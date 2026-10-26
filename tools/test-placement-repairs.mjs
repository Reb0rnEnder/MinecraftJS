import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {placementIntersects} from '../client/js/game/placement-collision.js';
import {initBlocks} from '../client/js/world/blocks.js';
import {Items} from '../client/js/game/items.js';
import {Interaction} from '../client/js/game/interaction.js';
import {LocalPlayer} from '../client/js/game/physics.js';
const read=name=>JSON.parse(readFileSync(new URL('../client/data/'+name+'.json',import.meta.url)));
const data=Object.fromEntries(['blocks','blockCollisionShapes','items','creative','enchantments','foods'].map(name=>[name,read(name)]));
initBlocks(data.blocks,data.blockCollisionShapes);
const findState=name=>data.blocks.find(block=>block.name===name).id<<4;
test('placement distinguishes a touching surface from occupied player volume',()=>{
 const pos={x:0,y:64,z:0},slab=[[0,0,0,1,.5,1]];
 assert.equal(placementIntersects(slab,pos,[.2,64.5,.2,.8,66.3,.8]),false);
 assert.equal(placementIntersects(slab,pos,[.2,64.4,.2,.8,66.2,.8]),true);
 assert.equal(placementIntersects([],pos,[.2,64,.2,.8,66,.8]),false);
});
test('normal right-click cannot predict a full block inside the local player',()=>{
 const items=new Items({data,translate:key=>key}),stack={id:data.items.find(item=>item.name==='stone').id,count:64,damage:0},p=new LocalPlayer();p.x=p.z=.5;p.y=64;
 const cells=new Map([['0,63,0',findState('stone')]]),world={getState:(x,y,z)=>cells.get([x,y,z].join(','))||0,setState:(x,y,z,s)=>cells.set([x,y,z].join(','),s)};
 const g={items,player:p,world,dimension:0,gameMode:1,food:20,entities:{all:()=>[]},inventory:{getHand:()=>stack,held:()=>stack,offhand:null,main:[stack]},send(){},sound:{onWorldEvent(){},playAtPlayer(){}},cooldownFraction:()=>0};
 const i=new Interaction(g);i.target={type:'block',x:0,y:63,z:0,face:1,hit:[.5,64,.5]};i.rightClickMouse();assert.equal(world.getState(0,64,0),0);
});
