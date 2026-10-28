import assert from 'node:assert/strict';
import {test} from 'node:test';
import {ControlsScreen,MouseSettingsScreen,AccessibilityScreen,VideoScreen} from '../client/js/gui/screens/options.js';
import {Settings,DEFAULT_KEYS} from '../client/js/game/settings.js';
import {setPlatform} from '../client/js/platform/platform.js';
import {setTranslator} from '../client/js/gui/i18n.js';
import {VANILLA_UI} from '../client/js/gui/vanilla-layout.js';
import {Input} from '../client/js/game/input.js';
setPlatform({loadSetting:()=>null,saveSetting(){},now:()=>100,isFullscreen:()=>false});
setTranslator(k=>k);
function fixture(width=420,height=300){
 const texts=[],buttons=[],gui={width,height,textWidth:s=>s.length*6,button:(...b)=>buttons.push(b),text:(...t)=>texts.push(t),textCentered(){},dirtBackground(){},worldBackground(){},rect(){},quad(){},scissor(){},clearScissor(){},gradient(){}};
 const game={gui,settings:new Settings(),assets:{texture:()=>null},sound:{playUi(){}},narrator:{label:()=>'',active:false,cycle(){}},screens:{open(s){this.current=s;},close(){}},renderer:{},device:{name:'WebGL 2'},applyGraphicsSettings(){}};
 return {game,texts,buttons};
}
test('controls use extracted native geometry at narrow and wide GUI sizes',()=>{
 for(const [w,h] of [[420,300],[427,301],[854,480]]){
  const {game,texts}=fixture(w,h),s=new ControlsScreen(game,null);s.init();
  assert.equal(s.list.top,43);assert.equal(s.list.bottom,h-32);assert.equal(s.list.slotHeight,20);
  assert.equal(s.list.width,w+45);assert.equal(s.list.showSelectionBox,false);
  assert.deepEqual(s.buttons.map(b=>[b.id,b.y]),[[202,18],[203,18],[201,h-29],[200,h-29]]);
  s.render(game.gui,-1,-1);assert.ok(texts.every(t=>Number.isInteger(t[1])&&Number.isInteger(t[2])),'text lies on integer GUI pixels');
 }
});
test('binding, duplicate warnings, Escape unbinding, mouse binding and reset actions',()=>{
 const {game,buttons}=fixture(),s=new ControlsScreen(game,null);s.init();s.render(game.gui,-1,-1);
 const e=s.entries.find(e=>e.key==='forward');
 e.changeButton.onClick();assert.equal(s.binding,'forward');s.key({code:'Escape'});assert.equal(game.settings.keys.forward,'');
 e.changeButton.onClick();s.mouseDown(0,0,2);assert.equal(game.settings.keys.forward,'mouse2');
 s.render(game.gui,-1,-1);assert.equal(e.resetButton.enabled,true);assert.equal(s.resetAll.enabled,true);
 e.resetButton.onClick();s._updateResets();assert.equal(game.settings.keys.forward,DEFAULT_KEYS.forward);assert.equal(s.resetAll.enabled,false);
 game.settings.keys.forward=game.settings.keys.back;s.render(game.gui,-1,-1);
 assert.ok(buttons.some(b=>typeof b[4]==='string'&&b[4].startsWith('§c')),'conflicts are red');
 s.resetAll.onClick();assert.deepEqual(game.settings.keys,DEFAULT_KEYS);
});
test('Tab traverses row widgets, skips disabled Reset buttons, and scrolls focused bindings into view',()=>{
 const {game}=fixture(420,220),s=new ControlsScreen(game,null);s.init();
 s.key({code:'Tab'});assert.equal(s.focusedWidget,s.buttons[0]);
 s.key({code:'Tab'});assert.equal(s.focusedWidget,s.buttons[1]);
 s.key({code:'Tab'});const first=s.entries.find(e=>e.key);assert.equal(s.focusedWidget,first.changeButton);
 s.key({code:'Enter'});assert.equal(s.binding,first.key);s.key({code:'KeyR'});s.key({code:'Tab'});assert.equal(s.focusedWidget,first.resetButton);
 s.key({code:'Enter'});assert.equal(game.settings.keys[first.key],DEFAULT_KEYS[first.key]);s.key({code:'Tab'});assert.notEqual(s.focusedWidget,s.buttons[0],'reset becoming disabled does not restart focus traversal');
 for(let i=0;i<s.entries.length+5;i++)s.key({code:'Tab'});
 assert.ok(s.list.amountScrolled>0);const target=s.focusedWidget;
 if(target.optionRow!==undefined){assert.ok(s.list.slotTop(target.optionRow)>=s.list.top);assert.ok(s.list.slotTop(target.optionRow)+20<=s.list.bottom);}
 s.focusedWidget=null;s.key({code:'Tab',shift:true});assert.equal(s.focusedWidget,s.buttons.at(-1));
});
test('controls list drags only via the scrollbar; row controls still take clicks',()=>{
 const {game}=fixture(420,220),s=new ControlsScreen(game,null);s.init();s.render(game.gui,-1,-1);
 s.mouseDown(s.list.slotLeft()+5,s.list.top+10,0,{});s.mouseMove(100,100);assert.equal(s.list.amountScrolled,0);
 s.mouseUp(100,100,0);s.mouseDown(s.list.scrollBarX()+2,s.list.top+10,0,{});s.mouseMove(s.list.scrollBarX()+2,s.list.top+35);assert.ok(s.list.amountScrolled>0);
});
test('mouse settings use native option rows and support focused slider keys',()=>{
 const {game}=fixture(420,180),s=new MouseSettingsScreen(game,null);s.init();
 assert.deepEqual([s.list.top,s.list.bottom,s.list.slotHeight,s.list.listWidth],[32,148,25,400]);
 assert.equal(s.buttons[0].y,153);s.key({code:'Tab'});const slider=s.focusedWidget,value=game.settings.sensitivity;
 s.key({code:'ArrowRight'});assert.ok(game.settings.sensitivity>value);s.key({code:'ArrowLeft'});assert.ok(Math.abs(game.settings.sensitivity-value)<1e-9);
});
test('Accessibility positions match the native grid; 1.15 video begins with the wide biome row',()=>{
 const {game}=fixture(),a=new AccessibilityScreen(game,null);a.init();
 assert.equal(a.buttons[0].y,50);assert.equal(a.buttons.at(-1).y,194);
 if(VANILLA_UI.version==='1.15.2'){
  assert.equal(a.buttons.length,9);assert.ok(VANILLA_UI.accessibilityOptions.includes('key.sneak'));assert.ok(VANILLA_UI.accessibilityOptions.includes('key.sprint'));
  const sneak=a.buttons[VANILLA_UI.accessibilityOptions.indexOf('key.sneak')];sneak.onClick();assert.equal(game.settings.toggleCrouch,true);assert.match(sneak.label(),/options.key.toggle/);
  const video=new VideoScreen(game,null);video.init();assert.equal(video.rows[0].length,1);assert.equal(video.rows[0][0].optionKey,'options.biomeBlendRadius');assert.equal(video.rows[0][0].w,310);
 }
});
if(VANILLA_UI.version==='1.15.2')test('toggle sneak/sprint latch on presses, ignore repeats, reset on unlock, and Hold stays physical',()=>{
 const handlers={},settings=new Settings();setPlatform({on:(k,v)=>handlers[k]=v});const input=new Input(settings);handlers.pointerlock(true);settings.toggleCrouch=true;
 const key=settings.keys.sneak;handlers.keydown({code:key,repeat:false});handlers.keyup({code:key});assert.equal(input.isDown('sneak'),true);
 handlers.keydown({code:key,repeat:true});assert.equal(input.isDown('sneak'),true);
 handlers.keydown({code:key,repeat:false});handlers.keyup({code:key});assert.equal(input.isDown('sneak'),false);
 settings.toggleSprint=true;handlers.keydown({code:settings.keys.sprint,repeat:false});handlers.keyup({code:settings.keys.sprint});assert.equal(input.isDown('sprint'),true);
 handlers.pointerlock(false);assert.equal(input.isDown('sprint'),false);settings.toggleCrouch=false;
 handlers.keydown({code:key,repeat:false});assert.equal(input.isDown('sneak'),true);handlers.keyup({code:key});assert.equal(input.isDown('sneak'),false);
});
