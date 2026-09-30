import { useState, useEffect, useCallback, useMemo } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import {
  Task,
  TaskStatus,
  AiRun,
  DayPlan,
  TimelineEvent,
  IdeToWidgetMessage,
  calculateCompletionPercentage,
} from '@workpulse/shared';
import { haptics } from '../audio/haptics';

const STORAGE_KEY_TASKS = 'workpulse_tasks_v3';
const STORAGE_KEY_CONFIG = 'workpulse_config_v1';

const getTodayDateStr = () => new Date().toISOString().split('T')[0];

const INITIAL_TASKS: Task[] = [];

const INITIAL_AI_RUN: AiRun = {
  id: 'live-gemini-opencode',
  agentName: 'Gemini 3.8 Flash & OpenCode',
  status: 'WORKING',
  currentStepDescription: 'Dynamic telemetry bridge active · Monitoring tasks & agent runs',
  filesModifiedCount: 14,
  testStatus: 'PASSED',
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

  // Focus Timer State
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(true);
  const [focusSeconds, setFocusSeconds] = useState<number>(522);
  const [targetMinutes, setTargetMinutes] = useState<number>(30);

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

  const activeTask = useMemo(() => {
    return tasks.find((t) => t.status === 'NOW') || null;
  }, [tasks]);

  const completionPercentage = useMemo(() => {
    return calculateCompletionPercentage(tasks);
  }, [tasks]);

  const addTask = useCallback((title: string, preferredStatus?: TaskStatus) => {
    if (!title.trim()) return;
    let assignedStatus: TaskStatus = 'NEXT';

    setTasks((prev) => {
      const hasNow = prev.some((t) => t.status === 'NOW');
      assignedStatus = preferredStatus || (hasNow ? 'NEXT' : 'NOW');
      const newTask: Task = {
        id: 'task-' + Date.now(),
        dayPlanDate: getTodayDateStr(),
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
        dayPlanDate: getTodayDateStr(),
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

  // Dynamically resize Tauri native window to match pill vs flyout
  useEffect(() => {
    if (isTauri()) {
      if (isExpanded) {
        invoke('set_widget_size', { width: 380, height: 600 }).catch(() => {});
      } else {
        invoke('set_widget_size', { width: 345, height: 48 }).catch(() => {});
      }
    }
  }, [isExpanded]);

  const toggleExpanded = useCallback(() => {
    haptics.snapClick();
    setIsExpanded((prev) => !prev);
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
          currentStepDescription: msg.payload.goal,
          filesModifiedCount: 0,
          testStatus: 'NOT_RUN',
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
          if (!prev) return null;
          return {
            ...prev,
            status: msg.payload.status,
            currentStepDescription: msg.payload.stepDescription ?? prev.currentStepDescription,
            currentStep: msg.payload.currentStep ?? prev.currentStep,
            totalSteps: msg.payload.totalSteps ?? prev.totalSteps,
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
        setAiRun((prev) =>
          prev ? { ...prev, filesModifiedCount: prev.filesModifiedCount + msg.payload.filePaths.length } : null
        );
        setTimeline((prev) => [
          {
            id: 'evt-' + Date.now(),
            dayPlanDate: getTodayDateStr(),
            aiRunId: msg.payload.runId,
            eventType: 'FILES_CHANGED',
            summary: `${msg.payload.filePaths.length} files modified`,
            timestamp: new Date().toISOString(),
          },
          ...prev,
        ]);
        break;
      }
      case 'ai/tests_result': {
        setAiRun((prev) => (prev ? { ...prev, testStatus: msg.payload.status } : null));
        setTimeline((prev) => [
          {
            id: 'evt-' + Date.now(),
            dayPlanDate: getTodayDateStr(),
            aiRunId: msg.payload.runId,
            eventType: 'TESTS_RUN',
            summary: `Tests ${msg.payload.status.toLowerCase()}`,
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
    }
  }, []);

  return {
    tasks,
    activeTask,
    aiRun,
    timeline,
    completionPercentage,
    isExpanded,
    isAlwaysOnTop,
    isMuted,
    isTimerRunning,
    focusSeconds,
    targetMinutes,
    adjustTargetMinutes,
    addTask,
    setActiveTask,
    updateTaskStatus,
    deleteTask,
    toggleExpanded,
    toggleAlwaysOnTop,
    minimizeToTaskbar,
    toggleMute,
    toggleTimer,
    resetTimer,
    handleIncomingIdeMessage,
  };
}
