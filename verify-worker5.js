const { readFileSync } = require('node:fs');
const src = readFileSync('dist/worker-bundle.js', 'utf8');
const r = await state.page.evaluate(async ({ workerText }) => {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(new Blob([workerText], { type: 'text/javascript' }));
    let w;
    try { w = new Worker(url); } catch (e) { resolve({ phase: 'construct', error: String(e) }); return; }
    w.onerror = (e) => resolve({ phase: 'error', message: (e.message || '').slice(0, 160) });
    // Minimal init: empty registries like the JS fallback would feed it.
    w.onmessage = (e) => {
      if (e.data && e.data.type === 'ready') resolve({ phase: 'ready', data: JSON.stringify(e.data).slice(0, 80) });
    };
    w.postMessage({ type: 'init', models: {}, blockstates: {}, atlas: {}, blocksJson: '{}', shapesJson: '{}', biomesJson: '{}' });
    setTimeout(() => resolve({ phase: 'silent-timeout' }), 25000);
  });
}, { workerText: src });
console.log('blob worker init:', JSON.stringify(r));
