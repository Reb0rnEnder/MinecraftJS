// Protocol 774 / Minecraft 1.21.11 MenuType registry -> container window parameters.
export const MENUS_774 = {
  0: { registryName: 'minecraft:generic_9x1', type: 'minecraft:chest', slotCount: 9 },
  1: { registryName: 'minecraft:generic_9x2', type: 'minecraft:chest', slotCount: 18 },
  2: { registryName: 'minecraft:generic_9x3', type: 'minecraft:chest', slotCount: 27 },
  3: { registryName: 'minecraft:generic_9x4', type: 'minecraft:chest', slotCount: 36 },
  4: { registryName: 'minecraft:generic_9x5', type: 'minecraft:chest', slotCount: 45 },
  5: { registryName: 'minecraft:generic_9x6', type: 'minecraft:chest', slotCount: 54 },
  6: { registryName: 'minecraft:generic_3x3', type: 'minecraft:dispenser', slotCount: 9 },
  7: { registryName: 'minecraft:crafter_3x3', type: 'minecraft:crafter_3x3', slotCount: 9 },
  8: { registryName: 'minecraft:anvil', type: 'minecraft:anvil', slotCount: 3 },
  9: { registryName: 'minecraft:beacon', type: 'minecraft:beacon', slotCount: 1 },
  10: { registryName: 'minecraft:blast_furnace', type: 'minecraft:blast_furnace', slotCount: 3 },
  11: { registryName: 'minecraft:brewing_stand', type: 'minecraft:brewing_stand', slotCount: 5 },
  12: { registryName: 'minecraft:crafting', type: 'minecraft:crafting_table', slotCount: 10 },
  13: { registryName: 'minecraft:enchantment', type: 'minecraft:enchanting_table', slotCount: 2 },
  14: { registryName: 'minecraft:furnace', type: 'minecraft:furnace', slotCount: 3 },
  15: { registryName: 'minecraft:grindstone', type: 'minecraft:grindstone', slotCount: 3 },
  16: { registryName: 'minecraft:hopper', type: 'minecraft:hopper', slotCount: 5 },
  17: { registryName: 'minecraft:lectern', type: 'minecraft:lectern', slotCount: 1 },
  18: { registryName: 'minecraft:loom', type: 'minecraft:loom', slotCount: 4 },
  19: { registryName: 'minecraft:merchant', type: 'minecraft:villager', slotCount: 3 },
  20: { registryName: 'minecraft:shulker_box', type: 'minecraft:shulker_box', slotCount: 27 },
  21: { registryName: 'minecraft:smithing', type: 'minecraft:smithing', slotCount: 4 },
  22: { registryName: 'minecraft:smoker', type: 'minecraft:smoker', slotCount: 3 },
  23: { registryName: 'minecraft:cartography_table', type: 'minecraft:cartography', slotCount: 3 },
  24: { registryName: 'minecraft:stonecutter', type: 'minecraft:stonecutter', slotCount: 2 }
};

export function menuInfo774(id) {
  const menu = MENUS_774[id];
  if (!menu) throw new Error('Unknown 1.21.11 MenuType id: ' + id);
  return menu;
}
