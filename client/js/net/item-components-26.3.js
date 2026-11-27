// Native 26.3 item stacks and data component patches.
//
// Layout, verified with javap on the 26.3 client jar:
//   ItemStack.STREAM_CODEC -> ItemStack$2 -> OPTIONAL_STREAM_CODEC (ItemStack$1):
//     VarInt count; count <= 0 is EMPTY, otherwise
//     Item.STREAM_CODEC (holderRegistry -> VarInt item id),
//     DataComponentPatch.STREAM_CODEC,
//   and DataComponentPatch$3 decodes:
//     VarInt addedCount, VarInt removedCount,
//     addedCount * (DataComponentType.STREAM_CODEC -> VarInt id, value by that type's codec),
//     removedCount * (VarInt id).
// ItemStackTemplate is the same envelope without the empty shortcut: item id, VarInt count, patch.
//
// Every component value reader below is derived from the type's networkSynchronized codec
// (tools/port-26.3/fixtures/data-component-codecs-26.3.json pins that expression per id).
// A component whose codec is not implemented throws, so the caller skips the frame instead
// of consuming the wrong number of bytes.
import {readAnonymousNbt} from './nbt-anonymous.js';
import {componentFromNbt} from './component-nbt-1.20.6.js';
import {DATA_COMPONENT_NAMES_26_3} from './items-26.3.js';
import {ENCHANTMENT_NAMES_26_3} from './enchantment-names-26.3.js';
import {ITEM_DEFAULTS_26_3} from './item-defaults-26.3.js';

const READERS={};
const define=(name,read)=>{READERS[name]=read;};

const unit=()=>null;
// ByteBufCodecs.VAR_INT (damage, max stack size, repair cost, ids of id-mapped enums).
const varint=r=>r.varint();
// ByteBufCodecs.FLOAT.
const float=r=>r.f32();
// ByteBufCodecs.STRING_UTF8; Identifier.STREAM_CODEC is the same wire shape.
const string=r=>r.string();
// ComponentSerialization.STREAM_CODEC = ByteBufCodecs.fromCodecWithRegistries -> unnamed NBT tag.
const component=r=>readAnonymousNbt(r);
// ByteBufCodecs.list(max): VarInt element count then the elements.
const list=(read,max=Infinity)=>r=>{
  const count=r.varint();
  if(count>max)throw Error('26.3 list length '+count+' exceeds native maximum '+max);
  const out=[];
  for(let i=0;i<count;i++)out.push(read(r));
  return out;
};
const fixedIntList=list(r=>r.i32());
const optional=(read,absent=null)=>r=>r.bool()?read(r):absent;
const idList=list(varint);

