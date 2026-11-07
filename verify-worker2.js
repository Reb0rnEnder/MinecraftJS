// verify-worker2.js
const r1 = await state.page.evaluate(async () => {
  return new Promise((resolve) => {
    let w;
    try {
      w = new Worker('data:text/javascript,self.onmessage=e=>self.postMessage({pong:true});');
    } catch (e) { resolve({ phase: 'construct', error: String(e) }); return; }
    w.onerror = (e) => resolve({ phase: 'error', message: e.message });
    w.onmessage = (e) => resolve({ phase: 'message', data: JSON.stringify(e.data) });
    setTimeout(() => resolve({ phase: 'silent' }), 5000);
    w.postMessage({});
  });
});
console.log('trivial data worker:', JSON.stringify(r1));
const r2 = await state.page.evaluate(async ({ workerText }) => {
  return new Promise((resolve) => {
    const url = 'data:text/javascript;charset=utf-8,' + encodeURIComponent(workerText);
    let w;
    try { w = new Worker(url); } catch (e) { resolve({ phase: 'construct', error: String(e) }); return; }
    w.onerror = (e) => resolve({ phase: 'error', message: e.message, line: e.lineno });
    w.onmessage = (e) => resolve({ phase: 'message', data: JSON.stringify(e.data).slice(0, 120) });
    setTimeout(() => resolve({ phase: 'silent-timeout' }), 20000);
  });
}, { workerText: window.__WORKER_TEXT });
console.log('real data worker:', JSON.stringify(r2));
