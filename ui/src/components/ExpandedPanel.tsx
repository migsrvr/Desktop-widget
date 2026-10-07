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
  sidePanel?: 'activity' | 'operator' | null;
  onToggleSidePanel?: (panel: 'activity' | 'operator') => void;
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
  onToggleSidePanel,
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
        alignItems: 'stretch',
        width: '100%',
        height: '100%',
        flex: 1,
        minHeight: 0,
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* Optional Flyout for detailed Spotify setup or Screen Operator camera feed */}
      {sidePanel && (
        <div
          className="session-panel-card"
          style={{
            width: 320,
            flexShrink: 0,
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            boxSizing: 'border-box',
            height: '100%',
            overflowY: 'auto',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <span
              className="session-mono"
              style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', color: '#FFFFFF' }}
            >
              {sidePanel === 'activity' ? 'ACTIVITY LOG' : 'SCREEN OPERATOR INSPECTION'}
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

          {sidePanel === 'activity' && (
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              <TimelineView timeline={timeline} />
            </div>
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

      {/* Main Board Console — Fills full window */}
      <div
        className="session-window-frame"
        style={{
          width: '100%',
          height: '100%',
          padding: '14px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          boxSizing: 'border-box',
          overflow: 'hidden',
          flex: 1,
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
            flexShrink: 0,
          }}
        >
          {/* SESSION / CONTROL BOARD Branding */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span
              data-tauri-drag-region
              className="session-display"
              style={{
                fontSize: 18,
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
                fontSize: 11.5,
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
              gap: 10,
            }}
          >
            {/* Real-Time Clock: 17:35:19 */}
            <span
              className="session-mono"
              style={{
                fontSize: 13.5,
                fontWeight: 600,
                color: 'var(--session-text-secondary)',
                letterSpacing: '0.05em',
              }}
            >
              {timeStr}
            </span>

            {/* Hardware-Style Window Buttons: PIN, SND, − */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                onClick={onToggleAlwaysOnTop}
                className={`session-btn ${isAlwaysOnTop ? 'active' : ''}`}
                style={{ padding: '2px 8px', fontSize: 11 }}
                title={isAlwaysOnTop ? 'Pinned always on top' : 'Pin always on top'}
              >
                PIN
              </button>

              <button
                onClick={onToggleMute}
                className={`session-btn ${isMuted ? 'active' : ''}`}
                style={{ padding: '2px 7px', fontSize: 11 }}
                title={isMuted ? 'Sound muted' : 'Sound active'}
              >
                {isMuted ? 'MUTED' : 'SND'}
              </button>

              {onMinimizeToTaskbar && (
                <button
                  onClick={onMinimizeToTaskbar}
                  className="session-btn"
                  style={{ padding: '2px 7px', fontSize: 11 }}
                  title="Minimize window"
                >
                  −
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Hairline Divider */}
        <div className="session-divider" style={{ flexShrink: 0 }} />

        {/* Current Session Banner */}
        <div style={{ flexShrink: 0 }}>
          <CurrentSessionBanner
            activeTask={activeTask}
            focusSeconds={focusSeconds}
            targetMinutes={targetMinutes}
            isTimerRunning={isTimerRunning}
            completionPercentage={completionPercentage}
          />
        </div>

        {/* Hairline Divider */}
        <div className="session-divider" style={{ flexShrink: 0 }} />

        {/* Middle Region: Task Departure Board (Left) + Activity Log / Timeline (Right) */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            gap: 14,
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
            width: '100%',
          }}
        >
          {/* Left: Airport Task Departure Board */}
          <div
            style={{
              flex: 1.4,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              backgroundColor: 'var(--session-surface)',
              border: '1px solid var(--session-border)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 12px',
              boxSizing: 'border-box',
            }}
          >
            <TaskList
              tasks={tasks}
              pastCompletedTasks={pastCompletedTasks}
              onSelectActive={onSelectActiveTask}
              onUpdateStatus={onUpdateTaskStatus}
              onDeleteTask={onDeleteTask}
              onAddTask={onAddTask}
              onClearPastTasks={onClearPastTasks}
            />
          </div>

          {/* Right: Spotify Showcase with album art */}
          <div
            style={{
              flex: 1,
              minWidth: 320,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              backgroundColor: 'var(--session-surface)',
              border: '1px solid var(--session-border)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 12px',
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: 6,
                borderBottom: '1px solid var(--session-border)',
                marginBottom: 6,
                flexShrink: 0,
              }}
            >
              <span
                className="session-mono"
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: 'var(--session-text-secondary)',
                  letterSpacing: '0.06em',
                }}
              >
                02 / NOW PLAYING
              </span>
              <button
                onClick={() => onToggleSidePanel?.('activity')}
                className="session-btn"
                style={{ fontSize: 11, padding: '2px 8px' }}
                title="Open activity log flyout"
              >
                {timeline.length} LOG ›
              </button>
            </div>

            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <SpotifyPlayerCard
                track={spotifyTrack ?? null}
                isConnected={!!isSpotifyConnected}
                isConnecting={!!isSpotifyConnecting}
                onOpenSetup={onOpenSpotifySetup ?? (() => {})}
                onControl={onSpotifyControl ?? (() => {})}
                onDetectLocal={onDetectSpotifyLocal}
              />
            </div>
          </div>
        </div>

        {/* Hairline Divider */}
        <div className="session-divider" style={{ flexShrink: 0 }} />

        {/* Studio Console (3-Channel Rack) */}
        <div style={{ flexShrink: 0 }}>
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
        </div>

        {/* Hairline Divider */}
        <div className="session-divider" style={{ flexShrink: 0 }} />

        {/* Transport Controls Bar */}
        <div style={{ flexShrink: 0 }}>
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
    </div>
  );
};
