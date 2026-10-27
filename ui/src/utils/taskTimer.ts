import type { Task } from '@workpulse/shared';

/** Advance the effective active task, including unfinished tasks carried over from earlier days. */
export function advanceActiveTaskFocus(tasks: Task[], seconds = 1): Task[] {
  if (seconds <= 0) return tasks;
  const index = tasks.findIndex((task) => task.status === 'NOW');
  if (index < 0) return tasks;
  const task = tasks[index];
  const elapsed = task.elapsedFocusSeconds || 0;
  const target = (task.estimatedMinutes || 0) * 60;
  if (target > 0 && elapsed >= target) return tasks;
  const nextElapsed = target > 0 ? Math.min(elapsed + seconds, target) : elapsed + seconds;
  return tasks.map((item, i) => i === index ? { ...item, elapsedFocusSeconds: nextElapsed } : item);
}

/**
 * Convert wall-clock time since the last settled tick into whole seconds.
 * Background tabs throttle intervals, so ticks are counted from the clock, not from callbacks.
 * The sub-second remainder is carried forward by returning the advanced anchor.
 */
export function settleElapsed(anchorMs: number, nowMs: number): { seconds: number; anchorMs: number } {
  const seconds = Math.max(0, Math.floor((nowMs - anchorMs) / 1000));
  return { seconds, anchorMs: anchorMs + seconds * 1000 };
}
