// Run: node tools/test-1.13.2-text.mjs
// Uses the local client jar (or MC_JAR), real protocol-404 decoders, game handlers,
// UI consumers and font layout. No network, browser, GPU or downloaded fixtures.
import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { ZipFile } from '../lib/zip.js';
import { Assets } from '../client/js/assets.js';
import { Writer, Reader } from '../client/js/net/buffer.js';
import { decodePacket } from '../client/js/net/packets.js';
import { nbt, TAG, writeNbtRoot } from '../client/js/net/nbt.js';
import { Game } from '../client/js/game/game.js';
import { Scoreboard } from '../client/js/game/scoreboard.js';
import { EntityManager } from '../client/js/game/entities.js';
import { Advancements } from '../client/js/game/advancements.js';
import { EntityRenderer } from '../client/js/render/entity-renderer.js';
import { Hud } from '../client/js/gui/hud.js';
import { FontRenderer, stripCodes } from '../client/js/gui/font.js';
import { chatToLegacy, chatToPlain, setTranslator } from '../client/js/gui/chat.js';
import { MultiplayerScreen, DisconnectedScreen } from '../client/js/gui/screens/menus.js';
import { BookScreen } from '../client/js/gui/screens/book.js';
import { AdvancementsScreen } from '../client/js/gui/screens/advancements.js';
import { CommandMinecartScreen } from '../client/js/gui/screens/commandblock.js';
import { openContainerScreen } from '../client/js/gui/screens/containers.js';
import { Narrator } from '../client/js/gui/narrator.js';
import { decodePng } from '../client/js/util/png.js';
import { setPlatform } from '../client/js/platform/platform.js';

const jar = new ZipFile(process.env.MC_JAR || fileURLToPath(new URL('../cache/1.13.2.jar', import.meta.url)));
const lang = JSON.parse(jar.read('assets/minecraft/lang/en_us.json').toString('utf8'));
const image = decodePng(jar.read('assets/minecraft/textures/font/ascii.png'));
const assets = { lang, image: () => image, texture: () => image, version: 1 };
assets.translate = Assets.prototype.translate.bind(assets);
setTranslator(assets.translate);
setPlatform({ now: () => 1000 });
const font = new FontRenderer({ assets });
const uuid = '00000000-0000-0000-0000-000000000001';
const json = JSON.stringify;
const packet = (id) => new Writer().varint(id);

function decode(w) {
  const p = decodePacket(w.build());
  assert.notEqual(p.name, 'unknown');
  assert.equal(p._extra, undefined, `${p.name}: decoder must consume the entire packet`);
  return p;
}

function game() {
  // Run production handlers without constructing the renderer/network connection.
  const g = Object.create(Game.prototype);
  const calls = [];
  g.gui = {
    width: 640, height: 360, font, assets, calls,
    text: (text) => calls.push(text), textCentered: (text) => calls.push(text),
    textWidth: (text) => font.width(text), tex: () => null,
    rect() {}, blit() {}, drawImage() {},
  };
  g.settings = { chatScale: 1, chatWidth: 1, servers: [{ name: 'Local', host: 'localhost', port: 25565 }] };
  g.assets = assets;
  g.username = 'Viewer'; g.entityId = 999;
  g.screens = { current: null, open(screen) { this.current = screen; } };
  g.entityRenderer = { remove() {}, skinFor() {} };
  g.narrator = { onChat() {} };
  g.interaction = {};
  g.entities = new EntityManager(g);
  g.scoreboard = new Scoreboard(g);
  g.hud = new Hud(g);
  g.advancements = new Advancements(g);
  return g;
}

function deliver(g, w) {
  const p = decode(w);
  // Unlike handlePacket's logging catch, let a consumer exception fail the test.
  g['on_' + p.name](p);
  return p;
}

