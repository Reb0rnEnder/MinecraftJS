// Maps (block id, metadata, neighbourhood) -> vanilla 1.12.2 blockstate file + property map.
// This re-implements each block's getStateFromMeta + getActualState + state mapper naming.
import { blocks, blocksByName } from './blocks.js';

const COLORS = ['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'silver',
  'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black'];
const WOODS = ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak'];
const HORIZ = ['south', 'west', 'north', 'east']; // EnumFacing.getHorizontal(i)
const FACING6 = ['down', 'up', 'north', 'south', 'west', 'east']; // EnumFacing.getFront(i)
const SLAB_STONE = ['stone', 'sandstone', 'wood_old', 'cobblestone', 'brick', 'stone_brick', 'nether_brick', 'quartz'];
const FLOWERS_RED = ['poppy', 'blue_orchid', 'allium', 'houstonia', 'red_tulip', 'orange_tulip', 'white_tulip', 'pink_tulip', 'oxeye_daisy'];
const DOUBLE_PLANTS = ['sunflower', 'syringa', 'double_grass', 'double_fern', 'double_rose', 'paeonia'];
const RAIL_SHAPES = ['north_south', 'east_west', 'ascending_east', 'ascending_west', 'ascending_north', 'ascending_south',
  'south_east', 'south_west', 'north_west', 'north_east'];
const MUSHROOM = ['all_inside', 'north_west', 'north', 'north_east', 'west', 'center', 'east', 'south_west', 'south',
  'south_east', 'stem', 'all_inside', 'all_inside', 'all_inside', 'all_outside', 'all_stem'];
const TORCH_FACING = [null, 'east', 'west', 'south', 'north', 'up'];
const OFFS = { north: [0, 0, -1], south: [0, 0, 1], west: [-1, 0, 0], east: [1, 0, 0], up: [0, 1, 0], down: [0, -1, 0] };
const ROT_CCW = { north: 'west', west: 'south', south: 'east', east: 'north' };
const OPP = { north: 'south', south: 'north', east: 'west', west: 'east', up: 'down', down: 'up' };

const axisOf = (f) => (f === 'north' || f === 'south' ? 'z' : f === 'east' || f === 'west' ? 'x' : 'y');
const bName = (state) => { const b = blocks[state >> 4]; return b ? b.name : 'air'; };
const bDef = (state) => blocks[state >> 4] || blocks[0];

function logAxis(m) { return ['y', 'x', 'z', 'none'][(m >> 2) & 3]; }

function stairsFacing(meta) { return ['east', 'west', 'south', 'north'][meta & 3]; }
function stairsHalf(meta) { return meta & 4 ? 'top' : 'bottom'; }

function stairsShape(get, x, y, z, meta) {
  const facing = stairsFacing(meta);
  const half = stairsHalf(meta);
  const isStairsSameHalf = (s) => bDef(s).isStairs && stairsHalf(s & 15) === half;
  const differentStairs = (dir) => {
    const o = OFFS[dir];
    const s = get(x + o[0], y + o[1], z + o[2]);
    return !bDef(s).isStairs || stairsFacing(s & 15) !== facing || stairsHalf(s & 15) !== half;
  };
  let o = OFFS[facing];
  const back = get(x + o[0], y, z + o[2]);
  if (isStairsSameHalf(back)) {
    const f1 = stairsFacing(back & 15);
    if (axisOf(f1) !== axisOf(facing) && differentStairs(OPP[f1])) {
      return f1 === ROT_CCW[facing] ? 'outer_left' : 'outer_right';
    }
  }
  o = OFFS[OPP[facing]];
  const front = get(x + o[0], y, z + o[2]);
  if (isStairsSameHalf(front)) {
    const f2 = stairsFacing(front & 15);
    if (axisOf(f2) !== axisOf(facing) && differentStairs(f2)) {
      return f2 === ROT_CCW[facing] ? 'inner_left' : 'inner_right';
    }
  }
  return 'straight';
}
export { stairsShape, stairsFacing, stairsHalf };

