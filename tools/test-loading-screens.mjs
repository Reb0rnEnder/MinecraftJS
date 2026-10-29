import{test}from'node:test';import assert from'node:assert/strict';
import{LOADING_STYLE,loadingScale,loadingLayout,loadingLogoQuads,loadingRects,loadingProgress,renderLoadingOverlay}from'../client/js/render/loading-overlay.js';
import{setPlatform}from'../client/js/platform/platform.js';
test('startup uses native integer GUI scale and version-specific logo dimensions',()=>{
 assert.equal(loadingScale(1920,1080),4);assert.equal(loadingScale(1920,1080,2),2);assert.equal(loadingScale(300,200),1);
 const l=loadingLayout(900,400);assert.deepEqual(l.logo,LOADING_STYLE==='studios'?[250,150,400,100]:[322,72,256,256]);
 const quads=loadingLogoQuads(l);assert.equal(quads.length,LOADING_STYLE==='studios'?2:1);
 if(LOADING_STYLE==='studios'){assert.equal(quads[0][4],-.0625/120);assert.equal(quads[1][4],.0625/120);assert.deepEqual(l.bar,[250,328,650,338]);}
 else assert.deepEqual(l.bar,[300,300,600,310]);
});
test('progress uses native smoothing, outlines, fill colors and correct atlas blending',()=>{
 const l=loadingLayout(900,400),rects=loadingRects(l,.5),blend=[];assert.ok(Math.abs(loadingProgress(0,1)-.05)<.000001);
 assert.ok(rects.every(([x,y,r,b])=>[x,y,r,b].every(Number.isFinite)));
 if(LOADING_STYLE==='legacy')assert.deepEqual(rects,[]);
 else if(LOADING_STYLE==='studios'){assert.equal(rects.length,5);assert.deepEqual(rects[4],[252,330,449,336,[1,1,1,1]]);}
 else{assert.equal(rects.length,3);assert.deepEqual(rects[0],[299,299,601,311,[0,0,0,1]]);assert.deepEqual(rects[2][4],[226/255,40/255,55/255,1]);}
 renderLoadingOverlay({width:900,height:400,rect(){},tex:()=>({}),quad(){},setBlend:b=>blend.push(b)},.5);
 assert.deepEqual(blend,[LOADING_STYLE==='studios'?'add':'alpha','alpha']);
});
if(LOADING_STYLE!=='legacy')test('resource reload blocks input and fades over its parent before completion',async()=>{
 const{ResourceLoadingScreen}=await import('../client/js/gui/screens/loading.js');let time=0,rendered=0;setPlatform({now:()=>time});
 const gui={width:900,height:400,rect(){},tex:()=>null},parent={init(){},render(){rendered++;}},screen=new ResourceLoadingScreen({gui},parent);
 screen.init();const done=screen.finish();assert.equal(screen.key({code:'Escape'}),true);screen.render(gui,0,0,0);assert.equal(rendered,1);
 time=1500;screen.render(gui,0,0,0);assert.ok(screen.resolve);time=2000;screen.render(gui,0,0,0);await done;assert.equal(screen.resolve,null);
});
