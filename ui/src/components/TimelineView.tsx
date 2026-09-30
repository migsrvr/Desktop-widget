import React from 'react';
import { TimelineEvent } from '@workpulse/shared';

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

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        maxHeight: 190,
        overflowY: 'auto',
        paddingRight: 2,
      }}
    >
      {timeline.map((evt) => (
        <div
          key={evt.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '5px 8px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'rgba(0, 0, 0, 0.18)',
            border: '1px solid rgba(255, 255, 255, 0.04)',
            fontSize: 11,
          }}
        >
          <span
            style={{
              fontFamily: 'JetBrains Mono, SF Mono, monospace',
              color: 'var(--text-tertiary)',
              fontSize: 10,
              minWidth: 48,
              flexShrink: 0,
            }}
          >
            {formatTime(evt.timestamp)}
          </span>

          <span style={{ color: 'var(--text-secondary)', flex: 1, lineHeight: 1.3 }}>
            {evt.summary}
          </span>
        </div>
      ))}
    </div>
  );
};
