// GuiOptions and its sub-screens, laid out like 1.8.9 (video, controls, sounds, chat, skin, language,
// snooper, broadcast).
import { Screen } from './manager.js';
import { Button, Slider } from '../widgets.js';
import { DEFAULT_KEYS } from '../../game/settings.js';
import { platform } from '../../platform/platform.js';
import { ResourcePacksScreen } from './packs.js';
import { tr, trOption, onOff } from '../i18n.js';

class OptionsBase extends Screen {
  constructor(game, parent, titleKey) {
    super(game);
    this.parent = parent;
    this.titleKey = titleKey;
    this.background = game.inWorld ? 'world' : 'dirt';
  }
  get s() { return this.game.settings; }
  done() { this.s.save(); this.game.screens.open(this.parent); }
  close() { this.done(); }
  renderContent(gui) { gui.textCentered(tr(this.titleKey), this.width / 2, 15, 0xffffff); }
  // Two-column layout helper (fixed rows, e.g. sounds / chat / skin)
  grid(items, y0 = this.height / 6 - 12) {
    let i = 0;
    for (const it of items) {
      const x = this.width / 2 - 155 + (i % 2) * 160;
      const y = y0 + 24 * (i >> 1);
      if (it) this.buttons.push(makeOption(i, x, y, it));
      i++;
    }
  }
  doneButton(y) {
    this.buttons.push(new Button(200, this.width / 2 - 100, y ?? this.height / 6 + 168, 200, 20, tr('gui.done'), () => this.done()));
  }
}

function makeOption(id, x, y, it) {
  const w = it.wide ? 310 : 150; // wide controls span both columns (e.g. master volume)
  const b = it.slider ? new Slider(id, x, y, w, 20, it.label, it.value(), it.set) : new Button(id, x, y, w, 20, it.label, it.click);
  if (it.enabled === false) b.enabled = false;
  return b;
}

// GuiOptions
export class OptionsScreen extends OptionsBase {
  constructor(game, parent) { super(game, parent, 'options.title'); }
  init() {
    const g = this.game, s = this.s;
    const cx = this.width / 2, h6 = this.height / 6;
    const fovLabel = (v) => {
      const f = Math.round(30 + v * 80);
      return trOption('options.fov', f === 70 ? tr('options.fov.min') : f === 110 ? tr('options.fov.max') : f);
    };
    this.buttons.push(new Slider(0, cx - 155, h6 - 12, 150, 20, fovLabel, (s.fov - 30) / 80, (v) => { s.fov = Math.round(30 + v * 80); }));
    if (g.inWorld) {
      // Difficulty can only be changed in singleplayer
      const diff = ['peaceful', 'easy', 'normal', 'hard'][g.difficulty] || 'normal';
      const b = new Button(108, cx + 5, h6 - 12, 150, 20, trOption('options.difficulty', tr(g.hardcore ? 'options.difficulty.hardcore' : 'options.difficulty.' + diff)), null);
      b.enabled = false;
      this.buttons.push(b);
    }
    const btn = (id, col, row, key, fn) => this.buttons.push(new Button(id, cx + (col ? 5 : -155), h6 + 48 - 6 + 24 * row, 150, 20, typeof key === 'function' ? key : tr(key), fn));
    const open = (Cls) => () => g.screens.open(new Cls(g, this));
    btn(110, 0, 0, 'options.skinCustomisation', open(SkinScreen));
    btn(8675309, 1, 0, 'Super Secret Settings...', () => g.cycleSuperSecret && g.cycleSuperSecret());
    btn(106, 0, 1, 'options.sounds', open(SoundScreen));
    btn(107, 1, 1, 'options.stream', open(StreamUnavailableScreen));
    btn(101, 0, 2, 'options.video', open(VideoScreen));
    btn(100, 1, 2, 'options.controls', open(ControlsScreen));
    btn(102, 0, 3, 'options.language', open(LanguageScreen));
    btn(103, 1, 3, 'options.chat.title', open(ChatOptionsScreen));
    btn(105, 0, 4, 'options.resourcepack', open(ResourcePacksScreen));
    btn(104, 1, 4, 'options.snooper.view', open(SnooperScreen));
    this.doneButton();
  }
}

