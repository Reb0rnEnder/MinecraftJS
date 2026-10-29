import { tr } from '../gui/i18n.js';
// Sound engine: vanilla sounds.json (+ resource packs), played through the platform audio interface.
import { getBlock, getBlockById, getStateProperties } from '../world/blocks.js';
import { platform } from '../platform/platform.js';

// SoundType (1.9+): [step, break, place, volume, pitch, hit, fall]
const T = (k, vol = 1, pitch = 1) => [`block.${k}.step`, `block.${k}.break`, `block.${k}.place`, vol, pitch, `block.${k}.hit`, `block.${k}.fall`];
const SOUND_TYPES = {
  stone: T('stone'), wood: T('wood'), gravel: T('gravel'), grass: T('grass'), metal: T('metal', 1, 1.5), glass: T('glass'),
  cloth: T('cloth'), sand: T('sand'), snow: T('snow'), ladder: T('ladder'), slime: T('slime'),
  anvil: ['block.anvil.step', 'block.anvil.break', 'block.anvil.place', 0.3, 1, 'block.anvil.hit', 'block.anvil.fall'],
};

function soundTypeOf(b) {
  if (!b) return SOUND_TYPES.stone;
  if (b.soundType) return b.soundType;
  const n = b.name;
  if (n === 'slime') return SOUND_TYPES.slime;
  if (n === 'anvil') return SOUND_TYPES.anvil;
  if (n === 'ladder') return SOUND_TYPES.ladder;
  if (/glass|^ice$|frosted_ice|packed_ice|glowstone|beacon|sea_lantern|redstone_lamp|portal|end_gateway/.test(n)) return SOUND_TYPES.glass;
  if (/wool|carpet|cactus|cake/.test(n)) return SOUND_TYPES.cloth;
  if (/^sand$|soul_sand|concrete_powder/.test(n)) return SOUND_TYPES.sand;
  if (/snow/.test(n)) return SOUND_TYPES.snow;
  if (/gravel|^dirt$|coarse_dirt|podzol|farmland|^clay$|grass_path/.test(n)) return SOUND_TYPES.gravel;
  if (/^grass$|^grass_block$|mycelium|leaves|sapling|tallgrass|deadbush|dead_bush|flower|vine|reeds|sugar_cane|waterlily|lily_pad|hay_block|^tnt$|sponge|double_plant|wheat|carrots|potatoes|beetroots|nether_wart$|stem|mushroom$|cocoa/.test(n)) return SOUND_TYPES.grass;
  if (/iron|gold_block|diamond_block|emerald_block|lapis_block|redstone_block|rail|hopper|cauldron|brewing_stand|command_block|structure_block/.test(n) && !/ore$/.test(n)) return SOUND_TYPES.metal;
  if (b.material === 'wood' || /pumpkin|melon_block|bookshelf|chest|crafting|jukebox|note_block|noteblock|sign|_door|fence|trapdoor|log|planks|chorus/.test(n)) return SOUND_TYPES.wood;
  if (b.material === 'plant' || b.material === 'leaves') return SOUND_TYPES.grass;
  if (b.material === 'dirt') return SOUND_TYPES.gravel;
  if (b.material === 'wool') return SOUND_TYPES.cloth;
  return SOUND_TYPES.stone;
}

// Canonical identities, not native wire IDs or internal renderer family numbers.
const E = (k) => [`entity.${k}.hurt`, `entity.${k}.death`];
const SOUND_ALIASES = { trader_llama: 'llama', cave_spider: 'spider', giant: 'hostile', mooshroom: 'cow', pufferfish: 'puffer_fish' };
const HOSTILE_TYPES = new Set(('elder_guardian wither_skeleton stray husk zombie_villager evoker vex vindicator illusioner '
  + 'pillager ravager creeper skeleton spider giant zombie slime ghast zombie_pigman enderman cave_spider silverfish blaze magma_cube '
  + 'ender_dragon wither witch endermite guardian shulker drowned phantom').split(' '));

