// Decodes every captured native 26.3 Play frame with the client's own codec and requires
// each decoded packet to consume its frame exactly. Undecoded packets are reported, not ignored.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {Reader} from '../../client/js/net/buffer.js';
import {decodePlayPacket} from '../../client/js/net/play-codec-26.3.js';
import {root} from './prepare.mjs';

const fixture=JSON.parse(await readFile(join(root,'tools/port-26.3/fixtures/play-26.3.json'),'utf8'));
assert.ok(fixture.frames.length>=10,'Play fixture must hold the full native startup burst');

const decoded=[],undecoded=[];
for(const frame of fixture.frames){
  const reader=new Reader(Buffer.from(frame.hex,'hex'));
  const result=decodePlayPacket(reader);
  assert.equal(result.id,frame.id,'fixture frame id must match its payload');
  if(result.decoded){
    const leftover=reader.remaining();
    assert.equal(leftover,0,result.name+' must consume its frame exactly, '+leftover+' bytes left');
    decoded.push({name:result.name,...result.data});
  }else{
    undecoded.push({id:frame.id,name:result.name,bytes:frame.hex.length/2-1});
  }
}

const by=list=>Object.fromEntries(list.map(x=>[x.name,x]));
const packets=by(decoded);

assert.deepEqual(packets.change_difficulty,{name:'change_difficulty',difficulty:1,locked:false},'difficulty 1 (easy), unlocked');
const abilities=packets.player_abilities;
assert.equal(abilities.name,'player_abilities');
assert.deepEqual([abilities.invulnerable,abilities.flying,abilities.canFly,abilities.instabuild],[false,false,false,false],'default survival ability flags');
assert.ok(Math.abs(abilities.flyingSpeed-0.05)<1e-6,'flying speed is 0.05');
assert.ok(Math.abs(abilities.walkingSpeed-0.1)<1e-6,'walking speed is 0.1');
assert.equal(packets.set_held_slot.slot,0,'held slot starts at 0');
assert.ok(packets.entity_event.entityId>0,'entity event targets a real entity');
assert.ok(packets.entity_event.eventId>=0&&packets.entity_event.eventId<64,'entity event id is a byte');
assert.equal(packets.server_data.motd.t,8,'server data motd is a string NBT root');
assert.match(packets.server_data.motd.v,/MinecraftJS/,'motd carries the probe server description');
assert.equal(packets.server_data.hasIcon,false,'probe server has no icon');
assert.equal(packets.player_info_update.count,0,'startup player info update has no entries');
assert.equal(packets.player_info_update.actions.length,8,'all eight player info actions are flagged');
assert.equal(packets.player_position.teleportId,1,'first teleport id');
assert.ok(Math.abs(packets.player_position.position.y-72)<16,'spawn height is plausible');
assert.deepEqual(packets.player_position.relatives,[],'absolute teleport has no relative flags');
assert.deepEqual(packets.recipe_book_settings,{
  name:'recipe_book_settings',
  crafting:{open:false,filtering:false},furnace:{open:false,filtering:false},
  blastFurnace:{open:false,filtering:false},smoker:{open:false,filtering:false}
},'recipe book starts closed and unfiltered');

assert.equal(packets.commands.root,0,'command tree root is node 0');
assert.equal(packets.commands.nodes.length,26,'native command tree has 26 nodes');
assert.ok(packets.commands.nodes.some(n=>n.name==='help'&&n.executable),'help is an executable literal');
assert.ok(packets.commands.nodes.some(n=>n.parser==='minecraft:int_range'),'int_range parser resolved from the native registry id');
assert.equal(decoded.length+undecoded.length,fixture.frames.length,'every frame is accounted for');
assert.equal(decoded.length,9,'nine packets decode natively');

console.log(JSON.stringify({decodedCount:decoded.length,undecoded,position:packets.player_position,commandNodes:packets.commands.nodes.length},null,2));
console.log('Native 26.3 Play codec: '+decoded.length+' packets decoded exactly, '+undecoded.length+' still raw ('+undecoded.map(u=>u.name).join(', ')+')');
