# SESSION

**Tasks, focus sessions, and AI allowances in one calm, macOS-style workspace.**

SESSION is a personal productivity companion. It keeps the day's tasks, an active focus timer, music, and the remaining plan allowance for Codex, Claude, and Gemini in one place. A full board handles planning, and a compact "island" stays out of the way while you work.

It ships in two forms from one React codebase:

- **Web app:** live at **https://session-xi-mauve.vercel.app**. Tasks and focus timers run entirely in the browser. No account is needed.
- **Desktop app (Tauri 2 + Rust):** adds the floating top-center island, system tray, SQLite persistence, Spotify playback controls, a local IDE bridge, and real provider allowance readings.

> The repository and some internal identifiers still use the earlier working name **WorkPulse** (`workpulse-ui`, `com.workpulse.companion`, `workpulse.exe`). **SESSION** is the product name.

---

## Status at a glance (27 October 2026)

| Area | Status |
| --- | --- |
| Web app | **Live** on Vercel at https://session-xi-mauve.vercel.app (public, HTTPS) |
| Windows desktop | Builds and runs on Windows; native checks pass. **No public installer yet**: signing and installer verification are pending. |
| macOS desktop | Separate macOS config exists (`tauri.macos.conf.json`). **Not yet built or verified on a Mac**; signing and notarization pending. |
| AI allowances | Codex verified live against the Codex app on Windows. Claude Code and Gemini (via Antigravity) pass fixture and exporter tests; live account comparison pending. See `docs/REAL-AI-USAGE.md`. |
| Tests | 106 Vitest tests passing, plus Rust unit tests in `src-tauri` |

---

## What it does

### Tasks
- Organize work into **Now / Next / Later / Completed**, with exactly one active "Now" task.
- Create, edit, search, complete, reopen, and delete tasks. Set an optional duration (1–180 minutes) per task.
- Views: **Today**, **All Tasks**, **Completed**, **AI Usage**, **Settings**.
- Unfinished tasks from earlier days roll over to today automatically.
- Keyboard shortcuts: `⌘/Ctrl + F` search, `⌘/Ctrl + N` new task, `⌘/Ctrl + ,` settings, `⌘/Ctrl + 1/2` Today / All Tasks.

### Focus sessions
- Start, pause, reset, and complete a focus session for the active task, with a per-task Pomodoro-style target that stops exactly at the goal.
- Time comes from the wall clock, not from timer callbacks, so it stays correct when a browser tab is in the background.
- A compact focus view (the island) shows the current task, countdown, and controls. On the desktop it floats over other apps at the top center of the screen. On the web it stays inside the page.

### AI Usage (desktop)
- Shows remaining plan allowance and reset times for **Codex, Claude, and Gemini**, including multiple quota windows per provider (for example, a five-hour and a weekly window).
- Readings come only from each provider's documented interface. Unknown values stay "unavailable" and are never shown as zero, and stale readings (over 15 minutes) are labeled as stale.
- Codex: a read-only Codex App Server connection. Claude Code and Gemini: opt-in status-line exporters that back up and restore the user's existing config and keep only quota fields.

### Music (desktop)
- Spotify playback controls and now-playing info. Uses Spotify's OAuth with PKCE (no client secret), and falls back to detecting the local Spotify app plus media keys for Spotify Free on Windows.
- Track art can be shown as the original image or as an ASCII-art rendering.

### Feel
- Subtle sound cues synthesized with the Web Audio API (no audio files) for task completion, mode changes, and alerts. They can be muted in Settings.

### Web vs desktop

| Feature | Web | Desktop |
| --- | --- | --- |
| Tasks, search, statuses, durations | ✅ (saved in this browser) | ✅ (SQLite) |
| Focus timer and compact focus view | ✅ (in-page) | ✅ (floating island) |
| Sound cues | ✅ | ✅ |
| Spotify controls | — ("Available in the desktop app") | ✅ |
| AI allowance readings | — (shown as unavailable) | ✅ |
| IDE bridge, open task in editor | — | ✅ |
| Window controls, always-on-top, tray | — | ✅ |

