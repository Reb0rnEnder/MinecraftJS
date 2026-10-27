// Item rendering: GUI icons (2D sprites + 3D block icons), counts/durability/glint,
// and 3D meshes for held/dropped items (port of ItemModelGenerator extrusion).
import { bedPiece, shulkerBox, skullModel } from './tile-renderer.js';
import { blockModel } from './entity-models.js';
import { composeBanner, bannerLayers, buildBanner, bannerSwing } from './banner.js';
import { FORMAT, colorParams } from '../gfx/device.js';
import { mat4, D2R } from '../gfx/math.js';
import { Node } from '../gfx/scene.js';
import { Part, entityMaterial, entityVertices } from './boxmodel.js';
import { platform } from '../platform/platform.js';


const ICON_PARAMS = colorParams(1, 1, 1, 1, 0.1, 0);
// RenderItem enables blending (SRC_ALPHA, ONE_MINUS_SRC_ALPHA): stained glass, ice etc. stay see-through
const ICON_STATE = { blend: 'alpha', depthTest: true, depthWrite: false, depthFunc: 'equal', cull: false };
const ICON_DEPTH_STATE = { blend: 'none', depthTest: true, depthWrite: true, colorWrite: false, cull: false };
const DIR_N = [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]];
const SHADE_GUI = [0.5, 1.0, 0.8, 0.8, 0.6, 0.6];
const rgbOf = (c) => [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];
const COLORS = ['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'light_gray',
  'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black'];
const GRASS_ITEMS = new Set(['grass_block', 'grass', 'fern', 'tall_grass', 'large_fern']);
const SKULLS = { skeleton_skull: 0, wither_skeleton_skull: 1, zombie_head: 2, player_head: 3, creeper_head: 4, dragon_head: 5 };
const POTIONS = new Set(['potion', 'splash_potion', 'lingering_potion', 'tipped_arrow']);
const modelPath = (name) => name.replace(/^minecraft:/, '');
// Shared banner compositor still indexes dyes black-first. Only adapt its colour input;
// protocol404 item IDs, flattened colour names and NBT stay untouched.
const bannerColors = (base, patterns) => bannerLayers(15 - (base & 15),
  (Array.isArray(patterns) ? patterns : []).map(p => ({ ...p, Color: 15 - (p.Color & 15) })));

export class ItemRenderer {
  constructor(game) {
    this.game = game;
    this.assets = game.assets;
    this.device = game.device;
    this.models = new Map();
    this.iconMeshes = new Map();
    this.meshes = new Map();
    this.blockMeshes = new Map();
    this.atlasTex = () => this.assets.atlasTexture;
  }

  get store() { return this.assets.modelStore; }
  get atlas() { return this.assets.atlas; }

  // Drop every cached mesh (resource reload)
  reset() {
    const d = this.device;
    for (const m of this.iconMeshes.values()) if (m && m.mesh) d.destroyMesh(m.mesh);
    for (const r of this.meshes.values()) if (r.mesh) d.destroyMesh(r.mesh);
    for (const m of this.blockMeshes.values()) if (m) d.destroyMesh(m);
    this.iconMeshes.clear(); this.meshes.clear(); this.blockMeshes.clear(); this.models.clear();
  }

  // ---------------------------------------------------------------- Model resolution

