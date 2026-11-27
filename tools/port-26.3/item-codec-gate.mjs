// Gate for the 26.3 item stack codec. The bytes here are hand-built from the javap layouts
// (never from a captured guess) so each field boundary is exercised: VarInt counts, the
// added/removed pair, a fixed-width INT color, nested lists, and the ItemStackTemplate use
// inside container contents. Unknown components must fail closed.
import assert from 'node:assert/strict';
import {Reader,Writer} from '../../client/js/net/buffer.js';
import {readItemStack26_3,COMPONENT_READERS_26_3,itemComponentValues26_3,normalizeNativeComponent} from '../../client/js/net/item-components-26.3.js';
import {DATA_COMPONENT_NAMES_26_3,ITEM_NAMES_26_3} from '../../client/js/net/items-26.3.js';
import {adaptPlay26_3} from '../../client/js/net/play-adapter-26.3.js';
import {Items} from '../../client/js/game/items.js';
import {armorType} from '../../client/js/game/container.js';
import {bundleContents} from '../../client/js/game/bundle.js';
import {DATA_COMPONENTS} from './component-fixture.mjs';

const componentId=name=>{
  const id=DATA_COMPONENT_NAMES_26_3.indexOf(name);
  assert.ok(id>=0,'native component registry has '+name);
  return id;
};
const itemId=name=>{
  const id=ITEM_NAMES_26_3.indexOf(name);
  assert.ok(id>=0,'native item registry has '+name);
  return id;
};

const diamondSword=itemId('diamond_sword');
const chest=itemId('chest');
const apple=itemId('apple');

// 1. A stack with five added components and two removals, each with a distinct wire shape.
const stackBytes=new Writer()
  .varint(1)                          // count
  .varint(diamondSword)               // item id
  .varint(5)                          // added components
  .varint(2)                          // removed components
  .varint(componentId('max_stack_size')).varint(16)
  .varint(componentId('damage')).varint(42)
  .varint(componentId('dyed_color')).i32(0x11223344)
  .varint(componentId('custom_model_data'))
    .varint(1).f32(0.5)
    .varint(1).bool(true)
    .varint(2).string('a').string('b')
    .varint(1).i32(7)
  .varint(componentId('enchantments'))
    .varint(2).varint(0).varint(3).varint(5).varint(1)
  .varint(componentId('unbreakable')).varint(componentId('repair_cost'))
  .build();

const reader=new Reader(stackBytes);
const stack=readItemStack26_3(reader);
assert.equal(reader.remaining(),0,'the stack consumes exactly its bytes');
assert.equal(stack.itemId,diamondSword);
assert.equal(stack.count,1);
assert.deepEqual(stack.added.map(component=>component.name),['max_stack_size','damage','dyed_color','custom_model_data','enchantments']);
assert.equal(stack.added[0].value,16,'max_stack_size is a VarInt');
assert.equal(stack.added[1].value,42,'damage is a VarInt');
assert.equal(stack.added[2].value,0x11223344,'dyed_color is a fixed four-byte INT, not a VarInt');
assert.deepEqual(stack.added[3].value,{floats:[0.5],flags:[true],strings:['a','b'],colors:[7]},'custom_model_data is four lists');
assert.deepEqual(stack.added[4].value,[{enchantment:0,id:'minecraft:aqua_affinity',level:3},{enchantment:5,id:'minecraft:channeling',level:1}],'enchantments are (holder, level) VarInt pairs resolved through the native registry');
assert.deepEqual(stack.removed,[componentId('unbreakable'),componentId('repair_cost')],'removed components are bare ids after the values');
assert.equal(stack.components.damage,42,'the convenience map follows the patch');

// 2. ItemStackTemplate inside container contents: item, count, patch; an empty slot is a bool false.
const containerBytes=new Writer()
  .varint(1).varint(chest)
  .varint(1)                          // one added component
  .varint(0)                          // no removed components
  .varint(componentId('container'))
    .varint(2)                        // two slots
    .bool(false)                      // empty slot
    .bool(true).varint(apple).varint(3).varint(0).varint(0) // three apples, empty patch
  .build();
const containerReader=new Reader(containerBytes);
const chestStack=readItemStack26_3(containerReader);
assert.equal(containerReader.remaining(),0,'container contents consume exactly their bytes');
assert.equal(chestStack.components.container.length,2);
assert.equal(chestStack.components.container[0],null,'an absent slot is null');
assert.equal(chestStack.components.container[1].itemId,apple);
assert.equal(chestStack.components.container[1].count,3);
assert.deepEqual(chestStack.components.container[1].added,[]);

