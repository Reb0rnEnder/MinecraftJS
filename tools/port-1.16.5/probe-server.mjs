// Opt-in local integration probe: real TCP, existing Minecraft framing/compression/login,
// native-754 packet codec. Uses its own connection and does not alter the UI.
import net from 'node:net';
import {once} from 'node:events';
import {writeFile,mkdir} from 'node:fs/promises';
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {VanillaSocket} from '../../client/js/net/tcp.js';
import {setPlatform} from '../../client/js/platform/platform.js';
import {decodePacket754,C754,PROTOCOL_754} from '../../client/js/net/protocol-1.16.5.js';
import {cache} from './prepare.mjs';
import {decodeChunkData754} from '../../client/js/world/chunk-1.16.5.js';
const options=Object.fromEntries(process.argv.slice(2).map(a=>{const [key,...v]=a.replace(/^--/,'').split('=');return [key,v.join('=')];}));
const host=options.host||'127.0.0.1',port=Number(options.port||25565),duration=Number(options.duration||25000);
assert.ok(Number.isInteger(port)&&port>0&&port<65536);assert.ok(Number.isFinite(duration)&&duration>=1000&&duration<=60000);
setPlatform({now:()=>performance.now()});
class DirectProbeSocket extends VanillaSocket {
  constructor(){super({type:'test-direct'});}
  async _open(host,port,onPacket,onClose){
    const tcp=net.createConnection({host,port});tcp.setNoDelay(true);
    this.stream={write:b=>tcp.write(b),close:()=>tcp.destroy()};
    tcp.on('data',b=>{try{this.split.feed(new Uint8Array(b),onPacket);}catch(e){this._control({type:'error',message:e.message});this.close();}});
    tcp.on('close',()=>{if(onClose)onClose(null);this.close();});
    // Keep an error listener after connecting, too; late TCP errors are control failures.
    tcp.on('error',e=>{this._control({type:'error',message:e.message});this.close();});
    await once(tcp,'connect');
  }
}
async function status(){
  const sock=new DirectProbeSocket();
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{sock.close();reject(new Error('Status timed out'));},5000);
    sock.on('text',text=>{const m=JSON.parse(text);if(m.type==='ping_result'){clearTimeout(timer);sock.close();m.status?resolve(m.status):reject(new Error(m.error));}});
    sock.sendText(JSON.stringify({type:'ping',host,port,protocol:PROTOCOL_754}));
  });
}
await mkdir(cache,{recursive:true});
const server=await status();assert.equal(server.version.protocol,754);console.log(`Status: ${server.version.name}, protocol ${server.version.protocol}`);
function captureFailedChunk(packet){writeFileSync(join(cache,'failed-chunk.json'),JSON.stringify({...packet,chunkData:Buffer.from(packet.chunkData).toString('base64')},(_,v)=>typeof v==='bigint'?v.toString():v));}
const report={protocol:754,serverVersion:server.version.name,compressionThreshold:null,loginSuccess:false,packets:{},unsupported:{},teleportsConfirmed:0,keepAlivesAnswered:0,sectionsDecoded:0};
await new Promise((resolve,reject)=>{
  const sock=new DirectProbeSocket();let finished=false;
  const finish=error=>{if(finished)return;finished=true;clearTimeout(timer);sock.close();error?reject(error):resolve();};
  const timer=setTimeout(()=>{
    try{
      assert.ok(report.loginSuccess,'login success');assert.ok(report.packets.login,'join game');
      assert.ok(report.teleportsConfirmed,'spawn teleport');assert.ok(report.packets.map_chunk,'chunks');assert.ok(report.packets.update_light,'light updates');
      if(duration>=22000)assert.ok(report.keepAlivesAnswered,'server keepalive round-trip');
      assert.ok(sock.split.threshold>=0,'server compression was negotiated');report.compressionThreshold=sock.split.threshold;finish();
    }catch(e){finish(e);}
  },duration);
  sock.on('text',text=>{
    const msg=JSON.parse(text);
    if(msg.type==='login_success'){report.loginSuccess=true;console.log('Login successful; waiting for join game');}
    if(msg.type==='error'||msg.type==='kicked')finish(new Error(msg.message||msg.reason));
  });
  sock.on('binary',bytes=>{
    if(finished)return;
    try{
      const packet=decodePacket754(bytes);
      if(packet.name==='unsupported'){const key=packet.packetName||String(packet.id);report.unsupported[key]=(report.unsupported[key]||0)+1;return;}
      report.packets[packet.name]=(report.packets[packet.name]||0)+1;
      if(packet.name==='login'){report.join={entityId:packet.entityId,dimension:packet.dimension,viewDistance:packet.viewDistance};sock.sendBinary(C754.settings('en_us',2));console.log('Join game decoded; waiting for chunks, light and keepalive');}
      if(packet.name==='map_chunk'){try{const chunk=decodeChunkData754(packet);report.sectionsDecoded+=chunk.sections.filter(Boolean).length;}catch(error){captureFailedChunk(packet);throw error;}}
      if(packet.name==='kick_disconnect')throw new Error('Server disconnected probe: '+packet.reason);
      if(packet.name==='position'){sock.sendBinary(C754.teleportConfirm(packet.teleportId));report.teleportsConfirmed++;}
      if(packet.name==='keep_alive'){sock.sendBinary(C754.keepAlive(packet.keepAliveId));report.keepAlivesAnswered++;}
    }catch(e){finish(e);}
  });
  sock.on('close',()=>{if(!finished)finish(new Error('Connection closed before probe completed'));});
  sock.sendText(JSON.stringify({type:'connect',host,port,username:'Codex1165Probe',protocol:PROTOCOL_754}));
});
await writeFile(join(cache,'live-probe.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
