import {ZipFile} from '../lib/zip.js';import mcassets from '../lib/mcassets.js';import {createHash} from 'node:crypto';
import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {LocalPlayer} from '../client/js/game/physics.js';import {initBlocks,blocksByName} from '../client/js/world/blocks.js';import {World} from '../client/js/world/world.js';import {Chunk} from '../client/js/world/chunk.js';import {RegistryTags} from '../client/js/game/tags.js';import {DEFAULT_TAGS} from '../client/js/game/default-tags.js';import {Game} from '../client/js/game/game.js';
const json=name=>JSON.parse(readFileSync(new URL('../client/data/'+name+'.json',import.meta.url)));initBlocks(json('blocks'),json('blockCollisionShapes'));
const nativeNames=DEFAULT_TAGS.blocks['minecraft:climbable'].map(id=>json('blocks').find(b=>b.id===id).name),vineNames=nativeNames.filter(n=>n.includes('vines'));
function scene(name){const world=new World(),chunk=new Chunk(0,0,true,world);world.chunks.set('0,0',chunk);const b=blocksByName[name];for(let y=0;y<24;y++)chunk.setState(1,y,1,b.defaultState);const player=new LocalPlayer();player.setPosition(1.5,8,1.5);return{world,player};}
test('default climbable membership matches the pinned native jar tag',()=>{
 const target=JSON.parse(readFileSync(new URL('port-'+mcassets.MC_VERSION+'/target.json',import.meta.url))),bytes=readFileSync(new URL('../cache/port-'+mcassets.MC_VERSION+'/client.jar',import.meta.url));assert.equal(createHash('sha1').update(bytes).digest('hex'),target.downloads.client.sha1);
 const jar=new ZipFile(new URL('../cache/port-'+mcassets.MC_VERSION+'/client.jar',import.meta.url).pathname),tag=JSON.parse(jar.read('data/minecraft/tags/blocks/climbable.json'));assert.deepEqual([...nativeNames].sort(),tag.values.map(n=>n.replace('minecraft:','')).sort());
});
test('all target-native climbable tips/stems are recognized; decorative plants are excluded',()=>{
 assert.ok(vineNames.includes('twisting_vines'));assert.ok(vineNames.includes('weeping_vines_plant'));
 for(const name of nativeNames){const {world,player}=scene(name);assert.equal(player.isOnLadder(world),true,name);player.spectator=true;assert.equal(player.isOnLadder(world),false,name+' spectator');}
 for(const name of ['hanging_roots','glow_lichen','kelp','kelp_plant','nether_sprouts','crimson_roots','warped_roots'].filter(n=>blocksByName[n])){const {world,player}=scene(name);assert.equal(player.isOnLadder(world),false,name);}
 const hasCaves=!!blocksByName.cave_vines;assert.equal(vineNames.includes('cave_vines'),hasCaves);assert.equal(vineNames.includes('cave_vines_plant'),hasCaves);
});
test('jumping climbs unsupported new vines, crouching arrests descent, and falling is capped',()=>{
 for(const name of vineNames){
  const {world,player}=scene(name);player.jumping=true;const start=player.y;for(let i=0;i<20;i++)player._moveWithHeading(world,0,0,.02);assert.ok(player.y>start+1.5,name+' rises while jumping');
  player.setPosition(1.5,8,1.5);player.jumping=false;player.sneaking=true;player.motionY=-1;player._moveWithHeading(world,0,0,.02);assert.equal(player.y,8,name+' crouch holds position');assert.equal(player.fallDistance,0);
  player.sneaking=false;player.motionY=-1;player._moveWithHeading(world,0,0,.02);assert.ok(Math.abs(player.y-7.85)<1e-9,name+' descending speed capped');
 }
});
test('server tag replacement governs climbing instead of hardcoded vine names',()=>{
 const {world,player}=scene('twisting_vines');world.registryTags=new RegistryTags();assert.equal(player.isOnLadder(world),true);
 const game={tags:world.registryTags,screens:{current:null}},tags={blocks:{'minecraft:climbable':[blocksByName.stone.id]}};Game.prototype.on_tags.call(game,{tags});assert.equal(player.isOnLadder(world),false,'removed vine does not remain climbable');
 const chunk=world.getChunk(0,0);chunk.setState(1,8,1,blocksByName.stone.defaultState);assert.equal(player.isOnLadder(world),true,'server-added block is climbable');
 Game.prototype.on_tags.call(game,{tags:{blocks:{'minecraft:climbable':[]}}});assert.equal(player.isOnLadder(world),false,'empty tag does not fall back to defaults');
});
