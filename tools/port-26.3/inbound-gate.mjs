// Byte gate for the inbound Play families added after the particle work. Every frame is built
// from the 26.3 record definition (javap), decoded by the client codec with zero leftover, and
// then adapted to the legacy handler field names.
import {Reader26_3} from '../../client/js/net/configuration-26.3.js';
import {decodePlayPacket} from '../../client/js/net/play-codec-26.3.js';
import {adaptPlay26_3} from '../../client/js/net/play-adapter-26.3.js';
import {PLAY_CLIENTBOUND_26_3} from '../../client/js/net/protocol-26.3-ids.js';
import {SOUND_NAMES_26_3,MOB_EFFECT_NAMES_26_3} from '../../client/js/net/registry-names-26.3.js';
import {EFFECT_766} from '../../client/js/game/effects-1.20.6.js';
import {ITEM_NAMES_26_3,DATA_COMPONENT_NAMES_26_3} from '../../client/js/net/items-26.3.js';

let failures = 0;
const check = (name, fn) => {
  try { fn(); console.log('ok   ' + name); }
  catch (error) { failures++; console.error('FAIL ' + name + ': ' + error.message); }
};
const eq = (actual, expected) => {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a !== b) throw Error('expected ' + b + ', got ' + a);
};
const varlong = value => {
  const out = [];
  let v = BigInt(value);
  do { let byte = Number(v & 0x7fn); v >>= 7n; if (v) byte |= 0x80; out.push(byte); } while (v);
  return out;
};
const varint = value => {
  const out = [];
  let v = value >>> 0;
  do { let byte = v & 0x7f; v >>>= 7; if (v) byte |= 0x80; out.push(byte); } while (v);
  return out;
};
const f32 = value => { const v = new DataView(new ArrayBuffer(4)); v.setFloat32(0, value); return [...new Uint8Array(v.buffer)]; };
const f64 = value => { const v = new DataView(new ArrayBuffer(8)); v.setFloat64(0, value); return [...new Uint8Array(v.buffer)]; };
const i32 = value => { const v = new DataView(new ArrayBuffer(4)); v.setInt32(0, value); return [...new Uint8Array(v.buffer)]; };
const i64 = value => { const v = new DataView(new ArrayBuffer(8)); v.setBigInt64(0, BigInt(value)); return [...new Uint8Array(v.buffer)]; };
const packPos = (x, y, z) => {
  const v = (BigInt(x) & 0x3ffffffn) << 38n | (BigInt(z) & 0x3ffffffn) << 12n | (BigInt(y) & 0xfffn);
  const out = new DataView(new ArrayBuffer(8));
  out.setBigInt64(0, BigInt.asIntN(64, v));
  return [...new Uint8Array(out.buffer)];
};
// Network text component: unnamed NBT StringTag.
// NBT strings are modified UTF-8 with an unsigned-short length, even in network NBT.
const nbtString = text => {
  const bytes = [...Buffer.from(text, 'utf8')];
  return [8, (bytes.length >> 8) & 0xff, bytes.length & 0xff, ...bytes];
};
const uuid = seed => Array.from({ length: 16 }, (_, i) => (seed + i) & 0xff);
const str = text => { const bytes = [...Buffer.from(text, 'utf8')]; return [...varint(bytes.length), ...bytes]; };
const holder = id => varint(id + 1);

function decode(name, body) {
  const frame = Uint8Array.from([...varint(PLAY_CLIENTBOUND_26_3[name]), ...body]);
  const reader = new Reader26_3(frame);
  const packet = decodePlayPacket(reader);
  eq(packet.name, name);
  eq(reader.remaining(), 0);
  return packet;
}
function adapt(name, body, expected) {
  const packet = decode(name, body);
  const adapted = adaptPlay26_3(packet, null);
  if (!adapted) throw Error('adapter skipped ' + name);
  eq(adapted.name, expected.name);
  return adapted;
}

check('animate decodes and adapts to animation', () => {
  const adapted = adapt('animate', [...varint(5), 3], {name: 'animation'});
  eq([adapted.entityId, adapted.animation], [5, 3]);
});

