// Item rendering: GUI icons (2D sprites + 3D block icons), counts/durability/glint,
// and 3D meshes for held/dropped items (port of ItemModelGenerator extrusion).
import { composeBanner, bannerLayers, buildBanner, bannerSwing } from './banner.js';
import { itemModelName } from '../world/blockstates.js';
import { blocks } from '../world/blocks.js';
import { FORMAT, colorParams } from '../gfx/device.js';
import { mat4, D2R } from '../gfx/math.js';
import { Node } from '../gfx/scene.js';
import { Part, entityMaterial, entityVertices } from './boxmodel.js';
import { platform } from '../platform/platform.js';

const EGG_COLORS = {
  50: [894731, 0], 51: [12698049, 4802889], 52: [3419431, 11013646], 54: [44975, 7969893], 55: [5349438, 8306542],
  56: [16382457, 12369084], 57: [15373203, 5009705], 58: [1447446, 0], 59: [803406, 11013646], 60: [7237230, 3158064],
  61: [16167425, 16775294], 62: [3407872, 16579584], 65: [4996656, 986895], 66: [3407872, 5349438], 67: [1447446, 7237230],
  68: [5931634, 15826224], 90: [15771042, 14377823], 91: [15198183, 16758197], 92: [4470310, 10592673], 93: [10592673, 16711680],
  94: [2243405, 7375001], 95: [14144467, 13545366], 96: [10489616, 12040119], 98: [15720061, 5653556], 100: [12623485, 15656192],
  101: [10051392, 7555121], 120: [5651507, 12422002],
};

