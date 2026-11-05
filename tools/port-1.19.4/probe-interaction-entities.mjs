// Mutating commands are restricted to run-presentation-fixture.mjs's own MOTD.
import net from 'node:net';
import {once} from 'node:events';
import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {VanillaSocket} from '../../client/js/net/tcp.js';
import {setPlatform} from '../../client/js/platform/platform.js';
import {decodePacket762,C762} from '../../client/js/net/protocol-1.19.4.js';
import {C} from '../../client/js/net/packets.js';
import {EntityManager} from '../../client/js/game/entities.js';
import {Interaction} from '../../client/js/game/interaction.js';
import {ENTITIES_BY_NAME} from '../../client/js/game/entity-types.js';
import {cache,target} from './prepare.mjs';
setPlatform({now:()=>performance.now()});
class Direct extends VanillaSocket {
  constructor(){super({type:'test-direct'});}
  async _open(host,port,onPacket,onClose){
    const tcp=net.createConnection({host,port});tcp.setNoDelay(true);
    this.stream={write:b=>tcp.write(b),close:()=>tcp.destroy()};
    tcp.on('data',b=>{try{this.split.feed(new Uint8Array(b),onPacket);}catch(e){this._control({type:'error',message:e.message});this.close();}});
    tcp.on('close',()=>{onClose?.(null);this.close();});
    tcp.on('error',e=>{this._control({type:'error',message:e.message});this.close();});
    await once(tcp,'connect');
  }
}
const host='127.0.0.1',port=25567;
const status=await new Promise((resolve,reject)=>{
  const socket=new Direct(),timer=setTimeout(()=>{socket.close();reject(Error('Fixture status timed out'));},5000);
  socket.on('text',text=>{const m=JSON.parse(text);if(m.type==='ping_result'){clearTimeout(timer);socket.close();m.status?resolve(m.status):reject(Error(m.error));}});
  socket.sendText(JSON.stringify({type:'ping',host,port,protocol:762}));
});
assert.equal(status.version.protocol,762);
assert.ok(JSON.stringify(status.description).includes('MCJS isolated presentation fixture'),'refuse commands on any other server');
const socket=new Direct(),swings=[],messages=[];
let failure,joined=false,position,interactionEntity;
const g={gameMode:1,entityId:42,player:{sneaking:false},entityRenderer:{remove(){}},
  world:{raycast:()=>null},inventory:{getHand:()=>null},send:p=>socket.sendBinary(p),
  eyePosition:()=>[.5,70.5,.5],lookVector:()=>[0,0,1]};
g.entities=new EntityManager(g);g.interaction=new Interaction(g);g.interaction.swing=hand=>swings.push(hand);
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const until=async predicate=>{const end=Date.now()+10000;while(!predicate()){if(failure)throw failure;if(Date.now()>end)throw Error('Interaction gate timed out: '+predicate);await pause(20);}};
socket.on('text',text=>{const p=JSON.parse(text);if(p.type==='error'||p.type==='kicked')failure=Error(p.message||p.reason);});
socket.on('binary',bytes=>{try{
  const p=decodePacket762(bytes);
  if(p.name==='login'){joined=true;g.entityId=p.entityId;}
  if(p.name==='keep_alive')g.send(C762.keepAlive(p.keepAliveId));
  if(p.name==='position'){position=p;g.send(C762.teleportConfirm(p.teleportId));g.send(C.positionLook(p.x,p.y,p.z,p.yaw,p.pitch,false));}
  if(p.name==='spawn_entity'&&p.type===ENTITIES_BY_NAME.interaction.id){g.entities.spawnObject(p);interactionEntity=g.entities.get(p.entityId);}
  if(p.name==='entity_metadata')g.entities.setMetadata(p.entityId,p.metadata);
  if(p.name==='system_chat')messages.push(p.content);
  if(p.name==='kick_disconnect')failure=Error(p.reason);
}catch(e){failure=e;}});
socket.sendText(JSON.stringify({type:'connect',host,port,username:'PresentProbe',protocol:762}));
try {
  await until(()=>joined&&position);
  const command=s=>g.send(C.chat(s));
  command('/gamemode creative');command('/tp @s 0.5 70 0.5');
  command('/kill @e[type=interaction,tag=mcjs_parity_interaction]');
  command('/summon interaction 0.5 70 2 {Tags:["mcjs_parity_interaction"],width:2.5f,height:3.5f,response:0b}');
  await until(()=>position.y===70&&interactionEntity?.width===2.5&&interactionEntity?.height===3.5);
  assert.equal(interactionEntity.pickable,true);assert.equal(interactionEntity.pickRadius,0);
  g.interaction.updateTarget();assert.equal(g.interaction.target?.entity,interactionEntity);
  g.interaction.rightClickMouse();assert.deepEqual(swings,[]);
  command('/execute as @e[tag=mcjs_parity_interaction,limit=1] if data entity @s interaction run tellraw PresentProbe {"text":"MCJS_INTERACTION_RECORDED"}');
  await until(()=>messages.some(s=>s.includes('MCJS_INTERACTION_RECORDED')));
  command('/data merge entity @e[tag=mcjs_parity_interaction,limit=1] {response:1b,width:0.75f}');
  await until(()=>interactionEntity.response===true&&interactionEntity.width===.75);
  g.interaction.updateTarget();g.interaction.rightClickMouse();assert.deepEqual(swings,[0]);
  const report={version:'1.19.4',serverJarSha1:target.downloads.server.sha1,
    receivedDimensions:[2.5,3.5],updatedDimensions:[interactionEntity.width,interactionEntity.height],
    serverRecordedInteraction:true,swingsForFalseResponse:0,swingsForTrueResponse:1,
    limitations:'Native server metadata and action acceptance; client response follows decompiled bfs. No Java-client pixel comparison.'};
  await mkdir(join(cache,'audit'),{recursive:true});
  await writeFile(join(cache,'audit/interaction-server.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
} finally {socket.close();}