// SPacketSoundEffect category ids
const CATEGORIES = ['master', 'music', 'record', 'weather', 'block', 'hostile', 'neutral', 'player', 'ambient', 'voice'];

// 1.13.2's protocol SoundEvent registry still contains several pre-flattening
// names, while the resource-pack sounds.json uses the flattened asset names.
const SOUND_EVENT_PREFIX_ALIASES = [
  ['block.cloth.', 'block.wool.'],
  ['block.enderchest.', 'block.ender_chest.'],
  ['block.metal_pressureplate.', 'block.metal_pressure_plate.'],
  ['block.note.', 'block.note_block.'],
  ['block.slime.', 'block.slime_block.'],
  ['block.stone_pressureplate.', 'block.stone_pressure_plate.'],
  ['block.waterlily.', 'block.lily_pad.'],
  ['block.wood_button.', 'block.wooden_button.'],
  ['block.wood_pressureplate.', 'block.wooden_pressure_plate.'],
  ['entity.armorstand.', 'entity.armor_stand.'],
  ['entity.bobber.', 'entity.fishing_bobber.'],
  ['entity.enderdragon_fireball.', 'entity.dragon_fireball.'],
  ['entity.enderdragon.', 'entity.ender_dragon.'],
  ['entity.endereye.', 'entity.ender_eye.'],
  ['entity.endermen.', 'entity.enderman.'],
  ['entity.enderpearl.', 'entity.ender_pearl.'],
  ['entity.evocation_fangs.', 'entity.evoker_fangs.'],
  ['entity.evocation_illager.', 'entity.evoker.'],
  ['entity.firework.', 'entity.firework_rocket.'],
  ['entity.illusion_illager.', 'entity.illusioner.'],
  ['entity.irongolem.', 'entity.iron_golem.'],
  ['entity.itemframe.', 'entity.item_frame.'],
  ['entity.leashknot.', 'entity.leash_knot.'],
  ['entity.lightning.', 'entity.lightning_bolt.'],
  ['entity.lingeringpotion.', 'entity.lingering_potion.'],
  ['entity.magmacube.', 'entity.magma_cube.'],
  ['entity.parrot.imitate.enderdragon', 'entity.parrot.imitate.ender_dragon'],
  ['entity.parrot.imitate.evocation_illager', 'entity.parrot.imitate.evoker'],
  ['entity.parrot.imitate.illusion_illager', 'entity.parrot.imitate.illusioner'],
  ['entity.parrot.imitate.magmacube', 'entity.parrot.imitate.magma_cube'],
  ['entity.parrot.imitate.vindication_illager', 'entity.parrot.imitate.vindicator'],
  ['entity.snowman.', 'entity.snow_golem.'],
  ['entity.vindication_illager.', 'entity.vindicator.'],
  ['entity.zombie_pig.', 'entity.zombie_pigman.'],
  ['record.', 'music_disc.'],
];

const SOUND_EVENT_ALIASES = new Map([
  ['entity.polar_bear.baby_ambient', 'entity.polar_bear.ambient_baby'],
  ['entity.villager.trading', 'entity.villager.trade'],
  ['entity.zombie.attack_door_wood', 'entity.zombie.attack_wooden_door'],
  ['entity.zombie.break_door_wood', 'entity.zombie.break_wooden_door'],
]);

function soundAssetName(name) {
  let n = String(name || '').replace(/^minecraft:/, '');
  if (SOUND_EVENT_ALIASES.has(n)) return SOUND_EVENT_ALIASES.get(n);
  const small = n.match(/^entity\.(small_(?:slime|magmacube))\.(death|hurt|jump|squish)$/);
  if (small) return `entity.${small[1] === 'small_slime' ? 'slime' : 'magma_cube'}.${small[2]}_small`;
  for (const [from, to] of SOUND_EVENT_PREFIX_ALIASES) if (n.startsWith(from)) return to + n.slice(from.length);
  return n;
}

