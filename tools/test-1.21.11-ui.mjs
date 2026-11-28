import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { VANILLA_UI } from '../client/js/gui/vanilla-layout.js';
import { calculateGuiScale, nextGuiScale } from '../client/js/gui/gui-scale.js';
import { titleFade } from '../client/js/gui/title-fade.js';
import { MENU_BLUR, MenuBlur } from '../client/js/render/menu-blur.js';
import { packCompatibility } from '../client/js/resource-pack-compatibility.js';
import { C774, Reader774 } from '../client/js/net/configuration-1.21.11.js';
import { C } from '../client/js/net/packets.js';
import { PLAY_SERVERBOUND_774 } from '../client/js/net/protocol-1.21.11-ids.js';
import {
  OptionsScreen,
  AccessibilityScreen,
  OnlineOptionsScreen,
  CreditsAndAttributionScreen,
  ControlsScreen,
  MouseSettingsScreen,
  KeyBindsScreen,
  LanguageScreen,
  FontOptionsScreen,
} from '../client/js/gui/screens/options.js';
import { PauseScreen } from '../client/js/gui/screens/pause.js';
import { ResourcePacksScreen } from '../client/js/gui/screens/packs.js';
import { TitleScreen, MultiplayerSafetyScreen, ConfirmScreen, AlertScreen, warningLayout } from '../client/js/gui/screens/menus.js';
import { Settings } from '../client/js/game/settings.js';
import { setPlatform } from '../client/js/platform/platform.js';
import { Game } from '../client/js/game/game.js';

setPlatform({
  now: () => 0,
  storage: { getItem: () => null, setItem() {}, get: () => null, set() {} },
  openExternal() {},
});

const require = createRequire(import.meta.url);
const { ZipFile } = require('../lib/zip.js');
const jar = new ZipFile(new URL('../cache/port-1.21.11/client.jar', import.meta.url).pathname);
const uiState = JSON.parse(readFileSync(new URL('./fixtures/ui-state-1.21.11.json', import.meta.url), 'utf8'));

function makeUiGame(w = 854, h = 480, extra = {}) {
  const calls = [];
  const settings = new Settings();
  const game = {
    gui: {
      width: w,
      height: h,
      font: {
        wrap: s => [String(s)],
        trimToWidth: (s, maxW) => String(s).slice(0, Math.max(1, Math.floor(maxW / 6))),
      },
      textWidth: s => String(s).length * 6,
      blit: (...a) => calls.push(['blit', ...a]),
      sprite: (...a) => calls.push(['sprite', ...a]),
      button: (...a) => calls.push(['button', ...a]),
      rect: (...a) => calls.push(['rect', ...a]),
      text: (...a) => calls.push(['text', ...a]),
      textCentered: (...a) => calls.push(['center', ...a]),
      drawImage: (...a) => calls.push(['drawImage', ...a]),
      tex: p => (p ? { path: p, width: 32, height: 32 } : null),
    },
    assets: {
      translate: k => k,
      splashes: ['Test splash!'],
      version: 0,
      source: { bytes: async () => null },
      makeTexture: () => null,
      listPacks: async () => extra.packs || [],
      packs: {
        list: () => extra.packs || [],
        enabled: () => extra.enabled || [],
        setEnabled: () => {},
      },
      languages: [{ code: 'en_us', name: 'English', region: 'US', bidirectional: false }],
    },
    narrator: { active: true, label: () => 'off', cycle() {} },
    settings,
    inWorld: extra.inWorld ?? false,
    screens: { current: null, open: s => { game.screens.current = s; } },
    send: extra.send || (() => {}),
    net: { state: extra.netState || 'play', send: extra.send || (() => {}) },
    ...extra,
  };
  return { game, calls };
}

