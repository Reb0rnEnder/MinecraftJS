import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Reader, Writer } from '../client/js/net/buffer.js';
import { readPalette774, decodeChunkData774 } from '../client/js/world/chunk-1.21.11.js';
import { World } from '../client/js/world/world.js';
import { Chunk, Section } from '../client/js/world/chunk.js';
import { buildSlice, SliceWorld } from '../client/js/world/slice.js';
import { packetHeight } from '../client/js/gui/debug-overlay.js';
import {
  initBiomes,
  setServerBiomeEntries,
  biomeInfo,
  parseColor,
  grassColor,
  foliageColor,
  dryFoliageColor,
  waterColor,
} from '../client/js/world/biomes.js';
import {
  sampleBiomeFog,
  biomeFogColor,
  biomeSkyColor,
  biomeWaterFogColor,
} from '../client/js/world/biome-effects.js';

function packFixedLongs(values, bits) {
  const perLong = Math.floor(64 / bits);
  const longCount = Math.ceil(values.length / perLong);
  const longs = new Array(longCount).fill(0n);
  for (let i = 0; i < values.length; i++) {
    const word = Math.floor(i / perLong);
    const shift = (i % perLong) * bits;
    longs[word] |= BigInt(values[i]) << BigInt(shift);
  }
  return longs;
}

function writePalette774(w, wireBits, palette, values, bits) {
  w.u8(wireBits);
  if (wireBits === 0) {
    w.varint(palette[0]);
    return;
  }
  if (palette) {
    w.varint(palette.length);
    for (const id of palette) w.varint(id);
  }
  for (const word of packFixedLongs(values, bits)) {
    w.i64(BigInt.asIntN(64, word));
  }
}

test('readPalette774 decodes 0-bit, 4-bit linear, 5-bit hashmap, 15-bit direct block palettes and 0/1/2/7-bit biome palettes without length prefix', () => {
  // 0-bit single value block palette (no long-array length prefix!)
  {
    const w = new Writer();
    writePalette774(w, 0, [42], [], 0);
    const r = new Reader(w.build());
    const out = readPalette774(r, 4096, 30000, 'blocks');
    assert.ok(out instanceof Uint16Array);
    assert.equal(out.length, 4096);
    assert.equal(out[0], 42);
    assert.equal(out[4095], 42);
    assert.equal(r.remaining(), 0);
  }

  // 2-bit wire width on blocks -> promotes to 4-bit linear (minLocal=4), 16 entries per long
  {
    const palette = [0, 1, 14, 25000];
    const indices = Array.from({ length: 4096 }, (_, i) => i % 4);
    const w = new Writer();
    writePalette774(w, 2, palette, indices, 4);
    const r = new Reader(w.build());
    const out = readPalette774(r, 4096, 30000, 'blocks');
    assert.equal(out[0], 0);
    assert.equal(out[1], 1);
    assert.equal(out[2], 14);
    assert.equal(out[3], 25000);
    assert.equal(out[4095], 25000);
    assert.equal(r.remaining(), 0);
  }

  // 5-bit hashmap block palette (perLong=12 -> entries cross 32-bit half boundary)
  {
    const palette = Array.from({ length: 20 }, (_, i) => 100 + i * 7);
    const indices = Array.from({ length: 4096 }, (_, i) => i % 20);
    const w = new Writer();
    writePalette774(w, 5, palette, indices, 5);
    const r = new Reader(w.build());
    const out = readPalette774(r, 4096, 30000, 'blocks');
    for (let i = 0; i < 4096; i++) assert.equal(out[i], palette[i % 20]);
    assert.equal(r.remaining(), 0);
  }

  // 15-bit direct global block palette (registrySize=29000 -> ceil(log2(29000))=15, perLong=4)
  {
    const values = Array.from({ length: 4096 }, (_, i) => (i * 17) % 29000);
    const w = new Writer();
    writePalette774(w, 15, null, values, 15);
    const r = new Reader(w.build());
    const out = readPalette774(r, 4096, 29000, 'blocks');
    assert.ok(out instanceof Uint16Array);
    for (let i = 0; i < 4096; i++) assert.equal(out[i], values[i]);
    assert.equal(r.remaining(), 0);
  }

  // >65536 registry size uses Uint32Array
  {
    const values = Array.from({ length: 64 }, (_, i) => 70000 + i);
    const w = new Writer();
    writePalette774(w, 4, null, values, 17);
    const r = new Reader(w.build());
    const out = readPalette774(r, 64, 100000, 'biomes');
    assert.ok(out instanceof Uint32Array);
    for (let i = 0; i < 64; i++) assert.equal(out[i], values[i]);
    assert.equal(r.remaining(), 0);
  }

  // 0, 1, 2, and 7-bit biome palettes (64 entries, no length prefix)
  for (const [wireBits, biomeCount] of [[0, 128], [1, 128], [2, 128], [7, 100]]) {
    const w = new Writer();
    let expected;
    if (wireBits === 0) {
      expected = Array(64).fill(55);
      writePalette774(w, 0, [55], [], 0);
    } else if (wireBits <= 3) {
      const palette = wireBits === 1 ? [3, 44] : [3, 12, 44, 99];
      const indices = Array.from({ length: 64 }, (_, i) => i % palette.length);
      expected = indices.map(idx => palette[idx]);
      writePalette774(w, wireBits, palette, indices, wireBits);
    } else {
      // wireBits >= 4 -> GlobalPalette, bits = ceil(log2(100)) = 7
      expected = Array.from({ length: 64 }, (_, i) => (i * 3) % 100);
      writePalette774(w, wireBits, null, expected, 7);
    }
    const r = new Reader(w.build());
    const out = readPalette774(r, 64, biomeCount, 'biomes');
    assert.deepEqual([...out], expected);
    assert.equal(r.remaining(), 0);
  }
});

