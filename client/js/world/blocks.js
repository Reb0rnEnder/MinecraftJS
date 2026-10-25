// Block registry for 1.13.2: block definitions are indexed by the flattened
// registry id, while chunk values are direct global block-state ids.
// Worker-safe (no DOM). Call initBlocks(blocksJson, shapesJson) once.

export const DIR = { DOWN: 0, UP: 1, NORTH: 2, SOUTH: 3, WEST: 4, EAST: 5 };
export const DIR_OFFSETS = [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]];
export const DIR_NAMES = ['down', 'up', 'north', 'south', 'west', 'east'];
export const OPPOSITE = [1, 0, 3, 2, 5, 4];

export const blocks = [];
export const blocksByName = {};
export const states = [];
export const stateById = states;

const STAIRS = (name) => name.endsWith('_stairs');

const SHULKER_BOXES = new Set(['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'light_gray',
  'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black'].map((c) => c + '_shulker_box'));

// Blocks with a full "block" bounding box that are NOT opaque cubes in vanilla
const NOT_OPAQUE = new Set([
  'glass', 'ice', 'chest', 'trapped_chest', 'ender_chest', 'cactus', 'cake', 'snow', 'farmland', 'enchanting_table',
  'end_portal_frame', 'brewing_stand', 'cauldron', 'hopper', 'anvil', 'daylight_detector', 'carpet', 'skull', 'flower_pot',
  'trapdoor', 'iron_trapdoor', 'ladder', 'piston_head', 'dragon_egg', 'cocoa', 'repeater', 'comparator', 'waterlily',
  'cobweb', 'end_portal', 'nether_portal', 'tripwire', 'tripwire_hook', 'vine', 'redstone_wire', 'piston', 'sticky_piston',
  'end_rod', 'chorus_plant', 'chorus_flower', 'grass_path', 'frosted_ice', 'structure_void', 'end_gateway', 'slime_block',
  'barrier', 'beacon', 'mob_spawner', 'redstone_torch', 'torch', 'fire', 'kelp', 'kelp_plant', 'seagrass', 'tall_seagrass',
  'dead_bush', 'dandelion', 'poppy', 'brown_mushroom', 'red_mushroom', 'sunflower', 'lilac', 'rose_bush', 'peony', 'tall_grass',
  'large_fern', 'turtle_egg', 'snow', 'white_bed', 'white_banner', 'white_wall_banner',
]);

// Clear glass uses binary texture alpha (cutout); stained glass needs blending.
const TRANSLUCENT = new Set(['water', 'lava', 'ice', 'frosted_ice', 'slime_block', 'nether_portal']);

// Blocks without a block model (rendered by special renderers or invisible)
const NO_MODEL = new Set([
  'air', 'water', 'lava', 'chest', 'trapped_chest', 'ender_chest', 'sign', 'wall_sign', 'skull', 'white_bed',
  'white_banner', 'white_wall_banner', 'piston_head', 'moving_piston', 'barrier', 'end_portal', 'structure_void',
  'end_gateway', ...SHULKER_BOXES,
]);

const FENCES = (name) => name.endsWith('_fence');
const FENCE_GATES = (name) => name.endsWith('_fence_gate');
const PANES = (name) => name.endsWith('_pane') || name === 'iron_bars';
const DOORS = (name) => name.endsWith('_door');

// Blocks that can be replaced by placing a block into them
const REPLACEABLE = new Set(['air', 'water', 'lava', 'tall_grass', 'dead_bush', 'vine', 'fire', 'snow', 'kelp', 'kelp_plant',
  'seagrass', 'tall_seagrass', 'dandelion', 'poppy', 'blue_orchid', 'allium', 'azure_bluet', 'red_tulip', 'orange_tulip',
  'white_tulip', 'pink_tulip', 'oxeye_daisy', 'brown_mushroom', 'red_mushroom', 'sunflower', 'lilac', 'rose_bush', 'peony',
  'large_fern', 'wheat', 'carrots', 'potatoes', 'beetroots', 'sweet_berry_bush']);

let shapesData = null;

