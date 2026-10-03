/**
 * WorkPulse Shared Data Types & WebSocket Protocol Contracts
 */

export type TaskStatus = 'NOW' | 'NEXT' | 'LATER' | 'DONE';

export interface Task {
  id: string;
  dayPlanDate: string; // YYYY-MM-DD
  title: string;
  status: TaskStatus;
  displayOrder: number;
  estimatedMinutes?: number;
  elapsedFocusSeconds: number;
  createdAt: string; // ISO timestamp
  completedAt?: string; // ISO timestamp
}

export type AiRunStatus =
  | 'QUEUED'
  | 'PLANNING'
  | 'WORKING'
  | 'RUNNING_TOOLS'
  | 'WAITING_INPUT'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type TestStatus = 'NOT_RUN' | 'RUNNING' | 'PASSED' | 'FAILED';

export interface AiRun {
  id: string;
  taskId?: string;
  agentName: string;
  status: AiRunStatus;
  /** Original goal / task the agent was asked to do (set on run_started). */
  goal?: string;
  currentStepDescription?: string;
  currentStep?: number;
  totalSteps?: number;
  filesModifiedCount: number;
  /** Deduped list of modified file paths backing filesModifiedCount. */
  modifiedFiles?: string[];
  testStatus: TestStatus;
  /** Human-readable test summary from the last ai/tests_result event. */
  testSummary?: string;
  summary?: string;
  startedAt: string; // ISO timestamp
  completedAt?: string; // ISO timestamp
}

export interface DayPlan {
  date: string; // YYYY-MM-DD
  totalFocusSeconds: number;
  suggestedFirstTask?: string;
  createdAt: string;
}

export type TimelineEventType =
  | 'TASK_START'
  | 'TASK_DONE'
  | 'AI_START'
  | 'AI_WAITING'
  | 'FILES_CHANGED'
  | 'TESTS_RUN'
  | 'GIT_COMMIT';

export interface TimelineEvent {
  id: string;
  dayPlanDate: string;
  taskId?: string;
  aiRunId?: string;
  eventType: TimelineEventType;
  summary: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Telemetry & WebSocket Protocol Messages
// ---------------------------------------------------------------------------

export type IdeToWidgetMessage =
  | {
      type: 'ide/handshake';
      payload: { ideName: string; version: string; workspaceRoot: string };
    }
  | {
      type: 'ide/active_file';
      payload: { filePath: string; languageId: string };
    }
  | {
      type: 'ai/run_started';
      payload: {
        runId: string;
        taskId?: string;
        agentName: string;
        goal: string;
      };
    }
  | {
      type: 'ai/status_update';
      payload: {
        runId: string;
        agentName?: string;
        status: AiRunStatus;
        stepDescription?: string;
        currentStep?: number;
        totalSteps?: number;
      };
    }
  | {
      type: 'ai/waiting_input';
      payload: {
        runId: string;
        prompt: string;
        toolName?: string;
      };
    }
  | {
      type: 'ai/files_changed';
      payload: {
        runId: string;
        filePaths: string[];
      };
    }
  | {
      type: 'ai/tests_result';
      payload: {
        runId: string;
        status: 'RUNNING' | 'PASSED' | 'FAILED';
        summary?: string;
      };
    }
  | {
      type: 'ai/run_finished';
      payload: {
        runId: string;
        status: 'COMPLETED' | 'FAILED' | 'CANCELLED';
        summary?: string;
      };
    }
  | {
      type: 'git/commit_created';
      payload: {
        hash: string;
        message: string;
        filesChanged: number;
      };
    };

export type WidgetToIdeMessage =
  | {
      type: 'widget/open_task_in_ide';
      payload: { taskId: string; taskTitle: string };
    }
  | {
      type: 'widget/ping';
      payload: { timestamp: number };
    }
  | {
      type: 'widget/state_sync';
      payload: {
        activeTaskId?: string;
        tasksCount: number;
      };
    };

// ---------------------------------------------------------------------------
// Invariant & Helper Utilities
// ---------------------------------------------------------------------------

/**
 * Validates that at most one task has the 'NOW' status.
 */
export function validateSingleNowTask(tasks: Task[]): {
  isValid: boolean;
  error?: string;
} {
  const nowTasks = tasks.filter((t) => t.status === 'NOW');
  if (nowTasks.length > 1) {
    return {
      isValid: false,
      error: `Expected at most 1 active 'NOW' task, but found ${nowTasks.length}: ${nowTasks.map((t) => t.title).join(', ')}`,
    };
  }
  return { isValid: true };
}

/**
 * Calculates honest progress percentage based on completed vs total tasks.
 */
export function calculateCompletionPercentage(tasks: Task[]): number {
  if (tasks.length === 0) return 0;
  const doneCount = tasks.filter((t) => t.status === 'DONE').length;
  return Math.round((doneCount / tasks.length) * 100);
}

/**
 * Filters tasks that belong to a specific day plan date.
 * - Any uncompleted task (NOW, NEXT, LATER) is part of today's active workload (rolling over).
 * - Completed tasks are only included if they were completed on today's date.
 */
export function filterTodaysTasks(tasks: Task[], todayDate: string): Task[] {
  return tasks.filter((t) => {
    if (t.status !== 'DONE') {
      return true;
    }
    if (t.completedAt) {
      return t.completedAt.startsWith(todayDate);
    }
    return t.dayPlanDate === todayDate;
  });
}

/**
 * Filters tasks that were marked DONE on a previous day.
 */
export function filterPastCompletedTasks(tasks: Task[], todayDate: string): Task[] {
  return tasks.filter((t) => {
    if (t.status !== 'DONE') return false;
    if (t.completedAt) {
      return !t.completedAt.startsWith(todayDate);
    }
    return t.dayPlanDate !== todayDate;
  });
}

/**
 * Calculates honest progress percentage specifically for today's workload.
 * On a new day, past completed tasks are excluded so the meter cleanly reloads to 0% (or reflects only today).
 */
export function calculateDailyWorkloadPercentage(tasks: Task[], todayDate: string): number {
  const todaysTasks = filterTodaysTasks(tasks, todayDate);
  return calculateCompletionPercentage(todaysTasks);
}

/**
 * Checks if the AI is actively running work.
 */
export function isAiActive(status: AiRunStatus): boolean {
  return status === 'PLANNING' || status === 'WORKING' || status === 'RUNNING_TOOLS';
}

/**
 * Checks if the AI requires user intervention.
 */
export function isAiWaitingInput(status: AiRunStatus): boolean {
  return status === 'WAITING_INPUT';
}
