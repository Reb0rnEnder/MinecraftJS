// 1.20.5+ ReceivingLevelScreen: the loading reason picks the nether portal sprite, the end portal shader, or the
// panorama with blur and the menu background; Escape is ignored and the screen gives up after 30 seconds.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setTranslator} from '../client/js/gui/i18n.js';
import {DownloadingTerrainScreen,levelLoadingReason} from '../client/js/gui/screens/menus.js';
setTranslator(k=>k);

test('determineLevelLoadingReason',()=>{
 assert.equal(levelLoadingReason(false,'minecraft:the_nether','minecraft:overworld'),'nether');
 assert.equal(levelLoadingReason(false,'minecraft:overworld','minecraft:the_nether'),'nether');
 assert.equal(levelLoadingReason(false,'minecraft:the_end','minecraft:the_nether'),'nether','either side in the Nether wins');
 assert.equal(levelLoadingReason(false,'minecraft:overworld','minecraft:the_end'),'end');
 assert.equal(levelLoadingReason(true,'minecraft:the_nether','minecraft:overworld'),'other','dead players respawn without a portal background');
 assert.equal(levelLoadingReason(false,'minecraft:overworld','minecraft:overworld'),'other');
});

function fixture(reason){
 const calls=[],closed={v:false};
 const gui={width:400,height:240,quad:(...a)=>calls.push(['quad',...a]),drawMesh:(d)=>calls.push(['mesh',d]),textCentered:(...a)=>calls.push(['text',...a]),setBlend:(b)=>calls.push(['blend',b]),menuBackground:(w)=>calls.push(['menu',w])};
 const game={gui,assets:{atlas:{entries:new Map([['block/nether_portal',{uv:[0.1,0.2,0.3,0.4]}]])},atlasTexture:'atlas',texture:()=>({})},
  device:{width:800,height:480,createMesh:()=>({}),destroyMesh(){}},world:{worldAge:100,isLoaded:()=>false},player:{x:0,z:0},inWorld:true,
  screens:{close(){closed.v=true;}}};
 const s=new DownloadingTerrainScreen(game,reason);return {s,gui,calls,closed};
}

test('backgrounds per reason',()=>{
 const n=fixture('nether');n.s.render(n.gui,0,0,0);
 assert.deepEqual(n.calls.filter(c=>c[0]==='blend').map(c=>c[1]),['none','alpha']);assert.deepEqual(n.calls.find(c=>c[0]==='quad').slice(1,10),['atlas',0,0,400,240,0.1,0.2,0.3,0.4]);
 const e=fixture('end');e.s.render(e.gui,0,0,0);const meshes=e.calls.filter(c=>c[0]==='mesh');
 assert.equal(meshes.length,16,'sky plus 15 portal layers');assert.ok(meshes.every(m=>m[1].pipeline==='endportal'));
 const o=fixture('other');assert.equal(o.s.panoramaBackground,true);assert.equal(o.s.usesMenuBackground,true);o.s.render(o.gui,0,0,0);assert.deepEqual(o.calls.find(c=>c[0]==='menu'),['menu',true],'the in-world menu background (the level exists)');
 for(const f of [n,e,o])assert.ok(f.calls.some(c=>c[0]==='text'&&c[1]==='multiplayer.downloadingTerrain'&&c[3]===120-50));
});

test('Escape is swallowed and the screen closes after 30 seconds without a ready level',()=>{
 const {s,closed}=fixture('other');assert.equal(s.key({code:'Escape'}),true);
 for(let i=0;i<600;i++)s.tick();assert.equal(closed.v,false);s.tick();assert.equal(closed.v,true);
});
