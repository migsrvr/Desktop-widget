import { describe, expect, it } from 'vitest';
import type { Task } from '@workpulse/shared';
import { advanceActiveTaskFocus } from './taskTimer';

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
});
