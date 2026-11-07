#!/usr/bin/env node
// Compare the Rust/WASM kernels with the original JavaScript implementations.
//   node tools/wasm-bench.mjs
// Numbers are wall-clock medians on this machine; run the parity suite first.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { core, initWasm, wasmReady } from '../client/js/wasm/core.js';
import { computeVisibilityJs } from '../client/js/render/visgraph.js';
import { decodePngJs } from '../client/js/util/png.js';
import { aabbInFrustumJs, frustumPlanesJs } from '../client/js/gfx/math.js';
import { decodeSectionJs } from '../client/js/world/chunk.js';
import { blocksByName, getBlock, initBlocks, states as blockStates } from '../client/js/world/blocks.js';
import { Reader, Writer } from '../client/js/net/buffer.js';
import { readNbtRoot, writeNbtRoot } from '../client/js/net/nbt.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (name) => JSON.parse(readFileSync(join(root, 'client', 'data', name), 'utf8'));
initBlocks(readJson('blocks.json'), readJson('blockCollisionShapes.json'));

await initWasm();
if (!wasmReady()) {
  console.error('WASM core failed to load; run node rust/build.mjs');
  process.exit(1);
}

const now = () => performance.now();
function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}
function time(label, iterations, fn) {
  for (let i = 0; i < Math.min(iterations, 20); i++) fn(i); // warm-up
  const samples = [];
  for (let run = 0; run < 5; run++) {
    const start = now();
    for (let i = 0; i < iterations; i++) fn(i);
    samples.push(now() - start);
  }
  const ms = median(samples);
  return { label, ms, perOp: (ms * 1000) / iterations };
}

let seed = 123456789;
function random() {
  seed ^= seed << 13; seed >>>= 0;
  seed ^= seed >>> 17;
  seed ^= seed << 5; seed >>>= 0;
  return seed / 0x100000000;
}
const randInt = (n) => Math.floor(random() * n);

const stateFlags = new Uint8Array(blockStates.length);
for (let i = 0; i < blockStates.length; i++) {
  const b = getBlock(i);
  let f = 0;
  if (b && b.opaque) f |= 1;
  if (b && b.name && b.name.endsWith('_leaves')) f |= 2;
  stateFlags[i] = f;
}
const palette = [0, blocksByName.stone?.defaultState ?? 1, blocksByName.oak_leaves?.defaultState ?? 1, blocksByName.glass?.defaultState ?? 1];
const sections = Array.from({ length: 32 }, () => {
  const section = new Uint16Array(4096);
  for (let i = 0; i < 4096; i++) if (random() < 0.35) section[i] = palette[randInt(palette.length)];
  return section;
});

function pushVarint(out, value) {
  value >>>= 0;
  do {
    let byte = value & 0x7f;
    value >>>= 7;
    if (value) byte |= 0x80;
    out.push(byte);
  } while (value);
}

function packSection(bits, paletteValues, values) {
  const out = [bits];
  if (bits <= 8) {
    pushVarint(out, paletteValues.length);
    for (const value of paletteValues) pushVarint(out, value);
  }
  const longCount = Math.ceil((4096 * bits) / 64);
  pushVarint(out, longCount);
  const longs = new Array(longCount).fill(0n);
  const mask = (1n << BigInt(bits)) - 1n;
  for (let i = 0; i < 4096; i++) {
    const bit = BigInt(i * bits);
    const word = Number(bit >> 6n);
    const shift = Number(bit & 63n);
    longs[word] |= (BigInt(values[i]) & mask) << BigInt(shift);
    if (shift + bits > 64) longs[word + 1] |= (BigInt(values[i]) & mask) >> BigInt(64 - shift);
  }
  const buffer = Buffer.alloc(longCount * 8);
  for (let i = 0; i < longCount; i++) buffer.writeBigUInt64BE(longs[i], i * 8);
  out.push(...buffer);
  return Uint8Array.from(out);
}

const sectionData = packSection(8, palette, Array.from({ length: 4096 }, () => randInt(palette.length)));
const jsBlocks = new Uint32Array(4096);
const wasmBlocks = new Uint32Array(4096);

const icon = readFileSync(join(root, 'client', 'apple-touch-icon.png'));
const roots = [];
for (let n = 0; n < 200; n++) {
  const fields = {};
  for (let i = 0; i < 10; i++) fields[`field_${i}`] = { t: 3, v: n * 100 + i };
  fields.name = { t: 8, v: 'bench' };
  fields.flags = { t: 7, v: Int8Array.from([1, 2, 3, 4, 5]) };
  fields.list = { t: 9, v: { et: 3, items: Array.from({ length: 8 }, (_, i) => ({ t: 3, v: i })) } };
  const writer = new Writer(256);
  writeNbtRoot(writer, { t: 10, name: 'root', v: fields });
  roots.push(writer.build());
}

const proj = [1.299, 0, 0, 0, 0, 1.732, 0, 0, 0, 0, -1.0002, -1, 0, 0, -0.1, 0];
const planes = frustumPlanesJs(proj);
const wasmFrustum = new core.Frustum();
wasmFrustum.from_matrix(proj);

const results = [];

results.push([
  'visgraph (16^3 flood fill)',
  time('js', 8000, (i) => computeVisibilityJs(sections[i % sections.length], i & 1)),
  time('wasm', 8000, (i) => core.compute_visibility_mask(sections[i % sections.length], stateFlags, i & 1)),
]);

results.push([
  'chunk section decode (4096 cells)',
  time('js', 2000, () => decodeSectionJs(sectionData, 0, jsBlocks)),
  time('wasm', 2000, () => core.decode_section(sectionData, wasmBlocks)),
]);

results.push([
  'PNG decode (180x180 RGBA)',
  time('js', 120, () => decodePngJs(icon)),
  time('wasm', 120, () => {
    const image = core.decode_png(icon);
    if (image) image.free();
  }),
]);

// Consume the result so the JIT cannot eliminate the JS loop.
let visibleCount = 0;
results.push([
  'frustum AABB test',
  time('js', 300000, () => { visibleCount += aabbInFrustumJs(planes, -8, 0, -8, 8, 16, 8) ? 1 : 0; }),
  time('wasm', 300000, () => { visibleCount += wasmFrustum.contains_aabb(-8, 0, -8, 8, 16, 8) ? 1 : 0; }),
]);

results.push([
  'NBT roundtrip (13-field compound)',
  time('js', 2000, (i) => {
    const bytes = roots[i % roots.length];
    const reader = new Reader(bytes);
    const parsed = readNbtRoot(reader);
    const writer = new Writer(256);
    writeNbtRoot(writer, parsed);
    return writer.build();
  }),
  time('wasm', 2000, (i) => core.nbt_roundtrip(roots[i % roots.length])),
]);

function format(perOp) {
  return perOp >= 1000 ? `${(perOp / 1000).toFixed(2)} ms` : `${perOp.toFixed(1)} µs`;
}

console.log('\nKernel benchmark (median of 5 runs, warm cache)\n');
console.log('kernel                              JS          WASM        speed-up');
console.log('--------------------------------------------------------------------');
for (const [name, js, wasm] of results) {
  const ratio = js.perOp / wasm.perOp;
  console.log(
    `${name.padEnd(34)} ${format(js.perOp).padStart(10)}  ${format(wasm.perOp).padStart(10)}  ${ratio.toFixed(2)}x`,
  );
}
wasmFrustum.free();
if (!visibleCount) console.log('');
