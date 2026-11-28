// Native 26.3 dialog fixtures. The NBT shapes come from Dialog.DIRECT_CODEC and the
// CommonDialogData/ActionButton MapCodecs, whose fields are flattened into one compound.
import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDialog263, parseDialogRegistry263} from '../client/js/net/dialog-26.3.js';
import {adaptPlay26_3} from '../client/js/net/play-adapter-26.3.js';
import {DialogScreen263, instantiateTemplate, scaledRangeValue} from '../client/js/gui/screens/dialog-26.3.js';

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
const F = value => ({t: 5, v: value});
const input = (key, type, fields = {}) => C({key: S(key), type: S('minecraft:' + type), ...fields});
const dialogInputs = L(
  input('name', 'text', {label: text('Name'), width: I(180), initial: S('Steve'), max_length: I(24)}),
  input('loud', 'boolean', {label: text('Loud'), initial: B(true), on_true: S('yes'), on_false: S('no')}),
  input('amount', 'number_range', {
    label: text('Amount'), width: I(180), label_format: S('options.generic_value'),
    range_info: C({start: F(1), end: F(10), initial: F(4), step: F(1)})
  }),
  input('mood', 'single_option', {
    label: text('Mood'), width: I(180),
    options: L(S('calm'), C({id: S('loud'), display: text('Loud'), initial: B(true)}))
  })
);

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
  assert.equal(screen.buttons.length, 4); // two links, exit button and the warning button
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
  assert.equal(screen.buttons.length, 2);
  assert.equal(screen.buttons[0].label, 'Continue');
  assert.equal(screen.buttons[1].label, '!');
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

test('item bodies keep the native stack template, decorations and description width', () => {
  const dialog = parseDialog263(C({
    type: S('minecraft:notice'), title: text('Item'),
    body: L(C({
      type: S('minecraft:item'),
      item: C({id: S('minecraft:diamond'), count: I(3)}),
      description: C({contents: text('Shiny'), width: I(80)}),
      show_decorations: B(false), show_tooltip: B(true),
      width: I(32), height: I(20)
    }))
  }));
  const body = dialog.bodies[0];
  assert.equal(body.type, 'item');
  assert.equal(body.itemId, 'diamond');
  assert.equal(body.count, 3);
  assert.equal(body.description.text, 'Shiny');
  assert.equal(body.descriptionWidth, 80);
  assert.equal(body.showDecorations, false);
  assert.equal(body.showTooltip, true);
  assert.deepEqual([body.width, body.height], [32, 20]);
});

test('native dialog inputs parse and feed templates/custom payloads', () => {
  const dynamic = C({type: S('minecraft:dynamic/run_command'), template: S('say $(name) $(loud) $(amount) $(mood)')});
  const dialog = parseDialog263(C({
    type: S('minecraft:notice'),
    title: text('Inputs'),
    inputs: dialogInputs,
    action: button('Run', dynamic)
  }));
  assert.equal(dialog.inputCount, 4);
  assert.deepEqual(dialog.inputs.map(input => [input.key, input.type]), [
    ['name', 'text'], ['loud', 'boolean'], ['amount', 'number_range'], ['mood', 'single_option']
  ]);
  assert.equal(dialog.inputs[0].maxLength, 24);
  assert.equal(dialog.inputs[0].labelVisible, true);
  assert.equal(dialog.inputs[1].onTrue, 'yes');
  assert.deepEqual([dialog.inputs[2].start, dialog.inputs[2].end, dialog.inputs[2].initial, dialog.inputs[2].step], [1, 10, 4, 1]);
  assert.equal(dialog.inputs[3].entries[1].display.text, 'Loud');

  const sent = [];
  const game = {
    gui: {width: 320, height: 240, font: {wrap: (text) => [text]}},
    send: (bytes) => sent.push(bytes),
    screens: {close: () => {}, open: () => {}}
  };
  const screen = new DialogScreen263(game, dialog);
  screen.init();
  assert.equal(screen.fields.length, 1);
  assert.equal(screen.controls.length, 4);

  screen.fields[0].setText('Buffy "quoted"');
  screen.controls[1].widget.selected = false;
  screen.controls[2].widget.value = 1;
  screen.controls[3].widget.onClick();
  const values = screen.inputValues();
  assert.equal(values.name.value, 'Buffy "quoted"');
  assert.equal(values.name.template, 'Buffy \\"quoted\\"');
  assert.equal(values.loud.value, false);
  assert.equal(values.loud.template, 'no');
  assert.equal(values.amount.value, 10);
  assert.equal(values.amount.tag.t, 5);
  assert.equal(values.mood.value, 'calm');
  assert.equal(instantiateTemplate('say $(name) $(loud) $(amount) $(mood)', values), 'say Buffy \\"quoted\\" no 10 calm');

  screen.buttons.find(button => button.label === 'Run').onClick();
  assert.equal(sent.length, 1);
  assert.equal(scaledRangeValue(dialog.inputs[2], 0), 1);
  assert.equal(scaledRangeValue(dialog.inputs[2], 0.5), 6);
});