// GuiLanguage: every language the game (and active resource packs) provide
class LanguageScreen extends OptionsBase {
  constructor(game, parent) {
    super(game, parent, 'options.language');
    this.scroll = 0;
    this.busy = false;
  }
  get codes() {
    const L = this.game.assets.languages;
    return Object.keys(L).sort((a, b) => (L[a].name + L[a].region).localeCompare(L[b].name + L[b].region));
  }
  init() {
    const s = this.s, cx = this.width / 2;
    this.buttons.push(new Button(100, cx - 155, this.height - 38, 150, 20, () => trOption('options.forceUnicodeFont', onOff(s.forceUnicodeFont)), () => {
      s.forceUnicodeFont = !s.forceUnicodeFont;
      s.save();
      this.game.applyLanguage();
    }));
    this.buttons.push(new Button(6, cx + 5, this.height - 38, 150, 20, tr('gui.done'), () => this.done()));
    const i = this.codes.indexOf(this.game.assets.language);
    this.scroll = Math.max(0, Math.min(this._maxScroll(), i * 18 - (this.height - 65 - 32) / 2));
  }
  _maxScroll() { return Math.max(0, this.codes.length * 18 + 4 - (this.height - 65 - 32)); }
  renderContent(gui) {
    const L = this.game.assets.languages, cur = this.game.assets.language;
    const top = 32, bottom = this.height - 65, cx = this.width / 2;
    gui.rect(0, top, this.width, bottom, 0x80000000);
    gui.scissor(0, top, this.width, bottom - top);
    this.codes.forEach((code, i) => {
      const y = top + 4 + i * 18 - this.scroll;
      if (y + 18 < top || y > bottom) return;
      if (code === cur) {
        gui.rect(cx - 110, y - 2, cx + 110, y + 16, 0xff808080);
        gui.rect(cx - 109, y - 1, cx + 109, y + 15, 0xff000000);
      }
      const l = L[code];
      gui.textCentered(l.name + ' (' + l.region + ')', cx, y + 2, 0xffffff, true);
    });
    gui.clearScissor();
    gui.textCentered(tr('options.language'), cx, 16, 0xffffff);
    gui.textCentered('(' + tr('options.languageWarning') + ')', cx, this.height - 56, 0x808080);
  }
  mouseDown(mx, my, button) {
    if (super.mouseDown(mx, my, button)) return true;
    const top = 32, bottom = this.height - 65, cx = this.width / 2;
    if (button !== 0 || this.busy || my < top || my >= bottom || mx < cx - 110 || mx >= cx + 110) return false;
    const code = this.codes[Math.floor((my - top - 4 + this.scroll) / 18)];
    if (!code || code === this.game.assets.language) return false;
    this.busy = true;
    this.game.sound.playUi('ui.button.click', 1);
    this.game.setLanguage(code).finally(() => {
      this.busy = false;
      this.buttons = []; this.fields = []; this.init(); // labels in the new language
    });
    return true;
  }
  wheel(d) { this.scroll = Math.max(0, Math.min(this._maxScroll(), this.scroll + d * 18)); }
}