define('max_stack_size',varint);
define('max_damage',varint);
define('damage',varint);
define('unbreakable',unit);
define('custom_name',component);
define('item_name',component);
// ItemLore.STREAM_CODEC: ByteBufCodecs.list(256) of ComponentSerialization.STREAM_CODEC.
define('lore',list(component,256));
// Rarity.STREAM_CODEC is ByteBufCodecs.idMapper(BY_ID, id) -> VarInt.
define('rarity',varint);
// ItemEnchantments.STREAM_CODEC: ByteBufCodecs.map(Enchantment.STREAM_CODEC, VAR_INT), so a
// VarInt entry count then (VarInt enchantment holder id, VarInt level) per entry.
const enchantments=r=>{
  const count=r.varint();
  const entries=[];
  for(let i=0;i<count;i++){
    const enchantment=r.varint();
    const name=ENCHANTMENT_NAMES_26_3[enchantment];
    if(!name)throw Error('Unknown 26.3 enchantment id '+enchantment);
    entries.push({enchantment,id:name,level:r.varint()});
  }
  return entries;
};
define('enchantments',enchantments);
define('stored_enchantments',enchantments);
// CustomModelData.STREAM_CODEC: list<float>, list<bool>, list<string>, list<int>.
define('custom_model_data',r=>({
  floats:list(float)(r),
  flags:list(r=>r.bool())(r),
  strings:list(string)(r),
  colors:fixedIntList(r)
}));
// TooltipDisplay.STREAM_CODEC: BOOL hideTooltip, collection(DataComponentType.STREAM_CODEC) hiddenComponents.
define('tooltip_display',r=>({hideTooltip:r.bool(),hiddenComponents:idList(r)}));
define('repair_cost',varint);
define('creative_slot_lock',unit);
define('enchantment_glint_override',r=>r.bool());
define('minimum_attack_charge',float);
define('item_model',string);
// DyedItemColor.STREAM_CODEC: ByteBufCodecs.INT (four bytes), not a VarInt.
define('dyed_color',r=>r.i32());
define('map_id',varint);
define('map_post_processing',varint);
// FireworkExplosion.STREAM_CODEC: shape id, int list colors, int list fade colors, BOOL trail, BOOL flicker.
const fireworkExplosion=r=>({
  shape:r.varint(),
  colors:fixedIntList(r),
  fadeColors:fixedIntList(r),
  hasTrail:r.bool(),
  hasFlicker:r.bool()
});
define('firework_explosion',fireworkExplosion);
// Fireworks.STREAM_CODEC: VarInt flightDuration, list(256) of explosions.
define('fireworks',r=>({flightDuration:r.varint(),explosions:list(fireworkExplosion,256)(r)}));
// PotionContents.STREAM_CODEC: optional potion holder, optional INT color,
// list of MobEffectInstance, optional STRING custom effects.
define('potion_contents',r=>({
  potion:optional(varint)(r),
  customColor:optional(r=>r.i32())(r),
  customEffects:list(mobEffect)(r),
  customEffectsName:optional(string)(r)
}));
define('potion_duration_scale',float);
// Filterable<T>.streamCodec: raw value then optional filtered value.
const filterable=read=>r=>({raw:read(r),filtered:optional(read)(r)});
const filterableString=filterable(string);
// WritableBookContent.STREAM_CODEC: list(100) of Filterable<String>.
define('writable_book_content',r=>({pages:list(filterableString,100)(r)}));
// WrittenBookContent.STREAM_CODEC: Filterable<String> title, STRING author, VAR_INT generation,
// list(100) of Filterable<Component> pages, BOOL resolved.
define('written_book_content',r=>({
  title:filterableString(r),
  author:string(r),
  generation:r.varint(),
  pages:list(filterable(component),100)(r),
  resolved:r.bool()
}));
// BlockItemStateProperties.STREAM_CODEC: ByteBufCodecs.map(STRING_UTF8, STRING_UTF8).
define('block_state',r=>{
  const count=r.varint();
  const properties={};
  for(let i=0;i<count;i++)properties[r.string()]=r.string();
  return properties;
});
// ItemContainerContents.STREAM_CODEC: list(256) of optional ItemStackTemplate.
define('container',list(r=>optional(readItemStackTemplate26_3)(r),256));
// ChargedProjectiles.STREAM_CODEC: list(1024) of ItemStackTemplate.
define('charged_projectiles',list(readItemStackTemplate26_3,1024));
// BundleContents.STREAM_CODEC: list of ItemStackTemplate.
define('bundle_contents',list(readItemStackTemplate26_3));
// PotDecorations: four optional ItemStackTemplates (back, left, right, front).
define('pot_decorations',r=>({
  back:optional(readItemStackTemplate26_3)(r),
  left:optional(readItemStackTemplate26_3)(r),
  right:optional(readItemStackTemplate26_3)(r),
  front:optional(readItemStackTemplate26_3)(r)
}));
// TypedEntityData.streamCodec(EntityType.STREAM_CODEC): VarInt entity type then unnamed NBT.
define('entity_data',r=>({entityType:r.varint(),tag:readAnonymousNbt(r)}));
define('block_entity_data',r=>({blockEntityType:r.varint(),tag:readAnonymousNbt(r)}));
// CustomData.STREAM_CODEC: unnamed NBT.
define('bucket_entity_data',r=>readAnonymousNbt(r));
define('note_block_sound',string);
define('base_color',varint);
// BannerPatternLayers.STREAM_CODEC: list of Layer(BannerPattern.STREAM_CODEC holder, DyeColor id).
define('banner_patterns',list(r=>({pattern:r.varint(),color:r.varint()})));
// ArmorTrim.STREAM_CODEC: TrimMaterial holder then TrimPattern holder.
define('trim',r=>({material:r.varint(),pattern:r.varint()}));
// SuspiciousStewEffects.STREAM_CODEC: list of Entry(MobEffect holder, VarInt duration).
define('suspicious_stew_effects',list(r=>({effect:r.varint(),duration:r.varint()})));
// Bees.STREAM_CODEC: list of Occupant(EntityType holder, unnamed NBT, VarInt ticks, VarInt minTicks).
define('bees',list(r=>({entityType:r.varint(),tag:readAnonymousNbt(r),ticksInHive:r.varint(),minTicksInHive:r.varint()})));
// LodestoneTracker.STREAM_CODEC: optional GlobalPos (dimension string + packed position), BOOL tracked.
define('lodestone_tracker',r=>({
  target:r.bool()?{dimension:r.string(),position:r.position()}:null,
  tracked:r.bool()
}));
// Registries.BANNER_PATTERN holder set, including the named-tag branch.
define('provides_banner_patterns',holderSet);
// JukeboxSong.STREAM_CODEC is a holder stream codec.
define('jukebox_playable',varint);
// SulfurCubeContent.STREAM_CODEC is a plain ItemStackTemplate.
define('sulfur_cube_content',readItemStackTemplate26_3);
// SoundEvent.STREAM_CODEC is ByteBufCodecs.holder -> VarInt registry id.
define('break_sound',varint);
define('instrument',varint);
define('provides_trim_material',varint);
define('damage_type',varint);
define('glider',unit);
// OminousBottleAmplifier.STREAM_CODEC: ByteBufCodecs.VAR_INT.
define('ominous_bottle_amplifier',varint);
define('waxed',unit);
define('additional_trade_cost',varint);
// Every remaining *_variant component is a registry holder stream codec (VarInt id):
// DyeColor.STREAM_CODEC, CatVariant.STREAM_CODEC and friends all use ByteBufCodecs.idMapper
// or holderRegistry, both of which write the numeric registry id.
for(const name of [
  'villager/variant','wolf/variant','wolf/sound_variant','wolf/collar','fox/variant','salmon/size',
  'parrot/variant','tropical_fish/pattern','tropical_fish/base_color','tropical_fish/pattern_color',
  'mooshroom/variant','rabbit/variant','pig/variant','pig/sound_variant','cow/variant','cow/sound_variant',
  'chicken/variant','chicken/sound_variant','zombie_nautilus/variant','frog/variant','horse/variant',
  'painting/variant','llama/variant','axolotl/variant','cat/variant','cat/sound_variant','cat/collar',
  'sheep/color','shulker/color','dye','provides_pottery_pattern'
])define(name,varint);

