import React, { useState, useEffect } from 'react';
import { SpotifyTrack, SpotifyPlaybackAction, formatTrackDuration } from '@workpulse/shared';
import { SpotifyAsciiArt, ArtMode } from './SpotifyAsciiArt';

interface SpotifyPlayerCardProps {
  track: SpotifyTrack | null;
  isConnected: boolean;
  isConnecting: boolean;
  onOpenSetup: () => void;
  onControl: (action: SpotifyPlaybackAction) => void;
  onDetectLocal?: () => void;
  /** Spotify account product ("premium" unlocks full Web API control). */
  accountType?: string | null;
}

export const SpotifyPlayerCard: React.FC<SpotifyPlayerCardProps> = ({
  track,
  isConnected,
  isConnecting,
  onOpenSetup,
  onControl,
  onDetectLocal,
  accountType,
}) => {
  const [isArtworkExpanded, setIsArtworkExpanded] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('workpulse:spotify_artwork_expanded');
      return saved !== null ? saved === 'true' : true; // Default to true: show large cover
    } catch {
      return true;
    }
  });

  const toggleArtworkExpanded = () => {
    setIsArtworkExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('workpulse:spotify_artwork_expanded', String(next));
      } catch {}
      return next;
    });
  };

  // Original vs ASCII artwork mode (expanded cover only). Defaults to ASCII;
  // falls back to Original automatically if conversion is unavailable.
  const [artMode, setArtMode] = useState<ArtMode>(() => {
    try {
      return localStorage.getItem('workpulse:spotify_art_mode') === 'original' ? 'original' : 'ascii';
    } catch {
      return 'ascii';
    }
  });
  const [asciiOk, setAsciiOk] = useState<boolean | null>(null);

  // Re-arm ASCII availability when the track's artwork changes.
  const artworkSrc = track?.albumArtUrl ?? null;
  useEffect(() => {
    setAsciiOk(null);
  }, [artworkSrc]);

  const selectArtMode = (mode: ArtMode) => {
    setArtMode(mode);
    try {
      localStorage.setItem('workpulse:spotify_art_mode', mode);
    } catch {}
  };

  // If not connected to Spotify yet
  if (!isConnected) {
    return (
      <div
        className="w11-card"
        style={{
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
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
            <span style={{ fontSize: 12.5, fontWeight: 700, color: '#ffffff' }}>
              Spotify Audio
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              {accountType === 'premium' ? 'Premium · Full Web API control' : 'Free Desktop & Web API'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
          {onDetectLocal && (
            <button
              onClick={onDetectLocal}
              className="apple-btn-text"
              style={{
                fontSize: 11,
                padding: '4px 10px',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                borderColor: 'rgba(255, 255, 255, 0.16)',
              }}
              title="Detect Spotify desktop app on this PC"
            >
              Detect Local
            </button>
          )}
          <button
            onClick={onOpenSetup}
            className="apple-btn-primary"
            style={{
              fontSize: 11,
              padding: '4px 10px',
            }}
            title="Open Spotify Settings"
          >
            {isConnecting ? 'Waiting…' : 'Setup'}
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
          padding: '12px',
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
            <span style={{ fontSize: 12.5, fontWeight: 600, color: '#ffffff' }}>
              Spotify Connected
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              Play any track on Spotify to display artwork
            </span>
          </div>
        </div>

        <button
          onClick={onOpenSetup}
          className="apple-btn-text"
          style={{ padding: '3px 7px', fontSize: 11 }}
          title="Spotify Settings"
        >
          ⚙
        </button>
      </div>
    );
  }

  const progressPercent =
    track.durationMs > 0
      ? Math.min(100, Math.max(0, (track.progressMs / track.durationMs) * 100))
      : 0;

  // VIEW 1: Expanded Big Cover Artwork Player
  if (isArtworkExpanded) {
    return (
      <div
        className="w11-card"
        style={{
          padding: '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 'var(--radius-md, 14px)',
        }}
      >
        {/* Top Header Row with Mini Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14, color: '#ffffff' }}>♫</span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.6px',
              }}
            >
              Now Playing
            </span>
            {accountType === 'premium' && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '0.6px',
                  color: '#000000',
                  backgroundColor: '#ffffff',
                  padding: '1px 6px',
                  borderRadius: 'var(--radius-pill)',
                }}
                title="Spotify Premium — full Web API control enabled"
              >
                PREMIUM
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {artworkSrc && asciiOk !== false && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: 'var(--radius-pill)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  overflow: 'hidden',
                }}
                role="group"
                aria-label="Artwork display mode"
              >
                {(['original', 'ascii'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => selectArtMode(mode)}
                    aria-pressed={artMode === mode}
                    title={mode === 'original' ? 'Show original cover' : 'Show ASCII cover'}
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: '0.4px',
                      textTransform: 'uppercase',
                      padding: '2px 7px',
                      background: artMode === mode ? '#ffffff' : 'transparent',
                      border: 'none',
                      color: artMode === mode ? '#000000' : 'var(--text-tertiary)',
                      cursor: 'pointer',
                    }}
                  >
                    {mode === 'original' ? 'Original' : 'ASCII'}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={toggleArtworkExpanded}
              className="apple-btn-text"
              style={{
                fontSize: 11,
                padding: '2px 8px',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
              title="Minimize to compact row"
            >
              <span>▾</span>
              <span>Mini</span>
            </button>
            <button
              onClick={onOpenSetup}
              className="apple-btn-text"
              style={{ padding: '2px 7px', fontSize: 11 }}
              title="Spotify Settings"
            >
              ⚙
            </button>
          </div>
        </div>

        {/* Album Artwork Box — capped so the column never scrolls */}
        <div
          style={{
            width: 'min(100%, 150px)',
            aspectRatio: '1 / 1',
            margin: '0 auto',
            borderRadius: '12px',
            overflow: 'hidden',
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            boxShadow: '0 12px 28px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            flexShrink: 0,
          }}
        >
          <SpotifyAsciiArt
            src={artworkSrc}
            mode={artMode}
            alt={track.album}
            onAsciiStatus={setAsciiOk}
          />
        </div>

        {/* Track Title and Artist */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: 3,
            padding: '0 4px',
          }}
        >
          <span
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: '#ffffff',
              letterSpacing: '-0.2px',
              maxWidth: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={track.name}
          >
            {track.name}
          </span>
          <span
            style={{
              fontSize: 12.5,
              color: 'var(--text-secondary)',
              maxWidth: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={track.artist}
          >
            {track.artist}
          </span>
          {track.album && track.album !== 'Spotify Free (Desktop)' && (
            <span
              style={{
                fontSize: 11,
                color: 'var(--text-tertiary)',
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {track.album}
            </span>
          )}
        </div>

        {/* Compact transport strip: controls + progress in one row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <button
              onClick={() => onControl('PREVIOUS')}
              className="apple-btn-text"
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                padding: 0,
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
              }}
              title="Previous Track"
            >
              ⏮
            </button>
            <button
              onClick={() => onControl(track.isPlaying ? 'PAUSE' : 'PLAY')}
              className="apple-btn-text"
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                padding: 0,
                color: '#ffffff',
                backgroundColor: 'rgba(255, 255, 255, 0.18)',
                borderColor: 'rgba(255, 255, 255, 0.28)',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
              }}
              title={track.isPlaying ? 'Pause' : 'Play'}
            >
              {track.isPlaying ? '⏸' : '▶'}
            </button>
            <button
              onClick={() => onControl('NEXT')}
              className="apple-btn-text"
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                padding: 0,
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
              }}
              title="Next Track"
            >
              ⏭
            </button>
          </div>

          {track.durationMs > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 0 }}>
              <div
                style={{
                  height: 4,
                  width: '100%',
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
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 10,
                  color: 'var(--text-tertiary)',
                  fontFamily: 'JetBrains Mono, SF Mono, monospace',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <span>{formatTrackDuration(track.progressMs)}</span>
                <span>{formatTrackDuration(track.durationMs)}</span>
              </div>
            </div>
          ) : (
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)', flex: 1 }}>
              {track.isPlaying ? 'Playing' : 'Paused'}
            </span>
          )}
        </div>
      </div>
    );
  }

  // VIEW 2: Compact Mini Row (when user minimizes the card)
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
              cursor: 'pointer',
            }}
            onClick={toggleArtworkExpanded}
            title="Click to expand song cover"
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
              cursor: 'pointer',
            }}
            onClick={toggleArtworkExpanded}
            title="Click to expand song cover"
          >
            ♫
          </div>
        )}

        <div
          style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, cursor: 'pointer' }}
          onClick={toggleArtworkExpanded}
          title="Click to expand song cover"
        >
          <span
            style={{
              fontSize: 13.5,
              fontWeight: 700,
              color: '#ffffff',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {track.name}
          </span>
          <span
            style={{
              fontSize: 11.5,
              color: 'var(--text-secondary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              fontFamily: 'JetBrains Mono, SF Mono, monospace',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {track.artist}
            {track.durationMs > 0 &&
              ` · ${formatTrackDuration(track.progressMs)}/${formatTrackDuration(track.durationMs)}`}
          </span>
        </div>

        {/* Inline transport controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
          <button
            onClick={() => onControl('PREVIOUS')}
            className="apple-btn-text"
            style={{ padding: '3px 7px', fontSize: 12 }}
            title="Previous Track"
          >
            ⏮
          </button>
          <button
            onClick={() => onControl(track.isPlaying ? 'PAUSE' : 'PLAY')}
            className="apple-btn-text"
            style={{
              padding: '3px 9px',
              fontSize: 12,
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
            style={{ padding: '3px 7px', fontSize: 12 }}
            title="Next Track"
          >
            ⏭
          </button>
          <button
            onClick={toggleArtworkExpanded}
            className="apple-btn-text"
            style={{ padding: '3px 6px', fontSize: 11 }}
            title="Expand song cover"
          >
            ▴
          </button>
          <button
            onClick={onOpenSetup}
            className="apple-btn-text"
            style={{ padding: '3px 6px', fontSize: 11 }}
            title="Spotify Settings"
          >
            ⚙
          </button>
        </div>
      </div>

      {/* Slim progress strip */}
      {track.durationMs > 0 && (
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
      )}
    </div>
  );
};
