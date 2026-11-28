import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Reader26_3,Writer26_3} from '../client/js/net/configuration-26.3.js';
import {readItemStack26_3,writeItemStack26_3,writeHashedStack26_3} from '../client/js/net/item-components-26.3.js';
import {C} from '../client/js/net/packets.js';
import {nativeCreativeRows263,creativeStack263} from '../client/js/gui/creative-data-26.3.js';
import {creativeRows} from '../client/js/gui/screens/containers.js';
import {Inventory,stackable} from '../client/js/game/container.js';

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

test('component patches stack semantically without their transport bytes', () => {
  const a={id:1,count:1,componentPatch:{added:[{type:3,name:'damage',value:1,componentWire:new Uint8Array([1])}],removed:[]}};
  const b={id:1,count:1,componentPatch:{added:[{type:3,name:'damage',value:1}],removed:[]}};
  const c={id:1,count:1,componentPatch:{added:[{type:3,name:'damage',value:2,componentWire:new Uint8Array([2])}],removed:[]}};
  assert.equal(stackable(a,b),true);
  assert.equal(stackable(a,c),false);
});

test('26.3 inventory offhand swaps, drag distribution and pickup-all are native', () => {
  const items={maxStack:item=>item.maxStackSize??64,name:()=>'stone'};
  const game={items,player:{},heldSlot:0,gameMode:0};
  const inv=new Inventory(game);
  game.inventory=inv;
  const stone=count=>({id:1,count});

  inv.main[0]=stone(1);
  inv.offhand=stone(5);
  inv.slotClick(36,40,2);
  assert.equal(inv.offhand.count,1);
  assert.equal(inv.main[0].count,5);
  inv.slotClick(36,40,2);
  assert.equal(inv.offhand.count,5);
  assert.equal(inv.main[0].count,1);

  inv.offhand=stone(5);
  inv.main[2]=stone(1);
  inv.slotClick(45,2,2);
  assert.equal(inv.offhand.count,1);
  assert.equal(inv.main[2].count,5);

  inv.main.fill(null);
  inv.cursor=stone(10);
  inv.slotClick(36,0,5);
  inv.slotClick(36,1,5);
  inv.slotClick(37,1,5);
  inv.slotClick(-999,2,5);
  assert.equal(inv.main[0].count,5);
  assert.equal(inv.main[1].count,5);
  assert.equal(inv.cursor,null);

  inv.main.fill(null);
  inv.offhand=null;
  inv.armor.fill(null);
  inv.craft.fill(null);
  inv.craftResult=null;
  inv.cursor=stone(1);
  inv.main[0]=stone(5);
  inv.main[1]=stone(2);
  inv.slotClick(38,0,6);
  assert.equal(inv.cursor.count,8);
  assert.equal(inv.main[0],null);
  assert.equal(inv.main[1],null);

  for(let index=9;index<36;index++)inv.main[index]=stone(64);
  inv.main[0]=stone(2);
  inv.slotClick(36,0,1);
  assert.equal(inv.main[0].count,2);
  inv.main[20]=null;
  inv.slotClick(36,0,1);
  assert.equal(inv.main[0],null);
  assert.equal(inv.main[20].count,2);
});

test('native enchantment map hashes match every Creative catalogue fixture', () => {
  let checked=0;
  for(const entry of data.stacks){
    if(!entry.patch||!entry.hashes)continue;
    const wire=new Writer26_3();
    wire.varint(entry.stack.count).varint(entry.stack.itemId).raw(Buffer.from(entry.patch,'base64'));
    const decoded=readItemStack26_3(new Reader26_3(wire.build()));
    for(const component of decoded.added){
      if(component.name!=='enchantments'&&component.name!=='stored_enchantments')continue;
      const stack={id:entry.stack.itemId,count:1,componentPatch:{added:[component],removed:[]}};
      const reader=new Reader26_3(writeHashedStack26_3(new Writer26_3(),stack).build());
      assert.equal(reader.bool(),true);
      assert.equal(reader.varint(),entry.stack.itemId);
      assert.equal(reader.varint(),1);
      assert.equal(reader.varint(),1);
      assert.equal(reader.varint(),component.type);
      assert.equal(reader.i32(),entry.hashes.added.find(([type])=>type===component.type)[1]);
      assert.equal(reader.varint(),0);
      assert.equal(reader.remaining(),0);
      checked++;
    }
  }
  assert.ok(checked>100);

  // A server-provided map works without the Creative hash table.
  const stack={id:1,count:1,componentPatch:{added:[{type:45,name:'stored_enchantments',value:[{enchantment:0,id:'minecraft:aqua_affinity',level:1}]}],removed:[]}};
  const reader=new Reader26_3(writeHashedStack26_3(new Writer26_3(),stack).build());
  assert.equal(reader.bool(),true);
  assert.equal(reader.varint(),1);
  assert.equal(reader.varint(),1);
  assert.equal(reader.varint(),1);
  assert.equal(reader.varint(),45);
  assert.equal(reader.i32(),1317401286);
  assert.equal(reader.varint(),0);
  assert.equal(reader.remaining(),0);
});
