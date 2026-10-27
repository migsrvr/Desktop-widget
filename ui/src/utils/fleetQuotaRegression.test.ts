import { describe, expect, it } from 'vitest';
import type { FleetSession, FleetTelemetry } from '@workpulse/shared';
import {
  advanceQuota, createQuotaState, FLEET_FRESHNESS_MS, isFleetFresh,
  localQuotaDate, quotaProviderForSession,
} from './fleetTelemetry';

const NOW = Date.parse('2026-10-11T14:00:00Z');
const session = (id: string, status: string, overrides: Partial<FleetSession> = {}): FleetSession => ({
  id, name: `Agent ${id}`, tool: 'codex', status, lastStatusAt: NOW - 65000, ...overrides,
});
const fleet = (sessions: FleetSession[], lastUpdated = NOW): FleetTelemetry => ({
  groupName: 'Project fleet', sessions, lastUpdated: new Date(lastUpdated).toISOString(),
});

describe('fleet freshness and provider quota accounting', () => {
  it('rejects absent, invalid and expired heartbeats independently of status age', () => {
    expect(isFleetFresh(null, NOW)).toBe(false);
    expect(isFleetFresh({ ...fleet([]), lastUpdated: 'invalid' }, NOW)).toBe(false);
    expect(isFleetFresh(fleet([], NOW - FLEET_FRESHNESS_MS), NOW)).toBe(false);
    expect(isFleetFresh(fleet([], NOW), NOW, NOW - FLEET_FRESHNESS_MS)).toBe(false);
    expect(isFleetFresh(fleet([session('old-status', 'working', { lastStatusAt: 1 })]), NOW, NOW)).toBe(true);
  });

  it('charges wall-clock overlap once per active provider and excludes idle or unknown providers', () => {
    const telemetry = fleet([
      session('codex-1', 'working'), session('codex-2', 'running_tools'),
      session('gemini', 'working', { tool: 'antigravity' }),
      session('other', 'working', { tool: 'mystery', model: 'unknown-model' }),
    ]);
    const state = advanceQuota(createQuotaState(NOW), telemetry, NOW, NOW + 2000, NOW, localQuotaDate(NOW));
    expect(state.openai.usedComputeSeconds).toBe(2);
    expect(state.antigravity.usedComputeSeconds).toBe(2);
    expect(state.openai.dailyUsedSeconds).toBe(2);
    expect(quotaProviderForSession({ tool: 'mystery', model: 'unknown-model' })).toBeNull();
    const idle = advanceQuota(state, fleet([session('idle', 'idle')]), NOW + 2000, NOW + 3000, NOW + 2000, localQuotaDate(NOW));
    expect(idle.openai.usedComputeSeconds).toBe(2);
  });

  it('caps charging at heartbeat expiry and resumes without backfilling a disconnected gap', () => {
    const active = fleet([session('worker', 'working')]);
    const stale = advanceQuota(createQuotaState(NOW), active, NOW, NOW + 60000, NOW, localQuotaDate(NOW));
    expect(stale.openai.usedComputeSeconds).toBe(5);
    const resumed = advanceQuota(stale, fleet(active.sessions, NOW + 60000), NOW + 60000, NOW + 61000, NOW + 60000, localQuotaDate(NOW));
    expect(resumed.openai.usedComputeSeconds).toBe(6);
  });

  it('rolls the daily estimate at local midnight without resetting the current window', () => {
    const midnight = new Date(2026, 9, 12, 0, 0, 0, 0).getTime();
    const from = midnight - 1000;
    const initial = createQuotaState(from);
    initial.openai.dailyUsedSeconds = 120;
    initial.openai.usedComputeSeconds = 60;
    const state = advanceQuota(initial, fleet([session('worker', 'working')], from), from, midnight + 1000, from, localQuotaDate(from));
    expect(state.openai.dailyUsedSeconds).toBe(1);
    expect(state.openai.usedComputeSeconds).toBe(62);
  });

  it('preserves fixed five-hour boundaries and charges active time after a crossed boundary', () => {
    const initial = createQuotaState(NOW);
    initial.openai.usedComputeSeconds = 100;
    const boundary = NOW + 5 * 3600000;
    const from = boundary - 1000;
    const state = advanceQuota(initial, fleet([session('worker', 'working')], from), from, boundary + 500, from, localQuotaDate(from));
    expect(state.openai.rollingWindowStartedAt).toBe(new Date(boundary).toISOString());
    expect(state.openai.usedComputeSeconds).toBe(0.5);
  });
});