test('VANILLA_UI metadata and vanilla option/layout screens initialize cleanly at 1.21.11 sizes', () => {
  assert.equal(VANILLA_UI.version, '1.21.11');
  assert.equal(VANILLA_UI.packFormat, 75);
  assert.equal(VANILLA_UI.clientJarSha1, uiState.clientJarSha1);
  assert.equal(VANILLA_UI.accessibilityOptions.length, 24);
  assert.equal(VANILLA_UI.fontOptions.length, 2);

  for (const [w, h] of [[320, 240], [854, 480], [1280, 720]]) {
    for (const Cls of [OptionsScreen, LanguageScreen, PauseScreen, AccessibilityScreen, ControlsScreen]) {
      const { game } = makeUiGame(w, h);
      const s = new Cls(game, null);
      s.init();
      assert.ok(s.buttons.length + (s.rows?.length || 0) >= 2, `${Cls.name} widgets at ${w}x${h}`);
      for (const b of s.buttons) {
        assert.ok(b.x >= 0 && b.x + b.w <= w + 1, `${Cls.name} button in width bounds at ${w}x${h}`);
        assert.ok(b.y >= 0 && b.y + b.h <= h + 1, `${Cls.name} button in height bounds at ${w}x${h}`);
      }
    }
  }
});

test('new Accessibility options construct, retain native order and expose real blur and shortcut settings', () => {
  const { game } = makeUiGame(854, 480);
  const acc = new AccessibilityScreen(game, null);
  acc.init();
  const keys = acc.optionKeys();
  assert.equal(keys.length, 24);
  assert.ok(keys.includes('options.accessibility.menu_background_blurriness'));
  assert.ok(keys.includes('options.accessibility.high_contrast'));
  assert.equal(acc.rows.length, 12);
});

test('Online options includes disabled difficulty only in a world and sends server-listing preference in both phases', () => {
  const menu = makeUiGame(854, 480, { inWorld: false });
  const onlineMenu = new OnlineOptionsScreen(menu.game, null);
  assert.deepEqual(onlineMenu.optionKeys(), ['options.realmsNotifications', 'options.allowServerListing']);

  const world = makeUiGame(854, 480, { inWorld: true });
  const onlineWorld = new OnlineOptionsScreen(world.game, null);
  assert.deepEqual(onlineWorld.optionKeys(), ['options.realmsNotifications', 'options.allowServerListing', 'options.difficulty.online']);

  const cfgBytes = C774.settings('en_us', 8, 0, true, 0x7f, 1, false, 0, true);
  const cfgR = new Reader774(cfgBytes);
  assert.equal(cfgR.varint(), 0); // config serverbound client_information
  assert.equal(cfgR.string(), 'en_us');

  const playBytes = C.settings('en_us', 8, 0, true, 0x7f, 1, false, 0, true);
  const playR = new Reader774(playBytes);
  assert.equal(playR.varint(), PLAY_SERVERBOUND_774.settings);
});

test('Title credits opens attribution menu and menu credits return without sending a respawn', async () => {
  const sent = [];
  const { game } = makeUiGame(854, 480, { send: p => sent.push(p) });
  const attr = new CreditsAndAttributionScreen(game, null);
  attr.init();
  const creditsBtn = attr.buttons.find(b => String(b.label).includes('credits'));
  assert.ok(creditsBtn);
  creditsBtn.onClick();
  await new Promise(r => setTimeout(r, 20));
  assert.ok(game.screens.current?.isCredits);
  assert.equal(game.screens.current.poem, false);
  game.screens.current.finish();
  assert.equal(game.screens.current, attr);
  assert.equal(sent.length, 0);
});

test('menu blur reproduces the native 1.21.11 six box_blur passes and skips disabled blur without allocating targets', () => {
  const blurJson = JSON.parse(jar.read('assets/minecraft/post_effect/blur.json').toString('utf8'));
  assert.deepEqual(MENU_BLUR.targets, Object.keys(blurJson.targets));
  assert.equal(MENU_BLUR.passes.length, blurJson.passes.length);
  assert.equal(MENU_BLUR.passes.length, 6);
  for (let i = 0; i < 6; i++) {
    assert.ok(blurJson.passes[i].fragment_shader.endsWith('box_blur'));
    assert.equal(MENU_BLUR.passes[i].name, 'box_blur');
    assert.equal(MENU_BLUR.passes[i].intarget, blurJson.passes[i].inputs[0].target);
    assert.equal(MENU_BLUR.passes[i].outtarget, blurJson.passes[i].output);
    assert.deepEqual(MENU_BLUR.passes[i].uniforms[0].values, blurJson.passes[i].uniforms.BlurConfig[0].value);
  }

  let created = 0;
  const blur = new MenuBlur({ createFramebuffer: () => { created++; return {}; }, destroyFramebuffer() {} });
  blur.render(0.05); // 0.5px < 1px skips chain allocation
  assert.equal(created, 0);
  assert.equal(blur.chain, null);
});

