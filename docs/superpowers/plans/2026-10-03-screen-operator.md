# WorkPulse Screen Operator Implementation Plan

**Document**: `docs/superpowers/plans/2026-10-03-screen-operator.md`
**Spec**: `docs/superpowers/specs/2026-10-03-screen-operator-design.md`
**Date**: 2026-10-03
**Mode**: Dual-model (Gemini PM + Muse 1.3 worker), TDD red-green-refactor per slice

---

## File-ownership matrix

| Task | Files (only these) | Tests |
|---|---|---|
| M1 contracts | `shared/types/events.ts`, `shared/types/events.test.ts` | vitest protocol suite |
| M2 Rust core | `src-tauri/Cargo.toml`, `src-tauri/src/screen.rs`, `src-tauri/src/operator.rs`, `src-tauri/src/db.rs`, `src-tauri/src/server.rs`, `src-tauri/src/main.rs` | `cargo check`, `cargo test` |
| M3 vision relay | `screen-worker/package.json`, `screen-worker/src/index.js`, `screen-worker/src/vision.js`, `screen-worker/README.md` | node `--test` + mock mode |
| M4 OpenClaw bridge | `openclaw-bridge/package.json`, `openclaw-bridge/src/index.js`, `openclaw-bridge/README.md` | node `--test`, WS loopback |
| M5 UI | `ui/src/components/OperatorCard.tsx`, `ui/src/hooks/useOperator.ts`, `ui/src/hooks/useWorkpulseState.ts`, `ui/src/components/ExpandedPanel.tsx`, `ui/src/components/CollapsedPill.tsx`, `ui/src/App.tsx` | vitest + `tsc` + vite build |
| M6 verify | all | `npm test`, `cargo check`, `ui build` |

## M1 — Shared protocol contracts + tests
- Add `ScreenMode`, `VisionState`, `OperatorTool`, `ScreenFrameMeta`, `VisionInference`, `OperatorActionProposal` + 5 WS message variants + `TimelineEventType` additions (`SCREEN_OBSERVED`, `VISION_INFERENCE`, `ACTION_PROPOSED`, `ACTION_EXECUTED`).
- Helpers: `isVisionConfident(inf, threshold=0.75)`, `validateOperatorAction(tool, args)`, `canApproveAction(status)`, `mapVisionToAiStatus(state)`.
- Tests first: confidence gating, tool validation (reject unknown tool, reject empty type text), approve state machine, vision→AI mapping, serialization round-trip.

## M2 — Rust screen + operator + DB + server + IPC
- `screen.rs`: `ScreenManager { watching, mode, last_hash, session_id }`, `capture_active_window()` via `xcap` (fallback: graceful `capture_unavailable` error in headless CI), average-hash dedupe, JPEG via `image`, `redact_zones` black-fill pre-encode. Unit: hash stable on same bytes, differs on change.
- `operator.rs`: `OperatorGate { enabled }`, `validate_tool()` mirror of TS, `execute()` stub that logs + returns ok in v1 (real `enigo` behind `OPERATOR_LIVE=1` env to keep CI safe). Default `enabled=false`.
- `db.rs`: 5 tables migration (idempotent `CREATE TABLE IF NOT EXISTS`), helpers `create_screen_session/end_session/insert_frame/insert_inference/propose_action/decide_action`.
- `server.rs`: `POST /api/screen/capture`, `GET /api/screen/latest` (in-memory thumb), `GET /api/screen/status`, `POST /api/operator/propose`, `POST /api/operator/approve|deny`. Broadcast `screen/observed`, `agent/action_proposed`.
- `main.rs`: IPC `get_screen_status`, `toggle_watching(mode)`, `capture_now`, `operator_approve`, `operator_deny`.

## M3 — screen-worker sidecar (cloud vision relay)
- `screen-worker/src/vision.js`: provider abstraction `{gemini, openai, mock}`, strict JSON prompt builder, `parseVisionResponse()` with confidence clamp + state whitelist.
- `screen-worker/src/index.js`: poll loop (env `POLL_MS=15000`), event triggers, `GET /api/screen/latest` → provider → `POST /api/ai/event {ai/vision_update}`. Mock mode when no key: cycles PROGRESSING mock, zero spend.
- README: `GEMINI_API_KEY` / `OPENAI_API_KEY`, `PROVIDER=mock|gemini|openai`.

## M4 — OpenClaw operator bridge
- `openclaw-bridge/src/index.js`: WS client to `41789`, handshake `{ideName:'OpenClaw'}`, listens `widget/operator_task` + `screen/observed`, emits `ai/run_started|status_update|waiting_input|run_finished` + `agent/action_proposed`. Approve path listens `agent/action_decided` → `POST /api/operator/approve`.
- Works standalone: `node src/index.js --goal "..."` smoke test without real OpenClaw.

## M5 — UI OperatorCard + state
- `useOperator.ts`: `watching`, `mode`, `lastFrame`, `inference`, `proposal`, actions `toggleWatching/captureNow/approve/deny`, WS handlers for `screen/observed|ai/vision_update|agent/action_proposed`.
- `OperatorCard.tsx`: monotone card, mode select, Watching toggle, Capture, thumb, confidence bar, summary, Approve/Deny. No raw b64 persisted.
- Wire into `ExpandedPanel` (between AI + Spotify), `CollapsedPill` badge, `App.tsx` sim buttons (mock vision ERROR → approval flow testable without backend).
- Extend `useWorkpulseState.handleIncomingIdeMessage` for 4 new event types → timeline + haptics.

## M6 — Verification gates
- `npm test` (root vitest, must stay green), `cargo check` (+ `cargo test` if toolchain present), `npm run --workspace=ui build`.
- Manual E2E checklist in spec §7.

## Risks
- `xcap/enigo` native build weight on Windows → mitigated by graceful fallback + `OPERATOR_LIVE` gate.
- Vision spend → mock default, explicit key required for live.
