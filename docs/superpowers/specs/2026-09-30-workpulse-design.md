# WorkPulse Design Specification

**Document**: `docs/superpowers/specs/2026-09-30-workpulse-design.md`  
**Status**: Approved  
**Author**: Gemini 3.8 Flash (Lead Architect & PM)  
**Date**: 2026-09-30  
**Target Platform**: Windows 11 / Windows 10 (WebView2)

---

## 1. Product Overview & Goals

**WorkPulse** is a lightweight, always-on-top, draggable desktop companion widget and system tray app for developers. It bridges task planning, focus tracking, and live IDE/AI agent telemetry into an ambient, unobtrusive floating pill that expands into a rich workload panel on demand.

### Key Value Propositions
1. **Ambient Telemetry**: Monitor AI agent execution (steps, elapsed time, files modified, tool approvals) without needing the IDE window visible or alt-tabbing.
2. **Honest AI Progress**: Avoid deceptive percentage progress bars; expose verified agent states (`Queued`, `Planning`, `Working`, `Running Tools`, `Waiting for Input`, `Completed`, `Failed`, `Cancelled`).
3. **Daily Workload Focus**: Structure work into `Now` (single active task), `Next`, `Later`, and `Done`, with daily rollover.
4. **Sensory Feedback ("Work Window Haptics")**: Synthesize subtle, elegant audio/micro-haptics (edge snap clicks, task complete pops, AI alert chimes) using the Web Audio API.
5. **Private & Fast**: 100% local execution using Tauri v2, SQLite, and a localhost WebSocket server (`ws://127.0.0.1:41789`). No external cloud dependencies.

---

## 2. Architecture & Tech Stack

### 2.1 Technology Stack
- **Desktop Shell**: Tauri v2 (`src-tauri/`) with Rust backend.
  - Transparent, frameless window with custom drag regions.
  - Screen edge snapping with magnetic damping.
  - System Tray with icon, context menu, and quick toggle.
  - `tauri-plugin-autostart` and `tauri-plugin-positioner` or custom multi-monitor coordinate clamp.
- **Embedded Local Server**: Embedded Axum/Tokio WebSocket and HTTP server running inside the Tauri Rust core at port `41789`.
- **Database**: SQLite via `rusqlite` with schema migrations embedded in the binary.
- **Desktop UI**: React 19 + TypeScript + Vite + Tailwind CSS / Vanilla CSS.
  - Dark Acrylic glassmorphism (`backdrop-filter: blur(24px)`).
  - Web Audio API haptics synthesizer.
- **IDE Companion Extension**: VS Code extension (`ide-companion/`) communicating over WebSocket to `ws://127.0.0.1:41789`.

---

## 3. Domain Model & Schemas

### 3.1 SQLite Database Schema

```sql
CREATE TABLE IF NOT EXISTS day_plans (
    date TEXT PRIMARY KEY, -- 'YYYY-MM-DD'
    total_focus_seconds INTEGER DEFAULT 0,
    suggested_first_task TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    day_plan_date TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('NOW', 'NEXT', 'LATER', 'DONE')),
    display_order INTEGER NOT NULL DEFAULT 0,
    estimated_minutes INTEGER DEFAULT 0,
    elapsed_focus_seconds INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY(day_plan_date) REFERENCES day_plans(date) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ai_runs (
    id TEXT PRIMARY KEY,
    task_id TEXT,
    agent_name TEXT NOT NULL DEFAULT 'AI Agent',
    status TEXT NOT NULL CHECK (status IN ('QUEUED', 'PLANNING', 'WORKING', 'RUNNING_TOOLS', 'WAITING_INPUT', 'COMPLETED', 'FAILED', 'CANCELLED')),
    current_step_description TEXT,
    current_step INTEGER,
    total_steps INTEGER,
    files_modified_count INTEGER DEFAULT 0,
    test_status TEXT DEFAULT 'NOT_RUN' CHECK (test_status IN ('NOT_RUN', 'RUNNING', 'PASSED', 'FAILED')),
    summary TEXT,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS timeline_events (
    id TEXT PRIMARY KEY,
    day_plan_date TEXT NOT NULL,
    task_id TEXT,
    ai_run_id TEXT,
    event_type TEXT NOT NULL,
    summary TEXT NOT NULL,
    metadata_json TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(day_plan_date) REFERENCES day_plans(date) ON DELETE CASCADE,
    FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE SET NULL,
    FOREIGN KEY(ai_run_id) REFERENCES ai_runs(id) ON DELETE SET NULL
);
```

