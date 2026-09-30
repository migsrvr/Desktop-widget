import React, { useState } from 'react';
import { Task, TaskStatus } from '@workpulse/shared';

interface TaskListProps {
  tasks: Task[];
  onSelectActive: (id: string) => void;
  onUpdateStatus: (id: string, status: TaskStatus) => void;
  onDeleteTask: (id: string) => void;
  onAddTask: (title: string, status: TaskStatus) => void;
}

export const TaskList: React.FC<TaskListProps> = ({
  tasks,
  onSelectActive,
  onUpdateStatus,
  onDeleteTask,
  onAddTask,
}) => {
  const [newTitle, setNewTitle] = useState('');
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const [isDoneCollapsed, setIsDoneCollapsed] = useState(false);

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

  const renderTaskItem = (task: Task) => {
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
      {tasks.length === 0 ? (
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
            No tasks planned yet
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
              {nextTasks.map(renderTaskItem)}
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
              {laterTasks.map(renderTaskItem)}
            </div>
          </div>
        )}

        {/* COMPLETED Tasks */}
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
              <span>Completed ({doneTasks.length})</span>
            </div>
            {!isDoneCollapsed && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {doneTasks.map(renderTaskItem)}
              </div>
            )}
          </div>
        )}
      </div>
      )}
    </div>
  );
};
