// Native 1.20.6 StatsScreen: HeaderAndFooterLayout(33, 58), General / Items / Mobs ObjectSelectionLists
// (280-wide rows) and the 1.20.2+ statistics sprites.
import { tr } from '../i18n.js';
import { Screen } from './manager.js';
import { Button } from '../widgets.js';
import { SlotList } from '../slot-list.js';
import { C } from '../../net/packets.js';
import { platform } from '../../platform/platform.js';
import { formatStat, customStatFormat, customStats, statItems, statMobs, itemBlock, BLOCK_COLUMNS, ITEM_COLUMNS } from '../../game/stats-counter.js';

const HEADER = 33, FOOTER = 58, ROW_WIDTH = 280;
// LoadingDotsText
const DOTS = ['O o o', 'o O o', 'o o O', 'o O o'];
export const loadingDots = (now) => DOTS[Math.floor(now / 300) % DOTS.length];
const COLUMNS = [...BLOCK_COLUMNS, ...ITEM_COLUMNS];
const COLUMN_SPRITES = ['statistics/block_mined', 'statistics/item_broken', 'statistics/item_crafted', 'statistics/item_used', 'statistics/item_picked_up', 'statistics/item_dropped'];
const column = (i) => 75 + 40 * i;
const ODD = 0xbababa;

export class StatsScreen extends Screen {
  constructor(game, parent) {
    super(game);
    this.parent = parent;
    this.loading = true;
    this.mode = 'general';
    this.requested = false;
  }
  // isPauseScreen: !isLoading
  get pausesGame() { return !this.loading; }
  set pausesGame(v) {}
  get counter() { return this.game.statsCounter; }

  init() {
    if (!this.requested) { this.requested = true; this.game.send(C.clientCommand(1)); }
    if (!this.loading) this._build();
  }

  // onStatsUpdated: only the first update builds the lists
  onStats() {
    if (!this.loading) return;
    this.loading = false;
    this.buttons = [];
    this._build();
  }

  _build() {
    const g = this.game, W = this.width, H = this.height;
    const keep = this.lists && Object.fromEntries(Object.entries(this.lists).map(([k, l]) => [k, l.amountScrolled]));
    this.lists = { general: new GeneralList(this), items: new ItemList(this), mobs: new MobsList(this) };
    if (keep) for (const [k, v] of Object.entries(keep)) { this.lists[k].amountScrolled = v; this.lists[k].clamp(); }
    // Footer: vertical LinearLayout (spacing 5) holding a 3 x 120 row (spacing 5) and a 200-wide Done, centred.
    const footerX = Math.max(0, Math.floor((W - 370) / 2)), rowY = H - 51;
    const general = new Button(1, footerX, rowY, 120, 20, tr('stat.generalButton'), () => { this.mode = 'general'; });
    const items = new Button(3, footerX + 125, rowY, 120, 20, tr('stat.itemsButton'), () => { this.mode = 'items'; });
    const mobs = new Button(4, footerX + 250, rowY, 120, 20, tr('stat.mobsButton'), () => { this.mode = 'mobs'; });
    items.enabled = this.lists.items.size() > 0;
    mobs.enabled = this.lists.mobs.size() > 0;
    this.buttons.push(general, items, mobs, new Button(0, footerX + 85, H - 26, 200, 20, tr('gui.done'), () => g.screens.open(this.parent)));
  }

  list() { return this.lists && this.lists[this.mode]; }

  render(gui, mx, my) {
    gui.menuBackground(this.game.inWorld);
    const cx = Math.floor(this.width / 2);
    if (this.loading) {
      // LoadingDotsWidget in the contents frame (top aligned, 30 below the header)
      const msg = tr('multiplayer.downloadingStats'), mid = HEADER + 30 + 13;
      gui.text(msg, cx - Math.floor(gui.textWidth(msg) / 2), mid - 9, 0xffffff, false);
      const dots = loadingDots(platform().now());
      gui.text(dots, cx - Math.floor(gui.textWidth(dots) / 2), mid + 9, 0x808080, false);
      return;
    }
    this.list().render(gui, mx, my);
    gui.textCentered(tr('gui.stats'), cx, 12, 0xffffff);
    for (const b of this.buttons) b.render(gui, mx, my);
    this.list().tooltip(gui, mx, my);
  }

  mouseDown(mx, my, button, e) {
    if (super.mouseDown(mx, my, button)) return true;
    return this.list() ? this.list().mouseDown(mx, my, button, e) : false;
  }
  mouseUp(mx, my, button) { super.mouseUp(mx, my, button); this.list()?.mouseUp(); }
  mouseMove(mx, my) { this.list()?.mouseMove(mx, my); }
  wheel(d) { this.list()?.wheel(d); }
  close() { this.game.screens.open(this.parent); }
}

class StatsList extends SlotList {
  constructor(screen, rowHeight, opts = {}) {
    super(screen, HEADER, screen.height - FOOTER, rowHeight, { selectionBox: false, listWidth: ROW_WIDTH, ...opts });
  }
  tooltip() {}
}

const statKey = (name) => 'stat.minecraft.' + name;

