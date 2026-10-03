import { useCallback, useEffect, useRef, useState } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow, currentMonitor } from '@tauri-apps/api/window';
import { PhysicalPosition } from '@tauri-apps/api/dpi';
import { haptics } from '../audio/haptics';

/**
 * Sticky-note window behavior for the WorkPulse widget:
 * - Proximity magnet: dragging near a screen edge snaps to it.
 * - Fling-to-dock: throwing the widget toward the right side docks it
 *   top-right, like flicking a sticky note into the corner.
 * - dockTopRight(): programmatic dock (Dock button / double-click header).
 */

export const SNAP_THRESHOLD = 24; // logical px — grab distance for the magnet
export const DOCK_MARGIN = 12; // logical px — gap kept from screen edges
const FLING_VELOCITY = 1000; // logical px/s — how fast a "throw" must be
const LIVE_SNAP_MAX_SPEED = 700; // logical px/s — skip gentle magnet mid-fling
const DROP_QUIET_MS = 180; // ms of no movement before a drag counts as dropped
const OWN_MOVE_GRACE_MS = 400; // ignore move events caused by our own setPosition

export type SnapKind = 'top-right' | 'right' | 'left' | 'top' | null;

export interface SnapGeometry {
  winX: number;
  winY: number;
  winW: number;
  winH: number;
  monX: number;
  monY: number;
  monW: number;
  monH: number;
}

export interface SnapTarget {
  x: number;
  y: number;
  kind: SnapKind;
}

/**
 * Pure snap math (all coordinates in logical px). Returns the snapped
 * top-left plus which edge(s) caught, or kind null when out of range.
 */
export function computeSnapTarget(
  g: SnapGeometry,
  threshold: number = SNAP_THRESHOLD,
  margin: number = DOCK_MARGIN
): SnapTarget {
  const monRight = g.monX + g.monW;
  const monBottom = g.monY + g.monH;
  const winRight = g.winX + g.winW;

  const nearRight = Math.abs(monRight - winRight) <= threshold;
  const nearLeft = Math.abs(g.winX - g.monX) <= threshold;
  const nearTop = Math.abs(g.winY - g.monY) <= threshold;

  const clampY = (y: number) =>
    g.winH + margin * 2 >= g.monH ? g.monY + margin : Math.min(Math.max(y, g.monY + margin), monBottom - g.winH - margin);
  const clampX = (x: number) =>
    g.winW + margin * 2 >= g.monW ? g.monX + margin : Math.min(Math.max(x, g.monX + margin), monRight - g.winW - margin);

  if (nearRight && nearTop) {
    return { x: monRight - g.winW - margin, y: g.monY + margin, kind: 'top-right' };
  }
  if (nearRight) {
    return { x: monRight - g.winW - margin, y: clampY(g.winY), kind: 'right' };
  }
  if (nearLeft) {
    return { x: g.monX + margin, y: clampY(g.winY), kind: 'left' };
  }
  if (nearTop) {
    return { x: clampX(g.winX), y: g.monY + margin, kind: 'top' };
  }
  return { x: g.winX, y: g.winY, kind: null };
}

interface TrailPoint {
  x: number;
  y: number;
  t: number;
}