// 3. Potion contents: optional potion holder, optional INT color, effect list, optional string.
const potionBytes=new Writer()
  .varint(1).varint(apple)
  .varint(1).varint(0)
  .varint(componentId('potion_contents'))
    .bool(true).varint(7)
    .bool(true).i32(0x00ff00)
    .varint(1).varint(1).varint(200).varint(2).bool(false).bool(true).bool(true).bool(false)
    .bool(false)
  .build();
const potionReader=new Reader(potionBytes);
const potion=readItemStack26_3(potionReader);
assert.equal(potionReader.remaining(),0);
assert.equal(potion.components.potion_contents.potion,7);
assert.equal(potion.components.potion_contents.customColor,0x00ff00);
assert.deepEqual(potion.components.potion_contents.customEffects,[
  {effect:1,duration:200,amplifier:2,ambient:false,showParticles:true,showIcon:true,hidden:null}
]);

// 4. An empty stack is a zero count and nothing else.
const emptyReader=new Reader(new Writer().varint(0).build());
assert.equal(readItemStack26_3(emptyReader),null);
assert.equal(emptyReader.remaining(),0,'the empty stack is exactly one VarInt');

// 5. A component without a verified codec fails closed instead of desynchronising the stream.
assert.ok(COMPONENT_READERS_26_3.attribute_modifiers,'attribute_modifiers has a verified reader');
const unknownBytes=new Writer()
  .varint(1).varint(apple)
  .varint(1).varint(0)
  .varint(componentId('custom_data')).varint(0)
  .build();
assert.throws(()=>readItemStack26_3(new Reader(unknownBytes)),/no verified network codec/,'unknown components throw');

// 6. Server-only components can never appear in a patch; the fixture records which they are.
for(const entry of Object.values(DATA_COMPONENTS)){
  if(entry.synced)continue;
  assert.equal(COMPONENT_READERS_26_3[entry.name],undefined,'server-only component '+entry.name+' has no reader');
}

// 7. The adapter exposes the slot shape the game's window handlers read.
const adapted=adaptPlay26_3({
  decoded:true,
  name:'container_set_content',
  data:{containerId:0,stateId:3,items:[stack,null],carried:null}
});
assert.equal(adapted.name,'window_items');
assert.equal(adapted.windowId,0);
assert.equal(adapted.stateId,3);
assert.equal(adapted.items[1],null,'empty slots stay null');
assert.equal(adapted.items[0].itemKey,'diamond_sword','itemKey comes from the native item registry');
assert.equal(adapted.items[0].id,diamondSword);
assert.equal(adapted.items[0].count,1);
assert.equal(adapted.items[0].damage,42);
assert.equal(adapted.items[0].maxStackSize,16);
assert.equal(adapted.items[0].version,'26.3');
assert.equal(adapted.items[0].maxDamage,1561,'adapted slots carry native defaults');
assert.equal(adapted.items[0].components.unbreakable,undefined,'adapted slots carry patch removals');
assert.equal(itemComponentValues26_3(adapted.items[0]).max_stack_size,16,'the item view applies an adapted slot patch');
assert.equal(itemComponentValues26_3(adapted.items[0]).unbreakable,undefined,'the item view applies adapted slot removals');
const bundleView=new Items({data:{items:[],enchantments:[]}});
const nestedBundle={version:'26.3',itemId:itemId('bundle'),added:[{name:'bundle_contents',value:[{itemId:apple,count:3,added:[],removed:[],components:{}},{itemId:itemId('stick'),count:8,added:[],removed:[],components:{}}]}],removed:[]};
const bundleItems=bundleContents(nestedBundle,bundleView);
assert.equal(bundleItems.length,2,'native bundle contents are visible');
assert.equal(bundleItems[0].id,apple,'native bundle entries are adapted to decorated stacks');
assert.equal(bundleItems[0].count,3,'native bundle entry counts survive adaptation');
assert.equal(bundleView.component(nestedBundle,'bundle_contents')[1].itemKey,'stick','nested component templates carry item keys');
assert.deepEqual(adapted.items[0].componentPatch.removed,[componentId('unbreakable'),componentId('repair_cost')]);

const slot=adaptPlay26_3({decoded:true,name:'container_set_slot',data:{containerId:5,stateId:9,slot:12,item:stack}});
assert.equal(slot.name,'set_slot');
assert.equal(slot.windowId,5);
assert.equal(slot.slot,12);

