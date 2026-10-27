# WorkPulse live fleet integration

Scope authorized by Gemini planner session `7026cb82` on 2026-10-11.
Architecture source: `fleet_telemetry_and_quota_monitor_plan.md` in the planner's project brain.

## Ownership

- Backend worker: `src-tauri/src/fleet_watcher.rs`, `src-tauri/src/main.rs`.
- Frontend worker: `StudioConsole.tsx`, `ExpandedPanel.tsx`, `useWorkpulseState.ts`, and fleet state/accounting helpers.
- Coordinator: `App.tsx`, stable WebSocket callback handling, integration, verification, and this record.
- Tester/reviewer: fleet component/contract tests and independent review after an implementation slot frees.
- External OpenCode worker: `QuotaMonitorCard.tsx`, `quotaCalculator.ts`, and their tests. Preserve these files and the planner's shared contracts.

## Decisions

- Agent Manager SQLite access is read-only and scoped to the configured project group. Database failures suppress heartbeats; a successful empty query represents a live empty fleet.
- `last_status_at` stores nanoseconds in the real database. Emit `lastStatusAt` as epoch milliseconds; it measures status age, not telemetry freshness.
- Fleet freshness uses one-second successful-read heartbeats and local receipt time. Long-running unchanged sessions remain live; stale data loses its working indicator.
- Quota usage is a local active-time estimate. Concurrent sessions from one provider accrue wall-clock time once, with independent provider buckets, five-hour window resets, and local daily rollover. The approved tool-based accounting assigns Antigravity sessions to Antigravity and both Codex and OpenCode sessions to OpenAI, regardless of model; other tools are excluded.
- Keep the WebSocket connected when render callbacks change, avoiding reconnection on each fleet heartbeat.
- Initial agent/timeline state must not fabricate a connected, working run before telemetry arrives.

## Delivered behavior

- Live working/standby counts, actual session chips, and session cards with IDs, models, status, and status age replace configured role placeholders. Unknown models/statuses remain visible without invented metadata.
- Read-only SQLite polling runs in `spawn_blocking` alongside the existing transcript watcher and broadcasts `fleet/status_update` over the existing Axum channel. It retries missing/locked databases without log spam or fabricated empty snapshots.
- Fleet updates do not reconnect the WebSocket on rerender. Stale telemetry disables activity indicators and stops quota accrual after the five-second freshness limit.
- The Board quota HUD shows `⚡ {usedHours}h / {maxHours}h` for the selected provider and opens the external quota card with provider selection, reset, and limit adjustment wired to persistent provider state. The flyout supports Escape and keyboard focus return.
- Provider usage is accumulated once per active provider, with no double counting concurrent Codex and OpenCode workers. Fixed-window boundaries and local midnight split elapsed usage correctly; offline/stale intervals are bounded. OpenCode/Muse sessions count toward the OpenAI estimate as required by the approved accounting contract.
- Removed fabricated initial WORKING/bridge-connected records. Real AiRun events still populate run goal/step/files/tests independently of the fleet.

## Configuration

- Optional `AGENT_MANAGER_DB_PATH` is tried first, followed by the native user's `.config/agent-manager/state.db` and Windows WSL UNC fallbacks (`wsl.localhost` and `wsl$`, Ubuntu, user miggy).
- `WORKPULSE_FLEET_GROUP` defaults to `Work Window Haptics`; an explicitly empty value includes all unarchived sessions. No database writes or schema changes.
- Quota uses `workpulse_quota_v1` localStorage, five-hour windows anchored at monitor initialization or manual reset, default five-hour compute limit, and default 24-hour daily cap. This is observed active time, not provider-reported remaining quota.

## Verification

- Full Vitest: 82 tests across 13 files passed, including live fleet/card rendering, contract serialization, provider concurrency, stale cutoff/recovery, local daily rollover, and the fixed-window boundary regression.
- UI TypeScript: passed with zero errors.
- UI production build: passed (76 modules).
- Native Windows Cargo: all eight fleet watcher tests passed, including successful full application test compilation. Tests cover group/archive filtering, nullable metadata, UnixNano conversion, JSON shape/UTC heartbeat, read-only access, missing paths, locks, and recovery.
- Read the real Agent Manager schema using SQLite read-only mode; no live session records were mutated.

The checks ran in `/tmp/workpulse-live-fleet` because the configured lowercase writable root resolves to a mixed-case read-only sandbox mount. Matching Linux binaries under `/tmp/workpulse-checks` and `/tmp/workpulse-build-checks` support the installed Windows dependency tree; UI dependencies were copied into staging to permit Vite's cache writes. Windows Cargo used the existing project native target cache and an offline manifest at the staged UNC path.

Production files appeared in the original project during integration and were compared byte-for-byte to the verified staging tree. Final synchronization preserves those changes, the planner's shared contracts, the external quota artifacts, and the unrelated font license edit. No commit, push, publishing, application exit, or live-session mutation was performed.

## Remaining practical limits

- A live Windows/Tauri smoke test is still needed for database-to-WebSocket-to-view behavior and interactive flyout controls. Unit/rendering tests and native compilation do not exercise the running desktop process.
- The external quota card supports reset and limit adjustment, but has no manual baseline or daily-cap UI. The baseline callback is implemented for future integration; the daily estimate is shown below the card.
- Usage across periods when WorkPulse is closed cannot be inferred from session status alone and is not backfilled.
