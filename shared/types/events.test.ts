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
  SpotifyTrack,
  SpotifyPlaybackAction,
  SpotifyAuthStatus,
  formatTrackDuration,
  validateSpotifyAction,
  VisionInference,
  OperatorActionProposal,
  isVisionConfident,
  validateOperatorAction,
  canApproveAction,
  mapVisionToAiStatus,
  ViewMode,
  TaskDisplayState,
  formatTaskNumber,
  formatCountdown,
  mapTaskToDisplayState,
  groupPastCompletedTasksByDate,
  formatPastDateLabel,
  formatPomodoroDuration,
} from './events';

describe('Domain Models & Invariants', () => {
  describe('task history and Pomodoro display', () => {
    const completedTask = (id: string, dayPlanDate: string, completedAt?: string): Task => ({
      id, dayPlanDate, completedAt, title: id, status: 'DONE',
      displayOrder: 0, elapsedFocusSeconds: 0, createdAt: '',
    });

    it('groups by completion date, falls back to plan date, and sorts newest first', () => {
      const tasks = [
        completedTask('older', '2026-10-05', '2026-10-05T09:00:00Z'),
        completedTask('yesterday', '2026-10-01', '2026-10-09T12:00:00Z'),
        completedTask('fallback', '2026-10-08'),
        completedTask('same-day', '2026-10-09', '2026-10-09T13:00:00Z'),
      ];
      const groups = groupPastCompletedTasksByDate(tasks, '2026-10-10');
      expect(groups.map((group) => group.date)).toEqual(['2026-10-09', '2026-10-08', '2026-10-05']);
      expect(groups[0].tasks.map((task) => task.id)).toEqual(['yesterday', 'same-day']);
      expect(groups[0].formattedLabel).toBe('Yesterday · Oct 9, 2026');
      expect(groups[1].tasks[0].id).toBe('fallback');
      expect(tasks.map((task) => task.id)).toEqual(['older', 'yesterday', 'fallback', 'same-day']);
      expect(groupPastCompletedTasksByDate([], '2026-10-10')).toEqual([]);
    });

    it('labels yesterday across month and year boundaries, and labels older dates', () => {
      expect(formatPastDateLabel('2026-10-09', '2026-10-10')).toBe('Yesterday · Oct 9, 2026');
      expect(formatPastDateLabel('2026-09-30', '2026-10-01')).toBe('Yesterday · Sep 30, 2026');
      expect(formatPastDateLabel('2025-12-31', '2026-01-01')).toBe('Yesterday · Dec 31, 2025');
      expect(formatPastDateLabel('2026-10-08', '2026-10-10')).toBe('Thu, Oct 8, 2026');
      expect(formatPastDateLabel('Earlier', '2026-10-10')).toBe('Earlier');
    });

    it('formats configured, elapsed, completed, and untimed task durations', () => {
      expect(formatPomodoroDuration(0, 25)).toBe('25m');
      expect(formatPomodoroDuration(260, 25)).toBe('04:20 / 25m');
      expect(formatPomodoroDuration(1500, 25)).toBe('25:00 / 25m');
      expect(formatPomodoroDuration(1)).toBe('00:01');
      expect(formatPomodoroDuration(65.9)).toBe('01:05');
      expect(formatPomodoroDuration(0)).toBe('--');
      expect(formatPomodoroDuration(-5, 15)).toBe('15m');
      expect(formatPomodoroDuration(65, 0)).toBe('01:05');
    });
  });

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

  it('formats track duration and validates Spotify playback actions', () => {
    expect(formatTrackDuration(0)).toBe('00:00');
    expect(formatTrackDuration(65000)).toBe('01:05');
    expect(formatTrackDuration(215000)).toBe('03:35');

    expect(validateSpotifyAction('PLAY')).toBe(true);
    expect(validateSpotifyAction('PAUSE')).toBe(true);
    expect(validateSpotifyAction('TOGGLE')).toBe(true);
    expect(validateSpotifyAction('NEXT')).toBe(true);
    expect(validateSpotifyAction('PREVIOUS')).toBe(true);
    expect(validateSpotifyAction('INVALID_ACTION')).toBe(false);

    const sampleTrack: SpotifyTrack = {
      id: 'track-123',
      name: 'Midnight City',
      artist: 'M83',
      album: 'Hurry Up, We\'re Dreaming',
      durationMs: 243000,
      progressMs: 65000,
      isPlaying: true,
    };

    expect(sampleTrack.name).toBe('Midnight City');
    expect(sampleTrack.isPlaying).toBe(true);
  });

  it('gates vision inference on confidence threshold', () => {
    const base: VisionInference = {
      inferenceId: 'inf-1',
      frameId: 'frame-1',
      provider: 'mock',
      state: 'ERROR',
      confidence: 0.9,
      summary: 'Build error visible',
      createdAt: new Date().toISOString(),
    };
    expect(isVisionConfident(base)).toBe(true);
    expect(isVisionConfident({ ...base, confidence: 0.74 })).toBe(false);
    expect(isVisionConfident({ ...base, confidence: 0.75 })).toBe(true);
    expect(isVisionConfident({ ...base, confidence: NaN })).toBe(false);
    expect(isVisionConfident({ ...base, state: 'BOGUS' as never })).toBe(false);
  });

  it('validates operator tools and args', () => {
    expect(validateOperatorAction('click', { x: 100, y: 200 }).isValid).toBe(true);
    expect(validateOperatorAction('mouse_move', { x: 10, y: 20 }).isValid).toBe(true);
    expect(validateOperatorAction('click', { x: 'a', y: 1 }).isValid).toBe(false);
    expect(validateOperatorAction('type', { text: 'hello' }).isValid).toBe(true);
    expect(validateOperatorAction('type', { text: '' }).isValid).toBe(false);
    expect(validateOperatorAction('hotkey', { keys: 'ctrl+s' }).isValid).toBe(true);
    expect(validateOperatorAction('hotkey', {}).isValid).toBe(false);
    expect(validateOperatorAction('rm_rf', {}).isValid).toBe(false);
  });

  it('guards operator approval state machine', () => {
    expect(canApproveAction('PROPOSED')).toBe(true);
    expect(canApproveAction('APPROVED')).toBe(false);
    expect(canApproveAction('EXECUTED')).toBe(false);
    expect(canApproveAction('DENIED')).toBe(false);
    expect(canApproveAction('FAILED')).toBe(false);
  });

  it('maps vision states to honest AI statuses', () => {
    expect(mapVisionToAiStatus('STUCK')).toBe('WAITING_INPUT');
    expect(mapVisionToAiStatus('ERROR')).toBe('WAITING_INPUT');
    expect(mapVisionToAiStatus('DONE')).toBe('WORKING');
    expect(mapVisionToAiStatus('IDLE')).toBe('WORKING');
    expect(mapVisionToAiStatus('PROGRESSING')).toBe('WORKING');
  });

  it('serializes screen operator WS messages', () => {
    const vision: IdeToWidgetMessage = {
      type: 'ai/vision_update',
      payload: {
        inferenceId: 'inf-9',
        frameId: 'frame-9',
        provider: 'gemini',
        state: 'ERROR',
        confidence: 0.91,
        summary: 'TypeScript error overlay',
        createdAt: new Date().toISOString(),
      },
    };
    const parsed = JSON.parse(JSON.stringify(vision)) as IdeToWidgetMessage;
    expect(parsed.type).toBe('ai/vision_update');

    const proposal: IdeToWidgetMessage = {
      type: 'agent/action_proposed',
      payload: {
        actionId: 'act-1',
        tool: 'hotkey',
        args: { keys: 'ctrl+s' },
        prompt: 'Save open file?',
        status: 'PROPOSED',
        createdAt: new Date().toISOString(),
      } as OperatorActionProposal,
    };
    expect(JSON.parse(JSON.stringify(proposal)).type).toBe('agent/action_proposed');
  });

  describe('SESSION Redesign Display & View State Helpers', () => {
    it('formats 1-indexed two-digit airport board task numbers', () => {
      expect(formatTaskNumber(0)).toBe('01');
      expect(formatTaskNumber(1)).toBe('02');
      expect(formatTaskNumber(9)).toBe('10');
      expect(formatTaskNumber(99)).toBe('100');
    });

    it('formats countdown seconds into mm:ss display values', () => {
      expect(formatCountdown(1478)).toBe('24:38');
      expect(formatCountdown(65)).toBe('01:05');
      expect(formatCountdown(0)).toBe('00:00');
      expect(formatCountdown(-10)).toBe('00:00');
    });

    it('maps task and timer state to explicit airport status badge', () => {
      const activeTask: Task = {
        id: 't-1',
        dayPlanDate: '2026-10-07',
        title: 'Task 1',
        status: 'NOW',
        displayOrder: 0,
        elapsedFocusSeconds: 0,
        createdAt: new Date().toISOString(),
      };

      expect(mapTaskToDisplayState(null, false)).toBe('READY');
      expect(mapTaskToDisplayState(activeTask, true)).toBe('IN_FOCUS');
      expect(mapTaskToDisplayState(activeTask, false)).toBe('PAUSED');
      expect(mapTaskToDisplayState({ ...activeTask, status: 'DONE' }, false)).toBe('COMPLETED');
    });
  });
});

