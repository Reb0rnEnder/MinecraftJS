import { test } from "node:test";
import assert from "node:assert/strict";

import { Game } from "../client/js/game/game.js";
import { Writer774 } from "../client/js/net/configuration-1.21.11.js";
import { writeLpVec3 } from "../client/js/net/lpvec3.js";
import { decodePlayBody774 } from "../client/js/net/play-codec-1.21.11.js";
import { PLAY_SCHEMA_774 } from "../client/js/net/play-schema-1.21.11.js";
import { ITEM_DEFAULTS_774 } from "../client/js/net/item-components-1.21.11-defaults.js";
import { replaceServerRecipes, serverRecipe, serverCraftResult } from "../client/js/game/server-recipes.js";

const noop = () => {};

test("native 1.21.11 declare_recipes property sets and recipe_book_add displays resolve crafting grids", () => {
  const stoneId = ITEM_DEFAULTS_774.items.findIndex((item) => item.name === "minecraft:stone");
  assert.ok(stoneId >= 0);

  const declared = decodePlayBody774(
    "declare_recipes",
    new Writer774()
      .varint(1)
      .string("minecraft:furnace_input").varint(1).varint(stoneId)
      .varint(1)
      .varint(2).varint(stoneId)
      .varint(2).varint(stoneId)
      .build()
  );
  assert.deepEqual(declared.recipes, [{ name: "minecraft:furnace_input", items: [stoneId] }]);
  assert.equal(declared.stoneCutterRecipes.length, 1);
  assert.equal(declared.stoneCutterRecipes[0].slotDisplay.data, stoneId);

  const gameTarget = { items: {}, recipeBook: { update: noop } };
  replaceServerRecipes(gameTarget, declared);
  assert.equal(gameTarget.recipePropertySets.get("minecraft:furnace_input").has(stoneId), true);
  assert.equal(gameTarget.stonecutterRecipes.length, 1);

  const displayMapping = PLAY_SCHEMA_774.types.RecipeDisplay[1][0].type[1].mappings;
  assert.equal(displayMapping[0], "crafting_shapeless");
  assert.equal(displayMapping[1], "crafting_shaped");
  assert.equal(displayMapping[2], "furnace");
  assert.equal(displayMapping[3], "stonecutter");
  assert.equal(displayMapping[4], "smithing");

  const stack = { itemId: stoneId, id: stoneId, count: 1, componentPatch: { added: [], removed: [] } };
  const bookAdd = decodePlayBody774(
    "recipe_book_add",
    new Writer774()
      .varint(2)
      // Entry 0: shaped 2x1 stone -> 2 stone
      .varint(100)
      .varint(1) // crafting_shaped
      .varint(2).varint(1)
      .varint(2)
      .varint(2).varint(stoneId) // SlotDisplay item
      .varint(2).varint(stoneId) // SlotDisplay item
      .varint(3).slot({ ...stack, count: 2 }) // SlotDisplay item_stack result
      .varint(0) // craftingStation empty
      .varint(0) // group absent
      .varint(3) // crafting_misc
      .bool(false) // no craftingRequirements
      .u8(1) // notification flag
      // Entry 1: furnace
      .varint(101)
      .varint(2) // furnace
      .varint(2).varint(stoneId) // ingredient
      .varint(1) // fuel: any_fuel
      .varint(3).slot(stack) // result
      .varint(0) // craftingStation empty
      .varint(200) // duration
      .f32(0.5) // experience
      .varint(0) // group absent
      .varint(5) // furnace_blocks
      .bool(false) // no craftingRequirements
      .u8(0)
      .bool(true) // replace
      .build()
  );

  const shapedEntry = bookAdd.entries[0].recipe;
  const furnaceEntry = bookAdd.entries[1].recipe;
  assert.equal(shapedEntry.display.data.width, 2);
  assert.equal(shapedEntry.display.data.height, 1);
  assert.equal(shapedEntry.display.data.ingredients.length, 2);
  assert.equal(furnaceEntry.display.data.duration, 200);

  const recipe = serverRecipe(shapedEntry);
  assert.equal(recipe.id, 100);
  assert.equal(serverCraftResult([stack, stack, null, null], 2, [recipe]).count, 2);
});

test("player-info entry action switches resolve the enclosing container across all 8 flags", () => {
  const uuid = "12345678-1234-4234-8234-123456789abc";
  const w = new Writer774()
    .u8(1 | 4 | 8 | 16 | 32 | 64 | 128)
    .varint(1)
    .uuid(uuid)
    .string("Fixture").varint(0)
    .varint(1)
    .bool(true)
    .varint(37)
    .bool(true).component({ text: "Display" })
    .varint(5)
    .bool(true);
  const p = decodePlayBody774("player_info", w.build());
  assert.equal(p.data[0].player.name, "Fixture");
  assert.equal(p.data[0].gamemode, 1);
  assert.equal(p.data[0].latency, 37);
  assert.equal(p.data[0].listed, true);
  assert.equal(p.data[0].listPriority, 5);
  assert.equal(p.data[0].showHat, true);
});

