// Native 26.3 dialog fixtures. The NBT shapes come from Dialog.DIRECT_CODEC and the
// CommonDialogData/ActionButton MapCodecs, whose fields are flattened into one compound.
import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDialog263, parseDialogRegistry263} from '../client/js/net/dialog-26.3.js';
import {adaptPlay26_3} from '../client/js/net/play-adapter-26.3.js';
import {DialogScreen263} from '../client/js/gui/screens/dialog-26.3.js';

const S = value => ({t: 8, v: value});
const I = value => ({t: 3, v: value});
const B = value => ({t: 1, v: value ? 1 : 0});
const C = value => ({t: 10, v: value});
const L = (...items) => ({t: 9, items, itemType: 10});
const text = value => C({text: S(value)});
const emptyRegistry = () => ({byId: new Map(), byKey: new Map()});
const button = (label, action = null, width = 150) => C({
  label: text(label),
  ...(width === 150 ? {} : {width: I(width)}),
  ...(action ? {action} : {})
});
const command = (value) => C({type: S('minecraft:run_command'), command: S(value)});
const url = (value) => C({type: S('minecraft:open_url'), url: S(value)});

const notice = C({
  type: S('minecraft:notice'),
  title: text('Notice title'),
  external_title: text('Notice external'),
  can_close_with_escape: B(false),
  pause: B(false),
  after_action: S('none'),
  body: L(C({type: S('minecraft:plain_message'), contents: text('First body'), width: I(120)})),
  action: button('Continue', command('say hello'))
});

const confirmation = C({
  type: S('minecraft:confirmation'),
  title: text('Confirm?'),
  yes: button('Yes', command('confirm yes')),
  no: button('No', url('https://example.invalid/no'))
});

const multi = C({
  type: S('minecraft:multi_action'),
  title: text('Choose'),
  actions: L(button('One', command('one')), button('Two'), button('Three', command('three'))),
  exit_action: button('Exit', command('exit')),
  columns: I(3)
});

test('notice dialog keeps flattened common/button fields and its cancel action', () => {
  const dialog = parseDialog263(notice);
  assert.equal(dialog.type, 'notice');
  assert.equal(dialog.title.text, 'Notice title');
  assert.equal(dialog.externalTitle.text, 'Notice external');
  assert.equal(dialog.canCloseWithEscape, false);
  assert.equal(dialog.pause, false);
  assert.equal(dialog.afterAction, 'none');
  assert.equal(dialog.bodies.length, 1);
  assert.equal(dialog.bodies[0].type, 'plain_message');
  assert.equal(dialog.bodies[0].component.text, 'First body');
  assert.equal(dialog.bodies[0].width, 120);
  assert.equal(dialog.buttons.length, 1);
  assert.equal(dialog.buttons[0].label.text, 'Continue');
  assert.deepEqual(dialog.buttons[0].action, {type: 'run_command', command: 'say hello'});
  assert.deepEqual(dialog.onCancel, dialog.buttons[0].action);
});

test('confirmation uses yes/no and no is the cancel action', () => {
  const dialog = parseDialog263(confirmation);
  assert.equal(dialog.buttons.length, 2);
  assert.equal(dialog.buttons[0].label.text, 'Yes');
  assert.equal(dialog.buttons[1].label.text, 'No');
  assert.deepEqual(dialog.onCancel, {type: 'open_url', url: 'https://example.invalid/no'});
});

test('multi_action keeps columns, action order and exit_action', () => {
  const dialog = parseDialog263(multi);
  assert.equal(dialog.columns, 3);
  assert.deepEqual(dialog.buttons.map(button => button.label.text), ['One', 'Two', 'Three']);
  assert.equal(dialog.buttons[1].action, null);
  assert.deepEqual(dialog.exitAction.action, {type: 'run_command', command: 'exit'});
  assert.deepEqual(dialog.onCancel, {type: 'run_command', command: 'exit'});
});

test('bare component body is a plain message and dialog_list builds nested buttons', () => {
  const bare = C({
    type: S('minecraft:notice'),
    title: text('Bare'),
    body: L(text('Bare body'))
  });
  assert.equal(parseDialog263(bare).bodies[0].component.text, 'Bare body');

  const list = C({
    type: S('minecraft:dialog_list'),
    title: text('List'),
    dialogs: L(
      C({type: S('minecraft:notice'), title: text('First'), external_title: text('First external')}),
      C({type: S('minecraft:notice'), title: text('Second')})
    ),
    columns: I(2)
  });
  const dialog = parseDialog263(list);
  assert.deepEqual(dialog.buttons.map(entry => entry.label.text), ['First external', 'Second']);
  assert.equal(dialog.buttons[0].action.type, 'open_dialog');
  assert.equal(dialog.buttons[0].action.dialog.title.text, 'First');
});

