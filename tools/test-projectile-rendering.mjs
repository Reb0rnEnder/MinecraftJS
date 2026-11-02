import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EntityManager} from '../client/js/game/entities.js';
import {EntityRenderer} from '../client/js/render/entity-renderer.js';
import {Node} from '../client/js/gfx/scene.js';
import {setJarModels} from '../client/js/render/entity-models.js';
import {setModelDevice} from '../client/js/render/boxmodel.js';
import mcassets from '../lib/mcassets.js';
const legacy=['1.8.9','1.12.2'].includes(mcassets.MC_VERSION);
const types=legacy?null:(await import('../client/js/game/entity-types.js')).OBJECT_TYPES;
const cases=[['snowball',61,332],['egg',62,344],['ender_pearl',65,368],['eye_of_ender',72,381],['potion',73,373],['experience_bottle',75,384],['small_fireball',64,385],['fireball',63,385],['firework_rocket',76,401],['wither_skull',66,0]];
const bundle=new URL('../client/assets/bundles/entity-models.json',import.meta.url);
setJarModels(JSON.parse(readFileSync(bundle)));
function fixture(){
 const device={createMesh:(format,data,options)=>({format,data,options})};setModelDevice(device);
 const seen=[],byName=new Map(cases.map(([name,,id],i)=>[name==='eye_of_ender'?'ender_eye':name==='potion'?'splash_potion':name,id?{id:i+1}:{}]));
 byName.set('fire_charge',{id:200});
 const game={items:{byName,potionColor:()=>0x123456},assets:{atlas:{entries:new Map([['sprite',{uv:[0,0,1,1]}],['liquid',{uv:[0,0,1,1]}]])}},
 itemRenderer:{iconKey:s=>String(s.id),modelFor:s=>{seen.push(s);return{layers:s.custom?['liquid','sprite']:['sprite']};}},entityRenderer:{remove(){}},world:{}};
 const manager=new EntityManager(game),renderer=Object.assign(Object.create(EntityRenderer.prototype),{game,device,atlasTex:{},group:new Node(),visuals:new Map(),_cachedMesh:(key,make)=>make(),_mat:()=>({})});
 return{manager,renderer,seen,byName};
}
for(const[name,oldId,oldItem]of cases)test(mcassets.MC_VERSION+': wire spawn renders '+name,()=>{
 const{manager,renderer,seen,byName}=fixture();
 const wire=legacy?oldId:Number(Object.keys(types).find(id=>types[id].name===name));assert.ok(Number.isInteger(wire),name+' exists in native registry');
 manager.spawnObject({entityId:1,type:wire,x:0,y:64,z:0,yaw:0,pitch:0,objectData:0});const e=manager.get(1);assert.equal(e.kind,'projectile');
 if(name==='potion')e.item={id:999,count:1,custom:true};
 const v=renderer._build(e);assert.ok(v.root.children.length,name+' has visible geometry');
 if(name==='wither_skull'){assert.equal(seen.length,0);return;}
 assert.ok(v.billboard);assert.equal(v.billboard.billboard,true);assert.equal(v.billboard.scale.x,name==='fireball'?2:.5);
 if(name==='potion' && mcassets.MC_VERSION!=='1.8.9'){assert.equal(seen[0],e.item);assert.equal(v.billboard.drawables.length,2,'metadata potion tint layer survives');}
 else assert.equal(seen[0].id,legacy?oldItem:byName.get(['small_fireball','fireball'].includes(name)?'fire_charge':name==='eye_of_ender'?'ender_eye':name).id);
});
