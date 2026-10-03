import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { LogicalPosition, LogicalSize } from '@tauri-apps/api/dpi';
import {
  Task,
  TaskStatus,
  AiRun,
  DayPlan,
  TimelineEvent,
  IdeToWidgetMessage,
  calculateCompletionPercentage,
  filterTodaysTasks,
  filterPastCompletedTasks,
} from '@workpulse/shared';
import { haptics } from '../audio/haptics';
import { useSpotifyPlayer } from './useSpotifyPlayer';

const STORAGE_KEY_TASKS = 'workpulse_tasks_v3';
const STORAGE_KEY_CONFIG = 'workpulse_config_v1';

export const getTodayDateStr = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const INITIAL_TASKS: Task[] = [];

const INITIAL_AI_RUN: AiRun = {
  id: 'live-gemini-opencode',
  agentName: 'Gemini 3.8 Flash & OpenCode',
  status: 'WORKING',
  goal: 'Monitoring live tasks & agent runs',
  currentStepDescription: 'Waiting for live agent telemetry…',
  filesModifiedCount: 0,
  modifiedFiles: [],
  testStatus: 'NOT_RUN',
  startedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
};

const INITIAL_TIMELINE: TimelineEvent[] = [
  {
    id: 'evt-init',
    dayPlanDate: getTodayDateStr(),
    eventType: 'AI_START',
    summary: 'Dynamic telemetry bridge connected to Gemini & OpenCode',
    timestamp: new Date().toISOString(),
  },
];

