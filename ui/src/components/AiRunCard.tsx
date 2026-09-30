import React, { useState, useEffect } from 'react';
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
          color: 'var(--text-tertiary)',
          fontSize: 12,
        }}
      >
        No active AI task in current workspace
      </div>
    );
  }

  const getStatusPill = () => {
    const isWorking = aiRun.status === 'WORKING' || aiRun.status === 'PLANNING' || aiRun.status === 'RUNNING_TOOLS';
    const isWaiting = aiRun.status === 'WAITING_INPUT';

    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '2px 8px',
          borderRadius: 'var(--radius-pill)',
          backgroundColor: isWaiting ? 'rgba(255, 255, 255, 0.20)' : 'rgba(255, 255, 255, 0.10)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          color: '#ffffff',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.4px',
          textTransform: 'uppercase',
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
        {aiRun.status.replace('_', ' ')}
      </span>
    );
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>
          AI · {aiRun.agentName}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {getStatusPill()}
          <span
            style={{
              fontFamily: 'JetBrains Mono, SF Mono, monospace',
              fontSize: 11,
              color: 'var(--text-tertiary)',
            }}
          >
            {elapsed}
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

      {/* Footer Row: Files Modified & Test Results */}
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
          <span>{aiRun.filesModifiedCount} files changed</span>

          {aiRun.testStatus === 'PASSED' && (
            <span style={{ color: '#ffffff', fontWeight: 600 }}>Tests passed</span>
          )}
          {aiRun.testStatus === 'FAILED' && (
            <span style={{ color: 'var(--text-secondary)', textDecoration: 'underline' }}>Tests failed</span>
          )}
        </div>

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
      </div>
    </div>
  );
};
