// GuiSpectator + SpectatorMenu (1.8: English strings, no translation keys): the spectator-mode hotbar menu. A number key, middle click or the scroll wheel opens
// it (root: Teleport to Player / Teleport to Team); selecting an item twice uses it. It fades out 5 seconds after the
// last selection.
import { C } from '../net/packets.js';
import { COLOR_CODES } from './font.js';
import { platform } from '../platform/platform.js';

const SPECTATOR_WIDGETS = 'gui/spectator_widgets.png';
const WIDGETS = 'gui/widgets.png';

const EMPTY = { empty: true, name: () => '', enabled: () => false, select() {}, icon() {} };
const CLOSE = { name: () => 'Close menu', enabled: () => true, select: (m) => m.exit(), icon: (gui) => gui.blit(SPECTATOR_WIDGETS, 0, 0, 128, 0, 16, 16) };
const move = (dir, enabled) => ({
  name: () => (dir < 0 ? 'Previous Page' : 'Next Page'),
  enabled: () => enabled,
  select: (m) => { m.page += dir; },
  icon: (gui) => gui.blit(SPECTATOR_WIDGETS, 0, 0, dir < 0 ? 144 : 160, 0, 16, 16),
});
const SCROLL_LEFT = move(-1, true), SCROLL_RIGHT_ENABLED = move(1, true), SCROLL_RIGHT_DISABLED = move(1, false);

// A player's face (8x8 face and hat layers drawn at 12x12), tinted like GlStateManager.color(b, b, b, alpha)
function face(gui, game, info, alpha, b = 1) {
  const skin = gui.tex(info ? game.entityRenderer.skinImage(info) : 'entity/steve.png');
  if (!skin) return;
  const k = skin.width / 64;
  gui.setColor(b, b, b, alpha);
  gui.drawImage(skin, 8 * k, 8 * k, 8 * k, 8 * k, 2, 2, 12, 12);
  gui.drawImage(skin, 40 * k, 8 * k, 8 * k, 8 * k, 2, 2, 12, 12);
}

// PlayerMenuObject: spectate (teleport to) that player
function playerObject(game, info) {
  return {
    name: () => info.name,
    enabled: () => true,
    select: () => game.send(C.spectate(info.uuid)),
    icon: (gui, b, alpha) => face(gui, game, info, alpha),
  };
}

// TeleportToPlayer: everyone in the tab list who is not a spectator, ordered by UUID
function teleportToPlayer(game, infos) {
  const list = [...infos].filter((p) => p.gamemode !== 3).sort((a, b) => (a.uuid < b.uuid ? -1 : a.uuid > b.uuid ? 1 : 0));
  const items = list.map((p) => playerObject(game, p));
  return {
    items, prompt: () => 'Select a player to teleport to',
    name: () => 'Teleport to player',
    enabled: () => items.length > 0,
    select: (m) => m.selectCategory(teleportToPlayer(game, infos)),
    icon: (gui) => gui.blit(SPECTATOR_WIDGETS, 0, 0, 0, 0, 16, 16),
  };
}

// TeleportToTeam: one entry per team, showing a random member's face on the team colour
function teleportToTeam(game) {
  const sb = game.scoreboard;
  const byName = new Map([...sb.players.values()].map((p) => [p.name, p]));
  const items = [...sb.teams.entries()].map(([name, t]) => {
    const members = [...(t.players || [])].map((n) => byName.get(n)).filter(Boolean);
    const shown = members.length ? members[Math.floor(Math.random() * members.length)] : null;
    const codes = String(t.prefix || '').match(/§[0-9a-f]/gi);
    const color = codes ? COLOR_CODES['0123456789abcdef'.indexOf(codes[codes.length - 1][1].toLowerCase())] : -1;
    return {
      name: () => t.displayName || name,
      enabled: () => members.length > 0,
      select: (m) => m.selectCategory(teleportToPlayer(game, members)),
      icon: (gui, b, alpha) => {
        if (color >= 0) {
          const r = Math.trunc(((color >> 16) & 255) * b), g = Math.trunc(((color >> 8) & 255) * b), bl = Math.trunc((color & 255) * b);
          gui.resetColor();
          gui.rect(1, 1, 15, 15, ((Math.trunc(alpha * 255) << 24) | (r << 16) | (g << 8) | bl) >>> 0);
        }
        face(gui, game, shown, alpha, b);
      },
    };
  });
  return {
    items, prompt: () => 'Select a team to teleport to',
    name: () => 'Teleport to team member',
    enabled: () => items.some((i) => i.enabled()),
    select: (m) => m.selectCategory(teleportToTeam(game)),
    icon: (gui) => gui.blit(SPECTATOR_WIDGETS, 0, 0, 16, 0, 16, 16),
  };
}

