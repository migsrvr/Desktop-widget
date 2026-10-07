# SESSION Desktop UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign WorkPulse into SESSION: Migs's Personal Board, combining an airport departure-board layout above with a recording-studio console below, adhering strictly to the monochrome palette and local dot-matrix typography.

**Architecture:** React 19, TypeScript, Vanilla CSS design tokens, Tauri v2 desktop window integration, existing WebSocket and IPC integrations preserved with zero mock data.

**Spec:** `docs/superpowers/specs/2026-10-07-session-redesign-design.md`

## Global Constraints
- Strict Monochrome Palette: `#121212` background, `#202020` console surface, `#2A2A2A` active surface, `#E7E7E7` primary text, `#AAAAAA` secondary text, `#424242` hairline dividers, `#FFFFFF` marker/highlight.
- No emojis, neon accents, or simulated/fake telemetry meters.
- Local dot-matrix typography: 100% bundled locally with zero external network requests.
- Preserve 100% of working backend integrations (WebSocket bridge, screen operator IPC, Spotify media session).
- TDD required: write failing tests before implementing data models and utilities.

---

### Task 1: View Mode Data Contracts & Unit Tests

**Files:**
- Modify: `shared/types/events.ts`
- Test: `shared/types/events.test.ts`

**Interfaces:**
- Produces:
  - `ViewMode = 'BOARD' | 'FOCUS' | 'DOCK'`
  - `TaskDisplayState = 'READY' | 'IN_FOCUS' | 'PAUSED' | 'COMPLETED'`
  - Helper functions for formatted countdown and task number numbering (`formatTaskNumber(index: number): string`)

- [ ] **Step 1: Write failing unit tests in `shared/types/events.test.ts` for view modes and airport numbering**
- [ ] **Step 2: Run `npm test` to verify tests fail**
- [ ] **Step 3: Implement types and helpers in `shared/types/events.ts`**
- [ ] **Step 4: Run `npm test` and verify tests pass**

---

### Task 2: Monochrome Design Tokens & Local Dot-Matrix Typography System

**Files:**
- Create: `ui/src/assets/fonts/dot-matrix.css` (local dot-matrix font definition)
- Modify: `ui/src/index.css`
- Modify: `ui/index.html`

**Deliverables:**
- Define CSS custom properties for palette tokens (`--session-bg`, `--session-surface`, `--session-surface-active`, `--session-text-primary`, `--session-text-secondary`, `--session-border`, `--session-accent-white`).
- Embed local dot-matrix display font family (`'DotMatrix'`, `'Silkscreen'`, or crisp vector dot-matrix font).
- Style departure board table rows, active white marker, hardware channel rails, and tactile transport buttons.
- Remove remote Google Fonts link in `ui/index.html` to eliminate external network dependencies.

- [ ] **Step 1: Set up local dot-matrix CSS font in `ui/src/assets/fonts/`**
- [ ] **Step 2: Update `ui/src/index.css` with the strict monochrome tokens and button/table classes**
- [ ] **Step 3: Remove remote Google Fonts from `ui/index.html`**
- [ ] **Step 4: Run `npm run build:ui` to confirm asset bundling succeeds**

---

### Task 3: Current Session Hero Banner with Dot-Matrix Countdown

**Files:**
- Create: `ui/src/components/CurrentSessionBanner.tsx`
- Modify: `ui/src/components/FocusTimer.tsx`

**Deliverables:**
- Layout matching user ASCII mockup:
  - Header: `CURRENT SESSION` (left) ... `IN FOCUS` (right status badge)
  - Hero: Big multi-line task title (left) ... large dot-matrix countdown e.g. `24:38` (right)
  - Small graduated progress scale: `[▮▮▮▯▯▯▯▯▯▯] 30%`
- Preserves focus timer start/pause/reset callbacks.

- [ ] **Step 1: Implement `CurrentSessionBanner.tsx` with dot-matrix countdown and graduated scale**
- [ ] **Step 2: Verify component renders active task title or "NO ACTIVE SESSION" when idle**
- [ ] **Step 3: Run `npm run build:ui` to ensure no typing or lint errors**

---

### Task 4: Airport Task Departure Board Table

**Files:**
- Modify: `ui/src/components/TaskList.tsx`

**Deliverables:**
- Aligned columns: `NO.   TASK                         TIME     STATUS`
- Monospace formatted row numbering (`01`, `02`, `03`).
- Narrow solid-white marker on the active `IN FOCUS` row.
- Inline title text wrapping for long task names without clipping.
- Quick `+ Add task` inline action.
- Collapsible section for completed tasks.