check('border packets decode native fields', () => {
  const init = adapt('initialize_border', [...f64(1), ...f64(2), ...f64(100), ...f64(200), ...varlong(50n), ...varint(29999984), ...varint(5), ...varint(15)], {name: 'initialize_world_border'});
  const center = adapt('set_border_center', [...f64(3), ...f64(4)], {name: 'world_border_center'});
  const lerp = adapt('set_border_lerp_size', [...f64(10), ...f64(20), ...varlong(7n)], {name: 'world_border_lerp_size'});
  eq([init.action, init.x, init.newRadius, init.portalBoundary, center.action, center.z, lerp.action, lerp.newRadius, Number(lerp.speed)], [3, 1, 100, 29999984, 2, 4, 1, 20, 7]);
});

check('player_chat decodes body, last-seen ids and bound type', () => {
  const body=[...varint(9), ...uuid(0), ...varint(2), 0,
    ...str('hello'), ...i64(1234n), ...i64(7n), ...varint(1), ...varint(1),
    0, ...varint(0), ...varint(0), ...nbtString('Steve'), 0];
  const adapted = adapt('player_chat', body, {name: 'player_chat'});
  eq([adapted.sender, adapted.index, JSON.parse(adapted.message).text, JSON.parse(adapted.networkName), adapted.chatType], ['00010203-0405-0607-0809-0a0b0c0d0e0f', 2, 'hello', 'Steve', 0]);
});

check('swing_animation reads id and action', () => {
  const adapted = adapt('swing_animation', [...varint(42), 3], {name: 'swing_animation'});
  eq([adapted.entityId, adapted.animation], [42, 3]);
});

check('map_item_data decodes optional decorations and patch', () => {
  const body=[...varint(5), 2, 1, 1, ...varint(1), ...varint(3), 1, 2, 4, 1, ...nbtString('Steve'),
    1, 1, 2, 3, 4, ...varint(12), ...Array.from({length:12},(_,i)=>i)];
  const adapted = adapt('map_item_data', body, {name: 'map'});
  eq([adapted.itemDamage, adapted.scale, adapted.locked, adapted.icons[0].type, adapted.icons[0].rot, adapted.x, adapted.y, adapted.columns, adapted.rows, adapted.data.length], [5, 2, true, 3, 4, 1, 2, 3, 4, 12]);
});

check('chunks_biomes carries packed positions and section palettes', () => {
  const section = [...Array(24)].flatMap(() => [0, 1]);
  const body = [...varint(1), ...i64((4n << 32n) | 3n), ...varint(section.length), ...section];
  const adapted = adapt('chunks_biomes', body, {name: 'chunk_biomes'});
  eq([adapted.biomes.length, adapted.biomes[0].x, adapted.biomes[0].z, adapted.biomes[0].data.length], [1, 3, 4, 48]);
});

check('set_player_team decodes parameters and players', () => {
  const body=[0, ...str('red'), 1, ...nbtString('Red Team'), ...nbtString('[R]'), ...nbtString(''), ...varint(0), ...varint(2), 0, 1, ...varint(1), ...str('Steve')];
  const adapted = adapt('set_player_team', body, {name: 'teams'});
  eq([adapted.team, adapted.mode, adapted.players, JSON.parse(adapted.displayName), adapted.color, adapted.friendlyFire, adapted.nameTagVisibility, adapted.collisionRule], ['red', 0, ['Steve'], 'Red Team', 15, true, 'always', 'pushOtherTeams']);
});

