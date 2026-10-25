import {shadowGeometry} from './shadows.js';
import {villagerLayers} from './villager-layers.js';
import { updateRiptide } from './riptide-layer.js';
import { EntityEffects, dragonCorpseMatrix } from './entity-effects.js';
import { poseInterval } from './lod.js';
// Entity rendering (RenderManager + Render* classes) on the gfx scene graph.
import * as M from './entity-models.js';

const M_dragon = () => M.dragonParts();
import { entityMaterial, entityMesh, modelDevice } from './boxmodel.js';
import { applyTransform } from './item-renderer.js';
import { buildTextMeshes, destroyTextMeshes } from './text-mesh.js';
import { getBlock, findState, getStateProperties } from '../world/blocks.js';
import { isPointInFluid } from '../world/fluids.js';
import { resolveState } from '../world/blockstates.js';
import { FORMAT, colorParams, EntityParams } from '../gfx/device.js';
import { mat4, D2R, aabbInFrustum } from '../gfx/math.js';
import { Node, material, drawTree, toDraw, Batcher } from '../gfx/scene.js';
import { JavaRandom } from '../util/jrandom.js';
import { decodePng } from '../util/png.js';
import { decodeBase64 } from '../util/base64.js';
import { platform } from '../platform/platform.js';
import { fetchSkin, fetchSkinProfile, uuidSkinProxyAvailable } from '../net/proxies.js';
import { EntityFire } from './entity-fire.js';
import { decodeUtf8 } from '../util/utf8.js';

const ARMOR_MATS = ['leather', 'chainmail', 'iron', 'diamond', 'gold', 'turtle'];

// Vanilla 1.8.9 MapColor base colors (r, g, b). Index 0 = NONE (transparent).
const MAP_BASE_COLORS = [
  [0, 0, 0], [127, 178, 56], [247, 233, 163], [199, 199, 199], [255, 0, 0],
  [160, 160, 255], [167, 167, 167], [0, 124, 0], [255, 255, 255], [164, 168, 184],
  [151, 109, 77], [112, 112, 112], [64, 64, 255], [143, 119, 72], [255, 252, 245],
  [216, 127, 51], [178, 76, 216], [102, 153, 216], [229, 229, 51], [127, 204, 25],
  [242, 127, 165], [76, 76, 76], [153, 153, 153], [76, 127, 153], [127, 63, 178],
  [51, 76, 178], [102, 76, 51], [102, 127, 51], [153, 51, 51], [25, 25, 25],
  [250, 238, 77], [92, 219, 213], [74, 128, 255], [0, 217, 58], [129, 86, 49],
  [112, 2, 0],
];
// Shade multipliers: variant 0 = 180/255, 1 = 220/255, 2 = 255/255, 3 = 135/255
const MAP_SHADES = [180, 220, 255, 135];
const FLEECE = [[1, 1, 1], [0.85, 0.5, 0.2], [0.7, 0.3, 0.85], [0.4, 0.6, 0.85], [0.9, 0.9, 0.2], [0.5, 0.8, 0.1], [0.95, 0.5, 0.65], [0.3, 0.3, 0.3],
  [0.6, 0.6, 0.6], [0.3, 0.5, 0.6], [0.5, 0.25, 0.7], [0.2, 0.3, 0.7], [0.4, 0.3, 0.2], [0.4, 0.5, 0.2], [0.6, 0.2, 0.2], [0.1, 0.1, 0.1]];
const VILLAGER_TEX = ['farmer', 'librarian', 'priest', 'smith', 'butcher'];
const HORSE_COLORS = ['white', 'creamy', 'chestnut', 'brown', 'black', 'gray', 'darkbrown'];
const RABBIT_TEX = ['brown', 'white', 'black', 'white_splotched', 'gold', 'salt'];
const CAT_TEX = ['ocelot', 'black', 'red', 'siamese'];
const ENTITY_DYES = ['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'light_gray',
  'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black'];
const PARROT_TEX = ['red_blue', 'blue', 'green', 'yellow_blue', 'grey'];
const LLAMA_TEX = ['creamy', 'white', 'brown', 'gray'];
const fishShape = e => ((e.fishVariant || 0) & 255) === 1 ? 1 : 0;
const fishPattern = e => Math.min(5, ((e.fishVariant || 0) >>> 8) & 255) + 1;
const yawAngle = (e, partial) => e.prevYaw + (e.yaw - e.prevYaw) * partial;
const pitchAngle = (e, partial) => e.prevPitch + (e.pitch - e.prevPitch) * partial;
const PAINTINGS = {
  Kebab: [16, 16, 0, 0], Aztec: [16, 16, 16, 0], Alban: [16, 16, 32, 0], Aztec2: [16, 16, 48, 0], Bomb: [16, 16, 64, 0], Plant: [16, 16, 80, 0],
  Wasteland: [16, 16, 96, 0], Pool: [32, 16, 0, 32], Courbet: [32, 16, 32, 32], Sea: [32, 16, 64, 32], Sunset: [32, 16, 96, 32], Creebet: [32, 16, 128, 32],
  Wanderer: [16, 32, 0, 64], Graham: [16, 32, 16, 64], Match: [32, 32, 0, 128], Bust: [32, 32, 32, 128], Stage: [32, 32, 64, 128], Void: [32, 32, 96, 128],
  SkullAndRoses: [32, 32, 128, 128], Wither: [32, 32, 160, 128], Fighters: [64, 32, 0, 96], Pointer: [64, 64, 0, 192], Pigscene: [64, 64, 64, 192],
  BurningSkull: [64, 64, 128, 192], Skeleton: [64, 48, 192, 64], DonkeyKong: [64, 48, 192, 112],
};
const STATE_OPAQUE = { blend: 'none' };
const CULLABLE = new Set(['player', 'mob', 'armorstand', 'item', 'xp', 'arrow', 'spectral_arrow', 'trident', 'projectile',
  'llama_spit', 'shulker_bullet', 'dragon_fireball', 'evoker_fangs', 'falling', 'tnt', 'boat', 'minecart', 'crystal']);
const STATE_ALPHA = { blend: 'alpha', depthWrite: false };
const GLINT_PARAMS = new EntityParams().setTint(0.5 * 0.75, 0.25 * 0.75, 0.8 * 0.75, 1).setFullBright(true).setNoLighting(true).setAlphaTest(0);

// UUID.hashCode for default skin selection
function uuidHash(uuid) {
  const hex = uuid.replace(/-/g, '');
  const most = BigInt.asIntN(64, BigInt('0x' + hex.slice(0, 16)));
  const least = BigInt.asIntN(64, BigInt('0x' + hex.slice(16)));
  const hilo = most ^ least;
  return Number(BigInt.asIntN(32, hilo >> 32n)) ^ Number(BigInt.asIntN(32, hilo));
}

// Box with explicit per-face UV rectangles (in texture pixels): faces = { px, nx, py, ny, pz, nz: [u0, v0, u1, v1] }
function uvBoxMesh(w, h, d, faces, texW, texH) {
  const x0 = -w / 2, x1 = w / 2, y0 = -h / 2, y1 = h / 2, z0 = -d / 2, z1 = d / 2;
  const pos = [], uv = [], nor = [];
  const face = (pts, r, n) => {
    const t = [[r[0], r[1]], [r[0], r[3]], [r[2], r[3]], [r[2], r[1]]];
    for (let i = 0; i < 4; i++) { pos.push(...pts[i]); uv.push(t[i][0] / texW, t[i][1] / texH); nor.push(...n); }
  };
  face([[x0, y1, z1], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1]], faces.pz, [0, 0, 1]);
  face([[x1, y1, z0], [x1, y0, z0], [x0, y0, z0], [x0, y1, z0]], faces.nz, [0, 0, -1]);
  face([[x1, y1, z1], [x1, y0, z1], [x1, y0, z0], [x1, y1, z0]], faces.px, [1, 0, 0]);
  face([[x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1]], faces.nx, [-1, 0, 0]);
  face([[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]], faces.py, [0, 1, 0]);
  face([[x0, y0, z1], [x0, y0, z0], [x1, y0, z0], [x1, y0, z1]], faces.ny, [0, -1, 0]);
  return entityMesh(pos, uv, nor, null, { quads: true });
}

// Camera facing unit quad in FORMAT.color (centred), uv rect given
function spriteMesh(device, u0, v0, u1, v1, w = 1, h = 1) {
  const x = w / 2, y = h / 2;
  const data = new Float32Array([
    -x, y, 0, u0, v0, 1, 1, 1, 1,
    -x, -y, 0, u0, v1, 1, 1, 1, 1,
    x, -y, 0, u1, v1, 1, 1, 1, 1,
    x, y, 0, u1, v0, 1, 1, 1, 1,
  ]);
  return device.createMesh(FORMAT.color, data, { quads: true });
}

export class EntityRenderer {
  constructor(game) {
    this.game = game;
    this.r = game.renderer;
    this.device = game.device;
    this.group = game.renderer.entityRoot;
    this.visuals = new Map();
    this.skins = new Map(); // uuid -> { path, slim, texture?, legacy }
    this.resolve = (t) => (typeof t === 'function' ? t() : game.assets.texture(t));
    this.fire = new EntityFire(game);
    this.effects = new EntityEffects(game);
    this.meshCache = new Map();
    this.atlasTex = () => game.assets.atlasTexture;

  }

  // Drop everything (resource reload / world change)
  reset() {
    this.effects.reset();
    for (const id of [...this.visuals.keys()]) this.remove({ id });
    for (const m of this.meshCache.values()) this.device.destroyMesh(m);
    this.meshCache.clear();
    this._guiModel = null;
  }

  _cachedMesh(key, make) {
    let m = this.meshCache.get(key);
    if (m === undefined) { m = make(); this.meshCache.set(key, m); }
    return m;
  }

  remove(e) {
    this.effects.remove(e.id);
    const v = this.visuals.get(e.id);
    if (!v) return;
    this.group.remove(v.root);
    if (v.line) this.group.remove(v.line);
    for (const m of v.ownMeshes || []) this.device.destroyMesh(m);
    destroyTextMeshes(this.device, v.tagMeshes);
    this.visuals.delete(e.id);
  }

  tick() {}

  // ---------------------------------------------------------------- skins

  // The player's textures property from the tab list (null until the server sends one)
  _texturesProp(uuid) {
    const info = this.game.scoreboard.players && this.game.scoreboard.players.get(uuid);
    const prop = info && info.properties && info.properties.find((p) => p.name === 'textures');
    return prop ? prop.value : null;
  }

  // NetworkPlayerInfo / SkinManager.loadProfileTextures: skin and cape from the player's textures property. The record
  // is redone when the property arrives or changes (the model may be drawn before the tab list entry). With no textures
  // from the server, the local player falls back to its own Mojang profile when the server's UUID is the account's.
  skinFor(e) {
    const value = this._texturesProp(e.uuid);
    let s = this.skins.get(e.uuid);
    if (s && (s.propValue === value || (value === null && s.propValue !== undefined && s.fromSession))) return s;
    const slim = (uuidHash(e.uuid) & 1) === 1;
    const fresh = { path: slim ? 'entity/alex.png' : 'entity/steve.png', slim, texture: null, propValue: value };
    if (s) this._rebuild(e.uuid);
    s = fresh;
    this.skins.set(e.uuid, s);
    if (value) this._loadTextures(s, e.uuid, value);
    else {
      if(e.uuid&&uuidSkinProxyAvailable())this._loadSkin(s,e.uuid,null);
      if(e.uuid&&e.uuid===this.game.playerUuid)this._sessionTextures(s,e.uuid);
    }
    return s;
  }

  _sessionTextures(s, uuid) {
    const acc = this.game.accounts && this.game.accounts.active();
    if (!acc || acc.type !== 'microsoft' || !acc.uuid || acc.uuid.replace(/-/g, '') !== uuid.replace(/-/g, '')) return;
    s.fromSession = true;
    fetchSkinProfile(uuid).then((j) => {
      const prop = (j.properties || []).find((p) => p.name === 'textures');
      if (prop && this.skins.get(uuid) === s) this._loadTextures(s, uuid, prop.value);
    }).catch(() => {});
  }

  _loadSkin(s, uuid, url) {
    fetchSkin(url, uuid).then((bytes) => {
          if (this.skins.get(uuid) !== s) return;
          // ImageBufferDownload.parseUserSkin: 64x64 layout, opaque base layer
          const img = parseUserSkin(decodePng(bytes));
          s.legacy = false;
          s.image = img;
          s.texture = this.game.assets.makeTexture('skin:' + uuid, img.width, img.height, img.data);
          this._rebuild(uuid);
        }).catch(() => {});
  }

  _loadTextures(s, uuid, value) {
    try {
      const tj = JSON.parse(decodeUtf8(decodeBase64(value)));
      const skin = tj.textures && tj.textures.SKIN;
      if(!skin?.url&&uuidSkinProxyAvailable())this._loadSkin(s,uuid,null);
      if (skin && skin.url) {
        s.slim = !!(skin.metadata && skin.metadata.model === 'slim');
        this._loadSkin(s, uuid, skin.url);
      }
      // Mojang capes (LayerCape, and LayerElytra without an elytra texture) and elytra textures, used as downloaded
      for (const [type, key] of [['CAPE', 'cape'], ['ELYTRA', 'elytra']]) {
        const t = tj.textures && tj.textures[type];
        if (!t || !t.url) continue;
        fetchSkin(t.url, uuid, key).then((bytes) => {
          if (this.skins.get(uuid) !== s) return;
          const img = decodePng(bytes);
          s[key] = this.game.assets.makeTexture(key + ':' + uuid, img.width, img.height, img.data);
          this._rebuild(uuid);
        }).catch(() => {});
      }
    } catch (err) { /* bad property */ }
  }

  // Texture reference for a skin (falls back to the default skin until loaded)
  skinTex(s) { return () => s.texture || this.game.assets.texture(s.path); }

  // Changing the HTTP template must also discard failed/pending downloads and the local hand skin.
  reloadSkins() {
    const known = new Set(this.skins.keys());
    for (const [id,v] of this.visuals) if (known.has(v.uuid)) this.remove({id});
    this.skins.clear(); this._guiModel = null;
    this.game.handRenderer?.invalidateSkin();
  }

  _rebuild(uuid) {
    for (const [id, v] of this.visuals) if (v.uuid === uuid) { const e = this.game.entities.get(id); if (e) this.remove(e); }
    if (uuid === this.game.playerUuid) {
      this._guiModel = null;
      if (this.game.handRenderer) this.game.handRenderer.invalidateSkin();
    }
  }

  // Texture (or path) of a player's skin, for GUI drawing (tab list faces)
  skinImage(p) {
    const s = this.skinFor({ uuid: p.uuid });
    return s.texture || s.path;
  }

  // ---------------------------------------------------------------- building visuals

