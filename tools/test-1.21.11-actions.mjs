import { test } from "node:test";
import assert from "node:assert/strict";

import { C } from "../client/js/net/packets.js";
import { ChatState774, computeLastSeenChecksum } from "../client/js/net/chat-state-1.21.11.js";
import { Reader774, Writer774 } from "../client/js/net/configuration-1.21.11.js";
import { hashSlot774, readHashedStack774 } from "../client/js/net/hashed-stack-1.21.11.js";
import { PLAY_SERVERBOUND_774 } from "../client/js/net/protocol-1.21.11-ids.js";
import { ITEM_DEFAULTS_774 } from "../client/js/net/item-components-1.21.11-defaults.js";
import { Inventory, copy, stackable } from "../client/js/game/container.js";
import { menuInfo774 } from "../client/js/game/menus-1.21.11.js";
import { Game } from "../client/js/game/game.js";
import { LocalPlayer } from "../client/js/game/physics.js";
import { Interaction } from "../client/js/game/interaction.js";

const stoneId = ITEM_DEFAULTS_774.items.findIndex((item) => item.name === "minecraft:stone");

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

test("protocol 774 menu registry accounts for crafter_3x3 and modern smithing", () => {
  assert.deepEqual(menuInfo774(7), {
    registryName: "minecraft:crafter_3x3",
    type: "minecraft:crafter_3x3",
    slotCount: 9
  });
  assert.deepEqual(menuInfo774(8), {
    registryName: "minecraft:anvil",
    type: "minecraft:anvil",
    slotCount: 3
  });
  assert.deepEqual(menuInfo774(21), {
    registryName: "minecraft:smithing",
    type: "minecraft:smithing",
    slotCount: 4
  });
  assert.deepEqual(menuInfo774(23), {
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

test("native window click encodes ContainerID varint, changed HashedSlots and carried HashedSlot", () => {
  const changed = stack(2, 7);
  const carried = stack(1, 8);
  const bytes = C.windowClick(129, 12, 1, 93, 0, [{ slot: 12, item: changed }], carried);
  const r = new Reader774(bytes);
  assert.equal(r.varint(), PLAY_SERVERBOUND_774.window_click);
  assert.equal(r.varint(), 129);
  assert.equal(r.varint(), 93);
  assert.equal(r.i16(), 12);
  assert.equal(r.i8(), 1);
  assert.equal(r.varint(), 0);
  assert.equal(r.varint(), 1);
  assert.equal(r.i16(), 12);
  const actualChanged = readHashedStack774(r);
  const actualCarried = readHashedStack774(r);
  assert.deepEqual(actualChanged, hashSlot774(changed));
  assert.deepEqual(actualCarried, hashSlot774(carried));
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

  const r = new Reader774(sent[0]);
  assert.equal(r.varint(), PLAY_SERVERBOUND_774.window_click);
  assert.equal(r.varint(), 0);
  assert.equal(r.varint(), 11);
  assert.equal(r.i16(), 36);
  r.i8();
  r.varint();
  assert.equal(r.varint(), 1);
  assert.equal(r.i16(), 36);
  assert.equal(readHashedStack774(r), null);
  assert.deepEqual(readHashedStack774(r), hashSlot774(stack(4, 7)));
  assert.equal(r.remaining(), 0);

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

test("unsigned 1.21.11 chat and commands reuse native last-seen acknowledgement and checksum byte", () => {
  const state = new ChatState774();
  const signature = new Uint8Array(256);
  signature[0] = 0x5a;
  state.process(signature, true);

  const bytes = state.encode("hello", { now: 1234, salt: 9n });
  const r = new Reader774(bytes);
  assert.equal(r.varint(), PLAY_SERVERBOUND_774.chat_message);
  assert.equal(r.string(), "hello");
  assert.equal(r.i64(), 1234n);
  assert.equal(r.i64(), 9n);
  assert.equal(r.bool(), false);
  assert.equal(r.varint(), 1);
  const acknowledged = r.bytesN(3);
  assert.ok(acknowledged.some((byte) => byte !== 0));
  assert.equal(r.u8(), computeLastSeenChecksum([signature]));
  assert.equal(r.remaining(), 0);

  const command = new Reader774(state.encode("/say hi"));
  assert.equal(command.varint(), PLAY_SERVERBOUND_774.chat_command);
  assert.equal(command.string(), "say hi");
  assert.equal(command.remaining(), 0);
});

test("gameplay actions are emitted with protocol-774 ContainerID and field layouts", () => {
  let r = new Reader774(C.enchantItem(129, 2));
  assert.equal(r.varint(), PLAY_SERVERBOUND_774.enchant_item);
  assert.equal(r.varint(), 129);
  assert.equal(r.i8(), 2);
  assert.equal(r.remaining(), 0);

  r = new Reader774(C.seenAdvancements("minecraft:story/root"));
  assert.equal(r.varint(), PLAY_SERVERBOUND_774.advancement_tab);
  assert.equal(r.varint(), 0);
  assert.equal(r.string(), "minecraft:story/root");

  r = new Reader774(C.nameItem("Sword"));
  assert.equal(r.varint(), PLAY_SERVERBOUND_774.name_item);
  assert.equal(r.string(), "Sword");

  r = new Reader774(C.updateSign(1, 64, 2, ["a", "b", "c", "d"], false));
  assert.equal(r.varint(), PLAY_SERVERBOUND_774.update_sign);
  assert.deepEqual(r.position(), { x: 1, y: 64, z: 2 });
  assert.equal(r.bool(), false);
  assert.deepEqual([r.string(), r.string(), r.string(), r.string()], ["a", "b", "c", "d"]);
  assert.equal(r.remaining(), 0);
});

test("merchant item-cost predicates decode ContainerID varint and normalize to merchant consumer shape", async () => {
  const { decodePlayBody774 } = await import("../client/js/net/play-codec-1.21.11.js");
  const output = stack(1, null);
  const body = new Writer774()
    .varint(129)
    .varint(1)
    .varint(stoneId).varint(3).varint(0)
    .slot(output)
    .bool(false)
    .bool(false)
    .i32(1).i32(12).i32(4).i32(-1).f32(0.05).i32(2)
    .varint(3).varint(9).bool(true).bool(true)
    .build();
  const packet = decodePlayBody774("trade_list", body);
  assert.equal(packet.windowId, 129);
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

test("1.21.11 attribute updates drive reach and local physics consumers", () => {
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
