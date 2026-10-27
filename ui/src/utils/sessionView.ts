import type { Task } from '@workpulse/shared';

export type BoardPage = 'Today' | 'All Tasks' | 'Completed' | 'AI Usage' | 'Settings';

export function selectBoardTasks(tasks: Task[], page: BoardPage, activeDate: string, query: string): Task[] {
  return tasks.filter(task => {
    if (page === 'Completed' && task.status !== 'DONE') return false;
    if (page === 'Today' && !(task.dayPlanDate === activeDate || (task.status !== 'DONE' && task.dayPlanDate < activeDate))) return false;
    return task.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  }).sort((a, b) => page === 'Completed'
    ? (b.completedAt ?? b.dayPlanDate).localeCompare(a.completedAt ?? a.dayPlanDate)
    : a.displayOrder - b.displayOrder);
}

export function getSessionCountdown(activeTask: Task | null, focusSeconds: number, targetMinutes: number): number {
  return Math.max(0, (activeTask?.estimatedMinutes ?? targetMinutes) * 60 - (activeTask?.estimatedMinutes != null ? activeTask.elapsedFocusSeconds : focusSeconds));
}
