import {test} from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from 'node:fs';
import{initBlocks}from '../client/js/world/blocks.js';import{shadowGeometry}from '../client/js/render/shadows.js';
const definitions=JSON.parse(readFileSync(new URL('../client/data/blocks.json',import.meta.url))),shapes=JSON.parse(readFileSync(new URL('../client/data/blockCollisionShapes.json',import.meta.url)));
initBlocks(definitions,shapes);const packed=definitions.find(b=>b.name==='stone').minStateId===undefined;
const state=name=>{const b=definitions.find(b=>b.name===name);return b?(packed?b.id<<4:b.defaultState):0;};
const scene=(tiles,light=0xf0)=>({hasSky:true,dimension:0,timeOfDay:6000,getState:(x,y,z)=>tiles.get([x,y,z].join(','))||0,getSkyLight:()=>light>>4,getBlockLight:()=>light&15});
test('shadow quads stay on actual ground cells and do not float across empty space',()=>{
 const world=scene(new Map([['0,0,0',state('stone')]])),p={x:.9,y:1,z:.5},mesh=shadowGeometry(world,p,.6);
 assert.ok(mesh.length);for(let i=0;i<mesh.length;i+=9){assert.ok(mesh[i]+p.x<=1+1e-6&&mesh[i]+p.x>=-1e-6);assert.ok(Math.abs(mesh[i+1]+p.y-1.015625)<1e-6);assert.ok(mesh[i+3]>=-1e-6&&mesh[i+3]<=1+1e-6);}
 assert.equal(shadowGeometry(scene(new Map()),p,.6).length,0);
});
test('shadow height follows each block rather than a single height under the entity center',()=>{
 const mesh=shadowGeometry(scene(new Map([['0,0,0',state('stone')],['1,1,0',state('stone')]])),{x:1,y:2,z:.5},1.1);
 const heights=new Set();for(let i=1;i<mesh.length;i+=9)heights.add(Math.round(mesh[i]*1000)/1000);
 assert.ok(heights.has(-.984));assert.ok(heights.has(.016));
});
test('shadows fade with light and camera strength and reject liquid or invisible supports',()=>{
 const tiles=new Map([['0,0,0',state('stone')]]),p={x:.5,y:1,z:.5};assert.equal(shadowGeometry(scene(tiles,0),p,.5).length,0);
 const full=shadowGeometry(scene(tiles),p,.5,1),faded=shadowGeometry(scene(tiles),p,.5,.25);assert.ok(faded[8]<full[8]);
 assert.equal(shadowGeometry(scene(tiles),p,.5,0).length,0);
 for(const name of ['water','flowing_water','barrier'])if(state(name))assert.equal(shadowGeometry(scene(new Map([['0,0,0',state(name)]])),p,.5).length,0,name);
});
