import { useState, useEffect, useCallback, useMemo } from 'react';
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

const STORAGE_KEY_TASKS = 'workpulse_tasks_v1';
const STORAGE_KEY_CONFIG = 'workpulse_config_v1';

const getTodayDateStr = () => new Date().toISOString().split('T')[0];

const INITIAL_TASKS: Task[] = [
  {
    id: 'task-1',
    dayPlanDate: getTodayDateStr(),
    title: 'Mediseena — implement OCR API',
    status: 'NOW',
    displayOrder: 0,
    elapsedFocusSeconds: 522,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'task-2',
    dayPlanDate: getTodayDateStr(),
    title: 'Build prescription form',
    status: 'DONE',
    displayOrder: 1,
    elapsedFocusSeconds: 1400,
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  },
  {
    id: 'task-3',
    dayPlanDate: getTodayDateStr(),
    title: 'Add validation for medical codes',
    status: 'DONE',
    displayOrder: 2,
    elapsedFocusSeconds: 980,
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  },
  {
    id: 'task-4',
    dayPlanDate: getTodayDateStr(),
    title: 'Connect OCR endpoint',
    status: 'NEXT',
    displayOrder: 3,
    elapsedFocusSeconds: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'task-5',
    dayPlanDate: getTodayDateStr(),
    title: 'Test failed uploads fallback',
    status: 'LATER',
    displayOrder: 4,
    elapsedFocusSeconds: 0,
    createdAt: new Date().toISOString(),
  },
];

const INITIAL_AI_RUN: AiRun = {
  id: 'run-101',
  taskId: 'task-1',
  agentName: 'Gemini 3.8 Flash',
  status: 'WORKING',
  currentStepDescription: 'Generating integration tests for OCR payload validation',
  currentStep: 3,
  totalSteps: 5,
  filesModifiedCount: 4,
  testStatus: 'RUNNING',
  startedAt: new Date(Date.now() - 8 * 60 * 1000 - 42 * 1000).toISOString(),
};

const INITIAL_TIMELINE: TimelineEvent[] = [
  {
    id: 'evt-1',
    dayPlanDate: getTodayDateStr(),
    taskId: 'task-1',
    eventType: 'TASK_START',
    summary: 'Started “OCR endpoint”',
    timestamp: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
  },
  {
    id: 'evt-2',
    dayPlanDate: getTodayDateStr(),
    taskId: 'task-1',
    aiRunId: 'run-101',
    eventType: 'AI_START',
    summary: 'AI agent launched slice implementation',
    timestamp: new Date(Date.now() - 28 * 60 * 1000).toISOString(),
  },
  {
    id: 'evt-3',
    dayPlanDate: getTodayDateStr(),
    taskId: 'task-1',
    aiRunId: 'run-101',
    eventType: 'FILES_CHANGED',
    summary: '4 files modified in src/ocr/',
    timestamp: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
  },
  {
    id: 'evt-4',
    dayPlanDate: getTodayDateStr(),
    taskId: 'task-1',
    aiRunId: 'run-101',
    eventType: 'TESTS_RUN',
    summary: 'Unit test suite passed',
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
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

  const addTask = useCallback((title: string, status: TaskStatus = 'NEXT') => {
    if (!title.trim()) return;
    const newTask: Task = {
      id: 'task-' + Date.now(),
      dayPlanDate: getTodayDateStr(),
      title: title.trim(),
      status,
      displayOrder: 999,
      elapsedFocusSeconds: 0,
      createdAt: new Date().toISOString(),
    };
    setTasks((prev) => [...prev, newTask]);
    haptics.hapticPop(320);

    setTimeline((prev) => [
      {
        id: 'evt-' + Date.now(),
        dayPlanDate: getTodayDateStr(),
        taskId: newTask.id,
        eventType: 'TASK_START',
        summary: `Created task “${newTask.title}”`,
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

  const toggleExpanded = useCallback(() => {
    haptics.snapClick();
    setIsExpanded((prev) => !prev);
  }, []);

  const toggleAlwaysOnTop = useCallback(() => {
    setIsAlwaysOnTop((prev) => !prev);
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
    toggleMute,
    toggleTimer,
    resetTimer,
    handleIncomingIdeMessage,
  };
}
