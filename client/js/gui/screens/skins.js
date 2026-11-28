// Skin & Capes screen. Offline accounts use the MCJS preset library and browser-local uploads.
// Microsoft accounts change their Mojang skin/cape through the selected MCJS relay; custom capes
// are client-side because Mojang does not accept user cape uploads.
import { tr } from '../i18n.js';
import { Screen } from './manager.js';
import { Button } from '../widgets.js';
import { ListOf } from '../slot-list.js';
import { accountFace, drawFace } from './accounts.js';
import { platform } from '../../platform/platform.js';
import { fetchSkin } from '../../net/proxies.js';
import { decodeBase64, encodeBase64 } from '../../util/base64.js';
import { decodePng, encodePng } from '../../util/png.js';
import { EAGLER_CAPES, EAGLER_SKINS } from '../../net/eagler-presets.js';
import { playerModel } from '../../render/entity-models.js';
import { entityMaterial } from '../../render/boxmodel.js';
import { Node } from '../../gfx/scene.js';
import { mat4, D2R } from '../../gfx/math.js';

const SKIN_TILE = 32;
const SKIN_GAP = 4;
const VIEW_TOP = 66;

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function pngInfo(bytes) {
  if (!bytes || !bytes.length || bytes.length > 1024 * 1024) return null;
  try {
    const img = decodePng(bytes);
    return img && img.width && img.height ? img : null;
  } catch (e) {
    return null;
  }
}

function validSkin(bytes) {
  const img = pngInfo(bytes);
  return img && img.width === 64 && (img.height === 32 || img.height === 64) ? img : null;
}

function validCape(bytes) {
  const img = pngInfo(bytes);
  return img && ((img.width === 64 && img.height === 32) || (img.width === 32 && img.height === 32)) ? img : null;
}

// Mojang caps skins at 24 KB. MCJS preset PNGs are not always that small, so re-encode and, when
// needed, quantise the colours until the upload fits. The visible 64x64 layout is unchanged.
function fitPremiumSkin(base64) {
  let bytes;
  try { bytes = decodeBase64(base64); } catch (e) { return null; }
  if (bytes.length <= 24576) return base64;
  const img = pngInfo(bytes);
  if (!img) return null;
  for (const bits of [8, 5, 4, 3]) {
    const data = new Uint8Array(img.data);
    if (bits < 8) {
      const mask = 255 << (8 - bits);
      for (let i = 0; i < data.length; i += 4) {
        data[i] &= mask; data[i + 1] &= mask; data[i + 2] &= mask;
        data[i + 3] = data[i + 3] < 128 ? 0 : 255;
      }
    }
    const out = encodePng(img.width, img.height, data);
    if (out.length <= 24576) return encodeBase64(out);
  }
  return null;
}

export class SkinsScreen extends Screen {
  constructor(game, parent, account = null) {
    super(game);
    this.parent = parent;
    this.background = 'dirt';
    const active = account || game.accounts.active();
    this.accountId = active ? active.id : null;
    this.tab = 'skin';
    this.status = null;
    this.profileLoading = false;
    this.profileError = null;
    this.profileRequested = false;
    this.capes = [];
    this.slim = !!(active && active.slim);
    this.skinPage = 0;
    this.capePage = 0;
    this.hoverName = null;
    this.officialRequests = new Set();
    this.profileGen = 0;
    this.viewYaw = 22;
    this.viewPitch = 5;
    this.viewZoom = 1;
    this.dragging = false;
    this.dragX = 0;
    this.dragY = 0;
    this.lastMx = -1;
    this.lastMy = -1;
    this._viewer = null;
    this._fx = new Map();
  }

  get account() {
    return this.game.accounts.list.find((a) => a.id === this.accountId) || this.game.accounts.active();
  }

  get premium() { return !!(this.account && this.account.type === 'microsoft'); }

