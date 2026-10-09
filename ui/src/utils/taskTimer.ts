import type { Task } from '@workpulse/shared';

/** Advance the effective active task, including unfinished tasks carried over from earlier days. */
export function advanceActiveTaskFocus(tasks: Task[]): Task[] {
  const index = tasks.findIndex((task) => task.status === 'NOW');
  if (index < 0) return tasks;
  const task = tasks[index];
  const elapsed = task.elapsedFocusSeconds || 0;
  const target = (task.estimatedMinutes || 0) * 60;
  if (target > 0 && elapsed >= target) return tasks;
  const nextElapsed = target > 0 ? Math.min(elapsed + 1, target) : elapsed + 1;
  return tasks.map((item, i) => i === index ? { ...item, elapsedFocusSeconds: nextElapsed } : item);
}
