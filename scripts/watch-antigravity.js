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
const seenFiles = new Set();
let lastTestStatus = '';

function looksLikeFilePath(s) {
  if (typeof s !== 'string') return false;
  const trimmed = s.trim().replace(/^["']|["']$/g, '');
  if (trimmed.length < 3 || trimmed.length > 500) return false;
  if (/\s{2,}/.test(trimmed)) return false;
  // Must contain a path separator or a file extension to avoid matching prose.
  if (!trimmed.includes('/') && !trimmed.includes('\\') && !/\.[a-zA-Z0-9]{1,5}$/.test(trimmed)) return false;
  return /\.[a-zA-Z0-9]{1,5}$/.test(trimmed);
}

function extractFilePaths(step) {
  const found = [];
  try {
    const toolCalls = step.tool_calls || [];
    for (const tc of toolCalls) {
      let args = tc.args;
      if (typeof args === 'string') {
        try { args = JSON.parse(args); } catch { /* keep raw string */ }
      }
      if (typeof args === 'string') {
        if (looksLikeFilePath(args)) found.push(args.trim());
        continue;
      }
      if (args && typeof args === 'object') {
        const stack = [args];
        while (stack.length > 0) {
          const cur = stack.pop();
          if (Array.isArray(cur)) {
            for (const v of cur) {
              if (typeof v === 'object' && v !== null) stack.push(v);
              else if (looksLikeFilePath(v)) found.push(String(v).trim());
            }
          } else if (cur && typeof cur === 'object') {
            for (const [k, v] of Object.entries(cur)) {
              if (typeof v === 'object' && v !== null) {
                stack.push(v);
              } else if (typeof v === 'string') {
                const keyHit = /file|path/i.test(k);
                if (keyHit && looksLikeFilePath(v)) found.push(v.trim());
                else if (!keyHit && looksLikeFilePath(v) && v.length < 200) found.push(v.trim());
              }
            }
          }
        }
      }
    }
  } catch { /* ignore extraction errors */ }
  return [...new Set(found)];
}

function detectTestStatus(description) {
  const lower = (description || '').toLowerCase();
  if (/tests?\s+(passed|passing)|all\s+tests?\s+green|0\s+failed/.test(lower)) return 'PASSED';
  if (/tests?\s+(failed|failing)|test\s+failure|1\+\s*failed/.test(lower)) return 'FAILED';
  if (/pytest|vitest|jest|npm\s+test|running\s+tests?|executing\s+unit\s+tests?/.test(lower)) return 'RUNNING';
  return '';
}

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
          description = 'Waiting for your next task';
          status = 'WAITING_INPUT';
        } else {
          description = 'Thinking and planning next steps...';
          status = 'PLANNING';
        }
      }

      // Always forward newly seen file paths + test signals, even when the
      // description text itself hasn't changed (e.g. multi-file edits).
      const filePaths = extractFilePaths(step);
      const freshFiles = filePaths.filter((f) => !seenFiles.has(f));
      for (const f of filePaths) seenFiles.add(f);
      if (freshFiles.length > 0) {
        console.log(`[WorkPulse Watcher] ${freshFiles.length} file(s) changed: ${freshFiles.slice(0, 3).join(', ')}`);
        sendToWorkpulse({
          type: 'ai/files_changed',
          payload: { runId: 'live-antigravity', filePaths: freshFiles },
        });
      }

      const testStatus = detectTestStatus(description);
      if (testStatus && testStatus !== lastTestStatus) {
        lastTestStatus = testStatus;
        console.log(`[WorkPulse Watcher] Tests ${testStatus.toLowerCase()}: ${description}`);
        sendToWorkpulse({
          type: 'ai/tests_result',
          payload: { runId: 'live-antigravity', status: testStatus, summary: description },
        });
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
