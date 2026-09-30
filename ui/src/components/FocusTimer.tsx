import React from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

interface FocusTimerProps {
  seconds: number;
  isRunning: boolean;
  onToggle: () => void;
  onReset: () => void;
}

export const FocusTimer: React.FC<FocusTimerProps> = ({
  seconds,
  isRunning,
  onToggle,
  onReset,
}) => {
  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 10px',
        borderRadius: 'var(--radius-sm)',
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: isRunning ? 'var(--accent-emerald)' : 'var(--text-dim)',
          }}
        />
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Focus Session</span>
        <span
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text-main)',
            letterSpacing: '0.5px',
          }}
        >
          {formatTime(seconds)}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button
          onClick={onToggle}
          className="btn-icon"
          style={{
            color: isRunning ? 'var(--accent-amber)' : 'var(--accent-emerald)',
          }}
          title={isRunning ? 'Pause' : 'Start'}
        >
          {isRunning ? <Pause size={12} /> : <Play size={12} />}
        </button>
        <button onClick={onReset} className="btn-icon" title="Reset">
          <RotateCcw size={12} />
        </button>
      </div>
    </div>
  );
};
