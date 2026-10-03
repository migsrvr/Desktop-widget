# WorkPulse Screen-Aware OpenClaw Operator — Design Specification

**Document**: `docs/superpowers/specs/2026-10-03-screen-operator-design.md`
**Status**: Approved for Build
**Date**: 2026-10-03
**Target**: Windows 11/10 (Tauri v2 + WebView2)
**Mode**: Full OpenClaw Operator + Cloud Vision API (cloud OK)

---

## 1. Overview & Goals

Give WorkPulse opt-in screen vision to help with task monitoring:

1. **On-demand + passive monitor**: capture active window (0.2–0.5 fps, event-triggered), infer `STUCK | ERROR | DONE | IDLE | PROGRESSING`.
2. **Honest task sync**: vision suggests `TASK_DONE`, `AI_WAITING`, focus nudges — never silently marks done. Emits `ai/vision_update` → widget + `timeline_events`.
3. **Full operator on approval**: OpenClaw sidecar sees screenshot + proposes `mouse_move | click | type | hotkey`. Executes only after explicit Approve (existing `WAITING_INPUT` amber chime path).
4. **AI/ML connected**: cloud vision (Gemini Flash default, OpenAI GPT-4o alt) with strict JSON contract; provider abstraction allows local VL later.

Non-goals v1: silent recording, autonomous clicking without approval, pixel persistence in DB, macOS/Linux.

## 2. Architecture

```
[Win Screen] --xcap active-window--> [screen.rs: capture+hash+dedupe]
     |                                     | JPEG70 + redact zones (local only)
     v                                     v
[screen-worker sidecar] --throttled--> [Cloud Vision API] --> strict JSON
     |                                       |
     +-- POST /api/ai/event ------------------+
     |                                       v
[OpenClaw bridge ws://127.0.0.1:41789/ws] <-> [server.rs broadcast]
     |                                       |
     +-- agent/action_proposed --> [OperatorCard Approve/Deny]
     +-- on Approve --> [enigo execute] --> audit log
```

### 2.1 Components

| Component | File | Responsibility |
|---|---|---|
| Screen capture | `src-tauri/src/screen.rs` (new) | `capture_active_window()`, hash dedupe, JPEG encode, redact |
| Operator input | `src-tauri/src/operator.rs` (new) | `enigo` gated execution, kill-switch, audit |
| HTTP+WS | `src-tauri/src/server.rs` (extend) | `POST /api/screen/capture`, `GET /api/screen/latest`, `POST /api/operator/propose|approve`, `POST /api/ai/event` (reuse) |
| DB | `src-tauri/src/db.rs` (extend) | 5 new tables (below), new timeline event types |
| IPC | `src-tauri/src/main.rs` (extend) | `get_screen_status`, `toggle_watching`, `capture_now`, `operator_approve`, `operator_deny` |
| Protocol | `shared/types/events.ts` (extend) | `screen/*`, `ai/vision_update`, `agent/*`, `widget/operator_task` |
| Vision relay | `screen-worker/` (new) | poll + event triggers, provider abstraction, mock mode for CI |
| OpenClaw bridge | `openclaw-bridge/` (new) | WS client, handshake `OpenClaw`, forwards run lifecycle + proposals |
| UI | `ui/src/components/OperatorCard.tsx` (new) | live thumb, Watching toggle, Approve/Deny, confidence |
| State | `ui/src/hooks/useWorkpulseState.ts` + `useOperator.ts` | vision + proposal state, haptics on WAITING |

### 2.2 Capture Pipeline (runtime)

1. **Capture**: `xcap` active window only. Skip if fullscreen RDP/bank heuristic or paused.
2. **Dedupe**: perceptual-hash (simple FNV/average-hash) compare; skip if identical to last within window.
3. **Preprocess**: downscale longest-edge 1280, redact user rects (black fill), JPEG q70 — all local.
4. **Infer**: sidecar sends `{b64, Now task title, active_file, last 5 timeline summaries}` with system prompt demanding `{state, confidence, summary, suggestedAction?}`.
5. **Fuse+Gate**: merge with `ai_runs.status` + `tasks.status`. `confidence<0.75` → log only. Else emit `ai/vision_update` → `ai/status_update` mapping + `timeline VISION_INFERENCE`.
6. **Act+Audit**: if `suggestedAction` needs input → `WAITING_INPUT` + `agentChime()` → user Approve → `enigo` → `ACTION_EXECUTED` timeline + `operator_actions EXECUTED`.

Throttling: 15–30s poll default + triggers (file-save, test-fail, idle>2min). No video. ~240 calls/hr worst-case; event-triggered cuts ~70%.

## 3. Data Models & ERD

Existing `day_plans/tasks/ai_runs/timeline_events/spotify_auth` unchanged.

