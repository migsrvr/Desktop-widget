import { describe, it, expect } from 'vitest';
import {
  Task,
  AiRun,
  validateSingleNowTask,
  calculateCompletionPercentage,
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
    expect(parsed.payload.ideName).toBe('VS Code');
  });
});
