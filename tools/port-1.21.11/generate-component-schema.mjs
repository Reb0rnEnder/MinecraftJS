import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { reports } from "./reports.mjs";
import { cache, target } from "./prepare.mjs";
import { canonicalJson } from "./canonical-report.mjs";

const schemaUrl = new URL("../../client/js/net/item-components-1.21.11-schema.js", import.meta.url);
const defaultsUrl = new URL("../../client/js/net/item-components-1.21.11-defaults.js", import.meta.url);

function collectTypes(allTypes, roots) {
  const out = {};
  const seen = new Set();

  const named = (name) => {
    if (seen.has(name)) return;
    if (!Object.hasOwn(allTypes, name) || allTypes[name] === "native") return;
    seen.add(name);
    out[name] = allTypes[name];
    walk(allTypes[name]);
  };

  const walk = (spec) => {
    if (typeof spec === "string") {
      named(spec);
      return;
    }
    if (!Array.isArray(spec)) return;
    const [kind, args] = spec;
    if (kind === "container") {
      for (const field of args) walk(field.type);
    } else if (kind === "switch") {
      for (const type of Object.values(args.fields || {})) walk(type);
      if (args.default !== undefined) walk(args.default);
    } else if (kind === "array") {
      walk(args.type);
      if (args.countType) walk(args.countType);
    } else if (kind === "mapper") {
      walk(args.type);
    } else if (kind === "option") {
      walk(args);
    } else if (kind === "pstring") {
      if (args.countType) walk(args.countType);
    } else if (kind === "registryEntryHolder") {
      walk(args.otherwise.type);
    } else if (kind === "registryEntryHolderSet") {
      walk(args.base.type);
      walk(args.otherwise.type);
    } else if (kind === "buffer") {
      if (args.countType) walk(args.countType);
    } else if (kind !== "bitfield") {
      throw new Error("Unsupported reachable protocol constructor: " + kind);
    }
  };

  for (const root of roots) named(root);
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

export function patchSharedComponentTypes(types) {
  // 1. Native DataComponentPredicate.STREAM_CODEC: list of
  //    Either<DataComponentPredicate.Type, DataComponentType> + anonymous NBT.
  if (types.DataComponentMatchers) {
    types.DataComponentMatchers = [
      "container",
      [
        { name: "exactMatchers", type: "ExactComponentMatcher" },
        {
          name: "partialMatchers",
          type: [
            "array",
            {
              countType: "varint",
              type: [
                "container",
                [
                  { name: "isPredicateType", type: "bool" },
                  { name: "typeId", type: "varint" },
                  { name: "value", type: "anonymousNbt" }
                ]
              ]
            }
          ]
        }
      ]
    ];
  }

  // 2. Native PlayerSkin.Patch.model uses ByteBufCodecs.BOOL (false=wide, true=slim).
  if (types.PlayerSkinPatch) {
    const model = types.PlayerSkinPatch[1].find((f) => f.name === "model");
    if (model) {
      model.type = ["option", ["mapper", { type: "bool", mappings: { false: "wide", true: "slim" } }]];
    }
  }

  // 3. Native ResolvableProfile uses ByteBufCodecs.either (true=complete, false=partial).
  if (types.ResolvableProfile) {
    const typeField = types.ResolvableProfile[1].find((f) => f.name === "type");
    if (typeField) {
      typeField.type = ["mapper", { type: "bool", mappings: { false: "partial", true: "complete" } }];
    }
  }

  // 4. Explicit default: "void" on attribute_modifiers[].display.component switch.
  const attr = types.SlotComponent?.[1]?.[1]?.type?.[1]?.fields?.attribute_modifiers;
  if (attr) {
    const display = attr[1].type[1].find((f) => f.name === "display");
    const comp = display?.type?.[1]?.find((f) => f.name === "component");
    if (comp?.type?.[0] === "switch" && comp.type[1].default === undefined) {
      comp.type[1].default = "void";
    }
  }

  // 5. UntrustedSlot switch defaults cleanly on non-zero itemCount.
  if (types.UntrustedSlot) {
    const sw = types.UntrustedSlot[1].find((f) => f.anon)?.type;
    if (sw?.[0] === "switch" && sw[1].fields) delete sw[1].fields.false;
  }

  // 6. Native WrittenBookContent uses Filterable.streamCodec(ComponentSerialization.STREAM_CODEC),
  //    which prefixes Optional<Component> with a boolean flag rather than TAG_End.
  if (types.ItemWrittenBookPage) {
    const filtered = types.ItemWrittenBookPage[1]?.find((f) => f.name === "filteredContent");
    if (filtered && filtered.type === "anonOptionalNbt") {
      filtered.type = ["option", "anonymousNbt"];
    }
  }

  // 7. Native BlockPredicate.STREAM_CODEC uses ByteBufCodecs.optional(NbtPredicate.STREAM_CODEC).
  if (types.ItemBlockPredicate) {
    const nbt = types.ItemBlockPredicate[1]?.find((f) => f.name === "nbt");
    if (nbt && nbt.type === "anonOptionalNbt") {
      nbt.type = ["option", "anonymousNbt"];
    }
  }

  // 8. Native Bees uses BeehiveBlockEntity.Occupant -> TypedEntityData.streamCodec(EntityType.STREAM_CODEC).
  const bees = types.SlotComponent?.[1]?.find((f) => f.name === "data")?.type?.[1]?.fields?.bees;
  const beeEntry = bees?.[1]?.find?.((f) => f.name === "bees")?.type?.[1]?.type;
  if (beeEntry?.[0] === "container" && !beeEntry[1].some((f) => f.name === "entityType")) {
    beeEntry[1].unshift({ name: "entityType", type: "varint" });
  }

  // 9. Native StatePropertiesPredicate$RangedMatcher encodes min/max as Optional<String>.
  if (types.ItemBlockProperty) {
    const ranged = types.ItemBlockProperty[1]?.find((f) => f.name === "value")?.type?.[1]?.fields?.false;
    if (ranged?.[0] === "container") {
      for (const boundName of ["minValue", "maxValue"]) {
        const entry = ranged[1].find((f) => f.name === boundName);
        if (entry && entry.type === "string") entry.type = ["option", "string"];
      }
    }
  }

  // 10. Native PaintingVariant.DIRECT_STREAM_CODEC uses VarInt for width and height.
  if (types.EntityMetadataPaintingVariant?.[0] === "container") {
    for (const dim of ["width", "height"]) {
      const entry = types.EntityMetadataPaintingVariant[1].find((f) => f.name === dim);
      if (entry && entry.type === "i32") entry.type = "varint";
    }
  }

  // 11. Native Equippable.STREAM_CODEC uses EquipmentSlot.STREAM_CODEC (BY_ID `id` field,
  //     not enum ordinal): 0=main_hand, 1=feet, 2=legs, 3=chest, 4=head, 5=off_hand, 6=body, 7=saddle.
  const equipSlot = types.SlotComponent?.[1]?.[1]?.type?.[1]?.fields?.equippable?.[1]?.find?.((f) => f.name === "slot");
  if (equipSlot?.type?.[0] === "mapper") {
    equipSlot.type[1].mappings = {
      0: "main_hand",
      1: "feet",
      2: "legs",
      3: "chest",
      4: "head",
      5: "off_hand",
      6: "body",
      7: "saddle"
    };
  }
}

function source(name, value) {
  return "// Generated from the pinned Minecraft 1.21.11 / protocol 774 inputs. Do not edit by hand.\n" +
    "export const " + name + " = " + (name === "ITEM_DEFAULTS_774" ? canonicalJson(value) : JSON.stringify(value)) + ";\n";
}

export async function generateComponentSchema(check = false) {
  await reports(true);

  const protocol = JSON.parse(await readFile(join(cache, "upstream/protocol.json"), "utf8"));
  const items = JSON.parse(await readFile(join(cache, "generated", "reports", "items.json"), "utf8"));
  const registries = JSON.parse(await readFile(join(cache, "generated", "reports", "registries.json"), "utf8"));

  const componentMap = protocol.types.SlotComponentType;
  assert.equal(componentMap?.[0], "mapper");
  const componentEntries = Object.entries(componentMap[1].mappings)
    .sort((a, b) => Number(a[0]) - Number(b[0]));
  const componentNames = componentEntries.map(([, name]) => name);

  const nativeComponents = registries["minecraft:data_component_type"].entries;
  assert.equal(componentNames.length, Object.keys(nativeComponents).length, "Component count mismatch");
  for (const [id, name] of componentEntries) {
    assert.equal(nativeComponents["minecraft:" + name]?.protocol_id, Number(id), "Component ID mismatch " + name);
  }

  const types = collectTypes(protocol.types, ["Slot", "SlotComponent", "UntrustedSlot", "HashedSlot", "ExactComponentMatcher"]);
  patchSharedComponentTypes(types);

  const schema = {
    minecraftVersion: target.minecraftVersion,
    protocol: target.protocol,
    componentNames,
    types
  };

  const itemEntries = registries["minecraft:item"].entries;
  const itemDefaults = new Array(Object.keys(itemEntries).length);
  for (const [name, entry] of Object.entries(itemEntries)) {
    const report = items[name];
    assert.ok(report, "Missing item report for " + name);
    const defaults = {};
    if (Array.isArray(report.components)) {
      for (const component of report.components) {
        const type = component.type.replace(/^minecraft:/, "");
        assert.ok(componentNames.includes(type), name + " has unknown component " + type);
        defaults[type] = component.value;
      }
    } else {
      for (const [rawType, value] of Object.entries(report.components || {})) {
        const type = rawType.replace(/^minecraft:/, "");
        assert.ok(componentNames.includes(type), name + " has unknown component " + type);
        defaults[type] = value;
      }
    }
    itemDefaults[entry.protocol_id] = { name, defaults };
  }
  assert.ok(itemDefaults.every(Boolean), "Item protocol IDs must be contiguous");

  const defaults = {
    minecraftVersion: target.minecraftVersion,
    protocol: target.protocol,
    items: itemDefaults
  };

  const schemaText = source("ITEM_COMPONENT_SCHEMA_774", schema);
  const defaultsText = source("ITEM_DEFAULTS_774", defaults);

  if (check) {
    assert.equal(await readFile(schemaUrl, "utf8"), schemaText, "Generated component schema differs");
    assert.equal(await readFile(defaultsUrl, "utf8"), defaultsText, "Generated item defaults differ");
    console.log("Verified " + componentNames.length + " component codecs and " + itemDefaults.length + " item default sets");
  } else {
    await writeFile(schemaUrl, schemaText);
    await writeFile(defaultsUrl, defaultsText);
    console.log("Generated " + componentNames.length + " component codecs and " + itemDefaults.length + " item default sets");
  }
  return { schema, defaults };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await generateComponentSchema(process.argv.includes("--check"));
}
