import {nativeSkyLight} from './native-light.js';
import {getBlock} from './blocks.js';
const isAir=state=>state===0||!!getBlock(state)?.isAir;
// Chunk storage: 16 sections of 16^3 flattened global block-state ids (1.13+),
// nibble arrays for block light and sky light, and a 16x16 biome array.

export class Section {
  constructor(hasSky) {
    this.blocks = new Uint32Array(4096);
    this.blockLight = new Uint8Array(2048);
    this.skyLight = new Uint8Array(2048);
    if (hasSky) this.skyLight.fill(0xff);
    this.nonAir = 0;
  }

  static index(x, y, z) { return (y << 8) | (z << 4) | x; }

  get(x, y, z) { return this.blocks[(y << 8) | (z << 4) | x]; }

  set(x, y, z, state) {
    const i = (y << 8) | (z << 4) | x;
    const old = this.blocks[i];
    if (isAir(old) && !isAir(state)) this.nonAir++;
    else if (!isAir(old) && isAir(state)) this.nonAir--;
    this.blocks[i] = state;
  }

  getSky(i) { return (this.skyLight[i >> 1] >> ((i & 1) << 2)) & 15; }
  getBlockLight(i) { return (this.blockLight[i >> 1] >> ((i & 1) << 2)) & 15; }

  setSky(i, v) {
    const j = i >> 1;
    if (i & 1) this.skyLight[j] = (this.skyLight[j] & 0x0f) | (v << 4);
    else this.skyLight[j] = (this.skyLight[j] & 0xf0) | v;
  }

  setBlockLight(i, v) {
    const j = i >> 1;
    if (i & 1) this.blockLight[j] = (this.blockLight[j] & 0x0f) | (v << 4);
    else this.blockLight[j] = (this.blockLight[j] & 0xf0) | v;
  }

  recount() {
    let n = 0;
    for (let i = 0; i < 4096; i++) if (!isAir(this.blocks[i])) n++;
    this.nonAir = n;
  }
}

export class Chunk {
  constructor(x, z, hasSky) {
    this.x = x;
    this.z = z;
    this.hasSky = hasSky;
    this.sections = new Array(16).fill(null);
    this.biomes = new Uint32Array(256);
    this.heightMap = new Uint16Array(256); // y of highest light-blocking block + 1
    this.tileEntities = new Map(); // "x,y,z" -> nbt (simplified)
  }

  getState(x, y, z) {
    if (y < 0 || y > 255) return 0;
    const s = this.sections[y >> 4];
    return s ? s.blocks[((y & 15) << 8) | (z << 4) | x] : 0;
  }

  setState(x, y, z, state) {
    this.debugHeightRevision=(this.debugHeightRevision||0)+1;
    if (y < 0 || y > 255) return;
    let s = this.sections[y >> 4];
    if (!s) {
      if (state === 0) return;
      s = this.sections[y >> 4] = new Section(this.nativeLight?false:this.hasSky);
      if(this.nativeLight){s.skyLight=this.nativeLight.sky[(y>>4)+1] ||= new Uint8Array(2048);s.blockLight=this.nativeLight.block[(y>>4)+1] ||= new Uint8Array(2048);}
    }
    s.set(x, y & 15, z, state);
  }

  getSkyLight(x, y, z) {
    if(this.nativeLight)return nativeSkyLight(this.nativeLight,x,y,z,this.hasSky);
    if(y<0)return 0;if(y>255)return this.hasSky?15:0;
    const s=this.sections[y>>4];return s?s.getSky(((y&15)<<8)|(z<<4)|x):this.hasSky?15:0;
  }

  getBlockLight(x, y, z) {
    if(this.nativeLight){const a=this.nativeLight.block[(y>>4)+1],i=((y&15)<<8)|(z<<4)|x;return a?(a[i>>1]>>((i&1)<<2))&15:0;}
    if(y<0||y>255)return 0;const s=this.sections[y>>4];return s?s.getBlockLight(((y&15)<<8)|(z<<4)|x):0;
  }

