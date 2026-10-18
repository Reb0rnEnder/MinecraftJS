// GuiStats (General / Blocks / Items / Mobs lists) and GuiAchievements (the scrolling achievement tree).
import { tr } from '../i18n.js';
import { Screen } from './manager.js';
import { Button } from '../widgets.js';
import { SlotList } from '../slot-list.js';
import { C } from '../../net/packets.js';
import { platform } from '../../platform/platform.js';
import { JavaRandom } from '../../util/jrandom.js';

const LAN_DOTS = ['oooooo', 'Oooooo', 'oOoooo', 'ooOooo', 'oooOoo', 'ooooOo', 'oooooO'];
const STATS_ICONS = 'gui/container/stats_icons.png';

// StatList.generalStats in registration order, with their IStatType
const GENERAL = [
  ['stat.leaveGame'], ['stat.playOneMinute', 'time'], ['stat.timeSinceDeath', 'time'],
  ['stat.walkOneCm', 'distance'], ['stat.crouchOneCm', 'distance'], ['stat.sprintOneCm', 'distance'], ['stat.swimOneCm', 'distance'],
  ['stat.fallOneCm', 'distance'], ['stat.climbOneCm', 'distance'], ['stat.flyOneCm', 'distance'], ['stat.diveOneCm', 'distance'],
  ['stat.minecartOneCm', 'distance'], ['stat.boatOneCm', 'distance'], ['stat.pigOneCm', 'distance'], ['stat.horseOneCm', 'distance'],
  ['stat.jump'], ['stat.drop'], ['stat.damageDealt', 'tenth'], ['stat.damageTaken', 'tenth'], ['stat.deaths'], ['stat.mobKills'],
  ['stat.animalsBred'], ['stat.playerKills'], ['stat.fishCaught'], ['stat.junkFished'], ['stat.treasureFished'],
  ['stat.talkedToVillager'], ['stat.tradedWithVillager'], ['stat.cakeSlicesEaten'], ['stat.cauldronFilled'], ['stat.cauldronUsed'],
  ['stat.armorCleaned'], ['stat.bannerCleaned'], ['stat.craftingTableInteraction'], ['stat.beaconInteraction'], ['stat.dropperInspected'],
  ['stat.hopperInspected'], ['stat.dispenserInspected'], ['stat.noteblockPlayed'], ['stat.noteblockTuned'], ['stat.flowerPotted'],
  ['stat.trappedChestTriggered'], ['stat.enderchestOpened'], ['stat.itemEnchanted'], ['stat.recordPlayed'], ['stat.furnaceInteraction'],
  ['stat.brewingstandInteraction'], ['stat.chestOpened'],
];

// Entities with spawn eggs (EntityList.entityEggs), in registration order
const EGG_IDS = [50, 51, 52, 54, 55, 56, 57, 58, 59, 60, 61, 62, 65, 66, 67, 68, 90, 91, 92, 93, 94, 95, 96, 98, 100, 101, 120];

// Java DecimalFormat("########0.00") and NumberFormat.getIntegerInstance(Locale.US)
const df = (v) => (Math.round(v * 100) / 100).toFixed(2);
const intFmt = (v) => Math.trunc(v).toLocaleString('en-US');
const javaDouble = (v) => (Number.isInteger(v) ? v.toFixed(1) : String(v));

export function formatStat(type, v) {
  switch (type) {
    case 'time': {
      const s = v / 20, m = s / 60, h = m / 60, d = h / 24, y = d / 365;
      return y > 0.5 ? df(y) + ' y' : d > 0.5 ? df(d) + ' d' : h > 0.5 ? df(h) + ' h' : m > 0.5 ? df(m) + ' m' : javaDouble(s) + ' s';
    }
    case 'distance': {
      const m = v / 100, km = m / 1000;
      return km > 0.5 ? df(km) + ' km' : m > 0.5 ? df(m) + ' m' : v + ' cm';
    }
    case 'tenth': return df(v * 0.1);
    default: return intFmt(v);
  }
}

// Statistics as received from the server (S37PacketStatistics), keyed by stat id
function statMap(entries) {
  const m = new Map();
  for (const e of entries || []) m.set(e.name, e.value);
  return m;
}

