import { maskHas, maskFits } from '../net/bitset.js';
// Since 1.16, entries are padded within each long and never straddle long boundaries.
import {Reader756} from '../net/protocol-1.17.1.js';
export const BLOCK_STATE_COUNT_756 = 20342;
export const AIR_STATES_756 = Object.freeze([0, 9916, 9915]);

export function decodeChunkData756(packet, {stateCount = BLOCK_STATE_COUNT_756, sectionCount = 16} = {}) {
  const {bitMap, chunkData} = packet;
  if (!Number.isInteger(sectionCount) || sectionCount < 1 || sectionCount > 254 || !maskFits(bitMap, sectionCount)) throw Error('Invalid terrain section mask');
  const r = new Reader756(chunkData), sections = new Array(sectionCount).fill(null);
  const globalBits = Math.ceil(Math.log2(stateCount));
  for (let y = 0; y < sectionCount; y++) if (maskHas(bitMap, y)) {
    const offset = r.offset;
    let wireBits, wireNonAir;
    try {
      wireNonAir = r.u16();
      wireBits = r.i8();
      // PalettedContainer.setBits normalizes small/local and direct registry widths.
      const bits = wireBits <= 4 ? 4 : wireBits < 9 ? wireBits : globalBits;
      // LevelChunkSection.recalcBlockCounts counts non-empty fluids again; the
      // transmitted occupancy can exceed 4096. Recount actual cells below.
      let palette = null;
      if (bits <= 8) {
        const n = r.varint();
        if (n < 1 || n > 1 << bits) throw Error('Invalid local palette');
        palette = new Uint32Array(n);
        for (let i = 0; i < n; i++) {
          const id = r.varint();
          if (id < 0 || id >= stateCount) throw Error('Invalid block state');
          palette[i] = id;
        }
      }
      const perLong = Math.floor(64 / bits), length = r.varint();
      if (length !== Math.ceil(4096 / perLong)) throw Error('Invalid padded palette length');
      const blocks = new Uint32Array(4096), mask = (1 << bits) - 1;
      let index = 0, nonAir = 0;
      for (let i = 0; i < length; i++) {
        // Read the big-endian long as two words. Entries never cross long boundaries.
        const high = r.i32() >>> 0, low = r.i32() >>> 0;
        for (let entry = 0; entry < perLong && index < 4096; entry++, index++) {
          const shift = entry * bits;
          let value = shift < 32 ? low >>> shift : high >>> (shift - 32);
          if (shift < 32 && shift + bits > 32) value |= high << (32 - shift);
          let state = value & mask;
          if (palette) {
            if (state >= palette.length) throw Error('Invalid palette index');
            state = palette[state];
          } else if (state >= stateCount) throw Error('Invalid global block state');
          blocks[index] = state;
          if (!AIR_STATES_756.includes(state)) nonAir++;
        }
      }
      sections[y] = {blocks, nonAir, wireNonAir};
    } catch (error) {
      throw Error(`${error.message} (chunk ${packet.x ?? '?'},${packet.z ?? '?'}, section ${y}, byte ${offset}, count ${wireNonAir ?? '?'}, bits ${wireBits ?? '?'})`, {cause: error});
    }
  }
  if (r.remaining()) throw Error('Trailing section data');
  return {sections, biomes: packet.biomes || null};
}
