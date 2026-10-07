import React, { useState, useCallback } from 'react';
import { useWorkpulseState } from './hooks/useWorkpulseState';
import { useWebSocketBridge } from './hooks/useWebSocketBridge';
import { useWindowMagnet } from './hooks/useWindowMagnet';
import { useOperator } from './hooks/useOperator';
import { CollapsedPill } from './components/CollapsedPill';
import { ExpandedPanel } from './components/ExpandedPanel';
import { FocusView } from './components/FocusView';
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
    completeActiveTask,
    viewMode,
    setViewMode,
    toggleExpanded,
    toggleAlwaysOnTop,
    toggleMute,
    toggleTimer,
    resetTimer,
    handleIncomingIdeMessage,
    spotify,
    sidePanel,
    toggleSidePanel,
    closeSidePanel,
  } = useWorkpulseState();

  const [isSpotifyModalOpen, setIsSpotifyModalOpen] = useState(false);

  const operator = useOperator();

  const handleBridgeMessage = useCallback(
    (msg: Parameters<typeof handleIncomingIdeMessage>[0]) => {
      handleIncomingIdeMessage(msg);
      operator.handleOperatorMessage(msg);
    },
    [handleIncomingIdeMessage, operator]
  );

  const { isConnected, sendMessage } = useWebSocketBridge({
    onMessage: handleBridgeMessage,
  });

  // Sticky-note behavior: edge magnet + fling-to-dock top-right.
  const { dockTopRight, isDocked } = useWindowMagnet(
    `${viewMode}:${sidePanel ?? 'none'}`
  );

  const [showSimMenu, setShowSimMenu] = useState(false);

  const handleSimulateAiStart = () => {
    handleBridgeMessage({
      type: 'ai/run_started',
      payload: {
        runId: 'sim-' + Date.now(),
        agentName: 'Gemini 3.8 Flash',
        goal: 'Implementing fast SQLite indexing and caching',
      },
    });
  };

  const handleSimulateAiWaiting = () => {
    handleBridgeMessage({
      type: 'ai/waiting_input',
      payload: {
        runId: 'sim-' + Date.now(),
        prompt: 'Approve writing file src/db/schema.sql?',
        toolName: 'write_to_file',
      },
    });
  };

  const handleSimulateAiDone = () => {
    handleBridgeMessage({
      type: 'ai/run_finished',
      payload: {
        runId: 'sim-' + Date.now(),
        status: 'COMPLETED',
        summary: 'All tasks and tests verified successfully',
      },
    });
  };

  const handleSimulateVision = () => {
    handleBridgeMessage({
      type: 'ai/vision_update',
      payload: {
        inferenceId: 'inf-sim-' + Date.now(),
        frameId: 'frame-sim',
        provider: 'mock',
        state: 'ERROR',
        confidence: 0.91,
        summary: 'Build error overlay blocking progress',
        createdAt: new Date().toISOString(),
      },
    });
    handleBridgeMessage({
      type: 'agent/action_proposed',
      payload: {
        actionId: 'act-sim-' + Date.now(),
        tool: 'hotkey',
        args: { keys: 'ctrl+`' },
        prompt: 'Open terminal to inspect build error?',
        status: 'PROPOSED',
        createdAt: new Date().toISOString(),
      },
    });
  };

  const handleOpenIde = () => {
    sendMessage({
      type: 'widget/open_task_in_ide',
      payload: {
        taskId: activeTask ? activeTask.id : 'unknown',
        taskTitle: activeTask ? activeTask.title : 'SESSION Active Task',
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
        padding: viewMode === 'BOARD' ? 6 : 2,
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* View Mode Router: BOARD vs FOCUS vs DOCK */}
      {viewMode === 'BOARD' && (
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
            viewMode={viewMode}
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
            onCompleteActiveTask={completeActiveTask}
            onSelectViewMode={setViewMode}
            onOpenIde={handleOpenIde}
            isBridgeConnected={isConnected}
            sidePanel={sidePanel}
            onToggleSidePanel={toggleSidePanel}
            onCloseSidePanel={closeSidePanel}
            spotifyTrack={spotify.track}
            isSpotifyConnected={spotify.authStatus.isConnected}
            isSpotifyConnecting={spotify.isConnecting}
            onOpenSpotifySetup={() => setIsSpotifyModalOpen(true)}
            onSpotifyControl={spotify.controlPlayback}
            onDetectSpotifyLocal={spotify.detectLocal}
            operatorWatching={operator.watching}
            operatorMode={operator.mode}
            operatorFrame={operator.lastFrame}
            operatorInference={operator.inference}
            operatorProposal={operator.proposal}
            operatorThumbUrl={operatorThumbUrl}
            onToggleOperatorWatching={() => operator.toggleWatching()}
            onOperatorModeChange={operator.setMode}
            onOperatorCapture={operator.captureNow}
            onOperatorApprove={operator.approve}
            onOperatorDeny={operator.deny}
          />

          {/* Dev-only telemetry simulator */}
          {import.meta.env.DEV && (
            <div
              style={{
                marginTop: 6,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 10,
                color: 'var(--session-text-secondary)',
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
                  backgroundColor: 'var(--session-surface)',
                  border: '1px solid var(--session-border)',
                }}
              >
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    backgroundColor: isConnected ? '#FFFFFF' : 'rgba(255, 255, 255, 0.3)',
                  }}
                />
                <span className="session-mono" style={{ color: 'var(--session-text-secondary)' }}>
                  {isConnected ? 'Bridge Online' : 'Bridge Offline'}
                </span>
              </div>

              <button
                onClick={() => setShowSimMenu(!showSimMenu)}
                className="session-btn"
                style={{ fontSize: 9, padding: '2px 6px' }}
              >
                {showSimMenu ? 'Hide' : 'Test AI'}
              </button>

              {showSimMenu && (
                <div
                  style={{
                    display: 'inline-flex',
                    gap: 4,
                    backgroundColor: 'var(--session-surface)',
                    padding: '2px 6px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--session-border)',
                  }}
                >
                  <button
                    onClick={handleSimulateAiStart}
                    className="session-btn"
                    style={{ fontSize: 9, padding: '2px 6px' }}
                  >
                    Start
                  </button>
                  <button
                    onClick={handleSimulateAiWaiting}
                    className="session-btn"
                    style={{ fontSize: 9, padding: '2px 6px' }}
                  >
                    Approval
                  </button>
                  <button
                    onClick={handleSimulateAiDone}
                    className="session-btn"
                    style={{ fontSize: 9, padding: '2px 6px' }}
                  >
                    Done
                  </button>
                  <button
                    onClick={handleSimulateVision}
                    className="session-btn"
                    style={{ fontSize: 9, padding: '2px 6px' }}
                  >
                    Vision
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {viewMode === 'FOCUS' && (
        <FocusView
          activeTask={activeTask}
          focusSeconds={focusSeconds}
          targetMinutes={targetMinutes}
          isTimerRunning={isTimerRunning}
          viewMode={viewMode}
          onToggleTimer={toggleTimer}
          onAdjustMinutes={adjustTargetMinutes}
          onCompleteActiveTask={completeActiveTask}
          onSelectViewMode={setViewMode}
          onOpenIde={handleOpenIde}
        />
      )}

      {viewMode === 'DOCK' && (
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
          operatorWatching={operator.watching}
        />
      )}

      {/* Spotify PKCE Connection & Settings Modal */}
      <SpotifySetupModal
        isOpen={isSpotifyModalOpen}
        onClose={() => setIsSpotifyModalOpen(false)}
        isConnected={spotify.authStatus.isConnected}
        activeClientId={spotify.authStatus.clientId}
        track={spotify.track}
        isConnecting={spotify.isConnecting}
        error={spotify.error}
        onConnect={(clientId) => spotify.startAuth(clientId)}
        onDisconnect={spotify.disconnect}
        onDetectLocal={spotify.detectLocal}
      />
    </div>
  );
};
