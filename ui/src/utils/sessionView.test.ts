import { describe, expect, it } from 'vitest';
import type { Task } from '@workpulse/shared';
import { getSessionCountdown, selectBoardTasks } from './sessionView';

const task = (id: string, status: Task['status'], dayPlanDate = '2026-10-26'): Task => ({ id, title: id, status, dayPlanDate, displayOrder: 0, elapsedFocusSeconds: 65, estimatedMinutes: 25, createdAt: '' });
describe('session views', () => {
  it('keeps unfinished carryovers in Today while completed history stays in Completed', () => {
    const tasks = [task('carry', 'NEXT', '2026-10-25'), task('old done', 'DONE', '2026-10-25'), task('today', 'DONE'), task('future', 'NEXT', '2026-10-27')];
    expect(selectBoardTasks(tasks, 'Today', '2026-10-26', '').map(t => t.id)).toEqual(['carry', 'today']);
    expect(selectBoardTasks(tasks, 'Completed', '2026-10-26', '').map(t => t.id)).toEqual(['today', 'old done']);
    expect(selectBoardTasks(tasks, 'All Tasks', '2026-10-26', 'CARRY').map(t => t.id)).toEqual(['carry']);
  });
  it('preserves the task timer across views and clamps completed sessions', () => {
    expect(getSessionCountdown(task('active', 'NOW'), 600, 30)).toBe(1435);
    expect(getSessionCountdown({ ...task('active', 'NOW'), estimatedMinutes: undefined }, 600, 30)).toBe(1200);
    expect(getSessionCountdown({ ...task('active', 'NOW'), elapsedFocusSeconds: 1600 }, 600, 30)).toBe(0);
  });
});