test('multiline text inputs accept line breaks and respect max_length', () => {
  const dialog = parseDialog263(C({
    type: S('minecraft:notice'), title: text('Multiline'),
    inputs: L(input('notes', 'text', {
      label: text('Notes'), initial: S('a'), max_length: I(8),
      multiline: C({max_lines: I(3), height: I(40)})
    }))
  }));
  assert.deepEqual(dialog.inputs[0].multiline, {maxLines: 3, height: 40});
  const screen = new DialogScreen263({
    gui: {width: 320, height: 240, font: {wrap: (text) => [text]}},
    send: () => {}, screens: {close: () => {}, open: () => {}}
  }, dialog);
  screen.init();
  const field = screen.fields[0];
  field.focused = true;
  assert.equal(field.key({code: 'Enter'}), true);
  field.char('b');
  assert.equal(field.text, 'a\nb');
  assert.equal(screen.inputValues().notes.value, 'a\nb');
});

test('dynamic_custom merges the input tags into the additions compound', () => {
  const action = C({type: S('minecraft:dynamic/custom'), id: S('example:act'), additions: C({fixed: S('x')})});
  const dialog = parseDialog263(C({
    type: S('minecraft:notice'),
    title: text('Custom'),
    inputs: dialogInputs,
    action: button('Send', action)
  }));
  const sent = [];
  const game = {
    gui: {width: 320, height: 240, font: {wrap: (text) => [text]}},
    send: (bytes) => sent.push(bytes),
    screens: {close: () => {}, open: () => {}}
  };
  const screen = new DialogScreen263(game, dialog);
  screen.init();
  assert.deepEqual(screen.dialog.buttons[0].action, {
    type: 'dynamic_custom', id: 'example:act', additions: C({fixed: S('x')})
  });
  screen.buttons.find(button => button.label === 'Send').onClick();
  assert.equal(sent.length, 1);
});

test('wait_for_response leaves the holder open for clear_dialog', () => {
  let closed = 0;
  const dialog = parseDialog263(C({
    type: S('minecraft:notice'), title: text('Wait'), after_action: S('wait_for_response'),
    action: button('Run', command('run'))
  }));
  const game = {
    gui: {width: 320, height: 240, font: {wrap: (text) => [text]}},
    send: () => {},
    screens: {close: () => { closed++; }, open: () => {}}
  };
  const screen = new DialogScreen263(game, dialog);
  screen.init();
  screen.buttons[0].onClick();
  assert.equal(closed, 0);
});

test('unsupported dialog types fail closed instead of presenting guessed UI', () => {
  assert.throws(() => parseDialog263(C({type: S('minecraft:unknown'), title: text('No')})), /Unsupported 26\.3 dialog type/);
});
