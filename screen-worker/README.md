# screen-worker

Throttled screen → cloud vision relay for WorkPulse.

```bash
# Zero-spend mock loop (default)
node src/index.js

# Live Gemini vision (15s poll)
PROVIDER=gemini GEMINI_API_KEY=... POLL_MS=15000 node src/index.js

# Live OpenAI vision
PROVIDER=openai OPENAI_API_KEY=... node src/index.js
```

Posts `ai/vision_update` to `http://127.0.0.1:41789/api/ai/event`.
Run `npm test` for contract tests (no network).
