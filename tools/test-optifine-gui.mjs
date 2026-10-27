import{test}from'node:test';import assert from'node:assert/strict';
import{ShaderPacksScreen,ShaderOptionsScreen}from'../client/js/gui/screens/shaders.js';import{setPlatform}from'../client/js/platform/platform.js';
function fixture(){return {gui:{width:640,height:360,font:{width:s=>s.length*6,trimToWidth:s=>s,wrap:s=>[s]}},shaderPack:{error:'',options:{},availableOptions:[{name:'OPTION',label:'Test option',description:'First sentence. Second sentence.',values:['false','true'],default:'false',toggle:true}]},device:{createFinalShaderPass(){}}};}
test('main shader screen matches G6 native list and right/bottom control coordinates',()=>{
 const s=new ShaderPacksScreen(fixture(),{});s.init();assert.equal(s.list.top,30);assert.equal(s.list.bottom,310);assert.equal(s.list.slotHeight,16);assert.equal(s.list.width,500);assert.equal(s.list.listWidth,480);
 for(let i=0;i<8;i++){const b=s.buttons.find(b=>b.id===10+i);assert.deepEqual([b.x,b.y,b.w,b.h],[510,30+i*20,120,20]);assert.equal(b.enabled,false);}
 const done=s.buttons.find(b=>b.id===3),options=s.buttons.find(b=>b.id===4),folder=s.buttons.find(b=>b.id===0);assert.deepEqual([done.x,done.y,done.w],[300,335,150]);assert.deepEqual([options.x,options.y,options.w],[510,335,120]);assert.deepEqual([folder.x,folder.y,folder.w],[50,335,129]);
});
test('option tooltips wait 700ms and draw after all buttons at the native tooltip rectangle',()=>{
 let now=0;setPlatform({now:()=>now});const g=fixture(),s=new ShaderOptionsScreen(g,{});s.init();const draws=[],gui={...g.gui,worldBackground(){},dirtBackground(){},textCentered(){},button(){draws.push('button');},rect(...args){draws.push(['tooltip',...args]);},text(...args){draws.push(['text',...args]);}};
 const x=s.buttons[0].x+1,y=31;s.render(gui,x,y,0);assert.equal(draws.some(Array.isArray),false);now=699;s.render(gui,x,y,0);assert.equal(draws.some(Array.isArray),false);now=700;draws.length=0;s.render(gui,x,y,0);
 const index=draws.findIndex(x=>Array.isArray(x)&&x[0]==='tooltip');assert.ok(index>draws.lastIndexOf('button'));assert.deepEqual(draws[index],['tooltip',170,158,470,252,0xe0000000]);assert.ok(draws.some(x=>Array.isArray(x)&&x[1]==='- Second sentence'));
 draws.length=0;s.render(gui,x+10,y,0);assert.equal(draws.some(Array.isArray),false);
});
