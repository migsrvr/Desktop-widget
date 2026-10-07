import React from 'react';
import { Task, TaskDisplayState, formatCountdown, mapTaskToDisplayState } from '@workpulse/shared';

interface CurrentSessionBannerProps {
  activeTask: Task | null;
  focusSeconds: number;
  targetMinutes: number;
  isTimerRunning: boolean;
  completionPercentage?: number;
}

export const CurrentSessionBanner: React.FC<CurrentSessionBannerProps> = ({
  activeTask,
  focusSeconds,
  targetMinutes,
  isTimerRunning,
  completionPercentage = 0,
}) => {
  const displayState: TaskDisplayState = mapTaskToDisplayState(activeTask, isTimerRunning);

  // Focus Countdown: remaining seconds from targetMinutes (or 00:00 when reached)
  const targetTotalSeconds = targetMinutes * 60;
  const remainingSeconds = Math.max(0, targetTotalSeconds - focusSeconds);
  const countdownStr = formatCountdown(remainingSeconds);

  // Status badge display label
  const getBadgeLabel = (state: TaskDisplayState): string => {
    switch (state) {
      case 'IN_FOCUS':
        return 'IN FOCUS';
      case 'PAUSED':
        return 'PAUSED';
      case 'COMPLETED':
        return 'COMPLETED';
      case 'READY':
      default:
        return 'READY';
    }
  };

  // Graduated progress blocks (10 segmented units e.g. [▮▮▮▯▯▯▯▯▯▯])
  const totalBlocks = 10;
  const filledBlocks = Math.min(
    totalBlocks,
    Math.max(0, Math.round((completionPercentage / 100) * totalBlocks))
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: '12px 14px',
        backgroundColor: 'var(--session-surface)',
        border: '1px solid var(--session-border)',
        borderRadius: 'var(--radius-md)',
        boxSizing: 'border-box',
        width: '100%',
      }}
    >
      {/* Top Meta Row */}
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
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: 'var(--session-text-secondary)',
            textTransform: 'uppercase',
          }}
        >
          CURRENT SESSION
        </span>

        {/* Status Badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '2px 8px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor:
              displayState === 'IN_FOCUS'
                ? 'var(--session-surface-active)'
                : 'rgba(255, 255, 255, 0.04)',
            border: `1px solid ${
              displayState === 'IN_FOCUS'
                ? 'var(--session-accent-white)'
                : 'var(--session-border)'
            }`,
          }}
        >
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              backgroundColor:
                displayState === 'IN_FOCUS'
                  ? 'var(--session-accent-white)'
                  : 'var(--session-text-secondary)',
              display: 'inline-block',
            }}
          />
          <span
            className="session-mono"
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.06em',
              color:
                displayState === 'IN_FOCUS'
                  ? '#FFFFFF'
                  : 'var(--session-text-secondary)',
            }}
          >
            {getBadgeLabel(displayState)}
          </span>
        </div>
      </div>

      {/* Hero Task Title & Large Dot-Matrix Countdown */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        {/* Task Title (Multi-line bold technical typography) */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2
            style={{
              fontSize: 15,
              fontWeight: 700,
              lineHeight: 1.25,
              letterSpacing: '-0.01em',
              color: 'var(--session-text-primary)',
              margin: 0,
              textTransform: 'uppercase',
              wordBreak: 'break-word',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
            title={activeTask ? activeTask.title : 'Ready for focus session'}
          >
            {activeTask ? activeTask.title : 'NO ACTIVE TASK SELECTED'}
          </h2>
        </div>

        {/* Large Dot-Matrix Countdown Display */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            flexShrink: 0,
          }}
        >
          <div
            className="session-display"
            style={{
              fontSize: 26,
              fontWeight: 700,
              lineHeight: 1,
              color: '#FFFFFF',
              letterSpacing: '0.08em',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {countdownStr}
          </div>
        </div>
      </div>

      {/* Graduated Progress Scale */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 4,
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
        }}
      >
        <div
          className="session-mono"
          style={{
            fontSize: 10,
            color: 'var(--session-text-secondary)',
            letterSpacing: '0.04em',
            userSelect: 'none',
          }}
        >
          {Array.from({ length: totalBlocks }).map((_, i) => (
            <span
              key={i}
              style={{
                color:
                  i < filledBlocks
                    ? 'var(--session-accent-white)'
                    : 'var(--session-border)',
                marginRight: 2,
              }}
            >
              {i < filledBlocks ? '▮' : '▯'}
            </span>
          ))}
        </div>

        <span
          className="session-mono"
          style={{
            fontSize: 10,
            color: 'var(--session-text-secondary)',
          }}
        >
          {completionPercentage}% DONE
        </span>
      </div>
    </div>
  );
};
