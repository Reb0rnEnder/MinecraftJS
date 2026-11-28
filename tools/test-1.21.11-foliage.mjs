import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { initBlocks, findState, blocksByName } from '../client/js/world/blocks.js';
import { initBiomes, setServerBiomeEntries, biomeInfo, grassColor, foliageColor, dryFoliageColor, waterColor } from '../client/js/world/biomes.js';
import { biomeInfoNoise } from '../client/js/world/biome-info-noise.js';
import { Mesher } from '../client/js/render/mesher.js';
import { ItemRenderer } from '../client/js/render/item-renderer.js';
import { KNOWN_PACK_774 } from '../client/js/net/known-pack-1.21.11.js';
import { simplify } from '../client/js/net/nbt.js';
import { nativeBiomeData } from './port-1.21.11/biome-data.mjs';

const json = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const oracle = json('fixtures/foliage-1.21.11.json');
const biomes = json('../client/data/biomes.json');
initBlocks(json('../client/data/blocks.json'), json('../client/data/blockCollisionShapes.json'));

function readColormapPng(relPath) {
  const buf = readFileSync(new URL('../' + relPath, import.meta.url));
  let off = 8, w = 0, h = 0;
  const chunks = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.subarray(off + 4, off + 8).toString('ascii');
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); }
    else if (type === 'IDAT') chunks.push(data);
    off += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(chunks));
  const bpp = raw.length / h === 1 + w * 4 ? 4 : 3;
  const out = new Uint8ClampedArray(w * h * 4);
  const stride = w * bpp, prev = new Uint8Array(stride);
  const paeth = (a, b, c) => {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < h; y++) {
    const ro = y * (1 + stride), f = raw[ro], cur = new Uint8Array(stride);
    for (let x = 0; x < stride; x++) {
      const v = raw[ro + 1 + x], a = x >= bpp ? cur[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      cur[x] = (v + (f === 0 ? 0 : f === 1 ? a : f === 2 ? b : f === 3 ? ((a + b) >> 1) : paeth(a, b, c))) & 255;
    }
    prev.set(cur);
    for (let x = 0; x < w; x++) {
      const si = x * bpp, di = (y * w + x) * 4;
      out[di] = cur[si]; out[di + 1] = cur[si + 1]; out[di + 2] = cur[si + 2]; out[di + 3] = bpp === 4 ? cur[si + 3] : 255;
    }
  }
  return out;
}

const grassPixels = readColormapPng('client/assets/minecraft/textures/colormap/grass.png');
const foliagePixels = readColormapPng('client/assets/minecraft/textures/colormap/foliage.png');
const dryFoliagePixels = readColormapPng('client/assets/minecraft/textures/colormap/dry_foliage.png');
initBiomes(biomes, grassPixels, foliagePixels, dryFoliagePixels);
setServerBiomeEntries([]);

test('native block and item color registrations match the target Java oracle, including bush, wildflowers and leaf_litter', () => {
  const plainsId = biomes.find((b) => b.name === 'plains').id;
  const usedResolvers = new Set();
  const m = {
    biomeBlend: (x, y, z, fn) => {
      assert.ok([grassColor, foliageColor, dryFoliageColor, waterColor].includes(fn), 'Unexpected resolver');
      usedResolvers.add(fn);
      return fn(plainsId, y, x, z);
    }
  };
  const item = { assets: { grassPixels } };
  const skipItemDefault = new Set(['minecraft:water', 'minecraft:seagrass', 'minecraft:tall_seagrass', 'minecraft:potted_fern']);
  for (const [key, expected] of Object.entries(oracle.blocks)) {
    const name = key.slice(10), state = blocksByName[name].defaultState;
    if (key === 'minecraft:water') {
      assert.equal(Mesher.prototype.biomeBlend.call({ options: { biomeBlendRadius: 0 }, world: { getBiome: () => plainsId } }, 3, 64, 7, waterColor), expected.world[0]);
    } else {
      for (let tint = 0; tint < 2; tint++) {
        const want = expected.world[tint] === -1 ? 0xffffff : expected.world[tint];
        assert.equal(Mesher.prototype.tintFor.call(m, state, tint, 3, 64, 7), want, `${key} block ${tint}`);
      }
    }
    if (!skipItemDefault.has(key)) {
      for (const color of expected.item) {
        const want = color === -1 ? 0xffffff : color;
        assert.equal(ItemRenderer.prototype._defaultTint.call(item, name), want, `${key} item`);
      }
    }
  }
  assert.ok(usedResolvers.has(grassColor) && usedResolvers.has(foliageColor) && usedResolvers.has(dryFoliageColor));
});