function game(fields = {}) {
  return Object.assign(Object.create(Game.prototype), fields);
}

function fieldType(packetName, fieldName) {
  const spec = PLAY_SCHEMA_774.types["packet_" + packetName];
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
    features: ["minecraft:vanilla"],
    tags: new Map([["minecraft:item", [{ name: "minecraft:test", entries: [1, 2] }]]]),
    registries: new Map([
      ["minecraft:dimension_type", [{ id: 0, key: "minecraft:overworld", value: dimension }]],
      ["minecraft:worldgen/biome", [{ id: 0, key: "minecraft:plains", value: biome }]]
    ])
  };
}

test("774 schema is target-pinned and includes 1.21.11 VarLong, LpVec3, and seaLevel types", () => {
  assert.equal(PLAY_SCHEMA_774.minecraftVersion, "1.21.11");
  assert.equal(PLAY_SCHEMA_774.protocol, 774);
  assert.equal(PLAY_SCHEMA_774.packets.length, 139);
  assert.equal(PLAY_SCHEMA_774.blockStateCount, 29671);
  assert.deepEqual(PLAY_SCHEMA_774.airStates, [0, 15091, 15090]);
  assert.equal(PLAY_SCHEMA_774.entityTypes.length, 157);
  assert.equal(PLAY_SCHEMA_774.blockEntityTypes.length, 49);
  assert.equal(fieldType("multi_block_change", "records")[1].type, "varlong");
  assert.equal(fieldType("initialize_world_border", "speed"), "varlong");
  assert.equal(fieldType("world_border_lerp_size", "speed"), "varlong");
  assert.equal(fieldType("spawn_entity", "velocity"), "lpVec3");
  assert.equal(fieldType("set_projectile_power", "accelerationPower"), "f64");
});

test("native 774 Join Game resolves Configuration registries and reaches Game.on_login", () => {
  const body = new Writer774()
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
    .varint(63)
    .bool(false)
    .build();

  const packet = decodePlayBody774("login", body, dimensionContext());
  assert.equal(packet.dimensionTypeName, "minecraft:overworld");
  assert.equal(packet.dimension, 0);
  assert.equal(packet.dimensionData.min_y, -64);
  assert.equal(packet.dimensionData.height, 384);
  assert.equal(packet.gameMode, 0);
  assert.equal(packet.previousGameMode, -1);
  assert.equal(packet.seaLevel, 63);
  assert.equal(packet.biomeRegistrySize, 1);
  assert.equal(packet.blockStateRegistrySize, 29671);
  assert.deepEqual(packet.enabledFeatures, ["minecraft:vanilla"]);
  assert.deepEqual(packet.registryTags.items, { "minecraft:test": [1, 2] });

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
  assert.equal(target.world.blockStateRegistrySize, 29671);
  assert.deepEqual(target.world.airStates, [0, 15091, 15090]);
  assert.equal(dimension.id, 0);
  assert.equal(dimension.data.height, 384);
});

