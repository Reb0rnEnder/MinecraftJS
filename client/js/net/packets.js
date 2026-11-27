import {technicalPackets} from './technical-packets.js';
import { ChatState766 } from "./chat-state-1.20.6.js";
import { Writer766 } from "./configuration-1.20.6.js";
import { decodePlayPacket766 } from "./play-codec-1.20.6.js";
import { PLAY_SERVERBOUND_26_3 as OUT } from "./protocol-26.3-ids.js";
import { writeLpVec3 } from "./lp-vec3-26.3.js";
import { writeItemStack26_3, writeHashedStack26_3 } from "./item-components-26.3.js";
import { writeAnonymousNbt } from "./nbt-anonymous.js";

// The 26.3 table renames chat_message -> chat and appends the LastSeenMessages.Update
// checksum byte. Keep the historical export name for the game's chat tracking.
export const chatState263 = new ChatState766({out: OUT, checksum: true});
export const chatState762 = chatState263;
export const PROTOCOL_VERSION = 777;
export const decodePacket = (data) => decodePlayPacket766(data);

// Generic handler names (shared with 1.20.6) to the native 26.3 serverbound names.
const OUTBOUND_26_3 = Object.freeze({
  teleport_confirm:'accept_teleportation', query_block_nbt:'block_entity_tag_query',
  set_difficulty:'change_difficulty', message_acknowledgement:'chat_ack',
  chat_command:'chat_command', chat_command_signed:'chat_command_signed', chat_message:'chat',
  chat_session_update:'chat_session_update', chunk_batch_received:'chunk_batch_received',
  client_command:'client_command', settings:'client_information', tab_complete:'command_suggestion',
  configuration_acknowledged:'configuration_acknowledged', enchant_item:'container_button_click',
  window_click:'container_click', close_window:'container_close', set_slot_state:'container_slot_state_changed',
  cookie_response:'cookie_response', custom_payload:'custom_payload',
  debug_sample_subscription:'debug_subscription_request', edit_book:'edit_book',
  query_entity_nbt:'entity_tag_query', use_entity:'interact', generate_structure:'jigsaw_generate',
  keep_alive:'keep_alive', lock_difficulty:'lock_difficulty', position:'move_player_pos',
  position_look:'move_player_pos_rot', look:'move_player_rot', flying:'move_player_status_only',
  vehicle_move:'move_vehicle', steer_boat:'paddle_boat', pick_item:'pick_item_from_block',
  ping_request:'ping_request', craft_recipe_request:'place_recipe', abilities:'player_abilities',
  block_dig:'player_action', entity_action:'player_command', steer_vehicle:'player_input',
  pong:'pong', arm_animation:'punch', recipe_book:'recipe_book_change_settings',
  displayed_recipe:'recipe_book_seen_recipe', name_item:'rename_item',
  resource_pack_receive:'resource_pack', advancement_tab:'seen_advancements',
  select_trade:'select_trade', set_beacon_effect:'set_beacon', held_item_slot:'set_carried_item',
  update_command_block:'set_command_block', update_command_block_minecart:'set_command_minecart',
  set_creative_slot:'set_creative_mode_slot', update_jigsaw_block:'set_jigsaw_block',
  update_structure_block:'set_structure_block', update_sign:'sign_update', spectate:'teleport_to_entity',
  block_place:'use_item_on', use_item:'use_item'
});
const packet = (name) => {
  const id = OUT[OUTBOUND_26_3[name] || name];
  if (!Number.isInteger(id)) throw new Error("Unknown protocol-777 serverbound packet " + name);
  return new Writer766().varint(id);
};

function payloadChannel(channel) {
  if (!/^[a-z0-9_.-]+:[a-z0-9/._-]+$/.test(channel)) {
    throw new Error("Invalid custom payload channel: " + channel);
  }
  return channel;
}