- [ ] **Step 1: Re-structure `TaskList.tsx` into the tabular departure board format**
- [ ] **Step 2: Add narrow white marker on active row and inline wrap**
- [ ] **Step 3: Verify task selection, status toggling, and deletion remain intact**
- [ ] **Step 4: Run `npm test` and `npm run build:ui`**

---

### Task 5: Studio Console 3-Channel Rack

**Files:**
- Create: `ui/src/components/StudioConsole.tsx`
- Modify: `ui/src/components/AiRunCard.tsx`
- Modify: `ui/src/components/OperatorCard.tsx`
- Modify: `ui/src/components/SpotifyPlayerCard.tsx`

**Deliverables:**
- Three side-by-side hardware-style channels:
  - `01 / AGENT`: Model name, status (`Waiting`, `Working`, `Idle`), graduated progress/files modified count, expandable detail drawer.
  - `02 / SCREEN`: Screen operator state (`Monitoring`, `Operator`, `Standby`), frame info, thumbnail trigger.
  - `03 / AUDIO`: Spotify track title, artist, playback controls (`Play/Pause`, `Skip`), connection state.
- Retain all real backend IPC and WebSocket listeners.

- [ ] **Step 1: Build `StudioConsole.tsx` assembling the 3 hardware-style channels side-by-side**
- [ ] **Step 2: Wire actual telemetry, screen operator, and Spotify state into each respective channel**
- [ ] **Step 3: Verify clean fallback for offline / waiting states**
- [ ] **Step 4: Run `npm run build:ui`**

---

### Task 6: Studio Transport Controls & View Mode Hook Extension

**Files:**
- Create: `ui/src/components/TransportBar.tsx`
- Modify: `ui/src/hooks/useWorkpulseState.ts`

**Deliverables:**
- Implement transport control strip:
  - Top row: `[ START / PAUSE ]    −  30 MIN  +    [ COMPLETE ]`
  - Bottom row: `BOARD   FOCUS   DOCK                           OPEN IDE`
- Add `viewMode` state (`'BOARD' | 'FOCUS' | 'DOCK'`) in `useWorkpulseState.ts`.
- Adjust window dimensions dynamically based on active `viewMode` (Board: 420x640, Focus: 420x260, Dock: 345x48).
- Ensure focus controls are visually and logically separated from agent execution.

- [ ] **Step 1: Add `viewMode` state and mode switching logic to `useWorkpulseState.ts`**
- [ ] **Step 2: Implement `TransportBar.tsx` with tactile monochrome buttons**
- [ ] **Step 3: Connect `onOpenIde`, `onToggleTimer`, `onAdjustMinutes`, `onCompleteActiveTask`**
- [ ] **Step 4: Run `npm run build:ui`**

---

### Task 7: View Modes Assembly & Title Bar

**Files:**
- Create: `ui/src/components/FocusView.tsx` (Focus view mode)
- Modify: `ui/src/components/CollapsedPill.tsx` (Dock view mode)
- Modify: `ui/src/components/ExpandedPanel.tsx` (Board view mode)
- Modify: `ui/src/App.tsx`

**Deliverables:**
- Title bar: `SESSION` / `CONTROL BOARD` (left), real-time clock `HH:MM:SS` (right), hardware buttons (`PIN`, `−`, `□`, `×`).
- Board view: Complete departure board + studio console + transport bar.
- Focus view: Distraction-free big countdown + active task + minimal agent badge + transport bar.
- Dock view: Compact hardware companion bar with task snippet, small timer, and expand trigger.
- Seamless state preservation across view transitions.

- [ ] **Step 1: Create `FocusView.tsx` with large dot-matrix countdown and transport bar**
- [ ] **Step 2: Restyle `CollapsedPill.tsx` as the Dock mode**
- [ ] **Step 3: Update `ExpandedPanel.tsx` and `App.tsx` with title bar and view mode router**
- [ ] **Step 4: Verify window dragging and non-drag interactive control separation**
- [ ] **Step 5: Run `npm run build:ui`**

---

### Task 8: Verification & Regression Testing

**Files:**
- All affected files

**Deliverables:**
- Vitest tests passing (`npm test`).
- Type check and production build (`npm run build:ui`).
- Manual verification of window resizing, magnet docking, pin toggle, task CRUD, and integration telemetry.

- [ ] **Step 1: Run full test suite with `npm test`**
- [ ] **Step 2: Run full build check with `npm run build:ui`**
- [ ] **Step 3: Verify all view modes and interactions**
- [ ] **Step 4: Review against all user guardrails and definition of done**
