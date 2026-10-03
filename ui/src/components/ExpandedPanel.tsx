import React, { useState } from 'react';
import { Task, TaskStatus, AiRun, TimelineEvent } from '@workpulse/shared';
import { AiRunCard } from './AiRunCard';
import { TaskList } from './TaskList';
import { FocusTimer } from './FocusTimer';
import { TimelineView } from './TimelineView';

interface ExpandedPanelProps {
  tasks: Task[];
  pastCompletedTasks?: Task[];
  activeTask: Task | null;
  aiRun: AiRun | null;
  timeline: TimelineEvent[];
  completionPercentage: number;
  doneCount?: number;
  remainingCount?: number;
  isAlwaysOnTop: boolean;
  isMuted: boolean;
  isTimerRunning: boolean;
  focusSeconds: number;
  targetMinutes: number;
  onCollapse: () => void;
  onMinimizeToTaskbar?: () => void;
  onToggleAlwaysOnTop: () => void;
  onToggleMute: () => void;
  onToggleTimer: () => void;
  onResetTimer: () => void;
  onAdjustMinutes: (delta: number) => void;
  onSelectActiveTask: (id: string) => void;
  onUpdateTaskStatus: (id: string, status: TaskStatus) => void;
  onDeleteTask: (id: string) => void;
  onAddTask: (title: string, status: TaskStatus) => void;
  onClearPastTasks?: () => void;
  onOpenIde?: () => void;
}

export const ExpandedPanel: React.FC<ExpandedPanelProps> = ({
  tasks,
  pastCompletedTasks = [],
  activeTask,
  aiRun,
  timeline,
  completionPercentage,
  doneCount: propDoneCount,
  remainingCount: propRemainingCount,
  isAlwaysOnTop,
  isMuted,
  isTimerRunning,
  focusSeconds,
  targetMinutes,
  onCollapse,
  onMinimizeToTaskbar,
  onToggleAlwaysOnTop,
  onToggleMute,
  onToggleTimer,
  onResetTimer,
  onAdjustMinutes,
  onSelectActiveTask,
  onUpdateTaskStatus,
  onDeleteTask,
  onAddTask,
  onClearPastTasks,
  onOpenIde,
}) => {
  const [activeTab, setActiveTab] = useState<'tasks' | 'timeline'>('tasks');
  const [currentTime, setCurrentTime] = React.useState(new Date());

  React.useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fullDateStr = currentTime.toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const timeStr = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const doneCount =
    typeof propDoneCount === 'number'
      ? propDoneCount
      : tasks.filter((t) => t.status === 'DONE').length;
  const remainingCount =
    typeof propRemainingCount === 'number' ? propRemainingCount : tasks.length - doneCount;

  return (
    <div
      className="w11-acrylic-panel"
      style={{
        width: '100%',
        maxWidth: 360,
        padding: '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        boxSizing: 'border-box',
      }}
    >
      {/* Title Header with Monotone Window Controls */}
      <div
        className="titlebar-drag-region"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'grab',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: '-0.3px', color: '#ffffff' }}>
              WorkPulse
            </span>
            <span
              style={{
                fontSize: 11,
                fontFamily: 'JetBrains Mono, monospace',
                color: 'var(--text-tertiary)',
              }}
            >
              {timeStr}
            </span>
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>
            {fullDateStr}
          </span>
        </div>

        {/* Monotone Header Action Buttons (No bulky multi-color icons) */}
        <div className="non-drag" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <button
            onClick={onToggleMute}
            className={`apple-btn-text ${isMuted ? '' : 'active'}`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? 'Muted' : 'Sound'}
          </button>
          <button
            onClick={onToggleAlwaysOnTop}
            className={`apple-btn-text ${isAlwaysOnTop ? 'active' : ''}`}
            title="Always on Top"
          >
            Pin
          </button>
          {onMinimizeToTaskbar && (
            <button
              onClick={onMinimizeToTaskbar}
              className="apple-btn-text"
              style={{ padding: '3px 6px', fontSize: 10 }}
              title="Minimize to taskbar"
            >
              _
            </button>
          )}
          <button
            onClick={onCollapse}
            className="apple-btn-text"
            style={{ padding: '3px 7px', fontSize: 12 }}
            title="Collapse to compact pill"
          >
            −
          </button>
        </div>
      </div>

      {/* Monotone Progress Bar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600 }}>
          <span style={{ color: 'var(--text-secondary)' }}>Today’s Workload</span>
          <span style={{ color: '#ffffff', fontFamily: 'JetBrains Mono, SF Mono, monospace' }}>
            {completionPercentage}%
          </span>
        </div>
        <div
          style={{
            height: 4,
            borderRadius: 'var(--radius-pill)',
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${completionPercentage}%`,
              background: '#ffffff',
              borderRadius: 'var(--radius-pill)',
              transition: 'width 0.35s ease',
            }}
          />
        </div>
      </div>

      {/* AI Companion Card */}
      <AiRunCard aiRun={aiRun} />

      {/* Workload & Focus Panel */}
      <div
        className="w11-card"
        style={{
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {/* Monotone Typographic Segmented Control (No icons) */}
        <div className="apple-segmented-container">
          <button
            onClick={() => setActiveTab('tasks')}
            className={`apple-segmented-item ${activeTab === 'tasks' ? 'active' : ''}`}
          >
            Tasks ({tasks.length})
          </button>
          <button
            onClick={() => setActiveTab('timeline')}
            className={`apple-segmented-item ${activeTab === 'timeline' ? 'active' : ''}`}
          >
            Timeline ({timeline.length})
          </button>
        </div>

        {/* Tab Body */}
        {activeTab === 'tasks' ? (
          <TaskList
            tasks={tasks}
            pastCompletedTasks={pastCompletedTasks}
            onSelectActive={onSelectActiveTask}
            onUpdateStatus={onUpdateTaskStatus}
            onDeleteTask={onDeleteTask}
            onAddTask={onAddTask}
            onClearPastTasks={onClearPastTasks}
          />
        ) : (
          <TimelineView timeline={timeline} />
        )}

        {/* Focus Timer Stepper & Primary Action */}
        <FocusTimer
          seconds={focusSeconds}
          isRunning={isTimerRunning}
          targetMinutes={targetMinutes}
          onToggle={onToggleTimer}
          onReset={onResetTimer}
          onAdjustMinutes={onAdjustMinutes}
        />
      </div>

      {/* Footer Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 2,
          paddingLeft: 2,
          paddingRight: 2,
        }}
      >
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
          {doneCount} done · {remainingCount} remaining
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => onAddTask('New Task', 'NOW')}
            className="apple-btn-text"
            title="Add immediate task"
          >
            + Task
          </button>
          <button
            onClick={onOpenIde}
            className="apple-btn-text"
            style={{ color: '#ffffff' }}
            title="Open in IDE"
          >
            Open IDE
          </button>
        </div>
      </div>
    </div>
  );
};
