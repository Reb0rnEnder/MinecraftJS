// Native-symbol pass over entity metadata. The legacy decoder above it maps wire indexes to 1.12-era positions,
// which drifted for several types; these fields are read by their native accessor names from this release's
// extracted table instead (tools/metadata-native.mjs).
import {NATIVE_ENTITY_METADATA as TABLE} from './entity-metadata-native.js';
const ZOMBIES = new Set(['zombie', 'husk', 'drowned', 'zombie_villager', 'zombified_piglin', 'zombie_pigman']);
const SKELETONS = new Set(['skeleton', 'stray', 'wither_skeleton']);
const HORSES = new Set(['horse', 'donkey', 'mule', 'skeleton_horse', 'zombie_horse', 'llama', 'trader_llama']);
export function applyNativeSymbols(e, wire) {
  const ids = e && TABLE[e.entityName];
  if (!ids || !wire) return;
  const has = (s) => ids[s] !== undefined && wire[ids[s]] !== undefined, get = (s) => wire[ids[s]], name = e.entityName;
  if (has('DATA_MOB_FLAGS_ID')) e.aggressive = !!(get('DATA_MOB_FLAGS_ID') & 4); // Mob.isAggressive
  if (ZOMBIES.has(name)) {
    // AbstractZombieModel raises the arms while aggressive; conversions only shake the model
    e.armsRaised = !!e.aggressive;
    if (has('DATA_DROWNED_CONVERSION_ID')) e.convertingToDrowned = !!get('DATA_DROWNED_CONVERSION_ID');
    if (has('DATA_CONVERTING_ID')) e.curing = !!get('DATA_CONVERTING_ID');
    e.converting = !!(e.convertingToDrowned || e.curing);
  }
  if (SKELETONS.has(name)) {
    e.armsRaised = !!e.aggressive;
    if (has('DATA_STRAY_CONVERSION_ID')) e.strayConverting = !!get('DATA_STRAY_CONVERSION_ID');
    e.converting = !!e.strayConverting;
  }
  if (name === 'shulker') {
    if (has('DATA_ATTACH_FACE_ID')) e.attachFace = get('DATA_ATTACH_FACE_ID');
    if (has('DATA_ATTACH_POS_ID')) e.attachPosition = get('DATA_ATTACH_POS_ID');
    else if (ids.DATA_ATTACH_POS_ID === undefined) delete e.attachPosition; // removed in 1.17
    if (has('DATA_PEEK_ID')) e.peekTick = get('DATA_PEEK_ID');
    if (has('DATA_COLOR_ID')) e.shulkerColor = get('DATA_COLOR_ID');
  }
  if (name === 'witch' && has('DATA_USING_ITEM')) e.witchAggressive = !!get('DATA_USING_ITEM'); // drinking a potion
  if (HORSES.has(name)) {
    if (has('DATA_ID_TYPE_VARIANT')) e.horseVariant = get('DATA_ID_TYPE_VARIANT');
    if (has('DATA_ID_CHEST')) e.horseChest = !!get('DATA_ID_CHEST');
    if (has('DATA_ID_CHEST') && e.horseFlags !== undefined) e.horseFlags = (e.horseFlags & ~8) | (e.horseChest ? 8 : 0);
    if (has('DATA_ID_OWNER_UUID')) e.ownerUuid = get('DATA_ID_OWNER_UUID');
    else if (ids.DATA_ID_OWNER_UUID === undefined) delete e.ownerUuid; // removed in 1.19.3
  }
  if (name === 'llama' || name === 'trader_llama') {
    if (has('DATA_STRENGTH_ID')) e.llamaStrength = get('DATA_STRENGTH_ID');
    if (has('DATA_SWAG_ID')) e.llamaCarpet = get('DATA_SWAG_ID');
    if (has('DATA_VARIANT_ID')) e.llamaVariant = get('DATA_VARIANT_ID');
  }
}
