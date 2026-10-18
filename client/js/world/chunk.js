// Chunk storage in the 1.8 format: 16 sections of 16^3 block states (id << 4 | meta),
// nibble arrays for block light and sky light, and a 16x16 biome array.

export class Section {
  constructor(hasSky) {
    this.blocks = new Uint16Array(4096);
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
    if ((old >> 4) === 0 && (state >> 4) !== 0) this.nonAir++;
    else if ((old >> 4) !== 0 && (state >> 4) === 0) this.nonAir--;
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
    for (let i = 0; i < 4096; i++) if (this.blocks[i] >> 4) n++;
    this.nonAir = n;
  }
}

export class Chunk {
  constructor(x, z, hasSky) {
    this.x = x;
    this.z = z;
    this.hasSky = hasSky;
    this.sections = new Array(16).fill(null);
    this.biomes = new Uint8Array(256);
    this.heightMap = new Uint8Array(256); // y of highest light-blocking block + 1
    this.tileEntities = new Map(); // "x,y,z" -> nbt (simplified)
  }

  getState(x, y, z) {
    if (y < 0 || y > 255) return 0;
    const s = this.sections[y >> 4];
    return s ? s.blocks[((y & 15) << 8) | (z << 4) | x] : 0;
  }

  setState(x, y, z, state) {
    if (y < 0 || y > 255) return;
    let s = this.sections[y >> 4];
    if (!s) {
      if ((state >> 4) === 0) return;
      s = this.sections[y >> 4] = new Section(this.hasSky);
    }
    s.set(x, y & 15, z, state);
  }

  getSkyLight(x, y, z) {
    if (y < 0) return 0;
    if (y > 255) return this.hasSky ? 15 : 0;
    const s = this.sections[y >> 4];
    if (!s) return this.hasSky ? 15 : 0;
    return s.getSky(((y & 15) << 8) | (z << 4) | x);
  }

  getBlockLight(x, y, z) {
    if (y < 0 || y > 255) return 0;
    const s = this.sections[y >> 4];
    if (!s) return 0;
    return s.getBlockLight(((y & 15) << 8) | (z << 4) | x);
  }

  setSkyLight(x, y, z, v) {
    if (y < 0 || y > 255) return;
    let s = this.sections[y >> 4];
    if (!s) s = this.sections[y >> 4] = new Section(this.hasSky);
    s.setSky(((y & 15) << 8) | (z << 4) | x, v);
  }

  setBlockLightAt(x, y, z, v) {
    if (y < 0 || y > 255) return;
    let s = this.sections[y >> 4];
    if (!s) s = this.sections[y >> 4] = new Section(this.hasSky);
    s.setBlockLight(((y & 15) << 8) | (z << 4) | x, v);
  }

  // Parse the 1.8 chunk data format. Returns the number of bytes consumed.
  load(data, offset, bitMap, groundUp, skyLight) {
    const view = data;
    let o = offset;
    const present = [];
    for (let s = 0; s < 16; s++) {
      if (bitMap & (1 << s)) {
        let sec = this.sections[s];
        if (!sec) sec = this.sections[s] = new Section(this.hasSky);
        const b = sec.blocks;
        for (let i = 0; i < 4096; i++) {
          b[i] = view[o] | (view[o + 1] << 8);
          o += 2;
        }
        sec.recount();
        present.push(sec);
      } else if (groundUp) {
        this.sections[s] = null;
      }
    }
    for (const sec of present) {
      sec.blockLight.set(view.subarray(o, o + 2048));
      o += 2048;
    }
    if (skyLight) {
      for (const sec of present) {
        sec.skyLight.set(view.subarray(o, o + 2048));
        o += 2048;
      }
    }
    if (groundUp) {
      this.biomes.set(view.subarray(o, o + 256));
      o += 256;
    }
    // Drop sections that are entirely air (keeps light though if sky)
    return o - offset;
  }

  static sizeOf(bitMap, groundUp, skyLight) {
    let n = 0;
    for (let s = 0; s < 16; s++) if (bitMap & (1 << s)) n++;
    return n * (8192 + 2048 + (skyLight ? 2048 : 0)) + (groundUp ? 256 : 0);
  }
}
