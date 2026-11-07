import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Reader766, Writer766 } from "../client/js/net/configuration-1.20.6.js";
import {
  COMPONENT_NAMES,
  readComponentData766,
  writeComponentData766
} from "../client/js/net/item-components-1.20.6.js";
import { ITEM_COMPONENT_SCHEMA_766 } from "../client/js/net/item-components-1.20.6-schema.js";
import { ITEM_DEFAULTS_766 } from "../client/js/net/item-components-1.20.6-defaults.js";
import { componentToNbt } from "../client/js/net/component-nbt-1.20.6.js";

const TYPES = ITEM_COMPONENT_SCHEMA_766.types;
const BRANCHES = TYPES.SlotComponent[1][1].type[1].fields;
const idFor = (name) => ITEM_DEFAULTS_766.items.findIndex((item) => item.name === name);
const STONE_ID = idFor("minecraft:stone");
const DIAMOND_SWORD_ID = idFor("minecraft:diamond_sword");
const nativeStacks = JSON.parse(
  readFileSync(new URL("./port-1.20.6/stack-fixtures.json", import.meta.url), "utf8")
);

function samplePrimitive(name) {
  switch (name) {
    case "i8": return 1;
    case "i32": return 17;
    case "i64": return 19n;
    case "f32": return 1.25;
    case "f64": return 2.5;
    case "bool": return true;
    case "varint": return 1;
    case "string": return "minecraft:test";
    case "UUID": return "12345678-1234-4234-8234-123456789abc";
    case "position": return { x: -123, y: 64, z: 456 };
    case "anonymousNbt": return { t: 10, v: { test: { t: 8, v: "value" } } };
    case "anonOptionalNbt": return { t: 8, v: "optional" };
    case "void": return undefined;
    default: return null;
  }
}

function sampleType(spec, context = null, depth = 0) {
  if (depth > 20) throw new Error("sample schema recursion");
  if (typeof spec === "string") {
    if (spec === "Slot") {
      return {
        id: STONE_ID,
        count: 2,
        componentPatch: { added: [], removed: [] }
      };
    }
    const primitive = samplePrimitive(spec);
    if (primitive !== null || ["void", "anonOptionalNbt"].includes(spec)) return primitive;
    return sampleType(TYPES[spec], context, depth + 1);
  }

  const [kind, args] = spec;
  if (kind === "container") {
    const out = {};
    for (const field of args) {
      const value = sampleType(field.type, out, depth + 1);
      if (field.anon) {
        if (value && typeof value === "object") Object.assign(out, value);
      } else if (value !== undefined) {
        out[field.name] = value;
      }
    }
    return out;
  }
  if (kind === "switch") {
    const key = String(context?.[args.compareTo]);
    return sampleType(
      Object.hasOwn(args.fields || {}, key) ? args.fields[key] : args.default,
      context,
      depth + 1
    );
  }
  if (kind === "array") {
    const count = args.count !== undefined ? Number(context?.[args.count]) : 2;
    return Array.from({ length: count }, () => sampleType(args.type, context, depth + 1));
  }
  if (kind === "mapper") return Object.values(args.mappings)[0];
  if (kind === "option") return depth > 12 ? null : sampleType(args, context, depth + 1);
  if (kind === "pstring") return "minecraft:test";
  if (kind === "bitfield") {
    return Object.fromEntries(args.map((field, index) => [
      field.name,
      field.signed && index === 0 ? -1 : index + 1
    ]));
  }
  if (kind === "registryEntryHolder") return { [args.baseName]: 1 };
  if (kind === "registryEntryHolderSet") return { [args.otherwise.name]: [1, 2] };
  throw new Error("unknown sample constructor " + kind);
}

function sampleComponent(type) {
  if (type === "custom_name" || type === "item_name") {
    return componentToNbt({ text: type, color: "gold" });
  }
  if (type === "lore") {
    return [
      componentToNbt("line one"),
      componentToNbt({ text: "line two", italic: true })
    ];
  }
  if (type === "written_book_content") {
    const value = sampleType(BRANCHES[type], { type });
    value.pages = [{
      content: componentToNbt({ text: "page", bold: true }),
      filteredContent: componentToNbt("filtered")
    }];
    return value;
  }
  return sampleType(BRANCHES[type], { type });
}

test("protocol-766 component schema covers all native component IDs", () => {
  assert.equal(COMPONENT_NAMES.length, 56);
  assert.deepEqual(Object.keys(BRANCHES), COMPONENT_NAMES);
  assert.ok(STONE_ID >= 0);
  assert.ok(DIAMOND_SWORD_ID >= 0);
});

for (const type of COMPONENT_NAMES) {
  test("component payload round-trip: " + type, () => {
    const source = sampleComponent(type);
    const writer = new Writer766();
    writeComponentData766(writer, type, source);
    const reader = new Reader766(writer.build());
    const decoded = readComponentData766(reader, type);
    assert.equal(reader.remaining(), 0);
    const rewritten = new Writer766();
    writeComponentData766(rewritten, type, decoded);
    assert.deepEqual(rewritten.build(), writer.build());
  });
}

test("slot preserves exact component patch and applies native item defaults", () => {
  const source = {
    id: DIAMOND_SWORD_ID,
    count: 1,
    componentPatch: {
      added: [
        { type: "damage", data: 37 },
        { type: "custom_name", data: componentToNbt({ text: "Parity Blade", color: "aqua" }) }
      ],
      removed: ["rarity"]
    }
  };
  const bytes = new Writer766().slot(source).build();
  const reader = new Reader766(bytes);
  const decoded = reader.slot();
  assert.equal(reader.remaining(), 0);
  assert.equal(decoded.itemKey, "minecraft:diamond_sword");
  assert.equal(decoded.damage, 37);
  assert.equal(decoded.maxDamage, 1561);
  assert.equal(decoded.maxStackSize, 1);
  assert.deepEqual(decoded.componentPatch.removed, ["rarity"]);
  assert.equal(decoded.effectiveComponents.rarity, undefined);
  assert.deepEqual(decoded.componentValues.custom_name, { text: "Parity Blade", color: "aqua" });
  assert.deepEqual(new Writer766().slot(decoded).build(), bytes);
});