// MobEffectInstance.STREAM_CODEC: MobEffect.STREAM_CODEC (holder -> VarInt), then Details:
// VarInt duration, VarInt amplifier, BOOL ambient/showParticles/showIcon, optional hidden effect.
function mobEffect(r){
  const effect=r.varint(),duration=r.varint(),amplifier=r.varint();
  const ambient=r.bool(),showParticles=r.bool(),showIcon=r.bool();
  const hidden=r.bool()?mobEffect(r):null;
  return {effect,duration,amplifier,ambient,showParticles,showIcon,hidden};
}

// ByteBufCodecs.holderSet: 0 then Identifier for a named tag, otherwise size+1 then holder ids.
function holderSet(r){
  const count=r.varint();
  if(count===0)return {tag:r.string()};
  const ids=[];
  for(let i=0;i<count-1;i++)ids.push(r.varint());
  return {ids};
}
const optionalHolderSet=()=>optional(holderSet);
// StatePropertiesPredicate.PropertyMatcher.STREAM_CODEC: STRING name, then either(exact, ranged).
// ValueMatcher.STREAM_CODEC writes Boolean.TRUE for ExactMatcher (one string) and FALSE for
// RangedMatcher (optional min, optional max). StatePropertiesPredicate.STREAM_CODEC is a list.
function statePropertiesPredicate(r){
  const count=r.varint(),properties=[];
  for(let i=0;i<count;i++){
    const name=r.string();
    properties.push({name,matcher:r.bool()?{exact:r.string()}:{min:optional(string)(r),max:optional(string)(r)}});
  }
  return properties;
}
// DataComponentPredicate.STREAM_CODEC: list(64) of a dispatched single predicate. Type.STREAM_CODEC
// is either(predicateType, componentType) -- TRUE for an explicit predicate type, FALSE for a
// component type used as an any-value predicate -- then VarInt id, then the predicate value.
// TypeBase.singleStreamCodec wraps every predicate's codec with fromCodecWithRegistries, so that
// value is one unnamed NBT tag. NbtPredicate.STREAM_CODEC is a plain unnamed CompoundTag.
function dataComponentMatchers(r){
  const exactCount=r.varint(),exact=[];
  for(let i=0;i<exactCount;i++){
    const typeId=r.varint();
    exact.push({type:typeId,...readComponentValue(r,typeId)});
  }
  const partialCount=r.varint();
  if(partialCount>64)throw Error('26.3 component matcher list '+partialCount+' exceeds native maximum 64');
  const partial=[];
  for(let i=0;i<partialCount;i++){
    const predicateType=r.bool(),id=r.varint(),value=readAnonymousNbt(r);
    partial.push(predicateType?{predicateType:id,value}:{componentType:id,value});
  }
  return {exact,partial};
}
const nbtPredicate=r=>readAnonymousNbt(r);
// BlockPredicate.STREAM_CODEC: optional holderSet<Block>, optional state predicate,
// optional NBT predicate, then DataComponentMatchers (never optional).
function blockPredicate(r){
  return {
    blocks:optional(holderSet)(r),
    properties:optional(statePropertiesPredicate)(r),
    nbt:optional(nbtPredicate)(r),
    components:dataComponentMatchers(r)
  };
}
// AdventureModePredicate.STREAM_CODEC: ByteBufCodecs.list of BlockPredicate, no show-tooltip flag.
const adventureModePredicate=r=>list(blockPredicate)(r);
define('can_place_on',adventureModePredicate);
define('can_break',adventureModePredicate);
// GameProfile.STREAM_CODEC: UUID, UTF8(16) name, then PropertyMap.
function profileProperties(r){
  const count=r.varint();
  if(count>16)throw Error('26.3 game profile has '+count+' properties');
  const properties=[];
  for(let i=0;i<count;i++)properties.push({name:r.string(),value:r.string(),signature:r.bool()?r.string():null});
  return properties;
}
const gameProfile=r=>({id:r.uuid(),name:r.string(),properties:profileProperties(r)});
// ByteBufCodecs.either writes Boolean.TRUE for the left branch and Boolean.FALSE for the right.
const resolvableInt=r=>r.bool()?{value:r.i32()}:{reference:r.string()};
const resolvableFloat=r=>r.bool()?{value:r.f32()}:{reference:r.string()};
// ConsumeEffect.Type registry order: apply_effects, remove_effects, clear_all_effects,
// teleport_randomly, play_sound.
function consumeEffect(r){
  const type=r.varint();
  if(type===0)return {type:'apply_effects',effects:list(mobEffect)(r),probability:r.f32()};
  if(type===1)return {type:'remove_effects',effects:holderSet(r)};
  if(type===2)return {type:'clear_all_effects'};
  if(type===3)return {type:'teleport_randomly',diameter:r.f32(),directionalParticles:r.bool()};
  if(type===4)return {type:'play_sound',sound:r.varint()};
  throw Error('Unknown 26.3 consume effect type '+type);
}
// ItemAttributeModifiers.Display.Type: default, hidden, override(Component).
function attributeDisplay(r){
  const type=r.varint();
  if(type===0)return {type:'default'};
  if(type===1)return {type:'hidden'};
  if(type===2)return {type:'override',component:readAnonymousNbt(r)};
  throw Error('Unknown 26.3 attribute modifier display '+type);
}