  init() {
    const cx = this.width / 2;
    this.buttons = [];
    this.fields = [];
    this.buttons.push(this._tabButton(0, cx - 154, 'skin'));
    this.buttons.push(this._tabButton(1, cx - 50, 'capes'));
    this.buttons.push(this._tabButton(2, cx + 54, 'accounts'));

    if (this.tab === 'skin') this._initSkin(cx);
    else if (this.tab === 'capes') this._initCapes(cx);
    else this._initAccounts(cx);

    if (this.tab === 'accounts') {
      this.buttons.push(new Button(40, cx - 154, this.height - 24, 150, 20, tr('minecraftjs.skins.useAccount'), () => this.useAccount()));
      this.buttons.push(new Button(0, cx + 4, this.height - 24, 150, 20, tr('gui.done'), () => this.close()));
    } else {
      this.buttons.push(new Button(0, cx - 50, this.height - 24, 100, 20, tr('gui.done'), () => this.close()));
    }
    this.loadProfile();
    this._syncPageButtons();
  }

  _tabButton(id, x, tab) {
    return new Button(100 + id, x, 20, 100, 20, () => (this.tab === tab ? '§e' : '') + tr('minecraftjs.skins.tab.' + tab), () => this.setTab(tab));
  }

  setTab(tab) {
    if (this.tab === tab) return;
    this.tab = tab;
    this.status = null;
    this.hoverName = null;
    this.viewYaw = tab === 'capes' ? 148 : 22;
    this.viewPitch = 5;
    this.viewZoom = 1;
    this._viewer = null;
    this.init();
  }

  close() { this.game.screens.open(this.parent); }

  useAccount() {
    const acc = this.account;
    if (!acc) return;
    this.game.accounts.setActive(acc.id);
    this.status = { text: tr('minecraftjs.accounts.inUse'), color: '§a' };
  }

  async loadProfile() {
    if (!this.premium || this.profileRequested) return;
    this.profileRequested = true;
    this.profileLoading = true;
    this.profileError = null;
    const gen = ++this.profileGen;
    try {
      const acc = await this.game.accounts.profile(this.account);
      if (gen !== this.profileGen) return;
      this.accountId = acc.id;
      this.capes = Array.isArray(acc.capes) ? acc.capes : [];
      this.slim = !!acc.slim;
    } catch (e) {
      if (gen === this.profileGen) {
        this.profileError = e.message;
        this.profileRequested = false;
      }
    } finally {
      if (gen === this.profileGen) this.profileLoading = false;
    }
  }

  selectAccount(acc) {
    if (!acc || acc.id === this.accountId) return;
    this.accountId = acc.id;
    this.profileGen++;
    this.profileRequested = false;
    this.profileError = null;
    this.profileLoading = false;
    this.capes = [];
    this.slim = !!acc.slim;
    this.skinPage = 0;
    this.capePage = 0;
    this.status = null;
    this._viewer = null;
    this.loadProfile();
  }

  // ---------------------------------------------------------------- layout and viewer

  // The viewer takes the left half; controls and the preset library stay on the right.
  _layout() {
    const x0 = Math.floor(this.width / 2 - 154);
    const w = Math.min(156, this.width - x0 - 8);
    const h = Math.max(96, Math.min(160, this.height - VIEW_TOP - 54));
    const rightX = x0 + w + 10;
    const controls = this.tab === 'skin' ? 3 : 2;
    const controlY = VIEW_TOP + 2;
    const labelY = controlY + controls * 24 + 4;
    return { x0, top: VIEW_TOP, w, h, rightX, controlY, labelY, gridY: labelY + 12, pageSize: this.pageSize() };
  }

  pageSize() { return this.height < 280 ? 4 : 8; }

  _initSkin(cx) {
    const L = this._layout();
    const x = L.rightX, y = L.controlY;
    this.buttons.push(new Button(10, x, y, 100, 20, tr('minecraftjs.skins.upload'), () => this.uploadSkin()));
    this.buttons.push(new Button(11, x, y + 24, 100, 20, () => tr('minecraftjs.skins.model', tr(this.slim ? 'minecraftjs.skins.modelSlim' : 'minecraftjs.skins.modelClassic')), () => {
      this.slim = !this.slim;
      this._viewer = null;
      if (!this.premium) this.game.cosmetics.setSlim(this.account.id, this.slim);
    }));
    this.buttons.push(new Button(12, x, y + 48, 100, 20, tr('minecraftjs.skins.reset'), () => this.resetSkin()));
    this._presetButtons('skin');
  }

