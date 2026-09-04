/**
 * Drives a real Chrome over CDP: navigate, click, type, screenshot.
 *
 * Exists because this app cannot be photographed any other way. Chrome's headless
 * `--screenshot` flag never completes service-worker registration, so the mock backend never
 * boots and every shot comes out blank; and jsdom has no pointer, so hover behaviour has no
 * coverage in the test suite at all. Both of those are checked here instead.
 *
 * No dependency: WebSocket is global in Node 24.
 *
 *   pnpm dev &
 *   node scripts/drive.mjs shots            # writes screenshots into ./shots
 *   node scripts/drive.mjs shots --keep     # leave Chrome running to look at it
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const OUT = process.argv[2] ?? 'shots';
const KEEP = process.argv.includes('--keep');
const PORT = 9333;
const APP = process.env.APP_URL ?? 'http://localhost:5173';

const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

mkdirSync(OUT, { recursive: true });

const chrome = spawn(
  CHROME,
  [
    `--remote-debugging-port=${PORT}`,
    ...(KEEP ? [] : ['--headless=new']),
    '--hide-scrollbars',
    '--no-first-run',
    `--user-data-dir=${path.join(tmpdir(), 'chromatics-cdp-profile')}`,
    '--window-size=1440,1000',
    'about:blank',
  ],
  { stdio: 'ignore' },
);

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let ws;
let nextId = 0;
const waiting = new Map();

/** Sends one CDP command and resolves with its result. */
export const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++nextId;
    waiting.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });

async function connect() {
  for (let i = 0; i < 40; i++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = targets.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      // Chrome has not opened the port yet.
    }
    await sleep(250);
  }
  throw new Error('Chrome did not expose a debugging target');
}

ws = new WebSocket(await connect());
await new Promise((resolve) => (ws.onopen = resolve));
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  const pending = waiting.get(message.id);
  if (!pending) return;
  waiting.delete(message.id);
  if (message.error) pending.reject(new Error(message.error.message));
  else pending.resolve(message.result);
};

await send('Page.enable');
await send('Runtime.enable');
await send('DOM.enable');

export async function evaluate(expression) {
  const result = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

export async function shot(name) {
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(data, 'base64'));
  console.log('  shot', name);
}

/** Polls an expression until it is truthy. Every wait in a real browser needs one of these. */
export async function waitFor(expression, label, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(expression)) return;
    await sleep(200);
  }
  throw new Error(`timed out waiting for ${label}`);
}

/** Clicks the button whose visible text matches exactly. */
export const clickText = (text) =>
  evaluate(
    `(() => { const b = [...document.querySelectorAll('button')]
       .find((b) => b.textContent.trim() === ${JSON.stringify(text)});
       if (!b) return false; b.click(); return true; })()`,
  );

/** Moves a real cursor onto an element - the only way to test hover. */
export async function hover(selector) {
  const box = await evaluate(
    `(() => { const e = document.querySelector(${JSON.stringify(selector)});
       if (!e) return null; const r = e.getBoundingClientRect();
       return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`,
  );
  if (!box) throw new Error(`no element matching ${selector}`);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...box, buttons: 0 });
}

export const scheme = (value) =>
  send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value }],
  });

export async function open(pathname = '/') {
  await send('Page.navigate', { url: `${APP}${pathname}` });
}

export function finish() {
  ws.close();
  if (!KEEP) chrome.kill();
}
