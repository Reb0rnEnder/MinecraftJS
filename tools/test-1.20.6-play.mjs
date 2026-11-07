import { test } from "node:test";
import assert from "node:assert/strict";

import { Game } from "../client/js/game/game.js";
import { Writer766 } from "../client/js/net/configuration-1.20.6.js";
import { decodePlayBody766 } from "../client/js/net/play-codec-1.20.6.js";
import { PLAY_SCHEMA_766 } from "../client/js/net/play-schema-1.20.6.js";
import { ITEM_DEFAULTS_766 } from "../client/js/net/item-components-1.20.6-defaults.js";

const noop = () => {};

function game(fields = {}) {
  return Object.assign(Object.create(Game.prototype), fields);
}

function fieldType(packetName, fieldName) {
  const spec = PLAY_SCHEMA_766.types["packet_" + packetName];
  return spec[1].find((field) => field.name === fieldName).type;
}

function dimensionContext() {
  const dimension = {
    t: 10,
    name: "",
    v: {
      min_y: { t: 3, v: -64 },
      height: { t: 3, v: 384 },
      effects: { t: 8, v: "minecraft:overworld" },
      has_skylight: { t: 1, v: 1 }
    }
  };
  const biome = {
    t: 10,
    name: "",
    v: {
      downfall: { t: 5, v: 0.4 },
      temperature: { t: 5, v: 0.8 },
      effects: {
        t: 10,
        v: {
          water_color: { t: 3, v: 4159204 },
          water_fog_color: { t: 3, v: 329011 }
        }
      }
    }
  };
  return {
    registries: new Map([
      ["minecraft:dimension_type", [{ id: 0, key: "minecraft:overworld", value: dimension }]],
      ["minecraft:worldgen/biome", [{ id: 0, key: "minecraft:plains", value: biome }]]
    ])
  };
}

test("P06 schema is target-pinned and applies Mojang VarLong corrections", () => {
  assert.equal(PLAY_SCHEMA_766.minecraftVersion, "1.20.6");
  assert.equal(PLAY_SCHEMA_766.protocol, 766);
  assert.equal(PLAY_SCHEMA_766.packets.length, 122);
  assert.equal(PLAY_SCHEMA_766.blockStateCount, 26684);
  assert.deepEqual(PLAY_SCHEMA_766.airStates, [0, 12959, 12958]);
  assert.equal(PLAY_SCHEMA_766.entityTypes.length, 130);
  assert.equal(fieldType("multi_block_change", "records")[1].type, "varlong");
  assert.equal(fieldType("initialize_world_border", "speed"), "varlong");
  assert.equal(fieldType("world_border_lerp_size", "speed"), "varlong");
});

test("native 766 Join Game resolves Configuration registries and reaches Game.on_login", () => {
  const body = new Writer766()
    .i32(7)
    .bool(false)
    .varint(1)
    .string("minecraft:overworld")
    .varint(20)
    .varint(8)
    .varint(6)
    .bool(false)
    .bool(true)
    .bool(false)
    .varint(0)
    .string("minecraft:overworld")
    .i64(123n)
    .i8(0)
    .u8(255)
    .bool(false)
    .bool(true)
    .bool(false)
    .varint(0)
    .bool(false)
    .build();

  const packet = decodePlayBody766("login", body, dimensionContext());
  assert.equal(packet.dimensionTypeName, "minecraft:overworld");
  assert.equal(packet.dimension, 0);
  assert.equal(packet.dimensionData.min_y, -64);
  assert.equal(packet.dimensionData.height, 384);
  assert.equal(packet.gameMode, 0);
  assert.equal(packet.previousGameMode, -1);
  assert.equal(packet.biomeRegistrySize, 1);
  assert.equal(packet.blockStateRegistrySize, 26684);

  let dimension;
  const target = game({
    inWorld: false,
    gameMode: 1,
    maxHealth: 80,
    selfMetadata: { 17: { old: true } },
    world: {
      biomeRegistrySize: 0,
      setDimension: (id, data) => { dimension = { id, data }; },
      setBiomeSeed: noop,
      clear: noop
    },
    entities: { clear: noop },
    tileRenderer: { clear: noop },
    pistons: { clear: noop },
    _resetMeshing: noop,
    applyGameMode: noop,
    updateWindowTitle: noop,
    sendSettings: noop,
    send: noop
  });
  target.handlePacket({ name: "login", ...packet });
  assert.equal(target.inWorld, true);
  assert.equal(target.entityId, 7);
  assert.equal(target.world.biomeRegistrySize, 1);
  assert.equal(target.world.blockStateRegistrySize, 26684);
  assert.deepEqual(target.world.airStates, [0, 12959, 12958]);
  assert.equal(dimension.id, 0);
  assert.equal(dimension.data.height, 384);
});

