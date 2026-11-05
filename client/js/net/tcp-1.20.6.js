// First native-766 transport milestone. Graphical Play/item-component support
// is not yet connected to Game; do not route this into the protocol-762 decoder.
import {VanillaSocket} from './tcp.js';
import {C766,Configuration766,decodeLogin766,decodeBootstrapPlay766} from './configuration-1.20.6.js';
import {nameUuid} from '../util/uuid-md5.js';import {encodeUtf8} from '../util/utf8.js';
export class VanillaSocket766 extends VanillaSocket{
 constructor(entry,options={}){super(entry);this.options=options;this.cookies=new Map();this.configuration=null;this.profile=null;this.configurationGeneration=0;}
 _connect(msg){return super._connect({...msg,protocol:766});}
 _loginStart(msg){const username=(msg.username||'Player').slice(0,16),uuid=this.auth?.uuid||nameUuid(encodeUtf8('OfflinePlayer:'+username));return C766.loginStart(username,uuid);}
 _beginConfiguration(){this.state='configuration';this.configurationGeneration++;this.configuration=new Configuration766(b=>this._send(b),p=>this.emit('configuration',p),this.cookies);this.configuration.start(this.options);}
 _packet(data){
  if(this.state==='login'){
   const p=decodeLogin766(data);
   switch(p.name){
    case 'disconnect':this._kick(p.reason);break;
    case 'compress':this.split.threshold=p.threshold;break;
    case 'success':this.profile=p;this._send(C766.loginAcknowledged());this._beginConfiguration();break;
    case 'login_plugin_request':this._send(C766.loginPluginResponse(p.messageId));break;
    case 'cookie_request':this._send(C766.loginCookieResponse(p.key,this.cookies.get(p.key)));break;
    case 'encryption_begin':this._control({type:'error',message:'Encrypted protocol-766 login is a pending port milestone'});this.close();break;
   }return;
  }
  if(this.state==='configuration'){
   const p=this.configuration.handle(data);
   if(p.name==='disconnect'){this.emit('configuration_disconnect',p.reason);this._kick('Disconnected during configuration');}
   else if(p.name==='finish_configuration'){
    this.state='play';this._control({type:'login_success',uuid:this.profile.uuid,username:this.profile.username});
    this.emit('configuration_complete',this.configuration);
   }else if(p.name==='transfer')this.emit('transfer',p);
   else if(p.name==='add_resource_pack')this.emit('resource_pack',p);
   return;
  }
  if(this.state==='play'){
   const p=decodeBootstrapPlay766(data);
   if(p.name==='start_configuration'){this._send(C766.acknowledgeReconfiguration());this._beginConfiguration();return;}
   this.emit('bootstrap_play',p);this.emit('binary',data);
  }
 }
}
