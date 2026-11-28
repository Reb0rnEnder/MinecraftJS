import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CreditsScreen, creditLines } from '../client/js/gui/screens/credits.js';
import { setPlatform } from '../client/js/platform/platform.js';

const textAsset = name => readFileSync(new URL('../client/assets/minecraft/' + name, import.meta.url), 'utf8');

test('scroll advances per frame by elapsed ticks, not per tick, and supports speedups/credits.json', async () => {
  let now = 1000;
  setPlatform({ now: () => now });
  let finished = 0;
  const game = {
    gui: {
      width: 400,
      height: 240,
      font: { wrap: s => [s] },
      textWidth: s => String(s).length * 6,
      fillRect() {},
      rect() {},
      tex() { return null; },
      texBlit() {},
      blit() {},
      quad() {},
      drawMesh() {},
      pushMatrix() {},
      popMatrix() {},
      translate() {},
      scale() {},
      text() {},
      resetTint() {},
    },
    device: { width: 400, height: 240, createMesh: () => ({}), destroyMesh() {}, draw() {} },
    assets: {
      texture: () => null,
      readText: async p => textAsset(p),
    },
    player: { name: 'Steve' },
    username: 'Steve',
    settings: { keys: {} },
    screens: { open() {}, close() {} },
    send() {},
    net: { send() {} },
  };
  const screen = new CreditsScreen(game, { poem: true, onFinished: () => { finished++; } });
  await screen._load();
  assert.ok(screen.lines.length > 100, '1.21.11 credits loaded');
  assert.ok(screen.lines.some(l => l && (l.text ?? l.line ?? String(l)).includes('Steve')), 'PLAYERNAME substituted in end.txt');

  screen.tick();
  assert.equal(screen.scroll, 0, 'tick() does not advance scroll');

  screen.render(game.gui, 0, 0, 0);
  assert.equal(screen.scroll, 0, 'first frame initializes lastFrame');

  now += 50; // 1 tick
  screen.render(game.gui, 0, 0, 0);
  assert.equal(screen.scroll, 0.5, 'poem advances 0.5 per tick');

  screen.key({ code: 'Space' });
  now += 50;
  screen.render(game.gui, 0, 0, 0);
  assert.equal(screen.scroll, 3.0, 'Space gives 5x speed (2.5 per tick)');

  screen.key({ code: 'ControlLeft' });
  now += 50;
  screen.render(game.gui, 0, 0, 0);
  assert.equal(screen.scroll, 13.0, 'Ctrl+Space gives 20x speed (10.0 per tick)');

  screen.key({ code: 'ArrowUp' });
  now += 50;
  screen.render(game.gui, 0, 0, 0);
  assert.equal(screen.scroll, 3.0, 'ArrowUp reverses scroll direction');

  screen.key({ code: 'Escape' });
  assert.equal(finished, 1, 'Escape invokes finished callback');

  const lines = creditLines(JSON.parse(textAsset('texts/credits.json')));
  assert.ok(lines.length > 50, '1.21.11 credits.json section/disciplines parsed');
});
