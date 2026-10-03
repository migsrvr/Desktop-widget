import React, { useState } from 'react';
import { useWorkpulseState } from './hooks/useWorkpulseState';
import { useWebSocketBridge } from './hooks/useWebSocketBridge';
import { useWindowMagnet } from './hooks/useWindowMagnet';
import { CollapsedPill } from './components/CollapsedPill';
import { ExpandedPanel } from './components/ExpandedPanel';
import { SpotifySetupModal } from './components/SpotifySetupModal';

export const App: React.FC = () => {
  const {
    tasks,
    todaysTasks,
    pastCompletedTasks,
    activeTask,
    aiRun,
    timeline,
    completionPercentage,
    todaysDoneCount,
    todaysRemainingCount,
    isExpanded,
    isAlwaysOnTop,
    minimizeToTaskbar,
    isMuted,
    isTimerRunning,
    focusSeconds,
    targetMinutes,
    adjustTargetMinutes,
    addTask,
    setActiveTask,
    updateTaskStatus,
    deleteTask,
    clearPastCompletedTasks,
    toggleExpanded,
    toggleAlwaysOnTop,
    toggleMute,
    toggleTimer,
    resetTimer,
    handleIncomingIdeMessage,
    spotify,
  } = useWorkpulseState();

  const [isSpotifyModalOpen, setIsSpotifyModalOpen] = useState(false);

  const { isConnected, sendMessage } = useWebSocketBridge({
    onMessage: handleIncomingIdeMessage,
  });

  // Sticky-note behavior: edge magnet + fling-to-dock top-right.
  const { dockTopRight, isDocked } = useWindowMagnet(isExpanded);

  const [showSimMenu, setShowSimMenu] = useState(false);

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
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        padding: isExpanded ? 6 : 2,
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {isExpanded ? (
        <>
          <ExpandedPanel
            tasks={todaysTasks}
            pastCompletedTasks={pastCompletedTasks}
            activeTask={activeTask}
            aiRun={aiRun}
            timeline={timeline}
            completionPercentage={completionPercentage}
            doneCount={todaysDoneCount}
            remainingCount={todaysRemainingCount}
            isAlwaysOnTop={isAlwaysOnTop}
            isMuted={isMuted}
            isTimerRunning={isTimerRunning}
            focusSeconds={focusSeconds}
            targetMinutes={targetMinutes}
            onCollapse={toggleExpanded}
            onDockTopRight={dockTopRight}
            isDocked={isDocked}
            onMinimizeToTaskbar={minimizeToTaskbar}
            onToggleAlwaysOnTop={toggleAlwaysOnTop}
            onToggleMute={toggleMute}
            onToggleTimer={toggleTimer}
            onResetTimer={resetTimer}
            onAdjustMinutes={adjustTargetMinutes}
            onSelectActiveTask={setActiveTask}
            onUpdateTaskStatus={updateTaskStatus}
            onDeleteTask={deleteTask}
            onAddTask={addTask}
            onClearPastTasks={clearPastCompletedTasks}
            onOpenIde={handleOpenIde}
            spotifyTrack={spotify.track}
            isSpotifyConnected={spotify.authStatus.isConnected}
            isSpotifyConnecting={spotify.isConnecting}
            onOpenSpotifySetup={() => setIsSpotifyModalOpen(true)}
            onSpotifyControl={spotify.controlPlayback}
          />

          {/* Monotone Telemetry & Dev Simulator Bar (Only in Expanded Flyout) */}
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
            >
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  backgroundColor: isConnected ? '#ffffff' : 'rgba(255, 255, 255, 0.3)',
                }}
              />
              <span style={{ color: 'var(--text-secondary)' }}>
                {isConnected ? 'Bridge Online' : 'Bridge Offline'}
              </span>
            </div>

            <button
              onClick={() => setShowSimMenu(!showSimMenu)}
              style={{
                fontSize: 10,
                color: 'var(--text-tertiary)',
                padding: '2px 6px',
                borderRadius: 'var(--radius-pill)',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
              }}
            >
              {showSimMenu ? 'Hide' : 'Test AI'}
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
                  className="apple-btn-text"
                  style={{ fontSize: 9, padding: '2px 6px' }}
                >
                  Start
                </button>
                <button
                  onClick={handleSimulateAiWaiting}
                  className="apple-btn-text"
                  style={{ fontSize: 9, padding: '2px 6px' }}
                >
                  Approval
                </button>
                <button
                  onClick={handleSimulateAiDone}
                  className="apple-btn-text"
                  style={{ fontSize: 9, padding: '2px 6px' }}
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        <CollapsedPill
          activeTask={activeTask}
          aiRun={aiRun}
          tasksCount={todaysTasks.length}
          doneCount={todaysDoneCount}
          focusSeconds={focusSeconds}
          isTimerRunning={isTimerRunning}
          onExpand={toggleExpanded}
          onMinimizeToTaskbar={minimizeToTaskbar}
          onDockTopRight={dockTopRight}
          onToggleTimer={(e) => {
            e.stopPropagation();
            toggleTimer();
          }}
          spotifyTrack={spotify.track}
          onSpotifyControl={spotify.controlPlayback}
        />
      )}

      {/* Spotify PKCE Connection & Settings Modal */}
      <SpotifySetupModal
        isOpen={isSpotifyModalOpen}
        onClose={() => setIsSpotifyModalOpen(false)}
        isConnected={spotify.authStatus.isConnected}
        activeClientId={spotify.authStatus.clientId}
        isConnecting={spotify.isConnecting}
        error={spotify.error}
        onConnect={(clientId) => spotify.startAuth(clientId)}
        onDisconnect={spotify.disconnect}
      />
    </div>
  );
};