export const C = {
  ...technicalPackets(packet),
  // Packets this client intentionally never originates because no screen or behavior owns
  // them. Every other Protocol 777 serverbound id has a sender below.
  outboundScope: Object.freeze({
    test_instance_block_action: 'gametest block editor; no client screen and server command path owns it'
  }),
  // 26.3 splits one client tick across several movement packets; the server only
  // clears its per-tick "position received" flag when this packet ends the tick.
  clientTickEnd: () => packet('client_tick_end').build(),
  configurationAcknowledged: () => packet('configuration_acknowledged').build(),
  playerLoaded: () => packet('player_loaded').build(),
  bundleItemSelected: (slotId, selectedItemIndex) =>
    packet('bundle_item_selected').varint(slotId).varint(selectedItemIndex).build(),
  chatAck: (offset) => packet('message_acknowledgement').varint(offset).build(),
  changeGameMode: (mode) => packet('change_game_mode').varint(mode).build(),
  pickItemFromEntity: (entityId, includeData = false) =>
    packet('pick_item_from_entity').varint(entityId).bool(includeData).build(),
  spectatorAction: (entityId = null) =>
    packet('spectator_action').varint(entityId == null ? 0 : entityId + 1).build(),
  setGameRule: (entries) => {
    const w = packet('set_game_rule').varint(entries.length);
    for (const {name, value} of entries) w.string(String(name)).string(String(value));
    return w.build();
  },
  setTestBlock: (pos, mode, message = '') =>
    packet('set_test_block').position(pos.x, pos.y, pos.z).varint(mode).string(String(message)).build(),
  setDifficulty: value => packet('set_difficulty').u8(value).build(),
  lockDifficulty: value => packet('lock_difficulty').bool(value).build(),
  pickItem: slot => packet('pick_item').varint(slot).build(),
  pingRequest: id => packet('ping_request').i64(id).build(),
  debugSampleSubscription: type => packet('debug_sample_subscription').varint(type).build(),
  setSlotState: (slot, windowId, enabled) => packet('set_slot_state').varint(slot).varint(windowId).bool(enabled).build(),
  generateStructure: (pos, levels, keepJigsaws) => packet('generate_structure').position(pos.x,pos.y,pos.z).varint(levels).bool(keepJigsaws).build(),
  editBook: (slot, pages, title = null) => {
    const w = packet('edit_book').varint(slot).varint(pages.length);
    for (const page of pages) w.string(page);
    w.bool(title !== null); if (title !== null) w.string(title);
    return w.build();
  },
  chatSession: ({sessionUUID, expireTime, publicKey, signature}) => packet('chat_session_update')
    .uuid(sessionUUID).i64(expireTime).varint(publicKey.length).raw(publicKey).varint(signature.length).raw(signature).build(),
  signedCommand: (command, {timestamp, salt, argumentSignatures = [], messageCount = 0, acknowledged}) => {
    if (!(acknowledged instanceof Uint8Array) || acknowledged.length !== 3) throw Error('Chat acknowledgement must be 3 bytes');
    const w = packet('chat_command_signed').string(command).i64(timestamp).i64(salt).varint(argumentSignatures.length);
    for (const {argumentName, signature} of argumentSignatures) {
      if (!(signature instanceof Uint8Array) || signature.length !== 256) throw Error('Chat argument signature must be 256 bytes');
      w.string(argumentName).raw(signature);
    }
    return w.varint(messageCount).raw(acknowledged).u8(0).build();
  },
  // 26.3 echoes the accepted position and rotations in the acknowledgement itself.
  teleportConfirm: (id, x = 0, y = 0, z = 0, yaw = 0, pitch = 0) =>
    packet("teleport_confirm").varint(id).f64(x).f64(y).f64(z).f32(yaw).f32(pitch).build(),
  chunkBatchReceived: (chunksPerTick) => packet("chunk_batch_received").f32(chunksPerTick).build(),
  keepAlive: (id) => packet("keep_alive").i64(id).build(),
  pong: (id) => packet("pong").i32(id).build(),

  // 26.3 ClientInformation: string, VarInt viewDistance, ChatVisiblity, bool chatColors,
  // byte modelCustomisation, HumanoidArm, bool textFiltering, bool allowsListing, ParticleStatus.
  settings: (locale, viewDistance, chatFlags, chatColors, skinParts, mainHand = 1, allowServerListing = true) =>
    packet("settings")
      .string(locale)
      .varint(viewDistance)
      .varint(chatFlags)
      .bool(chatColors)
      .u8(skinParts)
      .varint(mainHand)
      .bool(false)
      .bool(allowServerListing)
      .varint(0)
      .build(),
  customPayload: (channel, data) =>
    packet("custom_payload").string(payloadChannel(channel)).raw(data).build(),
  // ServerboundCustomClickActionPacket: Identifier plus Optional<Tag> (bool, then the anonymous
  // tag). Dialog custom actions use the additions compound as that payload.
  customClickAction: (id, payload = null) => {
    const w = packet("custom_click_action").string(payloadChannel(id)).bool(payload != null);
    if (payload != null) writeAnonymousNbt(w, payload);
    return w.build();
  },

  clientCommand: (action) => packet("client_command").varint(action).build(),
  cookieResponse: (key, value) => {
    const w = packet('cookie_response').string(String(key)).bool(value != null);
    if (value != null) w.raw(value instanceof Uint8Array ? value : new Uint8Array(value));
    return w.build();
  },
  tabComplete: (text, _position = null, transactionId = 0) =>
    packet("tab_complete").varint(transactionId).string(text).build(),
  // ServerboundContainerClosePacket(containerId): writeContainerId is a VarInt in 26.3.
  closeWindow: (windowId) => packet("close_window").varint(windowId).build(),

  // 26.3 packs onGround (bit 0) and horizontalCollision (bit 1) into one flags byte
  // written after the position/rotation fields in every movement packet.
  flying: (onGround, horizontalCollision = false) =>
    packet("flying").u8((onGround?1:0)|(horizontalCollision?2:0)).build(),
  position: (x, y, z, onGround, horizontalCollision = false) =>
    packet("position").f64(x).f64(y).f64(z).u8((onGround?1:0)|(horizontalCollision?2:0)).build(),
  look: (yaw, pitch, onGround, horizontalCollision = false) =>
    packet("look").f32(yaw).f32(pitch).u8((onGround?1:0)|(horizontalCollision?2:0)).build(),
  positionLook: (x, y, z, yaw, pitch, onGround, horizontalCollision = false) =>
    packet("position_look")
      .f64(x).f64(y).f64(z)
      .f32(yaw).f32(pitch)
      .u8((onGround?1:0)|(horizontalCollision?2:0))
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
  armAnimation: () => packet("arm_animation").build(),
  spectate: (uuid) => packet("spectate").uuid(uuid).build(),

  // 26.3 ServerboundInteractPacket(int entityId, InteractionHand, Vec3.LP location, boolean
  // usingSecondaryAction): attacking is a separate packet, so mouse 1 goes to attack.
  useEntity: (target, mouse, x, y, z, hand = 0, sneaking = false) => {
    if (mouse === 1) return packet("attack").varint(target).build();
    const writer = packet("use_entity").varint(target).varint(hand);
    writeLpVec3(writer, mouse === 2 ? {x, y, z} : {});
    return writer.bool(sneaking).build();
  },
  // ServerboundPlayerActionPacket: action enum (VarInt), packed position, Direction 3D value
  // as one byte, then the sequence VarInt.
  blockDig: (status, x, y, z, face, sequence = 0) =>
    packet("block_dig").varint(status).position(x, y, z).u8(face).varint(sequence).build(),
  // BlockHitResult.STREAM_CODEC: BlockPos, Direction (VarInt), three cursor floats, then
  // insideBlock and worldBorderHit booleans. ServerboundUseItemOnPacket appends the sequence.
  blockPlace: (x, y, z, face, hand, cursorX, cursorY, cursorZ, insideBlock = false, sequence = 0) =>
    packet("block_place")
      .varint(hand)
      .position(x, y, z)
      .varint(face)
      .f32(cursorX).f32(cursorY).f32(cursorZ)
      .bool(insideBlock)
      .bool(false)
      .varint(sequence)
      .build(),
  useItem: (hand = 0, sequence = 0, yaw = 0, pitch = 0) =>
    packet("use_item").varint(hand).varint(sequence).f32(yaw).f32(pitch).build(),

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

  // ServerboundSetCreativeModeSlotPacket: short slot then ItemStack.OPTIONAL_UNTRUSTED_STREAM_CODEC,
  // which is the 26.3 stack with components.
  creativeSlot: (slot, item) => {
    const writer = packet("set_creative_slot").i16(slot);
    writeItemStack26_3(writer, item);
    return writer.build();
  },

  // ServerboundContainerClickPacket: container id VarInt, state id VarInt, short slot, byte
  // button, ContainerInput id VarInt, then (short slot, HashedStack) per changed slot and the
  // carried HashedStack. HashedStack carries component hashes, so only empty patches are sent
  // until the component hash encoder lands.
  windowClick: (windowId, slot, mouseButton, stateId, mode, changedSlots, cursorItem) => {
    const writer = packet("window_click")
      .varint(windowId)
      .varint(stateId)
      .i16(slot)
      .i8(mouseButton)
      .varint(mode)
      .varint(changedSlots.length);
    for (const changed of changedSlots) {
      writer.i16(changed.slot);
      writeHashedStack26_3(writer, changed.item);
    }
    writeHashedStack26_3(writer, cursorItem);
    return writer.build();
  },

  chat: (message, options = undefined) => chatState263.encode(String(message), options),
  resourcePackStatus: (uuid, result) => packet("resource_pack_receive").uuid(uuid).varint(result).build(),
  enchantItem: (windowId, enchantment) => packet("enchant_item").i8(windowId).i8(enchantment).build(),
  menuButton: (windowId, button) => packet("enchant_item").i8(windowId).i8(button).build(),
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

export const mcStringBytes = (value) => new Writer766().string(value).build();
