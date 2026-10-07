import { describe, it, expect } from 'vitest';
import {
  clampAndPositionBoard,
  getBoardCenteredGeometry,
  getFocusDockedGeometry,
  DEFAULT_BOARD_WIDTH,
  DEFAULT_BOARD_HEIGHT,
  DOCK_WIDTH,
  DOCK_HEIGHT,
  FOCUS_WIDTH,
  FOCUS_HEIGHT,
  FOCUS_HEIGHT_SPOTIFY,
  MonitorBounds,
  WindowGeometry,
} from './windowGeometry';

describe('windowGeometry', () => {
  const MON_1080P: MonitorBounds = { x: 0, y: 0, width: 1920, height: 1080 };
  const MON_720P: MonitorBounds = { x: 0, y: 0, width: 1280, height: 720 };
  const MON_SECONDARY: MonitorBounds = { x: 1920, y: 0, width: 1920, height: 1080 };

  it('centers 1340x800 on 1080p monitor on Board mode', () => {
    const result = getBoardCenteredGeometry(MON_1080P, null);
    expect(result.width).toBe(DEFAULT_BOARD_WIDTH);
    expect(result.height).toBe(DEFAULT_BOARD_HEIGHT);
    // Center X: (1920 - 1340) / 2 = 290
    expect(result.x).toBe(290);
    // Center Y: (1080 - 800) / 2 = 140
    expect(result.y).toBe(140);
  });

  it('centers on secondary monitor when app launches on secondary display', () => {
    const result = getBoardCenteredGeometry(MON_SECONDARY, null);
    expect(result.width).toBe(DEFAULT_BOARD_WIDTH);
    expect(result.height).toBe(DEFAULT_BOARD_HEIGHT);
    expect(result.x).toBe(1920 + 290);
    expect(result.y).toBe(140);
  });

  it('docks 420x260 Focus mode to the top-right corner of the monitor on Dock mode', () => {
    const result = getFocusDockedGeometry(MON_1080P, 420, 260, 16);
    expect(result.width).toBe(420);
    expect(result.height).toBe(260);
    // Top-right X: 1920 - 420 - 16 = 1484
    expect(result.x).toBe(1484);
    // Top-right Y: 16
    expect(result.y).toBe(16);
  });

  it('docks Focus mode to the top-right corner on secondary monitor', () => {
    const result = getFocusDockedGeometry(MON_SECONDARY, 420, 260, 16);
    expect(result.width).toBe(420);
    expect(result.height).toBe(260);
    // Top-right X on secondary: 1920 + 1920 - 420 - 16 = 3404
    expect(result.x).toBe(3404);
    expect(result.y).toBe(16);
  });

  it('clamps window size to available work area on smaller displays (e.g. 1280x720)', () => {
    const result = getBoardCenteredGeometry(MON_720P, null);
    // Max available width is 1280 - 40 = 1240
    expect(result.width).toBe(1240);
    // Max available height is 720 - 64 = 656
    expect(result.height).toBe(656);
    // Centered in smaller display
    expect(result.x).toBe(20);
    expect(result.y).toBe(32);
  });

  it('maintains distinct compact dimensions for Focus / Dock modes (420x280)', () => {
    expect(DOCK_WIDTH).toBe(420);
    expect(DOCK_HEIGHT).toBe(280);
    expect(FOCUS_WIDTH).toBe(420);
    expect(FOCUS_HEIGHT).toBe(280);
  });

  it('grows Focus / Dock to 420x330 while the Spotify strip is visible', () => {
    expect(FOCUS_HEIGHT_SPOTIFY).toBe(330);
    expect(FOCUS_HEIGHT_SPOTIFY).toBeGreaterThan(FOCUS_HEIGHT);
  });
});
