import React from 'react';
import { SpotifyTrack, SpotifyPlaybackAction } from '@workpulse/shared';

interface SpotifyMiniStripProps {
  track: SpotifyTrack | null;
  onControl: (action: SpotifyPlaybackAction) => void;
}

/**
 * Slim Spotify strip for Focus mode: album thumb, track — artist,
 * and prev / play-pause / next controls sized for quick clicks mid-work.
 * Renders nothing when there is no active track (window stays compact).
 */
export const SpotifyMiniStrip: React.FC<SpotifyMiniStripProps> = ({ track, onControl }) => {
  if (!track) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 8px',
        borderRadius: 'var(--radius-sm)',
        backgroundColor: 'var(--session-surface)',
        border: '1px solid var(--session-border)',
        boxSizing: 'border-box',
      }}
    >
      {track.albumArtUrl ? (
        <img
          src={track.albumArtUrl}
          alt={track.album}
          style={{
            width: 30,
            height: 30,
            borderRadius: 6,
            objectFit: 'cover',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            flexShrink: 0,
          }}
        />
      ) : (
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 6,
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

      <div
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 11,
          fontWeight: 600,
          color: '#ffffff',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
        title={`${track.name} — ${track.artist}`}
      >
        {track.name} — {track.artist}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
        <button
          onClick={() => onControl('PREVIOUS')}
          className="session-btn"
          style={{ padding: '4px 8px', fontSize: 11 }}
          title="Previous Track"
        >
          ⏮
        </button>
        <button
          onClick={() => onControl(track.isPlaying ? 'PAUSE' : 'PLAY')}
          className="session-btn"
          style={{
            padding: '4px 10px',
            fontSize: 11,
            color: '#ffffff',
            backgroundColor: 'rgba(255, 255, 255, 0.14)',
          }}
          title={track.isPlaying ? 'Pause' : 'Play'}
        >
          {track.isPlaying ? '⏸' : '▶'}
        </button>
        <button
          onClick={() => onControl('NEXT')}
          className="session-btn"
          style={{ padding: '4px 8px', fontSize: 11 }}
          title="Next Track"
        >
          ⏭
        </button>
      </div>
    </div>
  );
};
