// MinecraftJS extra: with VSync off, frames the display cannot show are not rendered, but every loop iteration
// still runs the frame's other work (ticks, input, chunk scheduling). Nothing is capped.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DisplayPacer} from '../client/js/render/display-pacer.js';
import {Game} from '../client/js/game/game.js';
import {setPlatform} from '../client/js/platform/platform.js';
import {Settings} from '../client/js/game/settings.js';
setPlatform({now:()=>0,requestFrame(){},vsync:false,loadSetting:()=>null,saveSetting(){}});
function pacerAt(hz){let cb=null;const p=new DisplayPacer(f=>{cb=f;});for(let i=0,t=0;i<30;i++,t+=1000/hz)cb(t);return p;}
test('the pacer measures the display refresh and only skips frames inside the current refresh',()=>{
  const p=pacerAt(144);assert.ok(Math.abs(p.interval-1000/144)<.01);
  assert.equal(p.shouldSkip(1000),false,'first frame renders');assert.equal(p.shouldSkip(1004),true);assert.equal(p.shouldSkip(1007),false);
  assert.equal(p.shouldSkip(2000),false,'a stall restarts the schedule instead of bursting');assert.equal(p.shouldSkip(2001),true);
  assert.equal(new DisplayPacer(()=>{}).shouldSkip(5),false,'unknown refresh rate never skips');
});
test('at 250 loop iterations per second on a 144 Hz display every iteration does its work but only ~144 render',()=>{
  let now=0;setPlatform({now:()=>now,requestFrame(){},vsync:false});
  const counts={render:0,schedule:0};
  const g=Object.assign(Object.create(Game.prototype),{settings:Object.assign(new Settings(),{maxFps:0,skipUndisplayedFrames:true}),profiler:{start(){},end(){},endFrame(){}},lastFrame:0,tickAccumulator:0,tick(){},input:{takeMouseDelta:()=>[0,0]},inWorld:false,
    _scheduleMeshes(){counts.schedule++;},device:{busy:()=>false},frameTimes:new Array(240).fill(0),frameTimeIndex:0,renderFrame(){counts.render++;},frames:0,fpsTimer:0,crashed:false,displayPacer:pacerAt(144)});
  for(let i=0;i<250;i++){now=i*4;g._frame(now);}
  assert.equal(counts.schedule,250,'every iteration still does its work');
  assert.ok(counts.render>=143&&counts.render<=145,'rendered '+counts.render);
  g.settings.skipUndisplayedFrames=false;counts.render=0;for(let i=250;i<500;i++){now=i*4;g._frame(now);}assert.equal(counts.render,250,'off: every frame renders');
  setPlatform({now:()=>now,requestFrame(){},vsync:true});g.settings.skipUndisplayedFrames=true;counts.render=0;for(let i=500;i<510;i++){now=i*4;g._frame(now);}assert.equal(counts.render,10,'with VSync the browser already paces frames');
});
test('the extra is on by default',()=>{assert.equal(new Settings().skipUndisplayedFrames,true);});
