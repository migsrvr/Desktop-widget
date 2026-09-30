# WorkPulse Implementation Plan

**Document**: `docs/superpowers/plans/2026-09-30-workpulse.md`  
**Feature**: WorkPulse Desktop Companion (Phase 1 & Phase 2 Core Architecture)  
**Lead Architect & PM**: Gemini 3.8 Flash  
**Worker / Slice Implementer**: Muse 1.3 (via OpenCode)  
**Date**: 2026-09-30  

---

## 1. Project Directory Structure

```
c:\Users\Miggy\Documents\Work Window Haptics\
├── docs\
│   └── superpowers\
│       ├── specs\
│       │   └── 2026-09-30-workpulse-design.md
│       └── plans\
│           └── 2026-09-30-workpulse.md
├── shared\
│   └── types\
│       └── events.ts              <-- Frozen IPC & WebSocket data contracts
├── src-tauri\
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── src\
│   │   ├── main.rs
│   │   ├── db.rs                  <-- SQLite schema & queries
│   │   ├── server.rs              <-- Tokio/Axum WebSocket & HTTP server
│   │   ├── tray.rs                <-- Windows System Tray handler
│   │   └── window.rs              <-- Frameless drag, snap & positioner
├── ui\
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   ├── src\
│   │   ├── index.css              <-- Acrylic glassmorphism & typography
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── audio\
│   │   │   └── haptics.ts         <-- Web Audio API micro-cue synthesizer
│   │   ├── components\
│   │   │   ├── CollapsedPill.tsx  <-- Draggable compact widget
│   │   │   ├── ExpandedPanel.tsx  <-- Flyout card with all sections
│   │   │   ├── TaskList.tsx       <-- Now / Next / Later / Done lists
│   │   │   ├── AiRunCard.tsx      <-- Dependable AI state & metrics
│   │   │   ├── FocusTimer.tsx     <-- Active task focus stopwatch/pomodoro
│   │   │   └── TimelineView.tsx   <-- Real-time audit trail
│   │   └── hooks\
│   │       ├── useWorkpulseState.ts
│   │       └── useWebSocketBridge.ts
└── ide-companion\
    ├── package.json
    ├── tsconfig.json
    └── src\
        └── extension.ts           <-- VS Code companion WebSocket client
```

---

## 2. Bite-Sized Implementation Tasks

### Milestone 1: Shared Protocol Contracts & Data Types
- **Task 1.1**: Define shared TypeScript interfaces in `shared/types/events.ts` for Task, AiRun, DayPlan, TimelineEvent, and WebSocket message envelopes.
- **Task 1.2**: Write test suite `shared/types/events.test.ts` to validate schema serialization and invariants (e.g. single `NOW` task validation, AI status machine transitions).

### Milestone 2: Frontend Desktop Widget & Audio Haptics
- **Task 2.1**: Initialize Vite React 19 + TypeScript frontend with Tailwind CSS and Lucide icons in `ui/`.
- **Task 2.2**: Implement `ui/src/audio/haptics.ts` synthesizer (pop, snap click, chime, success chime) with unit tests in `ui/src/audio/haptics.test.ts`.
- **Task 2.3**: Build `CollapsedPill.tsx` component with drag handling, AI breathing pulse ring, and quick stats badge.
- **Task 2.4**: Build `ExpandedPanel.tsx` with header, progress bar, `AiRunCard.tsx`, segmented `TaskList.tsx` (Now, Next, Later, Done), and `FocusTimer.tsx`.
- **Task 2.5**: Implement `useWorkpulseState.ts` providing state management, localStorage fallback, and WebSocket telemetry sync.

### Milestone 3: Tauri v2 Desktop Shell & Local Database
- **Task 3.1**: Scaffold Tauri v2 project structure with `src-tauri/Cargo.toml` and `tauri.conf.json` configured for frameless, transparent, always-on-top window with tray support.
- **Task 3.2**: Implement SQLite database module `src-tauri/src/db.rs` with embedded migrations for `day_plans`, `tasks`, `ai_runs`, and `timeline_events`.
- **Task 3.3**: Implement embedded Axum/Tokio WebSocket & HTTP server in `src-tauri/src/server.rs` running on `127.0.0.1:41789` for real-time bidirectional messaging.
- **Task 3.4**: Integrate system tray, window edge-snapping, and position memory in `src-tauri/src/window.rs` and `src-tauri/src/tray.rs`.

### Milestone 4: IDE Companion Extension (VS Code / Windsurf / Cursor)
- **Task 4.1**: Scaffold `ide-companion/` with `package.json` and `extension.ts`.
- **Task 4.2**: Implement WebSocket auto-reconnect client that discovers `ws://127.0.0.1:41789`.
- **Task 4.3**: Implement active document watcher, git commit listener, and test execution observer emitting telemetry events.
- **Task 4.4**: Implement AI agent adapter reporting `ai/run_started`, `ai/status_update`, `ai/waiting_input`, and `ai/run_finished`.

### Milestone 5: End-to-End Verification & Gating
- **Task 5.1**: Automated test pass (frontend tests, rust unit tests, IDE extension compilation).
- **Task 5.2**: Launch end-to-end integration and verify drag & drop, sound synthesis, state persistence, and live telemetry receipt.
