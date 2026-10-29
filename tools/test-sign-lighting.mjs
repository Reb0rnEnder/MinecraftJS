import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TileEntityRenderer} from '../client/js/render/tile-renderer.js';
import {VANILLA_UI} from '../client/js/gui/vanilla-layout.js';
test('world sign glyph materials track ambient light after a light update',()=>{
 const lightmapData=new Uint8Array(1024);lightmapData.set([64,96,128,255],0);lightmapData.set([200,210,220,255],1020);
 let light=0;
 const game={settings:{renderDistance:4},world:{getSkyLight:()=>light,getBlockLight:()=>light},renderer:{entityRoot:{add(){}},camPos:[0,64,0],boxVisible:()=>true,lightmapData}};
 const renderer=new TileEntityRenderer(game);renderer._renderMoving=()=>{};
 const params=new Float32Array([1,1,1,1]),tile={x:0,y:64,z:0,type:'sign',built:true,obj:{},mat:{params:{setLight(){}}},signTextParams:[params]};
 renderer.tiles.set('0,64,0',tile);renderer.render(0);
 for(let i=0;i<3;i++)assert.ok(Math.abs(params[i]-lightmapData[i]/255)<1e-6);
 light=15;renderer.render(0);assert.ok(Math.abs(params[0]-200/255)<1e-6);
 if(VANILLA_UI.version==='1.17.1'){
  // A black glowing sign always has an outline, regardless of view distance.
  tile.data={GlowingText:1,Color:'black'};tile.signOutlined=true;renderer.render(0);assert.deepEqual([...params],[1,1,1,1]);
 }
});
if (['1.16.5','1.17.1'].includes(VANILLA_UI.version)) test('Nether wood standing and wall signs are registered as sign block entities',async()=>{
 const {isSign,signWood}=await import('../client/js/game/signs-1.14.4.js');
 for(const wood of ['crimson','warped'])for(const suffix of ['_sign','_wall_sign']){assert.equal(isSign(wood+suffix),true);assert.equal(signWood(wood+suffix),wood);}
});