// Category for client-played sounds without one: by the event name
const CATEGORY_OF = (name) => {
  if (name.startsWith('music.')) return 'music';
  if (name.startsWith('record.')) return 'record';
  if (name.startsWith('weather.')) return 'weather';
  if (name.startsWith('block.')) return 'block';
  if (name.startsWith('entity.player.')) return 'player';
  if (/^entity\.(zombie|husk|skeleton|stray|wither|spider|creeper|blaze|ghast|enderman|endermite|slime|small_slime|magma_cube|small_magma_cube|silverfish|witch|ender_dragon|guardian|elder_guardian|shulker|vex|evoker|vindicator|illusioner|zombie_pigman|zombie_villager|hostile|phantom|drowned)/.test(name)) return 'hostile';
  if (name.startsWith('entity.')) return 'neutral';
  if (name.startsWith('ambient.')) return 'ambient';
  return 'master';
};

// RenderGlobal.playEvent sounds: id -> [event, volume, pitch(rand)]
const r = Math.random;
const EVENT_SOUNDS = {
  1000: ['block.dispenser.dispense', 1, () => 1, 'block'], 1001: ['block.dispenser.fail', 1, () => 1.2, 'block'],
  1002: ['block.dispenser.launch', 1, () => 1.2, 'block'], 1003: ['entity.endereye.launch', 1, () => 1.2, 'neutral'],
  1004: ['entity.firework.shoot', 1, () => 1.2, 'neutral'],
  1005: ['block.iron_door.open', 1, () => r() * 0.1 + 0.9, 'block'], 1006: ['block.wooden_door.open', 1, () => r() * 0.1 + 0.9, 'block'],
  1007: ['block.wooden_trapdoor.open', 1, () => r() * 0.1 + 0.9, 'block'], 1008: ['block.fence_gate.open', 1, () => r() * 0.1 + 0.9, 'block'],
  1009: ['block.fire.extinguish', 0.5, () => 2.6 + (r() - r()) * 0.8, 'block'],
  1011: ['block.iron_door.close', 1, () => r() * 0.1 + 0.9, 'block'], 1012: ['block.wooden_door.close', 1, () => r() * 0.1 + 0.9, 'block'],
  1013: ['block.wooden_trapdoor.close', 1, () => r() * 0.1 + 0.9, 'block'], 1014: ['block.fence_gate.close', 1, () => r() * 0.1 + 0.9, 'block'],
  1015: ['entity.ghast.warn', 10, () => (r() - r()) * 0.2 + 1, 'hostile'], 1016: ['entity.ghast.shoot', 10, () => (r() - r()) * 0.2 + 1, 'hostile'],
  1017: ['entity.enderdragon.shoot', 10, () => (r() - r()) * 0.2 + 1, 'hostile'], 1018: ['entity.blaze.shoot', 2, () => (r() - r()) * 0.2 + 1, 'hostile'],
  1019: ['entity.zombie.attack_door_wood', 2, () => (r() - r()) * 0.2 + 1, 'hostile'], 1020: ['entity.zombie.attack_iron_door', 2, () => (r() - r()) * 0.2 + 1, 'hostile'],
  1021: ['entity.zombie.break_door_wood', 2, () => (r() - r()) * 0.2 + 1, 'hostile'], 1022: ['entity.wither.break_block', 2, () => (r() - r()) * 0.2 + 1, 'hostile'],
  1024: ['entity.wither.shoot', 2, () => (r() - r()) * 0.2 + 1, 'hostile'], 1025: ['entity.bat.takeoff', 0.05, () => (r() - r()) * 0.2 + 1, 'neutral'],
  1026: ['entity.zombie.infect', 2, () => (r() - r()) * 0.2 + 1, 'hostile'], 1027: ['entity.zombie_villager.converted', 2, () => (r() - r()) * 0.2 + 1, 'neutral'],
  1029: ['block.anvil.destroy', 1, () => r() * 0.1 + 0.9, 'block'], 1030: ['block.anvil.use', 1, () => r() * 0.1 + 0.9, 'block'],
  1031: ['block.anvil.land', 0.3, () => r() * 0.1 + 0.9, 'block'], 1033: ['block.chorus_flower.grow', 1, () => 1, 'block'],
  1034: ['block.chorus_flower.death', 1, () => 1, 'block'], 1035: ['block.brewing_stand.brew', 1, () => 1, 'block'],
  1036: ['block.iron_trapdoor.close', 1, () => r() * 0.1 + 0.9, 'block'], 1037: ['block.iron_trapdoor.open', 1, () => r() * 0.1 + 0.9, 'block'],
  1039: ['entity.phantom.bite', 0.3, () => r() * 0.1 + 0.9, 'hostile'],
  1040: ['entity.zombie.converted_to_drowned', 2, () => (r() - r()) * 0.2 + 1, 'neutral'],
  1041: ['entity.husk.converted_to_zombie', 2, () => (r() - r()) * 0.2 + 1, 'neutral'],
  1042: ['block.grindstone.use', 1, () => r() * 0.1 + 0.9, 'block'],
  1043: ['item.book.page_turn', 1, () => r() * 0.1 + 0.9, 'block'],
  1501: ['block.lava.extinguish', .5, () => 2.6 + (r() - r()) * .8, 'block'],
  1502: ['block.redstone_torch.burnout', .5, () => 2.6 + (r() - r()) * .8, 'block'],
  1503: ['block.end_portal_frame.fill', 1, () => 1, 'block'],
  3000: ['block.end_gateway.spawn', 10, () => (1 + (r() - r()) * .2) * .7, 'block'],
  3001: ['entity.ender_dragon.growl', 64, () => .8 + r() * .3, 'hostile'],
  2002: ['entity.splash_potion.break', 1, () => r() * 0.1 + 0.9, 'neutral'], 2007: ['entity.splash_potion.break', 1, () => r() * 0.1 + 0.9, 'neutral'],
};
// RenderGlobal.broadcastSound (heard from anywhere)
const GLOBAL_EVENTS = { 1023: 'entity.wither.spawn', 1028: 'entity.enderdragon.death', 1038: 'block.end_portal.spawn' };

