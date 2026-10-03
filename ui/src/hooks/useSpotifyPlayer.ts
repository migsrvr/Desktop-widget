import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import {
  SpotifyTrack,
  SpotifyAuthStatus,
  SpotifyPlaybackAction,
} from '@workpulse/shared';

interface SpotifyStatusResponse {
  isConnected: boolean;
  clientId?: string;
  track?: SpotifyTrack;
}

export function useSpotifyPlayer() {
  const [track, setTrack] = useState<SpotifyTrack | null>(null);
  const [authStatus, setAuthStatus] = useState<SpotifyAuthStatus>({
    isConnected: false,
  });
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const isPollingRef = useRef<boolean>(false);

  // Poll Spotify status from Tauri backend
  const refresh = useCallback(async () => {
    if (!isTauri()) {
      return;
    }

    try {
      const res = await invoke<SpotifyStatusResponse>('spotify_get_status');
      setAuthStatus({
        isConnected: res.isConnected,
        clientId: res.clientId,
      });
      setTrack(res.track ?? null);
      setError(null);
    } catch (err: any) {
      console.warn('[WorkPulse Spotify] Error polling status:', err);
      // Keep last known status unless disconnected
    }
  }, []);

  // Initial load
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Polling loop when connected
  useEffect(() => {
    if (!authStatus.isConnected) return;

    let intervalId: number;
    const pollInterval = track?.isPlaying ? 3000 : 6000;

    intervalId = window.setInterval(() => {
      if (!isPollingRef.current) {
        isPollingRef.current = true;
        refresh().finally(() => {
          isPollingRef.current = false;
        });
      }
    }, pollInterval);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [authStatus.isConnected, track?.isPlaying, refresh]);

  // Start Spotify OAuth loopback session
  const startAuth = useCallback(async (clientId: string) => {
    const trimmed = clientId.trim();
    if (!trimmed) {
      setError('Spotify Client ID cannot be empty');
      return;
    }

    setIsConnecting(true);
    setError(null);

    if (isTauri()) {
      try {
        const authUrl = await invoke<string>('spotify_start_login', {
          clientId: trimmed,
        });
        return authUrl;
      } catch (err: any) {
        setIsConnecting(false);
        setError(String(err));
      }
    } else {
      setIsConnecting(false);
      setError('Spotify connection is available in the desktop application');
    }
  }, []);

  // Called when WebSocket receives spotify/auth_success broadcast
  const handleAuthSuccess = useCallback(
    (clientId: string) => {
      setIsConnecting(false);
      setAuthStatus({
        isConnected: true,
        clientId,
      });
      setError(null);
      // Immediately refresh playback
      setTimeout(refresh, 500);
    },
    [refresh]
  );

  // Send player action (PLAY, PAUSE, TOGGLE, NEXT, PREVIOUS)
  const controlPlayback = useCallback(
    async (action: SpotifyPlaybackAction) => {
      if (!authStatus.isConnected) return;

      // Optimistic state updates for instant tactile feel
      if (track) {
        if (action === 'PAUSE') {
          setTrack((prev) => (prev ? { ...prev, isPlaying: false } : null));
        } else if (action === 'PLAY') {
          setTrack((prev) => (prev ? { ...prev, isPlaying: true } : null));
        } else if (action === 'TOGGLE') {
          setTrack((prev) =>
            prev ? { ...prev, isPlaying: !prev.isPlaying } : null
          );
        }
      }

      if (isTauri()) {
        try {
          await invoke('spotify_control', { action });
          // Poll after 400ms to get updated track state from Spotify
          setTimeout(refresh, 400);
        } catch (err: any) {
          console.warn('[WorkPulse Spotify] Control error:', err);
          setError(String(err));
          // Refresh true state
          setTimeout(refresh, 600);
        }
      }
    },
    [authStatus.isConnected, track, refresh]
  );

  // Disconnect Spotify
  const disconnect = useCallback(async () => {
    if (isTauri()) {
      try {
        await invoke('spotify_disconnect');
      } catch (err) {
        console.warn('[WorkPulse Spotify] Disconnect error:', err);
      }
    }
    setAuthStatus({ isConnected: false });
    setTrack(null);
    setIsConnecting(false);
  }, []);

  return {
    track,
    authStatus,
    isConnecting,
    error,
    startAuth,
    controlPlayback,
    disconnect,
    refresh,
    handleAuthSuccess,
  };
}
