#!/usr/bin/env node
// Differential tests for the Rust/WASM core.
//
//   node tools/wasm-parity.mjs
//
// Every check runs the original JavaScript implementation and the ported Rust
// kernel on the same generated input and compares the results bit-for-bit.
// Run `node rust/build.mjs` first (npm run wasm does both).
import { readFileSync } from 'node:fs';
import { generateKeyPairSync } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

import { core, initWasm, wasmReady } from '../client/js/wasm/core.js';
import { computeVisibilityJs } from '../client/js/render/visgraph.js';
import { decodePngJs, encodePngJs } from '../client/js/util/png.js';
import { aabbInFrustumJs, frustumPlanesJs, mat4 } from '../client/js/gfx/math.js';
import { Chunk, decodeSectionJs } from '../client/js/world/chunk.js';
import { decodeChunkData498 } from '../client/js/world/chunk-1.14.4.js';
import { decodeChunkData578 } from '../client/js/world/chunk-1.15.2.js';
import { blocksByName, getBlock, getStateProperties, initBlocks, staticCollisionBoxes, states as blockStates } from '../client/js/world/blocks.js';
import { Reader, Writer } from '../client/js/net/buffer.js';
import { readNbtRoot, simplify as simplifyNbt, writeNbtRoot } from '../client/js/net/nbt.js';
import { decodeUtf8Js, encodeUtf8Js } from '../client/js/util/utf8.js';
import { decodeBase64Js } from '../client/js/util/base64.js';
import { PLAYER_POSES as PLAYER_POSES_114 } from '../client/js/game/player-poses-1.14.4.js';
import { playerPoseDimensions } from '../client/js/game/player-poses-1.15.2.js';
import { placementIntersects } from '../client/js/game/placement-collision.js';
import { scaffoldingCollision } from '../client/js/world/scaffolding.js';
import { JavaRandom as JavaRandomJs } from '../client/js/util/jrandom.js';
import { lodDistance, sectionLod, poseInterval } from '../client/js/render/lod.js';
import { CameraEye as CameraEyeJs } from '../client/js/render/camera-eye.js';
import { nameUuid } from '../client/js/util/uuid-md5.js';
import { getFluidState } from '../client/js/world/fluids.js';
import { moveParticle } from '../client/js/render/particle-collision.js';
import { waterFog } from '../client/js/render/water-fog.js';
import { biomeInfo, initBiomes, grassColor, foliageColor, waterColor, biomeRainType } from '../client/js/world/biomes.js';
import { CLIENTBOUND_498, SERVERBOUND_498 } from '../client/js/net/protocol-1.14.4-ids.js';
import { readCommandTree } from '../client/js/net/command-tree.js';
import { readRecipes } from '../client/js/net/recipes.js';
import { parseSnbt } from '../client/js/net/snbt.js';
import { leashEndpoints, leashGeometry } from '../client/js/render/leash.js';
import { animateFox, scaleFoxChild } from '../client/js/render/fox-pose.js';
import { animateOcelot } from '../client/js/render/ocelot-pose.js';
import { teamsCanPush, pushVector } from '../client/js/game/entity-pushing.js';
import { technicalPackets } from '../client/js/net/technical-packets.js';
import { parseAddress, isEaglerAddress, formatAddress, parseProxyUrl, proxyHttpBase } from '../client/js/net/address.js';
import { zoomStepJs } from '../client/js/game/zoom.js';
import { Cfb8 as Cfb8Js, rsaEncrypt, serverHash, sha1 as sha1Js } from '../client/js/util/mccrypto.js';
import { CLIENTBOUND_578, SERVERBOUND_578 } from '../client/js/net/protocol-1.15.2-ids.js';
import { World, rayBox } from '../client/js/world/world.js';
import { biomeZoomCellJs, biomeZoomOffsetJs } from '../client/js/world/biome-zoom.js';
import { buildSlice } from '../client/js/world/slice.js';
import { calcXOffset, calcYOffset, calcZOffset, honeyFallMultiplier, honeyJumpFactor, honeyMovementFactor, mcCos, mcSin, offsetBB } from '../client/js/game/physics.js';
import { ZipArchive as ZipArchiveWasm, ZipArchiveJs } from '../client/js/util/zip.js';
import { resolveState, stairsShape, doorProps, itemModelName } from '../client/js/world/blockstates.js';
import { ModelStore } from '../client/js/render/models.js';
import { craftResult, containerItem, initRecipes } from '../client/js/game/crafting.js';
import { SectionCuller, sectionKey as cullerSectionKey } from '../client/js/render/culling.js';
import { animationLookup, glslFloatLiterals, selectGLSLFunctions, shaderBlockRules } from '../client/js/render/glsl-functions.js';
import { activeGLSL, glslCondition } from '../client/js/render/glsl-preprocessor.js';
import { lightingOption, lightingFrame, packLighting } from '../client/js/render/shader-lighting.js';
import { baseFogColor, brightnessTable, buildStarPositions, celestialAngle, cloudColor, skyColor, starBrightness, sunBrightness, sunriseColors, updateLightmap } from '../client/js/render/sky.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (name) => JSON.parse(readFileSync(join(root, 'client', 'data', name), 'utf8'));

initBlocks(readJson('blocks.json'), readJson('blockCollisionShapes.json'));

let passed = 0;
let failed = 0;
const failures = [];