const inventory=adaptPlay26_3({decoded:true,name:'set_player_inventory',data:{slot:36,item:stack}});
assert.equal(inventory.name,'set_slot','26.3 player-inventory writes land on the set_slot handler');
assert.equal(inventory.windowId,-2,'windowId -2 is the existing direct player-inventory path');
assert.equal(inventory.slot,36);

// 8. Adventure predicates: optional block holder set, optional state matchers, optional NBT,
// then DataComponentMatchers. Each partial matcher is a registry id and one unnamed NBT tag.
const emptyCompound=[10,0];
const adventureBytes=new Writer()
  .varint(1).varint(apple)
  .varint(1).varint(0)
  .varint(componentId('can_place_on'))
    .varint(2)                        // two BlockPredicates
    .bool(true).varint(3).varint(7).varint(8) // direct holder set: size+1 then two block ids
    .bool(true).varint(1).string('facing').bool(true).string('north')
    .bool(false)                      // no NBT
    .varint(0).varint(0)              // exact and partial component matchers are empty
    .bool(false)                      // no block set
    .bool(false)                      // no state predicate
    .bool(true).raw(emptyCompound)    // empty NBT predicate
    .varint(1).varint(componentId('damage')).varint(5) // exact component predicate
    .varint(1).bool(true).varint(0).raw(emptyCompound) // one explicit predicate type
  .build();
const adventureReader=new Reader(adventureBytes);
const adventureStack=readItemStack26_3(adventureReader);
assert.equal(adventureReader.remaining(),0,'can_place_on consumes exactly its bytes');
const predicates=adventureStack.components.can_place_on;
assert.equal(predicates.length,2);
assert.deepEqual(predicates[0].blocks,{ids:[7,8]},'holderSet direct branch is size+1 and holder ids');
assert.deepEqual(predicates[0].properties,[{name:'facing',matcher:{exact:'north'}}]);
assert.equal(predicates[0].nbt,null);
assert.deepEqual(predicates[0].components,{exact:[],partial:[]});
assert.ok(predicates[1].nbt,'NbtPredicate is one unnamed CompoundTag');
assert.deepEqual(predicates[1].components.exact.map(component=>[component.name,component.value]),[['damage',5]]);
assert.equal(predicates[1].components.partial[0].predicateType,0);
assert.ok(COMPONENT_READERS_26_3.can_break,'can_break shares the AdventureModePredicate reader');

