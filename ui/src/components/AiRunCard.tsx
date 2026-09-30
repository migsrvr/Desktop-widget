import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Clock,
  FileCode2,
  CheckCircle2,
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
        className="w11-card"
        style={{
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          color: 'var(--text-secondary)',
          fontSize: 12,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'rgba(255, 255, 255, 0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-tertiary)',
          }}
        >
          <Sparkles size={14} />
        </div>
        <span>No active AI task in current workspace</span>
      </div>
    );
  }

  const getStatusPill = () => {
    switch (aiRun.status) {
      case 'WORKING':
      case 'PLANNING':
      case 'RUNNING_TOOLS':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '3px 8px',
              borderRadius: 'var(--radius-pill)',
              backgroundColor: 'rgba(100, 210, 255, 0.14)',
              border: '1px solid rgba(100, 210, 255, 0.28)',
              color: 'var(--apple-cyan)',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.4px',
              textTransform: 'uppercase',
            }}
          >
            <span
              className="animate-pulse-glow"
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: 'var(--apple-cyan)',
                display: 'inline-block',
              }}
            />
            {aiRun.status.replace('_', ' ')}
          </span>
        );
      case 'WAITING_INPUT':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '3px 8px',
              borderRadius: 'var(--radius-pill)',
              backgroundColor: 'rgba(255, 159, 10, 0.18)',
              border: '1px solid rgba(255, 159, 10, 0.35)',
              color: 'var(--apple-amber)',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.4px',
              textTransform: 'uppercase',
            }}
          >
            <span
              className="animate-urgent-blink"
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: 'var(--apple-amber)',
                display: 'inline-block',
              }}
            />
            Waiting for approval
          </span>
        );
      case 'COMPLETED':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 8px',
              borderRadius: 'var(--radius-pill)',
              backgroundColor: 'rgba(48, 209, 88, 0.14)',
              border: '1px solid rgba(48, 209, 88, 0.28)',
              color: 'var(--apple-emerald)',
              fontSize: 10,
              fontWeight: 700,
            }}
          >
            <CheckCircle2 size={11} /> Done
          </span>
        );
      case 'FAILED':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 8px',
              borderRadius: 'var(--radius-pill)',
              backgroundColor: 'rgba(255, 69, 58, 0.16)',
              border: '1px solid rgba(255, 69, 58, 0.32)',
              color: 'var(--apple-rose)',
              fontSize: 10,
              fontWeight: 700,
            }}
          >
            <XCircle size={11} /> Error
          </span>
        );
      default:
        return (
          <span
            style={{
              display: 'inline-flex',
              padding: '2px 6px',
              borderRadius: 'var(--radius-pill)',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              fontSize: 10,
              fontWeight: 600,
            }}
          >
            {aiRun.status}
          </span>
        );
    }
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
      {/* Header Row: Agent Model & Dynamic Status */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              backgroundColor: 'rgba(10, 132, 255, 0.18)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--apple-cyan)',
            }}
          >
            <Sparkles size={12} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>
            AI · {aiRun.agentName}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {getStatusPill()}
          <span
            style={{
              fontFamily: 'JetBrains Mono, SF Mono, monospace',
              fontSize: 11,
              color: 'var(--text-tertiary)',
              display: 'flex',
              alignItems: 'center',
              gap: 3,
            }}
          >
            <Clock size={11} /> {elapsed}
          </span>
        </div>
      </div>

      {/* Description / Live Step */}
      <div
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--text-primary)',
          lineHeight: 1.4,
        }}
      >
        {aiRun.currentStepDescription || 'Executing workflow...'}
      </div>

      {/* Honest Progress Capsule */}
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
                background: 'linear-gradient(90deg, var(--apple-cyan), var(--apple-blue))',
                borderRadius: 'var(--radius-pill)',
                transition: 'width 0.35s ease',
              }}
            />
          </div>
        </div>
      )}

      {/* Footer Row: Files Changed & Apple Approve Action */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 6,
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontSize: 11,
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <FileCode2 size={12} />
            {aiRun.filesModifiedCount} files changed
          </span>

          {aiRun.testStatus === 'PASSED' && (
            <span
              style={{
                fontSize: 10,
                color: 'var(--apple-emerald)',
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                fontWeight: 600,
              }}
            >
              <CheckCircle2 size={11} /> Tests passed
            </span>
          )}
          {aiRun.testStatus === 'FAILED' && (
            <span
              style={{
                fontSize: 10,
                color: 'var(--apple-rose)',
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                fontWeight: 600,
              }}
            >
              <AlertTriangle size={11} /> Tests failed
            </span>
          )}
        </div>

        {aiRun.status === 'WAITING_INPUT' && onApprove && (
          <button
            onClick={onApprove}
            className="apple-btn-primary"
            style={{
              background: 'linear-gradient(180deg, var(--apple-amber) 0%, #D97706 100%)',
              color: '#000',
              fontWeight: 700,
              fontSize: 10,
              padding: '3px 10px',
            }}
          >
            Approve <ArrowRight size={10} />
          </button>
        )}
      </div>
    </div>
  );
};
