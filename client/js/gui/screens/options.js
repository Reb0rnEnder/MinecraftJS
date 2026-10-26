import { VANILLA_UI } from '../vanilla-layout.js';
// GuiOptions and its sub-screens, laid out like 1.12.2 (video, controls, sounds, chat, skin, language, snooper).
// Scrolling lists are GuiSlot / GuiListExtended ports (ListOf): drag the list or its scrollbar, or use the wheel.
import { Screen } from './manager.js';
import { Button, Slider } from '../widgets.js';
import { ListOf } from '../slot-list.js';
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
  b.tip=it.tip;
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
    } else {
      // 1.12 GuiOptions: GameSettings.Options.REALMS_NOTIFICATIONS on the title screen
      if (s.realmsNotifications === undefined) s.realmsNotifications = true;
      this.buttons.push(new Button(GameOptionsIds.REALMS_NOTIFICATIONS, cx + 5, h6 - 12, 150, 20,
        () => trOption('options.realmsNotifications', onOff(s.realmsNotifications)), () => { s.realmsNotifications = !s.realmsNotifications; }));
    }
    const btn = (id, col, row, key, fn) => this.buttons.push(new Button(id, cx + (col ? 5 : -155), h6 + 48 - 6 + 24 * row, 150, 20, typeof key === 'function' ? key : tr(key), fn));
    const open = (Cls) => () => g.screens.open(new Cls(g, this));
    btn(110, 0, 0, 'options.skinCustomisation', open(SkinScreen));
    btn(106, 1, 0, 'options.sounds', open(SoundScreen));
    btn(101, 0, 1, 'options.video', open(VideoScreen));
    btn(100, 1, 1, 'options.controls', open(ControlsScreen));
    btn(102, 0, 2, 'options.language', open(LanguageScreen));
    btn(103, 1, 2, 'options.chat.title', open(ChatOptionsScreen));
    btn(105, 0, 3, 'options.resourcepack', open(ResourcePacksScreen));
    btn(104, 1, 3, 'options.snooper.view', open(SnooperScreen));
    this.doneButton();
  }
}

const GameOptionsIds = { REALMS_NOTIFICATIONS: 30 };

// GuiLanguage + GuiLanguage.List (GuiSlot, 18 high, centred names, the current language selected)
class LanguageScreen extends OptionsBase {
  constructor(game, parent) {
    super(game, parent, 'options.language');
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
    this.buttons.push(new Button(6, cx - 155 + 160, this.height - 38, 150, 20, tr('gui.done'), () => this.done()));
    const codes = this.codes;
    const old = this.list;
    this.list = new ListOf(this, 32, this.height - 65 + 4, 18, {
      size: () => codes.length,
      selected: (i) => codes[i] === this.game.assets.language,
      draw: (gui, i, x, y) => { const l = this.game.assets.languages[codes[i]]; gui.textCentered(l.name + ' (' + l.region + ')', this.width / 2, y + 1, 0xffffff, true); },
      click: (i) => this._pick(codes[i]),
    });
    if (old) this.list.amountScrolled = old.amountScrolled;
    else this.list.amountScrolled = codes.indexOf(this.game.assets.language) * 18 - (this.list.bottom - this.list.top) / 2;
    this.list.clamp();
  }
  _pick(code) {
    if (!code || this.busy || code === this.game.assets.language) return;
    this.busy = true;
    this.game.setLanguage(code).finally(() => {
      this.busy = false;
      this.buttons = []; this.fields = []; this.init(); // labels in the new language
    });
  }
  render(gui, mx, my) {
    this.list.render(gui, mx, my);
    gui.textCentered(tr('options.language'), this.width / 2, 16, 0xffffff);
    gui.textCentered('(' + tr('options.languageWarning') + ')', this.width / 2, this.height - 56, 0x808080);
    for (const b of this.buttons) b.render(gui, mx, my);
  }
  mouseDown(mx, my, button, e) { return super.mouseDown(mx, my, button) || this.list.mouseDown(mx, my, button, e); }
  mouseUp(mx, my, button) { super.mouseUp(mx, my, button); this.list.mouseUp(); }
  mouseMove(mx, my) { this.list.mouseMove(mx, my); }
  wheel(d) { this.list.wheel(d); }
}

