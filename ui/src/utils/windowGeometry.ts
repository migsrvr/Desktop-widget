export interface WindowGeometry {
  width: number;
  height: number;
  x?: number;
  y?: number;
}

export interface MonitorBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const DEFAULT_BOARD_WIDTH = 1340;
export const DEFAULT_BOARD_HEIGHT = 800;
export const FOCUS_WIDTH = 420;
export const FOCUS_HEIGHT = 280;
/** Focus window height while the Spotify mini strip is visible (measured: 326 content + 4 air). */
export const FOCUS_HEIGHT_SPOTIFY = 330;
export const DOCK_WIDTH = 420;
export const DOCK_HEIGHT = 280;
export const DOCK_MARGIN = 16;

export const STORAGE_KEY_BOARD_GEOMETRY = 'session_board_geometry_v1';

/**
 * Calculates centered window bounds for Board mode.
 * Clamps dimensions to screen work area if on smaller displays.
 */
export function getBoardCenteredGeometry(
  monitor: MonitorBounds | null,
  saved?: WindowGeometry | null,
  defaultW: number = DEFAULT_BOARD_WIDTH,
  defaultH: number = DEFAULT_BOARD_HEIGHT
): { width: number; height: number; x: number; y: number } {
  if (!monitor) {
    return {
      width: defaultW,
      height: defaultH,
      x: 100,
      y: 100,
    };
  }

  const PADDING_X = 20;
  const PADDING_Y = 32;

  const maxW = Math.max(360, monitor.width - PADDING_X * 2);
  const maxH = Math.max(300, monitor.height - PADDING_Y * 2);

  const desiredW = saved?.width && saved.width >= 600 ? saved.width : defaultW;
  const desiredH = saved?.height && saved.height >= 500 ? saved.height : defaultH;

  const clampedW = Math.round(Math.min(desiredW, maxW));
  const clampedH = Math.round(Math.min(desiredH, maxH));

  const x = Math.round(monitor.x + (monitor.width - clampedW) / 2);
  const y = Math.round(monitor.y + (monitor.height - clampedH) / 2);

  return { width: clampedW, height: clampedH, x, y };
}

/**
 * Calculates top-right docked window bounds for Focus mode.
 */
export function getFocusDockedGeometry(
  monitor: MonitorBounds | null,
  width: number = FOCUS_WIDTH,
  height: number = FOCUS_HEIGHT,
  margin: number = DOCK_MARGIN
): { width: number; height: number; x: number; y: number } {
  if (!monitor) {
    return {
      width,
      height,
      x: 100,
      y: margin,
    };
  }

  const x = Math.round(monitor.x + monitor.width - width - margin);
  const y = Math.round(monitor.y + margin);

  return { width, height, x, y };
}

/**
 * Legacy wrapper for clampAndPositionBoard.
 */
export function clampAndPositionBoard(
  monitor: MonitorBounds | null,
  saved: WindowGeometry | null,
  defaultW: number = DEFAULT_BOARD_WIDTH,
  defaultH: number = DEFAULT_BOARD_HEIGHT
): { width: number; height: number; x: number; y: number } {
  return getBoardCenteredGeometry(monitor, saved, defaultW, defaultH);
}
