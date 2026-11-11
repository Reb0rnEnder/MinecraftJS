//// A native offline transport + Play decode gate, not a graphical gameplay test.
import net from "node:net";
import { once } from "node:events";
import assert from "node:assert/strict";
import { VanillaSocket766 } from "../../client/js/net/tcp-1.20.6.js";
import { setPlatform } from "../../client/js/platform/platform.js";

setPlatform({ now: () => performance.now() });

class Direct extends VanillaSocket766 {
  constructor() {
    super({ type: "test-direct" }, { distance: 2 });
  }

  async _open(host, port, onPacket, onClose) {
    const tcp = net.createConnection({ host, port });
    tcp.setNoDelay(true);
    this.stream = {
      write: (bytes) => tcp.write(bytes),
      close: () => tcp.destroy()
    };
    tcp.on("data", (bytes) => {
      try {
        this.split.feed(new Uint8Array(bytes), onPacket);
      } catch (error) {
        this._control({ type: "error", message: error.stack });
        this.close();
      }
    });
    tcp.on("close", () => {
      onClose?.(null);
      this.close();
    });
    tcp.on("error", (error) => {
      this._control({ type: "error", message: error.message });
      this.close();
    });
    await once(tcp, "connect");
  }
}

const host = "127.0.0.1";
const port = 25568;
const status = await new Promise((resolve, reject) => {
  const socket = new Direct();
  const timer = setTimeout(() => {
    socket.close();
    reject(Error("Fixture status timed out"));
  }, 5000);
  socket.on("text", (text) => {
    const message = JSON.parse(text);
    if (message.type === "ping_result") {
      clearTimeout(timer);
      socket.close();
      if (message.status) resolve(message.status);
      else reject(Error(message.error));
    }
  });
  socket.sendText(JSON.stringify({ type: "ping", host, port, protocol: 766 }));
});

assert.equal(status.version.protocol, 766);
assert.equal(status.version.name, "1.20.6");
assert.ok(
  JSON.stringify(status.description).includes("MCJS isolated 1.20.6 protocol fixture"),
  "Refuse any other server"
);

const socket = new Direct();
const packets = {};
const configPackets = {};
let failure;
let configuration;
let join;
let position;
let keepalives = 0;
let batches = 0;
let chunks = 0;

socket.on("text", (text) => {
  const message = JSON.parse(text);
  if (message.type === "error" || message.type === "kicked") {
    failure = Error(message.message || message.reason);
  }
});
socket.on("configuration", (packet) => {
  configPackets[packet.name] = (configPackets[packet.name] || 0) + 1;
});
socket.on("configuration_complete", (value) => {
  configuration = value;
});
socket.on("play", (packet) => {
  packets[packet.name] = (packets[packet.name] || 0) + 1;
  if (packet.name === "login") join = packet;
  if (packet.name === "position") {
    position = packet;
    assert.equal(packet.flags, 0, "Initial fixture teleport must be absolute");
  }
  if (packet.name === "keep_alive") keepalives++;
  if (packet.name === "chunk_batch_finished") batches++;
  if (packet.name === "map_chunk") {
    chunks++;
    assert.equal(packet.groundUp, true);
    assert.notEqual(packet.skyLightMask, undefined, "Play sky-light mask must be normalized");
    assert.notEqual(packet.blockLightMask, undefined, "Play block-light mask must be normalized");
    assert.ok(Array.isArray(packet.blockEntities));
  }
  if (packet.name === "kick_disconnect") failure = Error(JSON.stringify(packet.reason));
});

socket.sendText(JSON.stringify({
  type: "connect",
  host,
  port,
  username: "ProtocolProbe",
  protocol: 766
}));

try {
  const deadline = Date.now() + 35000;
  while (!(configuration && join && position && keepalives && chunks && batches)) {
    if (failure) throw failure;
    if (socket.closed) throw Error("Native connection closed");
    if (Date.now() > deadline) {
      throw Error("Native gate timeout " + JSON.stringify({ configPackets, packets }));
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  const dimensions = configuration.registries.get("minecraft:dimension_type");
  const biomes = configuration.registries.get("minecraft:worldgen/biome");
  assert.ok(dimensions?.length);
  assert.ok(biomes?.length);
  assert.ok(dimensions[join.dimensionType]?.value);
  assert.equal(join.dimensionTypeName, dimensions[join.dimensionType].key);
  assert.equal(join.biomeRegistrySize, biomes.length);
  assert.equal(join.blockStateRegistrySize, 26684);
  assert.deepEqual(join.airStates, [0, 12959, 12958]);
  assert.ok(configuration.features.includes("minecraft:vanilla"));
  assert.equal(socket.configurationGeneration, 1);
  assert.deepEqual(configuration.selectedKnownPacks, [
    { namespace: "minecraft", id: "core", version: "1.20.6" }
  ]);
  assert.ok(
    configuration.cachedRegistryValues > 0,
    "Native server must omit known-pack registry payloads when minecraft:core is selected"
  );

  console.log(JSON.stringify({
    protocol: 766,
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
      height: join.dimensionData.height
    },
    teleportConfirmed: position.teleportId,
    keepalivesAnswered: keepalives,
    chunkBatchesAcknowledged: batches,
    decodedChunksReceived: chunks,
    limitations: "Offline transport/Play decode gate only. This probe does not render chunks or test a real authenticated account."
  }, null, 2));
} finally {
  socket.close();
}
