import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Reader26_3,Writer26_3} from '../client/js/net/configuration-26.3.js';
import {readItemStack26_3,writeItemStack26_3} from '../client/js/net/item-components-26.3.js';
import {nativeCreativeRows263,creativeStack263} from '../client/js/gui/creative-data-26.3.js';
import {creativeRows} from '../client/js/gui/screens/containers.js';

const data=JSON.parse(readFileSync(new URL('../client/data/creative.json',import.meta.url)));
const items=JSON.parse(readFileSync(new URL('../client/data/items.json',import.meta.url)));
const byName=new Map(items.map(item=>[item.name,item.id]));
function game(mask=0,operator=false){
  return {
    assets:{data:{creative:data}},
    enabledFeatures:new Set(['minecraft:vanilla',...['minecraft:trade_rebalance','minecraft:redstone_experiments','minecraft:minecart_improvements'].filter((_,i)=>mask&(1<<i))]),
    settings:{operatorItemsTab:operator},
    canUseCommandBlock:()=>true
  };
}

test('native 26.3 Creative rows select all eight feature masks and keep operator tabs separate',()=>{
  assert.equal(data.version,'26.3');
  assert.equal(data.protocol,777);
  assert.equal(data.stackFormat,'native-components-263');
  assert.equal(data.stacks.length,2034);
  assert.equal(data.featureCatalogs.length,8);
  assert.equal(data.stacks.filter(entry=>entry.patch).length,405);
  assert.equal(creativeRows(game()),nativeCreativeRows263(game()));
  for(let mask=0;mask<8;mask++){
    const rows=nativeCreativeRows263(game(mask));
    assert.equal(rows.length,14);
    assert.equal(rows.find(tab=>tab.label==='search').items.length,2000);
    assert.equal(rows.find(tab=>tab.label==='op').items.length,0);
    for(const name of ['white_banner','potion','enchanted_book','diamond_sword','white_wool','apple'])assert.ok(rows.find(tab=>tab.label==='search').items.some(stack=>stack.stack.itemId===byName.get(name)),name);
    assert.equal(nativeCreativeRows263(game(mask,true)).find(tab=>tab.label==='search').items.length,2034);
    assert.equal(nativeCreativeRows263(game(mask,true)).find(tab=>tab.label==='op').items.length,34);
  }
});

test('every native 26.3 Creative stack survives the real stack codec with its component patch',()=>{
  for(const entry of data.stacks){
    const stack=creativeStack263(entry);
    assert.equal(stack.count,entry.stack.count);
    assert.equal(stack.damage,0);
    const bytes=writeItemStack26_3(new Writer26_3(),stack).build();
    const reader=new Reader26_3(bytes),decoded=readItemStack26_3(reader);
    assert.equal(reader.remaining(),0);
    assert.equal(decoded.itemId,entry.stack.itemId);
    assert.deepEqual(decoded.added.map(component=>component.type),entry.stack.added.map(component=>component.type));
    assert.deepEqual(decoded.removed,entry.stack.removed);
    if(entry.patch){
      assert.equal(stack.creativePatch,entry.patch);
      assert.equal(stack.creativePatchItem,stack.id);
    }
  }
});

test('native 26.3 Creative templates are independent copies',()=>{
  const entry=data.stacks.find(candidate=>candidate.patch);
  const a=creativeStack263(entry),b=creativeStack263(entry);
  assert.notEqual(a,b);
  a.count=7;
  assert.equal(b.count,entry.stack.count);
});
