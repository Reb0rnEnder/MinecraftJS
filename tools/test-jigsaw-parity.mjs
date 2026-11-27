import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JigsawScreen} from '../client/js/gui/screens/jigsaw.js';
import {JIGSAW_LAYOUT as layout} from '../client/js/gui/jigsaw-layout.js';
import * as values from '../client/js/gui/jigsaw-values.js';
import {C,PROTOCOL_VERSION} from '../client/js/net/packets.js';
import {Reader} from '../client/js/net/buffer.js';
import {initBlocks,findState} from '../client/js/world/blocks.js';
import {setTranslator} from '../client/js/gui/i18n.js';
import {setPlatform} from '../client/js/platform/platform.js';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/jigsaw-native.json',import.meta.url))),protocol=PROTOCOL_VERSION;
const ids=await import('../client/js/net/protocol-'+layout.version+'-ids.js'),OUT=ids['SERVERBOUND_'+protocol]||ids['PLAY_SERVERBOUND_'+protocol];
setPlatform({now:()=>0});setTranslator((key,args)=>key+(args.length?'('+args.join(',')+')':''));
initBlocks(JSON.parse(readFileSync(new URL('../client/data/blocks.json',import.meta.url))),null);
const pos={x:-31,y:72,z:481};
function setup(data={},orientation='up_north',width=427){
 const events=[],draw=[],font={width:s=>s.length*6,trimToWidth:(s,w)=>s.slice(0,Math.max(0,Math.floor(w/6))),wrap:s=>[s]},gui={width,height:300,font,textWidth:font.width,menuBackground(){},worldBackground(){},text:(...a)=>draw.push(['text',...a]),textCentered:(...a)=>draw.push(['center',...a]),rect:(...a)=>draw.push(['rect',...a]),button:(...a)=>draw.push(['button',...a]),sprite:(...a)=>draw.push(['sprite',...a]),tooltip:(...a)=>draw.push(['tooltip',...a])};
 const game={gui,inWorld:true,world:{getState:()=>findState('jigsaw',{orientation})},sound:{playUi:()=>draw.push(['sound'])},send:p=>events.push({kind:'send',bytes:p}),screens:{close:()=>events.push({kind:'close'})}};
 const s=new JigsawScreen(game,pos,data);s.init();return {s,game,events,draw};
}
function payload(bytes,kind){const r=new Reader(bytes);assert.equal(r.varint(),OUT[kind]);return Buffer.from(r.rest()).toString('hex');}
const nativeData={pool:'custom:pool',name:'anchor',target:'custom:target',target_pool:'custom:pool',attachement_type:'anchor',final_state:'minecraft:oak_log[axis=x]',joint:'rollable',selection_priority:-12,placement_priority:37};

