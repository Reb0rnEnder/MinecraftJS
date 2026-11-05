// A native offline transport gate, not a graphical gameplay test.
import net from 'node:net';
import {once} from 'node:events';
import assert from 'node:assert/strict';
import {VanillaSocket766} from '../../client/js/net/tcp-1.20.6.js';
import {C766} from '../../client/js/net/configuration-1.20.6.js';
import {setPlatform} from '../../client/js/platform/platform.js';
setPlatform({now:()=>performance.now()});
class Direct extends VanillaSocket766 {
 constructor(){super({type:'test-direct'},{distance:2});}
 async _open(host,port,onPacket,onClose){
  const tcp=net.createConnection({host,port});tcp.setNoDelay(true);
  this.stream={write:b=>tcp.write(b),close:()=>tcp.destroy()};
  tcp.on('data',b=>{try{this.split.feed(new Uint8Array(b),onPacket);}catch(e){this._control({type:'error',message:e.stack});this.close();}});
  tcp.on('close',()=>{onClose?.(null);this.close();});
  tcp.on('error',e=>{this._control({type:'error',message:e.message});this.close();});await once(tcp,'connect');
 }
}
const host='127.0.0.1',port=25568;
const status=await new Promise((resolve,reject)=>{
 const s=new Direct(),timer=setTimeout(()=>{s.close();reject(Error('Fixture status timed out'));},5000);
 s.on('text',text=>{const m=JSON.parse(text);if(m.type==='ping_result'){clearTimeout(timer);s.close();m.status?resolve(m.status):reject(Error(m.error));}});
 s.sendText(JSON.stringify({type:'ping',host,port,protocol:766}));
});
assert.equal(status.version.protocol,766);assert.equal(status.version.name,'1.20.6');
assert.ok(JSON.stringify(status.description).includes('MCJS isolated 1.20.6 protocol fixture'),'Refuse any other server');
const socket=new Direct(),packets={},configPackets={};let failure,configuration,join,position,keepalives=0,batches=0,chunks=0;
socket.on('text',text=>{const p=JSON.parse(text);if(p.type==='error'||p.type==='kicked')failure=Error(p.message||p.reason);});
socket.on('configuration',p=>configPackets[p.name]=(configPackets[p.name]||0)+1);
socket.on('configuration_complete',c=>configuration=c);
socket.on('bootstrap_play',p=>{
 packets[p.name]=(packets[p.name]||0)+1;
 if(p.name==='login')join=p;
 if(p.name==='position'){
  position=p;assert.equal(p.flags,0,'Initial fixture teleport must be absolute');
  socket.sendBinary(C766.teleportConfirm(p.teleportId));socket.sendBinary(C766.positionLook(p.x,p.y,p.z,p.yaw,p.pitch,false));
 }
 if(p.name==='keep_alive'){keepalives++;socket.sendBinary(C766.playKeepAlive(p.keepAliveId));}
 if(p.name==='chunk_batch_finished'){batches++;socket.sendBinary(C766.chunkBatchReceived(20));}
 if(p.name==='map_chunk')chunks++;
 if(p.name==='kick_disconnect')failure=Error(JSON.stringify(p.reason));
});
socket.sendText(JSON.stringify({type:'connect',host,port,username:'ProtocolProbe',protocol:766}));
try{
 const deadline=Date.now()+35000;
 while(!(configuration&&join&&position&&keepalives&&chunks&&batches)){
  if(failure)throw failure;if(socket.closed)throw Error('Native connection closed');
  if(Date.now()>deadline)throw Error('Native gate timeout '+JSON.stringify({configPackets,packets}));
  await new Promise(r=>setTimeout(r,20));
 }
 const dimensions=configuration.registries.get('minecraft:dimension_type'),biomes=configuration.registries.get('minecraft:worldgen/biome');
 assert.ok(dimensions?.length);assert.ok(biomes?.length);assert.ok(dimensions[join.dimensionType]?.value);
 assert.ok(configuration.features.includes('minecraft:vanilla'));assert.equal(socket.configurationGeneration,1);
 console.log(JSON.stringify({protocol:766,version:status.version.name,compressionThreshold:socket.split.threshold,profile:socket.profile.username,configuration:configPackets,registries:Object.fromEntries([...configuration.registries].map(([k,v])=>[k,v.length])),features:configuration.features,join:{world:join.worldName,dimensionType:dimensions[join.dimensionType].key},teleportConfirmed:position.teleportId,keepalivesAnswered:keepalives,chunkBatchesAcknowledged:batches,rawChunksReceived:chunks,limitations:'Offline transport only. Chunk payloads are counted, not decoded/rendered. Item components, encrypted login and graphical runtime integration remain pending.'},null,2));
}finally{socket.close();}
