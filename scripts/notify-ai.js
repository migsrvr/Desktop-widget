#!/usr/bin/env node

/**
 * WorkPulse Dynamic Telemetry Relay
 * Used by Gemini 3.8 Flash and OpenCode (Muse 1.3) to push live status & tasks directly to WorkPulse.
 *
 * Usage:
 *   node scripts/notify-ai.js start "Gemini 3.8 Flash" "Analyzing architecture"
 *   node scripts/notify-ai.js update "Executing unit tests" 2 4
 *   node scripts/notify-ai.js waiting "Approve file modification"
 *   node scripts/notify-ai.js done "Successfully implemented feature"
 *   node scripts/notify-ai.js add-task "My new task title"
 */

const http = require('http');

const [,, command, arg1, arg2, arg3, arg4] = process.argv;

if (!command) {
  console.log('Usage: node notify-ai.js <start|update|waiting|done|add-task> [...]');
  process.exit(0);
}

function sendHttp(path, data) {
  const payload = JSON.stringify(data);
  const req = http.request(
    {
      hostname: '127.0.0.1',
      port: 41789,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    },
    (res) => {
      res.on('data', () => {});
      res.on('end', () => {
        console.log(`[WorkPulse] Sent ${command} event successfully (${res.statusCode})`);
      });
    }
  );

  req.on('error', (err) => {
    // If widget is not running yet, fail silently without breaking worker scripts
    console.log('[WorkPulse] Note: Desktop bridge at 127.0.0.1:41789 not active:', err.message);
  });

  req.write(payload);
  req.end();
}

switch (command) {
  case 'start': {
    const agentName = arg1 || 'Gemini 3.8 Flash';
    const goal = arg2 || 'Executing task slice';
    sendHttp('/api/ai/event', {
      type: 'ai/run_started',
      payload: {
        runId: 'run-' + Date.now(),
        agentName,
        goal,
      },
    });
    break;
  }
  case 'update': {
    const stepDesc = arg1 || 'Executing workflow step';
    const currentStep = arg2 ? parseInt(arg2, 10) : undefined;
    const totalSteps = arg3 ? parseInt(arg3, 10) : undefined;
    sendHttp('/api/ai/event', {
      type: 'ai/status_update',
      payload: {
        runId: 'active-run',
        status: 'WORKING',
        stepDescription: stepDesc,
        currentStep,
        totalSteps,
      },
    });
    break;
  }
  case 'waiting': {
    const prompt = arg1 || 'Approval required for operation';
    sendHttp('/api/ai/event', {
      type: 'ai/waiting_input',
      payload: {
        runId: 'active-run',
        prompt,
      },
    });
    break;
  }
  case 'done': {
    const summary = arg1 || 'AI run completed';
    sendHttp('/api/ai/event', {
      type: 'ai/run_finished',
      payload: {
        runId: 'active-run',
        status: 'COMPLETED',
        summary,
      },
    });
    break;
  }
  case 'add-task': {
    const title = arg1;
    if (!title) {
      console.error('Error: task title required');
      process.exit(1);
    }
    sendHttp('/api/ai/event', {
      type: 'task/create',
      payload: {
        id: 'task-' + Date.now(),
        title,
        status: 'NOW',
      },
    });
    break;
  }
  default:
    console.error('Unknown command:', command);
}