test("nested stacks use the same decorated item/component model", () => {
  const source = {
    id: STONE_ID,
    count: 1,
    componentPatch: {
      added: [{
        type: "bundle_contents",
        data: {
          contents: [{
            id: DIAMOND_SWORD_ID,
            count: 1,
            componentPatch: {
              added: [{ type: "damage", data: 5 }],
              removed: []
            }
          }]
        }
      }],
      removed: []
    }
  };
  const bytes = new Writer766().slot(source).build();
  const decoded = new Reader766(bytes).slot();
  const nested = decoded.componentValues.bundle_contents.contents[0];
  assert.equal(nested.itemKey, "minecraft:diamond_sword");
  assert.equal(nested.damage, 5);
  assert.equal(nested.maxDamage, 1561);
  assert.deepEqual(new Writer766().slot(decoded).build(), bytes);
});

test("empty stacks and explicit default removals do not fall back to legacy NBT", () => {
  assert.equal(new Reader766(new Writer766().slot(null).build()).slot(), null);
  const bytes = new Writer766().slot({
    id: STONE_ID,
    count: 1,
    componentPatch: { added: [], removed: ["max_stack_size"] }
  }).build();
  const decoded = new Reader766(bytes).slot();
  assert.equal(decoded.maxStackSize, null);
  assert.equal(decoded.nbt, undefined);
  assert.equal(decoded.nbtRaw, undefined);
  assert.deepEqual(decoded.componentPatch.removed, ["max_stack_size"]);
});

test("holder and holder-set inline/named encodings round-trip", () => {
  const holder = {
    material: {
      data: {
        assetName: "gold",
        ingredientId: 1,
        overrideArmorAssets: [{ key: "minecraft:iron", value: "gold_darker" }],
        description: componentToNbt("Gold")
      }
    },
    pattern: { patternId: 2 },
    showInTooltip: true
  };
  const writer = new Writer766();
  writeComponentData766(writer, "trim", holder);
  const decoded = readComponentData766(new Reader766(writer.build()), "trim");
  assert.equal(decoded.material.data.assetName, "gold");
  assert.equal(decoded.material.data.description.v, "Gold");
  const rewritten = new Writer766();
  writeComponentData766(rewritten, "trim", decoded);
  assert.deepEqual(rewritten.build(), writer.build());

  const predicate = {
    predicates: [{
      blockSet: { name: "minecraft:mineable/pickaxe" },
      properties: null,
      nbt: null
    }],
    showTooltip: true
  };
  const predicateWriter = new Writer766();
  writeComponentData766(predicateWriter, "can_break", predicate);
  const decodedPredicate = readComponentData766(
    new Reader766(predicateWriter.build()),
    "can_break"
  );
  assert.equal(decodedPredicate.predicates[0].blockSet.name, "minecraft:mineable/pickaxe");
  const rewrittenPredicate = new Writer766();
  writeComponentData766(rewrittenPredicate, "can_break", decodedPredicate);
  assert.deepEqual(rewrittenPredicate.build(), predicateWriter.build());
});

test("native Mojang ItemStack fixtures decode semantically and re-encode byte-identically", () => {
  assert.equal(nativeStacks.minecraftVersion, "1.20.6");
  assert.equal(nativeStacks.protocol, 766);
  assert.equal(nativeStacks.clientSha1, "05b6f1c6b46a29d6ea82b4e0d42190e42402030f");
  assert.equal(nativeStacks.serverSha1, "145ff0858209bcfc164859ba735d4199aafa1eea");

  for (const [name, wire] of Object.entries(nativeStacks.fixtures)) {
    const bytes = Uint8Array.from(Buffer.from(wire, "hex"));
    const reader = new Reader766(bytes);
    const stack = reader.slot();
    assert.equal(reader.remaining(), 0, name + " has trailing bytes");
    assert.deepEqual(new Writer766().slot(stack).build(), bytes, name + " did not round-trip");

    if (name === "empty") assert.equal(stack, null);
    if (name === "stone") {
      assert.equal(stack.itemKey, "minecraft:stone");
      assert.equal(stack.maxStackSize, 64);
    }
    if (name === "damaged_sword") {
      assert.equal(stack.itemKey, "minecraft:diamond_sword");
      assert.equal(stack.damage, 37);
      assert.equal(stack.maxDamage, 1561);
    }
    if (name === "named_removed_sword") {
      assert.equal(stack.componentValues.custom_name, "Parity Blade");
      assert.equal(stack.damage, 37);
      assert.equal(stack.effectiveComponents.rarity, undefined);
      assert.deepEqual(stack.componentPatch.removed, ["rarity"]);
    }
    if (name === "stone_remove_max_stack") {
      assert.equal(stack.itemKey, "minecraft:stone");
      assert.equal(stack.maxStackSize, null);
      assert.deepEqual(stack.componentPatch.removed, ["max_stack_size"]);
    }
    if (name === "bundle_nested") {
      const nested = stack.componentValues.bundle_contents.contents[0];
      assert.equal(stack.itemKey, "minecraft:bundle");
      assert.equal(nested.itemKey, "minecraft:diamond_sword");
      assert.equal(nested.damage, 5);
      assert.equal(nested.maxDamage, 1561);
    }
  }
});
