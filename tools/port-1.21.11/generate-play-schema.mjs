import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { cache, target } from "./prepare.mjs";
import { patchSharedComponentTypes } from "./generate-component-schema.mjs";

const outUrl = new URL("../../client/js/net/play-schema-1.21.11.js", import.meta.url);

const corePackets = [
  "login", "respawn", "position", "player_rotation",
  "map_chunk", "update_light", "unload_chunk", "block_change", "multi_block_change", "tile_entity_data",
  "window_items", "set_slot", "set_cursor_item", "set_player_inventory",
  "abilities", "experience", "update_health", "held_item_slot", "difficulty", "update_time", "spawn_position",
  "entity_metadata", "entity_update_attributes", "spawn_entity", "keep_alive", "kick_disconnect", "start_configuration"
];

const leaves = new Set([
  "i8", "u8", "i16", "u16", "i32", "u32", "i64", "f32", "f64", "bool", "varint", "varlong", "string", "UUID", "position",
  "anonymousNbt", "anonOptionalNbt", "Slot", "UntrustedSlot", "HashedSlot", "void", "optvarint",
  "vec2f", "vec3f", "vec3f64", "vec4f", "lpVec3"
]);

const constructors = new Set([
  "container", "array", "bitfield", "bitflags", "buffer", "entityMetadataLoop", "mapper", "option", "pstring",
  "registryEntryHolder", "registryEntryHolderSet", "switch", "topBitSetTerminatedArray"
]);

