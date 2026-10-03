import { describe, it, expect } from 'vitest';
import {
  Task,
  AiRun,
  validateSingleNowTask,
  calculateCompletionPercentage,
  filterTodaysTasks,
  filterPastCompletedTasks,
  calculateDailyWorkloadPercentage,
  isAiActive,
  isAiWaitingInput,
  IdeToWidgetMessage,
} from './events';

describe('Domain Models & Invariants', () => {
  it('validates single active NOW task invariant', () => {
    const validTasks: Task[] = [
      {
        id: '1',
        dayPlanDate: '2026-09-30',
        title: 'Task A',
        status: 'NOW',
        displayOrder: 0,
        elapsedFocusSeconds: 120,
        createdAt: new Date().toISOString(),
      },
      {
        id: '2',
        dayPlanDate: '2026-09-30',
        title: 'Task B',
        status: 'NEXT',
        displayOrder: 1,
        elapsedFocusSeconds: 0,
        createdAt: new Date().toISOString(),
      },
    ];

    expect(validateSingleNowTask(validTasks).isValid).toBe(true);

    const invalidTasks: Task[] = [
      ...validTasks,
      {
        id: '3',
        dayPlanDate: '2026-09-30',
        title: 'Task C',
        status: 'NOW',
        displayOrder: 2,
        elapsedFocusSeconds: 0,
        createdAt: new Date().toISOString(),
      },
    ];

    const result = validateSingleNowTask(invalidTasks);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("Expected at most 1 active 'NOW' task");
  });

  it('calculates honest completion percentage', () => {
    expect(calculateCompletionPercentage([])).toBe(0);

    const tasks: Task[] = [
      { id: '1', dayPlanDate: '2026-09-30', title: '1', status: 'DONE', displayOrder: 0, elapsedFocusSeconds: 0, createdAt: '' },
      { id: '2', dayPlanDate: '2026-09-30', title: '2', status: 'DONE', displayOrder: 1, elapsedFocusSeconds: 0, createdAt: '' },
      { id: '3', dayPlanDate: '2026-09-30', title: '3', status: 'NOW', displayOrder: 2, elapsedFocusSeconds: 0, createdAt: '' },
      { id: '4', dayPlanDate: '2026-09-30', title: '4', status: 'NEXT', displayOrder: 3, elapsedFocusSeconds: 0, createdAt: '' },
    ];

    expect(calculateCompletionPercentage(tasks)).toBe(50);
  });

  it('filters today tasks vs past completed tasks on new day and reloads workload meter', () => {
    const today = '2026-10-03';
    const sampleTasks: Task[] = [
      // 2 tasks completed on previous day (2026-09-30)
      {
        id: 'past-1',
        dayPlanDate: '2026-09-30',
        title: 'Kohi',
        status: 'DONE',
        displayOrder: 0,
        elapsedFocusSeconds: 0,
        createdAt: '2026-09-30T10:00:00Z',
        completedAt: '2026-09-30T11:00:00Z',
      },
      {
        id: 'past-2',
        dayPlanDate: '2026-09-30',
        title: 'Reformat Laptop',
        status: 'DONE',
        displayOrder: 1,
        elapsedFocusSeconds: 0,
        createdAt: '2026-09-30T12:00:00Z',
        completedAt: '2026-09-30T13:00:00Z',
      },
      // 1 task rolled over / active for today (2026-10-03)
      {
        id: 'active-today',
        dayPlanDate: '2026-10-03',
        title: 'CRUD for Integ',
        status: 'NOW',
        displayOrder: 2,
        elapsedFocusSeconds: 0,
        createdAt: '2026-10-03T09:00:00Z',
      },
    ];

    // Past completed tasks must only contain past-1 and past-2
    const pastDone = filterPastCompletedTasks(sampleTasks, today);
    expect(pastDone.map((t) => t.id)).toEqual(['past-1', 'past-2']);

    // Today's tasks must only contain active-today (not past-1 or past-2)
    const todays = filterTodaysTasks(sampleTasks, today);
    expect(todays.map((t) => t.id)).toEqual(['active-today']);

    // On a new day with 0 done today and 1 active task, workload must reload to 0% (NOT 67%)
    expect(calculateDailyWorkloadPercentage(sampleTasks, today)).toBe(0);

    // If a task is completed today, workload updates honestly to 50% (1 of 2 done today)
    const updatedTasks: Task[] = [
      ...sampleTasks,
      {
        id: 'done-today',
        dayPlanDate: '2026-10-03',
        title: 'Review PR',
        status: 'DONE',
        displayOrder: 3,
        elapsedFocusSeconds: 0,
        createdAt: '2026-10-03T10:00:00Z',
        completedAt: '2026-10-03T10:30:00Z',
      },
    ];

    expect(calculateDailyWorkloadPercentage(updatedTasks, today)).toBe(50);
  });

  it('identifies AI active states and waiting input correctly', () => {
    expect(isAiActive('PLANNING')).toBe(true);
    expect(isAiActive('WORKING')).toBe(true);
    expect(isAiActive('RUNNING_TOOLS')).toBe(true);
    expect(isAiActive('WAITING_INPUT')).toBe(false);
    expect(isAiActive('COMPLETED')).toBe(false);

    expect(isAiWaitingInput('WAITING_INPUT')).toBe(true);
    expect(isAiWaitingInput('WORKING')).toBe(false);
  });

  it('correctly types and serializes IdeToWidget messages', () => {
    const handshakeMsg: IdeToWidgetMessage = {
      type: 'ide/handshake',
      payload: {
        ideName: 'VS Code',
        version: '1.92.0',
        workspaceRoot: 'c:/Users/Miggy/Documents/Work Window Haptics',
      },
    };

    const json = JSON.stringify(handshakeMsg);
    const parsed = JSON.parse(json) as IdeToWidgetMessage;
    expect(parsed.type).toBe('ide/handshake');
    if (parsed.type === 'ide/handshake') {
      expect(parsed.payload.ideName).toBe('VS Code');
    }
  });
});
