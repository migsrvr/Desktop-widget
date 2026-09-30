import React from 'react';
import { Play, Pause, Maximize2, Sparkles, CheckCircle2 } from 'lucide-react';
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
              backgroundColor: 'var(--apple-cyan)',
              color: 'var(--apple-cyan)',
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
              backgroundColor: 'var(--apple-amber)',
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
              style={{ color: 'var(--apple-emerald)' }}
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
              backgroundColor: 'var(--text-tertiary)',
              display: 'inline-block',
            }}
          />
        );
    }
  };

  return (
    <div
      onClick={onExpand}
      className="titlebar-drag-region"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: '6px 12px 6px 10px',
        borderRadius: 'var(--radius-pill)',
        cursor: 'pointer',
        backgroundColor: 'rgba(18, 18, 22, 0.90)',
        backdropFilter: 'blur(40px) saturate(180%)',
        WebkitBackdropFilter: 'blur(40px) saturate(180%)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow: '0 16px 36px -6px rgba(0, 0, 0, 0.7), inset 0 1px 0 0 rgba(255, 255, 255, 0.15)',
        maxWidth: 340,
        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Apple Dynamic Island Live Indicator Orb */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {getAiIndicator() || (
          <Sparkles size={13} style={{ color: 'var(--apple-blue)', opacity: 0.9 }} />
        )}
      </div>

      {/* Current Task Title */}
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
            color: '#ffffff',
          }}
        >
          {activeTask ? activeTask.title : 'No active task'}
        </span>
      </div>

      {/* Progress Capsule Badge e.g. 2 / 5 */}
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: 'var(--apple-blue)',
          backgroundColor: 'rgba(10, 132, 255, 0.14)',
          padding: '2px 7px',
          borderRadius: 'var(--radius-pill)',
          border: '1px solid rgba(10, 132, 255, 0.28)',
        }}
      >
        {doneCount}/{tasksCount}
      </div>

      {/* Focus Timer Capsule */}
      <div
        onClick={onToggleTimer}
        className="non-drag"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 11,
          fontFamily: 'JetBrains Mono, SF Mono, monospace',
          color: isTimerRunning ? '#ffffff' : 'var(--text-secondary)',
          padding: '3px 7px',
          borderRadius: 'var(--radius-pill)',
          backgroundColor: isTimerRunning ? 'rgba(10, 132, 255, 0.25)' : 'rgba(255, 255, 255, 0.08)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
        title="Toggle focus timer"
      >
        {isTimerRunning ? <Pause size={9} fill="currentColor" /> : <Play size={9} fill="currentColor" />}
        <span>{formatTime(focusSeconds)}</span>
      </div>

      {/* Apple-style Expand icon */}
      <button
        onClick={onExpand}
        className="apple-icon-btn non-drag"
        style={{ width: 20, height: 20, padding: 0, border: 'none', background: 'transparent' }}
        title="Expand panel"
      >
        <Maximize2 size={11} />
      </button>
    </div>
  );
};
