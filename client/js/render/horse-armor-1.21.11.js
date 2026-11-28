// Native 1.21.11 HorseArmorLayer: equipment asset under entity/equipment/horse_body/<material>.png;
// #dyeable armor (leather) takes its dyed_color (default 0xA06540).
const MATERIALS = {
  copper_horse_armor: 'copper',
  leather_horse_armor: 'leather',
  iron_horse_armor: 'iron',
  golden_horse_armor: 'gold',
  diamond_horse_armor: 'diamond',
  netherite_horse_armor: 'netherite',
};

export function horseArmor774(items, stack) {
  const name = stack?.id ? items.name(stack.id) : null, material = MATERIALS[name];
  if (!material) return null;
  let color = [1, 1, 1];
  if (name === 'leather_horse_armor') {
    const dye = items.component(stack, 'dyed_color');
    const rgb = dye === undefined ? 0xA06540 : (typeof dye === 'number' ? dye : (dye?.rgb ?? dye?.color ?? 0)) >>> 0;
    color = [(rgb >> 16 & 255) / 255, (rgb >> 8 & 255) / 255, (rgb & 255) / 255];
  }
  return { texture: 'entity/equipment/horse_body/' + material + '.png', color };
}