export class SoundManager {
  constructor(game) {
    this.game = game;
    this.audio = platform().createAudio();
    this.defs = null;
    this.buffers = new Map();
    this.playing = new Set();
    this.musicTimer = 100;
    this.music = null;
    this.reload();
  }

  // (Re)load sound definitions, e.g. after resource packs change
  reload() {
    this.stopAll();
    this.buffers.clear();
    this.game.assets.loadSoundDefinitions().then((d) => { this.defs = d; }).catch(() => { this.defs = {}; });
  }

  // SoundHandler.playSound -> GuiSubtitleOverlay: events with a "subtitle" in sounds.json (global sounds at the player)
  _subtitle(name, x, y, z, opts) {
    const g = this.game;
    const d = this.defs && this.defs[name];
    if (!d || !d.subtitle || !g.settings.showSubtitles || !g.inWorld || !g.hud.addSubtitle) return;
    const p = g.player;
    if (opts.global || x === undefined) g.hud.addSubtitle(tr(d.subtitle), p.x, p.y, p.z);
    else g.hud.addSubtitle(tr(d.subtitle), x, y, z);
  }

  volumeFor(cat) {
    const s = this.game.settings;
    const v = cat === 'master' ? 1 : (s.soundVolumes[cat] !== undefined ? s.soundVolumes[cat] : 1);
    return s.masterVolume * v;
  }

  _weight(name, seen = new Set()) {
    name = soundAssetName(name);
    if (seen.has(name)) return 0;
    const next = new Set(seen).add(name);
    return (this.defs?.[name]?.sounds || []).reduce((sum, raw) => {
      const e = typeof raw === 'string' ? { name: raw } : raw;
      return sum + (e.type === 'event' ? this._weight(e.name, next) : e.weight ?? 1);
    }, 0);
  }

