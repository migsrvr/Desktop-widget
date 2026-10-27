import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import type { IdeToWidgetMessage } from '@workpulse/shared';
import { useWorkpulseState } from './hooks/useWorkpulseState';
import { useWebSocketBridge } from './hooks/useWebSocketBridge';
import { useProviderUsage } from './hooks/useProviderUsage';
import { useIslandOwner, useIslandReceiver, presentSurface } from './hooks/useIslandBridge';
import { SessionBoard } from './components/SessionBoard';
import { SessionIsland } from './components/SessionIsland';
import { SpotifySetupModal } from './components/SpotifySetupModal';
import { getSessionCountdown, type BoardPage } from './utils/sessionView';
import type { IslandAction, IslandSnapshot } from './utils/islandProtocol';

function IslandSurface() {
  const { snapshot, send, onLayout } = useIslandReceiver();
  return <div className="island-surface"><SessionIsland key={snapshot?.mode} snapshot={snapshot} onAction={send} onLayout={onLayout} /></div>;
}

function MainApplication() {
  const session = useWorkpulseState();
  const [page, setPage] = useState<BoardPage>('Today');
  const [spotifySetup, setSpotifySetup] = useState(false);
  const { providers, ...usageControls } = useProviderUsage();
  const [now, setNow] = useState(Date.now);
  const stateMessageRef = useRef(session.handleIncomingIdeMessage);
  stateMessageRef.current = session.handleIncomingIdeMessage;
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const onBridgeMessage = useCallback((message: IdeToWidgetMessage) => {
    // General IDE telemetry is not an authenticated source of account allowances.
    if (message.type === 'usage/allowance') return;
    // Preserve the existing bridge integration without exposing agent/file feeds.
    stateMessageRef.current(message);
  }, []);
  // The local IDE bridge only exists alongside the desktop app; the public website never dials localhost.
  const { isConnected, sendMessage } = useWebSocketBridge({ onMessage: onBridgeMessage, enabled: isTauri() });
  const snapshot = useMemo<IslandSnapshot>(() => ({
    activeTask: session.activeTask,
    remainingSeconds: getSessionCountdown(session.activeTask, session.focusSeconds, session.targetMinutes),
    running: session.isTimerRunning,
    track: session.spotify.track,
    usage: providers, now, mode: session.viewMode,
  }), [session.activeTask, session.focusSeconds, session.targetMinutes, session.isTimerRunning, session.spotify.track, providers, now, session.viewMode]);
  const handleIslandAction = useCallback((action: IslandAction) => {
    switch (action.type) {
      case 'toggle-timer': session.toggleTimer(); break;
      case 'complete': session.completeActiveTask(); break;
      case 'reset-timer': session.resetTimer(); break;
      case 'open-board': session.setViewMode('BOARD'); break;
      case 'open-usage': setPage('AI Usage'); session.setViewMode('BOARD'); break;
      case 'music': void session.spotify.controlPlayback(action.action); break;
      case 'layout': if (session.viewMode !== 'BOARD') void presentSurface('island', action.expanded, session.spotify.track != null).catch(console.warn); break;
    }
  }, [session]);
  const surfaceError = useIslandOwner(snapshot, session.viewMode, handleIslandAction);
  const previewLayout = useCallback(() => {}, []);
  const native = isTauri();
  return <>
    {native || session.viewMode === 'BOARD' ? <SessionBoard session={session} page={page} onPage={setPage} providers={providers} usageControls={usageControls} now={now} bridgeConnected={isConnected}
      onSpotifySetup={() => { if (native) setSpotifySetup(true); }} onZoom={() => { if (native) void invoke('zoom_board'); }}
      onOpenEditor={() => { if (session.activeTask) sendMessage({ type: 'widget/open_task_in_ide', payload: { taskId: session.activeTask.id, taskTitle: session.activeTask.title } }); }} />
      : <div className="island-surface browser-island"><SessionIsland snapshot={snapshot} onAction={handleIslandAction} onLayout={previewLayout} /></div>}
    {surfaceError && <div className="surface-error" role="alert">{surfaceError}<button className="text-button" onClick={() => session.setViewMode('BOARD')}>Return to board</button></div>}
    <SpotifySetupModal isOpen={native && spotifySetup} onClose={() => setSpotifySetup(false)} isConnected={session.spotify.authStatus.isConnected} activeClientId={session.spotify.authStatus.clientId} accountType={session.spotify.authStatus.accountType} track={session.spotify.track} isConnecting={session.spotify.isConnecting} error={session.spotify.error} onConnect={session.spotify.startAuth} onDisconnect={session.spotify.disconnect} onDetectLocal={session.spotify.detectLocal} />
  </>;
}

export function App() {
  return isTauri() && new URLSearchParams(window.location.search).get('surface') === 'island' ? <IslandSurface /> : <MainApplication />;
}

