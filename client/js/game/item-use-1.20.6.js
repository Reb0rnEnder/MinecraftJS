// Item.useOn as it runs on the 1.20.6 client (MultiPlayerGameMode.performUseItemOn): the local player's own sounds
// and level events (the server excludes that player from its broadcast) and the block states the client
// predicts. Returns null when the item has no client-side useOn here, else { success }.
import { getBlock, getStateProperties, findState } from '../world/blocks.js';
import { getFluidState, fluidHeightAt } from '../world/fluids.js';
import { rayBox } from '../world/world.js';

const WOODS = ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'cherry', 'dark_oak', 'mangrove'];
// AxeItem.STRIPPABLES
export const STRIPPABLES = Object.fromEntries([
  ...WOODS.flatMap((w) => [[w + '_log', 'stripped_' + w + '_log'], [w + '_wood', 'stripped_' + w + '_wood']]),
  ...['crimson', 'warped'].flatMap((w) => [[w + '_stem', 'stripped_' + w + '_stem'], [w + '_hyphae', 'stripped_' + w + '_hyphae']]),
  ['bamboo_block', 'stripped_bamboo_block'],
]);
// WeatheringCopper.NEXT_BY_BLOCK: each family's unaffected -> exposed -> weathered -> oxidized chain
const COPPER = [['copper_block', 'copper'], ['cut_copper', 'cut_copper'], ['chiseled_copper', 'chiseled_copper'], ['cut_copper_slab', 'cut_copper_slab'],
  ['cut_copper_stairs', 'cut_copper_stairs'], ['copper_door', 'copper_door'], ['copper_trapdoor', 'copper_trapdoor'], ['copper_grate', 'copper_grate'], ['copper_bulb', 'copper_bulb']];
export const PREVIOUS_COPPER = {}, WAXABLES = {};
for (const [base, suffix] of COPPER) {
  const chain = [base, 'exposed_' + suffix, 'weathered_' + suffix, 'oxidized_' + suffix];
  for (let i = 1; i < 4; i++) PREVIOUS_COPPER[chain[i]] = chain[i - 1];
  // HoneycombItem.WAXABLES: waxed_ prefix, with copper_block -> waxed_copper_block
  for (const name of chain) WAXABLES[name] = 'waxed_' + name;
}
export const WAX_OFF = Object.fromEntries(Object.entries(WAXABLES).map(([a, b]) => [b, a]));
// ShovelItem.FLATTENABLES / HoeItem.TILLABLES
const FLATTENABLES = new Set(['grass_block', 'dirt', 'podzol', 'coarse_dirt', 'mycelium', 'rooted_dirt']);
const TILLABLES = { grass_block: true, dirt_path: true, dirt: true, coarse_dirt: true, rooted_dirt: false }; // value: needs air above

const strip = (name) => String(name || '').replace(/^minecraft:/, '');
const isAir = (b) => !b || b.id === 0 || /^(cave_|void_)?air$/.test(b.name);
// CampfireBlock / CandleBlock / CandleCakeBlock.canLight
export function canLight(name, props) {
  if (/^(soul_)?campfire$/.test(name) || name === 'candle' || /_candle$/.test(name)) return props.lit === 'false' && props.waterlogged !== 'true';
  if (/candle_cake$/.test(name)) return props.lit === 'false';
  return false;
}

