# Screen Operator — What You Need to Add to Make It Work Now

Built: 2026-10-03. App binary already includes the operator core.
This doc lists everything **you** must still provide: keys, installs,
commands to run, and the two known stubs (fake pixels + guarded clicks).

## 0. TL;DR checklist

- [ ] `npm install` in `openclaw-bridge/` (needs `ws`)
- [ ] No install needed in `screen-worker/` (zero deps, stdlib only)
- [ ] Set `GEMINI_API_KEY` **or** `OPENAI_API_KEY` for live vision (or run `PROVIDER=mock`)
- [ ] Run 3 processes: WorkPulse .exe + screen-worker + openclaw-bridge
- [ ] Optional for REAL pixels: add `xcap` + `image` deps (Section 4)
- [ ] Optional for REAL clicks: set `OPERATOR_LIVE=1` + wire `enigo` (Section 5)
- [ ] Optional: install real OpenClaw agent (Section 3) — bridge works standalone without it

## 1. What already works out of the box (no action)

| Piece | Status in the .exe |
|---|---|
| Bridge `127.0.0.1:41789` + WS `/ws` | Live |
| `POST /api/screen/capture`, `GET /api/screen/latest`, `GET /api/screen/status` | Live (placeholder pixels, Section 4) |
| `POST /api/operator/propose`, `POST /api/operator/approve` | Live, validated, audited to SQLite |
| SQLite tables `screen_sessions`, `screen_frames`, `vision_inferences`, `operator_actions`, `ai_provider_config` | Auto-migrated on launch |
| Widget `Screen Operator` card, Watching toggle, Capture, Approve/Deny, Test AI → Vision sim | Live (sim needs no backend) |
| State machine `PROPOSED → APPROVED/DENIED → EXECUTED/FAILED`, 75% confidence gate | Enforced in `shared/types/events.ts` + Rust |
| Timeline audit `SCREEN_OBSERVED`, `VISION_INFERENCE`, `ACTION_PROPOSED` + haptics chime | Live |

## 2. Install + keys (required)

### 2.1 One-time installs

```powershell
# From repo root:
cd openclaw-bridge; npm install   # installs ws for WS bridge
cd ..\screen-worker               # nothing to install (no deps)
```

### 2.2 Vision API key (pick one; cloud OK per your choice)

```powershell
# Option A — Gemini (recommended, you already use Gemini 3.8 Flash)
$env:GEMINI_API_KEY="AIza..."
$env:GEMINI_MODEL="gemini-2.0-flash"

# Option B — OpenAI
$env:OPENAI_API_KEY="sk-..."
$env:OPENAI_MODEL="gpt-4o-mini"
```

No key? Run `PROVIDER=mock` — full pipeline exercises with zero spend
(mock returns `PROGRESSING` @ 60%, correctly gated to log-only).

Costs if live: 15s poll ≈ 240 calls/hr. `gpt-4o-mini` / `gemini-flash`
vision ≈ $0.001–0.003/frame. Recommend event-triggered + 15–30s poll,
not video. Keys stay in env / OS keychain — never committed; the
`ai_provider_config.api_key_ref` column is ready for a keychain ref when
you add the settings UI.

## 3. Run it (3 terminals)

```powershell
# T1 — desktop app (bridge auto-listens on 41789)
.\src-tauri\target\release\workpulse.exe
# or: npm run tauri dev

# T2 — vision relay (mock first, live when key set)
cd screen-worker
$env:PROVIDER="mock"            # swap to gemini|openai when key set
$env:POLL_MS="15000"
$env:TASK_TITLE="My Now task"   # optional context for prompt
node src\index.js

# T3 — OpenClaw bridge (standalone OK without real OpenClaw)
cd ..\openclaw-bridge
npm install                      # first time only
node src\index.js --goal "Monitor build errors" --agent OpenClaw
```

Verify: widget → Screen Operator → `Watch` → `Capture` → Test AI →
`Vision` → amber `WAITING` + approval card → Approve/Deny → timeline
`ACTION_PROPOSED` entry. Health: `http://127.0.0.1:41789/health`.

