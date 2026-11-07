// make-offline.mjs — rebuild offlineclient.html as a single self-contained file.
// Bundles offline-entry.js + the wasm-bindgen glue + the embedded WASM into one
// inline IIFE <script> so the page works from file:// (ES-module imports are
// CORS-blocked on file://, but a classic inline script is not).
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = join(here, 'client', 'js', 'wasm', 'pkg');

const result = await build({
  entryPoints: [join(here, 'offline-entry.js')],
  bundle: true,
  minify: true,
  write: false,
  target: 'es2022',
  format: 'iife',
  legalComments: 'none',
  logLevel: 'warning',
  // The glue references import.meta.url inside a branch build.mjs already
  // replaced with a throw; esbuild keeps import.meta out of iife output.
});

const script = scriptSafe(result.outputFiles[0].text);
const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Gravrust — offline core check</title>
  <style>
    html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden;
      background: #1a1a2e; font-family: 'Segoe UI', system-ui, sans-serif; }
    #boot { display: flex; flex-direction: column; align-items: center; justify-content: center;
      height: 100%; gap: 16px; }
    #title { font-size: 28px; letter-spacing: 1px; color: #e94560; }
    #ver { color: #7fd17f; font-family: 'Consolas', monospace; }
    #status { color: #7f8c8d; font-size: 14px; max-width: 80%; text-align: center; }
  </style>
</head>
<body>
  <div id="boot">
    <div id="title">Gravrust</div>
    <div id="ver">loading Rust core&hellip;</div>
    <div id="status"></div>
  </div>
  <script>${script}</script>
</body>
</html>
`;

function scriptSafe(s) {
  return s.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');
}

const out = join(here, 'offlineclient.html');
writeFileSync(out, html);
console.log('offlineclient.html:', (html.length / 1024 / 1024).toFixed(2), 'MiB');