// ---- 26.3 components that were fail-closed before this port.
define('use_effects',r=>({canSprint:r.bool(),interactVibrations:r.bool(),speedMultiplier:r.f32()}));
define('attribute_modifiers',list(r=>({
  attribute:r.varint(),
  modifier:{id:r.string(),amount:r.f64(),operation:r.varint()},
  slot:r.varint(),
  display:attributeDisplay(r)
})));
define('food',r=>({nutrition:r.varint(),saturation:r.f32(),canAlwaysEat:r.bool()}));
define('consumable',r=>({
  consumeSeconds:r.f32(),
  animation:r.varint(),
  sound:r.varint(),
  hasConsumeParticles:r.bool(),
  onConsumeEffects:list(consumeEffect)(r)
}));
define('use_remainder',readItemStackTemplate26_3);
define('use_cooldown',r=>({seconds:r.f32(),cooldownGroup:optional(string)(r)}));
define('damage_resistant',holderSet);
define('tool',r=>{
  const rules=list(entry=>({blocks:holderSet(entry),speed:optional(float)(entry),correctForDrops:optional(entry=>entry.bool())(entry)}))(r);
  return {rules,defaultMiningSpeed:r.f32(),damagePerBlock:r.varint(),canDestroyBlocksInCreative:r.bool()};
});
define('weapon',r=>({itemDamagePerAttack:r.varint(),disableBlockingForSeconds:r.f32()}));
define('attack_range',r=>({
  minReach:r.f32(),maxReach:r.f32(),minCreativeReach:r.f32(),
  maxCreativeReach:r.f32(),hitboxMargin:r.f32(),mobFactor:r.f32()
}));
define('enchantable',varint);
define('equippable',r=>({
  slot:r.varint(),equipSound:r.varint(),assetId:optional(string)(r),cameraOverlay:optional(string)(r),
  allowedEntities:optionalHolderSet()(r),dispensable:r.bool(),swappable:r.bool(),damageOnHurt:r.bool(),
  equipOnInteract:r.bool(),canBeSheared:r.bool(),shearingSound:r.varint()
}));
define('repairable',holderSet);
define('tooltip_style',string);
define('death_protection',list(consumeEffect));
define('blocks_attacks',r=>({
  blockDelaySeconds:r.f32(),
  disableCooldownScale:r.f32(),
  damageReductions:list(entry=>({horizontalBlockingAngle:entry.f32(),type:optionalHolderSet()(entry),base:entry.f32(),factor:entry.f32()}))(r),
  itemDamage:{threshold:r.f32(),base:r.f32(),factor:r.f32()},
  bypassedBy:optionalHolderSet()(r),
  blockSound:optional(varint)(r),
  disableSound:optional(varint)(r)
}));
define('piercing_weapon',r=>({dealsKnockback:r.bool(),dismounts:r.bool(),sound:optional(varint)(r),hitSound:optional(varint)(r)}));
define('kinetic_weapon',r=>({
  contactCooldownTicks:r.varint(),delayTicks:r.varint(),
  dismountConditions:optional(kineticCondition)(r),
  knockbackConditions:optional(kineticCondition)(r),
  damageConditions:optional(kineticCondition)(r),
  forwardMovement:r.f32(),damageMultiplier:r.f32(),
  sound:optional(varint)(r),hitSound:optional(varint)(r)
}));
function kineticCondition(r){return {maxDurationTicks:r.varint(),minSpeed:r.f32(),minRelativeSpeed:r.f32()};}
const swingAnimation=r=>({type:r.varint(),duration:r.varint()});
define('attack_animation',swingAnimation);
define('interact_animation',swingAnimation);
define('block_transformer',varint);
define('villager_food',varint);
// ResolvableProfile: either(full GameProfile, partial), then PlayerSkin.Patch
// (three optional texture ids and an optional slim model flag).
define('profile',r=>{
  const profile=r.bool()?gameProfile(r):{
    name:optional(string)(r),id:optional(()=>r.uuid())(r),properties:profileProperties(r)
  };
  return {profile,skinPatch:{
    body:optional(string)(r),cape:optional(string)(r),elytra:optional(string)(r),model:optional(()=>r.bool())(r)
  }};
});
define('compostable',r=>({layers:resolvableInt(r)}));
define('cooking_fuel',r=>({burnTime:resolvableInt(r),speedMultiplier:resolvableFloat(r)}));
define('brewing_fuel',r=>({uses:resolvableInt(r),speedMultiplier:resolvableFloat(r)}));
define('mob_visibility',r=>({targetingEntityTypes:holderSet(r),visibility:r.f32()}));
// SignText.STREAM_CODEC: four components, optional four filtered components, dye id, glowing flag.
define('sign_text_front',signText);
define('sign_text_back',signText);
function signText(r){
  const messages=[];for(let i=0;i<4;i++)messages.push(readAnonymousNbt(r));
  const filtered=optional(()=>{const out=[];for(let i=0;i<4;i++)out.push(readAnonymousNbt(r));return out;})(r);
  return {messages,filteredMessages:filtered,color:r.varint(),hasGlowingText:r.bool()};
}
define('cushion/color',varint);