check('scoreboard score, reset and objective adapt', () => {
  const score = adapt('set_score', [...str('Steve'), ...str('obj'), ...varint(7), 1, ...nbtString('Steve'), 1, ...varint(0)], {name: 'scoreboard_score'});
  eq([score.action, score.itemName, score.scoreName, score.value, JSON.parse(score.displayName), score.numberFormat], [0, 'Steve', 'obj', 7, 'Steve', {type: 'blank'}]);
  const reset = adapt('reset_score', [...str('Steve'), 1, ...str('obj')], {name: 'reset_score'});
  eq([reset.action, reset.itemName, reset.scoreName], [1, 'Steve', 'obj']);
  const objective = adapt('set_objective', [...str('obj'), 0, ...nbtString('Objective'), ...varint(1), 0], {name: 'scoreboard_objective'});
  eq([objective.action, objective.objective, JSON.parse(objective.displayText), objective.type, objective.numberFormat], [0, 'obj', 'Objective', 'hearts', null]);
});

check('player_combat_kill decodes the death screen message', () => {
  const adapted = adapt('player_combat_kill', [...varint(7), ...nbtString('slain by a zombie')], {name: 'death_combat_event'});
  eq([adapted.playerId, JSON.parse(adapted.message)], [7, 'slain by a zombie']);
});

check('initialize_border adapts to the world_border action vocabulary', () => {
  const adapted = adapt('initialize_border', [...f64(8), ...f64(-4), ...f64(100), ...f64(50), ...varlong(2500), ...varint(29999984), ...varint(5), ...varint(15)], {name: 'initialize_world_border'});
  eq([adapted.action, adapted.x, adapted.z, adapted.oldRadius, adapted.newRadius, adapted.speed, adapted.portalBoundary, adapted.warningBlocks, adapted.warningTime], [3, 8, -4, 50, 25, 2500, 29999984, 5, 15]);
});

check('change_difficulty, entity_event and ticking frames adapt', () => {
  const difficulty = adapt('change_difficulty', [2, 1], {name: 'difficulty'});
  eq(difficulty.difficulty, 2);
  const event = adapt('entity_event', [...i32(9), 2], {name: 'entity_status'});
  eq([event.entityId, event.entityStatus], [9, 2]);
  const ticking = adapt('ticking_state', [...f32(20), 1], {name: 'set_ticking_state'});
  eq([ticking.tickRate, ticking.isFrozen], [20, true]);
  const step = adapt('ticking_step', [...varint(3)], {name: 'step_tick'});
  eq(step.tickSteps, 3);
});

check('view center, commands and server data adapt', () => {
  const center = adapt('set_chunk_cache_center', [...varint(12), ...varint(-3)], {name: 'update_view_position'});
  eq([center.chunkX, center.chunkZ], [12, -3]);
  const commands = adapt('commands', [...varint(1), 0, ...varint(0), 0], {name: 'declare_commands'});
  eq([commands.root, commands.nodes.length, commands.nodes[0].type], [0, 1, 0]);
  const server = adapt('server_data', [...nbtString('MOTD'), 0], {name: 'server_data'});
  eq([JSON.parse(server.motd), server.iconBytes], ['MOTD', null]);
});

check('player_info_update maps actions and fields', () => {
  const adapted = adapt('player_info_update', [0x10, ...varint(1), ...uuid(4), ...varint(37)], {name: 'player_info'});
  eq([adapted.actions, adapted.data[0].ping, adapted.data[0].uuid.slice(0, 2)], [16, 37, '04']);
});

check('section_blocks_update unpacks SectionPos and local positions', () => {
  const section = (3n << 44n) | (2n << 22n) | 1n;
  const change = (42n << 12n) | (4n << 8n) | (5n << 4n) | 6n;
  const adapted = adapt('section_blocks_update', [...i64(section), ...varint(1), ...varlong(change)], {name: 'multi_block_change'});
  eq([adapted.chunkX, adapted.chunkZ, adapted.records], [1, 2, [{x: 4, y: 54, z: 5, state: 42}]]);
});

check('custom_payload carries brand and opaque payload bytes', () => {
  const brand = adapt('custom_payload', [...str('minecraft:brand'), ...str('vanilla')], {name: 'custom_payload'});
  eq([brand.channel, new Reader26_3(Uint8Array.from(brand.data)).string()], ['minecraft:brand', 'vanilla']);
  const other = adapt('custom_payload', [...str('example:probe'), 1, 2, 3], {name: 'custom_payload'});
  eq([other.channel, Array.from(other.data)], ['example:probe', [1, 2, 3]]);
});

