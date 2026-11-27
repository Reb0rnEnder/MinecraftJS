import { ENTITY_REGISTRY_26_3 } from './entity-registry-26.3.js';
// Native 26.3 entity registry, dimensions, eye heights and MobCategory from the pinned client.
// Numeric MOB_FAMILIES selectors below are internal renderer identities, not wire IDs.
const REGISTRY = ENTITY_REGISTRY_26_3;
const MOB_CATEGORIES = new Set(['monster','creature','ambient','axolotls','underground_water_creature','water_creature','water_ambient']);

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

export const ANIMALS = new Set(('armadillo camel frog sniffer axolotl goat cat fox panda trader_llama chicken cow donkey horse llama mooshroom mule ocelot parrot pig polar_bear rabbit sheep skeleton_horse turtle wolf zombie_horse').split(' '));
export const AGEABLE = new Set([...ANIMALS, 'villager','wandering_trader']);
export const HORSES = new Set(('horse donkey mule zombie_horse skeleton_horse llama trader_llama').split(' '));
export const ZOMBIES = new Set(('zombie husk zombie_villager zombie_pigman drowned').split(' '));
export const FISH = new Set(('cod salmon pufferfish tropical_fish').split(' '));
const NEW_MOBS = new Set(('bogged breeze armadillo allay frog tadpole warden camel sniffer axolotl goat glow_squid hoglin piglin piglin_brute strider zoglin zombified_piglin bee cat fox panda pillager ravager wandering_trader trader_llama cod dolphin drowned evoker illusioner llama parrot polar_bear pufferfish salmon tropical_fish turtle vex vindicator phantom copper_golem').split(' '));
export const ENTITY_TYPES = REGISTRY.map(([name, width, height, eyeHeight, category], id) => ({
  id, name, width, height, eyeHeight, category,
  mob: Object.hasOwn(MOB_FAMILIES, name) || NEW_MOBS.has(name) || MOB_CATEGORIES.has(category),
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

// Since 1.14 Spawn Entity and Spawn Mob use the same entity registry. 26.3 split the generic
// potion entity into splash/lingering ids and renamed boats by wood, so map those names before
// falling back to the legacy table.
const boatKind=name=>/_chest_(boat|raft)$/.test(name)||/_(boat|raft)$/.test(name)?'boat':null;
const OBJECT_KINDS={splash_potion:'projectile',lingering_potion:'projectile',wind_charge:'projectile',breeze_wind_charge:'projectile'};
export const OBJECT_TYPES=Object.fromEntries(ENTITY_TYPES.map(def=>[def.id,{...def,kind:boatKind(def.name)||OBJECT_KINDS[def.name]||({'glow_item_frame':'itemframe','chest_boat':'boat','block_display':'display','item_display':'display','text_display':'display','interaction':'interaction','painting':'painting'})[def.name]||Object.values(LEGACY_OBJECT_TYPES).find(o=>o.name===def.name)?.kind||(MINECART_NAMES.includes(def.name)?'minecart':def.name)}]));