// GuiVideoSettings: GuiOptionsRowList (two columns, scrolling) with GameSettings.Options in 1.12.2 order
class VideoScreen extends OptionsBase {
  constructor(game, parent) { super(game, parent, 'options.videoTitle'); this.scroll = 0; }
  init() {
    const g = this.game, s = this.s;
    this.mipsBefore = s.mipmapLevels;
    const items = [
      { label: () => trOption('options.graphics', tr(s.fancyGraphics ? 'options.graphics.fancy' : 'options.graphics.fast')), click: () => { s.fancyGraphics = !s.fancyGraphics; } },
      { slider: true, label: (v) => trOption('options.renderDistance', Math.round(2 + v * 30) + ' chunks'), value: () => (s.renderDistance - 2) / 30, set: (v) => { s.renderDistance = Math.round(2 + v * 30); } },
      { label: () => trOption('options.ao', tr('options.ao.' + ['off', 'min', 'max'][s.smoothLighting | 0])), click: () => { s.smoothLighting = ((s.smoothLighting | 0) + 1) % 3; } },
      { slider: true, label: (v) => { const f = Math.round(10 + v * 250); return trOption('options.framerateLimit', f >= 260 ? tr('options.framerateLimit.max') : f + ' fps'); }, value: () => (s.maxFps ? (s.maxFps - 10) / 250 : 1), set: (v) => { const f = Math.round(10 + v * 250); s.maxFps = f >= 260 ? 0 : f; } },
      { label: () => trOption('options.anaglyph', onOff(false)), click: () => {} },
      { label: () => trOption('options.viewBobbing', onOff(s.viewBobbing)), click: () => { s.viewBobbing = !s.viewBobbing; } },
      { label: () => trOption('options.guiScale', tr('options.guiScale.' + ['auto', 'small', 'normal', 'large'][s.guiScale])), click: () => { s.guiScale = (s.guiScale + 1) % 4; g.gui.guiScaleSetting = s.guiScale; g.gui.resize(); } },
      { label: () => trOption('options.attackIndicator', tr(['options.off', 'options.attack.crosshair', 'options.attack.hotbar'][s.attackIndicator | 0])), click: () => { s.attackIndicator = ((s.attackIndicator | 0) + 1) % 3; } },
      { slider: true, label: (v) => trOption('options.gamma', v === 0 ? tr('options.gamma.min') : v === 1 ? tr('options.gamma.max') : '+' + Math.round(v * 100) + '%'), value: () => s.gamma, set: (v) => { s.gamma = v; g.renderer.gamma = v; } },
      { label: () => trOption('options.renderClouds', s.clouds === 0 ? tr('options.off') : tr(s.clouds === 1 ? 'options.graphics.fast' : 'options.graphics.fancy')), click: () => { s.clouds = ((s.clouds | 0) + 2) % 3; } },
      { label: () => trOption('options.particles', tr('options.particles.' + ['all', 'decreased', 'minimal'][s.particles])), click: () => { s.particles = (s.particles + 1) % 3; } },
      { label: () => trOption('options.fullscreen', onOff(platform().isFullscreen())), click: () => platform().toggleFullscreen() },
      { label: () => trOption('options.vsync', onOff(s.enableVsync)), click: () => { s.enableVsync = !s.enableVsync; platform().vsync = s.enableVsync; } },
      { slider: true, label: (v) => { const n = Math.round(v * 4); return trOption('options.mipmapLevels', n === 0 ? tr('options.off') : n); }, value: () => s.mipmapLevels / 4, set: (v) => { s.mipmapLevels = Math.round(v * 4); } },
      { label: () => trOption('options.vbo', onOff(s.useVbo)), click: () => { s.useVbo = !s.useVbo; } },
      { label: () => trOption('options.entityShadows', onOff(s.entityShadows)), click: () => { s.entityShadows = !s.entityShadows; } },
      // MinecraftJS: which graphics API the renderer uses
      { label: () => trOption('minecraftjs.options.graphicsApi', (s.graphicsApi === 'webgpu' ? 'WebGPU' : 'WebGL 2') + ((s.graphicsApi === 'webgpu') !== (g.device.name === 'WebGPU') ? ' ' + tr('minecraftjs.options.restart') : '')),
        click: () => { s.graphicsApi = s.graphicsApi === 'webgpu' ? 'webgl2' : 'webgpu'; } },
    ];
    this.rows = [];
    items.forEach((it, i) => {
      const b = makeOption(i, this.width / 2 - 155 + (i % 2) * 160, 0, it);
      b.baseY = 32 + 4 + (i >> 1) * 25;
      this.rows.push(b);
      this.buttons.push(b);
    });
    this.buttons.push(new Button(200, this.width / 2 - 100, this.height - 27, 200, 20, tr('gui.done'), () => this.done()));
    this._layout();
  }
  _maxScroll() { return Math.max(0, Math.ceil(this.rows.length / 2) * 25 + 8 - (this.height - 64)); }
  _layout() {
    const top = 32, bottom = this.height - 32;
    for (const b of this.rows) {
      b.y = b.baseY - Math.floor(this.scroll);
      b.visible = b.y + 20 > top && b.y < bottom;
      b.clickable = b.y >= top && b.y + 20 <= bottom;
    }
  }
  render(gui, mx, my, partial) {
    // GuiSlot: darker dirt list between dirt bars
    gui.dirtBackground(0x404040);
    gui.scissor(0, 32, this.width, this.height - 64);
    gui.dirtBackground(0x202020);
    this._layout();
    for (const b of this.rows) b.render(gui, mx, my);
    gui.clearScissor();
    gui.gradient(0, 32, this.width, 36, 0xff000000, 0x00000000);
    gui.gradient(0, this.height - 36, this.width, this.height - 32, 0x00000000, 0xff000000);
    gui.textCentered(tr(this.titleKey), this.width / 2, 15, 0xffffff);
    for (const b of this.buttons) if (!this.rows.includes(b)) b.render(gui, mx, my);
    void partial;
  }
  mouseDown(mx, my, button) {
    if (my >= 32 && my < this.height - 32) {
      for (const b of this.rows) if (b.clickable && b.mouseDown(mx, my, this.game)) return true;
      return false;
    }
    for (const b of this.buttons) if (!this.rows.includes(b) && b.mouseDown(mx, my, this.game)) return true;
    return false;
  }
  wheel(d) { this.scroll = Math.max(0, Math.min(this._maxScroll(), this.scroll + d * 25)); }
  done() {
    const g = this.game;
    g.renderer.renderDistance = this.s.renderDistance;
    g.applyGraphicsSettings();
    if (g.inWorld) g.sendSettings();
    super.done();
  }
}

