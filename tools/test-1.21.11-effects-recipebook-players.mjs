import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { inflateSync } from 'node:zlib';
import {
  EFFECT_774,
  effectLabel774,
  effectDuration774,
  createEffectBlend774,
  tickEffectBlend774,
} from '../client/js/game/effects-1.21.11.js';
import { ITEM_DATA_774 } from '../client/js/game/item-data-1.21.11.js';
import { Gui } from '../client/js/gui/gui.js';
import { Hud } from '../client/js/gui/hud.js';
import { drawModernEffects } from '../client/js/gui/screens/containers.js';
import { legacyGuiSprite } from '../client/js/gui/sprites-1.21.11.js';
import { RecipeBook } from '../client/js/game/recipebook.js';
import { RecipeBookGui } from '../client/js/gui/recipebook.js';
import { Game } from '../client/js/game/game.js';
import { Interaction } from '../client/js/game/interaction.js';
import { PLAY_SERVERBOUND_774 } from '../client/js/net/protocol-1.21.11-ids.js';
import { Reader774 } from '../client/js/net/configuration-1.21.11.js';

const require = createRequire(import.meta.url);
const { ZipFile } = require('../lib/zip.js');
const jar = new ZipFile(new URL('../cache/port-1.21.11/client.jar', import.meta.url).pathname);

function makeRecorderGui({ width = 400, height = 240, existing = null } = {}) {
  const calls = [];
  const gui = Object.create(Gui.prototype);
  const assets = {
    guiSpriteScaling: new Map(),
    loadGuiSprite: () => Promise.resolve({ type: 'stretch' }),
    translate: k => k,
    texture: p => ({ p }),
  };
  gui.game = { assets };
  gui.assets = assets;
  gui.width = width;
  gui.height = height;
  gui.tex = p => {
    if (existing && !existing.has(p)) return null;
    return { path: p };
  };
  gui.quad = (t, x0, y0, x1, y1, u0, v0, u1, v1, color) => {
    calls.push({ op: 'quad', path: t.path, x0, y0, x1, y1, u0, v0, u1, v1, color });
  };
  gui.text = (s, x, y, color) => calls.push({ op: 'text', s, x, y, color });
  gui.textWidth = s => String(s).length * 6;
  return { gui, calls, assets };
}

function pngHasOpaquePixel(buf) {
  let pos = 8;
  let width = 0, height = 0, colorType = 0;
  const idats = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9];
    } else if (type === 'IDAT') {
      idats.push(data);
    } else if (type === 'IEND') {
      break;
    }
    pos += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idats));
  const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 4 ? 2 : 1;
  if (bpp === 3 || bpp === 1) return width > 0 && height > 0;
  const stride = width * bpp;
  const recon = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const val = raw[y * (stride + 1) + 1 + x];
      const a = x >= bpp ? recon[y * stride + x - bpp] : 0;
      const b = y > 0 ? recon[(y - 1) * stride + x] : 0;
      const c = (x >= bpp && y > 0) ? recon[(y - 1) * stride + x - bpp] : 0;
      let out = val;
      if (filter === 1) out = (val + a) & 0xff;
      else if (filter === 2) out = (val + b) & 0xff;
      else if (filter === 3) out = (val + ((a + b) >> 1)) & 0xff;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        out = (val + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff;
      }
      recon[y * stride + x] = out;
    }
  }
  for (let i = bpp - 1; i < recon.length; i += bpp) {
    if (recon[i] > 0) return true;
  }
  return false;
}

