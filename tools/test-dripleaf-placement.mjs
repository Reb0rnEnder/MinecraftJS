import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {initBlocks,blocksByName,findState} from '../client/js/world/blocks.js';import {World} from '../client/js/world/world.js';import {Chunk} from '../client/js/world/chunk.js';import {LocalPlayer} from '../client/js/game/physics.js';import {Interaction} from '../client/js/game/interaction.js';import {dripleafCanSurvive} from '../client/js/game/dripleaf-placement.js';import {RegistryTags} from '../client/js/game/tags.js';import {VANILLA_UI} from '../client/js/gui/vanilla-layout.js';
const json=n=>JSON.parse(readFileSync(new URL('../client/data/'+n+'.json',import.meta.url)));initBlocks(json('blocks'),json('blockCollisionShapes'));
const newer=VANILLA_UI.version==='1.18.2',state=n=>blocksByName[n].defaultState;
function scene(name,support='stone'){const world=new World(),chunk=new Chunk(0,0,true,world),player=new LocalPlayer();world.chunks.set('0,0',chunk);chunk.setState(1,1,1,state(support));player.setPosition(5,1,5);let sounds=0,swings=0;const held={id:1,count:4,damage:0},game={world,player,gameMode:0,entities:{all:()=>[]},inventory:{getHand:hand=>hand===0?held:null,held:()=>held,offhand:null},items:{name:()=>name,useAction:()=>'none',def:()=>({name}),isBlockItem:()=>true,blockFor:()=>blocksByName[name]},sound:{playBlockPlace:()=>sounds++},cooldownFraction:()=>0,send:()=>{}},interaction=new Interaction(game),target={type:'block',x:1,y:1,z:1,face:1,hit:[1.5,2,1.5]};interaction.target=target;interaction.swing=()=>swings++;return{world,chunk,player,game,interaction,target,held,sounds:()=>sounds,swings:()=>swings};}
test('big dripleaf uses each target survival rule, including sturdy slabs in 1.17 only',()=>{
 for(const support of ['dirt','clay','moss_block','big_dripleaf','big_dripleaf_stem']){const s=scene('big_dripleaf',support);assert.equal(dripleafCanSurvive(s.world,'big_dripleaf',1,2,1),true,support);}
 const farm=scene('big_dripleaf','farmland');assert.equal(dripleafCanSurvive(farm.world,'big_dripleaf',1,2,1),newer);
 for(const support of ['stone','sand']){const s=scene('big_dripleaf',support);assert.equal(dripleafCanSurvive(s.world,'big_dripleaf',1,2,1),!newer,support);}
 const s=scene('big_dripleaf');s.chunk.setState(1,1,1,findState('stone_slab',{type:'top'}));assert.equal(dripleafCanSurvive(s.world,'big_dripleaf',1,2,1),!newer);s.chunk.setState(1,1,1,findState('stone_slab',{type:'bottom'}));assert.equal(dripleafCanSurvive(s.world,'big_dripleaf',1,2,1),false);
});
test('failed big-dripleaf placement produces no sound, swing, stack loss or prediction',()=>{
 const s=scene('big_dripleaf',newer?'stone':'glass_pane');assert.equal(s.interaction.onPlayerRightClick(s.target),false);s.interaction.rightClickMouse();assert.equal(s.sounds(),0);assert.equal(s.swings(),0);assert.equal(s.held.count,4);assert.equal(s.interaction.predictedBlocks.size,0);
});
test('successful placement returns success and plays the native placement sound once',()=>{
 const s=scene('big_dripleaf','dirt');assert.equal(s.interaction.onPlayerRightClick(s.target),true);assert.equal(s.sounds(),1);assert.equal(s.held.count,3);
});
test('small dripleaf checks dry/wet support, upper-cell space and height limit',()=>{
 for(const support of ['clay','moss_block']){const s=scene('small_dripleaf',support);assert.equal(s.interaction._canPlaceBlockOnSide(s.target,s.held),true);}
 const s=scene('small_dripleaf','dirt');assert.equal(s.interaction._canPlaceBlockOnSide(s.target,s.held),false);s.chunk.setState(1,2,1,state('water'));assert.equal(s.interaction._canPlaceBlockOnSide(s.target,s.held),true);s.chunk.setState(1,3,1,state('stone'));assert.equal(s.interaction._canPlaceBlockOnSide(s.target,s.held),false);
 s.chunk.setState(1,3,1,0);s.chunk.setState(1,1,1,state('stone'));assert.equal(s.interaction._canPlaceBlockOnSide(s.target,s.held),false);
 s.world.maxY=3;s.chunk.setState(1,1,1,state('clay'));assert.equal(s.interaction._canPlaceBlockOnSide(s.target,s.held),false);
});
test('dripleaf support tags follow server overrides where native uses them',()=>{
 const s=scene('small_dripleaf','stone');s.world.registryTags=new RegistryTags({blocks:{'minecraft:small_dripleaf_placeable':[blocksByName.stone.id],'minecraft:big_dripleaf_placeable':[blocksByName.stone.id]}});assert.equal(dripleafCanSurvive(s.world,'small_dripleaf',1,2,1),true);assert.equal(dripleafCanSurvive(s.world,'big_dripleaf',1,2,1),true);
});