function loadingScreen(screen, gui) {
  gui.textCentered(tr('multiplayer.downloadingStats'), screen.width / 2, screen.height / 2, 0xffffff, true);
  gui.textCentered(LAN_DOTS[Math.floor(platform().now() / 150) % LAN_DOTS.length], screen.width / 2, screen.height / 2 + 18, 0xffffff, true);
}

// ---------------------------------------------------------------- GuiStats

export class StatsScreen extends Screen {
  constructor(game, parent) {
    super(game);
    this.parent = parent;
    this.background = 'dirt';
    this.stats = null;
    this.mode = 'general';
    this.requested = false;
  }

  init() {
    if (!this.requested) { this.requested = true; this.game.send(C.clientCommand(1)); }
    if (this.stats) this._build();
  }

  onStats(entries) {
    this.stats = statMap(entries);
    this.buttons = [];
    this._build();
  }

  _build() {
    const cx = this.width / 2, H = this.height;
    const g = this.game;
    const lists = {
      general: new GeneralList(this),
      blocks: new CraftingList(this, 'blocks'),
      items: new CraftingList(this, 'items'),
      mobs: new MobsList(this),
    };
    this.lists = lists;
    this.buttons.push(new Button(0, cx + 4, H - 28, 150, 20, tr('gui.done'), () => g.screens.open(this.parent)));
    this.buttons.push(new Button(1, cx - 160, H - 52, 80, 20, tr('stat.generalButton'), () => { this.mode = 'general'; }));
    const mk = (id, x, key, mode) => {
      const b = new Button(id, x, H - 52, 80, 20, tr(key), () => { this.mode = mode; });
      b.enabled = lists[mode].size() > 0;
      this.buttons.push(b);
    };
    mk(2, cx - 80, 'stat.blocksButton', 'blocks');
    mk(3, cx, 'stat.itemsButton', 'items');
    mk(4, cx + 80, 'stat.mobsButton', 'mobs');
  }

  read(name) { return (this.stats && this.stats.get(name)) || 0; }
  list() { return this.lists && this.lists[this.mode]; }

  render(gui, mx, my) {
    gui.dirtBackground();
    if (!this.stats) { loadingScreen(this, gui); return; }
    this.list().render(gui, mx, my);
    gui.textCentered(tr('gui.stats'), this.width / 2, 20, 0xffffff, true);
    for (const b of this.buttons) b.render(gui, mx, my);
  }

  mouseDown(mx, my, button, e) {
    if (super.mouseDown(mx, my, button)) return true;
    return this.list() ? this.list().mouseDown(mx, my, button, e) : false;
  }
  mouseUp(mx, my, button) { super.mouseUp(mx, my, button); if (this.list()) this.list().mouseUp(); }
  mouseMove(mx, my) { if (this.list()) this.list().mouseMove(mx, my); }
  wheel(d) { if (this.list()) this.list().wheel(d); }
  close() { this.game.screens.open(this.parent); }

  // GuiStats.drawSprite (stats_icons.png is 128x128)
  sprite(gui, x, y, u, v) { gui.blit(STATS_ICONS, x, y, u, v, 18, 18, 128, 128); }

  // GuiStats.drawStatsScreen: slot background + item icon
  itemSlot(gui, x, y, item) {
    this.sprite(gui, x + 1, y + 1, 0, 0);
    this.game.itemRenderer.drawItem(gui, { id: item.id, damage: 0, count: 1 }, x + 2, y + 2, false);
  }
}

class GeneralList extends SlotList {
  constructor(screen) {
    super(screen, 32, screen.height - 64, 10, { selectionBox: false });
  }
  size() { return GENERAL.length; }
  drawSlot(gui, i, x, y) {
    const [name, type] = GENERAL[i];
    const c = i % 2 === 0 ? 0xffffff : 0x909090;
    gui.text(tr(name), x + 2, y + 1, c, true);
    const v = formatStat(type, this.screen.read(name));
    gui.text(v, x + 2 + 213 - gui.textWidth(v), y + 1, c, true);
  }
}

