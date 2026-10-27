// Headless-Chrome smoke test via raw CDP (no puppeteer dependency).
// Usage: node tests/smoke.js
// Exits non-zero on any failed assertion; fails on page console errors.
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const PORT = 9342;
const FILE = 'file://' + path.resolve(__dirname, '..', 'index.html');
let failures = 0;
const pageErrors = [];
function check(name, cond, extra) {
  console.log((cond ? 'ok - ' : 'FAIL - ') + name + (cond ? '' : ' :: ' + (extra || '')));
  if (!cond) failures++;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function poll(fn, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { if (await fn()) return true; } catch (e) { /* retry */ }
    await wait(200);
  }
  return false;
}

(async () => {
  const chrome = spawn('/opt/meta-chromium/chrome', [
    '--headless=new', '--no-sandbox', '--disable-gpu',
    '--remote-debugging-port=' + PORT, '--user-data-dir=/tmp/cube-smoke-' + process.pid,
    'about:blank',
  ], { stdio: 'ignore' });
  let targets = [];
  for (let i = 0; i < 50 && targets.length === 0; i++) {
    await wait(200);
    try {
      targets = JSON.parse(await new Promise((res, rej) => {
        http.get('http://127.0.0.1:' + PORT + '/json/list', (r) => {
          let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => res(d));
        }).on('error', rej);
      }));
    } catch (e) { /* retry */ }
  }
  if (!targets.length) { console.log('FAIL - chrome did not start'); process.exit(2); }
  const wsUrl = targets[0].webSocketDebuggerUrl;
  const ws = new WebSocket(wsUrl);
  await new Promise((res) => { ws.onopen = res; });
  let seq = 0; const pending = new Map();
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      pageErrors.push(JSON.stringify(msg.params.args));
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      pageErrors.push(JSON.stringify(msg.params.exceptionDetails).slice(0, 300));
    }
  };
  const send = (method, params) => new Promise((res) => {
    const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params }));
  });
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate', { url: FILE });
  await wait(1500);
  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
    if (r.result && r.result.exceptionDetails) return { error: JSON.stringify(r.result.exceptionDetails).slice(0, 300) };
    return r.result ? r.result.result.value : undefined;
  };

  check('page title contains Cube', (await ev('document.title'))?.includes('Cube'));
  const scramble = await ev(`window.__cube.getScramble()`);
  check('scramble has 20 moves', typeof scramble === 'string' && scramble.trim().split(/\s+/).length === 20, String(scramble));
  check('scramble rendered on page', (await ev(`document.getElementById('scrambleText').textContent`)) === scramble);
  check('initial solve count is 0', (await ev(`document.getElementById('statCount').textContent`)) === '0');

  // Timer via hooks: start, wait, stop -> 1 solve recorded, new scramble issued.
  await ev(`window.__cube.startTimer()`);
  check('timer state is running', (await ev(`window.__cube.getState()`)) === 'running');
  await wait(650);
  const disp = await ev(`document.getElementById('timeDisplay').textContent`);
  check('display ticks past 0.00 while running', disp !== '0.00', String(disp));
  await ev(`window.__cube.stopAndRecord()`);
  check('timer back to idle after stop', (await ev(`window.__cube.getState()`)) === 'idle');
  check('1 solve recorded', (await ev(`window.__cube.getSolves()`))?.length === 1);
  check('new scramble after recording', (await ev(`window.__cube.getScramble()`)) !== scramble);

  // Deterministic Ao5 scenario: clear, add 5 manual times, verify Ao5 = 11.00.
  await ev(`window.__cube.clearAllDirect()`);
  for (const t of ['10.00', '12.00', '11.00', '13.00', '9.00']) {
    const ok = await ev(`window.__cube.addManual(${JSON.stringify(t)})`);
    check('manual add ' + t + ' accepted', ok === true);
  }
  check('count is 5', (await ev(`document.getElementById('statCount').textContent`)) === '5');
  check('best is 9.00', (await ev(`document.getElementById('statBest').textContent`)) === '9.00');
  check('Ao5 is 11.00 (trimmed mean of 10,12,11,13,9)', (await ev(`document.getElementById('statAo5').textContent`)) === '11.00');
  check('Ao12 is dash with only 5 solves', (await ev(`document.getElementById('statAo12').textContent`)) === '—');
  check('history has 5 rows', (await ev(`document.querySelectorAll('#historyList li').length`)) === 5);

  // +2 penalty on the first solve (10.00 -> 12.00): Ao5 becomes 11.67.
  await ev(`window.__cube.setPenalty(0, '+2')`);
  check('Ao5 after +2 is 11.67', await poll(async () =>
    (await ev(`document.getElementById('statAo5').textContent`)) === '11.67', 3000),
    await ev(`document.getElementById('statAo5').textContent`));

  // Invalid manual input rejected, count unchanged.
  const bad = await ev(`window.__cube.addManual('abc')`);
  check('invalid manual time rejected', bad === false);
  check('count still 5 after bad input', (await ev(`window.__cube.getSolves()`))?.length === 5);

  // Language toggle + Bengali digits.
  await ev(`document.getElementById('langBtn').click()`);
  check('html lang switches to bn', (await ev(`document.documentElement.lang`)) === 'bn');
  check('lang button now reads English', (await ev(`document.getElementById('langBtn').textContent`)) === 'English');
  check('count uses Bengali digits', /[\u09e6-\u09ef]/.test(String(await ev(`document.getElementById('statCount').textContent`))), String(await ev(`document.getElementById('statCount').textContent`)));

  // 390px mobile check via emulation.
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await wait(600);
  const overflow = await ev(`document.documentElement.scrollWidth > 390 + 5`);
  check('390px viewport: no horizontal overflow', overflow === false, 'scrollWidth exceeded');
  check('no page console/exception errors', pageErrors.length === 0, pageErrors.join(' | '));

  ws.close(); chrome.kill();
  console.log(failures === 0 ? 'SMOKE GREEN' : 'SMOKE FAILURES: ' + failures);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error('SMOKE HARNESS ERROR', e); process.exit(2); });