  _pick(name, seen = new Set()) {
    name = soundAssetName(name);
    if (seen.has(name)) return null;
    const entries = this.defs?.[name]?.sounds;
    if (!entries?.length) return null;
    const next = new Set(seen).add(name), weighted = entries.map(raw => {
      const e = typeof raw === 'string' ? { name: raw } : raw;
      return [e, e.type === 'event' ? this._weight(e.name, next) : e.weight ?? 1];
    });
    const total = weighted.reduce((sum, [, weight]) => sum + weight, 0);
    if (!total) return null;
    let choice = Math.random() * total, pick;
    for (const [entry, weight] of weighted) { choice -= weight; if (choice < 0) { pick = entry; break; } }
    if (!pick) return null;
    if (pick.type === 'event') {
      const sound = this._pick(pick.name, next);
      return sound ? { ...sound, volume: sound.volume * (pick.volume ?? 1), pitch: sound.pitch * (pick.pitch ?? 1), stream: sound.stream || !!pick.stream } : null;
    }
    return { file: pick.name, volume: pick.volume ?? 1, pitch: pick.pitch ?? 1, stream: !!pick.stream };
  }

  async _buffer(file) {
    let b = this.buffers.get(file);
    if (b) return b;
    b = this.game.assets.readSound(file + '.ogg').then((bytes) => (bytes ? this.audio.decode(bytes) : null)).catch(() => null);
    this.buffers.set(file, b);
    return b;
  }

  // Positional sound at world coordinates. opts: { global, category (name or SPacketSoundEffect id) }
  async play(name, x, y, z, volume = 1, pitch = 1, opts = {}) {
    if (!this.audio) return null;
    const assetName = soundAssetName(name);
    const def = this._pick(assetName);
    if (!def) return null;
    this._subtitle(assetName, x, y, z, opts);
    const cat = typeof opts.category === 'number' ? CATEGORIES[opts.category] || 'master' : opts.category || CATEGORY_OF(assetName);
    const catVol = this.volumeFor(cat);
    if (catVol <= 0) return null;
    const generation = this.generation;
    const buf = await this._buffer(def.file);
    if (!buf || generation !== this.generation) return null;
    const handle = { name: assetName, category: cat, onEnd: null, entity:opts.entity };
    const voice = this.audio.play(buf, {
      volume: Math.min(1, volume) * def.volume * catVol,
      pitch: Math.max(0.5, Math.min(2, pitch * def.pitch)),
      pos: !opts.global && x !== undefined ? [x, y, z] : null,
      maxDistance: Math.max(16, volume * 16),
      onEnd: () => { this.playing.delete(handle); if (handle.onEnd) handle.onEnd(); },
    });
    if (!voice) return null;
    handle.voice = voice;
    this.playing.add(handle);
    return handle;
  }

  playAtPlayer(name, volume = 1, pitch = 1) {
    return this.play(name, 0, 0, 0, volume, pitch, { global: true });
  }

  playUi(name, pitch = 1) { return this.play(name, 0, 0, 0, 0.25, pitch, { global: true, category: 'master' }); }

  // SoundHandler.stop (/stopsound): sounds of one category and/or one sound event; neither stops everything
  stop(sound, category) {
    if (!category && !sound) { this.stopAll(); return; }
    const id = (s) => String(s).toLowerCase().replace(/^minecraft:/, '');
    const want = sound ? id(soundAssetName(sound)) : null;
    for (const h of [...this.playing]) {
      if (category && h.category !== category) continue;
      if (want && id(soundAssetName(h.name)) !== want) continue;
      if (h.stop) h.stop(); else h.voice.stop();
      this.playing.delete(h);
    }
  }

  stopAll() {
    this.generation = (this.generation || 0) + 1;
    for (const h of this.playing) h.voice.stop();
    this.playing.clear();
    if (this.music) { this.music.voice.stop(); this.music = null; }
  }

