# WorkPulse Spotify Integration Design Specification

**Document**: `docs/superpowers/specs/2026-10-03-spotify-integration-design.md`  
**Status**: Draft for Review  
**Author**: Gemini 3.8 Flash (Lead Architect & PM)  
**Date**: 2026-10-03  
**Target Platform**: Windows 11 / Windows 10 (Tauri v2 + WebView2)

---

## 1. Overview & Goals

The **Spotify Integration** for WorkPulse adds an ambient, elegant music companion directly into the floating desktop widget. Developers frequently listen to music or lo-fi tracks during focus sessions; this integration allows users to monitor their current track, pause/resume, and skip songs without switching windows or interrupting their workflow.

### Key Value Propositions
1. **Zero Context Switching**: View now playing track and control playback (Play/Pause, Next, Previous) directly from the floating pill or expanded panel.
2. **Standard OAuth 2.0 with PKCE**: Connects securely to the Spotify Web API using PKCE (Proof Key for Code Exchange) via WorkPulse's embedded local loopback server (`http://localhost:41789/api/spotify/callback`).
3. **No External Server Dependency**: 100% local execution. Tokens are stored encrypted/locally in WorkPulse's SQLite database, and token refresh is handled natively by the Rust core.
4. **Monotone Luxury UI**: Seamlessly inherits WorkPulse's Apple-style tactile buttons and Windows 11 acrylic glassmorphic design system—no bright neon green badges or jarring colors.

---

## 2. Architecture & Authentication Flow

### 2.1 Component Flow Diagram

```
[ User Desktop Browser ] ─── (1) Auth Redirect ───> [ Spotify Accounts Service ]
                                                           │
                                                           │ (2) Redirects with ?code=...
                                                           ▼
[ WorkPulse Local Server ] (http://localhost:41789/api/spotify/callback)
   │
   ├── (3) Exchanges code + code_verifier for access_token & refresh_token
   ├── (4) Persists tokens in local SQLite (table: spotify_auth)
   └── (5) Emits "spotify/auth_success" over internal WebSocket/IPC
            │
            ▼
[ WorkPulse Frontend UI ]
   ├── Polls / receives live track info via local backend bridge
   ├── Displays Now Playing Inset Card in Expanded Panel
   └── Displays Track Marquee & Play/Pause in Collapsed Pill
```

### 2.2 PKCE Authorization Sequence
1. **User Enters Client ID**: In the WorkPulse Settings Modal, the user enters their Spotify Developer `Client ID`.
2. **PKCE Secret Generation**: WorkPulse Rust backend generates a cryptographic `code_verifier` (43-128 chars) and SHA-256 `code_challenge`.
3. **Browser Auth Launch**: WorkPulse opens default system browser to:
   `https://accounts.spotify.com/authorize?client_id=...&response_type=code&redirect_uri=http://localhost:41789/api/spotify/callback&code_challenge_method=S256&code_challenge=...&scope=user-read-playback-state%20user-modify-playback-state%20user-read-currently-playing`
4. **Local Loopback Capture**: The embedded Axum server on port 41789 receives `GET /api/spotify/callback?code=...`.
5. **Token Exchange**: Backend makes `POST https://accounts.spotify.com/api/token` with the `code` and `code_verifier`.
6. **Persistence & Refresh**: `access_token`, `refresh_token`, and `expires_at` are stored in SQLite. Whenever `expires_at` is within 60 seconds of expiration, backend automatically refreshes the token using `refresh_token`.

---

## 3. Data Models & SQLite Schema

### 3.1 SQLite Schema (`src-tauri/src/db.rs`)

```sql
CREATE TABLE IF NOT EXISTS spotify_auth (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    client_id TEXT NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at INTEGER NOT NULL, -- Unix timestamp in seconds
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 3.2 Shared TypeScript Contracts (`shared/types/events.ts`)

```typescript
export interface SpotifyTrack {
  id: string;
  name: string;
  artist: string;
  album: string;
  albumArtUrl?: string;
  durationMs: number;
  progressMs: number;
  isPlaying: boolean;
  device?: {
    name: string;
    type: string;
    volumePercent: number;
  };
}