test("terrain and lighting decode to the 1.21.11 World handlers", () => {
  const lightBytes = new Uint8Array(2048);
  lightBytes.fill(15);
  const light = decodePlayBody774(
    "update_light",
    new Writer774()
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
      loadChunk774: (packet) => calls.push(["chunk", packet])
    },
    interaction: { onBlockChange: (location, state) => calls.push(["interaction", location, state]) },
    blockPrediction: null,
    applyBlockEntity: (nbt) => calls.push(["blockEntity", nbt])
  });

  target.handlePacket({ name: "update_light", ...light });
  assert.equal(calls[0][0], "light");

  const block = decodePlayBody774(
    "block_change",
    new Writer774().position(17, 65, -2).varint(12345).build()
  );
  target.handlePacket({ name: "block_change", ...block });
  assert.deepEqual(calls.find((call) => call[0] === "state"), ["state", 17, 65, -2, 12345]);

  const record = (29670n << 12n) | (1n << 8n) | (2n << 4n) | 3n;
  const multi = decodePlayBody774(
    "multi_block_change",
    new Writer774().i64(0n).varint(1).varlong(record).build()
  );
  target.handlePacket({ name: "multi_block_change", ...multi });
  assert.deepEqual(
    calls.filter((call) => call[0] === "state").at(-1),
    ["state", 1, 3, 2, 29670]
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

test("1.21.11 component stacks reach player inventory, cursor, and player-inventory handlers unchanged", () => {
  const stoneId = ITEM_DEFAULTS_774.items.findIndex((item) => item.name === "minecraft:stone");
  assert.ok(stoneId >= 0);
  const stack = {
    id: stoneId,
    count: 32,
    componentPatch: { added: [], removed: [] }
  };

  const setSlot = decodePlayBody774(
    "set_slot",
    new Writer774().varint(0).varint(9).i16(5).slot(stack).build()
  );
  assert.equal(setSlot.item.itemKey, "minecraft:stone");
  assert.equal(setSlot.item.maxStackSize, 64);

  let written, invSlot;
  const target = game({
    inventory: {
      stateId: 0,
      cursor: null,
      setSlot: (slot, item) => { written = { slot, item }; },
      setPlayerSlotByInventoryIndex: (slotId, contents) => { invSlot = { slotId, contents }; },
      get: () => null
    },
    tutorial: { handleSetSlot: noop },
    window: null
  });
  target.handlePacket({ name: "set_slot", ...setSlot });
  assert.equal(target.inventory.stateId, 9);
  assert.equal(written.slot, 5);
  assert.equal(written.item.itemKey, "minecraft:stone");

  const setCursor = decodePlayBody774("set_cursor_item", new Writer774().slot(stack).build());
  target.handlePacket({ name: "set_cursor_item", ...setCursor });
  assert.equal(target.inventory.cursor.itemKey, "minecraft:stone");

  const setPlayerInv = decodePlayBody774("set_player_inventory", new Writer774().varint(12).slot(stack).build());
  target.handlePacket({ name: "set_player_inventory", ...setPlayerInv });
  assert.equal(invSlot.slotId, 12);
  assert.equal(invSlot.contents.count, 32);

  let all;
  const windowItems = decodePlayBody774(
    "window_items",
    new Writer774()
      .varint(0)
      .varint(10)
      .varint(2)
      .slot(stack)
      .slot(null)
      .slot({ ...stack, count: 4 })
      .build()
  );
  target.inventory.setAll = (items) => { all = items; };
  target.handlePacket({ name: "window_items", ...windowItems });
  assert.equal(target.inventory.stateId, 10);
  assert.equal(all[0].itemKey, "minecraft:stone");
  assert.equal(all[1], null);
  assert.equal(target.inventory.cursor.count, 4);
});

test("entity identity, movement and 1.21.11 attributes reach existing entity consumers", () => {
  const zombie = PLAY_SCHEMA_774.entityTypes.indexOf("minecraft:zombie");
  assert.ok(zombie >= 0);
  const w = new Writer774()
    .varint(42)
    .uuid("12345678-1234-4234-8234-123456789abc")
    .varint(zombie)
    .f64(1).f64(64).f64(2);
  writeLpVec3(w, { x: 0.25, y: 0, z: -0.5 });
  w.i8(32).i8(64).i8(96).varint(0);
  const spawn = decodePlayBody774("spawn_entity", w.build());
  assert.equal(spawn.entityTypeName, "minecraft:zombie");
  assert.equal(spawn.yaw, 90);
  assert.equal(spawn.pitch, 45);
  assert.ok(Math.abs(spawn.velocityX - 0.25) < 1e-3);
  assert.ok(Math.abs(spawn.velocityZ + 0.5) < 1e-3);

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

  const move = decodePlayBody774(
    "rel_entity_move",
    new Writer774().varint(42).i16(4096).i16(-2048).i16(1024).bool(true).build()
  );
  assert.equal(move.dX, 1);
  assert.equal(move.dY, -0.5);
  assert.equal(move.dZ, 0.25);
  target.handlePacket({ name: "rel_entity_move", ...move });
  assert.deepEqual(calls.find((call) => call[0] === "relMove").slice(2), [true, false]);

  const movementSpeedId = 22;
  const attributes = decodePlayBody774(
    "entity_update_attributes",
    new Writer774()
      .varint(7)
      .varint(1)
      .varint(movementSpeedId)
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

  const health = decodePlayBody774(
    "update_health",
    new Writer774().f32(18).varint(17).f32(3.5).build()
  );
  target.handlePacket({ name: "update_health", ...health });
  assert.equal(target.health, 18);
  assert.equal(target.food, 17);
  assert.equal(target.saturation, 3.5);
  assert.equal(target.hud.healthFlash, 120);

  const xp = decodePlayBody774(
    "experience",
    new Writer774().f32(0.75).varint(12).varint(345).build()
  );
  target.handlePacket({ name: "experience", ...xp });
  assert.equal(target.xpBar, 0.75);
  assert.equal(target.xpLevel, 12);
  assert.equal(target.xpTotal, 345);

  const abilities = decodePlayBody774(
    "abilities",
    new Writer774().i8(0x0f).f32(0.05).f32(0.1).build()
  );
  target.handlePacket({ name: "abilities", ...abilities });
  assert.equal(target.player.invulnerable, true);
  assert.equal(target.player.flying, true);
  assert.equal(target.player.allowFlying, true);
  assert.equal(target.player.creative, true);
  assert.ok(Math.abs(target.player.flySpeed - 0.05) < 1e-6);
});

test("world-border lerp keeps native VarLong range and reaches WorldBorder", () => {
  const packet = decodePlayBody774(
    "world_border_lerp_size",
    new Writer774().f64(100).f64(200).varlong(5000000000n).build()
  );
  assert.equal(packet.name, "world_border");
  assert.equal(packet.action, 1);
  assert.equal(packet.speed, 5000000000);

  let applied;
  const target = game({ worldBorder: { apply: (value) => { applied = value; } } });
  target.handlePacket(packet);
  assert.equal(applied.speed, 5000000000);
});
