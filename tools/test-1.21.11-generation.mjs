import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalJson, canonicalReport } from "./port-1.21.11/canonical-report.mjs";

test("native report hashes ignore component-map and key order but preserve semantic list order", () => {
  const objectComponents = {
    "minecraft:lore": ["first", "second"],
    "minecraft:damage": 3
  };
  const reversedObject = {
    "minecraft:damage": 3,
    "minecraft:lore": ["first", "second"]
  };
  assert.equal(
    canonicalReport("items", { "minecraft:test": { components: objectComponents } }),
    canonicalReport("items", { "minecraft:test": { components: reversedObject } })
  );
  assert.notEqual(
    canonicalReport("items", { "minecraft:test": { components: objectComponents } }),
    canonicalReport("items", {
      "minecraft:test": { components: { ...objectComponents, "minecraft:lore": ["second", "first"] } }
    })
  );

  const legacyComponents = [
    { type: "minecraft:lore", value: ["first", "second"] },
    { type: "minecraft:damage", value: 3 }
  ];
  const a = { "minecraft:test": { components: legacyComponents } };
  const b = { "minecraft:test": { components: [...legacyComponents].reverse() } };
  assert.equal(canonicalReport("items", a), canonicalReport("items", b));
  assert.notEqual(canonicalReport("items", a), canonicalReport("items", {
    "minecraft:test": {
      components: [{ type: "minecraft:lore", value: ["second", "first"] }, legacyComponents[1]]
    }
  }));
  assert.notEqual(canonicalReport("items", a), canonicalReport("items", {
    "minecraft:test": {
      components: [legacyComponents[0], { type: "minecraft:damage", value: 4 }]
    }
  }));
  assert.deepEqual(a["minecraft:test"].components, legacyComponents);
  assert.equal(canonicalJson({ b: 1, a: { z: 2, c: 3 } }), canonicalJson({ a: { c: 3, z: 2 }, b: 1 }));
});