export function useWorkpulseState() {
  const [activeDate, setActiveDate] = useState<string>(getTodayDateStr);

  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TASKS);
      return saved ? JSON.parse(saved) : INITIAL_TASKS;
    } catch {
      return INITIAL_TASKS;
    }
  });

  const [aiRun, setAiRun] = useState<AiRun | null>(INITIAL_AI_RUN);
  const [timeline, setTimeline] = useState<TimelineEvent[]>(INITIAL_TIMELINE);

  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Focus Timer State (Daily scoped)
  const [focusSeconds, setFocusSeconds] = useState<number>(() => {
    try {
      const today = getTodayDateStr();
      const saved = localStorage.getItem(`workpulse_focus_seconds_${today}`);
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [targetMinutes, setTargetMinutes] = useState<number>(30);

  // Spotify integration
  const spotify = useSpotifyPlayer();

  // Check for date rollover (e.g. crossing midnight or opening on a new day)
  useEffect(() => {
    const checkDateRollover = () => {
      const currentToday = getTodayDateStr();
      const lastActiveDate = localStorage.getItem('workpulse_last_active_date');

      if (!lastActiveDate) {
        localStorage.setItem('workpulse_last_active_date', currentToday);
      } else if (lastActiveDate !== currentToday) {
        // A new day has arrived!
        localStorage.setItem('workpulse_last_active_date', currentToday);
        setActiveDate(currentToday);

        // Rollover: update any pending (uncompleted) tasks to today
        setTasks((prev) => {
          let rolledCount = 0;
          const updated = prev.map((t) => {
            if (t.status !== 'DONE' && t.dayPlanDate !== currentToday) {
              rolledCount++;
              return { ...t, dayPlanDate: currentToday };
            }
            return t;
          });

          if (rolledCount > 0) {
            setTimeline((prevTl) => [
              {
                id: 'evt-' + Date.now(),
                dayPlanDate: currentToday,
                eventType: 'TASK_START',
                summary: `New day started · Rolled over ${rolledCount} pending task(s)`,
                timestamp: new Date().toISOString(),
              },
              ...prevTl,
            ]);
          }
          return updated;
        });

        // Reset daily focus timer for the new day
        setFocusSeconds(0);
        setIsTimerRunning(false);
      }
    };

    checkDateRollover();
    const timer = setInterval(checkDateRollover, 10000); // Check every 10s for midnight
    return () => clearInterval(timer);
  }, []);

  const adjustTargetMinutes = useCallback((delta: number) => {
    setTargetMinutes((prev) => {
      const next = Math.max(5, Math.min(180, prev + delta));
      haptics.snapClick();
      return next;
    });
  }, []);

  // Save tasks to local storage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(tasks));
    } catch {}
  }, [tasks]);

  // Persist daily focus timer
  useEffect(() => {
    try {
      const today = getTodayDateStr();
      localStorage.setItem(`workpulse_focus_seconds_${today}`, focusSeconds.toString());
    } catch {}
  }, [focusSeconds]);

  // Focus timer tick
  useEffect(() => {
    if (!isTimerRunning) return;
    const interval = setInterval(() => {
      setFocusSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  // Sync mute state with haptics engine
  useEffect(() => {
    haptics.setMuted(isMuted);
  }, [isMuted]);

  // Filter tasks into Today's workload vs Previous Days' completed tasks
  const todaysTasks = useMemo(() => {
    return filterTodaysTasks(tasks, activeDate);
  }, [tasks, activeDate]);

  const pastCompletedTasks = useMemo(() => {
    return filterPastCompletedTasks(tasks, activeDate);
  }, [tasks, activeDate]);

  const activeTask = useMemo(() => {
    return todaysTasks.find((t) => t.status === 'NOW') || null;
  }, [todaysTasks]);

  const completionPercentage = useMemo(() => {
    return calculateCompletionPercentage(todaysTasks);
  }, [todaysTasks]);

  const todaysDoneCount = useMemo(() => {
    return todaysTasks.filter((t) => t.status === 'DONE').length;
  }, [todaysTasks]);

  const todaysRemainingCount = useMemo(() => {
    return todaysTasks.filter((t) => t.status !== 'DONE').length;
  }, [todaysTasks]);

  const addTask = useCallback((title: string, preferredStatus?: TaskStatus) => {
    if (!title.trim()) return;
    const currentToday = getTodayDateStr();
    let assignedStatus: TaskStatus = 'NEXT';

    setTasks((prev) => {
      const currentTodaysTasks = filterTodaysTasks(prev, currentToday);
      const hasNow = currentTodaysTasks.some((t) => t.status === 'NOW');
      assignedStatus = preferredStatus || (hasNow ? 'NEXT' : 'NOW');
      const newTask: Task = {
        id: 'task-' + Date.now(),
        dayPlanDate: currentToday,
        title: title.trim(),
        status: assignedStatus,
        displayOrder: prev.length,
        elapsedFocusSeconds: 0,
        createdAt: new Date().toISOString(),
      };
      return [...prev, newTask];
    });
    haptics.hapticPop(320);

    setTimeline((prev) => [
      {
        id: 'evt-' + Date.now(),
        dayPlanDate: currentToday,
        eventType: 'TASK_START',
        summary: `Created task “${title.trim()}”`,
        timestamp: new Date().toISOString(),
      },
      ...prev,
    ]);
  }, []);

  const setActiveTask = useCallback((taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          return { ...t, status: 'NOW' };
        }
        if (t.status === 'NOW') {
          return { ...t, status: 'NEXT' };
        }
        return t;
      })
    );
    haptics.snapClick();
  }, []);

  const updateTaskStatus = useCallback((taskId: string, newStatus: TaskStatus) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          const completedAt = newStatus === 'DONE' ? new Date().toISOString() : undefined;
          return { ...t, status: newStatus, completedAt };
        }
        return t;
      })
    );

    if (newStatus === 'DONE') {
      haptics.successChime();
      setTimeline((prev) => [
        {
          id: 'evt-' + Date.now(),
          dayPlanDate: getTodayDateStr(),
          taskId,
          eventType: 'TASK_DONE',
          summary: 'Task marked complete',
          timestamp: new Date().toISOString(),
        },
        ...prev,
      ]);
    } else {
      haptics.hapticPop();
    }
  }, []);

  const deleteTask = useCallback((taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    haptics.hapticPop(200);
  }, []);

  // Side flyout panel: Spotify / Screen Operator extend to the LEFT
  // of the main column instead of stacking into one long widget.
  const [sidePanel, setSidePanel] = useState<'spotify' | 'operator' | null>(null);

  const toggleSidePanel = useCallback((panel: 'spotify' | 'operator') => {
    haptics.snapClick();
    setSidePanel((prev) => (prev === panel ? null : panel));
  }, []);

  const closeSidePanel = useCallback(() => {
    setSidePanel(null);
  }, []);

  // Dynamically resize Tauri native window to match pill vs flyout.
  // When a side panel opens, the window grows leftward so the main
  // column stays visually anchored where the user left it.
  const MAIN_W = 420;
  const SIDE_W = 300;
  const SIDE_GAP = 8;
  const prevSideRef = useRef<'spotify' | 'operator' | null>(null);
  useEffect(() => {
    if (!isTauri()) return;
    const wasOpen = prevSideRef.current !== null;
    const isOpen = sidePanel !== null && isExpanded;
    prevSideRef.current = sidePanel;

    (async () => {
      try {
        const win = getCurrentWindow();
        if (!isExpanded) {
          await win.setSize(new LogicalSize(345, 48));
          return;
        }
        // Shift horizontally only on open/close transitions so the
        // main column doesn't jump when switching between flyouts.
        if (isOpen && !wasOpen) {
          const [pos, scale] = await Promise.all([win.outerPosition(), win.scaleFactor()]);
          const logical = pos.toLogical(scale);
          await win.setPosition(new LogicalPosition(logical.x - (SIDE_W + SIDE_GAP), logical.y));
        } else if (!isOpen && wasOpen) {
          const [pos, scale] = await Promise.all([win.outerPosition(), win.scaleFactor()]);
          const logical = pos.toLogical(scale);
          await win.setPosition(new LogicalPosition(logical.x + (SIDE_W + SIDE_GAP), logical.y));
        }
        await win.setSize(new LogicalSize(isOpen ? MAIN_W + SIDE_GAP + SIDE_W : MAIN_W, 640));
      } catch {
        // Fallback to the native command if the window API is unavailable.
        invoke(
          'set_widget_size',
          isExpanded ? { width: 420, height: 640 } : { width: 345, height: 48 }
        ).catch(() => {});
      }
    })();
  }, [isExpanded, sidePanel]);

  const toggleExpanded = useCallback(() => {
    haptics.snapClick();
    setIsExpanded((prev) => {
      if (prev) setSidePanel(null);
      return !prev;
    });
  }, []);

  const toggleAlwaysOnTop = useCallback(() => {
    setIsAlwaysOnTop((prev) => {
      const next = !prev;
      if (isTauri()) {
        invoke('toggle_always_on_top', { enable: next }).catch(() => {});
      }
      return next;
    });
    haptics.snapClick();
  }, []);

  const minimizeToTaskbar = useCallback(() => {
    if (isTauri()) {
      invoke('minimize_window').catch(() => {});
    }
    haptics.snapClick();
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  const toggleTimer = useCallback(() => {
    haptics.snapClick();
    setIsTimerRunning((prev) => !prev);
  }, []);

  const resetTimer = useCallback(() => {
    haptics.hapticPop(220);
    setFocusSeconds(0);
    setIsTimerRunning(false);
  }, []);

  // Process incoming telemetry from IDE extension
  const handleIncomingIdeMessage = useCallback((msg: IdeToWidgetMessage) => {
    switch (msg.type) {
      case 'ai/run_started': {
        setAiRun({
          id: msg.payload.runId,
          taskId: msg.payload.taskId,
          agentName: msg.payload.agentName,
          status: 'WORKING',
          goal: msg.payload.goal,
          currentStepDescription: msg.payload.goal,
          filesModifiedCount: 0,
          modifiedFiles: [],
          testStatus: 'NOT_RUN',
          testSummary: undefined,
          summary: undefined,
          completedAt: undefined,
          startedAt: new Date().toISOString(),
        });
        haptics.hapticPop(400);
        setTimeline((prev) => [
          {
            id: 'evt-' + Date.now(),
            dayPlanDate: getTodayDateStr(),
            taskId: msg.payload.taskId,
            aiRunId: msg.payload.runId,
            eventType: 'AI_START',
            summary: `AI agent started: ${msg.payload.goal}`,
            timestamp: new Date().toISOString(),
          },
          ...prev,
        ]);
        break;
      }
      case 'ai/status_update': {
        setAiRun((prev) => {
          const isActive =
            msg.payload.status === 'WORKING' ||
            msg.payload.status === 'PLANNING' ||
            msg.payload.status === 'RUNNING_TOOLS';
          if (!prev) {
            return {
              id: msg.payload.runId,
              agentName: msg.payload.agentName ?? 'Gemini 3.8 Flash & OpenCode',
              status: msg.payload.status,
              currentStepDescription: msg.payload.stepDescription ?? 'Working on task…',
              currentStep: msg.payload.currentStep,
              totalSteps: msg.payload.totalSteps,
              filesModifiedCount: 0,
              modifiedFiles: [],
              testStatus: 'NOT_RUN',
              startedAt: new Date().toISOString(),
            };
          }
          return {
            ...prev,
            // Adopt the live run id so follow-up files/tests events match,
            // but keep the friendly display name unless the payload provides one.
            id: prev.id.startsWith('live-') || prev.id.startsWith('sim-') ? msg.payload.runId : prev.id,
            agentName: msg.payload.agentName ?? prev.agentName,
            status: msg.payload.status,
            currentStepDescription: msg.payload.stepDescription ?? prev.currentStepDescription,
            currentStep: msg.payload.currentStep ?? prev.currentStep,
            totalSteps: msg.payload.totalSteps ?? prev.totalSteps,
            // If work restarted, clear the finished timestamp so the timer resumes.
            completedAt: isActive ? undefined : prev.completedAt,
          };
        });
        break;
      }
      case 'ai/waiting_input': {
        setAiRun((prev) => (prev ? { ...prev, status: 'WAITING_INPUT' } : null));
        haptics.agentAlertChime();
        setTimeline((prev) => [
          {
            id: 'evt-' + Date.now(),
            dayPlanDate: getTodayDateStr(),
            aiRunId: msg.payload.runId,
            eventType: 'AI_WAITING',
            summary: `AI requested approval: ${msg.payload.prompt}`,
            timestamp: new Date().toISOString(),
          },
          ...prev,
        ]);
        break;
      }
      case 'ai/files_changed': {
        setAiRun((prev) => {
          const incoming = Array.isArray(msg.payload.filePaths) ? msg.payload.filePaths : [];
          if (incoming.length === 0) return prev;
          if (!prev) {
            const unique = Array.from(new Set(incoming));
            return {
              id: msg.payload.runId,
              agentName: 'Gemini 3.8 Flash & OpenCode',
              status: 'WORKING',
              currentStepDescription: 'Working on task…',
              filesModifiedCount: unique.length,
              modifiedFiles: unique,
              testStatus: 'NOT_RUN',
              startedAt: new Date().toISOString(),
            };
          }
          const merged = Array.from(new Set([...(prev.modifiedFiles ?? []), ...incoming]));
          // Fall back to count arithmetic only when we have no file list yet
          // (e.g. legacy senders that report counts without paths).
          const nextCount =
            (prev.modifiedFiles ?? []).length > 0 || incoming.length > 0
              ? merged.length
              : prev.filesModifiedCount + incoming.length;
          if (nextCount === prev.filesModifiedCount && merged.length === (prev.modifiedFiles ?? []).length) {
            return prev;
          }
          return { ...prev, filesModifiedCount: nextCount, modifiedFiles: merged };
        });
        const incomingPaths = Array.isArray(msg.payload.filePaths) ? msg.payload.filePaths : [];
        const preview =
          incomingPaths.length <= 3
            ? incomingPaths.join(', ')
            : `${incomingPaths.slice(0, 3).join(', ')} +${incomingPaths.length - 3} more`;
        setTimeline((prev) => [
          {
            id: 'evt-' + Date.now(),
            dayPlanDate: getTodayDateStr(),
            aiRunId: msg.payload.runId,
            eventType: 'FILES_CHANGED',
            summary:
              incomingPaths.length > 0
                ? `${incomingPaths.length} file${incomingPaths.length === 1 ? '' : 's'} modified · ${preview}`
                : 'Files updated',
            metadata: { filePaths: incomingPaths },
            timestamp: new Date().toISOString(),
          },
          ...prev,
        ]);
        break;
      }
      case 'ai/tests_result': {
        setAiRun((prev) => {
          if (!prev) {
            return {
              id: msg.payload.runId,
              agentName: 'Gemini 3.8 Flash & OpenCode',
              status: 'WORKING',
              currentStepDescription: 'Working on task…',
              filesModifiedCount: 0,
              modifiedFiles: [],
              testStatus: msg.payload.status,
              testSummary: msg.payload.summary,
              startedAt: new Date().toISOString(),
            };
          }
          if (prev.testStatus === msg.payload.status && prev.testSummary === msg.payload.summary) {
            return prev;
          }
          return { ...prev, testStatus: msg.payload.status, testSummary: msg.payload.summary };
        });
        setTimeline((prev) => [
          {
            id: 'evt-' + Date.now(),
            dayPlanDate: getTodayDateStr(),
            aiRunId: msg.payload.runId,
            eventType: 'TESTS_RUN',
            summary: msg.payload.summary
              ? `Tests ${msg.payload.status.toLowerCase()} · ${msg.payload.summary}`
              : `Tests ${msg.payload.status.toLowerCase()}`,
            metadata: msg.payload.summary ? { summary: msg.payload.summary } : undefined,
            timestamp: new Date().toISOString(),
          },
          ...prev,
        ]);
        break;
      }
      case 'ai/run_finished': {
        setAiRun((prev) =>
          prev
            ? {
                ...prev,
                status: msg.payload.status,
                summary: msg.payload.summary ?? prev.summary,
                completedAt: new Date().toISOString(),
              }
            : null
        );
        if (msg.payload.status === 'COMPLETED') {
          haptics.successChime();
        } else {
          haptics.hapticPop(180);
        }
        break;
      }
      case 'git/commit_created': {
        setTimeline((prev) => [
          {
            id: 'evt-' + Date.now(),
            dayPlanDate: getTodayDateStr(),
            eventType: 'GIT_COMMIT',
            summary: `Git commit: ${msg.payload.message} (${msg.payload.hash.slice(0, 7)})`,
            timestamp: new Date().toISOString(),
          },
          ...prev,
        ]);
        break;
      }
      // Dynamic task creation from Gemini or OpenCode CLI
      case 'task/create' as any: {
        const payload = (msg as any).payload;
        if (payload && payload.title) {
          addTask(payload.title, payload.status);
        }
        break;
      }
      case 'spotify/auth_success': {
        spotify.handleAuthSuccess(msg.payload.clientId);
        break;
      }
      case 'screen/observed': {
        setTimeline((prev) => [
          {
            id: 'evt-' + Date.now(),
            dayPlanDate: getTodayDateStr(),
            eventType: 'SCREEN_OBSERVED',
            summary: `Screen observed · ${(msg.payload.width || 0)}x${msg.payload.height || 0}`,
            metadata: { frameId: msg.payload.frameId },
            timestamp: new Date().toISOString(),
          },
          ...prev.slice(0, 49),
        ]);
        break;
      }
      case 'ai/vision_update': {
        const confident = msg.payload.confidence >= 0.75;
        setAiRun((prev) => {
          const mapped = msg.payload.state === 'STUCK' || msg.payload.state === 'ERROR' ? 'WAITING_INPUT' : 'WORKING';
          if (!prev) {
            return {
              id: 'vision-' + Date.now(),
              agentName: 'Screen Vision',
              status: mapped,
              currentStepDescription: msg.payload.summary,
              filesModifiedCount: 0,
              modifiedFiles: [],
              testStatus: 'NOT_RUN',
              startedAt: new Date().toISOString(),
            };
          }
          return { ...prev, status: confident ? mapped : prev.status, currentStepDescription: msg.payload.summary };
        });
        if (msg.payload.state === 'STUCK' || msg.payload.state === 'ERROR') {
          haptics.agentAlertChime();
        }
        setTimeline((prev) => [
          {
            id: 'evt-' + Date.now(),
            dayPlanDate: getTodayDateStr(),
            eventType: 'VISION_INFERENCE',
            summary: `Vision ${msg.payload.state.toLowerCase()} (${Math.round(msg.payload.confidence * 100)}%) · ${msg.payload.summary}`,
            metadata: { inferenceId: msg.payload.inferenceId, confidence: msg.payload.confidence },
            timestamp: new Date().toISOString(),
          },
          ...prev.slice(0, 49),
        ]);
        break;
      }
      case 'agent/action_proposed': {
        setAiRun((prev) => (prev ? { ...prev, status: 'WAITING_INPUT' } : prev));
        haptics.agentAlertChime();
        setTimeline((prev) => [
          {
            id: 'evt-' + Date.now(),
            dayPlanDate: getTodayDateStr(),
            eventType: 'ACTION_PROPOSED',
            summary: `Operator proposed ${msg.payload.tool}: ${msg.payload.prompt}`,
            timestamp: new Date().toISOString(),
          },
          ...prev.slice(0, 49),
        ]);
        break;
      }
    }
  }, [addTask, spotify]);

  const clearPastCompletedTasks = useCallback(() => {
    const currentToday = getTodayDateStr();
    setTasks((prev) => {
      return prev.filter((t) => {
        if (t.status !== 'DONE') return true;
        if (t.completedAt) return t.completedAt.startsWith(currentToday);
        return t.dayPlanDate === currentToday;
      });
    });
    haptics.snapClick();
    setTimeline((prev) => [
      {
        id: 'evt-' + Date.now(),
        dayPlanDate: currentToday,
        eventType: 'TASK_DONE',
        summary: 'Cleared completed tasks from previous days',
        timestamp: new Date().toISOString(),
      },
      ...prev,
    ]);
  }, []);

  const clearAllCompletedTasks = useCallback(() => {
    setTasks((prev) => prev.filter((t) => t.status !== 'DONE'));
    haptics.snapClick();
  }, []);

  return {
    tasks,
    todaysTasks,
    pastCompletedTasks,
    activeTask,
    aiRun,
    timeline,
    completionPercentage,
    todaysDoneCount,
    todaysRemainingCount,
    isExpanded,
    isAlwaysOnTop,
    minimizeToTaskbar,
    isMuted,
    isTimerRunning,
    focusSeconds,
    targetMinutes,
    adjustTargetMinutes,
    addTask,
    setActiveTask,
    updateTaskStatus,
    deleteTask,
    clearPastCompletedTasks,
    clearAllCompletedTasks,
    sidePanel,
    toggleSidePanel,
    closeSidePanel,
    toggleExpanded,
    toggleAlwaysOnTop,
    toggleMute,
    toggleTimer,
    resetTimer,
    handleIncomingIdeMessage,
    spotify,
  };
}
