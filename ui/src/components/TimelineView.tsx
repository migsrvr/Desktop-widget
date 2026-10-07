import React from 'react';
import { TimelineEvent } from '@workpulse/shared';

interface TimelineViewProps {
  timeline: TimelineEvent[];
}

export const TimelineView: React.FC<TimelineViewProps> = ({ timeline }) => {
  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    } catch {
      return '';
    }
  };

  if (timeline.length === 0) {
    return (
      <div
        className="session-mono"
        style={{
          padding: '16px 8px',
          textAlign: 'center',
          color: 'var(--session-text-secondary)',
          fontSize: 12,
        }}
      >
        No activity logged yet.
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        height: '100%',
        overflowY: 'auto',
        paddingRight: 2,
        boxSizing: 'border-box',
      }}
    >
      {timeline.map((evt) => (
        <div
          key={evt.id}
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 10,
            padding: '5px 8px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--session-border)',
            fontSize: 13.5,
            boxSizing: 'border-box',
          }}
        >
          <span
            className="session-mono"
            style={{
              color: 'var(--session-text-secondary)',
              fontSize: 12,
              minWidth: 62,
              flexShrink: 0,
            }}
          >
            {formatTime(evt.timestamp)}
          </span>

          <span
            className="session-mono"
            style={{
              color: 'var(--session-text-primary)',
              flex: 1,
              lineHeight: 1.35,
              wordBreak: 'break-word',
            }}
          >
            {evt.summary}
          </span>
        </div>
      ))}
    </div>
  );
};