  _texFor(e) {
    if (e.kind === 'player') return null;
    if (e.kind === 'armorstand') return 'entity/armorstand/wood.png';
    const t = e.type;
    switch (t) {
      case 50: return 'entity/creeper/creeper.png';
      case 51: return e.wither ? 'entity/skeleton/wither_skeleton.png' : e.stray ? 'entity/skeleton/stray.png' : 'entity/skeleton/skeleton.png';
      case 52: return 'entity/spider/spider.png';
      // RenderZombieVillager (1.11+): textures by profession; RenderHusk
      case 53: case 54: return e.villagerZombie ? 'entity/zombie_villager/zombie_villager.png'
        : e.husk ? 'entity/zombie/husk.png' : 'entity/zombie/zombie.png';
      case 55: return 'entity/slime/slime.png';
      case 56: return e.attacking ? 'entity/ghast/ghast_shooting.png' : 'entity/ghast/ghast.png';
      case 57: return 'entity/zombie_pigman.png';
      case 58: return 'entity/enderman/enderman.png';
      case 59: return 'entity/spider/cave_spider.png';
      case 60: return 'entity/silverfish.png';
      case 61: return 'entity/blaze.png';
      case 62: return 'entity/slime/magmacube.png';
      case 64: return 'entity/wither/wither.png';
      case 65: return 'entity/bat.png';
      case 66: return 'entity/witch.png';
      case 67: return 'entity/endermite.png';
      case 68: return e.elder ? 'entity/guardian_elder.png' : 'entity/guardian.png';
      case 69: return 'entity/shulker/shulker' + (ENTITY_DYES[e.shulkerColor] ? '_' + ENTITY_DYES[e.shulkerColor] : '') + '.png';
      case 90: return 'entity/pig/pig.png';
      case 91: return 'entity/sheep/sheep.png';
      case 92: return 'entity/cow/cow.png';
      case 93: return 'entity/chicken.png';
      case 94: return 'entity/squid.png';
      case 95: return e.tamed ? 'entity/wolf/wolf_tame.png' : e.angry ? 'entity/wolf/wolf_angry.png' : 'entity/wolf/wolf.png';
      case 96: return 'entity/cow/'+(e.mooshroomType==='brown'?'brown':'red')+'_mooshroom.png';
      case 97: return 'entity/snow_golem.png';
      case 98: return 'entity/cat/' + (CAT_TEX[e.catType || 0] || 'ocelot') + '.png';
      case 99: return 'entity/iron_golem.png';
      case 100: {
        const ht = e.horseType || 0;
        if (ht === 1) return 'entity/horse/donkey.png';
        if (ht === 2) return 'entity/horse/mule.png';
        if (ht === 3) return 'entity/horse/horse_zombie.png';
        if (ht === 4) return 'entity/horse/horse_skeleton.png';
        return 'entity/horse/horse_' + (HORSE_COLORS[(e.horseVariant || 0) & 0xff] || 'white') + '.png';
      }
      case 101: return 'entity/rabbit/' + (e.rabbitType === 99 ? 'caerbannog' : (RABBIT_TEX[e.rabbitType || 0] || 'brown')) + '.png';
      case 120: return 'entity/villager/villager.png';
      case 'wandering_trader': return 'entity/wandering_trader.png';
      case 'trader_llama': return 'entity/llama/' + (LLAMA_TEX[e.llamaVariant] || LLAMA_TEX[0]) + '.png';
      case 'cat': return 'entity/cat/'+(['tabby','black','red','siamese','british_shorthair','calico','persian','ragdoll','white','jellie','all_black'][e.catType||0]||'tabby')+'.png';
      case 'fox': return 'entity/fox/'+(e.foxType===1?'snow_fox':'fox')+'.png';
      case 'panda': return 'entity/panda/panda.png';
      case 'ravager': return 'entity/illager/ravager.png';
      case 'pillager': return 'entity/illager/pillager.png';
      case 'polar_bear': return 'entity/bear/polarbear.png';
      case 'llama': return 'entity/llama/' + (LLAMA_TEX[e.llamaVariant] || LLAMA_TEX[0]) + '.png';
      case 'parrot': return 'entity/parrot/parrot_' + (PARROT_TEX[e.parrotVariant] || PARROT_TEX[0]) + '.png';
      case 'vex': return 'entity/illager/vex' + (e.charging ? '_charging' : '') + '.png';
      case 'evoker': case 'vindicator': case 'illusioner': return 'entity/illager/' + e.type + '.png';
      case 'drowned': return 'entity/zombie/drowned.png';
      case 'cod': case 'salmon': case 'pufferfish': return 'entity/fish/' + e.type + '.png';
      case 'tropical_fish': return 'entity/fish/tropical_' + (fishShape(e) ? 'b' : 'a') + '.png';
      case 'dolphin': return 'entity/dolphin.png';
      case 'turtle': return 'entity/turtle/big_sea_turtle.png';
      case 'phantom': return 'entity/phantom.png';
      default: return null;
    }
  }

  _modelFor(e) {
    if (e.kind === 'player') {
      const s = this.skinFor(e);
      return M.playerModel(s.slim, 64, 64);
    }
    if (e.kind === 'armorstand') return M.armorStand();
    switch (e.type) {
      case 50: return M.creeper();
      case 51: return M.skeleton();
      case 52: case 59: return M.spider();
      case 53: case 54: return M.zombie(64, 64, !!e.villagerZombie);
      case 57: return M.zombie(64, 64);
      case 55: return M.slime(false);
      case 56: return M.ghast();
      case 58: return M.enderman();
      case 60: return M.silverfish();
      case 61: return M.blaze();
      case 62: return M.magmaCube();
      case 64: return M.wither();
      case 65: return M.bat();
      case 66: return M.villager(64, 128, true);
      case 67: return M.endermite();
      case 68: return M.guardian();
      case 69: return M.shulker();
      case 90: return M.pig();
      case 91: return M.sheep(false);
      case 92: case 96: return M.cow();
      case 93: return M.chicken();
      case 94: return M.squid();
      case 95: return M.wolf();
      case 97: return M.snowman();
      case 98: return M.ocelot();
      case 99: return M.ironGolem();
      case 100: return M.horse(e.horseType || 0);
      case 101: return M.rabbit();
      case 120: case 'wandering_trader': return M.villager(64, 64, false);
      case 'trader_llama': return M.llama();
      case 'cat': return M.cat();
      case 'fox': return M.fox();
      case 'panda': return M.panda();
      case 'ravager': return M.ravager();
      case 'pillager': return M.illager('pillager');
      case 'polar_bear': return M.polarBear();
      case 'llama': return M.llama();
      case 'parrot': return M.parrot(e.parrotVariant);
      case 'vex': return M.vex();
      case 'evoker': case 'vindicator': case 'illusioner': return M.illager(e.type);
      case 'drowned': return M.drowned();
      case 'cod': return M.cod();
      case 'salmon': return M.salmon();
      case 'pufferfish': return M.pufferfish(e.puffState || 0);
      case 'tropical_fish': return M.tropicalFish(fishShape(e));
      case 'dolphin': return M.dolphin();
      case 'turtle': return M.turtle();
      case 'phantom': return M.phantom(e.phantomSize || 0);
      default: return null;
    }
  }

  // Metadata can change geometry/layers without changing the base texture (puff
  // size, fish patterns, phantom size, horse markings). Don't leave stale models.
  _livingKey(e) {
    return [e.type, this._texFor(e), e.puffState || 0, e.fishVariant || 0, e.phantomSize || 0,
      e.horseVariant || 0, e.horseType || 0,e.villagerType??2,e.profession??0,e.villagerLevel??1,!!e.child].join('|');
  }

  _visualKey(e) {
    if (e.kind === 'mob') return this._livingKey(e);
    if (e.kind === 'boat') return 'boat:' + (e.boatType || 0);
    if (e.kind === 'minecart') return ['cart', e.cartType, e.customDisplay, e.displayBlock, e.displayOffset, e.furnacePowered].join(':');
    if (e.kind === 'crystal') return 'crystal:' + (e.showBottom !== false);
    if (e.kind === 'projectile') return ['projectile', e.type, e.invulnerable,
      e.item ? this.game.itemRenderer.iconKey(e.item) : ''].join(':');
    return e.kind;
  }

  _makeModelObject(model, mat) {
    const g = new Node();
    for (const r of model.roots) g.add(r.build());
    for (const r of model.roots) r.setMaterial(mat);
    return g;
  }

  // LayerMooshroomMushroom: red mushroom block models, two on the back and one on the head
  _addMushrooms(v, model, mushroom='red_mushroom') {
    const bm = this.game.assets.modelStore.bakeVariant(mushroom, {}, 'normal', 0);
    const mesh = bm && this.game.itemRenderer.blockMesh({ baked: bm, name: mushroom });
    if (!mesh) return;
    const mat = this._mat(v, this.atlasTex, { alphaTest: 0.1 });
    // block meshes are centred, so translate(-0.5, -0.5, 0.5) becomes (0, 0, 1) plus the block's centre offset
    const block = () => { const n = new Node(); n.position.set(0, 0, 1); n.addDrawable(mesh, mat); return n; };
    const chain = (ops, leaf) => {
      let root = null, cur = null;
      for (const [k, x, y, z] of ops) {
        const n = new Node();
        if (k === 't') n.position.set(x, y, z); else if (k === 's') n.scale.set(x, y, z); else n.rotation.set(0, x * D2R, 0);
        if (cur) cur.add(n); else root = n;
        cur = n;
      }
      cur.add(leaf);
      return root;
    };
    const back = new Node();
    back.position.set(0, -1.5078125, 0);
    back.add(chain([['s', 1, -1, 1], ['t', 0.2, 0.35, 0.5], ['r', 42]], (() => {
      const g = new Node();
      g.add(block());
      g.add(chain([['t', 0.1, 0, -0.6], ['r', 42]], block()));
      return g;
    })()));
    v.scaleGroup.add(back);
    v.mushroomBack = back;
    if (model.parts.head && model.parts.head.obj) {
      const h = new Node(); h.scale.set(16, 16, 16); // undo the 1/16 model units: head.postRender(0.0625)
      h.add(chain([['s', 1, -1, 1], ['t', 0, 0.7, -0.2], ['r', 12]], block()));
      model.parts.head.obj.add(h);
      v.mushroomHead = h;
    }
  }

  _mat(v, tex, opts) {
    const m = entityMaterial(tex, opts);
    v.materials.push(m);
    return m;
  }

  _buildLiving(e) {
    const v = { root: new Node(), materials: [], layers: [], kind: 'living', uuid: e.uuid };
    const texPath = this._texFor(e);
    const tex = e.kind === 'player' ? this.skinTex(this.skinFor(e)) : texPath;
    v.texPath = texPath;
    v.modelKey = this._livingKey(e);
    const model = this._modelFor(e);
    if (!model || !tex) throw new Error('Unsupported living entity renderer: ' + (e.entityName || e.type));
    const mat = this._mat(v, tex, { alphaTest: 0.1, cull: !(e.kind === 'player' || e.type === 68), ...model.materialOptions });
    v.mainMat = mat;
    v.model = model;
    // Entity space: rotate Y (180 - bodyYaw), scale(-1,-1,1), translate(0,-1.5078125,0), parts in 1/16 units
    v.yawGroup = new Node();
    v.scaleGroup = new Node();
    v.modelGroup = new Node();
    v.modelGroup.scale.set(1 / 16, 1 / 16, 1 / 16);
    v.root.add(v.yawGroup);
    v.yawGroup.add(v.scaleGroup);
    v.scaleGroup.add(v.modelGroup);
    const bodyObject = this._makeModelObject(model, mat);
    v.bodyDrawables = [];
    bodyObject.traverse(n => v.bodyDrawables.push(...n.drawables));
    v.modelGroup.add(bodyObject);
    // Overlay layers
    const addLayer = (m, tex2, opts = {}) => {
      const lm = this._mat(v, tex2, { alphaTest: 0.1, ...opts });
      const obj = this._makeModelObject(m, lm);
      v.modelGroup.add(obj);
      v.layers.push({ model: m, mat: lm, obj, ...opts });
      return v.layers[v.layers.length - 1];
    };
    if (e.kind === 'mob') {
      if(e.type===120||e.villagerZombie)for(const layer of villagerLayers(e,this.game.assets.villagerHats)){
        const layerModel=e.villagerZombie?M.zombie(64,64,true):M.villager();
        addLayer(layerModel,layer.texture,{hideHat:!!layer.hideHat,cull:false});
      }
      if(e.type==='trader_llama')addLayer(M.llama(true),'entity/llama/decor/trader_llama.png',{cull:false});
      if (e.type === 91) v.wool = addLayer(M.sheep(true), 'entity/sheep/sheep_fur.png');
      if (e.type === 52 || e.type === 59) addLayer(M.spider(), 'entity/spider_eyes.png', { fullBright: true, transparent: true, additive: true, depthWrite: false, eyes: true });
      if (e.type === 58) addLayer(M.enderman(), 'entity/enderman/enderman_eyes.png', { fullBright: true, transparent: true, additive: true, depthWrite: false, eyes: true });
      if (e.type === 55) v.slimeOuter = addLayer(M.slime(true), 'entity/slime/slime.png', { transparent: true, depthWrite: true });
      if (e.type === 90) v.saddle = addLayer(M.pig(), 'entity/pig/pig_saddle.png');
      if (e.type === 50) v.charge = addLayer(M.creeper(), () => this.game.assets.texture('entity/creeper/creeper_armor.png', { wrap: 'repeat' }), { transparent: true, additive: true, fullBright: true, depthWrite: false, charge: true });
      if (e.type === 100) {
        const markings = ['', 'white', 'whitefield', 'whitedots', 'blackdots'][((e.horseVariant || 0) >> 8) & 0xff];
        if (markings && (e.horseType || 0) === 0) addLayer(M.horse(), 'entity/horse/horse_markings_' + markings + '.png');
      }
      if (e.stray) addLayer(M.biped('strayOverlay'), 'entity/skeleton/stray_overlay.png');
      if (e.type === 'drowned') addLayer(M.drowned(true), 'entity/zombie/drowned_outer_layer.png', { cull: false });
      if (e.type === 'llama') v.llamaDecor = addLayer(M.llama(true), 'entity/llama/decor/white.png', { cull: false });
      if (e.type === 'tropical_fish') {
        v.fishPattern = addLayer(M.tropicalFish(fishShape(e), true),
          'entity/fish/tropical_' + (fishShape(e) ? 'b' : 'a') + '_pattern_' + fishPattern(e) + '.png', { cull: false });
      }
      if (e.type === 'phantom') addLayer(M.phantom(e.phantomSize || 0), 'entity/phantom_eyes.png',
        { fullBright: true, transparent: true, additive: true, depthWrite: false, eyes: true, cull: false });
      if (e.type === 51 || e.type === 53 || e.type === 54 || e.type === 57 || e.type === 'drowned') this._addArmorLayers(v, e);
      if (e.type === 96) v.mushroomLayer = true;
    }
    if (e.kind === 'player' || e.kind === 'armorstand') {
      this._addArmorLayers(v, e);
      // LayerElytra: translate(0, 0, 0.125) in model space
      const em = M.elytra();
      // LayerElytra: the player's own elytra texture, else their cape (while the cape part is shown), else the default
      const esk = e.kind === 'player' ? this.skinFor(e) : null;
      const emat = this._mat(v, () => {
        if (esk && esk.elytra) return esk.elytra;
        const flags = e.skinFlags !== undefined ? e.skinFlags : 0x7f;
        if (esk && esk.cape && (flags & 1)) return esk.cape;
        return this.game.assets.texture('entity/elytra.png');
      }, { alphaTest: 0.1, cull: false });
      const eobj = this._makeModelObject(em, emat);
      eobj.position.z = 2;
      v.modelGroup.add(eobj);
      v.elytra = { model: em, obj: eobj };
    }
    if (e.kind === 'player') {
      // LayerCape: ModelPlayer.bipedCape, translate(0, 0, 0.125) then the sway rotations (set each frame)
      const sk = this.skinFor(e);
      if (sk.cape && model.parts.cape) {
        const cmat = this._mat(v, () => sk.cape, { alphaTest: 0.1, cull: false });
        const holder = new Node();
        holder.position.z = 2;
        holder.add(model.parts.cape.build());
        model.parts.cape.setMaterial(cmat);
        v.modelGroup.add(holder);
        v.cape = { holder, part: model.parts.cape };
      }
    }
    v.atlasMat = this._mat(v, this.atlasTex, { alphaTest: 0.1, transparent: true }); // RenderItem blends
    // Held item holders (LayerHeldItem: one per arm)
    v.itemHolder = null; v.leftHolder = null;
    if (model.parts && model.parts.rightArm && model.parts.rightArm.obj) {
      const h = new Node();
      h.scale.set(16, 16, 16);
      model.parts.rightArm.obj.add(h);
      v.itemHolder = h;
    }
    if (model.parts && model.parts.leftArm && model.parts.leftArm.obj) {
      const h = new Node();
      h.scale.set(16, 16, 16);
      model.parts.leftArm.obj.add(h);
      v.leftHolder = h;
    }
    if (model.parts && model.parts.head && model.parts.head.obj && (e.kind === 'player' || e.kind === 'mob' || e.kind === 'armorstand')) {
      const h = new Node();
      h.scale.set(16, 16, 16);
      model.parts.head.obj.add(h);
      v.headHolder = h;
    }
    if (v.mushroomLayer) this._addMushrooms(v, model,e.mooshroomType==='brown'?'brown_mushroom':'red_mushroom');
    this._addShadow(v);
    return v;
  }