function isOpaqueFull(state) { return bDef(state).opaque; }

function fenceConnects(selfName, s) {
  const d = bDef(s);
  if (d.id === 0) return false;
  if (d.isFence) {
    const selfNether = selfName === 'nether_brick_fence';
    return (d.name === 'nether_brick_fence') === selfNether;
  }
  if (d.isFenceGate) return true;
  return d.opaque && d.name !== 'pumpkin' && d.name !== 'lit_pumpkin' && d.name !== 'melon_block';
}

function paneConnects(s) {
  const d = bDef(s);
  return d.opaque || d.isPane || d.name === 'glass' || d.name === 'stained_glass';
}

function wallConnects(s) {
  const d = bDef(s);
  if (d.id === 0) return false;
  if (d.isWall || d.isFenceGate) return true;
  return d.opaque && d.name !== 'pumpkin' && d.name !== 'lit_pumpkin' && d.name !== 'melon_block';
}

function connections(get, x, y, z, fn) {
  return {
    north: fn(get(x, y, z - 1)), south: fn(get(x, y, z + 1)),
    west: fn(get(x - 1, y, z)), east: fn(get(x + 1, y, z)),
  };
}

function redstoneConn(get, x, y, z, dir) {
  const o = OFFS[dir];
  const nx = x + o[0], nz = z + o[2];
  const side = get(nx, y, nz);
  const canConnect = (s, d) => {
    const n = bName(s);
    if (n === 'redstone_wire') return true;
    if (n === 'unpowered_repeater' || n === 'powered_repeater') {
      const f = HORIZ[s & 3];
      return f === d || f === OPP[d];
    }
    const def = bDef(s);
    if (/redstone_torch|lever|button|pressure_plate|redstone_block|daylight_detector|comparator|tripwire_hook|detector_rail|trapped_chest|observer/.test(n)) return true;
    return false;
  };
  const above = get(x, y + 1, z);
  if (!isOpaqueFull(above) && isOpaqueFull(side) && bName(get(nx, y + 1, nz)) === 'redstone_wire') return 'up';
  if (canConnect(side, dir)) return 'side';
  if (!isOpaqueFull(side) && bName(get(nx, y - 1, nz)) === 'redstone_wire') return 'side';
  return 'none';
}

function doorProps(get, x, y, z, meta) {
  let lower, upper;
  if (meta & 8) { upper = meta; lower = get(x, y - 1, z) & 15; } else { lower = meta; upper = get(x, y + 1, z) & 15; }
  const facing = ['east', 'south', 'west', 'north'][lower & 3];
  return {
    facing,
    open: !!(lower & 4),
    hinge: upper & 1 ? 'right' : 'left',
    powered: !!(upper & 2),
    half: meta & 8 ? 'upper' : 'lower',
  };
}
export { doorProps };

