import React from 'react';
import { Play, Pause, Maximize2, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Task, AiRun } from '@workpulse/shared';

interface CollapsedPillProps {
  activeTask: Task | null;
  aiRun: AiRun | null;
  tasksCount: number;
  doneCount: number;
  focusSeconds: number;
  isTimerRunning: boolean;
  onExpand: () => void;
  onToggleTimer: (e: React.MouseEvent) => void;
}

export const CollapsedPill: React.FC<CollapsedPillProps> = ({
  activeTask,
  aiRun,
  tasksCount,
  doneCount,
  focusSeconds,
  isTimerRunning,
  onExpand,
  onToggleTimer,
}) => {
  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getAiIndicator = () => {
    if (!aiRun) return null;
    switch (aiRun.status) {
      case 'WORKING':
      case 'PLANNING':
      case 'RUNNING_TOOLS':
        return (
          <span
            className="animate-pulse-glow"
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: 'var(--accent-cyan)',
              color: 'var(--accent-cyan)',
              display: 'inline-block',
            }}
            title={`AI: ${aiRun.status}`}
          />
        );
      case 'WAITING_INPUT':
        return (
          <span
            className="animate-urgent-blink"
            style={{
              width: 9,
              height: 9,
              borderRadius: '50%',
              backgroundColor: 'var(--accent-amber)',
              display: 'inline-block',
            }}
            title="AI Waiting for your approval!"
          />
        );
      case 'COMPLETED':
        return (
          <span title="AI Run Completed" style={{ display: 'inline-flex' }}>
            <CheckCircle2
              size={12}
              style={{ color: 'var(--accent-emerald)' }}
            />
          </span>
        );
      default:
        return (
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              backgroundColor: 'var(--text-dim)',
              display: 'inline-block',
            }}
          />
        );
    }
  };

  return (
    <div
      onClick={onExpand}
      className="acrylic-card titlebar-drag-region"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: '6px 12px 6px 10px',
        borderRadius: 'var(--radius-full)',
        cursor: 'pointer',
        boxShadow: 'var(--shadow-acrylic)',
        border: '1px solid var(--border-subtle)',
        maxWidth: 320,
      }}
    >
      {/* AI Pulse Dot */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {getAiIndicator() || (
          <Sparkles size={13} style={{ color: 'var(--accent-cyan)', opacity: 0.8 }} />
        )}
      </div>

      {/* Current Task Snippet */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          minWidth: 80,
          maxWidth: 140,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            color: 'var(--text-main)',
          }}
        >
          {activeTask ? activeTask.title : 'No active task'}
        </span>
      </div>

      {/* Progress count e.g. 2 / 5 */}
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: 'var(--accent-cyan)',
          backgroundColor: 'rgba(56, 189, 248, 0.1)',
          padding: '2px 6px',
          borderRadius: 'var(--radius-full)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
        }}
      >
        {doneCount}/{tasksCount}
      </div>

      {/* Focus Timer */}
      <div
        onClick={onToggleTimer}
        className="non-drag"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 11,
          fontFamily: 'JetBrains Mono, monospace',
          color: 'var(--text-muted)',
          padding: '2px 6px',
          borderRadius: 'var(--radius-sm)',
          backgroundColor: 'var(--bg-surface)',
        }}
        title="Toggle focus timer"
      >
        {isTimerRunning ? <Pause size={10} /> : <Play size={10} />}
        <span>{formatTime(focusSeconds)}</span>
      </div>

      {/* Expand Icon */}
      <button
        onClick={onExpand}
        className="btn-icon non-drag"
        style={{ width: 20, height: 20, padding: 0 }}
        title="Expand panel"
      >
        <Maximize2 size={11} />
      </button>
    </div>
  );
};