// GuiStats.StatsBlock / StatsItem: three sortable columns per item
class CraftingList extends SlotList {
  constructor(screen, kind) {
    super(screen, 32, screen.height - 64, 20, { selectionBox: false, header: 20 });
    this.kind = kind;
    this.pressed = -1;
    this.sortCol = -1;
    this.sortDir = 0;
    const g = screen.game;
    // Columns: blocks = crafted, used, mined; items = depleted, crafted, used
    this.cols = kind === 'blocks'
      ? [['stat.craftItem.', 'stat.crafted', 18], ['stat.useItem.', 'stat.used', 36], ['stat.mineBlock.', 'stat.mined', 54]]
      : [['stat.breakItem.', 'stat.depleted', 72], ['stat.craftItem.', 'stat.crafted', 18], ['stat.useItem.', 'stat.used', 36]];
    const names = new Set();
    for (const k of screen.stats.keys()) {
      const m = k.match(/^stat\.(mineBlock|useItem|craftItem|breakItem)\.minecraft\.(.+)$/);
      if (m && screen.stats.get(k) > 0) names.add(m[2]);
    }
    this.rows = [];
    for (const n of names) {
      const item = g.items.byName.get(n);
      if (!item) continue;
      const isBlock = g.items.isBlockItem(item.id);
      if ((kind === 'blocks') !== isBlock) continue;
      this.rows.push({ item, name: n });
    }
    this.rows.sort((a, b) => a.item.id - b.item.id);
  }

  size() { return this.rows.length; }
  stat(row, col) { return this.cols[col][0] + 'minecraft.' + row.name; }

  drawHeader(gui, x, y, mx, my) {
    const s = this.screen;
    if (!this.mouseHeld) this.pressed = -1;
    const xs = [115, 165, 215];
    for (let c = 0; c < 3; c++) s.sprite(gui, x + xs[c] - 18, y + 1, 0, this.pressed === c ? 0 : 18);
    if (this.sortCol !== -1) {
      const i = this.sortCol === 1 ? 129 : this.sortCol === 2 ? 179 : 79;
      s.sprite(gui, x + i, y + 1, this.sortDir === 1 ? 36 : 18, 0);
    }
    for (let c = 0; c < 3; c++) {
      const d = this.pressed === c ? 1 : 0;
      s.sprite(gui, x + xs[c] - 18 + d, y + 1 + d, this.cols[c][2], 18);
    }
  }

  drawSlot(gui, i, x, y) {
    const s = this.screen, row = this.rows[i];
    s.itemSlot(gui, x + 40, y, row.item);
    const even = i % 2 === 0;
    [115, 165, 215].forEach((cx, c) => {
      const has = s.stats.has(this.stat(row, c));
      const v = has ? formatStat(null, s.read(this.stat(row, c))) : '-';
      gui.text(v, x + cx - gui.textWidth(v), y + 5, even ? 0xffffff : 0x909090, true);
    });
  }

  // Stats.func_148132_a: header buttons sort by that column (descending, ascending, off)
  headerClicked(x) {
    this.pressed = x >= 79 && x < 115 ? 0 : x >= 129 && x < 165 ? 1 : x >= 179 && x < 215 ? 2 : -1;
    if (this.pressed < 0) return;
    this.mouseHeld = true;
    const c = this.pressed;
    if (c !== this.sortCol) { this.sortCol = c; this.sortDir = -1; }
    else if (this.sortDir === -1) this.sortDir = 1;
    else { this.sortCol = -1; this.sortDir = 0; }
    const s = this.screen;
    this.rows.sort((a, b) => {
      if (this.sortCol >= 0) {
        const ka = this.stat(a, this.sortCol), kb = this.stat(b, this.sortCol);
        const ha = s.stats.has(ka), hb = s.stats.has(kb);
        if (ha || hb) {
          if (!ha) return 1;
          if (!hb) return -1;
          const l = s.read(ka), r = s.read(kb);
          if (l !== r) return (l - r) * this.sortDir;
        }
      }
      return a.item.id - b.item.id;
    });
    s.game.sound.playUi('gui.button.press', 1);
  }
  mouseUp() { super.mouseUp(); this.mouseHeld = false; }

