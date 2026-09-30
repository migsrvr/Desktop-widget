import React from 'react';
import { Play, Pause, RotateCcw, Minus, Plus } from 'lucide-react';

interface FocusTimerProps {
  seconds: number;
  isRunning: boolean;
  targetMinutes: number;
  onToggle: () => void;
  onReset: () => void;
  onAdjustMinutes: (delta: number) => void;
}

export const FocusTimer: React.FC<FocusTimerProps> = ({
  seconds,
  isRunning,
  targetMinutes,
  onToggle,
  onReset,
  onAdjustMinutes,
}) => {
  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 10px',
        borderRadius: 'var(--radius-sm)',
        backgroundColor: 'rgba(0, 0, 0, 0.22)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
      }}
    >
      {/* Stepper on the left (matches Windows 11 Focus UI: [-] 30 mins [+]) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={() => onAdjustMinutes(-5)}
          disabled={isRunning || targetMinutes <= 5}
          className="apple-stepper-btn"
          style={{ opacity: isRunning || targetMinutes <= 5 ? 0.4 : 1 }}
          title="Decrease focus duration"
        >
          <Minus size={13} />
        </button>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 62 }}>
          {isRunning ? (
            <span
              style={{
                fontFamily: 'JetBrains Mono, SF Mono, monospace',
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--apple-blue)',
                letterSpacing: '0.4px',
              }}
            >
              {formatTime(seconds)}
            </span>
          ) : (
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              {targetMinutes} mins
            </span>
          )}
        </div>

        <button
          onClick={() => onAdjustMinutes(5)}
          disabled={isRunning || targetMinutes >= 180}
          className="apple-stepper-btn"
          style={{ opacity: isRunning || targetMinutes >= 180 ? 0.4 : 1 }}
          title="Increase focus duration"
        >
          <Plus size={13} />
        </button>
      </div>

      {/* Focus Action Pill on the right (matches [▶ Focus] in Windows 11 & Apple Action Button) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {isRunning && (
          <button
            onClick={onReset}
            className="apple-icon-btn"
            style={{ width: 26, height: 26 }}
            title="Reset timer"
          >
            <RotateCcw size={11} />
          </button>
        )}

        <button
          onClick={onToggle}
          className={`apple-btn-primary ${isRunning ? 'apple-btn-focus-active' : ''}`}
          title={isRunning ? 'Pause focus' : 'Start focus session'}
        >
          {isRunning ? (
            <>
              <Pause size={12} fill="currentColor" />
              <span>Pause</span>
            </>
          ) : (
            <>
              <Play size={12} fill="currentColor" />
              <span>Focus</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
