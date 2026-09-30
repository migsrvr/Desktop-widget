import React, { useState } from 'react';
import {
  Check,
  Plus,
  Trash2,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
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
  const [selectedBucket, setSelectedBucket] = useState<TaskStatus>('NEXT');
  const [isDoneCollapsed, setIsDoneCollapsed] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && newTitle.trim()) {
      onAddTask(newTitle.trim(), selectedBucket);
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

    return (
      <div
        key={task.id}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 8px',
          borderRadius: 'var(--radius-sm)',
          backgroundColor: isNow ? 'rgba(10, 132, 255, 0.10)' : 'transparent',
          border: isNow ? '1px solid rgba(10, 132, 255, 0.28)' : '1px solid transparent',
          transition: 'all 0.15s ease',
          gap: 9,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flex: 1, minWidth: 0 }}>
          {/* Apple Reminders Style Circular Checkbox */}
          <button
            onClick={() => onUpdateStatus(task.id, isDone ? 'NEXT' : 'DONE')}
            className={`apple-checkbox ${isDone ? 'checked' : isNow ? 'active-now' : ''}`}
            title={isDone ? 'Mark uncompleted' : 'Mark completed'}
          >
            {isDone ? (
              <Check size={11} strokeWidth={3} color="#ffffff" />
            ) : isNow ? (
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: 'var(--apple-blue)',
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
              color: isDone ? 'var(--text-tertiary)' : 'var(--text-primary)',
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

        {/* Apple Icon Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {!isNow && !isDone && (
            <button
              onClick={() => onSelectActive(task.id)}
              className="apple-icon-btn"
              style={{ width: 22, height: 22, fontSize: 10 }}
              title="Set as current active task"
            >
              <span style={{ fontSize: 9, fontWeight: 700 }}>NOW</span>
            </button>
          )}
          <button
            onClick={() => onDeleteTask(task.id)}
            className="apple-icon-btn"
            style={{ width: 22, height: 22, color: 'var(--text-tertiary)' }}
            title="Delete task"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Apple-Style Glass Input Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 10px',
          borderRadius: 'var(--radius-pill)',
          backgroundColor: 'rgba(0, 0, 0, 0.28)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <Plus size={13} style={{ color: 'var(--text-tertiary)' }} />
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add task for today... (Enter)"
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-primary)',
            fontSize: 12,
            fontFamily: 'inherit',
          }}
        />
        <select
          value={selectedBucket}
          onChange={(e) => setSelectedBucket(e.target.value as TaskStatus)}
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.10)',
            borderRadius: 'var(--radius-pill)',
            color: 'var(--text-secondary)',
            fontSize: 10,
            padding: '2px 8px',
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          <option value="NOW">Now</option>
          <option value="NEXT">Next</option>
          <option value="LATER">Later</option>
        </select>
      </div>

      {/* Task Buckets */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
        {/* NOW Task */}
        {nowTask && (
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--apple-blue)',
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
                color: 'var(--text-secondary)',
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
                color: 'var(--apple-emerald)',
                textTransform: 'uppercase',
                letterSpacing: 0.6,
                marginBottom: 3,
                paddingLeft: 4,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {isDoneCollapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
              Completed ({doneTasks.length})
            </div>
            {!isDoneCollapsed && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {doneTasks.map(renderTaskItem)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
