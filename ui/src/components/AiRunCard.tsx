import React, { useState, useEffect } from 'react';
import { AiRun, TimelineEvent } from '@workpulse/shared';

interface AiRunCardProps {
  aiRun: AiRun | null;
  timeline?: TimelineEvent[];
  onApprove?: () => void;
  defaultExpanded?: boolean;
}

export const AiRunCard: React.FC<AiRunCardProps> = ({
  aiRun,
  timeline = [],
  onApprove,
  defaultExpanded = false,
}) => {
  const [elapsed, setElapsed] = useState<string>('00:00');
  const [expanded, setExpanded] = useState<boolean>(defaultExpanded);

  const startedAt = aiRun?.startedAt;
  const completedAt = aiRun?.completedAt;

  useEffect(() => {
    if (!startedAt) return;

    const updateElapsed = () => {
      const start = new Date(startedAt).getTime();
      const end = completedAt ? new Date(completedAt).getTime() : Date.now();
      const diffSec = Math.max(0, Math.floor((end - start) / 1000));
      const mins = Math.floor(diffSec / 60);
      const secs = diffSec % 60;
      setElapsed(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
    };

    updateElapsed();
    if (!completedAt) {
      const interval = setInterval(updateElapsed, 1000);
      return () => clearInterval(interval);
    }
  }, [startedAt, completedAt]);

  // Collapse when switching to a brand-new run so stale expanded state
  // doesn't hide the fresh task. Users can re-expand.
  const runId = aiRun?.id;
  useEffect(() => {
    setExpanded(defaultExpanded);
  }, [runId, defaultExpanded]);

  if (!aiRun) {
    return (
      <div
        className="w11-card"
        style={{
          padding: '12px 14px',
          color: 'var(--text-tertiary)',
          fontSize: 12,
        }}
      >
        No active AI task in current workspace
      </div>
    );
  }

  const getStatusLabel = () => {
    switch (aiRun.status) {
      case 'WAITING_INPUT':
        return 'WAITING';
      case 'RUNNING_TOOLS':
      case 'WORKING':
        return 'WORKING';
      case 'PLANNING':
        return 'PLANNING';
      case 'COMPLETED':
        return 'DONE';
      case 'FAILED':
        return 'ERROR';
      case 'CANCELLED':
        return 'STOPPED';
      default:
        return aiRun.status;
    }
  };

  const isWorking =
    aiRun.status === 'WORKING' || aiRun.status === 'PLANNING' || aiRun.status === 'RUNNING_TOOLS';
  const isWaiting = aiRun.status === 'WAITING_INPUT';

  const files = aiRun.modifiedFiles ?? [];
  const displayFileCount = Math.max(aiRun.filesModifiedCount ?? 0, files.length);
  const fullTaskText = aiRun.currentStepDescription || 'Executing workflow...';
  const goalText = aiRun.goal && aiRun.goal !== fullTaskText ? aiRun.goal : null;

  const recentRunEvents = timeline
    .filter((e) => !e.aiRunId || !aiRun.id || e.aiRunId === aiRun.id || e.aiRunId.startsWith('live-') || e.aiRunId.startsWith('sim-') || e.aiRunId.startsWith('vscode-') || e.aiRunId.startsWith('run-'))
    .slice(0, 5);

  const renderTestStatus = (showSummary: boolean) => {
    if (aiRun.testStatus === 'PASSED') {
      return (
        <span>
          <span style={{ color: '#ffffff', fontWeight: 600 }}>Tests passed</span>
          {showSummary && aiRun.testSummary && (
            <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}> · {aiRun.testSummary}</span>
          )}
        </span>
      );
    }
    if (aiRun.testStatus === 'FAILED') {
      return (
        <span>
          <span style={{ color: '#ff6b6b', fontWeight: 600 }}>Tests failed</span>
          {showSummary && aiRun.testSummary && (
            <span style={{ color: 'var(--text-tertiary)' }}> · {aiRun.testSummary}</span>
          )}
        </span>
      );
    }
    if (aiRun.testStatus === 'RUNNING') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span
            className="animate-mono-pulse"
            style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: '#fff', display: 'inline-block' }}
          />
          Tests running…
        </span>
      );
    }
    return <span style={{ color: 'var(--text-tertiary)' }}>Tests not run yet</span>;
  };

  return (
    <div
      className="w11-card"
      style={{
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {/* Header Row: Agent Name, Status Pill & Elapsed Time */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--text-secondary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={aiRun.agentName}
        >
          {aiRun.agentName}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '2px 8px',
              borderRadius: 'var(--radius-pill)',
              backgroundColor: isWaiting ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.10)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              color: '#ffffff',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {isWorking && (
              <span
                className="animate-mono-pulse"
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  backgroundColor: '#ffffff',
                  display: 'inline-block',
                }}
              />
            )}
            {getStatusLabel()}
          </span>

          <span
            style={{
              fontFamily: 'JetBrains Mono, SF Mono, monospace',
              fontSize: 11,
              color: 'var(--text-tertiary)',
              whiteSpace: 'nowrap',
            }}
          >
            {elapsed}
          </span>
        </div>
      </div>

      {/* Live task text — always shown in full, never clipped */}
      <div
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--text-primary)',
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          userSelect: 'text',
        }}
      >
        {fullTaskText}
      </div>

      {/* Expanded details */}
      {expanded && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            padding: '8px 10px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'rgba(0, 0, 0, 0.22)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            maxHeight: 240,
            overflowY: 'auto',
          }}
        >
          {goalText && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.6px', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                Goal
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-primary)', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', userSelect: 'text' }}>
                {goalText}
              </div>
            </div>
          )}

          <div>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.6px', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
              Changed files ({displayFileCount})
            </div>
            {files.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
                {files.map((f) => (
                  <span
                    key={f}
                    style={{
                      fontFamily: 'JetBrains Mono, SF Mono, monospace',
                      fontSize: 10,
                      color: 'var(--text-secondary)',
                      wordBreak: 'break-all',
                      userSelect: 'text',
                    }}
                  >
                    {f}
                  </span>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
                {displayFileCount > 0
                  ? `${displayFileCount} file${displayFileCount === 1 ? '' : 's'} changed (paths not reported)`
                  : 'No file telemetry yet — waiting for ai/files_changed.'}
              </div>
            )}
          </div>

          <div>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.6px', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
              Tests
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
              {renderTestStatus(true)}
            </div>
          </div>

          {(aiRun.summary || aiRun.currentStep != null || recentRunEvents.length > 0) && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.6px', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                Run info
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', lineHeight: 1.5, marginTop: 2 }}>
                {aiRun.currentStep != null && (
                  <div>
                    Step {aiRun.currentStep}
                    {aiRun.totalSteps ? ` of ${aiRun.totalSteps}` : ''}
                  </div>
                )}
                {aiRun.summary && <div style={{ color: 'var(--text-secondary)' }}>{aiRun.summary}</div>}
                {recentRunEvents.length > 0 && (
                  <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {recentRunEvents.map((e) => (
                      <span key={e.id} style={{ wordBreak: 'break-word' }}>
                        {e.summary}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Monotone Progress Bar */}
      {aiRun.totalSteps && aiRun.totalSteps > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 10,
              fontWeight: 600,
              color: 'var(--text-tertiary)',
            }}
          >
            <span>Step {aiRun.currentStep || 1} of {aiRun.totalSteps}</span>
            <span>{Math.round(((aiRun.currentStep || 1) / aiRun.totalSteps) * 100)}%</span>
          </div>
          <div
            style={{
              height: 4,
              borderRadius: 'var(--radius-pill)',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${Math.min(100, Math.round(((aiRun.currentStep || 1) / aiRun.totalSteps) * 100))}%`,
                background: '#ffffff',
                borderRadius: 'var(--radius-pill)',
                transition: 'width 0.35s ease',
              }}
            />
          </div>
        </div>
      )}

      {/* Footer Row: Files Modified & Test Results + Expand toggle */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 4,
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          fontSize: 11,
          color: 'var(--text-secondary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>{displayFileCount} file{displayFileCount === 1 ? '' : 's'} changed</span>
          {renderTestStatus(false)}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {aiRun.status === 'WAITING_INPUT' && onApprove && (
            <button
              onClick={onApprove}
              className="apple-btn-primary"
              style={{
                background: '#ffffff',
                color: '#000000',
                fontWeight: 700,
                fontSize: 10,
                padding: '2px 10px',
              }}
            >
              Approve
            </button>
          )}
          <button
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="apple-btn-text"
            style={{ fontSize: 10, padding: '2px 8px' }}
            title={expanded ? 'Collapse details' : 'Show changed files, tests and run info'}
          >
            {expanded ? '▴ Hide' : '▾ Details'}
          </button>
        </div>
      </div>
    </div>
  );
};
