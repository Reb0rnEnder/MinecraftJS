import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Button, TextField } from '../client/js/gui/widgets.js';
import { INPUT, changeFocus, nextArrow, setInitialFocus } from '../client/js/gui/focus-navigation.js';
import { Screen, ScreenManager } from '../client/js/gui/screens/manager.js';
import { SlotList } from '../client/js/gui/slot-list.js';
import { setPlatform } from '../client/js/platform/platform.js';

const game = () => ({
  gui: { width: 320, height: 240 },
  input: { locked: false, unlock() {}, lock() {} },
  inWorld: false,
  sound: { playUi() {} },
  screens: null
});
const button = (x, y, w = 98, h = 20) => new Button(0, x, y, w, h, 'button', () => {});

test('Tab follows widget construction order across fields and buttons, wraps, and skips disabled widgets', () => {
  const screen = new Screen(game());
  const beforeField = button(10, 10);
  const field = new TextField(10, 40, 200, 20);
  const afterField = button(10, 70);
  screen.buttons.push(beforeField, afterField);
  screen.fields.push(field);

  assert.equal(screen.key({ code: 'Tab' }), true);
  assert.equal(screen.focusedWidget, beforeField);
  screen.key({ code: 'Tab' });
  assert.equal(screen.focusedWidget, field);
  screen.key({ code: 'Tab' });
  assert.equal(screen.focusedWidget, afterField);
  screen.key({ code: 'Tab' });
  assert.equal(screen.focusedWidget, beforeField);
  screen.key({ code: 'Tab', shift: true });
  assert.equal(screen.focusedWidget, afterField);
  afterField.enabled = false;
  screen.key({ code: 'Tab', shift: true });
  assert.equal(screen.focusedWidget, field);
});

test('initial focus is retained if explicit, otherwise set only after keyboard navigation', () => {
  const screen = new Screen(game());
  const first = button(10, 10);
  screen.buttons.push(first);
  setInitialFocus(screen, INPUT.MOUSE);
  assert.equal(screen.focusedWidget, null);
  assert.equal(first.focused, undefined);
  setInitialFocus(screen, INPUT.TAB);
  assert.equal(screen.focusedWidget, first);

  const field = new TextField(10, 40, 200, 20, { focused: true });
  const explicit = new Screen(game());
  explicit.fields.push(field);
  setInitialFocus(explicit, INPUT.MOUSE);
  assert.equal(explicit.focusedWidget, field);
});

test('arrow navigation finds directional neighbors and skips disabled controls', () => {
  const screen = new Screen(game());
  const wide = button(60, 100, 200), left = button(60, 124), right = button(162, 124), lower = button(162, 148);
  screen.buttons.push(wide, left, right, lower);
  assert.equal(nextArrow(screen, 'ArrowDown'), wide);
  changeFocus(screen, wide);
  assert.equal(nextArrow(screen, 'ArrowDown'), left);
  changeFocus(screen, left);
  assert.equal(nextArrow(screen, 'ArrowRight'), right);
  changeFocus(screen, right);
  assert.equal(nextArrow(screen, 'ArrowDown'), lower);
  lower.enabled = false;
  assert.equal(nextArrow(screen, 'ArrowDown'), null);
});

test('focused sliders handle left/right before general directional focus movement', () => {
  const screen = new Screen(game());
  let changed = 0;
  const slider = Object.assign(button(10, 10), {
    value: 0.5,
    key(event) { if (event.code !== 'ArrowRight') return false; changed++; return true; }
  });
  const neighbor = button(120, 10);
  screen.buttons.push(slider, neighbor);
  changeFocus(screen, slider);
  assert.equal(screen.key({ code: 'ArrowRight' }), true);
  assert.equal(changed, 1);
  assert.equal(screen.focusedWidget, slider);
});

test('mouse clicks focus the activated widget and blank clicks clear ordinary focus', () => {
  const g = game();
  const screen = new Screen(g);
  const first = button(10, 10), second = button(120, 10);
  screen.buttons.push(first, second);
  screen.mouseDown(15, 15, 0);
  assert.equal(screen.focusedWidget, first);
  screen.mouseDown(125, 15, 0);
  assert.equal(screen.focusedWidget, second);
  screen.mouseDown(300, 200, 0);
  assert.equal(screen.focusedWidget, null);
});

test('opening and resizing screens sets initial focus from recent keyboard input', () => {
  const g = game();
  g.screens = new ScreenManager(g);
  const screen = new Screen(g);
  const first = button(10, 10);
  screen.init = () => { screen.buttons.push(button(10, 10)); };
  g.screens.onKey({ code: 'ArrowDown' });
  g.screens.open(screen);
  assert.equal(screen.buttons[0].focused, true);
  screen.onResize();
  assert.equal(screen.buttons[0].focused, true);
  assert.notEqual(screen.buttons[0], first);
});

test('a focused screen list participates in Tab order and receives pointer focus', () => {
  setPlatform({ now: () => 0 });
  const g = game();
  const screen = new Screen(g);
  let clicked = 0;
  const list = new SlotList(screen, 20, 120, 20, { left: 20, width: 180 });
  list.size = () => 3;
  list.clicked = () => { clicked++; return true; };
  screen.list = list;
  const done = button(20, 150);
  screen.buttons.push(done);
  screen.key({ code: 'Tab' });
  assert.equal(screen.focusedWidget, list);
  screen.key({ code: 'Tab' });
  assert.equal(screen.focusedWidget, done);
  screen.mouseDown(80, 30, 0);
  assert.equal(clicked, 1);
  assert.equal(screen.focusedWidget, list);
});
