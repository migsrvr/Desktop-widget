import React from 'react';
import { Task, ViewMode, formatCountdown } from '@workpulse/shared';
import { TransportBar } from './TransportBar';

interface FocusViewProps {
  activeTask: Task | null;
  focusSeconds: number;
  targetMinutes: number;
  isTimerRunning: boolean;
  viewMode: ViewMode;
  onToggleTimer: () => void;
  onAdjustMinutes: (delta: number) => void;
  onCompleteActiveTask: () => void;
  onSelectViewMode: (mode: ViewMode) => void;
  onOpenIde?: () => void;
}

export const FocusView: React.FC<FocusViewProps> = ({
  activeTask,
  focusSeconds,
  targetMinutes,
  isTimerRunning,
  viewMode,
  onToggleTimer,
  onAdjustMinutes,
  onCompleteActiveTask,
  onSelectViewMode,
  onOpenIde,
}) => {
  const targetTotalSeconds = targetMinutes * 60;
  const remainingSeconds = Math.max(0, targetTotalSeconds - focusSeconds);
  const countdownStr = formatCountdown(remainingSeconds);

  return (
    <div
      className="session-window-frame"
      style={{
        width: '100%',
        height: '100%',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        boxSizing: 'border-box',
      }}
    >
      {/* Title Bar Drag Region */}
      <div
        data-tauri-drag-region
        className="titlebar-drag-region"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'grab',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            className="session-display"
            style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF', letterSpacing: '0.06em' }}
          >
            SESSION
          </span>
          <span
            className="session-mono"
            style={{ fontSize: 10, color: 'var(--session-text-secondary)', letterSpacing: '0.05em' }}
          >
            / FOCUS MODE
          </span>
        </div>

        <div className="non-drag" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            onClick={() => onSelectViewMode('BOARD')}
            className="session-btn"
            style={{ fontSize: 10, padding: '2px 7px' }}
            title="Return to Board"
          >
            BOARD ↗
          </button>
        </div>
      </div>

      {/* Hero Task Title */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minHeight: 40 }}>
        <span
          className="session-mono"
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: 'var(--session-text-secondary)',
            letterSpacing: '0.08em',
          }}
        >
          ACTIVE FOCUS
        </span>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: 'var(--session-text-primary)',
            textTransform: 'uppercase',
            lineHeight: 1.3,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={activeTask ? activeTask.title : 'No active task selected'}
        >
          {activeTask ? activeTask.title : 'NO ACTIVE TASK SELECTED'}
        </div>
      </div>

      {/* Massive Dot-Matrix Countdown */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '10px 0',
          backgroundColor: 'var(--session-surface)',
          border: '1px solid var(--session-border)',
          borderRadius: 'var(--radius-sm)',
        }}
      >
        <span
          className="session-display"
          style={{
            fontSize: 42,
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: '#FFFFFF',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {countdownStr}
        </span>
      </div>

      {/* Transport Bar */}
      <TransportBar
        isTimerRunning={isTimerRunning}
        targetMinutes={targetMinutes}
        viewMode={viewMode}
        onToggleTimer={onToggleTimer}
        onAdjustMinutes={onAdjustMinutes}
        onCompleteActiveTask={onCompleteActiveTask}
        onSelectViewMode={onSelectViewMode}
        onOpenIde={onOpenIde}
        hasActiveTask={!!activeTask}
      />
    </div>
  );
};
