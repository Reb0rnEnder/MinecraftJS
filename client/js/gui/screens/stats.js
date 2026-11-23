// StatsScreen (1.13.2-1.19.4): General / Items / Mobs lists over the 1.13 statistics registries.
// Shared differences, from each release's decompiled client: the General list keeps registration order until
// 1.16, which sorts it by translated name; 1.13.2 draws mob names 10 pixels left of their two detail lines,
// 1.14+ indents the detail lines by 10 instead.
import { tr } from '../i18n.js';
import { Screen } from './manager.js';
import { Button } from '../widgets.js';
import { SlotList } from '../slot-list.js';
import { C } from '../../net/packets.js';
import { platform } from '../../platform/platform.js';
import { STAT_REGISTRY_VERSION } from '../../game/stat-registry.js';
import { formatStat, customStatFormat, customStats, statItems, statMobs, itemBlock, BLOCK_COLUMNS, ITEM_COLUMNS } from '../../game/stats-counter.js';

const LAN_DOTS = ['oooooo', 'Oooooo', 'oOoooo', 'ooOooo', 'oooOoo', 'ooooOo', 'oooooO'];
const STATS_ICONS = 'gui/container/stats_icons.png';
const [MAJOR, MINOR] = STAT_REGISTRY_VERSION.split('.').map(Number);
const SORTED_GENERAL = MAJOR > 1 || MINOR >= 16;
const OLD_MOB_ROWS = MINOR === 13;
// Column icons in stats_icons.png (u = 18 * index, v = 18): mined, broken, crafted, used, picked up, dropped.
const COLUMN_ICONS = [3, 4, 1, 2, 5, 6];
const COLUMNS = [...BLOCK_COLUMNS, ...ITEM_COLUMNS];
const column = (i) => 115 + 40 * i;

export class StatsScreen extends Screen {
  constructor(game, parent) {
    super(game);
    this.parent = parent;
    this.background = 'dirt';
    this.loading = true;
    this.mode = 'general';
    this.requested = false;
  }
  // The screen waits for the first statistics packet; it does not pause the game while downloading.
  get pausesGame() { return !this.loading; }
  set pausesGame(v) {}

  init() {
    if (!this.requested) { this.requested = true; this.game.send(C.clientCommand(1)); }
    if (!this.loading) this._build();
  }

  onStats() {
    if (!this.loading) return;
    this.loading = false;
    this.buttons = [];
    this._build();
  }

  get counter() { return this.game.statsCounter; }

  _build() {
    const cx = Math.floor(this.width / 2), H = this.height, g = this.game;
    this.lists = { general: new GeneralList(this), items: new ItemList(this), mobs: new MobsList(this) };
    this.buttons.push(new Button(1, cx - 120, H - 52, 80, 20, tr('stat.generalButton'), () => { this.mode = 'general'; }));
    const items = new Button(3, cx - 40, H - 52, 80, 20, tr('stat.itemsButton'), () => { this.mode = 'items'; });
    const mobs = new Button(4, cx + 40, H - 52, 80, 20, tr('stat.mobsButton'), () => { this.mode = 'mobs'; });
    items.enabled = this.lists.items.size() > 0;
    mobs.enabled = this.lists.mobs.size() > 0;
    this.buttons.push(items, mobs);
    this.buttons.push(new Button(0, cx - 100, H - 28, 200, 20, tr('gui.done'), () => g.screens.open(this.parent)));
  }

  list() { return this.lists && this.lists[this.mode]; }

  render(gui, mx, my) {
    if (this.loading) {
      gui.dirtBackground();
      gui.textCentered(tr('multiplayer.downloadingStats'), Math.floor(this.width / 2), Math.floor(this.height / 2), 0xffffff, true);
      gui.textCentered(LAN_DOTS[Math.floor(platform().now() / 150) % LAN_DOTS.length], Math.floor(this.width / 2), Math.floor(this.height / 2) + 18, 0xffffff, true);
      return;
    }
    this.list().render(gui, mx, my);
    gui.textCentered(tr('gui.stats'), Math.floor(this.width / 2), 20, 0xffffff, true);
    for (const b of this.buttons) b.render(gui, mx, my);
  }

