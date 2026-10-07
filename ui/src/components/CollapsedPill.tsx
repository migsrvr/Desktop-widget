import React from 'react';
import { Task, AiRun, SpotifyTrack, SpotifyPlaybackAction, formatCountdown } from '@workpulse/shared';

interface CollapsedPillProps {
  activeTask: Task | null;
  aiRun: AiRun | null;
  tasksCount: number;
  doneCount: number;
  focusSeconds: number;
  isTimerRunning: boolean;
  onExpand: () => void;
  onToggleTimer: (e: React.MouseEvent) => void;
  onMinimizeToTaskbar?: () => void;
  onDockTopRight?: () => void;
  spotifyTrack?: SpotifyTrack | null;
  onSpotifyControl?: (action: SpotifyPlaybackAction) => void;
  operatorWatching?: boolean;
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
  onMinimizeToTaskbar,
  onDockTopRight,
  spotifyTrack,
  onSpotifyControl,
  operatorWatching,
}) => {
  const isAiWorking =
    aiRun && (aiRun.status === 'WORKING' || aiRun.status === 'PLANNING' || aiRun.status === 'RUNNING_TOOLS');
  const isAiWaiting = aiRun && aiRun.status === 'WAITING_INPUT';

  return (
    <div
      data-tauri-drag-region
      className="titlebar-drag-region"
      onDoubleClick={onExpand}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 8px 4px 10px',
        borderRadius: 'var(--radius-sm)',
        backgroundColor: 'var(--session-bg)',
        border: '1px solid var(--session-border)',
        boxShadow: '0 12px 28px -4px rgba(0, 0, 0, 0.9)',
        maxWidth: 345,
        height: 38,
        boxSizing: 'border-box',
        cursor: 'grab',
        transition: 'border-color 0.2s ease',
      }}
      title="Double-click to expand to Board · Drag to reposition"
    >
      {/* Drag Grip Handle */}
      <span
        data-tauri-drag-region
        style={{
          fontSize: 9,
          letterSpacing: '-1px',
          color: 'var(--session-text-secondary)',
          userSelect: 'none',
          cursor: 'grab',
          marginRight: -2,
        }}
      >
        :::
      </span>

      {/* SESSION Wordmark in Dot-Matrix Display Font */}
      <span
        data-tauri-drag-region
        className="session-display"
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: '#FFFFFF',
          letterSpacing: '0.06em',
          userSelect: 'none',
        }}
      >
        SESSION
      </span>

      {/* Monotone Breathing Status Dot */}
      <div
        data-tauri-drag-region
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <span
          className={isAiWorking ? 'animate-mono-pulse' : ''}
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: '#FFFFFF',
            opacity: isAiWorking ? 1 : isAiWaiting ? 0.9 : 0.45,
            display: 'inline-block',
          }}
          title={aiRun ? `Agent: ${aiRun.status}` : 'Idle'}
        />
      </div>

      {/* Task Snippet */}
      <div
        data-tauri-drag-region
        style={{
          display: 'flex',
          flexDirection: 'column',
          minWidth: 60,
          maxWidth: 100,
        }}
      >
        <span
          data-tauri-drag-region
          style={{
            fontSize: 11,
            fontWeight: 600,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            color: 'var(--session-text-primary)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {activeTask ? activeTask.title : 'Ready'}
        </span>
      </div>

      {/* Ratio Badge e.g. 2 / 5 */}
      <div
        data-tauri-drag-region
        className="session-mono"
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: '#FFFFFF',
          backgroundColor: 'var(--session-surface)',
          padding: '1px 5px',
          borderRadius: 'var(--radius-xs)',
          border: '1px solid var(--session-border)',
        }}
      >
        {doneCount}/{tasksCount}
      </div>

      {/* Timer Capsule */}
      <div
        onClick={onToggleTimer}
        className="non-drag session-mono"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          fontSize: 10,
          color: '#FFFFFF',
          padding: '2px 5px',
          borderRadius: 'var(--radius-xs)',
          backgroundColor: isTimerRunning ? 'var(--session-surface-active)' : 'var(--session-surface)',
          border: `1px solid ${isTimerRunning ? 'var(--session-accent-white)' : 'var(--session-border)'}`,
          cursor: 'pointer',
        }}
        title="Toggle focus timer"
      >
        <span>{formatCountdown(focusSeconds)}</span>
      </div>

      {/* Spotify Capsule if Playing */}
      {spotifyTrack && onSpotifyControl && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            onSpotifyControl(spotifyTrack.isPlaying ? 'PAUSE' : 'PLAY');
          }}
          className="non-drag"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            fontSize: 10,
            maxWidth: 65,
            color: '#FFFFFF',
            padding: '2px 4px',
            borderRadius: 'var(--radius-xs)',
            backgroundColor: 'var(--session-surface)',
            border: '1px solid var(--session-border)',
            cursor: 'pointer',
          }}
          title={`${spotifyTrack.name} · ${spotifyTrack.artist}`}
        >
          <span style={{ fontSize: 9 }}>{spotifyTrack.isPlaying ? '⏸' : '▶'}</span>
          <span
            style={{
              fontSize: 9,
              fontFamily: 'var(--font-mono)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: 45,
            }}
          >
            {spotifyTrack.name}
          </span>
        </div>
      )}

      {/* Quick Action Buttons (Non-drag) */}
      <div className="non-drag" style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        {onMinimizeToTaskbar && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMinimizeToTaskbar();
            }}
            className="session-btn"
            style={{ padding: '1px 4px', fontSize: 9, height: 18 }}
            title="Minimize to taskbar"
          >
            _
          </button>
        )}

        {onDockTopRight && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDockTopRight();
            }}
            className="session-btn"
            style={{ padding: '1px 5px', fontSize: 10, fontWeight: 700, height: 18 }}
            title="Dock to top-right corner"
          >
            ⇗
          </button>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            onExpand();
          }}
          className="session-btn-primary"
          style={{ padding: '1px 6px', fontSize: 10, height: 18 }}
          title="Expand to Board mode"
        >
          ↗
        </button>
      </div>
    </div>
  );
};
