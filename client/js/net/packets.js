import {technicalPackets} from './technical-packets.js';
import { ChatState774, computeLastSeenChecksum } from "./chat-state-1.21.11.js";
import { Writer774 } from "./configuration-1.21.11.js";
import { writeAnonymousNbt } from "./nbt-anonymous.js";
import { decodePlayPacket774 } from "./play-codec-1.21.11.js";
import { PLAY_SERVERBOUND_774 as OUT } from "./protocol-1.21.11-ids.js";

export const chatState774 = new ChatState774();
export const chatState762 = chatState774;
export const PROTOCOL_VERSION = 774;
export const decodePacket = (data, context) => decodePlayPacket774(data, context);

const packet = (name) => {
  const id = OUT[name];
  if (!Number.isInteger(id)) throw new Error("Unknown protocol-774 serverbound packet " + name);
  return new Writer774().varint(id);
};

function payloadChannel(channel) {
  if (!/^[a-z0-9_.-]+:[a-z0-9/._-]+$/.test(channel)) {
    throw new Error("Invalid custom payload channel: " + channel);
  }
  return channel;
}

export const C = {
  ...technicalPackets(packet),
  setDifficulty: (value) => packet('set_difficulty').varint(value).build(),
  changeGamemode: (mode) => packet('change_gamemode').varint(mode).build(),
  lockDifficulty: (value) => packet('lock_difficulty').bool(value).build(),
  pickItemFromBlock: (pos, includeData = false) => packet('pick_item_from_block').position(pos.x, pos.y, pos.z).bool(!!includeData).build(),
  pickItemFromEntity: (entityId, includeData = false) => packet('pick_item_from_entity').varint(entityId).bool(!!includeData).build(),
  selectBundleItem: (slotId, selectedItemIndex) => packet('select_bundle_item').varint(slotId).varint(selectedItemIndex).build(),
  pingRequest: (id) => packet('ping_request').i64(id).build(),
  debugSubscriptionRequest: (subscriptions = []) => {
    const w = packet('debug_subscription_request').varint(subscriptions.length);
    for (const id of subscriptions) w.varint(id);
    return w.build();
  },
  setSlotState: (slot, windowId, enabled) => packet('set_slot_state').varint(slot).varint(windowId).bool(enabled).build(),
  generateStructure: (pos, levels, keepJigsaws) => packet('generate_structure').position(pos.x, pos.y, pos.z).varint(levels).bool(keepJigsaws).build(),
  editBook: (slot, pages, title = null) => {
    const w = packet('edit_book').varint(slot).varint(pages.length);
    for (const page of pages) w.string(page);
    w.bool(title !== null); if (title !== null) w.string(title);
    return w.build();
  },
  chatSession: ({ sessionUUID, expireTime, publicKey, signature }) => packet('chat_session_update')
    .uuid(sessionUUID).i64(expireTime).varint(publicKey.length).raw(publicKey).varint(signature.length).raw(signature).build(),
  signedCommand: (command, { timestamp, salt, argumentSignatures = [], messageCount = 0, acknowledged, checksum = undefined }) => {
    if (!(acknowledged instanceof Uint8Array) || acknowledged.length !== 3) throw Error('Chat acknowledgement must be 3 bytes');
    const w = packet('chat_command_signed').string(command).i64(timestamp).i64(salt).varint(argumentSignatures.length);
    const sigs = [];
    for (const { argumentName, signature } of argumentSignatures) {
      if (!(signature instanceof Uint8Array) || signature.length !== 256) throw Error('Chat argument signature must be 256 bytes');
      w.string(argumentName).raw(signature);
      sigs.push(signature);
    }
    const byteSum = checksum !== undefined ? (checksum & 0xff) : computeLastSeenChecksum(sigs);
    return w.varint(messageCount).raw(acknowledged).u8(byteSum).build();
  },
  teleportConfirm: (id) => packet("teleport_confirm").varint(id).build(),
  chunkBatchReceived: (chunksPerTick) => packet("chunk_batch_received").f32(chunksPerTick).build(),
  keepAlive: (id) => packet("keep_alive").i64(id).build(),
  pong: (id) => packet("pong").i32(id).build(),
  playerLoaded: () => packet("player_loaded").build(),
  tickEnd: () => packet("tick_end").build(),
  customClickAction: (id, payload = null) => {
    const body = writeAnonymousNbt(new Writer774(), payload).build();
    return packet("custom_click_action").string(id).varint(body.length).raw(body).build();
  },

  settings: (locale, viewDistance, chatFlags, chatColors, skinParts, mainHand = 1, allowServerListing = true, particleStatus = 0, textFiltering = false) =>
    packet("settings")
      .string(locale)
      .i8(viewDistance)
      .varint(chatFlags)
      .bool(chatColors)
      .u8(skinParts)
      .varint(mainHand)
      .bool(!!textFiltering)
      .bool(allowServerListing)
      .varint(particleStatus)
      .build(),
  customPayload: (channel, data) =>
    packet("custom_payload").string(payloadChannel(channel)).raw(data).build(),

  clientCommand: (action) => packet("client_command").varint(action).build(),
  tabComplete: (text, _position = null, transactionId = 0) =>
    packet("tab_complete").varint(transactionId).string(text).build(),
  closeWindow: (windowId) => packet("close_window").varint(windowId).build(),

  flying: (onGround, horizontalCollision = false) =>
    packet("flying").u8((onGround ? 1 : 0) | (horizontalCollision ? 2 : 0)).build(),
  position: (x, y, z, onGround, horizontalCollision = false) =>
    packet("position").f64(x).f64(y).f64(z).u8((onGround ? 1 : 0) | (horizontalCollision ? 2 : 0)).build(),
  look: (yaw, pitch, onGround, horizontalCollision = false) =>
    packet("look").f32(yaw).f32(pitch).u8((onGround ? 1 : 0) | (horizontalCollision ? 2 : 0)).build(),
  positionLook: (x, y, z, yaw, pitch, onGround, horizontalCollision = false) =>
    packet("position_look")
      .f64(x).f64(y).f64(z)
      .f32(yaw).f32(pitch)
      .u8((onGround ? 1 : 0) | (horizontalCollision ? 2 : 0))
      .build(),
  vehicleMove: (x, y, z, yaw, pitch, onGround = true) =>
    packet("vehicle_move").f64(x).f64(y).f64(z).f32(yaw).f32(pitch).bool(!!onGround).build(),
  steerBoat: (left, right) => packet("steer_boat").bool(left).bool(right).build(),
  abilities: (flags) => packet("abilities").i8(flags).build(),
  entityAction: (entityId, action, jumpBoost = 0) =>
    packet("entity_action").varint(entityId).varint(action).varint(jumpBoost).build(),
  playerInput: ({ forward = false, backward = false, left = false, right = false, jump = false, shift = false, sprint = false } = {}) =>
    packet("player_input").u8(
      (forward ? 1 : 0) |
      (backward ? 2 : 0) |
      (left ? 4 : 0) |
      (right ? 8 : 0) |
      (jump ? 16 : 0) |
      (shift ? 32 : 0) |
      (sprint ? 64 : 0)
    ).build(),
  steerVehicle: (sideways, forward, flags) =>
    packet("player_input").u8(
      (forward > 0 ? 1 : 0) |
      (forward < 0 ? 2 : 0) |
      (sideways > 0 ? 4 : 0) |
      (sideways < 0 ? 8 : 0) |
      (flags & 1 ? 16 : 0) |
      (flags & 2 ? 32 : 0)
    ).build(),
  heldItemSlot: (slot) => packet("held_item_slot").i16(slot).build(),
  armAnimation: (hand = 0) => packet("arm_animation").varint(hand).build(),
  spectate: (uuid) => packet("spectate").uuid(uuid).build(),

  useEntity: (target, mouse, x, y, z, hand = 0, sneaking = false) => {
    const writer = packet("use_entity").varint(target).varint(mouse);
    if (mouse === 2) writer.f32(x).f32(y).f32(z);
    if (mouse === 0 || mouse === 2) writer.varint(hand);
    return writer.bool(sneaking).build();
  },
  blockDig: (status, x, y, z, face, sequence = 0) =>
    packet("block_dig").varint(status).position(x, y, z).i8(face).varint(sequence).build(),
  blockPlace: (x, y, z, face, hand, cursorX, cursorY, cursorZ, insideBlock = false, sequence = 0, worldBorderHit = false) =>
    packet("block_place")
      .varint(hand)
      .position(x, y, z)
      .varint(face)
      .f32(cursorX).f32(cursorY).f32(cursorZ)
      .bool(insideBlock)
      .bool(!!worldBorderHit)
      .varint(sequence)
      .build(),
  useItem: (hand = 0, sequence = 0, yaw = 0, pitch = 0) =>
    packet("use_item").varint(hand).varint(sequence).f32(yaw).f32(pitch).build(),

  queryBlockNbt: (transactionId, x, y, z) =>
    packet("query_block_nbt").varint(transactionId).position(x, y, z).build(),
  queryEntityNbt: (transactionId, entityId) =>
    packet("query_entity_nbt").varint(transactionId).varint(entityId).build(),

  placeRecipe: (windowId, recipeId, makeAll) =>
    packet("craft_recipe_request").varint(windowId).varint(recipeId).bool(makeAll).build(),
  recipeInfoShown: (recipeId) => packet("displayed_recipe").varint(recipeId).build(),
  recipeBookSettings: (bookId, open, filtering) =>
    packet("recipe_book").varint(bookId).bool(open).bool(filtering).build(),
  recipeInfoSettings: (open, filtering) =>
    packet("recipe_book").varint(0).bool(open).bool(filtering).build(),

  creativeSlot: (slot, item) => packet("set_creative_slot").i16(slot).untrustedSlot(item).build(),

  windowClick: (windowId, slot, mouseButton, stateId, mode, changedSlots, cursorItem) => {
    const writer = packet("window_click")
      .varint(windowId)
      .varint(stateId)
      .i16(slot)
      .i8(mouseButton)
      .varint(mode)
      .varint(changedSlots.length);
    for (const changed of changedSlots) {
      writer.i16(changed.slot).hashedSlot(changed.item);
    }
    return writer.hashedSlot(cursorItem).build();
  },

  chat: (message, options = undefined) => chatState774.encode(String(message), options),
  resourcePackStatus: (uuid, result) => packet("resource_pack_receive").uuid(uuid).varint(result).build(),
  enchantItem: (windowId, enchantment) => packet("enchant_item").varint(windowId).i8(enchantment).build(),
  menuButton: (windowId, button) => packet("enchant_item").varint(windowId).i8(button).build(),
  seenAdvancements: (tabId) => {
    const writer = packet("advancement_tab").varint(tabId == null ? 1 : 0);
    if (tabId != null) writer.string(String(tabId));
    return writer.build();
  },
  selectTrade: (slot) => packet("select_trade").varint(slot).build(),
  nameItem: (name) => packet("name_item").string(String(name).slice(0, 50)).build(),
  setBeaconEffects: (primary, secondary) => {
    const writer = packet("set_beacon_effect").bool(primary != null);
    if (primary != null) writer.varint(primary);
    writer.bool(secondary != null);
    if (secondary != null) writer.varint(secondary);
    return writer.build();
  },
  updateJigsaw: (pos, name, target, pool, finalState, jointType = "rollable", selectionPriority = 0, placementPriority = 0) =>
    packet("update_jigsaw_block")
      .position(pos.x, pos.y, pos.z)
      .string(name)
      .string(target)
      .string(pool)
      .string(finalState)
      .string(jointType)
      .varint(selectionPriority)
      .varint(placementPriority)
      .build(),
  updateSign: (x, y, z, lines, isFrontText = true) =>
    packet("update_sign")
      .position(x, y, z)
      .bool(isFrontText)
      .string(String(lines?.[0] ?? ""))
      .string(String(lines?.[1] ?? ""))
      .string(String(lines?.[2] ?? ""))
      .string(String(lines?.[3] ?? ""))
      .build()
};

export const mcStringBytes = (value) => new Writer774().string(value).build();
