// ClientWaypointManager and the TrackedWaypoint render math used by the 26.3 locator bar.
// Ported from net.minecraft.client.waypoints.ClientWaypointManager and
// net.minecraft.world.waypoints.TrackedWaypoint (Vec3iWaypoint, ChunkWaypoint, AzimuthWaypoint).
const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

// Native assets/minecraft/waypoint_style/default.json and bowtie.json.
export const WAYPOINT_STYLES = Object.freeze({
  'minecraft:default': Object.freeze({nearDistance: 128, farDistance: 332, sprites: Object.freeze(['default_0', 'default_1', 'default_2', 'default_3'])}),
  'minecraft:bowtie': Object.freeze({nearDistance: 64, farDistance: 332, sprites: Object.freeze(['bowtie', 'default_0', 'default_1', 'default_2', 'default_3'])}),
});

function idKey(id) {
  if (id?.uuid) return ['u', String(id.uuid).replace(/-/g, '').toLowerCase()];
  return ['n', String(id?.name ?? '')];
}

function wrapDegrees(value) {
  value %= 360;
  if (value >= 180) value -= 360;
  if (value < -180) value += 360;
  return value;
}

function javaHash(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (Math.imul(31, hash) + value.charCodeAt(i)) | 0;
  return hash;
}

// ARGB.setBrightness(ARGB.color(255, hash), 0.9): keep the identity colour stable per waypoint.
function hashColor(id) {
  const hash = javaHash(id?.uuid ? String(id.uuid).replace(/-/g, '') : String(id?.name ?? ''));
  const red = Math.round(((hash >> 16) & 0xff) * 0.9);
  const green = Math.round(((hash >> 8) & 0xff) * 0.9);
  const blue = Math.round((hash & 0xff) * 0.9);
  return [red / 255, green / 255, blue / 255, 1];
}

export function waypointSprite(style, distance) {
  if (distance < style.nearDistance) return style.sprites[0];
  if (distance >= style.farDistance) return style.sprites[style.sprites.length - 1];
  if (style.sprites.length === 1) return style.sprites[0];
  if (style.sprites.length === 3) return style.sprites[1];
  const index = Math.floor(1 + (distance - style.nearDistance) / (style.farDistance - style.nearDistance) * (style.sprites.length - 2));
  return style.sprites[Math.max(1, Math.min(style.sprites.length - 1, index))];
}

export class WaypointManager26_3 {
  constructor(game) {
    this.game = game;
    this.waypoints = new Map();
  }

  reset() {
    this.waypoints.clear();
  }

  hasWaypoints() {
    return this.waypoints.size > 0;
  }

  accept(packet) {
    const key = idKey(packet.id).join(':');
    if (packet.operation === 1) { this.waypoints.delete(key); return; } // UNTRACK
    if (packet.operation === 2) { // UPDATE keeps the original icon and only merges contents
      const existing = this.waypoints.get(key);
      if (existing && existing.type === packet.type) existing.position = packet.position;
      return;
    }
    this.waypoints.set(key, packet); // TRACK
  }

  // ClientWaypointManager.forEachWaypoint sorts by distance, farthest first.
  ordered(fromEntity) {
    return [...this.waypoints.values()]
      .map(waypoint => ({waypoint, distance: this.distanceSquared(waypoint, fromEntity)}))
      .sort((a, b) => b.distance - a.distance)
      .map(entry => entry.waypoint);
  }

  worldPosition(waypoint, cameraY) {
    if (waypoint.type === 1) {
      const position = waypoint.position || {x: 0, y: 0, z: 0};
      const uuid = waypoint.id?.uuid;
      if (uuid) {
        let entity = null;
        for (const candidate of this.game.entities?.all?.() || []) if (candidate.uuid === uuid) { entity = candidate; break; }
        if (entity) {
          const manhattan = Math.abs(Math.floor(entity.x) - position.x) + Math.abs(Math.floor(entity.y) - position.y) + Math.abs(Math.floor(entity.z) - position.z);
          if (manhattan <= 3) return {x: entity.x, y: entity.y + (entity.eyeHeight ?? 1.62), z: entity.z};
        }
      }
      return {x: position.x + 0.5, y: position.y + 0.5, z: position.z + 0.5};
    }
    if (waypoint.type === 2) {
      const chunk = waypoint.position || {x: 0, z: 0};
      return {x: chunk.x * 16 + 8.5, y: Math.floor(cameraY) + 0.5, z: chunk.z * 16 + 8.5};
    }
    return null;
  }

  distanceSquared(waypoint, fromEntity) {
    if (waypoint.type === 1) {
      const p = waypoint.position || {x: 0, y: 0, z: 0};
      const dx = fromEntity.x - (p.x + 0.5), dy = fromEntity.y - (p.y + 0.5), dz = fromEntity.z - (p.z + 0.5);
      return dx * dx + dy * dy + dz * dz;
    }
    if (waypoint.type === 2) {
      const p = waypoint.position || {x: 0, z: 0};
      const dx = fromEntity.x - (p.x * 16 + 8.5), dz = fromEntity.z - (p.z * 16 + 8.5);
      return dx * dx + dz * dz;
    }
    return Infinity;
  }

  // The locator bar's horizontal angle, in degrees, positive to the right.
  angleToCamera(waypoint, camera, forward) {
    if (waypoint.type === 3) return wrapDegrees((waypoint.position?.angle ?? 0) * DEG);
    const target = this.worldPosition(waypoint, camera.y);
    if (!target) return Infinity;
    const dx = target.x - camera.x, dz = target.z - camera.z;
    const length = Math.hypot(dx, dz);
    if (!length) return 0;
    const tx = dx / length, tz = dz / length;
    const fx = forward[0], fz = forward[2];
    const fLength = Math.hypot(fx, fz) || 1;
    const rightX = -fz / fLength, rightZ = fx / fLength;
    return Math.atan2(tx * rightX + tz * rightZ, tx * (fx / fLength) + tz * (fz / fLength)) * DEG;
  }

  // TrackedWaypoint.PitchDirection: NONE / DOWN / UP.
  pitchDirection(waypoint, camera, forward, fov) {
    if (waypoint.type !== 1) {
      // Chunk/azimuth arrows follow the projected horizon: looking up pushes it down.
      const horizon = Math.atan2(forward[1], Math.hypot(forward[0], forward[2])) * DEG;
      if (horizon > fov / 2) return 'DOWN';
      if (horizon < -fov / 2) return 'UP';
      return 'NONE';
    }
    const target = this.worldPosition(waypoint, camera.y);
    if (!target) return 'NONE';
    const horizontal = Math.hypot(target.x - camera.x, target.z - camera.z);
    const elevation = Math.atan2(target.y - camera.y, horizontal) * DEG;
    const cameraPitch = Math.asin(Math.max(-1, Math.min(1, forward[1]))) * DEG;
    const difference = elevation - cameraPitch;
    if (difference < -fov / 2) return 'DOWN';
    if (difference > fov / 2) return 'UP';
    return 'NONE';
  }

  color(waypoint) {
    const color = waypoint.icon?.color;
    if (color) return [color.red / 255, color.green / 255, color.blue / 255, 1];
    return hashColor(waypoint.id);
  }
}