test('resource validation, normalization and exception messages match the exact native jar',()=>{
 assert.equal(fixture.minecraftVersion,layout.version);
 for(const row of fixture.resources){assert.equal(values.validJigsawResource(row.input),row.valid,row.input);if(row.normalized!==undefined)assert.equal(values.jigsawResource(row.input),row.normalized);else assert.throws(()=>values.jigsawResource(row.input),{message:row.error});}
});
test('outgoing jigsaw update/generate bodies match Java-produced bytes and target packet IDs',()=>{
 for(const p of fixture.packets){
  const bytes=p.kind==='generate'?C.generateStructure(pos,p.levels,p.keep):layout.modern?C.updateJigsaw(pos,'minecraft:anchor','custom:target','custom:pool',nativeData.final_state,p.joint,...(layout.priorities?[-12,37]:[])):C.updateJigsaw(pos,'minecraft:anchor','custom:pool',nativeData.final_state);
  assert.equal(payload(bytes,p.kind==='generate'?'generate_structure':'update_jigsaw_block'),p.body);
 }
});
test('editor reads native NBT keys and uses release-specific geometry and limits',()=>{
 for(const width of [420,427,854]){
  const {s}=setup(nativeData,'up_north',width),cx=Math.floor(width/2);
  assert.deepEqual(s.fields.map(f=>[f.x,f.y,f.w,f.h,f.maxLength]),layout.modern?[[cx+layout.fieldX,20,300,20,128],[cx+layout.fieldX,55,300,20,128],[cx+layout.fieldX,90,300,20,128],[cx+layout.fieldX,125,300,20,256],...(layout.priorities?[[cx-153,160,98,20,3],[cx-50,160,98,20,3]]:[])]:[[cx-152,40,300,20,128],[cx-152,80,300,20,128],[cx-152,120,300,20,256]]);
  assert.equal(s.edits.pool.text,'custom:pool');assert.equal(s.edits[layout.modern?'name':'attachment'].text,'anchor');
  assert.deepEqual([s.done.x,s.done.y,s.done.w,s.cancelButton.x,s.cancelButton.y],[cx-154,210,150,cx+4,210]);
  assert.equal(s.edits.pool.focused,true);assert.equal(s.fields.filter(f=>f.focused).length,1);
  if(layout.modern){assert.equal(s.edits.target.text,'custom:target');assert.equal(s.generateButton.y,layout.priorities?185:180);}else assert.equal(s.generateButton,undefined);
 }
});
test('Done saves the edited values using the native wire order and then closes',()=>{
 const {s,events}=setup(nativeData);s.done.onClick();
 assert.deepEqual(events.map(e=>e.kind),['send','close']);assert.equal(payload(events[0].bytes,'update_jigsaw_block'),fixture.packets.find(p=>p.kind==='update'&&p.joint==='rollable').body);
});
test('empty final state and resource paths remain legal, invalid resources disable Done',()=>{
 const {s,events}=setup(nativeData);s.edits.finalState.setText('');s.edits.pool.setText('');s.edits[layout.modern?'name':'attachment'].setText(':');
 assert.equal(s.done.enabled,true);s.edits.pool.setText('BAD:pool');assert.equal(s.done.enabled,false);s.save();assert.equal(events.length,0);
 if(layout.modern)assert.equal(s.generateButton.enabled,!layout.validateGenerate);
 s.edits.pool.setText(':pool');assert.equal(s.done.enabled,true);
});
test('native edit limits also apply to initial values; resizing preserves edits',()=>{
 const {s,game}=setup({...nativeData,pool:'a'.repeat(200),target_pool:'a'.repeat(200),final_state:'a'.repeat(300)});
 assert.equal(s.edits.pool.text.length,128);assert.equal(s.edits.finalState.text.length,256);
 s.edits.pool.setText('changed:pool');s.edits.finalState.setText('');if(layout.modern){s.levels=5;s.keepJigsaws=false;s.joint='aligned';}if(layout.priorities)s.edits.selectionPriority.setText('-8');
 game.gui.width=853;s.onResize();assert.equal(s.edits.pool.text,'changed:pool');assert.equal(s.edits.pool.x,426+layout.fieldX);assert.equal(s.edits.finalState.text,'');
 if(layout.modern){assert.equal(s.levels,5);assert.equal(s.levelSlider.value,5/layout.maxLevels);assert.equal(s.keepJigsaws,false);assert.equal(s.joint,'aligned');}if(layout.priorities)assert.equal(s.edits.selectionPriority.text,'-8');
});
test('Escape, Cancel and keyboard-activated Cancel send no update; Enter in a field saves',()=>{
 for(const action of ['escape','cancel','keyboardCancel','enter']){
  const {s,events}=setup(nativeData);
  if(action==='escape')s.key({code:'Escape'});else if(action==='cancel')s.cancelButton.onClick();else if(action==='keyboardCancel'){s.fields.forEach(f=>f.focused=false);s.focusedWidget=s.cancelButton;s.cancelButton.focused=true;s.key({code:'Enter'});}else s.key({code:'Enter'});
  assert.deepEqual(events.map(e=>e.kind),action==='enter'?['send','close']:['close']);
 }
});
if(layout.modern){
 test('slider focus, release sound and native keyboard-edit toggling preserve the editor',()=>{
  const {s,events,draw}=setup(nativeData),slider=s.levelSlider;
  s.mouseDown(slider.x+50,slider.y+5,0);assert.equal(s.focusedWidget,slider);assert.equal(s.fields.some(f=>f.focused),false);assert.equal(draw.filter(d=>d[0]==='sound').length,0);
  s.mouseUp(slider.x+50,slider.y+5,0);assert.equal(draw.filter(d=>d[0]==='sound').length,1);
  const value=slider.value;s.key({code:'ArrowRight'});assert.equal(slider.value,value+Math.fround(1/92));
  if(layout.sliderToggle){s.key({code:'Enter'});assert.equal(slider.canChangeValue,false);assert.equal(events.length,0);const v=slider.value;s.key({code:'ArrowRight'});assert.equal(slider.value,v);assert.notEqual(s.focusedWidget,slider);/* Screen arrow navigation once the slider declines */s.key({code:'ArrowLeft'});assert.equal(s.focusedWidget,slider);s.key({code:'Space'});assert.equal(slider.canChangeValue,true);}else{s.key({code:'Enter'});assert.deepEqual(events.map(e=>e.kind),['send','close']);}
 });
 test('Generate saves first, closes, then emits generation with native levels and keep toggle',()=>{
  const {s,events}=setup(nativeData);assert.equal(s.keepJigsaws,true);assert.equal(s.levels,0);
  s.levelSlider._set(s.levelSlider.x+s.levelSlider.w-4);assert.equal(s.levels,layout.maxLevels);s.levelSlider._set(s.levelSlider.x+4+(s.levelSlider.w-8)*0.51);assert.equal(s.levels,Math.floor(layout.maxLevels*0.51));
  s.keepButton.onClick();assert.equal(s.keepJigsaws,false);s.generateButton.onClick();assert.deepEqual(events.map(e=>e.kind),['send','close','send']);
  assert.equal(payload(events[0].bytes,'update_jigsaw_block'),fixture.packets.find(p=>p.kind==='update'&&p.joint==='rollable').body);
  assert.deepEqual(events[2].bytes,C.generateStructure(pos,s.levels,false));
 });
 test('joint control is visible only for vertical jigsaws; invalid/missing joint uses native orientation fallback',()=>{
  for(const [orientation,vertical]of [['up_north',true],['down_south',true],['north_up',false],['east_up',false]]){
   const {s}=setup({...nativeData,joint:'invalid'},orientation);assert.equal(s.vertical,vertical);assert.equal(s.jointButton.visible,vertical);assert.equal(s.jointButton.enabled,vertical);assert.equal(s.joint,vertical?'rollable':'aligned');
   if(vertical){s.jointButton.onClick();assert.equal(s.joint,'aligned');s.jointButton.onClick();assert.equal(s.joint,'rollable');}
  }
 });
}
if(layout.priorities){
 test('selection/placement priorities use three-character fields, native integer fallback and wire order',()=>{
  const {s,events}=setup(nativeData);s.edits.selectionPriority.setText('abc');s.edits.placementPriority.setText('-2');s.save();assert.deepEqual(events[0].bytes,C.updateJigsaw(pos,'minecraft:anchor','custom:target','custom:pool',nativeData.final_state,'rollable',0,-2));
  for(const row of fixture.integers)assert.equal(values.jigsawPriority(row.input),row.value,row.input);
 });
 test('priority tooltips render after all widgets',()=>{
  const {s,game,draw}=setup(nativeData);s.render(game.gui,s.edits.selectionPriority.x+2,162,0);assert.equal(draw.at(-1)[0],'tooltip');assert.match(draw.at(-1)[1][0],/selection_priority.tooltip/);
 });
}
