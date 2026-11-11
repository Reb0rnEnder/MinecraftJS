import {VanillaSocket766} from './tcp-1.20.6.js';
import {openEaglerSocket} from './eagler.js';

// EaglerXServer acknowledges the backend Login Success itself. Since 1.20.2,
// its finish-handshake packet is followed by Configuration, not directly Play.
// Payloads are already packet-delimited WebSocket messages: never TCP-frame or
// compress them a second time.
export class EaglerSocket766 extends VanillaSocket766 {
  constructor(address,options={}) {super({},options);this.address=address;this.isEagler=true;}
  async open() {
    this.link=await openEaglerSocket(this.address);
    this.stream={close:()=>this.link.close()};
    this.link.on('close',()=>this.close());
    this.link.on('text',text=>{
      let message;try{message=JSON.parse(text)}catch{return}
      if(message.type==='login_success'){
        this.profile={uuid:message.uuid,username:message.username};
        this._beginConfiguration();
      }else this._control(message);
    });
    this.link.on('binary',bytes=>{
      try{this._packet(bytes)}catch(error){this._control({type:'error',message:'Bad data from server: '+error.message});this.close();}
    });
    return this;
  }
  _send(bytes) {if(!this.closed)this.link.sendBinary(bytes);}
  sendText(text) {this.link.sendText(text);}
}
