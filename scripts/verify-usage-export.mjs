import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const executable = path.resolve(process.argv[2] ?? `src-tauri/target/debug/workpulse${process.platform === 'win32' ? '.exe' : ''}`);
assert.ok(fs.existsSync(executable), 'Build the native executable before running this check.');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'session-usage-export-test-'));
const usage = path.join(root, 'private usage folder');
fs.mkdirSync(usage);
const original = path.join(root, 'original status script.cjs');
fs.writeFileSync(original, "let text='';process.stdin.on('data',c=>text+=c);process.stdin.on('end',()=>{let input;try{input=JSON.parse(text)}catch{input={}};process.stdout.write('ORIGINAL:'+String(input.testMarker??'unknown'))});");
function record(provider, command = null) {
  fs.writeFileSync(path.join(usage, `${provider}.integration.json`), JSON.stringify({ enabled: true, settings_path: path.join(root, 'settings.json'), original_status_line: command ? { type: 'command', command } : null, had_status_line: command !== null, installed_status_line: { type: 'command', command: 'test fixture' } }));
}
function run(provider, input) {
  const result = spawnSync(executable, ['--usage-export', provider, '--usage-dir', usage], { input: typeof input === 'string' ? input : JSON.stringify(input), encoding: 'utf8', timeout: 10_000, windowsHide: true });
  assert.equal(result.error, undefined, 'The headless exporter must exit promptly without starting the app.');
  assert.equal(result.status, 0, result.stderr);
  return result;
}
try {
  if (process.platform === 'win32' && fs.existsSync('C:/Program Files/Git/bin/bash.exe')) {
    record('claude', 'input=$(cat); printf "%s" "$input"');
    const payload = { rate_limits: { five_hour: { used_percentage: 5 } }, testMarker: 'original bash syntax' };
    assert.equal(run('claude', payload).stdout, JSON.stringify(payload), 'Claude status lines must retain their Git Bash shell and exact stdin.');
    fs.rmSync(path.join(usage, 'claude.json'), { force: true });
  }
  const quote = value => process.platform === 'win32' ? `"${value.replaceAll('\\', '/')}"` : `'${value.replaceAll("'", "'\\''")}'`;
  record('claude', `${quote(process.execPath)} ${quote(original)}`);
  const input = { testMarker: 'preserved', rate_limits: { five_hour: { used_percentage: 12, resets_at: 1893456000 }, seven_day: { used_percentage: 72, resets_at: 1894060800 } }, prompt: 'PRIVATE_PROMPT_DO_NOT_STORE', accessToken: 'PRIVATE_TOKEN_DO_NOT_STORE' };
  assert.equal(run('claude', input).stdout, 'ORIGINAL:preserved');
  if (process.platform === 'win32') {
    const psQuote = value => `'${value.replaceAll('\\', '/').replaceAll("'", "''")}'`;
    const script = `& ${psQuote(executable)} --usage-export claude --usage-dir ${psQuote(usage)}`;
    const encoded = Buffer.from(script, 'utf16le').toString('base64');
    const args = ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded];
    const result = spawnSync('powershell.exe', args, { input: JSON.stringify(input), encoding: 'utf8', timeout: 10_000, windowsHide: true });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, 'ORIGINAL:preserved', 'The portable launcher must forward original stdin.');
    if (fs.existsSync('C:/Program Files/Git/bin/bash.exe')) {
      const bashResult = spawnSync('C:/Program Files/Git/bin/bash.exe', ['-c', `powershell.exe ${args.join(' ')}`], { input: JSON.stringify(input), encoding: 'utf8', timeout: 10_000, windowsHide: true });
      assert.equal(bashResult.status, 0, bashResult.stderr);
      assert.equal(bashResult.stdout, 'ORIGINAL:preserved');
    }
  }
  const cache = path.join(usage, 'claude.json');
  const first = JSON.parse(fs.readFileSync(cache));
  assert.equal(first.windows.length, 2);
  assert.equal(first.windows[0].usedPercent, 12);
  assert.ok(!fs.readFileSync(cache, 'utf8').includes('PRIVATE_'));
  assert.equal(run('claude', input).stdout, 'ORIGINAL:preserved');
  assert.equal(JSON.parse(fs.readFileSync(cache)).receivedAt, first.receivedAt, 'An unchanged export must not renew freshness.');
  assert.equal(run('claude', '{incomplete').stdout, 'ORIGINAL:unknown');
  assert.equal(JSON.parse(fs.readFileSync(cache)).receivedAt, first.receivedAt);
  const configuration = path.join(usage, 'claude.integration.json');
  const disabled = JSON.parse(fs.readFileSync(configuration)); disabled.enabled = false;
  fs.writeFileSync(configuration, JSON.stringify(disabled));
  run('claude', { ...input, rate_limits: { five_hour: { used_percentage: 99 } } });
  assert.equal(JSON.parse(fs.readFileSync(cache)).windows[0].usedPercent, 12, 'A disconnected exporter must not resume writes.');

  record('gemini');
  run('antigravity', { quota: { 'gemini-weekly': { remaining_fraction: 0.12, reset_time: '2030-01-01T00:00:00Z' }, 'gemini-requests': { remaining_amount: 17 }, 'claude-weekly': { remaining_fraction: 0 } }, email: 'PRIVATE_EMAIL', transcript_path: 'PRIVATE_PATH' });
  const geminiText = fs.readFileSync(path.join(usage, 'gemini.json'), 'utf8');
  const gemini = JSON.parse(geminiText);
  assert.equal(gemini.provider, 'gemini');
  assert.equal(gemini.windows.length, 2);
  assert.equal(gemini.windows.find(w => w.id === 'gemini-weekly').usedPercent, 88);
  assert.equal(gemini.windows.find(w => w.id === 'gemini-requests').usedPercent, null);
  assert.ok(!geminiText.includes('PRIVATE_') && !geminiText.includes('claude-weekly'));
  console.log('PASS: native headless startup, paths with spaces, original stdin/stdout, quota-only caches, unchanged freshness, malformed input, disconnect, and Antigravity bucket isolation.');
} finally {
  const absoluteRoot = path.resolve(root);
  assert.ok(absoluteRoot.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(absoluteRoot).startsWith('session-usage-export-test-'));
  fs.rmSync(absoluteRoot, { recursive: true, force: true });
}