  // Stats.func_148142_b: item name over the icon, column name over the header buttons
  decorations(gui, mx, my) {
    if (my < this.top || my > this.bottom) return;
    const i = this.slotAt(mx, my);
    const j = this.screen.width / 2 - 92 - 16;
    let text = '';
    if (i >= 0) {
      if (mx < j + 40 || mx > j + 40 + 20) return;
      text = this.screen.game.items.displayName({ id: this.rows[i].item.id, damage: 0, count: 1 });
    } else {
      const xs = [115, 165, 215];
      const c = xs.findIndex((cx) => mx >= j + cx - 18 && mx <= j + cx);
      if (c < 0) return;
      text = tr(this.cols[c][1]).trim();
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
    const ents = screen.game.assets.data.entities;
    this.rows = [];
    for (const id of EGG_IDS) {
      const e = ents.find((x) => x.id === id && x.type === 'mob');
      if (!e) continue;
      const kills = screen.read('stat.killEntity.' + e.name), killedBy = screen.read('stat.entityKilledBy.' + e.name);
      if (kills > 0 || killedBy > 0) this.rows.push({ name: e.name, kills, killedBy });
    }
  }
  size() { return this.rows.length; }
  drawSlot(gui, i, x, y) {
    const r = this.rows[i];
    const name = tr('entity.' + r.name + '.name');
    const s1 = r.kills === 0 ? tr('stat.entityKills.none', name) : tr('stat.entityKills', r.kills, name);
    const s2 = r.killedBy === 0 ? tr('stat.entityKilledBy.none', name) : tr('stat.entityKilledBy', name, r.killedBy);
    gui.text(name, x + 2 - 10, y + 1, 0xffffff, true);
    gui.text(s1, x + 2, y + 1 + 9, r.kills === 0 ? 0x606060 : 0x909090, true);
    gui.text(s2, x + 2, y + 1 + 18, r.killedBy === 0 ? 0x606060 : 0x909090, true);
  }
}

// ---------------------------------------------------------------- GuiAchievements

// AchievementList: [id, column, row, icon [itemId, meta], parent, special]
const ACHIEVEMENTS = [
  ['openInventory', 0, 0, [340], null],
  ['mineWood', 2, 1, [17], 'openInventory'],
  ['buildWorkBench', 4, -1, [58], 'mineWood'],
  ['buildPickaxe', 4, 2, [270], 'buildWorkBench'],
  ['buildFurnace', 3, 4, [61], 'buildPickaxe'],
  ['acquireIron', 1, 4, [265], 'buildFurnace'],
  ['buildHoe', 2, -3, [290], 'buildWorkBench'],
  ['makeBread', -1, -3, [297], 'buildHoe'],
  ['bakeCake', 0, -5, [354], 'buildHoe'],
  ['buildBetterPickaxe', 6, 2, [274], 'buildPickaxe'],
  ['cookFish', 2, 6, [350], 'buildFurnace'],
  ['onARail', 2, 3, [66], 'acquireIron', true],
  ['buildSword', 6, -1, [268], 'buildWorkBench'],
  ['killEnemy', 8, -1, [352], 'buildSword'],
  ['killCow', 7, -3, [334], 'buildSword'],
  ['flyPig', 9, -3, [329], 'killCow', true],
  ['snipeSkeleton', 7, 0, [261], 'killEnemy', true],
  ['diamonds', -1, 5, [264], 'acquireIron'],
  ['diamondsToYou', -1, 2, [264], 'diamonds'],
  ['portal', -1, 7, [49], 'diamonds'],
  ['ghast', -4, 8, [370], 'portal', true],
  ['blazeRod', 0, 9, [369], 'portal'],
  ['potion', 2, 8, [373], 'blazeRod'],
  ['theEnd', 3, 10, [381], 'blazeRod', true],
  ['theEnd2', 4, 13, [122], 'theEnd', true],
  ['enchantments', -4, 4, [116], 'diamonds'],
  ['overkill', -4, 1, [276], 'enchantments', true],
  ['bookcase', -3, 6, [47], 'enchantments'],
  ['breedCow', 7, -5, [296], 'killCow'],
  ['spawnWither', 7, 12, [397, 1], 'theEnd2'],
  ['killWither', 7, 10, [399], 'spawnWither'],
  ['fullBeacon', 7, 8, [138], 'killWither', true],
  ['exploreAllBiomes', 4, 8, [313], 'theEnd', true],
  ['overpowered', 6, 4, [322, 1], 'buildBetterPickaxe', true],
].map(([id, col, row, icon, parent, special]) => ({ id, col, row, icon: { id: icon[0], damage: icon[1] || 0, count: 1 }, parent, special: !!special }));
const BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));
const MIN_COL = Math.min(...ACHIEVEMENTS.map((a) => a.col)), MAX_COL = Math.max(...ACHIEVEMENTS.map((a) => a.col));
const MIN_ROW = Math.min(...ACHIEVEMENTS.map((a) => a.row)), MAX_ROW = Math.max(...ACHIEVEMENTS.map((a) => a.row));
const X_MIN = MIN_COL * 24 - 112, Y_MIN = MIN_ROW * 24 - 112, X_MAX = MAX_COL * 24 - 77, Y_MAX = MAX_ROW * 24 - 77;
const BG = 'gui/achievement/achievement_background.png';
const IMG_W = 256, IMG_H = 202;

function javaHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return h;
}

export class AchievementsScreen extends Screen {
  constructor(game, parent) {
    super(game);
    this.parent = parent;
    this.stats = null;
    this.requested = false;
    this.zoom = 1;
    const x = BY_ID.get('openInventory').col * 24 - 141 / 2 - 12, y = BY_ID.get('openInventory').row * 24 - 141 / 2;
    this.xPos = this.prevX = this.targetX = x;   // field_146569_s / field_146567_u / field_146565_w
    this.yPos = this.prevY = this.targetY = y;
    this.dragState = 0;
    this.mouseDownFlag = false;
  }

  init() {
    if (!this.requested) { this.requested = true; this.game.send(C.clientCommand(1)); }
    this.buttons.push(new Button(1, this.width / 2 + 24, this.height / 2 + 74, 80, 20, tr('gui.done'), () => this.close()));
  }

  onStats(entries) { this.stats = statMap(entries); }

  unlocked(a) { return !!(this.stats && this.stats.get('achievement.' + a.id) > 0); }
  canUnlock(a) { return !a.parent || this.unlocked(BY_ID.get(a.parent)); }
  // StatFileWriter.func_150874_c: how many locked ancestors stand in the way
  depth(a) {
    if (this.unlocked(a)) return 0;
    let n = 0;
    for (let p = a.parent && BY_ID.get(a.parent); p && !this.unlocked(p); p = p.parent && BY_ID.get(p.parent)) n++;
    return n;
  }

  tick() {
    super.tick();
    if (!this.stats) return;
    this.prevX = this.xPos;
    this.prevY = this.yPos;
    const dx = this.targetX - this.xPos, dy = this.targetY - this.yPos;
    if (dx * dx + dy * dy < 4) { this.xPos += dx; this.yPos += dy; } else { this.xPos += dx * 0.85; this.yPos += dy * 0.85; }
  }

  _clampTargets() {
    this.targetX = Math.max(X_MIN, Math.min(X_MAX - 1, this.targetX));
    this.targetY = Math.max(Y_MIN, Math.min(Y_MAX - 1, this.targetY));
  }

  render(gui, mx, my, partial) {
    if (!this.stats) {
      gui.worldBackground();
      loadingScreen(this, gui);
      return;
    }
    // dragging the map
    if (this.mouseDownFlag) {
      const k = (this.width - IMG_W) / 2 + 8, l = (this.height - IMG_H) / 2 + 17;
      if ((this.dragState === 0 || this.dragState === 1) && mx >= k && mx < k + 224 && my >= l && my < l + 155) {
        if (this.dragState === 0) this.dragState = 1;
        else {
          this.prevX -= (mx - this.lastMx) * this.zoom;
          this.prevY -= (my - this.lastMy) * this.zoom;
          this.targetX = this.xPos = this.prevX;
          this.targetY = this.yPos = this.prevY;
        }
        this.lastMx = mx; this.lastMy = my;
      }
    } else this.dragState = 0;
    this._clampTargets();
    if (this.game.inWorld) gui.worldBackground(); else gui.dirtBackground();
    this._drawMap(gui, mx, my, partial);
    gui.text(tr('gui.achievements'), (this.width - IMG_W) / 2 + 15, (this.height - IMG_H) / 2 + 5, 0x404040, false);
  }

