import {
  formatQuotaCountdown,
  getQuotaColorState,
  type ProviderQuotaState,
  type QuotaColorState,
  type QuotaProvider,
} from '@workpulse/shared';

/**
 * Quota calculation engine for the rolling 5-hour provider windows.
 *
 * User requirement: strictly VISUAL color cues only — no audio beeps,
 * chimes, or haptic feedback are emitted from this module. Callers must
 * render color state via {@link QUOTA_VISUAL_COLORS}.
 */

export const ROLLING_WINDOW_DEFAULT_SECONDS = 5 * 3600; // 18000s

export const WARNING_THRESHOLD_PERCENT = 80;
export const CRITICAL_THRESHOLD_PERCENT = 95;

/** Visual-only color mapping for quota states (amber warning / red critical). */
export const QUOTA_VISUAL_COLORS: Record<QuotaColorState, string> = {
  normal: 'var(--session-accent-white)',
  warning: '#F5A623', // amber
  critical: '#FF453A', // red
};

export interface ProviderQuotaSummary {
  provider: QuotaProvider;
  percentage: number;
  remainingSeconds: number;
  countdown: string;
  colorState: QuotaColorState;
  /** CSS color for the visual-only cue. */
  visualColor: string;
}

/** Total rolling window size in seconds for a provider. */
export function getRollingWindowTotalSeconds(provider: ProviderQuotaState): number {
  if (provider.rollingWindowHours > 0) {
    return Math.floor(provider.rollingWindowHours * 3600);
  }
  return ROLLING_WINDOW_DEFAULT_SECONDS;
}

/** Elapsed seconds since the rolling window started (clamped >= 0). */
export function getRollingWindowElapsedSeconds(
  provider: ProviderQuotaState,
  nowMs: number = Date.now()
): number {
  const startedMs = Date.parse(provider.rollingWindowStartedAt);
  if (Number.isNaN(startedMs)) return 0;
  return Math.max(0, Math.floor((nowMs - startedMs) / 1000));
}

/** Remaining seconds before the rolling window resets (clamped >= 0). */
export function getRollingWindowRemainingSeconds(
  provider: ProviderQuotaState,
  nowMs: number = Date.now()
): number {
  const total = getRollingWindowTotalSeconds(provider);
  const elapsed = getRollingWindowElapsedSeconds(provider, nowMs);
  return Math.max(0, total - elapsed);
}

/** Burn percentage: used / max * 100. Returns 0 for non-positive max. */
export function getBurnPercentage(usedSeconds: number, maxSeconds: number): number {
  if (!maxSeconds || maxSeconds <= 0) return 0;
  if (!usedSeconds || usedSeconds <= 0) return 0;
  return (usedSeconds / maxSeconds) * 100;
}

/**
 * Visual color state for quota consumption.
 * Normal: < 80%, Warning: >= 80%, Critical: >= 95%.
 */
export function getThresholdState(
  usedSeconds: number,
  maxSeconds: number,
  warningThreshold: number = WARNING_THRESHOLD_PERCENT,
  criticalThreshold: number = CRITICAL_THRESHOLD_PERCENT
): QuotaColorState {
  return getQuotaColorState(usedSeconds, maxSeconds, warningThreshold, criticalThreshold);
}

/** Convenience predicates for callers that branch on visual state. */
export function isQuotaWarning(usedSeconds: number, maxSeconds: number): boolean {
  return getThresholdState(usedSeconds, maxSeconds) === 'warning';
}

export function isQuotaCritical(usedSeconds: number, maxSeconds: number): boolean {
  return getThresholdState(usedSeconds, maxSeconds) === 'critical';
}

/** Full per-provider summary: burn %, remaining countdown, and visual color. */
export function getProviderQuotaSummary(
  provider: ProviderQuotaState,
  nowMs: number = Date.now(),
  warningThreshold: number = WARNING_THRESHOLD_PERCENT,
  criticalThreshold: number = CRITICAL_THRESHOLD_PERCENT
): ProviderQuotaSummary {
  const percentage = getBurnPercentage(provider.usedComputeSeconds, provider.maxComputeSeconds);
  const remainingSeconds = getRollingWindowRemainingSeconds(provider, nowMs);
  const colorState = getThresholdState(
    provider.usedComputeSeconds,
    provider.maxComputeSeconds,
    warningThreshold,
    criticalThreshold
  );
  return {
    provider: provider.provider,
    percentage,
    remainingSeconds,
    countdown: formatQuotaCountdown(remainingSeconds),
    colorState,
    visualColor: QUOTA_VISUAL_COLORS[colorState],
  };
}
