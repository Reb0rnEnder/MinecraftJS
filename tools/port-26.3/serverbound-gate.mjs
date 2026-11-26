// Byte-level gate for the 26.3 serverbound packets. Each expected hex string is derived field
// by field from the javap'd 26.3 codec, so a wrong field order, width or enum encoding fails
// here instead of being rejected by the live server.
import assert from 'node:assert/strict';
import {C} from '../../client/js/net/packets.js';
import {PLAY_SERVERBOUND_26_3 as OUT} from '../../client/js/net/protocol-26.3-ids.js';
import {Reader,Writer} from '../../client/js/net/buffer.js';
import {Reader26_3} from '../../client/js/net/configuration-26.3.js';
import {writeLpVec3,readLpVec3} from '../../client/js/net/lp-vec3-26.3.js';

const hex=packet=>Buffer.from(packet).toString('hex');
const id=name=>OUT[name].toString(16).padStart(2,'0');

// 1. Attack is entity id only; interact is hand + LP location + secondary flag, and the client
// sends zero location for a plain interact.
assert.equal(hex(C.useEntity(5,1,0,0,0)),id('attack')+'05','attack packet');
assert.equal(hex(C.useEntity(5,0,0,0,0,0,false)),id('interact')+'05'+'00'+'00'+'00','interact packet');
{
  const r=new Reader26_3(C.useEntity(5,2,1,2,3,1,true));
  assert.equal(r.varint(),OUT.interact,'interact-at packet id');
  assert.equal(r.varint(),5,'entity id');
  assert.equal(r.varint(),1,'hand');
  const location=readLpVec3(r);
  assert.ok(Math.abs(location.x-1)<0.01&&Math.abs(location.y-2)<0.01&&Math.abs(location.z-3)<0.01,'interact-at location');
  assert.equal(r.bool(),true,'secondary action');
  assert.equal(r.remaining(),0,'interact-at is fully consumed');
}

// 2. Container close uses the VarInt container id.
assert.equal(hex(C.closeWindow(5)),id('container_close')+'05','container close');

// 3. Container click: ids, short slot, byte button, VarInt input, then HashedStack pairs.
// A plain 64x stone stack has an empty HashedPatchMap (two zero counts); an empty cursor is
// the false boolean.
assert.equal(hex(C.closeWindow(300)),id('container_close')+'ac02','container id is a VarInt');
assert.equal(
  hex(C.windowClick(0,36,0,7,0,[{slot:36,item:{id:1,count:64}}],null)),
  id('container_click')+'00'+'07'+'0024'+'00'+'00'+'01'+'0024'+'01'+'01'+'40'+'00'+'00'+'00',
  'container click with one changed slot and an empty cursor'
);
// The carried stack is the last field and uses the same HashedStack shape.
assert.equal(
  hex(C.windowClick(0,36,0,7,0,[],{id:2,count:1})),
  id('container_click')+'00'+'07'+'0024'+'00'+'00'+'00'+'01'+'02'+'01'+'00'+'00',
  'container click with a carried stack'
);
// A patched stack cannot be hashed yet and must fail instead of sending a wrong hash.
assert.throws(()=>C.windowClick(0,36,0,7,0,[{slot:36,item:{id:1,count:1,componentPatch:{added:[{type:3}],removed:[]}}}],null),/component hashes/);

// 4. Creative slot: short slot then the 26.3 optional stack.
assert.equal(hex(C.creativeSlot(36,{id:1,count:1})),id('set_creative_mode_slot')+'0024'+'01'+'01'+'00'+'00','creative slot');
assert.equal(hex(C.creativeSlot(36,null)),id('set_creative_mode_slot')+'0024'+'00','creative slot clears with a zero count');

// 5. Block place appends insideBlock and worldBorderHit before the sequence.
{
  const bytes=C.blockPlace(1,64,-2,1,0,0.5,0.25,0.75,true,9);
  const r=new Reader26_3(bytes);
  assert.equal(r.varint(),OUT.use_item_on,'packet id');
  assert.equal(r.varint(),0,'hand');
  assert.deepEqual(r.position(),{x:1,y:64,z:-2},'block position');
  assert.equal(r.varint(),1,'direction');
  assert.equal(r.f32(),0.5);
  assert.equal(r.f32(),0.25);
  assert.equal(r.f32(),0.75);
  assert.equal(r.bool(),true,'insideBlock');
  assert.equal(r.bool(),false,'worldBorderHit');
  assert.equal(r.varint(),9,'sequence');
  assert.equal(r.remaining(),0,'block place is fully consumed');
}

// 6. Block dig writes the Direction 3D value as one byte, then the sequence.
{
  const r=new Reader26_3(C.blockDig(0,1,64,-2,5,3));
  assert.equal(r.varint(),OUT.player_action,'player action id');
  assert.equal(r.varint(),0,'action');
  assert.deepEqual(r.position(),{x:1,y:64,z:-2},'action position');
  assert.equal(r.u8(),5,'direction is one byte');
  assert.equal(r.varint(),3,'sequence');
  assert.equal(r.remaining(),0,'player action is fully consumed');
}

// 7. Punch is a unit packet.
assert.equal(hex(C.armAnimation(1)),id('punch'),'punch has no body');

// 8. LpVec3 round-trips within its own quantisation step.
for(const vector of [{x:0,y:0,z:0},{x:1.5,y:-2,z:0.25},{x:-0.01,y:0.02,z:99.5}]){
  const bytes=new Writer();
  writeLpVec3(bytes,vector);
  const back=readLpVec3(new Reader(bytes.build()));
  const max=Math.max(Math.abs(vector.x),Math.abs(vector.y),Math.abs(vector.z));
  const encodedScale=max===0?0:Math.max(4,Math.ceil(max/4)*4);
  const step=encodedScale/32766;
  for(const axis of ['x','y','z']){
    const error=Math.abs(back[axis]-vector[axis]);
    assert.ok(error<=step+1e-9,'LP '+axis+' error '+error+' exceeds half the quantisation step '+step);
  }
}

console.log(JSON.stringify({
  ids:{attack:OUT.attack,interact:OUT.interact,container_click:OUT.container_click,set_creative_mode_slot:OUT.set_creative_mode_slot,player_action:OUT.player_action,use_item_on:OUT.use_item_on,punch:OUT.punch},
  lpVec3:'round-trips within quantum'
},null,2));
console.log('26.3 serverbound packet bodies match the javap layouts');
