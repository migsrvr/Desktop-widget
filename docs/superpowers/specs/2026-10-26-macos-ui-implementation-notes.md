# SESSION implementation and portfolio handoff

The approved monochrome Figma direction is implemented in the React/Tauri app. Existing task/SQLite persistence, task timers, Spotify auth/playback, bridge and fleet internals remain. The new routed UI uses SessionBoard and SessionIsland. Legacy agent/file-update components remain in the repository for compatibility but are not shown in the new UI.

## Provider allowances

The board shows exactly Codex, Claude and Gemini through the native multi-window usage service. Codex uses its App Server; Claude Code and Antigravity use opt-in status-line exports with backup and restoration. The board ignores legacy `usage/allowance` WebSocket events. An IDE bridge connection does not establish quota availability. Missing, stale and expired values never become zero; stale readings cannot trigger current-usage alerts.

See [Real AI Usage setup and verification](../../REAL-AI-USAGE.md) for connection instructions, refresh behavior, privacy boundaries and remaining release gates. Live Codex readings were compared successfully on Windows. Claude/Antigravity account comparisons and macOS runtime validation are still pending. Browser/portfolio assets have no account integration.

## Desktop windows

The main webview owns all session state and the separate nonactivating `island` webview receives scoped snapshots and sends validated actions. The island sits below the menu bar using logical monitor work-area bounds, stays above ordinary windows, and expands without explicitly activating the app. The board keeps its dimensions. Explicit Open Board activates it. Browser preview uses the same UI components in one page.

The macOS config enables transparent custom chrome and app/DMG bundle targets. Spotify account auth now opens the system browser on macOS and Linux as well as Windows. Desktop-local music detection is still Windows-specific; macOS uses Spotify account connection. macOS builds/runtime behavior, signing and distribution require validation on a Mac. Custom window controls follow the approved monochrome artwork.

## Portfolio film

The 30-second film is an animated design walkthrough of the approved Figma screens, not a recording of verified macOS runtime behavior. It contains fictional task, track, and allowance data and labels it as a UI concept with sample data. The editable timeline is frame `37:242` in the existing Figma file. The exported MP4 and poster are under `artifacts/session-demo/`.