class SoundScreen extends OptionsBase {
  constructor(game, parent) { super(game, parent, 'options.sounds.title'); }
  init() {
    const s = this.s;
    const pct = (key) => (v) => trOption(key, v === 0 ? tr('options.off') : Math.round(v * 100) + '%');
    const items = [{ slider: true, wide: true, label: pct('soundCategory.master'), value: () => s.masterVolume, set: (v) => { s.masterVolume = v; } }, null];
    for (const k of ['music', 'record', 'weather', 'block', 'hostile', 'neutral', 'player', 'ambient']) {
      items.push({ slider: true, label: pct('soundCategory.' + k), value: () => s.soundVolumes[k], set: (v) => { s.soundVolumes[k] = v; } });
    }
    this.grid(items);
    this.doneButton();
  }
}

// ScreenChatOptions (GuiNewChat.calculateChatboxWidth / Height)
class ChatOptionsScreen extends OptionsBase {
  constructor(game, parent) { super(game, parent, 'options.chat.title'); }
  init() {
    const s = this.s;
    const px = (v, a, b) => Math.floor(v * a + b) + 'px';
    this.grid([
      { label: () => trOption('options.chat.visibility', tr('options.chat.visibility.' + ['full', 'system', 'hidden'][s.chatVisibility])), click: () => { s.chatVisibility = (s.chatVisibility + 1) % 3; } },
      { label: () => trOption('options.chat.color', onOff(s.chatColors)), click: () => { s.chatColors = !s.chatColors; } },
      { label: () => trOption('options.chat.links', onOff(true)), click: () => {} },
      { slider: true, label: (v) => trOption('options.chat.opacity', Math.round((v * 0.9 + 0.1) * 100) + '%'), value: () => s.chatOpacity, set: (v) => { s.chatOpacity = v; } },
      { label: () => trOption('options.chat.links.prompt', onOff(true)), click: () => {} },
      { slider: true, label: (v) => trOption('options.chat.scale', Math.round(v * 100) + '%'), value: () => s.chatScale, set: (v) => { s.chatScale = v; } },
      { slider: true, label: (v) => trOption('options.chat.height.focused', px(v, 160, 20)), value: () => s.chatHeightFocused, set: (v) => { s.chatHeightFocused = v; } },
      { slider: true, label: (v) => trOption('options.chat.height.unfocused', px(v, 160, 20)), value: () => s.chatHeightUnfocused, set: (v) => { s.chatHeightUnfocused = v; } },
      { slider: true, label: (v) => trOption('options.chat.width', px(v, 280, 40)), value: () => s.chatWidth, set: (v) => { s.chatWidth = v; } },
      { label: () => trOption('options.reducedDebugInfo', onOff(s.reducedDebugInfo)), click: () => { s.reducedDebugInfo = !s.reducedDebugInfo; } },
    ]);
    this.doneButton();
  }
  done() { if (this.game.inWorld) this.game.sendSettings(); super.done(); }
}