  _initCapes(cx) {
    const L = this._layout();
    const x = L.rightX, y = L.controlY;
    this.buttons.push(new Button(20, x, y, 100, 20, tr('minecraftjs.skins.uploadCape'), () => this.uploadCape()));
    this.buttons.push(new Button(21, x, y + 24, 100, 20, tr('minecraftjs.skins.removeCape'), () => this.removeCape()));
    this._presetButtons('cape');
  }

  _initAccounts(cx) {
    const old = this.accountList;
    this.accountList = new ListOf(this, 76, this.height - 30, 30, {
      size: () => this.game.accounts.list.length,
      selected: (i) => this.game.accounts.list[i] === this.account,
      draw: (gui, i, x, y) => this._accountRow(gui, this.game.accounts.list[i], x, y),
      click: (i) => { this.selectAccount(this.game.accounts.list[i]); return true; },
    });
    if (old) { this.accountList.amountScrolled = old.amountScrolled; this.accountList.clamp(); }
  }

  _presetButtons(kind) {
    const L = this._layout(), size = L.pageSize;
    const packW = 4 * SKIN_TILE + 3 * SKIN_GAP;
    for (let i = 0; i < size; i++) {
      const x = L.rightX + (i % 4) * (SKIN_TILE + SKIN_GAP);
      const y = L.gridY + Math.floor(i / 4) * (SKIN_TILE + 8);
      const btn = new Button(200 + i, x, y, SKIN_TILE, SKIN_TILE, '', () => this.applyPageItem(kind, i));
      btn.render = (gui, mx, my) => {
        const item = this.pageItems(kind)[i];
        if (!item) return;
        const hover = btn.hovered(mx, my);
        if (hover) this.hoverName = item.name || item.alias || null;
        if (kind === 'skin') this._drawPresetSkin(gui, item, x, y, hover);
        else this._drawPresetCape(gui, item, x, y, hover);
      };
      this.buttons.push(btn);
    }
    const prev = new Button(30, L.rightX + packW - 34, L.labelY - 4, 14, 14, '<', () => this.turnPage(kind, -1));
    const next = new Button(31, L.rightX + packW - 18, L.labelY - 4, 14, 14, '>', () => this.turnPage(kind, 1));
    prev.visible = next.visible = this.pageCount(kind) > 1;
    this.buttons.push(prev, next);
  }

  pageItems(kind) {
    const size = this.pageSize();
    const pages = this.pageCount(kind);
    if (kind === 'skin') {
      this.skinPage = Math.min(this.skinPage, pages - 1);
      return EAGLER_SKINS.slice(this.skinPage * size, this.skinPage * size + size);
    }
    this.capePage = Math.min(this.capePage, pages - 1);
    if (this.premium) return this.capes.slice(this.capePage * size, this.capePage * size + size);
    return EAGLER_CAPES.slice(this.capePage * size, this.capePage * size + size);
  }

  pageCount(kind) {
    const n = kind === 'skin' ? EAGLER_SKINS.length : this.premium ? this.capes.length : EAGLER_CAPES.length;
    return Math.max(1, Math.ceil(n / this.pageSize()));
  }

  turnPage(kind, dir) {
    const n = this.pageCount(kind);
    if (kind === 'skin') this.skinPage = (this.skinPage + dir + n) % n;
    else this.capePage = (this.capePage + dir + n) % n;
    this.hoverName = null;
  }

  // ---------------------------------------------------------------- applying

  async applyPageItem(kind, i) {
    const item = this.pageItems(kind)[i];
    if (!item) return;
    if (kind === 'skin') await this.applySkinPreset(item);
    else if (this.premium) { if (item.url) await this.applyOfficialCape(item); }
    else await this.applyCapePreset(item);
  }

  async applySkinPreset(preset) {
    const acc = this.account;
    if (!acc) return;
    this.status = { text: tr('minecraftjs.skins.applying'), color: '§7' };
    try {
      if (acc.type === 'microsoft') {
        const png = fitPremiumSkin(preset.png);
        if (!png) { this.status = { text: tr('minecraftjs.skins.invalidPng'), color: '§c' }; return; }
        const updated = await this.game.accounts.setSkin(acc, png, preset.slim ? 'slim' : 'classic');
        this.accountId = updated.id;
        this.slim = !!updated.slim;
        this.game.entityRenderer.reloadSkins();
        this.status = { text: tr('minecraftjs.skins.skinSaved'), color: '§a' };
      } else {
        this.game.cosmetics.applyPresetSkin(acc, preset);
        this.slim = !!preset.slim;
        this.status = { text: tr('minecraftjs.skins.skinLocal'), color: '§a' };
      }
    } catch (e) {
      this.status = { text: e.message, color: '§c' };
    }
  }

