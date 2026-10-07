import React from 'react';
import { ViewMode } from '@workpulse/shared';

interface TransportBarProps {
  isTimerRunning: boolean;
  targetMinutes: number;
  viewMode: ViewMode;
  onToggleTimer: () => void;
  onAdjustMinutes: (delta: number) => void;
  onCompleteActiveTask: () => void;
  onSelectViewMode: (mode: ViewMode) => void;
  onOpenIde?: () => void;
  hasActiveTask: boolean;
}

export const TransportBar: React.FC<TransportBarProps> = ({
  isTimerRunning,
  targetMinutes,
  viewMode,
  onToggleTimer,
  onAdjustMinutes,
  onCompleteActiveTask,
  onSelectViewMode,
  onOpenIde,
  hasActiveTask,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        width: '100%',
        boxSizing: 'border-box',
        paddingTop: 2,
      }}
    >
      {/* Top Transport Strip: [ START / PAUSE ]    − 30 MIN +    [ COMPLETE ] */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        {/* START / PAUSE Toggle Button */}
        <button
          onClick={onToggleTimer}
          className="session-btn-primary"
          style={{
            flex: 1,
            padding: '7px 10px',
            fontSize: 11,
            letterSpacing: '0.04em',
            textAlign: 'center',
          }}
          title={isTimerRunning ? 'Pause focus timer' : 'Start focus timer'}
        >
          {isTimerRunning ? 'PAUSE' : 'START / PAUSE'}
        </button>

        {/* Stepper: − 30 MIN + */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            backgroundColor: 'var(--session-surface)',
            border: '1px solid var(--session-border)',
            borderRadius: 'var(--radius-sm)',
            padding: '2px 6px',
          }}
        >
          <button
            onClick={() => onAdjustMinutes(-5)}
            disabled={isTimerRunning || targetMinutes <= 5}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--session-text-primary)',
              fontSize: 14,
              fontWeight: 700,
              cursor: isTimerRunning || targetMinutes <= 5 ? 'default' : 'pointer',
              opacity: isTimerRunning || targetMinutes <= 5 ? 0.3 : 1,
              padding: '0 4px',
            }}
            title="Decrease duration by 5 minutes"
          >
            −
          </button>

          <span
            className="session-mono"
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: '#FFFFFF',
              minWidth: 50,
              textAlign: 'center',
              userSelect: 'none',
            }}
          >
            {targetMinutes} MIN
          </span>

          <button
            onClick={() => onAdjustMinutes(5)}
            disabled={isTimerRunning || targetMinutes >= 180}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--session-text-primary)',
              fontSize: 14,
              fontWeight: 700,
              cursor: isTimerRunning || targetMinutes >= 180 ? 'default' : 'pointer',
              opacity: isTimerRunning || targetMinutes >= 180 ? 0.3 : 1,
              padding: '0 4px',
            }}
            title="Increase duration by 5 minutes"
          >
            +
          </button>
        </div>

        {/* [ COMPLETE ] Active Task Action */}
        <button
          onClick={onCompleteActiveTask}
          disabled={!hasActiveTask}
          className="session-btn"
          style={{
            padding: '7px 12px',
            fontSize: 11,
            letterSpacing: '0.04em',
            opacity: hasActiveTask ? 1 : 0.4,
            cursor: hasActiveTask ? 'pointer' : 'default',
          }}
          title={hasActiveTask ? 'Mark current active task complete' : 'No active task selected'}
        >
          COMPLETE
        </button>
      </div>

      {/* Bottom Switcher Strip: BOARD  FOCUS  DOCK           OPEN IDE */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '1px solid var(--session-border)',
          paddingTop: 8,
        }}
      >
        {/* Mode Switcher: BOARD vs DOCK */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            onClick={() => onSelectViewMode('BOARD')}
            className={`session-btn ${viewMode === 'BOARD' ? 'active' : ''}`}
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: '3px 10px',
              letterSpacing: '0.05em',
              fontFamily: 'var(--font-mono)',
              borderColor: viewMode === 'BOARD' ? 'var(--session-accent-white)' : 'var(--session-border)',
            }}
            title="Center Board on screen"
          >
            BOARD (CENTER)
          </button>
          <button
            onClick={() => onSelectViewMode('DOCK')}
            className={`session-btn ${viewMode === 'DOCK' || viewMode === 'FOCUS' ? 'active' : ''}`}
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: '3px 10px',
              letterSpacing: '0.05em',
              fontFamily: 'var(--font-mono)',
              borderColor: viewMode === 'DOCK' || viewMode === 'FOCUS' ? 'var(--session-accent-white)' : 'var(--session-border)',
            }}
            title="Dock Focus Mode to top-right"
          >
            DOCK (TOP-RIGHT)
          </button>
        </div>

        {/* OPEN IDE Action */}
        {onOpenIde && (
          <button
            onClick={onOpenIde}
            className="session-btn"
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: '3px 10px',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.04em',
              color: '#FFFFFF',
            }}
            title="Open active task in Antigravity / IDE"
          >
            OPEN IDE
          </button>
        )}
      </div>
    </div>
  );
};
