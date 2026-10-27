# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

The existing interface is React and TypeScript inside a Tauri desktop shell. The requested revision targets macOS conventions and macOS window behavior. This describes the current rendering stack, not a requirement to retain a web-style interface.

## Product Purpose

SESSION, called WorkPulse in the repository, combines personal tasks, focus sessions, and local AI activity monitoring in a desktop companion.

## Users

The confirmed priority is the user's tasks and focus session. The supporting AI view shows usage allowances.

## Operating Context

The user wants a macOS-oriented revision: a dynamic island at the center when docked, and a redesigned full board that feels at home among Apple's Mac applications.

The existing application includes Board, Focus, and Dock views, task timers, IDE telemetry, a screen operator, usage estimates, an activity timeline, and Spotify controls.

## Capabilities and Constraints

- Preserve task and timer continuity when changing presentation.
- The requested AI Usage view contains exactly Codex, Claude, and Gemini. Show plan allowance, remaining usage, and reset times; remove the OpenAI entry and agent/file-update feeds from the proposed UI.
- Preserve Spotify music playback alongside task and focus workflows. The Figma revision includes compact and expanded music-player layouts.
- The native AI Usage service reads Codex App Server allowances and opt-in Claude Code/Antigravity status-line exports. It renders multiple windows with independent connection/freshness states; local active-time estimates and the IDE bridge never populate these bars. Claude/Antigravity live account comparisons and macOS validation remain release gates; see `docs/REAL-AI-USAGE.md`.
- The existing desktop shell and some integrations are Windows-oriented. A native macOS release requires platform work as well as visual changes.
- The user approved implementation on 26 October 2026. The React board and a separate Tauri companion island implement the monochrome direction. macOS runtime verification still requires a Mac.

## Brand Commitments

Use SESSION for interface concepts, consistent with the current visible application. The user explicitly requests an Apple-like macOS design direction.

The user prefers the dark design with black, gray, and white only, confirmed on 26 October 2026. Use contrast, icons, and labels to communicate status.

## Evidence on Hand

The current React components, styles, Tauri configuration, and browser preview provide the incumbent interface. There are no provided screenshots of an existing macOS build.

## Product Principles

- Make the next task and the active focus session easy to identify.
- Keep allowances glanceable and make reset times easy to find.
- Distinguish unavailable readings from zero usage. Treat provider-reported plan allowances and local active-time estimates as different data.
- Follow macOS input and window conventions in the proposed Mac experience.
