// Block registry for 1.12.2: physical/visual properties per block id.
// Worker-safe (no DOM). Call initBlocks(blocksJson, shapesJson) once.

export const DIR = { DOWN: 0, UP: 1, NORTH: 2, SOUTH: 3, WEST: 4, EAST: 5 };
export const DIR_OFFSETS = [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]];
export const DIR_NAMES = ['down', 'up', 'north', 'south', 'west', 'east'];
export const OPPOSITE = [1, 0, 3, 2, 5, 4];

export const blocks = new Array(256).fill(null);
export const blocksByName = {};

const STAIRS = new Set(['oak_stairs', 'stone_stairs', 'brick_stairs', 'stone_brick_stairs', 'nether_brick_stairs',
  'sandstone_stairs', 'spruce_stairs', 'birch_stairs', 'jungle_stairs', 'quartz_stairs', 'acacia_stairs',
  'dark_oak_stairs', 'red_sandstone_stairs', 'purpur_stairs']);

const SHULKER_BOXES = ['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'silver', 'cyan', 'purple',
  'blue', 'brown', 'green', 'red', 'black'].map((c) => c + '_shulker_box');

// Blocks with a full "block" bounding box that are NOT opaque cubes in vanilla
const NOT_OPAQUE = new Set([
  'leaves', 'leaves2', 'glass', 'stained_glass', 'ice', 'stone_slab', 'wooden_slab', 'stone_slab2',
  'chest', 'trapped_chest', 'ender_chest', 'wooden_door', 'iron_door', 'spruce_door', 'birch_door', 'jungle_door',
  'acacia_door', 'dark_oak_door', 'fence', 'nether_brick_fence', 'spruce_fence', 'birch_fence', 'jungle_fence',
  'dark_oak_fence', 'acacia_fence', 'fence_gate', 'spruce_fence_gate', 'birch_fence_gate', 'jungle_fence_gate',
  'dark_oak_fence_gate', 'acacia_fence_gate', 'glass_pane', 'stained_glass_pane', 'iron_bars', 'cobblestone_wall',
  'slime', 'barrier', 'beacon', 'mob_spawner', 'cactus', 'cake', 'bed', 'snow_layer', 'farmland',
  'enchanting_table', 'end_portal_frame', 'brewing_stand', 'cauldron', 'hopper', 'anvil', 'daylight_detector',
  'daylight_detector_inverted', 'carpet', 'skull', 'flower_pot', 'trapdoor', 'iron_trapdoor', 'ladder', 'piston_head',
  'dragon_egg', 'cocoa', 'unpowered_repeater', 'powered_repeater', 'unpowered_comparator', 'powered_comparator',
  'waterlily', 'web', 'end_portal', 'portal', 'tripwire', 'tripwire_hook', 'vine', 'redstone_wire',
  'piston', 'sticky_piston',
  // 1.9 - 1.12
  'purpur_slab', 'end_rod', 'chorus_plant', 'chorus_flower', 'grass_path', 'frosted_ice', 'structure_void', 'end_gateway',
  ...SHULKER_BOXES,
  ...STAIRS,
]);

const TRANSLUCENT = new Set(['water', 'flowing_water', 'ice', 'frosted_ice', 'stained_glass', 'stained_glass_pane', 'slime', 'portal']);

// Blocks without a block model (rendered by special renderers or invisible)
const NO_MODEL = new Set([
  'air', 'water', 'flowing_water', 'lava', 'flowing_lava', 'chest', 'trapped_chest', 'ender_chest',
  'standing_sign', 'wall_sign', 'skull', 'standing_banner', 'wall_banner', 'piston_extension', 'barrier', 'end_portal',
  'bed', 'structure_void', 'end_gateway', ...SHULKER_BOXES,
]);

const FENCES = new Set(['fence', 'nether_brick_fence', 'spruce_fence', 'birch_fence', 'jungle_fence', 'dark_oak_fence', 'acacia_fence']);
const FENCE_GATES = new Set(['fence_gate', 'spruce_fence_gate', 'birch_fence_gate', 'jungle_fence_gate', 'dark_oak_fence_gate', 'acacia_fence_gate']);
const PANES = new Set(['glass_pane', 'stained_glass_pane', 'iron_bars']);
const DOORS = new Set(['wooden_door', 'iron_door', 'spruce_door', 'birch_door', 'jungle_door', 'acacia_door', 'dark_oak_door']);

