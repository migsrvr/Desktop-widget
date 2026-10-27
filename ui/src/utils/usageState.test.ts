import { describe, expect, it } from 'vitest';
import { emptyUsage, getProviderState, selectSummaryWindow, getUsageWindowDisplay, mergeUsageSnapshot } from './usageState';

const now = Date.parse('2026-10-26T10:00:00Z');
const window = (id: string, usedPercent: number | null, resetAt: string | null = '2026-10-26T12:00:00Z') => ({ id, label: id, usedPercent, remainingAmount: null, unit: null, resetAt });
const current = () => ({ ...emptyUsage().codex, status: 'current' as const, receivedAt: '2026-10-26T09:59:00Z', windows: [window('5-hour', 20), window('Weekly', 90)] });

describe('native provider usage state', () => {
  it('selects the most constrained valid window without collapsing independent windows', () => {
    const provider = current();
    expect(selectSummaryWindow(provider, now)?.id).toBe('Weekly');
    expect(provider.windows).toHaveLength(2);
    expect(getUsageWindowDisplay(provider.windows[1], provider, now)).toMatchObject({ used: 90, remaining: 10, low: true });
  });
  it('never raises current alerts from stale, disconnected or expired data', () => {
    expect(getProviderState(current(), now + 16 * 60_000)).toBe('stale');
    expect(selectSummaryWindow(current(), now + 16 * 60_000)).toBeNull();
    expect(selectSummaryWindow({ ...current(), status: 'not-connected' }, now)).toBeNull();
    expect(selectSummaryWindow({ ...current(), windows: [window('Expired', 100, '2026-10-26T09:59:30Z')] }, now)).toBeNull();
  });
  it('keeps absolute readings separate and unknown usage distinct from zero', () => {
    const provider = { ...current(), windows: [{ ...window('Requests', null, null), remainingAmount: 12, unit: 'requests' }, window('Unknown', null), window('Unused', 0)] };
    expect(selectSummaryWindow(provider, now)?.id).toBe('Unused');
    expect(getUsageWindowDisplay(provider.windows[0], provider, now)).toMatchObject({ available: true, used: null, remaining: null, amount: 12, low: false });
    expect(getUsageWindowDisplay(provider.windows[1], provider, now).available).toBe(false);
    expect(getUsageWindowDisplay(provider.windows[2], provider, now).remaining).toBe(100);
  });
  it('does not let delayed reads overwrite newer provider state or affect another provider', () => {
    const existing = { ...emptyUsage(), codex: current() };
    const older = { ...current(), receivedAt: '2026-10-26T09:50:00Z', windows: [window('5-hour', 1)] };
    expect(mergeUsageSnapshot(existing, { ...emptyUsage(), codex: older }).codex.windows).toEqual(existing.codex.windows);
    expect(mergeUsageSnapshot(existing, { ...existing, claude: { ...existing.claude, status: 'error', detail: 'CLI missing' } }).codex).toEqual(existing.codex);
  });
  it('does not revive a disconnected account from a delayed native command response', () => {
    const existing = { ...emptyUsage(), codex: { ...emptyUsage().codex, revision: 3 } };
    const delayed = { ...emptyUsage(), codex: { ...current(), revision: 2 } };
    expect(mergeUsageSnapshot(existing, delayed).codex.status).toBe('not-connected');
  });
});