test("terrain and lighting decode to the existing World handlers", () => {
  const lightBytes = new Uint8Array(2048);
  lightBytes.fill(15);
  const light = decodePlayBody766(
    "update_light",
    new Writer766()
      .varint(2)
      .varint(3)
      .varint(1).i64(2n)
      .varint(0)
      .varint(0)
      .varint(0)
      .varint(1).varint(lightBytes.length).raw(lightBytes)
      .varint(0)
      .build()
  );
  assert.equal(light.skyLightMask, 2);
  assert.equal(light.blockLightMask, 0);
  assert.equal(light.skyLight[0].length, 2048);

  const calls = [];
  const target = game({
    world: {
      updateLight758: (packet) => calls.push(["light", packet]),
      setState: (x, y, z, state) => calls.push(["state", x, y, z, state]),
      beginBatch: () => calls.push(["begin"]),
      endBatch: () => calls.push(["end"]),
      loadChunk762: (packet) => calls.push(["chunk", packet])
    },
    interaction: { onBlockChange: (location, state) => calls.push(["interaction", location, state]) },
    blockPrediction: null,
    applyBlockEntity: (nbt) => calls.push(["blockEntity", nbt])
  });

  target.handlePacket({ name: "update_light", ...light });
  assert.equal(calls[0][0], "light");

  const block = decodePlayBody766(
    "block_change",
    new Writer766().position(17, 65, -2).varint(12345).build()
  );
  target.handlePacket({ name: "block_change", ...block });
  assert.deepEqual(calls.find((call) => call[0] === "state"), ["state", 17, 65, -2, 12345]);

  const record = (26683n << 12n) | (1n << 8n) | (2n << 4n) | 3n;
  const multi = decodePlayBody766(
    "multi_block_change",
    new Writer766().i64(0n).varint(1).varlong(record).build()
  );
  target.handlePacket({ name: "multi_block_change", ...multi });
  assert.deepEqual(
    calls.filter((call) => call[0] === "state").at(-1),
    ["state", 1, 3, 2, 26683]
  );

  const chunk = {
    x: 0,
    z: 0,
    groundUp: true,
    chunkData: new Uint8Array(),
    blockEntities: [],
    ...light
  };
  target.handlePacket({ name: "map_chunk", ...chunk });
  assert.equal(calls.at(-1)[0], "chunk");
});

test("1.20.6 component stacks reach player inventory handlers unchanged", () => {
  const stoneId = ITEM_DEFAULTS_766.items.findIndex((item) => item.name === "minecraft:stone");
  assert.ok(stoneId >= 0);
  const stack = {
    id: stoneId,
    count: 32,
    componentPatch: { added: [], removed: [] }
  };

  const setSlot = decodePlayBody766(
    "set_slot",
    new Writer766().u8(0).varint(9).i16(5).slot(stack).build()
  );
  assert.equal(setSlot.item.itemKey, "minecraft:stone");
  assert.equal(setSlot.item.maxStackSize, 64);

  let written;
  const target = game({
    inventory: {
      stateId: 0,
      cursor: null,
      setSlot: (slot, item) => { written = { slot, item }; },
      setPlayerSlotByInventoryIndex: noop,
      get: () => null
    },
    tutorial: { handleSetSlot: noop },
    window: null
  });
  target.handlePacket({ name: "set_slot", ...setSlot });
  assert.equal(target.inventory.stateId, 9);
  assert.equal(written.slot, 5);
  assert.equal(written.item.itemKey, "minecraft:stone");

  let all;
  const windowItems = decodePlayBody766(
    "window_items",
    new Writer766()
      .u8(0)
      .varint(10)
      .varint(2)
      .slot(stack)
      .slot(null)
      .slot(stack)
      .build()
  );
  target.inventory.setAll = (items) => { all = items; };
  target.handlePacket({ name: "window_items", ...windowItems });
  assert.equal(target.inventory.stateId, 10);
  assert.equal(all[0].itemKey, "minecraft:stone");
  assert.equal(all[1], null);
  assert.equal(target.inventory.cursor.itemKey, "minecraft:stone");
});