// Returns { file, props, variant? } or null if the block has no model
export function resolveState(state, get, x, y, z) {
  const id = state >> 4;
  const m = state & 15;
  const b = blocks[id];
  if (!b || !b.hasModel) return null;
  const n = b.name;
  const P = {};
  const R = (file, props = P, variant) => ({ file, props, variant });

  switch (n) {
    case 'stone': return R(['stone', 'granite', 'smooth_granite', 'diorite', 'smooth_diorite', 'andesite', 'smooth_andesite'][m] || 'stone');
    case 'grass': case 'mycelium': {
      const up = bName(get(x, y + 1, z));
      P.snowy = up === 'snow' || up === 'snow_layer';
      return R(n);
    }
    case 'dirt': {
      if (m === 2) { const up = bName(get(x, y + 1, z)); P.snowy = up === 'snow' || up === 'snow_layer'; return R('podzol'); }
      return R(m === 1 ? 'coarse_dirt' : 'dirt');
    }
    case 'planks': return R((WOODS[m] || 'oak') + '_planks');
    case 'sapling': P.stage = (m >> 3) & 1; return R((WOODS[m & 7] || 'oak') + '_sapling');
    case 'sand': return R(m === 1 ? 'red_sand' : 'sand');
    case 'log': P.axis = logAxis(m); return R(WOODS[m & 3] + '_log');
    case 'log2': P.axis = logAxis(m); return R(WOODS[4 + (m & 1)] + '_log');
    case 'leaves': return R(WOODS[m & 3] + '_leaves');
    case 'leaves2': return R(WOODS[4 + (m & 1)] + '_leaves');
    case 'sponge': P.wet = !!(m & 1); return R('sponge');
    case 'dispenser': case 'dropper': P.facing = FACING6[m & 7] || 'north'; P.triggered = !!(m & 8); return R(n);
    case 'sandstone': return R(['sandstone', 'chiseled_sandstone', 'smooth_sandstone'][m] || 'sandstone');
    case 'red_sandstone': return R(['red_sandstone', 'chiseled_red_sandstone', 'smooth_red_sandstone'][m] || 'red_sandstone');
    case 'bed': return null; // TileEntityBedRenderer (1.12 beds are coloured block entities)
    case 'golden_rail': case 'detector_rail': case 'activator_rail':
      P.shape = RAIL_SHAPES[m & 7] || 'north_south'; P.powered = !!(m & 8); return R(n);
    case 'rail': P.shape = RAIL_SHAPES[m] || 'north_south'; return R('rail');
    case 'piston': case 'sticky_piston': P.facing = FACING6[m & 7] || 'up'; P.extended = !!(m & 8); return R(n);
    case 'piston_head': P.facing = FACING6[m & 7] || 'up'; P.type = m & 8 ? 'sticky' : 'normal'; P.short = false; return R('piston_head');
    case 'web': return R('web');
    case 'tallgrass': return R(['dead_bush', 'tall_grass', 'fern'][m] || 'tall_grass');
    case 'deadbush': return R('dead_bush');
    case 'wool': return R(COLORS[m] + '_wool');
    case 'carpet': return R(COLORS[m] + '_carpet');
    case 'stained_glass': return R(COLORS[m] + '_stained_glass');
    case 'stained_hardened_clay': return R(COLORS[m] + '_stained_hardened_clay');
    case 'stained_glass_pane': Object.assign(P, connections(get, x, y, z, paneConnects)); return R(COLORS[m] + '_stained_glass_pane');
    case 'glass_pane': case 'iron_bars': Object.assign(P, connections(get, x, y, z, paneConnects)); return R(n);
    case 'yellow_flower': return R('dandelion');
    case 'red_flower': return R(FLOWERS_RED[m] || 'poppy');
    case 'double_stone_slab': return R(SLAB_STONE[m & 7] + '_double_slab', P, m & 8 ? 'all' : 'normal');
    case 'stone_slab': P.half = m & 8 ? 'top' : 'bottom'; return R(SLAB_STONE[m & 7] + '_slab');
    case 'double_stone_slab2': return R('red_sandstone_double_slab', P, m & 8 ? 'all' : 'normal');
    case 'stone_slab2': P.half = m & 8 ? 'top' : 'bottom'; return R('red_sandstone_slab');
    case 'double_wooden_slab': return R((WOODS[m & 7] || 'oak') + '_double_slab');
    case 'wooden_slab': P.half = m & 8 ? 'top' : 'bottom'; return R((WOODS[m & 7] || 'oak') + '_slab');
    case 'torch': case 'redstone_torch': case 'unlit_redstone_torch':
      P.facing = TORCH_FACING[m] || 'up'; return R(n);
    case 'fire': {
      const below = get(x, y - 1, z);
      const flam = (s) => { const d = bDef(s); return d.material === 'wood' || d.material === 'leaves' || d.material === 'wool' || d.name === 'tnt' || d.name === 'bookshelf' || d.name === 'vine' || d.name === 'tallgrass' || d.name === 'coal_block' || d.name === 'hay_block' || d.name === 'carpet'; };
      if (isOpaqueFull(below) || flam(below)) {
        P.north = P.south = P.east = P.west = false;
      } else {
        Object.assign(P, connections(get, x, y, z, flam));
      }
      P.upper = 0; P.alt = ((x + y + z) & 1) === 1; P.flip = ((x ^ z) & 1) === 1;
      return R('fire');
    }
    case 'redstone_wire':
      P.north = redstoneConn(get, x, y, z, 'north'); P.south = redstoneConn(get, x, y, z, 'south');
      P.east = redstoneConn(get, x, y, z, 'east'); P.west = redstoneConn(get, x, y, z, 'west');
      P.power = m;
      return R('redstone_wire');
    case 'wheat': case 'carrots': case 'potatoes': P.age = m & 7; return R(n);
    case 'nether_wart': P.age = m & 3; return R('nether_wart');
    case 'farmland': P.moisture = m & 7; return R('farmland');
    case 'furnace': case 'lit_furnace': case 'ladder':
      P.facing = FACING6[m] && m >= 2 ? FACING6[m] : 'north'; return R(n);
    case 'wall_sign': case 'standing_sign': return null;
    case 'lever': {
      P.facing = ['down_x', 'east', 'west', 'south', 'north', 'up_z', 'up_x', 'down_z'][m & 7];
      P.powered = !!(m & 8); return R('lever');
    }
    case 'stone_pressure_plate': case 'wooden_pressure_plate': P.powered = !!(m & 1); return R(n);
    case 'light_weighted_pressure_plate': case 'heavy_weighted_pressure_plate': P.power = m; return R(n);
    case 'stone_button': case 'wooden_button':
      // BlockButton.getStateFromMeta: 0 down, 1 east, 2 west, 3 south, 4 north, 5+ up
      P.facing = ['down', 'east', 'west', 'south', 'north', 'up', 'up', 'up'][m & 7]; P.powered = !!(m & 8); return R(n);
    case 'snow_layer': P.layers = (m & 7) + 1; return R('snow_layer');
    case 'cactus': case 'reeds': return R(n);
    case 'pumpkin': case 'lit_pumpkin': P.facing = HORIZ[m & 3]; return R(n);
    case 'portal': P.axis = (m & 3) === 2 ? 'z' : 'x'; return R('portal');
    case 'cake': P.bites = m & 7; return R('cake');
    case 'unpowered_repeater': case 'powered_repeater':
      P.facing = HORIZ[m & 3]; P.delay = (m >> 2) + 1; P.locked = false; return R(n);
    case 'unpowered_comparator': case 'powered_comparator':
      P.facing = HORIZ[m & 3]; P.mode = m & 4 ? 'subtract' : 'compare'; P.powered = !!(m & 8); return R(n);
    case 'trapdoor': case 'iron_trapdoor':
      P.facing = ['north', 'south', 'west', 'east'][m & 3]; P.open = !!(m & 4); P.half = m & 8 ? 'top' : 'bottom';
      return R(n);
    case 'monster_egg':
      return R(['stone_monster_egg', 'cobblestone_monster_egg', 'stone_brick_monster_egg', 'mossy_brick_monster_egg',
        'cracked_brick_monster_egg', 'chiseled_brick_monster_egg'][m] || 'stone_monster_egg');
    case 'stonebrick': return R(['stonebrick', 'mossy_stonebrick', 'cracked_stonebrick', 'chiseled_stonebrick'][m] || 'stonebrick');
    case 'brown_mushroom_block': case 'red_mushroom_block': P.variant = MUSHROOM[m]; return R(n);
    case 'pumpkin_stem': case 'melon_stem': {
      P.age = m & 7;
      P.facing = 'up';
      if (P.age === 7) {
        const fruit = n === 'pumpkin_stem' ? 'pumpkin' : 'melon_block';
        for (const d of ['north', 'south', 'west', 'east']) {
          const o = OFFS[d];
          if (bName(get(x + o[0], y, z + o[2])) === fruit) { P.facing = d; break; }
        }
      }
      return R(n);
    }
    case 'vine': {
      P.south = !!(m & 1); P.west = !!(m & 2); P.north = !!(m & 4); P.east = !!(m & 8);
      P.up = isOpaqueFull(get(x, y + 1, z));
      return R('vine');
    }
    case 'cocoa': P.facing = HORIZ[m & 3]; P.age = (m >> 2) & 3; return R('cocoa');
    case 'brewing_stand': P.has_bottle_0 = !!(m & 1); P.has_bottle_1 = !!(m & 2); P.has_bottle_2 = !!(m & 4); return R(n);
    case 'cauldron': P.level = m & 3; return R('cauldron');
    case 'end_portal_frame': P.facing = HORIZ[m & 3]; P.eye = !!(m & 4); return R(n);
    case 'tripwire_hook': {
      P.facing = HORIZ[m & 3]; P.attached = !!(m & 4); P.powered = !!(m & 8);
      P.suspended = !isOpaqueFull(get(x, y - 1, z));
      return R(n);
    }
    case 'tripwire': {
      P.powered = !!(m & 1); P.suspended = !!(m & 2); P.attached = !!(m & 4); P.disarmed = !!(m & 8);
      Object.assign(P, connections(get, x, y, z, (s) => { const nn = bName(s); return nn === 'tripwire' || nn === 'tripwire_hook'; }));
      return R(n);
    }
    case 'cobblestone_wall': {
      Object.assign(P, connections(get, x, y, z, wallConnects));
      P.up = !((P.north && P.south && !P.east && !P.west) || (P.east && P.west && !P.north && !P.south)) || bDef(get(x, y + 1, z)).id !== 0;
      return R(m === 1 ? 'mossy_cobblestone_wall' : 'cobblestone_wall');
    }
    case 'flower_pot': P.contents = 'empty'; return R('flower_pot');
    case 'anvil': P.facing = HORIZ[m & 3]; P.damage = (m >> 2) & 3; return R('anvil');
    case 'daylight_detector': case 'daylight_detector_inverted': P.power = m; return R(n);
    case 'hopper': P.facing = FACING6[m & 7] || 'down'; P.enabled = !(m & 8); return R('hopper');
    case 'quartz_block':
      if (m === 1) return R('chiseled_quartz_block');
      if (m >= 2) { P.axis = ['y', 'x', 'z'][Math.min(m - 2, 2)]; return R('quartz_column'); }
      return R('quartz_block');
    case 'prismarine': return R(['prismarine', 'prismarine_bricks', 'dark_prismarine'][m] || 'prismarine');
    case 'hay_block': P.axis = ['y', 'x', 'z', 'y'][(m >> 2) & 3]; return R('hay_block');
    case 'double_plant': {
      let lowerMeta = m;
      if (m & 8) lowerMeta = (get(x, y - 1, z) >> 4) === id ? get(x, y - 1, z) & 15 : 0;
      P.half = m & 8 ? 'upper' : 'lower';
      return R(DOUBLE_PLANTS[lowerMeta & 7] || 'double_grass');
    }
    case 'end_portal': return null;
    case 'command_block': case 'repeating_command_block': case 'chain_command_block':
      P.facing = FACING6[m & 7] || 'down'; P.conditional = !!(m & 8); return R(n);
    case 'beacon': case 'mob_spawner': case 'dragon_egg': return R(n);
    // 1.9 - 1.12 blocks
    case 'concrete': return R(COLORS[m] + '_concrete');
    case 'concrete_powder': return R(COLORS[m] + '_concrete_powder');
    case 'bone_block': case 'purpur_pillar': P.axis = ['y', 'x', 'z', 'y'][(m >> 2) & 3]; return R(n);
    case 'purpur_slab': P.half = m & 8 ? 'top' : 'bottom'; P.variant = 'default'; return R(n);
    case 'purpur_double_slab': P.variant = 'default'; return R(n);
    case 'end_rod': P.facing = FACING6[m & 7] || 'up'; return R(n);
    case 'observer': P.facing = FACING6[m & 7] || 'down'; P.powered = !!(m & 8); return R(n);
    case 'chorus_flower': P.age = m & 7; return R(n);
    case 'chorus_plant': {
      // BlockChorusPlant.getActualState: connects to chorus plants / flowers, and end stone below
      const c = (s) => { const nn = bName(s); return nn === 'chorus_plant' || nn === 'chorus_flower'; };
      Object.assign(P, connections(get, x, y, z, c));
      P.up = c(get(x, y + 1, z));
      const below = get(x, y - 1, z);
      P.down = c(below) || bName(below) === 'end_stone';
      return R(n);
    }
    case 'beetroots': case 'frosted_ice': P.age = m & 3; return R(n);
    case 'structure_block': P.mode = ['save', 'load', 'corner', 'data'][m & 3]; return R(n);
    case 'structure_void': case 'end_gateway': return null;
    default: break;
  }

  if (b.isStairs) {
    P.facing = stairsFacing(m); P.half = stairsHalf(m); P.shape = stairsShape(get, x, y, z, m);
    return R(n === 'stone_stairs' ? 'stone_stairs' : n);
  }
  if (b.isFence) {
    Object.assign(P, connections(get, x, y, z, (s) => fenceConnects(n, s)));
    return R(n === 'fence' ? 'fence' : n);
  }
  if (b.isFenceGate) {
    P.facing = HORIZ[m & 3]; P.open = !!(m & 4);
    const f = P.facing;
    const side = f === 'north' || f === 'south' ? [[-1, 0], [1, 0]] : [[0, -1], [0, 1]];
    P.in_wall = side.some(([dx, dz]) => bDef(get(x + dx, y, z + dz)).isWall);
    return R(n);
  }
  if (b.isDoor) {
    Object.assign(P, doorProps(get, x, y, z, m));
    return R(n);
  }
  // model files call light gray "silver" (the registry name is light_gray_glazed_terracotta)
  if (n.endsWith('_glazed_terracotta')) { P.facing = HORIZ[m & 3]; return R(n.replace(/^light_gray_/, 'silver_')); }
  if (n.endsWith('_shulker_box')) return null; // TileEntityShulkerBoxRenderer
  // Simple blocks whose blockstate file has the registry name
  return R(n);
}