const UNSYNCED=new Set(['custom_data','intangible_projectile','map_decorations','debug_stick_state','recipes','lock','container_loot']);

function readComponentValue(r,typeId){
  const name=DATA_COMPONENT_NAMES_26_3[typeId];
  if(!name)throw Error('Unknown 26.3 data component id '+typeId);
  const read=READERS[name];
  if(!read)throw Error('26.3 data component "'+name+'" ('+typeId+') has no verified network codec'+(UNSYNCED.has(name)?' (registered as server-only)':''));
  return {name,value:read(r)};
}

export function readItemStackTemplate26_3(r){
  const itemId=r.varint();
  const count=r.varint();
  return readItemPatch(r,itemId,count);
}

// The native report and network codec use different shapes for a few components. Convert
// network values to the consumer-facing shapes used by Items/rendering, while report
// defaults already arrive in that shape.
const RARITIES=['common','uncommon','rare','epic'];
// ItemUseAnimation declaration order in 26.3: NONE, EAT, DRINK, BLOCK, BOW, TRIDENT,
// CROSSBOW, SPYGLASS, TOOT_HORN, BRUSH, BUNDLE, SPEAR.
const USE_ANIMATIONS=['none','eat','drink','block','bow','trident','crossbow','spyglass','toot_horn','brush','bundle','spear'];
const ATTRIBUTE_OPERATIONS={0:'add_value',1:'add_multiplied_base',2:'add_multiplied_total'};
const ATTRIBUTE_SLOTS={0:'any',1:'mainhand',2:'offhand',3:'hand',4:'feet',5:'legs',6:'chest',7:'head',8:'armor',9:'body'};
const TEXT_COMPONENTS=new Set(['custom_name','item_name','lore','written_book_content']);