  // holder: the entity holding the item (null: the local player, or no holder for GUI / dropped items)
  modelFor(item, holder = null, held = false) {
    const g = this.game;
    const name = g.items.name(item.id);
    let path = 'item/' + (held && name === 'trident' ? 'trident_in_hand' : name);
    // ItemOverrideList.applyOverride: the last override whose predicates all reach their values wins
    const ov = this.store.resolveModel(path).overrides;
    if (ov && ov.length) {
      const pv = this._predicates(item, holder);
      for (let i = ov.length - 1; i >= 0; i--) {
        const o = ov[i];
        let ok = true;
        for (const k in o.predicate) if (!((pv[modelPath(k)] ?? -Infinity) >= o.predicate[k])) { ok = false; break; }
        if (ok) { path = modelPath(o.model); break; }
      }
    }
    const key = name + '|' + path, mname = path.replace(/^item\//, '');
    let m = this.models.get(key);
    if (m) return m;
    const res = this.store.resolveModel(path);
    // builtin/compass and builtin/clock are generated items whose sprite frame follows the world (TextureCompass/Clock)
    if (res.builtin === 'builtin/generated' || res.builtin === 'builtin/compass' || res.builtin === 'builtin/clock') {
      const layers = [];
      for (let i = 0; i < 5; i++) {
        const t = res.resolveTex('#layer' + i);
        if (t) layers.push(t);
      }
      m = { kind: 'generated', layers, display: res.display, name: mname };
    } else if (res.builtin === 'builtin/entity') {
      m = { kind: 'builtin', name: mname, display: res.display };
    } else if (res.elements) {
      const baked = this.store.bakeModel(path);
      m = { kind: 'block', baked, display: res.display, name: mname };
    } else {
      // Fallback: block item with no item model -> try block model by name
      const b = g.items.blockFor(item.id);
      const bm = b ? this.store.resolveModel('block/' + b.name) : null;
      if (bm && bm.elements) m = { kind: 'block', baked: this.store.bakeModel('block/' + b.name), display: {}, name: b.name };
      else m = { kind: 'generated', layers: ['block/stone'], display: {}, name: 'missing' };
    }
    m.itemName = name;
    m.path = path;
    this.models.set(key, m);
    return m;
  }

  // Item.addPropertyOverride values (IItemPropertyGetter) for this stack
  _predicates(item, holder) {
    const g = this.game, it = g.interaction;
    const local = !holder || holder.id === g.entityId;
    const pv = { lefthanded: holder ? (holder.mainHand === 0 ? 1 : 0) : (g.settings?.mainHand === 'left' ? 1 : 0) };
    pv.custom_model_data = Number(g.items.nbt(item)?.CustomModelData || 0);
    const max = g.items.maxDurability(item.id);
    const damage = g.items.damage(item);
    if (max > 0) { pv.damaged = g.items.isDamageable(item) && damage > 0 ? 1 : 0; pv.damage = Math.min(1, damage / max); }
    const using = local ? g.player.usingItem && (g.inventory.held() === item || g.inventory.offhand === item) : holder && holder.usingItem;
    switch (g.items.name(item.id)) {
      case 'bow':
        pv.pulling = 0; pv.pull = 0;
        if (using) { pv.pulling = 1; pv.pull = local && it ? Math.min(1, it.useTicks / 20) : 0; }
        break;
      case 'crossbow': {
        const charged = g.items.crossbowCharged(item);
        pv.charged = charged ? 1 : 0;
        pv.pulling = using && !charged ? 1 : 0;
        pv.pull = using && !charged ? (local ? it?.useTicks || 0 : holder.useTicks || 0) / g.items.crossbowChargeDuration(item) : 0;
        pv.firework = charged && g.items.nbt(item)?.ChargedProjectiles?.some(p => p.id === 'minecraft:firework_rocket') ? 1 : 0;
        break;
      }
      case 'shield': pv.blocking = using ? 1 : 0; break;
      case 'fishing_rod': pv.cast = local && g.entities?.fishingCast && g.inventory.held() === item ? 1 : 0; break;
      case 'elytra': pv.broken = damage >= max - 1 ? 1 : 0; break;
      case 'compass': pv.angle = g.compassAngle || 0; break;
      case 'clock': pv.time = g.clockTime || 0; break;
      case 'trident': pv.throwing = using ? 1 : 0; break;
      default: break;
    }
    pv.cooldown = local && g.cooldowns ? g.cooldownFraction(item.id, 0) : 0;
    return pv;
  }

  layerTint(item, layer) {
    const g = this.game;
    const name = g.items.name(item.id);
    if (name.startsWith('leather_') && layer === 0) {
      const tag = g.items.nbt(item);
      return tag && tag.display && tag.display.color !== undefined ? tag.display.color : 10511680;
    }
    // ItemColors: potions (all three kinds) and tipped arrow heads take PotionUtils.getColor on tint index 0; spawn eggs
    // their registered egg colours (EntityTag does not change ItemColors)
    if (POTIONS.has(name) && layer === 0) return g.items.potionColor(item);
    if (name.endsWith('_spawn_egg')) { const c = g.items.eggInfo(item); return c ? c[layer ? 1 : 0] : 0xffffff; }
    if (name === 'firework_star' && layer === 1) {
      const tag = g.items.nbt(item);
      const cols = tag && tag.Explosion && tag.Explosion.Colors;
      if (cols && cols.length) {
        let r = 0, gg = 0, b = 0;
        for (const c of cols) { r += (c >> 16) & 255; gg += (c >> 8) & 255; b += c & 255; }
        return ((r / cols.length) << 16) | ((gg / cols.length) << 8) | (b / cols.length);
      }
      return 0x8a8a8a;
    }
    if (name === 'filled_map' && layer === 1) return g.items.nbt(item)?.display?.MapColor ?? 0x46402e;
    return this._defaultTint(name);
  }

  iconKey(item, held = false, holder = null) {
    const name = this.game.items.name(item.id);
    let k = name;
    if (POTIONS.has(name) || name.endsWith('_spawn_egg') || name === 'filled_map') k += ':' + this.layerTint(item, 0) + ',' + this.layerTint(item, 1);
    if (name.startsWith('leather_') || name === 'firework_star') k += ':' + this.layerTint(item, 0) + ',' + this.layerTint(item, 1);
    k += ':' + this.modelFor(item, holder, held).path; // overrides (bow pulling, clock, compass, ...)
    if (name.endsWith('_banner') || name === 'shield') {
      const tag = this.game.items.nbt(item);
      k += ':' + JSON.stringify((tag && tag.BlockEntityTag) || null);
    }
    if(name==='player_head')k+=':'+JSON.stringify(this.game.items.nbt(item)?.SkullOwner||null);
    return k;
  }

  // ---------------------------------------------------------------- GUI

  // Draw an atlas sprite (e.g. an empty armour slot icon)
  drawSprite(gui, name, x, y, w = 16, h = 16) {
    const e = this.atlas.entries.get(name);
    if (e) gui.quad(this.assets.atlasTexture, x, y, x + w, y + h, e.uv[0], e.uv[1], e.uv[2], e.uv[3], WHITE);
  }

  // Draws item icon (16x16 GUI units) at x,y; overlay = count + durability
  drawItem(gui, item, x, y, overlay = true, popTime = 0, countText = null) {
    if (!item) return;
    const m = this.modelFor(item);
    if (popTime > 0) {
      const f1 = 1 + popTime / 5;
      gui.pushMatrix();
      gui.translate(x + 8, y + 12);
      gui.scaleBy(1 / f1, (f1 + 1) / 2);
      gui.translate(-(x + 8), -(y + 12));
    }
    const glint = this.game.items.hasEffect(item);
    if (m.kind === 'generated') {
      if (glint) { gui.pushMatrix(); gui.translate(0, 0, gui.nextIconDepth()); gui.setDepth({ depthTest: true, depthWrite: true }); }
      this._drawLayers(gui, item, m, x, y);
      if (glint) {
        this._glintQuads(gui, x, y);
        gui.setDepth(null);
        gui.popMatrix();
      }
    } else {
      this._icon3d(gui, item, m, x, y);
    }
    if (popTime > 0) gui.popMatrix();
    if (overlay) this.drawOverlay(gui, item, x, y, countText);
  }

  _drawLayers(gui, item, m, x, y) {
    const tex = this.assets.atlasTexture;
    for (let i = 0; i < m.layers.length; i++) {
      const e = this.atlas.entries.get(m.layers[i]);
      if (!e) continue;
      const c = rgbOf(this.layerTint(item, i));
      gui.quad(tex, x, y, x + 16, y + 16, e.uv[0], e.uv[1], e.uv[2], e.uv[3], [c[0], c[1], c[2], 1]);
    }
  }

  // RenderItem.renderEffect: two scrolling, rotated passes of the glint texture, additive, depth-equal on the item
  _glintQuads(gui, x, y) {
    const tex = this.assets.texture('misc/enchanted_item_glint.png', { wrap: 'repeat' });
    if (!tex) return;
    const t = platform().now();
    gui.setDepth({ depthTest: true, depthWrite: false, depthFunc: 'equal' });
    gui.setBlend('add');
    const col = [0.5 * 0.5, 0.25 * 0.5, 0.8 * 0.5, 1];
    // RenderItem.renderEffect: texture matrix scale(8) * translate(+-time / period / 8) * rotate(angle), applied to
    // the sprite's atlas coordinates: one texture width per period, pattern 8x the sprite's atlas size
    const k = 8 * 16 / (this.atlas.size || 1024);
    const pass = (period, angle, dir) => {
      const off = dir * (t % period) / period;
      const c = Math.cos(angle * D2R), s = Math.sin(angle * D2R);
      const uv = (px, py) => [(px * c - py * s) * k + off, (px * s + py * c) * k];
      const a = uv(0, 0), b = uv(0, 1), cc = uv(1, 1), d = uv(1, 0);
      gui.quadUV(tex, x, y, x + 16, y + 16, [a, b, cc, d], col);
    };
    pass(3000, -50, 1);
    pass(4873, 10, -1);
    gui.setBlend('alpha');
  }

  // RenderItem.renderItemOverlayIntoGUI (1.9+): count, durability bar (hue from green to red), item cooldown
  drawOverlay(gui, item, x, y, countText) {
    const g = this.game;
    const s = countText !== null && countText !== undefined ? countText : (item.count !== 1 ? String(item.count) : null);
    if (s) {
      const color = item.count < 1 ? 0xff5555 : 0xffffff;
      gui.text(s, x + 19 - 2 - gui.textWidth(s), y + 6 + 3, color, true);
    }
    const damage = g.items.damage(item);
    if (g.items.isDamageable(item) && damage > 0) {
      const max = g.items.maxDurability(item.id);
      const f2 = Math.max(0, (max - damage) / max);
      const i = Math.max(0, Math.round(13 - damage * 13 / max));
      gui.rect(x + 2, y + 13, x + 15, y + 15, 0xff000000);
      gui.rect(x + 2, y + 13, x + 2 + i, y + 14, (0xff000000 | hsvToRgb(f2 / 3, 1, 1)) >>> 0);
    }
    const cd = g.cooldownFraction ? g.cooldownFraction(item.id, g.partial || 0) : 0;
    if (cd > 0) gui.rect(x, y + Math.floor(16 * (1 - cd)), x + 16, y + Math.floor(16 * (1 - cd)) + Math.ceil(16 * cd), 0x7fffffff);
  }

  // RenderItem.setupGuiTransform + the model's gui transform + renderItem's translate(-0.5) (1.9+)
  _iconMatrix(x, y, z, display) {
    const m = mat4.create();
    mat4.translate(m, m, x + 8, y + 8, z);
    mat4.scale(m, m, 16, -16, 16);
    transformMatrix(m, display && display.gui);
    mat4.translate(m, m, -0.5, -0.5, -0.5);
    return m;
  }

  _icon3d(gui, item, m, x, y) {
    const key = this.iconKey(item);
    const z = gui.nextIconDepth();
    if (m.kind === 'block') {
      let im = this.iconMeshes.get(key);
      if (im === undefined) { im = this._blockIconMesh(m); this.iconMeshes.set(key, im); }
      if (!im) return;
      // depth first, then colour only where a face is frontmost: hidden faces of translucent blocks (stained
      // glass, ice) must not add a second layer of tint
      const mtx = this._iconMatrix(x, y, z, m.display);
      gui.drawMesh({ mesh: im.mesh, pipeline: 'color', textures: [this.assets.atlasTexture], params: ICON_PARAMS, state: ICON_DEPTH_STATE }, mtx);
      gui.drawMesh({ mesh: im.mesh, pipeline: 'color', textures: [this.assets.atlasTexture], params: ICON_PARAMS, state: ICON_STATE }, mtx);
      return;
    }
    let node = this.iconMeshes.get(key);
    if (node === undefined) { node = this._builtinObject(item, m, true); if (node) this.iconMeshes.set(key, node); }
    if (node) gui.drawNode(node, this._iconMatrix(x, y, z, m.display));
  }

  // GUI icon mesh (FORMAT.color) with vanilla GUI face shading baked into the vertex colours
  _blockIconMesh(m) {
    const quads = m.baked.quads;
    if (!quads.length) return null;
    const data = new Float32Array(quads.length * 4 * 9);
    let o = 0;
    for (const q of quads) {
      const sh = q.shade ? SHADE_GUI[q.dir] : 1;
      const [r, g, b] = rgbOf(q.tint >= 0 ? this._defaultTint(m.itemName || m.name) : 0xffffff);
      for (let i = 0; i < 4; i++) {
        data[o] = q.pos[i * 3]; data[o + 1] = q.pos[i * 3 + 1]; data[o + 2] = q.pos[i * 3 + 2];
        data[o + 3] = q.uv[i * 2]; data[o + 4] = q.uv[i * 2 + 1];
        data[o + 5] = r * sh; data[o + 6] = g * sh; data[o + 7] = b * sh; data[o + 8] = 1;
        o += 9;
      }
    }
    return { mesh: this.device.createMesh(FORMAT.color, data, { quads: true }) };
  }

  _defaultTint(name) {
    if (GRASS_ITEMS.has(name)) {
      // ItemColors/BlockColors without a world: GrassColor.get(0.5, 1.0), including resource packs.
      const pixels = this.assets.grassPixels, k = (127 * 256 + 127) * 4;
      return pixels ? (pixels[k] << 16) | (pixels[k + 1] << 8) | pixels[k + 2] : 0x91bd59;
    }
    if (name === 'lily_pad') return 0x71c35c; // BlockColors with no world/position
    if (name === 'vine') return 0x48b518;
    if (name.endsWith('_leaves')) {
      if (name.startsWith('spruce')) return 0x619961;
      if (name.startsWith('birch')) return 0x80a755;
      return 0x48b518;
    }
    return 0xffffff;
  }

  // Chest / skull / banner items (TileEntityItemStackRenderer). Node in 0..1 block space.
  _builtinObject(item, m, gui = false) {
    const name = m.itemName || m.name;
    const root = new Node();
    const mat = (tex) => entityMaterial(tex, { alphaTest: 0.1, fullBright: gui, guiLighting: gui });
    if (name === 'chest' || name === 'trapped_chest' || name === 'ender_chest') {
      const tex = name === 'ender_chest' ? 'entity/chest/ender.png' : name === 'trapped_chest' ? 'entity/chest/trapped.png' : 'entity/chest/normal.png';
      const { lid, below, knob } = blockModel('chest', ['lid', 'below', 'knob']); // ModelChest
      const g = new Node();
      for (const p of [lid, knob, below]) g.add(p.build());
      g.setMaterial(mat(tex));
      // ModelChest is in a y-down space scaled by 1/16 with rotate 180 X
      g.scale.set(1 / 16, -1 / 16, -1 / 16);
      g.position.set(0, 1, 1);
      root.add(g);
      return root;
    }
    // TileEntityItemStackRenderer: shulker boxes facing up, beds as head + foot (foot one block towards -z)
    if (name === 'shulker_box' || name.endsWith('_shulker_box')) {
      const color = name === 'shulker_box' ? '' : '_' + name.slice(0, -'_shulker_box'.length);
      root.add(shulkerBox(mat('entity/shulker/shulker' + color + '.png'), 1).node);
      return root;
    }
    if (name.endsWith('_bed')) {
      const m2 = mat('entity/bed/' + name.slice(0, -4) + '.png');
      root.add(bedPiece(m2, true, 0));
      const foot = new Node(); foot.position.set(0, 0, -1); foot.add(bedPiece(m2, false, 0));
      root.add(foot);
      return root;
    }
    if (SKULLS[name] !== undefined) {
      const type = SKULLS[name];
      const texPath = ['entity/skeleton/skeleton.png', 'entity/skeleton/wither_skeleton.png', 'entity/zombie/zombie.png',
        'entity/steve.png', 'entity/creeper/creeper.png', 'entity/enderdragon/dragon.png'][type];
      // the skull node is in scale(-1, -1, 1) 1/16 units; this item space flips z instead of x
      const g = new Node();
      const sk = skullModel(type, mat(type===3&&this.game.items.nbt(item)?.SkullOwner?this.game.entityRenderer.skullTexture(this.game.items.nbt(item).SkullOwner):texPath));
      sk.scale.set(1, 1, 1); g.add(sk);
      g.scale.set(1 / 16, -1 / 16, -1 / 16);
      g.position.set(0.5, 0, 0.5);
      root.add(g);
      return root;
    }
    if (name === 'shield' || name === 'shield_blocking') {
      // TileEntityItemStackRenderer: ModelShield under scale(1, -1, -1); the banner design (BannerTextures.SHIELD_DESIGNS,
      // base colour from BlockEntityTag.Base, white without) or the plain shield texture
      const tag = this.game.items.nbt(item);
      const bet = tag && tag.BlockEntityTag;
      let tex = 'entity/shield_base_nopattern.png';
      if (bet) {
        const base = bet.Base !== undefined ? bet.Base : 0;
        const img = composeBanner(this.assets, bannerColors(base, bet.Patterns), true);
        if (!img) return null;
        const key = 'shielditem:' + base + ':' + JSON.stringify(bet.Patterns || []);
        tex = this.assets.textures.get(key) || this.assets.makeTexture(key, img.width, img.height, img.data);
      }
      const { plate, handle } = blockModel('shield', ['plate', 'handle']);
      const g = new Node();
      for (const p of [plate, handle]) g.add(p.build());
      g.setMaterial(mat(tex));
      g.scale.set(1 / 16, -1 / 16, -1 / 16);
      root.add(g);
      return root;
    }
    if (name.endsWith('_banner')) {
      // TileEntityBannerRenderer with no world: standing, rotation 0, flag at time 0, colours from the item
      const tag = this.game.items.nbt(item);
      const bet = tag && tag.BlockEntityTag;
      const base = COLORS.indexOf(name.slice(0, -7));
      const img = composeBanner(this.assets, bannerColors(base, bet && bet.Patterns));
      if (!img) return null;
      const key = 'banneritem:' + base + ':' + JSON.stringify((bet && bet.Patterns) || []);
      const tex = this.assets.textures.get(key) || this.assets.makeTexture(key, img.width, img.height, img.data);
      const b = buildBanner(entityMaterial(tex, { alphaTest: 0.1, fullBright: gui, guiLighting: gui }), true, 0);
      b.swing.rotation.x = bannerSwing(0);
      return b.node;
    }
    if (name === 'trident') {
      // TileEntityItemStackRenderer: ModelTrident, scale(1, -1, -1).
      const { shaft } = blockModel('trident', ['shaft']);
      const node = shaft.build();
      shaft.setMaterial(mat('entity/trident.png'));
      node.scale.set(1 / 16, -1 / 16, -1 / 16);
      root.add(node);
      return root;
    }
    if (name === 'conduit') {
      // Inactive conduit item: vanilla 1.13.2 cwd$c constructor, 32x16 texture, 6x6x6 shell.
      const shell = new Part(32, 16).box(-3, -3, -3, 6, 6, 6);
      const node = shell.build();
      shell.setMaterial(mat('entity/conduit/base.png'));
      node.scale.set(1 / 16, -1 / 16, -1 / 16);
      node.position.set(0.5, 0.5, 0.5);
      root.add(node);
      return root;
    }
    return null;
  }

  // ---------------------------------------------------------------- 3D meshes for world rendering

  // { mesh (FORMAT.entity, atlas UVs, centred), model, display, builtin: Node|null }
  meshFor(item, held = false, holder = null) {
    const m = this.modelFor(item, holder, held);
    const key = this.iconKey(item, held, holder) + '|mesh';
    let r = this.meshes.get(key);
    if (r) return r;
    let mesh = null;
    if (m.kind === 'generated') mesh = this._extrude(item, m);
    else if (m.kind === 'block') mesh = this.blockMesh(m);
    r = { mesh, model: m, display: m.display, builtin: m.kind === 'builtin' ? this._builtinObject(item, m) : null, shared: m.kind === 'block' };
    if (m.kind !== 'builtin' || r.builtin) this.meshes.set(key, r); // builtins retry until their textures load
    return r;
  }

  // Scene node for an item (held, dropped, framed...). atlasMat: entity material using the atlas.
  objectFor(item, atlasMat, held = false, holder = null) {
    if (!item) return null;
    const res = this.meshFor(item, held, holder);
    if (res.builtin) {
      const o = res.builtin.clone();
      // RenderItem.renderItem: translate(-0.5) for built-in renderers too (1.9+ has no extra turn)
      o.position.set(o.position.x - 0.5, o.position.y - 0.5, o.position.z - 0.5);
      const g = new Node(); g.add(o);
      return { obj: g, gui3d: true, model: res.model };
    }
    if (!res.mesh) return null;
    const n = new Node();
    n.addDrawable(res.mesh, atlasMat);
    if (this.game.items.hasEffect(item)) n.userData.glint = res.mesh;
    return { obj: n, gui3d: res.model.kind === 'block', model: res.model };
  }

  // Mesh of a baked block model, centred at the origin (entity format, atlas UVs)
  blockMesh(m) {
    const key = (m.itemName || '') + '|' + (m.path || m.name) + '|' + (m.baked && m.baked.quads.length);
    let mesh = this.blockMeshes.get(key);
    if (mesh !== undefined) return mesh;
    const pos = [], uv = [], nor = [], col = [];
    for (const q of m.baked.quads) {
      const [r, g, b] = rgbOf(q.tint >= 0 ? this._defaultTint(m.itemName || m.name) : 0xffffff);
      for (let i = 0; i < 4; i++) {
        pos.push(q.pos[i * 3] - 0.5, q.pos[i * 3 + 1] - 0.5, q.pos[i * 3 + 2] - 0.5);
        uv.push(q.uv[i * 2], q.uv[i * 2 + 1]);
        nor.push(...DIR_N[q.dir]);
        col.push(r, g, b);
      }
    }
    mesh = pos.length ? this.device.createMesh(FORMAT.entity, entityVertices(pos, uv, nor, col), { quads: true }) : null;
    this.blockMeshes.set(key, mesh);
    return mesh;
  }

  // ItemModelGenerator: front/back quads + per-pixel edge faces, 1/16 thick, centred
  _extrude(item, m) {
    const pos = [], uv = [], nor = [], col = [];
    const atlas = this.atlas;
    for (let li = 0; li < m.layers.length; li++) {
      const e = atlas.entries.get(m.layers[li]);
      if (!e) continue;
      const [r, g, b] = rgbOf(this.layerTint(item, li));
      const w = e.w, h = e.h;
      const S = atlas.size;
      const u0 = e.x / S, v0 = e.y / S, du = w / S, dv = h / S;
      const z0 = 7.5 / 16 - 0.5, z1 = 8.5 / 16 - 0.5;
      const quad = (p, t, n) => {
        for (let i = 0; i < 4; i++) { pos.push(p[i][0], p[i][1], p[i][2]); uv.push(t[i][0], t[i][1]); nor.push(n[0], n[1], n[2]); col.push(r, g, b); }
      };
      // front (south, +z) and back (north, -z)
      quad([[-0.5, 0.5, z1], [-0.5, -0.5, z1], [0.5, -0.5, z1], [0.5, 0.5, z1]], [[u0, v0], [u0, v0 + dv], [u0 + du, v0 + dv], [u0 + du, v0]], [0, 0, 1]);
      quad([[0.5, 0.5, z0], [0.5, -0.5, z0], [-0.5, -0.5, z0], [-0.5, 0.5, z0]], [[u0 + du, v0], [u0 + du, v0 + dv], [u0, v0 + dv], [u0, v0]], [0, 0, -1]);
      const alphaAt = (x, y) => {
        if (x < 0 || y < 0 || x >= w || y >= h) return 0;
        return atlas.data[((e.y + y) * S + e.x + x) * 4 + 3];
      };
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (alphaAt(x, y) === 0) continue;
          const px0 = x / w - 0.5, px1 = (x + 1) / w - 0.5;
          const py0 = 0.5 - (y + 1) / h, py1 = 0.5 - y / h;
          const tu = u0 + (x + 0.5) / S, tv = v0 + (y + 0.5) / S;
          const T = [[tu, tv], [tu, tv], [tu, tv], [tu, tv]];
          if (alphaAt(x, y - 1) === 0) quad([[px0, py1, z0], [px0, py1, z1], [px1, py1, z1], [px1, py1, z0]], T, [0, 1, 0]);
          if (alphaAt(x, y + 1) === 0) quad([[px0, py0, z1], [px0, py0, z0], [px1, py0, z0], [px1, py0, z1]], T, [0, -1, 0]);
          if (alphaAt(x - 1, y) === 0) quad([[px0, py1, z0], [px0, py0, z0], [px0, py0, z1], [px0, py1, z1]], T, [-1, 0, 0]);
          if (alphaAt(x + 1, y) === 0) quad([[px1, py1, z1], [px1, py0, z1], [px1, py0, z0], [px1, py1, z0]], T, [1, 0, 0]);
        }
      }
    }
    if (!pos.length) return null;
    return this.device.createMesh(FORMAT.entity, entityVertices(pos, uv, nor, col), { quads: true });
  }
}