function renders(actual, expected) {
  assert.equal(stripCodes(actual), stripCodes(expected), 'visible text');
  const a = font.layout(actual, 0, 0, 0xffffff, false), b = font.layout(expected, 0, 0, 0xffffff, false);
  assert.equal(a.width, b.width, 'formatted width');
  assert.equal(a.quads.length, b.quads.length, 'glyph/decorations count');
  for (let i = 0; i < a.quads.length; i++) {
    const { tex: at, ...aq } = a.quads[i], { tex: bt, ...bq } = b.quads[i];
    assert.equal(at, bt, `glyph ${i} texture`);
    assert.deepEqual(aq, bq, `glyph ${i} style and position`);
  }
}

function teamPacket(mode = 0, color = 10, prefix = { text: '[P]', color: 'red', bold: true }, suffix = { text: '!' }) {
  const w = packet(0x47).string('red-team').i8(mode);
  if (mode === 0 || mode === 2) w.string(json({ text: 'Team', color: 'gold' })).i8(3).string('always').string('always').varint(color).string(json(prefix)).string(json(suffix));
  if (mode === 0 || mode === 3 || mode === 4) w.varint(1).string('Alex');
  return w;
}

function metadata(w, name) {
  w.u8(2).varint(5).bool(name !== null);
  if (name !== null) w.string(name);
  return w.u8(3).varint(7).bool(true).u8(0xff);
}

function label(g, e) {
  const labels = [];
  const renderer = {
    game: g, r: { camPos: [0, 64, 0] }, device: {},
    makeLabel(text) { labels.push(text); return { node: { position: { set() {} } }, meshes: [] }; },
  };
  EntityRenderer.prototype._updateNameTag.call(renderer, e, { root: { position: { y: 64 }, add() {} } }, { x: 0, y: 64, z: 0 });
  return labels;
}

test('plain legacy, arbitrary JSON-looking and malformed strings are preserved verbatim', () => {
  for (const text of ['§aLegacy §lName§r', '  plain  ', 'null', ' true ', '001', '1e3', '{"foo":1}', '{}', '[]', '[red, blue]', '# literal', 'hello // literal', "'quoted'", '{"text":', '{text:"bad\\uZZZZ"}', '{"text":"ok","extra":"oops"}', '{"text":"ok","extra":[null]}', '{"translate":"x","with":{}}']) {
    assert.equal(chatToLegacy(text), text, text);
  }
  assert.equal(chatToLegacy(null), '');
  assert.equal(chatToLegacy(undefined), '');
  assert.equal(chatToPlain('§aLegacy §lName§r'), 'Legacy Name');
});

test('serialized roots decode once; component text/extra/with strings stay literal', () => {
  const literal = '{"text":"literal JSON","color":"red"}';
  assert.equal(chatToLegacy(json(literal)), literal);
  assert.equal(chatToLegacy(literal, { parsed: true }), literal);
  assert.equal(chatToPlain(literal, { parsed: true }), literal);
  assert.equal(chatToPlain({ text: literal, extra: [literal] }), literal + literal);
  assert.equal(chatToPlain({ translate: 'chat.type.text', with: ['Alex', literal] }), '<Alex> ' + literal);
  assert.equal(chatToPlain(json(['a', { text: 'b' }, 3, false])), 'ab3false');
});

test('recognized lenient component syntax is still accepted', () => {
  renders(chatToLegacy("/* component */ {text='Hello';color:'green';extra:[{text: '!',bold:true}]}"), '§aHello§a§l!');
});

test('nested extra styles inherit, explicit false clears, and following siblings recover', () => {
  const c = { text: 'A', color: 'red', bold: true, extra: [
    { text: 'B', bold: false, extra: [{ text: 'C', italic: true }] },
    { text: 'D' }, { text: 'E', color: 'reset', bold: false },
  ] };
  renders(chatToLegacy(c), '§c§lA§cB§c§oC§c§lD§rE');
});

test('nested array roots parent later siblings by their first component, not their last child', () => {
  const c = [[{ text: 'A', color: 'red', bold: true }, { text: 'B', color: 'blue', bold: false }], { text: 'C' }];
  renders(chatToLegacy(c), '§c§lA§9B§c§lC');
});

