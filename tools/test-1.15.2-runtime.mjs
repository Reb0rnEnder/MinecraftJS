import test from 'node:test';
import assert from 'node:assert/strict';
import {C578,Writer578,decodePacket578} from '../client/js/net/protocol-1.15.2.js';
import {EntityManager,nativeEntityDefinition} from '../client/js/game/entities.js';
import {ENTITIES_BY_NAME} from '../client/js/game/entity-types.js';
import {bee} from '../client/js/render/entity-models.js';
import {FOOD_NAMES} from '../client/js/game/items.js';
import {honeyFallMultiplier,honeyMovementFactor} from '../client/js/game/physics.js';
import {ModelStore} from '../client/js/render/models.js';

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
  assert.equal(ENTITIES_BY_NAME.zombie.id,95);
  assert.equal(ENTITIES_BY_NAME.zombie_horse.id,96);
});
test('1.15.2 bee registry entries are treated as living mobs',()=>{
  const game={assets:{data:{entities:[{id:4,name:'bee',width:.7,height:.6,type:'UNKNOWN'}]}}};
  const bee=nativeEntityDefinition(game,4);assert.equal(bee.name,'bee');assert.equal(bee.mob,true);
});
test('bee metadata keeps native nectar, stinger and anger fields',()=>{
  const manager=new EntityManager({});
  const entity=manager._base(1,0,0,0); entity.kind='mob'; entity.entityName='bee';
  manager._applyMeta(entity,{13:3,14:40});
  assert.equal(entity.hasNectar,true);assert.equal(entity.hasStung,true);assert.equal(entity.angry,true);assert.equal(entity.angerTime,40);
});
test('bee renderer has body, wings and a removable stinger',()=>{
  const model=bee();assert.equal(model.roots.length,5);assert.ok(model.parts.leftWing);assert.equal(model.parts.stinger.visible,true);
  model.animate(model,{age:4,hasStung:true});assert.equal(model.parts.stinger.visible,false);
});
test('1.15.2 honey bottle is food and honey blocks use vanilla movement fall factors',()=>{
  assert.equal(FOOD_NAMES.has('honey_bottle'),true);
  assert.equal(honeyFallMultiplier('honey_block'),0.2);
  assert.equal(honeyMovementFactor('honey_block'),0.4);
  assert.equal(honeyFallMultiplier('stone'),1);
});
test('1.15.2 item model gui_light is inherited and exposed to icon rendering',()=>{
  const store=new ModelStore({'item/generated':{gui_light:'front'},'item/test':{parent:'item/generated'}},{},{uv:()=>null});
  assert.equal(store.resolveModel('item/test').guiLight,'front');
});