export function useOn766(game, held, t, random = Math.random) {
  const w = game.world, item = strip(game.items.name(held.id)), st = w.getState(t.x, t.y, t.z), b = getBlock(st);
  if (!b) return null;
  const name = b.name, props = getStateProperties(st);
  const center = (x, y, z) => [x + 0.5, y + 0.5, z + 0.5];
  const sound = (id, pos, pitch = 1) => game.sound?.play(id, ...center(pos.x, pos.y, pos.z), 1, pitch, { category: 'block' });
  const levelEvent = (effectId, pos) => game.particles?.onWorldEvent?.({ effectId, location: { x: pos.x, y: pos.y, z: pos.z }, data: 0 });
  const predict = (pos, state) => { if (state > 0) w.setState(pos.x, pos.y, pos.z, state); }; // findState gives 0 for unknown names
  const above = () => getBlock(w.getState(t.x, t.y + 1, t.z));

  if (item.endsWith('_axe')) {
    // AxeItem.evaluateNewBlockState: strip, else scrape oxidation, else remove wax
    if (STRIPPABLES[name]) { sound('item.axe.strip', t); predict(t, findState(STRIPPABLES[name], { axis: props.axis })); return { success: true }; }
    if (PREVIOUS_COPPER[name]) { sound('item.axe.scrape', t); levelEvent(3005, t); predict(t, findState(PREVIOUS_COPPER[name], props)); return { success: true }; }
    if (WAX_OFF[name]) { sound('item.axe.wax_off', t); levelEvent(3004, t); predict(t, findState(WAX_OFF[name], props)); return { success: true }; }
    return { success: false };
  }
  if (item.endsWith('_shovel')) {
    // ShovelItem.useOn: the path itself is set by the server; a lit campfire is dowsed with local smoke
    if (t.face === 0) return { success: false };
    if (FLATTENABLES.has(name) && isAir(above())) { sound('item.shovel.flatten', t); return { success: true }; }
    if (/^(soul_)?campfire$/.test(name) && props.lit === 'true') {
      const P = game.particles, signal = props.signal_fire === 'true', side = () => (random() < 0.5 ? 1 : -1);
      for (let i = 0; i < 20; i++) {
        P?.campfireSmoke?.(t.x + 0.5 + random() / 3 * side(), t.y + random() + random(), t.z + 0.5 + random() / 3 * side(), signal);
        P?.nativeParticle?.('smoke', t.x + 0.5 + random() / 4 * side(), t.y + 0.4, t.z + 0.5 + random() / 4 * side(), 0, 0.005, 0);
      }
      return { success: true };
    }
    return { success: false };
  }
  if (item.endsWith('_hoe')) {
    // HoeItem.useOn: only the till sound on the client
    if (!(name in TILLABLES)) return { success: false };
    if (TILLABLES[name] && (t.face === 0 || !isAir(above()))) return { success: false };
    sound('item.hoe.till', t);
    return { success: true };
  }
  if (item === 'flint_and_steel' || item === 'fire_charge') {
    const charge = item === 'fire_charge';
    const play = (pos) => { if (!charge) sound('item.flintandsteel.use', pos, random() * 0.4 + 0.8); }; // the charge's sound is server-only
    if (canLight(name, props)) { play(t); predict(t, findState(name, { ...props, lit: 'true' })); if (charge) held.count--; return { success: true }; }
    // BaseFireBlock.canBePlacedAt / getState: fire on a sturdy floor (soul fire on soul blocks); fire kept up only by
    // flammable neighbours is left to the server, which has the flammability table
    const d = [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]][t.face] || [0, 1, 0];
    const p = { x: t.x + d[0], y: t.y + d[1], z: t.z + d[2] }, at = getBlock(w.getState(p.x, p.y, p.z)), below = getBlock(w.getState(p.x, p.y - 1, p.z));
    if (isAir(at) && below) {
      const soul = below.name === 'soul_sand' || below.name === 'soul_soil';
      if (soul || below.opaque && below.boundingBox === 'block') {
        play(p); predict(p, findState(soul ? 'soul_fire' : 'fire', {}));
        if (charge) held.count--;
        return { success: true };
      }
    }
    return { success: false, fail: true }; // InteractionResult.FAIL: the click ends here
  }
  if (item === 'honeycomb') {
    // HoneycombItem.useOn: waxed state and level event 3003 (particles and the wax-on sound) for the local player
    if (!WAXABLES[name]) return null;
    predict(t, findState(WAXABLES[name], props)); levelEvent(3003, t); held.count--;
    return { success: true };
  }
  return null;
}

