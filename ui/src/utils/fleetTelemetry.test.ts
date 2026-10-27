import { describe, expect, it } from 'vitest';
import type { FleetTelemetry, FleetSession } from '@workpulse/shared';
import { advanceQuota, createQuotaState, fleetStatusElapsed, isFleetFresh, localQuotaDate, quotaProviderForSession } from './fleetTelemetry';

const now = new Date(2026, 9, 11, 12).getTime();
const session: FleetSession = { id: 'lead', name: 'Real session', tool: 'codex', status: 'working', lastStatusAt: now - 3600000 };
const fleet = (sessions = [session], timestamp = now): FleetTelemetry => ({ groupName: 'Project', sessions, lastUpdated: new Date(timestamp).toISOString() });

describe('fleet telemetry freshness', () => {
  it('uses heartbeat freshness even when status has not changed for hours', () => {
    expect(isFleetFresh(fleet(), now, now)).toBe(true);
    expect(fleetStatusElapsed(session, now)).toBe('Status changed 1h 0m ago');
    expect(isFleetFresh(fleet(), now + 5000, now)).toBe(false);
    expect(isFleetFresh(null, now)).toBe(false);
  });
  it('rejects invalid clocks and caps freshness by local receipt time', () => {
    expect(isFleetFresh({ ...fleet(), lastUpdated: 'invalid' }, now)).toBe(false);
    expect(isFleetFresh(fleet([], now + 60000), now)).toBe(false);
    expect(isFleetFresh(fleet([], now + 1000), now, now - 5000)).toBe(false);
    expect(fleetStatusElapsed({ ...session, lastStatusAt: NaN }, now)).toBe('Status time unavailable');
    expect(fleetStatusElapsed({ ...session, lastStatusAt: now + 1 }, now)).toBe('Status time unavailable');
  });
});

describe('local quota estimates', () => {
  it('assigns provider buckets by approved tools regardless of model', () => {
    expect(quotaProviderForSession({ tool: 'antigravity' })).toBe('antigravity');
    expect(quotaProviderForSession({ tool: 'codex' })).toBe('openai');
    expect(quotaProviderForSession({ tool: 'opencode', model: 'openai/gpt-6.1-sol' })).toBe('openai');
    expect(quotaProviderForSession({ tool: 'opencode', model: 'muse-spark-1.3' })).toBe('openai');
    expect(quotaProviderForSession({ tool: 'opencode', model: 'Gemini 3.8 Flash' })).toBe('openai');
    expect(quotaProviderForSession({ tool: 'opencode' })).toBe('openai');
    expect(quotaProviderForSession({ tool: 'unknown', model: 'openai/gpt-6.1-sol' })).toBe(null);
  });
  it('counts concurrent provider workers once and stops at freshness expiry', () => {
    const value = advanceQuota(createQuotaState(now), fleet([session, { ...session, id: 'worker', tool: 'opencode', model: 'muse-spark-1.3' }]), now, now + 12000, now, localQuotaDate(now));
    expect(value.openai.usedComputeSeconds).toBe(5);
    expect(value.openai.dailyUsedSeconds).toBe(5);
    expect(value.antigravity.usedComputeSeconds).toBe(0);
  });
  it('does not charge idle or unknown sessions, or time before receipt', () => {
    expect(advanceQuota(createQuotaState(now), fleet([{ ...session, status: 'idle' }]), now, now + 1000, now, localQuotaDate(now)).openai.usedComputeSeconds).toBe(0);
    expect(advanceQuota(createQuotaState(now), fleet([{ ...session, tool: 'unknown', model: 'gpt-6.1-sol' }]), now, now + 1000, now, localQuotaDate(now)).openai.usedComputeSeconds).toBe(0);
    expect(advanceQuota(createQuotaState(now), fleet(), now - 10000, now + 1000, now, localQuotaDate(now)).openai.usedComputeSeconds).toBe(1);
  });
  it('resets expired fixed windows and local daily totals without counting offline time', () => {
    const state = createQuotaState(now - 6 * 3600000);
    state.openai.usedComputeSeconds = 100;
    state.openai.dailyUsedSeconds = 200;
    const value = advanceQuota(state, null, now, now, null, 'prior-day');
    expect(value.openai.usedComputeSeconds).toBe(0);
    expect(value.openai.dailyUsedSeconds).toBe(0);
    expect(Date.parse(value.openai.rollingWindowStartedAt)).toBe(now - 3600000);
  });
});