### 3.2 WebSocket Protocol Contracts (`127.0.0.1:41789`)

#### Messages from IDE Extension -> WorkPulse
```typescript
export type IdeEvent =
  | { type: 'ide/handshake'; payload: { ideName: string; version: string; workspaceRoot: string } }
  | { type: 'ide/active_file'; payload: { filePath: string; languageId: string } }
  | { type: 'ai/run_started'; payload: { runId: string; taskId?: string; agentName: string; goal: string } }
  | { type: 'ai/status_update'; payload: { runId: string; status: AiRunStatus; stepDescription?: string; currentStep?: number; totalSteps?: number } }
  | { type: 'ai/waiting_input'; payload: { runId: string; prompt: string; toolName?: string } }
  | { type: 'ai/files_changed'; payload: { runId: string; filePaths: string[] } }
  | { type: 'ai/tests_result'; payload: { runId: string; status: 'RUNNING' | 'PASSED' | 'FAILED'; summary?: string } }
  | { type: 'ai/run_finished'; payload: { runId: string; status: 'COMPLETED' | 'FAILED' | 'CANCELLED'; summary?: string } }
  | { type: 'git/commit_created'; payload: { hash: string; message: string; filesChanged: number } };
```

#### Messages from WorkPulse -> IDE Extension
```typescript
export type WidgetCommand =
  | { type: 'widget/open_task_in_ide'; payload: { taskId: string; taskTitle: string } }
  | { type: 'widget/ping'; payload: { timestamp: number } };
```

---

## 4. UI/UX & Sensory Specification

### 4.1 Visual Theme
- **Background**: Deep obsidian slate (`rgba(15, 18, 26, 0.82)`) with Windows Acrylic blur (`backdrop-filter: blur(28px) saturate(180%)`).
- **Borders & Highlights**: 1px high-precision border with subtle gradient glow (`linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.03))`).
- **Typography**: Inter / Outfit modern sans-serif typography with tabular numbers for timers.
- **AI Status Colors**:
  - `WORKING` / `PLANNING`: Electric Cyan (`#06b6d4`) with breathing ring animation.
  - `RUNNING_TOOLS`: Indigo / Violet (`#8b5cf6`) with pulse.
  - `WAITING_INPUT`: Amber / Gold (`#f59e0b`) with urgent strobe badge.
  - `COMPLETED`: Emerald (`#10b981`).
  - `FAILED`: Coral / Crimson (`#ef4444`).

### 4.2 Web Audio Haptics Engine ("Work Window Haptics")
Synthesizes crisp, zero-latency micro-sounds without external `.mp3`/`.wav` assets using Web Audio API oscillators and gain envelopes:
1. `hapticPop(frequency, duration)`: Crisp 35ms sine/triangle burst when checking off a task or moving an item.
2. `snapClick()`: 15ms high-pass click when widget magnetically latches to a display boundary.
3. `agentChime()`: Gentle two-tone harmonic chime when AI requests user approval.
4. `successChime()`: Ascending 3-chord sequence when an AI run completes successfully.

---

## 5. Phased Roadmap

- **Phase 1**: Desktop Widget Core (Tauri v2 + React 19 UI, Frameless Draggable Window, Snap Engine, SQLite Storage, Focus Timer, Web Audio Haptics, Local Embedded WebSocket/HTTP Server).
- **Phase 2**: IDE Companion Bridge (VS Code extension with automatic discovery, heartbeat, active file tracking, and git watcher).
- **Phase 3**: AI Agent Lifecycle Tracking (Adapters for official agent APIs, terminal command watchers, and git/test state fallback detection).
- **Phase 4**: Productivity Intelligence (End-of-day summary generator, morning task rollover, weekly velocity charts).
