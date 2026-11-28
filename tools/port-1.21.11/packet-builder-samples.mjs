// Exercise the actual runtime protocol-774 senders, independently decoded/re-encoded by native 1.21.11 Java.
import { C, chatState774 } from '../../client/js/net/packets.js';
import { C774, Reader774 } from '../../client/js/net/configuration-1.21.11.js';
import { ChatState774 } from '../../client/js/net/chat-state-1.21.11.js';
import { PLAY_SERVERBOUND_774 } from '../../client/js/net/protocol-1.21.11-ids.js';
import { publicKey } from './packet-samples.mjs';

export function builderSamples() {
  const pos = { x: 16777217, y: -63, z: -33554431 };
  const uuid = '12345678-1234-4234-8234-123456789abc';
  const slot = { id: 1, count: 12, componentPatch: { added: [], removed: [] } };
  const damagedSlot = { id: 1, count: 1, componentPatch: { added: [{ type: 'damage', data: 5 }], removed: ['repair_cost'] } };
  const signature = new Uint8Array(256).fill(0xa5);
  const acknowledged = new Uint8Array([0x81, 0xff, 0x0f]);

  const calls = [
    ['teleportConfirm', [234]],
    ['chunkBatchReceived', [3.5]],
    ['keepAlive', [0x123456789abcdef0n]],
    ['pong', [-72]],
    ['playerLoaded', []],
    ['tickEnd', []],
    ['customClickAction', ['minecraft:fixture', null]],
    ['customClickAction', ['minecraft:fixture', { t: 10, v: { ok: { t: 1, v: 1 } } }]],
    ['settings', ['en_us', 32, 1, true, 0x7f, 1, false, 2, true]],
    ['customPayload', ['minecraft:brand', new Uint8Array([1, 65])]],
    ['clientCommand', [1]],
    ['tabComplete', ['kill @e[type=', null, 25]],
    ['closeWindow', [129]],
    ['flying', [true]],
    ['flying', [false, true]],
    ['position', [1.25, -63.75, 3.125, true, false]],
    ['look', [90, -40, false, true]],
    ['positionLook', [1, 2, 3, 95, -60, true, true]],
    ['vehicleMove', [1, 2, 3, 40, -20, true]],
    ['steerBoat', [true, false]],
    ['abilities', [2]],
    ['entityAction', [122, 5, 90]],
    ['playerInput', [{ forward: true, shift: true, sprint: true }]],
    ['steerVehicle', [-1, 1, 3]],
    ['heldItemSlot', [8]],
    ['armAnimation', [1]],
    ['spectate', [uuid]],
    ['useEntity', [23, 0, 0, 0, 0, 1, true]],
    ['useEntity', [23, 1, 0, 0, 0, 0, false]],
    ['useEntity', [23, 2, 0.25, 0.5, 0.75, 0, true]],
    ['blockDig', [0, pos.x, pos.y, pos.z, 2, 35]],
    ['blockPlace', [pos.x, pos.y, pos.z, 2, 1, 0.25, 0.5, 0.75, true, 36, false]],
    ['blockPlace', [pos.x, pos.y, pos.z, 1, 0, 0.5, 1.0, 0.5, false, 37, true]],
    ['useItem', [1, 37, 90, -15]],
    ['queryBlockNbt', [73, pos.x, pos.y, pos.z]],
    ['queryEntityNbt', [74, 23]],
    ['placeRecipe', [129, 42, true]],
    ['recipeInfoShown', [42]],
    ['recipeBookSettings', [2, true, false]],
    ['creativeSlot', [36, slot]],
    ['creativeSlot', [-1, null]],
    ['windowClick', [129, 12, 1, 93, 0, [{ slot: 12, item: slot }], null]],
    ['windowClick', [2, 12, 0, 94, 0, [{ slot: 12, item: damagedSlot }], slot]],
    ['resourcePackStatus', [uuid, 3]],
    ['enchantItem', [129, 1]],
    ['seenAdvancements', ['minecraft:story/root']],
    ['seenAdvancements', [null]],
    ['selectTrade', [4]],
    ['selectBundleItem', [36, 2]],
    ['nameItem', ['Fixture']],
    ['setBeaconEffects', [1, 3]],
    ['setBeaconEffects', [null, null]],
    ['updateJigsaw', [pos, 'minecraft:fixture', 'minecraft:target', 'minecraft:pool', 'minecraft:air', 'aligned', -2, 7]],
    ['updateSign', [pos.x, pos.y, pos.z, ['first', 'second', 'third', 'fourth'], false]],
    ['updateCommandBlock', [pos, 'say fixture', 'REDSTONE', true, true, false]],
    ['updateCommandMinecart', [23, 'say fixture', true]],
    ['updateStructure', [pos, 2, { mode: 'LOAD', name: 'minecraft:fixture', posX: -16, posY: -1, posZ: 12, sizeX: 24, sizeY: 32, sizeZ: 48, mirror: 'LEFT_RIGHT', rotation: 'COUNTERCLOCKWISE_90', metadata: 'fixture', integrity: 0.75, seed: 123456n, ignoreEntities: true, showAir: false, showBoundingBox: true, strict: true }]],
    ['editBook', [40, ['first page', 'second page'], 'Book title']],
    ['editBook', [8, [], null]],
    ['setDifficulty', [3]],
    ['changeGamemode', [1]],
    ['lockDifficulty', [true]],
    ['pickItemFromBlock', [pos, true]],
    ['pickItemFromEntity', [23, false]],
    ['pingRequest', [987654321n]],
    ['debugSubscriptionRequest', [[1]]],
    ['setSlotState', [3, 128, true]],
    ['generateStructure', [pos, 7, false]],
    ['chatSession', [{ sessionUUID: uuid, expireTime: 1900000000000n, publicKey, signature }]],
    ['signedCommand', ['say fixture', { timestamp: 1700000000123n, salt: 123n, argumentSignatures: [{ argumentName: 'message', signature }], messageCount: 12, acknowledged }]]
  ];

  const ids = Object.fromEntries(Object.entries(PLAY_SERVERBOUND_774).map(([k, v]) => [v, k]));
  const sample = (wire, api, index) => {
    const name = ids[new Reader774(wire).varint()];
    if (!name) throw Error('Unknown builder packet');
    return { label: 'BUILDER:' + name + ':' + api + ':' + index, direction: 'SERVERBOUND', name, api, wire: Buffer.from(wire).toString('base64'), coverage: [] };
  };

  const out = calls.map(([name, args], i) => sample(C[name](...args), 'C.' + name, i));
  const state = new ChatState774();
  state.process(signature);
  out.push(
    sample(state.flush(), 'ChatState774.flush', 0),
    sample(state.encode('/say fixture'), 'ChatState774.encode', 0),
    sample(state.encode('fixture', { now: 1700000000123, salt: 123n, signature }), 'ChatState774.encode', 1)
  );
  chatState774.reset();
  chatState774.process(signature);
  out.push(sample(C.chat('hello 774', { now: 1700000000123, salt: 123n, signature }), 'C.chat', 0));
  chatState774.reset();
  out.push(
    sample(C774.acknowledgeReconfiguration(), 'C774.acknowledgeReconfiguration', 0),
    sample(C774.playCookieResponse('minecraft:fixture', new Uint8Array([4, 2])), 'C774.playCookieResponse', 0),
    sample(C774.playCookieResponse('minecraft:fixture', null), 'C774.playCookieResponse', 1),
    sample(C774.playerLoaded(), 'C774.playerLoaded', 0),
    sample(C774.tickEnd(), 'C774.tickEnd', 0)
  );
  return out;
}