  _drawMap(gui, mx, my, partial) {
    const g = this.game, A = g.assets;
    let i = Math.floor(this.prevX + (this.xPos - this.prevX) * partial);
    let j = Math.floor(this.prevY + (this.yPos - this.prevY) * partial);
    i = Math.max(X_MIN, Math.min(X_MAX - 1, i));
    j = Math.max(Y_MIN, Math.min(Y_MAX - 1, j));
    const k = Math.floor((this.width - IMG_W) / 2), l = Math.floor((this.height - IMG_H) / 2);
    const i1 = k + 16, j1 = l + 17;
    gui.scissor(i1, j1, 224, 155);
    gui.pushMatrix();
    gui.translate(i1, j1);
    gui.scaleBy(1 / this.zoom, 1 / this.zoom);
    // Background: rows of random blocks getting deeper (sand -> stone with ores -> bedrock)
    const k1 = (i + 288) >> 4, l1 = (j + 288) >> 4;
    const i2 = (i + 288) % 16, j2 = (j + 288) % 16;
    const acc = g.accounts && g.accounts.active();
    const pid = javaHash(String((acc && (acc.uuid || acc.name)) || g.username || ''));
    const rnd = new JavaRandom(0);
    const f = 16 / this.zoom;
    const tex = A.atlasTexture;
    for (let l3 = 0; l3 * f - j2 < 155; l3++) {
      const shade = 0.6 - (l1 + l3) / 25 * 0.3;
      for (let i4 = 0; i4 * f - i2 < 224; i4++) {
        rnd.setSeed((pid + k1 + i4 + (l1 + l3) * 16) | 0);
        const j4 = rnd.nextInt(1 + l1 + l3) + Math.trunc((l1 + l3) / 2);
        let name = 'sand';
        if (j4 <= 37 && l1 + l3 !== 35) {
          if (j4 === 22) name = rnd.nextInt(2) === 0 ? 'diamond_ore' : 'redstone_ore';
          else if (j4 === 10) name = 'iron_ore';
          else if (j4 === 8) name = 'coal_ore';
          else if (j4 > 4) name = 'stone';
          else if (j4 > 0) name = 'dirt';
        } else name = 'bedrock';
        const e = A.atlas.entries.get('blocks/' + name);
        if (!e) continue;
        const x = i4 * 16 - i2, y = l3 * 16 - j2;
        gui.quad(tex, x, y, x + 16, y + 16, e.uv[0], e.uv[1], e.uv[2], e.uv[3], [shade, shade, shade, 1]);
      }
    }
    // Lines between achievements and their parents
    for (const a of ACHIEVEMENTS) {
      if (!a.parent) continue;
      const p = BY_ID.get(a.parent);
      const k5 = a.col * 24 - i + 11, l5 = a.row * 24 - j + 11;
      const j6 = p.col * 24 - i + 11, k6 = p.row * 24 - j + 11;
      const d = this.depth(a);
      if (d > 4) continue;
      // available achievements: blinking blue line
      const blink = Math.sin((platform().now() % 600) / 600 * Math.PI * 2) > 0.6 ? 255 : 130;
      let c = 0xff000000;
      if (this.unlocked(a)) c = 0xffa0a0a0;
      else if (this.canUnlock(a)) c = 0xff000000 + blink;
      hline(gui, k5, j6, l5, c);
      vline(gui, j6, l5, k6, c);
      if (k5 > j6) gui.blit(BG, k5 - 11 - 7, l5 - 5, 114, 234, 7, 11);
      else if (k5 < j6) gui.blit(BG, k5 + 11, l5 - 5, 107, 234, 7, 11);
      else if (l5 > k6) gui.blit(BG, k5 - 5, l5 - 11 - 7, 96, 234, 11, 7);
      else if (l5 < k6) gui.blit(BG, k5 - 5, l5 + 11, 96, 241, 11, 7);
    }
    // Achievement frames + icons
    let hover = null;
    const fx = (mx - i1) * this.zoom, fy = (my - j1) * this.zoom;
    const t = gui.tex(BG);
    for (const a of ACHIEVEMENTS) {
      const i7 = a.col * 24 - i, j7 = a.row * 24 - j;
      if (i7 < -24 || j7 < -24 || i7 > 224 * this.zoom || j7 > 155 * this.zoom) continue;
      const d = this.depth(a);
      let b;
      if (this.unlocked(a)) b = 0.75;
      else if (this.canUnlock(a)) b = 1;
      else if (d < 3) b = 0.3;
      else if (d === 3) b = 0.2;
      else if (d === 4) b = 0.1;
      else continue;
      if (t) gui.quad(t, i7 - 2, j7 - 2, i7 + 24, j7 + 24, (a.special ? 26 : 0) / 256, 202 / 256, ((a.special ? 26 : 0) + 26) / 256, 228 / 256, [b, b, b, 1]);
      g.itemRenderer.drawItem(gui, a.icon, i7 + 3, j7 + 3, false);
      if (mx >= i1 && my >= j1 && mx < i1 + 224 && my < j1 + 155 && fx >= i7 && fx <= i7 + 22 && fy >= j7 && fy <= j7 + 22) hover = a;
    }
    gui.popMatrix();
    gui.clearScissor();
    // Frame over the map, then buttons and the tooltip
    gui.blit(BG, k, l, 0, 0, IMG_W, IMG_H);
    for (const btn of this.buttons) btn.render(gui, mx, my);
    if (hover) this._tooltip(gui, hover, mx, my);
  }

