import { useState } from 'react';
import { SPOTIFY_REDIRECT_URI, type SpotifyTrack } from '@workpulse/shared';
import { SessionDialog } from './SessionDialog';

interface SpotifySetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  isConnected: boolean;
  activeClientId?: string;
  track?: SpotifyTrack | null;
  isConnecting: boolean;
  error: string | null;
  onConnect: (clientId: string) => void;
  onDisconnect: () => void;
  onDetectLocal?: () => void;
  accountType?: string | null;
}

export function SpotifySetupModal({ isOpen, onClose, isConnected, activeClientId, track, isConnecting, error, onConnect, onDisconnect, onDetectLocal, accountType }: SpotifySetupModalProps) {
  const [clientId, setClientId] = useState('');
  const [copied, setCopied] = useState(false);
  if (!isOpen) return null;
  const windows = /Win/i.test(navigator.platform);
  return <SessionDialog title="Spotify" onClose={onClose}><div className="spotify-setup">
    {isConnected ? <><p>{track ? track.name + ' · ' + track.artist : 'Connected. Play something in Spotify and it will appear in your music bar.'}</p><p>{accountType === 'premium' ? 'Premium playback controls are ready.' : 'Playback controls depend on your Spotify account and active device.'}</p><div className="button-row"><button className="secondary-button" onClick={onDisconnect}>Disconnect</button><button className="primary-button" onClick={onClose}>Done</button></div></> : <>
      <p>Connect your account to bring music into your focus session. Keep Spotify open with an active playback device.</p>
      {windows && onDetectLocal && <div><button className="secondary-button" onClick={onDetectLocal}>Detect desktop Spotify</button><p className="caption">Local playback is available on Windows. Account connection works across platforms.</p></div>}
      <p>Create an app in your <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer">Spotify developer dashboard</a>, then add this redirect URI:</p>
      <code>{SPOTIFY_REDIRECT_URI}</code>
      <button className="text-button" onClick={async () => { try { await navigator.clipboard.writeText(SPOTIFY_REDIRECT_URI); setCopied(true); } catch { setCopied(false); } }}>{copied ? 'Copied redirect URI' : 'Copy redirect URI'}</button>
      <form onSubmit={event => { event.preventDefault(); if ((clientId || activeClientId)?.trim()) onConnect((clientId || activeClientId || '').trim()); }}>
        <label className="field-label">Client ID<input autoFocus required value={clientId || activeClientId || ''} onChange={event => setClientId(event.target.value)} placeholder="Paste your Spotify client ID" autoComplete="off" /></label>
        <p className="caption">Spotify opens in your browser. Return here after approving access.</p>
        <div className="dialog-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit" disabled={isConnecting || !(clientId || activeClientId)?.trim()}>{isConnecting ? 'Connecting…' : 'Connect Spotify'}</button></div>
      </form>
    </>}
    {error && <p className="error-copy" role="alert">{error}</p>}
  </div></SessionDialog>;
}