// Blocks that can be replaced by placing a block into them
const REPLACEABLE = new Set(['air', 'water', 'flowing_water', 'lava', 'flowing_lava', 'tallgrass', 'deadbush', 'vine',
  'fire', 'snow_layer', 'double_plant']);

let shapesData = null;

export function initBlocks(blocksJson, shapesJson) {
  shapesData = shapesJson;
  for (const b of blocksJson) {
    const name = b.name;
    const def = {
      id: b.id,
      name,
      displayName: b.displayName,
      hardness: b.hardness === null || b.hardness === undefined ? -1 : b.hardness,
      material: b.material || null,
      harvestTools: b.harvestTools || null,
      variations: b.variations || null,
      emitLight: b.emitLight || 0,
      filterLight: b.filterLight === undefined ? 15 : b.filterLight,
      boundingBox: b.boundingBox,
      opaque: b.boundingBox === 'block' && !NOT_OPAQUE.has(name) && b.id !== 0,
      translucent: TRANSLUCENT.has(name),
      hasModel: !NO_MODEL.has(name),
      isStairs: STAIRS.has(name),
      isFence: FENCES.has(name),
      isFenceGate: FENCE_GATES.has(name),
      isPane: PANES.has(name),
      isWall: name === 'cobblestone_wall',
      isDoor: DOORS.has(name),
      isLiquid: name === 'water' || name === 'flowing_water' || name === 'lava' || name === 'flowing_lava',
      isWater: name === 'water' || name === 'flowing_water',
      isLava: name === 'lava' || name === 'flowing_lava',
      replaceable: REPLACEABLE.has(name) || (b.material === 'plant' && b.boundingBox === 'empty' && name !== 'reeds' && name !== 'cactus' && name !== 'waterlily' && !/sapling|wheat|carrots|potatoes|stem|wart|flower|mushroom/.test(name)),
      slipperiness: name === 'ice' || name === 'packed_ice' || name === 'frosted_ice' ? 0.98 : name === 'slime' ? 0.8 : 0.6,
      shapes: shapesJson ? shapesJson.blocks[name] : null,
      // AO: opaque full cubes darken neighbours
      aoLight: 0,
    };
    def.aoLight = def.opaque ? 0.2 : 1.0;
    // Vanilla: light-blocking blocks that aren't full cubes still count as "normal cube" for AO
    blocks[b.id] = def;
    blocksByName[name] = def;
  }
  // Light opacity as in vanilla 1.8 (the data file disagrees for several blocks)
  for (const def of Object.values(blocksByName)) {
    // Non-solid plants, crops, portals, piston heads...: Block default opacity is 0 unless it is an opaque cube
    if (!def.opaque && def.boundingBox === 'empty' && !def.isLiquid) def.filterLight = 0;
  }
  for (const n of ['leaves', 'leaves2', 'web']) if (blocksByName[n]) blocksByName[n].filterLight = 1;
  for (const n of ['water', 'flowing_water', 'ice']) if (blocksByName[n]) blocksByName[n].filterLight = 3;
  // Slabs, stairs and farmland block light completely in 1.8 but render with their neighbours' brightness
  for (const n of ['stone_slab', 'wooden_slab', 'stone_slab2', 'farmland', ...STAIRS]) {
    if (blocksByName[n]) { blocksByName[n].filterLight = 15; blocksByName[n].useNeighborBrightness = true; }
  }
}

export function getBlock(id) { return blocks[id] || blocks[0]; }

// Static collision boxes (relative 0..1) for a state, ignoring neighbour-dependent shapes.
export function staticCollisionBoxes(id, meta) {
  const b = blocks[id];
  if (!b || !b.shapes && b.shapes !== 0) return [];
  let shapeId = b.shapes;
  if (Array.isArray(shapeId)) shapeId = shapeId[meta] !== undefined ? shapeId[meta] : shapeId[0];
  return shapesData.shapes[shapeId] || [];
}

export function isFullOpaque(state) {
  const b = blocks[state >> 4];
  return !!(b && b.opaque);
}

// Undefined means the shape needs the live-neighbour resolver; null means no selectable volume.
export function jarSelectionBox(state) {
  const selection = shapesData?.selection, index = selection?.states[state];
  return typeof index === 'number' ? selection.boxes[index] : undefined;
}
