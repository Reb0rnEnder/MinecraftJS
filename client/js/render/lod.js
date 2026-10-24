// Distances are world blocks. Old saved chunk values are read only for migration.
export function lodDistance(settings) {
  const value = settings.lodDistance ?? (settings.lodChunks === undefined ? 128 : settings.lodChunks * 16);
  return Number.isFinite(value) ? Math.max(0, value) : 128;
}

// Distance to the nearest point of a section: altitude and diagonal distance count.
// A four-block hysteresis band prevents repeated rebuilds around the boundary.
export function sectionLod(settings, camera, cx, sy, cz, previous = false) {
  const distance = lodDistance(settings);
  if (distance === 0) return false;
  const dx = Math.max(cx * 16 - camera[0], 0, camera[0] - (cx + 1) * 16);
  const dy = Math.max(sy * 16 - camera[1], 0, camera[1] - (sy + 1) * 16);
  const dz = Math.max(cz * 16 - camera[2], 0, camera[2] - (cz + 1) * 16);
  const cutoff = Math.max(0, distance + (previous ? -4 : 4));
  return dx * dx + dy * dy + dz * dz > cutoff * cutoff;
}

export function poseInterval(settings, distanceSquared) {
  const distance = lodDistance(settings);
  return distance <= 0 || distanceSquared <= distance * distance ? 1
    : distanceSquared <= 4 * distance * distance ? 2 : 4;
}
