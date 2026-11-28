// Native offline transport + Play decode + basic interaction gate against isolated 1.21.11 fixture.
import net from 'node:net';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import { VanillaSocket774 } from '../../client/js/net/tcp-1.21.11.js';
import { C774, Writer774 } from '../../client/js/net/configuration-1.21.11.js';
import { ChatState774 } from '../../client/js/net/chat-state-1.21.11.js';
import { PLAY_SCHEMA_774 } from '../../client/js/net/play-schema-1.21.11.js';
import { PLAY_SERVERBOUND_774 } from '../../client/js/net/protocol-1.21.11-ids.js';
import { createItemStack774, writeUntrustedSlot774 } from '../../client/js/net/item-components-1.21.11.js';
import { decodeChunkData774 } from '../../client/js/world/chunk-1.21.11.js';
import { setPlatform } from '../../client/js/platform/platform.js';

setPlatform({ now: () => performance.now() });

class Direct extends VanillaSocket774 {
  constructor() {
    super({ type: 'test-direct' }, { distance: 2 });
  }

  async _open(host, port, onPacket, onClose) {
    const tcp = net.createConnection({ host, port });
    tcp.setNoDelay(true);
    this.stream = {
      write: (bytes) => tcp.write(bytes),
      close: () => tcp.destroy()
    };
    tcp.on('data', (bytes) => {
      try {
        this.split.feed(new Uint8Array(bytes), onPacket);
      } catch (error) {
        this._control({ type: 'error', message: error.stack });
        this.close();
      }
    });
    tcp.on('close', () => {
      onClose?.(null);
      this.close();
    });
    tcp.on('error', (error) => {
      this._control({ type: 'error', message: error.message });
      this.close();
    });
    await once(tcp, 'connect');
  }
}

const host = '127.0.0.1';
const port = 25571;
const status = await new Promise((resolve, reject) => {
  const socket = new Direct();
  const timer = setTimeout(() => {
    socket.close();
    reject(Error('Fixture status timed out'));
  }, 5000);
  socket.on('text', (text) => {
    const message = JSON.parse(text);
    if (message.type === 'ping_result') {
      clearTimeout(timer);
      socket.close();
      if (message.status) resolve(message.status);
      else reject(Error(message.error));
    }
  });
  socket.sendText(JSON.stringify({ type: 'ping', host, port, protocol: 774 }));
});

assert.equal(status.version.protocol, 774);
assert.equal(status.version.name, '1.21.11');
assert.ok(
  JSON.stringify(status.description).includes('MCJS isolated 1.21.11 protocol fixture'),
  'Refuse any other server'
);

const socket = new Direct();
const packets = {};
const configPackets = {};
const chat = new ChatState774();
let failure;
let configuration;
let join;
let position;
let commands;
let keepalives = 0;
let batches = 0;
let chunks = 0;
let chatReceived = 0;
let playerLoadedSent = false;

