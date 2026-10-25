import assert from 'node:assert/strict';
import {test} from 'node:test';
import mcassets from '../lib/mcassets.js';
import {ZipFile} from '../lib/zip.js';
import {decodePng} from '../client/js/util/png.js';
import {Renderer} from '../client/js/render/renderer.js';
import {SoftwareDevice} from '../client/js/gfx/software.js';
import {setPlatform} from '../client/js/platform/platform.js';
import {ResourcePacksScreen} from '../client/js/gui/screens/packs.js';
import {VANILLA_UI} from '../client/js/gui/vanilla-layout.js';
const jar=new ZipFile(await mcassets.locateJar());

function renderer(t) {
  const old=globalThis.ImageData;
  globalThis.ImageData=class {constructor(data,width,height){Object.assign(this,{data,width,height});}};
  t.after(()=>{if(old===undefined)delete globalThis.ImageData;else globalThis.ImageData=old;});
  setPlatform({width:80,height:64,now:()=>0});
  const device=new SoftwareDevice({width:80,height:64,getContext:()=>({})});
  const img=decodePng(jar.read('assets/minecraft/textures/environment/end_sky.png'));
  const texture=device.createTexture({...img,wrap:'repeat'});
  const requests=[];
  const r=new Renderer(device,{texture:(name,opts)=>{requests.push([name,opts]);return name==='environment/end_sky.png'?texture:null;}});
  const state=dimension=>({dimension,worldTime:6000,partial:0,rain:0,thunder:0,temperature:0.8,lookDir:[0,0,1],camPos:[0,70,0],clouds:0});
  return {r,device,texture,img,requests,state};
}

test('End sky uses the native texture, covers all six directions, preserves depth and follows rotation rather than position',t=>{
  const {r,device,texture,requests,state}=renderer(t);r.updateEnvironment(state(1));
  for(const [yaw,pitch] of [[0,0],[90,0],[180,0],[270,0],[0,90],[0,-90],[45,40]]){
    r.setCamera(0,70,0,yaw,pitch,0,70);device.beginFrame([1,0,0]);r._drawSky();
    assert.ok(device.screen.color.every(c=>(c&255)<60 && ((c>>>8)&255)<60 && ((c>>>16)&255)<60),'all pixels receive the dark textured sky: '+[yaw,pitch]);
    assert.ok(new Set(device.screen.color).size>3,'sky texture detail must remain visible');
    assert.ok(device.screen.depth.every(d=>d===1),'sky must not occlude the world');
  }
  r.setCamera(0,70,0,35,20,0,70);device.beginFrame([1,0,0]);r._drawSky();const first=device.screen.color.slice();
  r.setCamera(12345,-500,-9000,35,20,0,70);device.beginFrame([1,0,0]);r._drawSky();assert.deepEqual(device.screen.color,first);
  assert.ok(requests.every(([name,opts])=>name==='environment/end_sky.png'&&opts.wrap==='repeat'));
  // Resource pack reload replaces the asset returned by texture(), not a cached sky texture.
  texture.u32.fill(0xff00ff00);device.beginFrame([1,0,0]);r._drawSky();
  assert.ok(device.screen.color.every(c=>(c&255)===0 && ((c>>>8)&255)===40 && ((c>>>16)&255)===0),'vanilla 40/255 tint; fog and lightmap do not tint the sky');
});

test('dimension transitions select End sky only in the End; Nether has no sky or clouds',t=>{
  const {r,device,requests,state}=renderer(t);
  for(const dim of [1,-1,0,1,-1]){
    r.updateEnvironment(state(dim));
    assert.equal(r.env.endSkyVisible,dim===1);assert.equal(r.env.skyVisible,dim===0);
    if(dim===-1){assert.equal(r.env.cloudsVisible,false);assert.deepEqual(r.fog.color,[0.2,0.03,0.03]);requests.length=0;device.beginFrame([1,0,0]);r._drawSky();assert.equal(requests.length,0);assert.ok(device.screen.color.every(c=>(c&255)===255));}
  }
});

test('resource-pack actions appear across the row and highlight only the icon action under the pointer',()=>{
  const screen=Object.create(ResourcePacksScreen.prototype);screen.game={settings:{touchscreen:false}};screen._icon=()=>null;
  const pack={name:'Test',format:VANILLA_UI.packFormat,description:'Description'};screen.selected=[pack,pack,pack];
  const calls=[],gui={tex:()=>null,rect(){},blit:(...a)=>calls.push(a),textWidth:()=>10,font:{wrap:s=>[s]},text(){}};
  const draw=(side,idx,mx,my,p=pack)=>{calls.length=0;screen._entry(gui,{side},p,idx,10,20,mx,my);return calls.map(a=>[a[3],a[4]]);};
  assert.deepEqual(draw(0,0,100,30),[[0,0]],'text hover shows the inactive add arrow');
  assert.deepEqual(draw(0,0,15,25),[[0,32]],'icon hover highlights add');
  assert.deepEqual(draw(0,0,100,54),[[0,0]],'bottom padding belongs to the row');
  assert.deepEqual(draw(0,0,100,56),[]);assert.deepEqual(draw(0,0,211,30),[]);
  assert.deepEqual(draw(1,1,100,30),[[32,0],[96,0],[64,0]],'all valid move/reorder controls show on text hover');
  assert.deepEqual(draw(1,1,15,25),[[32,32],[96,0],[64,0]]);
  assert.deepEqual(draw(1,1,35,25),[[32,0],[96,32],[64,0]]);
  assert.deepEqual(draw(1,1,35,45),[[32,0],[96,0],[64,32]]);
  assert.deepEqual(draw(1,0,100,30),[[32,0],[64,0]],'first entry cannot move up');
  assert.deepEqual(draw(1,2,100,30),[[32,0],[96,0]],'last entry cannot move down');
  screen.game.settings.touchscreen=true;assert.deepEqual(draw(0,0,-9999,-9999),[[0,0]]);
  assert.deepEqual(draw(1,0,15,25,null),[],'built-in default pack has no actions');
});
