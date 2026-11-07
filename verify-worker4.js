const { readFileSync } = require('node:fs');
const src = readFileSync('dist/worker-bundle.js', 'utf8');
// (1) big data: URL worker (2 MB of padding payload => ~4 MB data URL)
const big = 'self.onmessage=e=>self.postMessage({n:' + new Array(1000).fill(1).join('+') + '});' + '/*' + 'x'.repeat(2 * 1024 * 1024) + '*/';
// (2) the real bundle as a blob: URL
const r1 = await state.page.evaluate(async ({ big }) => {
  return new Promise((resolve) => {
    let w;
    try { w = new Worker('data:text/javascript;charset=utf-8,' + encodeURIComponent(big)); }
    catch (e) { resolve({ phase: 'construct', error: String(e) }); return; }
    w.onerror = (e) => resolve({ phase: 'error', message: (e.message || '').slice(0, 120) });
    w.onmessage = (e) => resolve({ phase: 'message', data: JSON.stringify(e.data) });
    setTimeout(() => resolve({ phase: 'silent' }), 8000);
    w.postMessage({});
  });
}, { big });
console.log('2MB data worker:', JSON.stringify(r1));
const r2 = await state.page.evaluate(async ({ workerText }) => {
  return new Promise((resolve) => {
    let url;
    try { url = URL.createObjectURL(new Blob([workerText], { type: 'text/javascript' })); }
    catch (e) { resolve({ phase: 'blob', error: String(e) }); return; }
    let w;
    try { w = new Worker(url); } catch (e) { resolve({ phase: 'construct', error: String(e) }); return; }
    w.onerror = (e) => resolve({ phase: 'error', message: (e.message || '').slice(0, 160) });
    w.onmessage = (e) => resolve({ phase: 'message', data: JSON.stringify(e.data).slice(0, 120) });
    setTimeout(() => resolve({ phase: 'silent-timeout' }), 25000);
    setTimeout(() => { try { w.postMessage({ type: '__ping' }); } catch {} }, 2000);
  });
}, { workerText: src });
console.log('real blob worker:', JSON.stringify(r2));
