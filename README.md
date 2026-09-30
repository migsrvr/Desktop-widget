# WorkPulse — Windows Desktop Workload Companion & AI Monitor

WorkPulse is a high-performance Windows desktop companion app that bridges your daily task workflow, focus sessions, and live IDE / AI agent telemetry into an ambient, draggable, always-on-top desktop pill that expands into a full workload command center.

---

## 🌟 Key Features

1. **Ambient Draggable Desktop Companion**:
   - **Collapsed State**: Unobtrusive floating pill or circle showing active task, live AI breathing ring (Working, Waiting for approval, Done, Error), today's completion counter (e.g. `3/5`), and live focus timer.
   - **Expanded State**: Windows acrylic glassmorphism card (`360px × 540px`) with daily progress bar, dependable AI agent run telemetry, active focus stopwatch, segmented workload (`Now`, `Next`, `Later`, `Done`), real-time activity timeline, and quick IDE bridge actions.
2. **Dependable AI Agent Tracking**:
   - Honest state machine (`Queued`, `Planning`, `Working`, `Running Tools`, `Waiting for Input`, `Completed`, `Failed`, `Cancelled`).
   - Discretized step progress only when total steps are known — no deceptive artificial percentage bars.
   - Live elapsed timer, files modified counter, and automated test result indicators.
3. **Web Audio Haptics Engine ("Work Window Haptics")**:
   - Synthesizes tactile, zero-latency micro-sounds with the Web Audio API without external audio files.
   - Micro-pops on task completion, tactile ticks on screen edge snaps and mode toggles, and dual-tone alert chimes when the AI requests approval.
4. **Embedded Local Bridge (`127.0.0.1:41789`)**:
   - Embedded Tokio/Axum WebSocket and HTTP server running in the Rust core.
   - VS Code / Windsurf / Cursor companion extension automatically pairs and streams file activity, test runs, git commits, and AI lifecycle events.
5. **100% Local & Private**:
   - SQLite relational storage. No cloud accounts, external databases, or third-party servers required.

---

## 📁 Repository Structure

```
├── docs/
│   └── superpowers/
│       ├── specs/
│       │   └── 2026-09-30-workpulse-design.md     <-- Architecture & UI design spec
│       └── plans/
│           └── 2026-09-30-workpulse.md            <-- Phased engineering plan
├── shared/
│   └── types/
│       ├── events.ts                             <-- Shared TypeScript protocol & invariants
│       └── events.test.ts                        <-- Vitest unit tests
├── ui/                                           <-- React 19 + TypeScript + Acrylic UI
│   ├── src/
│   │   ├── audio/haptics.ts                      <-- Web Audio API micro-cue engine
│   │   ├── components/
│   │   │   ├── CollapsedPill.tsx                 <-- Draggable compact widget
│   │   │   ├── ExpandedPanel.tsx                 <-- Full flyout command card
│   │   │   ├── AiRunCard.tsx                     <-- Honest AI state & metrics
│   │   │   ├── TaskList.tsx                      <-- Now / Next / Later / Done lists
│   │   │   ├── FocusTimer.tsx                    <-- Active focus stopwatch
│   │   │   └── TimelineView.tsx                  <-- Chronological audit trail
│   │   └── hooks/
│   │       ├── useWorkpulseState.ts              <-- Persistence & state management
│   │       └── useWebSocketBridge.ts             <-- Auto-reconnecting WebSocket hook
├── src-tauri/                                    <-- Tauri v2 Rust Shell
│   ├── src/
│   │   ├── main.rs                               <-- Windows System Tray & IPC
│   │   ├── db.rs                                 <-- SQLite database engine
│   │   └── server.rs                             <-- Tokio/Axum WebSocket server (41789)
└── ide-companion/                                <-- VS Code / Cursor companion extension
    └── src/
        └── extension.ts                          <-- Workspace & AI agent event emitter
```

---

## 🚀 Quick Start

### 1. Run the Web Companion Interface (Browser Preview)
```bash
npm run dev:ui
```
Open `http://localhost:5173` to test the floating widget with the interactive **Test AI Events** developer simulator.

### 2. Run the Desktop Widget (Tauri v2)
```bash
npm run tauri dev
```

### 3. Run the Automated Test Suite
```bash
npm test
```

### 4. Build the VS Code Companion Extension
```bash
cd ide-companion
npm run compile
```