test('decodeChunkData774 decodes sections cleanly and rejects any trailing bytes including 0x00', () => {
  const buildSection = (w, nonAir, blockWireBits, blockPalette, blockValues, blockBits, biomeWireBits, biomePalette, biomeValues, biomeBits) => {
    w.u16(nonAir);
    writePalette774(w, blockWireBits, blockPalette, blockValues, blockBits);
    writePalette774(w, biomeWireBits, biomePalette, biomeValues, biomeBits);
  };

  const w = new Writer();
  // Section 0: 0-bit air, 0-bit biome 44
  buildSection(w, 0, 0, [0], [], 0, 0, [44], [], 0);
  // Section 1: 4-bit linear blocks, 1-bit biome
  buildSection(
    w,
    2048,
    4,
    [0, 1],
    Array.from({ length: 4096 }, (_, i) => i & 1),
    4,
    1,
    [5, 300],
    Array.from({ length: 64 }, (_, i) => i & 1),
    1,
  );
  // Section 2: 5-bit hashmap blocks, 2-bit biome
  const hashPalette = Array.from({ length: 18 }, (_, i) => i + 10);
  buildSection(
    w,
    4096,
    5,
    hashPalette,
    Array.from({ length: 4096 }, (_, i) => i % 18),
    5,
    2,
    [1, 2, 300, 400],
    Array.from({ length: 64 }, (_, i) => i % 4),
    2,
  );
  // Section 3: 15-bit direct blocks, 9-bit direct biome (biomeCount=500 -> ceil(log2(500))=9 bits)
  buildSection(
    w,
    4096,
    15,
    null,
    Array.from({ length: 4096 }, (_, i) => (i * 7 + 1) % 29000),
    15,
    4,
    null,
    Array.from({ length: 64 }, (_, i) => (i * 7) % 500),
    9,
  );

  const bytes = w.build();
  const decoded = decodeChunkData774(
    { x: 1, z: -2, chunkData: bytes },
    { stateCount: 29000, biomeCount: 500, sectionCount: 4, airStates: [0] },
  );
  assert.equal(decoded.sections.length, 4);
  assert.equal(decoded.sections[0].nonAir, 0);
  assert.equal(decoded.sections[1].nonAir, 2048);
  assert.equal(decoded.sections[2].blocks[1], 11);
  assert.equal(decoded.sections[3].blocks[2], 15);
  assert.equal(decoded.biomes[0], 44);
  assert.equal(decoded.biomes[64 + 1], 300);
  assert.equal(decoded.biomes[128 + 3], 400);
  assert.equal(decoded.biomes[192 + 63], (63 * 7) % 500);

  // Also verify 7-bit direct biome palette inside decodeChunkData774 (biomeCount=100 -> 7 bits)
  const w7 = new Writer();
  buildSection(w7, 0, 0, [0], [], 0, 7, null, Array.from({ length: 64 }, (_, i) => i % 100), 7);
  const d7 = decodeChunkData774({ x: 0, z: 0, chunkData: w7.build() }, { stateCount: 29000, biomeCount: 100, sectionCount: 1, airStates: [0] });
  assert.equal(d7.biomes[63], 63);

  // Unlike 762, 1.21.11 has no trailing zero-byte padding bug; even one trailing 0x00 must throw.
  const withTrailingZero = new Uint8Array(bytes.length + 1);
  withTrailingZero.set(bytes);
  assert.throws(
    () => decodeChunkData774(
      { x: 1, z: -2, chunkData: withTrailingZero },
      { stateCount: 29000, biomeCount: 500, sectionCount: 4, airStates: [0] },
    ),
    /Trailing 774 section data/,
  );
});

