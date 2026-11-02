export class PacketBundles762 {
 constructor(){this.pending=null;}
 accept(packet,emit){if(packet.name==='bundle_delimiter'){if(this.pending){const packets=this.pending;this.pending=null;for(const p of packets)emit(p);}else this.pending=[];return;}
  if(this.pending){if(this.pending.length>=4096){this.pending=null;throw Error('762 bundle exceeds 4096 packets');}this.pending.push(packet);}else emit(packet);
 }
 reset(){this.pending=null;}
}
