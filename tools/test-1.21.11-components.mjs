import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Reader774, Writer774 } from "../client/js/net/configuration-1.21.11.js";
import {
  COMPONENT_NAMES,
  COMPONENT_IDS,
  readComponentData774,
  writeComponentData774,
  readUntrustedSlot774,
  writeUntrustedSlot774
} from "../client/js/net/item-components-1.21.11.js";
import { ITEM_COMPONENT_SCHEMA_774 } from "../client/js/net/item-components-1.21.11-schema.js";
import { ITEM_DEFAULTS_774 } from "../client/js/net/item-components-1.21.11-defaults.js";
import { componentToNbt } from "../client/js/net/component-nbt-1.21.11.js";
import {
  DATA_COMPONENT_IDS_774,
  crc32c,
  hashTag,
  hashSlot774,
  readHashedStack774,
  writeHashedStack774
} from "../client/js/net/hashed-stack-1.21.11.js";

const TYPES = ITEM_COMPONENT_SCHEMA_774.types;
const BRANCHES = TYPES.SlotComponent[1][1].type[1].fields;
const idFor = (name) => ITEM_DEFAULTS_774.items.findIndex((item) => item.name === name);
const STONE_ID = idFor("minecraft:stone");
const DIAMOND_SWORD_ID = idFor("minecraft:diamond_sword");
const nativeStacks = JSON.parse(
  readFileSync(new URL("./port-1.21.11/stack-fixtures.json", import.meta.url), "utf8")
);

