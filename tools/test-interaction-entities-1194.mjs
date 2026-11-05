import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EntityManager} from '../client/js/game/entities.js';
import {Interaction} from '../client/js/game/interaction.js';
import {ENTITIES_BY_NAME} from '../client/js/game/entity-types.js';
import {C} from '../client/js/net/packets.js';
import {decodePacket762,Writer762} from '../client/js/net/protocol-1.19.4.js';
import {CLIENTBOUND_762 as IN} from '../client/js/net/protocol-1.19.4-ids.js';

// Native 1.19.4 Interaction (bfs): defaults 1f/1f/false, accessors 8/9/10,
// inherited Entity pick radius 0, and SUCCESS vs CONSUME on the client.
function fixture() {
  const sent=[], swings=[];
  const game={gameMode:1,entityId:42,player:{sneaking:false},
    entityRenderer:{remove(){}},world:{raycast:()=>null},
    inventory:{getHand:()=>({id:1,count:1})},send:p=>sent.push(p),
    eyePosition:()=>[0,64.5,0],lookVector:()=>[0,0,1]};
  game.entities=new EntityManager(game);
  game.entities.spawnObject({entityId:7,type:ENTITIES_BY_NAME.interaction.id,
    objectUUID:'00000000-0000-0000-0000-000000000007',x:0,y:64,z:2,
    yaw:0,pitch:0,objectData:0,velocity:{x:0,y:0,z:0}});
  const interaction=new Interaction(game);
  interaction.swing=hand=>swings.push(hand);
  interaction.sendUseItem=()=>{throw Error('Interaction must consume the action before held-item use');};
  return {game,interaction,entity:game.entities.get(7),sent,swings};
}
function metadata(manager,width,height,response) {
  const w=new Writer762().varint(IN.entity_metadata).varint(7);
  if(width!==undefined)w.u8(8).varint(3).f32(width);
  if(height!==undefined)w.u8(9).varint(3).f32(height);
  if(response!==undefined)w.u8(10).varint(8).bool(response);
  const p=decodePacket762(w.u8(255).build());
  manager.setMetadata(p.entityId,p.metadata);
}

test('interaction spawn overrides the zero registration size and can be targeted without metadata',()=>{
  const {entity,interaction}=fixture();
  assert.deepEqual([entity.width,entity.height,entity.pickable,entity.noPhysics,entity.response],[1,1,true,true,false]);
  assert.equal(entity.pickRadius,0);
  assert.equal(entity.eyeHeight,Math.fround(.85));
  interaction.updateTarget();
  assert.equal(interaction.target.entity,entity);
  assert.deepEqual(interaction.target.hit,[0,64.5,1.5]);
});

test('wire metadata changes interaction dimensions, eye height and targeting; unrelated deltas retain them',()=>{
  const {entity,game,interaction}=fixture();
  game.eyePosition=()=>[1.2,66,0];
  interaction.updateTarget();assert.equal(interaction.target,null);
  metadata(game.entities,2.5,3.5,true);
  assert.deepEqual([entity.width,entity.height,entity.response],[2.5,3.5,true]);
  assert.equal(entity.eyeHeight,Math.fround(3.5*Math.fround(.85)));
  interaction.updateTarget();assert.equal(interaction.target.entity,entity);
  game.eyePosition=()=>[1.26,66,0];
  interaction.updateTarget();assert.equal(interaction.target,null,'native pick radius does not inflate the custom bounds');
  game.entities.setMetadata(7,{0:0});
  assert.deepEqual([entity.width,entity.height,entity.response],[2.5,3.5,true]);
  metadata(game.entities,undefined,.5,false);
  assert.deepEqual([entity.width,entity.height,entity.response],[2.5,.5,false]);
});

for(const response of [false,true])test(`interaction response=${response} consumes main-hand use with native swing behavior`,()=>{
  const {game,entity,interaction,sent,swings}=fixture();
  metadata(game.entities,undefined,undefined,response);
  interaction.updateTarget();interaction.rightClickMouse();
  assert.deepEqual(sent,[C.useEntity(entity.id,2,0,.5,-.5,0,false),C.useEntity(entity.id,0,0,0,0,0,false)]);
  assert.deepEqual(swings,response?[0]:[]);
});

test('spectator interaction does not synthesize a successful entity action',()=>{
  const {game,interaction,sent,swings}=fixture();
  game.gameMode=3;game.inventory.getHand=()=>null;
  metadata(game.entities,undefined,undefined,true);
  interaction.updateTarget();interaction.rightClickMouse();
  assert.equal(sent.length,4,'neither hand reports success in spectator mode');
  assert.deepEqual(swings,[]);
});
