import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initBlocks, getBlock, getStateProperties, findState } from '../client/js/world/blocks.js';
import { buildSignFrame } from '../client/js/render/sign-model.js';
import { setJarModels } from '../client/js/render/entity-models.js';
import { setModelDevice } from '../client/js/render/boxmodel.js';
import { TAG } from '../client/js/net/nbt.js';
import { buildSign774, signFace774, signOutlineKey774 } from '../client/js/render/sign-1.21.11.js';
import { placedBannerLayers774, itemBannerLayers774, loomPatterns774 } from '../client/js/render/banner-1.21.11.js';
import { SignEditScreen } from '../client/js/gui/screens/sign.js';
import { openContainerScreen } from '../client/js/gui/screens/containers.js';
import { Reader774 } from '../client/js/net/configuration-1.21.11.js';
import { readSlot774, createItemStack774, itemComponentValues774 } from '../client/js/net/item-components-1.21.11.js';
import { PLAY_SERVERBOUND_774 } from '../client/js/net/protocol-1.21.11-ids.js';
import { Game } from '../client/js/game/game.js';

const device = { createMesh: () => ({}), destroyMesh() {} };
setModelDevice(device);
initBlocks(JSON.parse(readFileSync(new URL('../client/data/blocks.json', import.meta.url), 'utf8')));
const entityModels = JSON.parse(readFileSync(new URL('../client/assets/bundles/entity-models.json', import.meta.url), 'utf8'));
setJarModels(entityModels);
const signFixture = JSON.parse(readFileSync(new URL('./fixtures/sign-transforms-1.21.11.json', import.meta.url), 'utf8'));
const bannerFixture = JSON.parse(readFileSync(new URL('./fixtures/banner-stacks-1.21.11.json', import.meta.url), 'utf8'));

test('85 sign frames (including pale_oak), native scales, text offsets and chain visibility match real Java calls', () => {
  assert.equal(entityModels.hangingSign.nativeLayer, 'minecraft:hanging_sign/oak/wall#main');
  assert.equal(signFixture.samples.length, 85);
  assert.ok(signFixture.samples.some(s => s.label.startsWith('pale_oak ')));

  const mat = { id: 'sign' };
  const font = { wrap: s => [s], textWidth: s => String(s).length * 6, glyph: () => null };
  const dummyGame = {
    gui: { font, white: {}, device },
    device,
    renderer: { camPos: [0, 0, 0] },
    settings: { textFilteringEnabled: false },
  };

  for (const s of signFixture.samples) {
    const b = getBlock(s.state);
    const props = getStateProperties(s.state);
    const tile = { x: 0, y: 0, z: 0, data: {} };
    const outer = buildSign774(dummyGame, tile, b.name, props, mat);
    outer.updateWorld();
    const inner = outer.children[0];

    for (let i = 0; i < 16; i++) {
      assert.ok(
        Math.abs(inner.world[i] - s.transform[i]) < 1e-5,
        `${s.label} transform[${i}]: ${inner.world[i]} vs ${s.transform[i]}`,
      );
    }

    const hanging = b.name.endsWith('_hanging_sign');
    const wall = b.name.includes('_wall_');
    const frame = buildSignFrame(b.name, props, mat);
    assert.ok(Math.abs(frame.scale - s.modelScale) < 1e-5, `${s.label} modelScale`);

    const frontText = inner.children[1].children[0];
    assert.ok(Math.abs(frontText.position.x - s.textOffset[0]) < 1e-5, `${s.label} textOffset[0]`);
    assert.ok(Math.abs(frontText.position.y - s.textOffset[1]) < 1e-5, `${s.label} textOffset[1]`);
    assert.ok(Math.abs(frontText.position.z - s.textOffset[2]) < 1e-5, `${s.label} textOffset[2]`);
    assert.ok(Math.abs(frontText.scale.x / 0.015625 - s.textScale) < 1e-5, `${s.label} textScale`);

    if (hanging) {
      const vChains = !wall && props.attached === 'true';
      const normalChains = !vChains;
      assert.equal(wall, Boolean(s.visible.plank), `${s.label} plank`);
      assert.equal(vChains, Boolean(s.visible.vChains), `${s.label} vChains`);
      assert.equal(normalChains, Boolean(s.visible.normalChains), `${s.label} normalChains`);
    }
  }
});

test('both modern sign faces preserve components, filtering, independent dye and glow', () => {
  const nbt = {
    front_text: {
      color: 'red',
      has_glowing_text: 1,
      messages: [signFixture.signText.messages[0], '', '', ''],
    },
    back_text: {
      color: 'blue',
      has_glowing_text: 0,
      messages: ['back line', '', '', ''],
      filtered_messages: ['[filtered]', '', '', ''],
    },
  };

  const front = signFace774(nbt, true, false);
  assert.equal(front.color, 'red');
  assert.equal(front.glowing, true);
  assert.equal(front.plainLines[0], 'Zażółć "test"');

  const backUnfiltered = signFace774(nbt, false, false);
  assert.equal(backUnfiltered.color, 'blue');
  assert.equal(backUnfiltered.glowing, false);
  assert.equal(backUnfiltered.plainLines[0], 'back line');

  const backFiltered = signFace774(nbt, false, true);
  assert.equal(backFiltered.plainLines[0], '[filtered]');

  const outlineKey = signOutlineKey774(
    { renderer: { camPos: [0, 0, 0] } },
    { x: 0, y: 0, z: 0, data: nbt },
  );
  assert.notEqual(outlineKey, 'none/none');
});

