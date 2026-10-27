import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Check, CircleCheck, ChevronRight, Ellipsis, List, Maximize2, Minus, PanelLeft, Pause, Play, Plus, RefreshCw, RotateCcw, Search, Settings, Sun, X } from 'lucide-react';
import { formatCountdown, type Task, type TaskStatus } from '@workpulse/shared';
import type { useWorkpulseState } from '../hooks/useWorkpulseState';
import { getSessionCountdown, selectBoardTasks, type BoardPage } from '../utils/sessionView';
import { ProviderUsage, type UsageControls, type UsageProps } from './ProviderUsage';
import { SessionMusic } from './SessionMusic';
import { SessionDialog } from './SessionDialog';

type Session = ReturnType<typeof useWorkpulseState>;
interface Props extends UsageProps {
  usageControls: UsageControls;
  session: Session;
  page: BoardPage;
  onPage: (page: BoardPage) => void;
  onSpotifySetup: () => void;
  onOpenEditor: () => void;
  onZoom: () => void;
  bridgeConnected: boolean;
}
const destinations = [{ name: 'Today', icon: Sun }, { name: 'All Tasks', icon: List }, { name: 'Completed', icon: CircleCheck }, { name: 'AI Usage', icon: Bot }, { name: 'Settings', icon: Settings }] as const;
const statusLabels: Record<TaskStatus, string> = { NOW: 'Now', NEXT: 'Next', LATER: 'Later', DONE: 'Completed' };

