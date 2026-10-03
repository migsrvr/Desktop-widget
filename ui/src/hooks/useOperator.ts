import { useState, useCallback } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import {
  IdeToWidgetMessage,
  ScreenFrameMeta,
  VisionInference,
  OperatorActionProposal,
  ScreenMode,
} from '@workpulse/shared';

const BRIDGE = 'http://127.0.0.1:41789';

export function useOperator() {
  const [watching, setWatching] = useState(false);
  const [mode, setMode] = useState<ScreenMode>('MONITOR');
  const [lastFrame, setLastFrame] = useState<ScreenFrameMeta | null>(null);
  const [inference, setInference] = useState<VisionInference | null>(null);
  const [proposal, setProposal] = useState<OperatorActionProposal | null>(null);
  const [thumbTick, setThumbTick] = useState(0);

  const toggleWatching = useCallback(
    async (next?: boolean) => {
      const target = typeof next === 'boolean' ? next : !watching;
      try {
        if (isTauri()) {
          const status = await invoke<{ watching: boolean; mode: string }>('toggle_watching', {
            watching: target,
            mode,
          });
          setWatching(status.watching);
        } else {
          await fetch(`${BRIDGE}/api/screen/capture`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          }).catch(() => {});
          setWatching(target);
        }
      } catch {
        setWatching(target);
      }
    },
    [watching, mode]
  );

  const captureNow = useCallback(async () => {
    try {
      if (isTauri()) {
        const meta = await invoke<ScreenFrameMeta>('capture_now', {});
        setLastFrame({
          frameId: (meta as unknown as Record<string, string>).frameId ?? (meta as unknown as Record<string, string>).frame_id ?? 'frame-' + Date.now(),
          sessionId: (meta as unknown as Record<string, string>).sessionId ?? 'sess-local',
          width: (meta as unknown as Record<string, number>).width ?? 1,
          height: (meta as unknown as Record<string, number>).height ?? 1,
          hash: (meta as unknown as Record<string, string>).hash ?? '',
          capturedAt: (meta as unknown as Record<string, string>).capturedAt ?? new Date().toISOString(),
        });
      } else {
        const res = await fetch(`${BRIDGE}/api/screen/capture`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        const json = await res.json();
        const f = json.frame;
        if (f) {
          setLastFrame({
            frameId: f.frame_id ?? f.frameId,
            sessionId: f.session_id ?? f.sessionId ?? 'sess-local',
            windowTitle: undefined,
            appName: undefined,
            width: f.width ?? 1,
            height: f.height ?? 1,
            hash: f.hash ?? '',
            capturedAt: f.captured_at ?? f.capturedAt ?? new Date().toISOString(),
          });
        }
      }
      setThumbTick((t) => t + 1);
    } catch {
      /* bridge offline — stay silent in preview */
    }
  }, []);

  const decide = useCallback(async (decision: 'APPROVED' | 'DENIED') => {
    if (!proposal) return;
    try {
      if (isTauri()) {
        await invoke('operator_approve', { actionId: proposal.actionId, decision }).catch(() => {});
      }
      await fetch(`${BRIDGE}/api/operator/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_id: proposal.actionId, actionId: proposal.actionId, decision }),
      }).catch(() => {});
    } finally {
      setProposal(null);
    }
  }, [proposal]);

  const handleOperatorMessage = useCallback((msg: IdeToWidgetMessage) => {
    switch (msg.type) {
      case 'screen/observed':
        setLastFrame(msg.payload);
        setThumbTick((t) => t + 1);
        break;
      case 'ai/vision_update':
        setInference(msg.payload);
        break;
      case 'agent/action_proposed':
        setProposal(msg.payload);
        break;
      case 'agent/action_decided' as never:
        setProposal(null);
        break;
    }
  }, []);

  const thumbUrl = `${BRIDGE}/api/screen/latest?t=${thumbTick}`;

  return {
    watching,
    mode,
    setMode,
    lastFrame,
    inference,
    proposal,
    thumbUrl,
    thumbTick,
    toggleWatching,
    captureNow,
    approve: () => decide('APPROVED'),
    deny: () => decide('DENIED'),
    handleOperatorMessage,
  };
}
