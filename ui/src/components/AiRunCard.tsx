import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Clock,
  FileCode2,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';
import { AiRun } from '@workpulse/shared';

interface AiRunCardProps {
  aiRun: AiRun | null;
  onApprove?: () => void;
}

export const AiRunCard: React.FC<AiRunCardProps> = ({ aiRun, onApprove }) => {
  const [elapsed, setElapsed] = useState<string>('00:00');

  useEffect(() => {
    if (!aiRun) return;

    const updateElapsed = () => {
      const start = new Date(aiRun.startedAt).getTime();
      const end = aiRun.completedAt ? new Date(aiRun.completedAt).getTime() : Date.now();
      const diffSec = Math.max(0, Math.floor((end - start) / 1000));
      const mins = Math.floor(diffSec / 60);
      const secs = diffSec % 60;
      setElapsed(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
    };

    updateElapsed();
    if (!aiRun.completedAt) {
      const interval = setInterval(updateElapsed, 1000);
      return () => clearInterval(interval);
    }
  }, [aiRun]);

  if (!aiRun) {
    return (
      <div
        style={{
          padding: '10px 12px',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--bg-surface)',
          border: '1px dashed var(--border-subtle)',
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 12,
        }}
      >
        <Sparkles size={14} style={{ opacity: 0.5 }} />
        <span>No active AI agent task in current IDE workspace</span>
      </div>
    );
  }

  const getStatusBadge = () => {
    switch (aiRun.status) {
      case 'WORKING':
      case 'PLANNING':
      case 'RUNNING_TOOLS':
        return (
          <span className="badge badge-working">
            <span
              className="animate-pulse-glow"
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: 'currentColor',
              }}
            />
            {aiRun.status.replace('_', ' ')}
          </span>
        );
      case 'WAITING_INPUT':
        return (
          <span className="badge badge-waiting">
            <ShieldAlert size={11} />
            Waiting for approval
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="badge badge-done">
            <CheckCircle size={11} />
            Completed
          </span>
        );
      case 'FAILED':
        return (
          <span className="badge badge-error">
            <XCircle size={11} />
            Failed
          </span>
        );
      default:
        return <span className="badge">{aiRun.status}</span>;
    }
  };

  const getTestBadge = () => {
    if (aiRun.testStatus === 'NOT_RUN') return null;
    if (aiRun.testStatus === 'RUNNING') {
      return (
        <span
          style={{
            fontSize: 10,
            padding: '2px 6px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'rgba(56, 189, 248, 0.12)',
            color: 'var(--accent-cyan)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          Tests running...
        </span>
      );
    }
    if (aiRun.testStatus === 'PASSED') {
      return (
        <span
          style={{
            fontSize: 10,
            padding: '2px 6px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            color: 'var(--accent-emerald)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <CheckCircle size={10} /> Tests passed
        </span>
      );
    }
    return (
      <span
        style={{
          fontSize: 10,
          padding: '2px 6px',
          borderRadius: 'var(--radius-sm)',
          backgroundColor: 'rgba(244, 63, 94, 0.15)',
          color: 'var(--accent-rose)',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <AlertTriangle size={10} /> Tests failed
      </span>
    );
  };

  return (
    <div
      style={{
        borderRadius: 'var(--radius-md)',
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {/* Top Header Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Sparkles size={13} style={{ color: 'var(--accent-cyan)' }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>
            AI · {aiRun.agentName}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {getStatusBadge()}
          <span
            style={{
              fontSize: 11,
              fontFamily: 'JetBrains Mono, monospace',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: 3,
            }}
          >
            <Clock size={11} /> {elapsed}
          </span>
        </div>
      </div>

      {/* Current Step Description */}
      <div
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--text-main)',
          lineHeight: 1.4,
        }}
      >
        {aiRun.currentStepDescription || 'Executing workflow...'}
      </div>

      {/* Discretized Step Progress (Honest Progress Bar) */}
      {aiRun.totalSteps && aiRun.totalSteps > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 10,
              color: 'var(--text-muted)',
            }}
          >
            <span>
              Step {aiRun.currentStep || 1} of {aiRun.totalSteps}
            </span>
            <span>{Math.round(((aiRun.currentStep || 1) / aiRun.totalSteps) * 100)}%</span>
          </div>
          <div
            style={{
              height: 4,
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${Math.min(100, Math.round(((aiRun.currentStep || 1) / aiRun.totalSteps) * 100))}%`,
                background: 'linear-gradient(90deg, var(--accent-cyan), var(--accent-purple))',
                borderRadius: 'var(--radius-full)',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>
      )}

      {/* Secondary Meta Row: Files Changed & Tests */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 4,
          borderTop: '1px solid rgba(255, 255, 255, 0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <FileCode2 size={12} />
            {aiRun.filesModifiedCount} files changed
          </span>
          {getTestBadge()}
        </div>

        {aiRun.status === 'WAITING_INPUT' && onApprove && (
          <button
            onClick={onApprove}
            className="btn-pill"
            style={{
              backgroundColor: 'var(--accent-amber)',
              color: '#000',
              fontWeight: 700,
              fontSize: 10,
            }}
          >
            Approve <ArrowRight size={10} />
          </button>
        )}
      </div>
    </div>
  );
};
