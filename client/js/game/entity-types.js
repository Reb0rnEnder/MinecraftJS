import { ENTITY_REGISTRY_12111 } from './entity-registry-1.21.11.js';
import { PAINTINGS_774 } from './painting-1.21.11.js';

// Native 1.21.11 explicit EntityType.Builder.eyeHeight overrides (Mojang EntityType.java);
// entities omitted here use the default Math.fround(height * 0.85).
const EXPLICIT_EYE_HEIGHTS = {
  acacia_boat: 0.5625, acacia_chest_boat: 0.5625, allay: 0.36, armadillo: 0.26, armor_stand: 1.7775,
  arrow: 0.13, axolotl: 0.2751, bamboo_chest_raft: 0.5625, bamboo_raft: 0.5625, bat: 0.45,
  bee: 0.3, birch_boat: 0.5625, birch_chest_boat: 0.5625, block_display: 0, bogged: 1.74,
  breeze: 1.3452, breeze_wind_charge: 0, camel: 2.275, camel_husk: 2.275, cat: 0.35,
  cave_spider: 0.45, cherry_boat: 0.5625, cherry_chest_boat: 0.5625, chicken: 0.644, cod: 0.195,
  copper_golem: 0.8125, cow: 1.3, creaking: 2.3, dark_oak_boat: 0.5625, dark_oak_chest_boat: 0.5625,
  dolphin: 0.3, donkey: 1.425, drowned: 1.74, elder_guardian: 0.99875, enderman: 2.55,
  endermite: 0.13, fox: 0.4, ghast: 2.6, happy_ghast: 2.6, giant: 10.44,
  glow_item_frame: 0, glow_squid: 0.4, guardian: 0.425, horse: 1.52, husk: 1.74,
  interaction: 0, item: 0.2125, item_display: 0, item_frame: 0, jungle_boat: 0.5625,
  jungle_chest_boat: 0.5625, leash_knot: 0.0625, lightning_bolt: 0, llama: 1.7765, magma_cube: 0.325,
  mangrove_boat: 0.5625, mangrove_chest_boat: 0.5625, mannequin: 1.62, marker: 0, mooshroom: 1.3,
  mule: 1.52, nautilus: 0.2751, oak_boat: 0.5625, oak_chest_boat: 0.5625, pale_oak_boat: 0.5625,
  pale_oak_chest_boat: 0.5625, parched: 1.74, parrot: 0.54, phantom: 0.175, piglin: 1.79,
  piglin_brute: 1.79, pufferfish: 0.455, salmon: 0.26, sheep: 1.235, shulker: 0.5,
  silverfish: 0.13, skeleton: 1.74, skeleton_horse: 1.52, slime: 0.325, sniffer: 1.05,
  snow_golem: 1.7, spectral_arrow: 0.13, spider: 0.65, spruce_boat: 0.5625, spruce_chest_boat: 0.5625,
  squid: 0.4, stray: 1.74, tadpole: 0.19500001, text_display: 0, tnt: 0.15,
  trader_llama: 1.7765, trident: 0.13, tropical_fish: 0.26, vex: 0.51875, villager: 1.62,
  wandering_trader: 1.62, wind_charge: 0, witch: 1.62, wither_skeleton: 2.1, wolf: 0.68,
  zombie: 1.74, zombie_horse: 1.52, zombie_nautilus: 0.2751, zombie_villager: 1.74, zombified_piglin: 1.79,
  player: 1.62
};

const NON_MOB_ENTITIES = new Set([
  'area_effect_cloud', 'armor_stand', 'arrow', 'block_display', 'breeze_wind_charge',
  'chest_minecart', 'command_block_minecart', 'dragon_fireball', 'egg', 'end_crystal',
  'ender_pearl', 'evoker_fangs', 'experience_bottle', 'experience_orb', 'eye_of_ender',
  'falling_block', 'fireball', 'firework_rocket', 'fishing_bobber', 'furnace_minecart',
  'glow_item_frame', 'hopper_minecart', 'interaction', 'item', 'item_display',
  'item_frame', 'leash_knot', 'lightning_bolt', 'lingering_potion', 'llama_spit',
  'mannequin', 'marker', 'minecart', 'ominous_item_spawner', 'painting', 'player',
  'shulker_bullet', 'small_fireball', 'snowball', 'spawner_minecart', 'spectral_arrow',
  'splash_potion', 'text_display', 'tnt', 'tnt_minecart', 'trident', 'wind_charge',
  'wither_skull'
]);