  // RenderDragon + ModelDragon: one node tree, rendered with the dragon texture and the glowing eyes layer
  _buildDragon(e) {
    const v = { root: new Node(), materials: [], kind: 'dragon', uuid: e.uuid };
    const mat = this._mat(v, 'entity/enderdragon/dragon.png', { alphaTest: 0.1 });
    const eyes = this._mat(v, 'entity/enderdragon/dragon_eyes.png', { fullBright: true, transparent: true, additive: true, depthWrite: false });
    const M = M_dragon();
    const unit = new Node();
    unit.scale.set(1 / 16, 1 / 16, 1 / 16);
    const add = (part, parent) => { parent.add(part.build()); part.setMaterial(mat); return part; };
    v.neck = []; v.tail = [];
    for (let i = 0; i < 5; i++) v.neck.push(add(M.spine(), unit));
    v.head = add(M.head, unit);
    v.jaw = M.jaw;
    v.bodyFrame = new Node();
    unit.add(v.bodyFrame);
    add(M.body, v.bodyFrame);
    v.sides = [];
    const mirror = new Node();
    mirror.scale.set(-1, 1, 1);
    for (const holder of [v.bodyFrame, mirror]) {
      const L = M.limbs();
      for (const k of ['wing', 'frontLeg', 'rearLeg']) add(L[k], holder);
      v.sides.push(L);
    }
    v.bodyFrame.add(mirror);
    for (let i = 0; i < 12; i++) v.tail.push(add(M.spine(), unit));
    v.dragonMask = this._mat(v, 'entity/enderdragon/dragon_exploding.png', { colorWrite: false, cull: false });
    v.dragonSkin = mat; v.dragonEyes = eyes; v.dragonMaskDraws = [];
    unit.traverse(n => { for (const d of [...n.drawables]) {
      const mask = { ...d, mat: v.dragonMask, order: -1, visible: false };
      n.drawables.push(mask); v.dragonMaskDraws.push(mask);
    }});
    // LayerEnderDragonEyes: the same geometry again with the eyes texture
    unit.traverse((n) => { for (const d of [...n.drawables]) if (d.mat === mat) n.drawables.push({ ...d, mat: eyes, order: 2 }); });
    for (const m of v.materials) m.state = { ...m.state, cull: false };
    v.corpse = new Node();
    v.offset = new Node();
    v.root.add(v.corpse);
    v.corpse.add(v.offset);
    v.offset.add(unit);
    v.all = [M.head, ...v.neck, ...v.tail, M.body, ...v.sides.flatMap((L) => [L.wing, L.frontLeg, L.rearLeg])];
    return v;
  }

  _renderDragon(e, v, partial) {
    const wrap = (a) => { a %= 360; if (a >= 180) a -= 360; if (a < -180) a += 360; return a; };
    // EntityDragon.getMovementOffsets
    const off = (i) => {
      const pt = e.dead ? 0 : 1 - partial;
      const j = (e.ringIdx - i) & 63, k = (e.ringIdx - i - 1) & 63;
      const a = e.ring[j], b = e.ring[k];
      return [a[0] + wrap(b[0] - a[0]) * pt, a[1] + (b[1] - a[1]) * pt];
    };
    if (!e.ring) return;
    // RenderDragon.rotateCorpse, then RendererLivingEntity's scale(-1,-1,1) / translate(0,-1.5078125,0)
    const cm = dragonCorpseMatrix(e, partial);
    v.corpse.matrix = cm;
    const dying = e.deathTime > 0;
    for (const d of v.dragonMaskDraws) d.visible = dying;
    v.dragonMask.params.setAlphaTest((e.deathTime || 0) / 200 + 1e-6);
    v.dragonSkin.state.depthFunc = dying ? 'equal' : undefined;
    v.dragonEyes.state.depthFunc = dying ? 'equal' : undefined;
    // ModelDragon.render
    const f = e.prevAnimTime + (e.animTime - e.prevAnimTime) * partial;
    const TAU = Math.PI * 2;
    v.jaw.rx = (Math.sin(f * TAU) + 1) * 0.2;
    let f1 = Math.sin(f * TAU - 1) + 1;
    f1 = (f1 * f1 + f1 * 2) * 0.05;
    const om = mat4.create();
    mat4.translate(om, om, 0, f1 - 2, -3);
    mat4.rotateX(om, om, f1 * 2 * D2R);
    v.offset.matrix = om;
    const f5 = 1.5;
    const a6 = off(6);
    const f6 = wrap(off(5)[0] - off(10)[0]);
    const f7 = wrap(off(5)[0] + f6 / 2);
    const f8 = f * TAU;
    let y = 20, z = -12, x = 0;
    for (let i = 0; i < 5; i++) {
      const a = off(5 - i), s = v.neck[i];
      s.ry = wrap(a[0] - a6[0]) * D2R * f5;
      s.rx = Math.cos(i * 0.45 + f8) * 0.15 + (a[1] - a6[1]) * D2R * f5 * 5;
      s.rz = -wrap(a[0] - f7) * D2R * f5;
      s.px = x; s.py = y; s.pz = z;
      y += Math.sin(s.rx) * 10; z -= Math.cos(s.ry) * Math.cos(s.rx) * 10; x -= Math.sin(s.ry) * Math.cos(s.rx) * 10;
    }
    const a0 = off(0), H = v.head;
    H.px = x; H.py = y; H.pz = z;
    H.ry = wrap(a0[0] - a6[0]) * D2R;
    H.rz = -wrap(a0[0] - f7) * D2R;
    const bm = mat4.create();
    mat4.translate(bm, bm, 0, 16, 0);
    mat4.rotateZ(bm, bm, -f6 * f5 * D2R);
    mat4.translate(bm, bm, 0, -16, 0);
    v.bodyFrame.matrix = bm;
    for (const L of v.sides) {
      L.wing.rx = 0.125 - Math.cos(f8) * 0.2; L.wing.ry = 0.25; L.wing.rz = (Math.sin(f8) + 0.125) * 0.8;
      L.wingTip.rz = -(Math.sin(f8 + 2) + 0.5) * 0.75;
      L.rearLeg.rx = 1 + f1 * 0.1; L.rearLegTip.rx = 0.5 + f1 * 0.1; L.rearFoot.rx = 0.75 + f1 * 0.1;
      L.frontLeg.rx = 1.3 + f1 * 0.1; L.frontLegTip.rx = -0.5 - f1 * 0.1; L.frontFoot.rx = 0.75 + f1 * 0.1;
    }
    let f10 = 0;
    y = 10; z = 60; x = 0;
    const a11 = off(11);
    for (let k = 0; k < 12; k++) {
      const a = off(12 + k), s = v.tail[k];
      f10 += Math.sin(k * 0.45 + f8) * 0.05;
      s.ry = (wrap(a[0] - a11[0]) * f5 + 180) * D2R;
      s.rx = f10 + (a[1] - a11[1]) * D2R * f5 * 5;
      s.rz = wrap(a[0] - f7) * D2R * f5;
      s.px = x; s.py = y; s.pz = z;
      y += Math.sin(s.rx) * 10; z -= Math.cos(s.ry) * Math.cos(s.rx) * 10; x -= Math.sin(s.ry) * Math.cos(s.rx) * 10;
    }
    for (const part of v.all) part.sync();
    // hurt flash (RendererLivingEntity)
    const overlay = e.hurtTime > 0 ? 0.3 : 0;
    for (const m of v.materials) m.params.setOverlay(1, 0, 0, overlay);
  }

  _addArmorLayers(v, e) {
    v.armor = [];
    for (let slot = 1; slot <= 4; slot++) {
      const inner = slot === 2;
      const m = M.armorModel(inner ? 0.5 : 1.0);
      const mat = this._mat(v, 'models/armor/iron_layer_1.png', { alphaTest: 0.1 });
      const obj = this._makeModelObject(m, mat);
      obj.visible = false;
      v.modelGroup.add(obj);
      const overlayMat = this._mat(v, 'models/armor/leather_layer_1_overlay.png', { alphaTest: 0.1 });
      const m2 = M.armorModel(inner ? 0.5 : 1.0);
      const obj2 = this._makeModelObject(m2, overlayMat);
      obj2.visible = false;
      v.modelGroup.add(obj2);
      v.armor[slot] = { model: m, obj, mat, slot, inner, overlay: { model: m2, obj: obj2, mat: overlayMat }, key: null };
    }
    void e;
  }

  _addShadow(v) {
    const n = new Node();
    v.shadowParams = colorParams(1, 1, 1, 0.5, 0, 1);
    v.shadowMesh=this.device.createMesh(FORMAT.color,new Float32Array(0),{quads:true,dynamic:true});
    (v.ownMeshes ||= []).push(v.shadowMesh);
    n.addDrawable(v.shadowMesh, material('color', 'misc/shadow.png', v.shadowParams, { blend: 'alpha', depthWrite: false, polygonOffset: true }), { order: 3 });
    v.shadow = n;
    v.root.add(n);
  }

  _blockObject(state, mat) {
    const g = this.game;
    const def = getBlock(state);
    if (def && !def.hasModel) {
      const item = g.items?.byName.get(def.name);
      return item ? this._itemObject({ id: item.id, count: 1, damage: 0 }, mat)?.obj || null : null;
    }
    const rs = resolveState(state, () => 0, 0, 0, 0);
    if (!rs) return null;
    const bm = g.assets.modelStore.bakeVariant(rs.file, rs.props, rs.variant, 0);
    if (!bm) return null;
    const mesh = g.itemRenderer.blockMesh({ baked: bm, name: rs.file + '#' + state });
    if (!mesh) return null;
    return new Node().addDrawable(mesh, mat);
  }

  _itemObject(item, mat) {
    return this.game.itemRenderer.objectFor(item, mat);
  }