function textValue(value){
  return value==null?value:componentFromNbt(value);
}

function nativeAttributeModifiers(value){
  if(!Array.isArray(value))return value;
  return {modifiers:value.map(entry=>({
    type:ITEM_DEFAULTS_26_3.attributeNames[entry.attribute]??entry.type,
    id:entry.modifier?.id,
    amount:entry.modifier?.amount,
    operation:ATTRIBUTE_OPERATIONS[entry.modifier?.operation]??entry.modifier?.operation,
    slot:ATTRIBUTE_SLOTS[entry.slot]??entry.slot
  }))};
}

export function normalizeNativeComponent(name,value){
  if(TEXT_COMPONENTS.has(name)){
    if(name==='lore')return (value||[]).map(textValue);
    if(name==='written_book_content')return {...value,pages:(value?.pages||[]).map(page=>({...page,content:textValue(page.content)}))};
    return textValue(value);
  }
  if(name==='attribute_modifiers')return nativeAttributeModifiers(value);
  if(name==='dyed_color'&&typeof value==='number')return {rgb:value>>>0,show_in_tooltip:true};
  if(name==='rarity'&&typeof value==='number')return RARITIES[value]??value;
  if(name==='potion_contents'&&value&&typeof value==='object')return {...value,potionId:value.potion};
  if(name==='consumable'&&typeof value?.animation==='number')return {...value,animation:USE_ANIMATIONS[value.animation]??value.animation};
  if(name==='custom_model_data'&&value&&typeof value==='object')return value.floats?.[0]??0;
  return value;
}

