import React from 'react';
import { SpotifyTrack, SpotifyPlaybackAction, formatTrackDuration } from '@workpulse/shared';

interface SpotifyPlayerCardProps {
  track: SpotifyTrack | null;
  isConnected: boolean;
  isConnecting: boolean;
  onOpenSetup: () => void;
  onControl: (action: SpotifyPlaybackAction) => void;
}

export const SpotifyPlayerCard: React.FC<SpotifyPlayerCardProps> = ({
  track,
  isConnected,
  isConnecting,
  onOpenSetup,
  onControl,
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
              Connect to control study & focus music
            </span>
          </div>
        </div>

        <button
          onClick={onOpenSetup}
          className="apple-btn-text"
          style={{
            fontSize: 11,
            padding: '3px 8px',
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            borderColor: 'rgba(255, 255, 255, 0.14)',
          }}
        >
          {isConnecting ? 'Waiting…' : 'Connect'}
        </button>
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

  return (
    <div
      className="w11-card"
      style={{
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {/* Top Track & Album Info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        {track.albumArtUrl ? (
          <img
            src={track.albumArtUrl}
            alt={track.album}
            style={{
              width: 38,
              height: 38,
              borderRadius: 'var(--radius-sm)',
              objectFit: 'cover',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              flexShrink: 0,
            }}
          />
        ) : (
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 15,
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
            title={track.name}
          >
            {track.name}
          </span>
          <span
            style={{
              fontSize: 11,
              color: 'var(--text-secondary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={`${track.artist} · ${track.album}`}
          >
            {track.artist}
          </span>
          {track.device && (
            <span
              style={{
                fontSize: 9,
                color: 'var(--text-tertiary)',
                marginTop: 1,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              via {track.device.name}
            </span>
          )}
        </div>

        <button
          onClick={onOpenSetup}
          className="apple-btn-text"
          style={{ padding: '3px 6px', fontSize: 10 }}
          title="Spotify Settings"
        >
          ⚙
        </button>
      </div>

      {/* Progress Track */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            fontSize: 9,
            fontFamily: 'JetBrains Mono, monospace',
            color: 'var(--text-tertiary)',
            minWidth: 28,
          }}
        >
          {formatTrackDuration(track.progressMs)}
        </span>

        <div
          style={{
            flex: 1,
            height: 3,
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            borderRadius: 'var(--radius-pill)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progressPercent}%`,
              backgroundColor: '#ffffff',
              borderRadius: 'var(--radius-pill)',
              transition: 'width 0.4s linear',
            }}
          />
        </div>

        <span
          style={{
            fontSize: 9,
            fontFamily: 'JetBrains Mono, monospace',
            color: 'var(--text-tertiary)',
            minWidth: 28,
            textAlign: 'right',
          }}
        >
          {formatTrackDuration(track.durationMs)}
        </span>
      </div>

      {/* Tactile Monotone Playback Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          paddingTop: 2,
        }}
      >
        <button
          onClick={() => onControl('PREVIOUS')}
          className="apple-btn-text"
          style={{ padding: '4px 10px', fontSize: 12 }}
          title="Previous Track"
        >
          ⏮
        </button>

        <button
          onClick={() => onControl(track.isPlaying ? 'PAUSE' : 'PLAY')}
          className="apple-btn-primary"
          style={{
            padding: '5px 16px',
            fontSize: 12,
            minWidth: 42,
          }}
          title={track.isPlaying ? 'Pause' : 'Play'}
        >
          {track.isPlaying ? '⏸' : '▶'}
        </button>

        <button
          onClick={() => onControl('NEXT')}
          className="apple-btn-text"
          style={{ padding: '4px 10px', fontSize: 12 }}
          title="Next Track"
        >
          ⏭
        </button>
      </div>
    </div>
  );
};
