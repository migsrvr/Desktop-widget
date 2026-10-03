import React, { useState } from 'react';
import { SPOTIFY_REDIRECT_URI } from '@workpulse/shared';

interface SpotifySetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  isConnected: boolean;
  activeClientId?: string;
  isConnecting: boolean;
  error: string | null;
  onConnect: (clientId: string) => void;
  onDisconnect: () => void;
}

export const SpotifySetupModal: React.FC<SpotifySetupModalProps> = ({
  isOpen,
  onClose,
  isConnected,
  activeClientId,
  isConnecting,
  error,
  onConnect,
  onDisconnect,
}) => {
  const [clientIdInput, setClientIdInput] = useState(activeClientId || '');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyUri = () => {
    navigator.clipboard.writeText(SPOTIFY_REDIRECT_URI);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (clientIdInput.trim()) {
      onConnect(clientIdInput.trim());
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 14,
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
          maxWidth: 320,
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.1)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#ffffff' }}>
              Spotify Integration
            </span>
          </div>
          <button
            onClick={onClose}
            className="apple-btn-text"
            style={{ padding: '2px 6px', fontSize: 11 }}
          >
            ✕
          </button>
        </div>

        {isConnected ? (
          /* Connected State */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  backgroundColor: '#ffffff',
                }}
              />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#ffffff' }}>
                  Connected to Spotify
                </span>
                {activeClientId && (
                  <span
                    style={{
                      fontSize: 10,
                      color: 'var(--text-tertiary)',
                      fontFamily: 'monospace',
                    }}
                  >
                    ID: {activeClientId.slice(0, 8)}…{activeClientId.slice(-4)}
                  </span>
                )}
              </div>
            </div>

            <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              WorkPulse is linked to your Spotify account. Playback status and media controls are active in both the flyout and floating pill.
            </p>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <button
                onClick={() => {
                  onDisconnect();
                  onClose();
                }}
                className="apple-btn-text"
                style={{ color: '#ff6b6b' }}
              >
                Disconnect
              </button>
              <button onClick={onClose} className="apple-btn-primary">
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Connect Setup Flow */
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              Control your study & focus music directly inside WorkPulse.
            </p>

            {/* Step 1 & 2 Instructions */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                fontSize: 11,
              }}
            >
              <span style={{ color: 'var(--text-tertiary)', fontWeight: 600 }}>Setup (1 minute):</span>
              <span style={{ color: 'var(--text-secondary)' }}>
                1. In Spotify Developer Dashboard, create an app.
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>
                2. Add this Redirect URI:
              </span>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  backgroundColor: 'rgba(0, 0, 0, 0.4)',
                  padding: '4px 6px',
                  borderRadius: 'var(--radius-xs)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <span
                  style={{
                    fontSize: 9,
                    fontFamily: 'monospace',
                    color: 'var(--text-secondary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                  }}
                >
                  {SPOTIFY_REDIRECT_URI}
                </span>
                <button
                  type="button"
                  onClick={handleCopyUri}
                  className="apple-btn-text"
                  style={{ fontSize: 9, padding: '1px 5px' }}
                >
                  {copied ? 'Copied' : 'Copy'}
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
                placeholder="e.g. 7f8a19b..."
                disabled={isConnecting}
                style={{
                  width: '100%',
                  padding: '7px 9px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'rgba(0, 0, 0, 0.4)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#ffffff',
                  fontSize: 11,
                  fontFamily: 'monospace',
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
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 4 }}>
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
                {isConnecting ? 'Waiting…' : 'Connect'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