test("entity identity, movement and attributes reach existing entity consumers", () => {
  const zombie = PLAY_SCHEMA_766.entityTypes.indexOf("minecraft:zombie");
  assert.ok(zombie >= 0);
  const spawn = decodePlayBody766(
    "spawn_entity",
    new Writer766()
      .varint(42)
      .uuid("12345678-1234-4234-8234-123456789abc")
      .varint(zombie)
      .f64(1).f64(64).f64(2)
      .i8(32).i8(64).i8(96)
      .varint(0)
      .i16(0).i16(0).i16(0)
      .build()
  );
  assert.equal(spawn.entityTypeName, "minecraft:zombie");
  assert.equal(spawn.yaw, 90);
  assert.equal(spawn.pitch, 45);

  const calls = [];
  const target = game({
    entityId: 7,
    player: {},
    entities: {
      spawnMob: (packet) => calls.push(["spawnMob", packet]),
      spawnObject: (packet) => calls.push(["spawnObject", packet]),
      relMove: (packet, move, look) => calls.push(["relMove", packet, move, look]),
      setAttributes: (packet) => calls.push(["attributes", packet])
    }
  });
  target.handlePacket({ name: "spawn_entity", ...spawn });
  const spawned = calls.find((call) => call[0] === "spawnMob")[1];
  assert.equal(spawned.wireType, zombie);
  assert.equal(spawned.entityTypeName, "zombie");

  const move = decodePlayBody766(
    "rel_entity_move",
    new Writer766().varint(42).i16(4096).i16(-2048).i16(1024).bool(true).build()
  );
  assert.equal(move.dX, 1);
  assert.equal(move.dY, -0.5);
  assert.equal(move.dZ, 0.25);
  target.handlePacket({ name: "rel_entity_move", ...move });
  assert.deepEqual(calls.find((call) => call[0] === "relMove").slice(2), [true, false]);

  const attributes = decodePlayBody766(
    "entity_update_attributes",
    new Writer766()
      .varint(7)
      .varint(1)
      .varint(17)
      .f64(0.2)
      .varint(0)
      .build()
  );
  assert.equal(attributes.name, "update_attributes");
  assert.equal(attributes.properties[0].key, "generic.movementSpeed");
  target.handlePacket(attributes);
  assert.equal(target.player.speedAttr.base, 0.2);
  assert.equal(calls.find((call) => call[0] === "attributes")[1].properties[0].key, "generic.movementSpeed");
});

test("HUD state and abilities use the unchanged Game consumers", () => {
  const target = game({
    entityId: 7,
    ticks: 100,
    health: 20,
    player: { healthInitialized: true },
    hud: { healthFlash: 0 },
    screens: { open: noop }
  });

  const health = decodePlayBody766(
    "update_health",
    new Writer766().f32(18).varint(17).f32(3.5).build()
  );
  target.handlePacket({ name: "update_health", ...health });
  assert.equal(target.health, 18);
  assert.equal(target.food, 17);
  assert.equal(target.saturation, 3.5);
  assert.equal(target.hud.healthFlash, 120);

  const xp = decodePlayBody766(
    "experience",
    new Writer766().f32(0.75).varint(12).varint(345).build()
  );
  target.handlePacket({ name: "experience", ...xp });
  assert.equal(target.xpBar, 0.75);
  assert.equal(target.xpLevel, 12);
  assert.equal(target.xpTotal, 345);

  const abilities = decodePlayBody766(
    "abilities",
    new Writer766().i8(0x0f).f32(0.05).f32(0.1).build()
  );
  target.handlePacket({ name: "abilities", ...abilities });
  assert.equal(target.player.invulnerable, true);
  assert.equal(target.player.flying, true);
  assert.equal(target.player.allowFlying, true);
  assert.equal(target.player.creative, true);
  assert.ok(Math.abs(target.player.flySpeed - 0.05) < 1e-6);
});

test("world-border lerp keeps native VarLong range and reaches WorldBorder", () => {
  const packet = decodePlayBody766(
    "world_border_lerp_size",
    new Writer766().f64(100).f64(200).varlong(5000000000n).build()
  );
  assert.equal(packet.name, "world_border");
  assert.equal(packet.action, 1);
  assert.equal(packet.speed, 5000000000);

  let applied;
  const target = game({ worldBorder: { apply: (value) => { applied = value; } } });
  target.handlePacket(packet);
  assert.equal(applied.speed, 5000000000);
});