// 9. Native defaults feed the game's item view: a decoded 26.3 stack keeps the report
// defaults and applies its patch, so durability/stack size/food no longer come from 766.
assert.equal(adventureStack.version,'26.3','decoded native stacks are marked for the consumer adapter');
const swordValues=itemComponentValues26_3(stack);
assert.equal(swordValues.max_damage,1561,'diamond sword native durability default');
assert.equal(swordValues.max_stack_size,16,'patched stack size overrides the default');
assert.equal(swordValues.damage,42,'patched damage overrides the default');
assert.equal(swordValues.unbreakable,undefined,'removed native default is deleted from the view');
assert.equal(itemComponentValues26_3({itemId:apple,added:[],removed:[]}).food.nutrition,4,'apple native food defaults');
assert.deepEqual(normalizeNativeComponent('rarity',2),'rare','native rarity id maps to its name');
assert.deepEqual(normalizeNativeComponent('dyed_color',0x123456),{rgb:0x123456,show_in_tooltip:true},'native dyed color becomes the item-view shape');
assert.equal(normalizeNativeComponent('custom_model_data',{floats:[7],flags:[],strings:[],colors:[]}),7,'native custom model data exposes its first float');
assert.equal(normalizeNativeComponent('potion_contents',{potion:13,customColor:null,customEffects:[],customEffectsName:null}).potionId,13,'native potion holder id reaches the item view');
assert.equal(normalizeNativeComponent('consumable',{consumeSeconds:1.6,animation:2,sound:0,hasConsumeParticles:false,onConsumeEffects:[]}).animation,'drink','native use-animation id maps to its name');
assert.deepEqual(normalizeNativeComponent('tooltip_display',{hideTooltip:false,hiddenComponents:[componentId('enchantments')]}),{hide_tooltip:false,hidden_components:['enchantments']},'native tooltip hidden-component ids map to names');
assert.equal(normalizeNativeComponent('tooltip_display',{hideTooltip:true,hiddenComponents:[]}).hide_tooltip,true,'native tooltip hide flag is preserved');
const itemView=new Items({data:{items:[]}});
const potionStack={version:'26.3',itemId:itemId('potion'),added:[{name:'consumable',value:{consumeSeconds:1.6,animation:2,sound:0,hasConsumeParticles:false,onConsumeEffects:[]}}],removed:[]};
assert.equal(itemView.useAction(potionStack),'drink','native consumable controls the potion use action');
assert.equal(itemView.useDuration(potionStack),32,'native consume seconds drive the use duration');
const appleStack={version:'26.3',itemId:apple,added:[],removed:[]};
assert.equal(itemView.useAction(appleStack),'eat','native food defaults remain edible');
assert.equal(itemView.useDuration(appleStack),32,'native food consume time is 1.6 s');
const nativeStack=name=>({version:'26.3',itemId:itemId(name),added:[],removed:[]});
assert.equal(itemView.strVsBlock(nativeStack('diamond_pickaxe'),{name:'stone'}),8,'native pickaxe rule gives stone speed 8');
assert.equal(itemView.strVsBlock(nativeStack('diamond_pickaxe'),{name:'dirt'}),1,'unmatched native tool rule falls back to 1');
assert.equal(itemView.strVsBlock(nativeStack('diamond_sword'),{name:'cobweb'}),15,'native sword cobweb rule wins before the tag rules');
assert.equal(itemView.strVsBlock(nativeStack('diamond_sword'),{name:'oak_leaves'}),1.5,'sword efficient tag is resolved through the native leaves tag');
assert.equal(itemView.strVsBlock(nativeStack('wooden_axe'),{name:'stone'}),1,'wooden axe rejects stone through the incorrect-tool tag');
assert.equal(itemView.strVsBlock(nativeStack('apple'),{name:'stone'}),1,'native non-tool items use hand speed instead of the shifted 766 table');
assert.equal(armorType(nativeStack('leather_helmet'),itemView),0,'native equippable head slot maps to the helmet slot');
assert.equal(armorType(nativeStack('elytra'),itemView),1,'native equippable chest slot maps to the chest slot');
assert.equal(armorType(nativeStack('wolf_armor'),itemView),-1,'native body equipment is not a player armor slot');
assert.equal(itemView.canHarvest(nativeStack('diamond_pickaxe'),{name:'stone'}),true,'native pickaxe harvests tool-required stone');
assert.equal(itemView.canHarvest(nativeStack('wooden_pickaxe'),{name:'stone'}),true,'wooden pickaxe harvests stone');
assert.equal(itemView.canHarvest(nativeStack('wooden_pickaxe'),{name:'iron_ore'}),false,'wooden pickaxe cannot harvest iron ore');
assert.equal(itemView.canHarvest(nativeStack('diamond_pickaxe'),{name:'obsidian'}),true,'diamond pickaxe harvests obsidian');
assert.equal(itemView.canHarvest(nativeStack('apple'),{name:'stone'}),false,'hand cannot harvest tool-required stone');
assert.equal(itemView.canHarvest(nativeStack('apple'),{name:'dirt'}),true,'hand harvests blocks that need no tool');
assert.equal(normalizeNativeComponent('equippable',{slot:5,equipSound:0,dispensable:true,swappable:true,damageOnHurt:true,equipOnInteract:false,canBeSheared:false}).slot,'head','native equipment slot id maps to its name');
const tooltipItems=new Items({data:{items:[{id:diamondSword,name:'diamond_sword'}],enchantments:[]},translate:key=>key});
const hiddenAttributes={...nativeStack('diamond_sword'),added:[{name:'tooltip_display',value:{hideTooltip:false,hiddenComponents:[componentId('attribute_modifiers')]}}]};
assert.ok(!tooltipItems.tooltip(hiddenAttributes).some(line=>line.includes('attribute.')),'hidden tooltip components are omitted');
const hiddenTooltip={...nativeStack('diamond_sword'),added:[{name:'tooltip_display',value:{hideTooltip:true,hiddenComponents:[]}}]};
assert.deepEqual(tooltipItems.tooltip(hiddenTooltip),[],'native hide-tooltip suppresses every line');

const total=Object.keys(DATA_COMPONENTS).length;
const unsynced=Object.values(DATA_COMPONENTS).filter(entry=>!entry.synced).length;
console.log(JSON.stringify({
  items:ITEM_NAMES_26_3.length,
  components:total,
  serverOnly:unsynced,
  decodable:total-unsynced,
  supported:Object.keys(COMPONENT_READERS_26_3).length
},null,2));
console.log('26.3 item stacks decode with native component ids ('+Object.keys(COMPONENT_READERS_26_3).length+' of '+(total-unsynced)+' wire components)');
