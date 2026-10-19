// Entity rendering (RenderManager + Render* classes) on the gfx scene graph.
import * as M from './entity-models.js';

const M_dragon = () => M.dragonParts();
import { entityMaterial, entityMesh, modelDevice, Part } from './boxmodel.js';
import { applyTransform } from './item-renderer.js';
import { buildTextMeshes, destroyTextMeshes } from './text-mesh.js';
import { blocks } from '../world/blocks.js';
import { resolveState } from '../world/blockstates.js';
import { FORMAT, colorParams, EntityParams } from '../gfx/device.js';
import { mat4, D2R, aabbInFrustum } from '../gfx/math.js';
import { Node, material, drawTree, toDraw } from '../gfx/scene.js';
import { JavaRandom } from '../util/jrandom.js';
import { decodePng } from '../util/png.js';
import { decodeBase64 } from '../util/base64.js';
import { platform } from '../platform/platform.js';
import { fetchSkin } from '../net/proxies.js';
import { EntityFire } from './entity-fire.js';

const ARMOR_MATS = ['leather', 'chainmail', 'iron', 'diamond', 'gold'];

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
const PAINTINGS = {
  Kebab: [16, 16, 0, 0], Aztec: [16, 16, 16, 0], Alban: [16, 16, 32, 0], Aztec2: [16, 16, 48, 0], Bomb: [16, 16, 64, 0], Plant: [16, 16, 80, 0],
  Wasteland: [16, 16, 96, 0], Pool: [32, 16, 0, 32], Courbet: [32, 16, 32, 32], Sea: [32, 16, 64, 32], Sunset: [32, 16, 96, 32], Creebet: [32, 16, 128, 32],
  Wanderer: [16, 32, 0, 64], Graham: [16, 32, 16, 64], Match: [32, 32, 0, 128], Bust: [32, 32, 32, 128], Stage: [32, 32, 64, 128], Void: [32, 32, 96, 128],
  SkullAndRoses: [32, 32, 128, 128], Wither: [32, 32, 160, 128], Fighters: [64, 32, 0, 96], Pointer: [64, 64, 0, 192], Pigscene: [64, 64, 64, 192],
  BurningSkull: [64, 64, 128, 192], Skeleton: [64, 48, 192, 64], DonkeyKong: [64, 48, 192, 112],
};
const STATE_OPAQUE = { blend: 'none' };
const CULLABLE = new Set(['player', 'mob', 'armorstand', 'item', 'xp', 'arrow', 'projectile', 'falling', 'tnt', 'boat', 'minecart', 'crystal']);
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
    this.meshCache = new Map();
    this.atlasTex = () => game.assets.atlasTexture;
    // Shadow: unit quad on the XZ plane
    this.shadowMesh = game.device.createMesh(FORMAT.color, new Float32Array([
      -0.5, 0, -0.5, 0, 0, 1, 1, 1, 1, -0.5, 0, 0.5, 0, 1, 1, 1, 1, 1, 0.5, 0, 0.5, 1, 1, 1, 1, 1, 1, 0.5, 0, -0.5, 1, 0, 1, 1, 1, 1,
    ]), { quads: true });
  }

  // Drop everything (resource reload / world change)
  reset() {
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

  skinFor(e) {
    let s = this.skins.get(e.uuid);
    if (s) return s;
    const slim = (uuidHash(e.uuid) & 1) === 1;
    s = { path: slim ? 'entity/alex.png' : 'entity/steve.png', slim, texture: null };
    // Custom skin from the player_info textures property (fetched through the proxy)
    const info = this.game.scoreboard.players && this.game.scoreboard.players.get(e.uuid);
    const prop = info && info.properties && info.properties.find((p) => p.name === 'textures');
    if (prop) {
      try {
        const tj = JSON.parse(new TextDecoder().decode(decodeBase64(prop.value)));
        const skin = tj.textures && tj.textures.SKIN;
        if (skin && skin.url) {
          s.slim = !!(skin.metadata && skin.metadata.model === 'slim');
          fetchSkin(skin.url).then((bytes) => {
            const img = decodePng(bytes);
            s.legacy = img.height === 32;
            s.image = img;
            s.texture = this.game.assets.makeTexture('skin:' + e.uuid, img.width, img.height, img.data);
            this._rebuild(e.uuid);
          }).catch(() => {});
        }
      } catch (err) { /* ignore */ }
    }
    this.skins.set(e.uuid, s);
    return s;
  }

  // Texture reference for a skin (falls back to the default skin until loaded)
  skinTex(s) { return () => s.texture || this.game.assets.texture(s.path); }

  _rebuild(uuid) {
    for (const [id, v] of this.visuals) if (v.uuid === uuid) { const e = this.game.entities.get(id); if (e) this.remove(e); }
    if (uuid === this.game.playerUuid) { this._guiModel = null; if (this.game.handRenderer) this.game.handRenderer.reset(); }
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
      case 51: return e.wither ? 'entity/skeleton/wither_skeleton.png' : 'entity/skeleton/skeleton.png';
      case 52: return 'entity/spider/spider.png';
      case 53: case 54: return e.villagerZombie ? 'entity/zombie/zombie_villager.png' : 'entity/zombie/zombie.png';
      case 55: return 'entity/slime/slime.png';
      case 56: return 'entity/ghast/ghast.png';
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
      case 90: return 'entity/pig/pig.png';
      case 91: return 'entity/sheep/sheep.png';
      case 92: return 'entity/cow/cow.png';
      case 93: return 'entity/chicken.png';
      case 94: return 'entity/squid.png';
      case 95: return e.tamed ? 'entity/wolf/wolf_tame.png' : e.angry ? 'entity/wolf/wolf_angry.png' : 'entity/wolf/wolf.png';
      case 96: return 'entity/cow/mooshroom.png';
      case 97: return 'entity/snowman.png';
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
      case 120: return 'entity/villager/' + (VILLAGER_TEX[e.profession] || 'villager') + '.png';
      default: return 'entity/steve.png';
    }
  }

  _modelFor(e) {
    if (e.kind === 'player') {
      const s = this.skinFor(e);
      return M.playerModel(s.slim, 64, s.legacy ? 32 : 64);
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
      case 90: return M.pig();
      case 91: return M.sheep(false);
      case 92: case 96: return M.cow();
      case 93: return M.chicken();
      case 94: return M.squid();
      case 95: return M.wolf();
      case 97: return M.snowman();
      case 98: return M.ocelot();
      case 99: return M.ironGolem();
      case 100: return M.horse();
      case 101: return M.rabbit();
      case 120: return M.villager(64, 64, false);
      default: return M.biped();
    }
  }

  _makeModelObject(model, mat) {
    const g = new Node();
    for (const r of model.roots) g.add(r.build());
    for (const r of model.roots) r.setMaterial(mat);
    return g;
  }

  // LayerMooshroomMushroom: red mushroom block models, two on the back and one on the head
  _addMushrooms(v, model) {
    const bm = this.game.assets.modelStore.bakeVariant('red_mushroom', {}, 'normal', 0);
    const mesh = bm && this.game.itemRenderer.blockMesh({ baked: bm, name: 'red_mushroom' });
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
    const tex = e.kind === 'player' ? this.skinTex(this.skinFor(e)) : (texPath || 'entity/steve.png');
    v.texPath = texPath;
    const model = this._modelFor(e);
    const mat = this._mat(v, tex, { alphaTest: 0.1, cull: !(e.kind === 'player' || e.type === 68) });
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
    v.modelGroup.add(this._makeModelObject(model, mat));
    // Overlay layers
    const addLayer = (m, tex2, opts = {}) => {
      const lm = this._mat(v, tex2, { alphaTest: 0.1, ...opts });
      const obj = this._makeModelObject(m, lm);
      v.modelGroup.add(obj);
      v.layers.push({ model: m, mat: lm, obj, ...opts });
      return v.layers[v.layers.length - 1];
    };
    if (e.kind === 'mob') {
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
      if (e.type === 51 || e.type === 53 || e.type === 54 || e.type === 57) this._addArmorLayers(v, e);
      if (e.type === 96) v.mushroomLayer = true;
    }
    if (e.kind === 'player' || e.kind === 'armorstand') this._addArmorLayers(v, e);
    v.atlasMat = this._mat(v, this.atlasTex, { alphaTest: 0.1, transparent: true }); // RenderItem blends
    // Held item holder (attached to right arm if present)
    v.itemHolder = null;
    if (model.parts && model.parts.rightArm && model.parts.rightArm.obj) {
      const h = new Node();
      h.scale.set(16, 16, 16);
      model.parts.rightArm.obj.add(h);
      v.itemHolder = h;
    }
    if (model.parts && model.parts.head && model.parts.head.obj && (e.kind === 'player' || e.kind === 'mob' || e.kind === 'armorstand')) {
      const h = new Node();
      h.scale.set(16, 16, 16);
      model.parts.head.obj.add(h);
      v.headHolder = h;
    }
    if (v.mushroomLayer) this._addMushrooms(v, model);
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
    // LayerEnderDragonEyes: the same geometry again with the eyes texture
    unit.traverse((n) => { for (const d of [...n.drawables]) n.drawables.push({ ...d, mat: eyes, order: 2 }); });
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
    const cm = mat4.create();
    mat4.rotateY(cm, cm, -off(7)[0] * D2R);
    mat4.rotateX(cm, cm, (off(5)[1] - off(10)[1]) * 10 * D2R);
    mat4.translate(cm, cm, 0, 0, 1);
    mat4.scale(cm, cm, -1, -1, 1);
    mat4.translate(cm, cm, 0, -1.5078125, 0);
    v.corpse.matrix = cm;
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
    const overlay = e.hurtTime > 0 || e.deathTime > 0 ? 0.3 : 0;
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
    n.addDrawable(this.shadowMesh, material('color', 'misc/shadow.png', v.shadowParams, { blend: 'alpha', depthWrite: false, polygonOffset: true }), { order: 3 });
    v.shadow = n;
    v.root.add(n);
  }

  _blockObject(state, mat) {
    const g = this.game;
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
      case 'arrow': {
        v = { root: new Node(), kind: 'arrow', materials: [] };
        const mat = this._mat(v, 'entity/arrow.png', { alphaTest: 0.1 });
        v.inner = new Node();
        v.inner.addDrawable(this._cachedMesh('arrow', arrowMesh), mat);
        v.root.add(v.inner);
        break;
      }
      case 'projectile': {
        const itemId = { 61: 332, 62: 344, 65: 368, 72: 381, 73: 373, 75: 384, 64: 385, 63: 385, 66: 0, 76: 401 }[e.type];
        v = { root: new Node(), kind: 'projectile', materials: [] };
        if (itemId) {
          const ir = this.game.itemRenderer;
          const item = e.type === 73 ? { id: 373, damage: e.objectData || 0, count: 1 } : { id: itemId, damage: 0, count: 1 };
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
          }
        } else if (e.type === 66) {
          // wither skull
          const mat = this._mat(v, 'entity/wither/wither.png');
          const head = M.biped(64, 64).parts.head;
          const g = new Node(); g.add(head.build()); head.setMaterial(mat);
          g.scale.set(-1 / 16, -1 / 16, 1 / 16);
          v.root.add(g);
        }
        break;
      }
      case 'falling': case 'tnt': {
        v = atlasOnly(e.kind);
        const st = e.kind === 'tnt' ? (46 << 4) : e.blockState;
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
        const mat = this._mat(v, e.kind === 'boat' ? 'entity/boat.png' : 'entity/minecart.png');
        v.inner = new Node();
        const mg = new Node();
        mg.add(this._makeModelObject(model, mat));
        mg.scale.set(-1 / 16, -1 / 16, 1 / 16);
        v.inner.add(mg);
        v.root.add(v.inner);
        if (e.kind === 'minecart') {
          const disp = e.customDisplay && e.displayBlock ? ((e.displayBlock & 0xfff) << 4) | ((e.displayBlock >> 12) & 15) : { 1: 54 << 4, 2: 61 << 4, 3: 46 << 4, 4: 52 << 4, 5: 154 << 4, 6: 137 << 4 }[e.cartType];
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
        const bm = this.game.assets.modelStore.bakeVariant('item_frame', {}, 'normal', 0);
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
        const mat = this._mat(v, 'entity/endercrystal/endercrystal.png', { fullBright: true });
        // ModelEnderCrystal base (RenderEnderCrystal builds it with the base): scale 2, translate -0.5
        const base = new Part(64, 32).tex(0, 16).box(-6, 0, -6, 12, 4, 12);
        const bg = new Node(); bg.add(base.build()); base.setMaterial(mat);
        bg.scale.set(2 / 16, 2 / 16, 2 / 16); bg.position.set(0, -1, 0);
        v.root.add(bg);
        v.cubes = [];
        for (const [u, vv, s] of [[0, 0, 8], [32, 0, 8], [32, 0, 6]]) {
          const pp = M.biped(64, 32).parts.head;
          pp.boxes = []; pp.tex(u, vv).box(-s / 2, -s / 2, -s / 2, s, s, s);
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
        const p = M.biped(32, 32).parts.head; p.boxes = []; p.tex(0, 0).box(-3, -8, -3, 6, 8, 6);
        const g = new Node(); g.add(p.build()); p.setMaterial(mat); g.scale.set(-1 / 16, -1 / 16, 1 / 16); g.position.y = 0.5;
        v.root.add(g);
        break;
      }
      default: v = { root: new Node(), kind: 'none', materials: [] };
    }
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
      if (v && v.kind === 'living' && e.kind === 'mob' && this._texFor(e) !== v.texPath) { this.remove(e); v = null; }
      const p = g.entities.interp(e, partial);
      const dx = p.x - camPos[0], dy = p.y - camPos[1], dz = p.z - camPos[2];
      const d2 = dx * dx + dy * dy + dz * dz;
      // RenderArmorStand.canRenderName ignores invisibility: invisible stands with a visible custom name are
      // how servers (Hypixel NPCs, holograms) float text, so keep just their name tag
      const floatingTag = e.kind === 'armorstand' && e.customName && e.nameVisible;
      if (dx * dx + dz * dz > far || (e.invisible && e.kind !== 'player' && !floatingTag)) { if (v) v.root.visible = false; continue; }
      // Entity culling: frustum + sections hidden behind terrain (never the camera's own entity)
      let tagOnly = !!(e.invisible && floatingTag);
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
      // LOD: far living entities re-pose less often (every 2nd frame past 32 blocks, every 4th past 64)
      v.lodSkip = d2 > 4096 ? (this.frame + e.id) % 4 !== 0 : d2 > 1024 ? (this.frame + e.id) % 2 !== 0 : false;
      if (v.lodSkip) this.stats.lod++;
      v.root.position.set(p.x, p.y, p.z);
      if (e.onFire) burning.push({ e, p });
      const light = this._light(p.x, p.y + (e.eyeHeight || 0.5), p.z);
      for (const m of v.materials) m.params.setLight(light[0], light[1]);
      try {
        switch (v.kind) {
          case 'living': this._renderLiving(e, v, p, partial); break;
          case 'dragon': this._renderDragon(e, v, partial); break;
          case 'item': this._renderItem(e, v, p, partial); break;
          case 'xp': this._renderXp(e, v, partial); break;
          case 'arrow': this._renderArrow(e, v, partial); break;
          case 'falling': if (v.inner) v.inner.position.set(0, 0.5, 0); break;
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
  }

  // Draw the entity tree (called by the world renderer)
  draw(device, camRot) {
    drawTree(device, this.group, { camRot, resolve: this.resolve });
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
    const body = lerpAngle(e.prevBodyYaw, e.bodyYaw);
    const head = lerpAngle(e.prevHeadYaw, e.headYaw);
    const pitch = e.prevPitch + (e.pitch - e.prevPitch) * partial;
    const age = e.ticks + partial;
    const ls = e.limbSwing - e.limbSwingAmount * (1 - partial);
    let lsa = e.prevLimbSwingAmount + (e.limbSwingAmount - e.prevLimbSwingAmount) * partial;
    if (lsa > 1) lsa = 1;
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
    let yOffset = 0;
    if (e.kind === 'player' && e.sneaking) yOffset = -0.125;
    v.root.position.y += yOffset;
    v.scaleGroup.rotation.set(0, 0, -deathRot * D2R * (e.kind === 'mob' && (e.type === 52 || e.type === 59) ? 2 : 1));
    // Pre-render scaling
    let sx = 1, sy = 1, sz = 1;
    const model = v.model;
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
        case 120: sx = sy = sz = 0.9375; break;
        case 68: if (e.elder) sx = sy = sz = 2.35; break;
        case 100: if (e.horseType === 1 || e.horseType === 2) { sx = sz = sy = e.horseType === 1 ? 0.87 : 0.92; } break;
        default: break;
      }
    }
    v.scaleGroup.scale.set(-sx, -sy, sz);
    v.scaleGroup.position.set(0, 0, 0);
    v.modelGroup.position.set(0, -1.5078125, 0);
    if (e.child) v.scaleGroup.scale.multiplyScalar(0.5);
    // Animate
    const held = e.equipment[0];
    const args = {
      ls, lsa, age, yaw: head - body, pitch, swing: swing > 0 ? swing : -9999, partial,
      sneak: !!e.sneaking, riding: e.riding >= 0, heldRight: held ? (e.usingItem && held && [267, 268, 272, 276, 283].includes(held.id) ? 3 : 1) : 0,
      aimedBow: e.kind === 'mob' && e.type === 51 ? !!(held && held.id === 261) : !!(e.usingItem && held && held.id === 261),
      onGround: e.onGround, eatingGrass: e.eatingGrass || 0, sitting: e.sitting, angry: e.angry, hanging: e.hanging,
      carrying: !!e.carried, screaming: e.screaming, horseType: e.horseType, saddled: !!(e.horseFlags & 4) || e.saddled,
      tailRotation: e.tamed ? (0.55 - (20 - (e.wolfHealth || 20)) * 0.02) * Math.PI : Math.PI / 5,
      witchDrinking: e.kind === 'mob' && e.type === 66 && e.usingItem,
      squish: 0,
    };
    if (e.kind === 'armorstand') {
      const m = e.metadata;
      const r = (i) => (m[i] ? [m[i].pitch, m[i].yaw, m[i].roll] : null);
      args.poses = { head: r(11), body: r(12), leftArm: r(13), rightArm: r(14), leftLeg: r(15), rightLeg: r(16) };
      args.showArms = !!(m[10] & 4); args.noBasePlate = !!(m[10] & 8);
      if (m[10] & 1) v.scaleGroup.scale.multiplyScalar(0.5);
    }
    if (v.lodSkip && v.posed) {
      // Keep the previous pose; only the transforms above were updated
      this._updateHeld(e, v, held, args);
      this._updateNameTag(e, v, p);
      return;
    }
    v.posed = true;
    model.animate(model, args);
    for (const r of model.roots) r.sync();
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
    for (const L of v.layers) {
      L.model.animate(L.model, args);
      copyPose(model, L.model);
      for (const r of L.model.roots) r.sync();
    }
    if (v.wool) v.wool.obj.visible = !e.sheared;
    if (v.wool) { const c = FLEECE[e.fleece || 0]; v.wool.mat.params.setTint(c[0], c[1], c[2], 1); }
    if (v.saddle) v.saddle.obj.visible = !!e.saddled;
    if (v.mushroomBack) { const vis = !e.child && !e.invisible; v.mushroomBack.visible = vis; if (v.mushroomHead) v.mushroomHead.visible = vis; }
    if (v.charge) {
      v.charge.obj.visible = !!e.powered;
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
    v.mainMat.params.p[3] = e.invisible ? 0.15 : 1;
    v.mainMat.state = e.invisible ? STATE_ALPHA : { ...STATE_OPAQUE, cull: v.mainMat.state.cull };
    // Held item
    this._updateHeld(e, v, held, args);
    this._updateHeadItem(e, v);
    // Name tag
    this._updateNameTag(e, v, p);
  }

  _updateArmor(e, v, model, args) {
    for (let slot = 1; slot <= 4; slot++) {
      const A = v.armor[slot];
      const item = e.equipment[slot];
      const idx = item ? armorMaterialIndex(item.id) : -1;
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

  _updateHeld(e, v, held, args) {
    if (!v.itemHolder) return;
    const key = held ? held.id + ':' + held.damage + ':' + (this.game.items.isEnchanted(held) ? 1 : 0) : null;
    if (key !== v.heldKey) {
      v.heldKey = key;
      v.itemHolder.clear();
      v.heldT1 = null;
      if (held) {
        const io = this._itemObject(held, v.atlasMat);
        if (io) {
          const t1 = new Node();
          t1.position.set(-0.0625, 0.4375, 0.0625);
          // ItemRenderer.renderItem: x2 (3D) / preTransform x2 (flat), display transform, then renderItem x0.5
          const s2 = new Node();
          s2.scale.setScalar(2);
          const t2 = new Node();
          applyTransform(t2, io.model.display && io.model.display.thirdperson);
          const t3 = new Node();
          t3.scale.setScalar(0.5);
          t3.add(io.obj);
          t2.add(t3); s2.add(t2); t1.add(s2);
          v.itemHolder.add(t1);
          v.heldT1 = t1;
          v.heldGlint = io.obj.userData.glint ? io.obj : null;
        } else v.heldKey = undefined;
      }
    }
    if (v.heldT1) v.heldT1.position.y = 0.4375 + (args.sneak ? 0.203125 : 0);
    if (v.heldGlint) this.glints.push(v.heldGlint);
  }

  _updateHeadItem(e, v) {
    if (!v.headHolder) return;
    if (e.kind === 'mob' && e.type === 97) {
      if (v.headKey === 'pumpkin') return;
      v.headKey = 'pumpkin';
      const io = this._itemObject({ id: 86, damage: 0, count: 1 }, v.atlasMat);
      if (!io) return;
      // LayerSnowmanHead: translate(0,-0.34375,0), rotate 180 Y, scale(0.625,-0.625,-0.625)
      const t = new Node();
      t.position.set(0, -0.34375, 0);
      t.rotation.y = Math.PI;
      t.scale.set(0.625, -0.625, -0.625);
      t.add(io.obj);
      v.headHolder.add(t);
      return;
    }
    const helm = e.equipment[4];
    const isBlockHead = helm && (helm.id === 86 || helm.id === 91 || helm.id === 397 || (helm.id < 256 && helm.id !== 0 && armorMaterialIndex(helm.id) < 0));
    const key = isBlockHead ? helm.id + ':' + helm.damage : null;
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
    t.add(io.obj);
    v.headHolder.add(t);
  }

  _updateNameTag(e, v, p) {
    const g = this.game;
    let name = null;
    if (e.kind === 'player') {
      if (e.invisible) name = null;
      else if (e.customName) name = e.customName;
      else name = g.scoreboard.displayName ? g.scoreboard.displayName(e.uuid, e.name) : e.name;
    } else if (e.kind === 'armorstand') name = e.customName && e.nameVisible ? e.customName : null; // RenderArmorStand
    else if (e.customName && (e.nameVisible || (g.interaction.target && g.interaction.target.entity === e))) name = e.customName;
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
    // Find ground below
    let y = Math.floor(p.y);
    let found = false;
    for (let i = 0; i < 4; i++) {
      const b = blocks[w.getState(Math.floor(p.x), y - 1, Math.floor(p.z)) >> 4];
      if (b && b.boundingBox === 'block' && b.id !== 0) { found = true; break; }
      y--;
    }
    const size = e.kind === 'mob' && (e.type === 55 || e.type === 62) ? 0.25 * (e.size || 1) : e.kind === 'item' ? 0.15 : Math.min(e.width, 2) * 0.5;
    if (!found || e.invisible || e.deathTime > 0 || !this.game.settings.entityShadows) { v.shadow.visible = false; return; }
    const dist = p.y - y;
    const a = (1 - dist / 3) * 0.5;
    if (a <= 0) { v.shadow.visible = false; return; }
    v.shadow.visible = true;
    v.shadowParams[3] = a;
    const s = size * 2;
    v.shadow.scale.set(s, 1, s);
    // shadow node is a child of root; root is at p, so place it at ground level
    v.shadow.position.set(0, y - v.root.position.y + 0.002, 0);
  }

  _renderItem(e, v, p, partial) {
    const it = e.item;
    const key = it ? it.id + ':' + it.damage + ':' + Math.min(5, it.count) + ':' + (this.game.items.isEnchanted(it) ? 1 : 0) : null;
    if (key !== v.itemKey) {
      v.itemKey = key;
      if (v.inner) v.root.remove(v.inner);
      v.inner = null;
      v.glintNode = null;
      if (it) {
        const io = this._itemObject(it, v.atlasMat);
        if (io) {
          const copies = it.count > 40 ? 5 : it.count > 20 ? 4 : it.count > 5 ? 3 : it.count > 1 ? 2 : 1;
          v.inner = new Node();
          for (let i = 0; i < copies; i++) {
            const c = i === 0 ? io.obj : io.obj.clone();
            const holder = new Node();
            if (io.gui3d) {
              holder.scale.setScalar(0.25);
              if (i > 0) holder.position.set((Math.random() * 2 - 1) * 0.15 * 0.5, (Math.random() * 2 - 1) * 0.15 * 0.5, (Math.random() * 2 - 1) * 0.15 * 0.5);
            } else {
              holder.scale.setScalar(0.5);
              holder.position.z = i * 0.046875 * 0.5;
            }
            holder.add(c);
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
    v.inner.position.set(0, bob + 0.25 * 0.5, 0);
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
    v.inner.rotation.set(0, (180 - yaw) * D2R, 0);
    v.inner.position.set(0, e.kind === 'boat' ? 0.25 : 0.375, 0);
    void p;
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
    v.root.rotation.set(0, [Math.PI, Math.PI / 2, 0, -Math.PI / 2][f] || 0, 0);
    const isMap = e.item && e.item.id === 358;
    const mapId = isMap ? e.item.damage : -1;
    const mapObj = isMap ? this.game.items.maps.get(mapId) : null;
    const mapVer = mapObj ? mapObj.version : -1;
    const key = e.item ? e.item.id + ':' + e.item.damage + ':' + (e.rotation || 0) : null;
    void mapVer;
    // ItemFrame model: the "map" variant has a full-size back so the map covers the whole face
    const frameModel = isMap ? 'map' : 'normal';
    if (v.frameModel !== frameModel && v.frame) {
      const bm = this.game.assets.modelStore.bakeVariant('item_frame', {}, frameModel, 0);
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
          const h = new Node();
          h.position.set(0, 0, 0.4375);
          const s = io.gui3d ? 0.5 * 0.5 : 0.5;
          h.scale.setScalar(s);
          // RenderItemFrame: rotate(rotation * 45, Z), then flat items and skulls turn 180 around Y
          const isSkull = e.item.id === 397;
          h.rotation.set(0, 0, (e.rotation || 0) * Math.PI / 4);
          const inner = new Node();
          inner.rotation.set(0, !io.gui3d || isSkull ? Math.PI : 0, 0);
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
      this._guiModel = M.playerModel(s.slim, 64, s.legacy ? 32 : 64);
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

function armorMaterialIndex(id) {
  if (id >= 298 && id <= 301) return 0;
  if (id >= 302 && id <= 305) return 1;
  if (id >= 306 && id <= 309) return 2;
  if (id >= 310 && id <= 313) return 3;
  if (id >= 314 && id <= 317) return 4;
  return -1;
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
