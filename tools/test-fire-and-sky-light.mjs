import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Chunk} from '../client/js/world/chunk.js';
import {World} from '../client/js/world/world.js';
import {Hud} from '../client/js/gui/hud.js';
import {fireOverlayVertices,fireOverlayProjection} from '../client/js/render/fire-overlay.js';
import {mat4} from '../client/js/gfx/math.js';

test('empty light packets above build height cannot darken entities or weather',()=>{
 for(const hasSky of [true,false]){
  const w=new World();w.hasSky=hasSky;const c=new Chunk(0,0,hasSky);w.chunks.set(World.key(0,0),c);
  const update=w.updateLight578||w.updateLight498;
  if(update)update.call(w,{chunkX:0,chunkZ:0,skyLight:{0:new Uint8Array(2048).fill(255)},blockLight:{},emptySkyLightMask:0x3fffd,emptyBlockLightMask:0x3ffff});

  for(const y of [...(update?[64,128,255]:[]),256,257,270,271,272,512,2048]){assert.equal(w.getSkyLight(1,y,1),hasSky?15:0,'sky y='+y);assert.equal(w.getBlockLight(1,y,1),0,'block y='+y);}
  assert.equal(w.getSkyLight(1,-1,1),0);assert.equal(w.getBlockLight(1,-1,1),0);
 }
});
test('burning first-person Creative and Survival players retain the overlay with F1; Spectator does not',()=>{
 for(const mode of [0,1,2,3])for(const burning of [false,true]){
  let drawn=0;const hud=Object.create(Hud.prototype);hud.game={gameMode:mode,thirdPerson:0,hideGui:true,settings:{},effects:new Map(),selfMetadata:{0:burning?1:0},player:{creative:mode===1}};hud.renderFire=()=>drawn++;hud.render({width:640,height:360},0,{underwater:false});assert.equal(drawn,burning&&mode!==3?1:0);
 }
});
test('native fire planes overlap the middle and retain perspective at every aspect ratio',()=>{
 const vertices=fireOverlayVertices([0,0,1,1]);assert.equal(vertices.length,8*9);
 for(const [width,height]of [[640,360],[1280,360],[360,640]]){
  const matrix=mat4.multiply(mat4.create(),mat4.ortho(mat4.create(),0,width,height,0,-400000,400000),fireOverlayProjection(width,height)),project=[];
  for(let i=0;i<vertices.length;i+=9){const [x,y,z]=vertices.slice(i,i+3),w=matrix[3]*x+matrix[7]*y+matrix[11]*z+matrix[15];project.push([(matrix[0]*x+matrix[4]*y+matrix[8]*z+matrix[12])/w,(matrix[1]*x+matrix[5]*y+matrix[9]*z+matrix[13])/w]);}
  for(const quad of [project.slice(0,4),project.slice(4)]){assert.ok(Math.min(...quad.map(v=>v[0]))<0);assert.ok(Math.max(...quad.map(v=>v[0]))>0);assert.ok(Math.min(...quad.map(v=>v[1]))< -1);assert.ok(Math.max(...quad.map(v=>v[1]))>0);}
 }
});
