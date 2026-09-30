import React, { useState } from 'react';
import {
  Minimize2,
  Pin,
  PinOff,
  Volume2,
  VolumeX,
  Plus,
  ExternalLink,
  Layers,
  History,
} from 'lucide-react';
import { Task, TaskStatus, AiRun, TimelineEvent } from '@workpulse/shared';
import { AiRunCard } from './AiRunCard';
import { TaskList } from './TaskList';
import { FocusTimer } from './FocusTimer';
import { TimelineView } from './TimelineView';

interface ExpandedPanelProps {
  tasks: Task[];
  activeTask: Task | null;
  aiRun: AiRun | null;
  timeline: TimelineEvent[];
  completionPercentage: number;
  isAlwaysOnTop: boolean;
  isMuted: boolean;
  isTimerRunning: boolean;
  focusSeconds: number;
  onCollapse: () => void;
  onToggleAlwaysOnTop: () => void;
  onToggleMute: () => void;
  onToggleTimer: () => void;
  onResetTimer: () => void;
  onSelectActiveTask: (id: string) => void;
  onUpdateTaskStatus: (id: string, status: TaskStatus) => void;
  onDeleteTask: (id: string) => void;
  onAddTask: (title: string, status: TaskStatus) => void;
  onOpenIde?: () => void;
}

export const ExpandedPanel: React.FC<ExpandedPanelProps> = ({
  tasks,
  activeTask,
  aiRun,
  timeline,
  completionPercentage,
  isAlwaysOnTop,
  isMuted,
  isTimerRunning,
  focusSeconds,
  onCollapse,
  onToggleAlwaysOnTop,
  onToggleMute,
  onToggleTimer,
  onResetTimer,
  onSelectActiveTask,
  onUpdateTaskStatus,
  onDeleteTask,
  onAddTask,
  onOpenIde,
}) => {
  const [activeTab, setActiveTab] = useState<'tasks' | 'timeline'>('tasks');

  const now = new Date();
  const dayStr = now.toLocaleDateString([], { weekday: 'short' });
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const doneCount = tasks.filter((t) => t.status === 'DONE').length;
  const remainingCount = tasks.length - doneCount;

  return (
    <div
      className="acrylic-card"
      style={{
        width: 360,
        borderRadius: 'var(--radius-lg)',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        boxShadow: 'var(--shadow-acrylic)',
      }}
    >
      {/* Draggable Title Header */}
      <div
        className="titlebar-drag-region"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'grab',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 800, fontSize: 14, letterSpacing: '-0.3px', color: '#fff' }}>
            WorkPulse
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {dayStr} {timeStr}
          </span>
        </div>

        {/* Window controls */}
        <div className="non-drag" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            onClick={onToggleMute}
            className="btn-icon"
            title={isMuted ? 'Unmute haptics' : 'Mute haptics'}
          >
            {isMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
          </button>
          <button
            onClick={onToggleAlwaysOnTop}
            className="btn-icon"
            style={{ color: isAlwaysOnTop ? 'var(--accent-cyan)' : 'var(--text-dim)' }}
            title={isAlwaysOnTop ? 'Always on Top (Enabled)' : 'Always on Top (Disabled)'}
          >
            {isAlwaysOnTop ? <Pin size={13} /> : <PinOff size={13} />}
          </button>
          <button onClick={onCollapse} className="btn-icon" title="Collapse to pill">
            <Minimize2 size={13} />
          </button>
        </div>
      </div>

      {/* Progress Bar & Percentage */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600 }}>
          <span style={{ color: 'var(--text-muted)' }}>Today’s Progress</span>
          <span style={{ color: 'var(--accent-cyan)', fontFamily: 'JetBrains Mono, monospace' }}>
            {completionPercentage}%
          </span>
        </div>
        <div
          style={{
            height: 6,
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${completionPercentage}%`,
              background: 'linear-gradient(90deg, var(--accent-cyan), var(--accent-emerald))',
              borderRadius: 'var(--radius-full)',
              transition: 'width 0.4s ease',
            }}
          />
        </div>
      </div>

      {/* Active AI Execution Card */}
      <AiRunCard aiRun={aiRun} />

      {/* Focus Timer */}
      <FocusTimer
        seconds={focusSeconds}
        isRunning={isTimerRunning}
        onToggle={onToggleTimer}
        onReset={onResetTimer}
      />

      {/* Tab Navigation: Tasks vs Timeline */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: 4,
        }}
      >
        <button
          onClick={() => setActiveTab('tasks')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 11,
            fontWeight: 700,
            padding: '4px 8px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: activeTab === 'tasks' ? 'var(--bg-surface-hover)' : 'transparent',
            color: activeTab === 'tasks' ? 'var(--text-main)' : 'var(--text-dim)',
          }}
        >
          <Layers size={12} /> Today ({tasks.length})
        </button>
        <button
          onClick={() => setActiveTab('timeline')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 11,
            fontWeight: 700,
            padding: '4px 8px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: activeTab === 'timeline' ? 'var(--bg-surface-hover)' : 'transparent',
            color: activeTab === 'timeline' ? 'var(--text-main)' : 'var(--text-dim)',
          }}
        >
          <History size={12} /> Timeline ({timeline.length})
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'tasks' ? (
        <TaskList
          tasks={tasks}
          onSelectActive={onSelectActiveTask}
          onUpdateStatus={onUpdateTaskStatus}
          onDeleteTask={onDeleteTask}
          onAddTask={onAddTask}
        />
      ) : (
        <TimelineView timeline={timeline} />
      )}

      {/* Footer Metrics & Actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 8,
          borderTop: '1px solid var(--border-subtle)',
        }}
      >
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {doneCount} done · {remainingCount} remaining {aiRun ? '· 1 AI run' : ''}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => onAddTask('New Task', 'NOW')}
            className="btn-pill"
            title="Add immediate task"
          >
            <Plus size={11} /> Task
          </button>
          <button
            onClick={onOpenIde}
            className="btn-pill"
            style={{ color: 'var(--accent-cyan)' }}
            title="Open Current Task in IDE"
          >
            <ExternalLink size={11} /> Open IDE
          </button>
        </div>
      </div>
    </div>
  );
};
