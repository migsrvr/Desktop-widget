import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Music2, Pause, Play, Settings2, SkipBack, SkipForward } from 'lucide-react';
import { formatTrackDuration, type SpotifyTrack, type SpotifyPlaybackAction } from '@workpulse/shared';

export interface MusicProps {
  track: SpotifyTrack | null;
  connected: boolean;
  error?: string | null;
  onControl: (action: SpotifyPlaybackAction) => void;
  onSetup: () => void;
}

export function MusicControls({ track, onControl }: Pick<MusicProps, 'track' | 'onControl'>) {
  return <div className="music-controls">
    <button className="icon-button" aria-label="Previous track" onClick={() => onControl('PREVIOUS')} disabled={!track}><SkipBack size={18} /></button>
    <button className="icon-button music-play" aria-label={track?.isPlaying ? 'Pause music' : 'Play music'} onClick={() => onControl('TOGGLE')} disabled={!track}>{track?.isPlaying ? <Pause size={17} /> : <Play size={17} />}</button>
    <button className="icon-button" aria-label="Next track" onClick={() => onControl('NEXT')} disabled={!track}><SkipForward size={18} /></button>
  </div>;
}

export function SessionMusic({ track, connected, error, onControl, onSetup }: MusicProps) {
  const [expanded, setExpanded] = useState(false);
  const playerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!expanded) return;
    const close = (event: PointerEvent) => { if (!playerRef.current?.contains(event.target as Node)) setExpanded(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setExpanded(false); };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', escape);
    return () => { window.removeEventListener('pointerdown', close); window.removeEventListener('keydown', escape); };
  }, [expanded]);
  const progress = track?.durationMs ? Math.max(0, Math.min(100, track.progressMs / track.durationMs * 100)) : 0;
  return <div className="session-music" ref={playerRef}>
    {expanded && <section className="music-popover" aria-label="Spotify player">
      <div className="row-between"><h3>Spotify</h3><button className="icon-button" aria-label="Collapse music player" onClick={() => setExpanded(false)}><ChevronDown size={16} /></button></div>
      <h2>{track?.name ?? 'Your focus soundtrack'}</h2><p className="caption">{track?.artist ?? (connected ? 'Play a track in Spotify to get started.' : 'Connect Spotify to listen while you focus.')}</p>
      <div className="usage-track" role="progressbar" aria-label="Track progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}><span style={{ width: `${progress}%` }} /></div>
      <div className="row-between caption"><span>{formatTrackDuration(track?.progressMs ?? 0)}</span><span>{formatTrackDuration(track?.durationMs ?? 0)}</span></div>
      <MusicControls track={track} onControl={onControl} />
      {error && <p className="caption" role="status">{error}</p>}
      <button className="text-button" onClick={onSetup}><Settings2 size={14} />{connected ? 'Spotify settings' : 'Connect Spotify'}</button>
    </section>}
    <button className="track-summary" aria-label={expanded ? 'Collapse Spotify player' : 'Expand Spotify player'} aria-expanded={expanded} onClick={() => setExpanded(v => !v)}>
      <span className="music-art">{track?.albumArtUrl ? <img src={track.albumArtUrl} alt="" /> : <Music2 size={18} />}</span>
      <span className="track-copy"><strong>{track?.name ?? 'Spotify'}</strong><span>{track ? `Spotify · ${track.artist}` : connected ? 'Ready when you are' : 'Add music to your focus session'}</span></span>
    </button>
    <MusicControls track={track} onControl={onControl} />
    {!connected && <button className="text-button connect-music" onClick={onSetup}>Connect</button>}
  </div>;
}
