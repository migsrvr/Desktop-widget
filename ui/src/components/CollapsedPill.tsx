import React from 'react';
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

  const isAiWorking =
    aiRun && (aiRun.status === 'WORKING' || aiRun.status === 'PLANNING' || aiRun.status === 'RUNNING_TOOLS');
  const isAiWaiting = aiRun && aiRun.status === 'WAITING_INPUT';

  return (
    <div
      onClick={onExpand}
      className="titlebar-drag-region"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 9,
        padding: '6px 12px 6px 10px',
        borderRadius: 'var(--radius-pill)',
        cursor: 'pointer',
        backgroundColor: 'rgba(18, 18, 20, 0.90)',
        backdropFilter: 'blur(40px) saturate(180%)',
        WebkitBackdropFilter: 'blur(40px) saturate(180%)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow: '0 16px 36px -6px rgba(0, 0, 0, 0.7), inset 0 1px 0 0 rgba(255, 255, 255, 0.12)',
        maxWidth: 340,
        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Monotone Breathing Status Dot */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span
          className={isAiWorking ? 'animate-mono-pulse' : ''}
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            backgroundColor: '#ffffff',
            opacity: isAiWorking ? 1 : isAiWaiting ? 0.9 : 0.4,
            display: 'inline-block',
          }}
          title={aiRun ? `AI: ${aiRun.status}` : 'WorkPulse Idle'}
        />
      </div>

      {/* Task Snippet */}
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

      {/* Monotone Ratio Badge e.g. 2 / 5 */}
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: '#ffffff',
          backgroundColor: 'rgba(255, 255, 255, 0.10)',
          padding: '2px 7px',
          borderRadius: 'var(--radius-pill)',
          border: '1px solid rgba(255, 255, 255, 0.14)',
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
          color: '#ffffff',
          padding: '3px 8px',
          borderRadius: 'var(--radius-pill)',
          backgroundColor: isTimerRunning ? 'rgba(255, 255, 255, 0.20)' : 'rgba(255, 255, 255, 0.08)',
          border: '1px solid rgba(255, 255, 255, 0.10)',
        }}
        title="Toggle focus timer"
      >
        <span>{formatTime(focusSeconds)}</span>
      </div>

      {/* Monotone Expand Symbol */}
      <span
        className="non-drag"
        style={{
          color: 'var(--text-tertiary)',
          fontSize: 10,
          fontWeight: 700,
          paddingLeft: 2,
        }}
      >
        ↗
      </span>
    </div>
  );
};
