import React, { useRef, useState } from 'react';
import { Task, TaskStatus, formatTaskNumber, formatPomodoroDuration, groupPastCompletedTasksByDate } from '@workpulse/shared';

interface TaskListProps {
  tasks: Task[];
  activeDate: string;
  pastCompletedTasks?: Task[];
  onSelectActive: (id: string) => void;
  onUpdateStatus: (id: string, status: TaskStatus) => void;
  onDeleteTask: (id: string) => void;
  onAddTask: (title: string, status: TaskStatus, estimatedMinutes?: number) => void;
  onSetTaskPomodoro: (id: string, minutes: number | undefined) => void;
  onResetTaskTimer: (id: string) => void;
  onClearPastTasks?: () => void;
}

export const TaskList: React.FC<TaskListProps> = ({
  tasks,
  activeDate,
  pastCompletedTasks = [],
  onSelectActive,
  onUpdateStatus,
  onDeleteTask,
  onAddTask,
  onSetTaskPomodoro,
  onResetTaskTimer,
  onClearPastTasks,
}) => {
  const [newTitle, setNewTitle] = useState('');
  const [newPomodoroMinutes, setNewPomodoroMinutes] = useState<number | undefined>(25);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const durationTrigger = useRef<HTMLButtonElement | null>(null);
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(() => new Set());
  const durationPresets = [15, 25, 45, undefined] as const;
  const closeDurationEditor = () => {
    setEditingTaskId(null);
    durationTrigger.current?.focus();
  };
  const [isAdding, setIsAdding] = useState(false);
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const [isDoneCollapsed, setIsDoneCollapsed] = useState(false);
  const [isPastCollapsed, setIsPastCollapsed] = useState(false);

  const handleSubmit = () => {
    if (newTitle.trim()) {
      onAddTask(newTitle.trim(), 'NEXT', newPomodoroMinutes);
      setNewTitle('');
      setIsAdding(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'Escape') {
      setIsAdding(false);
      setNewTitle('');
    }
  };

  // Separate active/queued tasks from completed tasks
  const pendingTasks = tasks.filter((t) => t.status !== 'DONE');
  const doneTasks = tasks.filter((t) => t.status === 'DONE');

  const pastDateGroups = groupPastCompletedTasksByDate(pastCompletedTasks, activeDate);

  const getStatusLabel = (task: Task): string => {
    switch (task.status) {
      case 'NOW':
        return 'IN FOCUS';
      case 'NEXT':
        return 'QUEUED';
      case 'LATER':
        return 'LATER';
      case 'DONE':
        return 'DONE';
      default:
        return task.status;
    }
  };

  const renderAirportRow = (task: Task, index: number, isDone = false) => {
    const isNow = task.status === 'NOW';
    const isHovered = hoveredTaskId === task.id;
    const taskNumber = formatTaskNumber(index);

    return (
      <React.Fragment key={task.id}>
        <div
          onMouseEnter={() => setHoveredTaskId(task.id)}
          onMouseLeave={() => setHoveredTaskId(null)}
          onClick={() => !isDone && onSelectActive(task.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '6px 8px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: isNow
              ? 'var(--session-surface-active)'
              : isHovered
              ? 'rgba(255, 255, 255, 0.03)'
              : 'transparent',
            cursor: isDone ? 'default' : 'pointer',
            position: 'relative',
            transition: 'background 0.12s ease',
            gap: 8,
            minHeight: 28,
            boxSizing: 'border-box',
          }}
        >
          {/* Narrow White Active Marker */}
          {isNow && (
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 3,
                bottom: 3,
                width: 3,
                backgroundColor: '#FFFFFF',
                borderRadius: '1px',
              }}
            />
          )}

          {/* Column: NO. */}
          <span
            className="session-mono"
            style={{
              width: 28,
              fontSize: 13,
              color: isNow ? '#FFFFFF' : 'var(--session-text-secondary)',
              fontWeight: isNow ? 700 : 500,
              flexShrink: 0,
            }}
          >
            {taskNumber}
          </span>

          {/* Quick Complete / Incomplete Check Trigger */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUpdateStatus(task.id, isDone ? 'NEXT' : 'DONE');
            }}
            style={{
              width: 15,
              height: 15,
              borderRadius: '2px',
              border: `1px solid ${isDone ? 'var(--session-accent-white)' : 'var(--session-border)'}`,
              backgroundColor: isDone ? '#FFFFFF' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 0,
              flexShrink: 0,
            }}
            title={isDone ? 'Mark incomplete' : 'Mark complete'}
            aria-label={`${isDone ? 'Mark incomplete' : 'Mark complete'}: ${task.title}`}
          >
            {isDone && <span style={{ fontSize: 10, color: '#000000', fontWeight: 900 }}>✓</span>}
          </button>

          {/* Column: TASK Title (Wraps naturally if long) */}
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              if (!isDone) onSelectActive(task.id);
            }}
            disabled={isDone}
            aria-label={`Focus on ${task.title}`}
            style={{
              background: 'transparent',
              border: 0,
              padding: 0,
              textAlign: 'left',
              cursor: isDone ? 'default' : 'pointer',
              flex: 1,
              minWidth: 0,
              fontSize: 14,
              fontFamily: 'var(--font-mono)',
              fontWeight: isNow ? 600 : 400,
              color: isDone
                ? 'var(--text-tertiary)'
                : isNow
                ? '#FFFFFF'
                : 'var(--session-text-primary)',
              textDecoration: isDone ? 'line-through' : 'none',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={task.title}
          >
            {task.title}
          </button>

          {/* Column: TIME — a keyboard-accessible duration disclosure */}
          <button
            type="button"
            className="session-btn session-mono"
            onClick={(event) => {
              event.stopPropagation();
              durationTrigger.current = event.currentTarget;
              setEditingTaskId(editingTaskId === task.id ? null : task.id);
            }}
            aria-expanded={editingTaskId === task.id}
            aria-controls={`task-duration-${task.id}`}
            aria-label={`Edit Pomodoro duration for ${task.title}: ${formatPomodoroDuration(task.elapsedFocusSeconds, task.estimatedMinutes)}`}
            style={{
              width: 116,
              textAlign: 'right',
              padding: '3px 4px',
              fontSize: 11,
              color: isNow ? '#FFFFFF' : 'var(--session-text-secondary)',
              flexShrink: 0,
            }}
          >
            {formatPomodoroDuration(task.elapsedFocusSeconds, task.estimatedMinutes)}
          </button>

          {/* Column: STATUS Badge */}
          <span
            className="session-mono"
            style={{
              width: 80,
              textAlign: 'right',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.04em',
              color: isNow
                ? '#FFFFFF'
                : isDone
                ? 'var(--text-tertiary)'
                : 'var(--session-text-secondary)',
              flexShrink: 0,
            }}
          >
            {getStatusLabel(task)}
          </span>

          {/* Delete Action */}
          <div style={{ width: 14, display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteTask(task.id);
                }}
                style={{
                  color: 'var(--session-text-secondary)',
                  fontSize: 12,
                  lineHeight: 1,
                  padding: '1px 3px',
                  cursor: 'pointer',
                }}
                title="Delete task"
                aria-label={`Delete task: ${task.title}`}
              >
                ✕
              </button>
          </div>
        </div>
        {editingTaskId === task.id && (
          <div
            id={`task-duration-${task.id}`}
            role="group"
            aria-label={`Pomodoro settings for ${task.title}`}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.stopPropagation();
                closeDurationEditor();
              }
            }}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setEditingTaskId(null);
              }
            }}
            style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '6px 8px', flexShrink: 0 }}
          >
            {durationPresets.map((minutes, presetIndex) => (
              <button
                key={minutes ?? 'none'}
                type="button"
                autoFocus={presetIndex === 0}
                className={`session-btn ${task.estimatedMinutes === minutes ? 'active' : ''}`}
                aria-pressed={task.estimatedMinutes === minutes}
                onClick={() => {
                  onSetTaskPomodoro(task.id, minutes);
                  closeDurationEditor();
                }}
                style={{ padding: '4px 8px', fontSize: 11 }}
              >
                {minutes == null ? 'None' : `${minutes}m`}
              </button>
            ))}
            {task.elapsedFocusSeconds > 0 && (
              <button
                type="button"
                className="session-btn"
                onClick={() => {
                  onResetTaskTimer(task.id);
                  closeDurationEditor();
                }}
                style={{ padding: '4px 8px', fontSize: 11 }}
              >
                Reset timer
              </button>
            )}
            <button type="button" className="session-btn" onClick={closeDurationEditor} style={{ padding: '4px 8px', fontSize: 11 }}>
              Close
            </button>
          </div>
        )}
      </React.Fragment>
    );
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        minHeight: 0,
        overflowY: 'auto',
      }}
    >
      {/* Airport Departure Board Table Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '4px 8px',
          borderBottom: '1px solid var(--session-border)',
          gap: 8,
          boxSizing: 'border-box',
          flexShrink: 0,
        }}
      >
        <span
          className="session-mono"
          style={{
            width: 28,
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--session-text-secondary)',
            flexShrink: 0,
          }}
        >
          NO.
        </span>
        <span style={{ width: 15, flexShrink: 0 }} />
        <span
          className="session-mono"
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--session-text-secondary)',
          }}
        >
          TASK
        </span>
        <span
          className="session-mono"
          style={{
            width: 116,
            textAlign: 'right',
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--session-text-secondary)',
            flexShrink: 0,
          }}
        >
          TIME
        </span>
        <span
          className="session-mono"
          style={{
            width: 80,
            textAlign: 'right',
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--session-text-secondary)',
            flexShrink: 0,
          }}
        >
          STATUS
        </span>
        <span style={{ width: 14, flexShrink: 0 }} />
      </div>

      {/* Task Rows Queue — shares scrolling with completed history */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          flexShrink: 0,
          paddingTop: 2,
        }}
      >
        {pendingTasks.length === 0 ? (
          <div
            className="session-mono"
            style={{
              padding: '16px 8px',
              textAlign: 'center',
              color: 'var(--session-text-secondary)',
              fontSize: 12,
            }}
          >
            No active tasks queued. Click + Add task below.
          </div>
        ) : (
          pendingTasks.map((t, idx) => renderAirportRow(t, idx))
        )}
      </div>

      {/* + Add Task Action Row */}
      {isAdding ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            flexShrink: 0,
            gap: 6,
            padding: '4px 8px',
            backgroundColor: 'var(--session-surface)',
            border: '1px solid var(--session-border)',
            borderRadius: 'var(--radius-sm)',
            marginTop: 4,
          }}
        >
          <span className="session-mono" style={{ fontSize: 12, color: 'var(--session-text-secondary)' }}>
            +
          </span>
          <input
            type="text"
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type task title and press Enter…"
            aria-label="New task title"
            style={{
              flex: 1,
              minWidth: 0,
              background: 'transparent',
              border: 'none',
              color: '#FFFFFF',
              fontSize: 12,
              fontFamily: 'var(--font-mono)',
            }}
          />
          <div role="group" aria-label="New task Pomodoro duration" style={{ display: 'flex', flexWrap: 'wrap', gap: 4, width: '100%', order: 1 }}>
            {durationPresets.map((minutes) => (
              <button
                key={minutes ?? 'none'}
                type="button"
                className={`session-btn ${newPomodoroMinutes === minutes ? 'active' : ''}`}
                aria-pressed={newPomodoroMinutes === minutes}
                onClick={() => setNewPomodoroMinutes(minutes)}
                style={{ padding: '3px 8px', fontSize: 11 }}
              >
                {minutes == null ? 'None' : `${minutes}m`}
              </button>
            ))}
          </div>
          <button
            onClick={handleSubmit}
            disabled={!newTitle.trim()}
            className="session-btn"
            style={{ padding: '2px 8px', fontSize: 11 }}
          >
            Add
          </button>
          <button
            onClick={() => setIsAdding(false)}
            className="session-btn"
            style={{ padding: '2px 6px', fontSize: 11, color: 'var(--session-text-secondary)' }}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          style={{
            alignSelf: 'flex-start',
            background: 'transparent',
            border: 'none',
            color: 'var(--session-text-secondary)',
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            fontWeight: 600,
            padding: '6px 8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            transition: 'color 0.12s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#FFFFFF')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--session-text-secondary)')}
        >
          + Add task
        </button>
      )}

      {/* Collapsible Completed Section */}
      {doneTasks.length > 0 && (
        <div style={{ marginTop: 4, borderTop: '1px solid var(--session-border)', paddingTop: 4 }}>
          <button
            type="button"
            aria-expanded={!isDoneCollapsed}
            aria-controls="completed-today-tasks"
            onClick={() => setIsDoneCollapsed(!isDoneCollapsed)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 8px',
              cursor: 'pointer',
              color: 'var(--session-text-secondary)',
              fontSize: 11.5,
              fontFamily: 'var(--font-mono)',
              userSelect: 'none',
              background: 'transparent',
              border: 0,
            }}
          >
            <span>{isDoneCollapsed ? '▶' : '▼'}</span>
            <span>COMPLETED TODAY ({doneTasks.length})</span>
          </button>

          {!isDoneCollapsed && (
            <div id="completed-today-tasks" style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingLeft: 4 }}>
              {doneTasks.map((t, idx) => renderAirportRow(t, pendingTasks.length + idx, true))}
            </div>
          )}
        </div>
      )}

      {/* Collapsible Past Days Completed */}
      {pastCompletedTasks.length > 0 && (
        <div style={{ marginTop: 2, borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: 4 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '2px 8px',
            }}
          >
            <button
              type="button"
              aria-expanded={!isPastCollapsed}
              aria-controls="previous-days-tasks"
              onClick={() => setIsPastCollapsed(!isPastCollapsed)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
                color: 'var(--text-tertiary)',
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                userSelect: 'none',
                background: 'transparent',
                border: 0,
                padding: '4px 0',
              }}
            >
              <span>{isPastCollapsed ? '▶' : '▼'}</span>
              <span>PREVIOUS DAYS ({pastCompletedTasks.length})</span>
            </button>

            {onClearPastTasks && (
              <button
                onClick={onClearPastTasks}
                className="session-btn"
                style={{ fontSize: 10, padding: '1px 6px' }}
                title="Clear past days' completed tasks"
              >
                Clear
              </button>
            )}
          </div>

          {!isPastCollapsed && (
            <div id="previous-days-tasks" style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 4 }}>
              {pastDateGroups.map((group) => {
                const collapsed = collapsedDates.has(group.date);
                return (
                  <div key={group.date}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      <button
                        type="button"
                        className="session-btn session-mono"
                        aria-expanded={!collapsed}
                        aria-controls={`past-tasks-${group.date}`}
                        onClick={() => setCollapsedDates((previous) => {
                          const next = new Set(previous);
                          if (next.has(group.date)) next.delete(group.date);
                          else next.add(group.date);
                          return next;
                        })}
                        style={{ fontSize: 11, padding: '4px 6px', textAlign: 'left' }}
                      >
                        {collapsed ? '▶' : '▼'} {group.formattedLabel} ({group.tasks.length})
                      </button>
                      <button
                        type="button"
                        className="session-btn"
                        aria-label={`Clear completed tasks for ${group.formattedLabel}`}
                        onClick={() => group.tasks.forEach((task) => onDeleteTask(task.id))}
                        style={{ fontSize: 10, padding: '2px 6px' }}
                      >
                        Clear
                      </button>
                    </div>
                    {!collapsed && (
                      <div id={`past-tasks-${group.date}`}>
                        {group.tasks.map((task, index) => renderAirportRow(task, index, true))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
