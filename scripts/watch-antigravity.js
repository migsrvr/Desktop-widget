const fs = require('fs');
const path = require('path');
const http = require('http');

// Locate Antigravity brain directory
const homeDir = process.env.USERPROFILE || process.env.HOME || 'C:\\Users\\Miggy';
const brainDir = path.join(homeDir, '.gemini', 'antigravity-ide', 'brain');

console.log('[WorkPulse Watcher] Checking brain directory:', brainDir);

function getLatestTranscriptFile() {
  try {
    if (!fs.existsSync(brainDir)) return null;
    const dirs = fs.readdirSync(brainDir);
    let latestFile = null;
    let latestMtime = 0;

    for (const d of dirs) {
      const logFile = path.join(brainDir, d, '.system_generated', 'logs', 'transcript.jsonl');
      if (fs.existsSync(logFile)) {
        const stat = fs.statSync(logFile);
        if (stat.mtimeMs > latestMtime) {
          latestMtime = stat.mtimeMs;
          latestFile = logFile;
        }
      }
    }
    return latestFile;
  } catch (err) {
    console.error('[WorkPulse Watcher] Error scanning brain:', err);
    return null;
  }
}

function sendToWorkpulse(payload) {
  const data = JSON.stringify(payload);
  const req = http.request(
    {
      hostname: '127.0.0.1',
      port: 41789,
      path: '/api/ai/event',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    },
    (res) => {
      res.on('data', () => {});
    }
  );
  req.on('error', () => {
    // Desktop bridge not yet active
  });
  req.write(data);
  req.end();
}

let lastStepIndex = -1;
let lastAction = '';

function checkTranscript() {
  const file = getLatestTranscriptFile();
  if (!file) return;

  try {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);
    if (lines.length === 0) return;

    const lastLine = lines[lines.length - 1];
    const step = JSON.parse(lastLine);

    if (step.step_index !== lastStepIndex) {
      lastStepIndex = step.step_index;

      let description = 'Working on task...';
      let status = 'WORKING';
      let agentName = 'Gemini 3.8 Flash';

      if (step.source === 'USER_EXPLICIT') {
        description = 'Processing your request...';
        status = 'WORKING';
      } else if (step.tool_calls && step.tool_calls.length > 0) {
        const tc = step.tool_calls[0];
        let action = tc.name;
        if (tc.args) {
          try {
            const args = typeof tc.args === 'string' ? JSON.parse(tc.args) : tc.args;
            if (args.toolAction) action = args.toolAction;
            else if (args.toolSummary) action = args.toolSummary;
          } catch {}
        }
        description = `${action.replace(/"/g, '')}`;
        status = 'RUNNING_TOOLS';
      } else if (step.type === 'PLANNER_RESPONSE' && step.status === 'DONE') {
        if (step.content) {
          description = 'Awaiting your review / next task';
          status = 'WAITING_INPUT';
        } else {
          description = 'Thinking and planning next steps...';
          status = 'PLANNING';
        }
      }

      if (description !== lastAction) {
        lastAction = description;
        console.log(`[WorkPulse Watcher] ${status}: ${description}`);

        sendToWorkpulse({
          type: 'ai/status_update',
          payload: {
            runId: 'live-antigravity',
            agentName,
            status,
            stepDescription: description,
            currentStep: step.step_index,
          },
        });
      }
    }
  } catch (err) {
    // Ignore parse errors on active write
  }
}

console.log('[WorkPulse Watcher] Started live Antigravity telemetry watcher loop.');
setInterval(checkTranscript, 600);
checkTranscript();
