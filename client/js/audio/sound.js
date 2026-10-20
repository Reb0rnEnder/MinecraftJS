// Sound engine: vanilla sounds.json (+ resource packs), played through the platform audio interface.
import { blocks } from '../world/blocks.js';
import { platform } from '../platform/platform.js';

// Block.SoundType equivalents: [stepName, breakName, placeName, volume, pitch]
const SOUND_TYPES = {
  stone: ['step.stone', 'dig.stone', 'dig.stone', 1, 1],
  wood: ['step.wood', 'dig.wood', 'dig.wood', 1, 1],
  gravel: ['step.gravel', 'dig.gravel', 'dig.gravel', 1, 1],
  grass: ['step.grass', 'dig.grass', 'dig.grass', 1, 1],
  metal: ['step.stone', 'dig.stone', 'dig.stone', 1, 1.5],
  glass: ['step.stone', 'dig.glass', 'dig.stone', 1, 1],
  cloth: ['step.cloth', 'dig.cloth', 'dig.cloth', 1, 1],
  sand: ['step.sand', 'dig.sand', 'dig.sand', 1, 1],
  snow: ['step.snow', 'dig.snow', 'dig.snow', 1, 1],
  ladder: ['step.ladder', 'dig.wood', 'dig.wood', 1, 1],
  anvil: ['step.stone', 'dig.stone', 'random.anvil_land', 0.3, 1],
  slime: ['mob.slime.small', 'mob.slime.big', 'mob.slime.big', 1, 1],
};

function soundTypeOf(b) {
  if (!b) return SOUND_TYPES.stone;
  const n = b.name;
  if (n === 'slime') return SOUND_TYPES.slime;
  if (n === 'anvil') return SOUND_TYPES.anvil;
  if (n === 'ladder') return SOUND_TYPES.ladder;
  if (/glass|^ice$|packed_ice|glowstone|beacon|sea_lantern|redstone_lamp|portal/.test(n)) return SOUND_TYPES.glass;
  if (/wool|carpet|cactus|cake/.test(n)) return SOUND_TYPES.cloth;
  if (/^sand$|soul_sand/.test(n)) return SOUND_TYPES.sand;
  if (/snow/.test(n)) return SOUND_TYPES.snow;
  if (/gravel|^dirt$|farmland|^clay$/.test(n)) return SOUND_TYPES.gravel;
  if (/^grass$|mycelium|leaves|sapling|tallgrass|deadbush|flower|vine|reeds|waterlily|hay_block|^tnt$|sponge|double_plant|wheat|carrots|potatoes|nether_wart|stem|mushroom$|cocoa|redstone_wire|tripwire$/.test(n)) return SOUND_TYPES.grass;
  if (/iron|gold_block|diamond_block|emerald_block|lapis_block|redstone_block|rail|hopper|cauldron|piston/.test(n) && !/ore$/.test(n)) return SOUND_TYPES.metal;
  if (b.material === 'wood' || /pumpkin|melon_block|bookshelf|chest|crafting|jukebox|noteblock|sign|_door|fence|trapdoor|log|planks/.test(n)) return SOUND_TYPES.wood;
  if (b.material === 'plant' || b.material === 'leaves') return SOUND_TYPES.grass;
  if (b.material === 'dirt') return SOUND_TYPES.gravel;
  if (b.material === 'wool') return SOUND_TYPES.cloth;
  return SOUND_TYPES.stone;
}