test('editing the back of a hanging sign uses its 60px limit and sends the back-side flag', () => {
  const state = findState('oak_hanging_sign', { attached: 'false', rotation: '0', waterlogged: 'false' });
  const sent = [];
  const saved = [];
  const game = {
    gui: { width: 400, height: 240, textWidth: s => String(s).length * 6 },
    world: { getState: () => state },
    tileRenderer: {
      _get: () => ({ data: { back_text: { messages: ['hi', '', '', ''], color: 'black', has_glowing_text: 0 } } }),
      setSign: (pos, lines, front) => saved.push({ pos, lines, front }),
    },
    settings: { textFilteringEnabled: false },
    screens: { close() {} },
    send: p => sent.push(p),
  };

  const screen = new SignEditScreen(game, { x: 1, y: 2, z: 3 }, false);
  assert.equal(screen.maxWidth, 60);
  screen.init();
  assert.equal(screen.fields[0].validate('a'.repeat(10)), true); // 60px exact
  assert.equal(screen.fields[0].validate('a'.repeat(11)), false); // 66px > 60px

  screen.onClose();
  assert.equal(sent.length, 1);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].front, false);

  const r = new Reader774(sent[0]);
  assert.equal(r.varint(), PLAY_SERVERBOUND_774.update_sign);
  r.position();
  assert.equal(r.bool(), false);
});

test('modern placed/item banner layers and 1.21.11 native wire stacks resolve exact patterns and dyes', () => {
  const mockGame = name => ({
    items: {
      name: () => name,
      component: (it, k) => itemComponentValues774(it)[k],
    },
  });

  const placed = placedBannerLayers774(mockGame('blue_banner'), 'blue_banner', {
    patterns: [{ pattern: 'minecraft:flower', color: 'yellow' }],
  });
  assert.equal(placed[0].Pattern, 'b');
  assert.equal(placed[1].Pattern, 'minecraft:flower');

  assert.equal(bannerFixture.samples.length, 4);
  const decoded = bannerFixture.samples.map(s => {
    const stack = readSlot774(new Reader774(Buffer.from(s.wire, 'base64')));
    const key = stack.itemKey.replace(/^minecraft:/, '');
    return { label: s.label, layers: itemBannerLayers774(mockGame(key), stack) };
  });

  assert.deepEqual(decoded[0].layers.map(l => l.Pattern), ['b', 'minecraft:stripe_center', 'minecraft:flower']);
  assert.deepEqual(decoded[1].layers.map(l => l.Pattern), ['b', 'custom:art']);
  assert.deepEqual(decoded[2].layers.map(l => l.Pattern), ['b', 'minecraft:cross']);
  assert.deepEqual(decoded[3].layers.map(l => l.Pattern), ['b', 'minecraft:flow', 'minecraft:guster']);
});

test('loom follows server tag order and sends the selectable-list index rather than a registry ID', () => {
  const sent = [];
  const names = { 1266: 'white_banner', 1081: 'black_dye', 1342: 'flower_banner_pattern' };
  const banner = createItemStack774(1266, 1);
  const dye = createItemStack774(1081, 1);
  const patternItem = createItemStack774(1342, 1);

  const game = {
    gui: { width: 400, height: 240 },
    assets: { translate: k => k },
    player: {},
    sound: { playUi() {} },
    screens: { current: null, open: s => { game.screens.current = s; } },
    send: p => sent.push(p),
    commandTags: {
      'minecraft:banner_pattern': {
        'minecraft:pattern_item/flower': ['minecraft:flower', 'minecraft:creeper'],
        'minecraft:no_item_required': ['minecraft:stripe_bottom'],
      },
    },
    items: {
      name: id => names[id],
      component: (it, k) => itemComponentValues774(it)[k],
    },
  };

  assert.deepEqual(loomPatterns774(game, banner, dye, patternItem), ['minecraft:flower', 'minecraft:creeper']);

  const win = {
    id: 9,
    type: 'minecraft:loom',
    slots: [banner, dye, patternItem, null],
    get: i => win.slots[i],
  };
  openContainerScreen(game, win);
  const screen = game.screens.current;
  screen.init();
  screen.extraMouseDown(screen.guiLeft + 62, screen.guiTop + 15, 0);

  assert.equal(sent.length, 1);
  const r = new Reader774(sent[0]);
  assert.equal(r.varint(), PLAY_SERVERBOUND_774.enchant_item); // C.menuButton
  assert.equal(r.varint(), 9);
  assert.equal(r.varint(), 0); // selectable-list index, NOT registry ID
});

test('actual chunk/update block-entity dispatch retains hanging-sign text data', () => {
  const recorded = [];
  const game = {
    applyBlockEntity: Game.prototype.applyBlockEntity,
    tileRenderer: {
      setTileEntity: (pos, action, data, nbt) => recorded.push({ pos, action, data, nbt }),
    },
    structureBlocks: new Map(),
    jigsawBlocks: new Map(),
    screens: { current: null },
  };
  const nbt = {
    t: TAG.COMPOUND,
    v: {
      id: { t: TAG.STRING, v: 'minecraft:hanging_sign' },
      x: { t: TAG.INT, v: 10 },
      y: { t: TAG.INT, v: 65 },
      z: { t: TAG.INT, v: -4 },
      front_text: {
        t: TAG.COMPOUND,
        v: {
          color: { t: TAG.STRING, v: 'black' },
          has_glowing_text: { t: TAG.BYTE, v: 0 },
          messages: { t: TAG.LIST, v: { et: TAG.STRING, items: ['hello', '', '', ''] } },
        },
      },
    },
  };

  Game.prototype.on_tile_entity_data.call(game, { nbtData: nbt });
  assert.equal(recorded.length, 1);
  assert.deepEqual(recorded[0].pos, { x: 10, y: 65, z: -4 });
  assert.equal(recorded[0].action, 9);
  assert.deepEqual(recorded[0].data.front_text.messages, ['hello', '', '', '']);
});
