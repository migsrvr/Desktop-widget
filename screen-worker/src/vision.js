/**
 * Vision provider abstraction with strict JSON contract.
 * Providers: mock (default, zero spend) | gemini | openai
 */

const VISION_STATES = ['STUCK', 'ERROR', 'DONE', 'IDLE', 'PROGRESSING'];

function clampConfidence(v) {
  const n = Number(v);
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function buildVisionPrompt({ taskTitle, activeFile, recentTimeline }) {
  const timeline = (recentTimeline || []).slice(0, 5).join('\n - ');
  return [
    'You are WorkPulse task monitor. Look at the screenshot and decide the worker state.',
    'Return STRICT JSON only: {"state":"STUCK|ERROR|DONE|IDLE|PROGRESSING","confidence":0..1,"summary":"<12 words","suggestedAction":null|{"tool":"hotkey|click|type|mouse_move","args":{},"rationale":"<12 words"}}',
    `Current Now task: ${taskTitle || '(none)'}`,
    `Active file: ${activeFile || '(unknown)'}`,
    `Recent timeline:\n - ${timeline || '(empty)'}`,
    'Rules: confidence<0.75 means log-only, no suggestedAction. Never mark DONE unless completion UI is clearly visible.',
  ].join('\n');
}

function parseVisionResponse(raw, frameId, provider) {
  let data;
  try {
    const text = typeof raw === 'string' ? raw : JSON.stringify(raw);
    // Tolerate ```json fences from chatty models.
    const cleaned = text.replace(/```json|```/g, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    data = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return {
      inferenceId: 'inf-' + Date.now(),
      frameId,
      provider,
      state: 'PROGRESSING',
      confidence: 0,
      summary: 'Unparseable vision response',
      createdAt: new Date().toISOString(),
    };
  }
  const state = VISION_STATES.includes(data.state) ? data.state : 'PROGRESSING';
  let suggestedAction;
  if (data.suggestedAction && typeof data.suggestedAction.tool === 'string') {
    suggestedAction = {
      tool: data.suggestedAction.tool,
      args: data.suggestedAction.args || {},
      rationale: String(data.suggestedAction.rationale || '').slice(0, 140),
    };
  }
  return {
    inferenceId: 'inf-' + Date.now(),
    frameId,
    provider,
    state,
    confidence: clampConfidence(data.confidence),
    summary: String(data.summary || state).slice(0, 200),
    ...(suggestedAction ? { suggestedAction } : {}),
    createdAt: new Date().toISOString(),
  };
}

async function runMockVision({ frameId }) {
  // Deterministic mock: cycles PROGRESSING so CI/E2E never spends API budget.
  return {
    inferenceId: 'inf-' + Date.now(),
    frameId,
    provider: 'mock',
    state: 'PROGRESSING',
    confidence: 0.6,
    summary: 'Mock: steady progress, no blocker detected',
    createdAt: new Date().toISOString(),
  };
}

async function runGeminiVision({ imageB64, prompt }) {
  const key = process.env.GEMINI_API_KEY || '';
  if (!key) return runMockVision({ frameId: 'noframe' });
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            { inline_data: { mime_type: 'image/jpeg', data: imageB64 } },
          ],
        },
      ],
      generationConfig: { temperature: 0.2, maxOutputTokens: 300 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini vision failed: ${res.status}`);
  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '{}';
  return text;
}

async function runOpenAIVision({ imageB64, prompt }) {
  const key = process.env.OPENAI_API_KEY || '';
  if (!key) return runMockVision({ frameId: 'noframe' });
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageB64}` } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI vision failed: ${res.status}`);
  const json = await res.json();
  return json?.choices?.[0]?.message?.content || '{}';
}

module.exports = {
  VISION_STATES,
  clampConfidence,
  buildVisionPrompt,
  parseVisionResponse,
  runMockVision,
  runGeminiVision,
  runOpenAIVision,
};
