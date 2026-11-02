// Native sequence acknowledgements retain server states until the corresponding
// local prediction completes. Repeated predictions preserve the first baseline.
export class BlockPrediction762 {
 constructor(game){this.game=game;this.reset();}
 reset(){this.next=0;this.current=0;this.pending=new Map();}
 run(action){if(this.current)return action();this.current=++this.next;try{return action();}finally{this.current=0;}}
 record(x,y,z,previous){if(!this.current)return;const key=x+','+y+','+z,old=this.pending.get(key),p=this.game.player;this.pending.set(key,{x,y,z,serverState:old?.serverState??previous,sequence:this.current,player:old?.player||{x:p.x,y:p.y,z:p.z}});}
 serverUpdate(pos,state){const pending=this.pending.get(pos.x+','+pos.y+','+pos.z);if(!pending)return false;pending.serverState=state;return true;}
 acknowledge(sequence){if(!Number.isInteger(sequence)||sequence<0||sequence>this.next)throw Error('Invalid block prediction acknowledgement');const g=this.game;g.world.beginBatch();try{for(const[key,p]of this.pending){if(p.sequence>sequence)continue;this.pending.delete(key);if(g.world.getState(p.x,p.y,p.z)!==p.serverState){g.world.setState(p.x,p.y,p.z,p.serverState);if(g.world.getCollisions(g.player.bb(),g.player).length)g.player.setPosition(p.player.x,p.player.y,p.player.z);}g.interaction.onBlockChange(p,p.serverState);}}finally{g.world.endBatch();}}
}
