import React from 'react';
import { ScreenMode } from '@workpulse/shared';
import type { ScreenFrameMeta, VisionInference, OperatorActionProposal } from '@workpulse/shared';

interface OperatorCardProps {
  watching: boolean;
  mode: ScreenMode;
  lastFrame: ScreenFrameMeta | null;
  inference: VisionInference | null;
  proposal: OperatorActionProposal | null;
  thumbUrl: string;
  onToggleWatching: () => void;
  onModeChange: (mode: ScreenMode) => void;
  onCaptureNow: () => void;
  onApprove: () => void;
  onDeny: () => void;
}

export const OperatorCard: React.FC<OperatorCardProps> = ({
  watching,
  mode,
  lastFrame,
  inference,
  proposal,
  thumbUrl,
  onToggleWatching,
  onModeChange,
  onCaptureNow,
  onApprove,
  onDeny,
}) => {
  const confidencePct = inference ? Math.round(inference.confidence * 100) : 0;

  return (
    <div className="w11-card" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
          Screen Operator
        </span>
        <span
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px',
            borderRadius: 'var(--radius-pill)', fontSize: 10, fontWeight: 700,
            backgroundColor: watching ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.16)', color: '#fff',
          }}
        >
          <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: '#fff', opacity: watching ? 1 : 0.4, display: 'inline-block' }} />
          {watching ? 'WATCHING' : 'PAUSED'}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <select
          value={mode}
          onChange={(e) => onModeChange(e.target.value as ScreenMode)}
          className="apple-btn-text"
          style={{ fontSize: 11, padding: '3px 8px' }}
          title="Operator mode"
        >
          <option value="ON_DEMAND">On-demand</option>
          <option value="MONITOR">Monitor</option>
          <option value="OPERATOR">Operator</option>
        </select>
        <button onClick={onToggleWatching} className="apple-btn-text" style={{ fontSize: 11, color: '#fff' }}>
          {watching ? 'Pause' : 'Watch'}
        </button>
        <button onClick={onCaptureNow} className="apple-btn-text" style={{ fontSize: 11 }}>
          Capture
        </button>
      </div>

      {watching && lastFrame && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <img
            src={thumbUrl}
            alt="Latest screen frame"
            style={{ width: 72, height: 48, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', backgroundColor: 'rgba(0,0,0,0.4)' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
            <div style={{ fontFamily: 'JetBrains Mono, monospace' }}>{lastFrame.frameId.slice(0, 18)}</div>
            <div>{lastFrame.width}×{lastFrame.height} · hash {String(lastFrame.hash).slice(0, 8)}</div>
          </div>
        </div>
      )}

      {inference && (
        <div style={{ padding: '8px 10px', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(0,0,0,0.22)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <span style={{ color: '#fff', fontWeight: 700 }}>{inference.state}</span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-tertiary)' }}>{confidencePct}% · {inference.provider}</span>
          </div>
          <div style={{ height: 4, borderRadius: 'var(--radius-pill)', backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 6, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${confidencePct}%`, background: '#fff', borderRadius: 'var(--radius-pill)' }} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.45 }}>{inference.summary}</div>
          {inference.confidence < 0.75 && (
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>Below 75% — logged only, no action proposed.</div>
          )}
        </div>
      )}

      {proposal && (
        <div style={{ padding: '8px 10px', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.18)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>Approval needed</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{proposal.prompt}</div>
          <div style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-tertiary)', marginTop: 2 }}>
            {proposal.tool} {JSON.stringify(proposal.args).slice(0, 80)}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button onClick={onApprove} className="apple-btn-primary" style={{ background: '#fff', color: '#000', fontWeight: 700, fontSize: 11, padding: '3px 12px' }}>
              Approve
            </button>
            <button onClick={onDeny} className="apple-btn-text" style={{ fontSize: 11 }}>
              Deny
            </button>
          </div>
        </div>
      )}

      {!inference && !proposal && (
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
          {watching ? 'Watching active window… vision updates land here.' : 'Start watching to let cloud vision + OpenClaw monitor this task.'}
        </div>
      )}
    </div>
  );
};