// Item.getPlayerPOVHitResult with ClipContext.Fluid.SOURCE_ONLY or NONE: the nearer of the block outline hit and,
// when sources count, the first fluid source cell whose fluid box the ray crosses
export function povHit(game, sources) {
  const eye = game.eyePosition(1), look = game.lookVector(1), range = game.interaction?.reach?.() ?? 4.5, w = game.world;
  const block = w.raycast(eye[0], eye[1], eye[2], look[0], look[1], look[2], range);
  let best = block ? { ...block, fluid: null } : null, limit = block ? block.dist : range;
  if (sources) {
    for (let d = 0; d <= limit + 1; d += 0.05) {
      const x = Math.floor(eye[0] + look[0] * d), y = Math.floor(eye[1] + look[1] * d), z = Math.floor(eye[2] + look[2] * d);
      const fluid = getFluidState(w.getState(x, y, z));
      if (!fluid?.source) continue;
      const h = fluidHeightAt(w, x, y, z), r = rayBox(eye[0], eye[1], eye[2], look[0], look[1], look[2], x, y, z, x + 1, y + h, z + 1);
      const dist = r && (typeof r === 'number' ? r : r.dist ?? r.t);
      if (dist === undefined || dist === null || dist > limit) continue;
      const face = r.face ?? (eye[1] > y + h ? 1 : 0);
      best = { x, y, z, face, dist, state: w.getState(x, y, z), fluid };
      break;
    }
  }
  return best;
}

const FACE = [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]];
// BucketItem.use / BottleItem.use on the client: pickups and placements predicted, the local sound played.
// Returns null when the item is not handled here, else { success, result } where result replaces the held stack.
export function use766(game, held) {
  const item = strip(game.items.name(held.id)), w = game.world;
  const bucket = /^(water_|lava_)?bucket$/.test(item) ? item : null;
  if (!bucket && item !== 'glass_bottle') return null;
  const hit = povHit(game, bucket === 'bucket' || item === 'glass_bottle');
  if (!hit) return { success: false };
  const st = w.getState(hit.x, hit.y, hit.z), b = getBlock(st), props = getStateProperties(st);
  const sound = (id, x, y, z, category = 'block') => game.sound?.play(id, x, y, z, 1, 1, { category });
  if (item === 'glass_bottle') {
    // BottleItem.use: filling from a water source plays the fill sound at the player
    if (!hit.fluid || hit.fluid.isLava) return { success: false };
    const p = game.player; sound('item.bottle.fill', p.x, p.y, p.z, 'neutral');
    return { success: true, result: 'potion' };
  }
  if (bucket === 'bucket') {
    // BucketPickup.pickupBlock: a fluid source becomes air, a waterlogged block dries; powder snow too
    if (b.name === 'powder_snow') { w.setState(hit.x, hit.y, hit.z, findState('air')); sound('item.bucket.fill_powder_snow', game.player.x, game.player.y, game.player.z, 'player'); return { success: true, result: 'powder_snow_bucket' }; }
    if (!hit.fluid) return { success: false };
    if (b.isLiquid) w.setState(hit.x, hit.y, hit.z, findState('air'));
    else if (props.waterlogged === 'true') w.setState(hit.x, hit.y, hit.z, findState(b.name, { ...props, waterlogged: 'false' }));
    else return { success: false }; // seagrass and kelp are not BucketPickup
    const p = game.player;
    sound(hit.fluid.isLava ? 'item.bucket.fill_lava' : 'item.bucket.fill', p.x, p.y, p.z, 'player');
    return { success: true, result: hit.fluid.isLava ? 'lava_bucket' : 'water_bucket' };
  }
  // BucketItem.emptyContents: water into a waterloggable block, else the fluid in front of the clicked face
  const water = bucket === 'water_bucket';
  let pos = { x: hit.x, y: hit.y, z: hit.z };
  if (!(water && props.waterlogged === 'false')) { const d = FACE[hit.face] || [0, 1, 0]; pos = { x: hit.x + d[0], y: hit.y + d[1], z: hit.z + d[2] }; }
  const target = getBlock(w.getState(pos.x, pos.y, pos.z)), targetProps = getStateProperties(w.getState(pos.x, pos.y, pos.z));
  if (water && game.dimension === -1) return { success: true, result: 'bucket' }; // ultrawarm: the server evaporates it
  if (water && targetProps.waterlogged === 'false') w.setState(pos.x, pos.y, pos.z, findState(target.name, { ...targetProps, waterlogged: 'true' }));
  else if (isAir(target) || target.isLiquid || target.replaceable) w.setState(pos.x, pos.y, pos.z, findState(water ? 'water' : 'lava', { level: 0 }));
  else return { success: false };
  sound(water ? 'item.bucket.empty' : 'item.bucket.empty_lava', pos.x + 0.5, pos.y + 0.5, pos.z + 0.5);
  return { success: true, result: 'bucket' };
}