class SkinScreen extends OptionsBase {
  constructor(game, parent) { super(game, parent, 'options.skinCustomisation.title'); }
  init() {
    const s = this.s;
    const parts = [['cape', 0x01], ['jacket', 0x02], ['left_sleeve', 0x04], ['right_sleeve', 0x08], ['left_pants_leg', 0x10], ['right_pants_leg', 0x20], ['hat', 0x40]];
    const items = parts.map(([n, bit]) => ({ label: () => trOption('options.modelPart.' + n, onOff(s.skinParts & bit)), click: () => { s.skinParts ^= bit; } }));
    // 1.9+: main hand
    items.push({ label: () => trOption('options.mainHand', tr(s.mainHand === 'left' ? 'options.mainHand.left' : 'options.mainHand.right')), click: () => { s.mainHand = s.mainHand === 'left' ? 'right' : 'left'; } });
    this.grid(items);
    this.doneButton();
  }
  done() { if (this.game.inWorld) this.game.sendSettings(); super.done(); }
}

// GameSettings.keyBindings: binding -> [description key, category key]
const KEY_BINDINGS = {
  attack: ['key.attack', 'key.categories.gameplay'], use: ['key.use', 'key.categories.gameplay'],
  forward: ['key.forward', 'key.categories.movement'], left: ['key.left', 'key.categories.movement'],
  back: ['key.back', 'key.categories.movement'], right: ['key.right', 'key.categories.movement'],
  jump: ['key.jump', 'key.categories.movement'], sneak: ['key.sneak', 'key.categories.movement'], sprint: ['key.sprint', 'key.categories.movement'],
  drop: ['key.drop', 'key.categories.gameplay'], inventory: ['key.inventory', 'key.categories.inventory'],
  chat: ['key.chat', 'key.categories.multiplayer'], playerlist: ['key.playerlist', 'key.categories.multiplayer'],
  pickItem: ['key.pickItem', 'key.categories.gameplay'], command: ['key.command', 'key.categories.multiplayer'],
  screenshot: ['key.screenshot', 'key.categories.misc'], perspective: ['key.togglePerspective', 'key.categories.misc'],
  smoothCamera: ['key.smoothCamera', 'key.categories.misc'],
  swapHands: ['key.swapHands', 'key.categories.inventory'], advancements: ['key.advancements', 'key.categories.misc'],
  saveToolbarActivator: ['key.saveToolbarActivator', 'key.categories.creative'], loadToolbarActivator: ['key.loadToolbarActivator', 'key.categories.creative'],
  fullscreen: ['key.fullscreen', 'key.categories.misc'], spectatorOutlines: ['key.spectatorOutlines', 'key.categories.misc'],
};
for (let i = 1; i <= 9; i++) KEY_BINDINGS['hotbar' + i] = ['key.hotbar.' + i, 'key.categories.inventory'];

