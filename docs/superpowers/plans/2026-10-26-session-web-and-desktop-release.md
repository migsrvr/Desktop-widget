# SESSION web app and desktop release plan

## Purpose and status

Publish SESSION as a usable web app with verified desktop downloads, so the portfolio can link to a working product instead of relying on a video demonstration.

The user selected:

- **Distribution:** Web app plus desktop downloads.
- **Web hosting:** Vercel, with a separate SESSION URL.
- **Desktop platforms:** Windows and macOS.
- **Release order:** Web first; add each desktop download after its build, installation testing, and signing requirements are satisfied.

This document is the CLI handoff. Deployment work described here has **not** been implemented or published. The earlier monochrome UI implementation and portfolio video already exist locally.

## Current codebase and context

- SESSION workspace: `C:/Users/Miggy/Documents/Work Window Haptics`.
- Portfolio workspace: `C:/Users/Miggy/Documents/ChatGPT/Portfolio`.
- SESSION Git remote: `https://github.com/migsrvr/Desktop-widget.git`.
- Stack: React 19, TypeScript, Vite, Tauri 2, Rust, and SQLite for desktop persistence.
- Frontend workspace: `ui`; shared types: `shared/types/events.ts`; native application: `src-tauri`.
- Approved design: dark, strictly black/gray/white, macOS-oriented board and top-center companion island. Tasks and focus are primary. AI Usage contains exactly Codex, Claude, and Gemini.
- The browser already supports task state and focus sessions, with local storage. Native integrations are guarded in several hooks, but the WebSocket bridge currently attempts a localhost connection automatically.
- The new routed UI uses `SessionBoard`, `SessionIsland`, `SessionMusic`, and `ProviderUsage`. `useWorkpulseState` owns the existing task/timer/Spotify state. The native island receives snapshots through `useIslandBridge`.
- Real provider allowances are not currently fetched from provider accounts. The UI accepts explicit `usage/allowance` bridge messages and otherwise shows unavailable. Local active-time estimates must never populate provider allowance bars.
- The portfolio has an existing `desktop-widget` project entry. Its content system distinguishes draft, preview, release, and active release. Do not update only its fixture content and assume the database-backed public site changed.
- Earlier verification passed 91 tests, the frontend production build, and Windows-host Rust compilation. Re-run verification after implementing this plan. macOS runtime behavior has not been verified.

There are pre-existing uncommitted changes in this workspace, including shared types, native integrations, UI components, telemetry work, and `workpulse.exe`. Inspect the current diff and applicable instructions before editing. Preserve unrelated changes and do not distribute the older executable as the new release.

Related material:

- `docs/superpowers/plans/2026-10-26-macos-ui-implementation.md`
- `docs/superpowers/specs/2026-10-26-macos-ui-implementation-notes.md`
- `ui/PRODUCT.md`
- Portfolio video: `artifacts/session-demo/SESSION-Portfolio.mp4`
- Figma: https://www.figma.com/design/m4repQN9EdKQgGPtJlwk9v

## 1. Publish the working web app

### Behavior

- Reuse the existing React interface and monochrome design; do not create a separate mock application.
- Support task creation, editing, completion, search, focus timers, and compact focus mode.
- Save each visitor's tasks locally in their own browser. No account, cloud database, or cross-device synchronization in this release.
- Make focus timing account for elapsed time in background tabs rather than relying on one interval callback per second.
- Handle unavailable browser storage gracefully, keeping the current session usable and explaining when changes cannot persist.
- Disable automatic localhost desktop-bridge connections on the public website.
- Hide native window controls in the browser. Browser compact focus mode remains inside the page; it must not claim to float over other applications.
- Explain that the desktop island, desktop Spotify integration, and provider allowances require the desktop application. Avoid inactive connection forms and controls that silently do nothing.
- Keep usage unavailable when no genuine provider reading exists. Do not preload demo percentages, fake connections, or fictional tasks into the production app.

### Hosting

