/**
 * WorkPulse <-> OpenClaw bridge.
 * Connects to ws://127.0.0.1:41789/ws like ide-companion does,
 * forwards OpenClaw lifecycle as ai/* events + operator proposals.
 *
 * Usage:
 *   node src/index.js --goal "Triage inbox" --agent OpenClaw
 */
let WebSocket = null;
try {
  WebSocket = require('ws');
} catch {
  // Allow contract tests to run without `npm install` (no WS needed).
  WebSocket = null;
}

const WS_URL = process.env.WORKPULSE_WS || 'ws://127.0.0.1:41789/ws';
const BRIDGE = process.env.BRIDGE || 'http://127.0.0.1:41789';

function parseArgs() {
  const out = { goal: 'OpenClaw operator session', agent: 'OpenClaw' };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--goal') out.goal = argv[i + 1] || out.goal;
    if (argv[i] === '--agent') out.agent = argv[i + 1] || out.agent;
  }
  return out;
}

function buildHandshake() {
  return { type: 'ide/handshake', payload: { ideName: 'OpenClaw', version: '0.1.0', workspaceRoot: process.cwd() } };
}

function buildRunStarted(runId, agent, goal) {
  return { type: 'ai/run_started', payload: { runId, agentName: agent, goal } };
}

function buildProposal({ actionId, tool, args, prompt, taskId, inferenceId }) {
  return {
    type: 'agent/action_proposed',
    payload: {
      actionId: actionId || 'act-' + Date.now(),
      inferenceId, taskId, tool, args: args || {},
      prompt: prompt || `Approve ${tool}?`,
      status: 'PROPOSED',
      createdAt: new Date().toISOString(),
    },
  };
}

async function proposeViaHttp({ tool, args, prompt, taskId }) {
  const res = await fetch(`${BRIDGE}/api/operator/propose`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tool, args: args || {}, prompt, taskId }),
  });
  if (!res.ok) throw new Error(`propose -> ${res.status}`);
  return res.json();
}

function connect({ goal, agent, onMessage }) {
  if (!WebSocket) {
    console.log('[openclaw-bridge] ws dependency missing — run `npm install` in openclaw-bridge/ for live bridge.');
    return null;
  }
  const ws = new WebSocket(WS_URL);
  const runId = 'openclaw-' + Date.now();
  ws.on('open', () => {
    ws.send(JSON.stringify(buildHandshake()));
    ws.send(JSON.stringify(buildRunStarted(runId, agent, goal)));
    console.log(`[openclaw-bridge] connected as ${agent}: ${goal}`);
  });
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (onMessage) onMessage(msg, ws, runId);
      if (msg.type === 'widget/operator_task') {
        console.log('[openclaw-bridge] operator task:', msg.payload.goal);
        ws.send(JSON.stringify({
          type: 'ai/status_update',
          payload: { runId, agentName: agent, status: 'WORKING', stepDescription: msg.payload.goal },
        }));
      }
      if (msg.type === 'agent/action_decided') {
        console.log(`[openclaw-bridge] action ${msg.payload.actionId} -> ${msg.payload.decision}`);
      }
    } catch (err) {
      console.log('[openclaw-bridge] parse error', err.message);
    }
  });
  ws.on('close', () => {
    console.log('[openclaw-bridge] disconnected, retrying in 4s…');
    setTimeout(() => connect({ goal, agent, onMessage }), 4000);
  });
  ws.on('error', () => ws.close());
  return ws;
}

if (require.main === module) {
  const { goal, agent } = parseArgs();
  connect({ goal, agent });
}

module.exports = { buildHandshake, buildRunStarted, buildProposal, proposeViaHttp, connect, WS_URL };
