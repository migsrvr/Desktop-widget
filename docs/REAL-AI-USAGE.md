# Real AI Usage: setup and verification

SESSION's native desktop app reads plan allowances for Codex, Claude Code, and Gemini through Antigravity. It renders every reported window, keeps unknown values unknown, and shows each provider's connection state independently. The general IDE bridge and active-time estimates do not supply these readings. The public browser preview has no account integration.

## Current verification status

| Provider | Implementation | Verification on 26 October 2026 |
| --- | --- | --- |
| Codex | Managed App Server stdio connection, sign-in, read/update messages, fallback refresh, reconnect, disconnect | Live Windows diagnostic matched the Codex app's five-hour and weekly percentages and exact reset timestamps for the signed-in account. |
| Claude Code | Opt-in status-line helper, five-hour and weekly allowances, backup/restore, original command forwarding | Sanitized fixtures and actual headless executable checks passed. Real subscription payload/display comparison remains pending. |
| Gemini / Antigravity | Opt-in status-line helper, Gemini bucket filtering, percentages or absolute remaining amount, backup/restore | Sanitized fixtures and actual exporter checks passed. The official `agy` CLI was not installed here; live account comparison remains pending. |

Windows native checks have been run. macOS builds, signed app launch, shell/configuration behavior, sleep/resume, and both desktop surfaces still require testing on a Mac before claiming macOS integration support. These are implementation and verification results, not a published release.

## Connect in the desktop app

1. Build and run the current desktop code, then open **AI Usage**. An older root-level executable will not include these changes.
2. **Codex:** install/sign in to Codex normally. SESSION detects an executable from PATH, standard installation locations, or `SESSION_CODEX_BINARY`. Startup uses an existing ChatGPT sign-in; **Connect Codex** opens Codex's normal browser flow if needed. API-key usage is separate from subscription allowance. Protocol incompatibility produces an update/reconnect message.
3. **Claude:** install and sign in to Claude Code, then explicitly choose **Connect Claude**. This backs up the existing user `statusLine` block before installing the exporter. Use Claude normally. Eligible subscription accounts supply `rate_limits` after a response; missing fields stay unavailable. Project or managed settings that override the user status line may prevent exports.
4. **Gemini:** install and sign in to the [official Antigravity CLI](https://antigravity.google/docs/cli/quickstart/), then explicitly choose **Connect Gemini**. SESSION checks `agy --version` and installs the helper in Antigravity's user settings. Only positively identified Gemini buckets are included. Antigravity's Claude model quotas never populate Claude Code's card.
5. Compare every displayed window and reset against the corresponding provider's own usage display before treating that integration as verified for your account. Disconnect/reconnect when changing accounts.

The Connect button is the status-line setup opt-in. Development builds install the path of the currently running executable; disconnect before moving/removing that executable, and reconnect from the final installed app.

## How updates work

- Codex initializes a private read-only App Server client and reads account limits. It listens for limit updates, refreshes on startup/reconnect/resume/manual Refresh, and uses a 60-second fallback. Errors back off, and upstream retry delays are respected. Refresh does not bypass a pending retry delay.
- Claude Code and Antigravity update when their status lines supply payloads. SESSION sends no model prompts and does not independently query their accounts. Refresh only re-reads their local cache.
- The native service checks sanitized cache files once per second. Re-reading a cache does not change its `receivedAt`. Identical status-line values/resets also retain their original receipt time, so repeatedly running a helper cannot create a false account refresh.
- A reading older than 15 minutes is stale. Expired windows become unavailable until the provider reports again; no reset is fabricated as zero usage. Stale/error/unknown readings cannot trigger low-allowance alerts.
- The compact summary selects the percentage window with the lowest remaining allowance. Absolute-only readings are shown in the full view without an invented percentage. Reset labels use local time calculations; they do not imply second-by-second provider polling.
- The main desktop webview owns the board/island snapshot. Provider data reaches it through scoped Tauri events, rather than the IDE WebSocket or a public endpoint.

## Settings, privacy, and disconnect

User settings modified only after Connect:

- Claude: `~/.claude/settings.json`, or `CLAUDE_CONFIG_DIR/settings.json`.
- Antigravity: `~/.gemini/antigravity-cli/settings.json`.

SESSION stores `<provider>.integration.json` and sanitized `<provider>.json` under the OS local application-data directory, in `SESSION/usage` (`%LOCALAPPDATA%/SESSION/usage` on Windows; `~/Library/Application Support/SESSION/usage` on macOS). Integration records contain the original status-line block and ownership information. Treat those backups as private local configuration: an existing user command may itself contain sensitive arguments. They are never sent to the frontend. Unix directories/files use owner-only permissions.

The helper passes the exact original stdin to the existing status-line command and preserves its output and exit code. Windows Claude commands retain Git Bash when available, or PowerShell otherwise; Antigravity uses its documented command shell. The helper's own quota cache contains only window IDs/labels, optional plan, percentages/absolute allowance, resets, source, and receipt time. It discards prompts, transcripts, workspace paths, tokens, costs, and credentials. No raw payload or upstream error text is logged by the usage service.

**Disconnect** disables exports, deletes the provider cache, and restores the original status-line block while retaining unrelated settings. If another tool edited the status-line block after setup, SESSION preserves that newer block and reports the conflict. Inspect it manually if it still references the SESSION helper. Disconnecting Codex stops SESSION's owned child process without signing out other Codex clients.

## Reproduce the checks

From the repository root:

```powershell
npm test
npm run --workspace=ui build
cargo test --locked --manifest-path src-tauri/Cargo.toml
cargo check --locked --manifest-path src-tauri/Cargo.toml
cargo build --locked --manifest-path src-tauri/Cargo.toml
node scripts/verify-usage-export.mjs
& './src-tauri/target/debug/workpulse.exe' --usage-check codex
```

The native diagnostic prints only normalized Codex quota data. It creates no model session/turn. The exporter verification uses disposable configuration directories, tests original stdin/stdout, shell quoting, paths with spaces, malformed input, unchanged freshness, disabled exports, and Gemini isolation. It does not change real Claude/Antigravity settings.

Headless status-line entry points are `--usage-export claude` and `--usage-export antigravity` (alias `gemini`). They run before single-instance handling, database initialization, trays, or application windows. They require an integration record created by Connect; piping arbitrary sample data does not silently enable an integration. `--usage-dir <absolute-directory>` supports isolated exporter verification.

## Remaining release gates

- Compare real Claude Code five-hour/seven-day readings with Claude's usage view, including missing-field and unsupported-account behavior.
- Install the official Antigravity CLI and compare each Gemini bucket, zero allowance, reset and absolute-only readings with its usage view.
- Exercise reconnect, restart, disconnect/configuration restoration, sleep/resume and board/island synchronization against real providers on both Windows and macOS.
- Package/sign the final macOS app, connect helpers from its stable installed location, and repeat those checks. Publish providers in the approved order: Codex, Claude Code, then Antigravity; do not mark pending live comparisons as completed.

## Provider references

- [OpenAI App Server](https://learn.chatgpt.com/docs/app-server)
- [Claude Code status line](https://code.claude.com/docs/en/statusline)
- [Antigravity status-line payload](https://antigravity.google/docs/cli/statusline/)
