import React from 'react';
import { SpotifyTrack, SpotifyPlaybackAction, formatTrackDuration } from '@workpulse/shared';

interface SpotifyPlayerCardProps {
  track: SpotifyTrack | null;
  isConnected: boolean;
  isConnecting: boolean;
  onOpenSetup: () => void;
  onControl: (action: SpotifyPlaybackAction) => void;
  onDetectLocal?: () => void;
}

export const SpotifyPlayerCard: React.FC<SpotifyPlayerCardProps> = ({
  track,
  isConnected,
  isConnecting,
  onOpenSetup,
  onControl,
  onDetectLocal,
}) => {
  // If not connected to Spotify yet
  if (!isConnected) {
    return (
      <div
        className="w11-card"
        style={{
          padding: '10px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              color: '#ffffff',
            }}
          >
            ♫
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#ffffff' }}>
              Spotify Audio
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
              Free Desktop & Web API
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {onDetectLocal && (
            <button
              onClick={onDetectLocal}
              className="apple-btn-text"
              style={{
                fontSize: 10,
                padding: '3px 8px',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                borderColor: 'rgba(255, 255, 255, 0.16)',
              }}
              title="Detect Spotify desktop app on this PC"
            >
              Detect
            </button>
          )}
          <button
            onClick={onOpenSetup}
            className="apple-btn-text"
            style={{
              fontSize: 10,
              padding: '3px 8px',
            }}
            title="Open Spotify Settings"
          >
            Setup
          </button>
        </div>
      </div>
    );
  }

  // Connected but Spotify player is idle or no active device
  if (!track) {
    return (
      <div
        className="w11-card"
        style={{
          padding: '10px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              color: 'var(--text-secondary)',
            }}
          >
            ♫
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#ffffff' }}>
              Spotify Connected
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
              Open Spotify on your PC or phone to play
            </span>
          </div>
        </div>

        <button
          onClick={onOpenSetup}
          className="apple-btn-text"
          style={{ padding: '3px 7px', fontSize: 10 }}
          title="Spotify Settings"
        >
          ⚙
        </button>
      </div>
    );
  }

  // Active playback card
  const progressPercent =
    track.durationMs > 0
      ? Math.min(100, Math.max(0, (track.progressMs / track.durationMs) * 100))
      : 0;

  // Compact single-row card: artwork, track, times, inline transport.
  return (
    <div
      className="w11-card"
      style={{
        padding: '8px 10px 0',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, paddingBottom: 8 }}>
        {track.albumArtUrl ? (
          <img
            src={track.albumArtUrl}
            alt={track.album}
            style={{
              width: 32,
              height: 32,
              borderRadius: 'var(--radius-sm)',
              objectFit: 'cover',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              flexShrink: 0,
            }}
          />
        ) : (
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              color: '#ffffff',
              flexShrink: 0,
            }}
          >
            ♫
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: '#ffffff',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={track.device ? `${track.name} · via ${track.device.name}` : track.name}
          >
            {track.name}
          </span>
          <span
            style={{
              fontSize: 10,
              color: 'var(--text-secondary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              fontFamily: 'JetBrains Mono, SF Mono, monospace',
              fontVariantNumeric: 'tabular-nums',
            }}
            title={`${track.artist} · ${track.album}`}
          >
            {track.artist} · {formatTrackDuration(track.progressMs)}/{formatTrackDuration(track.durationMs)}
          </span>
        </div>

        {/* Inline transport */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
          <button
            onClick={() => onControl('PREVIOUS')}
            className="apple-btn-text"
            style={{ padding: '3px 7px', fontSize: 11 }}
            title="Previous Track"
          >
            ⏮
          </button>
          <button
            onClick={() => onControl(track.isPlaying ? 'PAUSE' : 'PLAY')}
            className="apple-btn-text"
            style={{
              padding: '3px 9px',
              fontSize: 11,
              color: '#ffffff',
              backgroundColor: 'rgba(255, 255, 255, 0.14)',
              borderColor: 'rgba(255, 255, 255, 0.2)',
            }}
            title={track.isPlaying ? 'Pause' : 'Play'}
          >
            {track.isPlaying ? '⏸' : '▶'}
          </button>
          <button
            onClick={() => onControl('NEXT')}
            className="apple-btn-text"
            style={{ padding: '3px 7px', fontSize: 11 }}
            title="Next Track"
          >
            ⏭
          </button>
          <button
            onClick={onOpenSetup}
            className="apple-btn-text"
            style={{ padding: '3px 6px', fontSize: 10 }}
            title="Spotify Settings"
          >
            ⚙
          </button>
        </div>
      </div>

      {/* Slim progress strip pinned to the card edge */}
      <div
        style={{
          height: 2,
          margin: '0 -10px',
          backgroundColor: 'rgba(255, 255, 255, 0.08)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${progressPercent}%`,
            backgroundColor: '#ffffff',
            transition: 'width 0.4s linear',
          }}
        />
      </div>
    </div>
  );
};
