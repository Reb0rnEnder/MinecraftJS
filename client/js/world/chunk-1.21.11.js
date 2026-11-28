import { Reader } from '../net/buffer.js';

export const BLOCK_STATE_COUNT_774 = 32768;
export const AIR_STATES_774 = Object.freeze([0]);

/**
 * Decode a 1.21.11 (protocol 774) PalettedContainer without a VarInt long-array length prefix.
 */
export function readPalette774(r, size, registrySize, kind) {
  const wireBits = r.u8();
  const localMax = kind === 'blocks' ? 8 : 3;
  const minLocal = kind === 'blocks' ? 4 : 1;
  if (wireBits > 32 || registrySize < 1 || !Number.isSafeInteger(registrySize) || registrySize > 0x100000000) {
    throw Error('Invalid palette registry or width');
  }

  const ArrayType = registrySize <= 65536 ? Uint16Array : Uint32Array;
  const bits = wireBits === 0
    ? 0
    : wireBits <= localMax
      ? Math.max(minLocal, wireBits)
      : Math.max(1, Math.ceil(Math.log2(registrySize)));

  if (bits === 0) {
    const id = r.varint();
    if (id < 0 || id >= registrySize) {
      throw Error(`Invalid single palette value: ${kind} id ${id}, registry size ${registrySize}, palette byte ${r.offset - 1}`);
    }
    return new ArrayType(size).fill(id);
  }

  let palette;
  if (wireBits <= localMax) {
    const n = r.varint();
    if (n < 1 || n > 2 ** bits) throw Error('Invalid local palette length');
    palette = new Uint32Array(n);
    for (let i = 0; i < n; i++) {
      const id = r.varint();
      if (id < 0 || id >= registrySize) {
        throw Error(`Invalid palette registry value: ${kind} id ${id}, registry size ${registrySize}, palette byte ${r.offset - 1}`);
      }
      palette[i] = id;
    }
  }

  const perLong = Math.floor(64 / bits);
  const length = Math.ceil(size / perLong);
  const result = new ArrayType(size);
  const mask = bits >= 32 ? 0xffffffff : (2 ** bits - 1) >>> 0;

  // 1.21.11 uses FriendlyByteBuf.writeFixedSizeLongArray: no VarInt length prefix before the longs.
  r._check(length * 8);
  const b = r.bytes;
  const base = r.offset;
  const paletteLength = palette ? palette.length : 0;
  let index = 0;

  for (let i = 0, o = base; i < length; i++, o += 8) {
    const high = ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
    const low = ((b[o + 4] << 24) | (b[o + 5] << 16) | (b[o + 6] << 8) | b[o + 7]) >>> 0;
    const count = Math.min(perLong, size - index);
    for (let e = 0; e < count; e++, index++) {
      const shift = e * bits;
      let value = shift < 32 ? low >>> shift : high >>> (shift - 32);
      if (shift < 32 && shift + bits > 32) value |= high << (32 - shift);
      value = (value & mask) >>> 0;
      if (palette) {
        if (value >= paletteLength) {
          r.offset = base + length * 8;
          throw Error('Invalid local palette index');
        }
        result[index] = palette[value];
      } else {
        if (value >= registrySize) {
          r.offset = base + length * 8;
          throw Error('Invalid direct palette value');
        }
        result[index] = value;
      }
    }
  }

  r.offset = base + length * 8;
  return result;
}

const AIR_TABLES = new Map();
function airLookup(stateCount, airStates) {
  const key = stateCount + ':' + airStates.join(',');
  let t = AIR_TABLES.get(key);
  if (!t) {
    t = new Uint8Array(stateCount);
    for (const s of airStates) t[s] = 1;
    AIR_TABLES.set(key, t);
  }
  return t;
}

/**
 * Decode 1.21.11 (protocol 774) LevelChunkSection payloads into sections and 3D quart biomes.
 */
export function decodeChunkData774(packet, {
  stateCount = BLOCK_STATE_COUNT_774,
  biomeCount,
  sectionCount = 24,
  airStates = AIR_STATES_774,
} = {}) {
  if (!Number.isInteger(biomeCount) || biomeCount < 1) throw Error('Missing 774 biome registry size');
  if (!Number.isInteger(stateCount) || stateCount < 1) throw Error('Invalid 774 block state registry size');
  if (!Number.isInteger(sectionCount) || sectionCount < 1 || sectionCount > 254) throw Error('Invalid dimension section count');
  if (!Array.isArray(airStates) || !airStates.length || airStates.some(s => !Number.isInteger(s) || s < 0 || s >= stateCount)) {
    throw Error('Invalid air state set');
  }

  const r = new Reader(packet.chunkData);
  const sections = new Array(sectionCount);
  const biomes = new (biomeCount <= 65536 ? Uint16Array : Uint32Array)(sectionCount * 64);
  const airTable = airLookup(stateCount, airStates);

  for (let y = 0; y < sectionCount; y++) {
    const offset = r.offset;
    try {
      const wireNonAir = r.u16();
      const blocks = readPalette774(r, 4096, stateCount, 'blocks');
      const sectionBiomes = readPalette774(r, 64, biomeCount, 'biomes');
      let nonAir = 4096;
      for (let i = 0; i < 4096; i++) nonAir -= airTable[blocks[i]];
      sections[y] = { blocks, nonAir, wireNonAir };
      biomes.set(sectionBiomes, y * 64);
    } catch (error) {
      throw Error(`${error.message} (chunk ${packet.x},${packet.z}, section ${y}, byte ${offset})`, { cause: error });
    }
  }

  if (r.remaining() !== 0) throw Error('Trailing 774 section data');
  return { sections, biomes };
}
