// Reconcile both halves when a protection plugin corrects only the clicked half.
const key=p=>p.x+','+p.y+','+p.z;
export function predictDoorPair(interaction,entries,opening,modern){
 const pending=interaction.predictedDoors??=new Map(),world=interaction.game.world;
 const superseded=new Set();
 for(const e of entries){const old=pending.get(key(e));if(old){const previous=old.entries.find(p=>key(p)===key(e));if(previous)e.previous=previous.previous;superseded.add(old);}}
 for(const old of superseded)for(const p of old.entries)pending.delete(key(p));
 const group={entries,opening,modern};for(const e of entries)pending.set(key(e),group);
 while(pending.size>128){const oldest=pending.values().next().value;for(const e of oldest.entries)pending.delete(key(e));}
 for(const e of entries)world.setState(e.x,e.y,e.z,e.predicted);
}
export function reconcileDoorPair(interaction,pos,state,isConfirmed){
 const pending=interaction.predictedDoors,group=pending?.get(key(pos));if(!group)return;
 // Modern halves each carry OPEN; old metadata stores it only in the lower half.
 // A legacy upper-only update cannot confirm the locally modified lower half.
 const entry=group.entries.find(p=>key(p)===key(pos)),confirmed=entry&&entry.confirms&&isConfirmed(group,state);
 if(!confirmed){const w=interaction.game.world;for(const e of group.entries)if(key(e)!==key(pos)&&w.getState(e.x,e.y,e.z)===e.predicted)w.setState(e.x,e.y,e.z,e.previous);}
 for(const e of group.entries)pending.delete(key(e));
}
