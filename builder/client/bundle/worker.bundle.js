(() => {
  // js/world/blocks.js
  var DIR_OFFSETS = [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]];
  var DIR_NAMES = ["down", "up", "north", "south", "west", "east"];
  var OPPOSITE = [1, 0, 3, 2, 5, 4];
  var blocks = [];
  var blocksByName = {};
  var states = [];
  var renderBlocks = [];
  var STAIRS = (name) => name.endsWith("_stairs");
  var HEAD_BLOCKS = new Set(["skeleton_skull", "wither_skeleton_skull", "zombie_head", "player_head", "creeper_head", "dragon_head"].flatMap((name) => [name, name.replace(/_(head|skull)$/, "_wall_$1")]));
  var SHULKER_BOXES = new Set([
    "white",
    "orange",
    "magenta",
    "light_blue",
    "yellow",
    "lime",
    "pink",
    "gray",
    "light_gray",
    "cyan",
    "purple",
    "blue",
    "brown",
    "green",
    "red",
    "black"
  ].map((c) => c + "_shulker_box"));
  var NOT_OPAQUE = /* @__PURE__ */ new Set([
    "glass",
    "ice",
    "chest",
    "trapped_chest",
    "ender_chest",
    "cactus",
    "cake",
    "snow",
    "farmland",
    "enchanting_table",
    "end_portal_frame",
    "brewing_stand",
    "cauldron",
    "hopper",
    "anvil",
    "daylight_detector",
    "carpet",
    "skull",
    "flower_pot",
    "trapdoor",
    "iron_trapdoor",
    "ladder",
    "piston_head",
    "dragon_egg",
    "cocoa",
    "repeater",
    "comparator",
    "waterlily",
    "cobweb",
    "end_portal",
    "nether_portal",
    "tripwire",
    "tripwire_hook",
    "vine",
    "redstone_wire",
    "piston",
    "sticky_piston",
    "end_rod",
    "chorus_plant",
    "chorus_flower",
    "grass_path",
    "frosted_ice",
    "structure_void",
    "end_gateway",
    "slime_block",
    "barrier",
    "beacon",
    "mob_spawner",
    "redstone_torch",
    "torch",
    "fire",
    "kelp",
    "kelp_plant",
    "seagrass",
    "tall_seagrass",
    "dead_bush",
    "dandelion",
    "poppy",
    "brown_mushroom",
    "red_mushroom",
    "sunflower",
    "lilac",
    "rose_bush",
    "peony",
    "tall_grass",
    "large_fern",
    "turtle_egg",
    "snow",
    "white_bed",
    "white_banner",
    "white_wall_banner"
  ]);
  var TRANSLUCENT = /* @__PURE__ */ new Set(["water", "lava", "ice", "frosted_ice", "slime_block", "nether_portal"]);
  var NO_MODEL = /* @__PURE__ */ new Set([
    "air",
    "water",
    "lava",
    "chest",
    "trapped_chest",
    "ender_chest",
    "sign",
    "wall_sign",
    "skull",
    "white_bed",
    "white_banner",
    "white_wall_banner",
    "moving_piston",
    "barrier",
    "end_portal",
    "structure_void",
    "end_gateway",
    ...SHULKER_BOXES
  ]);
  var FENCES = (name) => name.endsWith("_fence");
  var FENCE_GATES = (name) => name.endsWith("_fence_gate");
  var PANES = (name) => name.endsWith("_pane") || name === "iron_bars";
  var DOORS = (name) => name.endsWith("_door");
  var REPLACEABLE = /* @__PURE__ */ new Set([
    "air",
    "water",
    "lava",
    "tall_grass",
    "dead_bush",
    "vine",
    "fire",
    "snow",
    "kelp",
    "kelp_plant",
    "seagrass",
    "tall_seagrass",
    "dandelion",
    "poppy",
    "blue_orchid",
    "allium",
    "azure_bluet",
    "red_tulip",
    "orange_tulip",
    "white_tulip",
    "pink_tulip",
    "oxeye_daisy",
    "brown_mushroom",
    "red_mushroom",
    "sunflower",
    "lilac",
    "rose_bush",
    "peony",
    "large_fern",
    "wheat",
    "carrots",
    "potatoes",
    "beetroots",
    "sweet_berry_bush"
  ]);
  var shapesData = null;
  function initBlocks(blocksJson, shapesJson) {
    shapesData = shapesJson;
    if (shapesJson?.modelOffsets && shapesJson.modelOffsets.source.blockCount !== blocksJson.length) throw Error("Incomplete native model offset data");
    blocks.length = 0;
    states.length = 0;
    renderBlocks.length = 0;
    for (const k of Object.keys(blocksByName)) delete blocksByName[k];
    for (const b of blocksJson) {
      const name = b.name;
      const stairs = STAIRS(name), renderLayer = shapesJson?.render?.layers?.[name];
      if (shapesJson?.render?.layers && !renderLayer) throw Error("Missing native block render layer: " + name);
      const def = {
        id: b.id,
        name,
        isAir: name === "air" || name === "cave_air" || name === "void_air",
        displayName: b.displayName,
        hardness: b.hardness === null || b.hardness === void 0 ? -1 : b.hardness,
        material: b.material || null,
        harvestTools: b.harvestTools || null,
        variations: b.variations || null,
        minStateId: b.minStateId === void 0 ? b.id : b.minStateId,
        maxStateId: b.maxStateId === void 0 ? b.id : b.maxStateId,
        defaultState: b.defaultState === void 0 ? b.id : b.defaultState,
        stateProperties: b.states || [],
        emitLight: b.emitLight || 0,
        filterLight: b.filterLight === void 0 ? 15 : b.filterLight,
        boundingBox: b.boundingBox,
        opaque: b.boundingBox === "block" && !b.transparent && !NOT_OPAQUE.has(name) && b.id !== 0,
        renderLayer,
        modelOffset: shapesJson?.modelOffsets?.blocks[name],
        translucent: renderLayer ? renderLayer === "translucent" : TRANSLUCENT.has(name) || name.endsWith("_stained_glass") || name.endsWith("_stained_glass_pane"),
        hasModel: !NO_MODEL.has(name) && !name.endsWith("_bed") && !name.endsWith("_banner") && !name.endsWith("_wall_banner") && !HEAD_BLOCKS.has(name) && !name.endsWith("_shulker_box") && name !== "conduit" && name !== "bubble_column" && name !== "void_air" && name !== "cave_air",
        isStairs: stairs,
        isFence: FENCES(name),
        isFenceGate: FENCE_GATES(name),
        isPane: PANES(name),
        isWall: name === "cobblestone_wall",
        isDoor: DOORS(name),
        isLiquid: name === "water" || name === "lava" || name === "bubble_column",
        isWater: name === "water" || name === "bubble_column",
        isLava: name === "lava",
        replaceable: REPLACEABLE.has(name) || b.material === "plant" && b.boundingBox === "empty" && !/sapling|wheat|carrots|potatoes|stem|wart|flower|mushroom/.test(name),
        slipperiness: name === "blue_ice" ? 0.989 : name === "ice" || name === "packed_ice" || name === "frosted_ice" ? 0.98 : name === "slime_block" ? 0.8 : 0.6,
        shapes: shapesJson ? shapesJson.blocks[name] : null,
        // AO: opaque full cubes darken neighbours
        aoLight: 0
      };
      def.aoLight = def.opaque ? 0.2 : 1;
      blocks[b.id] = def;
      blocksByName[name] = def;
      for (let state = def.minStateId; state <= def.maxStateId; state++) {
        states[state] = { id: state, blockId: b.id, name, properties: decodeProperties(def, state) };
      }
    }
    for (const def of Object.values(blocksByName)) {
      if (!def.opaque && def.boundingBox === "empty" && !def.isLiquid) def.filterLight = 0;
    }
    for (const b of Object.values(blocksByName)) if (b.name.endsWith("_leaves") || b.name === "cobweb") b.filterLight = 1;
    for (const n of ["water", "bubble_column", "ice"]) if (blocksByName[n]) blocksByName[n].filterLight = 3;
    if (blocksByName.turtle_egg) blocksByName.turtle_egg.filterLight = 0;
    for (const b of Object.values(blocksByName)) {
      if (b.name.endsWith("_slab") || b.isStairs || b.name === "farmland") {
        b.filterLight = 15;
        b.useNeighborBrightness = true;
      }
    }
    if (blocksByName.grass_path) {
      blocksByName.grass_path.filterLight = 15;
      blocksByName.grass_path.useNeighborBrightness = true;
    }
    const rendering = shapesJson?.render;
    if (rendering) {
      if (rendering.states.length !== states.length) throw new Error("Incomplete native block render properties; regenerate runtime data");
      for (const info of states) {
        const value = rendering.values[rendering.states[info.id]];
        if (!value) throw new Error("Missing block render properties for state " + info.id);
        const def = blocks[info.blockId];
        const overrides = {
          hasModel: value.renderType === 2,
          renderType: value.renderType,
          opaque: value.solid,
          suffocates: value.suffocates ?? value.viewBlocking,
          viewBlocking: value.viewBlocking,
          canOcclude: value.occludes,
          aoLight: value.shade,
          filterLight: value.lightBlock,
          emitLight: value.emission,
          collisionFull: value.collisionFull,
          occlusionBoxes: value.occlusion,
          soundType: value.sound,
          useNeighborBrightness: !value.solid && !value.collisionFull && !def.isLiquid
        };
        renderBlocks[info.id] = Object.assign(Object.create(def), overrides);
        if (info.id === def.defaultState) Object.assign(def, overrides);
      }
    }
  }
  function propertyValues(prop) {
    if (prop.type === "bool") return ["true", "false"];
    if (prop.values?.length) return prop.values.map(String);
    if (prop.type === "int") return Array.from({ length: prop.num_values }, (_, i) => String(i));
    return prop.values || [];
  }
  function decodeProperties(def, state) {
    let index = state - def.minStateId;
    const props = {};
    for (let i = def.stateProperties.length - 1; i >= 0; i--) {
      const prop = def.stateProperties[i];
      const values = propertyValues(prop);
      const value = values.length ? values[index % values.length] : void 0;
      if (value !== void 0) props[prop.name] = value;
      index = values.length ? Math.floor(index / values.length) : index;
    }
    return props;
  }
  function getBlockById(id) {
    return blocks[id] || blocks[0];
  }
  function getBlock(state) {
    const s = states[state];
    return renderBlocks[state] || (s ? getBlockById(s.blockId) : blocks[0]);
  }
  function getStateProperties(state) {
    return states[state] ? states[state].properties : {};
  }
  function getStateInfo(state) {
    return states[state] || states[0] || { id: 0, blockId: 0, name: "air", properties: {} };
  }
  function staticCollisionBoxes(state, x = 0, y = 0, z = 0) {
    const b = getBlock(state);
    if (!b || !b.shapes && b.shapes !== 0) return [];
    let shapeId = b.shapes;
    if (Array.isArray(shapeId)) {
      const meta = Math.max(0, state - b.minStateId);
      shapeId = shapeId[meta] !== void 0 ? shapeId[meta] : shapeId[0];
    }
    const boxes = shapesData.shapes[shapeId] || [], delta = shapeOffsetDelta(b, "collision", x, y, z);
    return delta ? boxes.map((box) => box.map((v, i) => v + delta[i % 3])) : boxes;
  }
  var NO_MODEL_OFFSET = Object.freeze([0, 0, 0]);
  function nativeModelOffset(name, x, y, z) {
    if (!shapesData?.modelOffsets) return null;
    const policy = blocksByName[name]?.modelOffset;
    if (!policy) return NO_MODEL_OFFSET;
    const seed = Math.imul(x, 3129871) ^ Math.imul(z, 116129781) ^ (shapesData.modelOffsets.source.seedY ? y : 0), r = Math.imul(Math.imul(seed, seed), 42317861) + Math.imul(seed, 11) | 0, h = policy.horizontal;
    return [Math.max(-h, Math.min(h, (Math.fround((r >>> 16 & 15) / 15) - 0.5) * 0.5)), policy.type === 2 ? (Math.fround((r >>> 20 & 15) / 15) - 1) * policy.vertical : 0, Math.max(-h, Math.min(h, (Math.fround((r >>> 24 & 15) / 15) - 0.5) * 0.5))];
  }
  function shapeOffsetDelta(block, kind, x, y, z) {
    const policy = block?.modelOffset;
    if (!policy?.[kind]) return null;
    const offset = nativeModelOffset(block.name, x, y, z), delta = offset.map((v, i) => v - policy.origin[i]);
    return delta.some((v) => v !== 0) ? delta : null;
  }

  // js/world/water-biomes.js
  var WATER_BIOMES = { "0": [4159204, 329011], "1": [4159204, 329011], "2": [4159204, 329011], "3": [4159204, 329011], "4": [4159204, 329011], "5": [4159204, 329011], "6": [6388580, 2302743], "7": [4159204, 329011], "8": [4159204, 329011], "9": [4159204, 329011], "10": [3750089, 329011], "11": [3750089, 329011], "12": [4159204, 329011], "13": [4159204, 329011], "14": [4159204, 329011], "15": [4159204, 329011], "16": [4159204, 329011], "17": [4159204, 329011], "18": [4159204, 329011], "19": [4159204, 329011], "20": [4159204, 329011], "21": [4159204, 329011], "22": [4159204, 329011], "23": [4159204, 329011], "24": [4159204, 329011], "25": [4159204, 329011], "26": [4020182, 329011], "27": [4159204, 329011], "28": [4159204, 329011], "29": [4159204, 329011], "30": [4020182, 329011], "31": [4020182, 329011], "32": [4159204, 329011], "33": [4159204, 329011], "34": [4159204, 329011], "35": [4159204, 329011], "36": [4159204, 329011], "37": [4159204, 329011], "38": [4159204, 329011], "39": [4159204, 329011], "40": [4159204, 329011], "41": [4159204, 329011], "42": [4159204, 329011], "43": [4159204, 329011], "44": [4445678, 270131], "45": [4566514, 267827], "46": [4020182, 329011], "47": [4445678, 270131], "48": [4566514, 267827], "49": [4020182, 329011], "50": [3750089, 329011], "127": [4159204, 329011], "129": [4159204, 329011], "130": [4159204, 329011], "131": [4159204, 329011], "132": [4159204, 329011], "133": [4159204, 329011], "134": [6388580, 2302743], "140": [4159204, 329011], "149": [4159204, 329011], "151": [4159204, 329011], "155": [4159204, 329011], "156": [4159204, 329011], "157": [4159204, 329011], "158": [4020182, 329011], "160": [4159204, 329011], "161": [4159204, 329011], "162": [4159204, 329011], "163": [4159204, 329011], "164": [4159204, 329011], "165": [4159204, 329011], "166": [4159204, 329011], "167": [4159204, 329011] };

  // js/world/biomes.js
  var biomeTable = [];
  var grassMap = null;
  var foliageMap = null;
  function initBiomes(biomesJson, grassPixels, foliagePixels) {
    biomeTable = [];
    for (const b of biomesJson) biomeTable[b.id] = b;
    grassMap = grassPixels;
    foliageMap = foliagePixels;
  }
  function biomeInfo(id) {
    return biomeTable[id] || biomeTable[1] || { temperature: 0.8, rainfall: 0.4, name: "plains" };
  }
  function sample(map, temp, rain) {
    if (!map) return 8368696;
    temp = Math.min(1, Math.max(0, temp));
    rain = Math.min(1, Math.max(0, rain)) * temp;
    const i = (1 - temp) * 255 | 0;
    const j = (1 - rain) * 255 | 0;
    const k = (j << 8 | i) * 4;
    return map[k] << 16 | map[k + 1] << 8 | map[k + 2];
  }
  function tempAt(b, y) {
    let t = b.temperature;
    if (y > 64) t -= (y - 64) * 0.05 / 30;
    return t;
  }
  var isSwamp = (n) => n === "swamp" || n === "swamp_hills";
  var isRoofed = (n) => n === "dark_forest" || n === "dark_forest_hills";
  var isMesa = (n) => !!n && n.includes("badlands");
  function grassColor(id, y) {
    const b = biomeInfo(id);
    const n = b.name;
    if (isSwamp(n)) return 6975545;
    if (isMesa(n)) return 9470285;
    const c = sample(grassMap, tempAt(b, y), b.rainfall);
    if (isRoofed(n)) return (c & 16711422) + 2634762 >> 1;
    return c;
  }
  function foliageColor(id, y) {
    const b = biomeInfo(id);
    const n = b.name;
    if (isSwamp(n)) return 6975545;
    if (isMesa(n)) return 10387789;
    return sample(foliageMap, tempAt(b, y), b.rainfall);
  }
  function waterColor(id) {
    if (WATER_BIOMES[id]) return WATER_BIOMES[id][0];
    const b = biomeInfo(id);
    if (typeof b.waterColor === "number") return b.waterColor;
    return isSwamp(b.name) ? 6388580 : 4159204;
  }

  // js/world/slice.js
  var SLICE = 20;
  var SLICE_MARGIN = 2;
  var SLICE_AREA = SLICE * SLICE;
  var SLICE_VOLUME = SLICE_AREA * SLICE;
  var SliceWorld = class {
    constructor(sl) {
      this.sl = sl;
      this.ox = sl.ox;
      this.oy = sl.oy;
      this.oz = sl.oz;
      this.states = sl.states;
      this.light = sl.light;
      this.biomes = sl.biomes;
      this.tileProps = /* @__PURE__ */ new Map();
      if (sl.props) for (const [x, y, z, v] of sl.props) this.tileProps.set(x + "," + y + "," + z, v);
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
      if (lx < 0) lx = 0;
      else if (lx >= SLICE) lx = SLICE - 1;
      if (ly < 0) ly = 0;
      else if (ly >= SLICE) ly = SLICE - 1;
      if (lz < 0) lz = 0;
      else if (lz >= SLICE) lz = SLICE - 1;
      return this.light[ly * SLICE_AREA + lz * SLICE + lx];
    }
    getBiome(x, z, y = this.oy + SLICE_MARGIN) {
      const size = this.sl.biomeSize || SLICE;
      let lx = x - (this.sl.biomeOx ?? this.ox), lz = z - (this.sl.biomeOz ?? this.oz);
      lx = Math.max(0, Math.min(size - 1, lx));
      lz = Math.max(0, Math.min(size - 1, lz));
      const layer = this.sl.biomeLayers ? Math.max(0, Math.min(this.sl.biomeLayers - 1, Math.floor(y - this.oy))) : 0;
      return this.biomes[(layer * size + lz) * size + lx];
    }
    // Raw states of the section itself (16^3, vanilla index order y, z, x)
    getSectionBlocks() {
      const out = new Uint16Array(4096);
      let empty = true;
      for (let y = 0; y < 16; y++) for (let z = 0; z < 16; z++) {
        const src = (y + SLICE_MARGIN) * SLICE_AREA + (z + SLICE_MARGIN) * SLICE + SLICE_MARGIN;
        const dst = y << 8 | z << 4;
        for (let x = 0; x < 16; x++) {
          const v = this.states[src + x];
          out[dst | x] = v;
          if (v !== 0) empty = false;
        }
      }
      return empty ? null : out;
    }
  };

  // js/resource-models.js
  var resourceName = (name) => typeof name === "string" ? name.replace(/^minecraft:/, "") : name;

  // js/render/models.js
  var FACE_INDEX = { down: 0, up: 1, north: 2, south: 3, west: 4, east: 5 };
  var DIR_VEC = [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]];
  var FACE_CORNERS = [
    [[0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]],
    // down
    [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]],
    // up
    [[1, 1, 0], [1, 0, 0], [0, 0, 0], [0, 1, 0]],
    // north
    [[0, 1, 1], [0, 0, 1], [1, 0, 1], [1, 1, 1]],
    // south
    [[0, 1, 0], [0, 0, 0], [0, 0, 1], [0, 1, 1]],
    // west
    [[1, 1, 1], [1, 0, 1], [1, 0, 0], [1, 1, 0]]
    // east
  ];
  function defaultUV(dir, from, to) {
    switch (dir) {
      case 0:
        return [from[0], 16 - to[2], to[0], 16 - from[2]];
      case 1:
        return [from[0], from[2], to[0], to[2]];
      case 2:
        return [16 - to[0], 16 - to[1], 16 - from[0], 16 - from[1]];
      case 3:
        return [from[0], 16 - to[1], to[0], 16 - from[1]];
      case 4:
        return [from[2], 16 - to[1], to[2], 16 - from[1]];
      case 5:
        return [16 - to[2], 16 - to[1], 16 - from[2], 16 - from[1]];
      default:
        return [0, 0, 16, 16];
    }
  }
  var ModelStore = class {
    // models: { 'block/stone': json, 'item/apple': json, ... }; blockstates: { name: json }
    // atlas: { uv(name) -> [u0,v0,u1,v1] | null, hasAlpha(name) -> bool }
    constructor(models, blockstates, atlas) {
      this.models = models;
      this.blockstates = blockstates;
      this.atlas = atlas;
      this.resolved = /* @__PURE__ */ new Map();
      this.baked = /* @__PURE__ */ new Map();
      this.variantIndex = /* @__PURE__ */ new Map();
    }
    resolveModel(name) {
      name = resourceName(name);
      if (this.resolved.has(name)) return this.resolved.get(name);
      const chain = [];
      let cur = name;
      let guard = 0;
      while (cur && guard++ < 32) {
        if (cur.startsWith("builtin/")) {
          chain.push({ builtin: cur });
          break;
        }
        const j = this.models[cur] || this.models["block/" + cur];
        if (!j) break;
        chain.push(j);
        cur = resourceName(j.parent);
      }
      const textures = {};
      let elements = null;
      let ao = true;
      let guiLight = "side";
      let display = {};
      let builtin = null;
      for (let i = chain.length - 1; i >= 0; i--) {
        const j = chain[i];
        if (j.builtin) {
          builtin = j.builtin;
          continue;
        }
        if (j.textures) Object.assign(textures, j.textures);
        if (j.elements) elements = j.elements;
        if (j.ambientocclusion === false) ao = false;
        if (j.gui_light) guiLight = j.gui_light;
        if (j.display) display = Object.assign({}, display, j.display);
      }
      const resolveTex = (t) => {
        let g = 0;
        while (t && t.startsWith("#") && g++ < 16) t = textures[t.slice(1)];
        return resourceName(t) || null;
      };
      const overrides = chain.length && !chain[0].builtin ? chain[0].overrides || null : null;
      const res = { name, textures, elements, ao, guiLight, display, builtin, resolveTex, overrides };
      this.resolved.set(name, res);
      return res;
    }
    // Bake a model with rotation; result cached by key
    bakeModel(modelName, rx = 0, ry = 0, uvlock = false) {
      const key = modelName + "|" + rx + "|" + ry + "|" + (uvlock ? 1 : 0);
      let b = this.baked.get(key);
      if (b) return b;
      const m = this.resolveModel(modelName);
      const quads = [];
      let bounds = null;
      if (m.elements) {
        for (const el of m.elements) {
          for (const [faceName, face] of Object.entries(el.faces || {})) {
            const dir = FACE_INDEX[faceName];
            if (dir === void 0) continue;
            const q = this._bakeFace(m, el, dir, face, rx, ry, uvlock);
            if (q) quads.push(q);
          }
          const bb = rotateBox(el.from, el.to, rx, ry);
          if (!bounds) bounds = bb;
          else {
            for (let i = 0; i < 3; i++) {
              bounds[i] = Math.min(bounds[i], bb[i]);
              bounds[i + 3] = Math.max(bounds[i + 3], bb[i + 3]);
            }
          }
        }
      }
      b = { quads, ao: m.ao, bounds, particle: m.resolveTex("#particle"), builtin: m.builtin, display: m.display };
      this.baked.set(key, b);
      return b;
    }
    _bakeFace(m, el, dir, face, rx, ry, uvlock) {
      const tex = m.resolveTex(face.texture);
      const auv = tex ? this.atlas.uv(tex) : null;
      if (!auv) return null;
      const from = el.from, to = el.to;
      const pos = new Float32Array(12);
      const corners = FACE_CORNERS[dir];
      for (let i = 0; i < 4; i++) {
        const c = corners[i];
        pos[i * 3] = c[0] ? to[0] : from[0];
        pos[i * 3 + 1] = c[1] ? to[1] : from[1];
        pos[i * 3 + 2] = c[2] ? to[2] : from[2];
      }
      if (el.rotation) applyElementRotation(pos, el.rotation);
      if (rx || ry) for (let i = 0; i < 4; i++) rotateVertex(pos, i * 3, rx, ry);
      let ndir = rotateDir(dir, rx, ry);
      let cull = face.cullface !== void 0 ? FACE_INDEX[face.cullface] : -1;
      if (cull !== void 0 && cull >= 0) cull = rotateDir(cull, rx, ry);
      if (cull === void 0) cull = -1;
      const uvs = face.uv || defaultUV(dir, from, to);
      const rot = (face.rotation || 0) / 90 | 0;
      const uv = new Float32Array(8);
      if (uvlock && (rx || ry)) {
        for (let i = 0; i < 4; i++) {
          const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
          let u, v;
          switch (ndir) {
            case 0:
              u = x;
              v = 16 - z;
              break;
            case 1:
              u = x;
              v = z;
              break;
            case 2:
              u = 16 - x;
              v = 16 - y;
              break;
            case 3:
              u = x;
              v = 16 - y;
              break;
            case 4:
              u = z;
              v = 16 - y;
              break;
            default:
              u = 16 - z;
              v = 16 - y;
              break;
          }
          uv[i * 2] = u;
          uv[i * 2 + 1] = v;
        }
      } else {
        for (let i = 0; i < 4; i++) {
          const j = (i + rot) % 4;
          uv[i * 2] = uvs[j !== 0 && j !== 1 ? 2 : 0];
          uv[i * 2 + 1] = uvs[j !== 0 && j !== 3 ? 3 : 1];
        }
      }
      const du = (auv[2] - auv[0]) / 16, dv = (auv[3] - auv[1]) / 16;
      for (let i = 0; i < 4; i++) {
        uv[i * 2] = auv[0] + uv[i * 2] * du;
        uv[i * 2 + 1] = auv[1] + uv[i * 2 + 1] * dv;
      }
      for (let i = 0; i < 12; i++) pos[i] /= 16;
      return {
        pos,
        uv,
        dir: ndir,
        cull,
        tint: face.tintindex !== void 0 ? face.tintindex : -1,
        shade: el.shade !== false,
        alpha: this.atlas.hasAlpha(tex),
        tex
      };
    }
    // Precompute variant property maps for subset matching
    _variants(file) {
      let idx = this.variantIndex.get(file);
      if (idx) return idx;
      const bs = this.blockstates[file];
      idx = [];
      if (bs && bs.variants) {
        for (const [key, val] of Object.entries(bs.variants)) {
          const props = {};
          if (key !== "normal" && key !== "all" && key !== "inventory") {
            for (const kv of key.split(",")) {
              const [k, v] = kv.split("=");
              props[k] = v;
            }
          }
          idx.push({ key, props, val });
        }
      }
      this.variantIndex.set(file, idx);
      return idx;
    }
    // Find the variant whose properties all match `props`
    findVariant(file, props, exactKey) {
      const idx = this._variants(file);
      if (!idx.length) return null;
      if (exactKey) {
        const e = idx.find((v) => v.key === exactKey);
        if (e) return e.val;
      }
      let best = null;
      let bestScore = -1;
      for (const v of idx) {
        let ok = true;
        let score = 0;
        for (const [k, val] of Object.entries(v.props)) {
          const p = props[k];
          if (p === void 0) continue;
          if (String(p) !== val) {
            ok = false;
            break;
          }
          score++;
        }
        if (ok && score > bestScore) {
          best = v.val;
          bestScore = score;
        }
      }
      return best || idx[0].val;
    }
    // Returns baked model for a blockstate (file, props); `rand` picks among weighted variants
    bakeVariant(file, props, exactKey, rand = 0) {
      const bs = this.blockstates[file];
      if (bs && bs.multipart) return this.bakeMultipart(file, bs.multipart, props, rand);
      const v = pickWeighted(this.findVariant(file, props, exactKey), rand);
      if (!v) return null;
      return this.bakeModel(v.model, v.x || 0, v.y || 0, !!v.uvlock);
    }
    // 1.9+ multipart blockstate (MultipartBakedModel): every part whose "when" matches adds its model
    bakeMultipart(file, parts, props, rand) {
      const picks = [];
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (part.when && !matchWhen(part.when, props)) continue;
        const v = pickWeighted(part.apply, rand);
        if (v) picks.push(i + ":" + (Array.isArray(part.apply) ? part.apply.indexOf(v) : 0));
      }
      const key = "mp|" + file + "|" + picks.join(",");
      let b = this.baked.get(key);
      if (b) return b;
      const quads = [];
      let bounds = null, first = null;
      for (const p of picks) {
        const [i, k] = p.split(":").map(Number);
        const apply = parts[i].apply;
        const v = Array.isArray(apply) ? apply[k] : apply;
        const m = this.bakeModel(v.model, v.x || 0, v.y || 0, !!v.uvlock);
        if (!first) first = m;
        for (const q of m.quads) quads.push(q);
        if (m.bounds) {
          if (!bounds) bounds = m.bounds.slice();
          else for (let j = 0; j < 3; j++) {
            bounds[j] = Math.min(bounds[j], m.bounds[j]);
            bounds[j + 3] = Math.max(bounds[j + 3], m.bounds[j + 3]);
          }
        }
      }
      b = { quads, ao: first ? first.ao : true, bounds, particle: first ? first.particle : null, builtin: null, display: first ? first.display : {} };
      this.baked.set(key, b);
      return b;
    }
  };
  function pickWeighted(v, rand) {
    if (!Array.isArray(v)) return v || null;
    let total = 0;
    for (const e of v) total += e.weight || 1;
    let r = Math.abs(rand) % total;
    for (const e of v) {
      r -= e.weight || 1;
      if (r < 0) return e;
    }
    return v[0];
  }
  function matchWhen(when, props) {
    if (when.OR) return when.OR.some((w) => matchWhen(w, props));
    for (const [k, val] of Object.entries(when)) {
      const p = props[k];
      if (!String(val).split("|").includes(String(p === void 0 ? false : p))) return false;
    }
    return true;
  }
  function applyElementRotation(pos, r) {
    const o = r.origin || [8, 8, 8];
    const a = (r.angle || 0) * Math.PI / 180;
    const c = Math.cos(a), s = Math.sin(a);
    let scale = [1, 1, 1];
    if (r.rescale) {
      const k = Math.abs(r.angle) === 22.5 ? 1 / Math.cos(Math.PI / 8) - 1 : 1 / Math.cos(Math.PI / 4) - 1;
      scale = r.axis === "x" ? [1, 1 + k, 1 + k] : r.axis === "y" ? [1 + k, 1, 1 + k] : [1 + k, 1 + k, 1];
    }
    for (let i = 0; i < 4; i++) {
      let x = pos[i * 3] - o[0], y = pos[i * 3 + 1] - o[1], z = pos[i * 3 + 2] - o[2];
      let nx = x, ny = y, nz = z;
      if (r.axis === "x") {
        ny = y * c - z * s;
        nz = y * s + z * c;
      } else if (r.axis === "y") {
        nx = x * c + z * s;
        nz = -x * s + z * c;
      } else {
        nx = x * c - y * s;
        ny = x * s + y * c;
      }
      pos[i * 3] = nx * scale[0] + o[0];
      pos[i * 3 + 1] = ny * scale[1] + o[1];
      pos[i * 3 + 2] = nz * scale[2] + o[2];
    }
  }
  function rotateVertex(pos, i, rx, ry) {
    let x = pos[i] - 8, y = pos[i + 1] - 8, z = pos[i + 2] - 8;
    if (rx) {
      const a = -rx * Math.PI / 180;
      const c = Math.round(Math.cos(a)), s = Math.round(Math.sin(a));
      const ny = y * c - z * s, nz = y * s + z * c;
      y = ny;
      z = nz;
    }
    if (ry) {
      const a = -ry * Math.PI / 180;
      const c = Math.round(Math.cos(a)), s = Math.round(Math.sin(a));
      const nx = x * c + z * s, nz = -x * s + z * c;
      x = nx;
      z = nz;
    }
    pos[i] = x + 8;
    pos[i + 1] = y + 8;
    pos[i + 2] = z + 8;
  }
  function rotateDir(dir, rx, ry) {
    const v = [DIR_VEC[dir][0] * 8 + 8, DIR_VEC[dir][1] * 8 + 8, DIR_VEC[dir][2] * 8 + 8];
    rotateVertex(v, 0, rx, ry);
    const x = Math.round(v[0] - 8), y = Math.round(v[1] - 8), z = Math.round(v[2] - 8);
    for (let d = 0; d < 6; d++) {
      const dv = DIR_VEC[d];
      if (dv[0] * 8 === x && dv[1] * 8 === y && dv[2] * 8 === z) return d;
    }
    return dir;
  }
  function rotateBox(from, to, rx, ry) {
    const a = [from[0], from[1], from[2]], b = [to[0], to[1], to[2]];
    if (rx || ry) {
      rotateVertex(a, 0, rx, ry);
      rotateVertex(b, 0, rx, ry);
    }
    return [
      Math.min(a[0], b[0]) / 16,
      Math.min(a[1], b[1]) / 16,
      Math.min(a[2], b[2]) / 16,
      Math.max(a[0], b[0]) / 16,
      Math.max(a[1], b[1]) / 16,
      Math.max(a[2], b[2]) / 16
    ];
  }

  // js/render/atlas.js
  var AtlasLookup = class {
    constructor(table) {
      this.table = table;
    }
    uv(name) {
      const e = this.table[name] || this.table["block/stone"];
      return e ? e.uv : null;
    }
    hasAlpha(name) {
      const e = this.table[name];
      return e ? e.alpha : false;
    }
    has(name) {
      return !!this.table[name];
    }
  };

  // js/world/fluids.js
  var waterPlants = /* @__PURE__ */ new Set(["seagrass", "tall_seagrass", "kelp", "kelp_plant"]);
  var makeStates = (lava) => Array.from({ length: 16 }, (_, level) => Object.freeze({
    isWater: !lava,
    isLava: lava,
    level,
    source: level === 0,
    height: (8 - (level >= 8 ? 0 : level)) / 9
  }));
  var WATER = makeStates(false);
  var LAVA = makeStates(true);
  function getFluidState(state) {
    const block = getBlock(state);
    if (!block) return null;
    const props = getStateProperties(state);
    if (block.isLiquid) return (block.isLava ? LAVA : WATER)[Number(props.level || 0)];
    return props.waterlogged === "true" || waterPlants.has(block.name) ? WATER[0] : null;
  }

  // js/world/blockstates.js
  var COLORS = [
    "white",
    "orange",
    "magenta",
    "light_blue",
    "yellow",
    "lime",
    "pink",
    "gray",
    "silver",
    "cyan",
    "purple",
    "blue",
    "brown",
    "green",
    "red",
    "black"
  ];
  var WOODS = ["oak", "spruce", "birch", "jungle", "acacia", "dark_oak"];
  var HORIZ = ["south", "west", "north", "east"];
  var FACING6 = ["down", "up", "north", "south", "west", "east"];
  var SLAB_STONE = ["stone", "sandstone", "wood_old", "cobblestone", "brick", "stone_brick", "nether_brick", "quartz"];
  var FLOWERS_RED = ["poppy", "blue_orchid", "allium", "houstonia", "red_tulip", "orange_tulip", "white_tulip", "pink_tulip", "oxeye_daisy"];
  var DOUBLE_PLANTS = ["sunflower", "syringa", "double_grass", "double_fern", "double_rose", "paeonia"];
  var RAIL_SHAPES = [
    "north_south",
    "east_west",
    "ascending_east",
    "ascending_west",
    "ascending_north",
    "ascending_south",
    "south_east",
    "south_west",
    "north_west",
    "north_east"
  ];
  var MUSHROOM = [
    "all_inside",
    "north_west",
    "north",
    "north_east",
    "west",
    "center",
    "east",
    "south_west",
    "south",
    "south_east",
    "stem",
    "all_inside",
    "all_inside",
    "all_inside",
    "all_outside",
    "all_stem"
  ];
  var TORCH_FACING = [null, "east", "west", "south", "north", "up"];
  var OFFS = { north: [0, 0, -1], south: [0, 0, 1], west: [-1, 0, 0], east: [1, 0, 0], up: [0, 1, 0], down: [0, -1, 0] };
  var ROT_CCW = { north: "west", west: "south", south: "east", east: "north" };
  var OPP = { north: "south", south: "north", east: "west", west: "east", up: "down", down: "up" };
  var axisOf = (f) => f === "north" || f === "south" ? "z" : f === "east" || f === "west" ? "x" : "y";
  var bName = (state) => getStateInfo(state).name;
  var bDef = (state) => getBlock(state);
  function logAxis(m) {
    return ["y", "x", "z", "none"][m >> 2 & 3];
  }
  function stairsFacing(state) {
    return getStateProperties(state).facing || "north";
  }
  function stairsHalf(state) {
    return getStateProperties(state).half || "bottom";
  }
  function stairsShape(get, x, y, z, meta) {
    const facing = stairsFacing(meta);
    const half = stairsHalf(meta);
    const isStairsSameHalf = (s) => bDef(s).isStairs && stairsHalf(s) === half;
    const differentStairs = (dir) => {
      const o2 = OFFS[dir];
      const s = get(x + o2[0], y + o2[1], z + o2[2]);
      return !bDef(s).isStairs || stairsFacing(s) !== facing || stairsHalf(s) !== half;
    };
    let o = OFFS[facing];
    const back = get(x + o[0], y, z + o[2]);
    if (isStairsSameHalf(back)) {
      const f1 = stairsFacing(back & 15);
      if (axisOf(f1) !== axisOf(facing) && differentStairs(OPP[f1])) {
        return f1 === ROT_CCW[facing] ? "outer_left" : "outer_right";
      }
    }
    o = OFFS[OPP[facing]];
    const front = get(x + o[0], y, z + o[2]);
    if (isStairsSameHalf(front)) {
      const f2 = stairsFacing(front & 15);
      if (axisOf(f2) !== axisOf(facing) && differentStairs(f2)) {
        return f2 === ROT_CCW[facing] ? "inner_left" : "inner_right";
      }
    }
    return "straight";
  }
  function isOpaqueFull(state) {
    return bDef(state).opaque;
  }
  function fenceConnects(selfName, s) {
    const d = bDef(s);
    if (d.id === 0) return false;
    if (d.isFence) {
      const selfNether = selfName === "nether_brick_fence";
      return d.name === "nether_brick_fence" === selfNether;
    }
    if (d.isFenceGate) return true;
    return d.opaque && d.name !== "pumpkin" && d.name !== "lit_pumpkin" && d.name !== "melon_block";
  }
  function paneConnects(s) {
    const d = bDef(s);
    return d.opaque || d.isPane || d.name === "glass" || d.name === "stained_glass";
  }
  function wallConnects(s) {
    const d = bDef(s);
    if (d.id === 0) return false;
    if (d.isWall || d.isFenceGate) return true;
    return d.opaque && d.name !== "pumpkin" && d.name !== "lit_pumpkin" && d.name !== "melon_block";
  }
  function connections(get, x, y, z, fn) {
    return {
      north: fn(get(x, y, z - 1)),
      south: fn(get(x, y, z + 1)),
      west: fn(get(x - 1, y, z)),
      east: fn(get(x + 1, y, z))
    };
  }
  function redstoneConn(get, x, y, z, dir) {
    const o = OFFS[dir];
    const nx = x + o[0], nz = z + o[2];
    const side = get(nx, y, nz);
    const canConnect = (s, d) => {
      const n = bName(s);
      if (n === "redstone_wire") return true;
      if (n === "unpowered_repeater" || n === "powered_repeater") {
        const f = HORIZ[s & 3];
        return f === d || f === OPP[d];
      }
      const def = bDef(s);
      if (/redstone_torch|lever|button|pressure_plate|redstone_block|daylight_detector|comparator|tripwire_hook|detector_rail|trapped_chest|observer/.test(n)) return true;
      return false;
    };
    const above = get(x, y + 1, z);
    if (!isOpaqueFull(above) && isOpaqueFull(side) && bName(get(nx, y + 1, nz)) === "redstone_wire") return "up";
    if (canConnect(side, dir)) return "side";
    if (!isOpaqueFull(side) && bName(get(nx, y - 1, nz)) === "redstone_wire") return "side";
    return "none";
  }
  function doorProps(get, x, y, z, meta) {
    let lower, upper;
    if (meta & 8) {
      upper = meta;
      lower = get(x, y - 1, z) & 15;
    } else {
      lower = meta;
      upper = get(x, y + 1, z) & 15;
    }
    const facing = ["east", "south", "west", "north"][lower & 3];
    return {
      facing,
      open: !!(lower & 4),
      hinge: upper & 1 ? "right" : "left",
      powered: !!(upper & 2),
      half: meta & 8 ? "upper" : "lower"
    };
  }
  function resolveState(state, get, x, y, z) {
    {
      const info = getStateInfo(state);
      const def = getBlock(state);
      if (!def || !def.hasModel) return null;
      const P2 = { ...info.properties };
      if (def.isStairs && !P2.shape) P2.shape = stairsShape(get, x, y, z, state);
      return { file: info.name, props: P2 };
    }
    const id = state >> 4;
    const m = state & 15;
    const b = blocks[id];
    if (!b || !b.hasModel) return null;
    const n = b.name;
    const P = {};
    const R = (file, props = P, variant) => ({ file, props, variant });
    switch (n) {
      case "stone":
        return R(["stone", "granite", "smooth_granite", "diorite", "smooth_diorite", "andesite", "smooth_andesite"][m] || "stone");
      case "grass":
      case "mycelium": {
        const up = bName(get(x, y + 1, z));
        P.snowy = up === "snow" || up === "snow_layer";
        return R(n);
      }
      case "dirt": {
        if (m === 2) {
          const up = bName(get(x, y + 1, z));
          P.snowy = up === "snow" || up === "snow_layer";
          return R("podzol");
        }
        return R(m === 1 ? "coarse_dirt" : "dirt");
      }
      case "planks":
        return R((WOODS[m] || "oak") + "_planks");
      case "sapling":
        P.stage = m >> 3 & 1;
        return R((WOODS[m & 7] || "oak") + "_sapling");
      case "sand":
        return R(m === 1 ? "red_sand" : "sand");
      case "log":
        P.axis = logAxis(m);
        return R(WOODS[m & 3] + "_log");
      case "log2":
        P.axis = logAxis(m);
        return R(WOODS[4 + (m & 1)] + "_log");
      case "leaves":
        return R(WOODS[m & 3] + "_leaves");
      case "leaves2":
        return R(WOODS[4 + (m & 1)] + "_leaves");
      case "sponge":
        P.wet = !!(m & 1);
        return R("sponge");
      case "dispenser":
      case "dropper":
        P.facing = FACING6[m & 7] || "north";
        P.triggered = !!(m & 8);
        return R(n);
      case "sandstone":
        return R(["sandstone", "chiseled_sandstone", "smooth_sandstone"][m] || "sandstone");
      case "red_sandstone":
        return R(["red_sandstone", "chiseled_red_sandstone", "smooth_red_sandstone"][m] || "red_sandstone");
      case "bed":
        return null;
      // TileEntityBedRenderer (1.12 beds are coloured block entities)
      case "golden_rail":
      case "detector_rail":
      case "activator_rail":
        P.shape = RAIL_SHAPES[m & 7] || "north_south";
        P.powered = !!(m & 8);
        return R(n);
      case "rail":
        P.shape = RAIL_SHAPES[m] || "north_south";
        return R("rail");
      case "piston":
      case "sticky_piston":
        P.facing = FACING6[m & 7] || "up";
        P.extended = !!(m & 8);
        return R(n);
      case "piston_head":
        P.facing = FACING6[m & 7] || "up";
        P.type = m & 8 ? "sticky" : "normal";
        P.short = false;
        return R("piston_head");
      case "web":
        return R("web");
      case "tallgrass":
        return R(["dead_bush", "tall_grass", "fern"][m] || "tall_grass");
      case "deadbush":
        return R("dead_bush");
      case "wool":
        return R(COLORS[m] + "_wool");
      case "carpet":
        return R(COLORS[m] + "_carpet");
      case "stained_glass":
        return R(COLORS[m] + "_stained_glass");
      case "stained_hardened_clay":
        return R(COLORS[m] + "_stained_hardened_clay");
      case "stained_glass_pane":
        Object.assign(P, connections(get, x, y, z, paneConnects));
        return R(COLORS[m] + "_stained_glass_pane");
      case "glass_pane":
      case "iron_bars":
        Object.assign(P, connections(get, x, y, z, paneConnects));
        return R(n);
      case "yellow_flower":
        return R("dandelion");
      case "red_flower":
        return R(FLOWERS_RED[m] || "poppy");
      case "double_stone_slab":
        return R(SLAB_STONE[m & 7] + "_double_slab", P, m & 8 ? "all" : "normal");
      case "stone_slab":
        P.half = m & 8 ? "top" : "bottom";
        return R(SLAB_STONE[m & 7] + "_slab");
      case "double_stone_slab2":
        return R("red_sandstone_double_slab", P, m & 8 ? "all" : "normal");
      case "stone_slab2":
        P.half = m & 8 ? "top" : "bottom";
        return R("red_sandstone_slab");
      case "double_wooden_slab":
        return R((WOODS[m & 7] || "oak") + "_double_slab");
      case "wooden_slab":
        P.half = m & 8 ? "top" : "bottom";
        return R((WOODS[m & 7] || "oak") + "_slab");
      case "torch":
      case "redstone_torch":
      case "unlit_redstone_torch":
        P.facing = TORCH_FACING[m] || "up";
        return R(n);
      case "fire": {
        const below = get(x, y - 1, z);
        const flam = (s) => {
          const d = bDef(s);
          return d.material === "wood" || d.material === "leaves" || d.material === "wool" || d.name === "tnt" || d.name === "bookshelf" || d.name === "vine" || d.name === "tallgrass" || d.name === "coal_block" || d.name === "hay_block" || d.name === "carpet";
        };
        if (isOpaqueFull(below) || flam(below)) {
          P.north = P.south = P.east = P.west = false;
        } else {
          Object.assign(P, connections(get, x, y, z, flam));
        }
        P.upper = 0;
        P.alt = (x + y + z & 1) === 1;
        P.flip = ((x ^ z) & 1) === 1;
        return R("fire");
      }
      case "redstone_wire":
        P.north = redstoneConn(get, x, y, z, "north");
        P.south = redstoneConn(get, x, y, z, "south");
        P.east = redstoneConn(get, x, y, z, "east");
        P.west = redstoneConn(get, x, y, z, "west");
        P.power = m;
        return R("redstone_wire");
      case "wheat":
      case "carrots":
      case "potatoes":
        P.age = m & 7;
        return R(n);
      case "nether_wart":
        P.age = m & 3;
        return R("nether_wart");
      case "farmland":
        P.moisture = m & 7;
        return R("farmland");
      case "furnace":
      case "lit_furnace":
      case "ladder":
        P.facing = FACING6[m] && m >= 2 ? FACING6[m] : "north";
        return R(n);
      case "wall_sign":
      case "standing_sign":
        return null;
      case "lever": {
        P.facing = ["down_x", "east", "west", "south", "north", "up_z", "up_x", "down_z"][m & 7];
        P.powered = !!(m & 8);
        return R("lever");
      }
      case "stone_pressure_plate":
      case "wooden_pressure_plate":
        P.powered = !!(m & 1);
        return R(n);
      case "light_weighted_pressure_plate":
      case "heavy_weighted_pressure_plate":
        P.power = m;
        return R(n);
      case "stone_button":
      case "wooden_button":
        P.facing = ["down", "east", "west", "south", "north", "up", "up", "up"][m & 7];
        P.powered = !!(m & 8);
        return R(n);
      case "snow_layer":
        P.layers = (m & 7) + 1;
        return R("snow_layer");
      case "cactus":
      case "reeds":
        return R(n);
      case "pumpkin":
      case "lit_pumpkin":
        P.facing = HORIZ[m & 3];
        return R(n);
      case "portal":
        P.axis = (m & 3) === 2 ? "z" : "x";
        return R("portal");
      case "cake":
        P.bites = m & 7;
        return R("cake");
      case "unpowered_repeater":
      case "powered_repeater":
        P.facing = HORIZ[m & 3];
        P.delay = (m >> 2) + 1;
        P.locked = false;
        return R(n);
      case "unpowered_comparator":
      case "powered_comparator":
        P.facing = HORIZ[m & 3];
        P.mode = m & 4 ? "subtract" : "compare";
        P.powered = !!(m & 8);
        return R(n);
      case "trapdoor":
      case "iron_trapdoor":
        P.facing = ["north", "south", "west", "east"][m & 3];
        P.open = !!(m & 4);
        P.half = m & 8 ? "top" : "bottom";
        return R(n);
      case "monster_egg":
        return R([
          "stone_monster_egg",
          "cobblestone_monster_egg",
          "stone_brick_monster_egg",
          "mossy_brick_monster_egg",
          "cracked_brick_monster_egg",
          "chiseled_brick_monster_egg"
        ][m] || "stone_monster_egg");
      case "stonebrick":
        return R(["stonebrick", "mossy_stonebrick", "cracked_stonebrick", "chiseled_stonebrick"][m] || "stonebrick");
      case "brown_mushroom_block":
      case "red_mushroom_block":
        P.variant = MUSHROOM[m];
        return R(n);
      case "pumpkin_stem":
      case "melon_stem": {
        P.age = m & 7;
        P.facing = "up";
        if (P.age === 7) {
          const fruit = n === "pumpkin_stem" ? "pumpkin" : "melon_block";
          for (const d of ["north", "south", "west", "east"]) {
            const o = OFFS[d];
            if (bName(get(x + o[0], y, z + o[2])) === fruit) {
              P.facing = d;
              break;
            }
          }
        }
        return R(n);
      }
      case "vine": {
        P.south = !!(m & 1);
        P.west = !!(m & 2);
        P.north = !!(m & 4);
        P.east = !!(m & 8);
        P.up = isOpaqueFull(get(x, y + 1, z));
        return R("vine");
      }
      case "cocoa":
        P.facing = HORIZ[m & 3];
        P.age = m >> 2 & 3;
        return R("cocoa");
      case "brewing_stand":
        P.has_bottle_0 = !!(m & 1);
        P.has_bottle_1 = !!(m & 2);
        P.has_bottle_2 = !!(m & 4);
        return R(n);
      case "cauldron":
        P.level = m & 3;
        return R("cauldron");
      case "end_portal_frame":
        P.facing = HORIZ[m & 3];
        P.eye = !!(m & 4);
        return R(n);
      case "tripwire_hook": {
        P.facing = HORIZ[m & 3];
        P.attached = !!(m & 4);
        P.powered = !!(m & 8);
        P.suspended = !isOpaqueFull(get(x, y - 1, z));
        return R(n);
      }
      case "tripwire": {
        P.powered = !!(m & 1);
        P.suspended = !!(m & 2);
        P.attached = !!(m & 4);
        P.disarmed = !!(m & 8);
        Object.assign(P, connections(get, x, y, z, (s) => {
          const nn = bName(s);
          return nn === "tripwire" || nn === "tripwire_hook";
        }));
        return R(n);
      }
      case "cobblestone_wall": {
        Object.assign(P, connections(get, x, y, z, wallConnects));
        P.up = !(P.north && P.south && !P.east && !P.west || P.east && P.west && !P.north && !P.south) || bDef(get(x, y + 1, z)).id !== 0;
        return R(m === 1 ? "mossy_cobblestone_wall" : "cobblestone_wall");
      }
      case "flower_pot":
        P.contents = "empty";
        return R("flower_pot");
      case "anvil":
        P.facing = HORIZ[m & 3];
        P.damage = m >> 2 & 3;
        return R("anvil");
      case "daylight_detector":
      case "daylight_detector_inverted":
        P.power = m;
        return R(n);
      case "hopper":
        P.facing = FACING6[m & 7] || "down";
        P.enabled = !(m & 8);
        return R("hopper");
      case "quartz_block":
        if (m === 1) return R("chiseled_quartz_block");
        if (m >= 2) {
          P.axis = ["y", "x", "z"][Math.min(m - 2, 2)];
          return R("quartz_column");
        }
        return R("quartz_block");
      case "prismarine":
        return R(["prismarine", "prismarine_bricks", "dark_prismarine"][m] || "prismarine");
      case "hay_block":
        P.axis = ["y", "x", "z", "y"][m >> 2 & 3];
        return R("hay_block");
      case "double_plant": {
        let lowerMeta = m;
        if (m & 8) lowerMeta = get(x, y - 1, z) >> 4 === id ? get(x, y - 1, z) & 15 : 0;
        P.half = m & 8 ? "upper" : "lower";
        return R(DOUBLE_PLANTS[lowerMeta & 7] || "double_grass");
      }
      case "end_portal":
        return null;
      case "command_block":
      case "repeating_command_block":
      case "chain_command_block":
        P.facing = FACING6[m & 7] || "down";
        P.conditional = !!(m & 8);
        return R(n);
      case "beacon":
      case "mob_spawner":
      case "dragon_egg":
        return R(n);
      // 1.9 - 1.12 blocks
      case "concrete":
        return R(COLORS[m] + "_concrete");
      case "concrete_powder":
        return R(COLORS[m] + "_concrete_powder");
      case "bone_block":
      case "purpur_pillar":
        P.axis = ["y", "x", "z", "y"][m >> 2 & 3];
        return R(n);
      case "purpur_slab":
        P.half = m & 8 ? "top" : "bottom";
        P.variant = "default";
        return R(n);
      case "purpur_double_slab":
        P.variant = "default";
        return R(n);
      case "end_rod":
        P.facing = FACING6[m & 7] || "up";
        return R(n);
      case "observer":
        P.facing = FACING6[m & 7] || "down";
        P.powered = !!(m & 8);
        return R(n);
      case "chorus_flower":
        P.age = m & 7;
        return R(n);
      case "chorus_plant": {
        const c = (s) => {
          const nn = bName(s);
          return nn === "chorus_plant" || nn === "chorus_flower";
        };
        Object.assign(P, connections(get, x, y, z, c));
        P.up = c(get(x, y + 1, z));
        const below = get(x, y - 1, z);
        P.down = c(below) || bName(below) === "end_stone";
        return R(n);
      }
      case "beetroots":
      case "frosted_ice":
        P.age = m & 3;
        return R(n);
      case "structure_block":
        P.mode = ["save", "load", "corner", "data"][m & 3];
        return R(n);
      case "structure_void":
      case "end_gateway":
        return null;
      default:
        break;
    }
    if (b.isStairs) {
      P.facing = stairsFacing(m);
      P.half = stairsHalf(m);
      P.shape = stairsShape(get, x, y, z, m);
      return R(n === "stone_stairs" ? "stone_stairs" : n);
    }
    if (b.isFence) {
      Object.assign(P, connections(get, x, y, z, (s) => fenceConnects(n, s)));
      return R(n === "fence" ? "fence" : n);
    }
    if (b.isFenceGate) {
      P.facing = HORIZ[m & 3];
      P.open = !!(m & 4);
      const f = P.facing;
      const side = f === "north" || f === "south" ? [[-1, 0], [1, 0]] : [[0, -1], [0, 1]];
      P.in_wall = side.some(([dx, dz]) => bDef(get(x + dx, y, z + dz)).isWall);
      return R(n);
    }
    if (b.isDoor) {
      Object.assign(P, doorProps(get, x, y, z, m));
      return R(n);
    }
    if (n.endsWith("_glazed_terracotta")) {
      P.facing = HORIZ[m & 3];
      return R(n.replace(/^light_gray_/, "silver_"));
    }
    if (n.endsWith("_shulker_box")) return null;
    return R(n);
  }
  var ITEM_VARIANTS = {
    stone: ["stone", "granite", "granite_smooth", "diorite", "diorite_smooth", "andesite", "andesite_smooth"],
    dirt: ["dirt", "coarse_dirt", "podzol"],
    planks: WOODS.map((w) => w + "_planks"),
    sapling: WOODS.map((w) => w + "_sapling"),
    sand: ["sand", "red_sand"],
    log: WOODS.slice(0, 4).map((w) => w + "_log"),
    log2: ["acacia_log", "dark_oak_log"],
    leaves: WOODS.slice(0, 4).map((w) => w + "_leaves"),
    leaves2: ["acacia_leaves", "dark_oak_leaves"],
    sponge: ["sponge", "sponge_wet"],
    sandstone: ["sandstone", "chiseled_sandstone", "smooth_sandstone"],
    red_sandstone: ["red_sandstone", "chiseled_red_sandstone", "smooth_red_sandstone"],
    tallgrass: ["dead_bush", "tall_grass", "fern"],
    wool: COLORS.map((c) => c + "_wool"),
    carpet: COLORS.map((c) => c + "_carpet"),
    stained_glass: COLORS.map((c) => c + "_stained_glass"),
    stained_glass_pane: COLORS.map((c) => c + "_stained_glass_pane"),
    stained_hardened_clay: COLORS.map((c) => c + "_stained_hardened_clay"),
    red_flower: FLOWERS_RED,
    yellow_flower: ["dandelion"],
    stone_slab: ["stone_slab", "sandstone_slab", "oak_slab", "cobblestone_slab", "brick_slab", "stone_brick_slab", "nether_brick_slab", "quartz_slab"],
    stone_slab2: ["red_sandstone_slab"],
    wooden_slab: WOODS.map((w) => w + "_slab"),
    monster_egg: ["stone_monster_egg", "cobblestone_monster_egg", "stone_brick_monster_egg", "mossy_brick_monster_egg", "cracked_brick_monster_egg", "chiseled_brick_monster_egg"],
    stonebrick: ["stonebrick", "mossy_stonebrick", "cracked_stonebrick", "chiseled_stonebrick"],
    cobblestone_wall: ["cobblestone_wall", "mossy_cobblestone_wall"],
    quartz_block: ["quartz_block", "chiseled_quartz_block", "quartz_column"],
    anvil: ["anvil_intact", "anvil_slightly_damaged", "anvil_very_damaged"],
    prismarine: ["prismarine", "prismarine_bricks", "dark_prismarine"],
    double_plant: DOUBLE_PLANTS,
    dye: [
      "dye_black",
      "dye_red",
      "dye_green",
      "dye_brown",
      "dye_blue",
      "dye_purple",
      "dye_cyan",
      "dye_silver",
      "dye_gray",
      "dye_pink",
      "dye_lime",
      "dye_yellow",
      "dye_light_blue",
      "dye_magenta",
      "dye_orange",
      "dye_white"
    ],
    coal: ["coal", "charcoal"],
    golden_apple: ["golden_apple", "golden_apple"],
    fish: ["cod", "salmon", "clownfish", "pufferfish"],
    cooked_fish: ["cooked_cod", "cooked_salmon"],
    concrete: COLORS.map((c) => c + "_concrete"),
    concrete_powder: COLORS.map((c) => c + "_concrete_powder"),
    skull: ["skull_skeleton", "skull_wither", "skull_zombie", "skull_char", "skull_creeper", "skull_dragon"]
  };

  // js/render/visgraph.js
  var ALL = new Uint8Array([63, 63, 63, 63, 63, 63]);
  var stack = new Int32Array(4096);
  var seen = new Uint8Array(4096);
  function allVisible() {
    return ALL.slice();
  }
  function computeVisibility(blocksArr, fancyLeaves) {
    seen.fill(0);
    let opaqueCount = 0;
    for (let i = 0; i < 4096; i++) {
      const b = getBlock(blocksArr[i]);
      if (b && b.opaque && !(fancyLeaves && b.name.endsWith("_leaves"))) {
        seen[i] = 1;
        opaqueCount++;
      }
    }
    if (opaqueCount < 256) return allVisible();
    const vis = new Uint8Array(6);
    if (opaqueCount === 4096) return vis;
    for (let i = 0; i < 4096; i++) {
      if (seen[i]) continue;
      const x = i & 15, z = i >> 4 & 15, y = i >> 8;
      if (x !== 0 && x !== 15 && y !== 0 && y !== 15 && z !== 0 && z !== 15) continue;
      let faces = 0, sp = 0;
      stack[sp++] = i;
      seen[i] = 1;
      while (sp > 0) {
        const j = stack[--sp];
        const jx = j & 15, jz = j >> 4 & 15, jy = j >> 8;
        if (jy === 0) faces |= 1;
        else if (!seen[j - 256]) {
          seen[j - 256] = 1;
          stack[sp++] = j - 256;
        }
        if (jy === 15) faces |= 2;
        else if (!seen[j + 256]) {
          seen[j + 256] = 1;
          stack[sp++] = j + 256;
        }
        if (jz === 0) faces |= 4;
        else if (!seen[j - 16]) {
          seen[j - 16] = 1;
          stack[sp++] = j - 16;
        }
        if (jz === 15) faces |= 8;
        else if (!seen[j + 16]) {
          seen[j + 16] = 1;
          stack[sp++] = j + 16;
        }
        if (jx === 0) faces |= 16;
        else if (!seen[j - 1]) {
          seen[j - 1] = 1;
          stack[sp++] = j - 1;
        }
        if (jx === 15) faces |= 32;
        else if (!seen[j + 1]) {
          seen[j + 1] = 1;
          stack[sp++] = j + 1;
        }
      }
      for (let a = 0; a < 6; a++) if (faces & 1 << a) vis[a] |= faces;
    }
    return vis;
  }

  // js/render/mesher.js
  var BYTES_PER_VERTEX = 20;
  var OFFSET_TYPES = {
    dandelion: 1,
    poppy: 1,
    blue_orchid: 1,
    allium: 1,
    azure_bluet: 1,
    red_tulip: 1,
    orange_tulip: 1,
    white_tulip: 1,
    pink_tulip: 1,
    oxeye_daisy: 1,
    brown_mushroom: 1,
    red_mushroom: 1,
    grass: 2,
    tall_grass: 2,
    fern: 2,
    large_fern: 2
  };
  function positionRandom(x, y, z) {
    const i = Math.imul(x, 3129871) ^ Math.imul(z, 116129781) ^ y;
    return Math.imul(Math.imul(i, i), 42317861) + Math.imul(i, 11) | 0;
  }
  var FACE_SHADE = [0.5, 1, 0.8, 0.8, 0.6, 0.6];
  function coversFluidFace(state, dir, height = 1) {
    const b = getBlock(state);
    if (!b || b.isLiquid) return false;
    if (b.opaque) return true;
    if (b.translucent || b.name === "glass" || b.name.endsWith("_leaves")) return false;
    const axis = dir < 2 ? 1 : dir < 4 ? 2 : 0;
    const u = axis === 0 ? 2 : 0, v = axis === 1 ? 2 : 1;
    const plane = dir === 1 ? height : dir & 1;
    let remaining = [[0, 0, 1, axis === 1 ? 1 : height]];
    for (const box of staticCollisionBoxes(state)) {
      if (box[axis] > plane + 1e-6 || box[axis + 3] < plane - 1e-6) continue;
      const next = [];
      for (const r of remaining) {
        const x0 = Math.max(r[0], box[u]), y0 = Math.max(r[1], box[v]);
        const x1 = Math.min(r[2], box[u + 3]), y1 = Math.min(r[3], box[v + 3]);
        if (x0 >= x1 || y0 >= y1) {
          next.push(r);
          continue;
        }
        if (r[0] < x0) next.push([r[0], r[1], x0, r[3]]);
        if (x1 < r[2]) next.push([x1, r[1], r[2], r[3]]);
        if (r[1] < y0) next.push([x0, r[1], x1, y0]);
        if (y1 < r[3]) next.push([x0, y1, x1, r[3]]);
      }
      remaining = next;
      if (!remaining.length) return true;
    }
    return false;
  }
  var VBuf = class {
    constructor() {
      this._alloc(1024);
      this.n = 0;
    }
    _alloc(verts) {
      const buf = new ArrayBuffer(verts * BYTES_PER_VERTEX);
      if (this.u8) new Uint8Array(buf).set(this.u8);
      this.u16 = new Uint16Array(buf);
      this.u8 = new Uint8Array(buf);
      this.cap = verts;
    }
    push10(x, y, z, u, v, r, g, b, sky, blk, animation = 0) {
      if (this.n >= this.cap) this._alloc(this.cap * 2);
      const w = this.n * 10, by = this.n * 20, U = this.u16, B = this.u8;
      U[w] = (x + 8) * 2048 + 0.5;
      U[w + 1] = (y + 8) * 2048 + 0.5;
      U[w + 2] = (z + 8) * 2048 + 0.5;
      U[w + 3] = animation;
      U[w + 4] = u * 65535 + 0.5;
      U[w + 5] = v * 65535 + 0.5;
      B[by + 12] = (r > 1 ? 1 : r) * 255 + 0.5;
      B[by + 13] = (g > 1 ? 1 : g) * 255 + 0.5;
      B[by + 14] = (b > 1 ? 1 : b) * 255 + 0.5;
      B[by + 15] = 255;
      B[by + 16] = sky * 17 + 0.5;
      B[by + 17] = blk * 17 + 0.5;
      this.n++;
    }
    result() {
      return this.u8.slice(0, this.n * BYTES_PER_VERTEX);
    }
    reset() {
      this.n = 0;
      return this;
    }
  };
  var AO_AXES = [
    [[1, 0, 0], [0, 0, 1]],
    // down
    [[1, 0, 0], [0, 0, 1]],
    // up
    [[1, 0, 0], [0, 1, 0]],
    // north
    [[1, 0, 0], [0, 1, 0]],
    // south
    [[0, 0, 1], [0, 1, 0]],
    // west
    [[0, 0, 1], [0, 1, 0]]
    // east
  ];
  var FACE_FLAGS = null;
  function faceFlags() {
    if (FACE_FLAGS && FACE_FLAGS.length === blocks.length) return FACE_FLAGS;
    FACE_FLAGS = new Uint8Array(blocks.length);
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (!b) continue;
      const n = b.name;
      let f = 0;
      if (n.endsWith("_leaves")) f |= 1;
      if (n === "glass" || n.endsWith("_stained_glass") || n === "ice" || n === "frosted_ice" || n === "slime_block" || n === "nether_portal") f |= 2;
      if (b.isPane) f |= 4;
      FACE_FLAGS[i] = f;
    }
    return FACE_FLAGS;
  }
  var LOD_SKIP = /* @__PURE__ */ new Set([
    "grass",
    "tall_grass",
    "fern",
    "seagrass",
    "tall_seagrass",
    "dandelion",
    "poppy",
    "blue_orchid",
    "allium",
    "azure_bluet",
    "red_tulip",
    "orange_tulip",
    "white_tulip",
    "pink_tulip",
    "oxeye_daisy",
    "dead_bush",
    "brown_mushroom",
    "red_mushroom",
    "sunflower",
    "lilac",
    "rose_bush",
    "peony",
    "large_fern",
    "lily_pad",
    "cobweb"
  ]);
  var ZERO_OFFSET = Object.freeze([0, 0, 0]);
  function blockModelOffset(name, x, y, z) {
    const native = nativeModelOffset(name, x, y, z);
    if (native) return native;
    const type = OFFSET_TYPES[name];
    if (!type) return ZERO_OFFSET;
    const r = positionRandom(x, y, z);
    return [((r >>> 16 & 15) / 15 - 0.5) * 0.5, type === 2 ? ((r >>> 20 & 15) / 15 - 1) * 0.2 : 0, ((r >>> 24 & 15) / 15 - 0.5) * 0.5];
  }
  var Mesher = class {
    constructor(world, store) {
      this.world = world;
      this.store = store;
      this.cache = /* @__PURE__ */ new Map();
      this.atlas = store.atlas;
      this.waterStill = this.atlas.uv("block/water_still");
      this.waterFlow = this.atlas.uv("block/water_flow");
      this.lavaStill = this.atlas.uv("block/lava_still");
      this.lavaFlow = this.atlas.uv("block/lava_flow");
      this.options = { fancy: true, smooth: 2, alt: true, biomeBlendRadius: 2 };
      this.stateModels = /* @__PURE__ */ new Map();
      this.dynamicStates = /* @__PURE__ */ new Set();
      this._reads = 0;
      this._countingGet = (a, b, c) => {
        this._reads++;
        return this.world.getState(a, b, c);
      };
      this._neighbors = new Int32Array(6);
      this._visible = new Uint8Array(6);
      this._corners = [];
      for (let i = 0; i < 12; i++) this._corners.push([new Float32Array(3), new Float32Array(3), new Float32Array(3), new Float32Array(3)]);
      this._cornerValid = new Uint8Array(12);
      this._tintCache = [];
    }
    isLeaves(b) {
      return b.name.endsWith("_leaves");
    }
    getModel(state, x, y, z) {
      const w = this.world;
      const hasTp = w.tileProps && w.tileProps.size && w.tileProps.has(x + "," + y + "," + z);
      if (!hasTp) {
        const cached = this.stateModels.get(state);
        if (cached !== void 0) return this._pick(cached, x, y, z);
      }
      this._reads = 0;
      const rs = resolveState(state, this._countingGet, x, y, z);
      const staticState = this._reads === 0 && !hasTp;
      if (!rs) {
        if (staticState) this.stateModels.set(state, null);
        return null;
      }
      const tp = hasTp && w.tileProps.get(x + "," + y + "," + z);
      if (tp) rs.props = { ...rs.props, ...tp };
      let key = rs.file + "|" + (rs.variant || "");
      for (const k in rs.props) key += k + "=" + rs.props[k] + ",";
      let m = this.cache.get(key);
      if (m === void 0) {
        const bs = this.store.blockstates[rs.file];
        if (!bs) {
          m = null;
        } else {
          const variants = bs.variants && this.store.findVariant(rs.file, rs.props, rs.variant);
          if (Array.isArray(variants)) {
            m = { multi: variants.map((v, i) => this.store.bakeVariant(rs.file, rs.props, rs.variant, i)), weights: variants.map((v) => v.weight || 1) };
          } else {
            m = this.store.bakeVariant(rs.file, rs.props, rs.variant, 0);
          }
        }
        this.cache.set(key, m);
      }
      if (staticState) this.stateModels.set(state, m);
      return this._pick(m, x, y, z);
    }
    _pick(m, x, y, z) {
      if (m && m.multi) {
        if (this.options.alt === false) return m.multi[0];
        const total = m.weights.reduce((a, b) => a + b, 0);
        let r = Math.abs(positionRandom(x, y, z) >> 16) % total;
        for (let i = 0; i < m.multi.length; i++) {
          r -= m.weights[i];
          if (r < 0) return m.multi[i];
        }
        return m.multi[0];
      }
      return m;
    }
    tintFor(state, tint, x, y, z) {
      if (tint < 0) return 16777215;
      const b = getBlock(state);
      const n = b.name;
      const props = getStateProperties(state);
      switch (n) {
        case "grass_block":
        case "grass":
        case "tall_grass":
        case "fern":
        case "large_fern":
        case "sugar_cane":
          return this.biomeBlend(x, y, z, grassColor);
        case "vine":
          return this.biomeBlend(x, y, z, foliageColor);
        case "spruce_leaves":
          return 6396257;
        case "birch_leaves":
          return 8431445;
        default:
          if (n.endsWith("_leaves")) return this.biomeBlend(x, y, z, foliageColor);
          if (n === "lily_pad") return 2129968;
          if (n === "attached_pumpkin_stem" || n === "attached_melon_stem") return 14731036;
          if (n === "pumpkin_stem" || n === "melon_stem") {
            const age = Number(props.age || 0);
            return age * 32 << 16 | 255 - age * 8 << 8 | age * 4;
          }
          if (n === "redstone_wire") {
            const power = Number(props.power || 0), f = power / 15;
            let r = f * 0.6 + 0.4;
            if (power === 0) r = 0.3;
            const g = Math.max(0, f * f * 0.7 - 0.5);
            const bl = Math.max(0, f * f * 0.6 - 0.7);
            return r * 255 << 16 | g * 255 << 8 | bl * 255;
          }
          return 16777215;
      }
    }
    biomeBlend(x, y, z, fn) {
      let r = 0, g = 0, b = 0;
      const radius = Math.max(0, Math.min(7, this.options.biomeBlendRadius ?? 2)), samples = (radius * 2 + 1) ** 2;
      for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const c = fn(this.world.getBiome(x + dx, z + dz, y), y);
          r += c >> 16 & 255;
          g += c >> 8 & 255;
          b += c & 255;
        }
      }
      return (r / samples | 0) << 16 | (g / samples | 0) << 8 | (b / samples | 0);
    }
    // Combined light used for AO sampling: returns [sky, block] or null if position is opaque
    lightAt(x, y, z) {
      const s = this.world.getState(x, y, z);
      const b = getBlock(s);
      if (b && b.opaque) return null;
      const l = this.world.getLight(x, y, z);
      if (b && b.useNeighborBrightness) {
        let best = l;
        for (const o of DIR_OFFSETS) {
          const nl = this.world.getLight(x + o[0], y + o[1], z + o[2]);
          if (nl >> 4 > best >> 4) best = nl & 240 | best & 15;
          if ((nl & 15) > (best & 15)) best = best & 240 | nl & 15;
        }
        return best;
      }
      return l;
    }
    aoValue(x, y, z) {
      const b = getBlock(this.world.getState(x, y, z));
      return b ? b.aoLight : 1;
    }
    isTranslucentForAO(x, y, z) {
      const b = getBlock(this.world.getState(x, y, z));
      return !b || !b.opaque;
    }
    // Compute per-corner light+AO for a face whose plane is at block (px,py,pz) looking in dir.
    // Returns array of 4 corners [(-,-),(+,-),(+,+),(-,+)] each [ao, sky, block] in tangent space.
    // lightAt with the block state already read
    _lightOf(state, x, y, z) {
      const b = getBlock(state);
      if (b && b.opaque) return null;
      if (b && b.useNeighborBrightness) return this.lightAt(x, y, z);
      return this.world.getLight(x, y, z);
    }
    faceCorners(px, py, pz, dir, out) {
      const [e1, e2] = AO_AXES[dir];
      const w = this.world;
      const sP = w.getState(px, py, pz), bP = getBlock(sP);
      const center = this._lightOf(sP, px, py, pz);
      const cAO = bP ? bP.aoLight : 1;
      const cSky = center === null ? 0 : center >> 4, cBlk = center === null ? 0 : center & 15;
      for (let k = 0; k < 4; k++) {
        const s1 = k === 0 || k === 3 ? -1 : 1;
        const s2 = k < 2 ? -1 : 1;
        const ax = px + e1[0] * s1, ay = py + e1[1] * s1, az = pz + e1[2] * s1;
        const bx = px + e2[0] * s2, by = py + e2[1] * s2, bz = pz + e2[2] * s2;
        const cx = ax + e2[0] * s2, cy = ay + e2[1] * s2, cz = az + e2[2] * s2;
        const sA = w.getState(ax, ay, az), sB = w.getState(bx, by, bz);
        const bA = getBlock(sA), bB = getBlock(sB);
        const aoA = bA ? bA.aoLight : 1;
        const aoB = bB ? bB.aoLight : 1;
        const tA = !bA || !bA.opaque;
        const tB = !bB || !bB.opaque;
        const lA = this._lightOf(sA, ax, ay, az);
        const lB = this._lightOf(sB, bx, by, bz);
        let aoC, lC;
        if (tA || tB) {
          const sC = w.getState(cx, cy, cz), bC = getBlock(sC);
          aoC = bC ? bC.aoLight : 1;
          lC = this._lightOf(sC, cx, cy, cz);
        } else {
          aoC = aoA;
          lC = lA;
        }
        const ao = (aoA + aoB + aoC + cAO) * 0.25;
        const sky = ((lA === null || lA === 0 ? cSky : lA >> 4) + (lB === null || lB === 0 ? cSky : lB >> 4) + (lC === null || lC === 0 ? cSky : lC >> 4) + cSky) / 4;
        const blk = ((lA === null || lA === 0 ? cBlk : lA & 15) + (lB === null || lB === 0 ? cBlk : lB & 15) + (lC === null || lC === 0 ? cBlk : lC & 15) + cBlk) / 4;
        const c = out[k];
        c[0] = ao;
        c[1] = sky;
        c[2] = blk;
      }
      return out;
    }
    shouldRenderFace(state, nState, dir) {
      const nb = getBlock(nState);
      const nid = nb ? nb.id : 0;
      if (!nb || nb.id === 0) return true;
      if (nb.opaque) return false;
      const F = this._flags;
      if (!this.options.fancy && F[nid] & 1) return false;
      const own = getBlock(state);
      const f = own ? F[own.id] : 0;
      if (own && own.id === nid) {
        if (f & 2 && (own.name !== "nether_portal" || state === nState)) return false;
        if (f & 4) {
          if (dir < 2) return false;
          const p = getStateProperties(state), np = getStateProperties(nState);
          if (p[DIR_NAMES[dir]] === "true" && np[DIR_NAMES[OPPOSITE[dir]]] === "true") return false;
        }
      }
      return true;
    }
    // world: a SliceWorld around the section
    // lod (Gravrust level of detail, far sections): flat lighting, fast leaves, no small plants
    buildSection(world, cx, sy, cz, lod = false) {
      if (lod) {
        const saved = this.options;
        this.options = { ...saved, fancy: false, smooth: 0, lod: true };
        try {
          return this.buildSection(world, cx, sy, cz, false);
        } finally {
          this.options = saved;
        }
      }
      this.world = world;
      this._flags = faceFlags();
      const bufs = this._bufs || (this._bufs = [new VBuf(), new VBuf(), new VBuf()]);
      const solid = bufs[0].reset(), cutout = bufs[1].reset(), trans = bufs[2].reset();
      const w = world;
      const bx0 = cx * 16, by0 = sy * 16, bz0 = cz * 16;
      const blocksArr = w.getSectionBlocks();
      if (!blocksArr) return null;
      for (let i = 0; i < 4096; i++) {
        const state = blocksArr[i];
        const b = getBlock(state);
        const id = b ? b.id : 0;
        if (id === 0) continue;
        const lx = i & 15, lz = i >> 4 & 15, ly = i >> 8;
        const x = bx0 + lx, y = by0 + ly, z = bz0 + lz;
        if (!b) continue;
        const fluid = getFluidState(state);
        if (fluid) this.renderFluid(state, fluid, x, y, z, trans, lx, ly, lz);
        if (b.isLiquid) continue;
        if (!b.hasModel) continue;
        if (this.options.lod && LOD_SKIP.has(b.name)) continue;
        const model = this.getModel(state, x, y, z);
        if (!model || !model.quads.length) continue;
        let ox = 0, oy = 0, oz = 0;
        if (b.modelOffset || OFFSET_TYPES[b.name]) [ox, oy, oz] = blockModelOffset(b.name, x, y, z);
        const useAO = this.options.smooth && model.ao && b.emitLight === 0;
        const fastLeaves = !this.options.fancy && this.isLeaves(b);
        const visible = this._visible;
        for (let d = 0; d < 6; d++) {
          const o = DIR_OFFSETS[d];
          visible[d] = this.shouldRenderFace(state, w.getState(x + o[0], y + o[1], z + o[2]), d) ? 1 : 0;
        }
        this._cornerValid.fill(0);
        const ownLight = this.lightAt(x, y, z);
        const tintCache = this._tintCache;
        tintCache.length = 0;
        for (const q of model.quads) {
          if (q.cull >= 0 && !visible[q.cull]) continue;
          let buf;
          if (b.translucent) buf = trans;
          else if (q.alpha && !fastLeaves) buf = cutout;
          else buf = solid;
          let tint = q.tint < 0 ? 16777215 : tintCache[q.tint];
          if (tint === void 0) tint = tintCache[q.tint] = this.tintFor(state, q.tint, x, y, z);
          const tr = (tint >> 16 & 255) / 255, tg = (tint >> 8 & 255) / 255, tb = (tint & 255) / 255;
          const shade = q.shade ? FACE_SHADE[q.dir] : 1;
          const p = q.pos, uv = q.uv;
          const middleV = (Math.min(uv[1], uv[3], uv[5], uv[7]) + Math.max(uv[1], uv[3], uv[5], uv[7])) * 0.5;
          const axis = q.dir >> 1;
          const ci = axis === 0 ? 1 : axis === 1 ? 2 : 0;
          const planeVal = p[ci];
          const aligned = Math.abs(p[3 + ci] - planeVal) < 1e-4 && Math.abs(p[6 + ci] - planeVal) < 1e-4 && Math.abs(p[9 + ci] - planeVal) < 1e-4;
          if (useAO && aligned) {
            const flush = q.dir & 1 ? planeVal > 0.9999 : planeVal < 1e-4;
            const o = DIR_OFFSETS[q.dir];
            const px = flush ? x + o[0] : x, py = flush ? y + o[1] : y, pz = flush ? z + o[2] : z;
            const ck = q.dir * 2 + (flush ? 1 : 0);
            const corners = this._corners[ck];
            if (!this._cornerValid[ck]) {
              this.faceCorners(px, py, pz, q.dir, corners);
              this._cornerValid[ck] = 1;
            }
            const [e1, e2] = AO_AXES[q.dir];
            for (let v = 0; v < 4; v++) {
              const vx = p[v * 3], vy = p[v * 3 + 1], vz = p[v * 3 + 2];
              const t1 = vx * e1[0] + vy * e1[1] + vz * e1[2];
              const t2 = vx * e2[0] + vy * e2[1] + vz * e2[2];
              const w0 = (1 - t1) * (1 - t2), w1 = t1 * (1 - t2), w2 = t1 * t2, w3 = (1 - t1) * t2;
              const ao = corners[0][0] * w0 + corners[1][0] * w1 + corners[2][0] * w2 + corners[3][0] * w3;
              const sky = corners[0][1] * w0 + corners[1][1] * w1 + corners[2][1] * w2 + corners[3][1] * w3;
              const blk = corners[0][2] * w0 + corners[1][2] * w1 + corners[2][2] * w2 + corners[3][2] * w3;
              const f = shade * ao;
              buf.push10(lx + vx + ox, ly + vy + oy, lz + vz + oz, uv[v * 2], uv[v * 2 + 1], tr * f, tg * f, tb * f, sky, blk, state | (uv[v * 2 + 1] < middleV ? 32768 : 0));
            }
          } else {
            let l = ownLight;
            if (q.cull >= 0) {
              const o = DIR_OFFSETS[q.cull];
              const nl = this.lightAt(x + o[0], y + o[1], z + o[2]);
              if (nl !== null) l = nl;
            }
            if (l === null) l = w.getLight(x, y, z);
            const sky = l >> 4, blk = l & 15;
            for (let v = 0; v < 4; v++) {
              buf.push10(lx + p[v * 3] + ox, ly + p[v * 3 + 1] + oy, lz + p[v * 3 + 2] + oz, uv[v * 2], uv[v * 2 + 1], tr * shade, tg * shade, tb * shade, sky, blk, state | (uv[v * 2 + 1] < middleV ? 32768 : 0));
            }
          }
        }
      }
      return { solid: solid.result(), cutout: cutout.result(), translucent: trans.result(), vis: computeVisibility(blocksArr, this.options.fancy), lod: !!this.options.lod };
    }
    // ---- Fluids (port of BlockFluidRenderer) ----
    fluidMatches(state, lava) {
      const fluid = getFluidState(state);
      return !!fluid && fluid.isLava === lava;
    }
    fluidHeight(x, y, z, lava) {
      let count = 0;
      let sum = 0;
      for (let j = 0; j < 4; j++) {
        const bx = x - (j & 1), bz = z - (j >> 1 & 1);
        if (this.fluidMatches(this.world.getState(bx, y + 1, bz), lava)) return 1;
        const s = this.world.getState(bx, y, bz);
        if (!this.fluidMatches(s, lava)) {
          const b = getBlock(s);
          const solid = b && b.boundingBox === "block" && b.id !== 0;
          if (!solid) {
            sum += 1;
            count++;
          }
        } else {
          const k = getFluidState(s).level;
          const pct = ((k >= 8 ? 0 : k) + 1) / 9;
          if (k >= 8 || k === 0) {
            sum += pct * 10;
            count += 10;
          }
          sum += pct;
          count++;
        }
      }
      return count ? 1 - sum / count : 0;
    }
    flowDecay(x, y, z, lava) {
      const s = this.world.getState(x, y, z);
      if (!this.fluidMatches(s, lava)) return -1;
      const l = getFluidState(s).level;
      return l >= 8 ? 0 : l;
    }
    flowDirection(x, y, z, lava) {
      let vx = 0, vz = 0;
      const i = this.flowDecay(x, y, z, lava);
      for (const [dx, dz] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        let j = this.flowDecay(x + dx, y, z + dz, lava);
        if (j < 0) {
          const s = this.world.getState(x + dx, y, z + dz);
          const b = getBlock(s);
          const blocksMovement = b && b.boundingBox === "block" && b.id !== 0;
          if (!blocksMovement) {
            j = this.flowDecay(x + dx, y - 1, z + dz, lava);
            if (j >= 0) {
              const k = j - (i - 8);
              vx += dx * k;
              vz += dz * k;
            }
          }
        } else {
          const k = j - i;
          vx += dx * k;
          vz += dz * k;
        }
      }
      if (vx === 0 && vz === 0) return -1e3;
      return Math.atan2(vz, vx) - Math.PI / 2;
    }
    renderFluid(state, fluid, x, y, z, buf, lx, ly, lz) {
      const lava = fluid.isLava;
      const w = this.world;
      const still = lava ? this.lavaStill : this.waterStill;
      const flow = lava ? this.lavaFlow : this.waterFlow;
      if (!still || !flow) return;
      const col = lava ? 16777215 : this.biomeBlend(x, y, z, (bio) => waterColor(bio));
      const cr = (col >> 16 & 255) / 255, cg = (col >> 8 & 255) / 255, cb = (col & 255) / 255;
      const up = w.getState(x, y + 1, z);
      const down = w.getState(x, y - 1, z);
      const sideStates = [w.getState(x, y, z - 1), w.getState(x, y, z + 1), w.getState(x - 1, y, z), w.getState(x + 1, y, z)];
      let h00 = this.fluidHeight(x, y, z, lava);
      let h01 = this.fluidHeight(x, y, z + 1, lava);
      let h11 = this.fluidHeight(x + 1, y, z + 1, lava);
      let h10 = this.fluidHeight(x + 1, y, z, lava);
      const height = Math.max(h00, h01, h11, h10);
      const renderTop = !this.fluidMatches(up, lava) && !coversFluidFace(state, 1, height);
      const renderBottom = !this.fluidMatches(down, lava) && !coversFluidFace(state, 0) && !coversFluidFace(down, 1);
      const sides = sideStates.map((s, i) => !this.fluidMatches(s, lava) && !coversFluidFace(state, i + 2, height) && !coversFluidFace(s, i + 2 ^ 1, height));
      if (!renderTop && !renderBottom && !sides.some((v) => v)) return;
      const U = (uv, t) => uv[0] + (uv[2] - uv[0]) * t / 16;
      const V = (uv, t) => uv[1] + (uv[3] - uv[1]) * t / 16;
      const light = (lx2, ly2, lz2) => {
        const a = w.getLight(lx2, ly2, lz2);
        return a;
      };
      const lt = Math.max(light(x, y, z) >> 4, light(x, y + 1, z) >> 4);
      const lb = Math.max(light(x, y, z) & 15, light(x, y + 1, z) & 15);
      const emitL = lava ? 15 : 0;
      const quad = (verts, shade, sky, blk) => {
        for (const v of verts) buf.push10(lx + v[0], ly + v[1], lz + v[2], v[3], v[4], cr * shade, cg * shade, cb * shade, sky, Math.max(blk, emitL));
        for (let k = 3; k >= 0; k--) {
          const v = verts[k];
          buf.push10(lx + v[0], ly + v[1], lz + v[2], v[3], v[4], cr * shade, cg * shade, cb * shade, sky, Math.max(blk, emitL));
        }
      };
      if (renderTop) {
        h00 -= 1e-3;
        h01 -= 1e-3;
        h11 -= 1e-3;
        h10 -= 1e-3;
        const dirA = this.flowDirection(x, y, z, lava);
        let uvs;
        if (dirA < -999) {
          uvs = [[U(still, 0), V(still, 0)], [U(still, 0), V(still, 16)], [U(still, 16), V(still, 16)], [U(still, 16), V(still, 0)]];
        } else {
          const s = Math.sin(dirA) * 0.25, c = Math.cos(dirA) * 0.25;
          uvs = [
            [U(flow, 8 + (-c - s) * 16), V(flow, 8 + (-c + s) * 16)],
            [U(flow, 8 + (-c + s) * 16), V(flow, 8 + (c + s) * 16)],
            [U(flow, 8 + (c + s) * 16), V(flow, 8 + (c - s) * 16)],
            [U(flow, 8 + (c - s) * 16), V(flow, 8 + (-c - s) * 16)]
          ];
        }
        quad([
          [0, h00, 0, uvs[0][0], uvs[0][1]],
          [0, h01, 1, uvs[1][0], uvs[1][1]],
          [1, h11, 1, uvs[2][0], uvs[2][1]],
          [1, h10, 0, uvs[3][0], uvs[3][1]]
        ], 1, lt, lb);
      }
      if (renderBottom) {
        const l = w.getLight(x, y - 1, z);
        quad([
          [0, 0, 1, U(still, 0), V(still, 16)],
          [0, 0, 0, U(still, 0), V(still, 0)],
          [1, 0, 0, U(still, 16), V(still, 0)],
          [1, 0, 1, U(still, 16), V(still, 16)]
        ], 0.5, l >> 4, l & 15);
      }
      const sideDefs = [
        [h00, h10, 0, 1, 1e-3, 1e-3, [0, 0, -1]],
        [h11, h01, 1, 0, 0.999, 0.999, [0, 0, 1]],
        [h01, h00, 1e-3, 1e-3, 1, 0, [-1, 0, 0]],
        [h10, h11, 0.999, 0.999, 0, 1, [1, 0, 0]]
      ];
      for (let j = 0; j < 4; j++) {
        if (!sides[j]) continue;
        const [f20, f21, d3, d4, d5, d6, o] = sideDefs[j];
        const u0 = U(flow, 0), u1 = U(flow, 8);
        const v0 = V(flow, (1 - f20) * 16 * 0.5), v1 = V(flow, (1 - f21) * 16 * 0.5), v2 = V(flow, 8);
        const l = w.getLight(x + o[0], y, z + o[2]);
        const shade = j < 2 ? 0.8 : 0.6;
        quad([
          [d3, f20, d5, u0, v0],
          [d4, f21, d6, u1, v1],
          [d4, 0, d6, u1, v2],
          [d3, 0, d5, u0, v2]
        ], shade, l >> 4, l & 15);
      }
    }
  };

  // js/render/mesh-service.js
  var MeshService = class {
    constructor(post) {
      this.post = post;
      this.mesher = null;
      this.pendingOptions = null;
    }
    handle(msg) {
      switch (msg.type) {
        case "init": {
          initBlocks(msg.blocksJson, msg.shapesJson);
          initBiomes(msg.biomesJson, msg.grass, msg.foliage);
          const store = new ModelStore(msg.models, msg.blockstates, new AtlasLookup(msg.atlas));
          const opts = this.mesher ? this.mesher.options : this.pendingOptions;
          this.mesher = new Mesher(null, store);
          if (opts) Object.assign(this.mesher.options, opts);
          this.post({ type: "ready" });
          break;
        }
        case "options":
          if (this.mesher) {
            Object.assign(this.mesher.options, msg.options);
            this.mesher.stateModels.clear();
          } else this.pendingOptions = msg.options;
          break;
        case "build": {
          if (!this.mesher) break;
          const sl = msg.slice;
          let res = null;
          const t0 = Date.now();
          try {
            res = this.mesher.buildSection(new SliceWorld(sl), sl.x, sl.y, sl.z, !!msg.lod);
          } catch (err) {
            console.error("mesh error", err);
          }
          const ms = Date.now() - t0;
          const head = { type: "built", x: sl.x, y: sl.y, z: sl.z, gen: msg.gen, token: msg.token, ms };
          if (!res) {
            this.post({ ...head, empty: true });
            break;
          }
          this.post({ ...head, ...res }, [res.solid.buffer, res.cutout.buffer, res.translucent.buffer]);
          break;
        }
        default:
          break;
      }
    }
  };

  // js/render/mesh-worker.js
  var service = new MeshService((msg, transfer) => self.postMessage(msg, transfer || []));
  self.onmessage = (e) => service.handle(e.data);
})();
