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
    activeDate,
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
    setTaskPomodoroMinutes,
    resetTaskTimer,
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

  // Sticky-note behavior: edge magnet + fling-to-dock in DOCK mode.
  // Strip flag is presence-only (boolean) so track polling never refires it.
  const { dockTopRight, isDocked } = useWindowMagnet(
    `${viewMode}:${sidePanel ?? 'none'}:${spotify.track ? 'spot' : 'nospot'}`,
    viewMode === 'DOCK'
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
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: viewMode === 'BOARD' ? 'stretch' : 'flex-start',
        padding: 0,
        boxSizing: 'border-box',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* View Mode Router: BOARD vs FOCUS vs DOCK */}
      {viewMode === 'BOARD' && (
        <>
          <ExpandedPanel
            tasks={todaysTasks}
            activeDate={activeDate}
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
            onSetTaskPomodoro={setTaskPomodoroMinutes}
            onResetTaskTimer={resetTaskTimer}
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
            spotifyAccountType={spotify.authStatus.accountType}
            onOpenSpotifySetup={() => setIsSpotifyModalOpen(true)}
            onSpotifyControl={spotify.controlPlayback}
            onDetectSpotifyLocal={spotify.detectLocal}
            operatorWatching={operator.watching}
            operatorMode={operator.mode}
            operatorFrame={operator.lastFrame}
            operatorInference={operator.inference}
            operatorProposal={operator.proposal}
            operatorThumbUrl={operator.thumbUrl}
            onToggleOperatorWatching={() => operator.toggleWatching()}
            onOperatorModeChange={operator.setMode}
            onOperatorCapture={operator.captureNow}
            onOperatorApprove={operator.approve}
            onOperatorDeny={operator.deny}
          />

          {/* Dev-only telemetry simulator (floats non-intrusively in bottom-right) */}
          {import.meta.env.DEV && (
            <div
              style={{
                position: 'absolute',
                bottom: 8,
                right: 18,
                zIndex: 100,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 10,
                color: 'var(--session-text-secondary)',
                backgroundColor: 'rgba(18, 18, 18, 0.9)',
                backdropFilter: 'blur(12px)',
                padding: '3px 8px',
                borderRadius: 'var(--radius-pill)',
                border: '1px solid var(--session-border)',
              }}
            >
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
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
                <span className="session-mono" style={{ color: 'var(--session-text-secondary)', fontSize: 9 }}>
                  {isConnected ? 'Bridge Online' : 'Bridge Offline'}
                </span>
              </div>

              <button
                onClick={() => setShowSimMenu(!showSimMenu)}
                className="session-btn"
                style={{ fontSize: 9, padding: '1px 5px' }}
              >
                {showSimMenu ? 'Hide' : 'Test AI'}
              </button>

              {showSimMenu && (
                <div
                  style={{
                    display: 'inline-flex',
                    gap: 3,
                  }}
                >
                  <button
                    onClick={handleSimulateAiStart}
                    className="session-btn"
                    style={{ fontSize: 9, padding: '1px 5px' }}
                  >
                    Start
                  </button>
                  <button
                    onClick={handleSimulateAiWaiting}
                    className="session-btn"
                    style={{ fontSize: 9, padding: '1px 5px' }}
                  >
                    Approval
                  </button>
                  <button
                    onClick={handleSimulateAiDone}
                    className="session-btn"
                    style={{ fontSize: 9, padding: '1px 5px' }}
                  >
                    Done
                  </button>
                  <button
                    onClick={handleSimulateVision}
                    className="session-btn"
                    style={{ fontSize: 9, padding: '1px 5px' }}
                  >
                    Vision
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {(viewMode === 'DOCK' || viewMode === 'FOCUS') && (
        <FocusView
          activeTask={activeTask}
          focusSeconds={focusSeconds}
          targetMinutes={targetMinutes}
          isTimerRunning={isTimerRunning}
          viewMode={viewMode}
          onToggleTimer={toggleTimer}
          onResetTimer={resetTimer}
          onAdjustMinutes={adjustTargetMinutes}
          onCompleteActiveTask={completeActiveTask}
          onSelectViewMode={setViewMode}
          onOpenIde={handleOpenIde}
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
        accountType={spotify.authStatus.accountType}
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