  async applyCapePreset(preset) {
    const acc = this.account;
    if (!acc) return;
    this.game.cosmetics.applyPresetCape(acc, preset);
    this.status = { text: tr('minecraftjs.skins.capeLocal'), color: '§a' };
  }

  async applyOfficialCape(cape) {
    const acc = this.account;
    if (!acc) return;
    this.status = { text: tr('minecraftjs.skins.applying'), color: '§7' };
    try {
      const updated = await this.game.accounts.setCape(acc, cape.id);
      this.accountId = updated.id;
      this.capes = Array.isArray(updated.capes) ? updated.capes : [];
      // An official cape replaces a local custom cape on the local player.
      this.game.cosmetics.clearCape(acc.id);
      this.game.entityRenderer.reloadSkins();
      this.status = { text: tr('minecraftjs.skins.capeSaved'), color: '§a' };
    } catch (e) {
      this.status = { text: e.message, color: '§c' };
    }
  }

  async uploadSkin() {
    const acc = this.account;
    if (!acc) return;
    let files;
    try { files = await platform().pickFiles({ accept: 'image/png' }); } catch (e) { return; }
    const bytes = files && files[0] && files[0].bytes;
    if (!bytes) return;
    if (!validSkin(bytes)) { this.status = { text: tr('minecraftjs.skins.invalidPng'), color: '§c' }; return; }
    this.status = { text: tr('minecraftjs.skins.applying'), color: '§7' };
    try {
      if (acc.type === 'microsoft') {
        const png = fitPremiumSkin(encodeBase64(bytes));
        if (!png) { this.status = { text: tr('minecraftjs.skins.invalidPng'), color: '§c' }; return; }
        const updated = await this.game.accounts.setSkin(acc, png, this.slim ? 'slim' : 'classic');
        this.accountId = updated.id;
        this.slim = !!updated.slim;
        this.game.entityRenderer.reloadSkins();
        this.status = { text: tr('minecraftjs.skins.skinSaved'), color: '§a' };
      } else {
        this.game.cosmetics.setSkin(acc.id, encodeBase64(bytes), this.slim, null);
        this.status = { text: tr('minecraftjs.skins.skinLocal'), color: '§a' };
      }
    } catch (e) {
      this.status = { text: e.message, color: '§c' };
    }
  }

  async resetSkin() {
    const acc = this.account;
    if (!acc) return;
    this.status = { text: tr('minecraftjs.skins.applying'), color: '§7' };
    try {
      if (acc.type === 'microsoft') {
        const updated = await this.game.accounts.resetSkin(acc);
        if (updated) {
          this.accountId = updated.id;
          this.slim = !!updated.slim;
          this.capes = Array.isArray(updated.capes) ? updated.capes : this.capes;
        }
        this.game.entityRenderer.reloadSkins();
      } else {
        this.game.cosmetics.clearSkin(acc.id);
      }
      this.status = { text: tr('minecraftjs.skins.skinReset'), color: '§a' };
    } catch (e) {
      this.status = { text: e.message, color: '§c' };
    }
  }

  async uploadCape() {
    const acc = this.account;
    if (!acc) return;
    let files;
    try { files = await platform().pickFiles({ accept: 'image/png' }); } catch (e) { return; }
    const bytes = files && files[0] && files[0].bytes;
    if (!bytes) return;
    if (!validCape(bytes)) { this.status = { text: tr('minecraftjs.skins.invalidCape'), color: '§c' }; return; }
    this.game.cosmetics.setCape(acc.id, encodeBase64(bytes), null);
    this.status = { text: this.premium ? tr('minecraftjs.skins.customCapeHint') : tr('minecraftjs.skins.capeLocal'), color: this.premium ? '§e' : '§a' };
  }

