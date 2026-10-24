import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { Reader, Writer } from '../client/js/net/buffer.js';
import { C, decodePacket } from '../client/js/net/packets.js';
import { ChatScreen } from '../client/js/gui/screens/chat.js';
import { LocalPlayer } from '../client/js/game/physics.js';
import { findState, initBlocks } from '../client/js/world/blocks.js';
import { Items } from '../client/js/game/items.js';
import { Interaction } from '../client/js/game/interaction.js';
import { soundAssetName } from '../client/js/audio/sound.js';

const data = name => JSON.parse(readFileSync(new URL('../client/data/' + name + '.json', import.meta.url)));
initBlocks(data('blocks'), data('blockCollisionShapes'));

test('1.13.2 tab-complete request carries only the transaction and text fields accepted by protocol 404 servers', () => {
  const noPos = new Reader(C.tabComplete('/gi', null, 17));
  assert.equal(noPos.varint(), 0x05);
  assert.equal(noPos.varint(), 17);
  assert.equal(noPos.string(), '/gi');
  assert.equal(noPos.remaining(), 0);

  const withPos = new Reader(C.tabComplete('Alex', { x: -2, y: 64, z: 9 }, 18));
  assert.equal(withPos.varint(), 0x05); assert.equal(withPos.varint(), 18); assert.equal(withPos.string(), 'Alex');
  assert.equal(withPos.remaining(), 0);
});

test('clientbound tab-complete decodes ranges and optional chat tooltips', () => {
  const bytes = new Writer().varint(0x10).varint(4).varint(5).varint(2).varint(2)
    .string('Alex').bool(false).string('/give').bool(true).string('{"text":"Give item"}').build();
  const p = decodePacket(bytes);
  assert.equal(p.name, 'tab_complete'); assert.equal(p.transactionId, 4); assert.equal(p.start, 5); assert.equal(p.length, 2);
  assert.deepEqual(p.matches, [{ match: 'Alex', tooltip: null }, { match: '/give', tooltip: '{"text":"Give item"}' }]);
  assert.equal(p._extra, undefined);
});

test('chat completion opens automatically, matches vanilla popup behavior, preserves suffix text and cycles matches', () => {
  const sent = [], lines = [];
  const game = {
    gui: { width: 320, height: 240 },
    hud: { chatScroll: 0, sentHistory: [], addChat: text => lines.push(text), chatComponentAt: () => null },
    interaction: { target: null }, send: bytes => sent.push(bytes), screens: { close() {} },
  };
  const screen = new ChatScreen(game, ''); screen.init();
  assert.equal(screen.input.maxLength, 256, '1.13.2 chat input limit');
  screen.input.setText('/tell Al rest'); screen.input.cursor = 8; screen.input.selEnd = 8;
  assert.ok(screen.tabRequest, 'editing the field schedules vanilla-style automatic completion');
  screen.tabComplete();
  const request = new Reader(sent[0]);
  assert.equal(request.varint(), 0x05); const transaction = request.varint();
  assert.equal(request.string(), '/tell Al'); assert.equal(request.remaining(), 0);
  screen.onTabComplete({ name: 'tab_complete', transactionId: transaction, start: 6, length: 2,
    matches: [{ match: 'Alex', tooltip: null }, { match: 'Alice', tooltip: null }] });
  assert.equal(screen.input.text, '/tell Al rest', 'response opens popup without applying a match');
  assert.equal(lines.length, 0, 'suggestions are not echoed into chat');
  const drawn = { boxes: 0, text: 0 };
  screen.render({ rect: () => { drawn.boxes++; }, text: () => { drawn.text++; }, tooltip: () => {}, font: { width: s => s.length * 6, trimToWidth: s => s } }, 0, 0);
  assert.equal(drawn.boxes, 3, 'vanilla-style popup, chat bar and cursor'); assert.equal(drawn.text, 3, 'two suggestions plus input');
  screen.tabComplete(); assert.equal(screen.input.text, '/tell Alex rest'); assert.equal(screen.input.cursor, 10);
  screen.tabComplete(); assert.equal(screen.input.text, '/tell Alice rest');
  screen.tabComplete(true); assert.equal(screen.input.text, '/tell Alex rest');
});

test('protocol sound-event names resolve to the 1.13.2 resource-pack sound keys', () => {
  const aliases = {
    'block.note.harp': 'block.note_block.harp',
    'entity.enderdragon.shoot': 'entity.ender_dragon.shoot',
    'entity.magmacube.hurt': 'entity.magma_cube.hurt',
    'entity.small_slime.hurt': 'entity.slime.hurt_small',
    'entity.zombie_pig.hurt': 'entity.zombie_pigman.hurt',
    'record.cat': 'music_disc.cat',
  };
  for (const [wire, asset] of Object.entries(aliases)) assert.equal(soundAssetName(wire), asset);
});

test('sprint-swimming uses the 1.13 pose, hitbox and eye height while leaving normal water movement intact', () => {
  const water = findState('water', { level: 0 });
  const world = {
    isLoaded: () => true,
    getState: () => water,
    getCollisions: () => [],
  };
  const p = new LocalPlayer(); p.setPosition(0.5, 1, 0.5); p.sprinting = true;
  p.tick(world, { forward: true, sprint: true, jump: false, sneak: false, autoJump: false });
  assert.equal(p.inWater, true); assert.equal(p.swimming, true);
  assert.equal(p.height, Math.fround(0.6)); assert.equal(p.eyeHeight(), Math.fround(0.4));
  assert.ok(Math.hypot(p.motionX, p.motionY, p.motionZ) > 0, 'swimming still advances through water');
  p.tick({ ...world, getState: () => 0 }, { forward: false, sprint: false, jump: false, sneak: false, autoJump: false });
  assert.equal(p.swimming, false); assert.equal(p.height, Math.fround(1.8));
});

test('tridents enter spear-use state and send the 1.13 release-use packet after charging', () => {
  const assets = { data: { items: data('items'), creative: data('creative') } };
  const items = new Items(assets), trident = { id: items.byName.get('trident').id, count: 1, damage: 0 };
  assert.equal(items.useAction(trident), 'spear'); assert.equal(items.useDuration(trident), 72000);
  const sent = [], game = {
    gameMode: 0, items, inventory: { getHand: () => trident, armor: [null, null, null, null] },
    send: bytes => sent.push(bytes), cooldownFraction: () => 0, food: 20, player: { usingItem: false }, target: null,
  };
  const interaction = new Interaction(game);
  assert.equal(interaction.sendUseItem(trident, 0), true);
  assert.equal(game.player.usingItem, true); assert.equal(interaction.useTicks, 0);
  const start = new Reader(sent[0]); assert.equal(start.varint(), 0x2a); assert.equal(start.varint(), 0);
  interaction.useTicks = 10; interaction.stopUsingItem();
  const release = new Reader(sent[1]); assert.equal(release.varint(), 0x18); assert.equal(release.varint(), 5);
});