- Use Vercel for a standalone SESSION deployment.
- Build from the repository root so workspace dependencies and shared types resolve correctly.
- Build command: `npm run build:ui`.
- Output directory: `ui/dist`.
- Retain the actual URL returned by Vercel; do not assume a particular hostname is available.
- Verify production asset paths and HTTPS behavior. The public web build must not depend on the local Rust server or expose desktop credentials.
- Authenticate deployment access when needed. Do not place account tokens or signing secrets in source files.

## 2. Prepare Windows and macOS downloads

- Add repeatable build automation for a Windows x64 installer and a macOS universal DMG.
- Build from the current source. Keep native platform configuration separate where required.
- Treat build success and runtime verification as separate gates. Test installation, startup, persistence, island behavior, and uninstall on each platform.
- Require macOS signing and notarization before listing its public download. Apply the appropriate signing process for the Windows public release.
- Publish verified installers as versioned public GitHub Release assets.
- Preserve source repository visibility. If the source repository is private, use a public binary-only release repository instead of making the source public.
- Do not list an installer until its real public asset URL is available and verified.
- Release each platform independently once ready. The web launch must not wait for unavailable signing credentials or macOS test access.

Hosting authentication, access to platform test environments, and signing credentials are external prerequisites. If one is missing, finish the unaffected work and report the specific remaining release gate. Never substitute an untested or unsigned preview for the user-selected verified release.

## 3. Update the portfolio

- Update the existing `desktop-widget` entry to display **SESSION**, preserving its identifier and relationships.
- Use the portfolio's existing draft/preview/publish workflow. Preserve unrelated projects and immutable historical releases.
- Set the SESSION entry to the deployed-project category once the web app is live, with the verified Vercel URL.
- Make **Open web app** the primary action.
- Add **Download for Windows** and **Download for macOS** independently when their verified release assets are public.
- Extend project records, validation, admin editing, and rendering with optional Windows and macOS download URLs. Older project records must remain valid without these fields.
- Do not publish placeholder download buttons or links to private release assets.
- Keep the existing portfolio video as supplementary material, rather than the only way to experience the project.

## 4. Verification and acceptance criteria

### Web

- Create, edit, search, complete, and reopen tasks.
- Confirm persistence after refresh and browser reopening.
- Verify timer start, pause, reset, completion, and board-to-focus transitions.
- Confirm elapsed timing after backgrounding the tab.
- Check unavailable-storage behavior without crashing the app.
- Test responsive layouts, keyboard access, and meaningful unavailable/desktop-only states.
- Confirm the production web app makes no automatic localhost bridge requests and includes no secrets.
- Verify the deployed HTTPS URL, icons, static assets, and navigation.

### Desktop

- Produce fresh Windows and macOS release artifacts from the intended source revision.
- Verify installation, startup, task persistence, board/island transitions, timer continuity, and uninstall on both platforms.
- Verify signing and macOS notarization before publishing the corresponding download.
- Confirm download links work for a visitor who is not signed into the owner's accounts.

### Portfolio and regression checks

- Verify the existing project identifier and relationships survive the update.
- Confirm older records without download URLs still validate and render.
- Preview the updated entry before publishing it through the portfolio's release workflow.
- Check the web action and every published platform download from the public portfolio.
- Run SESSION tests, the frontend build, and native checks; run the portfolio's relevant tests and build after its changes.

Useful SESSION commands:

```powershell
npm test
npm run build:ui
cargo check --locked --manifest-path src-tauri/Cargo.toml
```

## Assumptions and boundaries

- This plan covers SESSION only. The mobile project needs its own framework review before choosing browser, app-store, or installer distribution.
- No new authentication system, cloud task synchronization, provider-account quota integration, or browser Spotify backend is included in the first web release.
- Do not change portfolio hosting or restyle the entire portfolio.
- Keep the approved monochrome macOS design direction across the web and desktop versions.

## Suggested CLI continuation prompt

> Read `docs/superpowers/plans/2026-10-26-session-web-and-desktop-release.md`, inspect applicable instructions and the current working-tree changes, then implement this plan. Preserve unrelated work. Prepare and verify the usable Vercel web app first, then prepare verified Windows and macOS releases and update the existing portfolio entry. Do not fabricate usage data, publish placeholder downloads, expose secrets, or change source repository visibility. Report any missing hosting authentication, signing access, or platform testing prerequisites precisely.