  async removeCape() {
    const acc = this.account;
    if (!acc) return;
    this.game.cosmetics.clearCape(acc.id);
    this.status = { text: tr('minecraftjs.skins.capeRemoved'), color: '§a' };
    if (acc.type === 'microsoft') {
      try {
        const updated = await this.game.accounts.hideCape(acc);
        this.capes = Array.isArray(updated.capes) ? updated.capes : [];
        this.game.entityRenderer.reloadSkins();
      } catch (e) {
        // The local cape is already gone; the Mojang cape may still be active.
        this.status = { text: e.message, color: '§e' };
      }
    }
  }

  // ---------------------------------------------------------------- drawing

  renderContent(gui, mx, my) {
    const cx = this.width / 2;
    this.hoverName = null;
    const acc = this.account;
    if (acc) {
      drawFace(gui, this.game, acc, cx - 154, 44, 16);
      gui.text(gui.font.trimToWidth(acc.name, 160), cx - 134, 46, 0xffffff);
      const kind = acc.type === 'microsoft'
        ? tr('minecraftjs.skins.official')
        : tr('minecraftjs.skins.local');
      gui.text('§7' + kind, cx - 134, 57, 0x808080);
    }
    if (this.tab === 'accounts') this.accountList.render(gui, mx, my);
    else if (this.tab === 'skin') this._renderSkinTab(gui, acc);
    else this._renderCapeTab(gui, acc);
    // Draw the title after the account list: its dirt overlay covers the top of the screen.
    gui.textCentered(tr('minecraftjs.skins.title'), cx, 5, 0xffffff);
  }

  render(gui, mx, my, partial) {
    super.render(gui, mx, my, partial);
    let line;
    if (this.status) line = this.status.color + this.status.text;
    else if (this.premium && this.profileError) line = '§c' + gui.font.trimToWidth(tr('minecraftjs.skins.profileFailed', this.profileError), this.width - 12);
    else if (this.hoverName) line = '§7' + this.hoverName;
    else if (this.premium && this.profileLoading) line = '§7' + tr('minecraftjs.skins.profileLoading');
    else line = '§7' + (this.premium ? tr('minecraftjs.skins.premiumHint') : tr('minecraftjs.skins.crackedOnly'));
    gui.textCentered(line, this.width / 2, this.height - 38, 0xffffff);
  }

  _renderSkinTab(gui, acc) {
    const L = this._layout();
    this._renderViewer(gui, acc);
    gui.text('§7' + tr('minecraftjs.skins.packs') + '  §8' + (this.skinPage + 1) + '/' + this.pageCount('skin'), L.rightX, L.labelY, 0xffffff);
  }

  // A vanilla inventory-style preview: a gray beveled frame with a recessed, tiled dirt slot.
  // The slot texture comes from this version's gui/options_background.png, so every target keeps
  // its own assets while the layout stays consistent.
  _renderViewer(gui, acc) {
    const L = this._layout();
    const x = L.x0, y = L.top, w = L.w, h = L.h, cx = x + w / 2;
    const px = x + 4, py = y + 4, pw = w - 8, ph = h - 20;
    gui.rect(x - 1, y - 1, x + w + 1, y + h + 1, 0xff000000);
    gui.rect(x, y, x + w, y + h, 0xffc6c6c6);
    gui.rect(x + 1, y + 1, x + w - 1, y + 2, 0xffffffff);
    gui.rect(x + 1, y + 1, x + 2, y + h - 1, 0xffffffff);
    gui.rect(x + 1, y + h - 2, x + w - 1, y + h - 1, 0xff555555);
    gui.rect(x + w - 2, y + 1, x + w - 1, y + h - 1, 0xff555555);
    gui.rect(px - 1, py - 1, px + pw + 1, py + ph + 1, 0xff373737);
    const bg = this.game.assets.texture('gui/options_background.png', { wrap: 'repeat' });
    if (bg) gui.quad(bg, px, py, px + pw, py + ph, 0, 0, pw / 32, ph / 32, [0.25, 0.25, 0.25, 1]);
    else gui.rect(px, py, px + pw, py + ph, 0xff202020);
    gui.text('3D', px + 4, py + 3, 0xffffff, true);
    const type = this.slim ? 'SLIM' : 'CLASSIC';
    gui.text('§7' + type, px + pw - 3 - gui.textWidth(type), py + 3, 0xffffff, true);
    const skin = this._skinTexture(acc);
    const cape = this._capeTexture(acc);
    if (skin) this._ensureViewer(acc, skin, cape);
    const feet = y + h - 21;
    const shadow = this._fxTexture('shadow');
    if (shadow) gui.quad(shadow, cx - 42, feet - 5, cx + 42, feet + 10, 0, 0, 1, 1, [1, 1, 1, 1]);
    if (this._viewer) {
      gui.scissor(px, py, pw, ph);
      this._poseViewer();
      gui.drawNode(this._viewer.root, this._viewerMatrix(x, y, w, h));
      gui.clearScissor();
    }
    gui.rect(x + 1, y + h - 15, x + w - 1, y + h - 1, 0xff8b8b8b);
    gui.rect(x + 1, y + h - 15, x + w - 1, y + h - 14, 0xff373737);
    gui.textCentered('§f' + tr('minecraftjs.skins.viewerHint'), cx, y + h - 9, 0xffffff, false);
  }