test('World.loadChunk774 and protocol-774 routing in loadChunk762 populate Chunk, biomes, light and heightmaps', () => {
  const w = new World();
  w.setDimension(0, { min_y: -64, height: 384, has_skylight: true });
  w.biomeRegistrySize = 512;
  w.blockStateRegistrySize = 29000;
  w.airStates = [0];

  const data = new Writer();
  for (let s = 0; s < w.sectionCount; s++) {
    if (s === 0) {
      data.u16(4096);
      writePalette774(data, 0, [1], [], 0);
      writePalette774(data, 0, [300], [], 0);
    } else {
      data.u16(0);
      writePalette774(data, 0, [0], [], 0);
      writePalette774(data, 0, [44], [], 0);
    }
  }

  let loadedCount = 0;
  let dirtyCount = 0;
  w.on('chunkLoaded', () => loadedCount++);
  w.on('sectionDirty', () => dirtyCount++);

  const hmLongs = packFixedLongs([384n, ...Array(255).fill(65n)], 9).map(v => BigInt.asIntN(64, v));
  const packet = {
    protocol: 774,
    x: 2,
    z: -3,
    groundUp: true,
    heightmaps: [{ type: 1, data: hmLongs }, { type: 'motion_blocking', data: hmLongs }],
    chunkData: data.build(),
    skyLight: { 0: new Uint8Array(2048).fill(0xab) },
    blockLight: { 0: new Uint8Array(2048).fill(0x21) },
    emptySkyLightMask: 0n,
    emptyBlockLightMask: 0n,
  };

  const c = w.loadChunk762(packet);
  assert.equal(loadedCount, 1);
  assert.ok(dirtyCount > 0);
  assert.equal(w.getState(32, -64, -48), 1);
  assert.equal(w.getState(32, -48, -48), 0);
  assert.equal(c.getSection(-3), null);
  assert.equal(w.getBiome(32, -48, -64), 300);
  assert.equal(w.getBiome(32, -48, -48), 44);
  assert.equal(c.getSkyLight(0, -64, 0), 11);
  assert.equal(c.getBlockLight(0, -64, 0), 1);
  assert.equal(packetHeight(c, 'WORLD_SURFACE', 0, 0), 319);
  assert.equal(packetHeight(c, 'MOTION_BLOCKING', 1, 0), 0);
});

