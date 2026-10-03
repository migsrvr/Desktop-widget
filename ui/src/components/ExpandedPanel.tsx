import React, { useState } from 'react';
import { Task, TaskStatus, AiRun, TimelineEvent, SpotifyTrack, SpotifyPlaybackAction, ScreenMode, ScreenFrameMeta, VisionInference, OperatorActionProposal } from '@workpulse/shared';
import { AiRunCard } from './AiRunCard';
import { TaskList } from './TaskList';
import { FocusTimer } from './FocusTimer';
import { TimelineView } from './TimelineView';
import { SpotifyPlayerCard } from './SpotifyPlayerCard';
import { OperatorCard } from './OperatorCard';

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
  onDockTopRight?: () => void;
  isDocked?: boolean;
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
  isBridgeConnected?: boolean;
  spotifyTrack?: SpotifyTrack | null;
  isSpotifyConnected?: boolean;
  isSpotifyConnecting?: boolean;
  onOpenSpotifySetup?: () => void;
  onSpotifyControl?: (action: SpotifyPlaybackAction) => void;
  operatorWatching?: boolean;
  operatorMode?: ScreenMode;
  operatorFrame?: ScreenFrameMeta | null;
  operatorInference?: VisionInference | null;
  operatorProposal?: OperatorActionProposal | null;
  operatorThumbUrl?: string;
  onToggleOperatorWatching?: () => void;
  onOperatorModeChange?: (mode: ScreenMode) => void;
  onOperatorCapture?: () => void;
  onOperatorApprove?: () => void;
  onOperatorDeny?: () => void;
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
  onDockTopRight,
  isDocked = false,
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
  isBridgeConnected = false,
  spotifyTrack,
  isSpotifyConnected,
  isSpotifyConnecting,
  onOpenSpotifySetup,
  onSpotifyControl,
  operatorWatching,
  operatorMode,
  operatorFrame,
  operatorInference,
  operatorProposal,
  operatorThumbUrl,
  onToggleOperatorWatching,
  onOperatorModeChange,
  onOperatorCapture,
  onOperatorApprove,
  onOperatorDeny,
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
        maxWidth: 400,
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        boxSizing: 'border-box',
      }}
    >
      {/* Title Header with Monotone Window Controls (drag to move, double-click to dock top-right) */}
      <div
        data-tauri-drag-region
        className="titlebar-drag-region"
        onDoubleClick={onDockTopRight}
        title="Drag to move · Double-click to dock top-right"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'grab',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flexShrink: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: '-0.3px', color: '#ffffff' }}>
              WorkPulse
            </span>
            <span
              style={{
                fontSize: 11,
                fontFamily: 'JetBrains Mono, monospace',
                color: 'var(--text-tertiary)',
                whiteSpace: 'nowrap',
              }}
            >
              {timeStr}
            </span>
          </div>
          <span
            style={{
              fontSize: 11,
              color: 'var(--text-secondary)',
              marginTop: 1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {fullDateStr}
          </span>
        </div>

        {/* Monotone Header Action Buttons (No bulky multi-color icons) */}
        <div className="non-drag" style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          <button
            onClick={onToggleMute}
            className={`apple-btn-text ${isMuted ? '' : 'active'}`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? 'Muted' : 'Sound'}
          </button>
          {onDockTopRight && (
            <button
              onClick={onDockTopRight}
              className={`apple-btn-text ${isDocked ? 'active' : ''}`}
              title={isDocked ? 'Docked top-right' : 'Dock to top-right corner'}
            >
              Dock
            </button>
          )}
          <button
            onClick={onToggleAlwaysOnTop}
            className={`apple-btn-text ${isAlwaysOnTop ? 'active' : ''}`}
            title="Always on Top"
          >
            Pin
          </button>
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

      {/* Workload Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.2px', color: '#ffffff' }}>
            Today’s Workload
          </span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: '#ffffff',
              fontFamily: 'JetBrains Mono, SF Mono, monospace',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {completionPercentage}%
          </span>
        </div>
        <div
          style={{
            height: 6,
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
      <AiRunCard aiRun={aiRun} timeline={timeline} />

      {/* Screen Operator Card */}
      {onToggleOperatorWatching && operatorMode && (
        <OperatorCard
          watching={!!operatorWatching}
          mode={operatorMode}
          lastFrame={operatorFrame ?? null}
          inference={operatorInference ?? null}
          proposal={operatorProposal ?? null}
          thumbUrl={operatorThumbUrl ?? ''}
          onToggleWatching={onToggleOperatorWatching}
          onModeChange={onOperatorModeChange ?? (() => {})}
          onCaptureNow={onOperatorCapture ?? (() => {})}
          onApprove={onOperatorApprove ?? (() => {})}
          onDeny={onOperatorDeny ?? (() => {})}
        />
      )}

      {/* Spotify Music Card */}
      {onOpenSpotifySetup && onSpotifyControl && (
        <SpotifyPlayerCard
          track={spotifyTrack ?? null}
          isConnected={!!isSpotifyConnected}
          isConnecting={!!isSpotifyConnecting}
          onOpenSetup={onOpenSpotifySetup}
          onControl={onSpotifyControl}
        />
      )}

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
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-tertiary)' }}>
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              backgroundColor: isBridgeConnected ? '#ffffff' : 'rgba(255, 255, 255, 0.3)',
              display: 'inline-block',
            }}
            title={isBridgeConnected ? 'IDE bridge online' : 'IDE bridge offline'}
          />
          {doneCount} done · {remainingCount} remaining
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
