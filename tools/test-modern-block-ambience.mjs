import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {Particles} from '../client/js/render/particles.js';import {initBlocks,findState} from '../client/js/world/blocks.js';
const json=n=>JSON.parse(readFileSync(new URL('../client/data/'+n+'.json',import.meta.url)));initBlocks(json('blocks'),json('blockCollisionShapes'));
function system(){const p=Object.create(Particles.prototype),calls=[];p.game={player:{creative:false},sound:{play(){}},world:{getState:()=>0,isRainingAt:()=>false}};for(const name of ['smoke','flame','reddust','portal','nativeParticle'])p[name]=(...args)=>calls.push([name,...args]);return {p,calls};}
test('flattened lit furnace and wall torch properties produce their visible effects',()=>{
 const {p,calls}=system();p.randomDisplayTick(0,64,0,findState('furnace',{lit:'true',facing:'north'}));assert.ok(calls.some(a=>a[0]==='flame'&&a[3]<0));
 calls.length=0;p.randomDisplayTick(0,64,0,findState('furnace',{lit:'false'}));assert.equal(calls.length,0);
 p.randomDisplayTick(0,64,0,findState('wall_torch',{facing:'north'}));assert.ok(calls.some(a=>a[0]==='flame'&&a[3]>.5));
});
test('flattened portal identity and wire power reach their effects',()=>{
 const {p,calls}=system();p.randomDisplayTick(0,64,0,findState('nether_portal'));assert.equal(calls.filter(a=>a[0]==='portal').length,4);
 calls.length=0;p.randomDisplayTick(0,64,0,findState('redstone_wire',{power:'15'}));assert.ok(calls.some(a=>a[0]==='reddust'));
});
