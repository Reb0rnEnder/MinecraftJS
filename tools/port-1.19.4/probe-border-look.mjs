import assert from 'node:assert/strict';import{readFile,writeFile}from'node:fs/promises';import{join}from'node:path';
import {connectFixture} from './fixture-client.mjs';import{cache,target}from'./prepare.mjs';
import {WorldBorder} from '../../client/js/world/world-border.js';
import {LocalPlayer} from '../../client/js/game/physics.js';
import {EntityManager} from '../../client/js/game/entities.js';
import {Game} from '../../client/js/game/game.js';
import {applyLookAt} from '../../client/js/game/look-at.js';
import {World} from '../../client/js/world/world.js';
const g={worldBorder:new WorldBorder(),player:new LocalPlayer(),entityRenderer:{remove(){}}};
g.entities=new EntityManager(g);
const client=await connectFixture((p,state)=>{
  if(p.name==='login')g.entityId=p.entityId;
  if(p.name==='position'){const a=state.position;g.player.setPosition(a.x,a.y,a.z);g.player.yaw=a.yaw;g.player.pitch=a.pitch;}
  if(p.name==='world_border')Game.prototype.on_world_border.call(g,p);
  if(p.name==='face_player'){Game.prototype.on_face_player.call(g,p);state.position.yaw=g.player.yaw;state.position.pitch=g.player.pitch;}
  if(p.name==='spawn_entity')g.entities.spawnObject(p);
  if(p.name==='entity_metadata')g.entities.setMetadata(p.entityId,p.metadata);
  if(p.name==='entity_destroy')for(const id of p.entityIds)g.entities.map.delete(id);
});
try {
  const {command,until,state}=client;
  command('/gamemode creative');command('/worldborder center 0.0 0.0');command('/worldborder set 20');command('/worldborder warning distance 7');command('/worldborder warning time 19');
  await until(()=>g.worldBorder.x===0&&g.worldBorder.z===0&&g.worldBorder.size===20&&g.worldBorder.warningBlocks===7&&g.worldBorder.warningTime===19);
  command('/worldborder set 40 10');await until(()=>g.worldBorder.targetSize===40&&g.worldBorder.duration===10000);
  assert.equal(g.worldBorder.oldSize,20);assert.ok(g.worldBorder.size<40,'does not jump to the end');
  command('/worldborder set 20');command('/tp @s 0.0 70.0 0.0 0 0');await until(()=>g.worldBorder.size===20&&g.player.y===70&&g.player.x===0);
  const lookCount=()=>state.packets.filter(p=>p.name==='face_player').length;
  let count=lookCount();command('/tp @s ~ ~ ~ facing 3.0 77.0 -2.0');await until(()=>lookCount()>count);
  const vectors=JSON.parse(await readFile(new URL('../fixtures/border-look-native-1.19.4.json',import.meta.url))),v=vectors.angles.find(v=>v.delta.join(',')==='3,7,-2');
  assert.equal(g.player.yaw,v.yaw);assert.equal(g.player.pitch,v.pitch);
  command('/summon interaction 3 70 -2 {Tags:["mcjs_border_look"],height:3.5f}');
  await until(()=>[...g.entities.all()].some(e=>e.entityName==='interaction'&&e.height===3.5));
  count=lookCount();command('/execute anchored eyes run tp @s ~ ~ ~ facing entity @e[tag=mcjs_border_look,limit=1] eyes');await until(()=>lookCount()>count);
  const look=state.packets.filter(p=>p.name==='face_player').at(-1),before=[g.player.yaw,g.player.pitch];assert.equal(look.isEntity,true);assert.equal(look.fromAnchor,1);assert.equal(look.toAnchor,1);
  g.entities.map.delete(look.entityId);applyLookAt(g,look);assert.deepEqual([g.player.yaw,g.player.pitch],before,'native fallback coordinates equal the entity eye anchor');
  const world=new World();world.worldBorder=g.worldBorder;world.isLoaded=()=>true;world.getState=()=>0;world.collisionBoxes=()=>{};
  g.player.setPosition(9.5,70,0);g.player.moveEntity(world,1,0,0);assert.equal(g.player.bb()[3],10);
  const report={version:'1.19.4',serverJarSha1:target.downloads.server.sha1,warningBlocks:g.worldBorder.warningBlocks,warningTime:g.worldBorder.warningTime,lerpAccepted:true,coordinateLookAccepted:true,entityEyeAnchorAccepted:true,missingEntityFallback:true,collisionMaxX:g.player.bb()[3],limitations:'Native server wire layouts and client state/collision verified; border pixels use separate graphics tests.'};
  await writeFile(join(cache,'audit/border-look-server.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
} finally {client.close();}