test('translation arguments clear disabled inherited styles and restore surrounding text', () => {
  const c = { translate: 'chat.type.text', bold: true, italic: true, with: [
    { text: 'Alex', bold: false, italic: false }, { text: 'hello', italic: false },
  ], extra: [{ text: '!' }] };
  renders(chatToLegacy(c), '§l§o<§rAlex§r§l§o> §r§lhello§r§l§o!');
  const nested = { translate: 'chat.type.announcement', color: 'gold', with: [
    { translate: 'container.chest', color: 'aqua' }, { translate: 'multiplayer.player.joined', with: [{ text: 'Alex', color: 'red' }] },
  ] };
  renders(chatToLegacy(nested), '§6[§bChest§6] §cAlex§6 joined the game');
});

test('positional/repeated translation arguments and percent escapes retain styles', () => {
  const translate = Assets.prototype.translate.bind({ lang: { test: '%2$s / %1$s / %2$s %%' } });
  setTranslator(translate);
  try {
    renders(chatToLegacy({ translate: 'test', bold: true, with: [{ text: 'A', bold: false }, { text: 'B', color: 'blue' }] }), '§9§lB§r§l / §rA§r§l / §9§lB§r§l %');
  } finally { setTranslator(assets.translate); }
});

test('JSON null styles inherit and reset color does not discard inherited decorations', () => {
  renders(chatToLegacy({ text: 'A', color: 'red', bold: true, extra: [{ text: 'B', color: null, bold: null }, { text: 'C', color: 'reset' }] }), '§c§lAB§r§lC');
});

test('explicit root style false clears caller formatting; inherited tooltip styles remain overridable', () => {
  renders('§o' + chatToLegacy({ text: 'A', italic: false }) + 'B', 'AB');
  renders(chatToLegacy({ text: 'A', italic: false, extra: [{ text: 'B', italic: true }] }, { style: { color: 'gold', italic: true } }), '§6A§6§oB');
  for (const [style, code] of [['underlined', 'n'], ['strikethrough', 'm']]) {
    renders(chatToLegacy({ text: 'A', [style]: true, extra: [{ text: 'B', [style]: false }, { text: 'C' }] }), `§${code}A§rB§${code}C`);
  }
  renders(chatToLegacy({ text: '', obfuscated: true, extra: [{ text: 'A', obfuscated: false }] }), 'A');
});

test('empty components stay empty; formatted components reset before concatenated plain text', () => {
  assert.equal(chatToLegacy({ text: '', color: 'red', extra: [{ text: '' }] }), '');
  renders(chatToLegacy({ text: 'A', color: 'red', bold: true }) + 'B', '§c§lA§rB');
  assert.equal(chatToPlain({ score: { name: 'Alex', objective: 'wins', value: '42' } }), '42');
  assert.equal(chatToPlain({ selector: '@a' }), '@a');
  assert.equal(chatToPlain({ keybind: 'key.jump' }), 'key.jump'); // no settings resolver installed
});

