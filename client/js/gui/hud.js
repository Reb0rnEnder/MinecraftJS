import { debugTargets } from './debug-targets.js';
import { getStateProperties } from '../world/blocks.js';
import { getFluidState } from '../world/fluids.js';
// In-game overlay (port of GuiIngame / GuiNewChat / GuiPlayerTabOverlay / GuiOverlayDebug).
import { tr } from './i18n.js';
import { SpectatorGui } from './spectator.js';
import { getBlock } from '../world/blocks.js';
import { isPointInFluid } from '../world/fluids.js';
import { platform } from '../platform/platform.js';
import { resolveState } from '../world/blockstates.js';
import { biomeInfo } from '../world/biomes.js';
import { stripCodes } from './font.js';
import { chatToLegacy } from './chat.js';
import { FORMAT, colorParams } from '../gfx/device.js';
import { mat4 } from '../gfx/math.js';

const ICONS = 'gui/icons.png';
const WIDGETS = 'gui/widgets.png';
const performanceNow = () => platform().now();

// Java Random-ish deterministic RNG for heart jiggle
function seeded(seed) {
  let s = seed >>> 0;
  return (n) => { s = (s * 1103515245 + 12345) >>> 0; return (s >>> 16) % n; };
}

export class Hud {
  constructor(game) {
    this.game = game;
    this.chat = []; // { text, raw, tick }
    this.chatLines = []; // wrapped: { text, tick, comps }
    this.sentHistory = [];
    this.chatScroll = 0;
    this.updateCounter = 0;
    this.actionBar = null;
    this.actionBarTicks = 0;
    this.title = '';
    this.subtitle = '';
    this.titleTimer = 0;
    this.titleFadeIn = 10; this.titleStay = 70; this.titleFadeOut = 20;
    this.highlightTicks = 0;
    this.highlightItem = null;
    this.spectatorGui = new SpectatorGui(game);
    this.healthFlash = 0;
    this.lastHealth = 20;
    this.displayHealth = 20;
    this.lastHealthTime = 0;
    this.prevVignette = 1;
    this.elderGuardianTime = 0;
    this._vignetteMask = null;
    this._lastCrossScale = 0;
  }

  get gui() { return this.game.gui; }

  tick() {
    this.updateCounter++;
    if (this.actionBarTicks > 0) this.actionBarTicks--;
    if (this.titleTimer > 0) { this.titleTimer--; if (this.titleTimer <= 0) { this.title = ''; this.subtitle = ''; } }
    if (this.elderGuardianTime > 0) this.elderGuardianTime--;
    const g = this.game;
    const held = g.inventory ? g.inventory.held() : null;
    const key = held ? held.id + ':' + held.damage + ':' + g.items.displayName(held) : null;
    if (key !== this._lastHeldKey) {
      this._lastHeldKey = key;
      if (held) { this.highlightTicks = 40; this.highlightItem = held; } else this.highlightTicks = 0;
    } else if (this.highlightTicks > 0) this.highlightTicks--;
  }

  // ---------------------------------------------------------------- Chat

  addChat(text, raw, local = false) {
    const g = this.game;
    console.log('[chat]', stripCodes(text));
    const entry = { text, raw, tick: this.updateCounter };
    this.chat.unshift(entry);
    if (this.chat.length > 100) this.chat.pop();
    const width = this.chatWidth();
    const lines = g.gui.font.wrap(text, Math.floor(width / this.chatScale()));
    const comps = raw ? extractComponents(raw) : null;
    // GuiNewChat.setChatLine: each wrapped line is pushed to the front in order, so the message's last
    // line ends up at the bottom and its first line above it
    for (let i = 0; i < lines.length; i++) {
      this.chatLines.unshift({ text: lines[i], tick: this.updateCounter, comps, first: i === 0 });
    }
    while (this.chatLines.length > 100) this.chatLines.pop();
    if (this.chatScroll > 0) this.chatScroll += lines.length;
    void local;
  }

  chatScale() { return this.game.settings.chatScale || 1; }
  chatWidth() { return Math.floor((this.game.settings.chatWidth || 1) * 280 + 40); }
  chatOpen() { return this.game.screens.current && this.game.screens.current.constructor.name === 'ChatScreen'; }
  // GuiNewChat.getChatHeight / getLineCount: height = f * 160 + 20 pixels, 9 pixels per line
  chatLinesVisible() {
    const s = this.game.settings;
    const f = this.chatOpen() ? (s.chatHeightFocused ?? 1) : (s.chatHeightUnfocused ?? 0.44366196);
    return Math.floor(Math.floor(f * 160 + 20) / 9);
  }

  scrollChat(n) {
    this.chatScroll += n;
    const max = Math.max(0, this.chatLines.length - this.chatLinesVisible());
    if (this.chatScroll > max) this.chatScroll = max;
    if (this.chatScroll < 0) this.chatScroll = 0;
  }

  setActionBar(text) { this.actionBar = text; this.actionBarTicks = 60; }

  // F3+D (GuiNewChat.clearChatMessages)
  clearChat() {
    this.chat = [];
    this.chatLines = [];
    this.chatScroll = 0;
  }

  // Forget everything that belongs to the server we left (chat history stays, like vanilla)
  resetServerState() {
    this.actionBar = null; this.actionBarTicks = 0;
    this.title = ''; this.subtitle = ''; this.titleTimer = 0;
    this.titleFadeIn = 10; this.titleStay = 70; this.titleFadeOut = 20;
    this.highlightTicks = 0; this.highlightItem = null;
    if (this.spectatorGui) this.spectatorGui.onMenuClosed();
    this.toasts = []; this.toastQueue = [];
    this.bossBars = new Map();
  }

  // SPacketTitle: 0 title, 1 subtitle, 2 action bar, 3 times, 4 hide, 5 reset
  onTitle(p) {
    switch (p.action) {
      case 0: this.title = chatText(p.text); this.titleTimer = this.titleFadeIn + this.titleStay + this.titleFadeOut; break;
      case 1: this.subtitle = chatText(p.text); break;
      case 2: this.setActionBar(chatText(p.text)); break;
      case 3: this.titleFadeIn = p.fadeIn; this.titleStay = p.stay; this.titleFadeOut = p.fadeOut; break;
      case 4: this.title = ''; this.subtitle = ''; this.titleTimer = 0; break;
      case 5: this.title = ''; this.subtitle = ''; this.titleTimer = 0; this.titleFadeIn = 10; this.titleStay = 70; this.titleFadeOut = 20; break;
      default: break;
    }
  }

  // GuiToast (1.12): up to 5 toasts at the top right, sliding in and out over 600 ms
  addToast(toast) {
    this.toasts = this.toasts || [];
    this.toastQueue = this.toastQueue || [];
    this.toastQueue.push(toast);
  }

  renderToast(gui) {
    const toasts = this.toasts || (this.toasts = []);
    const queue = this.toastQueue || (this.toastQueue = []);
    const now = platform().now();
    for (let slot = 0; slot < 5; slot++) if (!toasts[slot] && queue.length) toasts[slot] = { toast: queue.shift(), animationTime: -1, visibleTime: -1, visibility: 'show' };
    for (let slot = 0; slot < toasts.length; slot++) {
      const t = toasts[slot];
      if (!t) continue;
      if (t.animationTime < 0) { t.animationTime = now; this.game.sound.playUi('ui.toast.in'); }
      if (t.visibility === 'show' && now - t.animationTime <= 600) t.visibleTime = now;
      const vis = () => { let f = Math.max(0, Math.min(1, (now - t.animationTime) / 600)); f *= f; return t.visibility === 'hide' ? 1 - f : f; };
      gui.pushMatrix();
      gui.translate(gui.width - 160 * vis(), slot * 32, 500 + slot);
      const v = this._drawToast(gui, t.toast, now - t.visibleTime);
      gui.popMatrix();
      if (v !== t.visibility) {
        t.animationTime = now - Math.floor((1 - vis()) * 600);
        t.visibility = v;
        this.game.sound.playUi(v === 'show' ? 'ui.toast.in' : 'ui.toast.out');
      }
      if (t.visibility === 'hide' && now - t.animationTime > 600) toasts[slot] = null;
    }
  }

