import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { openContainerScreen } from '../client/js/gui/screens/containers.js';
import { CORE_GUI_SPRITES } from '../client/js/gui/sprites-1.21.11.js';
import { PLAY_SERVERBOUND_774 } from '../client/js/net/protocol-1.21.11-ids.js';
import { Reader774, Writer774 } from '../client/js/net/configuration-1.21.11.js';
import { decodePlayBody774 } from '../client/js/net/play-codec-1.21.11.js';
import { createItemStack774, writeSlot774 } from '../client/js/net/item-components-1.21.11.js';
import { Game } from '../client/js/game/game.js';

const require = createRequire(import.meta.url);
const { ZipFile } = require('../lib/zip.js');
const jar = new ZipFile(new URL('../cache/port-1.21.11/client.jar', import.meta.url).pathname);

function makeRecorderGui() {
  const calls = [];
  const gui = {
    width: 400,
    height: 240,
    tex: p => ({ p }),
    blit: (...a) => calls.push(['blit', ...a]),
    sprite: (...a) => calls.push(['sprite', ...a]),
    spriteRegion: (...a) => calls.push(['spriteRegion', ...a]),
    button: (...a) => calls.push(['button', ...a]),
    text: (...a) => calls.push(['text', ...a]),
    textCentered: (...a) => calls.push(['center', ...a]),
    textWidth: s => String(s).length * 6,
    rect: (...a) => calls.push(['rect', ...a]),
    resetTint() {},
    setTint() {},
  };
  return { gui, calls };
}

function makeMerchantGame(gui, sent, items) {
  const byId = new Map(items.map(i => [i.id, i]));
  let current = null;
  const game = {
    gui,
    assets: { translate: k => k },
    player: {},
    screens: { current: null, open: s => { current = s; game.screens.current = s; } },
    send: p => sent.push(p),
    items: {
      name: id => byId.get(id)?.name || 'item',
      count: s => s?.count || 1,
      displayName: () => 'item',
      isItem: () => true,
      maxStack: () => 64,
    },
    itemRenderer: {
      drawItem: (...a) => gui._items?.push(['drawItem', ...a]),
      drawOverlay: (...a) => gui._items?.push(['drawOverlay', ...a]),
    },
  };
  return { game, getScreen: () => current };
}

test('background, trade arrows, offer buttons and the scroller use native 1.21.11 sprites and sizes', () => {
  const { gui, calls } = makeRecorderGui();
  gui._items = calls;
  const sent = [];
  const { game, getScreen } = makeMerchantGame(gui, sent, [
    { id: 899, name: 'emerald' },
    { id: 952, name: 'wheat' },
  ]);
  const trades = Array.from({ length: 9 }, (_, i) => ({
    a: createItemStack774(899, 1 + i),
    b: null,
    out: createItemStack774(952, 1),
    uses: i === 1 ? 12 : 0,
    max: 12,
    disabled: i === 1,
    specialPrice: 0,
    priceMultiplier: 0.05,
    demand: 0,
  }));
  const win = {
    id: 7,
    type: 'minecraft:villager',
    slots: [null, null, null],
    get: i => win.slots[i],
    villagerLevel: 2,
    villagerXp: 15,
    showProgress: true,
    tradeData: { trades, villagerLevel: 2, experience: 15, isRegularVillager: true, canRestock: true },
  };
  openContainerScreen(game, win);
  const screen = getScreen();
  screen.init();
  screen.drawBackground(gui, 0, 0);

  const bg = calls.find(c => c[0] === 'blit');
  assert.deepEqual(bg, ['blit', 'gui/container/villager.png', screen.guiLeft, screen.guiTop, 0, 0, 276, 166, 512, 256]);

  const scroller = calls.find(c => c[0] === 'sprite' && c[1] === 'container/villager/scroller');
  assert.ok(scroller, 'active scroller drawn when >7 offers');
  assert.equal(scroller[4], 6);
  assert.equal(scroller[5], 27);

  const buttons = calls.filter(c => c[0] === 'button');
  assert.equal(buttons.length, 7);
  assert.equal(buttons[0][3], 88);
  assert.equal(buttons[0][4], 20);

  const arrows = calls.filter(c => c[0] === 'sprite' && String(c[1]).startsWith('container/villager/trade_arrow'));
  assert.equal(arrows.length, 7);
  assert.equal(arrows[0][1], 'container/villager/trade_arrow');
  assert.equal(arrows[1][1], 'container/villager/trade_arrow_out_of_stock');

  screen.extraMouseDown(screen.guiLeft + 15, screen.guiTop + 25, 0);
  assert.equal(sent.length, 1);
  const r = new Reader774(sent[0]);
  assert.equal(r.varint(), PLAY_SERVERBOUND_774.select_trade);
  assert.equal(r.varint(), 0);
});

