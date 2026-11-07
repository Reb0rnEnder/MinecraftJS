const { readFileSync } = require('node:fs');
const src = readFileSync('dist/worker-bundle.js', 'utf8');
await state.page.evaluate((text) => { window.__WORKER_TEXT = text; }, src);
console.log('staged', src.length, 'bytes of worker source');
