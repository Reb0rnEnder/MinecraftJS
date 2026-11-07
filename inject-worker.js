// inject-worker.js — embed the built worker source into verify-worker.js.
import { readFileSync, writeFileSync } from 'node:fs';
const src = readFileSync('dist/worker-bundle.js', 'utf8');
let v = readFileSync('verify-worker.js', 'utf8');
v = v.replace('WORKER_SOURCE_PLACEHOLDER', src);
writeFileSync('verify-worker.js', v);
console.log('injected', src.length, 'bytes');
