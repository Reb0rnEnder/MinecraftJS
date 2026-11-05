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
const socket=new Direct(),windows=[],messages=[];let joined=false,position,failure;
const g={gameMode:0,player:{},entityRenderer:{remove(){}},send:p=>socket.sendBinary(p),tutorial:{openInventory(){throw Error('must request the vehicle inventory');}},screens:{open(){throw Error('must wait for the native server');}}};g.entities=new EntityManager(g);
const pause=ms=>new Promise(r=>setTimeout(r,ms)),until=async predicate=>{const deadline=Date.now()+10000;while(!predicate()){if(failure)throw failure;if(Date.now()>deadline)throw Error('Chest boat fixture timed out: '+predicate);await pause(20);}};
socket.on('text',text=>{const p=JSON.parse(text);if(p.type==='error'||p.type==='kicked')failure=Error(p.message||p.reason);});
socket.on('binary',bytes=>{try{const p=decodePacket762(bytes);
 if(p.name==='login'){joined=true;g.entityId=p.entityId;socket.sendBinary(C762.settings('en_us',2));}
 if(p.name==='keep_alive')socket.sendBinary(C762.keepAlive(p.keepAliveId));
 if(p.name==='position'){position=p;socket.sendBinary(C762.teleportConfirm(p.teleportId));socket.sendBinary(C.positionLook(p.x,p.y,p.z,p.yaw,p.pitch,false));}
 if(p.name==='spawn_entity'&&p.type===ENTITIES_BY_NAME.chest_boat.id)g.entities.spawnObject(p);
 if(p.name==='set_passengers'&&p.passengers.includes(g.entityId)){g.ridingEntityId=p.entityId;g.player.ridingEntity=g.entities.get(p.entityId);}
 if(p.name==='open_window')windows.push(p);
 if(p.name==='system_chat')messages.push(p.content);
 if(p.name==='kick_disconnect')failure=Error(p.reason);
 }catch(e){failure=e;}});
socket.sendText(JSON.stringify({type:'connect',host,port,username:'PresentProbe',protocol:762}));
try {
 await until(()=>joined&&position);const command=text=>g.send(C.chat(text));
 command('/gamemode creative');command('/kill @e[type=minecraft:chest_boat]');command('/summon minecraft:chest_boat 0.5 65 0.5');command('/tp @s 0.5 66.5 0.5');
 await until(()=>g.entities.count()>0&&position.y===66.5);const boat=[...g.entities.all()].at(-1);
 g.send(C.useEntity(boat.id,0,0,0,0,0,true));await until(()=>windows.length===1);assert.equal(windows[0].inventoryType,2);g.send(C.closeWindow(windows[0].windowId));
 g.send(C.useEntity(boat.id,0,0,0,0,0,false));await until(()=>g.player.ridingEntity?.chestBoat);Game.prototype.openInventory.call(g);await until(()=>windows.length===2);assert.equal(windows[1].inventoryType,2);
 console.log(JSON.stringify({protocol:762,secondaryUse:'native three-row chest',inventoryKey:'native three-row chest',windows:windows.map(w=>({id:w.windowId,type:w.inventoryType})),limitations:'This validates inventory protocol behavior, not the server-side floating-boat collision bug.'},null,2));
 g.send(C.closeWindow(windows[1].windowId));
} finally {socket.close();}