// GuiControls + GuiKeyBindingList: bindings grouped under category headers, sorted like KeyBinding.compareTo
class ControlsScreen extends OptionsBase {
  constructor(game, parent) { super(game, parent, 'controls.title'); this.scroll = 0; this.binding = null; }
  init() {
    const s = this.s;
    const cx = this.width / 2;
    this.grid([
      { label: () => trOption('options.invertMouse', onOff(s.invertMouse)), click: () => { s.invertMouse = !s.invertMouse; } },
      { slider: true, label: (v) => trOption('options.sensitivity', v === 0 ? tr('options.sensitivity.min') : v === 1 ? tr('options.sensitivity.max') : Math.round(v * 200) + '%'), value: () => s.sensitivity, set: (v) => { s.sensitivity = v; } },
      { label: () => trOption('options.touchscreen', onOff(s.touchscreen)), click: () => { s.touchscreen = !s.touchscreen; } },
      { label: () => trOption('options.autoJump', onOff(s.autoJump)), click: () => { s.autoJump = !s.autoJump; } },
    ], 18);
    this.buttons.push(new Button(201, cx - 155, this.height - 29, 150, 20, tr('controls.resetAll'), () => { s.keys = { ...DEFAULT_KEYS }; }));
    this.buttons.push(new Button(200, cx - 155 + 160, this.height - 29, 150, 20, tr('gui.done'), () => this.done()));
    const keys = Object.keys(KEY_BINDINGS).sort((a, b) => {
      const c = tr(KEY_BINDINGS[a][1]).localeCompare(tr(KEY_BINDINGS[b][1]));
      return c || tr(KEY_BINDINGS[a][0]).localeCompare(tr(KEY_BINDINGS[b][0]));
    });
    this.entries = [];
    let cat = null;
    for (const k of keys) {
      if (KEY_BINDINGS[k][1] !== cat) { cat = KEY_BINDINGS[k][1]; this.entries.push({ header: cat }); }
      this.entries.push({ key: k });
    }
  }
  renderContent(gui, mx, my) {
    gui.textCentered(tr(this.titleKey), this.width / 2, 8, 0xffffff);
    const top = 63, bottom = this.height - 32;
    gui.scissor(0, top, this.width, bottom - top);
    gui.rect(0, top, this.width, bottom, 0x60000000);
    const cx = this.width / 2;
    this.rows = [];
    let y = top + 4 - this.scroll;
    for (const e of this.entries) {
      if (e.header) {
        gui.textCentered(tr(e.header), cx, y + 20 - 9 - 1, 0xffffff, true);
        y += 20;
        continue;
      }
      const k = e.key;
      const name = tr(KEY_BINDINGS[k][0]);
      gui.text(name, cx + 90 - 185 - 5 + 90 - gui.textWidth(name) - 5, y + 6, 0xffffff);
      const code = this.s.keys[k];
      const dup = Object.keys(KEY_BINDINGS).some((o) => o !== k && this.s.keys[o] === code && code);
      let label = this.s.keyName(code);
      if (this.binding === k) label = '§f> §e' + label + '§f <';
      else if (dup) label = '§c' + label;
      const kx = cx + 90 - 185 + 105, inList = my >= top && my < bottom;
      gui.button(kx, y, 75, 20, label, inList && mx >= kx && mx < kx + 75 && my >= y && my < y + 20);
      const isDefault = code === DEFAULT_KEYS[k];
      const rx = kx + 80;
      gui.button(rx, y, 50, 20, tr('controls.reset'), inList && !isDefault && mx >= rx && mx < rx + 50 && my >= y && my < y + 20, !isDefault);
      this.rows.push({ k, y, kx, rx });
      y += 20;
    }
    this.contentHeight = y + this.scroll - top;
    gui.clearScissor();
  }
  mouseDown(mx, my, button, e) {
    if (this.binding) { this.s.keys[this.binding] = 'mouse' + button; this.binding = null; return true; }
    if (super.mouseDown(mx, my, button, e)) return true;
    if (my < 63 || my >= this.height - 32) return false;
    for (const r of this.rows || []) {
      if (my < r.y || my >= r.y + 20) continue;
      if (mx >= r.kx && mx < r.kx + 75) { this.binding = r.k; this.game.sound.playUi('ui.button.click', 1); return true; }
      if (mx >= r.rx && mx < r.rx + 50 && this.s.keys[r.k] !== DEFAULT_KEYS[r.k]) { this.s.keys[r.k] = DEFAULT_KEYS[r.k]; this.game.sound.playUi('ui.button.click', 1); return true; }
    }
    return false;
  }
  key(e) {
    if (this.binding) {
      this.s.keys[this.binding] = e.code === 'Escape' ? '' : e.code;
      this.binding = null;
      return true;
    }
    return super.key(e);
  }
  wheel(d) {
    const max = Math.max(0, (this.contentHeight || 0) + 8 - (this.height - 32 - 63));
    this.scroll = Math.min(max, Math.max(0, this.scroll + d * 20));
  }
}

