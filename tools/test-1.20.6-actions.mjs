import { test } from "node:test";
import assert from "node:assert/strict";

import { C } from "../client/js/net/packets.js";
import { ChatState766 } from "../client/js/net/chat-state-1.20.6.js";
import { Reader766, Writer766 } from "../client/js/net/configuration-1.20.6.js";
import { PLAY_SERVERBOUND_766 } from "../client/js/net/protocol-1.20.6-ids.js";
import { ITEM_DEFAULTS_766 } from "../client/js/net/item-components-1.20.6-defaults.js";
import { Inventory, copy, stackable } from "../client/js/game/container.js";
import { menuInfo766 } from "../client/js/game/menus-1.20.6.js";
import { Game } from "../client/js/game/game.js";
import { LocalPlayer } from "../client/js/game/physics.js";
import { Interaction } from "../client/js/game/interaction.js";

const stoneId = ITEM_DEFAULTS_766.items.findIndex((item) => item.name === "minecraft:stone");

function stack(count = 4, damage = null) {
  return {
    id: stoneId,
    itemId: stoneId,
    count,
    damage: damage ?? 0,
    componentPatch: {
      added: damage == null ? [] : [{ type: "damage", data: damage }],
      removed: []
    }
  };
}

test("protocol 766 menu registry accounts for crafter insertion and modern smithing", () => {
  assert.deepEqual(menuInfo766(7), {
    registryName: "minecraft:crafter_3x3",
    type: "minecraft:dispenser",
    slotCount: 9
  });
  assert.deepEqual(menuInfo766(8), {
    registryName: "minecraft:anvil",
    type: "minecraft:anvil",
    slotCount: 3
  });
  assert.deepEqual(menuInfo766(21), {
    registryName: "minecraft:smithing",
    type: "minecraft:smithing",
    slotCount: 4
  });
  assert.deepEqual(menuInfo766(23), {
    registryName: "minecraft:cartography_table",
    type: "minecraft:cartography",
    slotCount: 3
  });
});

test("component-stack copies and merge equality retain full component state", () => {
  const a = stack(3, 7);
  const cloned = copy(a);
  assert.deepEqual(cloned, a);
  cloned.componentPatch.added[0].data = 8;
  assert.equal(a.componentPatch.added[0].data, 7);
  assert.equal(stackable(a, stack(5, 7)), true);
  assert.equal(stackable(a, stack(5, 8)), false);
});

test("native window click encodes state, changed component stacks and carried item", () => {
  const changed = stack(2, 7);
  const carried = stack(1, 8);
  const bytes = C.windowClick(4, 12, 1, 93, 0, [{ slot: 12, item: changed }], carried);
  const r = new Reader766(bytes);
  assert.equal(r.varint(), PLAY_SERVERBOUND_766.window_click);
  assert.equal(r.u8(), 4);
  assert.equal(r.varint(), 93);
  assert.equal(r.i16(), 12);
  assert.equal(r.i8(), 1);
  assert.equal(r.varint(), 0);
  assert.equal(r.varint(), 1);
  assert.equal(r.i16(), 12);
  const actualChanged = r.slot();
  const actualCarried = r.slot();
  assert.equal(actualChanged.count, 2);
  assert.equal(actualChanged.damage, 7);
  assert.equal(actualCarried.count, 1);
  assert.equal(actualCarried.damage, 8);
  assert.equal(r.remaining(), 0);
});

test("inventory prediction preserves components and server correction stays authoritative", () => {
  const sent = [];
  const items = {
    maxStack: () => 64,
    name: () => "stone",
    def: () => ({ maxDurability: 0 })
  };
  const fakeGame = {
    heldSlot: 0,
    player: { creative: false },
    items,
    send: (bytes) => sent.push(bytes)
  };
  const inventory = new Inventory(fakeGame);
  fakeGame.inventory = inventory;
  inventory.stateId = 11;
  inventory.main[0] = stack(4, 7);

  inventory.click(36, 0, 0);
  assert.equal(inventory.main[0], null);
  assert.equal(inventory.cursor.damage, 7);
  assert.equal(sent.length, 1);

  const r = new Reader766(sent[0]);
  assert.equal(r.varint(), PLAY_SERVERBOUND_766.window_click);
  assert.equal(r.u8(), 0);
  assert.equal(r.varint(), 11);
  assert.equal(r.i16(), 36);
  r.i8();
  r.varint();
  assert.equal(r.varint(), 1);
  assert.equal(r.i16(), 36);
  assert.equal(r.slot(), null);
  assert.equal(r.slot().damage, 7);

  const target = Object.assign(Object.create(Game.prototype), {
    inventory,
    window: null,
    tutorial: { handleSetSlot() {} }
  });
  const correction = stack(4, 8);
  target.on_set_slot({ windowId: 0, stateId: 12, slot: 36, item: correction });
  target.on_set_slot({ windowId: -1, stateId: 12, slot: -1, item: null });
  assert.equal(inventory.stateId, 12);
  assert.equal(inventory.main[0].damage, 8);
  assert.equal(inventory.cursor, null);
});