check('delete_chat decodes packed ids and full signatures', () => {
  const indexed = adapt('delete_chat', [...varint(6)], {name: 'hide_message'});
  eq([indexed.signatureId, indexed.signature], [6, null]);
  const full = Array.from({length: 256}, (_, i) => i & 0xff);
  const complete = adapt('delete_chat', [...varint(0), ...full], {name: 'hide_message'});
  eq([complete.signatureId, complete.signature.length, complete.signature[255]], [0, 256, 255]);
});

check('open_screen decodes and adapts to open_window', () => {
  const adapted = adapt('open_screen', [...varint(3), ...varint(12), ...nbtString('Crafting')], {name: 'open_window'});
  eq([adapted.windowId, adapted.inventoryType, JSON.parse(adapted.windowTitle)], [3, 12, 'Crafting']);
});

check('take_item_entity decodes and adapts to collect', () => {
  const adapted = adapt('take_item_entity', [...varint(7), ...varint(9), ...varint(2)], {name: 'collect'});
  eq([adapted.collectedEntityId, adapted.collectorEntityId, adapted.amount], [7, 9, 2]);
});

check('hurt_animation decodes and adapts', () => {
  const adapted = adapt('hurt_animation', [...varint(11), ...f32(90.5)], {name: 'hurt_animation'});
  eq([adapted.entityId, adapted.yaw], [11, 90.5]);
});

check('block_event decodes and adapts to block_action', () => {
  const adapted = adapt('block_event', [...packPos(1, 64, -3), 5, 6, ...varint(42)], {name: 'block_action'});
  eq([adapted.location, adapted.byte1, adapted.byte2, adapted.blockId], [{ x: 1, y: 64, z: -3 }, 5, 6, 42]);
});

check('level_event decodes and adapts to world_event', () => {
  const adapted = adapt('level_event', [...i32(2001), ...packPos(0, 62, 0), ...i32(33), 1], {name: 'world_event'});
  eq([adapted.type, adapted.location, adapted.data, adapted.global], [2001, { x: 0, y: 62, z: 0 }, 33, true]);
});

check('player_rotation decodes with its relative flags', () => {
  const packet = decode('player_rotation', [...f32(45), 1, ...f32(-10), 0]);
  eq([packet.data.yRot, packet.data.relativeY, packet.data.xRot, packet.data.relativeX], [45, true, -10, false]);
});

check('title text/time/clear adapt to the shared title handler', () => {
  const text = adapt('set_title_text', nbtString('hi'), {name: 'title'});
  eq([text.action, JSON.parse(text.text)], [0, 'hi']);
  const sub = adapt('set_subtitle_text', nbtString('sub'), {name: 'title'});
  eq(sub.action, 1);
  const bar = adapt('set_action_bar_text', nbtString('bar'), {name: 'title'});
  eq(bar.action, 2);
  const times = adapt('set_titles_animation', [...i32(10), ...i32(70), ...i32(20)], {name: 'title'});
  eq([times.action, times.fadeIn, times.stay, times.fadeOut], [3, 10, 70, 20]);
  const clear = adapt('clear_titles', [1], {name: 'title'});
  eq(clear.action, 5);
});

check('system_chat decodes component + overlay', () => {
  const adapted = adapt('system_chat', [...nbtString('hello'), 1], {name: 'system_chat'});
  eq([JSON.parse(adapted.content), adapted.isActionBar], ['hello', true]);
});

check('disguised_chat decodes the bound chat type', () => {
  const adapted = adapt('disguised_chat', [...nbtString('hello'), ...varint(1), ...nbtString('Server'), 0], {name: 'profileless_chat'});
  eq([JSON.parse(adapted.message), JSON.parse(adapted.networkName), adapted.networkTargetName], ['hello', 'Server', null]);
});

check('tab_list decodes header and footer', () => {
  const adapted = adapt('tab_list', [...nbtString('head'), ...nbtString('foot')], {name: 'playerlist_header'});
  eq([JSON.parse(adapted.header), JSON.parse(adapted.footer)], ['head', 'foot']);
});

