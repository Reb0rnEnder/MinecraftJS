// ScaffoldingBlock.getCollisionShape and EntityCollisionContext.isAbove, native 1.14.4.
const STABLE = [[0, .875, 0, 1, 1, 1], [0, 0, 0, .125, 1, .125], [.875, 0, 0, 1, 1, .125], [0, 0, .875, .125, 1, 1], [.875, 0, .875, 1, 1, 1]];
const BOTTOM = [[0, 0, 0, 1, .125, 1]];
export function scaffoldingCollision(properties, y, mover) {
  const feet = mover ? mover.bb()[1] : Infinity;
  if (feet > y + 1 - 1e-5 && !mover?.sneaking) return STABLE;
  if (Number(properties.distance) !== 0 && properties.bottom === 'true' && feet > y - 1e-5) return BOTTOM;
  return [];
}
