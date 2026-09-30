import React from 'react';
import { TimelineEvent } from '@workpulse/shared';
import {
  Clock,
  Sparkles,
  CheckCircle2,
  FileCode2,
  GitCommit,
  ShieldAlert,
  Terminal,
} from 'lucide-react';

interface TimelineViewProps {
  timeline: TimelineEvent[];
}

export const TimelineView: React.FC<TimelineViewProps> = ({ timeline }) => {
  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const getEventBadge = (type: TimelineEvent['eventType']) => {
    let icon = <Clock size={11} />;
    let bg = 'rgba(255, 255, 255, 0.08)';
    let color = 'var(--text-secondary)';

    switch (type) {
      case 'AI_START':
        icon = <Sparkles size={11} />;
        bg = 'rgba(100, 210, 255, 0.16)';
        color = 'var(--apple-cyan)';
        break;
      case 'AI_WAITING':
        icon = <ShieldAlert size={11} />;
        bg = 'rgba(255, 159, 10, 0.20)';
        color = 'var(--apple-amber)';
        break;
      case 'TASK_START':
        icon = <Clock size={11} />;
        bg = 'rgba(10, 132, 255, 0.16)';
        color = 'var(--apple-blue)';
        break;
      case 'TASK_DONE':
        icon = <CheckCircle2 size={11} />;
        bg = 'rgba(48, 209, 88, 0.18)';
        color = 'var(--apple-emerald)';
        break;
      case 'FILES_CHANGED':
        icon = <FileCode2 size={11} />;
        bg = 'rgba(191, 90, 242, 0.18)';
        color = 'var(--apple-purple)';
        break;
      case 'TESTS_RUN':
        icon = <Terminal size={11} />;
        bg = 'rgba(100, 210, 255, 0.16)';
        color = 'var(--apple-cyan)';
        break;
      case 'GIT_COMMIT':
        icon = <GitCommit size={11} />;
        bg = 'rgba(48, 209, 88, 0.18)';
        color = 'var(--apple-emerald)';
        break;
    }

    return (
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          backgroundColor: bg,
          color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
    );
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        maxHeight: 180,
        overflowY: 'auto',
        paddingRight: 4,
      }}
    >
      {timeline.map((evt) => (
        <div
          key={evt.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '5px 8px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'rgba(0, 0, 0, 0.18)',
            border: '1px solid rgba(255, 255, 255, 0.04)',
            fontSize: 11,
          }}
        >
          {getEventBadge(evt.eventType)}
          <span style={{ color: 'var(--text-primary)', flex: 1, lineHeight: 1.3 }}>
            {evt.summary}
          </span>
          <span
            style={{
              fontFamily: 'JetBrains Mono, SF Mono, monospace',
              color: 'var(--text-tertiary)',
              fontSize: 10,
              flexShrink: 0,
            }}
          >
            {formatTime(evt.timestamp)}
          </span>
        </div>
      ))}
    </div>
  );
};
