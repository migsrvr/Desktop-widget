import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { emitTo, listen } from '@tauri-apps/api/event';
import { currentMonitor } from '@tauri-apps/api/window';
import type { ViewMode } from '@workpulse/shared';
import { getIslandGeometry } from '../utils/windowGeometry';
import { parseIslandAction, type IslandAction, type IslandSnapshot } from '../utils/islandProtocol';

export async function presentSurface(surface: 'board' | 'island', expanded = false, hasMusic = false) {
  if (!isTauri()) return;
  const monitor = await currentMonitor();
  const scale = monitor?.scaleFactor ?? 1;
  const position = monitor?.workArea.position.toLogical(scale);
  const size = monitor?.workArea.size.toLogical(scale);
  const geometry = getIslandGeometry(position && size ? { x: position.x, y: position.y, width: size.width, height: size.height } : null, expanded, hasMusic);
  await invoke('present_session_surface', { surface, geometry });
}

/** The board owns all mutable session state. The island receives snapshots and emits commands. */
export function useIslandOwner(snapshot: IslandSnapshot, viewMode: ViewMode, onAction: (action: IslandAction) => void) {
  const latest = useRef({ snapshot, onAction });
  latest.current = { snapshot, onAction };
  const [surfaceError, setSurfaceError] = useState<string | null>(null);
  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    const subscription = listen<unknown>('session:island-action', event => {
      const action = parseIslandAction(event.payload);
      if (!action || disposed) return;
      if (action.type === 'ready') void emitTo('island', 'session:snapshot', latest.current.snapshot);
      else latest.current.onAction(action);
    });
    return () => { disposed = true; void subscription.then(unlisten => unlisten()); };
  }, []);
  useEffect(() => { if (isTauri()) void emitTo('island', 'session:snapshot', snapshot).catch(console.warn); }, [snapshot]);
  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    void presentSurface(viewMode === 'BOARD' ? 'board' : 'island', false, snapshot.track != null)
      .then(() => { if (!disposed) setSurfaceError(null); })
      .catch(error => { if (!disposed) setSurfaceError(`Could not open the island: ${String(error)}`); });
    return () => { disposed = true; };
  }, [viewMode]);
  return surfaceError;
}

export function useIslandReceiver() {
  const [snapshot, setSnapshot] = useState<IslandSnapshot | null>(null);
  const latest = useRef<IslandSnapshot | null>(null);
  latest.current = snapshot;
  const send = useCallback((action: IslandAction) => { void emitTo('main', 'session:island-action', action); }, []);
  useEffect(() => {
    let disposed = false;
    let stop: (() => void) | undefined;
    let retry: ReturnType<typeof setInterval> | undefined;
    void listen<IslandSnapshot>('session:snapshot', event => { if (!disposed) setSnapshot(event.payload); }).then(unlisten => {
      if (disposed) { unlisten(); return; }
      stop = unlisten;
      send({ type: 'ready' });
      retry = setInterval(() => { if (!latest.current) send({ type: 'ready' }); }, 1000);
    });
    return () => { disposed = true; stop?.(); if (retry) clearInterval(retry); };
  }, [send]);
  const onLayout = useCallback((expanded: boolean) => { send({ type: 'layout', expanded }); }, [send]);
  return { snapshot, send, onLayout };
}