test('native ID zero and regeneration packets retain their exact registry identity through labels and gameplay', () => {
  assert.equal(EFFECT_774.speed, 0);
  assert.equal(ITEM_DATA_774.effects[0].key, 'minecraft:speed');
  assert.equal(EFFECT_774.breath_of_the_nautilus, 39);

  const allowedTex = new Set([
    'gui/sprites/container/inventory/effect_background.png',
    'mob_effect/speed.png',
    'mob_effect/regeneration.png',
  ]);
  const { gui, calls, assets } = makeRecorderGui({ existing: allowedTex });
  const game = {
    entityId: 1,
    ticks: 10,
    gui,
    assets,
    effects: new Map(),
    items: { effects: ITEM_DATA_774.effects },
    player: { id: 1 },
    entities: { addEffect() {} },
    _applyEffects() {},
    screens: { current: null },
  };

  Game.prototype.on_entity_effect.call(game, {
    entityId: 1,
    effectId: 0,
    amplifier: 1,
    duration: 200,
    ambient: false,
    showIcon: true,
    shouldBlend: true,
  });
  Game.prototype.on_entity_effect.call(game, {
    entityId: 1,
    effectId: EFFECT_774.regeneration,
    amplifier: 0,
    duration: -1,
    ambient: false,
    showIcon: true,
    shouldBlend: true,
  });

  assert.ok(game.effects.has(0));
  assert.equal(effectLabel774(game, 0, game.effects.get(0).amplifier), 'effect.minecraft.speed enchantment.level.2');
  assert.equal(effectDuration774(-1, k => (k === 'effect.duration.infinite' ? '∞' : k)), '∞');

  drawModernEffects(game, gui, { guiLeft: 100, guiTop: 20, imageWidth: 176, fullEffects: true }, 0, 0);
  const bgQuads = calls.filter(c => c.op === 'quad' && c.path.includes('effect_background'));
  assert.equal(bgQuads.length, 2);
  assert.equal(bgQuads[0].path, 'gui/sprites/container/inventory/effect_background.png');
  assert.ok(jar.has('assets/minecraft/textures/' + bgQuads[0].path));
});

test('HUD effects use native backgrounds/categories and infinite icons never blink out', () => {
  const { gui, calls, assets } = makeRecorderGui();
  const game = {
    gui,
    assets,
    screens: {},
    items: { effects: ITEM_DATA_774.effects },
    effects: new Map([
      [EFFECT_774.speed, { id: EFFECT_774.speed, amplifier: 0, duration: -1, ambient: false, showIcon: true }],
      [EFFECT_774.weakness, { id: EFFECT_774.weakness, amplifier: 0, duration: 40, ambient: false, showIcon: true }],
      [EFFECT_774.night_vision, { id: EFFECT_774.night_vision, amplifier: 0, duration: -1, ambient: true, showIcon: true }],
    ]),
  };
  const hud = Object.create(Hud.prototype);
  hud.game = game;

  hud.renderStatusEffects(gui, 0, 0);
  const bgs = calls.filter(c => c.op === 'quad' && c.path.includes('hud/effect_background'));
  assert.ok(bgs.some(c => c.path === 'gui/sprites/hud/effect_background.png'));
  assert.ok(bgs.some(c => c.path === 'gui/sprites/hud/effect_background_ambient.png'));

  const icons = calls.filter(c => c.op === 'quad' && c.path.startsWith('mob_effect/'));
  const speedIcon = icons.find(c => c.path === 'mob_effect/speed.png');
  const weaknessIcon = icons.find(c => c.path === 'mob_effect/weakness.png');
  assert.equal(speedIcon.color[3], 1, 'infinite effect stays full alpha');
  assert.ok(weaknessIcon.color[3] < 1, 'expiring effect dims/blinks');
});

