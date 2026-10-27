# SESSION macOS UI implementation plan

**Goal:** Implement the approved Figma direction in the existing app: monochrome board, task and focus priority, a top-center companion island, verified provider allowances, and Spotify.

**Approval:** The user approved implementation of the revised Figma file on 26 October 2026. No additional design approval is required.

**Architecture:** Keep the existing task/SQLite/Spotify state owner. The board and island share this owner; the native island is a separate, nonactivating floating webview, synchronized through scoped Tauri events. Browser preview uses the same components in one surface. Retain existing bridge and fleet internals without exposing their file/activity feeds. Add an explicit provider allowance message contract; absent, expired, or disconnected readings render unavailable rather than estimated quota.

**Stack:** React 19, TypeScript, CSS, Lucide, Tauri 2/Rust. System typography on macOS, monochrome tokens, existing SQLite persistence and Spotify OAuth.

**Reference:** Figma m4repQN9EdKQgGPtJlwk9v; Today 10:27, Usage 10:299, island 10:236/10:249/10:280, music 26:329.

## Constraints

- Preserve all pre-existing edits and existing task data. Do not overwrite the user's executable.
- Provider names are exactly Codex, Claude, Gemini. No fabricated percentages, costs, or file updates.
- Black, gray, white throughout, including music artwork, setup, errors, focus, and selection.
- Timer and task state survive board/island transitions. Native island respects monitor work area, scale, and menu bar.
- macOS runtime validation requires a Mac; record the limitation, validate available Windows/native builds locally.

## Implementation slices and file ownership

1. **Allowance and focus contracts** — shared/types/events.ts; ui/src/utils/providerUsage.ts; ui/src/utils/sessionView.ts. Add failing tests for unknown/invalid quota, expired and stale readings, reset labels, task filtering, and countdown semantics; implement and pass.
2. **Board and music** — ui/src/components/SessionBoard.tsx, ProviderUsage.tsx, SessionMusic.tsx, SpotifySetupModal.tsx; ui/src/index.css. Replace the routed old shell with approved regions, functional navigation/search/task editing, settings, compact and expanded Spotify. Preserve integration hooks.
3. **Island and native shell** — ui/src/components/SessionIsland.tsx, hooks/useIslandBridge.ts, utils/islandProtocol.ts, utils/windowGeometry.ts, App.tsx; src-tauri/src/island.rs, main.rs, capabilities/default.json, tauri.macos.conf.json. Test command validation and work-area geometry first. Add separate hidden native island, scoped state/commands, passive expansion, explicit board activation, native controls and Mac OAuth browser opening.
4. **Verification and handoff** — run full Vitest suite, TypeScript/Vite build, cargo check/test where available. Inspect actual board/usage/music/island and responsive states in browser in one batch, repair defects, confirm once. Update PRODUCT.md and record allowance bridge contract and platform limitations.

## Validation

Baseline: 13 files / 82 Vitest tests passed before implementation. Final validation must exercise real task creation/status/timer controls, keyboard navigation, usage unavailable states, music setup, and island expansion without resetting task timers. No CSS mirror tests. Keep legacy integration tests passing.
