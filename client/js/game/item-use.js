// Item.useOn / Item.use as this version's client runs them: the local player's sounds and level events (the
// server excludes that player) and the states the client itself sets. NATIVE comes from this version's AxeItem,
// ShovelItem, HoeItem, FlintAndSteelItem, HoneycombItem, WeatheringCopper, BucketItem and BottleItem.
import { getBlock, getStateProperties, findState } from '../world/blocks.js';
import { getFluidState, fluidHeightAt } from '../world/fluids.js';
import { rayBox } from '../world/world.js';

export const NATIVE = {"strip": ["oak_log", "oak_wood", "spruce_log", "spruce_wood", "birch_log", "birch_wood", "jungle_log", "jungle_wood", "acacia_log", "acacia_wood", "dark_oak_log", "dark_oak_wood"], "predictAxe": false, "copper": [], "flatten": ["grass_block"], "dowse": true, "till": {"grass_block": true, "grass_path": true, "dirt": true, "coarse_dirt": true}, "campfire": true, "candles": false, "fireFirst": true, "soulFire": false, "powderSnow": false};
const name = (n) => String(n || '').replace(/^minecraft:/, '');
export const STRIPPABLES = Object.fromEntries(NATIVE.strip.map((n) => [n, 'stripped_' + n]));
export const PREVIOUS_COPPER = {}, WAXABLES = {};
for (const [base, suffix] of NATIVE.copper) {
  const chain = [base, 'exposed_' + suffix, 'weathered_' + suffix, 'oxidized_' + suffix];
  for (let i = 1; i < 4; i++) PREVIOUS_COPPER[chain[i]] = chain[i - 1];
  for (const n of chain) WAXABLES[n] = 'waxed_' + n;
}
export const WAX_OFF = Object.fromEntries(Object.entries(WAXABLES).map(([a, b]) => [b, a]));
const isAir = (b) => !b || b.id === 0 || /^(cave_|void_)?air$/.test(b.name);
function canLightCampfire(n, p) { return NATIVE.campfire && /^(soul_)?campfire$/.test(n) && p.lit === 'false' && p.waterlogged !== 'true'; }
function canLightCandle(n, p) {
  if (!NATIVE.candles) return false;
  if (n === 'candle' || /_candle$/.test(n)) return p.lit === 'false' && p.waterlogged !== 'true';
  return /candle_cake$/.test(n) && p.lit === 'false';
}

export function useOnNative(game, held, t, random = Math.random) {
  const w = game.world, item = name(game.items.name(held.id)), st = w.getState(t.x, t.y, t.z), b = getBlock(st);
  if (!b) return null;
  const n = b.name, props = getStateProperties(st);
  const sound = (id, pos, pitch = 1) => game.sound?.play(id, pos.x + 0.5, pos.y + 0.5, pos.z + 0.5, 1, pitch, { category: 'block' });
  const levelEvent = (effectId, pos) => game.particles?.onWorldEvent?.({ effectId, location: { x: pos.x, y: pos.y, z: pos.z }, data: 0 });
  const predict = (pos, state) => { if (state > 0) w.setState(pos.x, pos.y, pos.z, state); };
  const airAbove = () => isAir(getBlock(w.getState(t.x, t.y + 1, t.z)));
  if (item.endsWith('_axe')) {
    if (STRIPPABLES[n]) { sound('item.axe.strip', t); if (NATIVE.predictAxe) predict(t, findState(STRIPPABLES[n], { axis: props.axis })); return { success: true }; }
    if (PREVIOUS_COPPER[n]) { sound('item.axe.scrape', t); levelEvent(3005, t); predict(t, findState(PREVIOUS_COPPER[n], props)); return { success: true }; }
    if (WAX_OFF[n]) { sound('item.axe.wax_off', t); levelEvent(3004, t); predict(t, findState(WAX_OFF[n], props)); return { success: true }; }
    return { success: false };
  }
  if (item.endsWith('_shovel')) {
    if (t.face === 0) return { success: false };
    if (NATIVE.flatten.includes(n) && airAbove()) { sound('item.shovel.flatten', t); return { success: true }; }
    if (NATIVE.dowse && /^(soul_)?campfire$/.test(n) && props.lit === 'true') {
      const P = game.particles, signal = props.signal_fire === 'true', side = () => (random() < 0.5 ? 1 : -1);
      for (let i = 0; i < 20; i++) P?.campfireSmoke?.(t.x + 0.5 + random() / 3 * side(), t.y + random() + random(), t.z + 0.5 + random() / 3 * side(), signal);
      return { success: true };
    }
    return { success: false };
  }
  if (item.endsWith('_hoe')) {
    if (!(n in NATIVE.till)) return { success: false };
    if (NATIVE.till[n] && (t.face === 0 || !airAbove())) return { success: false };
    sound('item.hoe.till', t);
    return { success: true };
  }
  if (item === 'flint_and_steel' || item === 'fire_charge') {
    const charge = item === 'fire_charge';
    const play = (pos) => { if (!charge) sound('item.flintandsteel.use', pos, random() * 0.4 + 0.8); };
    const lit = () => { play(t); predict(t, findState(n, { ...props, lit: 'true' })); if (charge) held.count--; return { success: true }; };
    if (!NATIVE.fireFirst && (canLightCampfire(n, props) || canLightCandle(n, props))) return lit();
    const d = [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]][t.face] || [0, 1, 0];
    const p = { x: t.x + d[0], y: t.y + d[1], z: t.z + d[2] }, at = getBlock(w.getState(p.x, p.y, p.z)), below = getBlock(w.getState(p.x, p.y - 1, p.z));
    if (isAir(at) && below) {
      const soul = NATIVE.soulFire && (below.name === 'soul_sand' || below.name === 'soul_soil');
      if (soul || below.opaque && below.boundingBox === 'block') {
        play(p); predict(p, findState(soul ? 'soul_fire' : 'fire', {})); if (charge) held.count--;
        return { success: true };
      }
    }
    if (NATIVE.fireFirst && canLightCampfire(n, props)) return lit();
    return { success: false, fail: true };
  }
  if (item === 'honeycomb' && NATIVE.copper.length) {
    if (!WAXABLES[n]) return null;
    predict(t, findState(WAXABLES[n], props)); levelEvent(3003, t); held.count--;
    return { success: true };
  }
  return null;
}

