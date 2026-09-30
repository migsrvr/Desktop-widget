import React, { useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  Radio,
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
          backgroundColor: isNow ? 'rgba(56, 189, 248, 0.08)' : 'transparent',
          border: isNow ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid transparent',
          transition: 'all 0.15s ease',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          {/* Status Checkbox */}
          <button
            onClick={() => onUpdateStatus(task.id, isDone ? 'NEXT' : 'DONE')}
            style={{ color: isDone ? 'var(--accent-emerald)' : 'var(--text-dim)', padding: 0 }}
            title={isDone ? 'Mark uncompleted' : 'Mark completed'}
          >
            {isDone ? (
              <CheckCircle2 size={15} />
            ) : isNow ? (
              <Radio size={15} style={{ color: 'var(--accent-cyan)' }} />
            ) : (
              <Circle size={15} />
            )}
          </button>

          {/* Task Title */}
          <span
            onClick={() => !isDone && onSelectActive(task.id)}
            style={{
              fontSize: 12,
              fontWeight: isNow ? 600 : 400,
              color: isDone ? 'var(--text-dim)' : 'var(--text-main)',
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

        {/* Task Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {!isNow && !isDone && (
            <button
              onClick={() => onSelectActive(task.id)}
              className="btn-icon"
              style={{ width: 20, height: 20, fontSize: 10 }}
              title="Set as current active task"
            >
              <Radio size={11} />
            </button>
          )}
          <button
            onClick={() => onDeleteTask(task.id)}
            className="btn-icon"
            style={{ width: 20, height: 20, color: 'var(--text-dim)' }}
            title="Delete task"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Inline Add Task Input */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 8px',
          borderRadius: 'var(--radius-sm)',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <Plus size={13} style={{ color: 'var(--text-dim)' }} />
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
            color: 'var(--text-main)',
            fontSize: 12,
          }}
        />
        <select
          value={selectedBucket}
          onChange={(e) => setSelectedBucket(e.target.value as TaskStatus)}
          style={{
            background: 'var(--bg-surface-hover)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-muted)',
            fontSize: 10,
            padding: '2px 4px',
            outline: 'none',
          }}
        >
          <option value="NOW">Now</option>
          <option value="NEXT">Next</option>
          <option value="LATER">Later</option>
        </select>
      </div>

      {/* Task Buckets */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto' }}>
        {/* NOW Task */}
        {nowTask && (
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--accent-cyan)',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 3,
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
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 3,
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
                color: 'var(--text-dim)',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 3,
              }}
            >
              Later Today ({laterTasks.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {laterTasks.map(renderTaskItem)}
            </div>
          </div>
        )}

        {/* DONE Tasks */}
        {doneTasks.length > 0 && (
          <div>
            <div
              onClick={() => setIsDoneCollapsed(!isDoneCollapsed)}
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--accent-emerald)',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 3,
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
