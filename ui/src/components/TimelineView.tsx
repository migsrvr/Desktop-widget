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

  const getEventIcon = (type: TimelineEvent['eventType']) => {
    switch (type) {
      case 'AI_START':
        return <Sparkles size={12} style={{ color: 'var(--accent-cyan)' }} />;
      case 'AI_WAITING':
        return <ShieldAlert size={12} style={{ color: 'var(--accent-amber)' }} />;
      case 'TASK_START':
        return <Clock size={12} style={{ color: 'var(--text-muted)' }} />;
      case 'TASK_DONE':
        return <CheckCircle2 size={12} style={{ color: 'var(--accent-emerald)' }} />;
      case 'FILES_CHANGED':
        return <FileCode2 size={12} style={{ color: 'var(--accent-purple)' }} />;
      case 'TESTS_RUN':
        return <Terminal size={12} style={{ color: 'var(--accent-cyan)' }} />;
      case 'GIT_COMMIT':
        return <GitCommit size={12} style={{ color: 'var(--accent-emerald)' }} />;
      default:
        return <Clock size={12} style={{ color: 'var(--text-muted)' }} />;
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
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
            alignItems: 'flex-start',
            gap: 8,
            fontSize: 11,
            lineHeight: 1.4,
          }}
        >
          <span
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              color: 'var(--text-dim)',
              fontSize: 10,
              minWidth: 50,
              paddingTop: 1,
            }}
          >
            {formatTime(evt.timestamp)}
          </span>
          <div style={{ paddingTop: 2 }}>{getEventIcon(evt.eventType)}</div>
          <span style={{ color: 'var(--text-main)', flex: 1 }}>{evt.summary}</span>
        </div>
      ))}
    </div>
  );
};