  // RecipeToast.addOrUpdate: new recipes join a recipe toast that is still showing
  addRecipeToast(recipes) {
    const all = [...(this.toasts || []).filter(Boolean).map((t) => t.toast), ...(this.toastQueue || [])];
    const t = all.find((x) => x.type === 'recipe');
    if (t) { t.recipes.push(...recipes); t.hasNew = true; } else this.addToast({ type: 'recipe', recipes: [...recipes], hasNew: true });
  }

  // SystemToast.addOrUpdate: one toast per kind ('narrator', 'tutorial'); a showing one takes the new text
  systemToast(kind, title, subtitle) {
    const all = [...(this.toasts || []).filter(Boolean).map((t) => t.toast), ...(this.toastQueue || [])];
    const t = all.find((x) => x.type === 'system' && x.kind === kind);
    if (t) { t.title = title; t.subtitle = subtitle; t.hasNew = true; } else this.addToast({ type: 'system', kind, title, subtitle, hasNew: true });
  }

  // SystemToast.draw: yellow title (and white subtitle) for 5 seconds from the last update
  _drawSystemToast(gui, toast, delta) {
    if (toast.hasNew) { toast.firstDraw = delta; toast.hasNew = false; }
    gui.blit('gui/toasts.png', 0, 0, 0, 64, 160, 32);
    if (toast.subtitle == null) gui.text(toast.title, 18, 12, 0xffff00, false);
    else { gui.text(toast.title, 18, 7, 0xffff00, false); gui.text(toast.subtitle, 18, 18, 0xffffff, false); }
    return delta - (toast.firstDraw || 0) < 5000 ? 'show' : 'hide';
  }

  // RecipeToast.draw: crafting table icon behind the recipe outputs, cycling through them
  _drawRecipeToast(gui, toast, delta) {
    if (toast.hasNew) { toast.firstDraw = delta; toast.hasNew = false; }
    gui.blit('gui/toasts.png', 0, 0, 0, 32, 160, 32);
    gui.text(tr('recipe.toast.title'), 30, 7, 0x500050, false);
    gui.text(tr('recipe.toast.description'), 30, 18, 0x000000, false);
    const r = toast.recipes[Math.floor(delta / (5000 / toast.recipes.length)) % toast.recipes.length];
    gui.pushMatrix(); gui.scaleBy(0.6, 0.6); this.game.itemRenderer.drawItem(gui, { id: 58, damage: 0, count: 1 }, 3, 3, false); gui.popMatrix();
    this.game.itemRenderer.drawItem(gui, { id: r.result.id, damage: r.result.data === 32767 ? 0 : r.result.data, count: 1 }, 8, 8, false);
    return delta - (toast.firstDraw || 0) >= 5000 ? 'hide' : 'show';
  }

  // AdvancementToast.draw: frame label then title, the item icon; challenges play their sound
  _drawToast(gui, toast, delta) {
    if (toast.type === 'recipe') return this._drawRecipeToast(gui, toast, delta);
    if (toast.type === 'system') return this._drawSystemToast(gui, toast, delta);
    if (toast.type === 'tutorial') return toast.draw(gui, delta);
    gui.blit('gui/toasts.png', 0, 0, 0, 0, 160, 32);
    const d = toast.advancement.display;
    const list = gui.font.wrap(d.title, 125);
    const color = d.frame === 1 ? 0xff88ff : 0xffff00;
    const label = tr('advancements.toast.' + ['task', 'challenge', 'goal'][d.frame || 0]);
    if (list.length === 1) {
      gui.text(label, 30, 7, color, false);
      gui.text(list[0], 30, 18, 0xffffff, false);
    } else if (delta < 1500) {
      const a = Math.floor(Math.max(0, Math.min(1, (1500 - delta) / 300)) * 255);
      gui.setAlpha(a / 255); gui.text(label, 30, 11, color, false); gui.resetColor();
    } else {
      const a = Math.floor(Math.max(0, Math.min(1, (delta - 1500) / 300)) * 252);
      let y = 16 - list.length * 9 / 2;
      gui.setAlpha(a / 255);
      for (const line of list) { gui.text(line, 30, y, 0xffffff, false); y += 9; }
      gui.resetColor();
    }
    if (!toast.played && delta > 0) { toast.played = true; if (d.frame === 1) this.game.sound.play('ui.toast.challenge_complete', 0, 0, 0, 1, 1, { global: true, category: 'record' }); }
    if (d.icon) this.game.itemRenderer.drawItem(gui, d.icon, 8, 8, false);
    return delta >= 5000 ? 'hide' : 'show';
  }

  // Returns the chat component under the mouse (when chat is open)
  chatComponentAt(mx, my) {
    if (!this.chatOpen()) return null;
    const gui = this.gui;
    const scale = this.chatScale();
    const baseY = gui.height - 28;
    const x = (mx - 2) / scale;
    const y = (baseY - my) / scale;
    if (x < 0 || y < 0) return null;
    const idx = Math.floor(y / 9) + this.chatScroll;
    if (idx >= this.chatLines.length || Math.floor(y / 9) >= this.chatLinesVisible()) return null;
    const line = this.chatLines[idx];
    if (!line.comps) return null;
    // Find which component the x position lands on (only exact for single-line messages)
    let cx = 0;
    for (const c of line.comps) {
      const w = gui.font.width(c.text);
      if (x >= cx && x < cx + w) return c;
      cx += w;
    }
    return null;
  }

  renderChat(gui) {
    const g = this.game;
    if (g.settings.chatVisibility === 2) return;
    const open = this.chatOpen();
    const lines = this.chatLinesVisible();
    const opacity = (g.settings.chatOpacity ?? 1) * 0.9 + 0.1;
    const scale = this.chatScale();
    const w = Math.ceil(this.chatWidth() / scale);
    gui.pushMatrix();
    gui.translate(2, gui.height - 28);
    gui.scaleBy(scale, scale);
    let drawn = 0;
    for (let i = 0; i + this.chatScroll < this.chatLines.length && i < lines; i++) {
      const line = this.chatLines[i + this.chatScroll];
      const age = this.updateCounter - line.tick;
      if (age >= 200 && !open) continue;
      let d = age / 200;
      d = 1 - d; d *= 10; d = Math.min(1, Math.max(0, d)); d *= d;
      let a = open ? 255 : Math.floor(255 * d);
      a = Math.floor(a * opacity);
      if (a <= 3) continue;
      const y = -i * 9;
      gui.rect(0, y - 9, w + 4, y, (Math.floor(a / 2) << 24) >>> 0);
      gui.font.draw(line.text, 0, y - 8, 0xffffff, true, a / 255);
      drawn++;
    }
    if (open && this.chatLines.length > lines) {
      const total = this.chatLines.length;
      const h = lines * 9;
      const barH = h * h / (total * 9);
      const barY = (this.chatScroll * h / total);
      const alpha = this.chatScroll > 0 ? 0xaa : 0x60;
      const color = this.chatScroll > 0 ? 0x3333aa : 0x333333;
      gui.rect(0, -barY, 2, -barY - barH, ((alpha << 24) | color) >>> 0);
      gui.rect(2, -barY, 1, -barY - barH, ((alpha << 24) | 0xcccccc) >>> 0);
    }
    gui.popMatrix();
    void drawn;
  }

  // ---------------------------------------------------------------- Main render