export function SessionBoard({ session: s, page, onPage, onSpotifySetup, onOpenEditor, onZoom, bridgeConnected, usageControls, ...usage }: Props) {
  const [sidebar, setSidebar] = useState(true);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inspector, setInspector] = useState(() => typeof window === 'undefined' || window.innerWidth >= 960);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDuration, setNewDuration] = useState('30');
  const [newStatus, setNewStatus] = useState<TaskStatus>('NEXT');
  const searchRef = useRef<HTMLInputElement>(null);
  const selected = s.tasks.find(task => task.id === selectedId) ?? s.activeTask;
  const visibleTasks = useMemo(() => selectBoardTasks(s.tasks, page, s.activeDate, query), [s.tasks, page, s.activeDate, query]);
  const taskPage = page !== 'AI Usage' && page !== 'Settings';
  const countdown = getSessionCountdown(s.activeTask, s.focusSeconds, s.targetMinutes);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || adding) return;
      if (event.key.toLowerCase() === 'f') { event.preventDefault(); searchRef.current?.focus(); }
      if (event.key.toLowerCase() === 'n') { event.preventDefault(); setAdding(true); }
      if (event.key === ',') { event.preventDefault(); onPage('Settings'); }
      if (event.key === '1') { event.preventDefault(); onPage('Today'); }
      if (event.key === '2') { event.preventDefault(); onPage('All Tasks'); }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [adding, onPage]);

  function navigate(next: BoardPage) { setQuery(''); onPage(next); }
  function changeStatus(task: Task, status: TaskStatus) { status === 'NOW' ? s.setActiveTask(task.id) : s.updateTaskStatus(task.id, status); }

  return <div className={`session-board ${sidebar ? '' : 'sidebar-hidden'} ${taskPage && inspector ? 'has-inspector' : ''}`}>
    <header className="board-toolbar" data-tauri-drag-region>
      <div className="window-controls" data-tauri-drag-region>
        <button aria-label="Close board to island" title="Close board to island" onClick={() => s.setViewMode('DOCK')}><X size={9} /></button>
        <button aria-label="Minimize window" title="Minimize" onClick={s.minimizeToTaskbar}><Minus size={9} /></button>
        <button aria-label="Zoom window" title="Zoom" onClick={onZoom}><Maximize2 size={8} /></button>
      </div>
      <div className="toolbar-content" data-tauri-drag-region>
        <button className="icon-button" aria-label="Toggle sidebar" aria-pressed={sidebar} onClick={() => setSidebar(v => !v)}><PanelLeft size={18} /></button>
        <span className="toolbar-title" data-tauri-drag-region>{page}</span>
        <label className="board-search"><Search size={14} /><input ref={searchRef} type="search" aria-label={page === 'AI Usage' ? 'Search providers' : 'Search tasks'} placeholder="Search" value={query} onChange={event => setQuery(event.target.value)} disabled={page === 'Settings'} /><kbd>⌘ F</kbd></label>
        <button className="primary-button new-task-button" aria-label="New Task" onClick={() => setAdding(true)}><Plus size={14} /><span>New Task</span></button>
        <button className="icon-button" aria-label="Collapse to island" title="Collapse to island" onClick={() => s.setViewMode('DOCK')}><img src="/icons/island.svg" alt="" width={20} height={20} /></button>
      </div>
    </header>
    <div className="board-workspace">
      {sidebar && <nav className="board-sidebar" aria-label="Session navigation"><p className="sidebar-heading">Session</p>{destinations.map(({ name, icon: Icon }) => <button key={name} aria-label={name} className={`nav-item ${page === name ? 'selected' : ''} ${name === 'AI Usage' ? 'nav-usage' : ''} ${name === 'Settings' ? 'nav-settings' : ''}`} onClick={() => navigate(name)} aria-current={page === name ? 'page' : undefined}><Icon size={18} /><span>{name}</span></button>)}</nav>}
      <main className={`board-main ${!taskPage ? 'wide' : ''}`}>
        <div className="page-heading"><h1>{page}</h1><p className="caption">{page === 'Today' ? new Date(`${s.activeDate}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }) : page === 'AI Usage' ? 'Remaining allowance and reset time for each service.' : page === 'Completed' ? 'A little progress, every day.' : page === 'Settings' ? 'Make room for the way you work.' : 'Everything you’re working toward.'}</p></div>
        {page === 'AI Usage' ? <>
          <div className="row-between usage-heading"><h3>Current plan windows</h3><button className="secondary-button" onClick={usageControls.refresh} disabled={!usageControls.supported || usageControls.pending !== null}><RefreshCw size={13} />{usageControls.pending === 'refresh' ? 'Checking…' : 'Refresh'}</button></div>
          {!usageControls.supported && <p className="caption usage-desktop-note">Account usage is available in the desktop app. This browser view does not connect to your local accounts.</p>}
          {usageControls.errors.refresh && <p className="caption error-copy" role="status">{usageControls.errors.refresh}</p>}
          <ProviderUsage {...usage} query={query} controls={usageControls} />
          <p className="usage-note caption">Codex refreshes every minute and when it reports a change. Claude Code and Antigravity update when their CLIs export a new quota reading.<br />Connecting a CLI adds a quota exporter to its status line and preserves your existing command. Only quota fields are retained. Unchanged exports do not renew the reading time.</p>
        </> : page === 'Settings' ? <div className="settings-content">
          <section><h2>Focus</h2><label className="setting-row"><span>Keep board on top</span><input type="checkbox" role="switch" checked={s.isAlwaysOnTop} onChange={s.toggleAlwaysOnTop} /></label><label className="setting-row"><span>Sound effects</span><input type="checkbox" role="switch" checked={!s.isMuted} onChange={s.toggleMute} /></label><div className="setting-row"><span>Default focus duration</span><div className="duration-stepper"><button className="icon-button" aria-label="Decrease focus duration" onClick={() => s.adjustTargetMinutes(-5)}><Minus size={14} /></button><span>{s.targetMinutes} min</span><button className="icon-button" aria-label="Increase focus duration" onClick={() => s.adjustTargetMinutes(5)}><Plus size={14} /></button></div></div></section>
          <section><h2>Music</h2><div className="setting-row"><span>Spotify<span className="caption block">{s.spotify.authStatus.isConnected ? 'Connected' : 'Connect your account to play music'}</span></span><button className="secondary-button" onClick={onSpotifySetup}>{s.spotify.authStatus.isConnected ? 'Manage' : 'Connect'}</button></div></section>
          <section><h2>Connections</h2><div className="setting-row"><span>IDE bridge</span><span className="caption">{bridgeConnected ? 'Connected' : 'Offline'}</span></div><p className="caption">AI allowances appear when a connected service provides a verified reading.</p></section>
          <button className="text-button" onClick={s.exitApp}>Quit SESSION</button>
        </div> : <>
          {page !== 'Completed' && <section className="current-focus" aria-label="Current focus">
            <div className="focus-summary"><p className="caption">Current focus</p><h2>{s.activeTask?.title ?? 'A little space to focus'}</h2><p className="focus-countdown" aria-label="Time remaining">{formatCountdown(countdown)}</p></div>
            <div className="focus-actions"><div className="button-row"><button className="primary-button" onClick={s.toggleTimer}>{s.isTimerRunning ? <Pause size={13} /> : <Play size={13} />}{s.isTimerRunning ? 'Pause' : 'Start'}</button><button className="secondary-button" disabled={!s.activeTask} onClick={s.completeActiveTask}>Complete</button><button className="icon-button" title="Reset focus timer" aria-label="Reset focus timer" onClick={s.resetTimer}><RotateCcw size={14} /></button></div><button className="text-button caption" onClick={() => navigate('AI Usage')}>View AI usage<ChevronRight size={12} /></button></div>
          </section>}
          {(['NOW', 'NEXT', 'LATER', 'DONE'] as const).map(status => {
            const group = visibleTasks.filter(task => task.status === status);
            if (group.length === 0) return null;
            return <section className="task-group" key={status} aria-label={`${statusLabels[status]} tasks`}><h3>{statusLabels[status]}{status === 'DONE' && <span className="caption"> · {group.length}</span>}</h3>{group.map(task => <div key={task.id} className={`task-row ${task.status === 'NOW' || selectedId === task.id ? 'selected' : ''} ${status === 'DONE' ? 'task-done' : ''}`}>
              <button className="task-check" aria-label={status === 'DONE' ? `Reopen ${task.title}` : `Complete ${task.title}`} aria-pressed={status === 'DONE'} onClick={() => s.updateTaskStatus(task.id, status === 'DONE' ? 'NEXT' : 'DONE')}>{status === 'DONE' && <Check size={12} />}</button>
              <button className="task-title" onClick={() => { setSelectedId(task.id); setInspector(true); }}>{task.title}</button>
              <span className="task-duration caption">{task.estimatedMinutes ? `${task.estimatedMinutes} min` : ''}</span>
              <button className="icon-button task-menu" aria-label={`Details for ${task.title}`} onClick={() => { setSelectedId(task.id); setInspector(true); }}><Ellipsis size={16} /></button>
            </div>)}</section>;
          })}
          {visibleTasks.length === 0 && <div className="empty-state"><CircleCheck size={26} strokeWidth={1} /><h2>{query ? 'No matching tasks' : page === 'Completed' ? 'Your progress starts here' : 'A clear day, a fresh start'}</h2><p>{query ? 'Try a different search.' : page === 'Completed' ? 'Completed tasks will appear here.' : 'Add a task and give it your attention.'}</p>{!query && page !== 'Completed' && <button className="secondary-button" onClick={() => setAdding(true)}><Plus size={14} />Add your first task</button>}</div>}
          <div className="task-footer"><button className="text-button caption" onClick={() => navigate('Completed')}><CircleCheck size={14} />Completed · {s.todaysDoneCount}</button><button className="text-button" onClick={() => setAdding(true)}><Plus size={14} />Add task</button></div>
        </>}
      </main>
      {taskPage && inspector && <aside className="task-inspector" aria-label="Task details">
        <div className="row-between"><h3>Task details</h3><button className="icon-button" aria-label="Hide task details" onClick={() => setInspector(false)}><X size={14} /></button></div>
        {selected ? <><h2 className="inspector-title">{selected.title}</h2><label className="detail-row"><span>Duration</span><span className="duration-input"><input aria-label="Task duration in minutes" type="number" min="1" max="180" value={selected.estimatedMinutes ?? ''} placeholder="—" onChange={event => { const value = event.target.value; if (!value) s.setTaskPomodoroMinutes(selected.id, undefined); else if (+value >= 1 && +value <= 180) s.setTaskPomodoroMinutes(selected.id, +value); }} />min</span></label><label className="detail-row"><span>Status</span><select aria-label="Task status" value={selected.status} onChange={event => changeStatus(selected, event.target.value as TaskStatus)}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><p className="caption">{formatCountdown(selected.elapsedFocusSeconds)} focused</p><div className="button-row"><button className="text-button caption" onClick={() => s.resetTaskTimer(selected.id)}>Reset timer</button><button className="text-button caption" onClick={() => { s.deleteTask(selected.id); setSelectedId(null); }}>Delete task</button></div></> : <p className="caption inspector-empty">Select a task to see its details.</p>}
        <hr /><h3>AI Usage</h3><ProviderUsage {...usage} compact /><button className="text-button" onClick={() => navigate('AI Usage')}>View all usage<ChevronRight size={14} /></button>
        <button className="secondary-button editor-button" disabled={!s.activeTask || !bridgeConnected} title={bridgeConnected ? 'Open current task in the connected editor' : 'Connect your editor to open tasks'} onClick={onOpenEditor}>Open in editor</button>
      </aside>}
    </div>
    <footer className="board-footer"><div className="sidebar-footer" /><SessionMusic track={s.spotify.track} connected={s.spotify.authStatus.isConnected} error={s.spotify.error} onControl={s.spotify.controlPlayback} onSetup={onSpotifySetup} /></footer>
    {adding && <SessionDialog title="New Task" onClose={() => setAdding(false)}><form onSubmit={event => { event.preventDefault(); if (!newTitle.trim()) return; if (newStatus === 'NOW' && s.activeTask) s.updateTaskStatus(s.activeTask.id, 'NEXT'); s.addTask(newTitle, newStatus, newDuration ? +newDuration : undefined); setNewTitle(''); setAdding(false); navigate('Today'); }}>
      <label className="field-label">What would you like to work on?<input autoFocus required maxLength={500} value={newTitle} onChange={event => setNewTitle(event.target.value)} placeholder="Task title" /></label>
      <div className="form-columns"><label className="field-label">Duration (minutes)<input type="number" min="1" max="180" value={newDuration} onChange={event => setNewDuration(event.target.value)} placeholder="Optional" /></label><label className="field-label">When<select value={newStatus} onChange={event => setNewStatus(event.target.value as TaskStatus)}><option value="NOW">Now</option><option value="NEXT">Next</option><option value="LATER">Later</option></select></label></div>
      <div className="dialog-actions"><button type="button" className="secondary-button" onClick={() => setAdding(false)}>Cancel</button><button type="submit" className="primary-button" disabled={!newTitle.trim()}>Add task</button></div>
    </form></SessionDialog>}
  </div>;
}