class SpectatorMenu {
  constructor(owner) {
    this.owner = owner;
    const g = owner.game;
    // BaseSpectatorGroup
    this.category = { items: [teleportToPlayer(g, g.scoreboard.players.values()), teleportToTeam(g)], prompt: () => 'Press a key to select a command, and again to use it.' };
    this.selectedSlot = -1;
    this.page = 0;
  }

  getItem(i) {
    const j = i + this.page * 6;
    if (this.page > 0 && i === 0) return SCROLL_LEFT;
    if (i === 7) return j < this.category.items.length ? SCROLL_RIGHT_ENABLED : SCROLL_RIGHT_DISABLED;
    if (i === 8) return CLOSE;
    if (j < 0 || j >= this.category.items.length) return EMPTY;
    return this.category.items[j] || EMPTY;
  }

  selectedItem() { return this.getItem(this.selectedSlot); }

  selectSlot(i) {
    const item = this.getItem(i);
    if (item === EMPTY) return;
    if (this.selectedSlot === i && item.enabled()) item.select(this);
    else this.selectedSlot = i;
  }

  selectCategory(c) {
    this.category = c;
    this.selectedSlot = -1;
    this.page = 0;
  }

  exit() { this.owner.onMenuClosed(this); }
}

export class SpectatorGui {
  constructor(game) {
    this.game = game;
    this.menu = null;
    this.lastSelectionTime = 0;
  }

  get active() { return this.menu !== null; }

  onHotbarSelected(i) {
    this.lastSelectionTime = platform().now();
    if (this.menu) this.menu.selectSlot(i); else this.menu = new SpectatorMenu(this);
  }

  // onMouseScroll: the next enabled item in that direction
  onMouseScroll(dir) {
    let i = this.menu.selectedSlot + dir;
    while (i >= 0 && i <= 8 && !(this.menu.getItem(i) !== EMPTY && this.menu.getItem(i).enabled())) i += dir;
    if (i >= 0 && i <= 8) { this.menu.selectSlot(i); this.lastSelectionTime = platform().now(); }
  }

  onMiddleClick() {
    this.lastSelectionTime = platform().now();
    if (this.menu) { const i = this.menu.selectedSlot; if (i !== -1) this.menu.selectSlot(i); } else this.menu = new SpectatorMenu(this);
  }

  onMenuClosed() { this.menu = null; this.lastSelectionTime = 0; }

  hotbarAlpha() { return Math.min(1, Math.max(0, (this.lastSelectionTime - platform().now() + 5000) / 2000)); }

  // renderTooltip: the menu in place of the hotbar, sliding down as it fades
  render(gui) {
    if (!this.menu) return;
    const a = this.hotbarAlpha();
    if (a <= 0) { this.menu.exit(); return; }
    const W = gui.width, cx = Math.floor(W / 2);
    const y = gui.height - 22 * a;
    gui.setColor(1, 1, 1, a);
    gui.blit(WIDGETS, cx - 91, y, 0, 0, 182, 22);
    const sel = this.menu.selectedSlot;
    if (sel >= 0) gui.blit(WIDGETS, cx - 91 - 1 + sel * 20, y - 1, 0, 22, 24, 22);
    const n = Math.trunc(a * 255);
    const keys = this.game.settings.keys || {};
    for (let i = 0; i < 9; i++) {
      const item = this.menu.getItem(i);
      if (item === EMPTY) continue;
      const x = Math.floor(W / 2) - 90 + i * 20 + 2, yy = y + 3;
      const b = item.enabled() ? 1 : 0.25;
      gui.pushMatrix();
      gui.translate(x, yy);
      gui.setColor(b, b, b, a);
      item.icon(gui, b, a);
      gui.popMatrix();
      gui.setColor(1, 1, 1, a);
      const key = this.game.settings.keyName(keys['hotbar' + (i + 1)] || 'Digit' + (i + 1));
      if (n > 3 && item.enabled()) gui.font.draw(key, x + 19 - 2 - gui.textWidth(key), yy + 6 + 3, 0xffffff, true, n / 255);
    }
    gui.resetColor();
  }

  // renderSelectedItem: the selected item's name (or the page prompt) above the hotbar
  renderSelectedItem(gui) {
    const n = Math.trunc(this.hotbarAlpha() * 255);
    if (n <= 3 || !this.menu) return;
    const item = this.menu.selectedItem();
    const s = item === EMPTY ? this.menu.category.prompt() : item.name();
    if (!s) return;
    gui.font.draw(s, Math.trunc((gui.width - gui.textWidth(s)) / 2), gui.height - 35, 0xffffff, true, n / 255);
  }
}
