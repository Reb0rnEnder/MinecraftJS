import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { DownloadingTerrainScreen, levelLoadingReason } from '../client/js/gui/screens/menus.js';
import { PORTAL_LAYERS } from '../client/js/render/end-portal-17.js';

const require = createRequire(import.meta.url);
const { ZipFile } = require('../lib/zip.js');
const jar = new ZipFile(new URL('../cache/port-1.21.11/client.jar', import.meta.url).pathname);

test('levelLoadingReason resolves nether, end, and other dimension transitions', () => {
  assert.equal(levelLoadingReason(false, 'minecraft:the_nether', 'minecraft:overworld'), 'nether');
  assert.equal(levelLoadingReason(false, 'minecraft:overworld', 'minecraft:the_nether'), 'nether');
  assert.equal(levelLoadingReason(false, 'minecraft:the_end', 'minecraft:overworld'), 'end');
  assert.equal(levelLoadingReason(false, 'minecraft:overworld', 'minecraft:overworld'), 'other');
  assert.equal(levelLoadingReason(true, 'minecraft:the_nether', 'minecraft:overworld'), 'other');
  assert.equal(levelLoadingReason(true, 'minecraft:the_end', 'minecraft:overworld'), 'other');
});

test('backgrounds per reason match 1.21.11 client jar textures and shader passes', () => {
  for (const path of [
    'assets/minecraft/textures/block/nether_portal.png',
    'assets/minecraft/textures/entity/end_portal.png',
    'assets/minecraft/textures/environment/end_sky.png',
  ]) {
    assert.ok(jar.has(path), `missing ${path} in 1.21.11 jar`);
  }

  const calls = [];
  const makeGui = () => ({
    width: 400,
    height: 240,
    setBlend: m => calls.push(['blend', m]),
    quad: (tex, x0, y0, x1, y1) => calls.push(['quad', tex, x0, y0, x1, y1]),
    drawMesh: req => calls.push(['drawMesh', req.pipeline, req.textures[0]]),
    textCentered: (txt, x, y) => calls.push(['textCentered', txt, x, y]),
  });

  const makeGame = () => ({
    gui: { width: 400, height: 240 },
    device: { width: 400, height: 240, createMesh: () => ({}), destroyMesh() {} },
    assets: {
      atlasTexture: 'atlas',
      atlas: { entries: new Map([['block/nether_portal', { uv: [0, 0, 1, 1] }]]) },
      texture: p => p,
      translate: k => k,
    },
    world: { worldAge: 10, isLoaded: () => false },
    player: { x: 0, z: 0 },
    screens: { close() {} },
  });

  const nether = new DownloadingTerrainScreen(makeGame(), 'nether');
  nether.init();
  nether.renderContent(makeGui(), 0, 0, 0);
  assert.deepEqual(calls.slice(0, 3), [
    ['blend', 'none'],
    ['quad', 'atlas', 0, 0, 400, 240],
    ['blend', 'alpha'],
  ]);
  assert.ok(calls.some(c => c[0] === 'textCentered'));

  calls.length = 0;
  const end = new DownloadingTerrainScreen(makeGame(), 'end');
  end.init();
  end.renderContent(makeGui(), 0, 0, 0);
  const meshCalls = calls.filter(c => c[0] === 'drawMesh');
  assert.equal(meshCalls.length, PORTAL_LAYERS + 1);
  assert.equal(meshCalls[0][1], 'endportal');
  assert.equal(meshCalls[0][2], 'environment/end_sky.png');
  assert.equal(meshCalls[1][2], 'entity/end_portal.png');

  calls.length = 0;
  const other = new DownloadingTerrainScreen(makeGame(), 'other');
  other.init();
  other.renderContent(makeGui(), 0, 0, 0);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'textCentered');
});

test('Escape is swallowed and screen closes after 30 seconds without ready level or once chunk loads', () => {
  let closed = 0;
  let loaded = false;
  const game = {
    gui: { width: 400, height: 240 },
    assets: { translate: k => k },
    world: { isLoaded: () => loaded },
    player: { x: 8, z: 8 },
    screens: { close() { closed++; } },
  };

  const s1 = new DownloadingTerrainScreen(game, 'other');
  assert.equal(s1.key({ code: 'Escape' }), true);
  assert.equal(closed, 0);
  for (let i = 0; i < 600; i++) s1.tick();
  assert.equal(closed, 0);
  s1.tick(); // 601st tick -> ticks > 600
  assert.equal(closed, 1);

  closed = 0;
  const s2 = new DownloadingTerrainScreen(game, 'other');
  s2.terrainReady = true;
  s2.tick();
  assert.equal(closed, 0);
  loaded = true;
  s2.tick();
  assert.equal(closed, 1);
});