const PROJECTILE_KINDS = new Set([
  'egg', 'ender_pearl', 'experience_bottle', 'eye_of_ender', 'firework_rocket',
  'fireball', 'small_fireball', 'snowball', 'wither_skull', 'splash_potion', 'lingering_potion'
]);

function entityKind(name) {
  if (name.endsWith('_boat') || name.endsWith('_raft')) return 'boat';
  if (name === 'minecart' || name.endsWith('_minecart')) return 'minecart';
  if (name === 'block_display' || name === 'item_display' || name === 'text_display') return 'display';
  if (name === 'item_frame' || name === 'glow_item_frame') return 'itemframe';
  if (name === 'armor_stand') return 'armorstand';
  if (name === 'end_crystal') return 'crystal';
  if (name === 'falling_block') return 'falling';
  if (name === 'leash_knot') return 'leash';
  if (name === 'fishing_bobber') return 'fishhook';
  if (PROJECTILE_KINDS.has(name)) return 'projectile';
  return name;
}

export const MOB_FAMILIES = {
  creeper: [50], skeleton: [51], wither_skeleton: [51, { wither: true }], stray: [51, { stray: true }],
  spider: [52], giant: [53], zombie: [54], husk: [54, { husk: true }], zombie_villager: [54, { villagerZombie: true }],
  slime: [55], ghast: [56], zombie_pigman: [57], zombified_piglin: [57], enderman: [58], cave_spider: [59], silverfish: [60],
  blaze: [61], magma_cube: [62], ender_dragon: [63], wither: [64], bat: [65], witch: [66],
  endermite: [67], guardian: [68], elder_guardian: [68, { elder: true }], shulker: [69],
  pig: [90], sheep: [91], cow: [92], chicken: [93], squid: [94], wolf: [95],
  mooshroom: [96], snow_golem: [97], ocelot: [98], iron_golem: [99],
  horse: [100, { horseType: 0 }], donkey: [100, { horseType: 1 }], mule: [100, { horseType: 2 }],
  zombie_horse: [100, { horseType: 3 }], skeleton_horse: [100, { horseType: 4 }],
  rabbit: [101], villager: [120],
};

export const ANIMALS = new Set((
  'armadillo camel frog sniffer axolotl goat cat fox panda trader_llama chicken cow donkey horse llama ' +
  'mooshroom mule ocelot parrot pig polar_bear rabbit sheep skeleton_horse turtle wolf zombie_horse happy_ghast nautilus'
).split(' '));

export const AGEABLE = new Set([
  ...ANIMALS, 'villager', 'wandering_trader', 'camel_husk', 'zombie_nautilus'
]);

export const HORSES = new Set(['horse', 'donkey', 'mule', 'zombie_horse', 'skeleton_horse', 'llama', 'trader_llama']);
export const ZOMBIES = new Set(['zombie', 'husk', 'zombie_villager', 'zombie_pigman', 'zombified_piglin', 'drowned']);
export const FISH = new Set(['cod', 'salmon', 'pufferfish', 'tropical_fish']);
export const ARROWS = new Set(['arrow', 'spectral_arrow', 'trident']);
export const FIREBALLS = new Set(['fireball', 'small_fireball', 'dragon_fireball', 'wither_skull']);
export const MINECART_NAMES = ['minecart', 'chest_minecart', 'furnace_minecart', 'tnt_minecart', 'spawner_minecart', 'hopper_minecart', 'command_block_minecart'];

const isBoatName = (name) => name.endsWith('_boat') || name.endsWith('_raft');

export const ENTITY_TYPES = Object.fromEntries(
  ENTITY_REGISTRY_12111.map(([name, width, height], id) => {
    const mob = !isBoatName(name) && !NON_MOB_ENTITIES.has(name);
    const eyeHeight = Object.hasOwn(EXPLICIT_EYE_HEIGHTS, name)
      ? EXPLICIT_EYE_HEIGHTS[name]
      : (height ? Math.fround(height * 0.85) : 0);
    return [id, { id, name, width, height, eyeHeight, mob }];
  })
);

export const ENTITIES_BY_NAME = Object.fromEntries(
  Object.values(ENTITY_TYPES).map((e) => [e.name, e])
);

export const OBJECT_TYPES = Object.fromEntries(
  Object.entries(ENTITY_TYPES).map(([id, e]) => [id, { ...e, kind: entityKind(e.name) }])
);

const titleCase = (short) => short.split('_').map((w) => w ? w[0].toUpperCase() + w.slice(1) : w).join('');
export const PAINTINGS = PAINTINGS_774.map((p) => {
  const short = p.assetId.replace(/^minecraft:/, '');
  return [short, titleCase(short), p.width * 16, p.height * 16];
});