class GeneralList extends StatsList {
  constructor(screen) {
    super(screen, 14);
    // Comparator.comparing(I18n.get(...)): Java String order (UTF-16 code units)
    this.stats = customStats().sort((a, b) => { const x = tr(statKey(a)), y = tr(statKey(b)); return x < y ? -1 : x > y ? 1 : 0; });
  }
  size() { return this.stats.length; }
  drawSlot(gui, i, x, y, h) {
    const name = this.stats[i], c = i % 2 === 0 ? 0xffffff : ODD, ty = y + Math.floor(h / 2) - 4;
    gui.text(tr(statKey(name)), x + 2, ty, c, true);
    const v = formatStat(customStatFormat(name), this.screen.counter.get('custom', name));
    gui.text(v, x + ROW_WIDTH - gui.textWidth(v) - 4, ty, c, true);
  }
}

// ItemStatisticsList: six sortable sprite columns (mined for block items, then the five item stats).
class ItemList extends StatsList {
  constructor(screen) {
    super(screen, 22, { header: 22 });
    const data = screen.game.assets.data;
    this.blockNames = new Set((data.blocks || []).map((b) => b.name));
    this.rows = statItems(screen.counter, data);
    this.pressed = -1;
    this.sortColumn = null;
    this.sortOrder = 0;
  }
  size() { return this.rows.length; }
  value(item, type) {
    if (type === 'mined') { const block = itemBlock(item.name, this.blockNames); return block == null ? null : this.screen.counter.get('mined', block); }
    return this.screen.counter.get(type, item.name);
  }

  drawHeader(gui, x, y) {
    if (!this.mouseHeld) this.pressed = -1;
    for (let i = 0; i < COLUMNS.length; i++) gui.sprite(this.pressed === i ? 'container/slot' : 'statistics/header', x + column(i) - 18, y + 1, 18, 18);
    if (this.sortColumn) gui.sprite(this.sortOrder === 1 ? 'statistics/sort_up' : 'statistics/sort_down', x + column(COLUMNS.indexOf(this.sortColumn)) - 36, y + 1, 18, 18);
    for (let i = 0; i < COLUMNS.length; i++) {
      const d = this.pressed === i ? 1 : 0;
      gui.sprite(COLUMN_SPRITES[i], x + column(i) - 18 + d, y + 1 + d, 18, 18);
    }
  }

  drawSlot(gui, i, x, y, h) {
    const item = this.rows[i], even = i % 2 === 0, ty = y + Math.floor(h / 2) - 4;
    gui.sprite('container/slot', x, y, 18, 18);
    this.screen.game.itemRenderer.drawItem(gui, { id: item.id, count: 1, damage: 0 }, x + 1, y + 1, false);
    COLUMNS.forEach((type, c) => {
      const v = this.value(item, type), text = v == null ? tr('stats.none') : formatStat('default', v);
      gui.text(text, x + column(c) - gui.textWidth(text), ty, even ? 0xffffff : ODD, true);
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
    // ItemRowComparator: by the column's value (missing mined values count as -1), then by item id; order 0 keeps the list
    const key = (item) => { if (!this.sortColumn) return 0; const v = this.value(item, this.sortColumn); return v == null ? -1 : v; };
    this.rows.sort((a, b) => { const l = key(a), r = key(b); return this.sortOrder * (l === r ? a.id - b.id : l - r); });
    this.screen.game.sound.playUi('ui.button.click', 1);
  }
  mouseUp() { super.mouseUp(); this.mouseHeld = false; }

  // renderDecorations: the item name over its slot, or the stat type name over a column header
  tooltip(gui, mx, my) {
    if (my < this.top || my > this.bottom) return;
    const i = this.slotAt(mx, my), left = this.slotLeft();
    let text = null;
    if (i >= 0) {
      if (mx < left || mx > left + 18) return;
      text = this.screen.game.items.displayName({ id: this.rows[i].id, count: 1, damage: 0 });
    } else {
      const c = COLUMNS.findIndex((_, n) => mx - left >= column(n) - 18 && mx - left <= column(n));
      if (c >= 0) text = tr('stat_type.minecraft.' + COLUMNS[c]);
    }
    if (text) gui.tooltip([text], mx, my);
  }
}

class MobsList extends StatsList {
  constructor(screen) {
    super(screen, 9 * 4);
    const c = screen.counter;
    this.rows = statMobs(c, screen.game.assets.data).map((e) => ({ name: e.name, kills: c.get('killed', e.name), killedBy: c.get('killed_by', e.name) }));
  }
  size() { return this.rows.length; }
  drawSlot(gui, i, x, y) {
    const r = this.rows[i], name = tr('entity.minecraft.' + r.name);
    const killed = r.kills === 0 ? tr('stat_type.minecraft.killed.none', name) : tr('stat_type.minecraft.killed', r.kills, name);
    const killedBy = r.killedBy === 0 ? tr('stat_type.minecraft.killed_by.none', name) : tr('stat_type.minecraft.killed_by', name, r.killedBy);
    gui.text(name, x + 2, y + 1, 0xffffff, true);
    gui.text(killed, x + 2 + 10, y + 1 + 9, r.kills === 0 ? 0x808080 : ODD, true);
    gui.text(killedBy, x + 2 + 10, y + 1 + 18, r.killedBy === 0 ? 0x808080 : ODD, true);
  }
}
