import { ENTITY_REGISTRY_26_3 } from './entity-registry-26.3.js';
// Native 26.3 entity registry, dimensions, eye heights and MobCategory from the pinned client.
// Numeric MOB_FAMILIES selectors below are internal renderer identities, not wire IDs.
const REGISTRY = ENTITY_REGISTRY_26_3;
const MOB_CATEGORIES = new Set(['monster','creature','ambient','axolotls','underground_water_creature','water_creature','water_ambient']);

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

export const ANIMALS = new Set(('armadillo camel frog sniffer axolotl goat cat fox panda trader_llama chicken cow donkey horse llama mooshroom mule ocelot parrot pig polar_bear rabbit sheep skeleton_horse turtle wolf zombie_horse').split(' '));
export const AGEABLE = new Set([...ANIMALS, 'villager','wandering_trader']);
export const HORSES = new Set(('horse donkey mule zombie_horse skeleton_horse llama trader_llama').split(' '));
export const ZOMBIES = new Set(('zombie husk zombie_villager zombie_pigman drowned').split(' '));
export const FISH = new Set(('cod salmon pufferfish tropical_fish').split(' '));
const NEW_MOBS = new Set(('bogged breeze armadillo allay frog tadpole warden camel sniffer axolotl goat glow_squid hoglin piglin piglin_brute strider zoglin zombified_piglin bee cat fox panda pillager ravager wandering_trader trader_llama cod dolphin drowned evoker illusioner llama parrot polar_bear pufferfish salmon tropical_fish turtle vex vindicator phantom copper_golem mannequin').split(' '));
export const ENTITY_TYPES = REGISTRY.map(([name, width, height, eyeHeight, category], id) => ({
  id, name, width, height, eyeHeight, category,
  mob: Object.hasOwn(MOB_FAMILIES, name) || NEW_MOBS.has(name) || MOB_CATEGORIES.has(category),
}));
export const ENTITIES_BY_NAME = Object.fromEntries(ENTITY_TYPES.map(e => [e.name, e]));

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

// Since 1.14 Spawn Entity and Spawn Mob use the same entity registry. 26.3 split the generic
// potion entity into splash/lingering ids and renamed boats by wood, so map those names before
// falling back to the legacy table.
const boatKind=name=>/_chest_(boat|raft)$/.test(name)||/_(boat|raft)$/.test(name)?'boat':null;
const OBJECT_KINDS={splash_potion:'projectile',lingering_potion:'projectile',lightning_bolt:'lightning'};
export const OBJECT_TYPES=Object.fromEntries(ENTITY_TYPES.map(def=>[def.id,{...def,kind:boatKind(def.name)||OBJECT_KINDS[def.name]||({'glow_item_frame':'itemframe','chest_boat':'boat','block_display':'display','item_display':'display','text_display':'display','interaction':'interaction','painting':'painting'})[def.name]||Object.values(LEGACY_OBJECT_TYPES).find(o=>o.name===def.name)?.kind||(MINECART_NAMES.includes(def.name)?'minecart':def.name)}]));