The web build never connects to `localhost`, has no backend, and ships no credentials. If browser storage is blocked, the app keeps working and shows a notice that changes won't be saved.

---

## Design

- **Dark, strictly black, gray, and white.** Status is shown with contrast, icons, and labels, never color alone.
- macOS-oriented: a Mac-style board with sidebar, toolbar, and inspector, plus a compact island at the top center of the screen.
- Product principles: the next task and active focus session are always easy to find. Allowances can be read at a glance, with reset times nearby. Unavailable data is never confused with zero.
- Figma: https://www.figma.com/design/m4repQN9EdKQgGPtJlwk9v

---

## Tech stack

| Layer | Technology |
| --- | --- |
| UI | React 19, TypeScript 5.8, Vite 6, lucide-react icons, plain CSS |
| Desktop shell | Tauri 2 (Rust), two webviews: main board + island |
| Native services | Tokio, Axum (WebSocket/HTTP bridge on `127.0.0.1:41789`), rusqlite (bundled SQLite), reqwest (rustls) |
| Shared contract | TypeScript event/protocol types in `shared/types/events.ts` |
| IDE companion | VS Code-compatible extension in `ide-companion/` |
| Testing | Vitest (UI + shared), Rust `cargo test` |
| Web hosting | Vercel (static Vite build, no server functions) |

---

## Architecture

```
            ┌──────────────── React UI (ui/) ─────────────────┐
            │  SessionBoard · SessionIsland · ProviderUsage    │
            │  useWorkpulseState (tasks, timer, Spotify state) │
            └───────┬──────────────────────────┬───────────────┘
     Web (Vercel)   │                          │  Desktop (Tauri)
  localStorage only │                          │  Tauri commands + scoped events
                    ▼                          ▼
             Browser storage        src-tauri/ (Rust)
                                    ├─ db.rs        SQLite tasks
                                    ├─ island.rs    floating island window
                                    ├─ usage/       Codex App Server + status-line exporters
                                    ├─ spotify.rs   OAuth PKCE + Web API
                                    ├─ windows_media.rs  local Spotify detection, media keys
                                    └─ server.rs    local IDE bridge (127.0.0.1:41789)
                                                     ▲
                                          ide-companion/ (editor extension)
```

- One React app serves both targets. Native-only features check `isTauri()` and are hidden or explained on the web, not left as inactive controls.
- The main board window owns the session state and sends snapshots to the island window through Tauri events (`useIslandBridge`).
- Provider allowances reach the UI only through scoped Tauri events from the native usage service, never through the IDE WebSocket or a public endpoint.

### Engineering decisions worth noting
- **Honest data.** No demo percentages or fabricated resets. Local activity time never fills provider allowance bars. Unchanged cache re-reads don't count as fresh readings.
- **Clock-based timing.** Focus time is computed from elapsed wall-clock time (`settleElapsed` in `ui/src/utils/taskTimer.ts`), so throttled background tabs don't lose time.
- **Safe persistence.** All browser storage access goes through `ui/src/utils/safeStorage.ts`, which never throws.
- **Privacy.** Status-line exporters discard prompts, transcripts, paths, tokens, and costs, keeping only quota fields. Original config blocks are backed up and restored on disconnect.
- **Security.** Spotify uses PKCE, so no client secret ships in the app. The public web build contains no secrets and makes no localhost requests.

---

## Repository structure

```
├── ui/                        React app (shared by web and desktop)
│   ├── src/App.tsx            Board vs island surface selection
│   ├── src/components/        SessionBoard, SessionIsland, SessionMusic, ProviderUsage, …
│   ├── src/hooks/             useWorkpulseState, useProviderUsage, useIslandBridge, useSpotifyPlayer, useWebSocketBridge
│   ├── src/utils/             taskTimer, safeStorage, sessionView, providerUsage, islandProtocol, …
│   ├── src/audio/haptics.ts   Web Audio sound cues
│   └── PRODUCT.md             Product brief and design commitments
├── shared/types/events.ts     Shared types and protocol
├── src-tauri/                 Rust desktop shell (db, island, usage/, spotify, server, tray)
├── ide-companion/             Editor extension for the local bridge
├── docs/
│   ├── REAL-AI-USAGE.md       Allowance integrations: setup, privacy, verification
│   └── superpowers/           Specs and plans (incl. the web + desktop release plan)
├── CONTEXT.md                 Domain terms (provider allowance, quota window, usage reading)
├── vercel.json                Web deployment config
└── .vercelignore              Keeps native/build artifacts out of the web upload
```

