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
  | 'GIT_COMMIT'
  | 'SCREEN_OBSERVED'
  | 'VISION_INFERENCE'
  | 'ACTION_PROPOSED'
  | 'ACTION_EXECUTED';

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
    }
  | {
      type: 'screen/observed';
      payload: ScreenFrameMeta;
    }
  | {
      type: 'ai/vision_update';
      payload: VisionInference;
    }
  | {
      type: 'agent/action_proposed';
      payload: OperatorActionProposal;
    }
  | {
      type: 'spotify/auth_success';
      payload: {
        isConnected: boolean;
        clientId: string;
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
    }
  | {
      type: 'widget/operator_task';
      payload: { taskId: string; goal: string; mode: ScreenMode };
    }
  | {
      type: 'agent/action_decided';
      payload: { actionId: string; decision: 'APPROVED' | 'DENIED' };
    };

// ---------------------------------------------------------------------------
// Screen-aware OpenClaw Operator Contracts
// ---------------------------------------------------------------------------

export type ScreenMode = 'ON_DEMAND' | 'MONITOR' | 'OPERATOR';

export type VisionState = 'STUCK' | 'ERROR' | 'DONE' | 'IDLE' | 'PROGRESSING';

export type OperatorTool = 'mouse_move' | 'click' | 'type' | 'hotkey';

export type OperatorActionStatus =
  | 'PROPOSED'
  | 'APPROVED'
  | 'DENIED'
  | 'EXECUTED'
  | 'FAILED';

export interface ScreenFrameMeta {
  frameId: string;
  sessionId: string;
  windowTitle?: string;
  appName?: string;
  width: number;
  height: number;
  hash: string;
  capturedAt: string; // ISO timestamp
}

export interface VisionInference {
  inferenceId: string;
  frameId: string;
  provider: string; // 'gemini' | 'openai' | 'mock'
  state: VisionState;
  confidence: number; // 0..1
  summary: string;
  suggestedAction?: {
    tool: OperatorTool;
    args: Record<string, unknown>;
    rationale: string;
  };
  createdAt: string; // ISO timestamp
}

export interface OperatorActionProposal {
  actionId: string;
  inferenceId?: string;
  taskId?: string;
  tool: OperatorTool;
  args: Record<string, unknown>;
  prompt: string;
  status: OperatorActionStatus;
  createdAt: string; // ISO timestamp
}

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

// ---------------------------------------------------------------------------
// Spotify Web API Integration Contracts
// ---------------------------------------------------------------------------

export const SPOTIFY_REDIRECT_URI = 'http://127.0.0.1:41789/api/spotify/callback';

export interface SpotifyDevice {
  id?: string;
  name: string;
  type: string;
  volumePercent: number;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artist: string;
  album: string;
  albumArtUrl?: string;
  durationMs: number;
  progressMs: number;
  isPlaying: boolean;
  device?: SpotifyDevice;
}

export type SpotifyPlaybackAction = 'PLAY' | 'PAUSE' | 'TOGGLE' | 'NEXT' | 'PREVIOUS';

export interface SpotifyAuthStatus {
  isConnected: boolean;
  clientId?: string;
  userDisplayName?: string;
  /** Spotify account product: "premium" | "free" | "open" (absent when unknown). */
  accountType?: string;
}

/**
 * Formats milliseconds into clean MM:SS format.
 */
export function formatTrackDuration(ms: number): string {
  if (!ms || ms < 0) return '00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Validates a Spotify playback action.
 */
export function validateSpotifyAction(action: string): boolean {
  return ['PLAY', 'PAUSE', 'TOGGLE', 'NEXT', 'PREVIOUS'].includes(action);
}

// ---------------------------------------------------------------------------
// Screen operator helpers
// ---------------------------------------------------------------------------

const VISION_STATES: VisionState[] = ['STUCK', 'ERROR', 'DONE', 'IDLE', 'PROGRESSING'];
const OPERATOR_TOOLS: OperatorTool[] = ['mouse_move', 'click', 'type', 'hotkey'];

/**
 * Returns true when the vision inference is confident enough to act on.
 * Default threshold 0.75 per spec — below that we log only, never propose.
 */
export function isVisionConfident(inference: VisionInference, threshold = 0.75): boolean {
  if (!inference || typeof inference.confidence !== 'number') return false;
  if (!VISION_STATES.includes(inference.state)) return false;
  if (Number.isNaN(inference.confidence)) return false;
  return inference.confidence >= threshold;
}

/**
 * Validates an operator tool + args pair before proposing/executing.
 */
export function validateOperatorAction(
  tool: string,
  args: Record<string, unknown> | undefined | null
): { isValid: boolean; error?: string } {
  if (!OPERATOR_TOOLS.includes(tool as OperatorTool)) {
    return { isValid: false, error: `Unknown operator tool: ${tool}` };
  }
  const a = args ?? {};
  switch (tool as OperatorTool) {
    case 'mouse_move':
    case 'click': {
      const x = (a as Record<string, unknown>).x;
      const y = (a as Record<string, unknown>).y;
      if (typeof x !== 'number' || typeof y !== 'number') {
        return { isValid: false, error: `${tool} requires numeric x and y` };
      }
      return { isValid: true };
    }
    case 'type': {
      const text = (a as Record<string, unknown>).text;
      if (typeof text !== 'string' || text.length === 0) {
        return { isValid: false, error: `type requires non-empty text` };
      }
      return { isValid: true };
    }
    case 'hotkey': {
      const keys = (a as Record<string, unknown>).keys;
      if (typeof keys !== 'string' || keys.length === 0) {
        return { isValid: false, error: `hotkey requires keys string (e.g. "ctrl+s")` };
      }
      return { isValid: true };
    }
  }
  return { isValid: true };
}

/**
 * Only PROPOSED actions can be approved/denied. Guards the
 * PROPOSED -> APPROVED|DENIED -> EXECUTED|FAILED state machine.
 */
export function canApproveAction(status: OperatorActionStatus): boolean {
  return status === 'PROPOSED';
}

/**
 * Maps a vision state to the honest AiRunStatus shown in the widget.
 * STUCK/ERROR surface as WAITING_INPUT (needs human eyes); DONE maps to
 * WORKING here — completion itself is only marked by explicit task/done events.
 */
export function mapVisionToAiStatus(state: VisionState): AiRunStatus {
  switch (state) {
    case 'STUCK':
    case 'ERROR':
      return 'WAITING_INPUT';
    case 'DONE':
    case 'IDLE':
    case 'PROGRESSING':
    default:
      return 'WORKING';
  }
}

// ---------------------------------------------------------------------------
// SESSION Redesign Types & Display Helpers
// ---------------------------------------------------------------------------

export type ViewMode = 'BOARD' | 'FOCUS' | 'DOCK';

export type TaskDisplayState = 'READY' | 'IN_FOCUS' | 'PAUSED' | 'COMPLETED';

/**
 * Formats a 0-indexed number into a 1-indexed two-digit airport board string.
 * Example: 0 -> "01", 1 -> "02", 9 -> "10".
 */
export function formatTaskNumber(index: number): string {
  const num = Math.max(1, index + 1);
  return num < 10 ? `0${num}` : `${num}`;
}

/**
 * Formats seconds into mm:ss for the airport departure / studio countdown display.
 * Negative or invalid values safely format as "00:00".
 */
export function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Maps the current active task and focus timer status to an explicit display state.
 */
export function mapTaskToDisplayState(task: Task | null, isTimerRunning: boolean): TaskDisplayState {
  if (!task) return 'READY';
  if (task.status === 'DONE') return 'COMPLETED';
  return isTimerRunning ? 'IN_FOCUS' : 'PAUSED';
}

export interface PastDateGroup {
  date: string; // YYYY-MM-DD
  formattedLabel: string; // e.g. "Yesterday · Oct 9, 2026" or "Wed, Oct 8, 2026"
  tasks: Task[];
}

/**
 * Formats a YYYY-MM-DD date string into a friendly airport log label relative to today.
 */
export function formatPastDateLabel(dateStr: string, todayDateStr: string): string {
  try {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const [y, m, d] = parts.map(Number);
    if (!y || !m || !d) return dateStr;

    const dateObj = new Date(y, m - 1, d);

    const todayParts = todayDateStr.split('-');
    if (todayParts.length === 3) {
      const [ty, tm, td] = todayParts.map(Number);
      const todayObj = new Date(ty, tm - 1, td);
      const diffDays = Math.round((todayObj.getTime() - dateObj.getTime()) / (1000 * 60 * 60 * 24));

      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = monthNames[m - 1] || '';
      const dayFormatted = `${month} ${d}, ${y}`;

      if (diffDays === 1) {
        return `Yesterday · ${dayFormatted}`;
      }
      const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const weekday = weekdayNames[dateObj.getDay()] || '';
      return `${weekday}, ${dayFormatted}`;
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

/**
 * Groups past completed tasks by their completion date (or dayPlanDate fallback),
 * sorted descending with the most recent past date first.
 */
export function groupPastCompletedTasksByDate(pastTasks: Task[], todayDate: string): PastDateGroup[] {
  const groupsMap = new Map<string, Task[]>();

  for (const task of pastTasks) {
    const rawDate = task.completedAt ? task.completedAt.slice(0, 10) : task.dayPlanDate;
    const dateKey = rawDate || 'Earlier';
    if (!groupsMap.has(dateKey)) {
      groupsMap.set(dateKey, []);
    }
    groupsMap.get(dateKey)!.push(task);
  }

  // Sort descending: newest date first
  const sortedDates = Array.from(groupsMap.keys()).sort((a, b) => b.localeCompare(a));

  return sortedDates.map((date) => ({
    date,
    formattedLabel: formatPastDateLabel(date, todayDate),
    tasks: groupsMap.get(date) || [],
  }));
}

/**
 * Formats task duration for display in the airport departures board.
 * - If estimatedMinutes is set and elapsed > 0: "04:20 / 25m"
 * - If estimatedMinutes is set and elapsed == 0: "25m"
 * - If only elapsed > 0: "04:20"
 * - Otherwise: "--"
 */
export function formatPomodoroDuration(elapsedSeconds: number, estimatedMinutes?: number): string {
  const safeElapsed = Math.max(0, Math.floor(elapsedSeconds || 0));
  if (estimatedMinutes && estimatedMinutes > 0) {
    if (safeElapsed > 0) {
      const mins = Math.floor(safeElapsed / 60);
      const secs = safeElapsed % 60;
      const elapsedStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      return `${elapsedStr} / ${estimatedMinutes}m`;
    }
    return `${estimatedMinutes}m`;
  }
  if (safeElapsed > 0) {
    const mins = Math.floor(safeElapsed / 60);
    const secs = safeElapsed % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return '--';
}

