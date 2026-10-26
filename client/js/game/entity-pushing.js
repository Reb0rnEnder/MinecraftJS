// EntitySelector.pushableBy / LivingEntity.doPush / Entity.push, native 1.9+ client behavior.
// Move only our local player's velocity; remote positions remain server controlled.
export function teamsCanPush(a,b){
 const ar=a?.collisionRule||'always',br=b?.collisionRule||'always',same=!!a&&a===b;
 if(ar==='never'||br==='never')return false;
 if((ar==='pushOwnTeam'||br==='pushOwnTeam')&&same)return false;
 return (ar!=='pushOtherTeams'&&br!=='pushOtherTeams')||same;
}
export function pushLocalPlayer(game){
 const p=game.player;
 if(game.dead||p.spectator||p.noClip||p.sleeping||p.ridingEntity||p.isOnLadder?.(game.world))return;
 const bb=p.bb(),teams=game.scoreboard?.playerTeam,mine=teams?.get(game.username);
 for(const e of game.entities.all()){
  if(e.id===game.entityId||e.dead||e.noClip||e.sleeping||e.kind!=='player'&&e.kind!=='mob'||e.entityName==='bat')continue;
  if(e.kind==='player'&&game.scoreboard?.players.get(e.uuid)?.gamemode===3)continue;
  const name=e.kind==='player'?(e.name||game.scoreboard?.players.get(e.uuid)?.name):e.uuid;
  if(!teamsCanPush(mine,teams?.get(name)))continue;
  const w=e.width/2;if(!(e.x+w>bb[0]&&e.x-w<bb[3]&&e.y+e.height>bb[1]&&e.y<bb[4]&&e.z+w>bb[2]&&e.z-w<bb[5]))continue;
  const dx=p.x-e.x,dz=p.z-e.z,d=Math.max(Math.abs(dx),Math.abs(dz));if(d<Math.fround(.01))continue;
  const length=Math.fround(Math.sqrt(d)),scale=Math.min(1,1/length)*Math.fround(.05)*(1-(p.collisionReduction||0))/length;
  p.motionX+=dx*scale;p.motionZ+=dz*scale;
 }
}
