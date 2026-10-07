import React, { useState } from 'react';
import { SPOTIFY_REDIRECT_URI, SpotifyTrack } from '@workpulse/shared';

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
  /** Spotify account product ("premium" unlocks full Web API control). */
  accountType?: string | null;
}

export const SpotifySetupModal: React.FC<SpotifySetupModalProps> = ({
  isOpen,
  onClose,
  isConnected,
  activeClientId,
  track,
  isConnecting,
  error,
  onConnect,
  onDisconnect,
  onDetectLocal,
  accountType,
}) => {
  const isPremium = accountType === 'premium';
  const [activeTab, setActiveTab] = useState<'local' | 'webapi'>('local');
  const [hasChosenTab, setHasChosenTab] = useState(false);
  // Premium accounts get full Web API control — land them on that tab
  // unless they explicitly picked one.
  const effectiveTab = isPremium && !hasChosenTab ? 'webapi' : activeTab;
  const selectTab = (tab: 'local' | 'webapi') => {
    setHasChosenTab(true);
    setActiveTab(tab);
  };
  const [clientIdInput, setClientIdInput] = useState(activeClientId || '');
  const [copied, setCopied] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);

  if (!isOpen) return null;

  const handleCopyUri = () => {
    navigator.clipboard.writeText(SPOTIFY_REDIRECT_URI);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDetectClick = async () => {
    if (onDetectLocal) {
      setIsDetecting(true);
      await onDetectLocal();
      setTimeout(() => setIsDetecting(false), 600);
    }
  };

  const handleSubmitWebApi = (e: React.FormEvent) => {
    e.preventDefault();
    if (clientIdInput.trim()) {
      onConnect(clientIdInput.trim());
    }
  };

  const isLocalMode = isConnected && !activeClientId;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 16,
        boxSizing: 'border-box',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w11-acrylic-panel"
        style={{
          width: '100%',
          maxWidth: 380,
          padding: '18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          borderRadius: 'var(--radius-md, 14px)',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.12)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: 14, color: '#ffffff' }}>♫</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#ffffff', letterSpacing: '-0.2px' }}>
              Spotify Integration
            </span>
          </div>
          <button
            onClick={onClose}
            className="apple-btn-text"
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              fontSize: 12,
              lineHeight: 1,
            }}
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher: Desktop App (Free) vs Web API (Developer) */}
        <div className="apple-segmented-container" style={{ padding: 2 }}>
          <button
            type="button"
            onClick={() => selectTab('local')}
            className={`apple-segmented-item ${effectiveTab === 'local' ? 'active' : ''}`}
            style={{ flex: 1, fontSize: 11, padding: '5px 0' }}
          >
            Desktop App (Free)
          </button>
          <button
            type="button"
            onClick={() => selectTab('webapi')}
            className={`apple-segmented-item ${effectiveTab === 'webapi' ? 'active' : ''}`}
            style={{ flex: 1, fontSize: 11, padding: '5px 0' }}
          >
            Web API (Developer)
          </button>
        </div>

        {/* TAB 1: Local Desktop App (Free Account Bypass) */}
        {effectiveTab === 'local' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                padding: '9px 11px',
                borderRadius: 'var(--radius-sm, 8px)',
                backgroundColor: isConnected ? 'rgba(255, 255, 255, 0.07)' : 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: '#ffffff',
                  opacity: isConnected ? 1 : 0.4,
                  flexShrink: 0,
                }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#ffffff' }}>
                  {isConnected
                    ? isLocalMode
                      ? 'Local Desktop Connected'
                      : 'Spotify Web API Connected'
                    : 'Looking for Spotify on Windows'}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: 'var(--text-tertiary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {track ? `${track.name} · ${track.artist}` : 'Requires Spotify desktop app running on this PC'}
                </span>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm, 8px)',
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                fontSize: 11,
                lineHeight: 1.45,
                color: 'var(--text-secondary)',
              }}
            >
              <span style={{ fontWeight: 600, color: '#ffffff' }}>
                Why use Desktop Mode?
              </span>
              <span>
                • <strong>100% Free</strong>: Works with Spotify Free without Spotify Premium.
              </span>
              <span>
                • <strong>Zero Configuration</strong>: No Spotify Developer accounts or Client IDs needed.
              </span>
              <span>
                • <strong>Native Controls</strong>: Uses Windows hardware media keys and window title detection for fast playback.
              </span>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              {isConnected && (
                <button
                  type="button"
                  onClick={() => {
                    onDisconnect();
                  }}
                  className="apple-btn-text"
                  style={{ color: '#ff6b6b' }}
                >
                  Disconnect
                </button>
              )}
              <button
                type="button"
                onClick={handleDetectClick}
                disabled={isDetecting}
                className="apple-btn-text"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  borderColor: 'rgba(255, 255, 255, 0.16)',
                }}
              >
                {isDetecting ? 'Scanning…' : 'Detect Spotify Now'}
              </button>
              <button type="button" onClick={onClose} className="apple-btn-primary">
                Done
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: Web API (Developer Dashboard PKCE Flow) */}
        {effectiveTab === 'webapi' && (
          <form onSubmit={handleSubmitWebApi} style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>
              Connect Spotify Web API for cross-device cloud sync (requires a Spotify Developer App and Spotify Premium).
            </p>
            {isPremium && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-sm, 8px)',
                  backgroundColor: 'rgba(255, 255, 255, 0.07)',
                  border: '1px solid rgba(255, 255, 255, 0.14)',
                  fontSize: 11,
                  color: '#ffffff',
                }}
              >
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
                >
                  PREMIUM
                </span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  Premium active — full play, pause & skip control enabled.
                </span>
              </div>
            )}

            {/* Step 1 & 2 Instructions */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 7,
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm, 8px)',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                fontSize: 11,
              }}
            >
              <span style={{ color: 'var(--text-tertiary)', fontWeight: 600 }}>Setup Instructions:</span>
              <span style={{ color: 'var(--text-secondary)' }}>
                1. Go to <strong>developer.spotify.com/dashboard</strong> and create an app.
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>
                2. In App Settings, add this Redirect URI:
              </span>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                  padding: '6px 8px',
                  borderRadius: 'var(--radius-xs, 6px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: 'JetBrains Mono, monospace',
                    color: '#ffffff',
                    wordBreak: 'break-all',
                    flex: 1,
                  }}
                >
                  {SPOTIFY_REDIRECT_URI}
                </span>
                <button
                  type="button"
                  onClick={handleCopyUri}
                  className="apple-btn-text"
                  style={{
                    fontSize: 10,
                    padding: '3px 8px',
                    backgroundColor: copied ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.08)',
                    flexShrink: 0,
                  }}
                >
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Step 3: Client ID Input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)' }}>
                Client ID
              </label>
              <input
                type="text"
                value={clientIdInput}
                onChange={(e) => setClientIdInput(e.target.value)}
                placeholder="e.g. 7f8a19b0245a49..."
                disabled={isConnecting}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm, 8px)',
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                  border: '1px solid rgba(255, 255, 255, 0.14)',
                  color: '#ffffff',
                  fontSize: 11,
                  fontFamily: 'JetBrains Mono, monospace',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {error && (
              <span style={{ fontSize: 10, color: '#ff6b6b', lineHeight: 1.3 }}>
                {error}
              </span>
            )}

            {isConnecting && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 10,
                  color: 'var(--text-secondary)',
                }}
              >
                <span
                  className="animate-mono-pulse"
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    backgroundColor: '#ffffff',
                  }}
                />
                <span>Authorizing in browser… complete Spotify login</span>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              {isConnected && (
                <button
                  type="button"
                  onClick={() => {
                    onDisconnect();
                  }}
                  className="apple-btn-text"
                  style={{ color: '#ff6b6b' }}
                >
                  Disconnect
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                disabled={isConnecting}
                className="apple-btn-text"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!clientIdInput.trim() || isConnecting}
                className="apple-btn-primary"
                style={{
                  opacity: !clientIdInput.trim() || isConnecting ? 0.5 : 1,
                  cursor: !clientIdInput.trim() || isConnecting ? 'not-allowed' : 'pointer',
                }}
              >
                {isConnecting ? 'Waiting…' : 'Connect Web API'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
