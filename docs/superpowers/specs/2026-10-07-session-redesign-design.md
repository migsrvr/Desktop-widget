# SESSION Desktop UI Redesign Specification

**Document**: `docs/superpowers/specs/2026-10-07-session-redesign-design.md`  
**Status**: Draft for Review  
**Author**: Gemini 3.8 Flash (Lead Architect & PM)  
**Date**: 2026-10-07  
**Target Platform**: Windows 11 / Windows 10 (Tauri v2 + React 19 + Vanilla CSS)

---

## 1. Overview & Vision

The objective is to redesign the existing WorkPulse desktop companion application into **SESSION: Migs's Personal Board**.

The visual and interaction redesign merges two distinct aesthetic concepts:
1. **Airport departure-board layout**: Aligned tabular rows, structured information architecture, dot-matrix countdown displays, and crisp status markers.
2. **Recording-studio console**: Three-channel hardware-inspired rack layout (Agent, Screen Operator, Audio/Spotify) with tactile transport controls (`START / PAUSE`, duration adjustment, `COMPLETE`, `OPEN IDE`).

This is a focused desktop UI redesign of the existing application. All underlying integrations—the Rust WebSocket bridge, live agent telemetry watchers, screen operator IPC, Spotify OAuth & Windows media controls, SQLite database, and sticky-magnet window behavior—remain fully functional with zero mock data.

---

## 2. Visual & Interaction Design System

### 2.1 Monochrome Color Palette
Color is used only for structure and brightness contrast, never decorative neon or colored glows:

| Token Name | Hex Code | Purpose |
| :--- | :--- | :--- |
| `--session-bg` | `#121212` | Window shell background |
| `--session-surface` | `#202020` | Console card and channel rack surface |
| `--session-surface-active` | `#2A2A2A` | Active task row, focused buttons, hover states |
| `--session-text-primary` | `#E7E7E7` | Primary headlines, task titles, active readout |
| `--session-text-secondary` | `#AAAAAA` | Column headers, secondary metadata, inactive labels |
| `--session-border` | `#424242` | Clean hairline dividers and panel borders |
| `--session-accent-white` | `#FFFFFF` | Active task marker line, countdown digits, live indicators |

### 2.2 Typography Roles
1. **Dot-Matrix Display Font**:
   - Bundled locally via `@font-face` (zero external network dependencies).
   - Applied to: `SESSION` wordmark, large focus countdown (`24:38`), and short status tags.
2. **Readable Monospace** (`JetBrains Mono`, `SF Mono`, `monospace`):
   - Applied to: Task board table rows, time/duration columns, timestamps, channel telemetry metrics, and file counts.
