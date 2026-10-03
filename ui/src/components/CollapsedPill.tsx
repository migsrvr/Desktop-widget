import React from 'react';
import { Task, AiRun, SpotifyTrack, SpotifyPlaybackAction } from '@workpulse/shared';

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
      data-tauri-drag-region
      className="titlebar-drag-region"
      onDoubleClick={onExpand}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 8px 4px 10px',
        borderRadius: 'var(--radius-pill)',
        backgroundColor: 'rgba(18, 18, 20, 0.94)',
        backdropFilter: 'blur(40px) saturate(180%)',
        WebkitBackdropFilter: 'blur(40px) saturate(180%)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow: '0 12px 28px -4px rgba(0, 0, 0, 0.75), inset 0 1px 0 0 rgba(255, 255, 255, 0.14)',
        maxWidth: 340,
        height: 38,
        boxSizing: 'border-box',
        cursor: 'grab',
        transition: 'border-color 0.2s ease',
      }}
      title="Double-click to expand · Drag to reposition"
    >
      {/* Subtle Drag Grip Handle */}
      <span
        data-tauri-drag-region
        style={{
          fontSize: 9,
          letterSpacing: '-1px',
          color: 'var(--text-tertiary)',
          userSelect: 'none',
          cursor: 'grab',
          marginRight: -2,
        }}
      >
        :::
      </span>

      {/* Monotone Breathing Status Dot */}
      <div
        data-tauri-drag-region
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <span
          className={isAiWorking ? 'animate-mono-pulse' : ''}
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            backgroundColor: '#ffffff',
            opacity: isAiWorking ? 1 : isAiWaiting ? 0.9 : 0.45,
            display: 'inline-block',
          }}
          title={aiRun ? `AI: ${aiRun.status}` : 'WorkPulse Idle'}
        />
      </div>

      {/* Task Snippet */}
      <div
        data-tauri-drag-region
        style={{
          display: 'flex',
          flexDirection: 'column',
          minWidth: 70,
          maxWidth: 120,
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
            color: '#ffffff',
          }}
        >
          {activeTask ? activeTask.title : 'Idle'}
        </span>
      </div>

      {/* Monotone Ratio Badge e.g. 2 / 5 */}
      <div
        data-tauri-drag-region
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: '#ffffff',
          backgroundColor: 'rgba(255, 255, 255, 0.10)',
          padding: '1px 6px',
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
          gap: 3,
          fontSize: 10,
          fontFamily: 'JetBrains Mono, SF Mono, monospace',
          color: '#ffffff',
          padding: '2px 6px',
          borderRadius: 'var(--radius-pill)',
          backgroundColor: isTimerRunning ? 'rgba(255, 255, 255, 0.20)' : 'rgba(255, 255, 255, 0.08)',
          border: '1px solid rgba(255, 255, 255, 0.10)',
          cursor: 'pointer',
        }}
        title="Toggle focus timer"
      >
        <span>{formatTime(focusSeconds)}</span>
      </div>

      {/* Spotify Mini Playback Capsule */}
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
            gap: 4,
            fontSize: 10,
            maxWidth: 105,
            color: '#ffffff',
            padding: '2px 6px',
            borderRadius: 'var(--radius-pill)',
            backgroundColor: spotifyTrack.isPlaying ? 'rgba(255, 255, 255, 0.16)' : 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          title={`${spotifyTrack.name} · ${spotifyTrack.artist} (Click to ${spotifyTrack.isPlaying ? 'pause' : 'play'})`}
        >
          <span style={{ fontSize: 9 }}>{spotifyTrack.isPlaying ? '⏸' : '▶'}</span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: 75,
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
            className="apple-btn-text"
            style={{
              padding: '1px 5px',
              fontSize: 9,
              height: 20,
              minWidth: 18,
            }}
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
            className="apple-btn-text"
            style={{
              padding: '1px 6px',
              fontSize: 10,
              fontWeight: 700,
              height: 20,
              minWidth: 20,
            }}
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
          className="apple-btn-text"
          style={{
            padding: '1px 6px',
            fontSize: 10,
            fontWeight: 700,
            height: 20,
            minWidth: 20,
            color: '#ffffff',
            backgroundColor: 'rgba(255, 255, 255, 0.12)',
            borderColor: 'rgba(255, 255, 255, 0.18)',
          }}
          title="Expand WorkPulse panel"
        >
          ↗
        </button>
      </div>
    </div>
  );
};