  mouseDown(mx, my, button, e) {
    if (super.mouseDown(mx, my, button)) return true;
    return this.list() ? this.list().mouseDown(mx, my, button, e) : false;
  }
  mouseUp(mx, my, button) { super.mouseUp(mx, my, button); this.list()?.mouseUp(); }
  mouseMove(mx, my) { this.list()?.mouseMove(mx, my); }
  wheel(d) { this.list()?.wheel(d); }
  close() { this.game.screens.open(this.parent); }

  // StatsScreen.blitSlotIcon: stats_icons.png is a 128x128 sheet of 18x18 cells
  sprite(gui, x, y, u, v) { gui.blit(STATS_ICONS, x, y, u, v, 18, 18, 128, 128); }
  itemSlot(gui, x, y, item) {
    this.sprite(gui, x + 1, y + 1, 0, 0);
    this.game.itemRenderer.drawItem(gui, { id: item.id, count: 1, damage: 0 }, x + 2, y + 2, false);
  }
}

const statKey = (name) => 'stat.minecraft.' + name;

class GeneralList extends SlotList {
  constructor(screen) {
    super(screen, 32, screen.height - 64, 10, { selectionBox: false });
    this.stats = customStats();
    // Comparator.comparing(I18n.get): Java String order (UTF-16 code units)
    if (SORTED_GENERAL) this.stats.sort((a, b) => { const x = tr(statKey(a)), y = tr(statKey(b)); return x < y ? -1 : x > y ? 1 : 0; });
  }
  size() { return this.stats.length; }
  drawSlot(gui, i, x, y) {
    const name = this.stats[i], c = i % 2 === 0 ? 0xffffff : 0x909090;
    gui.text(tr(statKey(name)), x + 2, y + 1, c, true);
    const v = formatStat(customStatFormat(name), this.screen.counter.get('custom', name));
    gui.text(v, x + 2 + 213 - gui.textWidth(v), y + 1, c, true);
  }
}

// ItemStatisticsList: six sortable columns (mined for block items, then the five item stats).
class ItemList extends SlotList {
  constructor(screen) {
    super(screen, 32, screen.height - 64, 20, { selectionBox: false, header: 20, listWidth: 375 });
    const data = screen.game.assets.data;
    this.blockNames = new Set((data.blocks || []).map((b) => b.name));
    this.rows = statItems(screen.counter, data);
    this.pressed = -1;
    this.sortColumn = null;
    this.sortOrder = 0;
  }
  // getScrollbarPosition: width / 2 + 140
  scrollBarX() { return this.left + Math.floor(this.width / 2) + 140; }
  size() { return this.rows.length; }
  value(item, type) {
    if (type === 'mined') { const block = itemBlock(item.name, this.blockNames); return block == null ? null : this.screen.counter.get('mined', block); }
    return this.screen.counter.get(type, item.name);
  }

  drawHeader(gui, x, y) {
    const s = this.screen;
    if (!this.mouseHeld) this.pressed = -1;
    for (let i = 0; i < COLUMNS.length; i++) s.sprite(gui, x + column(i) - 18, y + 1, 0, this.pressed === i ? 0 : 18);
    if (this.sortColumn) s.sprite(gui, x + column(COLUMNS.indexOf(this.sortColumn)) - 36, y + 1, 18 * (this.sortOrder === 1 ? 2 : 1), 0);
    for (let i = 0; i < COLUMNS.length; i++) {
      const d = this.pressed === i ? 1 : 0;
      s.sprite(gui, x + column(i) - 18 + d, y + 1 + d, 18 * COLUMN_ICONS[i], 18);
    }
  }

