//// Native protocol-766 menu registry. IDs come from the pinned 1.20.6 registry report.
export const MENUS_766 = Object.freeze({
  0: "minecraft:generic_9x1",
  1: "minecraft:generic_9x2",
  2: "minecraft:generic_9x3",
  3: "minecraft:generic_9x4",
  4: "minecraft:generic_9x5",
  5: "minecraft:generic_9x6",
  6: "minecraft:generic_3x3",
  7: "minecraft:crafter_3x3",
  8: "minecraft:anvil",
  9: "minecraft:beacon",
  10: "minecraft:blast_furnace",
  11: "minecraft:brewing_stand",
  12: "minecraft:crafting",
  13: "minecraft:enchantment",
  14: "minecraft:furnace",
  15: "minecraft:grindstone",
  16: "minecraft:hopper",
  17: "minecraft:lectern",
  18: "minecraft:loom",
  19: "minecraft:merchant",
  20: "minecraft:shulker_box",
  21: "minecraft:smithing",
  22: "minecraft:smoker",
  23: "minecraft:cartography_table",
  24: "minecraft:stonecutter"
});

const aliases = Object.freeze({
  "minecraft:generic_3x3": ["minecraft:dispenser", 9],
  "minecraft:crafter_3x3": ["minecraft:dispenser", 9],
  "minecraft:crafting": ["minecraft:crafting_table", 10],
  "minecraft:enchantment": ["minecraft:enchanting_table", 2],
  "minecraft:merchant": ["minecraft:villager", 3],
  "minecraft:blast_furnace": ["minecraft:blast_furnace", 3],
  "minecraft:smoker": ["minecraft:smoker", 3],
  "minecraft:cartography_table": ["minecraft:cartography", 3]
});

const fixed = Object.freeze({
  "minecraft:smithing": 4,
  "minecraft:anvil": 3,
  "minecraft:beacon": 1,
  "minecraft:brewing_stand": 5,
  "minecraft:furnace": 3,
  "minecraft:hopper": 5,
  "minecraft:shulker_box": 27,
  "minecraft:grindstone": 3,
  "minecraft:lectern": 1,
  "minecraft:loom": 4,
  "minecraft:stonecutter": 2
});

export function menuInfo766(id) {
  const name = MENUS_766[id];
  if (!name) throw new Error("Unknown protocol-766 menu " + id);
  const rows = /^minecraft:generic_9x([1-6])$/.exec(name);
  if (rows) return { registryName: name, type: "minecraft:chest", slotCount: Number(rows[1]) * 9 };
  const alias = aliases[name];
  if (alias) return { registryName: name, type: alias[0], slotCount: alias[1] };
  const slotCount = fixed[name];
  if (slotCount === undefined) throw new Error("Unsupported protocol-766 menu " + name);
  return { registryName: name, type: name, slotCount };
}
