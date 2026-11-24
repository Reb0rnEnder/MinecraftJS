// MicroProfiler extra: wraps subsystems into profiler sections only while enabled, records every frame (sections,
// frame time, rendered or not, draw calls), times packets, exports JSON and Chrome traces, and draws an overlay.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setPlatform} from '../client/js/platform/platform.js';
import {setTranslator} from '../client/js/gui/i18n.js';
import {Profiler} from '../client/js/game/profiler.js';
import {MicroProfiler,CAPACITY} from '../client/js/game/microprofiler.js';
import {MinecraftJSExtrasScreen,MicroProfilerScreen} from '../client/js/gui/screens/options.js';
let now=0,saved=null;setPlatform({now:()=>now,saveFile:(n,b)=>{saved={n,b};},loadSetting:()=>null,saveSetting(){}});setTranslator((k,a)=>a?.length?k+':'+a.flat().join(','):k);
class Renderer{render(){now+=3;}}
function fakeGame(){
  const P=new Profiler(),g={profiler:P,settings:{},renderer:new Renderer(),entities:{map:new Map([[1,{}]]),tick(){now+=1;}},world:{chunks:new Map([[1,1],[2,2]])},
    device:{draw(){},endFrame(){}},hud:{render(){}},handlePacket(p){now+=2;},tick(){this.entities.tick();},renderFrame(){this.renderer.render();this.device.draw();this.device.draw();}};
  // one game-loop frame shaped like Game._frame: root > tick, then gameRenderer when it renders
  g.frame=(render=true)=>{P.start('root');P.start('tick');g.tick();P.end();if(render){P.start('gameRenderer');g.renderFrame();P.end();}P.end();P.endFrame();now+=1;};
  return g;
}
test('enabling wraps subsystems into nested sections; disabling restores the originals exactly',()=>{
  const g=fakeGame(),proto=Renderer.prototype.render,ownTick=g.tick,mp=new MicroProfiler(g);g.profiler.enabled=true;
  mp.setEnabled(true);assert.notEqual(g.renderer.render,proto);
  for(let i=0;i<10;i++)g.frame(i%2===0);
  const st=mp.stats();assert.equal(st.frames,10);
  const row=p=>st.rows.find(r=>r.path===p);
  assert.ok(row('root.gameRenderer.frame.world').avg>0,'renderer.render nested under the wrapped renderFrame');
  assert.ok(row('root.tick.gameTick.entities'),'entities.tick nested under the game tick');
  assert.equal(mp.rendered.slice(0,10).reduce((a,b)=>a+b,0),5);assert.equal(mp.draws[0],2);assert.equal(mp.chunkCount[0],2);
  mp.setEnabled(false);assert.equal(g.renderer.render,proto);assert.ok(!Object.hasOwn(g.renderer,'render'),'prototype method restored by removing the wrapper');assert.equal(g.tick,ownTick);assert.equal(g.profiler.onFrame,null);
});
test('packets are timed by name; the ring buffer keeps the newest frames',()=>{
  const g=fakeGame(),mp=new MicroProfiler(g);g.profiler.enabled=true;mp.setEnabled(true);
  g.handlePacket({name:'chunk_data'});g.handlePacket({name:'chunk_data'});g.handlePacket({name:'keep_alive'});g.frame();
  const ps=mp.packetStats();assert.equal(ps[0].name,'chunk_data');assert.equal(ps[0].count,2);assert.ok(Math.abs(ps[0].ms-4)<1e-9);
  for(let i=0;i<CAPACITY+5;i++)g.frame();assert.equal(mp.count,CAPACITY);assert.equal(mp.recent().length,CAPACITY);
  mp.paused=true;const before=mp.head;g.frame();assert.equal(mp.head,before,'paused capture records nothing');
});
test('exports: JSON summary/frames and a Chrome trace with nested complete events and counters',()=>{
  const g=fakeGame(),mp=new MicroProfiler(g);g.profiler.enabled=true;mp.setEnabled(true);for(let i=0;i<4;i++)g.frame();g.handlePacket({name:'x'});
  const json=mp.toJSON();assert.equal(json.format,'minecraftjs-microprofiler');assert.equal(json.frames.length,4);assert.ok(json.frames[0].sections['root.tick']>0);assert.equal(json.packets[0].name,'x');
  const trace=mp.toTrace(),ev=trace.traceEvents;assert.ok(ev.some(e=>e.ph==='X'&&e.name==='world'&&e.args.path==='root.gameRenderer.frame.world'));
  const frame=ev.find(e=>e.ph==='X'&&e.name==='frame'),world=ev.find(e=>e.name==='world');assert.ok(world.ts>=frame.ts,'children start inside their frame');
  assert.ok(ev.some(e=>e.ph==='C'&&e.name==='draw calls'));
  const n=mp.export('trace');assert.ok(saved.n.startsWith('minecraftjs-trace-')&&saved.b.length===n);
});
test('overlay draws inside the GUI after the HUD, without being counted as HUD time',()=>{
  const g=fakeGame(),mp=new MicroProfiler(g);g.profiler.enabled=true;mp.setEnabled(true);for(let i=0;i<30;i++)g.frame();
  const calls={rect:0,text:[]},gui={width:427,height:240,rect(){calls.rect++;},text:(s)=>calls.text.push(s),textWidth:s=>s.length*6};
  g.hud.render(gui);assert.ok(calls.text[0].startsWith('MicroProfiler'));assert.ok(calls.rect>30,'graph columns drawn');
  mp.overlay='off';calls.text.length=0;g.hud.render(gui);assert.equal(calls.text.length,0);
});
test('extras are grouped into category pages; Debug holds the MicroProfiler toggle and page',()=>{
  const opened=[],g={settings:{microprofiler:false,save(){}},gui:{width:427,height:240,textWidth:s=>s.length*6},screens:{open:s=>opened.push(s)},ensureMicroProfiler(){}};
  const landing=new MinecraftJSExtrasScreen(g,null,[{label:()=>'LOD',click(){}}]);landing.init();
  const labels=landing.buttons.map(b=>typeof b.label==='function'?b.label():b.label);
  assert.deepEqual(labels.slice(0,5),['minecraftjs.extras.category.graphics…','minecraftjs.extras.category.performance…','minecraftjs.extras.category.lighting…','minecraftjs.extras.category.controls…','minecraftjs.extras.category.debug…']);
  landing.buttons[4].onClick();const debug=opened.at(-1);debug.init();
  const dl=debug.buttons.map(b=>typeof b.label==='function'?b.label():b.label);assert.ok(dl[0].startsWith('minecraftjs.extras.microprofiler'));assert.equal(dl[1],'minecraftjs.extras.microprofiler.open…');
  debug.buttons[0].onClick();assert.equal(g.settings.microprofiler,true);debug.buttons[1].onClick();assert.ok(opened.at(-1) instanceof MicroProfilerScreen);
  const perf=new MinecraftJSExtrasScreen(g,null,[],'performance');perf.init();assert.equal(perf.buttons.length-1,5,'five performance extras plus Done');
});
