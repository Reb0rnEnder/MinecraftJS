// Block ID to color/texture mapping for basic rendering
const BLOCK_COLORS = {
  0: null,           // air
  1: 0x7f7f7f,       // stone
  2: 0x5b8731,       // grass
  3: 0x866043,       // dirt
  4: 0x6b6b6b,       // cobblestone
  5: 0xbc9862,       // oak planks
  6: 0x2d5e1e,       // sapling
  7: 0x353535,       // bedrock
  8: 0x2848b5,       // water (flowing)
  9: 0x2848b5,       // water (still)
  10: 0xd4560c,      // lava (flowing)
  11: 0xd4560c,      // lava (still)
  12: 0xdbd3a0,      // sand
  13: 0x7e7c7a,      // gravel
  14: 0xfcee4b,      // gold ore
  15: 0xd8af93,      // iron ore
  16: 0x2f2f2f,      // coal ore
  17: 0x675333,      // wood log
  18: 0x2d5e1e,      // leaves
  19: 0xb5b538,      // sponge
  20: 0xc8dfe8,      // glass
  21: 0x667fc3,      // lapis ore
  22: 0x2048a3,      // lapis block
  23: 0x6b6b6b,      // dispenser
  24: 0xdbd3a0,      // sandstone
  25: 0x644331,      // noteblock
  26: 0xa33535,      // bed
  27: 0xc4a54a,      // powered rail
  28: 0x7b5d36,      // detector rail
  29: 0x70b233,      // sticky piston
  30: 0xdddddd,      // cobweb
  31: 0x4b7a2d,      // tallgrass
  32: 0x8b7e5e,      // dead bush
  33: 0x998b68,      // piston
  35: 0xdddddd,      // wool
  37: 0xe8d71c,      // dandelion
  38: 0xb82323,      // rose
  39: 0x8b7256,      // brown mushroom
  40: 0xb82323,      // red mushroom
  41: 0xf5e742,      // gold block
  42: 0xd8d8d8,      // iron block
  44: 0x7f7f7f,      // stone slab
  45: 0xb5503b,      // bricks
  46: 0xc13c2d,      // TNT
  47: 0xbc9862,      // bookshelf
  48: 0x4a6b3d,      // mossy cobblestone
  49: 0x14081e,      // obsidian
  50: 0xffd93d,      // torch
  51: 0xd48814,      // fire
  52: 0x267882,      // mob spawner
  53: 0xbc9862,      // oak stairs
  54: 0xbc9862,      // chest
  56: 0x8ec4e2,      // diamond ore
  57: 0x6edbd6,      // diamond block
  58: 0xbc9862,      // crafting table
  59: 0x567a1a,      // wheat
  60: 0x593c25,      // farmland
  61: 0x6b6b6b,      // furnace
  62: 0x6b6b6b,      // lit furnace
  63: 0xbc9862,      // sign
  64: 0xbc9862,      // wooden door
  65: 0xbc9862,      // ladder
  66: 0x7b5d36,      // rail
  67: 0x6b6b6b,      // cobblestone stairs
  68: 0xbc9862,      // wall sign
  73: 0xad4e4e,      // redstone ore
  78: 0xf0f0f0,      // snow layer
  79: 0x9dbcd4,      // ice
  80: 0xf0f0f0,      // snow block
  81: 0x0d6318,      // cactus
  82: 0x9ea4b0,      // clay
  83: 0x5b8731,      // sugar cane
  84: 0x644331,      // jukebox
  85: 0xbc9862,      // fence
  86: 0xc28420,      // pumpkin
  87: 0x6b3535,      // netherrack
  88: 0x544030,      // soul sand
  89: 0xb59740,      // glowstone
  90: 0x7b42ac,      // portal
  91: 0xc28420,      // jack o lantern
  98: 0x7f7f7f,      // stone bricks
  99: 0x8b7256,      // brown mushroom block
  100: 0xb82323,     // red mushroom block
  103: 0x669927,     // melon
  110: 0x486b3f,     // mycelium
  111: 0x0e5e0e,     // lily pad
  112: 0x2d1e2d,     // nether brick
  121: 0xdde2a0,     // end stone
  125: 0xbc9862,     // double wood slab
  126: 0xbc9862,     // wood slab
  128: 0xdbd3a0,     // sandstone stairs
  129: 0x0e8e5e,     // emerald ore
  133: 0x17dd62,     // emerald block
  134: 0xbc9862,     // spruce stairs
  135: 0xbc9862,     // birch stairs
  136: 0xbc9862,     // jungle stairs
  155: 0xf0ede5,     // quartz block
  156: 0xf0ede5,     // quartz stairs
  159: 0xd0a75f,     // stained clay
  161: 0x2d5e1e,     // leaves2
  162: 0x675333,     // log2
  170: 0xb5a535,     // hay block
  172: 0xbc8262,     // hardened clay
  173: 0x1a1a1a,     // coal block
  174: 0x9dbcd4,     // packed ice
  175: 0x4b7a2d,     // double plant
  179: 0xbc6a3d,     // red sandstone
};

