// 26.3 moved many entity textures into per-family directories and equipment
// layers. Keep the renderer's stable 1.20.6-style paths as the source of truth
// and resolve them once here, before the texture is requested or validated.
const MOVED = Object.freeze({
  'entity/armorstand/wood.png': 'entity/armorstand/armorstand.png',
  'entity/banner_base.png': 'entity/banner/banner_base.png',
  'entity/bat.png': 'entity/bat/bat.png',
  'entity/beacon_beam.png': 'entity/beacon/beacon_beam.png',
  'entity/blaze.png': 'entity/blaze/blaze.png',
  'entity/chicken.png': 'entity/chicken/chicken_temperate.png',
  'entity/cow/cow.png': 'entity/cow/cow_temperate.png',
  'entity/dolphin.png': 'entity/dolphin/dolphin.png',
  'entity/elytra.png': 'entity/equipment/wings/elytra.png',
  'entity/enchanting_table_book.png': 'entity/enchantment/enchanting_table_book.png',
  'entity/end_portal.png': 'entity/end_portal/end_portal.png',
  'entity/endercrystal/endercrystal_beam.png': 'entity/end_crystal/end_crystal_beam.png',
  'entity/endermite.png': 'entity/endermite/endermite.png',
  'entity/experience_orb.png': 'entity/experience/experience_orb.png',
  'entity/frog/temperate_frog.png': 'entity/frog/frog_temperate.png',
  'entity/guardian.png': 'entity/guardian/guardian.png',
  'entity/guardian_beam.png': 'entity/guardian/guardian_beam.png',
  'entity/guardian_elder.png': 'entity/guardian/guardian_elder.png',
  'entity/lead_knot.png': 'entity/lead_knot/lead_knot.png',
  'entity/llama/creamy.png': 'entity/llama/llama_creamy.png',
  'entity/llama/decor/trader_llama.png': 'entity/equipment/llama_body/trader_llama.png',
  'entity/llama/decor/white.png': 'entity/equipment/llama_body/white.png',
  'entity/llama/spit.png': 'entity/llama/llama_spit.png',
  'entity/minecart.png': 'entity/minecart/minecart.png',
  'entity/phantom.png': 'entity/phantom/phantom.png',
  'entity/phantom_eyes.png': 'entity/phantom/phantom_eyes.png',
  'entity/pig/pig.png': 'entity/pig/pig_temperate.png',
  'entity/pig/pig_saddle.png': 'entity/equipment/pig_saddle/saddle.png',
  'entity/sheep/sheep_fur.png': 'entity/sheep/sheep_wool.png',
  'entity/shield_base.png': 'entity/shield/shield_base.png',
  'entity/shield_base_nopattern.png': 'entity/shield/shield_base_nopattern.png',
  'entity/silverfish.png': 'entity/silverfish/silverfish.png',
  'entity/snow_golem.png': 'entity/snow_golem/snow_golem.png',
  'entity/spider_eyes.png': 'entity/spider/spider_eyes.png',
  'entity/strider/strider_saddle.png': 'entity/equipment/strider_saddle/saddle.png',
  'entity/trident.png': 'entity/trident/trident.png',
  'entity/trident_riptide.png': 'entity/trident/trident_riptide.png',
  'entity/turtle/big_sea_turtle.png': 'entity/turtle/turtle.png',
  'entity/wandering_trader.png': 'entity/wandering_trader/wandering_trader.png',
  'entity/witch.png': 'entity/witch/witch.png',
  'entity/wolf/wolf_armor.png': 'entity/equipment/wolf_body/armadillo_scute.png',
  'entity/wolf/wolf_armor_overlay.png': 'entity/equipment/wolf_body/armadillo_scute_overlay.png',
  'entity/zombie_pigman.png': 'entity/piglin/zombified_piglin.png'
});
const HORSE_ARMOR = 'entity/horse/armor/horse_armor_';
const CAT = 'entity/cat/';
const RABBIT = 'entity/rabbit/';

export function entityTexture263(path) {
  if (typeof path !== 'string') return path;
  if (path.startsWith(HORSE_ARMOR)) return 'entity/equipment/horse_body/' + path.slice(HORSE_ARMOR.length);
  if (path.startsWith(CAT)) {
    const name = path.slice(CAT.length);
    if (name !== 'ocelot.png' && !name.startsWith('cat_')) return CAT + 'cat_' + name;
  }
  if (path.startsWith(RABBIT) && !path.startsWith(RABBIT + 'rabbit_')) return RABBIT + 'rabbit_' + path.slice(RABBIT.length);
  return MOVED[path] || path;
}
