import React, { useState } from 'react';
import { useWorkpulseState } from './hooks/useWorkpulseState';
import { useWebSocketBridge } from './hooks/useWebSocketBridge';
import { CollapsedPill } from './components/CollapsedPill';
import { ExpandedPanel } from './components/ExpandedPanel';
import { Sparkles, Radio } from 'lucide-react';

export const App: React.FC = () => {
  const {
    tasks,
    activeTask,
    aiRun,
    timeline,
    completionPercentage,
    isExpanded,
    isAlwaysOnTop,
    isMuted,
    isTimerRunning,
    focusSeconds,
    addTask,
    setActiveTask,
    updateTaskStatus,
    deleteTask,
    toggleExpanded,
    toggleAlwaysOnTop,
    toggleMute,
    toggleTimer,
    resetTimer,
    handleIncomingIdeMessage,
  } = useWorkpulseState();

  const { isConnected, sendMessage } = useWebSocketBridge({
    onMessage: handleIncomingIdeMessage,
  });

  const [showSimMenu, setShowSimMenu] = useState(false);

  const doneCount = tasks.filter((t) => t.status === 'DONE').length;

  const handleSimulateAiStart = () => {
    handleIncomingIdeMessage({
      type: 'ai/run_started',
      payload: {
        runId: 'sim-' + Date.now(),
        agentName: 'Gemini 3.8 Flash',
        goal: 'Implementing fast SQLite indexing and caching',
      },
    });
  };

  const handleSimulateAiWaiting = () => {
    handleIncomingIdeMessage({
      type: 'ai/waiting_input',
      payload: {
        runId: 'sim-' + Date.now(),
        prompt: 'Approve writing file src/db/schema.sql?',
        toolName: 'write_to_file',
      },
    });
  };

  const handleSimulateAiDone = () => {
    handleIncomingIdeMessage({
      type: 'ai/run_finished',
      payload: {
        runId: 'sim-' + Date.now(),
        status: 'COMPLETED',
        summary: 'All tasks and tests verified successfully',
      },
    });
  };

  const handleOpenIde = () => {
    sendMessage({
      type: 'widget/open_task_in_ide',
      payload: {
        taskId: activeTask ? activeTask.id : 'unknown',
        taskTitle: activeTask ? activeTask.title : 'WorkPulse Active Task',
      },
    });
  };

  return (
    <div
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        padding: 8,
      }}
    >
      {isExpanded ? (
        <ExpandedPanel
          tasks={tasks}
          activeTask={activeTask}
          aiRun={aiRun}
          timeline={timeline}
          completionPercentage={completionPercentage}
          isAlwaysOnTop={isAlwaysOnTop}
          isMuted={isMuted}
          isTimerRunning={isTimerRunning}
          focusSeconds={focusSeconds}
          onCollapse={toggleExpanded}
          onToggleAlwaysOnTop={toggleAlwaysOnTop}
          onToggleMute={toggleMute}
          onToggleTimer={toggleTimer}
          onResetTimer={resetTimer}
          onSelectActiveTask={setActiveTask}
          onUpdateTaskStatus={updateTaskStatus}
          onDeleteTask={deleteTask}
          onAddTask={addTask}
          onOpenIde={handleOpenIde}
        />
      ) : (
        <CollapsedPill
          activeTask={activeTask}
          aiRun={aiRun}
          tasksCount={tasks.length}
          doneCount={doneCount}
          focusSeconds={focusSeconds}
          isTimerRunning={isTimerRunning}
          onExpand={toggleExpanded}
          onToggleTimer={(e) => {
            e.stopPropagation();
            toggleTimer();
          }}
        />
      )}

      {/* Embedded Telemetry Connection & Dev Simulator Pill */}
      <div
        style={{
          marginTop: 6,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 10,
          color: 'var(--text-dim)',
          paddingLeft: 4,
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
          title={isConnected ? 'Connected to local IDE bridge' : 'Waiting for local bridge (127.0.0.1:41789)'}
        >
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              backgroundColor: isConnected ? 'var(--accent-emerald)' : 'var(--accent-amber)',
            }}
          />
          {isConnected ? 'IDE Connected' : 'Bridge Idle'}
        </span>

        <button
          onClick={() => setShowSimMenu(!showSimMenu)}
          style={{
            fontSize: 9,
            color: 'var(--text-muted)',
            textDecoration: 'underline',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          {showSimMenu ? 'Hide Simulator' : 'Test AI Events'}
        </button>

        {showSimMenu && (
          <div
            style={{
              display: 'inline-flex',
              gap: 4,
              backgroundColor: 'var(--bg-surface)',
              padding: '2px 6px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <button onClick={handleSimulateAiStart} style={{ fontSize: 9, color: 'var(--accent-cyan)' }}>
              Start AI
            </button>
            <span>·</span>
            <button onClick={handleSimulateAiWaiting} style={{ fontSize: 9, color: 'var(--accent-amber)' }}>
              Wait Approval
            </button>
            <span>·</span>
            <button onClick={handleSimulateAiDone} style={{ fontSize: 9, color: 'var(--accent-emerald)' }}>
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