test('registry holders resolve by key and id, including static show_dialog actions', () => {
  const registry = parseDialogRegistry263({registries: new Map([
    ['minecraft:dialog', [{id: 4, key: 'minecraft:nested', value: notice}]]
  ])});
  const holderButton = button('Nested', C({type: S('show_dialog'), dialog: S('minecraft:nested')}));
  const dialog = parseDialog263(C({
    type: S('minecraft:notice'),
    title: text('Root'),
    action: holderButton
  }), registry);
  assert.equal(dialog.buttons[0].action.type, 'open_dialog');
  assert.equal(dialog.buttons[0].action.dialog.title.text, 'Notice title');
  assert.equal(registry.byId.get(4), notice);
});

test('show_dialog and clear_dialog adapt through the 26.3 packet bridge', () => {
  const inline = adaptPlay26_3({
    name: 'show_dialog', decoded: true, data: {dialogId: null, dialog: notice}
  }, {dialogs: emptyRegistry()});
  assert.equal(inline.name, 'show_dialog');
  assert.equal(inline.dialogId, null);
  assert.equal(inline.dialog.title.text, 'Notice title');

  const registry = emptyRegistry();
  registry.byId.set(3, confirmation);
  const byId = adaptPlay26_3({
    name: 'show_dialog', decoded: true, data: {dialogId: 3}
  }, {dialogs: registry});
  assert.equal(byId.dialog.type, 'confirmation');
  assert.equal(byId.dialog.buttons[0].label.text, 'Yes');

  const missing = adaptPlay26_3({
    name: 'show_dialog', decoded: true, data: {dialogId: 99}
  }, {dialogs: registry});
  assert.equal(missing, null);

  const cleared = adaptPlay26_3({name: 'clear_dialog', decoded: true, data: {}}, {dialogs: registry});
  assert.deepEqual(cleared, {name: 'clear_dialog'});
});

test('server_links packet supplies the dialog buttons', () => {
  const packet = adaptPlay26_3({
    name: 'server_links', decoded: true, data: {links: [
      {type: 0, name: null, link: 'https://example.invalid/bugs'},
      {type: null, name: C({text: S('Custom link')}), link: 'https://example.invalid/custom'}
    ]}
  }, {});
  assert.equal(packet.name, 'server_links');
  assert.equal(packet.links[0].type, 0);
  assert.equal(packet.links[1].name.text, 'Custom link');

  const dialog = parseDialog263(C({
    type: S('minecraft:server_links'),
    title: text('Links'),
    columns: I(2),
    button_width: I(120),
    exit_action: button('Back', command('back'))
  }));
  const screen = new DialogScreen263({
    gui: {width: 320, height: 240, font: {wrap: (text) => [text]}},
    serverLinks: packet.links,
    screens: {close: () => {}, open: () => {}},
    send: () => {}
  }, dialog);
  screen.init();
  assert.equal(screen.buttons.length, 3); // two links plus the exit button
  assert.equal(screen.buttons[0].label, 'known_server_link.report_bug');
  assert.equal(screen.buttons[1].label, 'Custom link');
  assert.equal(screen.buttons[0].w, 120);
  assert.equal(screen.buttons[2].label, 'Back');
  assert.deepEqual(screen.dialog.buttons[0].action, {type: 'open_url', url: 'https://example.invalid/bugs'});
});

test('dialog screen presents native buttons and runs a notice action', () => {
  const sent = [];
  let closed = 0;
  const game = {
    gui: {width: 320, height: 240, font: {wrap: (text) => [text]}},
    send: (bytes) => sent.push(bytes),
    screens: {close: () => { closed++; }}
  };
  const screen = new DialogScreen263(game, parseDialog263(notice));
  screen.init();
  assert.equal(screen.buttons.length, 1);
  assert.equal(screen.buttons[0].label, 'Continue');
  screen.buttons[0].onClick();
  assert.equal(sent.length, 1);
  assert.equal(closed, 0); // notice.after_action is none
  assert.equal(screen.key({code: 'Escape'}), true);
  assert.equal(closed, 0); // can_close_with_escape is false
});

test('dialog screen closes after an action when after_action is close', () => {
  let closed = 0;
  const game = {
    gui: {width: 320, height: 240, font: {wrap: (text) => [text]}},
    send: () => {},
    screens: {close: () => { closed++; }}
  };
  const dialog = parseDialog263(C({
    type: S('minecraft:notice'),
    title: text('Close me'),
    action: button('OK', command('ok'))
  }));
  const screen = new DialogScreen263(game, dialog);
  screen.init();
  screen.buttons[0].onClick();
  assert.equal(closed, 1);
});

test('unsupported dialog types fail closed instead of presenting guessed UI', () => {
  assert.throws(() => parseDialog263(C({type: S('minecraft:unknown'), title: text('No')})), /Unsupported 26\.3 dialog type/);
});
