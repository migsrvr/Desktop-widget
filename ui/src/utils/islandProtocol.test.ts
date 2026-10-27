import { describe, it, expect } from 'vitest';
import { parseIslandAction } from './islandProtocol';
import { getIslandGeometry } from './windowGeometry';

describe('island boundary', () => {
  it('accepts only explicit island actions and supported music commands', () => {
    expect(parseIslandAction({ type: 'toggle-timer' })).toEqual({ type: 'toggle-timer' });
    expect(parseIslandAction({ type: 'music', action: 'NEXT' })).toEqual({ type: 'music', action: 'NEXT' });
    for (const input of [null, { type: 'exit' }, { type: 'music', action: 'DELETE' }, { type: 'layout', expanded: 'true' }]) expect(parseIslandAction(input)).toBeNull();
  });
  it('centers below the menu bar in logical work-area coordinates on a left-hand monitor', () => {
    expect(getIslandGeometry({ x: -1512, y: 38, width: 1512, height: 904 }, false, false)).toEqual({ x: -916, y: 50, width: 320, height: 48 });
    expect(getIslandGeometry({ x: 0, y: 38, width: 1512, height: 904 }, true, true)).toEqual({ x: 556, y: 50, width: 400, height: 244 });
  });
  it('clamps to small work areas and never lets the expanded island leave the display', () => {
    expect(getIslandGeometry({ x: 0, y: 24, width: 360, height: 200 }, true, true)).toEqual({ x: 8, y: 36, width: 344, height: 176 });
  });
});
