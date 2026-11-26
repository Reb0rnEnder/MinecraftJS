// Protocol 777 socket: the 26.3 login/configuration states plus the decoded Play layer.
import {ChunkBatchCalculator} from './chunk-batch.js';
import {VanillaSocket} from './tcp.js';
import {C26_3,Configuration26_3,Reader26_3,decodeLogin26_3} from './configuration-26.3.js';
import {decodePlayPacket} from './play-codec-26.3.js';
import {nameUuid} from '../util/uuid-md5.js';
import {encodeUtf8} from '../util/utf8.js';

export class VanillaSocket26_3 extends VanillaSocket{
  constructor(entry,options={}){
    super(entry);
    this.options=options;
    this.cookies=new Map();
    this.resourcePacks=new Map();
    this.configuration=null;
    this.profile=null;
    this.spawn=null;
    this.playerId=null;
    this.configurationGeneration=0;
    this.chunkBatch=new ChunkBatchCalculator();
    this.autoPlayAcks=options.autoPlayAcks!==false;
    this.chunks=0;
  }

  _connect(msg){
    this.transferred=!!msg.transferred;
    return super._connect({...msg,protocol:777});
  }

  _loginIntent(){return this.transferred?3:2;}

  _loginStart(msg){
    const username=(msg.username||'Player').slice(0,16);
    const uuid=this.auth?.uuid||nameUuid(encodeUtf8('OfflinePlayer:'+username));
    return C26_3.loginStart(username,uuid);
  }

  _beginConfiguration(initial=true){
    this.state='configuration';
    this.configurationGeneration++;
    this.chunkBatch=new ChunkBatchCalculator();
    this.configuration=new Configuration26_3(
      bytes=>this._send(bytes),
      packet=>this.emit('configuration',packet),
      this.cookies,
      {knownPacks:this.options.knownPacks||[]}
    );
    if(initial)this.configuration.start(this.options);
  }

