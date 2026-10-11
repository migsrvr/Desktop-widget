import { invoke, isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { ViewMode } from '@workpulse/shared';

/**
 * Determines whether the window should remain always-on-top.
 * - Dock and Focus modes act as persistent on-screen widgets that float over other windows.
 * - Board mode acts as a normal desktop window unless explicitly pinned by the user.
 */
export function shouldKeepWindowOnTop(viewMode: ViewMode, isPinned: boolean): boolean {
  if (viewMode === 'DOCK' || viewMode === 'FOCUS') {
    return true;
  }
  return isPinned;
}

/**
 * Applies the window layering preference to the native window shell.
 */
export async function applyWindowLayering(viewMode: ViewMode, isPinned: boolean): Promise<void> {
  if (!isTauri()) return;
  const enable = shouldKeepWindowOnTop(viewMode, isPinned);
  try {
    await invoke('toggle_always_on_top', { enable });
  } catch (err) {
    console.warn('[WorkPulse] Failed to set window layering:', err);
  }
}

/**
 * Cleanly exits the desktop application, flushing pending storage/saves first.
 */
export async function exitApplication(flushPendingSaves?: () => Promise<void>): Promise<void> {
  if (flushPendingSaves) {
    try {
      await flushPendingSaves();
    } catch (err) {
      console.warn('[WorkPulse] Failed to flush pending saves before exit:', err);
    }
  }

  if (isTauri()) {
    try {
      await invoke('exit_app');
      return;
    } catch {
      try {
        const win = getCurrentWindow();
        await win.close();
        return;
      } catch {}
    }
  }

  if (typeof window !== 'undefined' && typeof window.close === 'function') {
    window.close();
  }
}