  // Footsteps (Entity.playStepSound)
  // Entity.playStepSound: block below (snow layer on top wins), volume * 0.15, played at the entity's feet
  playStep(x, y, z, state, at = null) {
    let b = getBlock(state);
    const above = getBlock(this.game.world.getState(x, y + 1, z));
    if (above && (above.name === 'snow_layer')) b = above;
    if (!b || b.id === 0 || b.isLiquid) return;
    const st = soundTypeOf(b);
    const p = at || [x + 0.5, y + 0.5, z + 0.5];
    this.play(st[0], p[0], p[1], p[2], st[3] * 0.15, st[4], { category: this._entityCategory() });
  }

  // Entity.getSoundCategory of the local player
  _entityCategory() { return 'player'; }

  // EntityLivingBase.fall (client side for the local player): fall thud, then the landing block's fall sound
  playFall(damage, x, y, z, state) {
    this.play(damage > 4 ? 'entity.player.big_fall' : 'entity.player.small_fall', x, y, z, 1, 1, { category: 'player' });
    const b = getBlock(state);
    if (b && b.id !== 0) {
      const st = soundTypeOf(b);
      this.play(st[6], x, y, z, st[3] * 0.5, st[4] * 0.75, { category: 'player' });
    }
  }

  // Looping sound whose volume / position the caller updates every tick (vanilla ITickableSound)
  async playLoop(name, x, y, z, opts = {}) {
    if (!this.audio) return null;
    const def = this._pick(name);
    if (!def) return null;
    const cat = opts.category || CATEGORY_OF(name);
    const generation = this.generation;
    const buf = await this._buffer(def.file);
    if (!buf || generation !== this.generation) return null;
    const base = def.volume * this.volumeFor(cat);
    const voice = this.audio.play(buf, { volume: 0, pitch: def.pitch, pos: opts.global ? null : [x, y, z], maxDistance: 16, loop: true });
    if (!voice) return null;
    const handle = { name, category: cat, voice, base, stop: () => { voice.stop(); this.playing.delete(handle); }, setVolume: (v) => voice.setVolume && voice.setVolume(Math.min(1, v) * base), setPosition: (p) => voice.setPosition && voice.setPosition(p), setPitch: (v) => voice.setPitch?.(Math.max(0.5, Math.min(2, v * def.pitch))) };
    this.playing.add(handle);
    return handle;
  }

  // PlayerControllerMP.onPlayerDamageBlock: the hit sound, NEUTRAL
  playBlockHit(x, y, z, state) {
    const st = soundTypeOf(getBlock(state));
    this.play(st[5], x + 0.5, y + 0.5, z + 0.5, (st[3] + 1) / 8, st[4] * 0.5, { category: 'neutral' });
  }

  playBlockBreak(x, y, z, state) {
    const st = soundTypeOf(getBlock(state));
    this.play(st[1], x + 0.5, y + 0.5, z + 0.5, (st[3] + 1) / 2, st[4] * 0.8, { category: 'block' });
  }

  // Explosion.finalizeExplosion: the explosion packet owns this client-local sound.
  playExplosion(x, y, z) {
    this.play('entity.generic.explode', x, y, z, 4, (1 + (Math.random() - Math.random()) * .2) * .7, { category: 'block' });
  }

  playBlockPlace(x, y, z, state) {
    const st = soundTypeOf(getBlock(state));
    this.play(st[2], x + 0.5, y + 0.5, z + 0.5, (st[3] + 1) / 2, st[4] * 0.8, { category: 'block' });
  }

  // EntityLiving.getHurtSound / getDeathSound (handleStatusUpdate 2 / 3)
  _mobSounds(e) {
    const name = e.entityName;
    if (name === 'armor_stand') return ['entity.armor_stand.hit', 'entity.armor_stand.break'];
    if (name === 'slime' || name === 'magma_cube') return E(name).map(s => (e.size || 1) > 1 ? s : s + '_small');
    return E(SOUND_ALIASES[name] || name || 'generic');
  }

  _mobCategory(e) {
    if (e.kind === 'player') return 'player';
    return HOSTILE_TYPES.has(e.entityName) ? 'hostile' : 'neutral';
  }

