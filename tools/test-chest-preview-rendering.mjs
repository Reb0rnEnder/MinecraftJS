import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import mcassets from '../lib/mcassets.js';import * as blocks from '../client/js/world/blocks.js';
import {setJarModels} from '../client/js/render/entity-models.js';import {setModelDevice} from '../client/js/render/boxmodel.js';
import {ItemRenderer} from '../client/js/render/item-renderer.js';import {TileEntityRenderer} from '../client/js/render/tile-renderer.js';import {EntityRenderer} from '../client/js/render/entity-renderer.js';import {Node} from '../client/js/gfx/scene.js';import {mat4} from '../client/js/gfx/math.js';
const read=p=>JSON.parse(readFileSync(new URL('../client/'+p,import.meta.url))),modern=['1.15.2','1.16.5','1.17.1','1.18.2'].includes(mcassets.MC_VERSION);
blocks.initBlocks(read('data/blocks.json'),read('data/blockCollisionShapes.json'));setJarModels(read('assets/bundles/entity-models.json'));
const device={createMesh:(format,cpu,opts)=>({format,cpu,...opts}),destroyMesh(){}};setModelDevice(device);
function meshes(root){root.updateWorld();return root.collect([]);}
function bounds(draw){const v=draw.d.mesh.cpu,m=draw.world,min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<v.length;i+=11){const p=mat4.transformPoint(m,v[i],v[i+1],v[i+2]);for(let j=0;j<3;j++){min[j]=Math.min(min[j],p[j]);max[j]=Math.max(max[j],p[j]);}}return{min,max};}
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
test('chest item base sits on y=0 and lid is above the base for all three chest items',()=>{
 const r=new ItemRenderer({assets:{},device});for(const name of ['chest','trapped_chest','ender_chest']){
  const node=r._builtinObject({}, {name},true),draws=meshes(node),body=bounds(draws[2]),lid=bounds(draws[0]);
  close(body.min[1],0);close(body.max[1],10/16);close(lid.min[1],9/16);close(lid.max[1],14/16);const lock=bounds(draws[1]);close(lock.min[2],15/16);close(lock.max[2],1);
 }
});
if(modern)test('native double chest meshes meet at the seam with two adjacent lock halves',()=>{
 const root=new Node(),g={device,renderer:{entityRoot:root}},r=new TileEntityRenderer(g),body=[],locks=[];
 for(const [type,x] of [['right',0],['left',1]]){
  const state=blocks.findState('chest',{type,facing:'south',waterlogged:'false'});g.world={getState:()=>state};const t={type:'chest',state,x,y:0,z:0};r._build(t);const draws=meshes(t.obj);body.push(bounds(draws[2]));locks.push(bounds(draws[1]));
 }
 close(body[0].min[0],1/16);close(body[0].max[0],1);close(body[1].min[0],1);close(body[1].max[0],31/16);
 close(locks[0].min[0],15/16);close(locks[0].max[0],1);close(locks[1].min[0],1);close(locks[1].max[0],17/16);
});
test('actual inventory player preview selects its dedicated lighting while staying full-bright',()=>{
 const renderer={game:{player:{sneaking:false},inventory:{held:()=>null},ticks:0},skinFor:()=>({slim:false}),skinTex:()=>null};
 EntityRenderer.prototype.drawPlayerInGui.call(renderer,{drawNode(){}},50,75,30,0,0);
 assert.equal(renderer._guiMat.params.p[11],3);assert.equal(renderer._guiMat.params.p[10],1);
});