test('objective create/update and team create/update reach sidebar and tab GUI as styled text', () => {
  const g = game();
  deliver(g, packet(0x45).string('wins').i8(0).string(json({ text: 'Wins', color: 'gold' })).varint(0));
  deliver(g, packet(0x3e).i8(1).string('wins'));
  deliver(g, teamPacket());
  deliver(g, packet(0x48).string('Alex').varint(0).string('wins').varint(7));
  deliver(g, packet(0x30).varint(0).varint(1).uuid(uuid).string('Alex').varint(0).varint(0).varint(5).bool(false));
  g.hud.renderSidebar(g.gui);
  g.hud.renderTabList(g.gui);
  assert.ok(g.gui.calls.includes(g.scoreboard.objectives.get('wins').displayName));
  renders(g.scoreboard.objectives.get('wins').displayName, '§6Wins');
  renders(g.scoreboard.teams.get('red-team').displayName, '§6Team');
  const formatted = g.scoreboard.formatName('Alex');
  assert.ok(g.gui.calls.filter((s) => s === formatted).length >= 2, 'sidebar and tab use the formatted team name');
  renders(formatted, '§c§l[P]§aAlex!');
  renders(g.scoreboard.displayName(uuid), '§c§l[P]§aAlex!');
  deliver(g, packet(0x45).string('wins').i8(2).string(json({ translate: 'container.chest' })).varint(1));
  assert.equal(stripCodes(g.scoreboard.objectives.get('wins').displayName), 'Chest');
  assert.equal(g.scoreboard.objectives.get('wins').scores.get('Alex'), 7);
  deliver(g, teamPacket(2, 9, { text: '[Q]' }, { text: '?', italic: true }));
  renders(g.scoreboard.formatName('Alex'), '§9[Q]Alex§9§o?');
  deliver(g, teamPacket(4));
  assert.equal(g.scoreboard.formatName('Alex'), 'Alex');
  deliver(g, teamPacket(1));
  assert.equal(g.scoreboard.teams.size, 0);
  deliver(g, packet(0x45).string('wins').i8(1));
  assert.equal(g.scoreboard.sidebar, null);
});

test('scoreboard identifiers and score-entry names that look like JSON remain literal', () => {
  const g = game(), name = '{"text":"literal entry"}';
  deliver(g, packet(0x45).string(name).i8(0).string('§aLegacy objective').varint(0));
  deliver(g, packet(0x48).string(name).varint(0).string(name).varint(1));
  assert.equal(g.scoreboard.objectives.get(name).displayName, '§aLegacy objective');
  assert.equal(g.scoreboard.formatName(name), name);
  assert.equal(g.scoreboard.objectives.get(name).scores.get(name), 1);
});

test('player-info display names distinguish absent from explicitly empty components', () => {
  const g = game();
  deliver(g, packet(0x30).varint(0).varint(1).uuid(uuid).string('Alex').varint(0).varint(0).varint(5).bool(true).string(json({ text: 'Alias', color: 'aqua' })));
  const p = g.scoreboard.players.get(uuid);
  renders(g.scoreboard.tabName(p), '§bAlias');
  deliver(g, packet(0x30).varint(3).varint(1).uuid(uuid).bool(true).string(json({ text: '' })));
  assert.equal(g.scoreboard.tabName(p), '');
  deliver(g, packet(0x30).varint(3).varint(1).uuid(uuid).bool(false));
  assert.equal(g.scoreboard.tabName(p), 'Alex');
});

test('optional-chat metadata updates, unrelated deltas and removal reach entity labels', () => {
  const g = game();
  g.entities.add({ id: 7, kind: 'armorstand', height: 1.975, metadata: {} });
  const raw = json({ text: 'Hologram', color: 'aqua', extra: [{ text: '!', bold: true }] });
  deliver(g, metadata(packet(0x3f).varint(7), raw));
  const e = g.entities.get(7);
  assert.equal(e.metadata[2], raw, 'raw metadata remains available');
  renders(label(g, e)[0], '§bHologram§b§l!');
  deliver(g, packet(0x3f).varint(7).u8(0).varint(0).i8(0).u8(0xff));
  renders(e.customName, '§bHologram§b§l!');
  deliver(g, metadata(packet(0x3f).varint(7), null));
  assert.equal(e.customName, '');
  assert.deepEqual(label(g, e), []);
  deliver(g, metadata(packet(0x3f).varint(7), '§aLegacy entity'));
  assert.equal(e.customName, '§aLegacy entity');
  const literal = '{"text":"literal name"}';
  deliver(g, metadata(packet(0x3f).varint(7), json({ text: literal })));
  assert.equal(stripCodes(e.customName), literal);
});

