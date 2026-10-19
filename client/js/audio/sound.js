// Sound engine: vanilla sounds.json (+ resource packs), played through the platform audio interface.
import { blocks } from '../world/blocks.js';
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
  const n = b.name;
  if (n === 'slime') return SOUND_TYPES.slime;
  if (n === 'anvil') return SOUND_TYPES.anvil;
  if (n === 'ladder') return SOUND_TYPES.ladder;
  if (/glass|^ice$|frosted_ice|packed_ice|glowstone|beacon|sea_lantern|redstone_lamp|portal|end_gateway/.test(n)) return SOUND_TYPES.glass;
  if (/wool|carpet|cactus|cake/.test(n)) return SOUND_TYPES.cloth;
  if (/^sand$|soul_sand|concrete_powder/.test(n)) return SOUND_TYPES.sand;
  if (/snow/.test(n)) return SOUND_TYPES.snow;
  if (/gravel|^dirt$|farmland|^clay$|grass_path/.test(n)) return SOUND_TYPES.gravel;
  if (/^grass$|mycelium|leaves|sapling|tallgrass|deadbush|flower|vine|reeds|waterlily|hay_block|^tnt$|sponge|double_plant|wheat|carrots|potatoes|beetroots|nether_wart$|stem|mushroom$|cocoa/.test(n)) return SOUND_TYPES.grass;
  if (/iron|gold_block|diamond_block|emerald_block|lapis_block|redstone_block|rail|hopper|cauldron|brewing_stand|command_block|structure_block/.test(n) && !/ore$/.test(n)) return SOUND_TYPES.metal;
  if (b.material === 'wood' || /pumpkin|melon_block|bookshelf|chest|crafting|jukebox|noteblock|sign|_door|fence|trapdoor|log|planks|chorus/.test(n)) return SOUND_TYPES.wood;
  if (b.material === 'plant' || b.material === 'leaves') return SOUND_TYPES.grass;
  if (b.material === 'dirt') return SOUND_TYPES.gravel;
  if (b.material === 'wool') return SOUND_TYPES.cloth;
  return SOUND_TYPES.stone;
}

// EntityLivingBase.getHurtSound / getDeathSound by entity registry id (1.12 sound event names)
const E = (k) => [`entity.${k}.hurt`, `entity.${k}.death`];
const MOB_SOUNDS = {
  4: E('elder_guardian'), 5: E('wither_skeleton'), 6: E('stray'), 23: E('husk'), 27: E('zombie_villager'),
  28: E('skeleton_horse'), 29: E('zombie_horse'), 31: E('donkey'), 32: E('mule'), 34: E('evocation_illager'), 35: E('vex'),
  36: E('vindication_illager'), 37: E('illusion_illager'), 50: E('creeper'), 51: E('skeleton'), 52: E('spider'), 53: E('hostile'),
  54: E('zombie'), 56: E('ghast'), 57: E('zombie_pig'), 58: E('endermen'), 59: E('spider'), 60: E('silverfish'), 61: E('blaze'),
  63: E('enderdragon'), 64: E('wither'), 65: E('bat'), 66: E('witch'), 67: E('endermite'), 68: E('guardian'), 69: E('shulker'),
  90: E('pig'), 91: E('sheep'), 92: E('cow'), 93: E('chicken'), 94: E('squid'), 95: E('wolf'), 96: E('cow'), 97: E('snowman'),
  98: E('cat'), 99: E('irongolem'), 100: E('horse'), 101: E('rabbit'), 102: E('polar_bear'), 103: E('llama'), 105: E('parrot'),
  120: E('villager'),
};
const HOSTILE_TYPES = new Set([4, 5, 6, 23, 27, 34, 35, 36, 37, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 66, 67, 68, 69]);

// SPacketSoundEffect category ids
const CATEGORIES = ['master', 'music', 'record', 'weather', 'block', 'hostile', 'neutral', 'player', 'ambient', 'voice'];