  playEntityHurt(e) {
    if (e.silent) return;
    if (e.kind === 'player') { this.play('entity.player.hurt', e.x, e.y, e.z, 1, (Math.random() - Math.random()) * 0.2 + 1, { category: 'player' }); return; }
    const s = this._mobSounds(e);
    if (s && s[0]) this.play(s[0], e.x, e.y, e.z, 1, (Math.random() - Math.random()) * 0.2 + (e.child ? 1.5 : 1), { category: this._mobCategory(e) });
  }

  playEntityDeath(e) {
    if (e.silent) return;
    if (e.kind === 'player') { this.play('entity.player.death', e.x, e.y, e.z, 1, (Math.random() - Math.random()) * 0.2 + 1, { category: 'player' }); return; }
    const s = this._mobSounds(e);
    if (s && s[1]) this.play(s[1], e.x, e.y, e.z, 1, (Math.random() - Math.random()) * 0.2 + (e.child ? 1.5 : 1), { category: this._mobCategory(e) });
  }

  // WorldClient.playMoodSoundAndCheckLight: now and then a cave sound in a dark, sky-less air block nearby
  _moodTick() {
    const g = this.game, w = g.world;
    if (!g.inWorld) return;
    if (this.ambientCountdown === undefined) this.ambientCountdown = Math.floor(Math.random() * 12000);
    if (this.ambientCountdown > 0) { this.ambientCountdown--; return; }
    const rd = Math.min(g.settings.renderDistance, 7);
    const pcx = Math.floor(g.player.x) >> 4, pcz = Math.floor(g.player.z) >> 4;
    this.lcg = this.lcg === undefined ? (Math.random() * 0x7fffffff) | 0 : this.lcg;
    for (let n = 0; n < 10; n++) {
      const cx = pcx + Math.floor(Math.random() * (rd * 2 + 1)) - rd, cz = pcz + Math.floor(Math.random() * (rd * 2 + 1)) - rd;
      if (!w.isLoaded(cx << 4, cz << 4)) continue;
      this.lcg = (Math.imul(this.lcg, 3) + 1013904223) | 0;
      const i = this.lcg >> 2;
      const x = (cx << 4) + (i & 15), z = (cz << 4) + ((i >> 8) & 15), y = (i >> 16) & 255;
      if (w.getState(x, y, z) !== 0) continue;
      const light = Math.max(w.getSkyLight(x, y, z), w.getBlockLight(x, y, z));
      if (light <= Math.floor(Math.random() * 8) && w.getSkyLight(x, y, z) <= 0) {
        const dx = g.player.x - x - 0.5, dy = g.player.y - y - 0.5, dz = g.player.z - z - 0.5;
        if (dx * dx + dy * dy + dz * dz > 4) {
          this.play('ambient.cave', x + 0.5, y + 0.5, z + 0.5, 0.7, 0.8 + Math.random() * 0.2, { category: 'ambient' });
          this.ambientCountdown = Math.floor(Math.random() * 12000) + 6000;
          return;
        }
      }
    }
  }

  onBlockAction(p) {
    const b = getBlockById(p.blockId);
    if (!b) return;
    const { x, y, z } = p.location;
    if (b.name === 'note_block') {
      // Since 1.13 the event is 0/0; both values belong to the synchronized block state.
      const props=getStateProperties(this.game.world.getState(x,y,z)), inst=props.instrument||'harp', note=Number(props.note||0);
      const pitch = Math.pow(2, (note - 12) / 12);
      this.play('block.note_block.' + inst, x + 0.5, y + 0.5, z + 0.5, 3, pitch, { category: 'record' });
      this.game.particles.note && this.game.particles.note(x, y, z, note);
    } else if (b.name === 'piston' || b.name === 'sticky_piston') {
      this.play(p.byte1 === 0 ? 'block.piston.extend' : 'block.piston.contract', x + 0.5, y + 0.5, z + 0.5, 0.5, Math.random() * 0.25 + 0.6, { category: 'block' });
    }
  }

