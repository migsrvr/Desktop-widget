import type { ProviderAllowance } from '@workpulse/shared';

export const PROVIDERS = [{ id: 'codex', name: 'Codex' }, { id: 'claude', name: 'Claude' }, { id: 'gemini', name: 'Gemini' }] as const;
const MAX_AGE_MS = 15 * 60_000;

/** Only explicit provider readings are accepted; local active-time estimates are incompatible. */
export function parseProviderAllowance(value: unknown): ProviderAllowance | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (!PROVIDERS.some(p => p.id === v.provider) || typeof v.usedPercent !== 'number' || !Number.isFinite(v.usedPercent) || v.usedPercent < 0 || v.usedPercent > 100 || typeof v.observedAt !== 'string' || !Number.isFinite(Date.parse(v.observedAt))) return null;
  if (v.resetAt !== null && (typeof v.resetAt !== 'string' || !Number.isFinite(Date.parse(v.resetAt)))) return null;
  return { provider: v.provider as ProviderAllowance['provider'], usedPercent: v.usedPercent, observedAt: v.observedAt, resetAt: v.resetAt as string | null,
    ...(typeof v.plan === 'string' ? { plan: v.plan.slice(0, 80) } : {}), ...(typeof v.window === 'string' ? { window: v.window.slice(0, 80) } : {}) };
}

export function getAllowanceDisplay(reading: ProviderAllowance | null | undefined, now: number, connected: boolean) {
  const unavailable = { available: false, used: null, remaining: null, reset: 'Reset unavailable', low: false } as const;
  if (!reading || !connected) return unavailable;
  const age = now - Date.parse(reading.observedAt);
  if (age < -60_000 || age > MAX_AGE_MS || (reading.resetAt && Date.parse(reading.resetAt) <= now)) return unavailable;
  const used = Math.round(reading.usedPercent);
  const minutes = reading.resetAt ? Math.ceil((Date.parse(reading.resetAt) - now) / 60_000) : null;
  const reset = minutes === null ? 'Reset unavailable' : `Reset in ${minutes >= 60 ? `${Math.floor(minutes / 60)}h ` : ''}${minutes % 60}m`;
  return { available: true, used, remaining: 100 - used, reset, low: used >= 85 };
}
