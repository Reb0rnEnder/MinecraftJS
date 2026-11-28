import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { Gui } from '../client/js/gui/gui.js';
import { Assets } from '../client/js/assets.js';
import { CORE_GUI_SPRITES, legacyGuiSprite } from '../client/js/gui/sprites-1.21.11.js';
import { VANILLA_UI } from '../client/js/gui/vanilla-layout.js';
import { Hud } from '../client/js/gui/hud.js';

const require = createRequire(import.meta.url);
const { ZipFile } = require('../lib/zip.js');
const jar = new ZipFile(new URL('../cache/port-1.21.11/client.jar', import.meta.url).pathname);

function makeGui({ guiSpriteScaling = new Map(), meta = {} } = {}) {
  const quads = [];
  const texMap = new Map();
  const game = {
    gui: null,
    assets: {
      guiSpriteScaling,
      loadGuiSprite: () => Promise.resolve({ type: 'stretch' }),
    },
  };
  const gui = Object.create(Gui.prototype);
  gui.game = game;
  gui.assets = game.assets;
  gui.width = 400;
  gui.height = 240;
  gui.tex = p => {
    if (!texMap.has(p)) texMap.set(p, { path: p, ...meta[p] });
    return texMap.get(p);
  };
  gui.quad = (t, x0, y0, x1, y1, u0, v0, u1, v1, color) => {
    quads.push({ path: t.path, x0, y0, x1, y1, u0, v0, u1, v1, color });
  };
  game.gui = gui;
  return { gui, quads, game };
}

test('every migrated 1.21.11 GUI sprite exists in the pinned client jar', () => {
  const ver = JSON.parse(jar.read('version.json').toString('utf8'));
  assert.equal(ver.id, '1.21.11');
  assert.equal(ver.pack_version.resource_major, 75);
  assert.equal(VANILLA_UI.version, '1.21.11');
  assert.equal(VANILLA_UI.packFormat, 75);

  assert.equal(CORE_GUI_SPRITES.length, 153);
  for (const path of CORE_GUI_SPRITES) {
    assert.ok(jar.has('assets/minecraft/textures/' + path), `missing sprite in jar: ${path}`);
  }
});

test('hotbar, selected slot, hearts and cropped progress use native sprites with normalized UVs', () => {
  const { gui, quads } = makeGui();

  gui.blit('gui/widgets.png', 10, 20, 0, 0, 182, 22);
  gui.blit('gui/widgets.png', 9, 19, 0, 22, 24, 23);
  gui.blit('gui/icons.png', 50, 100, 16, 0, 9, 9);
  gui.blit('gui/icons.png', 50, 100, 52, 0, 9, 9);
  gui.blit('gui/icons.png', 100, 200, 0, 69, 91, 5);
  gui.blit('gui/icons.png', 100, 210, 0, 89, 91, 5);

  assert.deepEqual(quads.map(q => q.path), [
    'gui/sprites/hud/hotbar.png',
    'gui/sprites/hud/hotbar_selection.png',
    'gui/sprites/hud/heart/container.png',
    'gui/sprites/hud/heart/full.png',
    'gui/sprites/hud/experience_bar_progress.png',
    'gui/sprites/hud/jump_bar_progress.png',
  ]);
  assert.deepEqual([quads[0].u0, quads[0].v0, quads[0].u1, quads[0].v1], [0, 0, 1, 1]);
  assert.deepEqual([quads[4].u0, quads[4].v0, quads[4].u1, quads[4].v1], [0, 0, 0.5, 1]);
  assert.deepEqual([quads[5].u0, quads[5].v0, quads[5].u1, quads[5].v1], [0, 0, 0.5, 1]);

  // Hud.renderXp draws through legacy icons path -> hud sprites
  const h = Object.create(Hud.prototype);
  const { gui: hGui, quads: hQuads } = makeGui();
  h.game = { entities: new Map(), ridingEntityId: -1, xpBar: 0.5, xpLevel: 0 };
  h.renderXp(hGui);
  assert.deepEqual(hQuads.map(q => q.path), [
    'gui/sprites/hud/experience_bar_background.png',
    'gui/sprites/hud/experience_bar_progress.png',
  ]);
  assert.ok(hQuads[1].u1 > 0.49 && hQuads[1].u1 < 0.51);
});

