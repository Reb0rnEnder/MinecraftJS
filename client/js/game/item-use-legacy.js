// Item.onItemUse / onItemRightClick as this version's client runs them (ItemHoe, ItemSpade, ItemFlintAndSteel,
// ItemFireball, ItemBucket, ItemGlassBottle): what the client sets itself and, from 1.9, the player's own sounds
// (World.playSound with the player excluded by the server). 1.8.9's client-side World.playSoundEffect is a no-op.
import { blocks } from '../world/blocks.js';

export const NATIVE = {"sounds": true, "path": true};
const blockOf = (st) => blocks[st >> 4];
const meta = (st) => st & 15;
const state = (n, m = 0) => { const b = Object.values(blocks).find((x) => x && x.name === n); return b ? (b.id << 4) | m : 0; };
const isAir = (b) => !b || b.id === 0;
// Numeric item ids (identical in 1.8.9 and 1.12.2)
const ITEM = { 290: 'wooden_hoe', 291: 'stone_hoe', 292: 'iron_hoe', 293: 'diamond_hoe', 294: 'golden_hoe', 256: 'iron_shovel', 269: 'wooden_shovel', 273: 'stone_shovel', 277: 'diamond_shovel', 284: 'golden_shovel',
  259: 'flint_and_steel', 385: 'fire_charge', 325: 'bucket', 326: 'water_bucket', 327: 'lava_bucket', 374: 'glass_bottle' };
const itemName = (id) => ITEM[id] ?? (typeof id === 'string' ? id : null);
const FACE = [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]];

export function useOnLegacy(game, held, t, random = Math.random) {
  const w = game.world, item = itemName(held.id), st = w.getState(t.x, t.y, t.z), b = blockOf(st);
  if (!b) return null;
  const sound = (id, pos, pitch = 1) => { if (NATIVE.sounds) game.sound?.play(id, pos.x + 0.5, pos.y + 0.5, pos.z + 0.5, 1, pitch, { category: 'block' }); };
  const airAbove = () => isAir(blockOf(w.getState(t.x, t.y + 1, t.z)));
  if (/_hoe$/.test(item)) {
    // grass (and 1.9+ grass_path) and plain dirt till to farmland, coarse dirt to dirt; podzol does not till
    if (t.face === 0 || !airAbove()) return { success: false };
    if (b.name === 'grass' || NATIVE.path && b.name === 'grass_path' || b.name === 'dirt' && (meta(st) === 0 || meta(st) === 1)) { sound('item.hoe.till', t); return { success: true }; }
    return { success: false };
  }
  if (NATIVE.path && /_shovel$/.test(item)) {
    // ItemSpade (1.9+): grass under air flattens to grass_path on the server
    if (t.face !== 0 && b.name === 'grass' && airAbove()) { sound('item.shovel.flatten', t); return { success: true }; }
    return { success: false };
  }
  if (item === 'flint_and_steel' || item === 'fire_charge') {
    // Fire on any air in front of the clicked face, set by the client too; flint and steel always succeeds
    const d = FACE[t.face] || [0, 1, 0], p = { x: t.x + d[0], y: t.y + d[1], z: t.z + d[2] };
    if (isAir(blockOf(w.getState(p.x, p.y, p.z)))) {
      if (item === 'flint_and_steel') sound('item.flintandsteel.use', p, random() * 0.4 + 0.8);
      w.setState(p.x, p.y, p.z, state('fire'));
      if (item === 'fire_charge' && game.gameMode !== 1) held.count--;
    }
    return { success: true };
  }
  return null;
}

// Liquid-aware ray (rayTrace with stopOnLiquid): only source blocks (level 0) count
function povHit(game, liquids) {
  const eye = game.eyePosition(1), look = game.lookVector(1), range = game.interaction?.reach?.() ?? 4.5, w = game.world;
  const block = w.raycast(eye[0], eye[1], eye[2], look[0], look[1], look[2], range);
  const limit = block ? block.dist : range;
  if (liquids) for (let d = 0; d <= limit; d += 0.05) {
    const x = Math.floor(eye[0] + look[0] * d), y = Math.floor(eye[1] + look[1] * d), z = Math.floor(eye[2] + look[2] * d), s = w.getState(x, y, z), b = blockOf(s);
    if (b && (b.isWater || b.isLava) && meta(s) === 0) {
      const above = blockOf(w.getState(x, y + 1, z)), surface = y + (above && (above.isWater || above.isLava) ? 1 : 8 / 9);
      if (eye[1] + look[1] * d <= surface) return { x, y, z, face: 1, state: s, liquid: b };
    }
  }
  return block ? { ...block, liquid: null } : null;
}

export function useLegacy(game, held) {
  const item = itemName(held.id), w = game.world;
  if (!/^(water_|lava_)?bucket$/.test(item) && item !== 'glass_bottle') return null;
  const hit = povHit(game, item === 'bucket' || item === 'glass_bottle');
  if (!hit) return { success: false };
  const p = game.player, sound = (id, x, y, z, category) => { if (NATIVE.sounds) game.sound?.play(id, x, y, z, 1, 1, { category }); };
  if (item === 'glass_bottle') {
    if (!hit.liquid?.isWater) return { success: false };
    sound('item.bottle.fill', p.x, p.y, p.z, 'neutral');
    return { success: true, result: 'potion' };
  }
  if (item === 'bucket') {
    if (!hit.liquid) return { success: false };
    w.setState(hit.x, hit.y, hit.z, 0);
    sound(hit.liquid.isLava ? 'item.bucket.fill_lava' : 'item.bucket.fill', p.x, p.y, p.z, 'player');
    return { success: true, result: hit.liquid.isLava ? 'lava_bucket' : 'water_bucket' };
  }
  // tryPlaceContainedLiquid: air or a non-solid block in front of the clicked face gets the flowing source
  const d = FACE[hit.face] || [0, 1, 0], pos = { x: hit.x + d[0], y: hit.y + d[1], z: hit.z + d[2] }, target = blockOf(w.getState(pos.x, pos.y, pos.z));
  if (!(isAir(target) || target.boundingBox === 'empty' || target.isLiquid)) return { success: false };
  const water = item === 'water_bucket';
  if (water && game.dimension === -1) return { success: true, result: 'bucket' }; // vaporizes (server effects)
  w.setState(pos.x, pos.y, pos.z, state(water ? 'flowing_water' : 'flowing_lava'));
  sound(water ? 'item.bucket.empty' : 'item.bucket.empty_lava', pos.x + 0.5, pos.y + 0.5, pos.z + 0.5, 'block');
  return { success: true, result: 'bucket' };
}
