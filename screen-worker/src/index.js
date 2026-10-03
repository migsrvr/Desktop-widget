/**
 * WorkPulse screen-worker: throttled capture -> vision -> bridge.
 *
 * Env:
 *   PROVIDER=mock|gemini|openai (default mock)
 *   POLL_MS=15000
 *   BRIDGE=http://127.0.0.1:41789
 *   TASK_TITLE, ACTIVE_FILE (optional context)
 */
const { buildVisionPrompt, parseVisionResponse, runMockVision, runGeminiVision, runOpenAIVision } = require('./vision');

const BRIDGE = process.env.BRIDGE || 'http://127.0.0.1:41789';
const PROVIDER = (process.env.PROVIDER || 'mock').toLowerCase();
const POLL_MS = Number(process.env.POLL_MS || 15000);

async function postJson(path, data) {
  const res = await fetch(`${BRIDGE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`POST ${path} -> ${res.status}`);
  return res.json().catch(() => ({}));
}

async function fetchLatestJpegB64() {
  const res = await fetch(`${BRIDGE}/api/screen/latest`);
  if (!res.ok) {
    // No frame yet — ask the bridge to capture one.
    await postJson('/api/screen/capture', {});
    return null;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.toString('base64');
}

async function tick() {
  try {
    const cap = await postJson('/api/screen/capture', {}).catch(() => null);
    const frameId = cap?.frame?.frame_id || cap?.frame?.frameId || 'frame-' + Date.now();
    const b64 = await fetchLatestJpegB64().catch(() => null);

    const prompt = buildVisionPrompt({
      taskTitle: process.env.TASK_TITLE || '',
      activeFile: process.env.ACTIVE_FILE || '',
      recentTimeline: [],
    });

    let raw;
    if (PROVIDER === 'gemini') {
      raw = b64 ? await runGeminiVision({ imageB64: b64, prompt }) : '{}';
    } else if (PROVIDER === 'openai') {
      raw = b64 ? await runOpenAIVision({ imageB64: b64, prompt }) : '{}';
    } else {
      const mocked = await runMockVision({ frameId });
      await postJson('/api/ai/event', { type: 'ai/vision_update', payload: mocked });
      console.log(`[screen-worker] mock inference ${mocked.state} ${(mocked.confidence * 100) | 0}%`);
      return;
    }

    const inference = parseVisionResponse(raw, frameId, PROVIDER);
    await postJson('/api/ai/event', { type: 'ai/vision_update', payload: inference });
    console.log(`[screen-worker] ${PROVIDER} inference ${inference.state} ${(inference.confidence * 100) | 0}% — ${inference.summary}`);
  } catch (err) {
    console.log('[screen-worker] tick skipped (bridge offline?):', err.message);
  }
}

if (require.main === module) {
  console.log(`[screen-worker] starting provider=${PROVIDER} poll=${POLL_MS}ms bridge=${BRIDGE}`);
  tick();
  setInterval(tick, POLL_MS);
}

module.exports = { tick, postJson };