// Category for client-played sounds without one: by the event name
const CATEGORY_OF = (name) => {
  if (name.startsWith('music.')) return 'music';
  if (name.startsWith('record.')) return 'record';
  if (name.startsWith('weather.')) return 'weather';
  if (name.startsWith('block.')) return 'block';
  if (name.startsWith('entity.player.')) return 'player';
  if (/^entity\.(zombie|husk|skeleton|stray|wither|spider|creeper|blaze|ghast|endermen|endermite|slime|small_slime|magmacube|small_magmacube|silverfish|witch|enderdragon|guardian|elder_guardian|shulker|vex|evocation|vindication|illusion|zombie_pig|zombie_villager|hostile)/.test(name)) return 'hostile';
  if (name.startsWith('entity.')) return 'neutral';
  if (name.startsWith('ambient.')) return 'ambient';
  return 'master';
};

// RenderGlobal.playEvent sounds: id -> [event, volume, pitch(rand)]
const r = Math.random;
const EVENT_SOUNDS = {
  1000: ['block.dispenser.dispense', 1, () => 1], 1001: ['block.dispenser.fail', 1, () => 1.2],
  1002: ['block.dispenser.launch', 1, () => 1.2], 1003: ['entity.endereye.launch', 1, () => 1.2],
  1004: ['entity.firework.shoot', 1, () => 1.2],
  1005: ['block.iron_door.open', 1, () => r() * 0.1 + 0.9], 1006: ['block.wooden_door.open', 1, () => r() * 0.1 + 0.9],
  1007: ['block.wooden_trapdoor.open', 1, () => r() * 0.1 + 0.9], 1008: ['block.fence_gate.open', 1, () => r() * 0.1 + 0.9],
  1009: ['block.fire.extinguish', 0.5, () => 2.6 + (r() - r()) * 0.8],
  1011: ['block.iron_door.close', 1, () => r() * 0.1 + 0.9], 1012: ['block.wooden_door.close', 1, () => r() * 0.1 + 0.9],
  1013: ['block.wooden_trapdoor.close', 1, () => r() * 0.1 + 0.9], 1014: ['block.fence_gate.close', 1, () => r() * 0.1 + 0.9],
  1015: ['entity.ghast.warn', 10, () => (r() - r()) * 0.2 + 1], 1016: ['entity.ghast.shoot', 10, () => (r() - r()) * 0.2 + 1],
  1017: ['entity.enderdragon.shoot', 10, () => (r() - r()) * 0.2 + 1], 1018: ['entity.blaze.shoot', 2, () => (r() - r()) * 0.2 + 1],
  1019: ['entity.zombie.attack_door_wood', 2, () => (r() - r()) * 0.2 + 1], 1020: ['entity.zombie.attack_iron_door', 2, () => (r() - r()) * 0.2 + 1],
  1021: ['entity.zombie.break_door_wood', 2, () => (r() - r()) * 0.2 + 1], 1022: ['entity.wither.break_block', 2, () => (r() - r()) * 0.2 + 1],
  1024: ['entity.wither.shoot', 2, () => (r() - r()) * 0.2 + 1], 1025: ['entity.bat.takeoff', 0.05, () => (r() - r()) * 0.2 + 1],
  1026: ['entity.zombie.infect', 2, () => (r() - r()) * 0.2 + 1], 1027: ['entity.zombie_villager.converted', 2, () => (r() - r()) * 0.2 + 1],
  1029: ['block.anvil.destroy', 1, () => r() * 0.1 + 0.9], 1030: ['block.anvil.use', 1, () => r() * 0.1 + 0.9],
  1031: ['block.anvil.land', 0.3, () => r() * 0.1 + 0.9], 1033: ['block.chorus_flower.grow', 1, () => 1],
  1034: ['block.chorus_flower.death', 1, () => 1], 1035: ['block.brewing_stand.brew', 1, () => 1],
  1036: ['block.iron_trapdoor.close', 1, () => r() * 0.1 + 0.9], 1037: ['block.iron_trapdoor.open', 1, () => r() * 0.1 + 0.9],
  2002: ['entity.splash_potion.break', 1, () => r() * 0.1 + 0.9], 2007: ['entity.splash_potion.break', 1, () => r() * 0.1 + 0.9],
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

  volumeFor(cat) {
    const s = this.game.settings;
    const v = cat === 'master' ? 1 : (s.soundVolumes[cat] !== undefined ? s.soundVolumes[cat] : 1);
    return s.masterVolume * v;
  }

  _pick(name) {
    if (!this.defs) return null;
    const d = this.defs[name];
    if (!d || !d.sounds || !d.sounds.length) return null;
    let total = 0;
    const entries = d.sounds.map((s) => (typeof s === 'string' ? { name: s } : s));
    for (const e of entries) total += e.weight || 1;
    let r = Math.random() * total;
    let pick = entries[0];
    for (const e of entries) { r -= e.weight || 1; if (r < 0) { pick = e; break; } }
    if (pick.type === 'event') return this._pick(pick.name);
    return { file: pick.name, volume: pick.volume !== undefined ? pick.volume : 1, pitch: pick.pitch !== undefined ? pick.pitch : 1, stream: !!pick.stream };
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
    const def = this._pick(name);
    if (!def) return null;
    const cat = typeof opts.category === 'number' ? CATEGORIES[opts.category] || 'master' : opts.category || CATEGORY_OF(name);
    const catVol = this.volumeFor(cat);
    if (catVol <= 0) return null;
    const buf = await this._buffer(def.file);
    if (!buf) return null;
    const handle = { name, onEnd: null };
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

  stopAll() {
    for (const h of this.playing) h.voice.stop();
    this.playing.clear();
    if (this.music) { this.music.voice.stop(); this.music = null; }
  }

  // Footsteps (Entity.playStepSound)
  // Entity.playStepSound: block below (snow layer on top wins), volume * 0.15, played at the entity's feet
  playStep(x, y, z, state, at = null) {
    let b = blocks[state >> 4];
    const above = blocks[this.game.world.getState(x, y + 1, z) >> 4];
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
    const b = blocks[state >> 4];
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
    const buf = await this._buffer(def.file);
    if (!buf) return null;
    const base = def.volume * this.volumeFor(cat);
    const voice = this.audio.play(buf, { volume: 0, pitch: def.pitch, pos: opts.global ? null : [x, y, z], maxDistance: 16, loop: true });
    if (!voice) return null;
    const handle = { voice, base, stop: () => { voice.stop(); this.playing.delete(handle); }, setVolume: (v) => voice.setVolume && voice.setVolume(Math.min(1, v) * base), setPosition: (p) => voice.setPosition && voice.setPosition(p) };
    this.playing.add(handle);
    return handle;
  }

  // PlayerControllerMP.onPlayerDamageBlock: the hit sound, NEUTRAL
  playBlockHit(x, y, z, state) {
    const st = soundTypeOf(blocks[state >> 4]);
    this.play(st[5], x + 0.5, y + 0.5, z + 0.5, (st[3] + 1) / 8, st[4] * 0.5, { category: 'neutral' });
  }

  playBlockBreak(x, y, z, state) {
    const st = soundTypeOf(blocks[state >> 4]);
    this.play(st[1], x + 0.5, y + 0.5, z + 0.5, (st[3] + 1) / 2, st[4] * 0.8, { category: 'block' });
  }

  playBlockPlace(x, y, z, state) {
    const st = soundTypeOf(blocks[state >> 4]);
    this.play(st[2], x + 0.5, y + 0.5, z + 0.5, (st[3] + 1) / 2, st[4] * 0.8, { category: 'block' });
  }

  // EntityLiving.getHurtSound / getDeathSound (handleStatusUpdate 2 / 3)
  _mobSounds(e) {
    const t = e.entityType !== undefined ? e.entityType : e.type;
    if (t === 55 || t === 62) {
      const big = (e.size || 1) > 1;
      return E(t === 55 ? (big ? 'slime' : 'small_slime') : (big ? 'magmacube' : 'small_magmacube'));
    }
    const s = MOB_SOUNDS[t];
    if (s) return s;
    return HOSTILE_TYPES.has(t) ? E('hostile') : E('generic');
  }

  _mobCategory(e) {
    if (e.kind === 'player') return 'player';
    return HOSTILE_TYPES.has(e.entityType !== undefined ? e.entityType : e.type) ? 'hostile' : 'neutral';
  }

  playEntityHurt(e) {
    if (e.kind === 'player') { this.play('entity.player.hurt', e.x, e.y, e.z, 1, (Math.random() - Math.random()) * 0.2 + 1, { category: 'player' }); return; }
    const s = this._mobSounds(e);
    if (s && s[0]) this.play(s[0], e.x, e.y, e.z, 1, (Math.random() - Math.random()) * 0.2 + (e.child ? 1.5 : 1), { category: this._mobCategory(e) });
  }

  playEntityDeath(e) {
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
      if (w.getState(x, y, z) >> 4) continue;
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
    const b = blocks[p.blockId];
    if (!b) return;
    const { x, y, z } = p.location;
    if (b.name === 'noteblock') {
      // BlockNote.INSTRUMENTS (1.12)
      const inst = ['harp', 'basedrum', 'snare', 'hat', 'bass', 'flute', 'bell', 'guitar', 'chime', 'xylophone'][p.byte1] || 'harp';
      const pitch = Math.pow(2, (p.byte2 - 12) / 12);
      this.play('block.note.' + inst, x + 0.5, y + 0.5, z + 0.5, 3, pitch, { category: 'record' });
      this.game.particles.note && this.game.particles.note(x, y, z, p.byte2);
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
      const id = p.data & 4095, meta = (p.data >> 12) & 15;
      this.playBlockBreak(x, y, z, (id << 4) | meta);
      return;
    }
    const gl = GLOBAL_EVENTS[p.effectId];
    if (gl) { this.play(gl, cx, cy, cz, p.effectId === 1028 ? 5 : 1, 1, { global: true }); return; }
    const e = EVENT_SOUNDS[p.effectId];
    if (e) this.play(e[0], cx, cy, cz, e[1], e[2]());
  }

  async playRecord(itemId, x, y, z) {
    if (this.record) { this.record.voice.stop(); this.record = null; }
    if (!itemId) return;
    const names = { 2256: '13', 2257: 'cat', 2258: 'blocks', 2259: 'chirp', 2260: 'far', 2261: 'mall', 2262: 'mellohi', 2263: 'stal', 2264: 'strad', 2265: 'ward', 2266: '11', 2267: 'wait' };
    const n = names[itemId];
    if (!n) return;
    this.game.hud.setActionBar('§dNow playing: C418 - ' + n);
    this.record = await this.play('record.' + n, x, y, z, 4, 1, { category: 'record' });
  }

  // Minecraft.getAmbientMusicType: [event, minDelay, maxDelay]
  _musicType() {
    const g = this.game, scr = g.screens.current;
    if (scr && scr.isCredits) return ['music.credits', 2147483647, 2147483647];
    if (!g.inWorld) return ['music.menu', 20, 600];
    if (g.dimension === -1) return ['music.nether', 1200, 3600];
    if (g.dimension === 1) return g.entities.boss && g.entities.boss() ? ['music.dragon', 0, 0] : ['music.end', 6000, 24000];
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
    this._moodTick();
    // Listener follows camera
    const f = g.lookVector();
    this.audio.setListener(g.renderer.camPos, f, [0, 1, 0]);
    this._musicTick();

  }
}

export { soundTypeOf };
