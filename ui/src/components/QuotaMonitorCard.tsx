import React from 'react';
import { QuotaTrackerState, type QuotaProvider } from '@workpulse/shared';
import {
  QUOTA_VISUAL_COLORS,
  getBurnPercentage,
  getProviderQuotaSummary,
  getRollingWindowRemainingSeconds,
} from '../utils/quotaCalculator';
import { formatQuotaCountdown } from '@workpulse/shared';

export interface QuotaMonitorCardProps {
  quota: QuotaTrackerState;
  onClose?: () => void;
  onResetWindow?: (provider?: 'antigravity' | 'openai') => void;
  onAdjustLimit?: (provider: 'antigravity' | 'openai', hours: number) => void;
  /** Which provider's countdown is shown large. Defaults to 'antigravity'. */
  selectedProvider?: QuotaProvider;
  /** Injected clock for deterministic rendering in tests. Defaults to Date.now(). */
  nowMs?: number;
  onSelectProvider?: (provider: QuotaProvider) => void;
}

/** Limit options offered by the adjustment selector (hours). */
export const QUOTA_LIMIT_OPTIONS = [
  { value: 1, label: '1h limit' },
  { value: 2.5, label: '2.5h limit' },
  { value: 5, label: '5h limit (default)' },
  { value: 10, label: '10h limit' },
];

const PROVIDER_LABELS: Record<QuotaProvider, string> = {
  antigravity: 'Antigravity',
  openai: 'OpenAI',
};

const SEGMENT_COUNT = 10;

function ProviderBar({
  provider,
  usedSeconds,
  maxSeconds,
}: {
  provider: QuotaProvider;
  usedSeconds: number;
  maxSeconds: number;
}) {
  const percentage = getBurnPercentage(usedSeconds, maxSeconds);
  const filled = Math.min(
    SEGMENT_COUNT,
    Math.max(0, Math.round((percentage / 100) * SEGMENT_COUNT))
  );
  const summary = getProviderQuotaSummary({
    provider,
    rollingWindowHours: 5,
    rollingWindowStartedAt: new Date().toISOString(),
    usedComputeSeconds: usedSeconds,
    maxComputeSeconds: maxSeconds,
    dailyUsedSeconds: 0,
    dailyMaxSeconds: 0,
  });
  const activeColor = QUOTA_VISUAL_COLORS[summary.colorState];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span
          className="session-mono"
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.06em',
            color: 'var(--session-text-primary)',
            textTransform: 'uppercase',
          }}
        >
          {PROVIDER_LABELS[provider]}
        </span>
        <span
          className="session-mono"
          style={{ fontSize: 12, fontWeight: 600, color: activeColor }}
        >
          {Math.round(percentage)}%
        </span>
      </div>
      <div
        className="session-mono"
        role="progressbar"
        aria-label={`${PROVIDER_LABELS[provider]} quota usage`}
        aria-valuenow={Math.round(percentage)}
        aria-valuemin={0}
        aria-valuemax={100}
        style={{
          fontSize: 12,
          letterSpacing: '0.04em',
          userSelect: 'none',
        }}
      >
        {Array.from({ length: SEGMENT_COUNT }).map((_, i) => (
          <span
            key={i}
            style={{
              color: i < filled ? activeColor : 'var(--session-border)',
              marginRight: 2,
            }}
          >
            {i < filled ? '▮' : '▯'}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * 320px quota pop-out flyout matching SESSION styling.
 * Visual color cues only — no audio or haptic alerts.
 */
export const QuotaMonitorCard: React.FC<QuotaMonitorCardProps> = ({
  quota,
  selectedProvider = 'antigravity',
  nowMs,
  onClose,
  onResetWindow,
  onAdjustLimit,
  onSelectProvider,
}) => {
  const now = nowMs ?? Date.now();
  const active = quota[selectedProvider];
  const activeLimitHours = active.maxComputeSeconds / 3600;
  const remaining = getRollingWindowRemainingSeconds(active, now);
  const countdown = formatQuotaCountdown(remaining);

  return (
    <div
      style={{
        width: 320,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: '12px 14px',
        backgroundColor: 'var(--session-surface)',
        border: '1px solid var(--session-border)',
        borderRadius: 'var(--radius-md)',
        boxSizing: 'border-box',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span
          className="session-mono"
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: 'var(--session-text-secondary)',
            textTransform: 'uppercase',
          }}
        >
          Quota Monitor
        </span>
        <button
          type="button"
          aria-label="Close quota monitor"
          onClick={() => onClose?.()}
          className="session-btn"
          style={{ padding: '2px 8px', fontSize: 12 }}
        >
          ✕
        </button>
      </div>

      {/* Provider tabs */}
      <div style={{ display: 'flex', gap: 6 }}>
        {(Object.keys(PROVIDER_LABELS) as QuotaProvider[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onSelectProvider?.(p)}
            className={`session-btn${p === selectedProvider ? ' active' : ''}`}
            aria-pressed={p === selectedProvider}
          >
            {PROVIDER_LABELS[p]}
          </button>
        ))}
      </div>

      {/* Large dot-matrix countdown for rolling 5h window reset */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 2,
        }}
      >
        <span
          className="session-mono"
          style={{
            fontSize: 11,
            letterSpacing: '0.08em',
            color: 'var(--session-text-secondary)',
            textTransform: 'uppercase',
          }}
        >
          Rolling 5h window resets in
        </span>
        <div
          className="session-display"
          style={{
            fontSize: 38,
            fontWeight: 700,
            lineHeight: 1,
            color: '#FFFFFF',
            letterSpacing: '0.08em',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {countdown}
        </div>
      </div>

      {/* Dual provider progress bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <ProviderBar
          provider="antigravity"
          usedSeconds={quota.antigravity.usedComputeSeconds}
          maxSeconds={quota.antigravity.maxComputeSeconds}
        />
        <ProviderBar
          provider="openai"
          usedSeconds={quota.openai.usedComputeSeconds}
          maxSeconds={quota.openai.maxComputeSeconds}
        />
      </div>

      {/* Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          paddingTop: 8,
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
        }}
      >
        <button
          type="button"
          className="session-btn"
          onClick={() => onResetWindow?.(selectedProvider)}
        >
          Reset Window
        </button>
        <label
          className="session-mono"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            color: 'var(--session-text-secondary)',
          }}
        >
          Limit
          <select
            aria-label="Quota limit"
            value={activeLimitHours}
            onChange={(e) => onAdjustLimit?.(selectedProvider, Number(e.target.value))}
            style={{
              backgroundColor: 'var(--session-surface-active)',
              color: 'var(--session-text-primary)',
              border: '1px solid var(--session-border)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 11,
              padding: '3px 6px',
            }}
          >
            {QUOTA_LIMIT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
            {!QUOTA_LIMIT_OPTIONS.some((o) => o.value === activeLimitHours) && (
              <option value={activeLimitHours}>
                Custom ({activeLimitHours}h)
              </option>
            )}
          </select>
        </label>
      </div>
    </div>
  );
};