const MOB_SOUNDS = {
  50: ['mob.creeper.say', 'mob.creeper.death'], 51: ['mob.skeleton.hurt', 'mob.skeleton.death'], 52: ['mob.spider.say', 'mob.spider.death'],
  54: ['mob.zombie.hurt', 'mob.zombie.death'], 55: ['mob.slime.small', 'mob.slime.small'], 56: ['mob.ghast.scream', 'mob.ghast.death'],
  57: ['mob.zombiepig.zpighurt', 'mob.zombiepig.zpigdeath'], 58: ['mob.endermen.hit', 'mob.endermen.death'], 59: ['mob.spider.say', 'mob.spider.death'],
  60: ['mob.silverfish.hit', 'mob.silverfish.kill'], 61: ['mob.blaze.hit', 'mob.blaze.death'], 62: ['mob.slime.small', 'mob.slime.small'],
  64: ['mob.wither.hurt', 'mob.wither.death'], 65: ['mob.bat.hurt', 'mob.bat.death'], 66: ['mob.witch.hurt', 'mob.witch.death'],
  67: ['mob.silverfish.hit', 'mob.silverfish.kill'], 68: ['mob.guardian.hit', 'mob.guardian.death'], 90: ['mob.pig.say', 'mob.pig.death'],
  91: ['mob.sheep.say', 'mob.sheep.say'], 92: ['mob.cow.hurt', 'mob.cow.hurt'], 93: ['mob.chicken.hurt', 'mob.chicken.hurt'],
  94: [null, null], 95: ['mob.wolf.hurt', 'mob.wolf.death'], 96: ['mob.cow.hurt', 'mob.cow.hurt'], 98: ['mob.cat.hitt', 'mob.cat.hitt'],
  99: ['mob.irongolem.hit', 'mob.irongolem.death'], 100: ['mob.horse.hit', 'mob.horse.death'], 101: ['mob.rabbit.hurt', 'mob.rabbit.death'],
  120: ['mob.villager.hit', 'mob.villager.death'],
};

