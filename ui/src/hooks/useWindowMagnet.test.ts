import { describe, it, expect } from 'vitest';
import { computeSnapTarget, SNAP_THRESHOLD, DOCK_MARGIN } from './useWindowMagnet';

const MON = { monX: 0, monY: 0, monW: 1920, monH: 1080 };
const WIN = { winW: 380, winH: 600 };

describe('computeSnapTarget', () => {
  it('snaps to the top-right corner when near both edges', () => {
    const target = computeSnapTarget({
      ...MON,
      ...WIN,
      winX: 1920 - 380 - 10, // right edge 10px off
      winY: 6, // top 6px off
    });
    expect(target.kind).toBe('top-right');
    expect(target.x).toBe(1920 - 380 - DOCK_MARGIN);
    expect(target.y).toBe(DOCK_MARGIN);
  });

  it('snaps to the right edge while keeping Y (clamped)', () => {
    const target = computeSnapTarget({ ...MON, ...WIN, winX: 1920 - 380 - 5, winY: 400 });
    expect(target.kind).toBe('right');
    expect(target.x).toBe(1920 - 380 - DOCK_MARGIN);
    expect(target.y).toBe(400);
  });

  it('snaps to the left edge', () => {
    const target = computeSnapTarget({ ...MON, ...WIN, winX: 4, winY: 300 });
    expect(target.kind).toBe('left');
    expect(target.x).toBe(DOCK_MARGIN);
    expect(target.y).toBe(300);
  });

  it('snaps to the top edge', () => {
    const target = computeSnapTarget({ ...MON, ...WIN, winX: 500, winY: 3 });
    expect(target.kind).toBe('top');
    expect(target.x).toBe(500);
    expect(target.y).toBe(DOCK_MARGIN);
  });

  it('leaves the window alone in the middle of the screen', () => {
    const target = computeSnapTarget({ ...MON, ...WIN, winX: 500, winY: 300 });
    expect(target.kind).toBeNull();
    expect(target.x).toBe(500);
    expect(target.y).toBe(300);
  });

  it('ignores edges beyond the snap threshold', () => {
    const target = computeSnapTarget({
      ...MON,
      ...WIN,
      winX: 1920 - 380 - (SNAP_THRESHOLD + 50),
      winY: 400,
    });
    expect(target.kind).toBeNull();
  });

  it('clamps Y so the snapped window never leaves the monitor', () => {
    const target = computeSnapTarget({ ...MON, ...WIN, winX: 1920 - 380 - 5, winY: 900 });
    expect(target.kind).toBe('right');
    expect(target.y).toBe(1080 - 600 - DOCK_MARGIN);
  });
});
