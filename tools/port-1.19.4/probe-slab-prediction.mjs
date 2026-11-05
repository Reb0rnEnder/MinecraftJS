// Run only against run-presentation-fixture.mjs's disposable server.
// The MOTD gate below refuses commands on any other server.
import net from 'node:net';import {once} from 'node:events';import assert from 'node:assert/strict';
import {VanillaSocket} from '../../client/js/net/tcp.js';import {setPlatform} from '../../client/js/platform/platform.js';
import {decodePacket762,C762} from '../../client/js/net/protocol-1.19.4.js';import {C} from '../../client/js/net/packets.js';
import {Game} from '../../client/js/game/game.js';import {EntityManager} from '../../client/js/game/entities.js';import {ENTITIES_BY_NAME} from '../../client/js/game/entity-types.js';
setPlatform({now:()=>performance.now()});
class Direct extends VanillaSocket {
 constructor(){super({type:'test-direct'});}
 async _open(host,port,onPacket,onClose){const tcp=net.createConnection({host,port});tcp.setNoDelay(true);this.stream={write:b=>tcp.write(b),close:()=>tcp.destroy()};tcp.on('data',b=>{try{this.split.feed(new Uint8Array(b),onPacket);}catch(e){this._control({type:'error',message:e.message});this.close();}});tcp.on('close',()=>{onClose?.(null);this.close();});tcp.on('error',e=>{this._control({type:'error',message:e.message});this.close();});await once(tcp,'connect');}
}
const host='127.0.0.1',port=25567;
const status=await new Promise((resolve,reject)=>{const s=new Direct(),timer=setTimeout(()=>{s.close();reject(Error('Fixture status timed out'));},5000);s.on('text',text=>{const m=JSON.parse(text);if(m.type==='ping_result'){clearTimeout(timer);s.close();m.status?resolve(m.status):reject(Error(m.error));}});s.sendText(JSON.stringify({type:'ping',host,port,protocol:762}));});
assert.equal(status.version.protocol,762);assert.ok(JSON.stringify(status.description).includes('MCJS isolated presentation fixture'),'refuse commands on any other server');
import {readFileSync} from 'node:fs';
import {Interaction} from '../../client/js/game/interaction.js';
import {Items} from '../../client/js/game/items.js';
import {LocalPlayer} from '../../client/js/game/physics.js';
import {initBlocks,findState,getStateProperties} from '../../client/js/world/blocks.js';
import {BlockPrediction762} from '../../client/js/game/block-prediction-1.19.4.js';
const read=n=>JSON.parse(readFileSync(new URL('../../client/data/'+n+'.json',import.meta.url)));
const data=Object.fromEntries(['blocks','blockCollisionShapes','items','creative','enchantments'].map(n=>[n,read(n)]));initBlocks(data.blocks,data.blockCollisionShapes);
const cells=new Map(),updates=[],socket=new Direct(),player=new LocalPlayer(),items=new Items({data,translate:k=>k});
const held={id:items.byName.get('oak_slab').id,count:64,damage:0},sounds=[];
let joined=false,position,failure,lastAck=0;
const world={minY:-64,maxY:320,getState:(x,y,z)=>cells.get([x,y,z].join(','))||0,setState(x,y,z,s){const old=this.getState(x,y,z);this.prediction?.record(x,y,z,old);cells.set([x,y,z].join(','),s);},getCollisions:()=>[],beginBatch(){},endBatch(){}};
const g={items,world,player,gameMode:1,dimension:0,entities:{all:()=>[]},inventory:{getHand:()=>held,held:()=>held,offhand:null,main:[held]},sound:{playBlockPlace:(...a)=>sounds.push(a)},send:p=>socket.sendBinary(p)};
g.blockPrediction=world.prediction=new BlockPrediction762(g);g.interaction=new Interaction(g);
const pause=ms=>new Promise(r=>setTimeout(r,ms)),until=async predicate=>{const end=Date.now()+10000;while(!predicate()){if(failure)throw failure;if(Date.now()>end)throw Error('Slab gate timed out: '+predicate);await pause(20);}};
socket.on('text',text=>{const p=JSON.parse(text);if(p.type==='error'||p.type==='kicked')failure=Error(p.message||p.reason);});
socket.on('binary',bytes=>{try{const p=decodePacket762(bytes);
 if(p.name==='login')joined=true;
 if(p.name==='keep_alive')g.send(C762.keepAlive(p.keepAliveId));
 if(p.name==='position'){position=p;player.setPosition(p.x,p.y,p.z);g.send(C762.teleportConfirm(p.teleportId));g.send(C.positionLook(p.x,p.y,p.z,p.yaw,p.pitch,false));}
 const update=(pos,state)=>{updates.push({pos,state});if(!g.blockPrediction.serverUpdate(pos,state))world.setState(pos.x,pos.y,pos.z,state);};
 if(p.name==='block_change')update(p.location,p.state);
 if(p.name==='multi_block_change')for(const r of p.records)update({x:p.chunkX*16+r.x,y:r.y,z:p.chunkZ*16+r.z},r.state);
 if(p.name==='acknowledge_player_digging'){lastAck=p.sequenceId;g.interaction.acknowledgeDigging(p);}
 if(p.name==='kick_disconnect')failure=Error(p.reason);
 }catch(e){failure=e;}});
socket.sendText(JSON.stringify({type:'connect',host,port,username:'PresentProbe',protocol:762}));
try{
 await until(()=>joined&&position);g.send(C.clientCommand(0));await pause(300);
 const command=s=>g.send(C.chat(s));command('/gamemode creative');command('/fill -1 69 -1 5 73 1 air');command('/setblock 2 69 0 stone');command('/setblock 4 69 0 stone');command('/setblock 4 70 0 water');command('/item replace entity @s weapon.mainhand with oak_slab 64');command('/tp @s 0.5 70 0.5');
 await until(()=>position.y===70&&world.getState(2,69,0)===findState('stone')&&world.getState(4,70,0)===findState('water'));await pause(200);
 const results=[];
 for(const [x,y,face,hitY,destination]of[[2,69,1,70,[2,70,0]],[2,70,1,70.5,[2,70,0]],[2,70,5,70.8,[3,70,0]],[4,69,1,70,[4,70,0]]]){
  const t={type:'block',x,y,z:0,face,hit:[face===5?x+1:x+.5,hitY,.5]},count=updates.length;
  assert.equal(g.interaction._canPlaceBlockOnSide(t,held),true);
  g.blockPrediction.run(()=>assert.equal(g.interaction.onPlayerRightClick(t),true));
  const predicted=world.getState(...destination),sequence=g.blockPrediction.next;
  assert.notEqual(predicted,0,'Slab must exist locally before network response');
  await until(()=>lastAck>=sequence);
  assert.equal(world.getState(...destination),predicted,'Native server must accept exact predicted state');
  assert.ok(updates.slice(count).some(u=>u.pos.x===destination[0]&&u.pos.y===destination[1]&&u.pos.z===destination[2]&&u.state===predicted));
  results.push({destination,properties:getStateProperties(predicted),sequence});
 }
 assert.equal(sounds.length,4);console.log(JSON.stringify({protocol:762,results,localPlacementSounds:sounds.length,limitations:'Native network/state gate; no graphical screenshot comparison claimed.'},null,2));
}finally{socket.close();}