check('set_passengers decodes the full list', () => {
  const adapted = adapt('set_passengers', [...varint(3), ...varint(2), ...varint(8), ...varint(9)], {name: 'set_passengers'});
  eq([adapted.entityId, adapted.passengers], [3, [8, 9]]);
});

check('set_entity_link decodes and adapts', () => {
  const adapted = adapt('set_entity_link', [...varint(4), ...varint(5)], {name: 'attach_entity'});
  eq([adapted.entityId, adapted.vehicleId], [4, 5]);
});

check('player_info_remove decodes UUIDs', () => {
  const adapted = adapt('player_info_remove', [...varint(1), ...uuid(1)], {name: 'player_remove'});
  eq(adapted.players.length, 1);
});

check('set_cursor_item decodes an empty stack', () => {
  const adapted = adapt('set_cursor_item', [0], {name: 'set_cursor_item'});
  eq(adapted.item, null);
});

check('teleport_entity decodes an absolute teleport', () => {
  const adapted = adapt('teleport_entity', [
    ...varint(12),
    ...f64(1.5), ...f64(64), ...f64(-2.5),
    ...f64(0), ...f64(0), ...f64(0),
    ...f32(90), ...f32(0),
    0, 1,
  ], {name: 'entity_teleport'});
  eq([adapted.entityId, adapted.x, adapted.y, adapted.z, adapted.yaw, adapted.pitch], [12, 1.5, 64, -2.5, 90, 0]);
  eq(adapted.onGround, true);
});

check('relative teleports are skipped instead of misapplied', () => {
  const packet = decode('teleport_entity', [
    ...varint(12), ...f64(1), ...f64(2), ...f64(3), ...f64(0), ...f64(0), ...f64(0), ...f32(0), ...f32(0), 1, 0,
  ]);
  eq(packet.data.relatives, 1);
  eq(adaptPlay26_3(packet, null), null);
});

check('boss_event decodes all six operations', () => {
  const id = uuid(3);
  const added = adapt('boss_event', [...id, ...varint(0), ...nbtString('Boss'), ...f32(0.5), ...varint(1), ...varint(0), 3], {name: 'boss_bar'});
  eq([JSON.parse(added.title), added.health, added.color, added.dividers, added.flags], ['Boss', 0.5, 1, 0, 3]);
  eq(adapt('boss_event', [...id, ...varint(1)], {name: 'boss_bar'}).action, 1);
  eq(adapt('boss_event', [...id, ...varint(2), ...f32(0.75)], {name: 'boss_bar'}).health, 0.75);
  eq(JSON.parse(adapt('boss_event', [...id, ...varint(3), ...nbtString('Renamed')], {name: 'boss_bar'}).title), 'Renamed');
  const styled = adapt('boss_event', [...id, ...varint(4), ...varint(2), ...varint(3)], {name: 'boss_bar'});
  eq([styled.color, styled.dividers], [2, 3]);
  eq(adapt('boss_event', [...id, ...varint(5), 5], {name: 'boss_bar'}).flags, 5);
});

check('sound, sound_entity and stop_sound decode and adapt', () => {
  const sound = adapt('sound', [...holder(1), ...varint(4), ...i32(8), ...i32(-16), ...i32(64), ...f32(0.5), ...f32(1.25), ...i64(7)], {name: 'sound_effect'});
  eq([sound.soundName, sound.x, sound.y, sound.z, sound.volume, sound.pitch], ['entity.allay.ambient_without_item', 1, -2, 8, 0.5, 1.25]);
  eq(Number(sound.seed), 7);
  const inline = adapt('sound', [...varint(0), ...str('minecraft:custom.sound'), ...f32(16), ...varint(9), ...i32(0), ...i32(0), ...i32(0), ...f32(1), ...f32(1), ...i64(0)], {name: 'sound_effect'});
  eq(inline.soundName, 'minecraft:custom.sound');
  const entity = adapt('sound_entity', [...holder(1), ...varint(7), ...varint(12), ...f32(1), ...f32(0.8), ...i64(9)], {name: 'entity_sound_effect'});
  eq([entity.soundName, entity.entityId, entity.soundCategory], [SOUND_NAMES_26_3[1], 12, 7]);
  const stopped = adapt('stop_sound', [3, ...varint(4), ...str('minecraft:block.note_block.pling')], {name: 'stop_sound'});
  eq([stopped.source, stopped.sound], [4, 'minecraft:block.note_block.pling']);
  eq(adapt('stop_sound', [0], {name: 'stop_sound'}), {name: 'stop_sound', source: null, sound: null});
});

