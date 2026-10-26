import test from 'node:test';
import assert from 'node:assert/strict';
import {C578,Writer578,decodePacket578} from '../client/js/net/protocol-1.15.2.js';
import {nativeEntityDefinition} from '../client/js/game/entities.js';

const uuid=Buffer.from('00112233445566778899aabbccddeeff','hex');
const login=new Writer578().varint(38).i32(7).u8(0).i32(0).i64(0n).u8(20).string('default').varint(8).bool(false).bool(true).build();
const particle=new Writer578().varint(36).i32(0).bool(false).f64(1.25).f64(64.5).f64(-2.75).f32(0).f32(0).f32(0).f32(0).i32(1).build();
const living=new Writer578().varint(3).varint(11).raw(uuid).varint(4).f64(1).f64(2).f64(3).i8(0).i8(0).i8(0).i16(0).i16(0).i16(0).build();

test('1.15.2 login adds the hashed seed and respawn-screen flag',()=>{
  const p=decodePacket578(login);assert.equal(p.name,'login');assert.equal(p.entityId,7);assert.equal(p.hashedSeed,0n);assert.equal(p.enableRespawnScreen,true);
});
test('1.15.2 particles preserve double coordinates',()=>{
  const p=decodePacket578(particle);assert.equal(p.name,'world_particles');assert.equal(p.x,1.25);assert.equal(p.y,64.5);assert.equal(p.z,-2.75);
});
test('1.15.2 spawn packets initialize metadata separately',()=>{
  const p=decodePacket578(living);assert.equal(p.name,'spawn_entity_living');assert.deepEqual(p.metadata,{});assert.equal(p.entityUUID,'00112233-4455-6677-8899-aabbccddeeff');
});
test('serverbound packet IDs use the protocol-578 table',()=>{
  const bytes=C578.blockDig(0,1,2,3,1);assert.equal(bytes[0],26);const settings=C578.settings('en_us',8,0,true,127,1);assert.equal(settings[0],5);
});
test('1.15.2 entity IDs resolve zombie and zombie horse independently',()=>{
  const game={assets:{data:{entities:[{id:95,name:'zombie',width:.6,height:1.95,type:'mob'},{id:96,name:'zombie_horse',width:1.39648,height:1.6,type:'mob'}]}}};
  assert.equal(nativeEntityDefinition(game,95).name,'zombie');
  assert.equal(nativeEntityDefinition(game,96).name,'zombie_horse');
});
