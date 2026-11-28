// Every Protocol 777 serverbound id must have a real sender or a recorded scope
// decision. This also pins the 26.3 chat ids and the extra LastSeenMessages checksum
// byte, which the 1.20.6 table does not have.
import test from 'node:test';
import assert from 'node:assert/strict';
import {C, chatState263} from '../client/js/net/packets.js';
import {PLAY_SERVERBOUND_26_3 as OUT} from '../client/js/net/protocol-26.3-ids.js';
import {Reader26_3} from '../client/js/net/configuration-26.3.js';

const SENDERS = {
  accept_teleportation: 'teleportConfirm', attack: 'useEntity', block_entity_tag_query: 'queryBlockNbt',
  bundle_item_selected: 'bundleItemSelected', change_difficulty: 'setDifficulty',
  change_game_mode: 'changeGameMode', chat_ack: 'chatAck', chat_command: 'chat',
  chat_command_signed: 'signedCommand', chat: 'chat', chat_session_update: 'chatSession',
  chunk_batch_received: 'chunkBatchReceived', client_command: 'clientCommand',
  client_tick_end: 'clientTickEnd', client_information: 'settings', command_suggestion: 'tabComplete',
  configuration_acknowledged: 'configurationAcknowledged', container_button_click: 'enchantItem',
  container_click: 'windowClick', container_close: 'closeWindow',
  container_slot_state_changed: 'setSlotState', cookie_response: 'cookieResponse',
  custom_payload: 'customPayload', debug_subscription_request: 'debugSampleSubscription',
  edit_book: 'editBook', entity_tag_query: 'queryEntityNbt', interact: 'useEntity',
  jigsaw_generate: 'generateStructure', keep_alive: 'keepAlive', lock_difficulty: 'lockDifficulty',
  move_player_pos: 'position', move_player_pos_rot: 'positionLook', move_player_rot: 'look',
  move_player_status_only: 'flying', move_vehicle: 'vehicleMove', paddle_boat: 'steerBoat',
  pick_item_from_block: 'pickItem', pick_item_from_entity: 'pickItemFromEntity',
  ping_request: 'pingRequest', place_recipe: 'placeRecipe', player_abilities: 'abilities',
  player_action: 'blockDig', player_command: 'entityAction', player_input: 'steerVehicle',
  player_loaded: 'playerLoaded', pong: 'pong', punch: 'armAnimation',
  recipe_book_change_settings: 'recipeBookSettings', recipe_book_seen_recipe: 'recipeInfoShown',
  rename_item: 'nameItem', resource_pack: 'resourcePackStatus', seen_advancements: 'seenAdvancements',
  select_trade: 'selectTrade', set_beacon: 'setBeaconEffects', set_carried_item: 'heldItemSlot',
  set_command_block: 'updateCommandBlock', set_command_minecart: 'updateCommandMinecart',
  set_creative_mode_slot: 'creativeSlot', set_game_rule: 'setGameRule',
  set_jigsaw_block: 'updateJigsaw', set_structure_block: 'updateStructure',
  set_test_block: 'setTestBlock', sign_update: 'updateSign', spectator_action: 'spectatorAction',
  teleport_to_entity: 'spectate', use_item_on: 'blockPlace', use_item: 'useItem',
  custom_click_action: 'customClickAction'
};
const SCOPED = {
  test_instance_block_action: 'gametest block editor; no client screen and the server command path owns it'
};

test('every serverbound 26.3 id has a sender or a scope decision', () => {
  assert.equal(Object.keys(OUT).length, 69);
  for (const id of Object.keys(OUT)) {
    if (SCOPED[id]) assert.ok(SCOPED[id].length > 10, id);
    else {
      assert.ok(SENDERS[id], `unaccounted serverbound id ${id}`);
      assert.equal(typeof C[SENDERS[id]], 'function', `missing sender C.${SENDERS[id]} for ${id}`);
    }
  }
  for (const id of [...Object.keys(SENDERS), ...Object.keys(SCOPED)]) assert.ok(id in OUT, `unknown id ${id}`);
});

function reader(bytes) { return new Reader26_3(bytes); }

test('26.3 chat uses the renamed chat id and the checksum byte', () => {
  let r = reader(C.chat('hello', {now: 1234, salt: 4n}));
  assert.equal(r.varint(), OUT.chat);
  assert.equal(r.string(), 'hello');
  assert.equal(r.i64(), 1234n);
  assert.equal(r.i64(), 4n);
  assert.equal(r.bool(), false);
  assert.equal(r.varint(), 0);
  assert.deepEqual([...r.rest()], [0, 0, 0, 0]);
  assert.equal(r.remaining(), 0);

  r = reader(C.chat('/say hi'));
  assert.equal(r.varint(), OUT.chat_command);
  assert.equal(r.string(), 'say hi');
  assert.equal(r.remaining(), 0);
});

test('26.3 chat acknowledgement carries the checksum and the native id', () => {
  chatState263.reset();
  chatState263.process(new Uint8Array(256));
  const ack = reader(chatState263.flush());
  assert.equal(ack.varint(), OUT.chat_ack);
  assert.equal(ack.varint(), 1);
  assert.equal(ack.remaining(), 0);

  const r = reader(C.chat('ack test', {now: 1, salt: 0n}));
  assert.equal(r.varint(), OUT.chat);
  assert.equal(r.string(), 'ack test');
  r.i64(); r.i64(); r.bool();
  assert.equal(r.varint(), 0);
  assert.deepEqual([...r.rest()], [0, 0, 8, 0]);
});

test('signed command appends the 26.3 checksum after the acknowledgement bitset', () => {
  const bytes = C.signedCommand('say hi', {timestamp: 9, salt: 3n, acknowledged: new Uint8Array(3)});
  const r = reader(bytes);
  assert.equal(r.varint(), OUT.chat_command_signed);
  assert.equal(r.string(), 'say hi');
  assert.equal(r.i64(), 9n);
  assert.equal(r.i64(), 3n);
  assert.equal(r.varint(), 0);
  assert.equal(r.varint(), 0);
  assert.deepEqual([...r.rest()], [0, 0, 0, 0]);
  assert.equal(r.remaining(), 0);
});
