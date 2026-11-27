// Gate for the 26.3 item stack codec. The bytes here are hand-built from the javap layouts
// (never from a captured guess) so each field boundary is exercised: VarInt counts, the
// added/removed pair, a fixed-width INT color, nested lists, and the ItemStackTemplate use
// inside container contents. Unknown components must fail closed.
import assert from 'node:assert/strict';
import {Reader,Writer} from '../../client/js/net/buffer.js';
import {readItemStack26_3,COMPONENT_READERS_26_3} from '../../client/js/net/item-components-26.3.js';
import {DATA_COMPONENT_NAMES_26_3,ITEM_NAMES_26_3} from '../../client/js/net/items-26.3.js';
import {adaptPlay26_3} from '../../client/js/net/play-adapter-26.3.js';
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
assert.deepEqual(stack.added[4].value,[{enchantment:0,level:3},{enchantment:5,level:1}],'enchantments are (holder, level) VarInt pairs');
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
assert.deepEqual(adapted.items[0].componentPatch.removed,[componentId('unbreakable'),componentId('repair_cost')]);

const slot=adaptPlay26_3({decoded:true,name:'container_set_slot',data:{containerId:5,stateId:9,slot:12,item:stack}});
assert.equal(slot.name,'set_slot');
assert.equal(slot.windowId,5);
assert.equal(slot.slot,12);

const inventory=adaptPlay26_3({decoded:true,name:'set_player_inventory',data:{slot:36,item:stack}});
assert.equal(inventory.name,'set_slot','26.3 player-inventory writes land on the set_slot handler');
assert.equal(inventory.windowId,-2,'windowId -2 is the existing direct player-inventory path');
assert.equal(inventory.slot,36);

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