  render(gui, partial, env) {
    const g = this.game;
    const W = gui.width, H = gui.height;
    const survival = g.gameMode === 0 || g.gameMode === 2;

    // First person overlays (rendered before GUI in vanilla)
    if (g.thirdPerson === 0 && !g.hideGui) {
      if (env.underwater) this.renderUnderwater(gui, partial);
      if (this._isBurning() && !g.player.creative) this.renderFire(gui);
    }
    if (g.hideGui) return;

    if (g.settings.fancyGraphics) this.renderVignette(gui);
    const helmet = g.inventory.armor[3];
    if (g.thirdPerson === 0 && helmet && helmet.id === 86) {
      const t = gui.tex('misc/pumpkinblur.png');
      if (t) gui.quad(t, 0, 0, W, H, 0, 0, 1, 1, [1, 1, 1, 1]);
    }
    if (env.portal > 0 && !g.effects.has(9)) this.renderPortalOverlay(gui, env.portal);

    if (g.gameMode === 3) this.spectatorGui.render(gui); // GuiSpectator.renderTooltip (nothing until the menu opens)
    else this.renderHotbar(gui, partial);

    const debugAxes = g.showDebug && !g.reducedDebug && !g.settings.reducedDebugInfo;
    const showCross = g.thirdPerson === 0 && !g.screens.current && !(g.gameMode === 3 && !g.interaction.target);
    if (showCross && debugAxes) this._debugAxes(gui, partial);
    else this._crosshair(showCross);

    this.renderBossBar(gui);
    if (survival) this.renderStats(gui);
    if (g.sleeping) {
      gui.rect(0, 0, W, H, 0xb0101020);
    }
    if (survival) this.renderXp(gui);
    else if (g.gameMode === 1) { /* no xp bar in creative */ }

    // Held item name
    if (g.gameMode === 3) this.spectatorGui.renderSelectedItem(gui);
    else if (this.highlightTicks > 0 && this.highlightItem) {
      let a = Math.floor(this.highlightTicks * 256 / 10);
      if (a > 255) a = 255;
      if (a > 0) {
        const name = g.items.displayName(this.highlightItem);
        const color = g.items.isEnchanted(this.highlightItem) ? '§b' : '';
        let y = H - 59;
        if (!survival) y += 14;
        gui.font.draw(color + name, (W - gui.textWidth(name)) / 2, y, 0xffffff, true, a / 255);
      }
    }

    if (g.showDebug) this.renderDebug(gui);

    // Action bar
    if (this.actionBarTicks > 0 && this.actionBar) {
      const f = this.actionBarTicks - partial;
      let a = Math.floor(f * 255 / 20);
      if (a > 255) a = 255;
      if (a > 8) gui.font.draw(this.actionBar, W / 2 - gui.textWidth(this.actionBar) / 2, H - 68 - 4, 0xffffff, true, a / 255);
    }
    // Title
    if (this.titleTimer > 0) {
      const f = this.titleTimer - partial;
      let a = 255;
      if (this.titleTimer > this.titleFadeOut + this.titleStay) a = (this.titleFadeIn + this.titleStay + this.titleFadeOut - f) * 255 / this.titleFadeIn;
      if (this.titleTimer <= this.titleFadeOut) a = f * 255 / this.titleFadeOut;
      a = Math.min(255, Math.max(0, a));
      if (a > 8) {
        gui.pushMatrix();
        gui.translate(W / 2, H / 2);
        gui.pushMatrix();
        gui.scaleBy(4, 4);
        gui.font.draw(this.title, -gui.textWidth(this.title) / 2, -10, 0xffffff, true, a / 255);
        gui.popMatrix();
        gui.scaleBy(2, 2);
        gui.font.draw(this.subtitle, -gui.textWidth(this.subtitle) / 2, 5, 0xffffff, true, a / 255);
        gui.popMatrix();
      }
    }
    this.renderSubtitles(gui);
    this.renderSidebar(gui);
    this.renderChat(gui);
    if (g.input.isDown('playerlist') && !g.screens.current && (!g.scoreboard.singlePlayer)) this.renderTabList(gui);
    else if (g.input.isDown('playerlist') && !g.screens.current) this.renderTabList(gui);
  }

  _isBurning() {
    const m = this.game.selfMetadata;
    return m && (m[0] & 1) === 1;
  }