test('spawn-mob and spawn-player metadata also normalize optional chat', () => {
  const g = game(), name = json({ translate: 'container.chest', color: 'gold' });
  deliver(g, metadata(packet(0x03).varint(8).uuid(uuid).varint(9).f64(0).f64(64).f64(0).u8(0).u8(0).u8(0).i16(0).i16(0).i16(0), name));
  renders(label(g, g.entities.get(8))[0], '§6Chest');
  deliver(g, metadata(packet(0x05).varint(9).uuid(uuid).f64(0).f64(64).f64(0).u8(0).u8(0), name));
  renders(g.entities.get(9).customName, '§6Chest');
  assert.deepEqual(label(g, g.entities.get(9)), [], 'player labels use their profile/team name, not metadata');
});

test('chat, title/action bar, boss bar and tab header/footer use the shared converter', () => {
  const g = game();
  const c = { translate: 'chat.type.text', bold: true, with: [{ text: 'Alex', bold: false }, 'hello'] };
  const expected = '§l<§rAlex§r§l> hello';
  deliver(g, packet(0x0e).string(json(c)).i8(0));
  renders(g.hud.chat[0].text, expected);
  renders(g.hud.chatLines[0].text, expected);
  deliver(g, packet(0x0e).string(json(c)).i8(2));
  renders(g.hud.actionBar, expected);
  for (const [action, field] of [[0, 'title'], [1, 'subtitle'], [2, 'actionBar']]) {
    deliver(g, packet(0x4b).varint(action).string(json(c)));
    renders(g.hud[field], expected);
  }
  deliver(g, packet(0x0c).uuid(uuid).varint(0).string(json(c)).f32(1).varint(0).varint(0).u8(0));
  renders(g.hud.bossBars.get(uuid).name, expected);
  deliver(g, packet(0x0c).uuid(uuid).varint(3).string(json({ text: 'New', color: 'red' })));
  renders(g.hud.bossBars.get(uuid).name, '§cNew');
  deliver(g, packet(0x4e).string(json(c)).string(json({ text: 'Footer', color: 'blue' })));
  renders(g.scoreboard.header, expected);
  renders(g.scoreboard.footer, '§9Footer');
});

test('disconnect reasons are decoded once before the disconnected screen', () => {
  const g = game(), literal = '{"text":"literal reason"}';
  deliver(g, packet(0x1b).string(json({ text: literal })));
  const screen = new DisconnectedScreen(g, 'Disconnected', g.kickReason);
  screen.init(); screen.renderContent(g.gui);
  assert.ok(g.gui.calls.includes(literal));
});

test('status description is already decoded JSON: primitive descriptions must not be reparsed', () => {
  const g = game(), screen = new MultiplayerScreen(g, null);
  screen.init();
  for (const description of [{ text: 'MOTD', color: 'green', extra: [{ text: '!', bold: true }] }, '{"text":"literal MOTD"}', '§aLegacy MOTD', ['one', { text: 'two', color: 'red' }]]) {
    // Status response is an outer JSON document, unlike play-state chat strings.
    const r = new Reader(packet(0x00).string(json({ description, ping: 5 })).build());
    assert.equal(r.varint(), 0);
    const status = JSON.parse(r.string());
    screen.pings.set('localhost:25565', { status });
    g.gui.calls.length = 0;
    screen.list.drawSlot(g.gui, 0, 0, 40, 36, -1, -1);
    const expected = typeof description === 'string' ? description : Array.isArray(description) ? 'one§ctwo' : '§aMOTD§a§l!';
    renders(g.gui.calls[1], expected);
  }
});

