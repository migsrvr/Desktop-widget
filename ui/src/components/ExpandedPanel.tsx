import React, { useState } from 'react';
import {
  Task,
  TaskStatus,
  AiRun,
  TimelineEvent,
  SpotifyTrack,
  SpotifyPlaybackAction,
  ScreenMode,
  ScreenFrameMeta,
  VisionInference,
  OperatorActionProposal,
  ViewMode,
} from '@workpulse/shared';
import { TaskList } from './TaskList';
import { CurrentSessionBanner } from './CurrentSessionBanner';
import { StudioConsole } from './StudioConsole';
import { TransportBar } from './TransportBar';
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
  viewMode?: ViewMode;
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
  onCompleteActiveTask?: () => void;
  onSelectViewMode?: (mode: ViewMode) => void;
  onOpenIde?: () => void;
  isBridgeConnected?: boolean;
  sidePanel?: 'spotify' | 'operator' | null;
  onToggleSidePanel?: (panel: 'spotify' | 'operator') => void;
  onCloseSidePanel?: () => void;
  spotifyTrack?: SpotifyTrack | null;
  isSpotifyConnected?: boolean;
  isSpotifyConnecting?: boolean;
  onOpenSpotifySetup?: () => void;
  onSpotifyControl?: (action: SpotifyPlaybackAction) => void;
  onDetectSpotifyLocal?: () => void;
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
  isAlwaysOnTop,
  isMuted,
  isTimerRunning,
  focusSeconds,
  targetMinutes,
  viewMode = 'BOARD',
  onCollapse,
  onDockTopRight,
  onMinimizeToTaskbar,
  onToggleAlwaysOnTop,
  onToggleMute,
  onToggleTimer,
  onAdjustMinutes,
  onSelectActiveTask,
  onUpdateTaskStatus,
  onDeleteTask,
  onAddTask,
  onClearPastTasks,
  onCompleteActiveTask = () => {},
  onSelectViewMode = () => {},
  onOpenIde,
  sidePanel = null,
  onCloseSidePanel,
  spotifyTrack,
  isSpotifyConnected,
  isSpotifyConnecting,
  onOpenSpotifySetup,
  onSpotifyControl,
  onDetectSpotifyLocal,
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
  const [currentTime, setCurrentTime] = useState(new Date());

  React.useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Format real-time clock: HH:MM:SS
  const timeStr = currentTime.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        gap: 8,
        alignItems: 'flex-start',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Optional Left Flyout for detailed Spotify setup or Screen Operator camera feed */}
      {sidePanel && (
        <div
          className="session-panel-card"
          style={{
            width: 300,
            flexShrink: 0,
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            boxSizing: 'border-box',
            maxHeight: 620,
            overflowY: 'auto',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span
              className="session-mono"
              style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', color: '#FFFFFF' }}
            >
              {sidePanel === 'spotify' ? 'SPOTIFY SETUP' : 'SCREEN OPERATOR INSPECTION'}
            </span>
            <button
              onClick={onCloseSidePanel}
              className="session-btn"
              style={{ padding: '1px 5px', fontSize: 10 }}
              title="Close flyout"
            >
              ✕
            </button>
          </div>

          {sidePanel === 'spotify' && onOpenSpotifySetup && onSpotifyControl && (
            <SpotifyPlayerCard
              track={spotifyTrack ?? null}
              isConnected={!!isSpotifyConnected}
              isConnecting={!!isSpotifyConnecting}
              onOpenSetup={onOpenSpotifySetup}
              onControl={onSpotifyControl}
              onDetectLocal={onDetectSpotifyLocal}
            />
          )}

          {sidePanel === 'operator' && (
            <OperatorCard
              watching={!!operatorWatching}
              mode={operatorMode ?? 'MONITOR'}
              lastFrame={operatorFrame ?? null}
              inference={operatorInference ?? null}
              proposal={operatorProposal ?? null}
              thumbUrl={operatorThumbUrl ?? ''}
              onToggleWatching={onToggleOperatorWatching ?? (() => {})}
              onModeChange={onOperatorModeChange ?? (() => {})}
              onCaptureNow={onOperatorCapture ?? (() => {})}
              onApprove={onOperatorApprove ?? (() => {})}
              onDeny={onOperatorDeny ?? (() => {})}
            />
          )}
        </div>
      )}

      {/* Main Board Console */}
      <div
        className="session-window-frame"
        style={{
          width: '100%',
          maxWidth: 420,
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          boxSizing: 'border-box',
        }}
      >
        {/* Title Bar with Drag Region */}
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
            userSelect: 'none',
          }}
        >
          {/* SESSION / CONTROL BOARD Branding */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span
              data-tauri-drag-region
              className="session-display"
              style={{
                fontSize: 15,
                fontWeight: 700,
                letterSpacing: '0.06em',
                color: '#FFFFFF',
                lineHeight: 1.1,
              }}
            >
              SESSION
            </span>
            <span
              data-tauri-drag-region
              className="session-mono"
              style={{
                fontSize: 10,
                color: 'var(--session-text-secondary)',
                letterSpacing: '0.05em',
                marginTop: 2,
              }}
            >
              CONTROL BOARD
            </span>
          </div>

          {/* Clock & Hardware Window Controls */}
          <div
            className="non-drag"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {/* Real-Time Clock: 17:35:19 */}
            <span
              className="session-mono"
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--session-text-secondary)',
                letterSpacing: '0.05em',
              }}
            >
              {timeStr}
            </span>

            {/* Hardware-Style Window Buttons: PIN, −, □, × */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <button
                onClick={onToggleAlwaysOnTop}
                className={`session-btn ${isAlwaysOnTop ? 'active' : ''}`}
                style={{ padding: '2px 6px', fontSize: 9 }}
                title={isAlwaysOnTop ? 'Pinned always on top' : 'Pin always on top'}
              >
                PIN
              </button>

              <button
                onClick={onToggleMute}
                className={`session-btn ${isMuted ? 'active' : ''}`}
                style={{ padding: '2px 5px', fontSize: 9 }}
                title={isMuted ? 'Sound muted' : 'Sound active'}
              >
                {isMuted ? 'MUTED' : 'SND'}
              </button>

              {onMinimizeToTaskbar && (
                <button
                  onClick={onMinimizeToTaskbar}
                  className="session-btn"
                  style={{ padding: '2px 5px', fontSize: 9 }}
                  title="Minimize window"
                >
                  −
                </button>
              )}

              <button
                onClick={() => onSelectViewMode('FOCUS')}
                className="session-btn"
                style={{ padding: '2px 5px', fontSize: 9 }}
                title="Switch to Focus mode"
              >
                □
              </button>

              <button
                onClick={onCollapse}
                className="session-btn"
                style={{ padding: '2px 5px', fontSize: 9 }}
                title="Collapse to Dock mode"
              >
                ×
              </button>
            </div>
          </div>
        </div>

        {/* Hairline Divider */}
        <div className="session-divider" />

        {/* Current Session Banner */}
        <CurrentSessionBanner
          activeTask={activeTask}
          focusSeconds={focusSeconds}
          targetMinutes={targetMinutes}
          isTimerRunning={isTimerRunning}
          completionPercentage={completionPercentage}
        />

        {/* Hairline Divider */}
        <div className="session-divider" />

        {/* Airport Task Departure Board */}
        <TaskList
          tasks={tasks}
          pastCompletedTasks={pastCompletedTasks}
          onSelectActive={onSelectActiveTask}
          onUpdateStatus={onUpdateTaskStatus}
          onDeleteTask={onDeleteTask}
          onAddTask={onAddTask}
          onClearPastTasks={onClearPastTasks}
        />

        {/* Hairline Divider */}
        <div className="session-divider" />

        {/* Studio Console (3-Channel Rack) */}
        <StudioConsole
          aiRun={aiRun}
          timeline={timeline}
          operatorWatching={operatorWatching}
          operatorMode={operatorMode}
          operatorFrame={operatorFrame}
          operatorInference={operatorInference}
          operatorProposal={operatorProposal}
          operatorThumbUrl={operatorThumbUrl}
          onToggleOperatorWatching={onToggleOperatorWatching}
          onOperatorCapture={onOperatorCapture}
          onOperatorApprove={onOperatorApprove}
          onOperatorDeny={onOperatorDeny}
          spotifyTrack={spotifyTrack}
          isSpotifyConnected={isSpotifyConnected}
          isSpotifyConnecting={isSpotifyConnecting}
          onOpenSpotifySetup={onOpenSpotifySetup}
          onSpotifyControl={onSpotifyControl}
          onDetectSpotifyLocal={onDetectSpotifyLocal}
        />

        {/* Hairline Divider */}
        <div className="session-divider" />

        {/* Transport Controls Bar */}
        <TransportBar
          isTimerRunning={isTimerRunning}
          targetMinutes={targetMinutes}
          viewMode={viewMode}
          onToggleTimer={onToggleTimer}
          onAdjustMinutes={onAdjustMinutes}
          onCompleteActiveTask={onCompleteActiveTask}
          onSelectViewMode={onSelectViewMode}
          onOpenIde={onOpenIde}
          hasActiveTask={!!activeTask}
        />
      </div>
    </div>
  );
};