```sql
CREATE TABLE IF NOT EXISTS screen_sessions (
  id TEXT PRIMARY KEY,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  ended_at DATETIME,
  mode TEXT NOT NULL CHECK(mode IN ('ON_DEMAND','MONITOR','OPERATOR')),
  consent_granted INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS screen_frames (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES screen_sessions(id) ON DELETE CASCADE,
  window_title TEXT, app_name TEXT,
  width INTEGER, height INTEGER, hash TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  -- no raw pixels: thumbnail stays in memory only
);
CREATE TABLE IF NOT EXISTS vision_inferences (
  id TEXT PRIMARY KEY,
  frame_id TEXT REFERENCES screen_frames(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'gemini' | 'openai' | 'mock'
  inferred_state TEXT NOT NULL, -- STUCK|ERROR|DONE|IDLE|PROGRESSING
  confidence REAL NOT NULL,
  summary TEXT,
  raw_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS operator_actions (
  id TEXT PRIMARY KEY,
  inference_id TEXT REFERENCES vision_inferences(id) ON DELETE SET NULL,
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  tool_name TEXT NOT NULL, -- mouse_move|click|type|hotkey
  args_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('PROPOSED','APPROVED','DENIED','EXECUTED','FAILED')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  executed_at DATETIME
);
CREATE TABLE IF NOT EXISTS ai_provider_config (
  id INTEGER PRIMARY KEY CHECK(id=1),
  provider TEXT NOT NULL, api_key_ref TEXT NOT NULL,
  model TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

ERD relations:

```
screen_sessions 1───* screen_frames 1───* vision_inferences 1───* operator_actions
tasks 1───* operator_actions (nullable task_id)
tasks 1───* ai_runs (existing) ; ai_runs 1───* timeline_events (existing)
timeline_events.event_type += SCREEN_OBSERVED | VISION_INFERENCE | ACTION_PROPOSED | ACTION_EXECUTED
```

## 4. Protocol Contracts (`shared/types/events.ts`)

```typescript
export type ScreenMode = 'ON_DEMAND' | 'MONITOR' | 'OPERATOR';
export type VisionState = 'STUCK' | 'ERROR' | 'DONE' | 'IDLE' | 'PROGRESSING';
export type OperatorTool = 'mouse_move' | 'click' | 'type' | 'hotkey';

export interface ScreenFrameMeta { frameId: string; sessionId: string; windowTitle?: string; appName?: string; width: number; height: number; hash: string; capturedAt: string; }
export interface VisionInference { inferenceId: string; frameId: string; provider: string; state: VisionState; confidence: number; summary: string; suggestedAction?: { tool: OperatorTool; args: Record<string, unknown>; rationale: string }; createdAt: string; }
export interface OperatorActionProposal { actionId: string; inferenceId?: string; taskId?: string; tool: OperatorTool; args: Record<string, unknown>; prompt: string; status: 'PROPOSED'|'APPROVED'|'DENIED'|'EXECUTED'|'FAILED'; createdAt: string; }

// WS additions:
| { type: 'screen/observed'; payload: ScreenFrameMeta }
| { type: 'ai/vision_update'; payload: VisionInference }
| { type: 'agent/action_proposed'; payload: OperatorActionProposal }
| { type: 'agent/action_decided'; payload: { actionId: string; decision: 'APPROVED'|'DENIED' } }
| { type: 'widget/operator_task'; payload: { taskId: string; goal: string; mode: ScreenMode } }
```

Invariants:
- `confidence` in [0,1]; `<0.75` never auto-proposes action.
- At most one `OPERATOR` session active; `toggle_watching(false)` ends session + clears in-memory thumbnail.
- `operator approve` requires action in `PROPOSED`; transitions atomic `PROPOSED→APPROVED→EXECUTED` or `→DENIED/FAILED`.
- No raw screenshot bytes in SQLite or WS broadcast by default (b64 only point-to-point `GET /api/screen/latest` + sidecar POST).

## 5. Security & Privacy

- Opt-in per session; tray dot + `Watching` pill indicator; kill-switch hotkey + `toggle_watching(false)`.
- Active-window-only; pause list (configurable substrings, defaults: banking, password managers, RDP).
- Redaction rects stored locally (`localStorage workpulse_redact_zones`), applied pre-upload.
- API key in OS keychain ref (`api_key_ref`), never in logs/DB plaintext; mock provider in CI so no spend.
- Every capture→inference→proposal→execution writes `timeline_events` audit with actor + timestamp.

## 6. UI

- `OperatorCard.tsx` between `AiRunCard` and `SpotifyPlayerCard` in `ExpandedPanel`: status dot, mode select, Capture-now, live thumb (object-url, no persist), confidence bar, Approve/Deny buttons.
- Collapsed pill: tiny `◉ Watching` badge when active.
- Settings: provider select, API key input, poll interval, pause list, redact hint.
- Haptics: `agentChime()` on proposal, `successChime()` on executed, `hapticPop(180)` on denied/failed.

## 7. Verification

- `npm test` (vitest): protocol validation, confidence gating, action state machine.
- `cargo check` + `cargo test` (db migration idempotency, screen hash dedupe unit).
- `npm run --workspace=ui build` passes.
- E2E manual: trigger mock vision `ERROR` → amber WAITING → Approve → mocked enigo log → timeline ACTION_EXECUTED.
