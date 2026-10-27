import { describe, it, expect } from 'vitest';
import { parseProviderAllowance, getAllowanceDisplay } from './providerUsage';

const now = Date.parse('2026-10-26T10:00:00Z');
const reading = { provider: 'codex', usedPercent: 42, resetAt: '2026-10-26T12:18:00Z', observedAt: '2026-10-26T09:59:00Z', plan: 'Pro', window: '5 hours' };

describe('provider allowances', () => {
  it('rejects local estimates, unknown providers, invalid percentages and timestamps', () => {
    for (const input of [null, { provider: 'openai', usedPercent: 42 }, { ...reading, usedPercent: 101 }, { ...reading, usedPercent: -1 }, { ...reading, usedPercent: NaN }, { ...reading, observedAt: 'yesterday' }, { ...reading, resetAt: 'later' }]) {
      expect(parseProviderAllowance(input)).toBeNull();
    }
  });
  it('derives remaining allowance and reset countdown only from fresh verified readings', () => {
    const display = getAllowanceDisplay(parseProviderAllowance(reading), now, true);
    expect(display).toMatchObject({ available: true, used: 42, remaining: 58, reset: 'Reset in 2h 18m', low: false });
    expect(getAllowanceDisplay(parseProviderAllowance({ ...reading, usedPercent: 88 }), now, true).low).toBe(true);
  });
  it('never presents disconnected, stale, future or reset readings as current usage', () => {
    expect(getAllowanceDisplay(parseProviderAllowance(reading), now, false).available).toBe(false);
    expect(getAllowanceDisplay(parseProviderAllowance(reading), now + 16 * 60_000, true).available).toBe(false);
    expect(getAllowanceDisplay(parseProviderAllowance(reading), now - 5 * 60_000, true).available).toBe(false);
    expect(getAllowanceDisplay(parseProviderAllowance({ ...reading, resetAt: '2026-10-26T09:59:30Z' }), now, true).available).toBe(false);
    expect(getAllowanceDisplay(null, now, true)).toMatchObject({ available: false, used: null, remaining: null, reset: 'Reset unavailable' });
  });
  it('accepts zero usage and unknown reset without inventing reset information', () => {
    const display = getAllowanceDisplay(parseProviderAllowance({ ...reading, usedPercent: 0, resetAt: null }), now, true);
    expect(display).toMatchObject({ available: true, used: 0, remaining: 100, reset: 'Reset unavailable' });
  });
});