  // Crosshair, drawn with vanilla's inverting blend (ONE_MINUS_DST_COLOR, ONE_MINUS_SRC_COLOR)
  // GuiIngame.renderAttackIndicator with the debug screen open (1.12): instead of the crosshair, 10 pixel X / Y / Z
  // axes at the screen centre turned with the camera (rotate pitch about -X, yaw about Y, scale -1), drawn as
  // OpenGlHelper.renderDirections does: 4 pixel black lines, then 2 pixel red / green / light blue ones
  _debugAxes(gui, partial) {
    const g = this.game, pl = g.player;
    const S = gui.scale;
    if (!this._axesMesh || this._axesScale !== S) {
      if (this._axesMesh) g.device.destroyMesh(this._axesMesh);
      const v = [];
      const box = (axis, h, r, gg, b) => {
        const lo = [-h, -h, -h], hi = [h, h, h];
        hi[axis] = 10;
        lo[axis] = 0;
        const P = (x, y, z) => v.push(x ? hi[0] : lo[0], y ? hi[1] : lo[1], z ? hi[2] : lo[2], 0, 0, r, gg, b, 1);
        // six faces of the bar
        for (const [a, b2, c, d] of [[[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], [[0, 0, 1], [0, 1, 1], [1, 1, 1], [1, 0, 1]], [[0, 0, 0], [0, 1, 0], [0, 1, 1], [0, 0, 1]],
          [[1, 0, 0], [1, 0, 1], [1, 1, 1], [1, 1, 0]], [[0, 0, 0], [0, 0, 1], [1, 0, 1], [1, 0, 0]], [[0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]]]) {
          P(...a); P(...b2); P(...c); P(...d);
        }
      };
      for (let axis = 0; axis < 3; axis++) box(axis, 2 / S, 0, 0, 0);
      box(0, 1 / S, 1, 0, 0); box(1, 1 / S, 0, 1, 0); box(2, 1 / S, 127 / 255, 127 / 255, 1);
      this._axesMesh = g.device.createMesh(FORMAT.color, new Float32Array(v), { quads: true });
      this._axesScale = S;
    }
    const pitch = (pl.prevPitch + (pl.pitch - pl.prevPitch) * partial) * Math.PI / 180;
    const yaw = (pl.prevYaw + (pl.yaw - pl.prevYaw) * partial) * Math.PI / 180;
    const m = mat4.create();
    mat4.translate(m, m, Math.floor(gui.width / 2), Math.floor(gui.height / 2), 0);
    mat4.rotateX(m, m, -pitch);
    mat4.rotateY(m, m, yaw);
    mat4.scale(m, m, -1, -1, -1);
    this._axesParams ||= colorParams(1, 1, 1, 1);
    gui.drawMesh({ mesh: this._axesMesh, pipeline: 'color', textures: [gui.white], params: this._axesParams, state: { blend: 'none', depthTest: false, depthWrite: false, cull: false } }, m);
  }

  _crosshair(show) {
    if (!show) return;
    const gui = this.gui;
    gui.setBlend('invert');
    gui.blit(ICONS, Math.floor(gui.width / 2 - 7), Math.floor(gui.height / 2 - 7), 0, 0, 16, 16);
    // attack indicator (attackIndicator 1 = crosshair): ready-to-hit mark on a living target, else the charging bar
    const g = this.game, it = g.interaction;
    if (g.settings.attackIndicator === 1 && it) {
      const f = it.cooledAttackStrength(0);
      const t = it.target;
      const living = t && t.type === 'entity' && (t.entity.kind === 'mob' || t.entity.kind === 'player' || t.entity.kind === 'armorstand') && !t.entity.dead;
      const ready = living && f >= 1 && it.cooldownPeriod() > 5;
      const y = Math.floor(gui.height / 2) - 7 + 16, x = Math.floor(gui.width / 2) - 8;
      if (ready) gui.blit(ICONS, x, y, 68, 94, 16, 16);
      else if (f < 1) { gui.blit(ICONS, x, y, 36, 94, 16, 4); gui.blit(ICONS, x, y, 52, 94, Math.floor(f * 17), 4); }
    }
    gui.setBlend('alpha');
  }

  renderHotbar(gui, partial) {
    const g = this.game;
    const W = gui.width, H = gui.height;
    gui.blit(WIDGETS, W / 2 - 91, H - 22, 0, 0, 182, 22);
    gui.blit(WIDGETS, W / 2 - 91 - 1 + g.heldSlot * 20, H - 22 - 1, 0, 22, 24, 22);
    // off hand slot on the side away from the main hand
    const off = g.inventory.offhand;
    const offLeft = g.settings.mainHand !== 'left';
    if (off) {
      if (offLeft) gui.blit(WIDGETS, W / 2 - 91 - 29, H - 23, 24, 22, 29, 24);
      else gui.blit(WIDGETS, W / 2 + 91, H - 23, 53, 22, 29, 24);
    }
    for (let i = 0; i < 9; i++) {
      const it = g.inventory.main[i];
      if (!it) continue;
      const x = W / 2 - 90 + i * 20 + 2, y = H - 16 - 3;
      g.itemRenderer.drawItem(gui, it, x, y, true, it.popTime ? it.popTime - partial : 0);
    }
    if (off) g.itemRenderer.drawItem(gui, off, offLeft ? W / 2 - 91 - 26 : W / 2 + 91 + 10, H - 16 - 3, true, off.popTime ? off.popTime - partial : 0);
    // attackIndicator 2 = hotbar: a filling sword icon beside the hotbar while the attack charges
    const it = g.interaction;
    if (g.settings.attackIndicator === 2 && it) {
      const f = it.cooledAttackStrength(0);
      if (f < 1) {
        const y = H - 20, x = offLeft ? W / 2 + 91 + 6 : W / 2 - 91 - 22;
        const k = Math.floor(f * 19);
        gui.blit(ICONS, x, y, 0, 94, 18, 18);
        gui.blit(ICONS, x, y + 18 - k, 18, 112 - k, 18, k);
      }
    }
  }


  renderStats(gui) {
    const g = this.game;
    const W = gui.width, H = gui.height;
    const health = Math.ceil(g.health);
    const flash = this.healthFlash > this.updateCounter + 0 && Math.floor((this.healthFlash - this.updateCounter) / 3) % 2 === 1;
    const now = platform().now();
    if (health !== this.displayHealth) {
      if (health < this.displayHealth) this.lastHealthTime = now;
      this.displayHealth = health;
    }
    if (now - this.lastHealthTime > 1000) this.lastHealth = health;
    const lastHealth = this.lastHealth;
    const rnd = seeded(this.updateCounter * 312871);
    const left = W / 2 - 91, right = W / 2 + 91;
    const top = H - 39;
    const maxHealth = g.maxHealth || 20;
    const absorption = (g.selfMetadata && g.selfMetadata[17]) || 0;
    const rows = Math.ceil((maxHealth + absorption) / 2 / 10);
    const rowH = Math.max(10 - (rows - 2), 3);
    const armorY = top - (rows - 1) * rowH - 10;
    const armor = g.inventory.armorPoints();
    for (let i = 0; i < 10; i++) {
      if (armor <= 0) break;
      const x = left + i * 8;
      if (i * 2 + 1 < armor) gui.blit(ICONS, x, armorY, 34, 9, 9, 9);
      if (i * 2 + 1 === armor) gui.blit(ICONS, x, armorY, 25, 9, 9, 9);
      if (i * 2 + 1 > armor) gui.blit(ICONS, x, armorY, 16, 9, 9, 9);
    }
    const regen = g.effects.has(10) ? this.updateCounter % Math.ceil(maxHealth + 5) : -1;
    let absLeft = absorption;
    const hardcore = g.hardcore ? 5 : 0;
    for (let i = Math.ceil((maxHealth + absorption) / 2) - 1; i >= 0; i--) {
      let u = 16;
      if (g.effects.has(19)) u += 36; else if (g.effects.has(20)) u += 72;
      const b0 = flash ? 1 : 0;
      const row = Math.ceil((i + 1) / 10) - 1;
      const x = left + (i % 10) * 8;
      let y = top - row * rowH;
      if (health <= 4) y += rnd(2);
      if (i === regen) y -= 2;
      gui.blit(ICONS, x, y, 16 + b0 * 9, 9 * hardcore, 9, 9);
      if (flash) {
        if (i * 2 + 1 < lastHealth) gui.blit(ICONS, x, y, u + 54, 9 * hardcore, 9, 9);
        if (i * 2 + 1 === lastHealth) gui.blit(ICONS, x, y, u + 63, 9 * hardcore, 9, 9);
      }
      if (absLeft > 0) {
        if (absLeft === absorption && absorption % 2 === 1) gui.blit(ICONS, x, y, u + 153, 9 * hardcore, 9, 9);
        else gui.blit(ICONS, x, y, u + 144, 9 * hardcore, 9, 9);
        absLeft -= 2;
      } else {
        if (i * 2 + 1 < health) gui.blit(ICONS, x, y, u + 36, 9 * hardcore, 9, 9);
        if (i * 2 + 1 === health) gui.blit(ICONS, x, y, u + 45, 9 * hardcore, 9, 9);
      }
    }
    const riding = g.player.ridingEntity && g.entities.isLiving && g.entities.isLiving(g.ridingEntityId);
    if (!riding) {
      const food = g.food;
      for (let i = 0; i < 10; i++) {
        let y = top;
        let u = 16, b4 = 0;
        if (g.effects.has(17)) { u += 36; b4 = 13; }
        if (g.saturation <= 0 && this.updateCounter % (food * 3 + 1) === 0) y = top + (rnd(3) - 1);
        const x = right - i * 8 - 9;
        gui.blit(ICONS, x, y, 16 + b4 * 9, 27, 9, 9);
        if (i * 2 + 1 < food) gui.blit(ICONS, x, y, u + 36, 27, 9, 9);
        if (i * 2 + 1 === food) gui.blit(ICONS, x, y, u + 45, 27, 9, 9);
      }
    } else {
      // Mount health
      const v = g.entities.get(g.ridingEntityId);
      if (v && v.maxHealth) {
        const hp = Math.ceil(v.health || 0);
        const hearts = Math.min(30, Math.floor((v.maxHealth + 0.5) / 2));
        let y = top;
        for (let base = 0; base < hearts; base += 10) {
          for (let i = 0; i < Math.min(10, hearts - base); i++) {
            const x = right - i * 8 - 9;
            gui.blit(ICONS, x, y, 52, 9, 9, 9);
            const idx = (i + base) * 2 + 1;
            if (idx < hp) gui.blit(ICONS, x, y, 88, 9, 9, 9);
            if (idx === hp) gui.blit(ICONS, x, y, 97, 9, 9, 9);
          }
          y -= 10;
        }
      }
    }
    // Air
    const eye = g.eyePosition();
    const air = g.selfMetadata && g.selfMetadata[1] !== undefined ? g.selfMetadata[1] : 300;
    // Vanilla keeps the bubbles visible while a partially depleted air meter
    // refills after surfacing; checking only eye-in-water hid that recovery.
    if (air < 300 || isPointInFluid(g.world, eye[0], eye[1], eye[2])) {
      const full = Math.ceil((air - 2) * 10 / 300);
      const pop = Math.ceil(air * 10 / 300) - full;
      for (let i = 0; i < full + pop; i++) {
        gui.blit(ICONS, right - i * 8 - 9, top - 10, i < full ? 16 : 25, 18, 9, 9);
      }
    }
  }

  renderXp(gui) {
    const g = this.game;
    const W = gui.width, H = gui.height;
    const x = W / 2 - 91;
    const v = g.entities.get && g.ridingEntityId >= 0 ? g.entities.get(g.ridingEntityId) : null;
    if (v && v.kind === 'mob' && v.type === 100 && g.horseJump !== undefined) {
      const fill = Math.floor(g.horseJump * 183);
      const y = H - 32 + 3;
      gui.blit(ICONS, x, y, 0, 84, 182, 5);
      if (fill > 0) gui.blit(ICONS, x, y, 0, 89, fill, 5);
      return;
    }
    const fill = Math.floor(g.xpBar * 183);
    const y = H - 32 + 3;
    gui.blit(ICONS, x, y, 0, 64, 182, 5);
    if (fill > 0) gui.blit(ICONS, x, y, 0, 69, fill, 5);
    if (g.xpLevel > 0) {
      const s = '' + g.xpLevel;
      const lx = (W - gui.textWidth(s)) / 2, ly = H - 31 - 4;
      gui.text(s, lx + 1, ly, 0, false);
      gui.text(s, lx - 1, ly, 0, false);
      gui.text(s, lx, ly + 1, 0, false);
      gui.text(s, lx, ly - 1, 0, false);
      gui.text(s, lx, ly, 8453920, false);
    }
  }

  // SPacketUpdateBossInfo (BossInfoClient): 0 add, 1 remove, 2 health, 3 title, 4 style, 5 flags
  onBossBar(p) {
    const bars = this.bossBars || (this.bossBars = new Map());
    if (p.action === 1) { bars.delete(p.uuid); return; }
    let b = bars.get(p.uuid);
    if (p.action === 0) {
      b = { name: chatText(p.title), raw: p.health, percent: p.health, setTime: performanceNow(), color: p.color, overlay: p.dividers, flags: p.flags };
      bars.set(p.uuid, b);
      return;
    }
    if (!b) return;
    if (p.action === 2) { b.raw = this._bossPercent(b); b.percent = p.health; b.setTime = performanceNow(); }
    else if (p.action === 3) b.name = chatText(p.title);
    else if (p.action === 4) { b.color = p.color; b.overlay = p.dividers; }
    else if (p.action === 5) b.flags = p.flags;
  }

  // BossInfoClient.getPercent: eases to the new value over 100 ms
  _bossPercent(b) {
    const f = Math.max(0, Math.min(1, (performanceNow() - b.setTime) / 100));
    return b.raw + (b.percent - b.raw) * f;
  }

  // GuiBossOverlay.shouldPlayEndBossMusic / shouldDarkenSky / shouldCreateFog
  bossFlag(bit) {
    for (const b of (this.bossBars || new Map()).values()) if (b.flags & bit) return true;
    return false;
  }

  // GuiBossOverlay.renderBossHealth: gui/bars.png, colour rows of 10 px (+5 filled), notch overlays from y 80
  // GuiSubtitleOverlay.soundPlay: one line per subtitle text, refreshed (time + position) when it plays again
  addSubtitle(text, x, y, z) {
    if (!this.subtitles) this.subtitles = [];
    const now = platform().now();
    const cur = this.subtitles.find((t) => t.text === text);
    if (cur) { cur.start = now; cur.pos = [x, y, z]; return; }
    this.subtitles.push({ text, start: now, pos: [x, y, z] });
  }

  // GuiSubtitleOverlay.renderSubtitles: bottom right, fading over 3 s, arrows towards sounds to the side
  renderSubtitles(gui) {
    const g = this.game;
    if (!g.settings.showSubtitles || !this.subtitles || !this.subtitles.length) return;
    const now = platform().now();
    this.subtitles = this.subtitles.filter((t) => t.start + 3000 > now);
    if (!this.subtitles.length) return;
    const pl = g.player;
    const eye = [pl.x, pl.y + pl.eyeHeight(), pl.z];
    const rp = -pl.pitch * Math.PI / 180, ry = -pl.yaw * Math.PI / 180;
    // Vec3d.rotatePitch then rotateYaw
    const rot = (v) => {
      let [x, y, z] = v;
      const cp = Math.cos(rp), sp = Math.sin(rp);
      [y, z] = [y * cp + z * sp, z * cp - y * sp];
      const cy = Math.cos(ry), sy = Math.sin(ry);
      [x, z] = [x * cy + z * sy, z * cy - x * sy];
      return [x, y, z];
    };
    const look = rot([0, 0, -1]), up = rot([0, 1, 0]);
    const side = [look[1] * up[2] - look[2] * up[1], look[2] * up[0] - look[0] * up[2], look[0] * up[1] - look[1] * up[0]];
    let j = 0;
    for (const t of this.subtitles) j = Math.max(j, gui.textWidth(t.text));
    j += gui.textWidth('<') + gui.textWidth(' ') + gui.textWidth('>') + gui.textWidth(' ');
    const l = Math.floor(j / 2), j1 = 4;
    this.subtitles.forEach((t, i) => {
      let d = [t.pos[0] - eye[0], t.pos[1] - eye[1], t.pos[2] - eye[2]];
      const len = Math.hypot(d[0], d[1], d[2]);
      d = len < 1e-4 ? [0, 0, 0] : d.map((v) => v / len);
      const d0 = -(side[0] * d[0] + side[1] * d[1] + side[2] * d[2]);
      const d1 = -(look[0] * d[0] + look[1] * d[1] + look[2] * d[2]);
      const f = Math.min(1, Math.max(0, (now - t.start) / 3000));
      const c = Math.floor(255 + (75 - 255) * f);
      const col = (c << 16) | (c << 8) | c;
      gui.pushMatrix();
      gui.translate(this.game.gui.width - l - 2, this.game.gui.height - 30 - i * 10);
      gui.rect(-l - 1, -j1 - 1, l + 1, j1 + 1, 0xcc000000);
      if (!(d1 > 0.5)) {
        if (d0 > 0) gui.text('>', l - gui.textWidth('>'), -j1, col, false);
        else if (d0 < 0) gui.text('<', -l, -j1, col, false);
      }
      gui.text(t.text, -Math.floor(gui.textWidth(t.text) / 2), -j1, col, false);
      gui.popMatrix();
    });
  }

  renderBossBar(gui) {
    if (!this.bossBars || !this.bossBars.size) return;
    const W = gui.width;
    let y = 12;
    const BARS = 'gui/bars.png';
    for (const b of this.bossBars.values()) {
      const x = Math.floor(W / 2) - 91;
      gui.blit(BARS, x, y, 0, b.color * 10, 182, 5);
      if (b.overlay > 0) gui.blit(BARS, x, y, 0, 80 + (b.overlay - 1) * 10, 182, 5);
      const fill = Math.floor(this._bossPercent(b) * 183);
      if (fill > 0) {
        gui.blit(BARS, x, y, 0, b.color * 10 + 5, fill, 5);
        if (b.overlay > 0) gui.blit(BARS, x, y, 0, 80 + (b.overlay - 1) * 10 + 5, fill, 5);
      }
      gui.text(b.name, Math.floor(W / 2) - Math.floor(gui.textWidth(b.name) / 2), y - 9, 0xffffff, true);
      y += 10 + 9;
      if (y >= gui.height / 3) break;
    }
  }

  renderVignette(gui) {
    const g = this.game;
    const eye = g.eyePosition();
    const sky = g.world.getSkyLight(Math.floor(eye[0]), Math.floor(eye[1]), Math.floor(eye[2]));
    const blk = g.world.getBlockLight(Math.floor(eye[0]), Math.floor(eye[1]), Math.floor(eye[2]));
    // EntityPlayer.getBrightness ~ lightmap brightness table value
    const lvl = Math.max(sky - this._skySubtract(), blk);
    const f1 = 1 - lvl / 15;
    let f = 1 - (1 - f1) * (1 - f1) * 0.5;
    f = Math.min(1, Math.max(0, f));
    let target = f;
    // World border warning tint
    const wb = g.worldBorder;
    let red = 0;
    if (wb && wb.radius < 29999984) {
      const d = Math.min(Math.abs(g.player.x - wb.x), Math.abs(g.player.z - wb.z));
      const dist = wb.radius - Math.max(Math.abs(g.player.x - wb.x), Math.abs(g.player.z - wb.z));
      void d;
      if (dist < wb.warningBlocks) red = 1 - dist / wb.warningBlocks;
    }
    this.prevVignette += (target - this.prevVignette) * 0.01;
    // GuiIngame.renderVignette: blend (ZERO, ONE_MINUS_SRC_COLOR); world border warning tints it (0, f, f)
    const t = gui.tex('misc/vignette.png');
    if (!t) return;
    const v = Math.min(1, Math.max(0, this.prevVignette));
    const c = red > 0 ? [0, red, red, 1] : [v, v, v, 1];
    gui.setBlend('darken');
    gui.quad(t, 0, 0, gui.width, gui.height, 0, 0, 1, 1, c);
    gui.setBlend('alpha');
  }

  _skySubtract() {
    const g = this.game;
    // Approximate World.skylightSubtracted from time of day
    const t = ((g.world.timeOfDay % 24000) + 24000) % 24000;
    const angle = ((t / 24000 - 0.25) + 1) % 1;
    let f1 = 1 - (Math.cos(angle * Math.PI * 2) * 2 + 0.5);
    f1 = Math.min(1, Math.max(0, f1));
    f1 = 1 - f1;
    f1 *= 1 - g.world.rainStrength * 5 / 16;
    return Math.floor((1 - f1) * 11);
  }

  renderPortalOverlay(gui, f) {
    if (f < 1) { f *= f; f *= f; f = f * 0.8 + 0.2; }
    const A = this.game.assets;
    const e = A.atlas.entries.get('block/nether_portal');
    if (!e) return;
    gui.quad(A.atlasTexture, 0, 0, gui.width, gui.height, e.uv[0], e.uv[1], e.uv[2], e.uv[3], [1, 1, 1, f]);
  }

  // ItemRenderer.renderWaterOverlayTexture
  renderUnderwater(gui, partial) {
    const t = gui.tex('misc/underwater.png') && this.game.assets.texture('misc/underwater.png', { wrap: 'repeat' });
    if (!t) return;
    const g = this.game;
    const eye = g.eyePosition(partial);
    const sky = g.world.getSkyLight(Math.floor(eye[0]), Math.floor(eye[1]), Math.floor(eye[2]));
    const b = Math.max(0.2, sky / 15);
    const f7 = -g.player.yaw / 64, f8 = g.player.pitch / 64;
    gui.quadUV(t, 0, 0, gui.width, gui.height, [[4 + f7, 4 + f8], [4 + f7, 0 + f8], [0 + f7, 0 + f8], [0 + f7, 4 + f8]], [b, b, b, 0.5]);
  }

  // ItemRenderer.renderFireInFirstPerson (as two screen-space sprites)
  renderFire(gui) {
    const A = this.game.assets;
    const e = A.atlas.entries.get('block/fire_1');
    if (!e) return;
    const W = gui.width, H = gui.height;
    const s = H * 0.5;
    const [u0, v0, u1, v1] = e.uv;
    const c = [1, 1, 1, 0.9];
    gui.quad(A.atlasTexture, -s * 0.15, H - s * 0.85, -s * 0.15 + s, H - s * 0.85 + s, u0, v0, u1, v1, c);
    gui.quad(A.atlasTexture, W + s * 0.15 - s, H - s * 0.85, W + s * 0.15, H - s * 0.85 + s, u1, v0, u0, v1, c);
  }

  renderSidebar(gui) {
    const sb = this.game.scoreboard;
    if (!sb || !sb.sidebar) return;
    const obj = sb.objectives.get(sb.sidebar);
    if (!obj) return;
    let scores = [...obj.scores.entries()].filter(([n]) => !n.startsWith('#'));
    scores.sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? 1 : -1));
    if (scores.length > 15) scores = scores.slice(scores.length - 15);
    const W = gui.width, H = gui.height;
    let w = gui.textWidth(obj.displayName);
    const rows = scores.map(([name, val]) => {
      const n = sb.formatName(name);
      const v = '§c' + val;
      w = Math.max(w, gui.textWidth(n + ': ' + v));
      return [n, v];
    });
    const totalH = rows.length * 9;
    const baseY = H / 2 + totalH / 3;
    const k1 = 3;
    const x0 = W - w - k1;
    rows.reverse();
    for (let j = 1; j <= rows.length; j++) {
      const [n, v] = rows[j - 1];
      const y = baseY - j * 9;
      const r = W - k1 + 2;
      gui.rect(x0 - 2, y, r, y + 9, 0x50000000);
      gui.text(n, x0, y, 0xffffff, false);
      gui.text(v, r - gui.textWidth(v), y, 0xffffff, false);
      if (j === rows.length) {
        gui.rect(x0 - 2, y - 9 - 1, r, y - 1, 0x60000000);
        gui.rect(x0 - 2, y - 1, r, y, 0x50000000);
        gui.text(obj.displayName, x0 + w / 2 - gui.textWidth(obj.displayName) / 2, y - 9, 0xffffff, false);
      }
    }
  }

  renderTabList(gui) {
    const g = this.game;
    const sb = g.scoreboard;
    const W = gui.width;
    const players = sb.sortedPlayers ? sb.sortedPlayers() : [];
    if (!players.length && !sb.header) return;
    const listObj = sb.list ? sb.objectives.get(sb.list) : null;
    let nameW = 0, scoreW = 0;
    for (const p of players) {
      nameW = Math.max(nameW, gui.textWidth(sb.tabName(p)));
      if (listObj && listObj.type !== 'hearts') scoreW = Math.max(scoreW, gui.textWidth(' ' + (listObj.scores.get(p.name) || 0)));
    }
    const n = players.length;
    let rowsPerCol = n;
    let cols = 1;
    while (rowsPerCol > 20) { cols++; rowsPerCol = Math.ceil(n / cols); }
    const showHeads = true;
    const colW = Math.min(cols * ((showHeads ? 9 : 0) + nameW + scoreW + 13), W - 50) / cols;
    const totalW = colW * cols + (cols - 1) * 5;
    const left = W / 2 - totalW / 2;
    let y = 10;
    let headerLines = sb.header ? gui.font.wrap(sb.header, W - 50) : [];
    let footerLines = sb.footer ? gui.font.wrap(sb.footer, W - 50) : [];
    let maxW = totalW;
    for (const l of headerLines) maxW = Math.max(maxW, gui.textWidth(l));
    for (const l of footerLines) maxW = Math.max(maxW, gui.textWidth(l));
    const bgH = headerLines.length * 9 + (headerLines.length ? 1 : 0) + rowsPerCol * 9 + (footerLines.length ? footerLines.length * 9 + 1 : 0);
    gui.rect(W / 2 - maxW / 2 - 1, y - 1, W / 2 + maxW / 2 + 1, y + bgH, 0x80000000);
    for (const l of headerLines) { gui.text(l, W / 2 - gui.textWidth(l) / 2, y, 0xffffff, true); y += 9; }
    if (headerLines.length) y++;
    for (let i = 0; i < n; i++) {
      const col = Math.floor(i / rowsPerCol), row = i % rowsPerCol;
      const x = left + col * colW + col * 5;
      const yy = y + row * 9;
      gui.rect(x, yy, x + colW, yy + 8, 0x20ffffff);
      const p = players[i];
      let tx = x;
      if (showHeads) {
        const skin = gui.tex(g.entityRenderer.skinImage ? g.entityRenderer.skinImage(p) : 'entity/steve.png');
        if (skin) {
          const k = skin.width / 64;
          gui.drawImage(skin, 8 * k, 8 * k, 8 * k, 8 * k, tx, yy, 8, 8);
          gui.drawImage(skin, 40 * k, 8 * k, 8 * k, 8 * k, tx, yy, 8, 8);
        }
        tx += 9;
      }
      const name = sb.tabName(p);
      gui.text(p.gamemode === 3 ? '§o' + stripCodes(name) : name, tx, yy, p.gamemode === 3 ? 0x90ffffff : 0xffffff, true);
      if (listObj) {
        const v = listObj.scores.get(p.name) || 0;
        const s = '§e' + v;
        if (listObj.type !== 'hearts') gui.text(s, x + colW - 12 - gui.textWidth(s), yy, 0xffffff, true);
      }
      // ping icon
      const ping = p.ping;
      const icon = ping < 0 ? 5 : ping < 150 ? 0 : ping < 300 ? 1 : ping < 600 ? 2 : ping < 1000 ? 3 : 4;
      gui.blit(ICONS, x + colW - 11, yy, 0, 176 + icon * 8, 10, 8);
    }
    y += rowsPerCol * 9;
    if (footerLines.length) {
      y++;
      for (const l of footerLines) { gui.text(l, W / 2 - gui.textWidth(l) / 2, y, 0xffffff, true); y += 9; }
    }
  }

  // GuiOverlayDebug.renderDebugInfo
  renderDebug(gui) {
    const g = this.game;
    this.debugTargets = debugTargets(g);
    const left = this._debugLeft(gui), right = this._debugRight(gui);
    const draw = (lines, alignRight) => {
      for (let i = 0; i < lines.length; i++) {
        const s = lines[i];
        if (!s) continue;
        const w = gui.textWidth(s), y = 2 + 9 * i;
        const x = alignRight ? gui.width - 2 - w : 2;
        gui.rect(x - 1, y - 1, x + w + 1, y + 8, 0x90505050);
        gui.text(s, x, y, 0xe0e0e0, false);
      }
    };
    draw(left, false);
    draw(right, true);
    if (g.showLagometer) this._renderLagometer(gui);
    if (g.showProfiler) this._renderProfiler(gui);
  }

  _debugLeft() {
    const g = this.game, s = g.settings, r = g.renderer, pl = g.player;
    const er = g.entityRenderer.stats || { total: 0, culled: 0 };
    const cu = g.chunkUpdates || 0;
    const fpsLine = `${g.fps} fps (${cu} chunk update${cu !== 1 ? 's' : ''}) T: ${s.maxFps ? s.maxFps : 'inf'}${s.enableVsync ? ' vsync' : ''}${s.fancyGraphics ? '' : ' fast'}`
      + `${s.clouds === 0 || s.clouds === false ? '' : s.clouds === 1 ? ' fast-clouds' : ' fancy-clouds'}${s.useVbo !== false ? ' vbo' : ''}`;
    const rendered = er.total - er.culled;
    const entCount = g.entities.count ? g.entities.count() : 0;
    const pool = g.assets.worker && g.assets.worker.workers;
    const workers = pool ? pool.filter((w) => !w.busy).length : 1; // available builders
    const lines = [
      'MinecraftJS 1.13.2 (1.13.2/vanilla)',
      fpsLine,
      `C: ${r.visibleSections || 0}/${r.sections.size} (s) D: ${s.renderDistance}, pC: ${String(g.dirty.size).padStart(3, '0')}, pU: ${g.inFlight.size}, aB: ${workers}`,
      `E: ${rendered}/${er.total}, B: ${er.culled}, I: ${Math.max(0, er.total - er.culled - rendered)}`,
      `P: ${g.particles.count ? g.particles.count() : 0}. T: All: ${entCount}`,
      `MultiplayerChunkCache: ${g.world.chunks.size}, ${g.world.chunks.size}`,
      '',
    ];
    const bx = Math.floor(pl.x), by = Math.floor(pl.y), bz = Math.floor(pl.z);
    if (g.reducedDebug || s.reducedDebugInfo) {
      lines.push(`Chunk-relative: ${bx & 15} ${by & 15} ${bz & 15}`);
      return lines;
    }
    const dimension = {0:'minecraft:overworld',[-1]:'minecraft:the_nether',1:'minecraft:the_end'}[g.dimension ?? g.world.dimension ?? 0];
    // FC is the server's force-loaded chunk count; multiplayer clients do not receive it.
    lines.splice(lines.length - 1, 0, (dimension || 'Unknown dimension (' + (g.dimension ?? g.world.dimension) + ')') + ' FC: n/a');
    const f = (n, d) => n.toFixed(d);
    const dirIdx = Math.floor(pl.yaw * 4 / 360 + 0.5) & 3; // getHorizontalFacing
    const facing = ['south', 'west', 'north', 'east'][dirIdx];
    const towards = ['Towards positive Z', 'Towards negative X', 'Towards negative Z', 'Towards positive X'][dirIdx];
    lines.push(`XYZ: ${f(pl.x, 3)} / ${f(pl.y, 5)} / ${f(pl.z, 3)}`);
    lines.push(`Block: ${bx} ${by} ${bz}`);
    lines.push(`Chunk: ${bx & 15} ${by & 15} ${bz & 15} in ${bx >> 4} ${by >> 4} ${bz >> 4}`);
    lines.push(`Facing: ${facing} (${towards}) (${f(wrapDeg(pl.yaw), 1)} / ${f(wrapDeg(pl.pitch), 1)})`);
    if (by >= 0 && by < 256 && g.world.getChunk && g.world.getChunk(bx >> 4, bz >> 4)) {
      const biome = biomeInfo(g.world.getBiome(bx, bz));
      const sky = g.world.getSkyLight(bx, by, bz), blk = g.world.getBlockLight(bx, by, bz);
      lines.push(`Biome: minecraft:${biome.name}`);
      lines.push(`Light: ${Math.max(sky, blk)} (${sky} sky, ${blk} block)`);
      const time = g.world.timeOfDay || 0;
      const ld = localDifficulty(g.difficulty, time);
      lines.push(`Local Difficulty: ${f(ld, 2)} // ${f(clampedDifficulty(ld), 2)} (Day ${Math.trunc(time / 24000)})`);
    } else lines.push(by < 0 || by >= 256 ? 'Outside of world...' : 'Waiting for chunk...');
    const targets = this.debugTargets || debugTargets(g);
    if (targets.block) { const t=targets.block; lines.push(`Looking at block: ${t.x} ${t.y} ${t.z}`); }
    if (targets.fluid) { const t=targets.fluid; lines.push(`Looking at liquid: ${t.x} ${t.y} ${t.z}`); }
    // GuiOverlayDebug.renderDebugInfoLeft
    lines.push('');
    lines.push(`Debug: Pie [shift]: ${g.showProfiler ? 'visible' : 'hidden'} FPS [alt]: ${g.showLagometer ? 'visible' : 'hidden'}`);
    lines.push('For help: press F3 + Q');
    return lines;
  }

  _debugRight(gui) {
    const g = this.game;
    const info = platform().info ? platform().info() : { runtime: 'Browser', bits: 64, memory: null, cpu: '?' };
    const MB = 1048576;
    const pad2 = (n) => String(n).padStart(2, ' '), pad3 = (n) => String(n).padStart(3, '0');
    const m = info.memory;
    const di = g.device.info || { vendor: g.device.name, renderer: '', version: '' };
    const lines = [
      `Browser: ${info.runtime} ${info.bits}bit`,
      m ? `Mem: ${pad2(Math.floor(m.used * 100 / m.max))}% ${pad3(Math.floor(m.used / MB))}/${pad3(Math.floor(m.max / MB))}MB` : 'Mem: n/a',
      m ? `Allocated: ${pad2(Math.floor(m.total * 100 / m.max))}% ${pad3(Math.floor(m.total / MB))}MB` : 'Allocated: n/a',
      '',
      `CPU: ${info.cpu}`,
      '',
      `Display: ${platform().width}x${platform().height} (${di.vendor})`,
      di.renderer,
      di.version,
    ];
    if (!g.reducedDebug && !g.settings.reducedDebugInfo) {
      const targets=this.debugTargets || debugTargets(g),t=targets.block;
      const properties = props => { for(const [key,value] of Object.entries(props).sort(([a],[b])=>a<b?-1:a>b?1:0)) {
        const text=String(value);lines.push(key+': '+(text==='true'?'§atrue':text==='false'?'§cfalse':text));
      }};
      if(t){lines.push('','§nTargeted Block','minecraft:'+getBlock(t.state).name);properties(getStateProperties(t.state));for(const name of g.tags?.forEntry('blocks',getBlock(t.state).id)||[])lines.push('#'+name);}
      if(targets.fluid) {
        const fluid=getFluidState(targets.fluid.state);
        const kind=fluid?.isLava?'lava':'water';
        lines.push('','§nTargeted Fluid','minecraft:'+(fluid?(fluid.source?kind:'flowing_'+kind):'empty'));
        if(fluid){properties(fluid.source?{falling:false}:{falling:fluid.level>=8,level:8-(fluid.level>=8?0:fluid.level)});for(const name of g.tags?.forEntry('fluids',fluid.source?(fluid.isLava?4:2):(fluid.isLava?3:1))||['minecraft:'+kind])lines.push('#'+name);}
      }
      const entity=g.interaction.target?.type==='entity'?g.interaction.target.entity:null;
      if(entity)lines.push('','§nTargeted Entity','minecraft:'+(entity.entityName||entity.typeName||entity.type));
    }
    void gui;
    return lines;
  }

  // GuiOverlayDebug.renderLagometer (Alt+F3)
  _renderLagometer(gui) {
    const g = this.game, H = gui.height;
    const vline = (x, y1, y2, c) => { if (y2 < y1) [y1, y2] = [y2, y1]; gui.rect(x, y1 + 1, x + 1, y2, c); };
    const hline = (x1, x2, y, c) => { if (x2 < x1) [x1, x2] = [x2, x1]; gui.rect(x1, y, x2 + 1, y + 1, c); };
    gui.rect(0, H - 60, 240, H, 0x90505050);
    const ft = g.frameTimes, n = ft.length;
    for (let l = 0; l < n; l++) {
      const ms = ft[(g.frameTimeIndex + l) % n];
      if (!(ms > 0)) continue;
      const h = Math.floor(ms / 16.666666 * 30);
      vline(l, H, H - h, lagColor(Math.min(60, Math.max(0, h))));
    }
    gui.rect(1, H - 30 + 1, 14, H - 30 + 10, 0x90505050);
    gui.text('60', 2, H - 30 + 2, 0xe0e0e0, false);
    hline(0, 239, H - 30, 0xffffffff);
    gui.rect(1, H - 60 + 1, 14, H - 60 + 10, 0x90505050);
    gui.text('30', 2, H - 60 + 2, 0xe0e0e0, false);
    hline(0, 239, H - 60, 0xffffffff);
    hline(0, 239, H - 1, 0xffffffff);
    vline(0, H - 60, H, 0xffffffff);
    vline(239, H - 60, H, 0xffffffff);
    const lim = g.settings.maxFps;
    if (lim && lim <= 120) hline(0, 239, H - 60 + lim / 2, 0xff00ffff);
  }

  // Minecraft.displayDebugInfo: profiler pie chart (Shift+F3), drawn in real pixels
  _renderProfiler(gui) {
    const P = this.game.profiler;
    if (!P.times.size) return;
    const res = P.results();
    const list = res.list;
    gui.pushMatrix();
    gui.scaleBy(1 / gui.scale, 1 / gui.scale);
    const DW = gui.width * gui.scale, DH = gui.height * gui.scale;
    const i = 160, j = DW - i - 10, k = DH - i * 2;
    const white = gui.white;
    const rgb = (c) => [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255, 1];
    let d0 = 0;
    for (const r1 of list) {
      const segs = Math.floor(r1.parentPct / 4) + 1;
      const top = rgb(r1.color), side = [((r1.color >> 16) & 255) / 510, ((r1.color >> 8) & 255) / 510, (r1.color & 255) / 510, 1];
      const pt = (jj) => {
        const a = (d0 + r1.parentPct * jj / segs) * Math.PI * 2 / 100;
        return [j + Math.sin(a) * i, k - Math.cos(a) * i * 0.5];
      };
      for (let s = segs; s > 0; s--) {
        const a = pt(s), b = pt(s - 1);
        gui.quadPoints(white, [[a[0], a[1] + 10], [b[0], b[1] + 10], b, a], [side]); // side wall (strip)
      }
      for (let s = segs; s > 0; s--) {
        const a = pt(s), b = pt(s - 1);
        gui.quadPoints(white, [[j, k], a, b, b], [top]); // top (fan)
      }
      d0 += r1.parentPct;
    }
    const pct = (v) => v.toFixed(2) + '%';
    const font = gui.font;
    let head = res.name !== 'unspecified' ? '[0] ' : '';
    head += (res.name.length === 0 ? 'ROOT' : res.name) + ' ';
    font.draw(head, j - i, k - i / 2 - 16, 0xffffff, true);
    let sv = pct(res.totalPct);
    font.draw(sv, j + i - gui.textWidth(sv), k - i / 2 - 16, 0xffffff, true);
    list.forEach((r3, n) => {
      const y = k + i / 2 + n * 8 + 20;
      font.draw((r3.name === 'unspecified' ? '[?] ' : `[${n + 1}] `) + r3.name, j - i, y, r3.color, true);
      sv = pct(r3.parentPct);
      font.draw(sv, j + i - 50 - gui.textWidth(sv), y, r3.color, true);
      sv = pct(r3.totalPct);
      font.draw(sv, j + i - gui.textWidth(sv), y, r3.color, true);
    });
    gui.popMatrix();
  }
}

