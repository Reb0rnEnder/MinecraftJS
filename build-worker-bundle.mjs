// build-worker-bundle.mjs — produce the same worker bundle tools/build.js makes.
import { build } from 'esbuild';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const result = await build({
  entryPoints: [join(here, 'client', 'js', 'render', 'mesh-worker.js')],
  bundle: true,
  minify: true,
  write: false,
  target: 'es2022',
  format: 'iife',
  legalComments: 'none',
  logLevel: 'warning',
});
writeFileSync(join(here, 'dist', 'worker-bundle.js'), result.outputFiles[0].text);
console.log('worker bundle:', (result.outputFiles[0].text.length / 1024).toFixed(1), 'KiB');