function samplePrimitive(name) {
  switch (name) {
    case "i8": return 1;
    case "u8": return 2;
    case "i16": return -3;
    case "u16": return 4;
    case "i32": return 17;
    case "u32": return 18;
    case "i64": return 19n;
    case "f32": return 1.25;
    case "f64": return 2.5;
    case "bool": return true;
    case "varint": return 1;
    case "varlong": return 21n;
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
  if (kind === "buffer") {
    const len = args.countType ? 4 : Number(args.count ?? 4);
    return new Uint8Array(len).fill(0x5a);
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

test("protocol-774 component schema covers all 104 native component IDs", () => {
  assert.equal(COMPONENT_NAMES.length, 104);
  assert.deepEqual(new Set(Object.keys(BRANCHES)), new Set(COMPONENT_NAMES));
  assert.deepEqual(DATA_COMPONENT_IDS_774, COMPONENT_IDS);
  assert.ok(STONE_ID >= 0);
  assert.ok(DIAMOND_SWORD_ID >= 0);
});

for (const type of COMPONENT_NAMES) {
  test("component payload round-trip: " + type, () => {
    const source = sampleComponent(type);
    const writer = new Writer774();
    writeComponentData774(writer, type, source);
    const reader = new Reader774(writer.build());
    const decoded = readComponentData774(reader, type);
    assert.equal(reader.remaining(), 0);
    const rewritten = new Writer774();
    writeComponentData774(rewritten, type, decoded);
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
      removed: ["repair_cost"]
    }
  };
  const bytes = new Writer774().slot(source).build();
  const reader = new Reader774(bytes);
  const decoded = reader.slot();
  assert.equal(reader.remaining(), 0);
  assert.equal(decoded.itemKey, "minecraft:diamond_sword");
  assert.equal(decoded.damage, 37);
  assert.equal(decoded.maxDamage, 1561);
  assert.equal(decoded.maxStackSize, 1);
  assert.deepEqual(decoded.componentPatch.removed, ["repair_cost"]);
  assert.equal(decoded.effectiveComponents.repair_cost, undefined);
  assert.deepEqual(decoded.componentValues.custom_name, { text: "Parity Blade", color: "aqua" });
  assert.deepEqual(new Writer774().slot(decoded).build(), bytes);
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
  const bytes = new Writer774().slot(source).build();
  const decoded = new Reader774(bytes).slot();
  const nested = decoded.componentValues.bundle_contents.contents[0];
  assert.equal(nested.itemKey, "minecraft:diamond_sword");
  assert.equal(nested.damage, 5);
  assert.equal(nested.maxDamage, 1561);
  assert.deepEqual(new Writer774().slot(decoded).build(), bytes);
});

test("empty stacks and explicit default removals do not fall back to legacy NBT", () => {
  assert.equal(new Reader774(new Writer774().slot(null).build()).slot(), null);
  const bytes = new Writer774().slot({
    id: STONE_ID,
    count: 1,
    componentPatch: { added: [], removed: ["max_stack_size"] }
  }).build();
  const decoded = new Reader774(bytes).slot();
  assert.equal(decoded.maxStackSize, null);
  assert.equal(decoded.nbt, undefined);
  assert.equal(decoded.nbtRaw, undefined);
  assert.deepEqual(decoded.componentPatch.removed, ["max_stack_size"]);
});

test("1.21.11 holder and holder-set inline/named encodings round-trip without removed tooltip booleans", () => {
  const holder = {
    material: {
      data: {
        assetBase: "gold",
        overrideArmorAssets: [{ key: "minecraft:iron", value: "gold_darker" }],
        description: componentToNbt("Gold")
      }
    },
    pattern: { patternId: 2 }
  };
  const writer = new Writer774();
  writeComponentData774(writer, "trim", holder);
  const decoded = readComponentData774(new Reader774(writer.build()), "trim");
  assert.equal(decoded.material.data.assetBase, "gold");
  assert.equal(decoded.material.data.description.v, "Gold");
  const rewritten = new Writer774();
  writeComponentData774(rewritten, "trim", decoded);
  assert.deepEqual(rewritten.build(), writer.build());

  const predicate = {
    predicates: [{
      blockSet: { name: "minecraft:mineable/pickaxe" },
      properties: null,
      nbt: null,
      components: { exactMatchers: [], partialMatchers: [] }
    }]
  };
  const predicateWriter = new Writer774();
  writeComponentData774(predicateWriter, "can_break", predicate);
  const decodedPredicate = readComponentData774(
    new Reader774(predicateWriter.build()),
    "can_break"
  );
  assert.equal(decodedPredicate.predicates[0].blockSet.name, "minecraft:mineable/pickaxe");
  const rewrittenPredicate = new Writer774();
  writeComponentData774(rewrittenPredicate, "can_break", decodedPredicate);
  assert.deepEqual(rewrittenPredicate.build(), predicateWriter.build());
});

test("HashedSlot and CRC32C HashOps round-trip for protocol 774 inventory clicks", () => {
  assert.equal(crc32c(Buffer.from("123456789", "ascii")), -486108541);
  assert.deepEqual(new Writer774().hashedSlot(null).build(), new Uint8Array([0]));

  const stack = {
    id: DIAMOND_SWORD_ID,
    count: 1,
    componentPatch: {
      added: [
        { type: "damage", data: 5 },
        { type: "custom_name", data: componentToNbt("Edge") }
      ],
      removed: ["repair_cost"]
    }
  };
  const hashed = hashSlot774(stack);
  assert.equal(hashed.itemId, DIAMOND_SWORD_ID);
  assert.equal(hashed.count, 1);
  assert.deepEqual(hashed.removeComponents, [COMPONENT_IDS.repair_cost]);
  assert.equal(hashed.components[1].hash, hashTag(componentToNbt("Edge")));

  const wire = writeHashedStack774(new Writer774(), hashed).build();
  assert.deepEqual(new Writer774().hashedSlot(stack).build(), wire);
  const reader = new Reader774(wire);
  assert.deepEqual(readHashedStack774(reader), hashed);
  assert.equal(reader.remaining(), 0);
  assert.equal(readHashedStack774(new Reader774(new Uint8Array([0]))), null);
});

test("native Mojang ItemStack fixtures decode semantically and re-encode byte-identically (trusted & untrusted)", () => {
  assert.equal(nativeStacks.minecraftVersion, "1.21.11");
  assert.equal(nativeStacks.protocol, 774);
  assert.equal(nativeStacks.clientSha1, "ba2df812c2d12e0219c489c4cd9a5e1f0760f5bd");
  assert.equal(nativeStacks.registryCount, 23);

  for (const [name, entry] of Object.entries(nativeStacks.fixtures)) {
    const trustedBytes = Uint8Array.from(Buffer.from(entry.trusted, "hex"));
    const trustedReader = new Reader774(trustedBytes);
    const stack = trustedReader.slot();
    assert.equal(trustedReader.remaining(), 0, name + " trusted has trailing bytes");
    assert.deepEqual(new Writer774().slot(stack).build(), trustedBytes, name + " trusted round-trip mismatch");

    const untrustedBytes = Uint8Array.from(Buffer.from(entry.untrusted, "hex"));
    const untrustedReader = new Reader774(untrustedBytes);
    const untrustedStack = readUntrustedSlot774(untrustedReader);
    assert.equal(untrustedReader.remaining(), 0, name + " untrusted has trailing bytes");
    assert.deepEqual(
      writeUntrustedSlot774(new Writer774(), untrustedStack).build(),
      untrustedBytes,
      name + " untrusted round-trip mismatch"
    );

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
      assert.equal(stack.effectiveComponents.repair_cost, undefined);
      assert.deepEqual(stack.componentPatch.removed, ["repair_cost"]);
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
    if (name === "kinetic_weapon") {
      const kw = stack.componentValues.kinetic_weapon;
      assert.equal(kw.contactCooldownTicks, 10);
      assert.equal(kw.delayTicks, 4);
      assert.equal(kw.dismountConditions.maxDurationTicks, 20);
      assert.equal(kw.knockbackConditions, null);
      assert.equal(kw.damageConditions.maxDurationTicks, 15);
    }
    if (name === "equippable") {
      const eq = stack.componentValues.equippable;
      assert.equal(eq.slot, "head");
      assert.equal(eq.swappable, false);
      assert.equal(eq.cameraOverlay, "minecraft:misc/pumpkinblur");
    }
    if (name === "tooltip_display") {
      const td = stack.componentValues.tooltip_display;
      assert.equal(td.hideTooltip, false);
      assert.deepEqual(td.hiddenComponents, [COMPONENT_IDS.damage, COMPONENT_IDS.enchantments]);
    }
  }
});
