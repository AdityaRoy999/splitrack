import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export function tailBytes(text, limit = 8192) {
  const buffer = Buffer.from(text);
  if (buffer.length <= limit) return text;
  let start = buffer.length - limit;
  while ((buffer[start] & 0xc0) === 0x80) start++;
  return buffer.subarray(start).toString('utf8');
}
export function logRedactor(env = process.env) {
  const masks = new Set(Object.entries(env).filter(([key, value]) => /TOKEN|SECRET|PASSWORD|PRIVATE_KEY|API_KEY/i.test(key) && value?.length >= 4).map(([, value]) => value));
  return line => {
    if (line.startsWith('::add-mask::')) { masks.add(line.slice(12).trim()); return '[additional secret masked]\n'; }
    let value = line.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');
    for (const secret of [...masks].filter(Boolean).sort((a, b) => b.length - a.length)) value = value.split(secret).join('***');
    value = value.replace(/\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)\b/g, '***')
      .replace(/data:text\/javascript;base64,[A-Za-z0-9+/=]+/g, 'data:text/javascript;[inline test module]');
    return value.length > 2000 ? `${value.slice(0, 2000)} [line truncated]\n` : value;
  };
}
export async function streamBuild({ command = 'bash', args = ['--noprofile', '--norc', '-e', '-o', 'pipefail'] } = {}) {
  const script = await new Promise((resolve, reject) => { let data = ''; process.stdin.setEncoding('utf8'); process.stdin.on('data', chunk => { data += chunk; }); process.stdin.on('end', () => resolve(data)); process.stdin.on('error', reject); });
  const platform = process.env.BUILD_LOG_PLATFORM, step = process.env.BUILD_LOG_STEP, stepIndex = Number(process.env.BUILD_LOG_INDEX);
  const enabled = ['android', 'ios'].includes(platform) && process.env.RELEASE_CONTROL_URL && process.env.ACTIONS_ID_TOKEN_REQUEST_URL && process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  const redact = logRedactor(), partial = { stdout: '', stderr: '' };
  let text = '', truncated = false, changed = true, sequence = 0, token, tokenUntil = 0, sending, warned = false;
  function append(line) { const next = text + redact(line); if (Buffer.byteLength(next) > 8192) truncated = true; text = tailBytes(next); changed = true; }
  async function identity() {
    if (token && tokenUntil > Date.now() + 30000) return token;
    const url = new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL); url.searchParams.set('audience', 'splittrack-releases');
    const response = await fetch(url, { headers: { Authorization: `Bearer ${process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}` }, signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error('Workflow identity unavailable.');
    token = (await response.json()).value;
    tokenUntil = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).exp * 1000;
    return token;
  }
  async function send(status = 'in_progress', conclusion) {
    if (!enabled || sending || (!changed && status === 'in_progress')) return;
    const snapshot = { platform, run_id: Number(process.env.GITHUB_RUN_ID), attempt: Number(process.env.GITHUB_RUN_ATTEMPT), commit: process.env.GITHUB_SHA, step, step_index: stepIndex, sequence: sequence++, text, truncated, status, ...(conclusion ? { conclusion } : {}) };
    changed = false;
    sending = (async () => {
      try {
        const url = new URL(process.env.RELEASE_CONTROL_URL);
        if (url.protocol !== 'https:' || !url.hostname.endsWith('.cloudfront.net')) throw new Error('Invalid log receiver.');
        const response = await fetch(`${url.origin}/api/pipelines/logs`, { method: 'POST', headers: { Authorization: `Bearer ${await identity()}`, 'Content-Type': 'application/json' }, body: JSON.stringify(snapshot), signal: AbortSignal.timeout(5000) });
        if (!response.ok) throw new Error(`Log receiver returned ${response.status}.`);
      } catch { changed = true; if (!warned) { console.error('::warning::Live log forwarding is unavailable; this command continues and its full output remains in GitHub Actions.'); warned = true; } }
    })();
    await sending; sending = undefined;
  }
  const initial = send();
  const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'], env: process.env });
  for (const name of ['stdout', 'stderr']) {
    child[name].setEncoding('utf8');
    child[name].on('data', chunk => { process[name].write(chunk); const lines = (partial[name] + chunk).split('\n'); partial[name] = lines.pop(); for (const line of lines) append(`${line}\n`); if (partial[name].length > 65536) { append(partial[name]); partial[name] = ''; } });
  }
  child.stdin.on('error', () => {}); child.stdin.end(script);
  let interrupted = false;
  const stop = signal => { interrupted = true; child.kill(signal); };
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
  const interval = setInterval(() => { void send(); }, 10000);
  const exit = await new Promise(resolve => { child.on('error', error => { append(`${error.message}\n`); resolve(1); }); child.on('close', code => resolve(code ?? 1)); });
  clearInterval(interval); await initial; if (sending) await sending;
  for (const value of Object.values(partial)) if (value) append(value);
  append(`\nCommand finished with exit code ${exit}.\n`);
  await send('completed', interrupted ? 'cancelled' : exit === 0 ? 'success' : 'failure');
  process.removeListener('SIGTERM', stop); process.removeListener('SIGINT', stop);
  process.exitCode = exit;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await streamBuild();
