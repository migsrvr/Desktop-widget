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
  ChevronDown,
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
  targetMinutes: number;
  onCollapse: () => void;
  onToggleAlwaysOnTop: () => void;
  onToggleMute: () => void;
  onToggleTimer: () => void;
  onResetTimer: () => void;
  onAdjustMinutes: (delta: number) => void;
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
  targetMinutes,
  onCollapse,
  onToggleAlwaysOnTop,
  onToggleMute,
  onToggleTimer,
  onResetTimer,
  onAdjustMinutes,
  onSelectActiveTask,
  onUpdateTaskStatus,
  onDeleteTask,
  onAddTask,
  onOpenIde,
}) => {
  const [activeTab, setActiveTab] = useState<'tasks' | 'timeline'>('tasks');

  const now = new Date();
  const fullDateStr = now.toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const doneCount = tasks.filter((t) => t.status === 'DONE').length;
  const remainingCount = tasks.length - doneCount;

  return (
    <div
      className="w11-acrylic-panel"
      style={{
        width: 360,
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {/* Windows 11 Header + Apple Glass Control Buttons */}
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
          <div
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              marginTop: 2,
            }}
          >
            <span>{fullDateStr}</span>
            <ChevronDown size={13} style={{ opacity: 0.7 }} />
          </div>
        </div>

        {/* Apple-style circular glass buttons */}
        <div className="non-drag" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={onToggleMute}
            className="apple-icon-btn"
            title={isMuted ? 'Unmute haptic sounds' : 'Mute haptic sounds'}
          >
            {isMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
          </button>
          <button
            onClick={onToggleAlwaysOnTop}
            className="apple-icon-btn"
            style={{ color: isAlwaysOnTop ? 'var(--apple-blue)' : 'var(--text-tertiary)' }}
            title={isAlwaysOnTop ? 'Always on Top (Enabled)' : 'Always on Top (Disabled)'}
          >
            {isAlwaysOnTop ? <Pin size={13} /> : <PinOff size={13} />}
          </button>
          <button onClick={onCollapse} className="apple-icon-btn" title="Collapse to floating pill">
            <Minimize2 size={13} />
          </button>
        </div>
      </div>

      {/* Daily Progress Bar (Apple Health / macOS style capsule) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600 }}>
          <span style={{ color: 'var(--text-secondary)' }}>Today’s Workload</span>
          <span style={{ color: 'var(--apple-blue)', fontFamily: 'JetBrains Mono, SF Mono, monospace' }}>
            {completionPercentage}%
          </span>
        </div>
        <div
          style={{
            height: 5,
            borderRadius: 'var(--radius-pill)',
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${completionPercentage}%`,
              background: 'linear-gradient(90deg, var(--apple-blue), var(--apple-emerald))',
              borderRadius: 'var(--radius-pill)',
              transition: 'width 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          />
        </div>
      </div>

      {/* Card 1: Elevated AI Companion Telemetry */}
      <AiRunCard aiRun={aiRun} />

      {/* Card 2: Workload & Focus Panel (Windows 11 Calendar & Focus style card) */}
      <div
        className="w11-card"
        style={{
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {/* Apple Segmented Control */}
        <div className="apple-segmented-container">
          <button
            onClick={() => setActiveTab('tasks')}
            className={`apple-segmented-item ${activeTab === 'tasks' ? 'active' : ''}`}
          >
            <Layers size={12} /> Tasks ({tasks.length})
          </button>
          <button
            onClick={() => setActiveTab('timeline')}
            className={`apple-segmented-item ${activeTab === 'timeline' ? 'active' : ''}`}
          >
            <History size={12} /> Timeline ({timeline.length})
          </button>
        </div>

        {/* Tab Body */}
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

        {/* Focus Timer Stepper & Primary Focus Button (Matches Windows 11 screenshot: [-] 30 mins [+] [▶ Focus]) */}
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
          paddingTop: 4,
          paddingLeft: 2,
          paddingRight: 2,
        }}
      >
        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
          {doneCount} done · {remainingCount} remaining
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => onAddTask('New Task', 'NOW')}
            className="apple-btn-primary"
            style={{ fontSize: 11, padding: '4px 10px' }}
            title="Add immediate task"
          >
            <Plus size={11} /> Task
          </button>
          <button
            onClick={onOpenIde}
            className="apple-btn-primary"
            style={{
              fontSize: 11,
              padding: '4px 10px',
              color: 'var(--apple-blue)',
            }}
            title="Open Current Task in IDE"
          >
            <ExternalLink size={11} /> Open IDE
          </button>
        </div>
      </div>
    </div>
  );
};