  _packet(data){
    if(this.closed)return;
    if(this.state==='login'){
      const packet=decodeLogin26_3(data);
      switch(packet.name){
        case 'login_disconnect':this._kick(packet.reason);break;
        case 'login_compression':this.split.threshold=packet.threshold;break;
        case 'login_finished':
          this.profile=packet;
          this._send(C26_3.loginAcknowledged());
          this._beginConfiguration();
          break;
        case 'custom_query':this._send(C26_3.loginPluginResponse(packet.messageId));break;
        case 'cookie_request':this._send(C26_3.loginCookieResponse(packet.key,this.cookies.get(packet.key)));break;
        case 'hello':return this._encryptionRequest(packet,packet.shouldAuthenticate);
      }
      return;
    }

    if(this.state==='configuration'){
      const packet=this.configuration.handle(data);
      if(packet.name==='disconnect'){
        this.emit('configuration_disconnect',packet.reason);
        this._kick(packet.reason);
      }else if(packet.name==='finish_configuration'){
        this.state='play';
        this._control({type:'login_success',uuid:this.profile.uuid,username:this.profile.username});
        this.emit('configuration_complete',this.configuration);
      }else if(packet.name==='transfer'){
        this._transfer(packet);
      }else if(packet.name==='resource_pack_push'){
        this.resourcePacks.set(packet.uuid,packet);
        this.emit('resource_pack',packet);
      }else if(packet.name==='resource_pack_pop'){
        if(packet.uuid)this.resourcePacks.delete(packet.uuid);else this.resourcePacks.clear();
        this.emit('resource_pack_remove',packet);
      }
      return;
    }

    if(this.state==='play'){
      this.lastPlayFrame=data;
      const reader=new Reader26_3(data);
      let packet;
      try{packet=decodePlayPacket(reader);}
      catch(error){
        // A Play frame whose layout is not implemented yet is surfaced and skipped, exactly
        // like the 1.20.6 decoder: one unknown packet must never close the connection.
        this.decodeErrors=(this.decodeErrors||0)+1;
        let hex='';
        for(let i=0;i<Math.min(data.length,96);i++)hex+=(data[i]<16?'0':'')+data[i].toString(16);
        const event={message:String(error?.message||error),bytes:data.length,hex};
        this.decodeErrorLog||=[ ];
        if(this.decodeErrorLog.length<48)this.decodeErrorLog.push(event);
        this.emit('decode_error',event);
        return;
      }
      if(packet.decoded&&reader.remaining()){
        throw Error('Trailing '+packet.name+' data: '+reader.remaining()+' bytes');
      }
      if(packet.name==='start_configuration'){
        this.emit('reconfiguration_start');
        this._send(C26_3.acknowledgeReconfiguration());
        this._beginConfiguration(false);
        return;
      }
      if(packet.name==='login'){
        this.playerId=packet.data.playerId;
        this.spawn=packet.data;
        this.emit('play_login',packet.data);
      }else if(packet.name==='level_chunk_with_light'){
        this.chunks++;
        this.emit('chunk',packet.data);
      }else if(packet.name==='resource_pack_push'){
        this.resourcePacks.set(packet.data.uuid,packet.data);
      }else if(packet.name==='resource_pack_pop'){
        const uuid=packet.data.uuid;
        if(uuid)this.resourcePacks.delete(uuid);else this.resourcePacks.clear();
      }

      if(packet.decoded&&packet.name==='cookie_request'){
        this._send(C26_3.playCookieResponse(packet.data.key,this.cookies.get(packet.data.key)));
      }else if(packet.decoded&&packet.name==='store_cookie'){
        if(packet.data.value.length>5120)throw Error('Cookie exceeds native limit');
        this.cookies.set(packet.data.key,packet.data.value.slice());
      }else if(packet.decoded&&packet.name==='transfer'){
        this._transfer(packet.data);
        return;
      }

      if(!packet.decoded){this.emit('play',packet);this.emit('binary',data);return;}
      if(this.autoPlayAcks&&packet.name==='chunk_batch_start')this.chunkBatch.start();
      if(this.autoPlayAcks&&packet.name==='keep_alive'){
        this._send(C26_3.playKeepAlive(BigInt(packet.data.keepAliveId)));
      }else if(this.autoPlayAcks&&packet.name==='player_position'){
        // Absolute position/rotations after the teleport; relative flags only shift a simulated player.
        this.playerPos={
          x:packet.data.position.x,y:packet.data.position.y,z:packet.data.position.z,
          yRot:packet.data.yRot,xRot:packet.data.xRot
        };
        this._send(C26_3.teleportConfirm(packet.data.teleportId,this.playerPos.x,this.playerPos.y,this.playerPos.z,this.playerPos.yRot,this.playerPos.xRot));
      }else if(this.autoPlayAcks&&packet.name==='chunk_batch_finished'){
        this._send(C26_3.chunkBatchReceived(this.chunkBatch.finish(packet.data.batchSize)));
      }else if(this.autoPlayAcks&&packet.name==='ping'){
        this._send(C26_3.playPong(packet.data.id32));
      }else if(packet.name==='disconnect'){
        this.emit('play_disconnect',packet.data.reason);
        this._kick(packet.data.reason);
        return;
      }

      this.emit('play',packet);
      this.emit('binary',data);
    }
  }

  // Control messages are JSON: 26.3 NBT components can hold BigInt longs.
  _kick(reason){
    const safe=reason&&typeof reason!=='string'
      ?JSON.stringify(reason,(key,value)=>typeof value==='bigint'?String(value):(value instanceof Int8Array||value instanceof Int32Array||value instanceof BigInt64Array?Array.from(value):value))
      :reason;
    super._kick(safe);
  }

  _transfer(packet){
    if(!packet.host||packet.port<1||packet.port>65535)throw Error('Invalid transfer destination');
    this.state='transferring';
    this.emit('transfer',{...packet,cookies:new Map([...this.cookies].map(([key,value])=>[key,value.slice()]))});
  }

  playPacket(data){return decodePlayPacket(new Reader26_3(data));}

  sendResourcePackStatus(uuid,status){
    if(this.closed)return;
    if(this.state==='configuration')this._send(C26_3.resourcePackStatus(uuid,status));
    else if(this.state==='play')this._send(C26_3.playResourcePackStatus(uuid,status));
  }
}
