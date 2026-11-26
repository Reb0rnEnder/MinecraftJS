// Live 26.3 gate: drives the client's own VanillaSocket26_3 (no parallel probe codec)
// against a native protocol-777 server over a plain Node TCP transport. Every decoded
// login, configuration, Play Login and chunk frame must be consumed byte-exactly.
import assert from 'node:assert/strict';
import net from 'node:net';
import {once} from 'node:events';
import {VanillaSocket26_3} from '../../client/js/net/tcp-26.3.js';
import {loginContext26_3} from '../../client/js/net/session-26.3.js';
import {GAME_PLAY_CLIENTBOUND_26_3} from '../../client/js/net/game-names-26.3.js';

const HOST=process.env.PROBE_HOST||'127.0.0.1';
const PORT=Number(process.env.PROBE_PORT||25568);
const TIMEOUT=Number(process.env.PROBE_TIMEOUT||25000);

class NodeSocket26_3 extends VanillaSocket26_3{
  async _open(host,port,onPacket,onClose){
    const socket=net.connect({host,port});
    socket.setNoDelay(true);
    await once(socket,'connect');
    this.socket=socket;
    const stream={
      write:bytes=>socket.write(bytes),
      close:()=>socket.destroy(),
      on:(event,fn)=>event==='data'?socket.on('data',fn):socket.on('close',()=>fn(null))
    };
    this.stream=stream;
    stream.on('data',raw=>{
      if(this.closed)return;
      try{this.split.feed(this.decipher?this.decipher.update(raw):raw,packet=>this._packet(packet));}
      catch(error){this._badPacket(error);}
    });
    stream.on('close',()=>{if(onClose)onClose(null);this.close();});
  }
}

const socket=new NodeSocket26_3({},{autoPlayAcks:true});
const state={configNames:[],play:[],chunks:[],login:null,failures:[]};

socket.on('text',text=>{
  let message;
  try{message=JSON.parse(text);}catch{return;}
  if(message.type==='error')state.failures.push(message.message);
  if(message.type==='kicked')state.failures.push('kicked: '+JSON.stringify(message.reason));
});
socket.on('configuration',packet=>state.configNames.push(packet.name));
socket.on('play',packet=>state.play.push(packet));
socket.on('play_login',data=>{state.login=data;});
socket.on('chunk',chunk=>state.chunks.push(chunk));

const wait=async(predicate,label)=>{
  const deadline=Date.now()+TIMEOUT;
  while(Date.now()<deadline){
    if(state.failures.length)throw Error(label+' failed: '+state.failures[0]);
    if(predicate())return;
    await new Promise(resolve=>setTimeout(resolve,20));
  }
  throw Error(label+' timed out after '+TIMEOUT+' ms');
};