test('packetHeight decodes 1.21.11 heightmap arrays by string or numeric type and retains legacy NBT fallback', () => {
  const c = new Chunk(0, 0, true, { minY: -64, height: 384 });
  const wsValues = Array.from({ length: 256 }, (_, i) => (i === 17 ? 129 : 65)); // (1,1) -> 129 + (-64) - 1 = 64
  const mbValues = Array.from({ length: 256 }, (_, i) => (i === 34 ? 384 : 1));  // (2,2) -> 384 + (-64) - 1 = 319
  const mlValues = Array.from({ length: 256 }, (_, i) => (i === 51 ? 200 : 1));  // (3,3) -> 200 + (-64) - 1 = 135

  const wsLongs = packFixedLongs(wsValues, 9).map(v => BigInt.asIntN(64, v));
  const mbLongs = packFixedLongs(mbValues, 9).map(v => BigInt.asIntN(64, v));
  const mlLongs = packFixedLongs(mlValues, 9).map(v => BigInt.asIntN(64, v));

  // String types
  c.heightmaps = [
    { type: 'world_surface', data: wsLongs },
    { type: 'motion_blocking', data: mbLongs },
    { type: 'motion_blocking_no_leaves', data: mlLongs },
  ];
  assert.equal(packetHeight(c, 'WORLD_SURFACE', 1, 1), 64);
  assert.equal(packetHeight(c, 'world_surface', 0, 0), 0);
  assert.equal(packetHeight(c, 1, 1, 1), 64);
  assert.equal(packetHeight(c, 'MOTION_BLOCKING', 2, 2), 319);
  assert.equal(packetHeight(c, 'MOTION_BLOCKING_NO_LEAVES', 3, 3), 135);
  assert.equal(packetHeight(c, 'OCEAN_FLOOR', 0, 0), -1);

  // Numeric enum IDs (1=WORLD_SURFACE, 4=MOTION_BLOCKING, 5=MOTION_BLOCKING_NO_LEAVES)
  c.heightmaps = [
    { type: 1, data: wsLongs },
    { type: 4, data: mbLongs },
    { type: 5, data: mlLongs },
  ];
  assert.equal(packetHeight(c, 'WORLD_SURFACE', 1, 1), 64);
  assert.equal(packetHeight(c, 'MOTION_BLOCKING', 2, 2), 319);
  assert.equal(packetHeight(c, 'MOTION_BLOCKING_NO_LEAVES', 3, 3), 135);

  // Legacy NBT compound fallback
  c.heightmaps = { t: 10, v: { WORLD_SURFACE: { t: 12, v: wsLongs } } };
  assert.equal(packetHeight(c, 'WORLD_SURFACE', 1, 1), 64);
});