export function useWindowMagnet(layoutKey: string) {
  const [isDocked, setIsDocked] = useState(false);

  const sizeRef = useRef<{ w: number; h: number } | null>(null);
  const monRef = useRef<{ x: number; y: number; w: number; h: number; scale: number } | null>(null);
  const progRef = useRef(0);
  const trailRef = useRef<TrailPoint[]>([]);
  const dropTimerRef = useRef<number | null>(null);

  const refreshMetrics = useCallback(async () => {
    if (!isTauri()) return;
    try {
      const win = getCurrentWindow();
      const [size, scale, mon] = await Promise.all([
        win.outerSize(),
        win.scaleFactor(),
        currentMonitor(),
      ]);
      const ls = size.toLogical(scale);
      sizeRef.current = { w: ls.width, h: ls.height };
      if (mon) {
        const mp = mon.position.toLogical(scale);
        const ms = mon.size.toLogical(scale);
        monRef.current = { x: mp.x, y: mp.y, w: ms.width, h: ms.height, scale };
      }
    } catch {
      // Bridge offline (browser dev) — magnet stays dormant.
    }
  }, []);

  const moveToLogical = useCallback(async (x: number, y: number, silent = false) => {
    if (!isTauri()) return;
    try {
      const win = getCurrentWindow();
      const scale = monRef.current?.scale ?? (await win.scaleFactor().catch(() => 1));
      progRef.current = Date.now();
      trailRef.current = [];
      await win.setPosition(new PhysicalPosition(Math.round(x * scale), Math.round(y * scale)));
      if (!silent) haptics.snapClick();
    } catch {
      // Ignore — window may be animating through a resize.
    }
  }, []);

  const dockTopRight = useCallback(async () => {
    await refreshMetrics();
    const mon = monRef.current;
    const size = sizeRef.current;
    if (!mon || !size) return;
    await moveToLogical(mon.x + mon.w - size.w - DOCK_MARGIN, mon.y + DOCK_MARGIN);
    setIsDocked(true);
  }, [refreshMetrics, moveToLogical]);

  const startDrag = useCallback(async () => {
    if (!isTauri()) return;
    try {
      await getCurrentWindow().startDragging();
    } catch {
      // Native drag unavailable — data-tauri-drag-region still covers mouse drags.
    }
  }, []);

  // Re-measure after expand/collapse or flyout changes resize the window.
  useEffect(() => {
    refreshMetrics();
    if (!isTauri()) return;
    const t = window.setTimeout(refreshMetrics, 350);
    return () => window.clearTimeout(t);
  }, [layoutKey, refreshMetrics]);

  const evaluateDrop = useCallback(
    async (dropX: number, dropY: number) => {
      const mon = monRef.current;
      const size = sizeRef.current;
      const trail = trailRef.current;
      trailRef.current = [];
      if (!mon || !size || trail.length < 2) return;

      const first = trail[0];
      const last = trail[trail.length - 1];
      const dt = (last.t - first.t) / 1000;
      if (dt <= 0 || dt > 0.6) return;

      const vx = (last.x - first.x) / dt;
      const vy = (last.y - first.y) / dt;
      const centerX = dropX + size.w / 2;
      const inRightZone = centerX > mon.x + mon.w * 0.55;
      const flungRight = vx > FLING_VELOCITY && inRightZone;
      const flungUp = vy < -FLING_VELOCITY && inRightZone && dropY < mon.y + mon.h * 0.5;

      if (flungRight || flungUp) {
        await moveToLogical(mon.x + mon.w - size.w - DOCK_MARGIN, mon.y + DOCK_MARGIN);
        setIsDocked(true);
      }
    },
    [moveToLogical]
  );

  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      try {
        await refreshMetrics();
        const win = getCurrentWindow();
        unlisten = await win.onMoved(({ payload }) => {
          void (async () => {
            if (cancelled) return;
            if (Date.now() - progRef.current < OWN_MOVE_GRACE_MS) return; // our own snap
            const mon = monRef.current;
            const size = sizeRef.current;
            if (!mon || !size) {
              void refreshMetrics();
              return;
            }

            const lx = payload.x / mon.scale;
            const ly = payload.y / mon.scale;
            const now = Date.now();
            trailRef.current.push({ x: lx, y: ly, t: now });
            if (trailRef.current.length > 12) trailRef.current.shift();
            setIsDocked(false);

            if (dropTimerRef.current) window.clearTimeout(dropTimerRef.current);
            dropTimerRef.current = window.setTimeout(() => void evaluateDrop(lx, ly), DROP_QUIET_MS);

            // Skip the gentle magnet mid-fling so a fast throw can
            // travel — the drop evaluation docks it top-right instead.
            const trail = trailRef.current;
            if (trail.length >= 2) {
              const a = trail[trail.length - 2];
              const b = trail[trail.length - 1];
              const dt = (b.t - a.t) / 1000;
              if (dt > 0) {
                const speed = Math.hypot(b.x - a.x, b.y - a.y) / dt;
                if (speed > LIVE_SNAP_MAX_SPEED) return;
              }
            }

            const target = computeSnapTarget({
              winX: lx,
              winY: ly,
              winW: size.w,
              winH: size.h,
              monX: mon.x,
              monY: mon.y,
              monW: mon.w,
              monH: mon.h,
            });
            if (target.kind && (Math.abs(target.x - lx) > 1 || Math.abs(target.y - ly) > 1)) {
              await moveToLogical(target.x, target.y);
            }
          })();
        });
      } catch {
        // Magnet unavailable — widget still drags natively.
      }
    })();

    return () => {
      cancelled = true;
      if (unlisten) unlisten();
      if (dropTimerRef.current) window.clearTimeout(dropTimerRef.current);
    };
  }, [refreshMetrics, moveToLogical, evaluateDrop]);

  return { dockTopRight, startDrag, isDocked };
}
