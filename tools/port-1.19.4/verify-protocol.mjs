import {VanillaSocket} from '../../client/js/net/tcp.js';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Writer762,Reader762,decodePacket762,C762,resolveDimension762} from '../../client/js/net/protocol-1.19.4.js';
import {CLIENTBOUND_762 as IN,SERVERBOUND_762 as OUT,CLIENTBOUND_INHERITED_762 as INHERITED} from '../../client/js/net/protocol-1.19.4-ids.js';
import {decodeChunkData762,AIR_STATES_762,BLOCK_STATE_COUNT_762} from '../../client/js/world/chunk-1.19.4.js';
import {nbt,writeNbtRoot,TAG} from '../../client/js/net/nbt.js';
import {compatible} from './protocol-compatibility.mjs';
const packet=name=>new Writer762().varint(IN[name]),decode=w=>decodePacket762(w.build());
const dimension=nbt.compound({name:nbt.string('minecraft:overworld'),id:nbt.int(0),element:nbt.compound({min_y:nbt.int(-64),height:nbt.int(384),effects:nbt.string('minecraft:overworld')})});
const registry=nbt.compound({'minecraft:dimension_type':nbt.compound({value:nbt.list(TAG.COMPOUND,[dimension.v])})});
const login=packet('login').i32(5).bool(false).u8(1).i8(-1).varint(1).string('minecraft:overworld');writeNbtRoot(login,registry);login.string('minecraft:overworld').string('minecraft:overworld').i64(0n).varint(20).varint(10).varint(10).bool(false).bool(true).bool(false).bool(false).bool(true).string('minecraft:the_nether').position(1,2,3);
let p=decode(login);assert.equal(p.dimensionData.min_y,-64);assert.equal(p.dimensionData.height,384);assert.equal(p.previousGameMode,-1);assert.equal(p.death.location.y,2);assert.throws(()=>resolveDimension762(registry,'missing'),/dimension/);
const alias=nbt.compound({dimension_type:registry.v['minecraft:dimension_type']});assert.equal(resolveDimension762(alias,'minecraft:overworld').height,384);
for(let flags=0;flags<4;flags++){p=decode(packet('respawn').string('minecraft:overworld').string('minecraft:overworld').i64(0n).u8(1).i8(-1).bool(false).bool(false).u8(flags).bool(false));assert.equal(p.dataToKeep,flags);assert.equal(p.keepAttributes,!!(flags&1));assert.equal(p.copyMetadata,!!(flags&2));assert.equal(p.previousGameMode,-1);}
p=decode(packet('position').f64(1).f64(64).f64(3).f32(90).f32(0).i8(0).varint(12));assert.equal(p.teleportId,12);assert.equal('dismountVehicle'in p,false);
assert.throws(()=>decode(packet('position').f64(1).f64(2).f64(3).f32(0).f32(0).i8(0).varint(1).bool(false)),/Trailing/);
p=decode(packet('system_chat').string('{"text":"hello"}').bool(true));assert.equal(p.isActionBar,true);
p=decode(packet('server_data').string('{}').bool(true).varint(3).raw(new Uint8Array([1,2,3])).bool(true));assert.equal(p.iconBytes.length,3);assert.equal(p.enforcesSecureChat,true);
p=decode(packet('spawn_entity').varint(100).uuid('00000000-0000-0000-0000-000000000001').varint(119).f64(1).f64(2).f64(3).i8(-64).i8(64).i8(32).varint(12345).i16(800).i16(-800).i16(0));assert.equal(p.objectData,12345);assert.equal(p.pitch,-90);assert.equal(p.headPitch,45);
for(const[name,bytes]of[['keep_alive',C762.keepAlive(123n)],['teleport_confirm',C762.teleportConfirm(77)]])assert.equal(new Reader762(bytes).varint(),OUT[name]);
assert.equal(C762.chat,undefined,'old chat is not exposed as signed chat');assert.throws(()=>C762.blockDig(0,1,2,3,1),/Unported/,'digging requires the new sequence field');assert.ok(!INHERITED.includes('entity_metadata'));
const before=JSON.parse(await readFile(new URL('../../cache/port-1.19.4/protocol-1.18.2.json',import.meta.url))),after=JSON.parse(await readFile(new URL('../../cache/port-1.19.4/protocol-1.19.4.json',import.meta.url)));
assert.ok(compatible(before,after,'play','toClient','window_items'));const changed=structuredClone(after);changed.types.slot=['container',[{name:'changed',type:'bool'}]];assert.equal(compatible(before,changed,'play','toClient','window_items'),false,'nested slot changes block inheritance');
const blocks=JSON.parse(await readFile(new URL('../../cache/port-1.19.4/generated/reports/blocks.json',import.meta.url)));assert.equal(Object.values(blocks).reduce((n,b)=>n+b.states.length,0),BLOCK_STATE_COUNT_762);assert.deepEqual(AIR_STATES_762,['air','void_air','cave_air'].flatMap(name=>blocks['minecraft:'+name].states.map(s=>s.id)));
const data=new Writer762();for(let y=0;y<24;y++)data.u16(y===23?4096:0).u8(0).varint(y===23?23724:AIR_STATES_762[y%3]).varint(0).u8(0).varint(y%64).varint(0);
assert.throws(()=>decodeChunkData762({chunkData:data.build()}),/biome registry/);
const chunk=decodeChunkData762({x:0,z:0,chunkData:data.build()},{biomeCount:64});assert.equal(chunk.sections[0].nonAir,0);assert.equal(chunk.sections[23].blocks[0],23724);assert.equal(chunk.biomes[1535],23);assert.throws(()=>decodeChunkData762({chunkData:data.build()},{stateCount:20342,biomeCount:64}),/single palette/);
for(const protocol of [758,762]){
 const sent=[],socket=Object.assign(Object.create(VanillaSocket.prototype),{_open:async()=>{},_control(){},_send:bytes=>sent.push(bytes)});
 await socket._connect({protocol,host:'127.0.0.1',port:25567,username:'CodexProbe'});
 const hello=new Reader762(sent[1]);assert.equal(hello.varint(),0);assert.equal(hello.string(),'CodexProbe');if(protocol===762)assert.equal(hello.bool(),false);assert.equal(hello.remaining(),0,'login hello respects protocol boundary');
}
console.log('762 fixtures passed: join/registry, respawn flag byte, position, entity spawn, server data, controls, inheritance boundaries and native terrain registry.');