  _ensureViewer(acc, skin, cape) {
    const key = [acc.id, skin.width + 'x' + skin.height, cape ? cape.width + 'x' + cape.height : '-', this.slim ? 1 : 0].join('|');
    if (this._viewer && this._viewer.key === key && this._viewer.skin === skin && this._viewer.cape === cape) return;
    let model;
    try { model = playerModel(this.slim, 64, 64); } catch (e) { this._viewer = null; return; }
    const root = new Node();
    const skinMat = entityMaterial(skin, { alphaTest: 0.1, cull: false, fullBright: true, inventoryLighting: true });
    for (const part of model.roots) root.add(part.build());
    for (const part of model.roots) part.setMaterial(skinMat);
    let capeHolder = null, capePart = null;
    if (cape && model.parts.cape) {
      capePart = model.parts.cape;
      const capeMat = entityMaterial(cape, { alphaTest: 0.1, cull: false, fullBright: true, inventoryLighting: true });
      capeHolder = new Node();
      capeHolder.position.z = 2;
      capeHolder.add(capePart.build());
      capePart.setMaterial(capeMat);
      root.add(capeHolder);
    }
    this._viewer = { key, skin, cape, accountId: acc.id, slim: this.slim, model, root, capeHolder, capePart };
  }

  _poseViewer() {
    const v = this._viewer;
    const t = performance.now() / 1000;
    v.model.animate(v.model, { ls: 0, lsa: 0, age: t * 20, yaw: 0, pitch: 0, swing: -9999, sneak: false, heldRight: 0, heldLeft: 0 });
    for (const part of v.model.roots) part.sync();
    if (v.capeHolder && v.capePart) {
      v.capeHolder.rotation.set((7 + Math.sin(t * 1.3) * 3) * D2R, (180 + Math.sin(t * 0.7) * 4) * D2R, Math.sin(t * 0.9) * 2 * D2R, 'XZY');
      v.capePart.py = 0;
      v.capePart.sync();
    }
  }

  _viewerMatrix(x, y, w, h) {
    const scale = Math.min(w / 3.35, h / 3.35) * this.viewZoom;
    // The model origin sits above its feet; lower the origin by the same proportional amount so the
    // soles meet the floor shadow at every zoom level.
    const footOffset = scale * 0.31;
    const m = mat4.create();
    mat4.translate(m, m, x + w / 2, y + h - 27 + footOffset, 50);
    mat4.scale(m, m, -scale, scale, scale);
    mat4.rotateZ(m, m, Math.PI);
    mat4.rotateX(m, m, -this.viewPitch * D2R);
    mat4.rotateY(m, m, (180 - this.viewYaw) * D2R);
    mat4.scale(m, m, -1, -1, 1);
    mat4.translate(m, m, 0, -1.5078125, 0);
    mat4.scale(m, m, 1 / 16, 1 / 16, 1 / 16);
    return m;
  }