// Item id/damage -> item model name (models/item/<name>.json)
const ITEM_VARIANTS = {
  stone: ['stone', 'granite', 'granite_smooth', 'diorite', 'diorite_smooth', 'andesite', 'andesite_smooth'],
  dirt: ['dirt', 'coarse_dirt', 'podzol'],
  planks: WOODS.map((w) => w + '_planks'),
  sapling: WOODS.map((w) => w + '_sapling'),
  sand: ['sand', 'red_sand'],
  log: WOODS.slice(0, 4).map((w) => w + '_log'),
  log2: ['acacia_log', 'dark_oak_log'],
  leaves: WOODS.slice(0, 4).map((w) => w + '_leaves'),
  leaves2: ['acacia_leaves', 'dark_oak_leaves'],
  sponge: ['sponge', 'sponge_wet'],
  sandstone: ['sandstone', 'chiseled_sandstone', 'smooth_sandstone'],
  red_sandstone: ['red_sandstone', 'chiseled_red_sandstone', 'smooth_red_sandstone'],
  tallgrass: ['dead_bush', 'tall_grass', 'fern'],
  wool: COLORS.map((c) => c + '_wool'),
  carpet: COLORS.map((c) => c + '_carpet'),
  stained_glass: COLORS.map((c) => c + '_stained_glass'),
  stained_glass_pane: COLORS.map((c) => c + '_stained_glass_pane'),
  stained_hardened_clay: COLORS.map((c) => c + '_stained_hardened_clay'),
  red_flower: FLOWERS_RED,
  yellow_flower: ['dandelion'],
  stone_slab: ['stone_slab', 'sandstone_slab', 'oak_slab', 'cobblestone_slab', 'brick_slab', 'stone_brick_slab', 'nether_brick_slab', 'quartz_slab'],
  stone_slab2: ['red_sandstone_slab'],
  wooden_slab: WOODS.map((w) => w + '_slab'),
  monster_egg: ['stone_monster_egg', 'cobblestone_monster_egg', 'stone_brick_monster_egg', 'mossy_brick_monster_egg', 'cracked_brick_monster_egg', 'chiseled_brick_monster_egg'],
  stonebrick: ['stonebrick', 'mossy_stonebrick', 'cracked_stonebrick', 'chiseled_stonebrick'],
  cobblestone_wall: ['cobblestone_wall', 'mossy_cobblestone_wall'],
  quartz_block: ['quartz_block', 'chiseled_quartz_block', 'quartz_column'],
  anvil: ['anvil_intact', 'anvil_slightly_damaged', 'anvil_very_damaged'],
  prismarine: ['prismarine', 'prismarine_bricks', 'dark_prismarine'],
  double_plant: DOUBLE_PLANTS,
  dye: ['dye_black', 'dye_red', 'dye_green', 'dye_brown', 'dye_blue', 'dye_purple', 'dye_cyan', 'dye_silver', 'dye_gray',
    'dye_pink', 'dye_lime', 'dye_yellow', 'dye_light_blue', 'dye_magenta', 'dye_orange', 'dye_white'],
  coal: ['coal', 'charcoal'],
  golden_apple: ['golden_apple', 'golden_apple'],
  fish: ['cod', 'salmon', 'clownfish', 'pufferfish'],
  cooked_fish: ['cooked_cod', 'cooked_salmon'],
  concrete: COLORS.map((c) => c + '_concrete'),
  concrete_powder: COLORS.map((c) => c + '_concrete_powder'),
  skull: ['skull_skeleton', 'skull_wither', 'skull_zombie', 'skull_char', 'skull_creeper', 'skull_dragon'],
};