test('native nine-slice sprites cover the destination exactly while preserving their borders', () => {
  const scaling = new Map([
    ['gui/sprites/widget/button.png', { type: 'nine_slice', width: 200, height: 20, border: 3, stretch_inner: false }],
    ['gui/sprites/widget/slider.png', { type: 'tile', width: 16, height: 16 }],
  ]);
  const { gui, quads } = makeGui({ guiSpriteScaling: scaling });

  gui.sprite('widget/button', 10, 20, 100, 40);
  assert.ok(quads.length >= 9, 'nine-slice emitted border + tiled inner quads');
  const minX = Math.min(...quads.map(q => q.x0));
  const maxX = Math.max(...quads.map(q => q.x1));
  const minY = Math.min(...quads.map(q => q.y0));
  const maxY = Math.max(...quads.map(q => q.y1));
  assert.deepEqual([minX, minY, maxX, maxY], [10, 20, 110, 60]);

  const topLeft = quads[0];
  assert.deepEqual([topLeft.x0, topLeft.y0, topLeft.x1, topLeft.y1], [10, 20, 13, 23]);
  assert.deepEqual([topLeft.u0, topLeft.v0, topLeft.u1, topLeft.v1], [0, 0, 3 / 200, 3 / 20]);

  quads.length = 0;
  gui.sprite('widget/slider', 0, 0, 24, 20);
  assert.equal(quads.length, 4);
  assert.deepEqual([quads[3].x0, quads[3].y0, quads[3].x1, quads[3].y1], [16, 16, 24, 20]);
  assert.deepEqual([quads[3].u1, quads[3].v1], [0.5, 0.25]);
});

test('sprite metadata belongs to the pack supplying its PNG and malformed tile sizes cannot hang rendering', async () => {
  const makeAssets = (metaResult, defaultGuiSprites = {}) => {
    const a = Object.create(Assets.prototype);
    a.version = 1;
    a.guiSpriteScaling = new Map();
    a.guiSpriteLoads = new Map();
    a.defaultGuiSprites = defaultGuiSprites;
    a.imageAsync = async () => ({});
    a.resourceMetadata = async () => metaResult;
    return a;
  };

  // Filtered overlay pack's defaultGuiSprites must not leak onto base PNG when meta has filtered=true
  const filteredAssets = makeAssets(
    { bytes: null, base: true, filtered: true },
    { 'gui/sprites/widget/button.png': { type: 'nine_slice', width: 200, height: 20, border: 3 } },
  );
  assert.deepEqual(await filteredAssets.loadGuiSprite('gui/sprites/widget/button.png'), { type: 'stretch' });

  // Unfiltered base pack inherits defaultGuiSprites
  const baseAssets = makeAssets(
    { bytes: null, base: true, filtered: false },
    { 'gui/sprites/widget/button.png': { type: 'nine_slice', width: 200, height: 20, border: 3 } },
  );
  assert.equal((await baseAssets.loadGuiSprite('gui/sprites/widget/button.png')).type, 'nine_slice');

  // Malformed tile / nine_slice metadata rejects cleanly without caching bad state
  const badTile = makeAssets({ bytes: new TextEncoder().encode(JSON.stringify({ gui: { scaling: { type: 'tile', width: 0, height: 16 } } })), base: false, filtered: false });
  await assert.rejects(badTile.loadGuiSprite('gui/sprites/bad_tile.png'), /Invalid GUI sprite dimensions/);

  const badBorders = makeAssets({ bytes: new TextEncoder().encode(JSON.stringify({ gui: { scaling: { type: 'nine_slice', width: 10, height: 10, border: 5 } } })), base: false, filtered: false });
  await assert.rejects(badBorders.loadGuiSprite('gui/sprites/bad_border.png'), /Invalid GUI sprite borders/);

  // Rendering with zero tile dimensions must terminate safely
  const { gui, quads } = makeGui({ guiSpriteScaling: new Map([['gui/sprites/zero.png', { type: 'tile', width: 0, height: 0 }]]) });
  gui.sprite('zero', 0, 0, 32, 32);
  assert.equal(quads.length, 0);
});

test('server, proxy and pack arrow rectangles all resolve to native 1.21.11 sprites', () => {
  assert.equal(legacyGuiSprite('gui/server_selection.png', 0, 0, 32, 32)?.spriteName, 'server_list/join');
  assert.equal(legacyGuiSprite('gui/server_selection.png', 0, 32, 32, 32)?.spriteName, 'server_list/join_highlighted');
  assert.equal(legacyGuiSprite('gui/server_selection.png', 96, 0, 32, 32)?.spriteName, 'server_list/move_up');
  assert.equal(legacyGuiSprite('gui/server_selection.png', 64, 32, 32, 32)?.spriteName, 'server_list/move_down_highlighted');

  assert.equal(legacyGuiSprite('gui/resource_packs.png', 0, 0, 32, 32)?.spriteName, 'transferable_list/select');
  assert.equal(legacyGuiSprite('gui/resource_packs.png', 0, 32, 32, 32)?.spriteName, 'transferable_list/select_highlighted');
  assert.equal(legacyGuiSprite('gui/resource_packs.png', 32, 0, 32, 32)?.spriteName, 'transferable_list/unselect');
  assert.equal(legacyGuiSprite('gui/resource_packs.png', 96, 0, 32, 32)?.spriteName, 'transferable_list/move_up');
  assert.equal(legacyGuiSprite('gui/resource_packs.png', 64, 32, 32, 32)?.spriteName, 'transferable_list/move_down_highlighted');
});