// GuiVideoSettings: GuiOptionsRowList (two columns, scrolling) with GameSettings.Options in 1.12.2 order
class VideoScreen extends OptionsBase {
  constructor(game, parent) { super(game, parent, 'options.videoTitle'); }
  init() {
    const g = this.game, s = this.s;
    this.mipsBefore = s.mipmapLevels;
    const items = [
      { key: 'options.graphics', label: () => trOption('options.graphics', tr(s.fancyGraphics ? 'options.graphics.fancy' : 'options.graphics.fast')), click: () => { s.fancyGraphics = !s.fancyGraphics; } },
      { key: 'options.renderDistance', slider: true, label: (v) => trOption('options.renderDistance', Math.round(2 + v * 30) + ' chunks'), value: () => (s.renderDistance - 2) / 30, set: (v) => { s.renderDistance = Math.round(2 + v * 30); } },
      { key: 'options.ao', label: () => trOption('options.ao', tr('options.ao.' + ['off', 'min', 'max'][s.smoothLighting | 0])), click: () => { s.smoothLighting = ((s.smoothLighting | 0) + 1) % 3; } },
      { key: 'options.framerateLimit', slider: true, label: (v) => { const f = Math.round(10 + v * 250); return trOption('options.framerateLimit', f >= 260 ? tr('options.framerateLimit.max') : f + ' fps'); }, value: () => (s.maxFps ? (s.maxFps - 10) / 250 : 1), set: (v) => { const f = Math.round(10 + v * 250); s.maxFps = f >= 260 ? 0 : f; } },
      { key: 'options.anaglyph', label: () => trOption('options.anaglyph', onOff(false)), click: () => {} },
      { key: 'options.viewBobbing', label: () => trOption('options.viewBobbing', onOff(s.viewBobbing)), click: () => { s.viewBobbing = !s.viewBobbing; } },
      { key: 'options.guiScale', label: () => trOption('options.guiScale', tr('options.guiScale.' + ['auto', 'small', 'normal', 'large'][s.guiScale])), click: () => { s.guiScale = (s.guiScale + 1) % 4; g.gui.guiScaleSetting = s.guiScale; g.gui.resize(); } },
      { key: 'options.attackIndicator', label: () => trOption('options.attackIndicator', tr(['options.off', 'options.attack.crosshair', 'options.attack.hotbar'][s.attackIndicator | 0])), click: () => { s.attackIndicator = ((s.attackIndicator | 0) + 1) % 3; } },
      { key: 'options.gamma', slider: true, label: (v) => trOption('options.gamma', v === 0 ? tr('options.gamma.min') : v === 1 ? tr('options.gamma.max') : '+' + Math.round(v * 100) + '%'), value: () => s.gamma, set: (v) => { s.gamma = v; g.renderer.gamma = v; } },
      { key: 'options.renderClouds', label: () => trOption('options.renderClouds', s.clouds === 0 ? tr('options.off') : tr(s.clouds === 1 ? 'options.graphics.fast' : 'options.graphics.fancy')), click: () => { s.clouds = ((s.clouds | 0) + 2) % 3; } },
      { key: 'options.particles', label: () => trOption('options.particles', tr('options.particles.' + ['all', 'decreased', 'minimal'][s.particles])), click: () => { s.particles = (s.particles + 1) % 3; } },
      { key: 'options.fullscreen', label: () => trOption('options.fullscreen', onOff(platform().isFullscreen())), click: () => platform().toggleFullscreen() },
      { key: 'options.vsync', label: () => trOption('options.vsync', onOff(s.enableVsync)), click: () => { s.enableVsync = !s.enableVsync; platform().vsync = s.enableVsync; } },
      { key: 'options.mipmapLevels', slider: true, label: (v) => { const n = Math.round(v * 4); return trOption('options.mipmapLevels', n === 0 ? tr('options.off') : n); }, value: () => s.mipmapLevels / 4, set: (v) => { s.mipmapLevels = Math.round(v * 4); } },
      { key: 'options.vbo', label: () => trOption('options.vbo', onOff(s.useVbo)), click: () => { s.useVbo = !s.useVbo; } },
      { key: 'options.entityShadows', label: () => trOption('options.entityShadows', onOff(s.entityShadows)), click: () => { s.entityShadows = !s.entityShadows; } },
      // Distance from the camera in world blocks; the slider's maximum disables LOD.
      { slider: true, label: (v) => { const k = Math.round(v * 31); return tr('minecraftjs.options.lodDistance') + ': ' + (k >= 31 ? tr('options.off') : (16 + k * 16) + ' blocks'); },
        value: () => s.lodDistance <= 0 ? 1 : Math.min(30, Math.max(0, (s.lodDistance - 16) / 16)) / 31,
        set: (v) => { const k = Math.round(v * 31); s.lodDistance = k >= 31 ? 0 : 16 + k * 16; } },
      { label: () => 'Shader Packs…', click: () => import('./shaders.js').then(m=>g.screens.open(new m.ShaderPacksScreen(g,this))) },
      // MinecraftJS: which graphics API the renderer uses
      { label: () => {
          const names = { webgl2: 'WebGL 2', webgpu: 'WebGPU', software: tr('minecraftjs.options.graphicsApi.software') };
          const cur = g.device.name === 'WebGPU' ? 'webgpu' : g.device.name === 'Software' ? 'software' : 'webgl2';
          return trOption('minecraftjs.options.graphicsApi', (names[s.graphicsApi] || 'WebGL 2') + (s.graphicsApi !== cur ? (g.device.graphicsSelection?.requested===s.graphicsApi?' (using '+names[cur]+')':' '+tr('minecraftjs.options.restart')) : ''));
        },
        tip:()=>g.device.graphicsSelection?.requested===s.graphicsApi?g.device.graphicsSelection.errors.join('\n'):'',
        click: () => { const order = ['webgl2', 'webgpu', 'software']; s.graphicsApi = order[(order.indexOf(s.graphicsApi) + 1) % order.length]; } },
      // MinecraftJS: Super Potato Mode trades quality for speed on any graphics API (lower internal resolution, a
      // single-pass menu panorama); always on with the CPU rasteriser
      { label: () => trOption('minecraftjs.options.superPotato', onOff(!!s.superPotato || g.device.name === 'Software')),
        enabled: g.device.name !== 'Software', // greyed out while the CPU rasteriser forces it on
        click: () => {
          if (g.device.name === 'Software') return; // forced on
          s.superPotato = !s.superPotato;
          platform().setPotato && platform().setPotato(s.superPotato);
        } },
    ];
    const vanillaItems = VANILLA_UI.videoOptions.map(key => {
      const item = items.find(it => it.key === key);
      if (!item) throw new Error('Missing video option: ' + key);
      return item;
    });
    const orderedItems = [...vanillaItems, ...items.filter(it => !it.key)];
    // GuiOptionsRowList: GuiListExtended(32, height - 32, 25), list width 400, scrollbar 32 further right
    this.rows = [];
    let col = 0;
    orderedItems.forEach((it, i) => {
      if (it.wide && col === 1) col = 0; // a wide option starts its own row
      const b = makeOption(i, this.width / 2 - 155 + col * 160, 0, it);
      b.optionKey = it.key || null;
      if (col === 0) this.rows.push([b]); else this.rows[this.rows.length - 1].push(b);
      col = it.wide ? 0 : 1 - col;
    });
    this.buttons.push(new Button(200, this.width / 2 - 100, this.height - 27, 200, 20, tr('gui.done'), () => this.done()));
    const old = this.list;
    this.list = new ListOf(this, 32, this.height - 32, 25, {
      size: () => this.rows.length,
      draw: (gui, i, x, y, h, mx, my, rmx, rmy) => { for (const b of this.rows[i]) { b.y = y; b.render(gui, b.dragging ? rmx : mx, b.dragging ? rmy : my); } },
      click: (i, dbl, mx, my) => this.rows[i].some((b) => b.mouseDown(mx, my, this.game)),
    }, { listWidth: 400, scrollBarOffset: 32, selectionBox: false });
    if (old) { this.list.amountScrolled = old.amountScrolled; this.list.clamp(); }
  }
  render(gui, mx, my) {
    this.list.render(gui, mx, my);
    gui.textCentered(tr(this.titleKey), this.width / 2, 5, 0xffffff);
    for (const b of this.buttons) b.render(gui, mx, my);
    if(my>=32&&my<this.height-32){const b=this.rows.flat().find(b=>b.tip&&b.hovered(mx,my)),tip=b?.tip();if(tip)gui.tooltip(gui.font.wrap(tip,Math.min(300,this.width-20)),mx,my);}
  }
  mouseDown(mx, my, button, e) { return super.mouseDown(mx, my, button) || this.list.mouseDown(mx, my, button, e); }
  mouseUp(mx, my, button) {
    super.mouseUp(mx, my, button);
    for (const r of this.rows) for (const b of r) if (b.mouseUp) b.mouseUp();
    this.list.mouseUp();
  }
  mouseMove(mx, my) { this.list.mouseMove(mx, my); }
  wheel(d) { this.list.wheel(d); }
  done() {
    const g = this.game;
    g.renderer.renderDistance = this.s.renderDistance;
    g.applyGraphicsSettings();
    if (g.inWorld) g.sendSettings();
    super.done();
  }
}