  _tooltip(gui, a, mx, my) {
    let name = tr('achievement.' + a.id);
    const keyName = this.game.settings.keyName ? this.game.settings.keyName(this.game.settings.keys.inventory) : 'E';
    const desc = tr('achievement.' + a.id + '.desc', keyName);
    const x = mx + 12, y = my - 4;
    const d = this.depth(a);
    const wrapH = (s, w) => gui.font.wrap(s, w).length * 9;
    if (this.canUnlock(a)) {
      const w = Math.max(gui.textWidth(name), 120);
      let h = wrapH(desc, w);
      if (this.unlocked(a)) h += 12;
      gui.gradient(x - 3, y - 3, x + w + 3, y + h + 3 + 12, 0xc0000000, 0xc0000000);
      drawSplit(gui, desc, x, y + 12, w, 0xffa0a0a0);
      if (this.unlocked(a)) gui.text(tr('achievement.taken'), x, y + h + 4, 0xff9090ff, true);
    } else if (d <= 3) {
      if (d === 3) name = tr('achievement.unknown');
      const w = Math.max(gui.textWidth(name), 120);
      const req = tr('achievement.requires', tr('achievement.' + a.parent));
      const h = wrapH(req, w);
      gui.gradient(x - 3, y - 3, x + w + 3, y + h + 12 + 3, 0xc0000000, 0xc0000000);
      drawSplit(gui, req, x, y + 12, w, 0xff705050);
    } else return;
    const c = this.canUnlock(a) ? (a.special ? 0xffffff80 : 0xffffffff) : (a.special ? 0xff808040 : 0xff808080);
    gui.text(name, x, y, c, true);
  }

  mouseDown(mx, my, button, e) {
    if (super.mouseDown(mx, my, button)) return true;
    if (button === 0) this.mouseDownFlag = true;
    return true;
  }
  mouseUp(mx, my, button) { super.mouseUp(mx, my, button); if (button === 0) this.mouseDownFlag = false; }

  // Mouse wheel zooms between 1x and 2x around the centre of the map
  wheel(d) {
    const old = this.zoom;
    if (d > 0) this.zoom += 0.25; else if (d < 0) this.zoom -= 0.25;
    this.zoom = Math.max(1, Math.min(2, this.zoom));
    if (this.zoom !== old) {
      this.prevX -= (this.zoom * IMG_W - old * IMG_W) * 0.5;
      this.prevY -= (this.zoom * IMG_H - old * IMG_H) * 0.5;
      this.targetX = this.xPos = this.prevX;
      this.targetY = this.yPos = this.prevY;
    }
  }

  key(e) {
    if (e.code === this.game.settings.keys.inventory) { this.close(); return true; }
    return super.key(e);
  }

  close() { this.game.screens.open(this.parent); }
}

function hline(gui, x1, x2, y, c) { if (x2 < x1) [x1, x2] = [x2, x1]; gui.rect(x1, y, x2 + 1, y + 1, c); }
function vline(gui, x, y1, y2, c) { if (y2 < y1) [y1, y2] = [y2, y1]; gui.rect(x, y1 + 1, x + 1, y2, c); }

// FontRenderer.drawSplitString (no shadow)
function drawSplit(gui, s, x, y, w, color) {
  for (const line of gui.font.wrap(s, w)) { gui.text(line, x, y, color & 0xffffff, false); y += 9; }
}