export function initBlocks(blocksJson, shapesJson) {
  shapesData = shapesJson;
  blocks.length = 0;
  states.length = 0;
  for (const k of Object.keys(blocksByName)) delete blocksByName[k];
  for (const b of blocksJson) {
    const name = b.name;
    const stairs = STAIRS(name);
    const def = {
      id: b.id,
      name,
      isAir: name === 'air' || name === 'cave_air' || name === 'void_air',
      displayName: b.displayName,
      hardness: b.hardness === null || b.hardness === undefined ? -1 : b.hardness,
      material: b.material || null,
      harvestTools: b.harvestTools || null,
      variations: b.variations || null,
      minStateId: b.minStateId === undefined ? b.id : b.minStateId,
      maxStateId: b.maxStateId === undefined ? b.id : b.maxStateId,
      defaultState: b.defaultState === undefined ? b.id : b.defaultState,
      stateProperties: b.states || [],
      emitLight: b.emitLight || 0,
      filterLight: b.filterLight === undefined ? 15 : b.filterLight,
      boundingBox: b.boundingBox,
      opaque: b.boundingBox === 'block' && !b.transparent && !NOT_OPAQUE.has(name) && b.id !== 0,
      translucent: TRANSLUCENT.has(name) || name.endsWith('_stained_glass') || name.endsWith('_stained_glass_pane'),
      hasModel: !NO_MODEL.has(name) && !name.endsWith('_bed') && !name.endsWith('_banner') && !name.endsWith('_wall_banner') &&
        !name.endsWith('_skull') && !name.endsWith('_wall_skull') && !name.endsWith('_head') && !name.endsWith('_wall_head') &&
        !name.endsWith('_shulker_box') && name !== 'conduit' &&
        name !== 'bubble_column' && name !== 'void_air' && name !== 'cave_air',
      isStairs: stairs,
      isFence: FENCES(name),
      isFenceGate: FENCE_GATES(name),
      isPane: PANES(name),
      isWall: name === 'cobblestone_wall',
      isDoor: DOORS(name),
      isLiquid: name === 'water' || name === 'lava' || name === 'bubble_column',
      isWater: name === 'water' || name === 'bubble_column',
      isLava: name === 'lava',
      replaceable: REPLACEABLE.has(name) || (b.material === 'plant' && b.boundingBox === 'empty' && !/sapling|wheat|carrots|potatoes|stem|wart|flower|mushroom/.test(name)),
      slipperiness: name === 'blue_ice' ? 0.989 : name === 'ice' || name === 'packed_ice' || name === 'frosted_ice' ? 0.98 : name === 'slime_block' ? 0.8 : 0.6,
      shapes: shapesJson ? shapesJson.blocks[name] : null,
      // AO: opaque full cubes darken neighbours
      aoLight: 0,
    };
    def.aoLight = def.opaque ? 0.2 : 1.0;
    // Vanilla: light-blocking blocks that aren't full cubes still count as "normal cube" for AO
    blocks[b.id] = def;
    blocksByName[name] = def;
    for (let state = def.minStateId; state <= def.maxStateId; state++) {
      states[state] = { id: state, blockId: b.id, name, properties: decodeProperties(def, state) };
    }
  }
  // Light opacity as in vanilla 1.8 (the data file disagrees for several blocks)
  for (const def of Object.values(blocksByName)) {
    // Non-solid plants, crops, portals, piston heads...: Block default opacity is 0 unless it is an opaque cube
    if (!def.opaque && def.boundingBox === 'empty' && !def.isLiquid) def.filterLight = 0;
  }
  for (const b of Object.values(blocksByName)) if (b.name.endsWith('_leaves') || b.name === 'cobweb') b.filterLight = 1;
  for (const n of ['water', 'bubble_column', 'ice']) if (blocksByName[n]) blocksByName[n].filterLight = 3;
  // Slabs, stairs and farmland block light completely in 1.8 but render with their neighbours' brightness
  for (const b of Object.values(blocksByName)) {
    if (b.name.endsWith('_slab') || b.isStairs || b.name === 'farmland') { b.filterLight = 15; b.useNeighborBrightness = true; }
  }
  if(blocksByName.grass_path)blocksByName.grass_path.useNeighborBrightness=true;
}

function propertyValues(prop) {
  if (prop.type === 'bool') return ['true', 'false'];
  if (prop.type === 'int') return Array.from({ length: prop.num_values }, (_, i) => String(i));
  return prop.values || [];
}

function decodeProperties(def, state) {
  let index = state - def.minStateId;
  const props = {};
  for (let i = def.stateProperties.length - 1; i >= 0; i--) {
    const prop = def.stateProperties[i];
    const values = propertyValues(prop);
    const value = values.length ? values[index % values.length] : undefined;
    if (value !== undefined) props[prop.name] = value;
    index = values.length ? Math.floor(index / values.length) : index;
  }
  return props;
}

export function getBlockById(id) { return blocks[id] || blocks[0]; }
export function getBlock(state) { const s = states[state]; return s ? getBlockById(s.blockId) : blocks[0]; }
export function getStateProperties(state) { return states[state] ? states[state].properties : {}; }
export function getStateInfo(state) { return states[state] || states[0] || { id: 0, blockId: 0, name: 'air', properties: {} }; }
export function findState(name, properties = {}) {
  const b = blocksByName[name];
  if (!b) return 0;
  for (let state = b.minStateId; state <= b.maxStateId; state++) {
    const p = getStateProperties(state);
    let ok = true;
    for (const [key, value] of Object.entries(properties)) if (String(p[key]) !== String(value)) { ok = false; break; }
    if (ok) return state;
  }
  return b.defaultState;
}

// Static collision boxes (relative 0..1) for a state, ignoring neighbour-dependent shapes.
export function staticCollisionBoxes(state) {
  const b = getBlock(state);
  if (!b || !b.shapes && b.shapes !== 0) return [];
  let shapeId = b.shapes;
  if (Array.isArray(shapeId)) {
    const meta = Math.max(0, state - b.minStateId);
    shapeId = shapeId[meta] !== undefined ? shapeId[meta] : shapeId[0];
  }
  return shapesData.shapes[shapeId] || [];
}

export function isFullOpaque(state) {
  const b = getBlock(state);
  return !!(b && b.opaque);
}

// Undefined means the shape needs the live-neighbour resolver; null means no selectable volume.
export function jarSelectionBox(state) {
  const selection = shapesData?.selection, index = selection?.states[state];
  return typeof index === 'number' ? selection.boxes[index] : undefined;
}