test('resource-pack compatibility, hover arrows, warnings and keyboard actions work for packFormat 75', () => {
  assert.equal(packCompatibility({ format: 75 }, 75), 'compatible');
  assert.equal(packCompatibility({ format: 32 }, 75), 'old');
  assert.equal(packCompatibility({ format: 99 }, 75), 'new');
  assert.equal(packCompatibility({ min_format: 74, max_format: 76 }, 75), 'compatible');
  assert.equal(packCompatibility({ format: 32, supportedFormats: [74, 75] }, 75), 'compatible');

  const oldPack = { id: 'old', name: 'old', format: 32, description: 'test' };
  const okPack = { id: 'ok', name: 'ok', format: 75, description: 'ok' };
  const { game, calls } = makeUiGame(854, 480, {
    packs: [oldPack, okPack],
    enabled: ['ok'],
  });
  game.assets.packs.list = () => [oldPack, okPack];
  const rps = new ResourcePacksScreen(game, null);
  rps.available = [oldPack];
  rps.selected = [okPack];
  rps.init();

  const rowX = rps.lists[0].list.left;
  const rowY = rps.lists[0].list.top + 4;
  rps._entry(game.gui, rps.lists[0], oldPack, 0, rowX, rowY, rowX + 8, rowY + 8);
  assert.ok(calls.some(c => c[0] === 'sprite' && c[1] === 'transferable_list/select_highlighted'));
  assert.ok(calls.some(c => c[0] === 'text' && c[1] === 'pack.incompatible'));

  calls.length = 0;
  rps._entry(game.gui, rps.lists[1], okPack, 0, rps.lists[1].list.left, rowY, 0, 0);
  assert.ok(!calls.some(c => c[0] === 'text' && String(c[1]).includes('incompatible')));

  rps.selected = [oldPack, okPack];
  rps.lists[1].list.focused = true;
  rps.lists[1].list.focusedIndex = 1;
  rps.key({ code: 'ArrowUp', shift: true });
  assert.deepEqual(rps.selected.map(p => p.id), ['ok', 'old']);
});

test('resource-pack selection always includes required Default, allows moving it, and only persists its non-bottom position', async () => {
  const pack = { id: 'ok', name: 'ok', format: 75, description: 'ok' };
  const settings = new Settings();
  settings.resourcePacks = ['ok'];
  const { game } = makeUiGame(854, 480, { packs: [pack], settings });
  const screen = new ResourcePacksScreen(game, null);
  await screen.loadPromise;
  screen.init();
  assert.deepEqual(screen.selected.map(p => p.id), ['ok', 'vanilla']);
  assert.deepEqual(screen._ids(), ['ok']);
  const vanilla = screen.selected[1];
  const selectedList = screen.lists[1];
  assert.equal(screen._click(selectedList, vanilla, 1, 8, 15, {}), false);
  assert.deepEqual(screen.selected.map(p => p.id), ['ok', 'vanilla']);
  assert.equal(screen._click(selectedList, vanilla, 1, 24, 4, {}), true);
  assert.deepEqual(screen.selected.map(p => p.id), ['vanilla', 'ok']);
  assert.deepEqual(screen._ids(), ['vanilla', 'ok']);
});

test('dropped resource packs are read only after confirmation and rejected files return through an alert', async () => {
  const pack = { id: 'ok', name: 'ok', format: 75, description: 'ok' };
  const { game } = makeUiGame(854, 480, { packs: [pack] });
  const screen = new ResourcePacksScreen(game, null);
  await screen.loadPromise;
  let reads = 0;
  const accepted = { name: 'accepted.zip', readBytes: async () => { reads++; return new Uint8Array([1]); } };
  const rejected = { name: 'rejected.zip', readBytes: async () => { reads++; return new Uint8Array([2]); } };
  game.assets.addPack = async (name, bytes) => {
    if (name === rejected.name) throw new Error('invalid zip');
    return { id: name, name, bytes };
  };

  screen.onFilesDrop([accepted]);
  assert.ok(game.screens.current instanceof ConfirmScreen);
  game.screens.current.init();
  assert.equal(reads, 0);
  await game.screens.current.buttons[1].onClick();
  assert.equal(reads, 0);
  assert.equal(game.screens.current, screen);

  screen.onFilesDrop([accepted, rejected]);
  assert.ok(game.screens.current instanceof ConfirmScreen);
  game.screens.current.init();
  assert.equal(reads, 0);
  await game.screens.current.buttons[0].onClick();
  assert.equal(reads, 2);
  assert.ok(game.screens.current instanceof AlertScreen);
  game.screens.current.init();
  assert.deepEqual(screen.available.map(p => p.id), ['accepted.zip', 'ok']);
  await game.screens.current.buttons[0].onClick();
  assert.equal(game.screens.current, screen);
});

