#!/usr/bin/env node
// Rust port progress ledger.
//
//   node tools/rust-port-status.mjs
//   node tools/rust-port-status.mjs --complete client/js/world/fluids.js
//   node tools/rust-port-status.mjs --partial client/js/game/physics.js=25
//
// Percentages describe how much of a JS file's algorithmic surface has a Rust
// implementation. Browser API glue (WebGL, DOM, workers, sockets) intentionally
// stays JavaScript and is not counted as ported.
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const clientDir = join(root, 'client', 'js');
const manifestPath = join(root, 'rust', 'port-status.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const info = statSync(path);
    if (info.isDirectory()) {
      if (name === 'pkg') continue; // generated wasm-bindgen output
      out.push(...walk(path));
    } else if (name.endsWith('.js')) {
      out.push(path);
    }
  }
  return out;
}

const files = walk(clientDir).map((path) => {
  const rel = relative(root, path).split(sep).join('/');
  const text = readFileSync(path, 'utf8');
  const lines = text === '' ? 0 : text.replace(/\n$/, '').split('\n').length;
  return { rel, lines, percent: manifest.files[rel] ?? 0 };
});

const totalLines = files.reduce((sum, file) => sum + file.lines, 0);
const portedLines = files.reduce((sum, file) => sum + (file.lines * file.percent) / 100, 0);
const complete = files.filter((file) => file.percent >= 100).length;
const partial = files.filter((file) => file.percent > 0 && file.percent < 100).length;
const pct = (value) => `${value.toFixed(2)}%`;

const [flag, assignment] = process.argv.slice(2);
if (flag === '--complete' || flag === '--partial') {
  if (!assignment) throw new Error(`${flag} needs a path${flag === '--partial' ? '=percent' : ''}`);
  const [path, value] = assignment.split('=');
  if (!files.some((file) => file.rel === path)) throw new Error(`Unknown JS file: ${path}`);
  const percent = flag === '--complete' ? 100 : Number(value);
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) throw new Error(`Invalid percent: ${value}`);
  manifest.files[path] = percent;
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  const updated = files.find((file) => file.rel === path);
  updated.percent = percent;
  const updatedLines = files.reduce((sum, file) => sum + (file.lines * file.percent) / 100, 0);
  console.log(`${path} -> ${percent}% | files ${complete}/${files.length} (${pct((complete / files.length) * 100)}) | weighted JS lines ${pct((updatedLines / totalLines) * 100)} (${Math.round(updatedLines)}/${totalLines})`);
  process.exit(0);
}

console.log(`Rust port status: ${complete}/${files.length} JS files complete (${pct((complete / files.length) * 100)}), ${partial} partial`);
console.log(`Weighted algorithm coverage: ${pct((portedLines / totalLines) * 100)} (${Math.round(portedLines)}/${totalLines} JS lines)`);
console.log('Partial files:');
for (const file of files.filter((f) => f.percent > 0 && f.percent < 100)) {
  console.log(`  ${file.percent.toString().padStart(3)}%  ${file.rel} (${file.lines} lines)`);
}
console.log('Unstarted files:', files.filter((file) => file.percent === 0).length);
console.log('\nLargest unstarted files:');
for (const file of files.filter((file) => file.percent === 0).sort((a, b) => b.lines - a.lines).slice(0, 30)) {
  console.log(`  ${file.lines.toString().padStart(5)} lines  ${file.rel}`);
}
