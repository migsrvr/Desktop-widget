# Real AI Usage implementation plan

**Approval:** The user explicitly approved implementation of the provider-by-provider plan on 26 October 2026.

**Goal:** Genuine Codex, Claude Code, and Gemini/Antigravity allowance readings, with independent provider states and multiple quota windows.

**Architecture:** A native Rust usage service owns sanitized snapshots and publishes scoped Tauri events. Codex uses a managed App Server stdio connection. Claude Code and Antigravity use opt-in status-line exporters through the desktop executable's headless mode. Exporters retain only quota fields in atomic user-local caches. The board and island consume the same native readings; the general WebSocket bridge is not a quota authority.

**Constraints:** Black/gray/white UI. One account per provider. No cost tracking, inferred quotas, token harvesting, agent prompts, automatic purchases, public-web account integration, or unrelated changes. Existing working-tree edits and executable must be preserved. macOS runtime readiness requires macOS verification.

## Implementation order and ownership

1. Shared types and tests: multi-window snapshots, source/connection states, freshness, compact selection, unknown values. `shared/types/events.ts`, `ui/src/utils/usageState.ts`, and focused tests.
2. Native foundation and Codex: `src-tauri/src/usage/` holds normalization, local cache/configuration, service, and managed stdio client. Wire native commands/setup/shutdown in `main.rs`. Test sanitization and protocol boundaries before implementation; verify live read-only Codex readings where authentication permits.
3. Exporter and opt-in configuration: headless `--usage-export claude|antigravity`, atomic cache writes, concurrency control, backup/restore and existing-command forwarding. Test against temporary user directories, never real settings during automated tests.
4. UI: `useProviderUsage`, multi-window ProviderUsage, provider connect/refresh/disconnect setup, source and last-reading labels. Update App/island snapshots to use per-provider state rather than IDE connectivity. Retain existing task/Spotify functionality.
5. Verification: Vitest, production build, Rust tests/checks, headless integration tests, real read-only Codex comparison, UI inspection when available. Document unsupported/missing CLIs and unverified platforms without claiming full live readiness.

## Frozen behavior

- A snapshot contains provider, source, state, windows, optional plan, last-received timestamp, and a sanitized explanation.
- Windows contain stable source IDs, labels, nullable used percentages, nullable absolute remaining amounts/units, and nullable resets.
- Freshness cutoff is 15 minutes. Expired windows do not become a false zero. Cache polling never renews timestamps. Identical status-line exports do not imply an independent account refresh.
- Compact UI selects the valid percentage window with the least remaining allowance. Absolute-only windows remain separate.
- Codex reads on startup/connect/resume/manual refresh, listens for notifications, and refreshes at 60-second intervals with bounded retry backoff.
- Status-line setup is an explicit user action. Preserve existing status-line input/output and unrelated settings. Disconnect restores owned configuration without overwriting external edits.
- Gemini means Antigravity quota buckets positively identified as Gemini. Never merge Antigravity's partner-model quotas into Claude Code.

## Reference documentation

- https://learn.chatgpt.com/docs/app-server
- https://code.claude.com/docs/en/statusline
- https://antigravity.google/docs/cli/statusline/
