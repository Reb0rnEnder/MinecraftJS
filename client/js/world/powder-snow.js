// Native 1.17.1 PowderSnowBlock / EntityCollisionContext. No context means no
// collision (selection/camera rays and ordinary unequipped bodies may pass).
const FULL = [[0, 0, 0, 1, 1, 1]], FALLING = [[0, 0, 0, 1, Math.fround(.9), 1]];
export function powderSnowCollision(y, mover) {
  if (!mover || mover.spectator) return [];
  if (mover.fallDistance > 2.5) return FALLING;
  const feet = typeof mover.bb === 'function' ? mover.bb()[1] : mover.y;
  if (mover.entityName === 'falling_block' || mover.canWalkPowderSnow && !mover.sneaking && feet > y + 1 - 1e-5) return FULL;
  return [];
}
export const frozenFraction = ticks => Math.min(140, Math.max(0, ticks || 0)) / 140;
export const FREEZING_UUID = '1eaf83ff-7207-4596-b37a-d7a07b3ec4ce';