// Item.getPlayerPOVHitResult with fluid sources (empty buckets, bottles) or without
export function povHit(game, sources) {
  const eye = game.eyePosition(1), look = game.lookVector(1), range = game.interaction?.reach?.() ?? 4.5, w = game.world;
  const block = w.raycast(eye[0], eye[1], eye[2], look[0], look[1], look[2], range);
  let best = block ? { ...block, fluid: null } : null;
  const limit = block ? block.dist : range;
  if (sources) for (let d = 0; d <= limit + 1; d += 0.05) {
    const x = Math.floor(eye[0] + look[0] * d), y = Math.floor(eye[1] + look[1] * d), z = Math.floor(eye[2] + look[2] * d);
    const fluid = getFluidState(w.getState(x, y, z));
    if (!fluid?.source) continue;
    const h = fluidHeightAt(w, x, y, z), r = rayBox(eye[0], eye[1], eye[2], look[0], look[1], look[2], x, y, z, x + 1, y + h, z + 1);
    if (!r || r.t > limit) continue;
    best = { x, y, z, face: r.face, dist: r.t, state: w.getState(x, y, z), fluid };
    break;
  }
  return best;
}

const FACE = [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]];
export function useNative(game, held) {
  const item = name(game.items.name(held.id)), w = game.world;
  const bucket = /^(water_|lava_)?bucket$/.test(item) ? item : null;
  if (!bucket && item !== 'glass_bottle') return null;
  const hit = povHit(game, bucket === 'bucket' || item === 'glass_bottle');
  if (!hit) return { success: false };
  const st = w.getState(hit.x, hit.y, hit.z), b = getBlock(st), props = getStateProperties(st), p = game.player;
  const sound = (id, x, y, z, category = 'block') => game.sound?.play(id, x, y, z, 1, 1, { category });
  if (item === 'glass_bottle') {
    if (!hit.fluid || hit.fluid.isLava) return { success: false };
    sound('item.bottle.fill', p.x, p.y, p.z, 'neutral');
    return { success: true, result: 'potion' };
  }
  if (bucket === 'bucket') {
    if (NATIVE.powderSnow && b.name === 'powder_snow') { w.setState(hit.x, hit.y, hit.z, findState('air')); sound('item.bucket.fill_powder_snow', p.x, p.y, p.z, 'player'); return { success: true, result: 'powder_snow_bucket' }; }
    if (!hit.fluid) return { success: false };
    if (b.isLiquid) w.setState(hit.x, hit.y, hit.z, findState('air'));
    else if (props.waterlogged === 'true') w.setState(hit.x, hit.y, hit.z, findState(b.name, { ...props, waterlogged: 'false' }));
    else return { success: false };
    sound(hit.fluid.isLava ? 'item.bucket.fill_lava' : 'item.bucket.fill', p.x, p.y, p.z, 'player');
    return { success: true, result: hit.fluid.isLava ? 'lava_bucket' : 'water_bucket' };
  }
  const water = bucket === 'water_bucket';
  let pos = { x: hit.x, y: hit.y, z: hit.z };
  if (!(water && props.waterlogged === 'false')) { const d = FACE[hit.face] || [0, 1, 0]; pos = { x: hit.x + d[0], y: hit.y + d[1], z: hit.z + d[2] }; }
  const tst = w.getState(pos.x, pos.y, pos.z), target = getBlock(tst), tprops = getStateProperties(tst);
  if (water && game.dimension === -1) return { success: true, result: 'bucket' };
  if (water && tprops.waterlogged === 'false') w.setState(pos.x, pos.y, pos.z, findState(target.name, { ...tprops, waterlogged: 'true' }));
  else if (isAir(target) || target.isLiquid || target.replaceable) w.setState(pos.x, pos.y, pos.z, findState(water ? 'water' : 'lava', { level: 0 }));
  else return { success: false };
  sound(water ? 'item.bucket.empty' : 'item.bucket.empty_lava', pos.x + 0.5, pos.y + 0.5, pos.z + 0.5);
  return { success: true, result: 'bucket' };
}