// Defaults plus the stack's patch, in the shape client consumers expect. 26.3 defaults come
// from the native reports; patch values go through the network-shape conversion above.
export function itemComponentValues26_3(item){
  const entry=ITEM_DEFAULTS_26_3.items[item.itemId??item.id];
  const values={...entry?.defaults};
  for(const id of item.removed||[])delete values[DATA_COMPONENT_NAMES_26_3[id]];
  for(const {name,value} of item.added||[])values[name]=normalizeNativeComponent(name,value);
  const tooltip=values.tooltip_display;
  if(tooltip&&(tooltip.hideTooltip??tooltip.hide_tooltip))values.hide_tooltip=true;
  return values;
}

function readItemPatch(r,itemId,count){
  const addedCount=r.varint(),removedCount=r.varint();
  const added=[],removed=[],components={};
  for(let i=0;i<addedCount;i++){
    const typeId=r.varint();
    const {name,value}=readComponentValue(r,typeId);
    added.push({type:typeId,name,value});
    components[name]=value;
  }
  for(let i=0;i<removedCount;i++)removed.push(r.varint());
  return {itemId,count,added,removed,components,version:'26.3'};
}

export function readItemStack26_3(r){
  const count=r.varint();
  if(count<=0)return null;
  const itemId=r.varint();
  return readItemPatch(r,itemId,count);
}

// ItemCost.STREAM_CODEC (javap on 26.3 ItemCost): Item.STREAM_CODEC (VarInt holder id),
// ByteBufCodecs.VAR_INT count, then DataComponentExactPredicate.STREAM_CODEC. The predicate
// is a VarInt-prefixed list of TypedDataComponent (VarInt type id, then that type's stream
// codec), which is the same typed-component pair an ItemStack patch carries. 26.3 trading
// costs therefore ship exact-match components instead of the 766 loose component list.
export function readItemCost26_3(r){
  const itemId=r.varint(),count=r.varint(),addedCount=r.varint();
  const added=[];
  for(let i=0;i<addedCount;i++){
    const typeId=r.varint();
    const {name,value}=readComponentValue(r,typeId);
    added.push({type:typeId,name,value});
  }
  return {itemId,count,added};
}

// Item source for outbound packets. Accepts either a decoded stack or the game's decorated
// slot shape. Component values are not re-encoded yet, so only stacks whose patch is empty can
// be written: that is exactly what creative inventory hands out, and it fails loudly rather
// than sending a patch the server would misread.
function patchOf(stack){
  return {
    itemId:stack.itemId??stack.id,
    count:stack.count,
    added:stack.added??stack.componentPatch?.added??[],
    removed:stack.removed??stack.componentPatch?.removed??[]
  };
}

export function writeItemStack26_3(w,stack){
  if(!stack||!(stack.count>0)){w.varint(0);return w;}
  const {itemId,count,added,removed}=patchOf(stack);
  if(!Number.isInteger(itemId)||itemId<0)throw Error('26.3 item stack needs a native item id');
  if(added.length||removed.length)throw Error('26.3 item writer has no component encoders yet (item '+itemId+')');
  w.varint(count).varint(itemId).varint(0).varint(0);
  return w;
}

// HashedStack.STREAM_CODEC: optional ActualItem(item holder, count, HashedPatchMap).
// HashedPatchMap is (VarInt type, INT hash)* then VarInt removed ids; an empty patch is two
// zero counts, which is the only patch this writer can prove without component hashing.
export function writeHashedStack26_3(w,stack){
  if(!stack||!(stack.count>0)){w.bool(false);return w;}
  const {itemId,count,added,removed}=patchOf(stack);
  if(added.length||removed.length)throw Error('26.3 HashedStack needs component hashes; only empty patches are supported yet (item '+itemId+')');
  w.bool(true).varint(itemId).varint(count).varint(0).varint(0);
  return w;
}

export function supportedComponentCount(){
  return Object.keys(READERS).length;
}

export const COMPONENT_READERS_26_3=Object.freeze({...READERS});