3. **System Sans-Serif** (`-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `Inter`, `sans-serif`):
   - Applied to: Transport buttons, descriptions, task input, modals, and settings.

### 2.3 Motion & Accessibility
- Brief, subtle state transitions (0.12s–0.18s) strictly tied to real user interactions or backend events.
- No continuous marquee animations, no flickering dot-matrix artifacts, and no simulated audio meters.
- Audio haptics remain optional with a hardware-style Mute/Sound toggle.

---

## 3. Screen Layout & Architecture

The Board layout directly realizes the user's specification:

```
WORKPULSE / SESSION                            17:35:19
CONTROL BOARD                              PIN   −  □  ×
───────────────────────────────────────────────────────

CURRENT SESSION                              IN FOCUS

REVISE THE WORKPULSE
INTERFACE                                      24:38

───────────────────────────────────────────────────────
NO.   TASK                         TIME     STATUS
01    Revise WorkPulse interface    30m      IN FOCUS  ◀
02    Connect agent telemetry      45m      QUEUED
03    Test compact layout           20m      QUEUED

+ Add task
───────────────────────────────────────────────────────

01 / AGENT         02 / SCREEN        03 / AUDIO
OpenCode           Screen operator   Spotify
Waiting            Monitoring        KODAK BLU

▯▯▯▯▯▯▯▯▯▯         Standby           Connected

───────────────────────────────────────────────────────
[ START / PAUSE ]    −  30 MIN  +    [ COMPLETE ]

BOARD   FOCUS   DOCK                           OPEN IDE
```

### 3.1 Header & Title Bar
- Left: `SESSION` wordmark + Subtitle `CONTROL BOARD` / `Migs's Personal Board`.
- Right: Real-time digital clock (`HH:MM:SS`) + Hardware window controls (`PIN`, `−`, `□`, `×`).
- Complete window dragging via `-webkit-app-region: drag` while preserving interactive controls.

### 3.2 Current Session Hero Display
- Top label row: `CURRENT SESSION` (left) and current state badge (right: `READY` | `IN FOCUS` | `PAUSED` | `COMPLETED`).
- Headline row: Multi-line prominent task title paired with a large dot-matrix countdown timer (`mm:ss`).
- Graduated progress meter: Subtly shows percentage completion of today's focus target.

### 3.3 Airport Task Departure Board
- Table header: `NO.   TASK                         TIME     STATUS`
- Rows rendered in monospace with tabular numbers:
  - Narrow solid white indicator marking the active `IN FOCUS` task.
  - Inline title wrapping for long task names without clipping.
  - Duration estimate / elapsed column.
  - Task status indicator (`IN FOCUS`, `QUEUED` / `NEXT`, `LATER`, `DONE`).
- Fast task addition row (`+ Add task`) with inline input.
- Collapsible section for completed tasks.

### 3.4 Studio Console (3-Channel Rack)
Three equal columns anchored side-by-side:
1. **Channel 01 / AGENT**:
   - Model name (e.g. `Gemini 3.8 Flash` or `OpenCode`).
   - Current status (`Waiting`, `Working`, `Idle`, `Error`).
   - Graduated step progress / file count readout (`▯▯▯▯▯▯▯▯▯▯` or `3 files`).
   - Click to inspect detail flyout (goals, tests, diff preview).
2. **Channel 02 / SCREEN**:
   - Channel header `02 / SCREEN`.
   - Operator state (`Monitoring`, `Operator`, `Standby`, `Paused`).
   - Current frame resolution / thumbnail preview on demand.
   - Quick capture action.
3. **Channel 03 / AUDIO**:
   - Channel header `03 / AUDIO`.
   - Current track title and artist from Spotify / Windows Media.
   - Connection state (`Connected`, `Offline`, `Playing`, `Paused`).
   - Play/Pause & track skip triggers.

### 3.5 Transport Controls & View Switcher
- Top strip:
  - `[ START / PAUSE ]` (Starts/pauses focus session).
  - `−  30 MIN  +` (Discrete session duration adjustor).
  - `[ COMPLETE ]` (Marks active task as done).
- Bottom strip:
  - Mode Switcher: `BOARD` · `FOCUS` · `DOCK`.
  - Right Action: `OPEN IDE` (Dispatches `widget/open_task_in_ide`).
- **Safety**: Focus timer controls are visually and logically separated from agent execution.

---

## 4. View Modes

1. **Board Mode** (Expanded view, ~420px wide):
   - Full airport departure table + 3-channel console + transport controls.
2. **Focus Mode** (Reduced distraction-free view, ~420x260px):
   - Current task title, large central dot-matrix countdown, minimal agent status dot, quick transport buttons, and a button to return to Board.
3. **Dock Mode** (Compact companion pill, ~345x48px):
   - Current task name, compact timer, agent status dot, and expand button.

All state (active task, remaining focus seconds, timer running state, agent and Spotify connections) persists seamlessly when toggling between view modes.

---

## 5. Verification Criteria

- Zero regression of existing integrations:
  - WebSocket telemetry from IDE bridge.
  - Screen operator IPC commands (`toggle_watching`, `capture_now`, `operator_approve`).
  - Spotify Web API and Windows hardware media controls.
  - Task creation, completion, deletion, and local storage persistence.
  - Window dragging, top-right magnetic dock, and pin/always-on-top.
- Bundled local fonts with zero external network request.
- Monochrome contrast verified for readability.
- Vitest test suite passes 100%.
- Frontend build succeeds cleanly.