const TRANSPARENT_BLOCKS = new Set([
  0, 6, 8, 9, 10, 11, 18, 20, 26, 27, 28, 30, 31, 32, 37, 38, 39, 40, 44, 50, 51, 52,
  53, 54, 55, 59, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 75, 76, 77, 78, 81, 83,
  85, 90, 96, 101, 102, 104, 105, 106, 107, 111, 113, 114, 115, 116, 117, 118, 119,
  120, 122, 126, 127, 128, 131, 132, 134, 135, 136, 139, 140, 141, 142, 143, 144,
  145, 146, 147, 148, 149, 150, 151, 154, 156, 157, 158, 160, 161, 163, 164,
  167, 171, 175, 176, 177, 178, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193,
  194, 195, 196, 197
]);

const SOLID_BLOCKS = new Set();
for (let i = 1; i < 256; i++) {
  if (!TRANSPARENT_BLOCKS.has(i)) SOLID_BLOCKS.add(i);
}
// Add some transparent but "solid-looking" blocks back
[18, 79, 161].forEach(id => SOLID_BLOCKS.add(id));

class ChunkSection {
  constructor() {
    this.blocks = new Uint16Array(4096);
    this.blockLight = new Uint8Array(2048);
    this.skyLight = new Uint8Array(2048);
  }

  getBlock(x, y, z) {
    return this.blocks[(y << 8) | (z << 4) | x];
  }

  setBlock(x, y, z, block) {
    this.blocks[(y << 8) | (z << 4) | x] = block;
  }
}

class ChunkColumn {
  constructor(x, z) {
    this.x = x;
    this.z = z;
    this.sections = new Array(16).fill(null);
    this.biomes = new Uint8Array(256);
    this.dirty = true;
    this.mesh = null;
  }

  getBlock(x, y, z) {
    const sectionIndex = y >> 4;
    if (sectionIndex < 0 || sectionIndex > 15) return 0;
    const section = this.sections[sectionIndex];
    if (!section) return 0;
    return section.getBlock(x & 15, y & 15, z & 15);
  }

  setBlock(x, y, z, block) {
    const sectionIndex = y >> 4;
    if (sectionIndex < 0 || sectionIndex > 15) return;
    if (!this.sections[sectionIndex]) {
      this.sections[sectionIndex] = new ChunkSection();
    }
    this.sections[sectionIndex].setBlock(x & 15, y & 15, z & 15, block);
    this.dirty = true;
  }
}

class World {
  constructor() {
    this.chunks = new Map();
    this.entities = new Map();
    this.players = new Map();
  }

  getChunkKey(cx, cz) {
    return `${cx},${cz}`;
  }

  getChunk(cx, cz) {
    return this.chunks.get(this.getChunkKey(cx, cz));
  }

