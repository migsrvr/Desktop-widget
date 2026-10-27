import { useEffect, useRef, useState } from 'react';
import { ChevronUp, Pause, Play, RotateCcw } from 'lucide-react';
import { formatCountdown } from '@workpulse/shared';
import type { IslandAction, IslandSnapshot } from '../utils/islandProtocol';
import { USAGE_PROVIDERS, getUsageWindowDisplay, selectSummaryWindow } from '../utils/usageState';
import { MusicControls } from './SessionMusic';

export function SessionIsland({ snapshot, onAction, onLayout }: { snapshot: IslandSnapshot | null; onAction: (action: IslandAction) => void; onLayout: (expanded: boolean) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [pinned, setPinned] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => { onLayout(expanded); }, [expanded, onLayout, snapshot?.track != null]);
  useEffect(() => () => { if (hoverTimer.current) clearTimeout(hoverTimer.current); if (timerRef.current) clearTimeout(timerRef.current); }, []);
  const attention = snapshot ? USAGE_PROVIDERS.map(provider => {
    const reading = snapshot.usage[provider.id]; const window = selectSummaryWindow(reading, snapshot.now);
    return window ? { provider, window, display: getUsageWindowDisplay(window, reading, snapshot.now) } : null;
  }).filter((item): item is NonNullable<typeof item> => item !== null && item.display.low).sort((a, b) => b.display.used! - a.display.used!)[0] : undefined;
  const low = attention?.provider;
  const remaining = attention?.display;
  function cancelClose() { if (timerRef.current) clearTimeout(timerRef.current); }
  function collapse() { setPinned(false); setExpanded(false); rootRef.current?.querySelector<HTMLButtonElement>('.island-summary')?.focus(); }
  return <div ref={rootRef} className={`session-island ${expanded ? 'expanded' : 'compact'} ${low ? 'has-attention' : ''}`}
    onPointerEnter={() => { cancelClose(); hoverTimer.current = setTimeout(() => setExpanded(true), 350); }}
    onPointerLeave={() => { if (hoverTimer.current) clearTimeout(hoverTimer.current); if (!pinned) timerRef.current = setTimeout(() => setExpanded(false), 450); }}
    onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); collapse(); } }}>
    <button className="island-summary" aria-label={expanded ? 'Focus session controls' : 'Expand focus island'} aria-expanded={expanded} onClick={() => { setExpanded(true); setPinned(true); }} onFocus={() => { cancelClose(); }}>
      <img className={snapshot?.running ? 'focus-symbol running' : 'focus-symbol'} src="/icons/focus.svg" alt="" />
      <span className="island-task"><strong>{!expanded && low ? `${low.name} allowance low` : snapshot?.activeTask?.title ?? 'Ready to focus'}</strong>{expanded && <span>{snapshot?.running ? 'Focus session' : 'Paused · Your time, your pace'}</span>}</span>
      <span className="island-countdown">{!expanded && remaining ? `${Math.round(remaining.remaining!)}% left` : snapshot ? formatCountdown(snapshot.remainingSeconds) : '—'}</span>
    </button>
    {expanded && <div className="island-expanded-content">
      <div className="island-actions"><button className="primary-button" disabled={!snapshot} onClick={() => onAction({ type: 'toggle-timer' })}>{snapshot?.running ? <Pause size={12} /> : <Play size={12} />}{snapshot?.running ? 'Pause' : 'Start'}</button><button className="secondary-button" disabled={!snapshot?.activeTask} onClick={() => onAction({ type: 'complete' })}>Complete</button><button className="secondary-button" onClick={() => onAction({ type: 'open-board' })}>Open Board</button></div>
      <div className="island-secondary"><button className="icon-button" aria-label="Reset focus timer" onClick={() => onAction({ type: 'reset-timer' })}><RotateCcw size={12} /></button>{low && remaining && <button className="text-button caption" onClick={() => onAction({ type: 'open-usage' })}>{low.name} · {Math.round(remaining.remaining!)}% left</button>}<button className="icon-button island-collapse" aria-label="Collapse island" onClick={collapse}><ChevronUp size={14} /></button></div>
      {snapshot?.track && <div className="island-music"><span className="track-copy"><strong>{snapshot.track.name}</strong><span>{snapshot.track.artist}</span></span><MusicControls track={snapshot.track} onControl={action => onAction({ type: 'music', action })} /></div>}
    </div>}
  </div>;
}