const ITEM_RENAME = {
  yellow_flower: 'dandelion', deadbush: 'dead_bush', web: 'web', golden_rail: 'golden_rail', noteblock: 'noteblock',
  brick_block: 'brick_block', mossy_cobblestone: 'mossy_cobblestone', wooden_door: 'oak_door', fence: 'oak_fence',
  fence_gate: 'oak_fence_gate', stone_stairs: 'stone_stairs', oak_stairs: 'oak_stairs', reeds: 'reeds',
  waterlily: 'waterlily', melon_block: 'melon_block', speckled_melon: 'speckled_melon', netherbrick: 'netherbrick',
  potion: 'bottle_drinkable', filled_map: 'filled_map', fireworks: 'fireworks', firework_charge: 'firework_charge',
  repeater: 'repeater', comparator: 'comparator', record_13: 'record_13', golden_carrot: 'golden_carrot',
  cooked_porkchop: 'cooked_porkchop', mob_spawner: 'mob_spawner', red_mushroom_block: 'red_mushroom_block',
  brown_mushroom_block: 'brown_mushroom_block', end_portal_frame: 'end_portal_frame', trapdoor: 'trapdoor',
  daylight_detector: 'daylight_detector', hardened_clay: 'hardened_clay', slime: 'slime', lit_pumpkin: 'lit_pumpkin',
  boat: 'oak_boat', splash_potion: 'bottle_splash', lingering_potion: 'bottle_lingering', totem_of_undying: 'totem',
  light_gray_shulker_box: 'silver_shulker_box', light_gray_glazed_terracotta: 'silver_glazed_terracotta',
};

export function itemModelName(itemName, damage) {
  const v = ITEM_VARIANTS[itemName];
  if (v) return v[damage] || v[0];
  if (itemName === 'potion') return 'bottle_drinkable'; // 1.9+: splash and lingering potions are their own items
  if (itemName === 'bow') return 'bow';
  return ITEM_RENAME[itemName] || itemName;
}

export { COLORS, WOODS, HORIZ, FACING6 };
