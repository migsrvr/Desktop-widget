import * as vscode from 'vscode';
import WebSocket from 'ws';

let ws: WebSocket | null = null;
let statusBarItem: vscode.StatusBarItem;
let reconnectTimer: NodeJS.Timeout | null = null;
let activeRunId: string | null = null;

const WS_URL = 'ws://127.0.0.1:41789/ws';

function getActiveRunId(): string {
  if (!activeRunId) {
    activeRunId = 'vscode-run-' + Date.now();
  }
  return activeRunId;
}

export function activate(context: vscode.ExtensionContext) {
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'workpulse.connect';
  context.subscriptions.push(statusBarItem);
  statusBarItem.show();

  connectToWorkpulse(context);

  // Monitor Active Document Changes
  const docChangeSub = vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (editor && editor.document && ws && ws.readyState === WebSocket.OPEN) {
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
      const relativePath = workspaceFolder
        ? vscode.workspace.asRelativePath(editor.document.uri)
        : editor.document.fileName;

      sendPayload({
        type: 'ide/active_file',
        payload: {
          filePath: relativePath,
          languageId: editor.document.languageId,
        },
      });
    }
  });
  context.subscriptions.push(docChangeSub);

  // Auto-report saved files as ai/files_changed so the widget's
  // "N files changed" counter updates live without manual simulation.
  const fileSaveSub = vscode.workspace.onDidSaveTextDocument((doc) => {
    try {
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(doc.uri);
      const relativePath = workspaceFolder
        ? vscode.workspace.asRelativePath(doc.uri)
        : doc.fileName;
      sendPayload({
        type: 'ai/files_changed',
        payload: {
          runId: getActiveRunId(),
          filePaths: [relativePath],
        },
      });
    } catch (err) {
      console.error('WorkPulse file save telemetry error', err);
    }
  });
  context.subscriptions.push(fileSaveSub);

  // Register Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('workpulse.connect', () => {
      vscode.window.showInformationMessage('WorkPulse: Reconnecting to desktop widget...');
      connectToWorkpulse(context);
    }),
    vscode.commands.registerCommand('workpulse.simulateAiStart', () => {
      activeRunId = 'vscode-run-' + Date.now();
      sendPayload({
        type: 'ai/run_started',
        payload: {
          runId: activeRunId,
          agentName: 'Gemini 3.8 Flash',
          goal: 'Refactoring SQLite schema & query planner',
        },
      });
      vscode.window.showInformationMessage('WorkPulse: Sent AI run start event');
    }),
    vscode.commands.registerCommand('workpulse.simulateAiWaiting', () => {
      sendPayload({
        type: 'ai/waiting_input',
        payload: {
          runId: getActiveRunId(),
          prompt: 'Execute database migration script on production replica?',
          toolName: 'run_command',
        },
      });
      vscode.window.showWarningMessage('WorkPulse: Sent AI waiting approval event');
    }),
    vscode.commands.registerCommand('workpulse.simulateAiDone', () => {
      sendPayload({
        type: 'ai/run_finished',
        payload: {
          runId: getActiveRunId(),
          status: 'COMPLETED',
          summary: 'All database queries optimized and verified',
        },
      });
      vscode.window.showInformationMessage('WorkPulse: Sent AI completed event');
    }),
    vscode.commands.registerCommand('workpulse.simulateFilesChanged', async () => {
      const input = await vscode.window.showInputBox({
        prompt: 'File paths changed (comma-separated)',
        value: 'src/db/schema.sql',
      });
      if (!input) return;
      const filePaths = input.split(',').map((s) => s.trim()).filter(Boolean);
      if (filePaths.length === 0) return;
      sendPayload({
        type: 'ai/files_changed',
        payload: { runId: getActiveRunId(), filePaths },
      });
      vscode.window.showInformationMessage(`WorkPulse: Sent ${filePaths.length} file(s) changed event`);
    }),
    vscode.commands.registerCommand('workpulse.simulateTestsResult', async () => {
      const status = await vscode.window.showQuickPick(['RUNNING', 'PASSED', 'FAILED'], {
        placeHolder: 'Select test result to send',
      });
      if (!status) return;
      sendPayload({
        type: 'ai/tests_result',
        payload: {
          runId: getActiveRunId(),
          status: status as 'RUNNING' | 'PASSED' | 'FAILED',
          summary: `Manual ${status.toLowerCase()} report from VS Code`,
        },
      });
      vscode.window.showInformationMessage(`WorkPulse: Sent tests ${status.toLowerCase()} event`);
    })
  );
}

function connectToWorkpulse(context: vscode.ExtensionContext) {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  updateStatusBar(false, 'Connecting...');

  try {
    if (ws) {
      ws.removeAllListeners();
      ws.close();
    }

    ws = new WebSocket(WS_URL);

    ws.on('open', () => {
      updateStatusBar(true, 'Connected');

      // Send initial Handshake
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
      sendPayload({
        type: 'ide/handshake',
        payload: {
          ideName: 'VS Code',
          version: vscode.version,
          workspaceRoot,
        },
      });
    });

    ws.on('message', (data: WebSocket.Data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'widget/open_task_in_ide') {
          vscode.window.showInformationMessage(
            `WorkPulse Focus: Opening task "${msg.payload.taskTitle}"`
          );
        }
      } catch (err) {
        console.error('WorkPulse message parse error', err);
      }
    });

    ws.on('close', () => {
      updateStatusBar(false, 'Disconnected');
      scheduleReconnect(context);
    });

    ws.on('error', () => {
      updateStatusBar(false, 'Offline');
      ws?.close();
    });
  } catch {
    updateStatusBar(false, 'Error');
    scheduleReconnect(context);
  }
}

function sendPayload(payload: unknown) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function updateStatusBar(connected: boolean, statusText: string) {
  if (!statusBarItem) return;
  if (connected) {
    statusBarItem.text = `$(pulse) WorkPulse: ${statusText}`;
    statusBarItem.tooltip = 'WorkPulse Desktop Widget Connected (127.0.0.1:41789)';
    statusBarItem.color = '#38bdf8';
  } else {
    statusBarItem.text = `$(circle-slash) WorkPulse: ${statusText}`;
    statusBarItem.tooltip = 'Click to reconnect to WorkPulse desktop companion';
    statusBarItem.color = '#8b949e';
  }
}

function scheduleReconnect(context: vscode.ExtensionContext) {
  if (!reconnectTimer) {
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connectToWorkpulse(context);
    }, 4000);
  }
}

export function deactivate() {
  if (ws) {
    ws.close();
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
  }
}
