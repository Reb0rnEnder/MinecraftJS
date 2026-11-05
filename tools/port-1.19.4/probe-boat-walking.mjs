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
import {readFile} from 'node:fs/promises';
import {World} from '../../client/js/world/world.js';import {LocalPlayer} from '../../client/js/game/physics.js';import {initBlocks} from '../../client/js/world/blocks.js';import {simplify} from '../../client/js/net/nbt.js';import {registryEntries} from '../../client/js/net/registry-codec.js';
initBlocks(JSON.parse(await readFile(new URL('../../client/data/blocks.json',import.meta.url))),JSON.parse(await readFile(new URL('../../client/data/blockCollisionShapes.json',import.meta.url))));
const socket=new Direct(),world=new World(),corrections=[],messages=[];let joined=false,position,failure;
const g={world,player:new LocalPlayer(),sound:{play(){}},particles:{},entityRenderer:{remove(){}},renderer:{sections:new Map(),invalidateVisibility(){},removeSection(){},removeChunk(){}},tileRenderer:{scanChunk(){},removeChunk(){},shulkerCollision(){},onBlockChanged(){}},pistons:{collision(){},onBlockChanged(){}},dirty:new Set(),meshedChunks:new Set(),inFlight:new Map(),buildTokens:new Map(),playerAffectedSections:new Set(),send:p=>socket.sendBinary(p)};
g.entities=new EntityManager(g);g.entities.updateSelf=()=>{};g._markSectionDirty=Game.prototype._markSectionDirty;Game.prototype._setupWorldListeners.call(g);
const pause=ms=>new Promise(r=>setTimeout(r,ms)),until=async predicate=>{const deadline=Date.now()+12000;while(!predicate()){if(failure)throw failure;if(Date.now()>deadline)throw Error('Walking fixture timeout: '+predicate);await pause(20);}};
socket.on('text',text=>{const p=JSON.parse(text);if(p.type==='error'||p.type==='kicked')failure=Error(p.message||p.reason);});
socket.on('binary',bytes=>{try{const p=decodePacket762(bytes);
 if(p.name==='login'){joined=true;g.entityId=p.entityId;world.setDimension(p.dimension,p.dimensionData);world.biomeRegistrySize=Math.max(...registryEntries(simplify(p.dimensionCodec),'minecraft:worldgen/biome').map(e=>e.id))+1;socket.sendBinary(C762.settings('en_us',2));}
 if(p.name==='update_health'&&p.health<=0)g.send(C.clientCommand(0));
 if(p.name==='keep_alive')socket.sendBinary(C762.keepAlive(p.keepAliveId));
 if(p.name==='position'){position=p;corrections.push(p);g.player.setPosition(p.x,p.y,p.z);g.player.motionX=g.player.motionY=g.player.motionZ=0;socket.sendBinary(C762.teleportConfirm(p.teleportId));socket.sendBinary(C.positionLook(p.x,p.y,p.z,-90,0,false));}
 if(p.name==='map_chunk')world.loadChunk762(p);if(p.name==='update_light')world.updateLight758(p);
 if(p.name==='block_change')world.setState(p.location.x,p.location.y,p.location.z,p.state);
 if(p.name==='multi_block_change'){world.beginBatch();for(const r of p.records)world.setState(p.chunkX*16+r.x,r.y,p.chunkZ*16+r.z,r.state);world.endBatch();}
 if(p.name==='spawn_entity'&&[ENTITIES_BY_NAME.chest_boat.id,ENTITIES_BY_NAME.boat.id].includes(p.type))g.entities.spawnObject(p);
 if(p.name==='rel_entity_move')g.entities.relMove(p,true,false);if(p.name==='entity_move_look')g.entities.relMove(p,true,true);if(p.name==='entity_look')g.entities.look(p);if(p.name==='entity_teleport')g.entities.teleport(p);
 if(p.name==='entity_destroy')for(const id of p.entityIds)g.entities.map.delete(id);
 if(p.name==='system_chat')messages.push(p.content);if(p.name==='kick_disconnect')failure=Error(p.reason);
 }catch(e){failure=e;}});
socket.sendText(JSON.stringify({type:'connect',host,port,username:'PresentProbe',protocol:762}));
try{
 await until(()=>joined&&position);g.send(C.clientCommand(0));await pause(500);const command=text=>g.send(C.chat(text));command('/gamemode survival');command('/effect give @s minecraft:resistance 99999 4 true');command('/fill -4 60 -4 4 60 4 minecraft:stone');command('/fill -4 61 -4 4 64 4 minecraft:water');command('/kill @e[type=minecraft:chest_boat]');command('/summon minecraft:chest_boat 0.5 65 0.5');command('/tp @s 0.5 68 0.5');await until(()=>g.entities.count()>0&&world.getChunk(0,0));
 const results=[];
 for(const initialPose of ['standing','swimming']){
  command('/tp @s 0.5 68 0.5');command('/kill @e[type=minecraft:chest_boat]');command('/summon minecraft:chest_boat 0.5 65 0.5');
  await pause(200);await until(()=>[...g.entities.all()].some(e=>e.chestBoat));
  const boat=[...g.entities.all()].find(e=>e.chestBoat);g.player=new LocalPlayer();g.player.yaw=-90;g.player.pose=initialPose;g.player.width=.6;g.player.height=initialPose==='swimming'?.6:1.8;
  for(let i=0;i<40;i++){g.entities.tick();await pause(50);}
  position=null;command('/tp @s '+boat.x+' '+(boat.y+boat.height-.002)+' '+boat.z);await until(()=>position);await pause(100);
  const before=corrections.length,samples=[];let direction=1;
  for(let i=0;i<160;i++){
   if(failure)throw failure;
   const p=g.player;if(p.x>boat.x+.25)direction=-1;else if(p.x<boat.x-.25)direction=1;

   p.tick(world,{forward:direction===1,back:direction===-1});g.send(C.positionLook(p.x,p.y,p.z,p.yaw,p.pitch,p.onGround));
   g.entities.tick();samples.push({x:p.x,y:p.y,pose:p.pose,onGround:p.onGround,boatTop:boat.y+boat.height});await pause(50);
  }
  results.push({initialPose,corrections:corrections.length-before,slowTicks:samples.filter(s=>s.pose!=='standing').length,xRange:[Math.min(...samples.map(s=>s.x)),Math.max(...samples.map(s=>s.x))],samples});
 }
 console.log(JSON.stringify({protocol:762,scenario:'Survival; native boat bobbing; initial feet overlap 0.002 blocks; resistance prevents fixture fall damage',results},null,2));
}finally{socket.close();}
