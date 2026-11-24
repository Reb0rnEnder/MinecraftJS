// Native 1.20.6 HorseArmorLayer: an AnimalArmorItem with the equestrian body type, worn in the BODY slot, drawn
// on the inflated horse_armor model with the item's texture; #dyeable armour (leather) takes its dyed_color,
// default DyedItemColor.LEATHER_COLOR (-6265536 = 0xA06540).
const MATERIALS = { leather_horse_armor: 'leather', iron_horse_armor: 'iron', golden_horse_armor: 'gold', diamond_horse_armor: 'diamond' };
export function horseArmor766(items, stack) {
  const name = stack?.id ? items.name(stack.id) : null, material = MATERIALS[name];
  if (!material) return null;
  let color = [1, 1, 1];
  if (name === 'leather_horse_armor') {
    const dye = items.component(stack, 'dyed_color'), rgb = dye === undefined ? 0xA06540 : (dye?.rgb ?? dye?.color ?? 0) >>> 0;
    color = [(rgb >> 16 & 255) / 255, (rgb >> 8 & 255) / 255, (rgb & 255) / 255];
  }
  return { texture: 'entity/horse/armor/horse_armor_' + material + '.png', color };
}