  setChunk(cx, cz, chunk) {
    this.chunks.set(this.getChunkKey(cx, cz), chunk);
  }

  removeChunk(cx, cz) {
    const key = this.getChunkKey(cx, cz);
    const chunk = this.chunks.get(key);
    if (chunk && chunk.mesh) {
      chunk.mesh.forEach(m => {
        if (m.parent) m.parent.remove(m);
        m.geometry.dispose();
        m.material.dispose();
      });
    }
    this.chunks.delete(key);
  }

  getBlock(x, y, z) {
    const cx = Math.floor(x / 16);
    const cz = Math.floor(z / 16);
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return 0;
    return chunk.getBlock(((x % 16) + 16) % 16, y, ((z % 16) + 16) % 16);
  }

  setBlock(x, y, z, block) {
    const cx = Math.floor(x / 16);
    const cz = Math.floor(z / 16);
    let chunk = this.getChunk(cx, cz);
    if (!chunk) {
      chunk = new ChunkColumn(cx, cz);
      this.setChunk(cx, cz, chunk);
    }
    chunk.setBlock(((x % 16) + 16) % 16, y, ((z % 16) + 16) % 16, block);
  }

  parseChunkData(buf, chunkX, chunkZ, groundUp, bitmask, skyLight = true) {
    if (bitmask === 0 && groundUp) {
      this.removeChunk(chunkX, chunkZ);
      return;
    }

    const chunk = new ChunkColumn(chunkX, chunkZ);

    // 1. Block IDs and metadata for each present section
    // In MC 1.8.9: 4096 ushorts per section, little-endian (blockId << 4 | meta)
    for (let section = 0; section < 16; section++) {
      if (!(bitmask & (1 << section))) continue;

      const chunkSection = new ChunkSection();

      for (let i = 0; i < 4096; i++) {
        if (buf.remaining() < 2) break;
        const blockData = buf.readUByte() | (buf.readUByte() << 8);
        const blockId = blockData >> 4;
        chunkSection.blocks[i] = blockId;
      }

      chunk.sections[section] = chunkSection;
    }

    // 2. Block light (2048 bytes per section)
    for (let section = 0; section < 16; section++) {
      if (!(bitmask & (1 << section))) continue;
      if (buf.remaining() >= 2048) {
        const chunkSectionLight = buf.readBytes(2048);
        if (chunk.sections[section]) {
          chunk.sections[section].blockLight.set(chunkSectionLight);
        }
      }
    }

    // 3. Sky light (2048 bytes per section, ONLY if skyLight is sent)
    if (skyLight) {
      for (let section = 0; section < 16; section++) {
        if (!(bitmask & (1 << section))) continue;
        if (buf.remaining() >= 2048) {
          const chunkSkyLight = buf.readBytes(2048);
          if (chunk.sections[section]) {
            chunk.sections[section].skyLight.set(chunkSkyLight);
          }
        }
      }
    }

    // 4. Biomes (256 bytes, if groundUp is true)
    if (groundUp && buf.remaining() >= 256) {
      chunk.biomes = buf.readBytes(256);
    }

    const existing = this.getChunk(chunkX, chunkZ);
    if (existing && existing.mesh) {
      existing.mesh.forEach(m => {
        if (m.parent) m.parent.remove(m);
        m.geometry.dispose();
        m.material.dispose();
      });
    }

    chunk.dirty = true;
    this.setChunk(chunkX, chunkZ, chunk);
  }

  parseChunkBulk(buf) {
    const skyLight = buf.readBoolean();
    const chunkCount = buf.readVarInt();
    const chunkMeta = [];

    for (let i = 0; i < chunkCount; i++) {
      chunkMeta.push({
        x: buf.readInt(),
        z: buf.readInt(),
        bitmask: buf.readUShort()
      });
    }

    for (const meta of chunkMeta) {
      this.parseChunkData(buf, meta.x, meta.z, true, meta.bitmask, skyLight);
    }
  }
}
