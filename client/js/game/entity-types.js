import { ENTITY_REGISTRY_1152 } from './entity-registry-1.15.2.js';
// Native 1.15.2 entity registry and dimensions, generated from the pinned reports.
// Numeric MOB_FAMILIES selectors below are internal renderer identities, not wire IDs.
const REGISTRY = ENTITY_REGISTRY_1152;

// INTERNAL renderer selectors, never protocol IDs. Only families already selected
// by the renderer use numbers. A new family keeps its canonical string as e.type.
export const MOB_FAMILIES = {
  creeper: [50], skeleton: [51], wither_skeleton: [51, { wither: true }], stray: [51, { stray: true }],
  spider: [52], giant: [53], zombie: [54], husk: [54, { husk: true }],
  zombie_villager: [54, { villagerZombie: true }], slime: [55], ghast: [56], zombie_pigman: [57],
  enderman: [58], cave_spider: [59], silverfish: [60], blaze: [61], magma_cube: [62],
  ender_dragon: [63], wither: [64], bat: [65], witch: [66], endermite: [67],
  guardian: [68], elder_guardian: [68, { elder: true }], shulker: [69],
  pig: [90], sheep: [91], cow: [92], chicken: [93], squid: [94], wolf: [95], mooshroom: [96],
  snow_golem: [97], ocelot: [98], iron_golem: [99], horse: [100, { horseType: 0 }],
  donkey: [100, { horseType: 1 }], mule: [100, { horseType: 2 }],
  zombie_horse: [100, { horseType: 3 }], skeleton_horse: [100, { horseType: 4 }],
  rabbit: [101], villager: [120],
};

export const ANIMALS = new Set(('cat fox panda trader_llama chicken cow donkey horse llama mooshroom mule ocelot parrot pig polar_bear rabbit sheep skeleton_horse turtle wolf zombie_horse').split(' '));
export const AGEABLE = new Set([...ANIMALS, 'villager','wandering_trader']);
export const HORSES = new Set(('horse donkey mule zombie_horse skeleton_horse llama trader_llama').split(' '));
export const ZOMBIES = new Set(('zombie husk zombie_villager zombie_pigman drowned').split(' '));
export const FISH = new Set(('cod salmon pufferfish tropical_fish').split(' '));
const NEW_MOBS = new Set(('bee cat fox panda pillager ravager wandering_trader trader_llama cod dolphin drowned evoker illusioner llama parrot polar_bear pufferfish salmon tropical_fish turtle vex vindicator phantom').split(' '));
const EYES = { armor_stand: 1.7775, bat: 0.45, cave_spider: 0.45, enderman: 2.55, endermite: 0.1,
  ghast: 2.6, giant: 10.44, guardian: 0.425, elder_guardian: 0.99875, shulker: 0.5, silverfish: 0.1,
  skeleton: 1.74, stray: 1.74, wither_skeleton: 2.1, spider: 0.65, squid: 0.4,
  zombie: 1.74, husk: 1.74, drowned: 1.74, zombie_pigman: 1.74, zombie_villager: 1.74,
  player: 1.62, parrot: 0.54, wolf: 0.68, chicken: 0.7, cow: 1.3, mooshroom: 1.3,
  cod: 0.195, salmon: 0.26, tropical_fish: 0.26, pufferfish: 0.455, dolphin: 0.3,
  horse: 1.6, donkey: 1.6, mule: 1.6, zombie_horse: 1.6, skeleton_horse: 1.6, llama: 1.87,
  sheep: 1.235, snow_golem: 1.7, villager: 1.62, witch: 1.62, phantom: 0.175,
  slime: 0.51000005 * 0.625, magma_cube: 0.51000005 * 0.625,
  arrow: 0, spectral_arrow: 0, trident: 0, item_frame: 0, leash_knot: -0.0625, tnt: 0 };
