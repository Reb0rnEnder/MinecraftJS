import { ChatState762 } from "./chat-state-1.19.4.js";
import { Writer766 } from "./configuration-1.20.6.js";
import { decodePlayPacket766 } from "./play-codec-1.20.6.js";
import { PLAY_SERVERBOUND_766 as OUT } from "./protocol-1.20.6-ids.js";

export const chatState762 = new ChatState762();
export const PROTOCOL_VERSION = 766;
export const decodePacket = (data) => decodePlayPacket766(data);

const packet = (name) => {
  const id = OUT[name];
  if (!Number.isInteger(id)) throw new Error("Unknown protocol-766 serverbound packet " + name);
  return new Writer766().varint(id);
};

function payloadChannel(channel) {
  if (!/^[a-z0-9_.-]+:[a-z0-9/._-]+$/.test(channel)) {
    throw new Error("Invalid custom payload channel: " + channel);
  }
  return channel;
}

function unsupported(name) {
  return () => {
    throw new Error("Protocol 766 outgoing packet not implemented yet: " + name);
  };
}

export const C = {
  teleportConfirm: (id) => packet("teleport_confirm").varint(id).build(),
  chunkBatchReceived: (chunksPerTick) => packet("chunk_batch_received").f32(chunksPerTick).build(),
  keepAlive: (id) => packet("keep_alive").i64(id).build(),
  pong: (id) => packet("pong").i32(id).build(),

  settings: (locale, viewDistance, chatFlags, chatColors, skinParts, mainHand = 1) =>
    packet("settings")
      .string(locale)
      .i8(viewDistance)
      .varint(chatFlags)
      .bool(chatColors)
      .u8(skinParts)
      .varint(mainHand)
      .bool(false)
      .bool(true)
      .build(),
  customPayload: (channel, data) =>
    packet("custom_payload").string(payloadChannel(channel)).raw(data).build(),

  clientCommand: (action) => packet("client_command").varint(action).build(),
  tabComplete: (text, _position = null, transactionId = 0) =>
    packet("tab_complete").varint(transactionId).string(text).build(),
  closeWindow: (windowId) => packet("close_window").u8(windowId).build(),

  flying: (onGround) => packet("flying").bool(onGround).build(),
  position: (x, y, z, onGround) =>
    packet("position").f64(x).f64(y).f64(z).bool(onGround).build(),
  look: (yaw, pitch, onGround) =>
    packet("look").f32(yaw).f32(pitch).bool(onGround).build(),
  positionLook: (x, y, z, yaw, pitch, onGround) =>
    packet("position_look")
      .f64(x).f64(y).f64(z)
      .f32(yaw).f32(pitch)
      .bool(onGround)
      .build(),
  vehicleMove: (x, y, z, yaw, pitch) =>
    packet("vehicle_move").f64(x).f64(y).f64(z).f32(yaw).f32(pitch).build(),
  steerBoat: (left, right) => packet("steer_boat").bool(left).bool(right).build(),
  abilities: (flags) => packet("abilities").i8(flags).build(),
  entityAction: (entityId, action, jumpBoost = 0) =>
    packet("entity_action").varint(entityId).varint(action).varint(jumpBoost).build(),
  steerVehicle: (sideways, forward, flags) =>
    packet("steer_vehicle").f32(sideways).f32(forward).u8(flags).build(),
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
  blockPlace: (x, y, z, face, hand, cursorX, cursorY, cursorZ, insideBlock = false, sequence = 0) =>
    packet("block_place")
      .varint(hand)
      .position(x, y, z)
      .varint(face)
      .f32(cursorX).f32(cursorY).f32(cursorZ)
      .bool(insideBlock)
      .varint(sequence)
      .build(),
  useItem: (hand = 0, sequence = 0) =>
    packet("use_item").varint(hand).varint(sequence).build(),

  queryBlockNbt: (transactionId, x, y, z) =>
    packet("query_block_nbt").varint(transactionId).position(x, y, z).build(),
  queryEntityNbt: (transactionId, entityId) =>
    packet("query_entity_nbt").varint(transactionId).varint(entityId).build(),

  placeRecipe: (windowId, recipe, makeAll) =>
    packet("craft_recipe_request").i8(windowId).string(String(recipe)).bool(makeAll).build(),
  recipeInfoShown: (recipe) => packet("displayed_recipe").string(String(recipe)).build(),
  recipeBookSettings: (bookId, open, filtering) =>
    packet("recipe_book").varint(bookId).bool(open).bool(filtering).build(),
  recipeInfoSettings: (open, filtering) =>
    packet("recipe_book").varint(0).bool(open).bool(filtering).build(),

  creativeSlot: (slot, item) => packet("set_creative_slot").i16(slot).slot(item).build(),

  //// Later parity gates own formats that changed materially in 1.20.x.
  chat: unsupported("chat_message"),
  windowClick: unsupported("window_click"),
  resourcePackStatus: unsupported("resource_pack_receive"),
  enchantItem: unsupported("enchant_item"),
  menuButton: unsupported("enchant_item"),
  seenAdvancements: unsupported("advancement_tab"),
  selectTrade: unsupported("select_trade"),
  nameItem: unsupported("name_item"),
  setBeaconEffects: unsupported("set_beacon_effect"),
  updateJigsaw: unsupported("update_jigsaw_block"),
  updateSign: unsupported("update_sign")
};

export const mcStringBytes = (value) => new Writer766().string(value).build();