Real OpenClaw agent (optional): install OpenClaw separately, point its
tool-runner at `POST 127.0.0.1:41789/api/operator/propose` with
`{tool, args, prompt, taskId}`. The bridge already emits
`ai/run_started|status_update|waiting_input|run_finished` for it, so no
OpenClaw code changes are needed for monitoring — only for autonomous
acting.

## 4. STUB #1 — Screen pixels are placeholders (to get REAL screenshots)

`src-tauri/src/screen.rs::capture_pixels()` currently returns a minimal
1×1 JPEG so `cargo check`, CI, and mock vision pass headless. To get live
pixels:

1. Add deps in `src-tauri/Cargo.toml`:
   ```toml
   xcap = "0.5"
   image = "0.25"
   ```
2. Replace `capture_pixels()` with: `xcap::Monitor::all()` → active
   window → `capture_image()` → downscale longest-edge 1280 → `image`
   JPEG encode quality 70 → apply redact rects (black fill) pre-encode.
3. Set `capture_unavailable: false` (already false) and return real
   `width/height`.
4. Re-run `cargo check`, `cargo test`, `npx tauri build`.

Until then: thumbnails render as tiny frames, vision sees mock input —
pipeline, gating, approvals, and audit all still exercise correctly.

Windows notes: no special capture permission needed for own desktop;
first run may trigger firewall prompt for `127.0.0.1:41789` — allow
Private/localhost only. Pause capture during RDP/banking (manual Pause
button for now; auto-pause list is future work).

## 5. STUB #2 — OS input is guarded (to get REAL mouse/keyboard)

`src-tauri/src/operator.rs::execute()` validates then returns
`guarded:<tool>` unless `OPERATOR_LIVE=1`. It never touches the OS today.
To enable:

1. Add `enigo = "0.3"` to `src-tauri/Cargo.toml`.
2. Implement the `TODO(enigo)` arm: `mouse_move {x,y}`, `click {x,y}`,
   `type {text}`, `hotkey {keys}` (parse `"ctrl+s"` → modifiers + key).
3. Launch with `$env:OPERATOR_LIVE="1"` — keep default off in dev/CI.
4. Keep the Approve gate: widget `Approve` → `POST /api/operator/approve
   {APPROVED}` → `decide_action APPROVED` → `execute()` → mark
   `EXECUTED` (+ `executed_at`). Every step stays in `operator_actions`
   + `timeline_events`.

Safety default stays `ask-first`: proposals chime + require Approve.
Full-auto click is deliberately not wired.

## 6. Not yet built (safe to defer)

- Redaction zones UI (spec'd as `localStorage workpulse_redact_zones`;
  currently captures full active window — add rect editor in Settings).
- Auto-pause list (banking/RDP/password-manager substring match).
- Provider settings UI (key input, model pick, poll interval) — env vars
  are the interface today.
- Local-only VL fallback (Ollama/LLaVA) — provider abstraction in
  `screen-worker/src/vision.js` is ready; add `PROVIDER=local` arm.
- Tray Watching indicator + kill-switch hotkey (card toggle is the
  switch today).

## 7. Troubleshooting

| Symptom | Fix |
|---|---|
| `Access denied workpulse.exe` on build | Old .exe running — `Stop-Process -Name workpulse -Force`, rebuild |
| `GET /api/screen/latest → 404 no frame yet` | Press `Capture` once, or start screen-worker (auto-captures) |
| `screen-worker tick skipped (bridge offline?)` | Start WorkPulse .exe first; check `:41789/health` |
| `ws dependency missing` | `cd openclaw-bridge; npm install` |
| Vision 400s | Check key env, model name, JPEG valid (real pixels need Section 4) |
| `confidence <75% logged only` | By design — raise evidence quality or lower threshold in `isVisionConfident` call |

## 8. Files you touch when enabling live mode

- `src-tauri/Cargo.toml` (+ `screen.rs`, `operator.rs`) — Sections 4–5
- Env only — Section 2 (no code for keys today)
- `screen-worker/src/index.js` env (`PROVIDER`, `POLL_MS`, `TASK_TITLE`)
- `openclaw-bridge/src/index.js` (`--goal`, `--agent`, real agent wiring)