  _build(e) {
    let v;
    const atlasOnly = (kind) => {
      const vv = { root: new Node(), kind, materials: [] };
      vv.atlasMat = this._mat(vv, this.atlasTex, { alphaTest: 0.1, transparent: true });
      return vv;
    };
    switch (e.kind) {
      case 'player': case 'mob': case 'armorstand': v = e.kind === 'mob' && e.type === 63 ? this._buildDragon(e) : this._buildLiving(e); break;
      case 'item': {
        v = atlasOnly('item');
        v.itemKey = null;
        this._addShadow(v);
        break;
      }
      case 'xp': {
        const size = e.count >= 2477 ? 10 : e.count >= 1237 ? 9 : e.count >= 617 ? 8 : e.count >= 307 ? 7 : e.count >= 149 ? 6 : e.count >= 73 ? 5 : e.count >= 37 ? 4 : e.count >= 17 ? 3 : e.count >= 7 ? 2 : e.count >= 3 ? 1 : 0;
        const u0 = (size % 4) * 16 / 64, v0 = Math.floor(size / 4) * 16 / 64;
        const mesh = this._cachedMesh('xp' + size, () => spriteMesh(this.device, u0, v0, u0 + 0.25, v0 + 0.25));
        v = { root: new Node(), kind: 'xp', materials: [] };
        v.params = colorParams(1, 1, 1, 1, 0.01, 1);
        const sp = new Node();
        sp.billboard = true;
        sp.scale.setScalar(0.3);
        sp.addDrawable(mesh, material('color', 'entity/experience_orb.png', v.params, { blend: 'add', depthWrite: false }), { order: 4 });
        v.sprite = sp;
        v.root.add(sp);
        break;
      }
      case 'arrow': case 'spectral_arrow': {
        v = { root: new Node(), kind: 'arrow', materials: [] };
        const mat = this._mat(v, 'entity/projectiles/' + (e.kind === 'spectral_arrow' ? 'spectral_arrow' : 'arrow') + '.png', { alphaTest: 0.1 });
        v.inner = new Node();
        v.inner.addDrawable(this._cachedMesh('arrow', arrowMesh), mat);
        v.root.add(v.inner);
        break;
      }
      case 'projectile': {
        const itemName = { 61: 'snowball', 62: 'egg', 65: 'ender_pearl', 72: 'ender_eye', 73: 'splash_potion',
          75: 'experience_bottle', 64: 'fire_charge', 63: 'fire_charge', 76: 'firework_rocket' }[e.type];
        const itemId = this.game.items.byName.get(itemName)?.id;
        v = { root: new Node(), kind: 'projectile', materials: [] };
        if (itemId) {
          const ir = this.game.itemRenderer;
          // EntityPotion carries its ItemStack (splash or lingering potion) in metadata
          const item = e.type === 73 && e.item ? e.item : { id: itemId, damage: 0, count: 1 };
          const m = ir.modelFor(item);
          const layer = m.layers && m.layers[m.layers.length > 1 ? 1 : 0];
          const entry = layer ? this.game.assets.atlas.entries.get(layer) : null;
          if (entry) {
            const mesh = this._cachedMesh('sprite:' + layer, () => spriteMesh(this.device, entry.uv[0], entry.uv[1], entry.uv[2], entry.uv[3]));
            v.spriteParams = colorParams(1, 1, 1, 1, 0.1, 1);
            const n = new Node();
            n.billboard = true;
            const s = e.type === 63 ? 2 : 0.5;
            n.scale.setScalar(s);
            n.addDrawable(mesh, material('color', this.atlasTex, v.spriteParams, { blend: 'none' }));
            v.billboard = n;
            v.root.add(n);
            // RenderSnowball draws the whole item: the potion's liquid layer tinted with PotionUtils.getColor
            const over = e.type === 73 && m.layers.length > 1 ? this.game.assets.atlas.entries.get(m.layers[0]) : null;
            if (over) {
              const c = this.game.items.potionColor(item);
              const om = this._cachedMesh('sprite:' + m.layers[0], () => spriteMesh(this.device, over.uv[0], over.uv[1], over.uv[2], over.uv[3]));
              n.addDrawable(om, material('color', this.atlasTex, colorParams(((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255, 1, 0.1, 1), { blend: 'none' }));
            }
          }
        } else if (e.type === 66) {
          // wither skull
          const mat = this._mat(v, e.invulnerable ? 'entity/wither/wither_invulnerable.png' : 'entity/wither/wither.png');
          const { head } = M.blockModel('witherSkull', ['head']); // RenderWitherSkull's ModelSkeletonHead
          const g = new Node(); g.add(head.build()); head.setMaterial(mat);
          g.scale.set(-1 / 16, -1 / 16, 1 / 16);
          v.inner = g; v.root.add(g);
        }
        break;
      }
      case 'trident': case 'llama_spit': case 'shulker_bullet': case 'evoker_fangs': {
        const model = { trident: M.trident, llama_spit: M.llamaSpit, shulker_bullet: M.shulkerBullet, evoker_fangs: M.evokerFangs }[e.kind]();
        v = { root: new Node(), kind: 'jar_projectile', materials: [], model };
        const mat = this._mat(v, model.texture, { alphaTest: 0.1, ...model.materialOptions, fullBright: e.kind === 'shulker_bullet' });
        v.inner = new Node();
        v.inner.add(this._makeModelObject(model, mat));
        v.root.add(v.inner);
        break;
      }
      case 'dragon_fireball': {
        v = { root: new Node(), kind: 'dragon_fireball', materials: [] };
        const sp = new Node(); sp.billboard = true;
        sp.addDrawable(this._cachedMesh('dragon_fireball', () => spriteMesh(this.device, 0, 0, 1, 1, 2, 2)),
          material('color', 'entity/enderdragon/dragon_fireball.png', colorParams(1, 1, 1, 1, 0.1, 1), { blend: 'none' }));
        v.root.add(sp);
        break;
      }
      case 'area_effect_cloud':
        // The vanilla cloud is particle-only; do not invent a solid entity model.
        v = { root: new Node(), kind: 'area_effect_cloud', materials: [] };
        break;
      case 'falling': case 'tnt': {
        v = atlasOnly(e.kind);
        const st = e.kind === 'tnt' ? findState('tnt', { unstable: false }) : e.blockState;
        const o = this._blockObject(st, v.atlasMat);
        if (o) { v.inner = new Node(); v.inner.add(o); v.root.add(v.inner); }
        if (e.kind === 'tnt') {
          // white flash overlay while the fuse runs (RenderTNTPrimed)
          v.flashMat = this._mat(v, this.atlasTex, { alphaTest: 0.1, transparent: true, depthWrite: false });
          v.flashMat.params.setOverlay(1, 1, 1, 1);
          v.flash = this._blockObject(st, v.flashMat);
          if (v.flash && v.inner) v.inner.add(v.flash);
        }
        break;
      }
      case 'boat': case 'minecart': {
        v = atlasOnly(e.kind);
        const model = e.kind === 'boat' ? M.boat() : M.minecart();
        // EntityBoat.Type: 1.13 uses the wood name directly, including dark_oak.
        const mat = this._mat(v, e.kind === 'boat' ? 'entity/boat/' + (['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak'][e.boatType || 0] || 'oak') + '.png' : 'entity/minecart.png');
        v.inner = new Node();
        const mg = new Node();
        mg.scale.set(-1 / 16, -1 / 16, 1 / 16);
        if (e.kind === 'boat') {
          // ModelBoat.render: rotate(90, Y) inside the scaled space; renderMultipass draws noWater depth only
          const r = new Node();
          r.rotation.set(0, Math.PI / 2, 0);
          r.add(this._makeModelObject(model, mat));
          const mask = this._mat(v, mat.tex, { colorWrite: false });
          r.add(this._makeModelObject({ roots: [model.noWater] }, mask));
          mg.add(r);
          v.boatModel = model;
        } else mg.add(this._makeModelObject(model, mat));
        v.inner.add(mg);
        v.root.add(v.inner);
        if (e.kind === 'minecart') {
          const displayName = { 1: 'chest', 2: 'furnace', 3: 'tnt', 4: 'spawner', 5: 'hopper', 6: 'command_block' }[e.cartType];
          const disp = e.customDisplay ? e.displayBlock : displayName ? findState(displayName,
            displayName === 'furnace' ? { facing: 'north', lit: !!e.furnacePowered } : {}) : 0;
          if (disp) {
            const bo = this._blockObject(disp, v.atlasMat);
            if (bo) { bo.scale.set(0.75, 0.75, 0.75); bo.position.set(0, (e.displayOffset !== undefined ? e.displayOffset : 6) / 16 + 0.375 * 0.75 - 0.375 + 0.0625, 0); v.inner.add(bo); }
          }
        }
        this._addShadow(v);
        break;
      }
      case 'painting': {
        v = { root: new Node(), kind: 'painting', materials: [] };
        const art = PAINTINGS[e.title] || PAINTINGS.Kebab;
        const w = art[0] / 16, h = art[1] / 16;
        const back = [192, 0, 208, 16];
        const mesh = this._cachedMesh('painting:' + (e.title || 'Kebab'), () => uvBoxMesh(w, h, 1 / 16, {
          pz: [art[2], art[3], art[2] + art[0], art[3] + art[1]], nz: back, px: back, nx: back, py: back, ny: back,
        }, 256, 256));
        const mat = this._mat(v, 'painting/paintings_kristoffer_zetterstrand.png', { alphaTest: 0.1 });
        v.mesh = new Node().addDrawable(mesh, mat);
        v.root.add(v.mesh);
        e.width = Math.max(w, 0.5); e.height = h;
        break;
      }
      case 'itemframe': {
        v = atlasOnly('itemframe');
        const bm = this.game.assets.modelStore.bakeVariant('item_frame', { map: 'false' }, null, 0);
        if (bm) {
          const mesh = this.game.itemRenderer.blockMesh({ baked: bm, name: 'item_frame' });
          if (mesh) { v.frame = new Node().addDrawable(mesh, v.atlasMat); v.root.add(v.frame); }
        }
        v.itemGroup = new Node();
        v.root.add(v.itemGroup);
        break;
      }
      case 'crystal': {
        v = { root: new Node(), kind: 'crystal', materials: [] };
        const mat = this._mat(v, 'entity/end_crystal/end_crystal.png', { fullBright: true });
        // ModelEnderCrystal (RenderEnderCrystal builds it with the base): base scaled 2, then glass, glass and cube
        const cm = M.blockModel(e.showBottom === false ? 'enderCrystalNoBase' : 'enderCrystal', ['cube', 'glass', 'base']);
        if (cm.base) {
          const bg = new Node(); bg.add(cm.base.build()); cm.base.setMaterial(mat);
          bg.scale.set(2 / 16, 2 / 16, 2 / 16); bg.position.set(0, -1, 0);
          v.root.add(bg);
        }
        v.cubes = [];
        for (const pp of [cm.glass, M.blockModel('enderCrystal', ['cube', 'glass']).glass, cm.cube]) {
          const o = pp.build(); pp.setMaterial(mat);
          const g = new Node(); g.add(o); v.cubes.push(g); v.root.add(g);
        }
        break;
      }
      case 'lightning': {
        v = { root: new Node(), kind: 'lightning', materials: [], ownMeshes: [] };
        break;
      }
      case 'fishhook': {
        v = { root: new Node(), kind: 'fishhook', materials: [], ownMeshes: [] };
        const mesh = this._cachedMesh('fishhook', () => spriteMesh(this.device, 8 / 128, 16 / 128, 16 / 128, 24 / 128));
        const sp = new Node();
        sp.billboard = true;
        sp.scale.setScalar(0.5);
        sp.addDrawable(mesh, material('color', 'particle/particles.png', colorParams(1, 1, 1, 1, 0.1, 1), { blend: 'none' }));
        v.root.add(sp);
        const lineMesh = this.device.createMesh(FORMAT.color, new Float32Array(32 * 9), { dynamic: true });
        v.ownMeshes.push(lineMesh);
        v.lineMesh = lineMesh;
        v.line = new Node().addDrawable(lineMesh, material('color', null, colorParams(0, 0, 0, 1, 0, 1), { blend: 'none' }), { primitive: 'lines' });
        this.group.add(v.line);
        this.game.entities.fishingCast = e.owner === this.game.entityId;
        break;
      }
      case 'leash': {
        v = { root: new Node(), kind: 'leash', materials: [] };
        const mat = this._mat(v, 'entity/lead_knot.png');
        const p = M.blockModel('leash', ['knot']).knot; // ModelLeashKnot
        const g = new Node(); g.add(p.build()); p.setMaterial(mat); g.scale.set(-1 / 16, -1 / 16, 1 / 16); g.position.y = 0.5;
        v.root.add(g);
        break;
      }
      default: return null; // Unsupported identities never borrow an unrelated entity model.
    }
    v.visualKey = this._visualKey(e);
    this.group.add(v.root);
    this.visuals.set(e.id, v);
    return v;
  }

  // ---------------------------------------------------------------- per-frame

  render(partial) {
    const g = this.game;
    const camPos = this.r.camPos;
    const list = [...g.entities.all()];
    const self = g.entities.self;
    if (self) {
      if (g.thirdPerson > 0 && g.cameraEntity == null) list.push(self);
      else { const sv = this.visuals.get(-1); if (sv) sv.root.visible = false; }
    }
    this.glints = [];
    this.frame = (this.frame || 0) + 1;
    const far = (g.settings.renderDistance * 16) ** 2;
    this.stats = { total: list.length, culled: 0, lod: 0 };
    const burning = [];
    for (const e of list) {
      let v = this.visuals.get(e.id);
      if (v && this._visualKey(e) !== v.visualKey) { this.remove(e); v = null; }
      const p = g.entities.interp(e, partial);
      const dx = p.x - camPos[0], dy = p.y - camPos[1], dz = p.z - camPos[2];
      const d2 = dx * dx + dy * dy + dz * dz;
      // RenderArmorStand.canRenderName ignores invisibility: invisible stands with a visible custom name are
      // how servers float text. Equipped items remain visible independently of the body.
      const floatingTag = e.kind === 'armorstand' && e.customName && e.nameVisible;
      const living = e.kind === 'mob' && e.type !== 63 || e.kind === 'player' || e.kind === 'armorstand';
      if (dx * dx + dz * dz > far || (e.invisible && !living)) { if (v) v.root.visible = false; continue; }
      // Entity culling: frustum + sections hidden behind terrain (never the camera's own entity)
      let tagOnly = false;
      if (CULLABLE.has(e.kind) && e.id !== -1) {
        const hw = (e.width || 0.6) / 2 + 0.5, h = (e.height || 1.8) * (e.type === 56 ? 4.5 : 1) + 0.5;
        const visible = this.r.boxVisible(p.x - hw, p.y - 0.5, p.z - hw, p.x + hw, p.y + h, p.z + hw);
        if (!visible) {
          // Vanilla draws player name tags through walls; keep those when only occluded
          const inFrustum = aabbInFrustum(this.r.frustum, p.x - hw, p.y, p.z - hw, p.x + hw, p.y + h + 0.6, p.z + hw);
          if (inFrustum && (e.kind === 'player' || floatingTag) && !e.sneaking && d2 < 64 * 64) tagOnly = true;
          else { if (v) v.root.visible = false; this.stats.culled++; continue; }
        }
      }
      if (!v) v = this._build(e);
      if (!v) continue;
      v.root.visible = true;
      if (v.yawGroup) v.yawGroup.visible = !tagOnly;
      if (tagOnly) {
        v.root.position.set(p.x, p.y, p.z);
        if (v.shadow) v.shadow.visible = false;
        this._updateNameTag(e, v, p);
        continue;
      }
      const interval = v.kind === 'living' && e.id !== -1 ? poseInterval(g.settings, d2) : 1;
      v.lodSkip = interval > 1 && (this.frame + e.id) % interval !== 0;
      if (v.lodSkip) this.stats.lod++;
      v.root.position.set(p.x, p.y, p.z);
      if (e.onFire) burning.push({ e, p });
      const light = this._light(p.x, p.y + (e.eyeHeight || 0.5), p.z);
      for (const m of v.materials) m.params.setLight(light[0], light[1]);
      try {
        switch (v.kind) {
          case 'living': this._renderLiving(e, v, p, partial); updateRiptide(e, v, partial); break;
          case 'dragon': this._renderDragon(e, v, partial); break;
          case 'item': this._renderItem(e, v, p, partial); break;
          case 'xp': this._renderXp(e, v, partial); break;
          case 'arrow': this._renderArrow(e, v, partial); break;
          case 'jar_projectile': this._renderJarProjectile(e, v, partial); break;
          case 'projectile': if (v.inner) v.inner.rotation.set(pitchAngle(e, partial) * D2R, yawAngle(e, partial) * D2R, 0); break;
          case 'area_effect_cloud': this._renderCloud(e, v, p); break;
          case 'falling': if (v.inner) { v.inner.position.set(0, 0.5, 0);v.inner.visible=g.world.getState(Math.floor(e.x),Math.floor(e.y),Math.floor(e.z))!==e.blockState; } break;
          case 'tnt': this._renderTnt(e, v, partial); break;
          case 'boat': case 'minecart': this._renderVehicle(e, v, p, partial); break;
          case 'painting': this._renderPainting(e, v); break;
          case 'itemframe': this._renderFrame(e, v); break;
          case 'crystal': this._renderCrystal(e, v, partial); break;
          case 'lightning': this._renderLightning(e, v); break;
          case 'fishhook': this._renderFishhook(e, v, p, partial); break;
          default: break;
        }
      } catch (err) { console.warn('entity render', e.kind, err); }
      if (v.shadow) this._updateShadow(e, v, p);
    }
    // RenderManager.playerViewY: the camera's yaw (front view looks back)
    let viewYaw = g.player.prevYaw + (g.player.yaw - g.player.prevYaw) * partial;
    if (g.debugCam) viewYaw = g.debugCam.yaw;
    else if (g.thirdPerson === 2) viewYaw += 180;
    this.fire.update(burning, viewYaw);
    this.effects.update(partial);
  }

  // Draw the entity tree (called by the world renderer)
  draw(device, camRot) {
    // model parts sharing a material go out as one draw (scene.js Batcher)
    if (!this.batcher) this.batcher = new Batcher(device, FORMAT.entity);
    drawTree(device, this.group, { camRot, resolve: this.resolve, batcher: this.noBatch ? null : this.batcher });
    for (const node of this.glints || []) this.drawGlint(device, node, null);
  }

  // Enchantment glint (RenderItem.renderEffect): redraw the item meshes with the scrolling glint texture,
  // additive and depth-equal. node must have up-to-date world matrices.
  drawGlint(device, node) {
    const tex = this.game.assets.texture('misc/enchanted_item_glint.png', { wrap: 'repeat' });
    if (!tex) return;
    const t = platform().now();
    const p1 = new EntityParams().setTint(0.5 * 0.75, 0.25 * 0.75, 0.8 * 0.75, 1).setFullBright(true).setNoLighting(true).setAlphaTest(0);
    const state = { blend: 'add', depthWrite: false, depthFunc: 'equal' };
    const meshes = [];
    node.traverse((n) => { if (n.visible) for (const d of n.drawables) if (d.mesh && n.userData.glint) meshes.push({ mesh: d.mesh, world: n.world }); });
    // RenderItem.renderEffect: uv * 8 scrolled by one texture width per period (second pass the other way)
    for (const [period, dir] of [[3000, 1], [4873, -1]]) {
      p1.setUvTransform(dir * (t % period) / period, 0, 8);
      for (const m of meshes) device.draw({ mesh: m.mesh, pipeline: 'entity', textures: [tex], params: new Float32Array(p1.p), model: m.world, state });
    }
    void GLINT_PARAMS;
  }

  _light(x, y, z) {
    const w = this.game.world;
    const bx = Math.floor(x), by = Math.floor(y), bz = Math.floor(z);
    return [w.getSkyLight(bx, by, bz), w.getBlockLight(bx, by, bz)];
  }

  _renderLiving(e, v, p, partial) {
    const g = this.game;
    const lerpAngle = (a, b) => { let d = b - a; while (d < -180) d += 360; while (d >= 180) d -= 360; return a + d * partial; };
    let body = e.kind === 'mob' && e.type === 69 ? 180 : lerpAngle(e.prevBodyYaw, e.bodyYaw); // EntityShulker keeps its body at 180
    const head = lerpAngle(e.prevHeadYaw, e.headYaw);
    // RenderLivingBase.doRender: riding a living mount, the body follows the mount (head within 85 degrees of it)
    const mount = e.riding >= 0 ? g.entities.get(e.riding) : null;
    if (mount && (mount.kind === 'mob' || mount.kind === 'player')) {
      body = lerpAngle(mount.prevBodyYaw, mount.bodyYaw);
      let d = head - body;
      d = ((d % 360) + 540) % 360 - 180;
      d = Math.max(-85, Math.min(85, d));
      body = head - d;
      if (d * d > 2500) body += d * 0.2;
    }
    const pitch = e.prevPitch + (e.pitch - e.prevPitch) * partial;
    const age = e.ticks + partial;
    // riders get no limb swing; children swing three times as fast
    let ls = 0, lsa = 0;
    if (e.riding < 0) {
      lsa = Math.min(1, e.prevLimbSwingAmount + (e.limbSwingAmount - e.prevLimbSwingAmount) * partial);
      ls = e.limbSwing - e.limbSwingAmount * (1 - partial);
      if (e.child) ls *= 3;
    }
    let sd = e.swingProgress - e.prevSwingProgress;
    if (sd < 0) sd += 1; // getSwingProgress
    const swing = e.prevSwingProgress + sd * partial;
    // Death rotation (RendererLivingEntity.rotateCorpse)
    let deathRot = 0;
    if (e.deathTime > 0) {
      let f = ((e.deathTime + partial - 1) / 20) * 1.6;
      f = Math.sqrt(f);
      if (f > 1) f = 1;
      deathRot = f * 90;
    }
    v.yawGroup.rotation.set(0, (180 - body) * D2R, 0);
    v.yawGroup.position.set(0, 0, 0);
    v.yawGroup.matrix = null;
    if (e.kind === 'mob' && e.type === 69 && e.attachFace) {
      // RenderShulker.applyRotations: turn the body onto the face it is attached to
      const m = mat4.create();
      mat4.rotateY(m, m, (180 - body) * D2R);
      const R = (a, x, y, z) => mat4.rotate(m, m, a * D2R, x, y, z);
      switch (e.attachFace) {
        case 5: mat4.translate(m, m, 0.5, 0.5, 0); R(90, 1, 0, 0); R(90, 0, 0, 1); break;
        case 4: mat4.translate(m, m, -0.5, 0.5, 0); R(90, 1, 0, 0); R(-90, 0, 0, 1); break;
        case 2: mat4.translate(m, m, 0, 0.5, -0.5); R(90, 1, 0, 0); break;
        case 3: mat4.translate(m, m, 0, 0.5, 0.5); R(90, 1, 0, 0); R(180, 0, 0, 1); break;
        case 1: mat4.translate(m, m, 0, 1, 0); R(180, 1, 0, 0); break;
        default: break;
      }
      v.yawGroup.matrix = m;
    }
    if (e.kind === 'player' && e.elytraFlying) {
      // RenderPlayer.applyRotations: pitch into the glide, then turn towards the direction of travel
      const m = mat4.create();
      mat4.rotateY(m, m, (180 - body) * D2R);
      const ft = (e.elytraTicks || 0) + partial;
      const f1 = Math.max(0, Math.min(1, ft * ft / 100));
      mat4.rotateX(m, m, f1 * (-90 - pitch) * D2R);
      // EntityLivingBase.getLook: getVectorForRotation(pitch, head yaw)
      const ly = (e.prevHeadYaw + (e.headYaw - e.prevHeadYaw) * partial) * D2R, lp = pitch * D2R;
      const f2 = -Math.cos(-lp);
      const lx = Math.sin(-ly - Math.PI) * f2, lz = Math.cos(-ly - Math.PI) * f2;
      const mx = e.motionX || 0, mz = e.motionZ || 0;
      const d0 = mx * mx + mz * mz, d1 = lx * lx + lz * lz;
      if (d0 > 0 && d1 > 0) {
        const d2 = Math.max(-1, Math.min(1, (mx * lx + mz * lz) / (Math.sqrt(d0) * Math.sqrt(d1))));
        const d3 = mx * lz - mz * lx;
        mat4.rotateY(m, m, Math.sign(d3) * Math.acos(d2));
      }
      v.yawGroup.matrix = m;
    }
    const swimAmount = (e.prevSwimAmount ?? e.swimAmount ?? 0) + ((e.swimAmount ?? (e.swimming ? 1 : 0)) - (e.prevSwimAmount ?? e.swimAmount ?? 0)) * partial;
    if ((e.kind === 'player' || e.kind === 'mob') && swimAmount > 0.001 && !e.elytraFlying && !e.riptide) {
      // RenderPlayer.applyRotations: pitch around X, then move the horizontal
      // body to its swimming hitbox. Retain the last pitch while leaving water.
      const m = mat4.create();
      mat4.rotateY(m, m, (180 - body) * D2R);
      let angle = (-90 - pitch) * swimAmount;
      if (e.swimming) v.swimRotation = angle;
      else angle = (v.swimRotation || 0) * (1 - swimAmount);
      mat4.rotateX(m, m, angle * D2R);
      if (e.swimming) mat4.translate(m, m, 0, -1, 0.3);
      v.yawGroup.matrix = m;
    }
    if (e.riptide && (e.kind === 'player' || e.kind === 'mob')) {
      const m = mat4.create();
      mat4.rotateY(m, m, (180 - body) * D2R);
      mat4.rotateX(m, m, (-90 - pitch) * D2R);
      mat4.rotateY(m, m, -75 * ((e.ticks || 0) + partial) * D2R);
      v.yawGroup.matrix = m;
    }
    let yOffset = 0;
    if (e.kind === 'player' && e.sneaking) yOffset = -0.125;
    v.root.position.y += yOffset;
    v.scaleGroup.rotation.set(0, 0, -deathRot * D2R * (e.kind === 'mob' && (e.type === 52 || e.type === 59) ? 2 : 1));
    // Pre-render scaling
    const model = v.model;
    let sx = model.modelScale || 1, sy = sx, sz = sx;
    v.flash = 0;
    if (e.kind === 'mob') {
      switch (e.type) {
        case 53: sx = sy = sz = 6; break;
        case 59: sx = sy = sz = 0.7; break;
        case 56: sx = sy = sz = 4.5; break;
        case 64: sx = sy = sz = 2; break;
        case 65: sx = sy = sz = 0.35; break;
        case 55: case 62: { const s = e.size || 1; sx = sy = sz = s; break; }
        case 50: {
          // Creeper swell (RenderCreeper.preRenderCallback / getColorMultiplier)
          const st = e.creeperState || -1;
          e.swell = Math.max(0, Math.min(30, (e.swell || 0) + (st > 0 ? 1 : -1) * 0.5));
          let f = e.swell / 28;
          const f1 = 1 + Math.sin(f * 100) * f * 0.01;
          f = Math.min(1, Math.max(0, f)); f *= f; f *= f;
          sx = sz = (1 + f * 0.4) * f1; sy = (1 + f * 0.1) / f1;
          const ff = e.swell / 28;
          v.flash = (Math.floor(ff * 10) & 1) === 0 ? 0 : Math.min(1, Math.max(0, ff * 0.2 + 0.0)) * 2.5;
          if (v.flash > 0.6) v.flash = 0.6;
          break;
        }
        case 66: sx = sy = sz = 0.9375; break;
        case 120: case 'wandering_trader': sx = sy = sz = 0.9375; break;
        case 68: if (e.elder) sx = sy = sz = 2.35; break;
        case 69: sx = sy = sz = 0.999; break;
        case 100: if (e.horseType === 1 || e.horseType === 2) { sx = sz = sy = e.horseType === 1 ? 0.87 : 0.92; } break;
        default: break;
      }
    }
    v.scaleGroup.scale.set(-sx, -sy, sz);
    v.scaleGroup.position.set(0, 0, 0);
    v.modelGroup.position.set(0, -1.5078125 + (model.modelTranslateY || 0), model.modelTranslateZ || 0);
    if (e.child) v.scaleGroup.scale.multiplyScalar(model.childScale || 0.5);
    // Animate
    const held = e.equipment[0];
    // RenderPlayer.setModelVisibilities / RenderBiped: arm poses from both hands (main hand on the primary side)
    const primaryRight = e.kind === 'player' ? e.mainHand !== 0 : !e.leftHanded;
    const poseOf = (stack, hand) => {
      if (!stack) return 'empty';
      if (e.usingItem && (e.activeHand || 0) === hand) {
        const name = g.items.name(stack.id);
        if (name === 'shield') return 'block';
        if (name === 'bow') return 'bow';
        if (name === 'trident') return 'spear';
      }
      return 'item';
    };
    const mainPose = poseOf(held, 0), offPose = poseOf(e.offhand, 1);
    const skeletonAim = (e.kind === 'mob' && e.type === 51 && e.armsRaised && held && g.items.name(held.id) === 'bow');
    const speedSq = (e.motionX || 0) ** 2 + (e.motionY || 0) ** 2 + (e.motionZ || 0) ** 2;
    const args = {
      ls, lsa, age, yaw: head - body, pitch, swing: swing > 0 ? swing : -9999, partial,
      sneak: !!e.sneaking, riding: e.riding >= 0,
      rightPose: skeletonAim ? 'bow' : primaryRight ? mainPose : offPose, leftPose: primaryRight ? offPose : mainPose,
      swingSide: ((e.swingHand || 0) === 0) === primaryRight ? 1 : -1,
      elytra: (e.elytraTicks || 0) > 4, speedSq,
      onGround: e.onGround, eatingGrass: e.eatingGrass || 0, sitting: e.sitting, angry: e.angry, hanging: e.hanging,
      carrying: !!e.carried, screaming: e.screaming, horseType: e.horseType, saddled: !!(e.horseFlags & 4) || e.saddled,
      tailRotation: e.tamed ? (0.55 - (20 - (e.wolfHealth || 20)) * 0.02) * Math.PI : Math.PI / 5,
      witchDrinking: e.kind === 'mob' && e.type === 66 && e.usingItem,
      squish: 0,
      peek: e.type === 69 ? (e.prevPeek || 0) + ((e.peek || 0) - (e.prevPeek || 0)) * partial : 0,
      entityId: e.id, child: !!e.child, leftHanded: !!e.leftHanded,
      inWater: isPointInFluid(g.world, e.x, e.y + e.height / 2, e.z),
      swimming: !!e.swimming, swimAmount, armsRaised: !!e.armsRaised,
      rearing: e.type === 'polar_bear' ? (e.standing ? 1 : 0) : (e.horseFlags & 64 ? 1 : 0),
      grazing: e.horseFlags & 32 ? 1 : 0, mouthOpen: e.horseFlags & 128 ? 1 : 0,
      chested: !!e.horseChest, hasRider: e.passenger >= 0, tailWag: !!e.tailWag,
      charging: !!e.charging, attacking: !!e.armsRaised, spellcasting: !!e.spell,
      aimedBow: e.type === 'illusioner' && !!e.armsRaised,
      throwing: e.type === 'drowned' && !!e.armsRaised && !!held && g.items.name(held.id) === 'trident',
      hasEgg: !!e.hasEgg, layingEgg: !!e.layingEgg,
    };
    if (e.type === 'illusioner' && !e.spell && e.armsRaised) args.pose = 'bow';
    if (e.kind === 'armorstand') {
      const m = e.metadata;
      const r = (i) => (m[i] ? [m[i].pitch, m[i].yaw, m[i].roll] : null);
      args.poses = { head: r(12), body: r(13), leftArm: r(14), rightArm: r(15), leftLeg: r(16), rightLeg: r(17) };
      args.showArms = !!(m[11] & 4); args.noBasePlate = !!(m[11] & 8);
      if (m[11] & 1) v.scaleGroup.scale.multiplyScalar(0.5);
    }
    if (v.lodSkip && v.posed && v.wasInvisible === !!e.invisible) {
      // Keep the previous pose; only the transforms above were updated
      this._updateHeld(e, v, held, args);
      this._updateNameTag(e, v, p);
      return;
    }
    v.posed = true;
    v.wasInvisible = !!e.invisible;
    model.animate(model, args);
    v.modelGroup.position.set(0, -1.5078125 + (model.modelTranslateY || 0), model.modelTranslateZ || 0);
    for (const r of model.roots) r.sync();
    // Invisibility hides the body, not equipped armor/items. Keep arm/head nodes
    // alive for attached equipment, and keep hologram-only stands bodyless.
    for (const draw of v.bodyDrawables) draw.visible = !e.invisible;
    // Player-specific visibility
    if (e.kind === 'player') {
      const pp = model.parts;
      const flags = e.skinFlags !== undefined ? e.skinFlags : 0x7f;
      if (pp.headwear) pp.headwear.obj.visible = !!(flags & 0x40);
      if (pp.bodywear) pp.bodywear.obj.visible = !!(flags & 0x02);
      if (pp.leftArmwear) pp.leftArmwear.obj.visible = !!(flags & 0x04);
      if (pp.rightArmwear) pp.rightArmwear.obj.visible = !!(flags & 0x08);
      if (pp.leftLegwear) pp.leftLegwear.obj.visible = !!(flags & 0x10);
      if (pp.rightLegwear) pp.rightLegwear.obj.visible = !!(flags & 0x20);
    }
    // Layers follow the main pose
    if (v.elytra) {
      const chest = e.equipment[3];
      const show = !!chest && g.items.name(chest.id) === 'elytra';
      v.elytra.obj.visible = show;
      if (show) {
        const t = M.elytraAngles(!!e.elytraFlying, !!e.sneaking, [e.motionX || 0, e.motionY || 0, e.motionZ || 0]);
        // AbstractClientPlayer.rotateElytraX/Y/Z ease 10% towards the target each render; armor stands snap
        if (e.kind === 'player') {
          const r = e.rotElytra || (e.rotElytra = [t[0], t[1], t[2]]);
          r[0] += (t[0] - r[0]) * 0.1; r[1] += (t[1] - r[1]) * 0.1; r[2] += (t[2] - r[2]) * 0.1;
          v.elytra.model.animate(v.elytra.model, { rot: r, py: t[3] });
        } else v.elytra.model.animate(v.elytra.model, { rot: [t[0], t[1], t[2]], py: t[3] });
        for (const r of v.elytra.model.roots) r.sync();
      }
    }
    if (v.cape) this._poseCape(e, v, partial);
    for (const L of v.layers) {
      L.model.animate(L.model, args);
      copyPose(model, L.model);
      if(L.hideHat){for(const key of ['head','hat','hatRim','headwear'])if(L.model.parts[key])L.model.parts[key].visible=false;}
      for (const r of L.model.roots) r.sync();
      L.obj.visible = !e.invisible;
    }
    if (v.wool) v.wool.obj.visible = !e.sheared && !e.invisible;
    if (v.wool) { const c = FLEECE[e.fleece || 0]; v.wool.mat.params.setTint(c[0], c[1], c[2], 1); }
    if (v.saddle) v.saddle.obj.visible = !!e.saddled && !e.invisible;
    if (v.llamaDecor) {
      v.llamaDecor.obj.visible = !e.invisible && e.llamaCarpet >= 0 && e.llamaCarpet < ENTITY_DYES.length;
      v.llamaDecor.mat.tex = 'entity/llama/decor/' + (ENTITY_DYES[e.llamaCarpet] || 'white') + '.png';
    }
    if (v.fishPattern) {
      const base = FLEECE[((e.fishVariant || 0) >>> 16) & 15];
      const pattern = FLEECE[((e.fishVariant || 0) >>> 24) & 15];
      v.mainMat.params.setTint(base[0], base[1], base[2], 1);
      v.fishPattern.mat.params.setTint(pattern[0], pattern[1], pattern[2], 1);
    }
    if (v.mushroomBack) { const vis = !e.child && !e.invisible; v.mushroomBack.visible = vis; if (v.mushroomHead) v.mushroomHead.visible = vis; }
    if (v.charge) {
      v.charge.obj.visible = !!e.powered && !e.invisible;
      if (e.powered) {
        const t = (e.ticks + partial) * 0.01;
        v.charge.mat.params.setUvTransform(t, t, 0);
        v.charge.mat.params.setTint(0.5, 0.5, 0.5, 1);
      }
    }
    if (v.armor) this._updateArmor(e, v, model, args);
    // Hurt / death red overlay, creeper flash
    const overlay = e.hurtTime > 0 || e.deathTime > 0 ? 0.3 : 0;
    for (const m of v.materials) {
      if (m === v.atlasMat) continue;
      if (v.flash > 0) m.params.setOverlay(1, 1, 1, v.flash);
      else m.params.setOverlay(1, 0, 0, overlay);
    }
    v.mainMat.params.p[3] = 1;
    v.mainMat.state = { ...STATE_OPAQUE, cull: v.mainMat.state.cull };
    // Held item
    this._updateHeld(e, v, held, args);
    this._updateHeadItem(e, v);
    if (e.type === 58) this._updateCarriedBlock(e, v);
    // Name tag
    this._updateNameTag(e, v, p);
  }

  _updateArmor(e, v, model, args) {
    for (let slot = 1; slot <= 4; slot++) {
      const A = v.armor[slot];
      const item = e.equipment[slot];
      const idx = item ? armorMaterialIndex(this.game.items.name(item.id)) : -1;
      const visible = idx >= 0;
      A.obj.visible = visible;
      A.overlay.obj.visible = visible && idx === 0;
      if (!visible) continue;
      const key = idx + ':' + slot;
      if (A.key !== key) {
        A.key = key;
        const layer = slot === 2 ? 2 : 1;
        A.mat.tex = `models/armor/${ARMOR_MATS[idx]}_layer_${layer}.png`;
        A.overlay.mat.tex = `models/armor/leather_layer_${layer}_overlay.png`;
      }
      if (idx === 0) {
        const tag = this.game.items.nbt(item);
        const c = tag && tag.display && tag.display.color !== undefined ? tag.display.color : 10511680;
        A.mat.params.setTint(((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255, 1);
      } else A.mat.params.setTint(1, 1, 1, 1);
      for (const M2 of [A.model, A.overlay.model]) {
        M2.animate(M2, args);
        copyPose(model, M2);
        const pp = M2.parts;
        pp.head.visible = slot === 4; pp.headwear.visible = slot === 4;
        pp.body.visible = slot === 3 || slot === 2;
        pp.rightArm.visible = pp.leftArm.visible = slot === 3;
        pp.rightLeg.visible = pp.leftLeg.visible = slot === 2 || slot === 1;
        for (const r of M2.roots) r.sync();
      }
    }
  }

  // LayerHeldItem (1.9+): main hand item in the primary arm, off hand item in the other
  _updateHeld(e, v, held, args) {
    const primaryRight = e.kind === 'player' ? e.mainHand !== 0 : !e.leftHanded;
    const right = primaryRight ? held : e.offhand, left = primaryRight ? e.offhand : held;
    this._heldIn(v, 'r', v.itemHolder, right, false, args, e);
    this._heldIn(v, 'l', v.leftHolder, left, true, args, e);
  }

  // renderHeldItem: (sneaking: +0.2 y) arm transform, rotate -90 X and 180 Y, translate (+-1/16, 0.125, -0.625),
  // then the THIRD_PERSON_RIGHT_HAND / LEFT_HAND transform (mirrored for the left hand)
  _heldIn(v, k, holder, stack, leftHand, args, entity) {
    if (!holder) return;
    const key = stack ? stack.id + ':' + stack.damage + ':' + this.game.itemRenderer.iconKey(stack, true, entity) : null;
    const st = v['held' + k] || (v['held' + k] = { key: undefined, root: null, glint: null });
    if (key !== st.key) {
      st.key = key;
      holder.clear();
      st.root = null; st.glint = null;
      if (stack) {
        const io = this.game.itemRenderer.objectFor(stack, v.atlasMat, true, entity);
        if (io) {
          const root = new Node();
          const turn = new Node();
          turn.rotation.set(-Math.PI / 2, Math.PI, 0, 'XYZ');
          const off = new Node();
          off.position.set((leftHand ? -1 : 1) / 16, 0.125, -0.625);
          const t = new Node();
          const d = io.model.display || {};
          applyTransform(t, leftHand ? d.thirdperson_lefthand || d.thirdperson_righthand : d.thirdperson_righthand, leftHand);
          t.add(io.obj); off.add(t); turn.add(off); root.add(turn);
          holder.add(root);
          st.root = root;
          st.glint = io.obj.userData.glint ? io.obj : null;
        } else st.key = undefined;
      }
    }
    if (st.root) st.root.position.y = args.sneak ? 0.2 : 0;
    if (st.glint) this.glints.push(st.glint);
  }

  _updateHeadItem(e, v) {
    if (!v.headHolder) return;
    if (e.kind === 'mob' && e.type === 97) {
      v.headHolder.visible = e.hasPumpkin !== false && !e.invisible;
      if (v.headKey === 'pumpkin') return;
      v.headKey = 'pumpkin';
      const io = this._itemObject({ id: this.game.items.byName.get('carved_pumpkin').id, damage: 0, count: 1 }, v.atlasMat);
      if (!io) return;
      // LayerSnowmanHead: translate(0,-0.34375,0), rotate 180 Y, scale(0.625,-0.625,-0.625)
      const t = new Node();
      t.position.set(0, -0.34375, 0);
      t.rotation.y = Math.PI;
      t.scale.set(0.625, -0.625, -0.625);
      const h = new Node(); applyTransform(h, (io.model.display || {}).head); // renderItem(HEAD)
      h.add(io.obj); t.add(h);
      v.headHolder.add(t);
      return;
    }
    const helm = e.equipment[4];
    const isBlockHead = helm && this.game.items.isBlockItem(helm.id) && armorMaterialIndex(this.game.items.name(helm.id)) < 0;
    const key = isBlockHead ? this.game.itemRenderer.iconKey(helm) : null;
    if (key === v.headKey) return;
    v.headKey = key;
    v.headHolder.clear();
    if (!isBlockHead) return;
    const io = this._itemObject(helm, v.atlasMat);
    if (!io) return;
    // LayerCustomHead: translate(0,-0.25,0), rotate 180 Y, scale(0.625,-0.625,-0.625)
    const t = new Node();
    t.position.set(0, -0.25, 0);
    t.rotation.y = Math.PI;
    t.scale.set(0.625, -0.625, -0.625);
    const h = new Node(); applyTransform(h, (io.model.display || {}).head); // renderItem(HEAD)
    h.add(io.obj); t.add(h);
    v.headHolder.add(t);
  }

  _updateCarriedBlock(e, v) {
    const state = e.carriedBlockState || 0;
    if (v.carriedState === state) return;
    v.carriedState = state;
    if (v.carriedBlock) v.modelGroup.remove(v.carriedBlock);
    v.carriedBlock = null;
    if (!state) return;
    const block = this._blockObject(state, v.atlasMat);
    if (!block) return;
    const holder = new Node(); holder.position.set(0, 11, -12);
    holder.rotation.set(20 * D2R, 45 * D2R, 0);
    holder.scale.set(-8, -8, 8); holder.add(block);
    v.modelGroup.add(holder); v.carriedBlock = holder;
  }

  _updateNameTag(e, v, p) {
    const g = this.game;
    let name = null;
    if (e.kind === 'player') {
      // EntityPlayer.getDisplayName: team-formatted profile name; a custom name tag on a player is never shown
      if (e.invisible) name = null;
      else name = g.scoreboard.displayName ? g.scoreboard.displayName(e.uuid, e.name) : e.name;
    } else if (e.kind === 'armorstand') name = e.customName && e.nameVisible ? e.customName : null; // RenderArmorStand
    else if (!e.invisible && e.customName && (e.nameVisible || (g.interaction.target && g.interaction.target.entity === e))) name = e.customName;
    // RendererLivingEntity.canRenderName: never the camera entity (own name in F5), not with F1, not when ridden
    if (e.id === -1 || e.id === g.entityId || g.hideGui || (e.kind !== 'armorstand' && e.passenger !== undefined && e.passenger >= 0)) name = null;
    const cam = this.r.camPos;
    const dist = Math.hypot(cam[0] - p.x, cam[1] - p.y, cam[2] - p.z);
    if (!name || dist >= 64) { if (v.tag) v.tag.visible = false; return; }
    const sneak = !!e.sneaking;
    if (!v.tag || v.tagText !== name || v.tagSneak !== sneak) {
      if (v.tag) v.root.remove(v.tag);
      destroyTextMeshes(this.device, v.tagMeshes);
      const { node, meshes } = this.makeLabel(name, sneak);
      v.tag = node; v.tagMeshes = meshes;
      v.tagText = name; v.tagSneak = sneak;
      v.root.add(v.tag);
    }
    v.tag.visible = true;
    v.tag.position.set(0, e.height + 0.5 - (sneak ? 0.25 : 0) - (v.root.position.y - p.y), 0);
  }

  // Render.renderLivingLabel: billboard text with a translucent background; non-sneaking labels are also
  // drawn faintly through walls
  makeLabel(text, sneak) {
    const font = this.game.gui.font;
    const w = font.width(text);
    const half = w / 2;
    const bg = { x0: -half - 1, y0: -1, x1: half + 1, y1: 8, color: [0, 0, 0, 0.25] };
    const meshes = buildTextMeshes(this.device, font, [{ text, x: -half, y: 0, color: 0xffffff }], [bg]);
    const node = new Node();
    node.billboard = true;
    const s = 0.016666668 * 1.6;
    node.scale.set(s, -s, s);
    const white = this.game.gui.white;
    for (const m of meshes) {
      const isBg = m.tex === null;
      const tex = m.tex || white;
      // pass 1: through walls (no depth), faint
      node.addDrawable(m.mesh, material('color', tex, colorParams(1, 1, 1, isBg || sneak ? 1 : 0.125, 0.004, 0), { blend: 'alpha', depthTest: false, depthWrite: false }), { order: 20 });
      // pass 2: normal depth tested text
      if (!isBg && !sneak) node.addDrawable(m.mesh, material('color', tex, colorParams(1, 1, 1, 1, 0.004, 0), { blend: 'alpha', depthWrite: true }), { order: 21 });
    }
    if (sneak) for (const d of node.drawables) d.mat.state = { blend: 'alpha', depthWrite: false };
    return { node, meshes };
  }

  _updateShadow(e, v, p) {
    const w = this.game.world;
    const size = (e.kind==='mob'&&(e.type===55||e.type===62)? .25*(e.size||1):e.kind==='item'?.15:Math.min(e.width,2)*.5);
    const camera=this.r.camPos||[p.x,p.y,p.z],distance=(p.x-camera[0])**2+(p.y-camera[1])**2+(p.z-camera[2])**2;
    if(e.invisible||e.deathTime>0||!this.game.settings.entityShadows||distance>=256){v.shadow.visible=false;return;}
    const vertices=shadowGeometry(w,p,size,1-distance/256);
    v.shadow.visible=vertices.length>0;if(!vertices.length)return;
    v.shadowParams[3]=1;v.shadow.scale.set(1,1,1);
    v.shadow.position.set(p.x-v.root.position.x,p.y-v.root.position.y,p.z-v.root.position.z);
    this.device.updateMesh(v.shadowMesh,vertices,{quads:true});
  }

  _renderItem(e, v, p, partial) {
    const it = e.item;
    const copiesFor = count => count > 48 ? 5 : count > 32 ? 4 : count > 16 ? 3 : count > 1 ? 2 : 1;
    const key = it ? this.game.itemRenderer.iconKey(it) + ':' + copiesFor(it.count) + ':' + (this.game.items.hasEffect(it) ? 1 : 0) : null;
    if (key !== v.itemKey) {
      v.itemKey = key;
      if (v.inner) v.root.remove(v.inner);
      v.inner = null;
      v.glintNode = null;
      if (it) {
        const io = this._itemObject(it, v.atlasMat);
        if (io) {
          // RenderEntityItem.getModelCount / doRender (1.9+): each copy gets the GROUND transform; 3D items jitter,
          // flat ones stack along z
          const copies = it.count > 48 ? 5 : it.count > 32 ? 4 : it.count > 16 ? 3 : it.count > 1 ? 2 : 1;
          const ground = (io.model.display || {}).ground;
          const gs = (ground && ground.scale) || [1, 1, 1];
          v.groundScaleY = gs[1];
          v.inner = new Node();
          let z = 0;
          for (let i = 0; i < copies; i++) {
            const c = i === 0 ? io.obj : io.obj.clone();
            const holder = new Node();
            const j = io.gui3d ? 0.15 : 0.15 * 0.5;
            if (i > 0) holder.position.set((Math.random() * 2 - 1) * j, (Math.random() * 2 - 1) * j, (Math.random() * 2 - 1) * j);
            if (!io.gui3d) { holder.position.z += z; z += 0.09375 * gs[2]; }
            const t = new Node();
            applyTransform(t, ground);
            t.add(c);
            holder.add(t);
            v.inner.add(holder);
          }
          v.gui3d = io.gui3d;
          v.root.add(v.inner);
          if (io.obj.userData.glint) v.glintNode = v.inner;
        } else v.itemKey = null; // retry next frame (textures still loading)
      }
    }
    if (!v.inner) return;
    const age = e.ticks + partial;
    const bob = Math.sin(age / 10 + e.hoverStart) * 0.1 + 0.1;
    v.inner.position.set(0, bob + 0.25 * (v.groundScaleY || 1), 0);
    v.inner.rotation.set(0, (age / 20 + e.hoverStart), 0);
    if (v.glintNode) this.glints.push(v.glintNode);
    void p;
  }

  _renderXp(e, v, partial) {
    const t = (e.ticks + partial) / 2;
    const r = (Math.sin(t) + 1) * 0.5;
    v.params[0] = r; v.params[1] = 1; v.params[2] = (Math.sin(t + 4.1887903) + 1) * 0.1; v.params[3] = 0.5;
    v.sprite.position.y = 0.1;
  }

  _renderArrow(e, v, partial) {
    const yaw = e.prevYaw + (e.yaw - e.prevYaw) * partial;
    const pitch = e.prevPitch + (e.pitch - e.prevPitch) * partial;
    v.inner.rotation.set(Math.PI / 4, (yaw - 90) * D2R, pitch * D2R, 'YZX');
    v.inner.scale.setScalar(0.05625);
  }

  _renderJarProjectile(e, v, partial) {
    const model = v.model, yaw = yawAngle(e, partial), pitch = pitchAngle(e, partial);
    const progress = (e.prevFangsProgress || 0) + ((e.fangsProgress || 0) - (e.prevFangsProgress || 0)) * partial;
    model.animate(model, { age: e.ticks + partial, yaw, pitch, progress });
    for (const part of model.roots) part.sync();
    const scale = (model.modelScale ?? 1) / 16;
    v.inner.scale.setScalar(scale);
    v.inner.position.set(0, 0, 0);
    if (e.kind === 'trident' || e.kind === 'llama_spit') {
      v.inner.rotation.set(0, (yaw - 90) * D2R, (pitch + (e.kind === 'trident' ? 90 : 0)) * D2R, 'YZX');
    } else if (e.kind === 'shulker_bullet') {
      const age = e.ticks + partial;
      v.inner.scale.set(-scale, -scale, scale);
      v.inner.position.y = 0.15;
      v.inner.rotation.set(Math.cos(age * 0.1) * Math.PI, Math.sin(age * 0.1) * Math.PI, Math.sin(age * 0.15) * Math.PI * 2);
    } else if (e.kind === 'evoker_fangs') {
      v.inner.visible = !!e.fangsActive && progress < 1;
      v.inner.scale.set(-scale, -scale, scale);
      v.inner.position.y = -(model.modelTranslateY || 0) * (model.modelScale ?? 1);
      v.inner.rotation.set(0, (90 - yaw) * D2R, 0);
    }
  }

  _renderCloud(e, v, p) {
    if (v.particleTick === e.ticks) return; // Particles follow game ticks, not uncapped FPS.
    v.particleTick = e.ticks;
    const radius = Math.max(0, e.radius ?? 3), n = e.singlePoint ? 2 : Math.min(256, Math.ceil(Math.PI * radius * radius));
    const color = e.cloudColor || 0;
    for (let i = 0; i < n; i++) {
      const angle = Math.random() * Math.PI * 2, distance = e.singlePoint ? 0.2 : Math.sqrt(Math.random()) * radius;
      this.game.particles.spell(p.x + Math.cos(angle) * distance, p.y, p.z + Math.sin(angle) * distance,
        0, 0, 0, ((color >> 16) & 255) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255);
    }
  }

  _renderTnt(e, v, partial) {
    if (!v.inner) return;
    const fuse = e.fuse - partial + 1;
    let s = 1;
    if (fuse < 10) { let f = 1 - fuse / 10; f = Math.min(1, Math.max(0, f)); f *= f; f *= f; s = 1 + f * 0.3; }
    v.inner.scale.setScalar(s);
    v.inner.position.set(0, 0.5, 0);
    if (v.flashMat) {
      const on = Math.floor(e.fuse / 5) % 2 === 0;
      v.flash.visible = on;
      v.flashMat.params.p[3] = on ? Math.min(1, Math.max(0, (1 - (e.fuse - partial + 1) / 100) * 0.8)) : 0; // GL clamps colour
    }
  }

  _renderVehicle(e, v, p, partial) {
    const yaw = e.prevYaw + (e.yaw - e.prevYaw) * partial;
    v.inner.position.set(0, 0.375, 0);
    if (e.kind === 'boat') {
      // RenderBoat.setupRotation: hurt wobble around X, then ModelBoat paddles from EntityBoat.getRowingTime
      const f = (e.timeSinceHit || 0) - partial;
      const f1 = Math.max(0, (e.damageTaken || 0) - partial);
      const wob = f > 0 ? Math.sin(f) * f * f1 / 10 * (e.forwardDirection || 1) : 0;
      v.inner.rotation.set(wob * D2R, (180 - yaw) * D2R, 0, 'YXZ');
      if (v.boatModel) {
        const pos = e.paddlePositions || [0, 0], st = e.paddleState || [false, false];
        const rt = (i) => (st[i] ? pos[i] - 0.39269909262657166 + 0.39269909262657166 * Math.min(1, Math.max(0, partial)) : 0);
        v.boatModel.animate(v.boatModel, { rowing: [rt(0), rt(1)] });
        for (const r of v.boatModel.roots) r.sync();
      }
    } else this._renderMinecart(e, v, p, partial, yaw);
  }

  // LayerCape.doRenderLayer: hidden with an elytra, while invisible or with the cape skin part off; swings back with
  // the distance to the trailing chasing point, sideways with turning, and bobs while walking
  _poseCape(e, v, partial) {
    const chest = e.equipment[3];
    const flags = e.skinFlags !== undefined ? e.skinFlags : 0x7f;
    const show = !e.invisible && !!(flags & 1) && !(chest && this.game.items.name(chest.id) === 'elytra');
    v.cape.holder.visible = show;
    if (!show) return;
    const L = (a, b) => a + (b - a) * partial;
    const d0 = L(e.prevChasingX, e.chasingX) - L(e.prevX, e.x);
    const d1 = L(e.prevChasingY, e.chasingY) - L(e.prevY, e.y);
    const d2 = L(e.prevChasingZ, e.chasingZ) - L(e.prevZ, e.z);
    const f = L(e.prevBodyYaw, e.bodyYaw) * D2R;
    const d3 = Math.sin(f), d4 = -Math.cos(f);
    let f1 = Math.max(-6, Math.min(32, d1 * 10));
    const f2 = Math.max(0, (d0 * d3 + d2 * d4) * 100);
    const f3 = (d0 * d4 - d2 * d3) * 100;
    const f4 = L(e.prevCameraYaw || 0, e.cameraYaw || 0);
    f1 += Math.sin(L(e.prevDistanceWalked || 0, e.distanceWalked || 0) * 6) * 32 * f4;
    if (e.sneaking) f1 += 25;
    // rotate(6 + f2 / 2 + f1, X), rotate(f3 / 2, Z), rotate(-f3 / 2, Y), rotate(180, Y)
    v.cape.holder.rotation.set((6 + f2 / 2 + f1) * D2R, (180 - f3 / 2) * D2R, f3 / 2 * D2R, 'XZY');
    v.cape.part.py = e.sneaking ? 2 : 0; // ModelPlayer.setRotationAngles
    v.cape.part.sync();
  }

  // RenderMinecart: snapped onto the rail (EntityMinecart.getPos / getPosOffset 0.3 blocks ahead and behind), yaw and
  // pitch from the track, a tiny per-cart offset, and the hurt wobble
  _renderMinecart(e, v, p, partial, yaw) {
    const w = this.game.world;
    let pitch = e.prevPitch + (e.pitch - e.prevPitch) * partial;
    let ox = 0, oy = 0, oz = 0;
    const pos = railPos(w, p.x, p.y, p.z);
    if (pos) {
      const a = railPosOffset(w, p.x, p.y, p.z, 0.3) || pos, b = railPosOffset(w, p.x, p.y, p.z, -0.3) || pos;
      ox = pos[0] - p.x; oy = (a[1] + b[1]) / 2 - p.y; oz = pos[2] - p.z;
      const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
      const len = Math.hypot(dx, dy, dz);
      if (len !== 0) {
        yaw = Math.atan2(dz / len, dx / len) * 180 / Math.PI;
        pitch = Math.atan(dy / len) * 73;
      }
    }
    // long i = id * 493286711L; i = i * i * 4392167121L + i * 98761L
    if (v.jitter === undefined) {
      let i = BigInt.asIntN(64, BigInt(e.id) * 493286711n);
      i = BigInt.asIntN(64, i * i * 4392167121n + i * 98761n);
      const f = (sh) => ((Number((i >> BigInt(sh)) & 7n) + 0.5) / 8 - 0.5) * 0.004;
      v.jitter = [f(16), f(20), f(24)];
    }
    v.inner.position.set(ox + v.jitter[0], oy + 0.375 + v.jitter[1], oz + v.jitter[2]);
    const f5 = (e.rollingAmplitude || 0) - partial;
    const f6 = Math.max(0, (e.cartDamage || 0) - partial);
    const roll = f5 > 0 ? Math.sin(f5) * f5 * f6 / 10 * (e.rollingDirection || 1) : 0;
    // rotate(180 - yaw, Y), rotate(-pitch, Z), rotate(roll, X)
    v.inner.rotation.set(roll * D2R, (180 - yaw) * D2R, -pitch * D2R, 'YZX');
  }

  _renderPainting(e, v) {
    const art = PAINTINGS[e.title] || PAINTINGS.Kebab;
    const f = e.facing;
    const bp = e.blockPos;
    // EntityHanging position: block center pushed against the wall, offset for even sizes
    const dirs = [[0, 1], [-1, 0], [0, -1], [1, 0]]; // south, west, north, east
    const [fx, fz] = dirs[f] || [0, 1];
    let x = bp.x + 0.5 - fx * 0.46875, z = bp.z + 0.5 - fz * 0.46875;
    let y = bp.y + 0.5;
    const off = (sz) => (sz % 32 === 0 ? 0.5 : 0);
    const ccw = [[1, 0], [0, 1], [-1, 0], [0, -1]][f];
    x += ccw[0] * off(art[0]); z += ccw[1] * off(art[0]); // EntityHanging.updateBoundingBox: + d4 * rotateYCCW
    y += off(art[1]);
    v.root.position.set(x, y, z);
    v.root.rotation.set(0, [0, -Math.PI / 2, Math.PI, Math.PI / 2][f] || 0, 0);
    if (!e.box) { // picking box (EntityHanging.updateBoundingBox)
      const alongZ = fx === 0, hw = art[0] / 32, hh = art[1] / 32;
      e.box = [x - (alongZ ? hw : 1 / 32), y - hh, z - (alongZ ? 1 / 32 : hw), x + (alongZ ? hw : 1 / 32), y + hh, z + (alongZ ? 1 / 32 : hw)];
    }
    const light = this._light(x + fx * 0.5, y, z + fz * 0.5);
    v.materials[0].params.setLight(light[0], light[1]);
  }

  _renderFrame(e, v) {
    const f = e.facing;
    const bx = Math.floor(e.x), by = Math.floor(e.y), bz = Math.floor(e.z);
    v.root.position.set(bx + 0.5, by + 0.5, bz + 0.5);
    // The model's back is at local +Z. Face indices are down/up/north/south/west/east.
    v.root.rotation.set(f === 0 ? -Math.PI / 2 : f === 1 ? Math.PI / 2 : 0,
      [0, 0, 0, Math.PI, Math.PI / 2, -Math.PI / 2][f] || 0, 0);
    const isMap = e.item && this.game.items.name(e.item.id) === 'filled_map';
    const mapId = isMap ? (this.game.items.nbt(e.item)?.map ?? 0) : -1;
    const mapObj = isMap ? this.game.items.maps.get(mapId) : null;
    const mapVer = mapObj ? mapObj.version : -1;
    const key = e.item ? this.game.itemRenderer.iconKey(e.item) + ':' + (e.rotation || 0) + ':' + mapId + ':' + mapVer : null;
    // ItemFrame model: the "map" variant has a full-size back so the map covers the whole face
    const frameModel = isMap ? 'true' : 'false';
    if (v.frameModel !== frameModel && v.frame) {
      const bm = this.game.assets.modelStore.bakeVariant('item_frame', { map: frameModel }, null, 0);
      const mesh = bm && this.game.itemRenderer.blockMesh({ baked: bm, name: 'item_frame_' + frameModel });
      if (mesh) { v.frame.drawables = []; v.frame.addDrawable(mesh, v.atlasMat); v.frameModel = frameModel; }
    }
    if (key !== v.itemKey) {
      v.itemKey = key;
      v.itemGroup.clear();
      if (isMap && mapObj) {
        // RenderItemFrame: translate 0.4375, rotate (rotation % 4) * 90, rotate 180 around Z, scale 1/128,
        // translate (-64, -64, -1), then MapItemRenderer draws the 128x128 map (no background in frames)
        const h = new Node();
        h.position.set(0, 0, 0.4375);
        h.rotation.set(0, 0, ((e.rotation || 0) % 4) * 2 * Math.PI / 4 + Math.PI);
        h.scale.set(1 / 128, 1 / 128, 1 / 128);
        h.addDrawable(this.mapQuadMesh(), material('color', () => this.mapTexture(mapId), colorParams(1, 1, 1, 1, 0.01, 0), { blend: 'alpha', polygonOffset: true, cull: false }));
        v.itemGroup.add(h);
      } else if (e.item) {
        const io = this._itemObject(e.item, v.atlasMat);
        if (io) {
          // RenderItemFrame.renderItem (1.9+): translate 0.4375, rotate(rotation * 45, Z), scale 0.5, FIXED transform
          const h = new Node();
          h.position.set(0, 0, 0.4375);
          h.scale.setScalar(0.5);
          h.rotation.set(0, 0, (e.rotation || 0) * Math.PI / 4);
          const inner = new Node();
          applyTransform(inner, (io.model.display || {}).fixed);
          inner.add(io.obj);
          h.add(inner);
          v.itemGroup.add(h);
        }
      }
    }
  }

  // MapItemRenderer: one 128x128 texture per map id, refreshed when new map data arrives
  mapTexture(mapId) {
    const m = this.game.items.maps.get(mapId);
    if (!m) return null;
    this.mapTextures = this.mapTextures || new Map();
    let t = this.mapTextures.get(mapId);
    if (!t) { t = { tex: this.device.createTexture({ width: 128, height: 128, data: new Uint8Array(128 * 128 * 4), filter: 'nearest' }), ver: -1 }; this.mapTextures.set(mapId, t); }
    if (t.ver !== m.version) {
      t.ver = m.version;
      const rgba = new Uint8Array(128 * 128 * 4);
      for (let i = 0; i < 128 * 128; i++) {
        const c = m.colors[i];
        const base = c >> 2;
        if (base === 0) { rgba[i * 4 + 3] = ((i + (i >> 7)) & 1) * 8 + 16; continue; } // MapColor.airColor: faint checker
        const col = MAP_BASE_COLORS[base] || [0, 0, 0];
        const mul = MAP_SHADES[c & 3];
        rgba[i * 4] = (col[0] * mul / 255) | 0;
        rgba[i * 4 + 1] = (col[1] * mul / 255) | 0;
        rgba[i * 4 + 2] = (col[2] * mul / 255) | 0;
        rgba[i * 4 + 3] = 255;
      }
      this.device.updateTexture(t.tex, rgba);
    }
    return t.tex;
  }

  // The map quad in MapItemRenderer space (0..128 pixels, translated by -64 and z -1)
  mapQuadMesh() {
    if (!this._mapQuad) {
      this._mapQuad = this.device.createMesh(FORMAT.color, new Float32Array([
        -64, 64, -1, 0, 1, 1, 1, 1, 1,
        64, 64, -1, 1, 1, 1, 1, 1, 1,
        64, -64, -1, 1, 0, 1, 1, 1, 1,
        -64, -64, -1, 0, 0, 1, 1, 1, 1,
      ]), { quads: true });
    }
    return this._mapQuad;
  }

  _renderCrystal(e, v, partial) {
    const t = e.ticks + partial;
    const f1 = Math.sin(t * 0.2) / 2 + 0.5;
    const y = f1 * f1 + f1;
    v.cubes.forEach((c, i) => {
      c.position.set(0, y + 0.5, 0);
      c.rotation.set(Math.PI / 3 * (i + 1) * 0.3, t * 3 * D2R * (i + 1), Math.PI / 4);
      c.scale.setScalar(2 / 16 * (1 - i * 0.125));
    });
  }

  // RenderLightningBolt: 4 layers x 3 branches of jagged additive triangle strips
  _renderLightning(e, v) {
    if (v.boltSeed === e.boltVertex && v.boltNode) { v.boltNode.visible = e.lightningState >= 0; return; }
    v.boltSeed = e.boltVertex;
    for (const m of v.ownMeshes) this.device.destroyMesh(m);
    v.ownMeshes = [];
    v.root.clear();
    const seed = BigInt.asIntN(64, BigInt(e.boltVertex || 0));
    const xs = new Array(8), zs = new Array(8);
    let d0 = 0, d1 = 0;
    const random = new JavaRandom(seed);
    for (let i = 7; i >= 0; i--) { xs[i] = d0; zs[i] = d1; d0 += random.nextInt(11) - 5; d1 += random.nextInt(11) - 5; }
    const tris = [];
    const col = [0.45, 0.45, 0.5, 0.3];
    for (let k1 = 0; k1 < 4; k1++) {
      const random1 = new JavaRandom(seed);
      for (let j = 0; j < 3; j++) {
        let k = 7, l = 0;
        if (j > 0) { k = 7 - j; l = k - 2; }
        let d2 = xs[k] - d0, d3 = zs[k] - d1;
        for (let i1 = k; i1 >= l; i1--) {
          const d4 = d2, d5 = d3;
          if (j === 0) { d2 += random1.nextInt(11) - 5; d3 += random1.nextInt(11) - 5; }
          else { d2 += random1.nextInt(31) - 15; d3 += random1.nextInt(31) - 15; }
          let d6 = 0.1 + k1 * 0.2;
          if (j === 0) d6 *= i1 * 0.1 + 1;
          let d7 = 0.1 + k1 * 0.2;
          if (j === 0) d7 *= (i1 - 1) * 0.1 + 1;
          const strip = [];
          for (let j1 = 0; j1 < 5; j1++) {
            let d8 = 0.5 - d6, d9 = 0.5 - d6;
            if (j1 === 1 || j1 === 2) d8 += d6 * 2;
            if (j1 === 2 || j1 === 3) d9 += d6 * 2;
            let d10 = 0.5 - d7, d11 = 0.5 - d7;
            if (j1 === 1 || j1 === 2) d10 += d7 * 2;
            if (j1 === 2 || j1 === 3) d11 += d7 * 2;
            strip.push([d10 + d2, i1 * 16, d11 + d3], [d8 + d4, (i1 + 1) * 16, d9 + d5]);
          }
          for (let s = 0; s + 2 < strip.length; s++) tris.push(strip[s], strip[s + 1], strip[s + 2]);
        }
      }
    }
    const data = new Float32Array(tris.length * 9);
    tris.forEach((p, i) => data.set([p[0] - 0.5, p[1], p[2] - 0.5, 0, 0, col[0], col[1], col[2], col[3]], i * 9));
    const mesh = this.device.createMesh(FORMAT.color, data);
    v.ownMeshes.push(mesh);
    v.boltNode = new Node().addDrawable(mesh, material('color', null, colorParams(1, 1, 1, 1, 0, 0), { blend: 'add', depthWrite: false }), { order: 5 });
    v.boltNode.visible = e.lightningState >= 0;
    v.root.add(v.boltNode);
  }

  _renderFishhook(e, v, p, partial) {
    const g = this.game;
    let ox, oy, oz;
    if (e.owner === g.entityId) {
      const eye = g.eyePosition(partial);
      const look = g.lookVector(partial);
      ox = eye[0] + look[0] * 0.5 - look[2] * 0.35; oy = eye[1] - 0.45; oz = eye[2] + look[2] * 0.5 + look[0] * 0.35;
    } else {
      const o = g.entities.get(e.owner);
      if (!o) return;
      const op = g.entities.interp(o, partial);
      ox = op.x; oy = op.y + 1.2; oz = op.z;
    }
    const data = new Float32Array(32 * 9);
    let prev = null, o = 0;
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      const pt = [p.x + (ox - p.x) * t, p.y + 0.25 + (oy - p.y - 0.25) * (t * t + t) * 0.5, p.z + (oz - p.z) * t];
      if (prev) {
        data.set([prev[0], prev[1], prev[2], 0, 0, 1, 1, 1, 1], o); o += 9;
        data.set([pt[0], pt[1], pt[2], 0, 0, 1, 1, 1, 1], o); o += 9;
      }
      prev = pt;
    }
    this.device.updateMesh(v.lineMesh, data);
  }

  // ---------------------------------------------------------------- GUI player preview (GuiInventory.drawEntityOnScreen)

  drawPlayerInGui(gui, x, y, scale, mouseDX, mouseDY) {
    const g = this.game;
    if (!this._guiModel) {
      const s = this.skinFor({ uuid: g.playerUuid || '00000000-0000-0000-0000-000000000000' });
      this._guiModel = M.playerModel(s.slim, 64, 64);
      this._guiMat = entityMaterial(this.skinTex(s), { alphaTest: 0.1, fullBright: true });
      const root = new Node();
      for (const r of this._guiModel.roots) root.add(r.build());
      for (const r of this._guiModel.roots) r.setMaterial(this._guiMat);
      this._guiRoot = root;
    }
    const pl = g.player;
    const body = Math.atan(mouseDX / 40) * 20;
    const yaw = Math.atan(mouseDX / 40) * 40;
    const pitch = -Math.atan(mouseDY / 40) * 20;
    const m = this._guiModel;
    m.animate(m, { ls: 0, lsa: 0, age: g.ticks, yaw: yaw - body, pitch, swing: -9999, sneak: pl.sneaking, heldRight: g.inventory.held() ? 1 : 0 });
    for (const r of m.roots) r.sync();
    // translate(x, y, 50), scale(-s, s, s), rotate 180 Z, rotate X (-atan(my/40)*20), then the living renderer
    const mm = mat4.create();
    mat4.translate(mm, mm, x, y, 50);
    mat4.scale(mm, mm, -scale, scale, scale);
    mat4.rotateZ(mm, mm, Math.PI);
    mat4.rotateX(mm, mm, -Math.atan(mouseDY / 40) * 20 * D2R);
    mat4.rotateY(mm, mm, (180 - body) * D2R);
    mat4.scale(mm, mm, -1, -1, 1);
    mat4.translate(mm, mm, 0, -1.5078125 + (pl.sneaking ? 0.125 : 0), 0);
    mat4.scale(mm, mm, 1 / 16, 1 / 16, 1 / 16);
    gui.drawNode(this._guiRoot, mm);
  }
}

function copyPose(from, to) {
  for (const k of Object.keys(to.parts || {})) {
    const a = from.parts[k], b = to.parts[k];
    if (a && b && a instanceof Object && 'rx' in a && 'rx' in b) b.copyAngles(a);
  }
}

function armorMaterialIndex(name) {
  const match = /^(leather|chainmail|iron|diamond|golden|turtle)_(helmet|chestplate|leggings|boots)$/.exec(name);
  return match ? ['leather', 'chainmail', 'iron', 'diamond', 'golden', 'turtle'].indexOf(match[1]) : -1;
}

// RenderArrow geometry (in arrow pixel units; scaled by 0.05625 and offset -4 on x)
function arrowMesh() {
  const pos = [], uv = [], nor = [];
  const quad = (pts, uvs, n) => { for (let i = 0; i < 4; i++) { pos.push(pts[i][0] - 4, pts[i][1], pts[i][2]); uv.push(uvs[i][0], uvs[i][1]); nor.push(n[0], n[1], n[2]); } };
  const f = 0, f1 = 0.5, f2 = 0, f3 = 5 / 32, f4 = 0, f5 = 0.15625, f6 = 5 / 32, f7 = 10 / 32;
  quad([[-7, -2, -2], [-7, -2, 2], [-7, 2, 2], [-7, 2, -2]], [[f4, f6], [f5, f6], [f5, f7], [f4, f7]], [1, 0, 0]);
  quad([[-7, 2, -2], [-7, 2, 2], [-7, -2, 2], [-7, -2, -2]], [[f4, f6], [f5, f6], [f5, f7], [f4, f7]], [-1, 0, 0]);
  for (let j = 0; j < 4; j++) {
    const a = (j + 1) * Math.PI / 2;
    const c = Math.cos(a), s = Math.sin(a);
    const rot = (p) => [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c];
    quad([rot([-8, -2, 0]), rot([8, -2, 0]), rot([8, 2, 0]), rot([-8, 2, 0])], [[f, f2], [f1, f2], [f1, f3], [f, f3]], rot([0, 0, 1]));
  }
  return entityMesh(pos, uv, nor, null, { quads: true });
}

export { uuidHash, modelDevice, toDraw };

// EntityMinecart.MATRIX: the two exits of each named rail shape.
const RAIL_EXITS = [[[0, 0, -1], [0, 0, 1]], [[-1, 0, 0], [1, 0, 0]], [[-1, -1, 0], [1, 0, 0]], [[-1, 0, 0], [1, -1, 0]], [[0, 0, -1], [0, -1, 1]],
  [[0, -1, -1], [0, 0, 1]], [[0, 0, 1], [1, 0, 0]], [[0, 0, 1], [-1, 0, 0]], [[0, 0, -1], [-1, 0, 0]], [[0, 0, -1], [1, 0, 0]]];
const RAILS = new Set(['rail', 'powered_rail', 'detector_rail', 'activator_rail']);
const RAIL_SHAPES = ['north_south', 'east_west', 'ascending_east', 'ascending_west', 'ascending_north', 'ascending_south',
  'south_east', 'south_west', 'north_west', 'north_east'];
// Flattened state IDs do not contain a rail-shape metadata nibble.
function railShape(w, x, y, z) {
  const st = w.getState(x, y, z), b = getBlock(st);
  if (!b || !RAILS.has(b.name)) return null;
  const shape = RAIL_SHAPES.indexOf(getStateProperties(st).shape);
  return shape < 0 ? null : shape;
}

// EntityMinecart.getPos: the point on the rail nearest to the position
function railPos(w, x, y, z) {
  const i = Math.floor(x), k = Math.floor(z);
  let j = Math.floor(y);
  if (railShape(w, i, j - 1, k) !== null) j--;
  const dir = railShape(w, i, j, k);
  if (dir === null) return null;
  const a = RAIL_EXITS[dir];
  const d0 = i + 0.5 + a[0][0] * 0.5, d1 = j + 0.0625 + a[0][1] * 0.5, d2 = k + 0.5 + a[0][2] * 0.5;
  const d3 = i + 0.5 + a[1][0] * 0.5, d4 = j + 0.0625 + a[1][1] * 0.5, d5 = k + 0.5 + a[1][2] * 0.5;
  const d6 = d3 - d0, d7 = (d4 - d1) * 2, d8 = d5 - d2;
  let d9;
  if (d6 === 0) d9 = z - k;
  else if (d8 === 0) d9 = x - i;
  else d9 = ((x - d0) * d6 + (z - d2) * d8) * 2;
  let ry = d1 + d7 * d9;
  if (d7 < 0) ry += 1;
  if (d7 > 0) ry += 0.5;
  return [d0 + d6 * d9, ry, d2 + d8 * d9];
}

// EntityMinecart.getPosOffset: getPos `offset` blocks along the rail
function railPosOffset(w, x, y, z, offset) {
  const i = Math.floor(x), k = Math.floor(z);
  let j = Math.floor(y);
  if (railShape(w, i, j - 1, k) !== null) j--;
  const dir = railShape(w, i, j, k);
  if (dir === null) return null;
  y = j;
  if (dir >= 2 && dir <= 5) y = j + 1; // ascending shapes
  const a = RAIL_EXITS[dir];
  let d0 = a[1][0] - a[0][0], d1 = a[1][2] - a[0][2];
  const d2 = Math.sqrt(d0 * d0 + d1 * d1);
  d0 /= d2; d1 /= d2;
  x += d0 * offset; z += d1 * offset;
  if (a[0][1] !== 0 && Math.floor(x) - i === a[0][0] && Math.floor(z) - k === a[0][2]) y += a[0][1];
  else if (a[1][1] !== 0 && Math.floor(x) - i === a[1][0] && Math.floor(z) - k === a[1][2]) y += a[1][1];
  return railPos(w, x, y, z);
}

// ImageBufferDownload.parseUserSkin (1.8+): skins become 64x64 (times the HD factor). Legacy 64x32 skins get their
// limbs copied (mirrored) into the separate left-limb areas. The base layer is made opaque everywhere, and the hat layer
// cleared unless it already has transparency (old skins painted it solid).
export function parseUserSkin(img) {
  let W = 64, H = 64, k = 1;
  while (W < img.width || H < img.height) { W *= 2; H *= 2; k *= 2; }
  const d = new Uint8Array(W * H * 4);
  for (let y = 0; y < Math.min(img.height, H); y++) d.set(img.data.subarray(y * img.width * 4, y * img.width * 4 + Math.min(img.width, W) * 4), y * W * 4);
  if (img.height === 32 * k) {
    // Graphics.drawImage(src, dx1, dy1, dx2, dy2, sx1, sy1, sx2, sy2): dx1 > dx2 mirrors horizontally
    const draw = (dx1, dy1, dx2, dy2, sx1, sy1, sx2, sy2) => {
      const w = Math.abs(dx2 - dx1), h = dy2 - dy1, flip = dx1 > dx2, x0 = Math.min(dx1, dx2);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const sx = sx1 + (flip ? w - 1 - x : x), sy = sy1 + y;
        const si = (sy * W + sx) * 4, di = ((dy1 + y) * W + x0 + x) * 4;
        d[di] = d[si]; d[di + 1] = d[si + 1]; d[di + 2] = d[si + 2]; d[di + 3] = d[si + 3];
      }
    };
    for (const r of [[24, 48, 20, 52, 4, 16, 8, 20], [28, 48, 24, 52, 8, 16, 12, 20], [20, 52, 16, 64, 8, 20, 12, 32], [24, 52, 20, 64, 4, 20, 8, 32],
      [28, 52, 24, 64, 0, 20, 4, 32], [32, 52, 28, 64, 12, 20, 16, 32], [40, 48, 36, 52, 44, 16, 48, 20], [44, 48, 40, 52, 48, 16, 52, 20],
      [36, 52, 32, 64, 48, 20, 52, 32], [40, 52, 36, 64, 44, 20, 48, 32], [44, 52, 40, 64, 40, 20, 44, 32], [48, 52, 44, 64, 52, 20, 56, 32]]) {
      draw(...r.map((v) => v * k));
    }
  }
  const opaque = (x1, y1, x2, y2) => { for (let y = y1; y < y2; y++) for (let x = x1; x < x2; x++) d[(y * W + x) * 4 + 3] = 255; };
  const transparent = (x1, y1, x2, y2) => {
    for (let y = y1; y < y2; y++) for (let x = x1; x < x2; x++) if (d[(y * W + x) * 4 + 3] < 128) return;
    for (let y = y1; y < y2; y++) for (let x = x1; x < x2; x++) d[(y * W + x) * 4 + 3] = 0;
  };
  opaque(0, 0, 32 * k, 16 * k);
  transparent(32 * k, 0, 64 * k, 32 * k);
  opaque(0, 16 * k, 64 * k, 32 * k);
  opaque(16 * k, 48 * k, 48 * k, 64 * k);
  return { width: W, height: H, data: d };
}
