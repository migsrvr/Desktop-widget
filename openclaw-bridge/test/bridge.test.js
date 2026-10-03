const test = require('node:test');
const assert = require('node:assert/strict');
const { buildHandshake, buildRunStarted, buildProposal } = require('../src/index');

test('handshake identifies as OpenClaw', () => {
  const h = buildHandshake();
  assert.equal(h.type, 'ide/handshake');
  assert.equal(h.payload.ideName, 'OpenClaw');
});

test('run_started carries goal', () => {
  const m = buildRunStarted('r1', 'OpenClaw', 'Do things');
  assert.equal(m.type, 'ai/run_started');
  assert.equal(m.payload.goal, 'Do things');
});

test('proposal defaults to PROPOSED + prompt', () => {
  const p = buildProposal({ tool: 'hotkey', args: { keys: 'ctrl+s' } });
  assert.equal(p.type, 'agent/action_proposed');
  assert.equal(p.payload.status, 'PROPOSED');
  assert.match(p.payload.prompt, /hotkey/);
});