test('sign NBT and written-book pages convert once; editable book text stays literal', () => {
  const g = game(), literal = '{"text":"literal"}';
  let lines;
  g.tileRenderer = { setSign(pos, text) { lines = text; } };
  const tag = { t: TAG.COMPOUND, name: '', v: {
    id: nbt.string('minecraft:sign'), x: nbt.int(0), y: nbt.int(64), z: nbt.int(0),
    Text1: nbt.string(json({ text: 'Sign', color: 'blue' })), Text2: nbt.string(json({ text: literal })),
    Text3: nbt.string('§aLegacy'), Text4: nbt.string(''),
  } };
  const w = packet(0x09).position(0, 64, 0).u8(9);
  writeNbtRoot(w, tag);
  deliver(g, w);
  renders(lines[0], '§9Sign');
  assert.equal(stripCodes(lines[1]), literal);
  assert.equal(lines[2], '§aLegacy');
  const pages = [json({ text: 'Book', color: 'red' }), json({ text: literal })];
  g.items = { nbt: () => ({ pages }) };
  const book = new BookScreen(g, { id: 1 }, false);
  renders(book.pages[0], '§cBook');
  assert.equal(stripCodes(book.pages[1]), literal);
  assert.deepEqual(new BookScreen(g, { id: 1 }, true).pages, pages);
});

test('open-window titles pass through the real container foreground renderer', () => {
  const g = game();
  for (const title of [{ translate: 'container.chest', color: 'gold' }, { text: '{"text":"literal"}' }, '§aLegacy chest']) {
    g.gui.calls.length = 0;
    deliver(g, packet(0x14).u8(1).string('minecraft:chest').string(typeof title === 'string' ? title : json(title)).u8(27));
    g.screens.current.drawForeground(g.gui);
    renders(g.gui.calls[0], typeof title === 'string' ? title : title.text || '§6Chest');
  }
});

test('advancement packet title/description components reach the screen layout', () => {
  const g = game();
  const w = packet(0x51).bool(true).varint(1).string('test:root').bool(false).bool(true)
    .string(json({ translate: 'container.chest', color: 'gold' }))
    .string(json({ text: 'Details', color: 'aqua', extra: [{ text: '!', bold: true }] }))
    .slot(null).varint(0).i32(0).f32(0).f32(0)
    .varint(1).string('done').varint(1).varint(1).string('done')
    .varint(0).varint(0);
  deliver(g, w);
  const a = g.advancements.map.get('test:root');
  const screen = new AdvancementsScreen(g, null);
  const widget = screen._widget(a, null);
  renders(widget.title, '§6Chest');
  renders(widget.description.join(''), '§bDetails§b§l!');
});

test('hover text and command output decode at their boundary exactly once', () => {
  const g = game(), literal = '{"text":"this is literal JSON"}';
  const raw = json({ text: 'Hover', hoverEvent: { action: 'show_text', value: literal } });
  g.hud.addChat(chatToLegacy(raw), raw);
  assert.equal(g.hud.chatLines[0].comps[0].hoverText, literal);
  const screen = new CommandMinecartScreen(g, { metadata: { 1: '', 2: json(literal) } }, 1, 2);
  assert.equal(screen.output, literal);
  const malformed = new CommandMinecartScreen(g, { metadata: { 2: 'Plain server output' } }, 1, 2);
  assert.equal(malformed.output, 'Plain server output');
});

test('narration leaves already-decoded translation argument strings literal', () => {
  const g = game(); g.settings.narrator = 1;
  const narrator = new Narrator(g), heard = [];
  Object.defineProperty(narrator, 'active', { value: true });
  narrator.say = s => heard.push(s);
  const literal = '{"text":"literal"}';
  narrator.onChat(0, { translate: 'chat.type.text', with: ['Alex', literal] });
  assert.ok(heard[0].includes(literal));
});

test('anvil rename field uses plain visible names and refreshes same-ID renamed stacks', () => {
  const g = game();
  let first = { id: 493, label: { text: 'Blade', color: 'red', italic: false } };
  g.items = { displayName: it => chatToLegacy(json(it.label)) };
  const win = { type: 'minecraft:anvil', title: 'Anvil', get: i => i === 0 ? first : null };
  openContainerScreen(g, win);
  const screen = g.screens.current;
  screen.init(); screen.tick();
  assert.equal(screen.nameField.text, 'Blade');
  first = { id: 493, label: { text: '{"text":"literal"}', bold: true } };
  screen.tick();
  assert.equal(screen.nameField.text, '{"text":"literal"}');
  assert.equal(screen.nameField.cursor, screen.nameField.text.length);
});