const WHITE = [1, 1, 1, 1];

// ItemCameraTransforms.applyTransformSide (1.9+): translate (mirrored in x for the left hand), rotate as
// makeQuaternion(x, y, z) = R(x) R(y) R(z) with y and z negated for the left hand, then scale. Model json
// translations are in pixels (x 1/16, clamped to +-5 blocks); scales are clamped to +-4.
export function applyTransform(obj, t, leftHanded = false) {
  obj.position.set(0, 0, 0);
  obj.rotation.set(0, 0, 0, 'XYZ');
  obj.scale.set(1, 1, 1);
  if (!t) return;
  const tr = t.translation || [0, 0, 0];
  const ro = t.rotation || [0, 0, 0];
  const sc = t.scale || [1, 1, 1];
  const k = leftHanded ? -1 : 1;
  obj.position.set(k * clamp(tr[0] / 16, -5, 5), clamp(tr[1] / 16, -5, 5), clamp(tr[2] / 16, -5, 5));
  obj.rotation.set(ro[0] * D2R, k * ro[1] * D2R, k * ro[2] * D2R, 'XYZ');
  obj.scale.set(clamp(sc[0], -4, 4), clamp(sc[1], -4, 4), clamp(sc[2], -4, 4));
}

// Same transform applied to a matrix
export function transformMatrix(m, t, leftHanded = false) {
  if (!t) return m;
  const tr = t.translation || [0, 0, 0];
  const ro = t.rotation || [0, 0, 0];
  const sc = t.scale || [1, 1, 1];
  const k = leftHanded ? -1 : 1;
  mat4.translate(m, m, k * clamp(tr[0] / 16, -5, 5), clamp(tr[1] / 16, -5, 5), clamp(tr[2] / 16, -5, 5));
  mat4.rotateX(m, m, ro[0] * D2R);
  mat4.rotateY(m, m, k * ro[1] * D2R);
  mat4.rotateZ(m, m, k * ro[2] * D2R);
  mat4.scale(m, m, clamp(sc[0], -4, 4), clamp(sc[1], -4, 4), clamp(sc[2], -4, 4));
  return m;
}
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// MathHelper.hsvToRGB -> 0xRRGGBB
function hsvToRgb(h, s, v) {
  const i = Math.floor(h * 6) % 6, f = h * 6 - Math.floor(h * 6);
  const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const [r, g, b] = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
  return (Math.floor(r * 255) << 16) | (Math.floor(g * 255) << 8) | Math.floor(b * 255);
}
