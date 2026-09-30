import React, { useState } from 'react';
import { useWorkpulseState } from './hooks/useWorkpulseState';
import { useWebSocketBridge } from './hooks/useWebSocketBridge';
import { CollapsedPill } from './components/CollapsedPill';
import { ExpandedPanel } from './components/ExpandedPanel';
import { Play, ShieldAlert, CheckCircle2 } from 'lucide-react';

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
    targetMinutes,
    adjustTargetMinutes,
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
        padding: 6,
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
          targetMinutes={targetMinutes}
          onCollapse={toggleExpanded}
          onToggleAlwaysOnTop={toggleAlwaysOnTop}
          onToggleMute={toggleMute}
          onToggleTimer={toggleTimer}
          onResetTimer={resetTimer}
          onAdjustMinutes={adjustTargetMinutes}
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

      {/* Embedded Telemetry Connection & Dev Simulator Pill (Apple-Style Glass Capsule) */}
      <div
        style={{
          marginTop: 6,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 10,
          color: 'var(--text-tertiary)',
          paddingLeft: 4,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '2px 8px',
            borderRadius: 'var(--radius-pill)',
            backgroundColor: 'rgba(0, 0, 0, 0.25)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
          }}
          title={isConnected ? 'Connected to local IDE bridge' : 'Waiting for local bridge (127.0.0.1:41789)'}
        >
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              backgroundColor: isConnected ? 'var(--apple-emerald)' : 'var(--apple-amber)',
              boxShadow: isConnected ? '0 0 6px var(--apple-emerald)' : 'none',
            }}
          />
          <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
            {isConnected ? 'IDE Connected' : 'Bridge Idle'}
          </span>
        </div>

        <button
          onClick={() => setShowSimMenu(!showSimMenu)}
          style={{
            fontSize: 10,
            color: 'var(--text-tertiary)',
            textDecoration: 'none',
            cursor: 'pointer',
            padding: '2px 6px',
            borderRadius: 'var(--radius-pill)',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
          }}
        >
          {showSimMenu ? 'Hide Tests' : 'Simulate AI'}
        </button>

        {showSimMenu && (
          <div
            style={{
              display: 'inline-flex',
              gap: 4,
              backgroundColor: 'rgba(0, 0, 0, 0.35)',
              padding: '2px 6px',
              borderRadius: 'var(--radius-pill)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <button
              onClick={handleSimulateAiStart}
              className="apple-btn-primary"
              style={{ fontSize: 9, padding: '2px 6px', gap: 3 }}
            >
              <Play size={8} fill="currentColor" /> Start
            </button>
            <button
              onClick={handleSimulateAiWaiting}
              className="apple-btn-primary"
              style={{
                fontSize: 9,
                padding: '2px 6px',
                gap: 3,
                color: 'var(--apple-amber)',
              }}
            >
              <ShieldAlert size={8} /> Alert
            </button>
            <button
              onClick={handleSimulateAiDone}
              className="apple-btn-primary"
              style={{
                fontSize: 9,
                padding: '2px 6px',
                gap: 3,
                color: 'var(--apple-emerald)',
              }}
            >
              <CheckCircle2 size={8} /> Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
