import React, { useState } from 'react';
import { Task, TaskStatus, formatTaskNumber } from '@workpulse/shared';

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
  const [isAdding, setIsAdding] = useState(false);
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const [isDoneCollapsed, setIsDoneCollapsed] = useState(true);
  const [isPastCollapsed, setIsPastCollapsed] = useState(true);

  const handleSubmit = () => {
    if (newTitle.trim()) {
      onAddTask(newTitle.trim(), 'NEXT');
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

  const formatTaskDuration = (task: Task): string => {
    if (task.estimatedMinutes && task.estimatedMinutes > 0) {
      return `${task.estimatedMinutes}m`;
    }
    if (task.elapsedFocusSeconds && task.elapsedFocusSeconds >= 60) {
      return `${Math.floor(task.elapsedFocusSeconds / 60)}m`;
    }
    return '--';
  };

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
      <div
        key={task.id}
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
            width: 24,
            fontSize: 11,
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
            width: 14,
            height: 14,
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
        >
          {isDone && <span style={{ fontSize: 9, color: '#000000', fontWeight: 900 }}>✓</span>}
        </button>

        {/* Column: TASK Title (Wraps naturally if long) */}
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 12,
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
        </span>

        {/* Column: TIME */}
        <span
          className="session-mono"
          style={{
            width: 36,
            textAlign: 'right',
            fontSize: 11,
            color: isNow ? '#FFFFFF' : 'var(--session-text-secondary)',
            flexShrink: 0,
          }}
        >
          {formatTaskDuration(task)}
        </span>

        {/* Column: STATUS Badge */}
        <span
          className="session-mono"
          style={{
            width: 68,
            textAlign: 'right',
            fontSize: 10,
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

        {/* Hover Delete Action */}
        <div style={{ width: 14, display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
          {isHovered && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteTask(task.id);
              }}
              style={{
                color: 'var(--session-text-secondary)',
                fontSize: 11,
                lineHeight: 1,
                padding: '1px 3px',
                cursor: 'pointer',
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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        overflow: 'hidden',
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
            width: 24,
            fontSize: 10,
            fontWeight: 700,
            color: 'var(--session-text-secondary)',
            flexShrink: 0,
          }}
        >
          NO.
        </span>
        <span style={{ width: 14, flexShrink: 0 }} />
        <span
          className="session-mono"
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 10,
            fontWeight: 700,
            color: 'var(--session-text-secondary)',
          }}
        >
          TASK
        </span>
        <span
          className="session-mono"
          style={{
            width: 36,
            textAlign: 'right',
            fontSize: 10,
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
            width: 68,
            textAlign: 'right',
            fontSize: 10,
            fontWeight: 700,
            color: 'var(--session-text-secondary)',
            flexShrink: 0,
          }}
        >
          STATUS
        </span>
        <span style={{ width: 14, flexShrink: 0 }} />
      </div>

      {/* Task Rows Queue (Scrolls Internally) */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
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
              fontSize: 11,
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
            gap: 6,
            padding: '4px 8px',
            backgroundColor: 'var(--session-surface)',
            border: '1px solid var(--session-border)',
            borderRadius: 'var(--radius-sm)',
            marginTop: 4,
          }}
        >
          <span className="session-mono" style={{ fontSize: 11, color: 'var(--session-text-secondary)' }}>
            +
          </span>
          <input
            type="text"
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type task title and press Enter…"
            style={{
              flex: 1,
              minWidth: 0,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#FFFFFF',
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
            }}
          />
          <button
            onClick={handleSubmit}
            disabled={!newTitle.trim()}
            className="session-btn"
            style={{ padding: '2px 8px', fontSize: 10 }}
          >
            Add
          </button>
          <button
            onClick={() => setIsAdding(false)}
            className="session-btn"
            style={{ padding: '2px 6px', fontSize: 10, color: 'var(--session-text-secondary)' }}
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
            fontSize: 11,
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
          <div
            onClick={() => setIsDoneCollapsed(!isDoneCollapsed)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 8px',
              cursor: 'pointer',
              color: 'var(--session-text-secondary)',
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
              userSelect: 'none',
            }}
          >
            <span>{isDoneCollapsed ? '▶' : '▼'}</span>
            <span>COMPLETED TODAY ({doneTasks.length})</span>
          </div>

          {!isDoneCollapsed && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingLeft: 4 }}>
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
            <div
              onClick={() => setIsPastCollapsed(!isPastCollapsed)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
                color: 'var(--text-tertiary)',
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                userSelect: 'none',
              }}
            >
              <span>{isPastCollapsed ? '▶' : '▼'}</span>
              <span>PREVIOUS DAYS ({pastCompletedTasks.length})</span>
            </div>

            {onClearPastTasks && (
              <button
                onClick={onClearPastTasks}
                className="session-btn"
                style={{ fontSize: 9, padding: '1px 6px' }}
                title="Clear past days' completed tasks"
              >
                Clear
              </button>
            )}
          </div>

          {!isPastCollapsed && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingLeft: 4 }}>
              {pastCompletedTasks.map((t, idx) => renderAirportRow(t, idx, true))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
