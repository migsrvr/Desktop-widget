import React from 'react';

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
      {/* Stepper (Monotone: [-] 30 mins [+]) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={() => onAdjustMinutes(-5)}
          disabled={isRunning || targetMinutes <= 5}
          className="apple-stepper-btn"
          style={{ opacity: isRunning || targetMinutes <= 5 ? 0.3 : 1 }}
          title="Decrease minutes"
        >
          −
        </button>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 62 }}>
          {isRunning ? (
            <span
              style={{
                fontFamily: 'JetBrains Mono, SF Mono, monospace',
                fontSize: 13,
                fontWeight: 700,
                color: '#ffffff',
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
                color: 'var(--text-secondary)',
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
          style={{ opacity: isRunning || targetMinutes >= 180 ? 0.3 : 1 }}
          title="Increase minutes"
        >
          +
        </button>
      </div>

      {/* Focus / Pause Action */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {isRunning && (
          <button
            onClick={onReset}
            className="apple-btn-text"
            style={{ fontSize: 11, padding: '3px 8px' }}
            title="Reset timer"
          >
            Reset
          </button>
        )}

        <button
          onClick={onToggle}
          className={`apple-btn-primary ${isRunning ? 'apple-btn-focus-active' : ''}`}
          title={isRunning ? 'Pause focus session' : 'Start focus session'}
        >
          {isRunning ? 'Pause' : 'Focus'}
        </button>
      </div>
    </div>
  );
};