const CATEGORY_OF = (name) => {
  if (name.startsWith('music.')) return 'music';
  if (name.startsWith('records.')) return 'record';
  if (name.startsWith('ambient.weather')) return 'weather';
  if (name.startsWith('step.') || name.startsWith('dig.') || name.startsWith('tile.') || name.startsWith('random.door') || name.startsWith('random.chest') || name.startsWith('note.') || name.startsWith('fire.') || name.startsWith('liquid.')) return 'block';
  if (/^mob\.(zombie|skeleton|spider|creeper|blaze|ghast|endermen|slime|magmacube|silverfish|witch|wither|enderdragon|guardian|zombiepig)/.test(name)) return 'hostile';
  if (name.startsWith('mob.')) return 'neutral';
  if (name.startsWith('game.player') || name.startsWith('random.')) return 'player';
  if (name.startsWith('ambient.')) return 'ambient';
  return 'master';
};

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
    return { file: pick.name, volume: pick.volume !== undefined ? pick.volume : 1, pitch: pick.pitch !== undefined ? pick.pitch : 1, stream: !!pick.stream, category: d.category };
  }

  async _buffer(file) {
    let b = this.buffers.get(file);
    if (b) return b;
    b = this.game.assets.readSound(file + '.ogg').then((bytes) => (bytes ? this.audio.decode(bytes) : null)).catch(() => null);
    this.buffers.set(file, b);
    return b;
  }

  // Positional sound at world coordinates
  async play(name, x, y, z, volume = 1, pitch = 1, opts = {}) {
    if (!this.audio) return null;
    const def = this._pick(name);
    if (!def) return null;
    const cat = def.category || CATEGORY_OF(name);
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

  // SoundHandler.getRandomSoundFromCategories: any sound event of those categories
  randomEvent(categories) {
    const names = Object.keys(this.defs || {}).filter((n) => categories.includes(this.defs[n].category));
    return names.length ? names[Math.floor(Math.random() * names.length)] : null;
  }

  playUi(name, pitch = 1) { return this.play(name, 0, 0, 0, 0.25, pitch, { global: true }); }

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
    this.play(st[0], p[0], p[1], p[2], st[3] * 0.15, st[4]);
  }

  // EntityLivingBase.fall (client side for the local player): fall thud, then the landing block's step sound
  playFall(damage, x, y, z, state) {
    this.play(damage > 4 ? 'game.player.hurt.fall.big' : 'game.player.hurt.fall.small', x, y, z, 1, 1);
    const b = blocks[state >> 4];
    if (b && b.id !== 0) {
      const st = soundTypeOf(b);
      this.play(st[0], x, y, z, st[3] * 0.5, st[4] * 0.75);
    }
  }

  // Looping sound whose volume / position the caller updates every tick (vanilla ITickableSound)
  async playLoop(name, x, y, z, opts = {}) {
    if (!this.audio) return null;
    const def = this._pick(name);
    if (!def) return null;
    const cat = def.category || CATEGORY_OF(name);
    const buf = await this._buffer(def.file);
    if (!buf) return null;
    const base = def.volume * this.volumeFor(cat);
    const voice = this.audio.play(buf, { volume: 0, pitch: def.pitch, pos: opts.global ? null : [x, y, z], maxDistance: 16, loop: true });
    if (!voice) return null;
    const handle = { voice, base, stop: () => { voice.stop(); this.playing.delete(handle); }, setVolume: (v) => voice.setVolume && voice.setVolume(Math.min(1, v) * base), setPosition: (p) => voice.setPosition && voice.setPosition(p) };
    this.playing.add(handle);
    return handle;
  }

  playBlockHit(x, y, z, state) {
    const st = soundTypeOf(blocks[state >> 4]);
    this.play(st[0], x + 0.5, y + 0.5, z + 0.5, (st[3] + 1) / 8, st[4] * 0.5);
  }

  playBlockBreak(x, y, z, state) {
    const st = soundTypeOf(blocks[state >> 4]);
    this.play(st[1], x + 0.5, y + 0.5, z + 0.5, (st[3] + 1) / 2, st[4] * 0.8);
  }

  playBlockPlace(x, y, z, state) {
    const st = soundTypeOf(blocks[state >> 4]);
    this.play(st[2], x + 0.5, y + 0.5, z + 0.5, (st[3] + 1) / 2, st[4] * 0.8);
  }

  // EntityLiving.getHurtSound / getDeathSound (handleStatusUpdate 2 / 3)
  _mobSounds(e) {
    const t = e.type;
    if (t === 55 || t === 62) { const big = (e.size || 1) > 1 ? 'big' : 'small'; return ['mob.slime.' + big, 'mob.slime.' + big]; }
    if (t === 100) {
      const ht = (e.metadata && e.metadata[19]) || 0; // 0 horse, 1 donkey, 2 mule, 3 zombie, 4 skeleton
      const k = ht === 3 ? 'zombie.' : ht === 4 ? 'skeleton.' : ht === 1 || ht === 2 ? 'donkey.' : '';
      return ['mob.horse.' + k + 'hit', 'mob.horse.' + k + 'death'];
    }
    if (t === 68 && e.elder) return ['mob.guardian.elder.hit', 'mob.guardian.elder.death'];
    if (t === 63) return ['mob.enderdragon.hit', 'mob.enderdragon.end'];
    const s = MOB_SOUNDS[t];
    if (s) return s;
    const hostile = [53, 63, 64].includes(t) || (t >= 50 && t <= 68);
    return hostile ? ['game.hostile.hurt', 'game.hostile.die'] : ['game.neutral.hurt', 'game.neutral.die'];
  }

  playEntityHurt(e) {
    if (e.kind === 'player') { this.play('game.player.hurt', e.x, e.y, e.z, 1, (Math.random() - Math.random()) * 0.2 + 1); return; }
    const s = this._mobSounds(e);
    if (s && s[0]) this.play(s[0], e.x, e.y, e.z, 1, (Math.random() - Math.random()) * 0.2 + (e.child ? 1.5 : 1));
  }

  playEntityDeath(e) {
    if (e.kind === 'player') { this.play('game.player.die', e.x, e.y, e.z, 1, (Math.random() - Math.random()) * 0.2 + 1); return; }
    const s = this._mobSounds(e);
    if (s && s[1]) this.play(s[1], e.x, e.y, e.z, 1, (Math.random() - Math.random()) * 0.2 + (e.child ? 1.5 : 1));
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
          this.play('ambient.cave.cave', x + 0.5, y + 0.5, z + 0.5, 0.7, 0.8 + Math.random() * 0.2);
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
      const inst = ['harp', 'bd', 'snare', 'hat', 'bassattack'][p.byte1] || 'harp';
      const pitch = Math.pow(2, (p.byte2 - 12) / 12);
      this.play('note.' + inst, x + 0.5, y + 0.5, z + 0.5, 3, pitch);
      this.game.particles.note && this.game.particles.note(x, y, z, p.byte2);
    } else if (b.name === 'piston' || b.name === 'sticky_piston') {
      this.play(p.byte1 === 0 ? 'tile.piston.out' : 'tile.piston.in', x + 0.5, y + 0.5, z + 0.5, 0.5, Math.random() * 0.25 + 0.6);
    }
  }

  onWorldEvent(p) {
    const { x, y, z } = p.location;
    const cx = x + 0.5, cy = y + 0.5, cz = z + 0.5;
    const r = () => Math.random();
    switch (p.effectId) {
      case 1000: this.play('random.click', cx, cy, cz, 1, 1); break;
      case 1001: this.play('random.click', cx, cy, cz, 1, 1.2); break;
      case 1002: this.play('random.bow', cx, cy, cz, 1, 1.2); break;
      case 1003: this.play('random.door_open', cx, cy, cz, 1, r() * 0.1 + 0.9); break;
      case 1004: this.play('random.fizz', cx, cy, cz, 0.5, 2.6 + (r() - r()) * 0.8); break;
      case 1005: this.playRecord(p.data, cx, cy, cz); break;
      case 1006: this.play('random.door_close', cx, cy, cz, 1, r() * 0.1 + 0.9); break;
      case 1007: this.play('mob.ghast.charge', cx, cy, cz, 10, (r() - r()) * 0.2 + 1); break;
      case 1008: this.play('mob.ghast.fireball', cx, cy, cz, 10, (r() - r()) * 0.2 + 1); break;
      case 1009: this.play('mob.ghast.fireball', cx, cy, cz, 2, (r() - r()) * 0.2 + 1); break;
      case 1010: this.play('mob.zombie.wood', cx, cy, cz, 2, (r() - r()) * 0.2 + 1); break;
      case 1011: this.play('mob.zombie.metal', cx, cy, cz, 2, (r() - r()) * 0.2 + 1); break;
      case 1012: this.play('mob.zombie.woodbreak', cx, cy, cz, 2, (r() - r()) * 0.2 + 1); break;
      case 1013: this.play('mob.wither.spawn', cx, cy, cz, 1, 1, { global: true }); break;
      case 1014: this.play('mob.wither.shoot', cx, cy, cz, 2, (r() - r()) * 0.2 + 1); break;
      case 1015: this.play('mob.bat.takeoff', cx, cy, cz, 0.05, (r() - r()) * 0.2 + 1); break;
      case 1016: this.play('mob.zombie.infect', cx, cy, cz, 2, (r() - r()) * 0.2 + 1); break;
      case 1017: this.play('mob.zombie.unfect', cx, cy, cz, 2, (r() - r()) * 0.2 + 1); break;
      case 1018: this.play('mob.enderdragon.end', cx, cy, cz, 5, 1, { global: true }); break;
      case 1020: this.play('random.anvil_break', cx, cy, cz, 1, r() * 0.1 + 0.9); break;
      case 1021: this.play('random.anvil_use', cx, cy, cz, 1, r() * 0.1 + 0.9); break;
      case 1022: this.play('random.anvil_land', cx, cy, cz, 0.3, r() * 0.1 + 0.9); break;
      case 2001: {
        const id = p.data & 4095, meta = (p.data >> 12) & 15;
        this.playBlockBreak(x, y, z, (id << 4) | meta);
        break;
      }
      case 2002: this.play('game.potion.smash', cx, cy, cz, 1, r() * 0.1 + 0.9); break;
      default: break;
    }
  }

  async playRecord(itemId, x, y, z) {
    if (this.record) { this.record.voice.stop(); this.record = null; }
    if (!itemId) return;
    const names = { 2256: '13', 2257: 'cat', 2258: 'blocks', 2259: 'chirp', 2260: 'far', 2261: 'mall', 2262: 'mellohi', 2263: 'stal', 2264: 'strad', 2265: 'ward', 2266: '11', 2267: 'wait' };
    const n = names[itemId];
    if (!n) return;
    this.game.hud.setActionBar('§dNow playing: C418 - ' + n);
    this.record = await this.play('records.' + n, x, y, z, 4, 1);
  }

  // Minecraft.getAmbientMusicType: [event, minDelay, maxDelay]
  _musicType() {
    const g = this.game, scr = g.screens.current;
    if (scr && scr.isCredits) return ['music.game.end.credits', 2147483647, 2147483647];
    if (!g.inWorld) return ['music.menu', 20, 600];
    if (g.dimension === -1) return ['music.nether', 1200, 3600];
    if (g.dimension === 1) return g.entities.boss && g.entities.boss() ? ['music.game.end.dragon', 0, 0] : ['music.game.end', 6000, 24000];
    if (g.player.creative && g.player.allowFlying) return ['music.game.creative', 1200, 3600];
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