// GuiSnooper: the toggle and what it would report. MinecraftJS never sends snooper data.
class SnooperScreen extends OptionsBase {
  constructor(game, parent) { super(game, parent, 'options.snooper.title'); }
  init() {
    const s = this.s, cx = this.width / 2;
    this.buttons.push(new Button(1, cx - 152, this.height - 30, 150, 20, () => trOption('options.snooper', onOff(s.snooperEnabled)), () => { s.snooperEnabled = !s.snooperEnabled; }));
    this.buttons.push(new Button(2, cx + 2, this.height - 30, 150, 20, tr('gui.done'), () => this.done()));
    const P = platform();
    this.data = [
      ['version', '1.12.2'], ['client_brand', 'vanilla'], ['display_type', P.isFullscreen() ? 'fullscreen' : 'windowed'],
      ['display_frequency', '-'], ['gl_version', this.game.device.name], ['cpu_cores', String(P.cpuCount || '?')],
      ['opengl_version', this.game.device.name], ['render_distance', String(s.renderDistance)],
    ];
  }
  renderContent(gui) {
    super.renderContent(gui);
    const lines = gui.font.wrap(tr('options.snooper.desc'), this.width - 30);
    let y = 23;
    for (const l of lines) { gui.textCentered(l, this.width / 2, y, 0x808080); y += 9; }
    const top = y + 6;
    gui.rect(0, top, this.width, this.height - 40, 0x80000000);
    let ry = top + 4;
    for (const [k, v] of this.data) {
      gui.text(k, 10, ry, 0xffffff);
      gui.text(v, 220, ry, 0xffffff);
      ry += 10;
    }
  }
}

// GuiStreamUnavailable: Twitch broadcasting does not exist in the browser
class StreamUnavailableScreen extends OptionsBase {
  constructor(game, parent) { super(game, parent, 'stream.unavailable.title'); }
  init() { this.buttons.push(new Button(1, this.width / 2 - 155 + 80, this.height / 4 + 120 + 12, 150, 20, tr('gui.back'), () => this.done())); }
  renderContent(gui) {
    gui.textCentered(tr(this.titleKey), this.width / 2, this.height / 4 - 20, 0xffffff);
    let y = this.height / 4 + 10;
    for (const l of gui.font.wrap(tr('stream.unavailable.not_supported.other'), this.width - 60)) { gui.textCentered(l, this.width / 2, y, 0xa0a0a0); y += 9; }
  }
}

export { VideoScreen, ControlsScreen, LanguageScreen };