test('a discount draws the base count, the cost count 14 to the right and the strikethrough sprite', () => {
  const { gui, calls } = makeRecorderGui();
  gui._items = calls;
  const { game, getScreen } = makeMerchantGame(gui, [], [
    { id: 899, name: 'emerald' },
    { id: 952, name: 'wheat' },
  ]);
  const win = {
    id: 7,
    type: 'minecraft:villager',
    slots: [null, null, null],
    get: i => win.slots[i],
    villagerLevel: 1,
    villagerXp: 0,
    showProgress: false,
    tradeData: {
      trades: [{
        a: createItemStack774(899, 5),
        b: null,
        out: createItemStack774(952, 1),
        uses: 0,
        max: 12,
        disabled: false,
        specialPrice: -2,
        priceMultiplier: 0.05,
        demand: 0,
      }],
      villagerLevel: 1,
      experience: 0,
      isRegularVillager: true,
      canRestock: true,
    },
  };
  openContainerScreen(game, win);
  const screen = getScreen();
  screen.init();
  screen.drawBackground(gui, 0, 0);

  const overlays = calls.filter(c => c[0] === 'drawOverlay');
  assert.equal(overlays.length, 2);
  assert.equal(overlays[0][2].count, 5);
  assert.equal(overlays[1][2].count, 3);
  assert.equal(overlays[1][3] - overlays[0][3], 14);
  const strike = calls.find(c => c[0] === 'sprite' && c[1] === 'container/villager/discount_strikethrough');
  assert.ok(strike);
  assert.equal(strike[4], 9);
  assert.equal(strike[5], 2);

  const disabledScroller = calls.find(c => c[0] === 'sprite' && c[1] === 'container/villager/scroller_disabled');
  assert.ok(disabledScroller);
});

test('experience bar draws current and pending XP as regions of the 102x5 bar; scroller steps natively and trade_list decodes', () => {
  const { gui, calls } = makeRecorderGui();
  gui._items = calls;
  const { game, getScreen } = makeMerchantGame(gui, [], [
    { id: 899, name: 'emerald' },
    { id: 952, name: 'wheat' },
  ]);
  const w = new Writer774();
  w.varint(7);
  w.varint(9);
  for (let i = 0; i < 9; i++) {
    w.varint(899); w.varint(5 + i); w.varint(0);
    writeSlot774(w, createItemStack774(952, 1));
    w.bool(false);
    w.bool(false);
    w.i32(0); w.i32(12); w.i32(5); w.i32(0); w.f32(0.05); w.i32(0);
  }
  w.varint(2); w.varint(15); w.bool(true); w.bool(true);
  const pkt = decodePlayBody774('trade_list', w.build());

  const win = {
    id: 7,
    type: 'minecraft:villager',
    slots: [null, null, null],
    get: i => win.slots[i],
    villagerLevel: 1,
    villagerXp: 0,
    showProgress: true,
  };
  game.window = win;
  openContainerScreen(game, win);
  const screen = getScreen();
  screen.init();
  Game.prototype.on_trade_list.call(game, pkt);

  screen.extraMouseDown(screen.guiLeft + 15, screen.guiTop + 25, 0);
  screen.drawBackground(gui, 0, 0);

  const xpBg = calls.find(c => c[0] === 'sprite' && c[1] === 'container/villager/experience_bar_background');
  assert.ok(xpBg);
  assert.equal(xpBg[4], 102);
  assert.equal(xpBg[5], 5);

  const regions = calls.filter(c => c[0] === 'spriteRegion');
  assert.ok(regions.some(r => r[1] === 'container/villager/experience_bar_current' && r[2] === 102 && r[3] === 5));
  assert.ok(regions.some(r => r[1] === 'container/villager/experience_bar_result' && r[2] === 102 && r[3] === 5));

  assert.equal(screen.row, 0);
  screen.wheel(1);
  assert.equal(screen.row, 1);
  screen.wheel(5);
  assert.equal(screen.row, 2); // clamped to 9 - 7 = 2
  screen.wheel(-1);
  assert.equal(screen.row, 1);
});

test('every merchant sprite and texture exists in the pinned 1.21.11 jar', () => {
  const merchantSprites = [
    'container/villager/discount_strikethrough',
    'container/villager/experience_bar_background',
    'container/villager/experience_bar_current',
    'container/villager/experience_bar_result',
    'container/villager/out_of_stock',
    'container/villager/scroller',
    'container/villager/scroller_disabled',
    'container/villager/trade_arrow',
    'container/villager/trade_arrow_out_of_stock',
  ];
  for (const s of merchantSprites) {
    assert.ok(jar.has(`assets/minecraft/textures/gui/sprites/${s}.png`), `missing ${s}`);
  }
  assert.ok(jar.has('assets/minecraft/textures/gui/container/villager.png'));
});