test("unsigned 1.20.6 chat and commands reuse the native last-seen acknowledgement model", () => {
  const state = new ChatState766();
  const signature = new Uint8Array(256);
  signature[0] = 0x5a;
  state.process(signature, true);

  const bytes = state.encode("hello", { now: 1234, salt: 9n });
  const r = new Reader766(bytes);
  assert.equal(r.varint(), PLAY_SERVERBOUND_766.chat_message);
  assert.equal(r.string(), "hello");
  assert.equal(r.i64(), 1234n);
  assert.equal(r.i64(), 9n);
  assert.equal(r.bool(), false);
  assert.equal(r.varint(), 1);
  const acknowledged = r.bytesN(3);
  assert.ok(acknowledged.some((byte) => byte !== 0));
  assert.equal(r.remaining(), 0);

  const command = new Reader766(state.encode("/say hi"));
  assert.equal(command.varint(), PLAY_SERVERBOUND_766.chat_command);
  assert.equal(command.string(), "say hi");
  assert.equal(command.remaining(), 0);
});

test("simple legacy gameplay actions are emitted with protocol-766 layouts", () => {
  let r = new Reader766(C.enchantItem(3, 2));
  assert.equal(r.varint(), PLAY_SERVERBOUND_766.enchant_item);
  assert.equal(r.i8(), 3);
  assert.equal(r.i8(), 2);

  r = new Reader766(C.seenAdvancements("minecraft:story/root"));
  assert.equal(r.varint(), PLAY_SERVERBOUND_766.advancement_tab);
  assert.equal(r.varint(), 0);
  assert.equal(r.string(), "minecraft:story/root");

  r = new Reader766(C.nameItem("Sword"));
  assert.equal(r.varint(), PLAY_SERVERBOUND_766.name_item);
  assert.equal(r.string(), "Sword");

  r = new Reader766(C.updateSign(1, 64, 2, ["a", "b", "c", "d"], false));
  assert.equal(r.varint(), PLAY_SERVERBOUND_766.update_sign);
  assert.deepEqual(r.position(), { x: 1, y: 64, z: 2 });
  assert.equal(r.bool(), false);
  assert.deepEqual([r.string(), r.string(), r.string(), r.string()], ["a", "b", "c", "d"]);
  assert.equal(r.remaining(), 0);
});

test("merchant item-cost predicates normalize to the legacy merchant consumer shape", async () => {
  const { decodePlayBody766 } = await import("../client/js/net/play-codec-1.20.6.js");
  const output = stack(1, null);
  const body = new Writer766()
    .u8(2)
    .varint(1)
    .varint(stoneId).varint(3).varint(0)
    .slot(output)
    .bool(false)
    .bool(false)
    .i32(1).i32(12).i32(4).i32(-1).f32(0.05).i32(2)
    .varint(3).varint(9).bool(true).bool(true)
    .build();
  const packet = decodePlayBody766("trade_list", body);
  assert.equal(packet.windowId, 2);
  assert.equal(packet.trades.length, 1);
  assert.equal(packet.trades[0].a.itemKey, "minecraft:stone");
  assert.equal(packet.trades[0].a.count, 3);
  assert.equal(packet.trades[0].out.itemKey, "minecraft:stone");
  assert.equal(packet.trades[0].b, null);
  assert.equal(packet.trades[0].uses, 1);
  assert.equal(packet.trades[0].max, 12);
  assert.equal(packet.trades[0].specialPrice, -1);
  assert.equal(packet.villagerLevel, 3);
  assert.equal(packet.experience, 9);
});

test("1.20.6 attribute updates drive reach and local physics consumers", () => {
  const player = new LocalPlayer();
  const target = Object.assign(Object.create(Game.prototype), {
    entityId: 5,
    player,
    world: { getCollisions: () => [] },
    entities: { setAttributes() {} }
  });
  target.on_update_attributes({
    entityId: 5,
    properties: [
      { key: "generic.gravity", value: 0.04, modifiers: [] },
      { key: "generic.jumpStrength", value: 0.6, modifiers: [] },
      { key: "generic.stepHeight", value: 1.25, modifiers: [] },
      { key: "generic.safeFallDistance", value: 5, modifiers: [] },
      { key: "generic.fallDamageMultiplier", value: 0.5, modifiers: [] },
      { key: "generic.scale", value: 1.5, modifiers: [] },
      { key: "player.blockBreakSpeed", value: 2, modifiers: [] },
      { key: "player.blockInteractionRange", value: 7, modifiers: [] },
      { key: "player.entityInteractionRange", value: 5, modifiers: [] }
    ]
  });
  assert.equal(player.gravity, 0.04);
  assert.equal(player.jumpStrength, 0.6);
  assert.equal(player.stepHeight, 1.25);
  assert.equal(player.safeFallDistance, 5);
  assert.equal(player.fallDamageMultiplier, 0.5);
  assert.equal(player.scale, 1.5);
  assert.equal(player.blockBreakSpeed, 2);
  assert.equal(player.blockInteractionRange, 7);
  assert.equal(player.entityInteractionRange, 5);

  const interaction = new Interaction({ player, blockPrediction: null, gameMode: 0 });
  assert.equal(interaction.reach(), 7);
});