// GuiScreenOptionsSounds: master (wide), every other SoundCategory, then "Show Subtitles"
class SoundScreen extends OptionsBase {
  constructor(game, parent) { super(game, parent, 'options.sounds.title'); }
  init() {
    const s = this.s;
    const pct = (key) => (v) => trOption(key, v === 0 ? tr('options.off') : Math.round(v * 100) + '%');
    const items = [{ slider: true, wide: true, label: pct('soundCategory.master'), value: () => s.masterVolume, set: (v) => { s.masterVolume = v; } }, null];
    for (const k of ['music', 'record', 'weather', 'block', 'hostile', 'neutral', 'player', 'ambient', 'voice']) {
      items.push({ slider: true, label: pct('soundCategory.' + k), value: () => (s.soundVolumes[k] !== undefined ? s.soundVolumes[k] : 1), set: (v) => { s.soundVolumes[k] = v; } });
    }
    this.grid(items);
    const i = items.length + 1;
    this.buttons.push(new Button(201, this.width / 2 - 75, this.height / 6 - 12 + 24 * (i >> 1), 150, 20,
      () => trOption('options.showSubtitles', onOff(s.showSubtitles)), () => { s.showSubtitles = !s.showSubtitles; }));
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
      { label: () => this.game.narrator.label(), click: () => this.game.narrator.cycle() },
    ]);
    this.doneButton(this.height / 6 + 144);
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
    // GuiCustomizeSkin: rows start at height / 6, Done on the row after the last (odd counts round up)
    this.grid(items, this.height / 6);
    let i = items.length;
    if (i % 2 === 1) i++;
    this.doneButton(this.height / 6 + 24 * (i >> 1));
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
for (const binding of Object.values(KEY_BINDINGS)) binding[1] = VANILLA_UI.bindingCategories[binding[0]] || binding[1];
const compareText = (a,b) => a < b ? -1 : a > b ? 1 : 0; // Java String.compareTo, not locale collation.