export const ENTITY_TYPES = REGISTRY.map(([name, width, height], id) => ({
  id, name, width, height, eyeHeight: EYES[name] ?? height * 0.85,
  mob: Object.hasOwn(MOB_FAMILIES, name) || NEW_MOBS.has(name),
}));
export const ENTITIES_BY_NAME = Object.fromEntries(ENTITY_TYPES.map(e => [e.name, e]));

// NetHandlerPlayClient crd.a(iz): object ID -> canonical identity and renderer kind.
const LEGACY_OBJECT_TYPES = Object.fromEntries([
  [1, 'boat', 'boat'], [2, 'item', 'item'], [3, 'area_effect_cloud', 'area_effect_cloud'],
  [10, 'minecart', 'minecart'], [50, 'tnt', 'tnt'], [51, 'end_crystal', 'crystal'],
  [60, 'arrow', 'arrow'], [61, 'snowball', 'projectile'], [62, 'egg', 'projectile'],
  [63, 'fireball', 'projectile'], [64, 'small_fireball', 'projectile'], [65, 'ender_pearl', 'projectile'],
  [66, 'wither_skull', 'projectile'], [67, 'shulker_bullet', 'shulker_bullet'], [68, 'llama_spit', 'llama_spit'],
  [70, 'falling_block', 'falling'], [71, 'item_frame', 'itemframe'], [72, 'eye_of_ender', 'projectile'],
  [73, 'potion', 'projectile'], [75, 'experience_bottle', 'projectile'], [76, 'firework_rocket', 'projectile'],
  [77, 'leash_knot', 'leash'], [78, 'armor_stand', 'armorstand'], [79, 'evoker_fangs', 'evoker_fangs'],
  [90, 'fishing_bobber', 'fishhook'], [91, 'spectral_arrow', 'spectral_arrow'],
  [93, 'dragon_fireball', 'dragon_fireball'], [94, 'trident', 'trident'],
].map(([id, name, kind]) => [id, { ...ENTITIES_BY_NAME[name], id, kind }]));
export const MINECART_NAMES = ['minecart', 'chest_minecart', 'furnace_minecart', 'tnt_minecart', 'spawner_minecart', 'hopper_minecart', 'command_block_minecart'];
export const ARROWS = new Set(['arrow', 'spectral_arrow', 'trident']);
export const FIREBALLS = new Set(['fireball', 'small_fireball', 'dragon_fireball', 'wither_skull']);

// Painting motive registry amd; retain the existing atlas title spelling at the boundary.
export const PAINTINGS = [
  ['kebab', 'Kebab', 16, 16], ['aztec', 'Aztec', 16, 16], ['alban', 'Alban', 16, 16],
  ['aztec2', 'Aztec2', 16, 16], ['bomb', 'Bomb', 16, 16], ['plant', 'Plant', 16, 16], ['wasteland', 'Wasteland', 16, 16],
  ['pool', 'Pool', 32, 16], ['courbet', 'Courbet', 32, 16], ['sea', 'Sea', 32, 16], ['sunset', 'Sunset', 32, 16], ['creebet', 'Creebet', 32, 16],
  ['wanderer', 'Wanderer', 16, 32], ['graham', 'Graham', 16, 32],
  ['match', 'Match', 32, 32], ['bust', 'Bust', 32, 32], ['stage', 'Stage', 32, 32], ['void', 'Void', 32, 32],
  ['skull_and_roses', 'SkullAndRoses', 32, 32], ['wither', 'Wither', 32, 32], ['fighters', 'Fighters', 64, 32],
  ['pointer', 'Pointer', 64, 64], ['pigscene', 'Pigscene', 64, 64], ['burning_skull', 'BurningSkull', 64, 64],
  ['skeleton', 'Skeleton', 64, 48], ['donkey_kong', 'DonkeyKong', 64, 48],
];

// Since 1.14 Spawn Entity and Spawn Mob use the same entity registry.
export const OBJECT_TYPES=Object.fromEntries(ENTITY_TYPES.map(def=>[def.id,{...def,kind:Object.values(LEGACY_OBJECT_TYPES).find(o=>o.name===def.name)?.kind||(MINECART_NAMES.includes(def.name)?'minecart':def.name)}]));