test('all native fallback biomes contain the exact shipped climate and color effects', () => {
  assert.deepEqual(biomes, nativeBiomeData(biomes));
  assert.equal(biomes.length, 65);
  for (const [name, points] of Object.entries(oracle.biomes)) {
    const id = biomes.find((b) => b.name === name.slice(10)).id;
    for (const p of points) {
      for (const y of [-64, 64, 250, 319]) {
        assert.equal(grassColor(id, y, p.x, p.z), p.grass, `${name} grass at ${y}`);
        assert.equal(foliageColor(id, y), p.foliage, `${name} foliage at ${y}`);
        assert.equal(dryFoliageColor(id, y), p.dryFoliage, `${name} dryFoliage at ${y}`);
      }
    }
  }
});

test('swamp noise and both native grass colors match actual native Java samples', () => {
  const swampId = biomes.find((b) => b.name === 'swamp').id;
  const colors = new Set();
  for (const p of oracle.noise) {
    assert.ok(Math.abs(biomeInfoNoise(p.x, p.z) - p.value) < 1e-12);
    assert.equal(grassColor(swampId, 64, p.x, p.z), p.grass);
    colors.add(p.grass);
  }
  assert.equal(colors.size, 2);
});

test('server registry IDs, custom grass modifiers and overrides govern blended colors', () => {
  const native = KNOWN_PACK_774.registries['minecraft:worldgen/biome'].find((e) => e.key === 'minecraft:cherry_grove');
  setServerBiomeEntries([
    { id: 400, name: native.key, element: simplify(native.value) },
    {
      id: 401,
      name: 'test:forest',
      element: {
        temperature: 0.4,
        downfall: 0.8,
        effects: { grass_color: 0xabcdef, grass_color_modifier: 'dark_forest', foliage_color: 0x123456, dry_foliage_color: 0x654321 }
      }
    }
  ]);
  const m = { options: { biomeBlendRadius: 0 }, world: { getBiome: () => 400 } };
  assert.equal(Mesher.prototype.biomeBlend.call(m, 100, 200, 50, grassColor), 0xb6db61);
  assert.equal(grassColor(401, 200), ((0xabcdef & 0xfefefe) + 0x28340a) >> 1);
  assert.equal(foliageColor(401, 200), 0x123456);
  assert.equal(dryFoliageColor(401, 200), 0x654321);
  setServerBiomeEntries([]);
  assert.notEqual(biomeInfo(400).name, 'cherry_grove');
});

test('upper tall grass and fern color sample the lower half biome, and packed foliage uses the resource colormap', () => {
  for (const name of ['tall_grass', 'large_fern']) {
    const calls = [], m = { biomeBlend: (...args) => { calls.push(args); return 123; } };
    Mesher.prototype.tintFor.call(m, findState(name, { half: 'upper' }), 0, 3, 100, 7);
    assert.equal(calls[0][1], 99);
  }
  const p = grassPixels.slice(), k = (127 * 256 + 127) * 4;
  p.set([12, 34, 56, 255], k);
  assert.equal(ItemRenderer.prototype._defaultTint.call({ assets: { grassPixels: p } }, 'short_grass'), 0x0c2238);
  assert.equal(ItemRenderer.prototype._defaultTint.call({ assets: { grassPixels: p } }, 'bush'), 0x0c2238);
});
