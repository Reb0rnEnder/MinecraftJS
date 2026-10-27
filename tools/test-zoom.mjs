import{test}from'node:test';import assert from'node:assert/strict';import{zoomActive,zoomFov,smoothCameraActive}from'../client/js/game/zoom.js';import{Settings,DEFAULT_KEYS}from'../client/js/game/settings.js';import{setPlatform}from'../client/js/platform/platform.js';
test('C zoom quarters FOV only while held in the world, respects rebinding, and preserves the cinematic setting',()=>{
 let now=0;const store=new Map();setPlatform({now:()=>now,loadSetting:k=>store.get(k),saveSetting:(k,v)=>store.set(k,v)});const settings=new Settings(),down=new Set(),g={settings,inWorld:true,screens:{current:null},input:{locked:true,down,isDown:bind=>down.has(settings.keys[bind])},smoothCamera:false};
 assert.equal(DEFAULT_KEYS.zoom,'KeyC');assert.equal(zoomFov(g,70),70);down.add('KeyC');assert.equal(zoomFov(g,70),70);now=75;assert.equal(zoomFov(g,70),43.75);now=150;assert.equal(zoomFov(g,70),17.5);assert.equal(smoothCameraActive(g),true);assert.equal(g.smoothCamera,false);
 down.add('F3');assert.equal(zoomActive(g),false);down.delete('F3');g.screens.current={};assert.equal(zoomActive(g),false);g.screens.current=null;
 settings.keys.zoom='KeyZ';settings.save();assert.equal(new Settings().keys.zoom,'KeyZ');assert.equal(zoomActive(g),false);down.add('KeyZ');assert.equal(zoomActive(g),true);g._smoothCam={yaw:100};smoothCameraActive(g);down.clear();assert.equal(smoothCameraActive(g),false);assert.equal(g._smoothCam,null);
 g.smoothCamera=true;assert.equal(smoothCameraActive(g),true);g.inWorld=false;assert.equal(zoomFov(g,70),70);
});

test('zoom reversal starts at the current FOV instead of snapping to either endpoint',()=>{
 let now=0,held=false;setPlatform({now:()=>now});const g={inWorld:true,input:{locked:true,isDown:()=>held,down:new Set()},screens:{current:null}};
 assert.equal(zoomFov(g,80),80);held=true;zoomFov(g,80);now=75;const mid=zoomFov(g,80);held=false;assert.equal(zoomFov(g,80),mid);now=225;assert.equal(zoomFov(g,80),80);
});