test('15px title icons use native integer centering inside their 20px buttons', () => {
  const { game, calls } = makeUiGame(400, 240);
  const ts = new TitleScreen(game, null);
  ts.init();
  for (const id of [5, 6]) {
    const btn = ts.buttons.find(b => b.id === id);
    assert.ok(btn, `title icon button ${id}`);
    calls.length = 0;
    btn.render(game.gui);
    const sprite = calls.find(c => c[0] === 'sprite');
    assert.ok(sprite);
    assert.equal(sprite[2], btn.x + 3);
    assert.equal(sprite[3], btn.y + 3);
    assert.equal(sprite[4], 15);
    assert.equal(sprite[5], 15);
  }
});

test('Controls uses native option-list layout and routes its first row to mouse/key-bind screens', () => {
  const { game } = makeUiGame(854, 480);
  const controls = new ControlsScreen(game, null);
  controls.init();
  assert.equal(controls.rows[0].length, 2);
  controls.rows[0][0].onClick();
  assert.ok(game.screens.current instanceof MouseSettingsScreen);
  controls.rows[0][1].onClick();
  assert.ok(game.screens.current instanceof KeyBindsScreen);
});

test('GUI scale matches native Window.calculateScale across all 72 fixture states and cycles dynamically', () => {
  assert.equal(uiState.scales.length, 72);
  for (const s of uiState.scales) {
    assert.equal(
      calculateGuiScale(s.size[0], s.size[1], s.requested, s.unicode),
      s.scale,
      `scale mismatch for ${JSON.stringify(s)}`,
    );
  }
  const max = calculateGuiScale(1280, 720, 0, false);
  let cur = 0;
  for (let i = 1; i <= max; i++) {
    cur = nextGuiScale(1280, 720, cur, false);
    assert.equal(cur, i);
  }
  assert.equal(nextGuiScale(1280, 720, cur, false), 0);
});

test('title screen fades widgets over two seconds across all 12 native 1.21.11 frames', () => {
  assert.equal(uiState.titleFade.length, 12);
  for (const f of uiState.titleFade) {
    const js = titleFade(f.elapsed);
    assert.equal(js.fading, f.fading, `fading at ${f.elapsed}`);
    assert.ok(Math.abs(js.widgets - f.widgets) < 1e-6, `widgets at ${f.elapsed}: ${js.widgets} vs ${f.widgets}`);
  }
});

test('LanguageScreen and FontOptionsScreen plus MultiplayerSafetyScreen preserve native bindings', () => {
  const { game, calls } = makeUiGame(854, 480);
  const lang = new LanguageScreen(game, null);
  lang.init();
  const fontBtn = lang.buttons.find(b => b.id === 100);
  fontBtn.onClick();
  assert.ok(game.screens.current instanceof FontOptionsScreen);

  const safety = new MultiplayerSafetyScreen(game, null);
  safety.init();
  const expected = warningLayout(854, 480, Object.assign(s => game.gui.textWidth(s), { title: game.gui.textWidth('§lmultiplayerWarning.header') }), ['§lmultiplayerWarning.header'], game.gui.textWidth('multiplayerWarning.check'));
  assert.equal(safety.buttons[0].id, 2);
  assert.equal(safety.buttons[0].y, safety.layout.checkbox[1]);
  assert.equal(expected.proceed[1], safety.layout.proceed[1]);
  safety.buttons[0].render(game.gui);
  assert.ok(calls.some(c => c[0] === 'sprite' && c[1] === 'widget/checkbox'));
});
