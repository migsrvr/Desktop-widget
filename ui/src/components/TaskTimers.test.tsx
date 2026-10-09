import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Task } from '@workpulse/shared';
import { FocusView } from './FocusView';
import { CurrentSessionBanner } from './CurrentSessionBanner';
import { TaskList } from './TaskList';

const noop = () => {};
const activeTask: Task = {
  id: 'active', title: 'Write tests', status: 'NOW', dayPlanDate: '2026-10-10',
  estimatedMinutes: 25, elapsedFocusSeconds: 65, displayOrder: 0, createdAt: '',
};
const timerProps = {
  activeTask, targetMinutes: 30, focusSeconds: 600, isTimerRunning: false,
};

describe('task timer displays', () => {
  it('uses task time consistently in Board and Focus and exposes the Focus reset control', () => {
    const board = renderToStaticMarkup(<CurrentSessionBanner {...timerProps} />);
    const focus = renderToStaticMarkup(<FocusView {...timerProps} viewMode="FOCUS"
      onToggleTimer={noop} onResetTimer={noop} onAdjustMinutes={noop}
      onCompleteActiveTask={noop} onSelectViewMode={noop} />);
    expect(board).toContain('23:55');
    expect(focus).toContain('23:55');
    expect(focus).toContain('RESET');
    expect(board).not.toContain('20:00');
  });

  it('falls back to the session countdown without a task target and clamps completed targets', () => {
    expect(renderToStaticMarkup(<CurrentSessionBanner {...timerProps}
      activeTask={{ ...activeTask, estimatedMinutes: undefined }} />)).toContain('20:00');
    expect(renderToStaticMarkup(<CurrentSessionBanner {...timerProps}
      activeTask={{ ...activeTask, elapsedFocusSeconds: 1600 }} />)).toContain('00:00');
  });

  it('shows elapsed task time and distinct date groups in newest-first order', () => {
    const html = renderToStaticMarkup(<TaskList tasks={[activeTask]} activeDate="2026-10-10"
      pastCompletedTasks={[
        { ...activeTask, id: 'old', title: 'Older task', status: 'DONE', completedAt: '2026-10-08T10:00:00Z' },
        { ...activeTask, id: 'recent', title: 'Recent task', status: 'DONE', completedAt: '2026-10-09T10:00:00Z' },
      ]}
      onSelectActive={noop} onUpdateStatus={noop} onDeleteTask={noop} onAddTask={noop}
      onSetTaskPomodoro={noop} onResetTaskTimer={noop} />);
    expect(html).toContain('01:05 / 25m');
    expect(html).toContain('Yesterday · Oct 9, 2026');
    expect(html).toContain('Thu, Oct 8, 2026');
    expect(html.indexOf('Recent task')).toBeLessThan(html.indexOf('Older task'));
  });
});