test('effect blend state matches six actual native Java scenarios frame by frame', () => {
  const { blendSamples } = JSON.parse(readFileSync(new URL('../tools/fixtures/item-ux-1.21.11.json', import.meta.url), 'utf8'));
  assert.equal(blendSamples.length, 6);

  // First 3 scenarios use darkness (blendTicks = 22); next 3 use instant effect (blendTicks = 0)
  for (let i = 0; i < blendSamples.length; i++) {
    const sample = blendSamples[i];
    const id = i < 3 ? EFFECT_774.darkness : EFFECT_774.speed;
    const effect = {
      id,
      duration: sample.duration,
      factor: createEffectBlend774(id, sample.duration, true),
    };
    assert.equal(effect.factor.factor_current, sample.frames[0].current, `sample ${i} frame 0 current`);
    assert.equal(effect.factor.factor_previous_frame, sample.frames[0].previous, `sample ${i} frame 0 previous`);
    for (let f = 1; f < sample.frames.length; f++) {
      effect.duration = sample.frames[f].duration;
      tickEffectBlend774(effect);
      assert.ok(
        Math.abs(effect.factor.factor_current - sample.frames[f].current) < 1e-6,
        `sample ${i} frame ${f} current: ${effect.factor.factor_current} vs ${sample.frames[f].current}`,
      );
      assert.ok(
        Math.abs(effect.factor.factor_previous_frame - sample.frames[f].previous) < 1e-6,
        `sample ${i} frame ${f} previous: ${effect.factor.factor_previous_frame} vs ${sample.frames[f].previous}`,
      );
    }
  }
});

test('recipe-book buttons, tabs, filters, recipe slots and arrows sample opaque native sprites', () => {
  const expectedSprites = [
    legacyGuiSprite('gui/container/crafting_table.png', 0, 168, 20, 18),
    legacyGuiSprite('gui/container/crafting_table.png', 0, 187, 20, 18),
    legacyGuiSprite('gui/recipe_book.png', 153, 2, 35, 27),
    legacyGuiSprite('gui/recipe_book.png', 188, 2, 35, 27),
    legacyGuiSprite('gui/recipe_book.png', 152, 41, 26, 16),
    legacyGuiSprite('gui/recipe_book.png', 180, 41, 26, 16),
    legacyGuiSprite('gui/recipe_book.png', 29, 206, 25, 25),
    legacyGuiSprite('gui/recipe_book.png', 54, 206, 25, 25),
    legacyGuiSprite('gui/recipe_book.png', 1, 208, 12, 17),
    legacyGuiSprite('gui/recipe_book.png', 14, 208, 12, 17),
  ];
  for (const s of expectedSprites) {
    assert.ok(s && s.spriteName?.startsWith('recipe_book/'), `missing mapping: ${JSON.stringify(s)}`);
    const raw = jar.read('assets/minecraft/textures/' + s.path);
    assert.ok(raw, `missing jar texture ${s.path}`);
    assert.ok(pngHasOpaquePixel(raw), `expected opaque pixel in ${s.path}`);
  }
});

test('unified player spawns remain pickable and NPC targeting emits the native attack packet', () => {
  const spawned = [];
  const sent = [];
  const game = {
    entities: {
      spawnPlayer: p => spawned.push(p),
      entities: new Map(),
    },
    player: { sneaking: false },
    send: p => sent.push(p),
  };

  Game.prototype.on_spawn_entity.call(game, {
    entityId: 42,
    objectUUID: '00000000-0000-4000-8000-000000000042',
    type: 155,
    entityTypeName: 'minecraft:player',
    x: 10,
    y: 64,
    z: -5,
    yaw: 0,
    pitch: 0,
    headPitch: 0,
    objectData: 0,
    velocityX: 0,
    velocityY: 0,
    velocityZ: 0,
  });
  assert.equal(spawned.length, 1);
  assert.equal(spawned[0].entityId, 42);

  const interaction = Object.create(Interaction.prototype);
  interaction.game = game;
  interaction._attackTargetEntity = () => {};
  interaction.resetCooldown = () => {};
  interaction.attackEntity({ id: 42 });

  assert.equal(sent.length, 1);
  const r = new Reader774(sent[0]);
  assert.equal(r.varint(), PLAY_SERVERBOUND_774.use_entity);
  assert.equal(r.varint(), 42);
  assert.equal(r.varint(), 1); // attack
  assert.equal(PLAY_SERVERBOUND_774.use_entity, 25);
});
