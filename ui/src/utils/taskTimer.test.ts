import { describe, expect, it } from 'vitest';
import type { Task } from '@workpulse/shared';
import { advanceActiveTaskFocus, settleElapsed } from './taskTimer';

const task = (id: string, status: Task['status'], elapsedFocusSeconds = 0): Task => ({
  id, status, elapsedFocusSeconds, title: id, dayPlanDate: '2026-10-09',
  displayOrder: 0, createdAt: '',
});

describe('active task timer', () => {
  it('advances only the active task, including carried-over work, without mutating input', () => {
    const tasks = [task('queued', 'NEXT', 20), task('active', 'NOW', 4), task('done', 'DONE', 60)];
    const result = advanceActiveTaskFocus(tasks);
    expect(result.map((item) => item.elapsedFocusSeconds)).toEqual([20, 5, 60]);
    expect(tasks[1].elapsedFocusSeconds).toBe(4);
    expect(result[0]).toBe(tasks[0]);
    expect(result[2]).toBe(tasks[2]);
  });

  it('reaches a Pomodoro target exactly and does not run into overtime', () => {
    const tasks = [{ ...task('active', 'NOW', 1499), estimatedMinutes: 25 }];
    const result = advanceActiveTaskFocus(tasks);
    expect(result[0].elapsedFocusSeconds).toBe(1500);
    expect(advanceActiveTaskFocus(result)).toBe(result);
    const overTarget = [{ ...tasks[0], elapsedFocusSeconds: 1600 }];
    expect(advanceActiveTaskFocus(overTarget)).toBe(overTarget);
  });

  it('supports untimed work and leaves an empty or inactive queue unchanged', () => {
    expect(advanceActiveTaskFocus([task('untimed', 'NOW', 2700)])[0].elapsedFocusSeconds).toBe(2701);
    const tasks = [task('queued', 'NEXT'), task('done', 'DONE')];
    expect(advanceActiveTaskFocus(tasks)).toBe(tasks);
    const empty: Task[] = [];
    expect(advanceActiveTaskFocus(empty)).toBe(empty);
  });

  it('applies a multi-second catch-up in one step and still clamps to the target', () => {
    const tasks = [{ ...task('active', 'NOW', 1400), estimatedMinutes: 25 }];
    expect(advanceActiveTaskFocus(tasks, 60)[0].elapsedFocusSeconds).toBe(1460);
    expect(advanceActiveTaskFocus(tasks, 600)[0].elapsedFocusSeconds).toBe(1500);
    expect(advanceActiveTaskFocus(tasks, 0)).toBe(tasks);
  });
});

describe('wall-clock settling', () => {
  it('counts whole seconds from the clock and carries the remainder', () => {
    expect(settleElapsed(1_000, 1_999)).toEqual({ seconds: 0, anchorMs: 1_000 });
    expect(settleElapsed(1_000, 3_500)).toEqual({ seconds: 2, anchorMs: 3_000 });
  });

  it('recovers a long background gap that a throttled interval would have missed', () => {
    const start = 10_000;
    const afterBackground = start + 61_250;
    expect(settleElapsed(start, afterBackground)).toEqual({ seconds: 61, anchorMs: start + 61_000 });
  });

  it('never goes backwards when the clock moves behind the anchor', () => {
    expect(settleElapsed(5_000, 4_000)).toEqual({ seconds: 0, anchorMs: 5_000 });
  });
});
