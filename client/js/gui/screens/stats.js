// GuiStats (General / Blocks / Items / Mobs lists).
import { tr } from '../i18n.js';
import { Screen } from './manager.js';
import { Button } from '../widgets.js';
import { SlotList } from '../slot-list.js';
import { C } from '../../net/packets.js';
import { platform } from '../../platform/platform.js';
import { JavaRandom } from '../../util/jrandom.js';

const LAN_DOTS = ['oooooo', 'Oooooo', 'oOoooo', 'ooOooo', 'oooOoo', 'ooooOo', 'oooooO'];
const STATS_ICONS = 'gui/container/stats_icons.png';

// StatList.BASIC_STATS (1.12) in registration order, with their IStatType
const GENERAL = [
  ['stat.leaveGame'], ['stat.playOneMinute', 'time'], ['stat.timeSinceDeath', 'time'], ['stat.sneakTime', 'time'],
  ['stat.walkOneCm', 'distance'], ['stat.crouchOneCm', 'distance'], ['stat.sprintOneCm', 'distance'], ['stat.swimOneCm', 'distance'],
  ['stat.fallOneCm', 'distance'], ['stat.climbOneCm', 'distance'], ['stat.flyOneCm', 'distance'], ['stat.diveOneCm', 'distance'],
  ['stat.minecartOneCm', 'distance'], ['stat.boatOneCm', 'distance'], ['stat.pigOneCm', 'distance'], ['stat.horseOneCm', 'distance'],
  ['stat.aviateOneCm', 'distance'],
  ['stat.jump'], ['stat.drop'], ['stat.damageDealt', 'tenth'], ['stat.damageTaken', 'tenth'], ['stat.deaths'], ['stat.mobKills'],
  ['stat.animalsBred'], ['stat.playerKills'], ['stat.fishCaught'],
  ['stat.talkedToVillager'], ['stat.tradedWithVillager'], ['stat.cakeSlicesEaten'], ['stat.cauldronFilled'], ['stat.cauldronUsed'],
  ['stat.armorCleaned'], ['stat.bannerCleaned'], ['stat.craftingTableInteraction'], ['stat.beaconInteraction'], ['stat.dropperInspected'],
  ['stat.hopperInspected'], ['stat.dispenserInspected'], ['stat.noteblockPlayed'], ['stat.noteblockTuned'], ['stat.flowerPotted'],
  ['stat.trappedChestTriggered'], ['stat.enderchestOpened'], ['stat.itemEnchanted'], ['stat.recordPlayed'], ['stat.furnaceInteraction'],
  ['stat.brewingstandInteraction'], ['stat.chestOpened'], ['stat.sleepInBed'], ['stat.shulkerBoxOpened'],
];

// Entities with spawn eggs (EntityList.entityEggs), in registration order
// EntityList.ENTITY_EGGS (1.12, registry order) -> translation name used by the kill stats and entity.<name>.name
const EGG_MOBS = [
  ['bat', 'Bat'], ['blaze', 'Blaze'], ['cave_spider', 'CaveSpider'], ['chicken', 'Chicken'], ['cow', 'Cow'], ['creeper', 'Creeper'],
  ['donkey', 'Donkey'], ['elder_guardian', 'ElderGuardian'], ['enderman', 'Enderman'], ['endermite', 'Endermite'],
  ['evocation_illager', 'EvocationIllager'], ['ghast', 'Ghast'], ['guardian', 'Guardian'], ['horse', 'Horse'], ['husk', 'Husk'],
  ['llama', 'Llama'], ['magma_cube', 'LavaSlime'], ['mooshroom', 'MushroomCow'], ['mule', 'Mule'], ['ocelot', 'Ozelot'],
  ['parrot', 'Parrot'], ['pig', 'Pig'], ['polar_bear', 'PolarBear'], ['rabbit', 'Rabbit'], ['sheep', 'Sheep'], ['shulker', 'Shulker'],
  ['silverfish', 'Silverfish'], ['skeleton', 'Skeleton'], ['skeleton_horse', 'SkeletonHorse'], ['slime', 'Slime'], ['spider', 'Spider'],
  ['squid', 'Squid'], ['stray', 'Stray'], ['vex', 'Vex'], ['villager', 'Villager'], ['vindication_illager', 'VindicationIllager'],
  ['witch', 'Witch'], ['wither_skeleton', 'WitherSkeleton'], ['wolf', 'Wolf'], ['zombie', 'Zombie'], ['zombie_horse', 'ZombieHorse'],
  ['zombie_pigman', 'PigZombie'], ['zombie_villager', 'ZombieVillager'],
];

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
    s.game.sound.playUi('ui.button.click', 1);
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
    this.rows = [];
    for (const [, name] of EGG_MOBS) {
      const kills = screen.read('stat.killEntity.' + name), killedBy = screen.read('stat.entityKilledBy.' + name);
      if (kills > 0 || killedBy > 0) this.rows.push({ name, kills, killedBy });
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
