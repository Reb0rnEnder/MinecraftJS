// Fluid state is separate from block identity in 1.13. A waterlogged stair is
// still a stair for models/collision, with source water occupying the same cell.
import { getBlock, getStateProperties } from './blocks.js';

const waterPlants = new Set(['seagrass', 'tall_seagrass', 'kelp', 'kelp_plant']);
const makeStates = (lava) => Array.from({ length: 16 }, (_, level) => Object.freeze({
  isWater: !lava, isLava: lava, level, source: level === 0,
  height: (8 - (level >= 8 ? 0 : level)) / 9,
}));
const WATER = makeStates(false), LAVA = makeStates(true);

export function getFluidState(state) {
  const block = getBlock(state);
  if (!block) return null;
  const props = getStateProperties(state);
  if (block.isLiquid) return (block.isLava ? LAVA : WATER)[Number(props.level || 0)];
  return props.waterlogged === 'true' || waterPlants.has(block.name) ? WATER[0] : null;
}

// Full-height fluid when the cell above contains the same fluid, otherwise its
// level's surface height. Used consistently by camera, HUD, physics and boats.
export function fluidHeightAt(world, x, y, z) {
  const fluid = getFluidState(world.getState(x, y, z));
  if (!fluid) return 0;
  const above = getFluidState(world.getState(x, y + 1, z));
  return above && above.isLava === fluid.isLava ? 1 : fluid.height;
}

export function isPointInFluid(world, x, y, z, lava = false) {
  const bx = Math.floor(x), by = Math.floor(y), bz = Math.floor(z);
  const fluid = getFluidState(world.getState(bx, by, bz));
  return !!fluid && fluid.isLava === lava && y < by + fluidHeightAt(world, bx, by, bz);
}