socket.sendText(JSON.stringify({type:'connect',host:HOST,port:PORT,username:'Port26_3'}));
try{
  await wait(()=>state.login!==null,'Play Login');
  await wait(()=>state.chunks.length>=2,'two level_chunk_with_light frames');
  // Let the keep-alive/chunk-batch exchange run once so an unacked frame closes the socket.
  await new Promise(resolve=>setTimeout(resolve,400));
  if(state.failures.length)console.error('socket failures:',state.failures);
  assert.equal(state.failures.length,0,'the native server keeps the connection open');
  assert.ok(!socket.closed,'the socket stays open after join');

  const profile=socket.profile;
  assert.equal(profile.username,'Port26_3','Login Finished carries the requested name');
  assert.match(profile.uuid,/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,'Login Finished profile UUID');
  assert.match(profile.sessionId,/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,'26.3 Login Finished session UUID');

  const configuration=socket.configuration;
  for(const name of ['custom_payload','update_enabled_features','select_known_packs','registry_data','update_tags','finish_configuration']){
    assert.ok(state.configNames.includes(name),'configuration must include '+name);
  }
  assert.ok(socket.configuration.complete,'finish_configuration was acknowledged');
  assert.ok(configuration.registries.size>=32,'native 26.3 sends at least 32 registries, got '+configuration.registries.size);
  assert.equal(configuration.elidedRegistryValues,0,'claiming no known packs must yield full registry payloads');
  for(const [registry,entries] of configuration.registries){
    assert.ok(entries.length>0,registry+' has entries');
    for(const entry of entries)if(entry.value===null)throw Error(registry+' / '+entry.key+' lost its payload');
  }
  const biome=configuration.registries.get('minecraft:worldgen/biome');
  assert.ok(biome?.some(entry=>entry.key==='minecraft:badlands'),'biome registry lists minecraft:badlands');
  assert.ok(configuration.tags.size>=10,'native 26.3 sends tag registries, got '+configuration.tags.size);
  const tagCount=[...configuration.tags.values()].reduce((sum,tags)=>sum+tags.length,0);
  assert.ok(tagCount>=100,'native 26.3 sends at least 100 tags, got '+tagCount);

  const login=state.login;
  const context=loginContext26_3(configuration,login);
  assert.equal(context.blockStateRegistrySize,35723,'the native block-state registry size');
  assert.deepEqual([...context.airStates],[0,18649,18650],'canonical air states from the native block report');
  assert.ok(context.biomeRegistrySize>=60,'biome registry size '+context.biomeRegistrySize);
  assert.equal(context.dimensionData.key,'minecraft:overworld','spawn dimension type');
  assert.equal(context.dimensionData.min_y,-64,'overworld min_y');
  assert.equal(context.dimensionData.height,384,'overworld height');
  assert.equal(context.dimensionData.has_skylight,true,'overworld skylight');
  assert.equal(context.dimensionData.effects,'minecraft:overworld','overworld effects id');
  assert.ok(context.enabledFeatures.includes('minecraft:vanilla'),'enabled features carried into Play');
  assert.ok(Object.keys(context.registryTags).length>=10,'tag registries carried into Play');
  assert.ok(login.levels.includes('minecraft:overworld')&&login.levels.includes('minecraft:the_nether')&&login.levels.includes('minecraft:the_end'),'level set');
  assert.equal(login.spawn.dimension,'minecraft:overworld','spawn dimension');
  assert.ok(login.spawn.seaLevel>=0&&login.spawn.seaLevel<=512,'spawn sea level '+login.spawn.seaLevel);
  assert.ok(login.chunkRadius>=2&&login.chunkRadius<=32,'chunk radius '+login.chunkRadius);

  for(const [index,chunk] of state.chunks.entries()){
    assert.ok(Number.isInteger(chunk.x)&&Number.isInteger(chunk.z),'chunk '+index+' coordinates');
    assert.equal(chunk.sections.length,24,'chunk '+index+' section count');
    assert.ok(Array.isArray(chunk.blockEntities),'chunk '+index+' block entities');
    assert.ok(chunk.buffer.length>0,'chunk '+index+' has a block buffer');
  }

  const decoded=state.play.filter(packet=>packet.decoded),undecoded=state.play.filter(packet=>!packet.decoded);
  const names=new Set(decoded.map(packet=>packet.name));
  const gameNames=new Set(decoded.map(packet=>GAME_PLAY_CLIENTBOUND_26_3[packet.name]));
  for(const name of ['map_chunk','spawn_entity','login','update_time']){
    assert.ok(gameNames.has(name),'the join maps a native packet onto the game handler '+name);
  }
  for(const name of ['login','chunk_batch_start','level_chunk_with_light','chunk_batch_finished','player_position']){
    assert.ok(names.has(name),'Play decode must cover '+name);
  }

  console.log(JSON.stringify({
    host:HOST,port:PORT,
    profile:{uuid:profile.uuid,username:profile.username,sessionId:profile.sessionId},
    configuration:{packets:state.configNames.length,registries:configuration.registries.size,tags:tagCount,elided:configuration.elidedRegistryValues},
    joinContext:{blockStates:context.blockStateRegistrySize,airStates:context.airStates,biomes:context.biomeRegistrySize,
      dimension:context.dimensionData.key,bounds:[context.dimensionData.min_y,context.dimensionData.height],
      features:context.enabledFeatures,tagRegistries:Object.keys(context.registryTags).length},
    playLogin:{playerId:login.playerId,levels:login.levels,spawn:login.spawn},
    chunks:state.chunks.length,
    playFrames:{decoded:decoded.length,undecoded:undecoded.length,types:[...names].sort(),raw:[...new Set(undecoded.map(packet=>packet.name))].sort(),gameNames:[...gameNames].sort()}
  },null,2));
  console.log('Native 26.3 client net gate passed: protocol 777 login, configuration, Play Login and '+state.chunks.length+' chunks decoded by the client socket');
}finally{
  socket.close();
  socket.socket?.destroy();
}
