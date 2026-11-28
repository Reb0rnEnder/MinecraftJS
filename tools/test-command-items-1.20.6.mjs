// 1.20.5+ ItemParser and ComponentPredicateParser rules (minecraft:item_stack / minecraft:item_predicate).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseItemStack,parseItemPredicate} from '../client/js/game/command-items-1.20.6.js';
const ctx={items:['minecraft:stone','minecraft:diamond_sword'],itemTags:['minecraft:logs']};
const stack=s=>{const r=parseItemStack(s,0,ctx);return r.error?[r.error.key,...r.error.args,r.error.start]:r.end;};
const pred=s=>{const r=parseItemPredicate(s,0,ctx);return r.error?[r.error.key,...r.error.args,r.error.start]:r.end;};
test('item_stack: components in brackets, native errors and codec messages',()=>{
  assert.equal(stack('stone'),5);assert.equal(stack('minecraft:stone[]'),17);
  const full='diamond_sword[damage=3, custom_name=\'"x"\',enchantments={levels:{"minecraft:sharpness":5}}]';assert.equal(stack(full),full.length);
  assert.equal(stack('stone{CustomName:"x"}'),5); // NBT is no longer part of the argument
  assert.deepEqual(stack('dirt'),['argument.item.id.invalid','minecraft:dirt',0]);
  assert.deepEqual(stack('stone[damage=-1]'),['arguments.item.component.malformed','minecraft:damage','Value must be non-negative: -1',13]);
  assert.deepEqual(stack('stone[max_stack_size=100]'),['arguments.item.component.malformed','minecraft:max_stack_size','Value must be within range [1;99]: 100',21]);
  assert.deepEqual(stack('stone[max_damage="a"]'),['arguments.item.component.malformed','minecraft:max_damage','Not a number',17]);
  assert.deepEqual(stack('stone[damage=1,damage=2]'),['arguments.item.component.repeated','minecraft:damage',21]);
  assert.deepEqual(stack('stone[creative_slot_lock={}]'),['arguments.item.component.unknown','minecraft:creative_slot_lock',6]);
  assert.deepEqual(stack('stone[damage 3]'),['parsing.expected','=',13]);
  assert.deepEqual(stack('stone[damage=1,'),['arguments.item.component.expected',15]);
  assert.deepEqual(stack('stone[damage=1'),['parsing.expected',']',14]);
});
test('item_predicate: ids, tags and *, alternatives, negation, existence, sub-predicates and count',()=>{
  assert.equal(pred('*'),1);assert.equal(pred('#logs'),5);assert.equal(pred('stone[]'),7);
  const p='*[!damage|count=2, enchantments~{}, custom_data]';assert.equal(pred(p),p.length);
  assert.equal(pred('stone[count~{min:1}]'),20);
  assert.deepEqual(pred('#minecraft:nope'),['arguments.item.tag.unknown','minecraft:nope',1]);
  assert.deepEqual(pred('*[foo~{}]'),['arguments.item.predicate.unknown','minecraft:foo',2]);
  assert.deepEqual(pred('*[foo]'),['arguments.item.component.unknown','minecraft:foo',2]);
  assert.deepEqual(pred('*[damage=-2]'),['arguments.item.component.malformed','minecraft:damage','Value must be non-negative: -2',9]);
});
test('through the command tree: /give accepts components and rejects 1.20.4 NBT syntax as trailing data',async()=>{
  const {CommandTree}=await import('../client/js/game/commands.js');
  const tree=new CommandTree({root:0,nodes:[{type:0,children:[1]},{type:1,name:'give',children:[2]},{type:2,name:'item',parser:'minecraft:item_stack',children:[3],executable:true},{type:2,name:'count',parser:'brigadier:integer',properties:{},children:[],executable:true}]},{assets:{data:{items:[{name:'stone'}]}}});
  const ok=tree.parse('/give stone[damage=1] 2');assert.equal(ok.error,undefined);assert.equal(ok.cursor,'/give stone[damage=1] 2'.length);
  const nbt=tree.parse('/give stone{display:{}}');assert.ok(nbt.error||nbt.cursor<'/give stone{display:{}}'.length);
  const bad=tree.parse('/give stone[damage=-1]');assert.equal(bad.error?.key,'arguments.item.component.malformed');
});
test('suggestions follow ItemParser: [ after a complete id, component= names, = after a name, then , and ]',async()=>{
  const {itemStackSuggestions,itemPredicateSuggestions}=await import('../client/js/game/command-items-1.20.6.js');
  const items=['minecraft:stone','minecraft:stone_bricks'];
  assert.equal(itemStackSuggestions('ston',items),null);
  assert.deepEqual(itemStackSuggestions('stone',items),{offset:5,values:['[']});
  const names=itemStackSuggestions('stone[da',items);assert.equal(names.offset,6);assert.ok(names.values.includes('minecraft:damage='));assert.ok(!names.values.includes('minecraft:creative_slot_lock='));
  assert.ok(!itemStackSuggestions('stone[damage=1,',items).values.includes('minecraft:damage='));
  assert.deepEqual(itemStackSuggestions('stone[damage',items),{offset:12,values:['=']});
  assert.deepEqual(itemStackSuggestions('stone[damage=1',items),{offset:14,values:[',',']']});
  const p=itemPredicateSuggestions('*[!dam');assert.equal(p.offset,3);assert.ok(p.values.includes('minecraft:count')&&p.values.includes('minecraft:enchantments'));
});