socket.on('text', (text) => {
  const message = JSON.parse(text);
  if (message.type === 'error' || message.type === 'kicked') {
    failure = Error(message.message || message.reason);
  }
});
socket.on('configuration', (packet) => {
  configPackets[packet.name] = (configPackets[packet.name] || 0) + 1;
});
socket.on('configuration_complete', (value) => {
  configuration = value;
});
socket.on('play', (packet) => {
  packets[packet.name] = (packets[packet.name] || 0) + 1;
  if (packet.name === 'login') join = packet;
  if (packet.name === 'declare_commands') commands = packet;
  if (packet.name === 'system_chat' || packet.name === 'profileless_chat') chatReceived++;
  if (packet.name === 'player_chat') {
    chatReceived++;
    if (packet.signature) chat.process(packet.signature, true);
  }
  if (packet.name === 'position') {
    position = packet;
    assert.equal(packet.flags, 0, 'Initial fixture teleport must be absolute');
    if (!playerLoadedSent) {
      playerLoadedSent = true;
      socket._send(C774.positionLook(packet.x, packet.y, packet.z, packet.yaw, packet.pitch, true, false));
      socket._send(C774.playerLoaded());
      socket._send(C774.tickEnd());
      socket._send(new Writer774().varint(PLAY_SERVERBOUND_774.player_input).u8(0).build());
      socket._send(chat.encode('probe hello 1.21.11'));
      const w = new Writer774().varint(PLAY_SERVERBOUND_774.set_creative_slot).i16(36);
      writeUntrustedSlot774(w, createItemStack774(1, 1));
      socket._send(w.build());
    }
  }
  if (packet.name === 'keep_alive') keepalives++;
  if (packet.name === 'chunk_batch_finished') batches++;
  if (packet.name === 'map_chunk') {
    chunks++;
    assert.equal(packet.groundUp, true);
    assert.notEqual(packet.skyLightMask, undefined, 'Play sky-light mask must be normalized');
    assert.notEqual(packet.blockLightMask, undefined, 'Play block-light mask must be normalized');
    assert.ok(Array.isArray(packet.blockEntities));
    assert.ok(Array.isArray(packet.heightmaps));
    const decoded = decodeChunkData774(packet, {
      biomeCount: join?.biomeRegistrySize ?? 65,
      sectionCount: ((join?.dimensionData?.height ?? 384) / 16) | 0,
      stateCount: PLAY_SCHEMA_774.blockStateCount,
      airStates: PLAY_SCHEMA_774.airStates
    });
    assert.ok(decoded.sections.length > 0, 'Decoded 1.21.11 chunk must contain sections');
  }
  if (packet.name === 'kick_disconnect') failure = Error(JSON.stringify(packet.reason));
});

socket.sendText(JSON.stringify({
  type: 'connect',
  host,
  port,
  username: 'ProtocolProbe',
  protocol: 774
}));

try {
  const deadline = Date.now() + 35000;
  while (!(configuration && join && position && commands && keepalives && chunks && batches && chatReceived)) {
    if (failure) throw failure;
    if (socket.closed) throw Error('Native connection closed');
    if (Date.now() > deadline) {
      throw Error('Native gate timeout ' + JSON.stringify({ configPackets, packets }));
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  const dimensions = configuration.registries.get('minecraft:dimension_type');
  const biomes = configuration.registries.get('minecraft:worldgen/biome');
  assert.ok(dimensions?.length);
  assert.ok(biomes?.length);
  assert.ok(dimensions[join.dimensionType]?.value);
  assert.equal(join.dimensionTypeName, dimensions[join.dimensionType].key);
  assert.equal(join.biomeRegistrySize, biomes.length);
  assert.equal(join.blockStateRegistrySize, PLAY_SCHEMA_774.blockStateCount);
  assert.deepEqual(join.airStates, PLAY_SCHEMA_774.airStates);
  assert.ok(configuration.features.includes('minecraft:vanilla'));
  assert.equal(socket.configurationGeneration, 1);
  assert.deepEqual(configuration.selectedKnownPacks, [
    { namespace: 'minecraft', id: 'core', version: '1.21.11' }
  ]);
  assert.ok(
    configuration.cachedRegistryValues > 0,
    'Native server must omit known-pack registry payloads when minecraft:core is selected'
  );

  console.log(JSON.stringify({
    protocol: 774,
    version: status.version.name,
    compressionThreshold: socket.split.threshold,
    profile: socket.profile.username,
    configuration: configPackets,
    knownPacks: configuration.selectedKnownPacks,
    cachedRegistryValues: configuration.cachedRegistryValues,
    registries: Object.fromEntries([...configuration.registries].map(([key, value]) => [key, value.length])),
    features: configuration.features,
    join: {
      world: join.worldName,
      dimensionType: dimensions[join.dimensionType].key,
      minY: join.dimensionData.min_y,
      height: join.dimensionData.height,
      seaLevel: join.seaLevel
    },
    teleportConfirmed: position.teleportId,
    commandNodes: commands.nodes.length,
    keepalivesAnswered: keepalives,
    chunkBatchesAcknowledged: batches,
    decodedChunksReceived: chunks,
    chatsReceived: chatReceived,
    playPackets: packets,
    limitations: 'Offline transport/Play decode + basic movement/chat probe only.'
  }, null, 2));
} finally {
  socket.close();
}
