// GUI scale regressions derived from this release's native scale code (remainder rules).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as scale from '../client/js/gui/gui-scale.js';
const kind='remainder';
test('GUI scale follows the native calculation, including Unicode rounding',()=>{
 const c=scale.calculateGuiScale;
 assert.equal(c(640,480,0,false),2);assert.equal(c(1920,1080,0,false),4);assert.equal(c(1920,1080,2,false),2);assert.equal(c(3840,2160,0,false),9);
 if(kind==='legacy'){
  // ScaledResolution: odd scales round down, except 1.
  assert.equal(c(960,720,0,true),2);assert.equal(c(320,240,0,true),1);assert.equal(c(1920,1080,3,true),2);assert.equal(c(1920,1080,0,true),4);
 }else{
  // Window.calculateScale: odd scales round up, and the loop is bounded by the framebuffer.
  assert.equal(c(960,720,0,true),4);assert.equal(c(320,240,0,true),2);assert.equal(c(1920,1080,3,true),4);assert.equal(c(1920,1080,3,false),3);
 }
});
test('GUI scale option cycles over the native range',()=>{
 if(kind==='legacy'){assert.equal(scale.nextGuiScale,undefined);assert.match(readFileSync(new URL('../client/js/gui/screens/options.js',import.meta.url),'utf8'),/s\.guiScale = \(s\.guiScale \+ 1\) % 4/);return;}
 const n=scale.nextGuiScale,seen=[];let v=0;do{seen.push(v);v=n(3840,2160,v);}while(v!==0);assert.deepEqual(seen,[...Array(10).keys()]);
 assert.equal(n(1920,1080,4),0);assert.equal(n(1920,1080,6),kind==='remainder'?2:0);assert.equal(n(640,480,1,true),2);
});
test('the GUI resizes through the shared native helper',()=>{
 assert.match(readFileSync(new URL('../client/js/gui/gui.js',import.meta.url),'utf8'),/calculateGuiScale\(w,h,this\.guiScaleSetting,!!this\.font\.unicode\)/);
});
