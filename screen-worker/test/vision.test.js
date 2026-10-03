const test = require('node:test');
const assert = require('node:assert/strict');
const { buildVisionPrompt, parseVisionResponse, clampConfidence, runMockVision } = require('../src/vision');

test('clampConfidence keeps 0..1', () => {
  assert.equal(clampConfidence(0.9), 0.9);
  assert.equal(clampConfidence(9), 1);
  assert.equal(clampConfidence(-1), 0);
  assert.equal(clampConfidence('bad'), 0);
});

test('buildVisionPrompt includes task context', () => {
  const p = buildVisionPrompt({ taskTitle: 'Fix login', activeFile: 'a.ts', recentTimeline: ['x'] });
  assert.match(p, /Fix login/);
  assert.match(p, /STRICT JSON/);
});

test('parseVisionResponse whitelists state + clamps', () => {
  const inf = parseVisionResponse('{"state":"ERROR","confidence":0.91,"summary":"boom"}', 'f1', 'mock');
  assert.equal(inf.state, 'ERROR');
  assert.equal(inf.confidence, 0.91);
  const bad = parseVisionResponse('{"state":"HACK","confidence":5}', 'f1', 'mock');
  assert.equal(bad.state, 'PROGRESSING');
  assert.equal(bad.confidence, 1);
  const broken = parseVisionResponse('not json', 'f1', 'mock');
  assert.equal(broken.confidence, 0);
});

test('mock vision never spends budget', async () => {
  const m = await runMockVision({ frameId: 'f1' });
  assert.equal(m.provider, 'mock');
  assert.ok(m.confidence < 0.75);
});
