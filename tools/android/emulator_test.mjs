// Drives the app inside the emulator through its WebView (Chrome DevTools protocol, plain
// WebSocket), the way a person would: make an event two minutes ahead with a reminder, then wait
// for the phone to ring.
import { execSync } from 'node:child_process';

const out = process.argv[2] ?? 'emulator-out';
const log = (...a) => console.log('[e2e]', ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const targets = await (await fetch('http://127.0.0.1:9222/json')).json();
const target = targets.find((t) => t.type === 'page') ?? targets[0];
if (!target) throw new Error('no WebView page found');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res, rej) => {
  ws.onopen = res;
  ws.onerror = () => rej(new Error('websocket failed'));
});
let id = 0;
const pending = new Map();
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  } else if (msg.method === 'Runtime.exceptionThrown') {
    log('page exception:', JSON.stringify(msg.params.exceptionDetails?.exception?.description));
  }
};
const send = (method, params = {}) =>
  new Promise((res) => {
    id += 1;
    pending.set(id, res);
    ws.send(JSON.stringify({ id, method, params }));
  });
await send('Runtime.enable');
/** Runs `code` in the page and returns its value. */
async function ev(code) {
  const r = await send('Runtime.evaluate', {
    expression: `(async () => { ${code} })()`,
    awaitPromise: true,
    returnByValue: true,
  });
  if (r.result?.exceptionDetails) {
    throw new Error(r.result.exceptionDetails.exception?.description ?? 'page error');
  }
  return r.result?.result?.value;
}

const HELPERS = `
  const q = (s, root = document) => root.querySelector(s);
  const setInput = (el, v) => {
    const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
`;

await sleep(3000);
log('native?', JSON.stringify(await ev(`return {
  cap: window.Capacitor?.isNativePlatform?.(), bridge: window.androidBridge !== undefined,
  lang: navigator.language, title: document.title };`)));

// Dismiss the welcome card if it is there.
await ev(`${HELPERS}
  const b = [...document.querySelectorAll('.banner button')].find((x) => /Get started|ابدأ/.test(x.textContent));
  if (b) b.click();`);

await ev(`${HELPERS} q('.fab').click(); await wait(800);`);
const soon = await ev(`const d = new Date(Date.now() + 2 * 60000);
  const p = (n) => String(n).padStart(2, '0'); return p(d.getHours()) + ':' + p(d.getMinutes());`);
log('event time (device clock):', soon);
log('editor:', JSON.stringify(await ev(`${HELPERS}
  const dlg = q('.modal');
  setInput(q('.ed-title', dlg), 'Emulator test');
  await wait(200);
  setInput(q('input[type=time]', dlg), ${JSON.stringify(soon)});
  await wait(200);
  const sel = [...dlg.querySelectorAll('select')].find((s) => s.querySelector('option[value="1440"]'));
  if (sel) { setInput(sel, '0'); }
  await wait(200);
  return { hasReminderSelect: !!sel, reminder: sel?.value, time: q('input[type=time]', dlg)?.value };`)));
execSync(`adb exec-out screencap -p > ${out}/editor.png`);
await ev(`${HELPERS} q('.modal button[type=submit]').click(); await wait(4000);`);
log('banners after save:', JSON.stringify(await ev(`return [...document.querySelectorAll('.banner')].map((b) => b.textContent);`)));
execSync(`adb exec-out screencap -p > ${out}/after-save.png`);

// The app's own diagnostics.
log('diagnostics:', JSON.stringify(await ev(`${HELPERS}
  const open = [...document.querySelectorAll('button')].find((b) => /^(Settings|الإعدادات)$/.test(b.textContent.trim()));
  open?.click(); await wait(800);
  const check = [...document.querySelectorAll('button')].find((b) => /Check now|افحص الآن/.test(b.textContent));
  check?.click(); await wait(3000);
  return [...document.querySelectorAll('.reminder-diag-list li')].map((l) => l.textContent);`)));
await ev(`document.querySelector('.modal [aria-label]')?.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true }));`);

log('waiting for the reminder to ring…');
await sleep(150_000);
execSync('adb shell cmd statusbar expand-notifications');
await sleep(2000);
execSync(`adb exec-out screencap -p > ${out}/shade.png`);
ws.close();