function wrapDeg(a) { a %= 360; if (a >= 180) a -= 360; if (a < -180) a += 360; return a; }

// GuiOverlayDebug.func_181552_c: green -> yellow -> red over 0..30..60
function lagColor(v) {
  const blend = (c1, c2, t) => {
    let out = 0;
    for (let sh = 24; sh >= 0; sh -= 8) {
      const a = (c1 >>> sh) & 255, b = (c2 >>> sh) & 255;
      out = out * 256 + Math.min(255, Math.max(0, Math.floor(a + (b - a) * t)));
    }
    return out >>> 0;
  };
  return v < 30 ? blend(0xff00ff00, 0xffffff00, v / 30) : blend(0xffffff00, 0xffff0000, (v - 30) / 30);
}

// DifficultyInstance.calculateAdditionalDifficulty (client chunks never know their inhabited time)
// DifficultyInstance (World.getDifficultyForLocation): float maths; the client's chunks have no inhabited time (0)
function localDifficulty(difficulty, worldTime, inhabited = 0) {
  if (!difficulty) return 0;
  const f32 = Math.fround, clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const moon = [1, 0.75, 0.5, 0.25, 0, 0.25, 0.5, 0.75][((Math.trunc(worldTime / 24000) % 8) + 8) % 8];
  let f = f32(0.75);
  const f1 = f32(clamp(f32(f32(f32(worldTime) + -72000) / 1440000), 0, 1) * f32(0.25));
  f = f32(f + f1);
  let f2 = 0;
  f2 = f32(f2 + f32(clamp(f32(f32(inhabited) / 3600000), 0, 1) * (difficulty === 3 ? 1 : f32(0.75))));
  f2 = f32(f2 + clamp(f32(moon * f32(0.25)), 0, f1));
  if (difficulty === 1) f2 = f32(f2 * f32(0.5));
  return f32(difficulty * f32(f + f2));
}

