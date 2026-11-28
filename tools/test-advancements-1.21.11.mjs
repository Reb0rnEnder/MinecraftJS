// Native 1.21.11 AdvancementsScreen / AdvancementTab / AdvancementWidget presentation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ZipFile } from '../lib/zip.js';
import { setTranslator } from '../client/js/gui/i18n.js';
import { setPlatform } from '../client/js/platform/platform.js';
import { Advancements } from '../client/js/game/advancements.js';
import { AdvancementsScreen } from '../client/js/gui/screens/advancements.js';
import { renderLoadingOverlay } from '../client/js/render/loading-overlay.js';
import { Settings } from '../client/js/game/settings.js';

setTranslator((k) => k);
setPlatform({ now: () => 0, loadSetting: () => null, saveSetting() {} });
const jar = new ZipFile(new URL('../cache/port-1.21.11/client.jar', import.meta.url));
const A = (id, parent, title, frame, x, y, reqs) => ({
  id,
  parent,
  criteria: reqs.flat(),
  requirements: reqs,
  display: {
    title: { text: title },
    description: { text: title + ' description text that wraps over lines' },
    icon: { id: 1, count: 1 },
    frame,
    showToast: false,
    hidden: false,
    background: parent ? null : 'minecraft:textures/gui/advancements/backgrounds/stone.png',
    x,
    y
  }
});

function fixture(roots = 2) {
  const calls = { sprite: [], region: [], text: [], blit: [] };
  const sent = [];
  const gui = {
    width: 427,
    height: 240,
    font: {
      width: (s) => String(s).replace(/§./g, '').length * 6,
      trimToWidth: (s, w) => s.slice(0, Math.floor(w / 6)),
      wrap: (s, w) => {
        const words = s.split(' ');
        const out = [];
        let line = '';
        for (const word of words) {
          const t = line ? line + ' ' + word : word;
          if (t.replace(/§./g, '').length * 6 > w && line) {
            out.push(line);
            line = word;
          } else line = t;
        }
        if (line) out.push(line);
        return out;
      }
    },
    textWidth: (s) => String(s).length * 6,
    sprite: (...a) => calls.sprite.push(a),
    spriteRegion: (...a) => calls.region.push(a),
    blit: (...a) => calls.blit.push(a),
    text: (...a) => calls.text.push(a),
    textCentered: (...a) => calls.text.push(a),
    rect() {},
    scissor() {},
    clearScissor() {},
    menuBackground() {},
    tooltip() {},
    button() {}
  };
  const g = {
    gui,
    inWorld: false,
    send: (p) => sent.push(p),
    settings: { keys: { advancements: 'KeyL' } },
    itemRenderer: { drawItem() {} },
    hud: { addToast() {} },
    screens: { open(s) { this.current = s; }, close() { this.closed = true; } }
  };
  g.advancements = new Advancements(g);
  const added = [
    A('story/root', null, 'Minecraft', 0, 0, 0, [['a']]),
    A('story/a', 'story/root', 'Stone Age', 0, 1, 0, [['a']]),
    A('story/b', 'story/a', 'Deeper', 2, 2, 1, [['a'], ['b'], ['c']])
  ];
  if (roots > 1) added.push(A('nether/root', null, 'Nether', 1, 0, 0, [['a']]));
  g.advancements.onPacket({
    reset: true,
    removed: [],
    added,
    progress: [{ id: 'story/root', criteria: { a: 1 } }, { id: 'story/b', criteria: { a: 1, b: null, c: null } }]
  });
  const s = new AdvancementsScreen(g, null);
  g.screens.open(s);
  s.init();
  return { s, g, calls, sent };
}