  // RenderGlobal.playEvent / broadcastSound (1.12 event ids)
  onWorldEvent(p) {
    const { x, y, z } = p.location;
    const cx = x + 0.5, cy = y + 0.5, cz = z + 0.5;
    if (p.effectId === 1010) { this.playRecord(p.data, cx, cy, cz); return; }
    if (p.effectId === 1032) { this.play('block.portal.travel', 0, 0, 0, 0.25, Math.random() * 0.4 + 0.8, { global: true, category: 'master' }); return; }
    if (p.effectId === 2001) {
      this.playBlockBreak(x, y, z, p.data);
      return;
    }
    if(p.effectId===1500){this.play(p.data>0?'block.composter.fill_success':'block.composter.fill',x,y,z,1,1,{category:'block'});return;}
    if(p.effectId===2006){if(p.data===1)this.play('entity.dragon_fireball.explode',cx,cy,cz,1,r()*.1+.9,{category:'hostile'});return;}
    const gl = GLOBAL_EVENTS[p.effectId];
    if (gl) { this.play(gl, cx, cy, cz, p.effectId === 1028 ? 5 : 1, 1, { global: true }); return; }
    const e = EVENT_SOUNDS[p.effectId];
    if (e) this.play(e[0], cx, cy, cz, e[1], e[2](), { category: e[3] });
  }

  async playRecord(itemId, x, y, z) {
    if (this.record) { this.record.voice.stop(); this.record = null; }
    if (!itemId) return;
    const item=this.game.items.name(itemId),n=item.startsWith('music_disc_')?item.slice(11):null;
    if (!n) return;
    this.game.hud.setActionBar(tr('record.nowPlaying',tr('item.minecraft.music_disc_'+n+'.desc')));
    this.record = await this.play('music_disc.' + n, x, y, z, 4, 1, { category: 'record' });
  }

  // Minecraft.getAmbientMusicType: [event, minDelay, maxDelay]
  _musicType() {
    const g = this.game, scr = g.screens.current;
    if (scr && scr.isCredits) return ['music.credits', 2147483647, 2147483647];
    if (!g.inWorld) return ['music.menu', 20, 600];
    if (g.dimension === -1) return ['music.nether', 1200, 3600];
    if (g.dimension === 1) return g.hud.bossFlag(2) ? ['music.dragon', 0, 0] : ['music.end', 6000, 24000]; // GuiBossOverlay.shouldPlayEndBossMusic
    if (g.player.creative && g.player.allowFlying) return ['music.creative', 1200, 3600];
    return ['music.game', 12000, 24000];
  }

  // MusicTicker.update
  _musicTick() {
    const [name, min, max] = this._musicType();
    const rand = (a, b) => (a >= b ? a : a + Math.floor(Math.random() * (b - a + 1)));
    if (this.music) {
      if (this.musicName !== name) {
        this.music.voice.stop();
        this.musicTimer = rand(0, Math.floor(min / 2));
      }
      if (this.music.voice.ended || this.musicName !== name) {
        this.music = null;
        this.musicTimer = Math.min(rand(min, max), this.musicTimer);
      }
    }
    if (!this.music && !this.musicPending && this.musicTimer-- <= 0) {
      this.musicPending = true;
      this.musicName = name;
      this.play(name, 0, 0, 0, 1, 1, { global: true }).then((h) => {
        this.musicPending = false;
        this.music = h;
        this.musicTimer = 2147483647;
        if (!h) this.musicTimer = rand(min, max);
      });
    }
  }

  tick() {
    const g = this.game;
    if (!this.audio) return;
    for(const h of this.playing)if(h.entity)h.voice.setPosition?.([h.entity.x,h.entity.y,h.entity.z]);
    this._moodTick();
    // Listener follows camera
    const f = g.lookVector();
    this.audio.setListener(g.renderer.camPos, f, [0, 1, 0]);
    this._musicTick();

  }
}

export { soundAssetName, soundTypeOf };
