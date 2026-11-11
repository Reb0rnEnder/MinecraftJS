import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ZipFile} from '../lib/zip.js';
import {CORE_GUI_SPRITES,legacyGuiSprite} from '../client/js/gui/sprites-1.20.6.js';
import {Gui} from '../client/js/gui/gui.js';
import {Assets} from '../client/js/assets.js';

test('every migrated GUI sprite exists in the exact target client jar',()=>{
  const jar=new ZipFile(new URL('../cache/port-1.20.6/client.jar',import.meta.url));
  for(const path of CORE_GUI_SPRITES)assert.ok(jar.read('assets/minecraft/textures/'+path),path);
  const logo=jar.read('assets/minecraft/textures/gui/title/minecraft.png');assert.equal(logo.readUInt32BE(16),1024);assert.equal(logo.readUInt32BE(20),256);
  assert.equal(jar.read('assets/minecraft/textures/gui/widgets.png'),null);
});

test('hotbar, selected slot, hearts and cropped progress use native sprites with normalized UVs',()=>{
  assert.equal(legacyGuiSprite('gui/widgets.png',0,0,182,22).path,'gui/sprites/hud/hotbar.png');
  assert.equal(legacyGuiSprite('gui/widgets.png',0,22,24,23).v1,1);
  const health=legacyGuiSprite('gui/icons.png',52,0,9,9);assert.equal(health.path,'gui/sprites/hud/heart/full.png');
  const progress=legacyGuiSprite('gui/icons.png',0,89,91,5);assert.equal(progress.u1,.5);
  const calls=[],fake={tex:path=>({path}),quad:(...args)=>calls.push(args)};
  Gui.prototype.blit.call(fake,'gui/widgets.png',4,5,0,0,182,22);
  assert.equal(calls[0][0].path,'gui/sprites/hud/hotbar.png');assert.deepEqual(calls[0].slice(1,9),[4,5,186,27,0,0,1,1]);
});

test('native nine-slice sprites cover the destination exactly while preserving their borders',()=>{
  for(const [w,h] of [[200,20],[98,20],[20,20],[7,5],[300,40]]){
    const quads=[],path='gui/sprites/widget/button.png',fake={assets:{guiSpriteScaling:new Map([[path,{type:'nine_slice',width:200,height:20,border:3}]])},tex:()=>({}),quad:(t,x,y,x1,y1,u,v,u1,v1)=>quads.push({x,y,x1,y1,u,v,u1,v1})};
    Gui.prototype.sprite.call(fake,'widget/button',0,0,w,h);
    assert.equal(quads.reduce((area,q)=>area+(q.x1-q.x)*(q.y1-q.y),0),w*h);
    for(const q of quads){assert.ok(q.x>=0&&q.y>=0&&q.x1<=w&&q.y1<=h);assert.ok(q.u>=0&&q.v>=0&&q.u1<=1&&q.v1<=1);}
  }
});

test('sprite metadata belongs to the pack supplying its PNG and malformed tile sizes cannot hang rendering',async()=>{
  const path='gui/sprites/widget/button.png',base={type:'nine_slice',width:200,height:20,border:3};
  const fake=()=>({version:1,guiSpriteScaling:new Map(),guiSpriteLoads:new Map(),defaultGuiSprites:{[path]:base},packs:[],async imageAsync(){return{}}});
  let a=fake();assert.deepEqual(await Assets.prototype.loadGuiSprite.call(a,path),base);
  a=fake();a.packs=[{has:()=>true,read:()=>null}];assert.deepEqual(await Assets.prototype.loadGuiSprite.call(a,path),{type:'stretch'});
  a=fake();a.packs=[{has:()=>true,read:()=>new TextEncoder().encode(JSON.stringify({gui:{scaling:{type:'tile',width:0,height:16}}}))}];
  await assert.rejects(Assets.prototype.loadGuiSprite.call(a,path),/dimensions/);
});
