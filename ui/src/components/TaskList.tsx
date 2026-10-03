import React, { useState } from 'react';
import { Task, TaskStatus } from '@workpulse/shared';

interface TaskListProps {
  tasks: Task[];
  pastCompletedTasks?: Task[];
  onSelectActive: (id: string) => void;
  onUpdateStatus: (id: string, status: TaskStatus) => void;
  onDeleteTask: (id: string) => void;
  onAddTask: (title: string, status: TaskStatus) => void;
  onClearPastTasks?: () => void;
}

export const TaskList: React.FC<TaskListProps> = ({
  tasks,
  pastCompletedTasks = [],
  onSelectActive,
  onUpdateStatus,
  onDeleteTask,
  onAddTask,
  onClearPastTasks,
}) => {
  const [newTitle, setNewTitle] = useState('');
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const [isDoneCollapsed, setIsDoneCollapsed] = useState(false);
  const [isPastCollapsed, setIsPastCollapsed] = useState(true);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && newTitle.trim()) {
      onAddTask(newTitle.trim(), 'NEXT');
      setNewTitle('');
    }
  };

  const nowTask = tasks.find((t) => t.status === 'NOW');
  const nextTasks = tasks.filter((t) => t.status === 'NEXT');
  const laterTasks = tasks.filter((t) => t.status === 'LATER');
  const doneTasks = tasks.filter((t) => t.status === 'DONE');

  const formatTaskDate = (task: Task) => {
    try {
      const raw = task.completedAt || task.dayPlanDate;
      if (!raw) return '';
      const d = new Date(raw);
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const renderTaskItem = (task: Task, isPast = false) => {
    const isNow = task.status === 'NOW';
    const isDone = task.status === 'DONE';
    const isHovered = hoveredTaskId === task.id;

    return (
      <div
        key={task.id}
        onMouseEnter={() => setHoveredTaskId(task.id)}
        onMouseLeave={() => setHoveredTaskId(null)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 8px',
          borderRadius: 'var(--radius-sm)',
          backgroundColor: isNow ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
          border: isNow ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid transparent',
          transition: 'all 0.15s ease',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          {/* Monotone Circular Checkbox */}
          <button
            onClick={() => onUpdateStatus(task.id, isDone ? 'NEXT' : 'DONE')}
            className={`apple-checkbox ${isDone ? 'checked' : isNow ? 'active-now' : ''}`}
            title={isDone ? 'Mark incomplete' : 'Mark complete'}
          >
            {isDone ? (
              <span style={{ fontSize: 11, fontWeight: 800, lineHeight: 1 }}>✓</span>
            ) : isNow ? (
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: '#ffffff',
                }}
              />
            ) : null}
          </button>

          {/* Task Title */}
          <span
            onClick={() => !isDone && onSelectActive(task.id)}
            style={{
              fontSize: 12,
              fontWeight: isNow ? 600 : 400,
              color: isDone ? 'var(--text-tertiary)' : isNow ? '#ffffff' : 'var(--text-secondary)',
              textDecoration: isDone ? 'line-through' : 'none',
              cursor: isDone ? 'default' : 'pointer',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              flex: 1,
            }}
            title={task.title}
          >
            {task.title}
          </span>

          {/* Past Day Date Indicator Badge */}
          {isPast && (
            <span
              style={{
                fontSize: 9,
                fontFamily: 'JetBrains Mono, monospace',
                color: 'var(--text-tertiary)',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                padding: '1px 5px',
                borderRadius: 'var(--radius-pill)',
                flexShrink: 0,
              }}
            >
              {formatTaskDate(task)}
            </span>
          )}
        </div>

        {/* Minimal Hover Action (no bulky icons) */}
        <div style={{ display: 'flex', alignItems: 'center', minWidth: 20, justifyContent: 'flex-end' }}>
          {isHovered && (
            <button
              onClick={() => onDeleteTask(task.id)}
              style={{
                color: 'var(--text-tertiary)',
                fontSize: 13,
                lineHeight: 1,
                padding: '2px 4px',
                borderRadius: 'var(--radius-xs)',
              }}
              title="Delete task"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    );
  };

  const hasNoTasksAtAll = tasks.length === 0 && pastCompletedTasks.length === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Clean Monotone Input (No ugly select dropdown) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '6px 12px',
          borderRadius: 'var(--radius-pill)',
          backgroundColor: 'rgba(0, 0, 0, 0.25)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add task for today... (Press Enter)"
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#ffffff',
            fontSize: 12,
            fontFamily: 'inherit',
          }}
        />
      </div>

      {/* Task Buckets */}
      {hasNoTasksAtAll ? (
        <div
          style={{
            padding: '24px 16px',
            textAlign: 'center',
            color: 'var(--text-tertiary)',
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          <div style={{ color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4 }}>
            No tasks planned for today
          </div>
          <div>Type above and press Enter to plan your day.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 190, overflowY: 'auto' }}>
          {/* CURRENT Task */}
          {nowTask && (
            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'var(--text-tertiary)',
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                  marginBottom: 3,
                  paddingLeft: 4,
                }}
              >
                Current Active Task
              </div>
              {renderTaskItem(nowTask)}
            </div>
          )}

          {/* NEXT Tasks */}
          {nextTasks.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'var(--text-tertiary)',
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                  marginBottom: 3,
                  paddingLeft: 4,
                }}
              >
                Next Up ({nextTasks.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {nextTasks.map((t) => renderTaskItem(t))}
              </div>
            </div>
          )}

          {/* LATER Tasks */}
          {laterTasks.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'var(--text-tertiary)',
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                  marginBottom: 3,
                  paddingLeft: 4,
                }}
              >
                Later ({laterTasks.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {laterTasks.map((t) => renderTaskItem(t))}
              </div>
            </div>
          )}

          {/* COMPLETED TODAY Tasks */}
          {doneTasks.length > 0 && (
            <div>
              <div
                onClick={() => setIsDoneCollapsed(!isDoneCollapsed)}
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'var(--text-tertiary)',
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                  marginBottom: 3,
                  paddingLeft: 4,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <span>{isDoneCollapsed ? '▶' : '▼'}</span>
                <span>Completed Today ({doneTasks.length})</span>
              </div>
              {!isDoneCollapsed && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {doneTasks.map((t) => renderTaskItem(t))}
                </div>
              )}
            </div>
          )}

          {/* PREVIOUS DAYS COMPLETED (Cleanly separated & Collapsed by default) */}
          {pastCompletedTasks.length > 0 && (
            <div
              style={{
                marginTop: 4,
                paddingTop: 6,
                borderTop: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingLeft: 4,
                  paddingRight: 4,
                  marginBottom: 3,
                }}
              >
                <div
                  onClick={() => setIsPastCollapsed(!isPastCollapsed)}
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'var(--text-tertiary)',
                    textTransform: 'uppercase',
                    letterSpacing: 0.6,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                  title="Toggle completed tasks from previous days"
                >
                  <span>{isPastCollapsed ? '▶' : '▼'}</span>
                  <span>Previous Days ({pastCompletedTasks.length})</span>
                </div>

                {onClearPastTasks && (
                  <button
                    onClick={onClearPastTasks}
                    className="apple-btn-text"
                    style={{
                      fontSize: 9,
                      padding: '1px 6px',
                      color: 'var(--text-tertiary)',
                    }}
                    title="Clear completed tasks from previous days"
                  >
                    Clear
                  </button>
                )}
              </div>

              {!isPastCollapsed && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {pastCompletedTasks.map((t) => renderTaskItem(t, true))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
