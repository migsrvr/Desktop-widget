import type { ProviderUsageSnapshot, UsageConnectionState, UsageProvider, UsageSnapshot, UsageWindow } from '@workpulse/shared';

export const USAGE_PROVIDERS = [
  { id: 'codex', name: 'Codex', source: 'codex-app-server', sourceLabel: 'Codex App Server' },
  { id: 'claude', name: 'Claude', source: 'claude-statusline', sourceLabel: 'Claude Code' },
  { id: 'gemini', name: 'Gemini', source: 'antigravity-statusline', sourceLabel: 'Antigravity' },
] as const;
export const USAGE_STATE_LABELS: Record<UsageConnectionState, string> = { 'not-connected': 'Not connected', waiting: 'Waiting for reading', current: 'Current', stale: 'Stale', error: 'Error' };
export const USAGE_MAX_AGE = 15 * 60_000;

export function emptyUsage(): UsageSnapshot {
  const reading = (provider: UsageProvider, source: ProviderUsageSnapshot['source']): ProviderUsageSnapshot => ({ revision: 0, provider, source, status: 'not-connected', windows: [], plan: null, receivedAt: null, detail: null });
  return { codex: reading('codex', 'codex-app-server'), claude: reading('claude', 'claude-statusline'), gemini: reading('gemini', 'antigravity-statusline') };
}

export function getProviderState(provider: ProviderUsageSnapshot, now: number): UsageConnectionState {
  if (provider.status !== 'current' && provider.status !== 'stale') return provider.status;
  const age = provider.receivedAt ? now - Date.parse(provider.receivedAt) : NaN;
  if (!Number.isFinite(age) || age > USAGE_MAX_AGE || age < -60_000) return 'stale';
  if (provider.windows.length && provider.windows.every(w => w.resetAt !== null && Date.parse(w.resetAt) <= now)) return 'stale';
  return provider.status;
}

export function getUsageWindowDisplay(window: UsageWindow, provider: ProviderUsageSnapshot, now: number) {
  const unavailable = { available: false, used: null, remaining: null, amount: null, reset: 'Reset unavailable', low: false } as const;
  if (getProviderState(provider, now) !== 'current') return unavailable;
  const resetTime = window.resetAt === null ? null : Date.parse(window.resetAt);
  if (resetTime !== null && (!Number.isFinite(resetTime) || resetTime <= now)) return unavailable;
  const used = window.usedPercent !== null && Number.isFinite(window.usedPercent) && window.usedPercent >= 0 && window.usedPercent <= 100 ? window.usedPercent : null;
  const amount = window.remainingAmount !== null && Number.isFinite(window.remainingAmount) && window.remainingAmount >= 0 ? window.remainingAmount : null;
  if (used === null && amount === null) return unavailable;
  const minutes = resetTime === null ? null : Math.ceil((resetTime - now) / 60_000);
  const reset = minutes === null ? 'Reset unavailable' : `Reset in ${minutes >= 1440 ? `${Math.floor(minutes / 1440)}d ` : ''}${minutes >= 60 ? `${Math.floor(minutes / 60) % 24}h ` : ''}${minutes % 60}m`;
  return { available: true, used, remaining: used === null ? null : 100 - used, amount, reset, low: used !== null && used >= 85 };
}

export function selectSummaryWindow(provider: ProviderUsageSnapshot, now: number): UsageWindow | null {
  return provider.windows.filter(w => w.usedPercent !== null && getUsageWindowDisplay(w, provider, now).available)
    .sort((a, b) => (b.usedPercent! - a.usedPercent!) || a.id.localeCompare(b.id))[0] ?? null;
}

/** Native events are provider snapshots; delayed initial reads cannot replace newer events. */
export function mergeUsageSnapshot(previous: UsageSnapshot, incoming: UsageSnapshot): UsageSnapshot {
  const next = { ...previous };
  for (const { id } of USAGE_PROVIDERS) {
    const value = incoming[id];
    if (!value || value.provider !== id || !Array.isArray(value.windows)) continue;
    if ((value.revision ?? 0) < (previous[id].revision ?? 0)) continue;
    const oldTime = Date.parse(previous[id].receivedAt ?? '');
    const newTime = Date.parse(value.receivedAt ?? '');
    if (value.status === 'current' && previous[id].status === 'current' && newTime < oldTime) continue;
    next[id] = value;
  }
  return next;
}

export function providerFor(source: string): UsageProvider | null {
  return source === 'claude' ? 'claude' : source === 'antigravity' || source === 'gemini' ? 'gemini' : source === 'codex' ? 'codex' : null;
}
