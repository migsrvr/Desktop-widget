import type { SpotifyPlaybackAction, SpotifyTrack, Task, ViewMode, UsageSnapshot } from '@workpulse/shared';

export interface IslandSnapshot {
  mode: ViewMode;
  activeTask: Task | null;
  remainingSeconds: number;
  running: boolean;
  track: SpotifyTrack | null;
  usage: UsageSnapshot;
  now: number;
}
export type IslandAction = { type: 'ready' | 'toggle-timer' | 'complete' | 'open-board' | 'open-usage' | 'reset-timer' }
  | { type: 'layout'; expanded: boolean }
  | { type: 'music'; action: SpotifyPlaybackAction };

export function parseIslandAction(value: unknown): IslandAction | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (['ready', 'toggle-timer', 'complete', 'open-board', 'open-usage', 'reset-timer'].includes(v.type as string)) return { type: v.type } as IslandAction;
  if (v.type === 'layout' && typeof v.expanded === 'boolean') return { type: 'layout', expanded: v.expanded };
  if (v.type === 'music' && ['PLAY', 'PAUSE', 'TOGGLE', 'NEXT', 'PREVIOUS'].includes(v.action as string)) return { type: 'music', action: v.action } as IslandAction;
  return null;
}
