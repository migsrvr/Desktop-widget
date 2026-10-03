# Spotify Web API Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Spotify Web API into WorkPulse via local OAuth PKCE loopback, displaying a monotone Now Playing card in the flyout panel, track marquee in the floating pill, and in-app Client ID setup modal.

**Architecture:** A local OAuth 2.0 PKCE flow handled by WorkPulse's embedded Axum server (`http://localhost:41789/api/spotify/callback`). Tokens are stored in SQLite and silently refreshed by Rust. The React frontend interacts with Spotify playback state via Tauri IPC commands and live WebSocket events.

**Tech Stack:** Tauri v2, Rust (Axum, Rusqlite, Reqwest/Ureq, SHA-256), TypeScript, React 19, Vite, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-03-spotify-integration-design.md`

## Global Constraints
- Pure monotone luxury aesthetic (Apple-style tactile controls, Windows 11 acrylic glass, `#ffffff` typography, no bright green badges).
- 100% local execution — no external cloud middleman servers.
- Keep runtime memory low (< 35MB).
- TDD required: write failing tests before implementing data models and utilities.

---

### Task 1: Shared Data Contracts & Unit Tests

**Files:**
- Modify: `shared/types/events.ts`
- Test: `shared/types/events.test.ts`

**Interfaces:**
- Produces:
  - `SpotifyTrack`: `{ id, name, artist, album, albumArtUrl?, durationMs, progressMs, isPlaying, device? }`
  - `SpotifyPlaybackAction`: `'PLAY' | 'PAUSE' | 'TOGGLE' | 'NEXT' | 'PREVIOUS'`
  - `SpotifyAuthStatus`: `{ isConnected: boolean, clientId?: string, userDisplayName?: string }`
  - Helper functions: `formatTrackDuration(ms: number): string`, `validateSpotifyAction(action: string): boolean`

- [ ] **Step 1: Write the failing unit tests for Spotify helpers**
- [ ] **Step 2: Run `npm test` to verify tests fail**
- [ ] **Step 3: Implement data contracts and helpers in `shared/types/events.ts`**
- [ ] **Step 4: Run `npm test` and `npm run --workspace=shared build` to verify tests pass**
- [ ] **Step 5: Commit changes to git**

---

### Task 2: SQLite Credentials Store in Rust Backend

**Files:**
- Modify: `src-tauri/src/db.rs`

**Interfaces:**
- Produces:
  - `SpotifyAuthRecord`: `{ client_id: String, access_token: String, refresh_token: String, expires_at: i64 }`
  - `Database::save_spotify_auth(&self, auth: &SpotifyAuthRecord) -> Result<()>`
  - `Database::get_spotify_auth(&self) -> Result<Option<SpotifyAuthRecord>>`
  - `Database::delete_spotify_auth(&self) -> Result<()>`

- [ ] **Step 1: Add table `spotify_auth` to SQLite initialization in `db.rs`**
- [ ] **Step 2: Implement `save_spotify_auth`, `get_spotify_auth`, and `delete_spotify_auth` in `db.rs`**
- [ ] **Step 3: Run `cargo check` in `src-tauri` to verify compilation**
- [ ] **Step 4: Commit changes to git**

---

### Task 3: Embedded Loopback Handler & Spotify Client in Rust

**Files:**
- Modify: `src-tauri/Cargo.toml` (add `reqwest = { version = "0.12", features = ["json"] }` and `base64`)
- Create: `src-tauri/src/spotify.rs` (PKCE generator, token exchange, and player API client)
- Modify: `src-tauri/src/server.rs` (add `/api/spotify/callback` route)
- Modify: `src-tauri/src/main.rs` (register Tauri IPC commands: `spotify_get_auth_url`, `spotify_get_status`, `spotify_control`, `spotify_disconnect`)

**Interfaces:**
- Produces:
  - `spotify_get_auth_url(client_id: String) -> Result<String, String>`
  - `spotify_get_status() -> Result<SpotifyStatusResponse, String>`
  - `spotify_control(action: String) -> Result<(), String>`
  - `spotify_disconnect() -> Result<(), String>`

- [ ] **Step 1: Add reqwest dependency to `src-tauri/Cargo.toml`**
- [ ] **Step 2: Create `src-tauri/src/spotify.rs` with PKCE and token exchange logic**
- [ ] **Step 3: Add Axum route `GET /api/spotify/callback` in `src-tauri/src/server.rs` to handle OAuth loopback**
- [ ] **Step 4: Expose IPC commands in `src-tauri/src/main.rs` and register in `generate_handler!`**
- [ ] **Step 5: Run `cargo check` in `src-tauri` to verify compilation**
- [ ] **Step 6: Commit changes to git**

---

### Task 4: Frontend Spotify State Hook

**Files:**
- Create: `ui/src/hooks/useSpotifyPlayer.ts`
- Modify: `ui/src/hooks/useWorkpulseState.ts`

**Interfaces:**
- Produces:
  - `track`: `SpotifyTrack | null`
  - `authStatus`: `SpotifyAuthStatus`
  - `isConnecting`: `boolean`
  - `startAuth`: `(clientId: string) => Promise<void>`
  - `controlPlayback`: `(action: SpotifyPlaybackAction) => Promise<void>`
  - `disconnect`: `() => Promise<void>`

- [ ] **Step 1: Create `ui/src/hooks/useSpotifyPlayer.ts` calling Tauri IPC commands with polling (every 3s when playing)**
- [ ] **Step 2: Connect `useSpotifyPlayer` into `useWorkpulseState.ts`**
- [ ] **Step 3: Run `npm run --workspace=ui build` to verify type safety**
- [ ] **Step 4: Commit changes to git**

---

### Task 5: Monotone UI Components (Now Playing Inset Card & Setup Modal)

**Files:**
- Create: `ui/src/components/SpotifyPlayerCard.tsx`
- Create: `ui/src/components/SpotifySetupModal.tsx`
- Modify: `ui/src/components/ExpandedPanel.tsx`
- Modify: `ui/src/components/CollapsedPill.tsx`

**Interfaces:**
- Consumes:
  - `track`, `authStatus`, `controlPlayback`, `startAuth`, `disconnect` from `useSpotifyPlayer`

- [ ] **Step 1: Build `ui/src/components/SpotifyPlayerCard.tsx` with luxury monotone acrylic card, album squircle, progress bar, and Apple-style playback buttons**
- [ ] **Step 2: Build `ui/src/components/SpotifySetupModal.tsx` with Client ID input, copyable redirect URI, and 1-click connect button**
- [ ] **Step 3: Embed `SpotifyPlayerCard` and setup modal trigger into `ExpandedPanel.tsx`**
- [ ] **Step 4: Integrate track marquee & mini playback toggle into `CollapsedPill.tsx`**
- [ ] **Step 5: Run `npm run --workspace=ui build` and `npm test` to verify zero errors**
- [ ] **Step 6: Commit changes to git**

---

### Task 6: Full Verification & Release Executable Build

**Files:**
- Target: `src-tauri/target/release/workpulse.exe`
- Target: `src-tauri/target/release/bundle/nsis/WorkPulse_0.1.0_x64-setup.exe`

- [ ] **Step 1: Run full Vitest test suite (`npm test`)**
- [ ] **Step 2: Run frontend production bundle (`npm run --workspace=ui build`)**
- [ ] **Step 3: Run Rust release compiler (`npm run tauri build`)**
- [ ] **Step 4: Verify generated `.exe` size, low memory (< 35MB), and desktop shortcut**
- [ ] **Step 5: Final git commit and delivery to user**
