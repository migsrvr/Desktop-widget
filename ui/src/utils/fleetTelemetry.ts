import type { FleetTelemetry, FleetSession, QuotaProvider, QuotaTrackerState, ProviderQuotaState } from '@workpulse/shared';

export const FLEET_FRESHNESS_MS = 5000;

/** Backend timestamps are Unix milliseconds; reject missing, invalid and future values. */
export function fleetTimestamp(value: number | undefined, now: number): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= now ? value : null;
}

export function isFleetFresh(telemetry: FleetTelemetry | null, now: number, receivedAt?: number | null): boolean {
  if (!telemetry) return false;
  const timestamp = Date.parse(telemetry.lastUpdated);
  return Number.isFinite(timestamp) && timestamp <= now + 30000 && now - timestamp < FLEET_FRESHNESS_MS
    && (receivedAt == null || (receivedAt <= now && now - receivedAt < FLEET_FRESHNESS_MS));
}

export function isFleetSessionWorking(session: FleetSession): boolean {
  return session.status === 'working' || session.status === 'running_tools';
}

export function fleetStatusLabel(session: FleetSession): string {
  switch (session.status) {
    case 'working': return 'Working';
    case 'running_tools': return 'Running tools';
    case 'idle': return 'Standby';
    case 'dead': return 'Offline';
    case 'waiting_input': return 'Waiting for input';
    default: return session.status || 'Unknown';
  }
}

export function fleetStatusElapsed(session: FleetSession, now: number): string {
  const timestamp = fleetTimestamp(session.lastStatusAt, now);
  if (timestamp === null) return 'Status time unavailable';
  const seconds = Math.floor((now - timestamp) / 1000);
  const elapsed = seconds < 60 ? `${seconds}s` : seconds < 3600 ? `${Math.floor(seconds / 60)}m` : `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `Status changed ${elapsed} ago`;
}

export function quotaProviderForSession(session: Pick<FleetSession, 'tool' | 'model'>): QuotaProvider | null {
  const tool = session.tool.toLowerCase();
  if (tool === 'antigravity') return 'antigravity';
  if (tool === 'codex' || tool === 'opencode') return 'openai';
  return null;
}

export function localQuotaDate(now: number): string {
  const date = new Date(now);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

export function createQuotaState(now: number): QuotaTrackerState {
  const provider = (name: QuotaProvider): ProviderQuotaState => ({
    provider: name, rollingWindowHours: 5, rollingWindowStartedAt: new Date(now).toISOString(),
    usedComputeSeconds: 0, maxComputeSeconds: 18000, dailyUsedSeconds: 0, dailyMaxSeconds: 86400,
  });
  return { antigravity: provider('antigravity'), openai: provider('openai'), warningThresholdPercent: 80, criticalThresholdPercent: 95 };
}

/** Only overlap with fresh telemetry is charged, once per provider regardless of worker count. */
export function advanceQuota(state: QuotaTrackerState, telemetry: FleetTelemetry | null, from: number, now: number, receivedAt: number | null, previousDate: string): QuotaTrackerState {
  const heartbeat = telemetry ? Date.parse(telemetry.lastUpdated) : NaN;
  const freshUntil = Number.isFinite(heartbeat) && heartbeat <= now + 30000 && receivedAt != null
    ? Math.min(heartbeat + FLEET_FRESHNESS_MS, receivedAt + FLEET_FRESHNESS_MS) : from;
  const active = new Map<QuotaProvider, string>();
  for (const session of telemetry?.sessions ?? []) {
    const provider = quotaProviderForSession(session);
    if (provider && isFleetSessionWorking(session)) active.set(provider, session.id);
  }
  const midnight = new Date(now); midnight.setHours(0, 0, 0, 0);
  const newDay = previousDate !== localQuotaDate(now);
  const update = (provider: QuotaProvider): ProviderQuotaState => {
    const current = state[provider];
    const start = Date.parse(current.rollingWindowStartedAt);
    const duration = current.rollingWindowHours * 3600000;
    const expired = !Number.isFinite(start) || now >= start + duration;
    const windowStart = expired
      ? Number.isFinite(start) && duration > 0 ? start + Math.floor((now - start) / duration) * duration : now
      : start;
    const activeFrom = Math.max(from, receivedAt ?? now);
    const end = Math.min(now, freshUntil);
    const elapsed = active.has(provider) ? Math.max(0, end - activeFrom) / 1000 : 0;
    const windowElapsed = active.has(provider) ? Math.max(0, end - Math.max(activeFrom, windowStart)) / 1000 : 0;
    const dailyElapsed = active.has(provider) ? Math.max(0, end - Math.max(activeFrom, midnight.getTime())) / 1000 : 0;
    return { ...current, rollingWindowStartedAt: new Date(windowStart).toISOString(),
      usedComputeSeconds: (expired ? 0 : current.usedComputeSeconds) + windowElapsed,
      dailyUsedSeconds: (newDay ? 0 : current.dailyUsedSeconds) + (newDay ? dailyElapsed : elapsed),
      lastActiveSessionId: active.get(provider) ?? current.lastActiveSessionId };
  };
  return { ...state, antigravity: update('antigravity'), openai: update('openai') };
}
