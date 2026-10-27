import { useCallback, useEffect, useRef, useState } from 'react';
import type { FleetTelemetry, QuotaTrackerState, QuotaProvider } from '@workpulse/shared';
import { advanceQuota, createQuotaState, localQuotaDate } from '../utils/fleetTelemetry';

const STORAGE_KEY = 'workpulse_quota_v1';

function loadQuota(now: number): { state: QuotaTrackerState; date: string } {
  const fallback = { state: createQuotaState(now), date: localQuotaDate(now) };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    const state = saved?.state;
    if (!state || typeof saved.date !== 'string') return fallback;
    for (const provider of ['antigravity', 'openai'] as const) {
      const value = state[provider];
      if (!value || value.provider !== provider || !Number.isFinite(Date.parse(value.rollingWindowStartedAt))) return fallback;
      for (const key of ['rollingWindowHours', 'maxComputeSeconds', 'dailyMaxSeconds', 'usedComputeSeconds', 'dailyUsedSeconds']) {
        if (!Number.isFinite(value[key]) || value[key] < 0) return fallback;
      }
      if (value.rollingWindowHours <= 0 || value.maxComputeSeconds <= 0 || value.dailyMaxSeconds <= 0) return fallback;
    }
    if (!Number.isFinite(state.warningThresholdPercent) || !Number.isFinite(state.criticalThresholdPercent)) return fallback;
    return { state, date: saved.date };
  } catch { return fallback; }
}

export function useFleetTelemetry() {
  const [fleetTelemetry, storeFleetTelemetry] = useState<FleetTelemetry | null>(null);
  const [fleetReceivedAt, storeReceivedAt] = useState<number | null>(null);
  const [initial] = useState(() => loadQuota(Date.now()));
  const [quotaState, setQuotaState] = useState(initial.state);
  const ledger = useRef({ state: initial.state, date: initial.date, lastTick: Date.now(), telemetry: null as FleetTelemetry | null, receivedAt: null as number | null });

  const settle = useCallback((now: number) => {
    const current = ledger.current;
    current.state = advanceQuota(current.state, current.telemetry, current.lastTick, now, current.receivedAt, current.date);
    current.date = localQuotaDate(now);
    current.lastTick = now;
    setQuotaState(current.state);
  }, []);

  const setFleetTelemetry = useCallback((telemetry: FleetTelemetry) => {
    const now = Date.now();
    settle(now);
    ledger.current.telemetry = telemetry;
    ledger.current.receivedAt = now;
    storeFleetTelemetry(telemetry);
    storeReceivedAt(now);
  }, [settle]);

  useEffect(() => {
    settle(Date.now());
    const timer = window.setInterval(() => settle(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [settle]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: quotaState, date: ledger.current.date })); } catch {}
  }, [quotaState]);

  const resetQuotaWindow = useCallback((provider?: QuotaProvider) => {
    settle(Date.now());
    const current = ledger.current;
    for (const name of provider ? [provider] : ['antigravity', 'openai'] as const) {
      current.state = { ...current.state, [name]: { ...current.state[name], usedComputeSeconds: 0, rollingWindowStartedAt: new Date().toISOString() } };
    }
    setQuotaState(current.state);
  }, [settle]);

  const adjustQuotaLimit = useCallback((provider: QuotaProvider, hours: number) => {
    if (!Number.isFinite(hours) || hours <= 0) return;
    settle(Date.now());
    const current = ledger.current;
    current.state = { ...current.state, [provider]: { ...current.state[provider], maxComputeSeconds: hours * 3600 } };
    setQuotaState(current.state);
  }, [settle]);

  const calibrateQuota = useCallback((provider: QuotaProvider, hours: number) => {
    if (!Number.isFinite(hours) || hours < 0) return;
    settle(Date.now());
    const current = ledger.current;
    current.state = { ...current.state, [provider]: { ...current.state[provider], usedComputeSeconds: hours * 3600 } };
    setQuotaState(current.state);
  }, [settle]);

  return { fleetTelemetry, fleetReceivedAt, setFleetTelemetry, quotaState, resetQuotaWindow, calibrateQuota, adjustQuotaLimit };
}