  _fxTexture() {
    if (this._fx.has('shadow')) return this._fx.get('shadow');
    // Soft contact shadow only; no coloured lighting, matching the vanilla GUI palette.
    const n = 64, data = new Uint8Array(n * n * 4);
    for (let py = 0; py < n; py++) for (let px = 0; px < n; px++) {
      const dx = (px + 0.5) / n * 2 - 1;
      const dy = (py + 0.5) / n * 2 - 1;
      const d = Math.sqrt(dx * dx + (dy * 2.8) * (dy * 2.8));
      const a = Math.max(0, 1 - d);
      const o = (py * n + px) * 4;
      data[o + 3] = Math.round(a * a * 220);
    }
    const key = 'skins-view:shadow:' + this.game.assets.version;
    let tex = this.game.assets.textures.get(key);
    if (!tex) tex = this.game.assets.makeTexture(key, n, n, data, { filter: 'linear' });
    this._fx.set('shadow', tex);
    return tex;
  }

  // Compose the front of the player from the skin sheet so the preview looks like a character, not a texture dump.
  _drawPlayer(gui, tex, x, y, s = 2) {
    const k = tex.width / 64;
    const tall = tex.height >= 64;
    const part = (sx, sy, sw, sh, dx, dy, dw, dh) => gui.drawImage(tex, sx * k, sy * k, sw * k, sh * k, x + dx * s, y + dy * s, dw * s, dh * s);
    part(8, 8, 8, 8, 4, 0, 8, 8);       // head
    part(40, 8, 8, 8, 4, 0, 8, 8);      // hat
    part(20, 20, 8, 12, 4, 8, 8, 12);   // body
    part(20, 36, 8, 12, 4, 8, 8, 12);   // jacket
    part(44, 20, 4, 12, 0, 8, 4, 12);   // right arm
    part(44, 36, 4, 12, 0, 8, 4, 12);   // right sleeve
    part(4, 20, 4, 12, 4, 20, 4, 12);   // right leg
    part(4, 36, 4, 12, 4, 20, 4, 12);   // right trouser
    if (tall) {
      part(36, 52, 4, 12, 12, 8, 4, 12);  // left arm
      part(52, 52, 4, 12, 12, 8, 4, 12);  // left sleeve
      part(20, 52, 4, 12, 8, 20, 4, 12);  // left leg
      part(4, 52, 4, 12, 8, 20, 4, 12);   // left trouser
    } else {
      part(44, 20, 4, 12, 12, 8, 4, 12);  // legacy skin: mirror the only arm
      part(44, 36, 4, 12, 12, 8, 4, 12);
      part(4, 20, 4, 12, 8, 20, 4, 12);   // legacy skin: mirror the only leg
      part(4, 36, 4, 12, 8, 20, 4, 12);
    }
  }

  _renderCapeTab(gui, acc) {
    const L = this._layout();
    this._renderViewer(gui, acc);
    const title = this.premium ? tr('minecraftjs.skins.officialCapes') : tr('minecraftjs.skins.capePacks');
    gui.text('§7' + title + '  §8' + (this.capePage + 1) + '/' + this.pageCount('cape'), L.rightX, L.labelY, 0xffffff);
  }

  _syncPageButtons() {
    const many = this.pageCount(this.tab === 'skin' ? 'skin' : 'cape') > 1;
    for (const b of this.buttons) if (b.id === 30 || b.id === 31) b.visible = many;
  }

  _skinTexture(acc) {
    if (!acc) return null;
    if (acc.type === 'microsoft') return this.game.gui.tex(accountFace(this.game, acc));
    if (acc.type === 'offline') {
      return this.game.cosmetics.skinTexture(acc) || this.game.assets.texture(acc.slim ? 'entity/alex.png' : 'entity/steve.png');
    }
    return this.game.assets.texture(acc.slim ? 'entity/alex.png' : 'entity/steve.png');
  }

  _capeTexture(acc) {
    if (!acc) return null;
    const local = this.game.cosmetics.capeTexture(acc);
    if (local) return local;
    const active = (this.capes || []).find((c) => c.state === 'ACTIVE');
    if (active && active.url) return this._officialTexture(active);
    if (acc.capeUrl) return this._officialTexture({ id: acc.capeId || acc.capeUrl, url: acc.capeUrl });
    return null;
  }

  _drawPresetSkin(gui, preset, x, y, hover) {
    const tex = this._presetTexture(preset, 'skin');
    if (!tex) return;
    gui.rect(x - 1, y - 1, x + SKIN_TILE + 1, y + SKIN_TILE + 1, 0xff000000);
    gui.rect(x, y, x + SKIN_TILE, y + SKIN_TILE, hover ? 0xffffffff : 0xff8b8b8b);
    this._drawPlayer(gui, tex, x, y, 1);
  }