check('cooldown, update and remove mob effect decode and adapt', () => {
  const cooldown = adapt('cooldown', [...str('minecraft:ender_pearl'), ...varint(40)], {name: 'set_cooldown'});
  eq([cooldown.itemId, cooldown.cooldownTicks], [ITEM_NAMES_26_3.indexOf('ender_pearl'), 40]);
  const speedWire = MOB_EFFECT_NAMES_26_3.indexOf('speed') + 1;
  const updated = adapt('update_mob_effect', [...varint(3), ...varint(speedWire), ...varint(1), ...varint(200), 8 | 2 | 1], {name: 'entity_effect'});
  eq([updated.entityId, updated.effectId, updated.amplifier, updated.duration], [3, EFFECT_766.speed, 1, 200]);
  eq([updated.ambient, updated.hideParticles, updated.showIcon, updated.shouldBlend], [true, false, false, true]);
  eq(adapt('remove_mob_effect', [...varint(3), ...varint(speedWire)], {name: 'remove_entity_effect'}), {name: 'remove_entity_effect', entityId: 3, effectId: EFFECT_766.speed});
});

check('chunk unload, block entity, sign editor and advancement tab decode', () => {
  const packed = (BigInt(3) & 0xffffffffn) | ((BigInt(-2) & 0xffffffffn) << 32n);
  const unloaded = adapt('forget_level_chunk', i64(packed), {name: 'unload_chunk'});
  eq([unloaded.chunkX, unloaded.chunkZ], [3, -2]);
  const entity = adapt('block_entity_data', [...packPos(1, 64, -3), ...varint(5), 10, 0], {name: 'tile_entity_data'});
  eq([entity.location, entity.nbtData.t], [{x: 1, y: 64, z: -3}, 10]);
  eq(adapt('open_sign_editor', [...packPos(4, 70, 5), ...varint(1)], {name: 'open_sign_entity'}), {name: 'open_sign_entity', location: {x: 4, y: 70, z: 5}, isFrontText: true});
  eq(adapt('open_sign_editor', [...packPos(4, 70, 5), ...varint(0)], {name: 'open_sign_entity'}).isFrontText, false);
  eq(adapt('select_advancements_tab', [1, ...str('minecraft:story/root')], {name: 'select_advancement_tab'}).id, 'minecraft:story/root');
  eq(adapt('select_advancements_tab', [0], {name: 'select_advancement_tab'}).id, null);
});

check('respawn, look_at, open_book and suggestions decode', () => {
  const respawned = adapt('respawn', [...varint(1), ...str('minecraft:overworld'), ...i64(42), ...varint(1), ...varint(0), 1, 0, 0, ...varint(0), ...varint(63), 3], {name: 'respawn'});
  eq([respawned.worldType, respawned.worldName, respawned.hashedSeed, respawned.gameMode, respawned.previousGameMode, respawned.isDebug, respawned.isFlat, respawned.portalCooldown, respawned.seaLevel, respawned.dataToKeep], [1, 'minecraft:overworld', 42, 1, -1, true, false, 0, 63, 3]);
  const look = adapt('player_look_at', [...varint(0), ...f64(1.5), ...f64(64), ...f64(-2.5), 0], {name: 'face_player'});
  eq([look.isEntity, look.x, look.y, look.z, look.entityId], [false, 1.5, 64, -2.5, 0]);
  const lookEntity = adapt('player_look_at', [...varint(1), ...f64(0), ...f64(0), ...f64(0), 1, ...varint(9), ...varint(1)], {name: 'face_player'});
  eq([lookEntity.isEntity, lookEntity.entityId, lookEntity.toAnchor], [true, 9, 1]);
  eq(adapt('open_book', [...varint(1)], {name: 'open_book'}), {name: 'open_book', hand: 1});
  const suggestions = adapt('command_suggestions', [...varint(3), ...varint(1), ...varint(4), ...varint(2), ...str('/say'), 0, ...str('/time'), 1, ...nbtString('t')], {name: 'tab_complete'});
  eq([suggestions.transactionId, suggestions.start, suggestions.length, suggestions.matches.map(m => m.match)], [3, 1, 4, ['/say', '/time']]);
  eq(suggestions.matches[1].tooltip.t, 8);
});

