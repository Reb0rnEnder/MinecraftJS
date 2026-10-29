import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Reader754 as Reader,Writer754 as Writer,C754,decodePacket754} from '../client/js/net/protocol-1.16.5.js';
import {CLIENTBOUND_754 as IN,SERVERBOUND_754 as OUT} from '../client/js/net/protocol-1.16.5-ids.js';
import {PROTOCOL_VERSION} from '../client/js/net/packets.js';
import {decodeChunkData754} from '../client/js/world/chunk-1.16.5.js';
import {writeNbtRoot} from '../client/js/net/nbt.js';
const packet=name=>new Writer().varint(IN[name]);
const decode=w=>decodePacket754(w.build());
test('active identity and unique native packet IDs',()=>{
 assert.equal(PROTOCOL_VERSION,754);
 for(const [table,count]of[[IN,92],[OUT,48]]){assert.equal(Object.keys(table).length,count);assert.equal(new Set(Object.values(table)).size,count);}
 const blocks=JSON.parse(readFileSync(new URL('../client/data/blocks.json',import.meta.url)));
 assert.equal(blocks.length,763);assert.equal(Math.max(...blocks.map(b=>b.maxStateId)),17111);
});
test('recipe init/add/remove expose the game consumer fields and all book flags',()=>{
 for(const action of[0,1,2]){
  const w=packet('unlock_recipes').varint(action);for(let i=0;i<8;i++)w.bool(i%2===0);
  w.varint(1).string('minecraft:stone');if(action===0)w.varint(1).string('minecraft:stone');
  const p=decode(w);assert.deepEqual(p.recipes,['minecraft:stone']);assert.deepEqual(p.recipesToHighlight,action===0?['minecraft:stone']:[]);assert.equal(p.blastFurnaceOpen,true);assert.equal(p.filteringSmoker,false);
 }
});
test('equipment continues across the high bit and particle metadata uses native item ID',()=>{
 const p=decode(packet('entity_equipment').varint(42).u8(128).slot({id:975,count:1}).u8(5).slot(null));
 assert.equal(p.entityId,42);assert.equal(p.equipments.length,2);assert.equal(p.equipments[0].item.id,975);assert.equal(p.equipments[1].slot,5);assert.equal(p.equipments[1].item,null);
 const meta=decode(packet('entity_metadata').varint(42).u8(8).varint(15).varint(34).slot({id:975,count:1}).u8(255));
 assert.equal(meta.metadata[8].data.item.id,975);
});
test('section updates preserve signed coordinates and VarLong block state',()=>{
 const packed=(BigInt(-8)&0x3fffffn)<<42n|(BigInt(-12)&0x3fffffn)<<20n|(BigInt(-2)&0xfffffn);
 const p=decode(packet('multi_block_change').i64(BigInt.asIntN(64,packed)).bool(true).varint(1).varlong(17111n<<12n|0xabcn));
 assert.equal(p.chunkX,-8);assert.equal(p.chunkZ,-12);assert.equal(p.sectionY,-2);assert.deepEqual(p.records,[{state:17111,x:10,z:11,y:-20}]);
});
test('padded five-bit terrain palettes never straddle a long boundary',()=>{
 const w=new Writer().u16(4096).u8(5).varint(17);for(let i=0;i<17;i++)w.varint(i+1);
 const perLong=12,length=Math.ceil(4096/perLong);w.varint(length);
 for(let i=0;i<length;i++){let value=0n;for(let j=0;j<perLong&&i*perLong+j<4096;j++)value|=BigInt((i*perLong+j)%17)<<BigInt(j*5);w.i64(BigInt.asIntN(64,value));}
 const section=decodeChunkData754({bitMap:1,chunkData:w.build()}).sections[0];
 for(let i=0;i<4096;i++)assert.equal(section.blocks[i],i%17+1);assert.equal(section.nonAir,4096);
 const invalid=w.build();invalid[2]=6;assert.throws(()=>decodeChunkData754({bitMap:1,chunkData:invalid}),/length/);
});
test('dimension data and world identifiers survive respawn independently',()=>{
 const w=packet('respawn');writeNbtRoot(w,{t:10,name:'',v:{effects:{t:8,v:'minecraft:the_nether'},has_skylight:{t:1,v:0}}});
 const p=decode(w.string('custom:inferno').i64(99n).u8(0).i8(-1).bool(false).bool(false).bool(true));
 assert.equal(p.dimension,-1);assert.equal(p.worldName,'custom:inferno');assert.equal(p.dimensionData.has_skylight,0);assert.equal(p.copyMetadata,true);
});
test('outgoing abilities are one byte and interactions include sneaking',()=>{
 let r=new Reader(C754.abilities(255));assert.equal(r.varint(),OUT.abilities);assert.equal(r.u8(),2);assert.equal(r.remaining(),0);
 r=new Reader(C754.useEntity(42,2,.1,.2,.3,1,true));assert.equal(r.varint(),OUT.use_entity);assert.equal(r.varint(),42);assert.equal(r.varint(),2);r.f32();r.f32();r.f32();assert.equal(r.varint(),1);assert.equal(r.bool(),true);assert.equal(r.remaining(),0);
 r=new Reader(C754.recipeBookSettings(3,true,false));assert.equal(r.varint(),OUT.recipe_book);assert.equal(r.varint(),3);assert.equal(r.bool(),true);assert.equal(r.bool(),false);assert.equal(r.remaining(),0);
});

test('vanilla normalizes low palette headers and direct palette widths',()=>{
 for(const wireBits of [0,1,2,3,4,9,14,15,16]){
  const local=wireBits<=4,bits=local?4:15,w=new Writer().u16(4096).u8(wireBits);
  if(local)w.varint(1).varint(1);
  const perLong=Math.floor(64/bits),length=Math.ceil(4096/perLong);w.varint(length);
  for(let i=0;i<length;i++){let value=0n;if(!local)for(let j=0;j<perLong;j++)value|=1n<<BigInt(j*bits);w.i64(BigInt.asIntN(64,value));}
  const section=decodeChunkData754({bitMap:1,chunkData:w.build()}).sections[0];assert.equal(section.nonAir,4096);assert.ok(section.blocks.every(id=>id===1));
 }
});

test('fluid-heavy native sections accept occupancy counts above the cell count',()=>{
 const water=JSON.parse(readFileSync(new URL('../client/data/blocks.json',import.meta.url))).find(b=>b.name==='water').defaultState;
 const section=new Writer().u16(8192).u8(4).varint(1).varint(water).varint(256);for(let i=0;i<256;i++)section.i64(0n);
 const terrain=section.build(),w=packet('map_chunk').i32(-17).i32(29).bool(true).varint(1);
 writeNbtRoot(w,{t:10,name:'',v:{}});w.varint(1024);for(let i=0;i<1024;i++)w.varint(1);w.varint(terrain.length);for(const b of terrain)w.u8(b);w.varint(0);
 const decoded=decodeChunkData754(decode(w)).sections[0];assert.equal(decoded.wireNonAir,8192);assert.equal(decoded.nonAir,4096);assert.ok(decoded.blocks.every(state=>state===water));
});
