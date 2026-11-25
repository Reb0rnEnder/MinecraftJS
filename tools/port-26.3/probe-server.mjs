// Native 26.3 probe: status ping + login/configuration handshake against a real server.
// This asserts the protocol we ported to is the protocol Mojang's own jar speaks.
import net from 'node:net';
import zlib from 'node:zlib';

const HOST=process.env.PROBE_HOST||'127.0.0.1';
const PORT=Number(process.env.PROBE_PORT||25568);
const PROTOCOL=777;

function varint(value){const bytes=[];let v=value>>>0;do{let b=v&0x7f;v>>>=7;if(v)b|=0x80;bytes.push(b);}while(v);return Buffer.from(bytes);}
function writeString(text){const body=Buffer.from(text,'utf8');return Buffer.concat([varint(body.length),body]);}
function packet(id,payload){const body=Buffer.concat([varint(id),payload]);return Buffer.concat([varint(body.length),body]);}
// After Set Compression every frame carries a data-length VarInt; 0 means the body is uncompressed.
function frame(id,payload,threshold){const body=Buffer.concat([varint(id),payload]);if(threshold<0)return Buffer.concat([varint(body.length),body]);const inner=Buffer.concat([varint(0),body]);return Buffer.concat([varint(inner.length),inner]);}

class Reader{
  constructor(socket){this.socket=socket;this.buffer=Buffer.alloc(0);this.queue=[];this.waiter=null;this.threshold=-1;this.closed=false;
    socket.on('data',chunk=>{this.buffer=Buffer.concat([this.buffer,chunk]);this.pump();});
    socket.on('close',()=>{this.closed=true;this.fail(Error('socket closed'));});
    socket.on('error',error=>this.fail(error));}
  fail(error){if(this.waiter){this.waiter.reject(error);this.waiter=null;}}
  pump(){this.frames();while(this.queue.length&&this.waiter){const entry=this.queue.shift();const waiter=this.waiter;this.waiter=null;waiter.resolve(entry);}}
  frames(){
    for(;;){
      const length=readVarint(this.buffer,0);if(!length)return;const [size,offset]=length;
      if(this.buffer.length<offset+size)return;
      let payload=this.buffer.subarray(offset,offset+size);this.buffer=this.buffer.subarray(offset+size);
      if(this.threshold>=0){const dataLength=readVarint(payload,0);const [uncompressed,dataOffset]=dataLength;payload=uncompressed===0?payload.subarray(dataOffset):zlib.inflateSync(payload.subarray(dataOffset));}
      if(!this.queue.length&&this.waiter){this.queue.push({payload});this.pump();}
      else this.queue.push({payload});
    }
  }
  next(timeout=15000){if(this.queue.length)return Promise.resolve(this.queue.shift());if(this.closed)return Promise.reject(Error('socket closed'));
    return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.waiter=null;reject(Error('probe timeout'));},timeout);this.waiter={resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}};});}
}
function readVarint(buffer,offset){let value=0,shift=0,index=offset;for(;;){if(index>=buffer.length)return null;const byte=buffer[index++];value|=(byte&0x7f)<<shift;if(!(byte&0x80))return [value,index];shift+=7;if(shift>35)throw Error('VarInt too long');}}
function packetId(payload){return readVarint(payload,0);}
function readString(payload,offset){const header=readVarint(payload,offset);if(!header)return null;const [length,start]=header;return [payload.subarray(start,start+length).toString('utf8'),start+length];}

async function status(){
  const socket=net.connect(PORT,HOST);await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('error',reject);});
  const reader=new Reader(socket);
  socket.write(packet(0x00,Buffer.concat([varint(PROTOCOL),writeString(HOST),(()=>{const p=Buffer.alloc(2);p.writeUInt16BE(PORT);return p;})(),varint(1)])));
  socket.write(packet(0x00,Buffer.alloc(0)));
  const {payload}=await reader.next();
  socket.destroy();
  const [name,offset]=readString(payload,1);
  return {packetId:packetId(payload)[0],json:JSON.parse(name),offset};
}

async function login(){
  const socket=net.connect(PORT,HOST);await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('error',reject);});
  const reader=new Reader(socket);
  socket.write(packet(0x00,Buffer.concat([varint(PROTOCOL),writeString(HOST),(()=>{const p=Buffer.alloc(2);p.writeUInt16BE(PORT);return p;})(),varint(2)])));
  const uuid=Buffer.alloc(16);for(let i=0;i<16;i++)uuid[i]=i*7+1;
  socket.write(packet(0x00,Buffer.concat([writeString('Probe26_3'),uuid])));
  const seen=[];
  const loginPackets=[],configPackets=[];
  const loginResult={loginPackets,configPackets};
  let phase='login';
  const deadline=Date.now()+20000;
  try{
    while(Date.now()<deadline){
      const {payload}=await reader.next(5000);
      const [id]=packetId(payload);
      if(phase==='login'){
        loginPackets.push(id);
        if(id===0x03){const [threshold]=readVarint(payload,1);reader.threshold=threshold;continue;}
        if(id===0x02){socket.write(frame(0x03,Buffer.alloc(0),reader.threshold));phase='configuration';continue;}
        if(id===0x00){loginResult.disconnectReason=payload.subarray(1).toString('utf8').slice(0,300);loginResult.hex=payload.toString('hex').slice(0,200);break;}
      }else{
        configPackets.push(id);
        if(id===0x03)break; // finish_configuration
      }
      seen.push(phase+':'+id);
    }
  }catch(e){if(!/timeout/.test(String(e.message)))throw e;}
  socket.destroy();
  return Object.assign(loginResult,{seen});
}

const statusResult=await status();
const version=statusResult.json.version||{};
if(version.protocol!==PROTOCOL)throw Error('Server reports protocol '+version.protocol+', expected '+PROTOCOL);
const loginResult=await login();
if(!loginResult.loginPackets.length)throw Error('No login response');
if(loginResult.disconnectReason!==undefined){
  console.log(JSON.stringify({disconnect:{reason:loginResult.disconnectReason,hex:loginResult.hex}},null,2));
  throw Error('Native server rejected the probe login');
}
if(!loginResult.configPackets.length)throw Error('Login completed but Configuration was never entered');
console.log(JSON.stringify({
  status:{name:version.name,protocol:version.protocol,players:statusResult.json.players},
  loginPackets:loginResult.loginPackets,
  configPackets:loginResult.configPackets.slice(0,8),
  reachedConfiguration:loginResult.configPackets.length>0
},null,2));
console.log('Native 26.3 probe passed: status protocol 777, login+configuration packets received');
