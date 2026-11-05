import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {Reader766,Writer766,C766,Configuration766,decodeLogin766,decodeConfiguration766,decodeBootstrapPlay766} from '../client/js/net/configuration-1.20.6.js';
import {readModifiedUtf,writeModifiedUtf,readAnonymousNbt} from '../client/js/net/nbt-anonymous.js';import {VanillaSocket766} from '../client/js/net/tcp-1.20.6.js';
import {CONFIGURATION_CLIENTBOUND_766 as IN,CONFIGURATION_SERVERBOUND_766 as OUT,LOGIN_CLIENTBOUND_766 as LI,PLAY_CLIENTBOUND_766 as PI} from '../client/js/net/protocol-1.20.6-ids.js';
const uuid='12345678-1234-4234-8234-123456789abc',packet=id=>new Writer766().varint(id),registry=()=>{const w=packet(IN.registry_data).string('minecraft:dimension_type').varint(1).string('minecraft:overworld').bool(true).u8(10);w.u8(3);writeModifiedUtf(w,'min_y');w.i32(-64).u8(3);writeModifiedUtf(w,'height');return w.i32(384).u8(0).build();};
test('phase IDs agree with the pinned schema, including cookies and known packs',()=>{
 const schema=JSON.parse(readFileSync(new URL('../cache/port-1.20.6/protocol-1.20.6.json',import.meta.url)));for(const [direction,ids] of [['toClient',IN],['toServer',OUT]]){const native=schema.configuration[direction].types.packet[1][0].type[1].mappings;assert.deepEqual(ids,Object.fromEntries(Object.entries(native).map(([id,name])=>[name,Number(id)])));}
});
test('modified UTF-8 matches Java DataOutputStream oracle for NUL and a surrogate-pair emoji',()=>{
 const bytes=Uint8Array.from(Buffer.from('000b41c080c3a9eda0bcedbcbf','hex'));assert.equal(readModifiedUtf(new Reader766(bytes)),'A\0é🌿');const w=new Writer766();writeModifiedUtf(w,'A\0é🌿');assert.deepEqual(w.build(),bytes);assert.throws(()=>readModifiedUtf(new Reader766(new Uint8Array([0,1,0xff]))),/UTF/);
});
test('anonymous NBT is typed, nameless and rejects malformed array/list lengths',()=>{
 const p=decodeConfiguration766(registry());assert.equal(p.entries[0].value.name,'');assert.equal(p.entries[0].value.v.min_y.v,-64);assert.equal(p.entries[0].value.v.height.v,384);
 assert.throws(()=>readAnonymousNbt(new Reader766(new Writer766().u8(9).u8(1).i32(-1).build())),/length/);
 assert.throws(()=>readAnonymousNbt(new Reader766(new Writer766().u8(7).i32(10).u8(1).build())),/length/);
 assert.throws(()=>decodeConfiguration766(new Writer766().varint(IN.custom_payload).varint(-1).build()),/length/);
});
test('login success, mandatory UUID and the new encryption flag preserve native fields',()=>{
 const p=decodeLogin766(packet(LI.success).uuid(uuid).string('Probe').varint(1).string('textures').string('payload').bool(false).bool(true).build());assert.equal(p.uuid,uuid);assert.equal(p.strictErrorHandling,true);assert.equal(p.properties[0].signature,null);
 const r=new Reader766(C766.loginStart('Probe',uuid));assert.equal(r.varint(),0);assert.equal(r.string(),'Probe');assert.equal(r.uuid(),uuid);assert.equal(r.remaining(),0);
 const e=decodeLogin766(packet(LI.encryption_begin).string('').varint(1).u8(1).varint(1).u8(2).bool(false).build());assert.equal(e.shouldAuthenticate,false);
});
test('configuration answers control packets, requests full registry data and atomically finishes',()=>{
 const sent=[],events=[],c=new Configuration766(p=>sent.push(p),p=>events.push(p));c.start();assert.equal(new Reader766(sent[0]).varint(),OUT.settings);
 c.handle(packet(IN.select_known_packs).varint(1).string('minecraft').string('core').string('1.20.6').build());const packs=new Reader766(sent.at(-1));assert.equal(packs.varint(),OUT.select_known_packs);assert.equal(packs.varint(),0);
 c.handle(registry());assert.equal(c.registries.get('minecraft:dimension_type')[0].id,0);
 c.handle(packet(IN.keep_alive).i64(123n).build());assert.deepEqual(sent.at(-1),C766.keepAlive(123n));c.handle(packet(IN.ping).i32(42).build());assert.deepEqual(sent.at(-1),C766.pong(42));
 c.handle(packet(IN.feature_flags).varint(1).string('minecraft:vanilla').build());c.handle(packet(IN.finish_configuration).build());assert.equal(c.complete,true);assert.deepEqual(c.features,['minecraft:vanilla']);assert.deepEqual(sent.at(-1),C766.finishConfiguration());assert.throws(()=>c.handle(registry()),/finished/);
});
test('unavailable registry payloads, duplicate keys and trailing packets fail explicitly',()=>{
 const c=new Configuration766(()=>{});assert.throws(()=>c.handle(packet(IN.registry_data).string('x').varint(1).string('y').bool(false).build()),/Omitted/);
 const w=packet(IN.registry_data).string('x').varint(2);for(let i=0;i<2;i++)w.string('y').bool(true).u8(10).u8(0);assert.throws(()=>c.handle(w.build()),/Duplicate/);
 assert.throws(()=>decodeConfiguration766(packet(IN.finish_configuration).u8(1).build()),/Trailing/);assert.throws(()=>decodeConfiguration766(new Uint8Array([127])) ,/Unknown/);
});
test('cookies retain bounded owned bytes and answer with the configuration cookie opcode',()=>{
 const sent=[],c=new Configuration766(p=>sent.push(p)),source=packet(IN.store_cookie).string('minecraft:test').varint(2).u8(1).u8(2).build();c.handle(source);source[source.length-1]=9;c.handle(packet(IN.cookie_request).string('minecraft:test').build());const r=new Reader766(sent.at(-1));assert.equal(r.varint(),OUT.cookie_response);assert.equal(r.string(),'minecraft:test');assert.equal(r.bool(),true);assert.equal(r.varint(),2);assert.deepEqual([...r.rest()],[1,2]);assert.throws(()=>C766.cookieResponse('x',new Uint8Array(5121)),/limit/);
});
test('transport login acknowledgement and later reconfiguration never leak configuration into play',()=>{
 const s=new VanillaSocket766({}),sent=[],play=[];s._send=p=>sent.push(p);s.state='login';s.on('binary',p=>play.push(p));
 s._packet(packet(LI.success).uuid(uuid).string('Probe').varint(0).bool(true).build());assert.equal(s.state,'configuration');assert.equal(new Reader766(sent[0]).varint(),3);s._packet(registry());s._packet(packet(IN.finish_configuration).build());assert.equal(s.state,'play');assert.equal(play.length,0);
 s._packet(packet(PI.start_configuration).build());assert.equal(s.state,'configuration');assert.equal(s.configurationGeneration,2);assert.equal(s.configuration.registries.size,0);assert.equal(play.length,0);s.close();
});
test('first-play layout includes numeric dimensions, limited crafting, death position and portal cooldown',()=>{
 const w=packet(PI.login).i32(42).bool(false).varint(1).string('minecraft:overworld').varint(5).varint(2).varint(2).bool(false).bool(true).bool(false).varint(0).string('minecraft:overworld').i64(1n).i8(0).u8(255).bool(false).bool(true).bool(true).string('minecraft:overworld').position(-5,-64,12).varint(0).bool(false);
 const p=decodeBootstrapPlay766(w.build());assert.equal(p.dimensionType,0);assert.equal(p.hashedSeed,1n);assert.deepEqual(p.death.position,{x:-5,y:-64,z:12});assert.equal(p.enforcesSecureChat,false);assert.throws(()=>new Reader766(new Uint8Array()).slot(),/not implemented/);assert.throws(()=>new Writer766().slot({}),/not implemented/);
});
