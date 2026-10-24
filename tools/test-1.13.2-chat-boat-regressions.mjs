import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { ZipFile } from '../lib/zip.js';
import { parseClass } from '../lib/classfile.js';
import { walk } from '../lib/bytecode.js';
import { ChatScreen } from '../client/js/gui/screens/chat.js';
import { soundAssetName } from '../client/js/audio/sound.js';
import { initBlocks, findState } from '../client/js/world/blocks.js';
import { BoatController } from '../client/js/game/vehicle.js';
import { World } from '../client/js/world/world.js';
import { Chunk } from '../client/js/world/chunk.js';
const data = n => JSON.parse(readFileSync(new URL('../client/data/' + n + '.json', import.meta.url)));
initBlocks(data('blocks'), data('blockCollisionShapes'));
const jar = new ZipFile(fileURLToPath(new URL('../cache/1.13.2.jar', import.meta.url)));

test('every numeric sound ID follows SoundEvent registration order, including land/water paddles', () => {
  const c = parseClass(jar.read('wi.class'));
  const instructions = [...walk(c.methods.find(m => m.name === 'b' && m.desc === '()V').code)];
  const expected = [];
  for (let i = 1; i < instructions.length; i++) {
    const ins = instructions[i];
    if (ins.op !== 0xb8) continue;
    const ref = c.ref(ins.u2);
    if (ref.owner !== 'wi' || ref.name !== 'a' || ref.desc !== '(Ljava/lang/String;)V') continue;
    const prev = instructions[i - 1];
    assert.ok(prev.op === 0x12 || prev.op === 0x13);
    expected.push({ id: expected.length, name: c.constant(prev.op === 0x12 ? prev.u1 : prev.u2).value });
  }
  assert.equal(expected.length, 662);
  const actual = data('sounds');
  assert.deepEqual(actual, expected, 'name coverage alone cannot detect shifted numeric IDs');
  assert.equal(actual[181].name, 'entity.boat.paddle_land');
  assert.equal(actual[182].name, 'entity.boat.paddle_water');
  const pack = JSON.parse(readFileSync(new URL('../client/assets/minecraft/sounds.json', import.meta.url)));
  for (const s of actual) assert.ok(pack[soundAssetName(s.name)], s.name);
});

function screen(text = '') {
  const sent = [];
  const game = { gui: { width: 320, height: 240 },
    hud: { chatScroll: 0, sentHistory: [], chatComponentAt: () => null, scrollChat() {} },
    send: p => sent.push(p), screens: { close() {} } };
  const s = new ChatScreen(game, text); s.init();
  return { s, sent };
}
const font = { width: s => s.length * 6, trimToWidth: (s, w) => s.slice(0, Math.max(0, Math.floor(w / 6))) };
function render(s, mx = 0, my = 0) {
  const rects = [], texts = [];
  s.render({ font, rect: (...v) => rects.push(v), text: (...v) => texts.push(v), tooltip() {} }, mx, my);
  return { rects, texts };
}
function respond(s, names, start = 1, length = s.input.cursor - start) {
  s.tabComplete();
  s.onTabComplete({ transactionId: s.tabTransaction, start, length, matches: names.map(match => ({ match, tooltip: null })) });
}

test('ordinary chat never requests or displays command completions, including stale responses', () => {
  const { s, sent } = screen('hello');
  try {
    assert.equal(s.tabRequest, null);
    s.tabComplete(); assert.equal(sent.length, 0);
    s.input.setText('/gi'); s.tabComplete();
    const transactionId = s.tabTransaction;
    s.input.setText('give');
    s.onTabComplete({ transactionId, start: 0, length: 4, matches: [{ match: 'give' }] });
    assert.equal(s.tabMatches, null); assert.equal(s.tabRequest, null);
    s.input.setText('/ti'); s.input.setText('ordinary text');
    assert.equal(s.tabRequest, null, 'slash removal cancels queued automatic requests');
    render(s); assert.equal(s.tabBox, null);
  } finally { s.onClose(); }
});

test('popup uses vanilla range anchoring, row insets, full-list width, ghost text and keyboard/mouse scrolling', () => {
  const { s } = screen('/tell Al');
  try {
    const names = ['Alex', 'Alice', ...Array.from({ length: 10 }, (_, i) => 'Al' + i), 'Al_longest_entry'];
    respond(s, names, 6, 2);
    const { rects, texts } = render(s);
    assert.deepEqual(s.tabBox, { x: 39, y: 105, width: 97, rows: 10 });
    assert.ok(rects.some(r => r.join() === [39, 105, 136, 225, 0xd0000000].join()));
    assert.ok(texts.some(t => t[0] === 'Alex' && t[1] === 40 && t[2] === 107 && t[3] === 0xffffff00));
    assert.ok(texts.some(t => t[0] === 'ex' && t[3] === 0xff808080));
    s.key({ code: 'ShiftLeft' });
    assert.ok(s.tabMatches, 'modifier presses preserve the popup for Shift+Tab');
    s.key({ code: 'ArrowDown' }); assert.equal(s.tabIndex, 1);
    assert.equal(s.input.text, '/tell Al', 'arrow selection does not replace text');
    s.tabComplete(); assert.equal(s.input.text, '/tell Alice');
    for (let i = 0; i < 11; i++) s.tabComplete();
    assert.equal(s.tabIndex, 12); assert.equal(s.tabOffset, 3);
    render(s, 42, 107);
    assert.equal(s.tabIndex, 3, 'hover picks the visible row');
    s.wheel(1); assert.equal(s.tabOffset, 2);
    render(s, 42, 119);
    s.mouseDown(42, 119, 0);
    assert.equal(s.input.text, '/tell ' + names[3], 'click applies visible suggestion');
    s.key({ code: 'Escape' }); assert.equal(s.tabMatches, null);
  } finally { s.onClose(); }
});

test('boats retain ice momentum on normal, packed, frosted and blue ice, with blue ice fastest', () => {
  const speeds = {};
  for (const name of ['grass_block', 'ice', 'packed_ice', 'frosted_ice', 'blue_ice']) {
    const w = new World(); const c = new Chunk(0, 0, true); w.chunks.set(World.key(0, 0), c);
    const state = findState(name);
    for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) c.setState(x, 8, z, state);
    const b = new BoatController(w, { x: 8.5, y: 9, z: 8.5, yaw: 0 });
    b.body.motionX = 0.2;
    b.tick({});
    assert.equal(b.status, 'land', name);
    const friction = name === 'grass_block' ? 0.6 : name === 'blue_ice' ? 0.989 : 0.98;
    assert.ok(Math.abs(b.momentum - friction) < 1e-6, name + ' friction');
    assert.ok(Math.abs(b.body.motionX - 0.2 * friction) < 1e-6, name + ' movement');
    speeds[name] = b.body.motionX;
  }
  assert.equal(speeds.ice, speeds.packed_ice);
  assert.equal(speeds.ice, speeds.frosted_ice);
  assert.ok(speeds.blue_ice > speeds.ice && speeds.ice > speeds.grass_block);
});
