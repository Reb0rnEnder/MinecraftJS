import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { reports } from "./reports.mjs";
import { cache, target } from "./prepare.mjs";
import { canonicalJson } from "./canonical-report.mjs";

const schemaUrl = new URL("../../client/js/net/item-components-1.20.6-schema.js", import.meta.url);
const defaultsUrl = new URL("../../client/js/net/item-components-1.20.6-defaults.js", import.meta.url);

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
    } else if (kind !== "bitfield") {
      throw new Error("Unsupported reachable protocol constructor: " + kind);
    }
  };

  for (const root of roots) named(root);
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

function source(name, value) {
  return "// Generated from the pinned Minecraft 1.20.6 / protocol 766 inputs. Do not edit by hand.\n" +
    "export const " + name + " = " + (name === 'ITEM_DEFAULTS_766' ? canonicalJson(value) : JSON.stringify(value)) + ";\n";
}

export async function generateComponentSchema(check = false) {
  await reports(true);

  const protocol = JSON.parse(await readFile(join(cache, "protocol-1.20.6.json"), "utf8"));
  const items = JSON.parse(await readFile(join(cache, "generated", "reports", "items.json"), "utf8"));
  const registries = JSON.parse(await readFile(join(cache, "generated", "reports", "registries.json"), "utf8"));

  const componentMap = protocol.types.SlotComponentType;
  assert.equal(componentMap?.[0], "mapper");
  const componentNames = Object.entries(componentMap[1].mappings)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([, name]) => name);
  assert.equal(componentNames.length, 56);

  const types = collectTypes(protocol.types, ["Slot", "SlotComponent"]);
  // Native PotionContents has exactly potion/customColor/customEffects in
  // protocol 766. The pinned upstream schema includes a later customName field.
  const potion=types.SlotComponent[1][1].type[1].fields.potion_contents;
  assert.equal(potion[0],'container');
  potion[1]=potion[1].filter(field=>field.name!=='customName');
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
    for (const component of report.components || []) {
      const type = component.type.replace(/^minecraft:/, "");
      assert.ok(componentNames.includes(type), name + " has unknown component " + type);
      defaults[type] = component.value;
    }
    itemDefaults[entry.protocol_id] = { name, defaults };
  }
  assert.ok(itemDefaults.every(Boolean), "Item protocol IDs must be contiguous");

  const defaults = {
    minecraftVersion: target.minecraftVersion,
    protocol: target.protocol,
    items: itemDefaults
  };

  const schemaText = source("ITEM_COMPONENT_SCHEMA_766", schema);
  const defaultsText = source("ITEM_DEFAULTS_766", defaults);

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