function collect(all, roots) {
  const out = {};
  const seen = new Set();
  const named = (name) => {
    if (leaves.has(name) || seen.has(name)) return;
    const spec = all[name];
    if (spec === undefined || spec === "native") return;
    seen.add(name);
    out[name] = spec;
    walk(spec);
  };
  const walk = (spec) => {
    if (typeof spec === "string") {
      named(spec);
      return;
    }
    if (!Array.isArray(spec)) return;
    const [kind, args] = spec;
    if (!constructors.has(kind)) throw new Error("Unsupported protocol-774 Play constructor " + kind);
    if (kind === "container") for (const field of args) walk(field.type);
    else if (kind === "array") { walk(args.type); if (args.countType) walk(args.countType); }
    else if (kind === "switch") {
      for (const value of Object.values(args.fields || {})) walk(value);
      if (args.default !== undefined) walk(args.default);
    } else if (kind === "mapper") walk(args.type);
    else if (kind === "option") walk(args);
    else if (kind === "pstring" && args.countType) walk(args.countType);
    else if (kind === "buffer" && args.countType) walk(args.countType);
    else if (kind === "registryEntryHolder") walk(args.otherwise.type);
    else if (kind === "registryEntryHolderSet") { walk(args.base.type); walk(args.otherwise.type); }
    else if (kind === "entityMetadataLoop" || kind === "topBitSetTerminatedArray") walk(args.type);
    else if (kind === "bitflags") walk(args.type);
  };
  for (const root of roots) named(root);
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

export async function generatePlaySchema(check = false) {
  const protocol = JSON.parse(await readFile(join(cache, "upstream/protocol.json"), "utf8"));
  const registries = JSON.parse(await readFile(join(cache, "generated", "reports", "registries.json"), "utf8"));
  const blocks = JSON.parse(await readFile(join(cache, "generated", "reports", "blocks.json"), "utf8"));
  const play = structuredClone(protocol.play.toClient.types);

  const field = (packetName, fieldName) => {
    const spec = play["packet_" + packetName];
    assert.equal(spec?.[0], "container", "Expected container packet " + packetName);
    const value = spec[1].find((entry) => entry.name === fieldName);
    assert.ok(value, "Missing packet field " + packetName + "." + fieldName);
    return value;
  };

  // Verified against 1.21.11 Java ClientboundSectionBlocksUpdatePacket,
  // ClientboundBlockEntityDataPacket, ClientboundInitializeBorderPacket,
  // ClientboundSetBorderLerpSizePacket, and ClientboundMoveMinecartPacket
  // (NewMinecartBehavior$MinecartStep: Vec3 position, Vec3 movement, byte yRot, byte xRot, float weight):
  field("multi_block_change", "records").type[1].type = "varlong";
  field("tile_entity_data", "nbtData").type = "anonymousNbt";
  field("initialize_world_border", "speed").type = "varlong";
  field("world_border_lerp_size", "speed").type = "varlong";
  const stepFields = field("move_minecart", "steps").type[1].type[1];
  for (const [fName, fType] of [["position", "vec3f64"], ["velocity", "vec3f64"], ["yaw", "i8"], ["pitch", "i8"]]) {
    const entry = stepFields.find((f) => f.name === fName);
    if (entry) entry.type = fType;
  }

  // Verified against 1.21.11 ClientboundPlayerInfoUpdatePacket$Action enum:
  // ordinals 6 and 7 are UPDATE_LIST_ORDER (0x40) then UPDATE_HAT (0x80),
  // and listed uses writeBoolean (not varint).
  const playerInfoAction = field("player_info", "action");
  playerInfoAction.type[1].flags = [
    "add_player",
    "initialize_chat",
    "update_game_mode",
    "update_listed",
    "update_latency",
    "update_display_name",
    "update_list_order",
    "update_hat"
  ];
  field("player_info", "data").type[1].type[1].find((f) => f.name === "listed").type[1].fields.true = "bool";

  // Tracked waypoint empty type has no extra payload.
  const waypointData = field("tracked_waypoint", "waypoint").type[1].find((f) => f.name === "data");
  if (waypointData?.type?.[0] === "switch" && waypointData.type[1].default === undefined) {
    waypointData.type[1].default = "void";
  }

  const packetMappings = play.packet[1][0].type[1].mappings;
  const idByName = Object.fromEntries(Object.entries(packetMappings).map(([id, name]) => [name, Number(id)]));
  const packets = Object.keys(idByName).sort((a, b) => idByName[a] - idByName[b]);
  for (const name of corePackets) assert.ok(idByName[name] !== undefined, "Missing required protocol-774 packet " + name);

  const all = { ...structuredClone(protocol.types), ...play };
  // Native DebugGoalInfo.STREAM_CODEC encodes List<DebugGoal>, not a single unprefixed DebugGoal.
  const debugEventFields = all.DebugSubscriptionEvent?.[1]?.find((f) => f.name === "value")?.type?.[1]?.fields;
  if (debugEventFields?.GoalSelectors && debugEventFields.GoalSelectors[0] !== "array") {
    debugEventFields.GoalSelectors = ["array", { countType: "varint", type: debugEventFields.GoalSelectors }];
  }
  const nativeIds = (registry) => Object.fromEntries(
    Object.entries(registries[registry].entries)
      .sort((a, b) => a[1].protocol_id - b[1].protocol_id)
      .map(([key, entry]) => [entry.protocol_id, key])
  );

  // Align Particle mappings with Mojang's native particle_type registry
  // (trial_spawner_detection / trial_spawner_detection_ominous) and default simple particles to void.
  const particleMap = nativeIds("minecraft:particle_type");
  all.Particle[1].find((entry) => entry.name === "type").type[1].mappings = Object.fromEntries(
    Object.entries(particleMap).map(([id, key]) => [id, key.replace(/^minecraft:/, "")])
  );
  all.Particle[1].find((entry) => entry.name === "data").type[1].default = "void";

  // Align command_node parser mappings and singleton argument properties with Mojang's command_argument_type registry.
  const commandArguments = all.command_node[1].find((entry) => entry.name === "extraNodeData").type[1].fields["2"][1];
  commandArguments.find((entry) => entry.name === "parser").type[1].mappings = nativeIds("minecraft:command_argument_type");
  const argumentProperties = commandArguments.find((entry) => entry.name === "properties").type[1].fields;
  for (const name of [
    "minecraft:loot_table",
    "minecraft:loot_predicate",
    "minecraft:loot_modifier",
    "minecraft:style",
    "minecraft:item_slots",
    "minecraft:nbt_compound_tag",
    "minecraft:nbt_tag"
  ]) {
    argumentProperties[name] = "void";
  }
  for (const name of Object.values(nativeIds("minecraft:command_argument_type"))) {
    assert.ok(Object.hasOwn(argumentProperties, name), "Missing native command argument properties for " + name);
  }
  for (const name of Object.keys(argumentProperties)) {
    if (!Object.values(nativeIds("minecraft:command_argument_type")).includes(name)) {
      delete argumentProperties[name];
    }
  }

  // Server links switch implicit defaults -> void.
  if (all.packet_common_server_links) {
    const linkFields = all.packet_common_server_links[1].find((f) => f.name === "links").type[1].type[1];
    for (const key of ["knownType", "unknownType"]) {
      const entry = linkFields.find((f) => f.name === key);
      if (entry?.type?.[0] === "switch" && entry.type[1].default === undefined) entry.type[1].default = "void";
    }
  }

  for (const name of packets) {
    const root = "packet_" + name;
    if (all[root] === undefined && all["packet_common_" + name] !== undefined) all[root] = all["packet_common_" + name];
    if (name === "bundle_delimiter" && all[root] === undefined) all[root] = ["container", []];
  }
  const roots = packets.map((name) => "packet_" + name);
  for (const root of roots) assert.ok(all[root], "Missing protocol-774 type " + root);
  const types = collect(all, roots);
  patchSharedComponentTypes(types);

  const ids = Object.fromEntries(packets.map((name) => [name, idByName[name]]));
  assert.ok(Object.values(ids).every(Number.isInteger), "Every protocol-774 Play packet needs a protocol ID");

  const orderedRegistry = (name) => Object.entries(registries[name].entries)
    .sort((a, b) => a[1].protocol_id - b[1].protocol_id)
    .map(([key]) => key);
  const blockEntityTypes = orderedRegistry("minecraft:block_entity_type");
  const entityTypes = orderedRegistry("minecraft:entity_type");
  const blockStateCount = Object.values(blocks).reduce((total, block) => total + block.states.length, 0);
  const airStates = ["minecraft:air", "minecraft:cave_air", "minecraft:void_air"].map((name) => {
    const state = blocks[name]?.states?.find((entry) => entry.default);
    assert.ok(state && Number.isInteger(state.id), "Missing default state for " + name);
    return state.id;
  });

  const value = {
    minecraftVersion: target.minecraftVersion,
    protocol: target.protocol,
    packets,
    ids,
    blockEntityTypes,
    entityTypes,
    blockStateCount,
    airStates,
    types
  };
  const text = "//// Generated from the pinned Minecraft 1.21.11 / protocol 774 schema. Do not edit by hand.\n" +
    "export const PLAY_SCHEMA_774 = " + JSON.stringify(value) + ";\n";
  if (check) {
    assert.equal(await readFile(outUrl, "utf8"), text, "Generated protocol-774 Play schema differs");
    console.log("Verified " + packets.length + " protocol-774 Play packet bodies / " + Object.keys(types).length + " named helper types");
  } else {
    await writeFile(outUrl, text);
    console.log("Generated " + packets.length + " protocol-774 Play packet bodies / " + Object.keys(types).length + " named helper types");
  }
  return value;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await generatePlaySchema(process.argv.includes("--check"));
}