check('chat completions, tag query and display objective decode', () => {
  const completions = adapt('custom_chat_completions', [...varint(0), ...varint(2), ...str('one'), ...str('two')], {name: 'chat_suggestions'});
  eq([completions.action, completions.entries], [0, ['one', 'two']]);
  const query = adapt('tag_query', [...varint(5), ...nbtString('hello')], {name: 'nbt_query_response'});
  eq([query.transactionId, query.nbt.t, query.nbt.v], [5, 8, 'hello']);
  eq(adapt('set_display_objective', [...varint(1), ...str('myscore')], {name: 'scoreboard_display_objective'}), {name: 'scoreboard_display_objective', position: 1, objective: 'myscore'});
});

check('pong and the combat pair decode', () => {
  eq(Number(adapt('pong_response', [...i64(1234)], {name: 'ping_response'}).id), 1234);
  eq(adapt('player_combat_enter', [], {name: 'enter_combat_event'}), {name: 'enter_combat_event'});
  eq(adapt('player_combat_end', [...varint(300)], {name: 'end_combat_event'}).duration, 300);
});

check('distance, camera and radius decode their VarInts', () => {
  eq(adapt('set_simulation_distance', [...varint(12)], {name: 'simulation_distance'}).distance, 12);
  eq(adapt('set_chunk_cache_radius', [...varint(10)], {name: 'update_view_distance'}).viewDistance, 10);
  eq(adapt('set_camera', [...varint(44)], {name: 'camera'}).cameraId, 44);
});

check('move_vehicle decodes PositionAndRotation', () => {
  const adapted = adapt('move_vehicle', [...f64(1.5), ...f64(64), ...f64(-2.25), ...f32(90), ...f32(15)], {name: 'vehicle_move'});
  eq([adapted.x, adapted.y, adapted.z, adapted.yaw], [1.5, 64, -2.25, 90]);
});

check('block_changed_ack decodes the sequence', () => {
  const adapted = adapt('block_changed_ack', [...varint(300)], {name: 'acknowledge_player_digging'});
  eq(adapted.sequenceId, 300);
});

check('block_destruction decodes entity, pos and stage', () => {
  const adapted = adapt('block_destruction', [...varint(7), ...packPos(1, 67, 16), 4], {name: 'block_break_animation'});
  eq([adapted.entityId, adapted.location, adapted.destroyStage], [7, {x: 1, y: 67, z: 16}, 4]);
});

check('update_tags decodes the registry map and adapts to the 766 tag list', () => {
  const body = [...varint(1), ...str('minecraft:block'), ...varint(1), ...str('minecraft:logs'), ...varint(2), ...varint(5), ...varint(9)];
  const adapted = adapt('update_tags', body, {name: 'tags'});
  eq([adapted.tags.length, adapted.tags[0].tagType, adapted.tags[0].tags[0].tagName, adapted.tags[0].tags[0].entries], [1, 'minecraft:block', 'minecraft:logs', [5, 9]]);
});

check('game_rule_values decodes the identifier/string map', () => {
  const packet = decode('game_rule_values', [...varint(1), ...str('minecraft:doFireTick'), ...str('false')]);
  eq(packet.data.values, {'minecraft:doFireTick': 'false'});
});

