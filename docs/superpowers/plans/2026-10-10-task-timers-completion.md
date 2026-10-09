# WorkPulse task timers and dated history — engineering completion

Implemented from Gemini planner session `7026cb82` and its
`task_timer_and_date_separation_plan.md` brief on 2026-10-10.

## Delivered

- Board and Focus/Dock transport RESET stops the timer and clears both session time and the active task's elapsed time.
- Tasks support 15m, 25m, 45m, and None presets; creation defaults to 25m. Existing task badges display elapsed time and expose duration editing and individual reset.
- Each tick advances the effective NOW task, including carried-over work. Reaching its target pauses focus, plays the alert chime, and records a take-a-break reminder.
- Board and Focus countdowns use the active task's target and elapsed time. The transport stepper updates the selected task's target.
- Elapsed task time saves every five seconds and on pause, task switch, reset, or completion. Task changes persist after React commits; per-task write ordering prevents stale saves after reset/deletion. Delayed hydration cannot overwrite intervening task changes.
- Previous tasks render under descending date headers, with counts, individual collapse/Clear controls, and whole-history collapse/Clear. History scrolls within the board.

## Ownership

- Coordinator: `ui/src/hooks/useWorkpulseState.ts`, `ui/src/App.tsx`, timer utility and tests, shared helper tests, component regression tests, Vitest shared-source alias, and this record.
- Frontend worker: `TaskList.tsx`, `TransportBar.tsx`, `FocusView.tsx`, `ExpandedPanel.tsx`, and `CurrentSessionBanner.tsx`.
- Independent reviewer checked timer boundaries, carried-over tasks, and persistence ordering; resulting fixes are included.
- Gemini's existing `shared/types/events.ts` changes and the unrelated `ui/font/OFL.txt` edit were preserved. No native database/schema changes, commits, or publishing.

## Validation

- `npx --workspace=ui tsc --noEmit`: passed.
- Vitest: 46 tests across eight files passed. Added coverage includes shared date/duration helpers, active task ticking, carried-over tasks, target boundaries, Board/Focus countdown consistency, reset visibility, and grouped history rendering.
- `npm run build:ui`: passed.
- Changed-code whitespace check: passed; the pre-existing font license edit was excluded.

The installed dependencies contain Windows native binaries. WSL checks used matching Linux binaries downloaded into `/tmp`, leaving repository manifests and lockfiles unchanged:

```bash
NODE_PATH=/tmp/workpulse-checks/node_modules \
ESBUILD_BINARY_PATH=/tmp/workpulse-checks/node_modules/@esbuild/linux-x64/bin/esbuild npm test

NODE_PATH=/tmp/workpulse-checks/node_modules \
ESBUILD_BINARY_PATH=/tmp/workpulse-build-checks/node_modules/@esbuild/linux-x64/bin/esbuild npm run build:ui
```

## Remaining verification and known existing issue

Native SQLite, audible haptics, window-close flushing, and interactive 420px layout need a live Windows/Tauri smoke test; unit/rendering checks do not exercise those integrations.

The supplied shared contract groups completion dates using UTC timestamp prefixes, while activeDate uses the local calendar. For example, October 10 at 00:30 in Singapore is stored as October 9 at 16:30Z and appears under Yesterday. Existing today/past filters and history-clearing logic share this mismatch. This was reported to Gemini; the supplied shared contract is preserved pending coordinated correction.