function check(name, ok, detail = '') {
  if (ok) {
    passed++;
  } else {
    failed++;
    failures.push(`${name}${detail ? `: ${detail}` : ''}`);
    if (failures.length <= 25) console.error(`FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function sameBytes(a, b) {
  if (a.length !== b.length) return `length ${a.length} != ${b.length}`;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return `byte ${i}: ${a[i]} != ${b[i]}`;
  return '';
}

const stateFlags = new Uint8Array(blockStates.length);
for (let i = 0; i < blockStates.length; i++) {
  const b = getBlock(i);
  let f = 0;
  if (b && b.opaque) f |= 1;
  if (b && b.name && b.name.endsWith('_leaves')) f |= 2;
  stateFlags[i] = f;
}

// Deterministic PRNG so failures are reproducible.
let seed = 0x5eed1234;
function random() {
  seed ^= seed << 13; seed >>>= 0;
  seed ^= seed >>> 17;
  seed ^= seed << 5; seed >>>= 0;
  return seed / 0x100000000;
}
const randInt = (n) => Math.floor(random() * n);

const air = 0;
const stone = blocksByName.stone?.defaultState ?? 1;
const leaves = blocksByName.oak_leaves?.defaultState ?? stone;
const glass = blocksByName.glass?.defaultState ?? stone;
const water = blocksByName.water?.defaultState ?? stone;

// ------------------------------------------------------------------ visgraph

function compareVisibility(name, section, fancy) {
  const js = computeVisibilityJs(section, fancy);
  const wasm = core.compute_visibility_mask(section, stateFlags, fancy);
  check(`visgraph ${name} fancy=${fancy}`, sameBytes(js, wasm) === '', sameBytes(js, wasm));
}

function visgraphTests() {
  const airs = () => new Uint16Array(4096);
  const all = (state) => new Uint16Array(4096).fill(state);

  compareVisibility('all-air', airs(), true);
  compareVisibility('all-stone', all(stone), true);
  compareVisibility('all-stone-fast', all(stone), false);
  compareVisibility('all-glass', all(glass), true);
  compareVisibility('all-water', all(water), true);
  compareVisibility('all-leaves-fancy', all(leaves), true);
  compareVisibility('all-leaves-fast', all(leaves), false);

  const floor = airs();
  for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) floor[z * 16 + x] = stone;
  compareVisibility('floor', floor, true);

  const wall = airs();
  for (let y = 0; y < 16; y++) for (let z = 0; z < 16; z++) wall[(y << 8) | (z << 4) | 7] = stone;
  compareVisibility('wall', wall, true);

  const checker = airs();
  for (let i = 0; i < 4096; i++) if (((i & 15) + ((i >> 4) & 15) + (i >> 8)) & 1) checker[i] = stone;
  compareVisibility('checkerboard', checker, true);

  const palette = [air, stone, leaves, glass, water];
  for (let n = 0; n < 120; n++) {
    const section = new Uint16Array(4096);
    const density = 0.05 + random() * 0.95;
    for (let i = 0; i < 4096; i++) {
      if (random() < density) section[i] = palette[randInt(palette.length)];
    }
    compareVisibility(`random-${n}`, section, random() < 0.5);
  }

  // Reusable class must agree with the free function.
  const graph = new core.VisGraph(stateFlags);
  for (let n = 0; n < 10; n++) {
    const section = new Uint16Array(4096);
    for (let i = 0; i < 4096; i++) if (random() < 0.5) section[i] = palette[randInt(palette.length)];
    check(
      `visgraph class-${n}`,
      sameBytes(graph.compute(section, true), computeVisibilityJs(section, true)) === '',
    );
  }
  graph.free();
}

// ---------------------------------------------------------------- chunk codec

function pushVarint(out, value) {
  value >>>= 0;
  do {
    let byte = value & 0x7f;
    value >>>= 7;
    if (value) byte |= 0x80;
    out.push(byte);
  } while (value);
}

function packSection(bits, palette, values) {
  const out = [];
  out.push(bits);
  if (bits <= 8) {
    pushVarint(out, palette.length);
    for (const value of palette) pushVarint(out, value);
  }
  const longCount = Math.ceil((4096 * bits) / 64);
  pushVarint(out, longCount);
  const longs = new Array(longCount).fill(0n);
  const mask = (1n << BigInt(bits)) - 1n;
  for (let i = 0; i < 4096; i++) {
    const bit = BigInt(i * bits);
    const word = Number(bit >> 5n) >> 1;
    const shift = Number(bit & 63n);
    longs[word] |= BigInt(values[i]) & mask << BigInt(shift);
    if (shift + bits > 64) longs[word + 1] |= (BigInt(values[i]) & mask) >> BigInt(64 - shift);
  }
  const buffer = Buffer.alloc(longCount * 8);
  for (let i = 0; i < longCount; i++) buffer.writeBigUInt64BE(longs[i], i * 8);
  out.push(...buffer);
  return out;
}

function chunkCodecTests() {
  for (const bits of [4, 5, 6, 7, 8, 14]) {
    const palette = bits <= 8
      ? Array.from({ length: Math.min(1 << bits, 1 + randInt(1 << Math.min(bits, 6))) }, (_, i) => (i === 0 ? air : stone + i))
      : [];
    if (bits <= 8) palette[0] = air;
    const values = new Uint32Array(4096);
    for (let i = 0; i < 4096; i++) values[i] = bits <= 8 ? randInt(palette.length) : randInt(11271);

    const blockBytes = packSection(bits, palette, values);
    const blockLight = Uint8Array.from({ length: 2048 }, () => randInt(256));
    const skyLight = Uint8Array.from({ length: 2048 }, () => randInt(256));

    // Reference decode from the original JavaScript function.
    const jsBlocks = new Uint32Array(4096);
    const jsConsumed = decodeSectionJs(Uint8Array.from(blockBytes), 0, jsBlocks);

    // WASM decode into a caller-owned typed array.
    const wasmBlocks = new Uint32Array(4096).fill(0xdeadbeef);
    const wasmConsumed = core.decode_section(Uint8Array.from(blockBytes), wasmBlocks);

    check(`chunk bits=${bits} consumed`, jsConsumed === wasmConsumed, `${jsConsumed} != ${wasmConsumed}`);
    check(`chunk bits=${bits} blocks`, sameBytes(jsBlocks, wasmBlocks) === '', sameBytes(jsBlocks, wasmBlocks));

    const nonAirJs = jsBlocks.reduce((n, state) => n + ([0, 9129, 9130].includes(state) ? 0 : 1), 0);
    const nonAirWasm = core.count_non_air(wasmBlocks, new Uint32Array([0, 9129, 9130]));
    check(`chunk bits=${bits} non-air`, nonAirJs === nonAirWasm, `${nonAirJs} != ${nonAirWasm}`);

    // Full Chunk.load path: block data + two light arrays + biomes.
    const data = Uint8Array.from([...blockBytes, ...blockLight, ...skyLight]);
    const biomes = new Uint8Array(1024);
    for (let i = 0; i < 256; i++) biomes[i * 4] = randInt(256);
    for (let i = 0; i < 256; i++) biomes[i * 4 + 3] = biomes[i * 4];
    const chunkData = Uint8Array.from([...data, ...biomes]);
    const chunk = new Chunk(0, 0, true);
    const consumed = chunk.load(chunkData, 0, 1, true, true);
    check(`chunk bits=${bits} load-consumed`, consumed === chunkData.length, `${consumed} != ${chunkData.length}`);
    check(`chunk bits=${bits} load-blocks`, sameBytes(chunk.sections[0].blocks, jsBlocks) === '', sameBytes(chunk.sections[0].blocks, jsBlocks));
    check(`chunk bits=${bits} load-nonair`, chunk.sections[0].nonAir === nonAirJs, `${chunk.sections[0].nonAir} != ${nonAirJs}`);
    check(`chunk bits=${bits} block-light`, sameBytes(chunk.sections[0].blockLight, blockLight) === '');
    check(`chunk bits=${bits} sky-light`, sameBytes(chunk.sections[0].skyLight, skyLight) === '');
    const expectedBiomes = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      expectedBiomes[i] = ((biomes[i * 4] << 24) | (biomes[i * 4 + 1] << 16) | (biomes[i * 4 + 2] << 8) | biomes[i * 4 + 3]) >>> 0;
    }
    check(`chunk bits=${bits} biomes`, sameBytes(chunk.biomes, expectedBiomes) === '', sameBytes(chunk.biomes, expectedBiomes));
  }

  // Nibble helpers on random light arrays.
  const light = Uint8Array.from({ length: 2048 }, () => randInt(256));
  for (let n = 0; n < 500; n++) {
    const index = randInt(4096);
    const expected = (light[index >> 1] >> ((index & 1) << 2)) & 15;
    check(
      `chunk nibble get ${index}`,
      core.get_sky_light(light, index) === expected,
      `${core.get_sky_light(light, index)} != ${expected}`,
    );
  }
  const lightCopy = light.slice();
  for (let n = 0; n < 500; n++) {
    const index = randInt(4096);
    const value = randInt(16);
    const byte = index >> 1;
    const before = lightCopy[byte];
    core.set_sky_light(lightCopy, index, value);
    const expected = index & 1
      ? (before & 0x0f) | (value << 4)
      : (before & 0xf0) | value;
    check(`chunk nibble set ${index}`, lightCopy[byte] === expected, `${lightCopy[byte]} != ${expected}`);
  }
}

// ------------------------------------------------------------- legacy columns

function legacyColumnTests() {
  for (const [protocol, decode, stateCount] of [
    [498, decodeChunkData498, 11271],
    [578, decodeChunkData578, 11337],
  ]) {
    const globalBits = Math.ceil(Math.log2(stateCount));
    for (let n = 0; n < 24; n++) {
      const w = new Writer(1 << 16);
      let bitMap = 0;
      for (let y = 0; y < 16; y++) if (random() < 0.25) bitMap |= 1 << y;
      for (let y = 0; y < 16; y++) {
        if (!(bitMap & (1 << y))) continue;
        const bits = random() < 0.3 ? globalBits : 4 + Math.floor(random() * 5);
        let palette = null;
        if (bits <= 8) {
          const length = 1 + Math.floor(random() * Math.min(1 << bits, 16));
          palette = Array.from({ length }, () => Math.floor(random() * stateCount));
        }
        const values = Array.from({ length: 4096 }, () => (palette ? Math.floor(random() * palette.length) : Math.floor(random() * stateCount)));
        w.u16(Math.floor(random() * 65536));
        w.u8(bits);
        if (palette) {
          w.varint(palette.length);
          for (const id of palette) w.varint(id);
        }
        w.varint(64 * bits);
        const longs = new Array(64 * bits).fill(0n);
        for (let i = 0; i < 4096; i++) {
          const bit = i * bits, word = Math.floor(bit / 64), shift = bit % 64;
          const value = BigInt(values[i]);
          longs[word] |= value << BigInt(shift);
          if (shift + bits > 64) longs[word + 1] |= value >> BigInt(64 - shift);
        }
        for (const long of longs) w.i64(BigInt.asIntN(64, long));
      }
      const groundUp = protocol === 498 && random() < 0.6;
      if (groundUp) for (let i = 0; i < 256; i++) w.i32(Math.floor(random() * 2 ** 31) | 0);
      const bytes = w.build();
      const packet = { bitMap, chunkData: bytes, groundUp };
      if (protocol === 578) packet.biomes = Array.from({ length: 256 }, () => Math.floor(random() * 1000));
      const expected = decode(packet, { stateCount });
      const actual = protocol === 498
        ? core.decode_chunk_498(bytes, bitMap, stateCount, groundUp)
        : core.decode_chunk_578(bytes, bitMap, stateCount);
      check(`legacy chunk ${protocol} ${n} decoded`, !!actual);
      if (!actual) continue;
      for (let y = 0; y < 16; y++) {
        const section = expected.sections[y];
        check(`legacy chunk ${protocol} ${n} present ${y}`, actual.present(y) === !!section);
        if (section) {
          check(`legacy chunk ${protocol} ${n} blocks ${y}`, actual.blocks(y).join(',') === Array.from(section.blocks).join(','));
          check(`legacy chunk ${protocol} ${n} non-air ${y}`, actual.non_air(y) === section.nonAir);
          check(`legacy chunk ${protocol} ${n} wire count ${y}`, actual.wire_non_air(y) === section.wireNonAir);
        }
      }
      if (protocol === 498) {
        check(`legacy chunk 498 ${n} biomes`, actual.has_biomes() === !!expected.biomes && (!expected.biomes || actual.biomes().join(',') === Array.from(expected.biomes).join(',')));
      }
      actual.free();
    }
  }
}

// ----------------------------------------------------------------------- PNG

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  Buffer.from(data).copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function encodePngRaw({ width, height, depth, colorType, raw, palette, trns, interlace = 0 }) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = depth;
  ihdr[9] = colorType;
  ihdr[12] = interlace;
  const parts = [Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk('IHDR', ihdr)];
  if (palette) parts.push(pngChunk('PLTE', Buffer.from(palette)));
  if (trns) parts.push(pngChunk('tRNS', Buffer.from(trns)));
  parts.push(pngChunk('IDAT', zlib.deflateSync(Buffer.from(raw))));
  parts.push(pngChunk('IEND', Buffer.alloc(0)));
  return Buffer.concat(parts);
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function filterRow(type, row, prev, bpp) {
  const out = new Uint8Array(row.length);
  for (let i = 0; i < row.length; i++) {
    const a = i >= bpp ? row[i - bpp] : 0;
    const up = prev[i];
    const c = i >= bpp ? prev[i - bpp] : 0;
    const predictor = type === 0 ? 0 : type === 1 ? a : type === 2 ? up : type === 3 ? (a + up) >> 1 : paeth(a, up, c);
    out[i] = (row[i] - predictor) & 255;
  }
  return out;
}

function packSamples(samples, depth) {
  const out = new Uint8Array(Math.ceil((samples.length * depth) / 8));
  const perByte = 8 / depth;
  samples.forEach((value, i) => {
    const byte = Math.floor(i / perByte);
    const shift = 8 - depth * ((i % perByte) + 1);
    out[byte] |= (value & ((1 << depth) - 1)) << shift;
  });
  return out;
}

function makePngCase({ width, height, depth, colorType, channels, interlace = 0, palette, trns, pixel }) {
  const bytesPerPixel = Math.max(1, (channels * depth) >> 3);
  const rowBytes = Math.ceil((width * channels * depth) / 8);
  const raw = [];
  const sampleRow = (y) => {
    const samples = [];
    for (let x = 0; x < width; x++) for (const value of pixel(x, y)) samples.push(value);
    return depth < 8 ? packSamples(samples, depth) : Uint8Array.from(samples.flatMap((v) => depth === 16 ? [v >> 8, v & 255] : [v & 255]));
  };
  if (!interlace) {
    let prev = new Uint8Array(rowBytes);
    for (let y = 0; y < height; y++) {
      const row = sampleRow(y);
      const filter = y % 5;
      raw.push(filter, ...filterRow(filter, row, prev, bytesPerPixel));
      prev = row;
    }
  } else {
    for (const [x0, y0, dx, dy] of [[0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4], [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2]]) {
      const pw = Math.ceil((width - x0) / dx);
      const ph = Math.ceil((height - y0) / dy);
      if (pw <= 0 || ph <= 0) continue;
      let prev = new Uint8Array(Math.ceil((pw * channels * depth) / 8));
      for (let y = 0; y < ph; y++) {
        const samples = [];
        for (let x = 0; x < pw; x++) for (const value of pixel(x0 + x * dx, y0 + y * dy)) samples.push(value);
        const row = depth < 8 ? packSamples(samples, depth) : Uint8Array.from(samples.flatMap((v) => depth === 16 ? [v >> 8, v & 255] : [v & 255]));
        raw.push(0, ...row);
        prev = row;
      }
    }
  }
  return encodePngRaw({ width, height, depth, colorType, raw, palette, trns, interlace });
}

function pngTests() {
  const cases = [];
  const rgba = (x, y) => [x * 17 % 256, y * 29 % 256, (x * y * 13) % 256, (x + y) % 2 ? 255 : 128];
  cases.push(['rgba8', makePngCase({ width: 9, height: 7, depth: 8, colorType: 6, channels: 4, pixel: rgba })]);
  cases.push(['rgb8', makePngCase({ width: 9, height: 7, depth: 8, colorType: 2, channels: 3, pixel: (x, y) => [x * 3, y * 5, (x + y) * 11] })]);
  cases.push(['gray8', makePngCase({ width: 9, height: 7, depth: 8, colorType: 0, channels: 1, pixel: (x, y) => [(x * 7 + y * 13) & 255] })]);
  cases.push(['gray-alpha8', makePngCase({ width: 9, height: 7, depth: 8, colorType: 4, channels: 2, pixel: (x, y) => [(x * 7) & 255, (y * 13) & 255] })]);
  cases.push(['rgba16', makePngCase({ width: 5, height: 4, depth: 16, colorType: 6, channels: 4, pixel: (x, y) => [x * 9000, y * 12000, 65535 - x * 3000, 65535] })]);
  cases.push(['gray4', makePngCase({ width: 9, height: 7, depth: 4, colorType: 0, channels: 1, pixel: (x, y) => [(x + y) & 15] })]);
  const palette = Array.from({ length: 16 }, (_, i) => [i * 16, 255 - i * 16, (i * 37) & 255]).flat();
  const trns = Array.from({ length: 16 }, (_, i) => i % 2 ? 0 : 255);
  cases.push(['palette4', makePngCase({ width: 9, height: 7, depth: 4, colorType: 3, channels: 1, palette, trns, pixel: (x, y) => [(x + y) & 15] })]);
  cases.push(['palette8', makePngCase({ width: 16, height: 16, depth: 8, colorType: 3, channels: 1, palette, trns, pixel: (x, y) => [(x * 3 + y) & 15] })]);
  cases.push(['interlaced-rgba8', makePngCase({ width: 13, height: 11, depth: 8, colorType: 6, channels: 4, interlace: 1, pixel: rgba })]);
  cases.push(['real-apple-touch-icon', readFileSync(join(root, 'client', 'apple-touch-icon.png'))]);

  for (const [name, bytes] of cases) {
    let js;
    try { js = decodePngJs(bytes); } catch (error) { check(`png ${name} js-decode`, false, error.message); continue; }
    const image = core.decode_png(bytes);
    if (!image) { check(`png ${name} wasm-decode`, false, 'returned null'); continue; }
    check(`png ${name} width`, js.width === image.width, `${js.width} != ${image.width}`);
    check(`png ${name} height`, js.height === image.height, `${js.height} != ${image.height}`);
    const wasmData = image.data;
    image.free();
    check(`png ${name} rgba`, sameBytes(js.data, wasmData) === '', sameBytes(js.data, wasmData));
  }

  // Truncated / deliberately broken files must return null, never throw.
  for (let n = 0; n < 10; n++) {
    const original = cases[n % cases.length][1];
    const broken = original.subarray(0, Math.max(1, original.length - 1 - n * 3));
    let threw = false;
    try { core.decode_png(broken); } catch { threw = true; }
    check(`png broken-${n}`, !threw);
  }
}

function pngEncodeTests() {
  for (const [width, height] of [[1, 1], [2, 2], [3, 2], [17, 9], [32, 32], [64, 3]]) {
    const rgba = Uint8Array.from({ length: width * height * 4 }, () => randInt(256));
    const rust = core.encode_png(width, height, rgba);
    check(`png encode ${width}x${height} returns bytes`, !!rust && rust.length > 8);
    if (!rust) continue;
    const decoded = decodePngJs(rust);
    check(`png encode ${width}x${height} width`, decoded.width === width);
    check(`png encode ${width}x${height} height`, decoded.height === height);
    check(`png encode ${width}x${height} pixels`, sameBytes(decoded.data, rgba) === '', sameBytes(decoded.data, rgba));
    const js = decodePngJs(encodePngJs(width, height, rgba));
    check(`png js encode ${width}x${height}`, sameBytes(js.data, rgba) === '', sameBytes(js.data, rgba));
  }
  check('png encode rejects bad length', core.encode_png(2, 2, new Uint8Array(15)) === undefined);
}

// -------------------------------------------------------------------- frustum

function multiply(a, b) {
  const out = new Float32Array(16);
  for (let i = 0; i < 4; i++) {
    const b0 = b[i * 4], b1 = b[i * 4 + 1], b2 = b[i * 4 + 2], b3 = b[i * 4 + 3];
    out[i * 4] = b0 * a[0] + b1 * a[4] + b2 * a[8] + b3 * a[12];
    out[i * 4 + 1] = b0 * a[1] + b1 * a[5] + b2 * a[9] + b3 * a[13];
    out[i * 4 + 2] = b0 * a[2] + b1 * a[6] + b2 * a[10] + b3 * a[14];
    out[i * 4 + 3] = b0 * a[3] + b1 * a[7] + b2 * a[11] + b3 * a[15];
  }
  return out;
}

function mat4Tests() {
  const near = (a, b) => a.length === b.length && a.every((value, index) => Math.abs(value - b[index]) < 1e-6);
  for (let n = 0; n < 60; n++) {
    const a = Float32Array.from({ length: 16 }, () => (random() - 0.5) * 4);
    const b = Float32Array.from({ length: 16 }, () => (random() - 0.5) * 4);
    check(`mat4 multiply ${n}`, near(core.mat4_multiply(a, b), mat4.multiply(new Float32Array(16), a, b)));

    const x = (random() - 0.5) * 8, y = (random() - 0.5) * 8, z = (random() - 0.5) * 8;
    check(`mat4 translate ${n}`, near(core.mat4_translate(a, x, y, z), mat4.translate(new Float32Array(16), a, x, y, z)));
    check(`mat4 scale ${n}`, near(core.mat4_scale(a, x, y, z), mat4.scale(new Float32Array(16), a, x, y, z)));
    const radians = (random() - 0.5) * Math.PI;
    check(`mat4 rotate ${n}`, near(core.mat4_rotate(a, radians, x, y, z), mat4.rotate(new Float32Array(16), a, radians, x, y, z)));

    const fov = 0.5 + random();
    const aspect = 0.5 + random() * 2;
    const nearPlane = 0.01 + random();
    const farPlane = 100 + random() * 100;
    check(`mat4 perspective ${n}`, near(core.mat4_perspective(fov, aspect, nearPlane, farPlane), mat4.perspective(new Float32Array(16), fov, aspect, nearPlane, farPlane)));
    const wasmOrtho = core.mat4_ortho(-x, x, -y, y, 0.1, farPlane);
    const jsOrtho = mat4.ortho(new Float32Array(16), -x, x, -y, y, 0.1, farPlane);
    check(`mat4 ortho ${n}`, near(wasmOrtho, jsOrtho), `${JSON.stringify(Array.from(wasmOrtho))} != ${JSON.stringify(Array.from(jsOrtho))} args ${[-x, x, -y, y, 0.1, farPlane]}`);

    const point = [x, y, z];
    check(`mat4 point ${n}`, near(core.mat4_transform_point(a, ...point), mat4.transformPoint(a, ...point)));
    check(`mat4 dir ${n}`, near(core.mat4_transform_dir(a, ...point), mat4.transformDir(a, ...point)));

    const invertible = mat4.perspective(new Float32Array(16), fov, aspect, nearPlane, farPlane);
    const inverted = mat4.invert(new Float32Array(16), invertible);
    check(`mat4 invert ${n}`, near(core.mat4_invert(invertible), inverted));
  }
  check('mat4 singular inverse', core.mat4_invert(new Float32Array(16)) === undefined);
}

function frustumTests() {
  let checked = 0;
  for (let n = 0; n < 80; n++) {
    const proj = mat4.perspective(mat4.create(), 0.9 + random() * 0.8, 0.5 + random() * 2, 0.05, 128 + random() * 128);
    const view = mat4.rotateY(mat4.create(), mat4.create(), random() * Math.PI * 2);
    mat4.rotateX(view, view, (random() - 0.5) * 1.2);
    mat4.translate(view, view, (random() - 0.5) * 64, random() * 32, (random() - 0.5) * 64);
    const viewProj = multiply(proj, view);
    const planes = frustumPlanesJs(viewProj);
    const wasmFrustum = new core.Frustum();
    wasmFrustum.from_matrix(viewProj);

    for (let i = 0; i < planes.length; i++) {
      const flat = [planes[i][0], planes[i][1], planes[i][2], planes[i][3]];
      const wasmPlanes = wasmFrustum.planes();
      for (let j = 0; j < 4; j++) {
        if (Math.abs(flat[j] - wasmPlanes[i * 4 + j]) > 1e-9) {
          check(`frustum plane ${n}.${i}.${j}`, false, `${flat[j]} != ${wasmPlanes[i * 4 + j]}`);
        }
      }
    }

    for (let b = 0; b < 20; b++) {
      const x = (random() - 0.5) * 400;
      const y = random() * 96 - 16;
      const z = (random() - 0.5) * 400;
      const w = 1 + random() * 32, h = 1 + random() * 32, d = 1 + random() * 32;
      const jsVisible = aabbInFrustumJs(planes, x, y, z, x + w, y + h, z + d);
      const wasmVisible = wasmFrustum.contains_aabb(x, y, z, x + w, y + h, z + d);
      check(`frustum box ${n}.${b}`, jsVisible === wasmVisible, `${jsVisible} != ${wasmVisible}`);
      checked++;
    }
    wasmFrustum.free();
  }
  check('frustum boxes sampled', checked === 80 * 20, String(checked));
}

// ------------------------------------------------------------------------ NBT

function rootOf(name, value) {
  return { t: value.t, name, v: value.v };
}

function randomTag(depth = 0) {
  const kind = depth > 3 ? randInt(6) : randInt(12);
  switch (kind) {
    case 0: return { t: 1, v: randInt(256) - 128 };
    case 1: return { t: 2, v: randInt(65536) - 32768 };
    case 2: return { t: 3, v: (randInt(1 << 30) - (1 << 29)) };
    case 3: return { t: 4, v: BigInt(randInt(1 << 30)) * 100000n };
    case 4: return { t: 5, v: Math.fround(random() * 100 - 50) };
    case 5: return { t: 6, v: random() * 1000 - 500 };
    case 6: return { t: 7, v: Int8Array.from({ length: randInt(12) }, () => randInt(256) - 128) };
    case 7: return { t: 8, v: ['', 'hello', 'MinecraftJS', 'ünïcode'][randInt(4)] };
    case 8: {
      const et = [1, 3, 5, 8][randInt(4)];
      const items = Array.from({ length: randInt(5) }, () => {
        if (et === 8) return `s${randInt(100)}`;
        if (et === 1) return randInt(256) - 128;
        if (et === 3) return randInt(1 << 30) - (1 << 29);
        return Math.fround(random() * 10);
      });
      return { t: 9, v: { et, items } };
    }
    case 9: {
      const fields = {};
      for (let i = 0; i < randInt(5); i++) {
        const tag = randomTag(depth + 1);
        fields[`k${i}_${randInt(1000)}`] = tag;
      }
      return { t: 10, v: fields };
    }
    case 10: return { t: 11, v: Int32Array.from({ length: randInt(8) }, () => randInt(1 << 30) - (1 << 29)) };
    default: return { t: 12, v: BigInt64Array.from({ length: randInt(6) }, () => BigInt(randInt(1 << 30))) };
  }
}

function nbtRoundtripJs(bytes) {
  const reader = new Reader(bytes);
  const parsed = readNbtRoot(reader);
  const writer = new Writer(128);
  writeNbtRoot(writer, parsed);
  return writer.build();
}

function nbtTests() {
  const roots = [rootOf('hello', { t: 10, v: { byte: { t: 1, v: -1 }, int: { t: 3, v: 42 }, str: { t: 8, v: 'value' } } })];
  for (let n = 0; n < 80; n++) roots.push(rootOf(`root_${n}`, randomTag()));

  for (const [index, root] of roots.entries()) {
    const writer = new Writer(128);
    writeNbtRoot(writer, root);
    const bytes = writer.build();
    const js = nbtRoundtripJs(bytes);
    const wasm = core.nbt_roundtrip(bytes);
    check(`nbt ${index} valid`, core.nbt_valid(bytes) === true);
    check(`nbt ${index} length`, js.length === wasm.length, `${js.length} != ${wasm.length}`);
    check(`nbt ${index} bytes`, sameBytes(js, wasm) === '', sameBytes(js, wasm));

    // Feeding the re-encoded bytes back through WASM must be a fixed point.
    const again = core.nbt_roundtrip(wasm);
    check(`nbt ${index} fixed-point`, sameBytes(wasm, again) === '', sameBytes(wasm, again));
  }

  const empty = new Writer(8);
  writeNbtRoot(empty, null);
  check('nbt empty root', sameBytes(core.nbt_roundtrip(empty.build()), Uint8Array.of(0)) === '');
  check('nbt rejects garbage', core.nbt_valid(Uint8Array.from([10, 0, 1, 2, 3])) === false);
  const named = new Writer(32);
  writeNbtRoot(named, rootOf('named', { t: 3, v: 1 }));
  check('nbt root name', core.nbt_root_name(named.build()) === 'named');

  const plain = (value) => {
    if (typeof value === 'bigint') return Number(value);
    if (ArrayBuffer.isView(value)) return Array.from(value, plain);
    if (Array.isArray(value)) return value.map(plain);
    if (value && typeof value === 'object') {
      const out = {};
      for (const key of Object.keys(value)) out[key] = plain(value[key]);
      return out;
    }
    return value;
  };
  for (const [index, root] of roots.entries()) {
    const bytes = new Writer(128);
    writeNbtRoot(bytes, root);
    const expected = plain(simplifyNbt(readNbtRoot(new Reader(bytes.build()))));
    const actual = core.nbt_simplify_json(bytes.build());
    check(`nbt simplify ${index}`, JSON.stringify(JSON.parse(actual)) === JSON.stringify(expected), `${actual} != ${JSON.stringify(expected)}`);
  }
  check('nbt simplify rejects garbage', core.nbt_simplify_json(Uint8Array.from([10, 0, 1, 2, 3])) === undefined);
}

// --------------------------------------------------------------- biome zoom

function biomeZoomTests() {
  for (let n = 0; n < 40; n++) {
    const seed = BigInt.asIntN(64, BigInt(Math.floor(random() * 2 ** 32)) * 48271n - 12345n);
    const wasm = new core.BiomeZoom(seed);
    for (let s = 0; s < 30; s++) {
      const x = Math.floor((random() - 0.5) * 512), y = Math.floor((random() - 0.5) * 256), z = Math.floor((random() - 0.5) * 512);
      const expectedOffset = biomeZoomOffsetJs(seed, x, y, z);
      const actualOffset = wasm.offset(x, y, z);
      check(`biome zoom offset ${n}.${s}`, expectedOffset.every((value, index) => value === actualOffset[index]), `${expectedOffset} != ${actualOffset}`);
      const expectedCell = biomeZoomCellJs(seed, x, y, z);
      const actualCell = wasm.cell(x, y, z);
      check(`biome zoom cell ${n}.${s}`, expectedCell.every((value, index) => value === actualCell[index]), `${expectedCell} != ${actualCell}`);
    }
    wasm.free();
  }
}

// ---------------------------------------------------------------------- zip

function zipTests() {
  const bytes = readFileSync(join(root, 'tools', 'fixtures', 'shader-pack-final-test.zip'));
  const js = new ZipArchiveJs(bytes);
  const wasm = new ZipArchiveWasm(bytes);
  check('zip wasm backend', !!wasm.wasm);
  check('zip root prefix', wasm.rootPrefix() === js.rootPrefix(), `${wasm.rootPrefix()} != ${js.rootPrefix()}`);
  const jsNames = js.list('');
  const wasmNames = wasm.list('');
  check('zip list', JSON.stringify(jsNames) === JSON.stringify(wasmNames), `${jsNames.length} != ${wasmNames.length}`);
  for (const name of jsNames) {
    check(`zip has ${name}`, wasm.has(name) === js.has(name));
    const expected = js.read(name);
    const actual = wasm.read(name);
    check(`zip read ${name}`, !!actual && sameBytes(expected, actual) === '', sameBytes(expected, actual));
  }
  check('zip missing entry', wasm.read('does/not/exist') === null && wasm.has('does/not/exist') === false);
}

// ------------------------------------------------------------------- physics

function physicsTests() {
  for (let n = 0; n < 300; n++) {
    const box = Float64Array.from({ length: 6 }, () => (random() - 0.5) * 8);
    const bb = Float64Array.from({ length: 6 }, () => (random() - 0.5) * 8);
    const offset = (random() - 0.5) * 8;
    for (const [name, jsFn, wasmFn] of [
      ['x', calcXOffset, core.calc_x_offset],
      ['y', calcYOffset, core.calc_y_offset],
      ['z', calcZOffset, core.calc_z_offset],
    ]) {
      const expected = jsFn(box, bb, offset);
      const actual = wasmFn(box, bb, offset);
      check(`physics ${name} offset ${n}`, Math.abs(expected - actual) < 1e-12, `${expected} != ${actual}`);
    }

    const ox = (random() - 0.5) * 10, oy = (random() - 0.5) * 10, oz = (random() - 0.5) * 10;
    const dx = (random() - 0.5) * 2, dy = (random() - 0.5) * 2, dz = (random() - 0.5) * 2;
    const x0 = (random() - 0.5) * 8, y0 = (random() - 0.5) * 8, z0 = (random() - 0.5) * 8;
    const x1 = x0 + random() * 4, y1 = y0 + random() * 4, z1 = z0 + random() * 4;
    const expected = rayBox(ox, oy, oz, dx, dy, dz, x0, y0, z0, x1, y1, z1);
    const actual = core.ray_box(ox, oy, oz, dx, dy, dz, x0, y0, z0, x1, y1, z1);
    check(`physics ray hit ${n}`, (expected === null) === (actual[0] === 0), JSON.stringify(expected));
    if (expected) {
      check(`physics ray t ${n}`, Math.abs(expected.t - actual[1]) < 1e-12, `${expected.t} != ${actual[1]}`);
      check(`physics ray face ${n}`, expected.face === actual[2], `${expected.face} != ${actual[2]}`);
    }
  }
}

// --------------------------------------------------------------------- world

function worldTables() {
  const opacity = new Uint8Array(blockStates.length);
  const emit = new Uint8Array(blockStates.length);
  for (let i = 0; i < blockStates.length; i++) {
    const b = getBlock(i);
    opacity[i] = !b || b.id === 0 ? 0 : b.opaque ? 15 : (b.filterLight || 0);
    emit[i] = b ? (b.emitLight || 0) : 0;
  }
  return { opacity, emit };
}

const worldPalette = [
  0,
  blocksByName.stone?.defaultState ?? 1,
  blocksByName.oak_leaves?.defaultState ?? 1,
  blocksByName.glass?.defaultState ?? 1,
  blocksByName.water?.defaultState ?? 1,
  blocksByName.glowstone?.defaultState ?? 1,
  blocksByName.torch?.defaultState ?? 1,
  blocksByName.oak_planks?.defaultState ?? 1,
];

function makeChunkData(bits, palette) {
  const out = [];
  for (let sy = 0; sy < 16; sy++) {
    const values = new Uint32Array(4096);
    for (let i = 0; i < 4096; i++) values[i] = bits <= 8 ? randInt(palette.length) : palette[randInt(palette.length)];
    out.push(...packSection(bits, bits <= 8 ? palette : [], values));
    out.push(...new Uint8Array(2048)); // block light
    out.push(...new Uint8Array(2048).fill(0xff)); // sky light
  }
  for (let i = 0; i < 256; i++) {
    const biome = randInt(256);
    out.push(0, 0, 0, biome);
  }
  return Uint8Array.from(out);
}

function compareWorldChunk(jsWorld, rustWorld, cx, cz, label) {
  const chunk = jsWorld.getChunk(cx, cz);
  check(`world ${label} chunk ${cx},${cz}`, !!chunk);
  if (!chunk) return;
  for (let sy = 0; sy < 16; sy++) {
    const section = chunk.sections[sy];
    const blocks = rustWorld.section_blocks(cx, sy, cz);
    if (!section) {
      check(`world ${label} section ${cx},${sy},${cz} absent`, blocks.length === 0);
      continue;
    }
    check(`world ${label} blocks ${cx},${sy},${cz}`, sameBytes(section.blocks, blocks) === '', sameBytes(section.blocks, blocks));
    const sky = rustWorld.section_sky_light(cx, sy, cz);
    const block = rustWorld.section_block_light(cx, sy, cz);
    check(`world ${label} sky ${cx},${sy},${cz}`, sameBytes(section.skyLight, sky) === '', sameBytes(section.skyLight, sky));
    check(`world ${label} block-light ${cx},${sy},${cz}`, sameBytes(section.blockLight, block) === '', sameBytes(section.blockLight, block));
  }
  check(`world ${label} heights ${cx},${cz}`, sameBytes(chunk.heightMap, rustWorld.height_map(cx, cz)) === '', sameBytes(chunk.heightMap, rustWorld.height_map(cx, cz)));
  check(`world ${label} biomes ${cx},${cz}`, sameBytes(chunk.biomes, rustWorld.chunk_biomes(cx, cz)) === '', sameBytes(chunk.biomes, rustWorld.chunk_biomes(cx, cz)));
}

function compareWorldState(jsWorld, rustWorld, label) {
  for (let n = 0; n < 250; n++) {
    const x = -16 + randInt(48);
    const z = -16 + randInt(48);
    const y = randInt(256);
    check(`world ${label} state ${x},${y},${z}`, jsWorld.getState(x, y, z) === rustWorld.get_state(x, y, z), `${jsWorld.getState(x, y, z)} != ${rustWorld.get_state(x, y, z)}`);
    check(`world ${label} sky ${x},${y},${z}`, jsWorld.getSkyLight(x, y, z) === rustWorld.get_sky_light(x, y, z), `${jsWorld.getSkyLight(x, y, z)} != ${rustWorld.get_sky_light(x, y, z)}`);
    check(`world ${label} blocklight ${x},${y},${z}`, jsWorld.getBlockLight(x, y, z) === rustWorld.get_block_light(x, y, z), `${jsWorld.getBlockLight(x, y, z)} != ${rustWorld.get_block_light(x, y, z)}`);
    check(`world ${label} biome ${x},${z}`, jsWorld.getBiome(x, z, y) === rustWorld.get_biome(x, z, y), `${jsWorld.getBiome(x, z, y)} != ${rustWorld.get_biome(x, z, y)}`);
  }
}

function worldTests() {
  const tables = worldTables();
  const jsWorld = new World();
  jsWorld.hasSky = true;
  const rustWorld = new core.WorldCore(tables.opacity, tables.emit);
  rustWorld.set_has_sky(true);

  for (let cx = -1; cx <= 1; cx++) {
    for (let cz = -1; cz <= 1; cz++) {
      const data = makeChunkData(8, worldPalette);
      const jsConsumed = jsWorld.loadChunk(cx, cz, true, 0xffff, data, 0, true);
      const rustConsumed = rustWorld.load_chunk_113(cx, cz, true, 0xffff, data, 0, true);
      check(`world load ${cx},${cz} consumed`, jsConsumed === rustConsumed, `${jsConsumed} != ${rustConsumed}`);
      check(`world load ${cx},${cz} length`, jsConsumed === data.length, `${jsConsumed} != ${data.length}`);
      compareWorldChunk(jsWorld, rustWorld, cx, cz, 'loaded');
    }
  }
  compareWorldState(jsWorld, rustWorld, 'loaded');

  // Random edits, including emitters and opacity changes. Relighting is the
  // part most likely to diverge, so compare the whole affected chunk.
  for (let n = 0; n < 40; n++) {
    const cx = randInt(3) - 1;
    const cz = randInt(3) - 1;
    const x = cx * 16 + randInt(16);
    const z = cz * 16 + randInt(16);
    const y = randInt(256);
    const state = worldPalette[randInt(worldPalette.length)];
    jsWorld.setState(x, y, z, state);
    rustWorld.set_state(x, y, z, state);
    check(`world edit ${n} state`, jsWorld.getState(x, y, z) === rustWorld.get_state(x, y, z));
    if (n % 5 === 0) {
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        if (Math.abs(cx + dx) <= 1 && Math.abs(cz + dz) <= 1) compareWorldChunk(jsWorld, rustWorld, cx + dx, cz + dz, `edit ${n}`);
      }
    }
  }
  compareWorldState(jsWorld, rustWorld, 'edited');

  // Collision boxes, swept queries and ray tracing against the same world.
  const rnd = () => randInt(100000) / 100000;
  const reg = new core.BlockRegistryCore(JSON.stringify(readJson('blocks.json')), JSON.stringify(readJson('blockCollisionShapes.json')));
  try {
    const structures = ['stone', 'oak_slab', 'oak_stairs', 'glass', 'water', 'scaffolding', 'cobblestone_wall', 'oak_fence'];
    for (let i = 0; i < structures.length; i++) {
      const name = structures[i];
      const state = blocksByName[name]?.defaultState ?? 1;
      for (let x = 2 + i; x < 10; x++) for (let z = 2; z < 6; z++) {
        jsWorld.setState(x, 10 + i, z, state);
        rustWorld.set_state(x, 10 + i, z, state);
      }
    }
    for (let n = 0; n < 300; n++) {
      const x = 1 + rnd() * 9, y = 8 + rnd() * 8, z = 1 + rnd() * 6;
      const w = 0.2 + rnd() * 2, h = 0.2 + rnd() * 2;
      const bb = [x, y, z, x + w, y + h, z + w];
      const expected = jsWorld.getCollisions(bb).flat();
      const actual = Array.from(core.world_get_collisions(rustWorld, reg, Float64Array.from(bb)));
      check(`world collisions ${n}`, JSON.stringify(expected) === JSON.stringify(actual), `${JSON.stringify(expected)} != ${JSON.stringify(actual)}`);
    }
    for (const collider of [false, true]) {
      for (let n = 0; n < 250; n++) {
        const origin = [1 + rnd() * 9, 18 + rnd() * 4, 1 + rnd() * 6];
        const dir = [rnd() * 2 - 1, -rnd() * 2, rnd() * 2 - 1];
        const len = Math.hypot(...dir) || 1;
        dir[0] /= len; dir[1] /= len; dir[2] /= len;
        // Mode 2 ('any') mutates the JS shape table through the shared array
        // returned by staticCollisionBoxes, so it is not comparable without
        // replicating that bug. Compare the two non-mutating modes.
        const mode = n % 2;
        const expected = jsWorld.raycast(origin[0], origin[1], origin[2], dir[0], dir[1], dir[2], 40, mode === 1 ? true : mode === 2 ? 'any' : false, collider);
        const actual = JSON.parse(core.world_raycast(rustWorld, reg, Float64Array.from(origin), Float64Array.from(dir), 40, mode, collider));
        if (!expected) {
          check(`world ray ${collider} ${n} null`, actual === null, JSON.stringify(actual));
          continue;
        }
        check(`world ray ${collider} ${n} hit`, actual !== null);
        if (!actual) continue;
        check(`world ray ${collider} ${n} block`, actual.x === expected.x && actual.y === expected.y && actual.z === expected.z, `${JSON.stringify(actual)} != ${JSON.stringify(expected)}`);
        check(`world ray ${collider} ${n} face`, actual.face === expected.face, `${actual.face} != ${expected.face}`);
        check(`world ray ${collider} ${n} state`, actual.state === expected.state);
        check(`world ray ${collider} ${n} dist`, Math.abs(actual.dist - expected.dist) < 1e-9, `${actual.dist} != ${expected.dist}`);
        check(`world ray ${collider} ${n} point`, expected.hit.every((v, k) => Math.abs(actual.hit[k] - v) < 1e-9));
        check(`world ray ${collider} ${n} box`, JSON.stringify(actual.box) === JSON.stringify(expected.box), `${JSON.stringify(actual.box)} != ${JSON.stringify(expected.box)}`);
      }
    }
  } finally {
    reg.free();
  }

  // Batched edits use one light pass in both implementations.
  jsWorld.beginBatch();
  rustWorld.begin_batch();
  for (let n = 0; n < 20; n++) {
    const x = randInt(32) - 16;
    const z = randInt(32) - 16;
    const y = randInt(256);
    const state = worldPalette[randInt(worldPalette.length)];
    jsWorld.setState(x, y, z, state);
    rustWorld.set_state(x, y, z, state);
  }
  jsWorld.endBatch();
  rustWorld.end_batch();
  for (let cx = -1; cx <= 1; cx++) for (let cz = -1; cz <= 1; cz++) compareWorldChunk(jsWorld, rustWorld, cx, cz, 'batch');
  compareWorldState(jsWorld, rustWorld, 'batch');

  // Mesh slices (world/slice.js) at the chunk edges and in the middle.
  for (const sy of [0, 8, 15]) {
    for (const [cx, cz] of [[0, 0], [-1, -1], [1, 0]]) {
      const expected = buildSlice(jsWorld, cx, sy, cz, null, 2);
      const actual = rustWorld.build_slice(cx, sy, cz, 2);
      check(`world slice ${cx},${sy},${cz} states`, sameBytes(expected.states, actual.states) === '', sameBytes(expected.states, actual.states));
      check(`world slice ${cx},${sy},${cz} light`, sameBytes(expected.light, actual.light) === '', sameBytes(expected.light, actual.light));
      check(`world slice ${cx},${sy},${cz} biomes`, sameBytes(expected.biomes, actual.biomes) === '', sameBytes(expected.biomes, actual.biomes));
      check(`world slice ${cx},${sy},${cz} sky`, expected.hasSky === actual.has_sky);
      check(`world slice ${cx},${sy},${cz} origin`, expected.ox === actual.ox && expected.oy === actual.oy && expected.oz === actual.oz);
      actual.free();
    }
  }

  rustWorld.free();
}

function bufferTests() {
  const w = new Writer(16);
  const rw = new core.PacketWriter();
  const uuid = '123e4567-e89b-12d3-a456-426614174000';
  w.i8(-7); rw.i8(-7);
  w.u8(200); rw.u8(200);
  w.bool(true); rw.write_bool(true);
  w.i16(-12345); rw.i16(-12345);
  w.u16(60000); rw.u16(60000);
  w.i32(-123456789); rw.i32(-123456789);
  w.i64(-9007199254740993n); rw.i64(-9007199254740993n);
  w.f32(1.5); rw.f32(1.5);
  w.f64(-2.25); rw.f64(-2.25);
  w.varint(-1); rw.varint(-1);
  w.varint(300); rw.varint(300);
  w.varlong(-1n); rw.varlong(-1n);
  w.varlong(1n << 40n); rw.varlong(1n << 40n);
  w.string('héllo'); rw.string('héllo');
  w.uuid(uuid); rw.uuid(uuid);
  w.position(-20000000, 128, 33000000); rw.position(-20000000, 128, 33000000);
  w.raw(Uint8Array.of(1, 2, 3)); rw.raw(Uint8Array.of(1, 2, 3));
  const js = w.build();
  const wasm = rw.build();
  check('buffer writer bytes', sameBytes(js, wasm) === '', sameBytes(js, wasm));

  const r = new Reader(wasm);
  const rr = new core.PacketReader(wasm);
  check('buffer i8', r.i8() === rr.i8());
  check('buffer u8', r.u8() === rr.u8());
  check('buffer bool', r.bool() === rr.read_bool());
  check('buffer i16', r.i16() === rr.i16());
  check('buffer u16', r.u16() === rr.u16());
  check('buffer i32', r.i32() === rr.i32());
  check('buffer i64', r.i64() === rr.i64());
  check('buffer f32', Object.is(r.f32(), rr.f32()));
  check('buffer f64', Object.is(r.f64(), rr.f64()));
  check('buffer varint -1', r.varint() === rr.varint());
  check('buffer varint 300', r.varint() === rr.varint());
  check('buffer varlong -1', r.varlong() === rr.varlong());
  check('buffer varlong 1<<40', r.varlong() === rr.varlong());
  check('buffer string', r.string() === rr.string());
  check('buffer uuid', r.uuid() === rr.uuid());
  const jp = r.position(), wp = rr.position();
  check('buffer position', jp.x === wp[0] && jp.y === wp[1] && jp.z === wp[2], JSON.stringify([jp, wp]));
  check('buffer raw', sameBytes(r.bytesN(3), rr.bytes_n(3)) === '');
  check('buffer remaining', r.remaining() === rr.remaining());
  check('buffer underflow', (() => {
    try { new Reader(Uint8Array.of(1)).i32(); return false; } catch { return true; }
  })() && (() => {
    try { new core.PacketReader(Uint8Array.of(1)).i32(); return false; } catch { return true; }
  })());
}

// --------------------------------------------------------------------- base85

const BASE85_ALPHABET = Array.from({ length: 94 }, (_, i) => String.fromCharCode(33 + i))
  .filter((c) => !'<>&'.includes(c)).slice(0, 85).join('');
function encodeBase85Js(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 4) {
    let value = ((bytes[i] || 0) * 0x1000000) + ((bytes[i + 1] || 0) << 16) + ((bytes[i + 2] || 0) << 8) + (bytes[i + 3] || 0);
    let word = '';
    for (let j = 0; j < 5; j++) { word = BASE85_ALPHABET[value % 85] + word; value = Math.floor(value / 85); }
    out += word;
  }
  return out;
}

function base85Tests() {
  for (let length = 0; length < 100; length++) {
    const bytes = Uint8Array.from({ length }, () => randInt(256));
    const encoded = encodeBase85Js(bytes);
    const decoded = core.decode_base85(encoded, length);
    check(`base85 ${length}`, sameBytes(bytes, decoded) === '', sameBytes(bytes, decoded));
  }
}

// ---------------------------------------------------------------------- utf8

function utf8Tests() {
  for (let byte = 0; byte < 256; byte++) {
    const bytes = Uint8Array.of(byte);
    check(`utf8 byte ${byte}`, core.decode_utf8(bytes, 0, 1) === decodeUtf8Js(bytes));
  }

  const samples = [
    '', 'hello', 'héllo', '日本語', '😩', 'a\u0000b',
    '\ud800', '\udc00', '\ud83d\ude00', 'a\ud800b', '\ufffd',
  ];
  for (const [index, sample] of samples.entries()) {
    const js = encodeUtf8Js(sample);
    const wasm = core.encode_utf8(sample);
    check(`utf8 encode ${index}`, sameBytes(js, wasm) === '', sameBytes(js, wasm));
    check(`utf8 encode/decode ${index}`, core.decode_utf8(wasm, 0, wasm.length) === decodeUtf8Js(js));
  }

  for (let n = 0; n < 400; n++) {
    const length = randInt(24);
    const bytes = Uint8Array.from({ length }, () => randInt(256));
    const start = randInt(length + 1);
    const end = start + randInt(length - start + 1);
    const expected = decodeUtf8Js(bytes, start, end);
    const actual = core.decode_utf8(bytes, start, end);
    check(`utf8 random ${n}`, expected === actual, `${JSON.stringify(expected)} != ${JSON.stringify(actual)}`);
  }
}

// -------------------------------------------------------------------- base64

function base64Tests() {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/= \n\t-_!@';
  const samples = ['', 'aGVsbG8=', 'aGVsbG8', '8J+YqQ==', '!!!!', 'aG Vs\nbG8=', '////', 'AA=='];
  for (let n = 0; n < 300; n++) {
    const length = randInt(40);
    let value = '';
    for (let i = 0; i < length; i++) value += alphabet[randInt(alphabet.length)];
    samples.push(value);
  }
  for (const [index, value] of samples.entries()) {
    const expected = decodeBase64Js(value);
    const actual = core.decode_base64(value);
    check(`base64 ${index}`, sameBytes(expected, actual) === '', sameBytes(expected, actual));
  }
  for (let n = 0; n < 60; n++) {
    const length = randInt(64);
    const bytes = Uint8Array.from({ length }, () => randInt(256));
    const expected = Buffer.from(bytes).toString('base64');
    const actual = core.encode_base64(bytes);
    check(`base64 encode ${n}`, expected === actual, `${expected} != ${actual}`);
  }
}

// ------------------------------------------------------------- command tree

function deepEqualJson(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((key) => Object.hasOwn(b, key) && deepEqualJson(a[key], b[key]));
}

function commandTreeTests() {
  const parsers = ['brigadier:integer', 'brigadier:float', 'brigadier:string', 'minecraft:entity', 'minecraft:vec3'];
  for (let n = 0; n < 40; n++) {
    const count = 1 + Math.floor(random() * 7);
    const w = new Writer(256);
    w.varint(count);
    for (let i = 0; i < count; i++) {
      const kind = Math.floor(random() * 3);
      let flags = kind | 4 | (random() < 0.3 ? 8 : 0) | (kind === 2 && random() < 0.3 ? 16 : 0);
      const children = [];
      const childCount = Math.floor(random() * 3);
      for (let c = 0; c < childCount; c++) children.push(Math.floor(random() * count));
      w.u8(flags).varint(children.length);
      for (const child of children) w.varint(child);
      if (flags & 8) w.varint(Math.floor(random() * count));
      if (kind === 1 || kind === 2) w.string(`node${i}`);
      if (kind === 2) {
        const parser = parsers[Math.floor(random() * parsers.length)];
        w.string(parser);
        if (parser.startsWith('brigadier:')) {
          if (parser === 'brigadier:string') w.varint(Math.floor(random() * 3));
          else {
            const bounds = (random() < 0.7 ? 1 : 0) | (random() < 0.7 ? 2 : 0);
            w.u8(bounds);
            if (bounds & 1) w.f32((random() - 0.5) * 100);
            if (bounds & 2) w.f32(100 + random() * 100);
          }
        } else if (parser === 'minecraft:entity') w.u8(Math.floor(random() * 256));
        if (flags & 16) w.string('minecraft:ask_server');
      }
    }
    w.varint(0);
    const bytes = w.build();
    const expected = readCommandTree(new Reader(bytes));
    const actual = core.parse_command_tree(bytes);
    const parsed = actual === undefined ? null : JSON.parse(actual);
    check(`command tree ${n}`, deepEqualJson(parsed, expected), `${actual}`);
  }
}

// ------------------------------------------------------------------- recipes

function recipesTests() {
  const plain = (value) => {
    if (typeof value === 'bigint') return Number(value);
    if (ArrayBuffer.isView(value)) return Array.from(value, plain);
    if (Array.isArray(value)) return value.map(plain);
    if (value && typeof value === 'object') {
      const out = {};
      for (const key of Object.keys(value)) if (key !== 'nbtRaw') out[key] = plain(value[key]);
      return out;
    }
    return value;
  };
  const kinds = ['crafting_shaped', 'crafting_shapeless', 'smelting', 'stonecutting', 'crafting_special_repair_item'];
  for (const protocol of [404, 578]) {
    for (let n = 0; n < 40; n++) {
      const w = new Writer(512);
      w.varint(1);
      const available = protocol === 404 ? kinds.filter((kind) => kind !== 'stonecutting') : kinds;
      const type = `minecraft:${available[Math.floor(random() * available.length)]}`;
      const id = `minecraft:test_${n}`;
      if (protocol === 404) { w.string(id); w.string(type); } else { w.string(type); w.string(id); }
      const kind = type.slice(10);
      const slot = () => (random() < 0.3 ? w.slot(null) : w.slot({ id: 1 + Math.floor(random() * 200), count: 1 + Math.floor(random() * 64) }));
      if (kind === 'crafting_shaped') {
        const width = 1 + Math.floor(random() * 3), height = 1 + Math.floor(random() * 3);
        w.varint(width).varint(height).string('group');
        for (let i = 0; i < width * height; i++) {
          const count = Math.floor(random() * 3);
          w.varint(count);
          for (let j = 0; j < count; j++) slot();
        }
        slot();
      } else if (kind === 'crafting_shapeless') {
        const count = Math.floor(random() * 10);
        w.string('group').varint(count);
        for (let i = 0; i < count; i++) {
          const alternatives = 1 + Math.floor(random() * 2);
          w.varint(alternatives);
          for (let j = 0; j < alternatives; j++) slot();
        }
        slot();
      } else if (['smelting', 'blasting', 'smoking', 'campfire_cooking'].includes(kind)) {
        w.string('group');
        const alternatives = 1 + Math.floor(random() * 2);
        w.varint(alternatives);
        for (let j = 0; j < alternatives; j++) slot();
        slot();
        w.f32(random() * 2);
        w.varint(Math.floor(random() * 400));
      } else if (kind === 'stonecutting' && protocol !== 404) {
        w.string('group');
        w.varint(1);
        slot();
        slot();
      }
      const bytes = w.build();
      const expected = plain(readRecipes(new Reader(bytes), protocol));
      const actualText = core.parse_recipes(bytes, protocol);
      const actual = actualText === undefined ? null : JSON.parse(actualText);
      check(`recipes ${protocol} ${n}`, deepEqualJson(actual, expected), `${actualText} != ${JSON.stringify(expected)}`);
    }
  }
}

// ----------------------------------------------------------------------- SNBT

function snbtTests() {
  const plain = (value) => {
    if (typeof value === 'bigint') return Number(value);
    if (Array.isArray(value)) return value.map(plain);
    if (value && typeof value === 'object') {
      const out = {};
      for (const key of Object.keys(value)) out[key] = plain(value[key]);
      return out;
    }
    return value;
  };
  const samples = [
    '1b', '-2s', '3', '-4l', '1.5f', '2.25d', '1e3', '1e3b', 'true', 'false', '"hello"', "'q'",
    '{id:"minecraft:stone",Count:1b,tag:{display:{Name:"x"}}}',
    '{}', '[]', '[1,2,3]', '[0:"a",1:"b"]', '[B;1b,2b,3b]', '[I;1,2,3]', '[L;1l,2l]',
    '{a:1,b:\'two\',c:[1,2],d:{e:3}}',
  ];
  for (const [index, sample] of samples.entries()) {
    const expected = plain(parseSnbt(sample));
    const actualText = core.parse_snbt(sample);
    const actual = actualText === undefined ? null : JSON.parse(actualText);
    check(`snbt ${index}`, deepEqualJson(actual, expected), `${actualText} != ${JSON.stringify(expected)}`);
  }
  for (const sample of ['{', '[B;1]', '"unterminated', '{} trailing', '[1,"a"]']) {
    let threw = false;
    try { parseSnbt(sample); } catch { threw = true; }
    check(`snbt rejects ${sample}`, threw && core.parse_snbt(sample) === undefined);
  }
}

// ---------------------------------------------------------------------- leash

function leashTests() {
  for (let n = 0; n < 60; n++) {
    const mob = {
      x: (random() - 0.5) * 100, y: random() * 64, z: (random() - 0.5) * 100,
      prevX: (random() - 0.5) * 100, prevY: random() * 64, prevZ: (random() - 0.5) * 100,
      width: 0.4 + random() * 2, height: 0.5 + random() * 2,
      bodyYaw: random() * 720 - 360, prevBodyYaw: random() * 720 - 360,
    };
    const holder = {
      x: (random() - 0.5) * 100, y: random() * 64, z: (random() - 0.5) * 100,
      prevX: (random() - 0.5) * 100, prevY: random() * 64, prevZ: (random() - 0.5) * 100,
      yaw: random() * 720 - 360, prevYaw: random() * 720 - 360,
      pitch: random() * 180 - 90, prevPitch: random() * 180 - 90,
      eyeHeight: 1.4 + random(), kind: random() < 0.2 ? 'leash' : 'player',
    };
    const partial = random();
    const expected = leashEndpoints(mob, holder, partial);
    const actual = core.leash_endpoints(
      mob.x, mob.y, mob.z, mob.prevX, mob.prevY, mob.prevZ, mob.width,
      mob.bodyYaw, mob.prevBodyYaw, mob.height,
      holder.x, holder.y, holder.z, holder.prevX, holder.prevY, holder.prevZ,
      holder.yaw, holder.prevYaw, holder.pitch, holder.prevPitch, holder.eyeHeight,
      holder.kind === 'leash', partial,
    );
    const flat = [expected.start[0], expected.start[1], expected.start[2], expected.end[0], expected.end[1], expected.end[2], expected.height];
    check(`leash endpoints ${n}`, flat.every((value, index) => Math.abs(value - actual[index]) < 1e-9), `${flat} != ${actual}`);

    const jsGeometry = leashGeometry(expected);
    const wasmGeometry = core.leash_geometry(...flat);
    let mismatch = jsGeometry.length === wasmGeometry.length ? -1 : -2;
    for (let i = 0; i < jsGeometry.length && mismatch === -1; i++) {
      if (jsGeometry[i] !== wasmGeometry[i]) mismatch = i;
    }
    check(`leash geometry ${n}`, mismatch === -1, `${mismatch}: ${jsGeometry[mismatch]} != ${wasmGeometry[mismatch]}`);
  }
}

// ------------------------------------------------------------------------ zoom

function zoomTests() {
  for (let n = 0; n < 80; n++) {
    const now = random() * 100000;
    const fov = 30 + random() * 100;
    const target = random() < 0.5 ? 0.25 : 1;
    const lens = { from: 0.25 + random() * 0.75, to: random() < 0.5 ? 0.25 : 1, started: now - random() * 400 };
    const reference = { ...lens };
    const expected = zoomStepJs(now, fov, target, reference);
    const actual = core.zoom_fov(now, fov, target, lens.from, lens.to, lens.started);
    check(`zoom factor ${n}`, Math.abs(expected - actual[0]) < 1e-12, `${expected} != ${actual[0]}`);
    check(`zoom state ${n}`, Math.abs(reference.from - actual[1]) < 1e-12 && reference.to === actual[2] && reference.started === actual[3], `${JSON.stringify(reference)} != ${actual}`);
  }
}

// -------------------------------------------------------------------- addresses

function addressTests() {
  const samples = [
    '', 'example.com', 'example.com:25566', '[::1]:25565', '::1', 'a:b:c', 'example.com:0',
    'example.com:99999', 'bad host', 'user:pass@wss://host', 'wss://user:pass@host:443/path?q=1',
    'ender:xyz@ws:///example.com:5123/lol', 'ws://host', 'wss://host:65535/', '%zz@ws://host',
    'wss://example.com', 'https://example.com:8443/ws', 'localhost:8080', '127.0.0.1',
    '[2001:db8::1]:25565', 'user%20name:pass%20word@wss://host/path',
  ];
  for (const [index, sample] of samples.entries()) {
    const expected = parseAddress(sample);
    const actualText = core.parse_address(sample);
    const actual = actualText === undefined ? null : JSON.parse(actualText);
    check(`address ${index}`, deepEqualJson(actual, expected), `${actualText} != ${JSON.stringify(expected)}`);
    check(`is eagler ${index}`, core.is_eagler_address(sample) === isEaglerAddress(sample));
  }
  for (const sample of ['localhost:8080', 'https://proxy.example/ws', 'proxy.example:9000/path', 'ws://localhost:1/', 'bad host', 'wss://proxy.example/ws/']) {
    check(`proxy url ${sample}`, core.parse_proxy_url(sample) === (parseProxyUrl(sample) ?? undefined));
    const base = proxyHttpBase(sample);
    check(`proxy base ${sample}`, core.proxy_http_base(sample) === (base ?? undefined));
  }
  for (const [host, port] of [['example.com', 25565], ['example.com', 25566], ['::1', 25565], ['::1', 1], ['wss://host/path', 25565]]) {
    check(`format address ${host}:${port}`, core.format_address(host, port) === formatAddress(host, port));
  }
}

// ----------------------------------------------------------- technical packets

function technicalPacketTests() {
  const modes = ['SEQUENCE', 'AUTO', 'REDSTONE', 'unknown'];
  const structureModes = ['SAVE', 'LOAD', 'CORNER', 'DATA', 'unknown'];
  const mirrors = ['NONE', 'LEFT_RIGHT', 'FRONT_BACK', 'unknown'];
  const rotations = ['NONE', 'CLOCKWISE_90', 'CLOCKWISE_180', 'COUNTERCLOCKWISE_90', 'unknown'];
  const packets = technicalPackets(() => new Writer(256));
  for (let n = 0; n < 60; n++) {
    const x = Math.floor((random() - 0.5) * 1000), y = Math.floor(random() * 256), z = Math.floor((random() - 0.5) * 1000);
    const command = `say ${Math.floor(random() * 1000)}`;
    const mode = modes[Math.floor(random() * modes.length)];
    const track = random() < 0.5, conditional = random() < 0.5, automatic = random() < 0.5;
    const expected = packets.updateCommandBlock({ x, y, z }, command, mode, track, conditional, automatic);
    const actual = core.update_command_block(x, y, z, command, mode, track, conditional, automatic);
    check(`command block packet ${n}`, sameBytes(expected, actual) === '', sameBytes(expected, actual));

    const id = Math.floor(random() * 1000);
    check(`command minecart packet ${n}`, sameBytes(packets.updateCommandMinecart(id, command, track), core.update_command_minecart(id, command, track)) === '');

    const t = {
      mode: structureModes[Math.floor(random() * structureModes.length)],
      name: `struct_${n}`,
      posX: Math.floor(random() * 16) - 8, posY: Math.floor(random() * 16) - 8, posZ: Math.floor(random() * 16) - 8,
      sizeX: Math.floor(random() * 16), sizeY: Math.floor(random() * 16), sizeZ: Math.floor(random() * 16),
      mirror: mirrors[Math.floor(random() * mirrors.length)],
      rotation: rotations[Math.floor(random() * rotations.length)],
      metadata: 'meta', integrity: Math.fround(random()), seed: BigInt(Math.floor(random() * 2 ** 32)),
      ignoreEntities: random() < 0.5, showAir: random() < 0.5, showBoundingBox: random() < 0.5,
    };
    const action = 1 + Math.floor(random() * 3);
    const expectedStructure = packets.updateStructure({ x, y, z }, action, t);
    const actualStructure = core.update_structure_block(
      x, y, z, action, t.mode, t.name, t.posX, t.posY, t.posZ, t.sizeX, t.sizeY, t.sizeZ,
      t.mirror, t.rotation, t.metadata, t.integrity, t.seed, t.ignoreEntities, t.showAir, t.showBoundingBox,
    );
    check(`structure packet ${n}`, sameBytes(expectedStructure, actualStructure) === '', sameBytes(expectedStructure, actualStructure));
  }
}

// --------------------------------------------------------------- entity pushing

function entityPushingTests() {
  const rules = [undefined, 'never', 'pushOwnTeam', 'pushOtherTeams', 'always'];
  for (let n = 0; n < 60; n++) {
    const ar = rules[Math.floor(random() * rules.length)];
    const same = random() < 0.3;
    const br = same ? ar : rules[Math.floor(random() * rules.length)];
    const shared = { collisionRule: ar };
    const a = same ? shared : ar === undefined ? undefined : { collisionRule: ar };
    const b = same ? shared : br === undefined ? undefined : { collisionRule: br };
    const expectedPush = teamsCanPush(a, b);
    const actualPush = core.teams_can_push(ar, br, a === b);
    check(`teams can push ${n}`, expectedPush === actualPush, `rules ${ar}/${br} same ${a === b}: ${expectedPush} != ${actualPush}`);
  }
  for (let n = 0; n < 120; n++) {
    const bb = [0, 0, 0, 0.6 + random(), 1.8, 0.6 + random()];
    const p = { x: (random() - 0.5) * 4, z: (random() - 0.5) * 4, collisionReduction: random() * 0.5 };
    const e = { x: (random() - 0.5) * 4, y: random() * 2, z: (random() - 0.5) * 4, width: 0.4 + random() * 2, height: 0.5 + random() * 2 };
    const expected = pushVector(p, e, bb);
    const actual = core.push_offset(bb[0], bb[1], bb[2], bb[3], bb[4], bb[5], p.x, p.z, e.x, e.y, e.z, e.width, e.height, p.collisionReduction);
    check(`push vector ${n}`, Math.abs(expected[0] - actual[0]) < 1e-12 && Math.abs(expected[1] - actual[1]) < 1e-12, `${expected} != ${actual}`);
  }
}

// ------------------------------------------------------------------ entity poses

function foxReference(a) {
  const names = ['body', 'tail', 'head', 'rightHindLeg', 'leftHindLeg', 'rightFrontLeg', 'leftFrontLeg'];
  const parts = {};
  for (const name of names) parts[name] = { rx: 0, ry: 0, rz: 0, px: 0, py: 0, pz: 0 };
  for (const name of ['rightHindLeg', 'leftHindLeg', 'rightFrontLeg', 'leftFrontLeg']) parts[name].visible = true;
  animateFox({ parts }, a);
  const p = parts;
  const out = [p.body.rx, p.body.ry, p.body.py, p.body.pz, p.body.rz, p.tail.rx, p.tail.pz, p.head.rx, p.head.ry, p.head.rz, p.head.px, p.head.py, p.head.pz];
  for (const name of ['rightHindLeg', 'leftHindLeg', 'rightFrontLeg', 'leftFrontLeg']) {
    out.push(p[name].rx, p[name].rz, p[name].py, p[name].pz, p[name].visible ? 1 : 0);
  }
  return out;
}

function ocelotReference(a, cat) {
  const names = ['body', 'head', 'tail', 'tail2', 'frontLeft', 'frontRight', 'backLeft', 'backRight'];
  const parts = {};
  for (const name of names) parts[name] = { rx: 0, ry: 0, rz: 0, px: 0, py: 0, pz: 0 };
  animateOcelot({ parts, jarModel: cat ? 'cat' : 'ocelot' }, a);
  const p = parts;
  return [
    p.body.rx, p.body.py, p.body.pz,
    p.head.rx, p.head.ry, p.head.py, p.head.pz,
    p.tail.rx, p.tail.py, p.tail.pz,
    p.tail2.rx, p.tail2.py, p.tail2.pz,
    p.frontLeft.rx, p.frontLeft.py, p.frontLeft.pz,
    p.frontRight.rx, p.frontRight.py, p.frontRight.pz,
    p.backLeft.rx, p.backLeft.py, p.backLeft.pz,
    p.backRight.rx, p.backRight.py, p.backRight.pz,
  ];
}

function entityPoseTests() {
  const close = (a, b) => a.length === b.length && a.every((value, index) => Math.abs(value - b[index]) < 1e-9);
  for (let n = 0; n < 60; n++) {
    const a = {
      ls: random() * 20, lsa: random(), foxHeadRoll: random(),
      foxCrouching: random() < 0.2, foxCrouchAmount: random() * 4,
      foxSleeping: random() < 0.2, child: random() < 0.3, sitting: random() < 0.3,
      pitch: random() * 180 - 90, yaw: random() * 360 - 180, age: random() * 1000,
      foxFaceplanted: random() < 0.2,
    };
    const expected = foxReference(a);
    const actual = core.fox_pose(a.ls, a.lsa, a.foxHeadRoll, a.foxCrouching, a.foxCrouchAmount, a.foxSleeping, a.child, a.sitting, a.pitch, a.yaw, a.age, a.foxFaceplanted);
    check(`fox pose ${n}`, close(expected, actual), `${JSON.stringify(expected)} != ${JSON.stringify(actual)}`);

    const groups = { head: { scale: { setScalar(v) { this.value = v; }, value: 0 }, position: { set(x, y, z) { this.x = x; this.y = y; this.z = z; } } }, body: { scale: { setScalar(v) { this.value = v; }, value: 0 }, position: { set(x, y, z) { this.x = x; this.y = y; this.z = z; } } } };
    scaleFoxChild(groups, a.child);
    const scaleExpected = [groups.head.scale.value, groups.head.position.x, groups.head.position.y, groups.head.position.z, groups.body.scale.value, groups.body.position.x, groups.body.position.y, groups.body.position.z];
    check(`fox scale ${n}`, close(scaleExpected, core.fox_scale(a.child)));

    const ocelot = { pitch: a.pitch, yaw: a.yaw, sitting: a.sitting, ls: a.ls, lsa: a.lsa };
    const cat = random() < 0.5;
    check(`ocelot pose ${n}`, close(ocelotReference(ocelot, cat), core.ocelot_pose(cat, ocelot.pitch, ocelot.yaw, ocelot.sitting, ocelot.ls, ocelot.lsa)));
  }
}

// --------------------------------------------------------------------- crypto

function cryptoBytes(length) {
  return Uint8Array.from({ length }, () => Math.floor(random() * 256));
}

function cryptoTests() {
  for (let n = 0; n < 30; n++) {
    const data = cryptoBytes(Math.floor(random() * 200));
    const expected = Buffer.from(sha1Js(data)).toString('hex');
    const actual = Buffer.from(core.sha1(data)).toString('hex');
    check(`sha1 ${n}`, expected === actual, `${expected} != ${actual}`);
  }

  for (let n = 0; n < 40; n++) {
    const secret = cryptoBytes(16);
    const plain = cryptoBytes(1 + Math.floor(random() * 96));
    const jsEnc = new Cfb8Js(secret, false);
    const wasmEnc = new core.Cfb8(secret, false);
    const expected = jsEnc.update(plain);
    const actual = wasmEnc.update(plain);
    check(`cfb8 encrypt ${n}`, sameBytes(expected, actual) === '', sameBytes(expected, actual));
    const jsDec = new Cfb8Js(secret, true).update(expected);
    const wasmDecCipher = new core.Cfb8(secret, true);
    const wasmDec = wasmDecCipher.update(actual);
    check(`cfb8 decrypt ${n}`, sameBytes(plain, wasmDec) === '', sameBytes(plain, wasmDec));
    check(`cfb8 roundtrip ${n}`, sameBytes(jsDec, wasmDec) === '');
    wasmEnc.free();
    wasmDecCipher.free();
  }

  for (let n = 0; n < 30; n++) {
    const id = `player_${Math.floor(random() * 100000)}`;
    const secret = cryptoBytes(Math.floor(random() * 20));
    const key = cryptoBytes(Math.floor(random() * 200));
    const expected = serverHash(id, secret, key);
    const actual = core.server_hash(id, secret, key);
    check(`server hash ${n}`, expected === actual, `${expected} != ${actual}`);
  }

  const { publicKey } = generateKeyPairSync('rsa', { modulusLength: 1024 });
  const spki = publicKey.export({ type: 'spki', format: 'der' });
  for (let n = 0; n < 8; n++) {
    const data = cryptoBytes(1 + Math.floor(random() * 100));
    const stream = cryptoBytes(4096);
    let cursor = 0;
    const expected = rsaEncrypt(spki, data, (length) => {
      const out = stream.subarray(cursor, cursor + length);
      cursor += length;
      return out;
    });
    const actual = core.rsa_encrypt(spki, data, stream);
    check(`rsa encrypt ${n}`, !!actual && sameBytes(expected, actual) === '', sameBytes(expected, actual ?? new Uint8Array()));
  }
}

// ------------------------------------------------------------------ water fog

function waterFogTests() {
  const cases = [
    { biomeId: 1, waterVision: 0, previous: null, now: 1000 },
    { biomeId: 6, waterVision: 0.5, previous: { target: 2302743, from: 329011, time: 0 }, now: 2500 },
    { biomeId: 1, waterVision: 1, previous: { target: 329011, from: 329011, time: 0 }, now: 6000 },
    { biomeId: 134, waterVision: 0.25, previous: { target: 6388580, from: 329011, time: 100 }, now: 1200 },
    { biomeId: 44, waterVision: 0.75, previous: null, now: 0 },
    { biomeId: 999, waterVision: 0, previous: { target: 4159204, from: 329011, time: 0 }, now: 4999 },
  ];
  for (const [index, entry] of cases.entries()) {
    const expected = waterFog(entry, entry.previous, entry.now);
    const actual = core.water_fog(
      entry.biomeId, entry.waterVision, !!entry.previous,
      entry.previous?.target ?? 0, entry.previous?.from ?? 0, entry.previous?.time ?? 0, entry.now,
    );
    check(`water fog ${index} target`, expected.transition.target === actual[0], `${expected.transition.target} != ${actual[0]}`);
    check(`water fog ${index} from`, expected.transition.from === actual[1], `${expected.transition.from} != ${actual[1]}`);
    check(`water fog ${index} time`, expected.transition.time === actual[2], `${expected.transition.time} != ${actual[2]}`);
    for (let channel = 0; channel < 3; channel++) {
      check(`water fog ${index} rgb${channel}`, Object.is(expected.color[channel], actual[3 + channel]), `${expected.color[channel]} != ${actual[3 + channel]}`);
    }
    check(`water fog ${index} density`, Object.is(expected.density, actual[6]), `${expected.density} != ${actual[6]}`);
  }
}

// ------------------------------------------------------------------ particles

function particleTests() {
  for (let n = 0; n < 400; n++) {
    const boxes = Array.from({ length: randInt(8) }, () =>
      [random() * 2 - 1, random() * 2 - 1, random() * 2 - 1, random() * 2 - 1, random() * 2 - 1, random() * 2 - 1]
        .map((v, i, a) => (i < 3 ? Math.min(v, a[i + 3] - 0.1) : v)));
    const particle = {
      x: random() * 2 - 1, y: random() * 2 - 1, z: random() * 2 - 1,
      mx: random() * 0.4 - 0.2, my: random() * 0.4 - 0.2, mz: random() * 0.4 - 0.2,
      width: 0.05 + random() * 0.4, height: 0.05 + random() * 0.4,
      collide: random() < 0.8,
    };
    const world = { getCollisions: () => boxes };
    const original = { ...particle };
    moveParticle(particle, world);
    const actual = core.move_particle(
      original.x, original.y, original.z,
      original.mx, original.my, original.mz,
      original.width, original.height, original.collide, boxes.flat(),
    );
    check(`particle ${n}`, sameBytes(
      Float64Array.of(particle.x, particle.y, particle.z, particle.mx ?? 0, particle.my ?? 0, particle.mz ?? 0, particle.onGround ? 1 : 0),
      actual,
    ) === '', `${JSON.stringify([particle.x, particle.y, particle.z])} != ${JSON.stringify(Array.from(actual))}`);
  }
}

// --------------------------------------------------------------------- fluids

function fluidTests() {
  const findState = (name, predicate = () => true) =>
    blockStates.find((state) => getBlock(state)?.name === name && predicate(getStateProperties(state)));
  const candidates = [
    blocksByName.water?.defaultState,
    blocksByName.lava?.defaultState,
    blocksByName.stone?.defaultState,
    blocksByName.seagrass?.defaultState,
    blocksByName.tall_seagrass?.defaultState,
    blocksByName.kelp?.defaultState,
    blocksByName.kelp_plant?.defaultState,
    findState('oak_stairs', (props) => props.waterlogged === 'true'),
  ].filter((state) => state !== undefined);
  const waterPlants = new Set(['seagrass', 'tall_seagrass', 'kelp', 'kelp_plant']);
  for (const state of candidates) {
    const block = getBlock(state);
    const props = getStateProperties(state);
    const expected = getFluidState(state);
    const actual = core.fluid_state(
      !!block.isLiquid,
      !!block.isLava,
      Number(props.level || 0),
      props.waterlogged === 'true',
      waterPlants.has(block.name),
    );
    if (!expected) {
      check(`fluid ${block.name} null`, actual === undefined || actual === null, `${actual}`);
      continue;
    }
    check(
      `fluid ${block.name}`,
      actual && actual.is_water === expected.isWater && actual.is_lava === expected.isLava
        && actual.level === expected.level && actual.source === expected.source
        && actual.height === expected.height,
      JSON.stringify({ expected, actual }),
    );
    if (actual) actual.free();
  }
}

// --------------------------------------------------------------------- biomes

function biomeTests() {
  const grass = new Uint8ClampedArray(256 * 256 * 4);
  const foliage = new Uint8ClampedArray(256 * 256 * 4);
  for (let i = 0; i < grass.length / 4; i++) {
    grass[i * 4] = (i * 7) & 255; grass[i * 4 + 1] = (i * 13) & 255; grass[i * 4 + 2] = (i * 29) & 255; grass[i * 4 + 3] = 255;
    foliage[i * 4] = (i * 31) & 255; foliage[i * 4 + 1] = (i * 17) & 255; foliage[i * 4 + 2] = (i * 3) & 255; foliage[i * 4 + 3] = 255;
  }
  const records = [
    { id: 1, name: 'plains', temperature: 0.8, rainfall: 0.4, precipitation: 'rain' },
    { id: 2, name: 'swamp', temperature: 0.8, rainfall: 0.9, precipitation: 'rain' },
    { id: 3, name: 'badlands', temperature: 2.0, rainfall: 0.0, precipitation: 'none' },
    { id: 4, name: 'dark_forest', temperature: 0.7, rainfall: 0.8, precipitation: 'rain' },
    { id: 5, name: 'snowy_tundra', temperature: -0.5, rainfall: 0.5, precipitation: 'snow' },
    { id: 200, name: 'custom', temperature: 0.5, rainfall: 0.5, precipitation: 'rain', waterColor: 0x123456 },
  ];
  initBiomes(records, grass, foliage);
  for (const record of records) {
    for (const y of [0, 64, 80, 128, 255]) {
      check(
        `biome grass ${record.id}/${y}`,
        grassColor(record.id, y) === core.grass_color(record.name, record.temperature, record.rainfall, y, grass),
        `${grassColor(record.id, y)} != ${core.grass_color(record.name, record.temperature, record.rainfall, y, grass)}`,
      );
      check(
        `biome foliage ${record.id}/${y}`,
        foliageColor(record.id, y) === core.foliage_color(record.name, record.temperature, record.rainfall, y, foliage),
      );
      check(
        `biome rain ${record.id}/${y}`,
        biomeRainType(record.id, y) === core.biome_rain_type(record.precipitation, record.temperature, record.rainfall, y),
      );
    }
    check(
      `biome water ${record.id}`,
      waterColor(record.id) === core.water_color(record.id, record.name, record.waterColor),
      `${waterColor(record.id)} != ${core.water_color(record.id, record.name, record.waterColor)}`,
    );
  }
}

// ---------------------------------------------------------------- name UUID

function uuidTests() {
  const samples = [
    new Uint8Array(),
    encodeUtf8Js('Notch'),
    encodeUtf8Js('OfflinePlayer:Notch'),
    encodeUtf8Js('player@example.com'),
  ];
  for (let n = 0; n < 100; n++) {
    samples.push(Uint8Array.from({ length: randInt(128) }, () => randInt(256)));
  }
  for (const [index, bytes] of samples.entries()) {
    const expected = nameUuid(bytes);
    const actual = core.name_uuid(bytes);
    check(`uuid ${index}`, expected === actual, `${expected} != ${actual}`);
  }
}

// -------------------------------------------------------------- packet IDs

function packetIdTests() {
  for (const [protocol, maps] of [
    [498, [[CLIENTBOUND_498, true], [SERVERBOUND_498, false]]],
    [578, [[CLIENTBOUND_578, true], [SERVERBOUND_578, false]]],
  ]) {
    const nameFn = protocol === 498 ? core.packet_name_498 : core.packet_name_578;
    const idFn = protocol === 498 ? core.packet_id_498 : core.packet_id_578;
    for (const [map, clientbound] of maps) {
      for (const [name, id] of Object.entries(map)) {
        check(`packet ${protocol} ${clientbound ? 'C' : 'S'} ${id} name`, nameFn(id, clientbound) === name);
        check(`packet ${protocol} ${clientbound ? 'C' : 'S'} ${name} id`, idFn(name, clientbound) === id);
      }
    }
  }
  check('packet 498 unknown', core.packet_name_498(999, true) === undefined);
  check('packet 578 unknown', core.packet_id_578('not_a_packet', false) === undefined);
}

// ----------------------------------------------------------------------- lod

function lodTests() {
  const settings = [
    {},
    { lodDistance: 0 },
    { lodDistance: 64 },
    { lodDistance: -8 },
    { lodDistance: Infinity },
    { lodDistance: null, lodChunks: 8 },
    { lodChunks: 4 },
  ];
  for (const [index, value] of settings.entries()) {
    const expected = lodDistance(value);
    const actual = core.lod_distance(value.lodDistance ?? null, value.lodChunks ?? null);
    check(`lod distance ${index}`, Object.is(expected, actual), `${expected} != ${actual}`);
    for (let n = 0; n < 40; n++) {
      const camera = [random() * 512 - 256, random() * 256, random() * 512 - 256];
      const cx = randInt(40) - 20, sy = randInt(16), cz = randInt(40) - 20;
      const previous = random() < 0.5;
      const want = sectionLod(value, camera, cx, sy, cz, previous);
      const got = core.section_lod(expected, camera[0], camera[1], camera[2], cx, sy, cz, previous);
      check(`lod section ${index}/${n}`, want === got, `${want} != ${got}`);
      const ds = random() * 1e6;
      check(`lod pose ${index}/${n}`, poseInterval(value, ds) === core.pose_interval(expected, ds));
    }
  }
}

function cameraEyeTests() {
  for (const heights of [[1.62], [1.62, 1.8], [1.62, 1.8, 0.6, 2.1, 0.2, 2.1]]) {
    const js = new CameraEyeJs();
    const rust = new core.CameraEye();
    for (const height of heights) {
      js.tick(height);
      rust.tick(height);
      for (const partial of [0, 0.25, 0.5, 1, 0.875]) {
        check(
          `camera eye ${heights.join(',')}/${height}/${partial}`,
          Object.is(js.height(partial, height), rust.height(partial, height)),
          `${js.height(partial, height)} != ${rust.height(partial, height)}`,
        );
      }
    }
    js.reset();
    rust.reset();
    check('camera eye reset', Object.is(js.height(0.5, 1.62), rust.height(0.5, 1.62)));
  }
}

// -------------------------------------------------------------------- random

function randomTests() {
  for (const seed of [0n, 1n, -1n, 123456789n, -9007199254740991n, 0x123456789abcdefn]) {
    const js = new JavaRandomJs(seed);
    const rust = new core.JavaRandom(seed);
    for (let bits = 1; bits <= 32; bits++) {
      check(`random ${seed} next(${bits})`, js.next(bits) === rust.next(bits));
    }
    for (const bound of [1, 2, 3, 5, 16, 17, 100, 1000, 1 << 30]) {
      for (let n = 0; n < 20; n++) {
        check(`random ${seed} nextInt(${bound})`, js.nextInt(bound) === rust.next_int(bound));
      }
    }
    for (let n = 0; n < 100; n++) {
      check(`random ${seed} nextFloat ${n}`, Object.is(js.nextFloat(), rust.next_float()));
      check(`random ${seed} nextDouble ${n}`, Object.is(js.nextDouble(), rust.next_double()));
    }
  }
}

// ------------------------------------------------------------------ collision

function collisionTests() {
  for (let n = 0; n < 300; n++) {
    const boxes = Array.from({ length: randInt(6) }, () =>
      Array.from({ length: 6 }, () => (random() - 0.5) * 4));
    const pos = { x: (random() - 0.5) * 4, y: (random() - 0.5) * 4, z: (random() - 0.5) * 4 };
    const entity = Array.from({ length: 6 }, () => (random() - 0.5) * 4);
    const expected = placementIntersects(boxes, pos, entity);
    const flat = boxes.flat();
    const actual = core.placement_intersects(flat, [pos.x, pos.y, pos.z], entity);
    check(`placement ${n}`, expected === actual, `${expected} != ${actual}`);
  }

  for (const distance of [0, 1, 2, -1]) {
    for (const bottom of [false, true]) {
      for (const feet of [-1, 0, 0.5, 1, Infinity]) {
        for (const sneaking of [false, true]) {
          const props = { distance: String(distance), bottom: String(bottom) };
          const mover = { bb: () => [0, feet, 0, 1, feet + 1.8, 1], sneaking };
          const expected = scaffoldingCollision(props, 0, mover);
          const actual = core.scaffolding_collision(distance, bottom, feet, 0, sneaking);
          check(
            `scaffolding ${distance}/${bottom}/${feet}/${sneaking}`,
            JSON.stringify(expected.flat()) === JSON.stringify(Array.from(actual)),
            `${JSON.stringify(expected.flat())} != ${JSON.stringify(Array.from(actual))}`,
          );
        }
      }
    }
  }
}

// ---------------------------------------------------------------------- poses

function poseTests() {
  for (const [pose, [width, height]] of Object.entries(PLAYER_POSES_114)) {
    check(`pose 1.14 ${pose} width`, core.player_pose_width_114(pose) === width);
    check(`pose 1.14 ${pose} height`, core.player_pose_height_114(pose) === height);
  }
  for (const pose of ['standing', 'sleeping', 'fall_flying', 'swimming', 'spin_attack', 'crouching', 'dying', 'sneaking']) {
    const expected = playerPoseDimensions(pose);
    check(`pose 1.15 ${pose} width`, core.player_pose_width_115(pose) === expected[0]);
    check(`pose 1.15 ${pose} height`, core.player_pose_height_115(pose) === expected[1]);
  }
  check('pose 1.15 sneaking aliases crouching', core.player_pose_height_115('sneaking') === 1.5);
}


// --------------------------------------------------------------------- blocks

function sortedProps(value) {
  return Object.keys(value || {}).sort().map((key) => [key, value[key]]);
}

function blockTests() {
  const blocksJson = readJson('blocks.json');
  const shapesJson = readJson('blockCollisionShapes.json');
  initBlocks(blocksJson, shapesJson);
  const reg = new core.BlockRegistryCore(JSON.stringify(blocksJson), JSON.stringify(shapesJson));
  try {
    check('blocks state count', reg.state_count() === blockStates.length, `${reg.state_count()} != ${blockStates.length}`);
    for (let state = 0; state < blockStates.length; state++) {
      const def = getBlock(state);
      const label = `state ${state} ${def.name}`;
      check(`blocks ${label} name`, reg.state_name(state) === def.name);
      check(`blocks ${label} block id`, reg.block_id(state) === def.id);
      check(`blocks ${label} props`, JSON.stringify(sortedProps(JSON.parse(reg.properties_json(state)))) === JSON.stringify(sortedProps(getStateProperties(state))));
      check(`blocks ${label} boxes`, JSON.stringify(Array.from(reg.collision_boxes(state))) === JSON.stringify(staticCollisionBoxes(state).flat()));
      check(`blocks ${label} opaque`, reg.opaque(state) === !!def.opaque);
      check(`blocks ${label} filter`, reg.filter_light(state) === def.filterLight);
      check(`blocks ${label} emit`, reg.emit_light(state) === def.emitLight);
      check(`blocks ${label} model`, reg.has_model(state) === !!def.hasModel);
    }

    // Neighbour-dependent stairs shapes.
    const stairStates = [];
    for (let state = 0; state < blockStates.length; state++) if (getBlock(state).isStairs) stairStates.push(state);
    let seed = 0x51ed;
    const rand = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let n = 0; n < 400; n++) {
      const state = stairStates[Math.floor(rand() * stairStates.length)];
      const neighbours = Array.from({ length: 6 }, () => blockStates[Math.floor(rand() * blockStates.length)]?.id ?? 0);
      const get = (x, y, z) => {
        const dx = x, dy = y, dz = z;
        if (dy === -1 && dx === 0 && dz === 0) return neighbours[0];
        if (dy === 1 && dx === 0 && dz === 0) return neighbours[1];
        if (dy === 0 && dx === 0 && dz === -1) return neighbours[2];
        if (dy === 0 && dx === 0 && dz === 1) return neighbours[3];
        if (dy === 0 && dx === -1 && dz === 0) return neighbours[4];
        if (dy === 0 && dx === 1 && dz === 0) return neighbours[5];
        return 0;
      };
      const expected = stairsShape(get, 0, 0, 0, state);
      const actual = core.stairs_shape_wasm(reg, state, Uint32Array.from(neighbours));
      check(`stairs ${n} shape`, expected === actual, `${expected} != ${actual}`);
    }

    // Door halves.
    for (let n = 0; n < 200; n++) {
      const state = Math.floor(rand() * 16);
      const below = blockStates[Math.floor(rand() * blockStates.length)]?.id ?? 0;
      const above = blockStates[Math.floor(rand() * blockStates.length)]?.id ?? 0;
      const get = (x, y) => (y < 0 ? below : above);
      const expected = doorProps(get, 0, 0, 0, state);
      const actual = JSON.parse(core.door_props_wasm(reg, state, below, above));
      const normDoor = (v) => JSON.stringify(Object.keys(v).sort().map((k) => [k, v[k]]));
      check(`door ${n}`, normDoor(expected) === normDoor(actual), `${normDoor(expected)} != ${normDoor(actual)}`);
    }

    // resolveState for every state (stairs use straight neighbours).
    for (let state = 0; state < blockStates.length; state += 1) {
      const expected = resolveState(state, () => 0, 0, 0, 0);
      const actual = core.resolve_state_wasm(reg, state, new Uint32Array(6));
      const parsed = actual === 'null' ? null : JSON.parse(actual);
      const norm = (value) => value === null ? null : { file: value.file, props: sortedProps(value.props) };
      check(`resolve ${state}`, JSON.stringify(norm(expected)) === JSON.stringify(norm(parsed)), `${JSON.stringify(norm(expected))} != ${JSON.stringify(norm(parsed))}`);
    }

    const items = ['stone', 'dirt', 'planks', 'sapling', 'sand', 'log', 'log2', 'leaves', 'leaves2', 'sponge', 'sandstone', 'tallgrass', 'wool', 'carpet', 'stained_glass', 'red_flower', 'stone_slab', 'wooden_slab', 'monster_egg', 'stonebrick', 'quartz_block', 'anvil', 'prismarine', 'double_plant', 'dye', 'coal', 'fish', 'concrete', 'skull', 'potion', 'boat', 'apple', 'light_gray_shulker_box'];
    for (const item of items) {
      for (let damage = 0; damage < 17; damage++) {
        const expected = itemModelName(item, damage);
        const actual = core.item_model_name_wasm(item, damage);
        check(`item model ${item}/${damage}`, expected === actual, `${expected} != ${actual}`);
      }
    }
  } finally {
    reg.free();
  }
}


// --------------------------------------------------------------------- models

function modelTests() {
  const models = {
    'block/cube_all': {
      textures: { all: 'block/stone', particle: '#all' },
      elements: [{
        from: [0, 0, 0], to: [16, 16, 16],
        faces: {
          down: { texture: '#all', cullface: 'down' },
          up: { texture: '#all', cullface: 'up' },
          north: { texture: '#all', cullface: 'north' },
          south: { texture: '#all', cullface: 'south' },
          west: { texture: '#all', cullface: 'west' },
          east: { texture: '#all', cullface: 'east' },
        },
      }],
    },
    'block/child': { parent: 'block/cube_all', textures: { all: 'block/dirt' }, ambientocclusion: false },
    'block/torch': {
      textures: { torch: 'block/torch', particle: '#torch' },
      elements: [{
        from: [7, 0, 7], to: [9, 10, 9],
        rotation: { origin: [8, 0, 8], axis: 'y', angle: 45, rescale: true },
        shade: false,
        faces: {
          up: { texture: '#torch', uv: [7, 6, 9, 8], tintindex: 2 },
          north: { texture: '#torch', uv: [7, 8, 9, 16], rotation: 90 },
        },
      }],
    },
    'block/slab': {
      textures: { all: 'block/stone' },
      elements: [{ from: [0, 0, 0], to: [16, 8, 16], faces: { up: { texture: '#all' }, down: { texture: '#all' } } }],
    },
    'block/weighted': {
      textures: { all: 'block/stone' },
      elements: [{ from: [0, 0, 0], to: [16, 16, 16], faces: { up: { texture: '#all' } } }],
    },
    'builtin/entity': {},
  };
  const blockstates = {
    torch: { variants: { normal: { model: 'block/torch' }, 'facing=north': { model: 'block/torch', x: 90 } } },
    slab: { variants: { 'type=bottom': { model: 'block/slab' }, 'type=double': { model: 'block/cube_all', y: 90, uvlock: true } } },
    grass_block: {
      multipart: [
        { apply: { model: 'block/cube_all' } },
        { when: { snowy: 'true' }, apply: [{ model: 'block/slab', weight: 3 }, { model: 'block/weighted', weight: 1 }] },
        { when: { OR: [{ snowy: 'true' }, { note: 'true' }] }, apply: { model: 'block/weighted' } },
      ],
    },
    weighted: { variants: { normal: [{ model: 'block/weighted', weight: 2 }, { model: 'block/child', weight: 1 }] } },
  };
  const atlasTable = {
    'block/stone': { uv: [0, 0, 0.25, 0.25], alpha: false },
    'block/dirt': { uv: [0.25, 0, 0.5, 0.25], alpha: true },
    'block/torch': { uv: [0.5, 0.5, 0.5625, 0.5625], alpha: true },
  };
  const atlas = {
    uv: (name) => (atlasTable[name] || atlasTable['block/stone'])?.uv ?? null,
    hasAlpha: (name) => !!atlasTable[name]?.alpha,
  };
  const jsStore = new ModelStore(models, blockstates, atlas);
  const reg = new core.ModelStoreCore(JSON.stringify(models), JSON.stringify(blockstates), JSON.stringify(atlasTable));
  const near = (a, b) => Math.abs(a - b) < 1e-6;
  const compareBake = (label, expected, actual) => {
    check(`models ${label} quads`, expected.quads.length === actual.quads.length, `${expected.quads.length} != ${actual.quads.length}`);
    for (let i = 0; i < Math.min(expected.quads.length, actual.quads.length); i++) {
      const a = expected.quads[i], b = actual.quads[i];
      check(`models ${label} ${i} dir`, a.dir === b.dir, `${a.dir} != ${b.dir}`);
      check(`models ${label} ${i} cull`, a.cull === b.cull, `${a.cull} != ${b.cull}`);
      check(`models ${label} ${i} tint`, a.tint === b.tint);
      check(`models ${label} ${i} shade`, a.shade === b.shade);
      check(`models ${label} ${i} alpha`, a.alpha === b.alpha);
      check(`models ${label} ${i} tex`, a.tex === b.tex, `${a.tex} != ${b.tex}`);
      check(`models ${label} ${i} pos`, a.pos.every((v, k) => near(v, b.pos[k])), `${Array.from(a.pos)} != ${JSON.stringify(b.pos)}`);
      check(`models ${label} ${i} uv`, a.uv.every((v, k) => near(v, b.uv[k])), `${Array.from(a.uv)} != ${JSON.stringify(b.uv)}`);
    }
    check(`models ${label} ao`, expected.ao === actual.ao, `${expected.ao} != ${actual.ao}`);
    check(`models ${label} bounds`, JSON.stringify(expected.bounds) === JSON.stringify(actual.bounds), `${JSON.stringify(expected.bounds)} != ${JSON.stringify(actual.bounds)}`);
    check(`models ${label} particle`, expected.particle === actual.particle, `${expected.particle} != ${actual.particle}`);
  };

  try {
    for (const name of ['block/cube_all', 'block/child', 'block/torch', 'block/slab', 'block/weighted', 'block/missing']) {
      for (const [rx, ry] of [[0, 0], [90, 0], [0, 90], [90, 90], [180, 270]]) {
        for (const uvlock of [false, true]) {
          const label = `${name} ${rx}/${ry}/${uvlock}`;
          const expected = jsStore.bakeModel(name, rx, ry, uvlock);
          const actual = JSON.parse(reg.bake_model_json(name, rx, ry, uvlock));
          compareBake(label, expected, actual);
        }
      }
    }
    for (const file of ['torch', 'slab', 'grass_block', 'weighted', 'unknown']) {
      for (const props of [{}, { facing: 'north' }, { type: 'double' }, { snowy: 'true' }, { note: 'true' }, { snowy: 'false', note: 'false' }]) {
        for (const rand of [0, 1, 2, 3.7, -4]) {
          const label = `${file} ${JSON.stringify(props)} r${rand}`;
          const expected = jsStore.bakeVariant(file, props, null, rand);
          const actual = JSON.parse(reg.bake_variant_json(file, JSON.stringify(props), '', rand));
          if (!expected) {
            check(`models ${label} null`, actual === null);
          } else {
            compareBake(label, expected, actual);
          }
        }
      }
    }
    for (const [file, key] of [['torch', 'facing=north'], ['slab', 'type=double']]) {
      const expected = jsStore.findVariant(file, {}, key);
      const actual = JSON.parse(reg.find_variant_json(file, '{}', key));
      check(`models variant ${file}/${key}`, JSON.stringify(expected) === JSON.stringify(actual), `${JSON.stringify(expected)} != ${JSON.stringify(actual)}`);
    }
  } finally {
    reg.free();
  }
}

// ----------------------------------------------------------------------- main

await initWasm();
if (!wasmReady()) {
  console.error('WASM core failed to load; run: node rust/build.mjs');
  process.exit(1);
}

console.log(`core ${core.core_version()} — comparing WASM against the JavaScript originals\n`);
const started = performance.now();
visgraphTests();
chunkCodecTests();
// ------------------------------------------- crafting / culling / GLSL / BSL

function craftingTests() {
  const table = {};
  for (let r = 0; r < 12; r++) {
    const result = { id: 100 + r, count: 1 + (r % 4), metadata: r % 3 };
    if (r % 2 === 0) {
      const h = 1 + (r % 3), w = 1 + ((r * 2) % 3);
      const inShape = [];
      for (let y = 0; y < h; y++) {
        const row = [];
        for (let x = 0; x < w; x++) {
          const cell = (x + y + r) % 4;
          row.push(cell === 0 ? null : cell === 1 ? { id: 5 + r } : cell === 2 ? 20 : { id: 30, metadata: 1 });
        }
        inShape.push(row);
      }
      table[`shaped_${r}`] = [{ result, inShape }];
    } else {
      const ingredients = [];
      for (let i = 0; i < 1 + (r % 3); i++) ingredients.push(i % 2 ? { id: 40 + i } : { id: 50 });
      table[`shapeless_${r}`] = [{ result, ingredients }];
    }
  }
  initRecipes(table);
  const durability = {};
  for (let id = 200; id < 210; id++) durability[id] = 60 + (id % 7) * 40;
  const items = { maxDurability: (id) => durability[id] ?? 0 };
  const wasmTable = new core.CraftingTableCore(JSON.stringify(table));
  check('crafting shaped count', wasmTable.shaped_count() === 6, `${wasmTable.shaped_count()}`);
  check('crafting shapeless count', wasmTable.shapeless_count() === 6, `${wasmTable.shapeless_count()}`);

  const pool = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 20, 30, 40, 41, 42, 50, 200, 201, 202, 203, 204];
  const shape = (value) => (value === null ? null : { id: value.id, count: value.count, damage: value.damage });
  for (let round = 0; round < 500; round++) {
    const n = 2 + (round % 2);
    const grid = new Array(n * n).fill(null);
    const filled = randInt(n * n + 1);
    for (let k = 0; k < filled; k++) {
      const id = pool[randInt(pool.length)];
      grid[randInt(n * n)] = { id, count: 1, damage: randInt(3) };
    }
    const expected = shape(craftResult(grid, n, items));
    const actual = JSON.parse(wasmTable.craft(JSON.stringify(grid), n, JSON.stringify(durability)));
    check(`crafting grid ${round}`, JSON.stringify(expected) === JSON.stringify(actual), `${JSON.stringify(expected)} != ${JSON.stringify(actual)}`);
  }
  for (let id = 0; id < 400; id += 7) {
    const expected = containerItem({ id, count: 1, damage: 0 });
    const actual = JSON.parse(core.container_item_wasm(id, 1, 0));
    check(`crafting container ${id}`, JSON.stringify(shape(expected)) === JSON.stringify(actual), `${JSON.stringify(shape(expected))} != ${JSON.stringify(actual)}`);
  }
}

function cullingTests() {
  const js = new SectionCuller();
  const wasm = new core.SectionCullerCore();
  for (let round = 0; round < 60; round++) {
    const renderDistance = 1 + (round % 3);
    const R = renderDistance + 1, W = 2 * R + 1;
    const cam = [random() * 96 - 32, random() * 200 - 32, random() * 96 - 32];
    const ccx = Math.floor(cam[0] / 16), ccz = Math.floor(cam[2] / 16);
    const columns = new Uint8Array(W * W);
    for (let i = 0; i < W; i++) {
      for (let j = 0; j < W; j++) columns[i * W + j] = random() < 0.9 ? 1 : 0;
    }
    const sections = new Map();
    const keys = [], flags = [], vis = [];
    for (let sy = 0; sy < 5; sy++) {
      for (let dz = -R; dz <= R; dz++) {
        for (let dx = -R; dx <= R; dx++) {
          if (random() < 0.4) continue;
          const cx = ccx + dx, cz = ccz + dz;
          let f = 0;
          if (random() < 0.8) f |= 1;
          if (random() < 0.4) f |= 2;
          if (random() < 0.25) f |= 4;
          const mask = new Uint8Array(6);
          for (let d = 0; d < 6; d++) mask[d] = random() < 0.55 ? 0xff : 0;
          sections.set(cullerSectionKey(cx, sy, cz), {
            index: keys.length,
            solid: !!(f & 1),
            cutout: !!(f & 2),
            translucent: !!(f & 4),
            vis: mask,
          });
          keys.push(cullerSectionKey(cx, sy, cz));
          flags.push(f);
          vis.push(mask[0], mask[1], mask[2], mask[3], mask[4], mask[5]);
        }
      }
    }
    const matrix = new Float32Array(16);
    for (let i = 0; i < 16; i++) matrix[i] = i % 5 === 0 ? 1 : (random() - 0.5) * 0.6;
    const planes = frustumPlanesJs(matrix);
    const flat = new Float64Array(24);
    for (let p = 0; p < 6; p++) flat.set(planes[p], p * 4);
    const cameraInOpaque = random() < 0.2;
    const enabled = random() < 0.75;
    const maxDist = 40 + random() * 60;
    js.enabled = enabled;
    const columnLoaded = (cx, cz) => columns[(cz - ccz + R) * W + (cx - ccx + R)] === 1;
    const expected = js.update(sections, planes, cam, renderDistance, columnLoaded, cameraInOpaque, maxDist).map((s) => s.index);
    const actual = Array.from(wasm.update(
      BigInt64Array.from(keys, (key) => BigInt(key)),
      new Uint8Array(flags),
      new Uint8Array(vis),
      flat,
      new Float64Array(cam),
      renderDistance,
      columns,
      cameraInOpaque,
      maxDist,
      enabled,
    ));
    check(`culling ${round}`, JSON.stringify(expected) === JSON.stringify(actual), `${expected.length} reached vs ${actual.length}`);
    check(`culling ${round} reachedCount`, js.reachedCount === wasm.reached_count(), `${js.reachedCount} != ${wasm.reached_count()}`);
    for (let k = 0; k < 6; k++) {
      const x = (ccx + randInt(2 * R + 1) - R) * 16 + random() * 16;
      const y = random() * 96 - 8;
      const z = (ccz + randInt(2 * R + 1) - R) * 16 + random() * 16;
      check(`culling ${round} visible ${k}`, js.isVisible(x, y, z) === wasm.is_visible(x, y, z));
    }
  }
}

function glslFunctionTests() {
  const names = ['helper', 'shade', 'wave', 'tint', 'fresnel'];
  for (let round = 0; round < 40; round++) {
    const used = names.slice(0, 2 + randInt(names.length - 1));
    let source = 'const float PI = 3.14159;\n';
    for (let i = 0; i < used.length; i++) source += `float ${used[i]}(float x) { return x * PI + ${i}.0; }\n`;
    source += 'float unused_fn(float x) { return x; }\n';
    source += `float root(float x) { float y = ${used[used.length - 1]}(x); return y; }\n`;
    const expected = selectGLSLFunctions(source, 'root');
    const actual = JSON.parse(core.select_glsl_functions_wasm(source, 'root'));
    check(`glsl select ${round}`, expected.source === actual.source, 'source differs');
    check(`glsl select ${round} list`, JSON.stringify(expected.functions) === JSON.stringify(actual.functions), `${JSON.stringify(expected.functions)} != ${JSON.stringify(actual.functions)}`);
  }
  for (const [source, root] of [
    ['float a() { return 1.0; }', 'b'],
    ['float a() { return 1.0; } float a(float x) { return x; }', 'a'],
    ['const float X = 1.0', 'X'],
  ]) {
    let jsErr = '', wasmErr = '';
    try { selectGLSLFunctions(source, root); } catch (error) { jsErr = error.message; }
    try { core.select_glsl_functions_wasm(source, root); } catch (error) { wasmErr = String(error); }
    check('glsl select error', !!jsErr === !!wasmErr, `${jsErr} vs ${wasmErr}`);
  }

  const ruleSources = [
    'MC_VERSION >= 1\nblock.10 = minecraft:stone\n',
    '#if MC_VERSION >= 2\nblock.20 = water:level=0 lava\n#else\nblock.30 = dirt\n#endif\n',
    'block.5 = minecraft:grass_block:snowy=true,false\n#if MC_VERSION > 400\nblock.6 = sand\n#endif\n',
    'block.7 = oak_stairs:facing=north,half=top\n',
    '#if MC_VERSION == 3\nblock.8 = a\n#elif MC_VERSION <= 2\nblock.9 = b\n#endif\n',
  ];
  for (const [index, source] of ruleSources.entries()) {
    for (const version of [1, 2, 3, 404, 578]) {
      let expected = null, actual = null, jsErr = '', wasmErr = '';
      try { expected = shaderBlockRules(source, version); } catch (error) { jsErr = error.message; }
      try { actual = JSON.parse(core.shader_block_rules_wasm(source, version)); } catch (error) { wasmErr = String(error); }
      check(`block rules ${index}/${version} error`, !!jsErr === !!wasmErr, `${jsErr} vs ${wasmErr}`);
      if (!jsErr && !wasmErr) {
        check(`block rules ${index}/${version}`, JSON.stringify(expected) === JSON.stringify(actual), `${JSON.stringify(expected)} != ${JSON.stringify(actual)}`);
      }
    }
  }
  const badRules = ['#if MC_VERSION >= 1\nblock.1 = stone\n', '#endif\n', '#if TIME > 1\nblock.1 = stone\n#endif\n'];
  for (const [index, source] of badRules.entries()) {
    let jsErr = '', wasmErr = '';
    try { shaderBlockRules(source, 2); } catch (error) { jsErr = error.message; }
    try { core.shader_block_rules_wasm(source, 2); } catch (error) { wasmErr = String(error); }
    check(`block rules bad ${index}`, !!jsErr === !!wasmErr, `${jsErr} vs ${wasmErr}`);
  }

  for (let round = 0; round < 20; round++) {
    const rules = [];
    const states = [];
    const stateNames = ['stone', 'water', 'lava', 'grass_block'];
    for (let i = 0; i < 40; i++) {
      const name = stateNames[randInt(stateNames.length)];
      states.push({ id: i, name, properties: { level: String(randInt(4)), snowy: random() < 0.5 ? 'true' : 'false' } });
    }
    for (let i = 0; i < 12; i++) {
      const name = stateNames[randInt(stateNames.length)];
      const properties = random() < 0.5 ? {} : { level: [String(randInt(4)), String(randInt(4))] };
      rules.push({ id: randInt(65000), name, properties });
    }
    const expected = animationLookup(rules, states);
    const actual = JSON.parse(core.animation_lookup_wasm(JSON.stringify(rules), JSON.stringify(states)));
    check(`animation lookup ${round} size`, expected.width === actual.width && expected.height === actual.height);
    check(`animation lookup ${round} data`, sameBytes(expected.data, actual.data) === '', sameBytes(expected.data, actual.data));
  }

  const literalSources = [
    'float tint; x = 2 * tint;',
    'vec3 tint; x = tint / 2;',
    'float tint; x = 2.5 * tint;',
    'float tint; x = 2;',
    'mat4 m; x = m * 2;',
    'float tint; x = 10 - tint + 3 * tint;',
    'float a; float b; x = 1 / a; y = b * 4;',
    'int i = 2 * 3;',
  ];
  for (const [index, source] of literalSources.entries()) {
    check(`glsl literals ${index}`, glslFloatLiterals(source) === core.glsl_float_literals_wasm(source), `${glslFloatLiterals(source)} != ${core.glsl_float_literals_wasm(source)}`);
  }
}

function glslPreprocessTests() {
  const expressions = ['A > 1', 'A + B * 2', '!A', '~B & 3', 'A << 2', 'defined(A) && B', 'A / B', '-A + B', 'B % 2', 'A == 2', 'A != B', '(A + 1) * 3', 'defined(NOPE)', 'A ^ B', 'A >> 1', 'A <= B'];
  // The divisor is kept non-zero: the JS yields ±Infinity for division by
  // zero, which an i32-returning kernel cannot represent (documented in
  // docs/rust-wasm-port.md).
  const macroSets = [
    { A: '2', B: '3' },
    { A: '0', B: '1' },
    { A: '5', B: '2' },
  ];
  for (const macros of macroSets) {
    const map = new Map(Object.entries({ GL_ES: '1', __VERSION__: '300', ...macros }));
    for (const expression of expressions) {
      let expected = null, actual = null, jsErr = '', wasmErr = '';
      try { expected = glslCondition(expression, map); } catch (error) { jsErr = error.message; }
      try { actual = core.glsl_condition_wasm(expression, JSON.stringify(macros)); } catch (error) { wasmErr = String(error); }
      check(`glsl condition ${expression}`, !!jsErr === !!wasmErr, `${jsErr} vs ${wasmErr}`);
      if (!jsErr && !wasmErr) check(`glsl condition value ${expression}`, expected === actual, `${expected} != ${actual}`);
    }
  }
  for (const [index, expression] of ['A +', '@', '(A', 'A &&'].entries()) {
    let jsErr = '', wasmErr = '';
    try { glslCondition(expression, new Map([['A', '1']])); } catch (error) { jsErr = error.message; }
    try { core.glsl_condition_wasm(expression, JSON.stringify({ A: '1' })); } catch (error) { wasmErr = String(error); }
    check(`glsl condition bad ${index}`, !!jsErr === !!wasmErr, `${jsErr} vs ${wasmErr}`);
  }

  const sources = [
    'void main() {\n#if A > 1\n  gl_FragColor = vec4(1.0);\n#else\n  gl_FragColor = vec4(0.0);\n#endif\n}\n',
    '#ifdef FANCY\n#define LEVEL 2\n#endif\nvoid main() { float x = LEVEL; }\n',
    '#ifndef PLAIN\nfloat a = 1.0;\n#endif\n#ifdef PLAIN\nfloat b = 2.0;\n#endif\n',
    '#if A == 2 && B > 1\nfloat yes = 1.0;\n#elif A == 0\nfloat maybe = 1.0;\n#else\nfloat no = 1.0;\n#endif\n',
    '// #if A\nfloat x = 1.0;\n/* #endif */\nfloat y = 2.0;\n',
  ];
  for (const [index, source] of sources.entries()) {
    for (const definitions of [{ A: '2', B: '2' }, { A: '0', B: '0', FANCY: '1' }, { A: '5', PLAIN: '1' }]) {
      let expected = null, actual = null, jsErr = '', wasmErr = '';
      try { expected = activeGLSL(source, definitions); } catch (error) { jsErr = error.message; }
      try { actual = core.active_glsl_wasm(source, JSON.stringify(definitions)); } catch (error) { wasmErr = String(error); }
      check(`glsl active ${index} error`, !!jsErr === !!wasmErr, `${jsErr} vs ${wasmErr}`);
      if (!jsErr && !wasmErr) check(`glsl active ${index}`, expected === actual, `\n${expected}\n---\n${actual}`);
    }
  }
}

function shaderLightingTests() {
  for (const name of ['LIGHT_DR', 'AMBIENT_NI', 'BLOCKLIGHT_R', 'MINLIGHT_I', 'NETHER_NG', 'END_B', 'LIGHT_XYZ', 'SHADOW_R', 'BLOCKLIGHT_', 'AMBIENT_MR']) {
    check(`lighting option ${name}`, lightingOption.test(name) === core.is_lighting_option_wasm(name));
  }
  const keys = ['BLOCKLIGHT_R', 'BLOCKLIGHT_G', 'BLOCKLIGHT_B', 'BLOCKLIGHT_I', 'LIGHT_DR', 'LIGHT_DG', 'AMBIENT_DR', 'LIGHT_MR', 'LIGHT_MI', 'LIGHT_DI', 'AMBIENT_NI'];
  for (let round = 0; round < 80; round++) {
    const options = [];
    const values = {};
    for (const key of keys) {
      if (random() < 0.85) options.push({ name: key, default: Math.round(random() * 255) });
      if (random() < 0.4) values[key] = Math.round(random() * 300);
    }
    const expected = packLighting(options, values);
    const actual = JSON.parse(core.pack_lighting_wasm(JSON.stringify(options), JSON.stringify(values)));
    check(`lighting pack ${round} required`, (expected === null) === (actual === null), `${expected === null} vs ${actual === null}`);
    if (expected && actual) {
      const expectedKeys = Object.keys(expected).sort();
      const actualKeys = Object.keys(actual).sort();
      check(`lighting pack ${round} keys`, JSON.stringify(expectedKeys) === JSON.stringify(actualKeys), `${JSON.stringify(expectedKeys)} != ${JSON.stringify(actualKeys)}`);
      for (const key of expectedKeys) {
        check(`lighting pack ${round} ${key}`, expected[key].every((v, i) => Math.abs(v - actual[key][i]) < 1e-12), `${JSON.stringify(expected[key])} != ${JSON.stringify(actual[key])}`);
      }
    }
  }

  const colorKeys = ['LIGHT_M', 'LIGHT_D', 'LIGHT_E', 'LIGHT_N', 'AMBIENT_M', 'AMBIENT_D', 'AMBIENT_E', 'AMBIENT_N', 'BLOCKLIGHT_', 'MINLIGHT_', 'END_', 'NETHER_N'];
  for (let round = 0; round < 120; round++) {
    // `lightingFrame` dereferences BLOCKLIGHT_ unconditionally, so it must be
    // present or the JS itself throws.
    const colors = { BLOCKLIGHT_: [random(), random(), random()] };
    for (const key of colorKeys) {
      if (random() < 0.85) colors[key] = [random(), random(), random()];
    }
    const worldTime = (random() * 5 - 1) * 24000;
    const dimension = [0, -1, 1][randInt(3)];
    const rain = random();
    const expected = lightingFrame(colors, worldTime, dimension, rain);
    const actual = JSON.parse(core.lighting_frame_wasm(JSON.stringify(colors), worldTime, dimension, rain));
    for (const field of ['ambient', 'direct', 'block', 'minimum']) {
      check(`lighting frame ${round} ${field}`, expected[field].every((v, i) => Math.abs(v - actual[field][i]) < 1e-9), `${JSON.stringify(expected[field])} != ${JSON.stringify(actual[field])}`);
    }
    check(`lighting frame ${round} dimension`, expected.dimension === actual.dimension);
  }
}

function skyTests() {
  const near = (a, b) => Math.abs(a - b) <= 1e-12;
  const nearList = (a, b) => a.length === b.length && a.every((value, index) => Math.abs(value - b[index]) <= 1e-12);
  for (let i = 0; i < 200; i++) {
    const worldTime = (random() * 10 - 2) * 24000;
    const partial = random();
    const angle = celestialAngle(worldTime, partial);
    const wasmAngle = core.celestial_angle_wasm(worldTime, partial);
    check(`sky angle ${i}`, near(angle, wasmAngle), `${angle} != ${wasmAngle}`);

    const rain = random(), thunder = random();
    check(`sky sun ${i}`, near(sunBrightness(angle, rain, thunder), core.sun_brightness_wasm(wasmAngle, rain, thunder)));
    check(`sky star ${i}`, near(starBrightness(angle), core.star_brightness_wasm(wasmAngle)));

    const temperature = (random() * 4 - 2) * 3;
    check(`sky color ${i}`, nearList(skyColor(angle, temperature, rain, thunder), Array.from(core.sky_color_wasm(wasmAngle, temperature, rain, thunder)), 'sky'));
    check(`sky fog ${i}`, nearList(baseFogColor(angle), Array.from(core.base_fog_color_wasm(wasmAngle))));
    check(`sky cloud ${i}`, nearList(cloudColor(angle, rain, thunder), Array.from(core.cloud_color_wasm(wasmAngle, rain, thunder))));
    const expectedSunrise = sunriseColors(angle);
    const actualSunrise = Array.from(core.sunrise_colors_wasm(wasmAngle));
    check(`sky sunrise ${i}`, expectedSunrise === null ? actualSunrise.length === 0 : nearList(expectedSunrise, actualSunrise), `${JSON.stringify(expectedSunrise)} != ${JSON.stringify(actualSunrise)}`);
  }

  for (const dimension of [-1, 0, 1]) {
    const expected = brightnessTable(dimension);
    const actual = Array.from(core.brightness_table_wasm(dimension));
    check(`sky brightness table ${dimension}`, nearList(expected, actual), `${JSON.stringify(expected)} != ${JSON.stringify(actual)}`);
  }

  for (let i = 0; i < 60; i++) {
    const sun = random();
    const dimension = [-1, 0, 1][randInt(3)];
    const options = {
      sun,
      dimension,
      torchFlicker: random(),
      gamma: random(),
      nightVision: random() < 0.3 ? random() : 0,
      lightning: random() < 0.3 ? random() : 0,
    };
    const expected = new Uint8Array(16 * 16 * 4);
    updateLightmap(expected, options);
    const actual = new Uint8Array(16 * 16 * 4);
    core.update_lightmap_wasm(actual, options.sun, options.dimension, options.torchFlicker, options.gamma, options.nightVision, options.lightning);
    check(`sky lightmap ${i}`, sameBytes(expected, actual) === '', sameBytes(expected, actual));
  }

  const expectedStars = buildStarPositions();
  const actualStars = Array.from(core.build_star_positions_wasm());
  check('sky stars length', expectedStars.length === actualStars.length, `${expectedStars.length} != ${actualStars.length}`);
  check('sky stars values', nearList(expectedStars, actualStars), 'star positions differ');
}

function mathHelperTests() {
  const near = (a, b) => Math.abs(a - b) <= 1e-12;
  for (let i = 0; i < 400; i++) {
    // Radians, including negatives and values far outside one turn.
    const value = (random() * 40 - 20) * Math.PI;
    check(`math sin ${i}`, near(mcSin(value), core.mc_sin_wasm(value)), `${mcSin(value)} != ${core.mc_sin_wasm(value)}`);
    check(`math cos ${i}`, near(mcCos(value), core.mc_cos_wasm(value)), `${mcCos(value)} != ${core.mc_cos_wasm(value)}`);
  }
  for (const name of ['honey_block', 'stone', 'slime_block', '']) {
    check(`honey fall ${name}`, honeyFallMultiplier(name) === core.honey_fall_multiplier_wasm(name));
    check(`honey jump ${name}`, honeyJumpFactor(name) === core.honey_jump_factor_wasm(name));
    check(`honey move ${name}`, honeyMovementFactor(name) === core.honey_movement_factor_wasm(name));
  }
  for (let i = 0; i < 200; i++) {
    const bb = [random() * 4 - 2, random() * 4 - 2, random() * 4 - 2, random() * 4, random() * 4, random() * 4];
    const x = random() * 2 - 1, y = random() * 2 - 1, z = random() * 2 - 1;
    check(`offset bb ${i}`, JSON.stringify(offsetBB(bb, x, y, z)) === JSON.stringify(Array.from(core.offset_bb_wasm(bb, x, y, z))));
  }
  // look_vec is internal to the JS module; check the wasm wrapper against the
  // vanilla identity: pitch 0 / yaw 0 is +Z, pitch 90 is straight down.
  const forward = Array.from(core.look_vec_wasm(0, 0));
  check('look vec forward', Math.abs(forward[2] - 1) < 1e-5, `${forward[2]}`);
  const down = Array.from(core.look_vec_wasm(90, 0));
  check('look vec down', Math.abs(down[1] + 1) < 1e-5, `${down[1]}`);
}

legacyColumnTests();
pngTests();
pngEncodeTests();
frustumTests();
nbtTests();
mat4Tests();
biomeZoomTests();
commandTreeTests();
recipesTests();
cryptoTests();
snbtTests();
leashTests();
entityPoseTests();
entityPushingTests();
technicalPacketTests();
addressTests();
zoomTests();
zipTests();
bufferTests();
base85Tests();
utf8Tests();
base64Tests();
poseTests();
collisionTests();
randomTests();
uuidTests();
particleTests();
waterFogTests();
fluidTests();
biomeTests();
packetIdTests();
lodTests();
cameraEyeTests();
physicsTests();
worldTests();
blockTests();
modelTests();
craftingTests();
cullingTests();
glslFunctionTests();
glslPreprocessTests();
shaderLightingTests();
skyTests();
mathHelperTests();
const elapsed = performance.now() - started;

console.log(`\n${passed} checks passed, ${failed} failed (${elapsed.toFixed(1)} ms)`);
if (failed) {
  console.error(`\n${failures.length} failure(s). First ones:`);
  for (const failure of failures.slice(0, 40)) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log('WASM core matches the JavaScript implementation.');