check('report details, disk warning and mount screens decode', () => {
  eq(decode('custom_report_details', [...varint(1), ...str('contact'), ...str('mail@example.com')]).data.details, {contact: 'mail@example.com'});
  eq(decode('low_disk_space_warning', []).data, {});
  eq(decode('mount_screen_open', [...varint(3), ...varint(9), ...i32(44)]).data, {containerId: 3, inventoryColumns: 9, entityId: 44});
});

check('transient block, debug sample and test frames decode', () => {
  eq(decode('add_transient_block', [...packPos(1, 64, 2), ...varint(100)]).data, {position: {x: 1, y: 64, z: 2}, state: 100});
  eq(adapt('debug_sample', [...varint(2), ...i64(10n), ...i64(20n), ...varint(0)], {name: 'debug_sample'}).sample, [10, 20]);
  eq(decode('game_test_highlight_pos', [...packPos(1, 2, 3), ...packPos(4, 5, 6)]).data, {absolutePos: {x: 1, y: 2, z: 3}, relativePos: {x: 4, y: 5, z: 6}});
  const status = decode('test_instance_block_status', [...nbtString('ok'), 1, ...varint(3), ...varint(4), ...varint(5)]).data;
  eq([status.status.v, status.size], ['ok', {x: 3, y: 4, z: 5}]);
});

check('damage_event decodes the holder, optional ids and position', () => {
  const adapted = adapt('damage_event', [...varint(7), ...varint(3), ...varint(6), ...varint(0), 1, ...f64(1), ...f64(2), ...f64(3)], {name: 'damage_event'});
  eq([adapted.entityId, adapted.sourceTypeId, adapted.sourceCauseId, adapted.sourceDirectId, adapted.sourcePosition], [7, 3, 5, -1, {x: 1, y: 2, z: 3}]);
  const absent = adapt('damage_event', [...varint(8), ...varint(4), ...varint(0), ...varint(0), 0], {name: 'damage_event'});
  eq([absent.sourceCauseId, absent.sourceDirectId, absent.sourcePosition], [-1, -1, null]);
});

check('projectile_power decodes the scalar acceleration', () => {
  const packet = decode('projectile_power', [...varint(11), ...f64(0.5)]);
  eq([packet.data.id, packet.data.accelerationPower], [11, 0.5]);
});

check('merchant_offers decodes costs, offer counters and villager data', () => {
  const damageId = DATA_COMPONENT_NAMES_26_3.indexOf('damage');
  if (damageId < 0) throw Error('native component table has no damage component');
  const cost = (itemId, count, components = []) =>
    [...varint(itemId), ...varint(count), ...varint(components.length), ...components.flat()];
  const body = [
    ...varint(3), ...varint(1),
    ...cost(5, 3, [[...varint(damageId), ...varint(7)]]),
    ...varint(1), ...varint(9), ...varint(0), ...varint(0),
    0, 0,
    ...i32(4), ...i32(12), ...i32(5), ...i32(-1), ...f32(0.05), ...i32(2),
    ...varint(2), ...varint(15), 1, 1
  ];
  const adapted = adapt('merchant_offers', body, {name: 'trade_list'});
  const trade = adapted.trades[0];
  eq([adapted.windowId, adapted.trades.length, trade.a.itemKey, trade.a.count, trade.a.components.damage], [3, 1, ITEM_NAMES_26_3[5], 3, 7]);
  eq([trade.out.count, trade.b, trade.disabled, trade.uses, trade.max, trade.xp, trade.specialPrice, trade.demand], [1, null, false, 4, 12, 5, -1, 2]);
  if (Math.abs(trade.priceMultiplier - 0.05) > 1e-6) throw Error('price multiplier decoded as ' + trade.priceMultiplier);
  eq([adapted.villagerLevel, adapted.experience, adapted.isRegularVillager, adapted.canRestock], [2, 15, true, true]);
});

if (failures) {
  console.error(failures + ' inbound checks failed');
  process.exit(1);
}
console.log('inbound batch: all checks passed');
