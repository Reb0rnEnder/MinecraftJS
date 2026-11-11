import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { cache, target } from "./prepare.mjs";

const outUrl = new URL("../../client/js/net/play-schema-1.20.6.js", import.meta.url);

const corePackets = [
  "login","respawn","position",
  "map_chunk","update_light","unload_chunk","block_change","multi_block_change","tile_entity_data",
  "window_items","set_slot",
  "abilities","experience","update_health","held_item_slot","difficulty","update_time","spawn_position",
  "entity_metadata","entity_update_attributes","spawn_entity","keep_alive","kick_disconnect","start_configuration"
];

const leaves = new Set([
  "i8","u8","i16","i32","i64","f32","f64","bool","varint","varlong","string","UUID","position",
  "anonymousNbt","anonOptionalNbt","Slot","void","optvarint","vec3f","vec3f64","vec3i16","vec4f"
]);

const constructors = new Set([
  "container","array","bitfield","bitflags","buffer","entityMetadataLoop","mapper","option","pstring",
  "registryEntryHolder","registryEntryHolderSet","switch","topBitSetTerminatedArray"
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
    if (!constructors.has(kind)) throw new Error("Unsupported protocol-766 Play constructor " + kind);
    if (kind === "container") for (const field of args) walk(field.type);
    else if (kind === "array") { walk(args.type); if (args.countType) walk(args.countType); }
    else if (kind === "switch") {
      for (const value of Object.values(args.fields || {})) walk(value);
      if (args.default !== undefined) walk(args.default);
    } else if (kind === "mapper") walk(args.type);
    else if (kind === "option") walk(args);
    else if (kind === "pstring" && args.countType) walk(args.countType);
    else if (kind === "registryEntryHolder") walk(args.otherwise.type);
    else if (kind === "registryEntryHolderSet") { walk(args.base.type); walk(args.otherwise.type); }
    else if (kind === "entityMetadataLoop" || kind === "topBitSetTerminatedArray") walk(args.type);
    else if (kind === "bitflags") walk(args.type);
  };
  for (const root of roots) named(root);
  return Object.fromEntries(Object.entries(out).sort(([a],[b]) => a.localeCompare(b)));
}

export async function generatePlaySchema(check = false) {
  const protocol = JSON.parse(await readFile(join(cache, "protocol-1.20.6.json"), "utf8"));
  const registries = JSON.parse(await readFile(join(cache, "generated", "reports", "registries.json"), "utf8"));
  const blocks = JSON.parse(await readFile(join(cache, "generated", "reports", "blocks.json"), "utf8"));
  const play = protocol.play.toClient.types;

  //// minecraft-data 1.20.5 currently describes these three long-valued fields as VarInt.
  //// The pinned Mojang 1.20.6 packet classes read/write them with FriendlyByteBuf VarLong.
  const field = (packetName, fieldName) => {
    const spec = play["packet_" + packetName];
    assert.equal(spec?.[0], "container", "Expected container packet " + packetName);
    const value = spec[1].find((entry) => entry.name === fieldName);
    assert.ok(value, "Missing packet field " + packetName + "." + fieldName);
    return value;
  };
  field("multi_block_change", "records").type[1].type = "varlong";
  field("initialize_world_border", "speed").type = "varlong";
  field("world_border_lerp_size", "speed").type = "varlong";
  // The upstream schema still lists the removed banner-add-pattern serializer,
  // shifting every subsequent recipe ID. Registry IDs come from Mojang reports.
  const recipeFields = field('declare_recipes', 'recipes').type[1].type[1];
  const recipeType = recipeFields.find(entry => entry.name === 'type');
  const recipeBodies = recipeFields.find(entry => entry.name === 'data').type[1].fields;
  recipeType.type[1].mappings = Object.fromEntries(Object.entries(registries['minecraft:recipe_serializer'].entries)
    .sort((a,b) => a[1].protocol_id - b[1].protocol_id)
    .map(([name, entry]) => {
      assert.ok(recipeBodies[name], 'Missing native recipe serializer body ' + name);
      return [entry.protocol_id, name];
    }));
  const packetMappings = play.packet[1][0].type[1].mappings;
  const idByName = Object.fromEntries(Object.entries(packetMappings).map(([id, name]) => [name, Number(id)]));
  const packets = Object.keys(idByName).sort((a, b) => idByName[a] - idByName[b]);
  for (const name of corePackets) assert.ok(idByName[name] !== undefined, "Missing required protocol-766 packet " + name);
  const all = { ...protocol.types, ...play };
  const nativeIds = registry => Object.fromEntries(Object.entries(registries[registry].entries)
    .sort((a,b) => a[1].protocol_id - b[1].protocol_id).map(([key,entry]) => [entry.protocol_id,key]));
  // SimpleParticleType has no payload; the upstream switch omits its default.
  all.Particle[1].find(entry => entry.name === 'type').type[1].mappings = Object.fromEntries(
    Object.entries(nativeIds('minecraft:particle_type')).map(([id,key]) => [id,key.replace(/^minecraft:/,'')]));
  all.Particle[1].find(entry => entry.name === 'data').type[1].default = 'void';
  const commandArguments = all.command_node[1].find(entry => entry.name === 'extraNodeData').type[1].fields['2'][1];
  commandArguments.find(entry => entry.name === 'parser').type[1].mappings = nativeIds('minecraft:command_argument_type');
  const argumentProperties = commandArguments.find(entry => entry.name === 'properties').type[1].fields;
  // ArgumentTypeInfos registers these as SingletonArgumentInfo.contextAware:
  // their templates have no network fields (native il, lines 153-155).
  for (const name of ['minecraft:loot_table','minecraft:loot_predicate','minecraft:loot_modifier','minecraft:style','minecraft:item_slots','minecraft:nbt_compound_tag','minecraft:nbt_tag']) argumentProperties[name] = 'void';
  for (const name of Object.values(nativeIds('minecraft:command_argument_type'))) {
    assert.ok(Object.hasOwn(argumentProperties,name),'Missing native command argument properties for ' + name);
  }
  for (const name of packets) {
    const root = "packet_" + name;
    if (all[root] === undefined && all["packet_common_" + name] !== undefined) all[root] = all["packet_common_" + name];
    if (name === "bundle_delimiter" && all[root] === undefined) all[root] = ["container", []];
  }
  const roots = packets.map((name) => "packet_" + name);
  for (const root of roots) assert.ok(all[root], "Missing protocol-766 type " + root);
  const types = collect(all, roots);
  const ids = Object.fromEntries(packets.map((name) => [name, idByName[name]]));
  assert.ok(Object.values(ids).every(Number.isInteger), "Every protocol-766 Play packet needs a protocol ID");
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
  const text = "//// Generated from the pinned Minecraft 1.20.6 / protocol 766 schema. Do not edit by hand.\n" +
    "export const PLAY_SCHEMA_766 = " + JSON.stringify(value) + ";\n";
  if (check) {
    assert.equal(await readFile(outUrl, "utf8"), text, "Generated protocol-766 Play schema differs");
    console.log("Verified " + packets.length + " protocol-766 Play packet bodies / " + Object.keys(types).length + " named helper types");
  } else {
    await writeFile(outUrl, text);
    console.log("Generated " + packets.length + " protocol-766 Play packet bodies / " + Object.keys(types).length + " named helper types");
  }
  return value;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await generatePlaySchema(process.argv.includes("--check"));
}