test('setServerBiomeEntries supports 1.21.11 attributes, modifier objects, #rrggbb strings, dry_foliage_color and biome-effects', () => {
  const dryPixels = new Uint8ClampedArray(256 * 256 * 4);
  for (let i = 0; i < 256 * 256; i++) dryPixels.set([0xaa, 0xbb, 0xcc, 255], i * 4);
  initBiomes([{ id: 1, name: 'plains', temperature: 0.8, rainfall: 0.4, effects: { sky_color: 0x78a7ff, fog_color: 0xc0d8ff } }], null, null, dryPixels);

  assert.equal(parseColor('#78a7ff'), 0x78a7ff);
  assert.equal(parseColor('3F76E4'), 0x3f76e4);
  assert.equal(parseColor(0x123456), 0x123456);
  assert.equal(parseColor('invalid'), undefined);

  setServerBiomeEntries([
    {
      id: 300,
      name: 'minecraft:pale_garden',
      element: {
        has_precipitation: true,
        temperature: 0.7,
        downfall: 0.8,
        attributes: {
          'minecraft:visual/sky_color': '#b9b9b9',
          'minecraft:visual/fog_color': { argument: '#817f7c', modifier: 'override' },
          'minecraft:visual/water_fog_color': { value: 0x1e2b3c, modifier: 'override' },
          'minecraft:visual/ambient_particles': [{ particle: { type: 'minecraft:pale_oak_leaves' }, probability: 0.05 }],
          'minecraft:audio/background_music': { default: { sound: 'minecraft:music.overworld.forest', min_delay: 12000, max_delay: 24000 } },
          'minecraft:audio/ambient_sounds': {
            loop: 'minecraft:ambient.crimson_forest.loop',
            mood: { sound: 'minecraft:ambient.cave', tick_delay: 6000, offset: 2, block_search_extent: 8 },
            additions: [{ sound: 'minecraft:ambient.crimson_forest.additions', tick_chance: 0.01 }],
          },
        },
        effects: {
          water_color: '#76889d',
          foliage_color: '#878d76',
          dry_foliage_color: '#a17b54',
          grass_color: '#778272',
        },
      },
    },
    {
      id: 301,
      name: 'minecraft:desert_dry',
      element: {
        has_precipitation: false,
        temperature: 1.0,
        downfall: 0.0,
        attributes: {
          'minecraft:visual/sky_color': 0x78a7ff,
          'minecraft:visual/fog_color': 0xc0d8ff,
        },
        effects: {
          water_color: 0x3f76e4,
        },
      },
    },
  ]);

  const b = biomeInfo(300);
  assert.equal(b.name, 'pale_garden');
  assert.equal(b.effects.sky_color, 0xb9b9b9);
  assert.equal(b.effects.fog_color, 0x817f7c);
  assert.equal(b.effects.water_fog_color, 0x1e2b3c);
  assert.equal(b.waterFogColor, 0x1e2b3c);
  assert.equal(b.effects.water_color, 0x76889d);
  assert.equal(b.waterColor, 0x76889d);
  assert.equal(b.effects.foliage_color, 0x878d76);
  assert.equal(b.effects.dry_foliage_color, 0xa17b54);
  assert.equal(b.effects.grass_color, 0x778272);
  assert.equal(b.effects.particle.probability, 0.05);
  assert.equal(b.effects.particle.options.type, 'minecraft:pale_oak_leaves');
  assert.equal(b.effects.music.sound, 'minecraft:music.overworld.forest');
  assert.equal(b.effects.ambient_sound, 'minecraft:ambient.crimson_forest.loop');
  assert.equal(b.effects.mood_sound.sound, 'minecraft:ambient.cave');
  assert.equal(b.effects.additions_sound.sound, 'minecraft:ambient.crimson_forest.additions');

  assert.equal(grassColor(300, 64), 0x778272);
  assert.equal(foliageColor(300, 64), 0x878d76);
  assert.equal(dryFoliageColor(300, 64), 0xa17b54);
  assert.equal(waterColor(300), 0x76889d);
  assert.equal(dryFoliageColor(301, 64), 0xaabbcc);

  assert.equal(biomeSkyColor(300), 0xb9b9b9);
  assert.equal(biomeFogColor(300), 0x817f7c);
  assert.equal(biomeWaterFogColor(300), 0x1e2b3c);

  const fog = sampleBiomeFog({ getNoiseBiome: () => 300 }, 10, 64, 10);
  assert.ok(Math.abs(fog[0] - 0x81 / 255) < 1e-10);
  assert.ok(Math.abs(fog[1] - 0x7f / 255) < 1e-10);
  assert.ok(Math.abs(fog[2] - 0x7c / 255) < 1e-10);

  setServerBiomeEntries([]);
});

test('slice.js preserves biome IDs >= 256, promotes states to Uint32Array for > 65535, and aligns nativeLight section indices', () => {
  const w = new World();
  w.setDimension(0, { min_y: -64, height: 384, has_skylight: true });
  const c = new Chunk(0, 0, true, w);
  w.chunks.set('0,0', c);

  c.nativeLight = w._lightColumn(0, 0);
  c.nativeLight.sky[0 - w.minSection + 1] = new Uint8Array(2048).fill(0x99); // section sy=0 -> index 4
  c.nativeLight.block[0 - w.minSection + 1] = new Uint8Array(2048).fill(0x55);

  const sec = new Section(false, new Uint32Array(4096));
  sec.set(1, 2, 3, 70000);
  c.setSection(0, sec);

  c.biomes = new Uint32Array(w.sectionCount * 64);
  c.biomes.fill(300);
  c.biomes3D = true;

  const sl = buildSlice(w, 0, 0, 0);
  assert.ok(sl.biomes instanceof Uint16Array);
  assert.ok(sl.states instanceof Uint32Array);

  const sw = new SliceWorld(sl);
  assert.equal(sw.getBiome(1, 3, 2), 300);
  assert.equal(sw.getState(1, 2, 3), 70000);
  assert.equal(sw.getLight(1, 2, 3), 0x95);

  const sectionBlocks = sw.getSectionBlocks();
  assert.ok(sectionBlocks instanceof Uint32Array);
  assert.equal(sectionBlocks[(2 << 8) | (3 << 4) | 1], 70000);
});
