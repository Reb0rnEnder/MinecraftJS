// Loopback-only connection that refuses commands unless the isolated fixture's
// protocol/MOTD match. User servers and worlds are never selected by this tool.
import net from 'node:net';import {once} from 'node:events';import assert from 'node:assert/strict';
import {VanillaSocket} from '../../client/js/net/tcp.js';
import {setPlatform} from '../../client/js/platform/platform.js';
import {decodePacket762,C762} from '../../client/js/net/protocol-1.19.4.js';
import {C} from '../../client/js/net/packets.js';
setPlatform({now:()=>performance.now()});
class Direct extends VanillaSocket {
  constructor(){super({type:'test-direct'});}
  async _open(host,port,onPacket,onClose){const tcp=net.createConnection({host,port});tcp.setNoDelay(true);this.stream={write:b=>tcp.write(b),close:()=>tcp.destroy()};tcp.on('data',b=>{try{this.split.feed(new Uint8Array(b),onPacket);}catch(e){this._control({type:'error',message:e.message});this.close();}});tcp.on('close',()=>{onClose?.(null);this.close();});tcp.on('error',e=>{this._control({type:'error',message:e.message});this.close();});await once(tcp,'connect');}
}
export async function connectFixture(onPacket=()=>{}){
  const host='127.0.0.1',port=25567;
  const status=await new Promise((resolve,reject)=>{const s=new Direct(),timer=setTimeout(()=>{s.close();reject(Error('Fixture status timed out'));},5000);s.on('text',text=>{const m=JSON.parse(text);if(m.type==='ping_result'){clearTimeout(timer);s.close();m.status?resolve(m.status):reject(Error(m.error));}});s.sendText(JSON.stringify({type:'ping',host,port,protocol:762}));});
  assert.equal(status.version.protocol,762);assert.ok(JSON.stringify(status.description).includes('MCJS isolated presentation fixture'),'refuse commands on any other server');
  const socket=new Direct(),state={packets:[],joined:false,position:null,failure:null};
  const send=bytes=>socket.sendBinary(bytes);
  socket.on('text',text=>{const p=JSON.parse(text);if(['error','kicked'].includes(p.type))state.failure=Error(p.message||p.reason);});
  socket.on('binary',bytes=>{try{
    const p=decodePacket762(bytes);state.packets.push(p);if(state.packets.length>2048)state.packets.shift();
    if(p.name==='login')state.joined=true;
    if(p.name==='keep_alive')send(C762.keepAlive(p.keepAliveId));
    if(p.name==='position'){
      const before=state.position||{x:0,y:0,z:0,yaw:0,pitch:0};state.position={...p};
      for(const [field,flag]of [['x',1],['y',2],['z',4],['yaw',8],['pitch',16]])if(p.flags&flag)state.position[field]+=before[field];
      send(C762.teleportConfirm(p.teleportId));
      const a=state.position;send(C.positionLook(a.x,a.y,a.z,a.yaw,a.pitch,false));
    }
    if(p.name==='kick_disconnect')state.failure=Error(p.reason);onPacket(p,state);
  }catch(e){state.failure=e;}});
  const until=async predicate=>{const end=Date.now()+10000;while(!predicate()){if(state.failure)throw state.failure;if(Date.now()>end)throw Error('Fixture timed out: '+predicate);await new Promise(r=>setTimeout(r,20));}};
  socket.sendText(JSON.stringify({type:'connect',host,port,username:'PresentProbe',protocol:762}));
  try{await until(()=>state.joined&&state.position);}catch(e){socket.close();throw e;}
  return{...state,state,send,until,command:s=>send(C.chat(s)),close:()=>socket.close()};
}