// GuiControls + GuiKeyBindingList (GuiListExtended(width + 45, 63, height - 32, 20)): bindings under category
// headers, sorted like KeyBinding.compareTo; list width 252, scrollbar 15 further right
class ControlsScreen extends OptionsBase {
  constructor(game, parent) { super(game, parent, 'controls.title'); this.binding = null; }
  init() {
    const s = this.s;
    const cx = this.width / 2;
    this.buttons.push(new Button(200, cx - 155 + 160, this.height - 29, 150, 20, tr('gui.done'), () => this.done()));
    this.resetAll = new Button(201, cx - 155, this.height - 29, 150, 20, tr('controls.resetAll'), () => { s.keys = { ...DEFAULT_KEYS }; });
    this.buttons.push(this.resetAll);
    this.grid([
      { label: () => trOption('options.invertMouse', onOff(s.invertMouse)), click: () => { s.invertMouse = !s.invertMouse; } },
      { slider: true, label: (v) => trOption('options.sensitivity', v === 0 ? tr('options.sensitivity.min') : v === 1 ? tr('options.sensitivity.max') : Math.round(v * 200) + '%'), value: () => s.sensitivity, set: (v) => { s.sensitivity = v; } },
      { label: () => trOption('options.touchscreen', onOff(s.touchscreen)), click: () => { s.touchscreen = !s.touchscreen; } },
      { label: () => trOption('options.autoJump', onOff(s.autoJump)), click: () => { s.autoJump = !s.autoJump; } },
    ], 18);
    const keys = Object.keys(KEY_BINDINGS).sort((a, b) => {
      const ca=KEY_BINDINGS[a][1], cb=KEY_BINDINGS[b][1];
      const order=VANILLA_UI.categoryOrder;
      const c=order.length ? order.indexOf(ca)-order.indexOf(cb) : compareText(tr(ca),tr(cb));
      return c || compareText(tr(KEY_BINDINGS[a][0]),tr(KEY_BINDINGS[b][0]));
    });
    this.entries = [];
    let cat = null;
    for (const k of keys) {
      if (KEY_BINDINGS[k][1] !== cat) { cat = KEY_BINDINGS[k][1]; this.entries.push({ header: cat }); }
      this.entries.push({ key: k });
    }
    const gui = this.game.gui;
    this.maxLabel = Math.max(...keys.map((k) => gui.textWidth(tr(KEY_BINDINGS[k][0]))));
    const old = this.list;
    this.list = new ListOf(this, 63, this.height - 32, 20, {
      size: () => this.entries.length,
      draw: (g2, i, x, y, h, mx, my) => this._drawEntry(g2, this.entries[i], x, y, h, mx, my),
      click: (i, dbl, mx, my) => this._clickEntry(this.entries[i], mx, my),
    }, { left: 0, width: this.width + 45, listWidth: 252, scrollBarOffset: 15 });
    if (old) { this.list.amountScrolled = old.amountScrolled; this.list.clamp(); }
  }
  _drawEntry(gui, e, x, y, h, mx, my) {
    if (e.header) {
      // KeyBindingList.CategoryEntry
      const label = tr(e.header);
      gui.text(label, this.width / 2 - gui.textWidth(label) / 2, y + h - 9 - 1, 0xffffff, false);
      return;
    }
    const k = e.key, s = this.s;
    gui.text(tr(KEY_BINDINGS[k][0]), x + 90 - this.maxLabel, y + h / 2 - 9 / 2, 0xffffff, false);
    const code = s.keys[k];
    const dup = !!code && Object.keys(KEY_BINDINGS).some((o) => o !== k && s.keys[o] === code);
    let label = s.keyName(code);
    if (this.binding === k) label = '§f> §e' + label + '§f <';
    else if (dup) label = '§c' + label;
    const isDefault = code === DEFAULT_KEYS[k];
    e.kx = x + 105; e.rx = x + 190; e.y = y;
    gui.button(e.rx, y, 50, 20, tr('controls.reset'), !isDefault && mx >= e.rx && mx < e.rx + 50 && my >= y && my < y + 20, !isDefault);
    gui.button(e.kx, y, 75, 20, label, mx >= e.kx && mx < e.kx + 75 && my >= y && my < y + 20);
  }
  _clickEntry(e, mx, my) {
    if (!e || e.header || e.y === undefined || my < e.y || my >= e.y + 20) return false;
    const s = this.s;
    if (mx >= e.kx && mx < e.kx + 75) { this.binding = e.key; this.game.sound.playUi('ui.button.click', 1); return true; }
    if (mx >= e.rx && mx < e.rx + 50 && s.keys[e.key] !== DEFAULT_KEYS[e.key]) { s.keys[e.key] = DEFAULT_KEYS[e.key]; this.game.sound.playUi('ui.button.click', 1); return true; }
    return false;
  }
  render(gui, mx, my) {
    if (this.background === 'world') gui.worldBackground(); else gui.dirtBackground();
    this.list.render(gui, mx, my);
    gui.textCentered(tr(this.titleKey), this.width / 2, 8, 0xffffff);
    // GuiControls.drawScreen: "Reset Keys" only while something differs from the defaults
    this.resetAll.enabled = Object.keys(KEY_BINDINGS).some((k) => this.s.keys[k] !== DEFAULT_KEYS[k]);
    for (const b of this.buttons) b.render(gui, mx, my);
  }
  mouseDown(mx, my, button, e) {
    if (this.binding) { this.s.keys[this.binding] = 'mouse' + button; this.binding = null; return true; }
    if (this.list.mouseDown(mx, my, button, e)) return true;
    return super.mouseDown(mx, my, button, e);
  }
  mouseUp(mx, my, button) { super.mouseUp(mx, my, button); this.list.mouseUp(); }
  mouseMove(mx, my) { this.list.mouseMove(mx, my); }
  key(e) {
    if (this.binding) {
      this.s.keys[this.binding] = e.code === 'Escape' ? '' : e.code;
      this.binding = null;
      return true;
    }
    return super.key(e);
  }
  wheel(d) { this.list.wheel(d); }
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