test('every advancement sprite the screen draws exists in the pinned 1.21.11 jar', () => {
  for (const n of ['task', 'challenge', 'goal']) {
    for (const o of ['obtained', 'unobtained']) {
      assert.ok(jar.read(`assets/minecraft/textures/gui/sprites/advancements/${n}_frame_${o}.png`));
    }
  }
  for (const t of ['above_left', 'above_middle', 'above_right', 'below_left', 'left_top', 'left_bottom', 'right_middle']) {
    for (const sel of ['', '_selected']) {
      assert.ok(jar.read(`assets/minecraft/textures/gui/sprites/advancements/tab_${t}${sel}.png`), t + sel);
    }
  }
  assert.ok(jar.read('assets/minecraft/textures/gui/sprites/advancements/box_obtained.png'));
  assert.ok(jar.read('assets/minecraft/textures/gui/sprites/advancements/box_unobtained.png'));
  assert.ok(jar.read('assets/minecraft/textures/gui/sprites/advancements/title_box.png'));
  assert.ok(jar.read('assets/minecraft/textures/gui/advancements/window.png'));
  assert.equal(jar.read('assets/minecraft/textures/gui/advancements/widgets.png'), null, '1.21.11 has no legacy widget sheet');
});

test('header/footer layout, Done button, tab sprites and the selected tab title', () => {
  const { s, calls } = fixture();
  s.render(s.gui, -1, -1, 0);
  const done = s.buttons[0];
  assert.deepEqual([done.x, done.y, done.w], [Math.floor(427 / 2) - 100, 240 - 26, 200]);
  assert.ok(calls.text.some((t) => t[0] === 'gui.advancements' && t[2] === 12), 'title header');
  assert.ok(calls.text.some((t) => t[0] === 'Minecraft' && t[3] === 0x404040), 'window shows the selected tab title');
  assert.ok(calls.sprite.some((a) => a[0] === 'advancements/tab_above_left_selected'));
  assert.ok(calls.sprite.some((a) => a[0] === 'advancements/tab_above_middle'));
  assert.ok(calls.sprite.some((a) => a[0] === 'advancements/task_frame_obtained'));
  assert.ok(calls.sprite.some((a) => a[0] === 'advancements/goal_frame_unobtained'));
  assert.equal(calls.blit.filter((b) => /advancements\/(widgets|tabs)\.png/.test(b[0])).length, 0);
});

test('a single root shows no tabs; descriptions take the frame colour and hover boxes split by progress', () => {
  const one = fixture(1);
  one.s.render(one.s.gui, -1, -1, 0);
  assert.equal(one.calls.sprite.filter((a) => /tab_/.test(a[0])).length, 0);
  const { s, calls } = fixture();
  const tab = s.selected;
  const w = tab.widgets.find((item) => item.a.id === 'story/b');
  assert.ok(w.description[0].startsWith('§a'), 'goal descriptions are green');
  const L = Math.floor((427 - 252) / 2);
  const T = Math.floor((240 - 140) / 2);
  s.render(s.gui, -1, -1, 0);
  s._drawHover(s.gui, w, L + 9, T + 18, Math.floor(tab.scrollX), Math.floor(tab.scrollY), L);
  assert.equal(calls.region.length, 2);
  assert.equal(calls.region[0][0], 'advancements/box_obtained');
  assert.equal(calls.region[1][0], 'advancements/box_unobtained');
  assert.deepEqual(calls.region.map((r) => [r[1], r[2]]), [[200, 26], [200, 26]]);
  assert.ok(calls.sprite.some((a) => a[0] === 'advancements/title_box'));
});

test('advancements key closes to the game and tells the server the screen closed', () => {
  const { s, g, sent } = fixture();
  const before = sent.length;
  s.key({ code: 'KeyL' });
  assert.equal(g.screens.closed, true);
  assert.equal(sent.length, before + 1);
  assert.equal(g.advancements.listener, null);
});

test('1.16+ Mojang Studios loading logo samples linearly; preloading is off by default', () => {
  const opts = [];
  const gui = {
    width: 427,
    height: 240,
    rect() {},
    quad() {},
    setBlend() {},
    assets: { texture: (p, o) => { opts.push([p, o]); return {}; } }
  };
  renderLoadingOverlay(gui, 0.5);
  assert.deepEqual(opts[0], ['gui/title/mojangstudios.png', { filter: 'linear' }]);
  assert.equal(new Settings().preloadTextures, false);
});
