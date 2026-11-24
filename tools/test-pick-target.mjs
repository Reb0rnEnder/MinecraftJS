// Crosshair picking (getMouseOver / GameRenderer.pick): an entity in front of a block but out of entity reach is a
// miss, not the block behind it; blocks cap the entity search; 1.20.5+ ranges come from the interaction attributes.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Interaction} from '../client/js/game/interaction.js';

const modern=/entityInteractionRange/.test(readFileSync(new URL('../client/js/game/interaction.js',import.meta.url),'utf8'));
// Looking along +z from (0.5, 1.62, 0); a wall at z = wall and an entity whose front face is at z = front
function pick({wall=null,front=null,mode=0,blockRange=mode===1?5:4.5,entityRange=mode===1?5:3}){
 const entity=front===null?null:{id:7,pickable:true,width:0.6,height:1.8,x:0.5,y:0,z:front+0.3,prevX:0.5,prevY:0,prevZ:front+0.3,pickRadius:0};
 const game={gameMode:mode,entityId:1,ridingEntityId:-1,eyePosition:()=>[0.5,1.62,0],lookVector:()=>[0,0,1],
  world:{raycast:(ox,oy,oz,dx,dy,dz,max)=>wall!==null&&wall<=max?{dist:wall,x:0,y:1,z:Math.floor(wall),face:2}:null},
  entities:{pickable:()=>entity?[entity]:[],interp:e=>({x:e.x,y:e.y,z:e.z})}};
 const player={blockInteractionRange:blockRange,entityInteractionRange:entityRange};
 const it=Object.create(Interaction.prototype);Object.defineProperty(it,'game',{value:game});Object.defineProperty(it,'player',{value:player});
 it.reach=()=>modern?blockRange:(mode===1?5:4.5);
 return it.updateTarget(1);
}

test('an out-of-reach entity in front of a block is a miss, a close one is targeted, and blocks occlude entities',()=>{
 assert.equal(pick({wall:4.4,front:3.8}),null,'entity at 3.8 (> 3) shields the block at 4.4');
 assert.equal(pick({wall:4.4,front:2.5})?.type,'entity');
 assert.equal(pick({wall:2,front:2.5})?.type,'block','the block in front hides the entity');
 assert.equal(pick({wall:4.4})?.type,'block');
 assert.equal(pick({wall:6})?.type,undefined,'blocks beyond reach are not targeted');
 assert.equal(pick({front:4.6,mode:1})?.type,'entity','Creative reaches entities at 4.6');
 assert.equal(pick({front:5.5,mode:1}),null,'the search stops at the block pick range (a miss at 5) in Creative');
});

test('1.20.5+: ranges come from block/entity interaction attributes and blocks between the ranges occlude',{skip:!modern},()=>{
 assert.equal(pick({front:7,blockRange:4.5,entityRange:10})?.type,'entity','entity range 10');
 assert.equal(pick({wall:6,front:8,blockRange:4.5,entityRange:10}),null,'the wall at 6 is nearer but outside block range: a miss');
 assert.equal(pick({wall:8,blockRange:10,entityRange:3})?.type,'block','block range 10');
 assert.equal(pick({wall:3,front:2.99,blockRange:4.5,entityRange:2.99}),null,'ranges are strict');
});