export type SpotifyPlaybackAction = 'PLAY' | 'PAUSE' | 'TOGGLE' | 'NEXT' | 'PREVIOUS';

export interface SpotifyAuthStatus {
  isConnected: boolean;
  clientId?: string;
  userDisplayName?: string;
}
```

---

## 4. UI & Layout Integration

### 4.1 Expanded Flyout Panel
- **Placement**: Nested between the AI Companion Card and the Tasks/Focus section.
- **Visual Design**:
  - `w11-card` with frosted obsidian acrylic background (`rgba(28, 28, 32, 0.65)`).
  - Squircle album art thumbnail (42 × 42 px) with subtle 1px border.
  - Track Title (white `#ffffff`, bold 12px, single line with ellipsis) and Artist (silver 11px).
  - Micro progress bar with live elapsed time (`01:24 / 03:45`).
  - Tactile Apple-style transport buttons:
    - `[ |< ]` Previous
    - `[ ▶ ]` / `[ ❚❚ ]` Play / Pause (high-contrast white pill)
    - `[ >| ]` Next
  - If not connected, displays a clean `[ Connect Spotify ]` button that opens the setup modal.

### 4.2 Collapsed Floating Pill
- When Spotify is connected and playing, the floating pill adapts seamlessly:
  - Mini sound-wave / breathing music orb indicator.
  - Marquee snippet of the song title alongside active task.
  - Quick-toggle play/pause action button.

### 4.3 Setup Modal
- Monotone flyout modal accessible via `[ Music ]` pill in header or Connect prompt.
- Includes:
  - Text input for Spotify `Client ID`.
  - Copyable redirect URI: `http://localhost:41789/api/spotify/callback`.
  - 1-click `[ Authenticate with Spotify ]` button.
  - `[ Disconnect ]` option for revoking credentials.

---

## 5. Error Handling & Edge Cases

1. **No Active Device**: If Spotify Web API returns `404 / NO_ACTIVE_DEVICE` (common when Spotify app is closed or idle), display "No active Spotify device · Open Spotify on your PC or phone" with a convenient "Retry" or "Launch Spotify" button.
2. **Expired Access Token**: Automatically refreshed in Rust background before issuing player commands.
3. **Spotify Free Limitation**: Spotify Web API player controls require Spotify Premium. If a `403 / RESTRICTED_ACTION` error is received, display a clear, non-intrusive tooltip: "Playback control requires Spotify Premium". Track viewing remains functional.
4. **Offline / Network Interruption**: If requests timeout, display "Offline" indicator and suppress retry spam until connection resumes.

---

## 6. Implementation & Verification Plan

1. **Contracts & Tests**:
   - Add TypeScript contracts to `shared/types/events.ts`.
   - Write Vitest unit tests verifying track parsing, duration formatting, and action payload validation.
2. **Rust Backend Implementation**:
   - Add `spotify_auth` table in `src-tauri/src/db.rs`.
   - Add PKCE helper and Axum loopback endpoint in `src-tauri/src/server.rs`.
   - Add Tauri IPC commands in `src-tauri/src/main.rs`:
     - `spotify_start_login(client_id: String)`
     - `spotify_get_track()`
     - `spotify_send_command(action: String)`
     - `spotify_disconnect()`
3. **Frontend UI Components**:
   - Create `ui/src/components/SpotifyPlayerCard.tsx` (Now Playing card).
   - Create `ui/src/components/SpotifySetupModal.tsx` (Credentials & OAuth modal).
   - Update `ui/src/components/CollapsedPill.tsx` with now playing indicator.
   - Update `ui/src/hooks/useWorkpulseState.ts` to manage player state.
4. **Verification**:
   - `npm test` passing with 100% test suite integrity.
   - `npm run --workspace=ui build` and `cargo check` passing.
   - Live end-to-end OAuth flow test against Spotify Web API.
