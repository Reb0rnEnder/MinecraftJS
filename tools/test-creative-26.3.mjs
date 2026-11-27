import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Reader26_3,Writer26_3} from '../client/js/net/configuration-26.3.js';
import {readItemStack26_3,writeItemStack26_3,writeHashedStack26_3} from '../client/js/net/item-components-26.3.js';
import {C} from '../client/js/net/packets.js';
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
      assert.deepEqual(stack.creativeHashes,entry.hashes);
      assert.equal(stack.creativeHashesItem,stack.id);
      const hashed=Buffer.from(writeHashedStack26_3(new Writer26_3(),stack).build()).toString('base64');
      assert.equal(hashed,entry.hashedWire);
    }
  }
});

test('native 26.3 Creative templates are independent copies', () => {
  const entry=data.stacks.find(candidate=>candidate.patch);
  const a=creativeStack263(entry),b=creativeStack263(entry);
  assert.notEqual(a,b);
  a.count=7;
  assert.equal(b.count,entry.stack.count);
});

test('server-decoded component patches keep their exact native bytes', () => {
  const entry=data.stacks.find(candidate=>candidate.patch&&candidate.stack.added.length);
  const wire=new Writer26_3();
  wire.varint(entry.stack.count).varint(entry.stack.itemId).raw(Buffer.from(entry.patch,'base64'));
  const raw=Buffer.from(wire.build());
  const decoded=readItemStack26_3(new Reader26_3(raw));
  assert.ok(decoded.added.every(component=>component.componentWire instanceof Uint8Array));
  const round=Buffer.from(writeItemStack26_3(new Writer26_3(),decoded).build());
  assert.equal(round.toString('hex'),raw.toString('hex'));

  // No canonical hash generator is guessed: the HashedPatchMap is empty, so the server's
  // RemoteSlot comparison schedules a correction instead of rejecting the click.
  const hashed=writeHashedStack26_3(new Writer26_3(),decoded).build();
  const reader=new Reader26_3(hashed);
  assert.equal(reader.bool(),true);
  assert.equal(reader.varint(),entry.stack.itemId);
  assert.equal(reader.varint(),entry.stack.count);
  assert.equal(reader.varint(),0);
  assert.equal(reader.varint(),0);
  assert.equal(reader.remaining(),0);

  // The normal container-click sender must use the captured patch bytes, not the old Creative
  // shortcut, and must not throw when the hash is unknown.
  const click=new Reader26_3(C.windowClick(0,36,0,7,0,[{slot:36,item:decoded}],null));
  assert.equal(click.varint(),18);
  assert.equal(click.varint(),0);
  assert.equal(click.varint(),7);
  assert.equal(click.i16(),36);
  assert.equal(click.i8(),0);
  assert.equal(click.varint(),0);
  assert.equal(click.varint(),1);
  assert.equal(click.i16(),36);
  assert.equal(click.bool(),true);
  assert.equal(click.varint(),entry.stack.itemId);
  assert.equal(click.varint(),entry.stack.count);
  assert.equal(click.varint(),0);
  assert.equal(click.varint(),0);
  assert.equal(click.bool(),false);
  assert.equal(click.remaining(),0);
});

test('a locally changed damage value replaces only its captured component row', () => {
  const stack={id:1,count:1,damage:5,componentPatch:{added:[{type:3,name:'damage',componentWire:new Uint8Array([0])}],removed:[]}};
  const decoded=readItemStack26_3(new Reader26_3(writeItemStack26_3(new Writer26_3(),stack).build()));
  assert.equal(decoded.components.damage,5);
  assert.equal(decoded.added[0].type,3);
});

test('unknown added hashes keep removal ids in the HashedPatchMap', () => {
  const stack={id:1,count:1,componentPatch:{added:[{type:3,name:'damage',componentWire:new Uint8Array([0])}],removed:[12]}};
  const reader=new Reader26_3(writeHashedStack26_3(new Writer26_3(),stack).build());
  assert.equal(reader.bool(),true);
  assert.equal(reader.varint(),1);
  assert.equal(reader.varint(),1);
  assert.equal(reader.varint(),0);
  assert.equal(reader.varint(),1);
  assert.equal(reader.varint(),12);
  assert.equal(reader.remaining(),0);
});

test('native integer component hashes match Mojang HashOps.CRC32C values', () => {
  const hashOf=(type,value,stackValue=value)=>{
    const stack={id:1,count:1,damage:stackValue,componentPatch:{added:[{type,name:type===3?'damage':'max_stack_size',value,componentWire:new Uint8Array([0])}],removed:[]}};
    const reader=new Reader26_3(writeHashedStack26_3(new Writer26_3(),stack).build());
    assert.equal(reader.bool(),true);
    assert.equal(reader.varint(),1);
    assert.equal(reader.varint(),1);
    assert.equal(reader.varint(),1);
    assert.equal(reader.varint(),type);
    return reader.i32();
  };
  assert.equal(hashOf(3,1),1565579036);
  assert.equal(hashOf(3,5),645064431);
  assert.equal(hashOf(3,128),-759843685);
  assert.equal(hashOf(1,16),1769065625);
  // A predicted damage change must replace the stale decoded damage hash.
  assert.equal(hashOf(3,1,5),645064431);
});