Some older components (`CollapsedPill`, `ExpandedPanel`, `StudioConsole`, `OperatorCard`) and native modules (screen operator, fleet watcher) are from earlier iterations and are not part of the current SESSION interface.

---

## Run locally

Requires Node.js and npm. The desktop app also needs Rust and the Tauri 2 prerequisites.

```bash
npm ci                 # install all workspaces from the repo root
npm run dev:ui         # web app at http://localhost:5173
npm run tauri dev      # desktop app
npm test               # Vitest suite
npm run build:ui       # production web build -> ui/dist
cargo test --locked --manifest-path src-tauri/Cargo.toml
```

## Deploy (web)

The web app is a static Vite build deployed to Vercel from the repo root (`vercel.json`):

- Install: `npm ci` · Build: `npm run build:ui` · Output: `ui/dist`
- Vercel project: `session` (linked to this GitHub repository)
- `vercel deploy` creates a preview and `vercel deploy --prod` publishes to production.

Desktop release work (Windows installer, macOS universal DMG, signing, GitHub Release assets) is tracked in `docs/superpowers/plans/2026-10-26-session-web-and-desktop-release.md`.

---

## For portfolio use

Facts and copy for presenting SESSION in a portfolio. Everything here is accurate as of 27 October 2026.

### Key facts
- **Name:** SESSION
- **Category:** Deployed web app + desktop app (in progress)
- **Live URL:** https://session-xi-mauve.vercel.app
- **Source:** https://github.com/migsrvr/Desktop-widget
- **Primary action:** "Open web app"
- **Downloads:** none published yet. Do not show download buttons until real installers exist.
- **Stack tags:** React, TypeScript, Vite, Tauri, Rust, SQLite, Axum, Web Audio API, Vercel
- **Skill tags:** product design, desktop app development, cross-platform UI, API integration, OAuth (PKCE), privacy-conscious data handling, testing

### One-liner
A calm, macOS-style workspace that keeps your tasks, focus timer, music, and AI plan allowances in one place.

### Short description
SESSION combines a task board, a focus timer, and a glanceable view of Codex, Claude, and Gemini plan allowances in a dark, monochrome, Mac-style interface. The web app runs entirely in the browser. The Tauri desktop app adds a floating island, Spotify controls, and live allowance readings.

### Longer description
SESSION started as a desktop companion for keeping track of focused work alongside AI coding tools. It is one React 19 + TypeScript codebase that ships both as a public web app on Vercel and as a Tauri 2 desktop app with a Rust backend. Tasks are grouped into Now, Next, and Later, with a focus timer for the active task that stays accurate even in background tabs. On the desktop, a compact island floats at the top of the screen while you work. The AI Usage view reads real plan allowances from each provider's documented interface and never fakes a number: unavailable stays unavailable, and stale readings are labeled. Spotify integration uses OAuth with PKCE, so no secret ships in the app. The design is strictly black, gray, and white, and communicates status through contrast and labels.

### Media assets (local, not in the web build)
- Portfolio video: `artifacts/session-demo/SESSION-Portfolio.mp4` (30 s, 1920×1080, silent, about 2 MB, suitable for muted autoplay)
- Poster image: `artifacts/session-demo/SESSION-Poster.jpg`
- The video is an animated UI concept walkthrough with sample data. Present it as a design walkthrough, not as a recording of a shipped macOS build.

### Claims to avoid
- Don't say Windows or macOS downloads are available, or that the macOS app is verified. Neither is true yet.
- Don't say Claude or Gemini allowance readings are verified against live accounts. Only Codex is.
- Don't describe the web app as syncing across devices or having accounts. It stores data only in the visitor's browser.
- Don't show the video's sample percentages as real usage data.
