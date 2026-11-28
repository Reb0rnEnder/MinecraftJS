// 1.20 powered heads: DragonHeadModel / PiglinHeadModel.setupAnim with SkullBlockEntity's animation ticks.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setJarModels} from '../client/js/render/entity-models.js';
import {setModelDevice} from '../client/js/render/boxmodel.js';
setModelDevice({createMesh:()=>({}),destroyMesh(){}});
import {skullModel} from '../client/js/render/tile-renderer.js';
setJarModels(JSON.parse(readFileSync(new URL('../client/assets/bundles/entity-models.json',import.meta.url),'utf8')));
const f=Math.fround;
test('dragon jaw and piglin ears follow the native formulas, resting at 0.2 and -0.7 / 0.7',()=>{
 const dragon=skullModel(5,{}),piglin=skullModel(6,{});
 const jaw=a=>f((Math.sin(f(f(a*f(Math.PI))*f(.2)))+1)*f(.2));
 const find=(n,pred)=>{let hit=null;n.traverse(x=>{if(!hit&&pred(x))hit=x;});return hit;};
 const jawNode=()=>find(dragon,x=>Math.abs(x.rotation.x-jaw(0))<1e-6);
 assert.ok(jawNode(),'resting jaw');
 dragon.skullAnimate(2.5);assert.ok(find(dragon,x=>Math.abs(x.rotation.x-jaw(2.5))<1e-6),'jaw at 2.5 ticks');
 assert.ok(find(piglin,x=>Math.abs(x.rotation.z+0.7)<1e-6)&&find(piglin,x=>Math.abs(x.rotation.z-0.7)<1e-6),'resting ears');
 piglin.skullAnimate(3);const l=f(-(Math.cos(f(f(f(3*f(Math.PI))*f(.2))*f(1.2)))+2.5)*f(.2)),r=f((Math.cos(f(f(3*f(Math.PI))*f(.2)))+2.5)*f(.2));
 assert.ok(find(piglin,x=>Math.abs(x.rotation.z-l)<1e-6)&&find(piglin,x=>Math.abs(x.rotation.z-r)<1e-6),'ears at 3 ticks');
});
