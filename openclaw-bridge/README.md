# openclaw-bridge

WorkPulse ↔ OpenClaw operator bridge (same WS pattern as `ide-companion`).

```bash
npm install
node src/index.js --goal "Monitor build errors" --agent OpenClaw
```

- Handshakes as `OpenClaw` on `ws://127.0.0.1:41789/ws`
- Forwards `widget/operator_task` → `ai/status_update`
- Propose actions via `POST /api/operator/propose` (Approve lives in widget)
- `npm test` runs contract tests, no bridge required