  _drawCape(gui, tex, x, y, w, h) {
    // The usable cape is the 22x17 front/top/side region at the texture's top-left; the rest is padding.
    const sw = Math.min(tex.width, 22), sh = Math.min(tex.height, 17);
    const dw = Math.round(h * sw / sh);
    gui.drawImage(tex, 0, 0, sw, sh, x + Math.round((w - dw) / 2), y, dw, h);
  }

  _drawPresetCape(gui, preset, x, y, hover) {
    gui.rect(x - 1, y - 1, x + SKIN_TILE + 1, y + 20, 0xff000000);
    gui.rect(x, y, x + SKIN_TILE, y + 16, hover ? 0xffffffff : 0xff8b8b8b);
    if (this.premium && preset.url) {
      const tex = this._officialTexture(preset);
      if (tex) this._drawCape(gui, tex, x, y, SKIN_TILE, 16);
      else gui.rect(x, y, x + SKIN_TILE, y + 16, 0xff3f3f3f);
      return;
    }
    const tex = this._presetTexture(preset, 'cape');
    if (tex) this._drawCape(gui, tex, x, y, SKIN_TILE, 16);
  }

  _presetTexture(item, kind) {
    const key = 'skins-preset-' + kind + ':' + item.id + ':' + item.name;
    const cached = this.game.assets.textures.get(key);
    if (cached) return cached;
    try {
      const img = decodePng(decodeBase64(item.png));
      return this.game.assets.makeTexture(key, img.width, img.height, img.data);
    } catch (e) {
      return null;
    }
  }

  _officialTexture(cape) {
    const key = 'skins-official-cape:' + cape.id;
    const cached = this.game.assets.textures.get(key);
    if (cached) return cached;
    if (cape.url && !this.officialRequests.has(key)) {
      this.officialRequests.add(key);
      fetchSkin(cape.url, this.account && this.account.uuid, 'cape').then((bytes) => {
        const img = decodePng(bytes);
        this.game.assets.makeTexture(key, img.width, img.height, img.data);
      }).catch(() => {});
    }
    return null;
  }

  _accountRow(gui, acc, x, y) {
    if (!acc) return;
    drawFace(gui, this.game, acc, x, y, 24);
    gui.text(acc.name, x + 28, y + 1, 0xffffff, false);
    const kind = acc.type === 'microsoft' ? tr('minecraftjs.accounts.microsoft') : tr('minecraftjs.accounts.offline');
    gui.text('§7' + kind, x + 28, y + 11, 0x808080, false);
  }

  _viewerContains(mx, my) {
    if (this.tab === 'accounts') return false;
    const L = this._layout();
    return mx >= L.x0 && mx <= L.x0 + L.w && my >= L.top && my <= L.top + L.h;
  }

  mouseDown(mx, my, button, e) {
    if (super.mouseDown(mx, my, button)) return true;
    if (button === 0 && this._viewerContains(mx, my)) {
      this.dragging = true;
      this.dragX = mx;
      this.dragY = my;
      return true;
    }
    return this.tab === 'accounts' && this.accountList.mouseDown(mx, my, button, e);
  }

  mouseUp(mx, my, button) {
    this.dragging = false;
    super.mouseUp(mx, my, button);
    if (this.tab === 'accounts') this.accountList.mouseUp();
  }

  mouseMove(mx, my) {
    this.lastMx = mx;
    this.lastMy = my;
    if (this.dragging) {
      this.viewYaw = (this.viewYaw + (mx - this.dragX) * 0.55 + 360) % 360;
      this.viewPitch = clamp(this.viewPitch + (my - this.dragY) * 0.35, -30, 30);
      this.dragX = mx;
      this.dragY = my;
      return;
    }
    if (this.tab === 'accounts') this.accountList.mouseMove(mx, my);
  }

  wheel(d) {
    if (this._viewerContains(this.lastMx, this.lastMy)) {
      this.viewZoom = clamp(this.viewZoom + (d > 0 ? -0.06 : 0.06), 0.7, 1.2);
      return;
    }
    if (this.tab === 'accounts') this.accountList.wheel(d);
  }
}
