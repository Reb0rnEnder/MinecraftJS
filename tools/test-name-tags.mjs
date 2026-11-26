// Name tags per release (Render.renderLivingLabel / EntityRenderer.renderNameTag / PlayerRenderer.renderNameTag):
// scale (1.6/60 before 1.14, then 0.025), the sneaking drop (before 1.15), the deadmau5 lift, and the below-name
// objective label for players within 10 blocks with the name raised by 9 * 1.15 * scale.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EntityRenderer} from '../client/js/render/entity-renderer.js';
const pkg=readFileSync(new URL('../client/js/render/entity-renderer.js',import.meta.url),'utf8');
const NAME_TAG=eval('('+pkg.match(/const NAME_TAG = (\{[^}]*\})/)[1]+')');
function fixture({below=true,camDist=5}={}){
 const layouts=[];const font={width:s=>s.length*6,layout:(text,x,y)=>{layouts.push({text,x,y});return {quads:[]};}};
 const objectives=new Map([['kills',{displayName:'Kills',scores:new Map([['Alex',7]]),scoreInfo:new Map(),numberFormat:null}]]);
 const sb={belowName:below?'kills':null,objectives,displayName:(u,n)=>n,scoreText:(o,owner)=>String(o.scores.get(owner)??0)};
 const er=Object.create(EntityRenderer.prototype);
 er.game={scoreboard:sb,gui:{font,white:{}},hideGui:false,interaction:{target:null},entityId:1};er.device={createMesh:()=>({}),destroyMesh(){}};er.r={camPos:[0,64+camDist,0]};
 return {er,layouts};
}
const node=()=>({remove(){},add(){},position:{y:64}});
test('scale and sneaking drop follow this release',()=>{
 assert.ok(NAME_TAG.scale===0.025||Math.abs(NAME_TAG.scale-0.016666668*1.6)<1e-9);
 for(const sneak of [false,true]){
  const {er}=fixture({below:false}),v={root:{...node(),position:{y:64}}},e={kind:'player',name:'Alex',uuid:'u',height:sneak?1.5:1.8,sneaking:sneak,id:5};
  er._updateNameTag(e,v,{x:0,y:64,z:0});
  assert.ok(Math.abs(v.tag.position.y-(e.height+0.5-(NAME_TAG.sneakOffset&&sneak?0.25:0)))<1e-9);
  assert.ok(Math.abs(v.tag.scale.x-NAME_TAG.scale)<1e-9);
 }
});
test('below-name objective label within 10 blocks lifts the name; farther away only the name shows',()=>{
 const {er,layouts}=fixture(),v={root:node()},e={kind:'player',name:'Alex',uuid:'u',height:1.8,id:5};
 er._updateNameTag(e,v,{x:0,y:64,z:0});
 assert.ok(layouts.some(l=>l.text==='7 Kills'));assert.ok(Math.abs(v.tagBelow.position.y-2.3)<1e-9);
 assert.ok(Math.abs(v.tag.position.y-(2.3+9*1.15*NAME_TAG.scale))<1e-9);
 const far=fixture({camDist:12}),fv={root:node()};far.er._updateNameTag(e,fv,{x:0,y:64,z:0});
 assert.equal(fv.tagBelow,undefined);assert.ok(Math.abs(fv.tag.position.y-2.3)<1e-9);
});
test('deadmau5 is drawn 10 pixels higher',()=>{
 const {er,layouts}=fixture({below:false});er.makeLabel('deadmau5',false);er.makeLabel('Alex',false);
 assert.equal(layouts.find(l=>l.text==='deadmau5').y,-10);assert.equal(layouts.find(l=>l.text==='Alex').y,0);
});