  drawSlot(gui, i, x, y) {
    const s = this.screen, item = this.rows[i], even = i % 2 === 0;
    s.itemSlot(gui, x + 40, y, item);
    COLUMNS.forEach((type, c) => {
      const v = this.value(item, type), text = v == null ? '-' : formatStat('default', v);
      gui.text(text, x + column(c) - gui.textWidth(text), y + 5, even ? 0xffffff : 0x909090, true);
    });
  }

  headerClicked(x) {
    this.pressed = -1;
    for (let i = 0; i < COLUMNS.length; i++) { const d = x - column(i); if (d >= -36 && d <= 0) { this.pressed = i; break; } }
    if (this.pressed < 0) return;
    this.mouseHeld = true;
    const type = COLUMNS[this.pressed];
    if (type !== this.sortColumn) { this.sortColumn = type; this.sortOrder = -1; }
    else if (this.sortOrder === -1) this.sortOrder = 1;
    else { this.sortColumn = null; this.sortOrder = 0; }
    // ItemComparator: by the column's value (missing mined values count as -1), then by item id; order 0 keeps the list
    const key = (item) => { if (!this.sortColumn) return 0; const v = this.value(item, this.sortColumn); return v == null ? -1 : v; };
    this.rows.sort((a, b) => { const l = key(a), r = key(b); return this.sortOrder * (l === r ? a.id - b.id : l - r); });
    this.screen.game.sound.playUi('ui.button.click', 1);
  }
  mouseUp() { super.mouseUp(); this.mouseHeld = false; }

  // renderDecorations: the item name over its icon, or the stat type name over a column header
  decorations(gui, mx, my) {
    if (my < this.top || my > this.bottom) return;
    const i = this.slotAt(mx, my), left = this.left + Math.floor((this.width - this.listWidth) / 2);
    let text = null;
    if (i >= 0) {
      if (mx < left + 40 || mx > left + 40 + 20) return;
      text = this.screen.game.items.displayName({ id: this.rows[i].id, count: 1, damage: 0 });
    } else {
      const c = COLUMNS.findIndex((_, n) => mx - left >= column(n) - 18 && mx - left <= column(n));
      if (c >= 0) text = tr('stat_type.minecraft.' + COLUMNS[c]);
    }
    if (!text) return;
    const k = mx + 12, l = my - 12, w = gui.textWidth(text);
    gui.gradient(k - 3, l - 3, k + w + 3, l + 8 + 3, 0xc0000000, 0xc0000000);
    gui.text(text, k, l, 0xffffff, true);
  }
}

class MobsList extends SlotList {
  constructor(screen) {
    super(screen, 32, screen.height - 64, 9 * 4, { selectionBox: false });
    const c = screen.counter;
    this.rows = statMobs(c, screen.game.assets.data).map((e) => ({ name: e.name, kills: c.get('killed', e.name), killedBy: c.get('killed_by', e.name) }));
  }
  size() { return this.rows.length; }
  drawSlot(gui, i, x, y) {
    const r = this.rows[i], name = tr('entity.minecraft.' + r.name);
    const killed = r.kills === 0 ? tr('stat_type.minecraft.killed.none', name) : tr('stat_type.minecraft.killed', r.kills, name);
    const killedBy = r.killedBy === 0 ? tr('stat_type.minecraft.killed_by.none', name) : tr('stat_type.minecraft.killed_by', name, r.killedBy);
    const nameX = OLD_MOB_ROWS ? x + 2 - 10 : x + 2, lineX = OLD_MOB_ROWS ? x + 2 : x + 2 + 10;
    gui.text(name, nameX, y + 1, 0xffffff, true);
    gui.text(killed, lineX, y + 1 + 9, r.kills === 0 ? 0x606060 : 0x909090, true);
    gui.text(killedBy, lineX, y + 1 + 18, r.killedBy === 0 ? 0x606060 : 0x909090, true);
  }
}