const ICON_PARAMS = colorParams(1, 1, 1, 1, 0.1, 0);
// RenderItem enables blending (SRC_ALPHA, ONE_MINUS_SRC_ALPHA): stained glass, ice etc. stay see-through
const ICON_STATE = { blend: 'alpha', depthTest: true, depthWrite: false, depthFunc: 'equal', cull: false };
const ICON_DEPTH_STATE = { blend: 'none', depthTest: true, depthWrite: true, colorWrite: false, cull: false };
const DIR_N = [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]];
const SHADE_GUI = [0.5, 1.0, 0.8, 0.8, 0.6, 0.6];
const rgbOf = (c) => [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];

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

  modelFor(item) {
    const g = this.game;
    const name = g.items.name(item.id);
    let mname = itemModelName(name, item.damage);
    if (item.id === 261 && g.interaction && g.player.usingItem && g.inventory.held() === item) {
      const t = g.interaction.useTicks;
      if (t >= 18) mname = 'bow_pulling_2'; else if (t > 13) mname = 'bow_pulling_1'; else if (t > 0) mname = 'bow_pulling_0';
    }
    if (item.id === 346 && g.entities && g.entities.fishingCast && g.inventory.held() === item) mname = 'fishing_rod_cast';
    const key = mname;
    let m = this.models.get(key);
    if (m) return m;
    const res = this.store.resolveModel('item/' + mname);
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
      const baked = this.store.bakeModel('item/' + mname);
      m = { kind: 'block', baked, display: res.display, name: mname };
    } else {
      // Fallback: block item with no item model -> try block model by name
      const b = blocks[item.id];
      const bm = b ? this.store.resolveModel('block/' + b.name) : null;
      if (bm && bm.elements) m = { kind: 'block', baked: this.store.bakeModel('block/' + b.name), display: {}, name: b.name };
      else m = { kind: 'generated', layers: ['blocks/stone'], display: {}, name: 'missing' };
    }
    this.models.set(key, m);
    return m;
  }

  layerTint(item, layer) {
    const g = this.game;
    const id = item.id;
    if (id >= 298 && id <= 301 && layer === 0) {
      const tag = g.items.nbt(item);
      return tag && tag.display && tag.display.color !== undefined ? tag.display.color : 10511680;
    }
    if (id === 373 && layer === 0) return g.items.potionColor(item);
    if (id === 383) { const c = EGG_COLORS[item.damage]; return c ? c[layer] : 0xffffff; }
    if (id === 402 && layer === 1) {
      const tag = g.items.nbt(item);
      const cols = tag && tag.Explosion && tag.Explosion.Colors;
      if (cols && cols.length) {
        let r = 0, gg = 0, b = 0;
        for (const c of cols) { r += (c >> 16) & 255; gg += (c >> 8) & 255; b += c & 255; }
        return ((r / cols.length) << 16) | ((gg / cols.length) << 8) | (b / cols.length);
      }
      return 0x8a8a8a;
    }
    return 0xffffff;
  }

  iconKey(item) {
    let k = item.id + ':' + item.damage;
    if (item.id >= 298 && item.id <= 301 || item.id === 402) {
      const tag = this.game.items.nbt(item);
      k += ':' + JSON.stringify(tag && (tag.display || tag.Explosion) || null);
    }
    if (item.id === 261 || item.id === 346) k += ':' + this.modelFor(item).name;
    if (item.id === 425) {
      const tag = this.game.items.nbt(item);
      k += ':' + JSON.stringify((tag && tag.BlockEntityTag) || null);
    }
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
    const glint = this.game.items.isEnchanted(item);
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

  drawOverlay(gui, item, x, y, countText) {
    const g = this.game;
    const s = countText !== null && countText !== undefined ? countText : (item.count !== 1 ? String(item.count) : null);
    if (g.items.isDamageable(item) && item.damage > 0) {
      const max = g.items.maxDurability(item.id);
      const health = item.damage / max;
      const j = Math.round(13 - health * 13);
      const i = Math.round(255 - health * 255);
      gui.rect(x + 2, y + 13, x + 15, y + 15, 0xff000000);
      gui.rect(x + 2, y + 13, x + 14, y + 14, (0xff000000 | (Math.floor((255 - i) / 4) << 16) | (64 << 8)) >>> 0);
      gui.rect(x + 2, y + 13, x + 2 + j, y + 14, (0xff000000 | ((255 - i) << 16) | (i << 8)) >>> 0);
    }
    if (s) {
      const color = item.count <= 0 ? 0xff5555 : 0xffffff;
      gui.text(s, x + 19 - 2 - gui.textWidth(s), y + 6 + 3, color, true);
    }
  }

  // RenderItem.setupGuiTransform (gui3d) + the model's gui transform + renderItem's scale/offset
  // RenderItem.setupGuiTransform (3D) + GUI camera transform + renderItem (builtin renderers turn 180 around Y)
  _iconMatrix(x, y, z, display, builtin = false) {
    const m = mat4.create();
    mat4.translate(m, m, x + 8, y + 8, z);
    mat4.scale(m, m, 1, 1, -1);
    mat4.scale(m, m, 20, 20, 20);
    mat4.rotateX(m, m, 210 * D2R);
    mat4.rotateY(m, m, -135 * D2R);
    transformMatrix(m, display && display.gui);
    mat4.scale(m, m, 0.5, 0.5, 0.5);
    if (builtin) mat4.rotateY(m, m, Math.PI);
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
    if (node) gui.drawNode(node, this._iconMatrix(x, y, z, m.display, true));
  }

  // GUI icon mesh (FORMAT.color) with vanilla GUI face shading baked into the vertex colours
  _blockIconMesh(m) {
    const quads = m.baked.quads;
    if (!quads.length) return null;
    const data = new Float32Array(quads.length * 4 * 9);
    let o = 0;
    for (const q of quads) {
      const sh = q.shade ? SHADE_GUI[q.dir] : 1;
      const [r, g, b] = rgbOf(q.tint >= 0 ? this._defaultTint(m.name) : 0xffffff);
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
    if (/grass|fern|tall_grass|double_grass|vine|waterlily/.test(name)) return name === 'waterlily' ? 0x208030 : 0x7fb238;
    if (/leaves/.test(name)) {
      if (name.startsWith('spruce')) return 0x619961;
      if (name.startsWith('birch')) return 0x80a755;
      return 0x48b518;
    }
    return 0xffffff;
  }

  // Chest / skull / banner items (TileEntityItemStackRenderer). Node in 0..1 block space.
  _builtinObject(item, m, gui = false) {
    const name = m.name;
    const root = new Node();
    const mat = (tex) => entityMaterial(tex, { alphaTest: 0.1, fullBright: gui, noLighting: false });
    if (name === 'chest' || name === 'trapped_chest' || name === 'ender_chest') {
      const tex = name === 'ender_chest' ? 'entity/chest/ender.png' : name === 'trapped_chest' ? 'entity/chest/trapped.png' : 'entity/chest/normal.png';
      const lid = new Part(64, 64).tex(0, 0).box(0, -5, -14, 14, 5, 14).pivot(1, 7, 15);
      const knob = new Part(64, 64).tex(0, 0).box(-1, -2, -15, 2, 4, 1).pivot(8, 7, 15);
      const bottom = new Part(64, 64).tex(0, 19).box(0, 0, 0, 14, 10, 14).pivot(1, 6, 1);
      const g = new Node();
      for (const p of [lid, knob, bottom]) g.add(p.build());
      g.setMaterial(mat(tex));
      // ModelChest is in a y-down space scaled by 1/16 with rotate 180 X
      g.scale.set(1 / 16, -1 / 16, -1 / 16);
      g.position.set(0, 1, 1);
      root.add(g);
      return root;
    }
    if (name.startsWith('skull_')) {
      // TileEntityItemStackRenderer: translate(-0.5, 0, -0.5), scale(2), then renderSkull(0, 0, 0, UP): a head 1 block tall
      const which = name.slice(6);
      const texPath = { skeleton: 'entity/skeleton/skeleton.png', wither: 'entity/skeleton/wither_skeleton.png', zombie: 'entity/zombie/zombie.png',
        char: 'entity/steve.png', creeper: 'entity/creeper/creeper.png' }[which];
      const th = which === 'zombie' || which === 'char' ? 64 : 32;
      const head = new Part(64, th).tex(0, 0).box(-4, -8, -4, 8, 8, 8);
      const g = new Node();
      g.add(head.build());
      g.setMaterial(mat(texPath));
      g.scale.set(2 / 16, -2 / 16, -2 / 16);
      g.position.set(0.5, 0, 0.5);
      root.add(g);
      return root;
    }
    if (name === 'banner') {
      // TileEntityBannerRenderer with no world: standing, rotation 0, flag at time 0, colours from the item
      const tag = this.game.items.nbt(item);
      const bet = tag && tag.BlockEntityTag;
      const base = bet && bet.Base !== undefined ? bet.Base : (item.damage & 15);
      const img = composeBanner(this.assets, bannerLayers(base, bet && bet.Patterns));
      if (!img) return null;
      const key = 'banneritem:' + base + ':' + JSON.stringify((bet && bet.Patterns) || []);
      const tex = this.assets.textures.get(key) || this.assets.makeTexture(key, img.width, img.height, img.data);
      const b = buildBanner(entityMaterial(tex, { alphaTest: 0.1, fullBright: gui }), true, 0);
      b.swing.rotation.x = bannerSwing(0);
      return b.node;
    }
    return null;
  }

  // ---------------------------------------------------------------- 3D meshes for world rendering

  // { mesh (FORMAT.entity, atlas UVs, centred), model, display, builtin: Node|null }
  meshFor(item) {
    const m = this.modelFor(item);
    const key = this.iconKey(item) + '|mesh';
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
  objectFor(item, atlasMat) {
    if (!item) return null;
    const res = this.meshFor(item);
    if (res.builtin) {
      const o = res.builtin.clone();
      o.position.set(o.position.x - 0.5, o.position.y - 0.5, o.position.z - 0.5);
      // RenderItem.renderItem: isBuiltInRenderer -> rotate(180, Y) before translate(-0.5)
      const g = new Node(); g.rotation.set(0, Math.PI, 0); g.add(o);
      return { obj: g, gui3d: true, model: res.model };
    }
    if (!res.mesh) return null;
    const n = new Node();
    n.addDrawable(res.mesh, atlasMat);
    if (this.game.items.isEnchanted(item)) n.userData.glint = res.mesh;
    return { obj: n, gui3d: res.model.kind === 'block', model: res.model };
  }

  // Mesh of a baked block model, centred at the origin (entity format, atlas UVs)
  blockMesh(m) {
    const key = m.name + '|' + (m.baked && m.baked.quads.length);
    let mesh = this.blockMeshes.get(key);
    if (mesh !== undefined) return mesh;
    const pos = [], uv = [], nor = [], col = [];
    for (const q of m.baked.quads) {
      const [r, g, b] = rgbOf(q.tint >= 0 ? this._defaultTint(m.name) : 0xffffff);
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

// ItemTransformVec3f.apply on a node: translate, rotate Y, X, Z, scale
export function applyTransform(obj, t) {
  obj.position.set(0, 0, 0);
  obj.rotation.set(0, 0, 0, 'YXZ');
  obj.scale.set(1, 1, 1);
  if (!t) return;
  const tr = t.translation || [0, 0, 0];
  const ro = t.rotation || [0, 0, 0];
  const sc = t.scale || [1, 1, 1];
  obj.position.set(clamp(tr[0], -24, 24) / 16, clamp(tr[1], -24, 24) / 16, clamp(tr[2], -24, 24) / 16);
  obj.rotation.set(ro[0] * D2R, ro[1] * D2R, ro[2] * D2R, 'YXZ');
  obj.scale.set(clamp(sc[0], -4, 4), clamp(sc[1], -4, 4), clamp(sc[2], -4, 4));
}

// Same transform applied to a matrix
export function transformMatrix(m, t) {
  if (!t) return m;
  const tr = t.translation || [0, 0, 0];
  const ro = t.rotation || [0, 0, 0];
  const sc = t.scale || [1, 1, 1];
  mat4.translate(m, m, clamp(tr[0], -24, 24) / 16, clamp(tr[1], -24, 24) / 16, clamp(tr[2], -24, 24) / 16);
  mat4.rotateY(m, m, ro[1] * D2R);
  mat4.rotateX(m, m, ro[0] * D2R);
  mat4.rotateZ(m, m, ro[2] * D2R);
  mat4.scale(m, m, clamp(sc[0], -4, 4), clamp(sc[1], -4, 4), clamp(sc[2], -4, 4));
  return m;
}
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