  setSkyLight(x, y, z, v) {
    if (y < 0 || y > 255) return;
    let s = this.sections[y >> 4];
    if (!s) s = this.sections[y >> 4] = new Section(this.nativeLight?false:this.hasSky);
      if(this.nativeLight){s.skyLight=this.nativeLight.sky[(y>>4)+1] ||= new Uint8Array(2048);s.blockLight=this.nativeLight.block[(y>>4)+1] ||= new Uint8Array(2048);}
    s.setSky(((y & 15) << 8) | (z << 4) | x, v);
  }

  setBlockLightAt(x, y, z, v) {
    if (y < 0 || y > 255) return;
    let s = this.sections[y >> 4];
    if (!s) s = this.sections[y >> 4] = new Section(this.nativeLight?false:this.hasSky);
      if(this.nativeLight){s.skyLight=this.nativeLight.sky[(y>>4)+1] ||= new Uint8Array(2048);s.blockLight=this.nativeLight.block[(y>>4)+1] ||= new Uint8Array(2048);}
    s.setBlockLight(((y & 15) << 8) | (z << 4) | x, v);
  }

  // Parse 1.9+ chunk data (ChunkSection / BlockStateContainer): per section in bitMap a palette, the packed block
  // states (entries may span two longs), block light and sky light (if the dimension has sky); then the biomes
  // for a full chunk. Returns the number of bytes consumed.
  load(data, offset, bitMap, groundUp, skyLight) {
    let o = offset;
    const varint = () => {
      let v = 0, shift = 0, b;
      do { b = data[o++]; v |= (b & 0x7f) << shift; shift += 7; } while (b & 0x80);
      return v;
    };
    for (let s = 0; s < 16; s++) {
      if (!(bitMap & (1 << s))) {
        if (groundUp) this.sections[s] = null;
        continue;
      }
      let sec = this.sections[s];
      if (!sec) sec = this.sections[s] = new Section(this.hasSky);
      let bits = data[o++];
      const plen = bits <= 8 ? varint() : 0; // 1.13 global palettes write no palette header.
      let palette = null;
      if (plen) { palette = new Int32Array(plen); for (let i = 0; i < plen; i++) palette[i] = varint(); }
      if (bits < 4) bits = 4;
      if (bits > 8) palette = null; // flattened global registry state ids
      const nLongs = varint();
      // big-endian longs -> (lo, hi) 32-bit words
      const words = new Uint32Array(nLongs * 2);
      for (let i = 0; i < nLongs; i++, o += 8) {
        words[i * 2 + 1] = ((data[o] << 24) | (data[o + 1] << 16) | (data[o + 2] << 8) | data[o + 3]) >>> 0;
        words[i * 2] = ((data[o + 4] << 24) | (data[o + 5] << 16) | (data[o + 6] << 8) | data[o + 7]) >>> 0;
      }
      const mask = bits >= 32 ? 0xffffffff : (1 << bits) - 1;
      const b = sec.blocks;
      for (let i = 0; i < 4096; i++) {
        const bit = i * bits;
        const w = bit >>> 5, sh = bit & 31; // 32-bit word index (lo word first) and offset
        let v = words[w] >>> sh;
        if (sh + bits > 32) v |= words[w + 1] << (32 - sh);
        v &= mask;
        b[i] = palette ? palette[v] || 0 : v;
      }
      sec.recount();
      sec.blockLight.set(data.subarray(o, o + 2048));
      o += 2048;
      if (skyLight) {
        sec.skyLight.set(data.subarray(o, o + 2048));
        o += 2048;
      }
    }
    if (groundUp) {
      // 1.13 Chunk Data stores 256 biome registry ids as big-endian i32 values.
      for (let i = 0; i < 256; i++, o += 4) this.biomes[i] = ((data[o] << 24) | (data[o + 1] << 16) | (data[o + 2] << 8) | data[o + 3]) >>> 0;
    }
    return o - offset;
  }
}
