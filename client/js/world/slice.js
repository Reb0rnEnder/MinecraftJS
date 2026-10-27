// World slices (like Sodium's WorldSlice): a self-contained copy of the blocks, light and biomes around
// one 16^3 section with a 2 block margin, so mesh workers need no copy of the world and can run in parallel.
export const SLICE = 20;          // edge length: section + 2 blocks each side
export const SLICE_MARGIN = 2;
const SLICE_AREA = SLICE * SLICE;
const SLICE_VOLUME = SLICE_AREA * SLICE;

// Copy the neighbourhood of section (cx, sy, cz). tileProps: Map 'x,y,z' -> props (flower pots etc.)
export function buildSlice(world, cx, sy, cz, tileProps, biomeBlendRadius = 2) {
  const states = new Uint16Array(SLICE_VOLUME);
  const light = new Uint8Array(SLICE_VOLUME); // sky << 4 | block
  const biomeMargin = Math.max(SLICE_MARGIN, Math.max(0, Math.min(7, Math.round(biomeBlendRadius)))), biomeSize = 16 + biomeMargin * 2;
  const biomeOx = cx * 16 - biomeMargin, biomeOz = cz * 16 - biomeMargin;
  const biomes = new Uint8Array(biomeSize * biomeSize);
  const ox = cx * 16 - SLICE_MARGIN, oy = sy * 16 - SLICE_MARGIN, oz = cz * 16 - SLICE_MARGIN;
  const chunks = [];
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) chunks.push(world.getChunk(cx + dx, cz + dz) || null);
  const center = chunks[4];
  const hasSky = center ? center.hasSky : true;
  // x segments of a slice row: [local start, length, chunk dx, block offset in that chunk]
  const segs = [[0, 2, -1, 14], [2, 16, 0, 0], [18, 2, 1, 0]];
  for (let ly = 0; ly < SLICE; ly++) {
    const y = oy + ly;
    for (let lz = 0; lz < SLICE; lz++) {
      const z = oz + lz;
      const czOff = (z >> 4) - cz; // -1, 0, 1
      const bz = z & 15;
      const row = ly * SLICE_AREA + lz * SLICE;
      for (const [lx0, len, dx, bx0] of segs) {
        const c = chunks[(czOff + 1) * 3 + dx + 1];
        const o = row + lx0;
        if (!c) { light.fill(0xf0, o, o + len); continue; }
        if(c.nativeLight){
          const sy=y>>4,s=c.sections[sy],sky=c.nativeLight.sky[sy+1],block=c.nativeLight.block[sy+1];
          const base=((y&15)<<8)|(bz<<4);
          for(let k=0;k<len;k++){const i=base|(bx0+k);states[o+k]=s?s.blocks[i]:0;light[o+k]=(c.getSkyLight(bx0+k,y,bz)<<4)|c.getBlockLight(bx0+k,y,bz);}

          continue;
        }
        if (y < 0) continue; // void: air, no light
        if (y > 255) { light.fill(0xf0, o, o + len); continue; }
        const s = c.sections[y >> 4];
        if (!s) { if (c.hasSky) light.fill(0xf0, o, o + len); continue; }
        const base = ((y & 15) << 8) | (bz << 4);
        for (let k = 0; k < len; k++) {
          const i = base | (bx0 + k);
          states[o + k] = s.blocks[i];
          const sh = (i & 1) << 2, j = i >> 1;
          light[o + k] = (((s.skyLight[j] >> sh) & 15) << 4) | ((s.blockLight[j] >> sh) & 15);
        }
      }
    }
  }
  // Biome sampling has its own horizontal margin; block/light slices stay compact.
  for (let lz = 0; lz < biomeSize; lz++) {
    const z = biomeOz + lz, czOff = (z >> 4) - cz;
    for (let lx = 0; lx < biomeSize; lx++) {
      const x = biomeOx + lx, cxOff = (x >> 4) - cx;
      const c = chunks[(czOff + 1) * 3 + cxOff + 1];
      biomes[lz * biomeSize + lx] = c ? c.biomes[((z & 15) << 4) | (x & 15)] : 1;
    }
  }
  let props = null;
  if (tileProps && tileProps.size) {
    for (const [k, v] of tileProps) {
      const [x, y, z] = k.split(',').map(Number);
      if (x >> 4 === cx && y >> 4 === sy && z >> 4 === cz) (props ||= []).push([x, y, z, v]);
    }
  }
  return { x: cx, y: sy, z: cz, ox, oy, oz, hasSky, states, light, biomes, biomeOx, biomeOz, biomeSize, props };
}

// World-like accessors over a slice (used by the mesher). Coordinates are world coordinates.
export class SliceWorld {
  constructor(sl) {
    this.sl = sl;
    this.ox = sl.ox; this.oy = sl.oy; this.oz = sl.oz;
    this.states = sl.states; this.light = sl.light; this.biomes = sl.biomes;
    this.tileProps = new Map();
    if (sl.props) for (const [x, y, z, v] of sl.props) this.tileProps.set(x + ',' + y + ',' + z, v);
    this.getStateFn = (x, y, z) => this.getState(x, y, z);
  }

  getState(x, y, z) {
    const lx = x - this.ox, ly = y - this.oy, lz = z - this.oz;
    if (lx < 0 || ly < 0 || lz < 0 || lx >= SLICE || ly >= SLICE || lz >= SLICE) return 0;
    return this.states[ly * SLICE_AREA + lz * SLICE + lx];
  }

  // sky << 4 | block
  getLight(x, y, z) {
    let lx = x - this.ox, ly = y - this.oy, lz = z - this.oz;
    // outside the slice: clamp to the nearest copied block (only reached by rare neighbour lookups)
    if (lx < 0) lx = 0; else if (lx >= SLICE) lx = SLICE - 1;
    if (ly < 0) ly = 0; else if (ly >= SLICE) ly = SLICE - 1;
    if (lz < 0) lz = 0; else if (lz >= SLICE) lz = SLICE - 1;
    return this.light[ly * SLICE_AREA + lz * SLICE + lx];
  }

  getBiome(x, z) {
    const size = this.sl.biomeSize || SLICE;
    let lx = x - (this.sl.biomeOx ?? this.ox), lz = z - (this.sl.biomeOz ?? this.oz);
    lx = Math.max(0, Math.min(size - 1, lx)); lz = Math.max(0, Math.min(size - 1, lz));
    return this.biomes[lz * size + lx];
  }

  // Raw states of the section itself (16^3, vanilla index order y, z, x)
  getSectionBlocks() {
    const out = new Uint16Array(4096);
    let empty = true;
    for (let y = 0; y < 16; y++) for (let z = 0; z < 16; z++) {
      const src = (y + SLICE_MARGIN) * SLICE_AREA + (z + SLICE_MARGIN) * SLICE + SLICE_MARGIN;
      const dst = (y << 8) | (z << 4);
      for (let x = 0; x < 16; x++) { const v = this.states[src + x]; out[dst | x] = v; if (v !== 0) empty = false; }
    }
    return empty ? null : out;
  }
}
