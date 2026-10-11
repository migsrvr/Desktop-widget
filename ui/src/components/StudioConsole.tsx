import React, { useId, useRef, useState } from 'react';
import {
  AiRun,
  TimelineEvent,
  ScreenMode,
  ScreenFrameMeta,
  VisionInference,
  OperatorActionProposal,
} from '@workpulse/shared';

interface StudioConsoleProps {
  aiRun: AiRun | null;
  timeline?: TimelineEvent[];
  operatorWatching?: boolean;
  operatorMode?: ScreenMode;
  operatorFrame?: ScreenFrameMeta | null;
  operatorInference?: VisionInference | null;
  operatorProposal?: OperatorActionProposal | null;
  operatorThumbUrl?: string;
  onToggleOperatorWatching?: () => void;
  onOperatorCapture?: () => void;
  onOperatorApprove?: () => void;
  onOperatorDeny?: () => void;
}

type Channel = 'agent' | 'screen';

const configuredRoles = [
  { name: 'Gemini Planner', role: 'Overall Planner & PM' },
  { name: 'Codex Senior', role: 'Engineering Lead & Subagent Coordinator' },
  { name: 'Muse Junior', role: 'Independent Worker' },
];

export const StudioConsole: React.FC<StudioConsoleProps> = ({
  aiRun,
  operatorWatching = false,
  operatorMode = 'MONITOR',
  operatorFrame,
  operatorInference,
  operatorProposal,
  onToggleOperatorWatching,
  onOperatorCapture,
  onOperatorApprove,
  onOperatorDeny,
}) => {
  const [activeChannelDetail, setActiveChannelDetail] = useState<Channel | null>(null);
  const drawerId = useId();
  const agentButton = useRef<HTMLButtonElement>(null);
  const screenButton = useRef<HTMLButtonElement>(null);
  const statusLabels: Record<AiRun['status'], string> = {
    QUEUED: 'Queued',
    PLANNING: 'Orchestrating',
    WORKING: 'Working',
    RUNNING_TOOLS: 'Running tools',
    WAITING_INPUT: 'Waiting for input',
    COMPLETED: 'Completed',
    FAILED: 'Failed',
    CANCELLED: 'Cancelled',
  };
  const agentStatusText = aiRun ? statusLabels[aiRun.status] : 'Standby';
  const isAgentWorking = aiRun?.status === 'PLANNING' || aiRun?.status === 'WORKING' || aiRun?.status === 'RUNNING_TOOLS';
  const screenStatusText = !operatorWatching ? 'Standby'
    : operatorMode === 'OPERATOR' ? 'Operator'
    : operatorMode === 'ON_DEMAND' ? 'On-demand' : 'Monitoring';
  const screenSubText = operatorWatching && operatorFrame
    ? `${operatorFrame.width}×${operatorFrame.height}`
    : operatorWatching ? 'Waiting for a frame' : 'Standby';
  const toggleDetail = (channel: Channel) => {
    setActiveChannelDetail((previous) => previous === channel ? null : channel);
  };
  const closeDetail = () => {
    const trigger = activeChannelDetail === 'agent' ? agentButton : screenButton;
    setActiveChannelDetail(null);
    trigger.current?.focus();
  };
  const channelStyle: React.CSSProperties = {
    display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
    gap: 4, minWidth: 0, padding: '8px 10px', border: 0,
    textAlign: 'left', cursor: 'pointer', color: 'var(--session-text-primary)',
    fontFamily: 'inherit',
  };
  const metaStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--session-text-secondary)',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', backgroundColor: 'var(--session-surface)', border: '1px solid var(--session-border)', borderRadius: 'var(--radius-md)', boxSizing: 'border-box', overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', width: '100%' }}>
        <button
          ref={agentButton}
          type="button"
          onClick={() => toggleDetail('agent')}
          aria-expanded={activeChannelDetail === 'agent'}
          aria-controls={drawerId}
          style={{ ...channelStyle, borderRight: '1px solid var(--session-border)', backgroundColor: activeChannelDetail === 'agent' ? 'var(--session-surface-active)' : 'transparent' }}
        >
          <span className="session-mono" style={metaStyle}>01 / AGENT FLEET</span>
          <span className="session-mono" style={{ ...metaStyle, fontSize: 9, fontWeight: 500 }}>AGENT MANAGER</span>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Gemini Planner → Codex Senior</span>
          {aiRun && <span style={{ fontSize: 11, overflowWrap: 'anywhere' }}>Current run · {aiRun.agentName}</span>}
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {isAgentWorking && <span aria-hidden="true" className="fleet-breathing-dot" />}
            <span className="session-mono" style={{ fontSize: 11, color: isAgentWorking ? '#FFFFFF' : 'var(--session-text-secondary)' }}>{agentStatusText}</span>
          </span>
          <span className="session-mono" style={{ fontSize: 10, color: 'var(--session-text-secondary)' }}>
            Configured workflow · 3 Sessions (Planner · Lead · Worker)
          </span>
        </button>
        <button
          ref={screenButton}
          type="button"
          onClick={() => toggleDetail('screen')}
          aria-expanded={activeChannelDetail === 'screen'}
          aria-controls={drawerId}
          style={{ ...channelStyle, backgroundColor: activeChannelDetail === 'screen' ? 'var(--session-surface-active)' : 'transparent' }}
        >
          <span className="session-mono" style={metaStyle}>02 / SCREEN OPERATOR</span>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Screen operator</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#FFFFFF', opacity: operatorWatching ? 1 : 0.35 }} />
            <span className="session-mono" style={{ fontSize: 11, color: operatorWatching ? '#FFFFFF' : 'var(--session-text-secondary)' }}>{screenStatusText}</span>
          </span>
          <span className="session-mono" style={{ fontSize: 11, color: 'var(--session-text-secondary)' }}>{screenSubText}</span>
        </button>
      </div>
      {activeChannelDetail && (
        <div
          id={drawerId}
          role="region"
          aria-label={activeChannelDetail === 'agent' ? 'Agent Fleet details' : 'Screen operator controls'}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              closeDetail();
            }
          }}
          style={{ padding: '10px 12px', borderTop: '1px solid var(--session-border)', backgroundColor: 'var(--session-bg)', display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span className="session-mono" style={{ fontSize: 11, fontWeight: 700, color: '#FFFFFF' }}>
              {activeChannelDetail === 'agent' ? 'CHANNEL 01 / AGENT FLEET TELEMETRY' : 'CHANNEL 02 / SCREEN OPERATOR CONTROLS'}
            </span>
            <button type="button" onClick={closeDetail} className="session-btn" style={{ padding: '1px 5px', fontSize: 10 }} aria-label="Close channel details">✕</button>
          </div>
          {activeChannelDetail === 'agent' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="session-mono" style={{ fontSize: 10, color: 'var(--session-text-secondary)' }}>Configured workflow roles</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 6 }}>
                {configuredRoles.map(({ name, role }) => (
                  <div key={name} style={{ padding: '7px 8px', border: '1px solid var(--session-border)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{name}</div>
                    <div style={{ fontSize: 10, lineHeight: 1.4, color: 'var(--session-text-secondary)', marginTop: 3 }}>{role}</div>
                  </div>
                ))}
              </div>
              {aiRun ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11, overflowWrap: 'anywhere' }}>
                  <div>Current run: {aiRun.agentName} · {agentStatusText}</div>
                  <div>Goal: {aiRun.goal || 'No goal reported'}</div>
                  <div>Step: {aiRun.currentStepDescription || 'No step reported'}
                    {aiRun.currentStep != null && ` · ${aiRun.currentStep}${aiRun.totalSteps != null ? ` / ${aiRun.totalSteps}` : ''}`}
                  </div>
                  <div>Files modified: {aiRun.filesModifiedCount}</div>
                  <div className="session-mono">Tests: {aiRun.testStatus}{aiRun.testSummary ? ` · ${aiRun.testSummary}` : ''}</div>
                  {aiRun.modifiedFiles && aiRun.modifiedFiles.length > 0 && (
                    <div style={{ color: 'var(--session-text-secondary)' }}>
                      Changed: {aiRun.modifiedFiles.slice(0, 3).join(', ')}
                      {aiRun.modifiedFiles.length > 3 ? ` +${aiRun.modifiedFiles.length - 3} more` : ''}
                    </div>
                  )}
                  {aiRun.summary && <div>Summary: {aiRun.summary}</div>}
                </div>
              ) : <div style={{ fontSize: 11, color: 'var(--session-text-secondary)' }}>No agent run reported. Workflow roles are configured; live session activity is unavailable.</div>}
            </div>
          )}
          {/* SCREEN DETAIL DRAWER */}
          {activeChannelDetail === 'screen' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {onToggleOperatorWatching && (
                  <button
                    onClick={onToggleOperatorWatching}
                    className="session-btn"
                    style={{ fontSize: 11 }}
                  >
                    {operatorWatching ? 'Pause Watching' : 'Start Watching'}
                  </button>
                )}
                {onOperatorCapture && (
                  <button
                    onClick={onOperatorCapture}
                    className="session-btn"
                    style={{ fontSize: 11 }}
                  >
                    Capture Now
                  </button>
                )}
              </div>

              {operatorProposal && (
                <div
                  style={{
                    padding: '6px 8px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--session-accent-white)',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#FFFFFF' }}>Proposal Approval:</div>
                  <div style={{ fontSize: 12, color: 'var(--session-text-primary)', marginTop: 2 }}>
                    {operatorProposal.prompt}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    {onOperatorApprove && (
                      <button
                        onClick={onOperatorApprove}
                        className="session-btn-primary"
                        style={{ fontSize: 11, padding: '2px 8px' }}
                      >
                        Approve
                      </button>
                    )}
                    {onOperatorDeny && (
                      <button
                        onClick={onOperatorDeny}
                        className="session-btn"
                        style={{ fontSize: 11, padding: '2px 8px' }}
                      >
                        Deny
                      </button>
                    )}
                  </div>
                </div>
              )}

              {operatorInference && (
                <div style={{ fontSize: 11, color: 'var(--session-text-secondary)', fontFamily: 'var(--font-mono)' }}>
                  Vision Inference: {operatorInference.state} ({Math.round(operatorInference.confidence * 100)}%)
                </div>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  );
};
