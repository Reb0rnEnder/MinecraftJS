import {test} from 'node:test';import assert from 'node:assert/strict';import {ItemRenderer} from '../client/js/render/item-renderer.js';
test('block items cull opposing coplanar faces without mutating the shared item material',()=>{
 const material={pipeline:'entity',params:{p:new Float32Array(16)},state:{cull:false,blend:'alpha'}},mesh={};
 const r={game:{items:{hasEffect:()=>false}},meshFor:()=>({mesh,model:{kind:'block',name:'big_dripleaf'}})};
 const object=ItemRenderer.prototype.objectFor.call(r,{id:1},material,true),draw=object.obj.drawables[0];assert.equal(draw.mesh,mesh);assert.equal(draw.mat.state.cull,true);assert.equal(draw.mat.state.blend,'alpha');assert.equal(draw.mat.params,material.params);assert.equal(material.state.cull,false);
 r.meshFor=()=>({mesh,model:{kind:'generated',name:'stick'}});const sprite=ItemRenderer.prototype.objectFor.call(r,{id:2},material,true);assert.equal(sprite.obj.drawables[0].mat,material);
});
