import assert from 'node:assert/strict';import {test} from 'node:test';import {readFileSync} from 'node:fs';
import mcassets from '../lib/mcassets.js';import {ZipFile} from '../lib/zip.js';import {extractModels,assertCompleteModels} from '../lib/modelextract.js';
import {PROTOCOL_VERSION,C,decodePacket} from '../client/js/net/packets.js';import {Reader498,Writer498} from '../client/js/net/protocol-1.14.4.js';
import {setJarModels,playerModel} from '../client/js/render/entity-models.js';import {ENTITY_TYPES,OBJECT_TYPES} from '../client/js/game/entity-types.js';import {EntityManager} from '../client/js/game/entities.js';
const data=n=>JSON.parse(readFileSync(new URL('../client/data/'+n+'.json',import.meta.url)));
test('active browser version, wire codec, native tables and creative toolbar identities agree',()=>{
 assert.equal(mcassets.MC_VERSION,'1.14.4');assert.equal(PROTOCOL_VERSION,498);assert.equal(data('blocks').length,676);assert.equal(data('items').length,876);assert.equal(data('creative').protocol,498);
 assert.equal(data('blockCollisionShapes').selection.states.length,11271);assert.equal(data('blockCollisionShapes').selection.source.clientJarSha1,'8c325a0c5bd674dd747d6ebaa4c791fd363ad8a9');
 const items=new Set(data('items').map(i=>i.id));for(const tab of data('creative').tabs)for(const [id] of tab.items)assert.ok(items.has(id));
 for(const e of data('entities'))assert.equal(ENTITY_TYPES[e.id].name,e.name);
 assert.equal(OBJECT_TYPES[data('entities').find(e=>e.name==='arrow').id].kind,'arrow');
});
test('active outbound IDs and all position-bearing encoders use native 498 layout',()=>{
 assert.equal(new Reader498(C.settings('en_us',6,0,true,127,1)).varint(),5);assert.equal(new Reader498(C.keepAlive(1n)).varint(),15);
 const dig=new Reader498(C.blockDig(0,1,2,3,1));assert.equal(dig.varint(),0x1a);dig.varint();assert.deepEqual(dig.position(),{x:1,y:2,z:3});
 const sign=new Reader498(C.updateSign(1,2,3,['A','B','C','D']));assert.equal(sign.varint(),0x29);assert.deepEqual(sign.position(),{x:1,y:2,z:3});assert.equal(sign.string(),'A');
 const book=new Reader498(C.recipeInfoSettings(true,false));assert.equal(book.varint(),0x1d);assert.equal(book.varint(),1);assert.equal(book.remaining(),8);
 const login=new Writer498().varint(0x25).i32(1).u8(0).i32(0).u8(20).string('default').varint(10).bool(false);assert.equal(decodePacket(login.build()).viewDistance,10);
});
test('native player constructor extraction includes sleeves, pants and jacket and animates both arm widths',async()=>{
 const models=assertCompleteModels(extractModels(new ZipFile(await mcassets.locateJar())));assert.equal(models.player.fields.length,14);assert.equal(models.playerSlim.fields.length,14);setJarModels(models);
 for(const slim of [false,true]){const m=playerModel(slim);m.animate(m,{});assert.ok(m.parts.leftArmwear);assert.ok(m.parts.bodywear);assert.ok(Number.isFinite(m.parts.rightArm.rx));}
});
test('native base pose and living metadata insertions do not interpret hand flags as health',()=>{
 const manager=new EntityManager({entityRenderer:{remove(){}}}),e={kind:'mob',entityName:'cow',health:20,metadata:{6:0,7:0,8:10,9:123,10:false,11:2,12:null}};
 manager._applyMeta(e);assert.equal(e.pose,0);assert.equal(e.health,10);assert.equal(e.potionColor,123);assert.equal(e.arrowCount,2);assert.equal(e.dead,undefined);
});