// DifficultyInstance.getClampedAdditionalDifficulty
function clampedDifficulty(d) {
  if (d < 2) return 0;
  if (d > 4) return 1;
  return Math.fround(Math.fround(d - 2) / 2);
}

function chatText(json) { return chatToLegacy(json); }

// Flatten a chat component into [{text, click, hoverText}] for hit-testing
function extractComponents(raw) {
  let obj = raw;
  if (typeof raw === 'string') { try { obj = JSON.parse(raw); } catch (e) { return null; } }
  const out = [];
  const walk = (c, click, hover) => {
    if (c === null || c === undefined) return;
    if (typeof c === 'string') { out.push({ text: c, click, hoverText: hover }); return; }
    if (Array.isArray(c)) { c.forEach((x) => walk(x, click, hover)); return; }
    const ck = c.clickEvent || click;
    let hv = hover;
    if (c.hoverEvent && c.hoverEvent.action === 'show_text') {
      try { hv = chatToLegacy(c.hoverEvent.value, { parsed: true }); } catch (e) { hv = String(c.hoverEvent.value); }
    }
    if (c.text !== undefined) out.push({ text: c.text, click: ck, hoverText: hv });
    else if (c.translate) {
      try { out.push({ text: stripCodes(chatToLegacy(c)), click: ck, hoverText: hv }); } catch (e) { /* ignore */ }
      return;
    }
    for (const e of c.extra || []) walk(e, ck, hv);
  };
  walk(obj, null, null);
  if (!out.some((c) => c.click || c.hoverText)) return null;
  return out;
}
