import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {Gui} from '../client/js/gui/gui.js';import {Hud} from '../client/js/gui/hud.js';
import {ChatOptionsScreen} from '../client/js/gui/screens/options.js';import {Settings} from '../client/js/game/settings.js';import {ChatScreen} from '../client/js/gui/screens/chat.js';
import {VANILLA_UI} from '../client/js/gui/vanilla-layout.js';import {setPlatform} from '../client/js/platform/platform.js';import {setTranslator} from '../client/js/gui/i18n.js';
import * as Blocks from '../client/js/world/blocks.js';const {initBlocks,findState}=Blocks;import {LocalPlayer} from '../client/js/game/physics.js';
const data=Object.fromEntries(['blocks','blockCollisionShapes'].map(n=>[n,JSON.parse(readFileSync(new URL('../client/data/'+n+'.json',import.meta.url)))]));initBlocks(data.blocks,data.blockCollisionShapes);
const modern=['1.14.4','1.15.2'].includes(VANILLA_UI.version),native=['1.13.2','1.14.4','1.15.2'].includes(VANILLA_UI.version);
const Narrator=VANILLA_UI.version!=='1.8.9'?(await import('../client/js/gui/narrator.js')).Narrator:null;
let now=0;setPlatform({now:()=>now,loadSetting:()=>null,saveSetting(){}});setTranslator((key,args)=>key+(args.length?' '+args.join('|'):''));
function fixture(){return {settings:new Settings(),gui:{width:420,height:300,textWidth:s=>s.length*6},narrator:{active:true,label:()=> 'Narrator',cycle(){}},screens:{open(s){this.current=s;}},world:{getState:()=>0},player:new LocalPlayer(),gameMode:1,send(){}};}
test('button text uses the native per-version normal/hover/disabled colors',()=>{
 const colors=[],gui={blit(){},textCentered:(label,x,y,color)=>colors.push(color)};
 for(const [hover,enabled]of[[false,true],[true,true],[true,false]])Gui.prototype.button.call(gui,0,0,150,20,'Button',hover,enabled);
 assert.deepEqual(colors,VANILLA_UI.version==='1.15.2'?[0xffffff,0xffffff,0xa0a0a0]:[0xe0e0e0,0xffffa0,0xa0a0a0]);
});
test('Chat Settings uses jar-derived ordering, matching row positions, and working link switches',()=>{
 const g=fixture(),s=new ChatOptionsScreen(g,null);s.init();assert.deepEqual(s.buttons.slice(0,-1).map(b=>b.optionKey),VANILLA_UI.chatOptions);
 assert.equal(s.buttons[0].y,50);assert.equal(s.buttons.at(-1).y,50+(modern?168:144));
 const links=s.buttons.find(b=>b.optionKey==='options.chat.links');links.onClick();assert.equal(g.settings.chatLinks,false);links.onClick();assert.equal(g.settings.chatLinks,true);
 const prompt=s.buttons.find(b=>b.optionKey==='options.chat.links.prompt');prompt.onClick();assert.equal(g.settings.chatLinksPrompt,false);
 if(modern)assert.ok(s.buttons.some(b=>b.optionKey==='options.accessibility.text_background_opacity'));
 if(native)assert.ok(s.buttons.some(b=>b.optionKey==='options.autoSuggestCommands'));
});
test('creative local fire/lava contact renders fire without requiring an authoritative burning flag',()=>{
 const g=fixture(),hud=Object.create(Hud.prototype);hud.game=g;g.player.setPosition(.5,64,.5);
 assert.equal(hud._isBurning(),false);g.player.inLava=true;assert.equal(hud._isBurning(),true);g.player.inLava=false;
 const fire=native?findState('fire'):data.blocks.find(b=>b.name==='fire').id<<4;
 g.world.getState=(x,y,z)=>x===0&&y===64&&z===0?fire:0;assert.equal(hud._isBurning(),true);
 g.world.getState=()=>0;assert.equal(hud._isBurning(),false);g.selfMetadata={0:1};assert.equal(hud._isBurning(),true);
 g.gameMode=3;assert.equal(hud._isBurning(),false);
});
test('chat width zero reaches the native 40 pixel minimum',()=>{
 const g=fixture(),hud=Object.create(Hud.prototype);hud.game=g;g.settings.chatWidth=0;assert.equal(hud.chatWidth(),40);
});
if(modern)test('narrator follows mouse/focus delays, mode filtering, changing labels and disabled widgets',()=>{
 const oldSpeech=globalThis.speechSynthesis,oldUtterance=globalThis.SpeechSynthesisUtterance,spoken=[];
 globalThis.speechSynthesis={speak:u=>spoken.push(u.text),cancel(){}};globalThis.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
 try{
  const g=fixture();g.settings.narrator=1;const narrator=new Narrator(g),button={enabled:true,visible:true};
  now=0;narrator.widget(button,true,'Done');now=749;narrator.widget(button,true,'Done');assert.equal(spoken.length,0);
  now=750;narrator.widget(button,true,'Done');assert.deepEqual(spoken,['gui.narrate.button Done']);now=1000;narrator.widget(button,true,'Done');assert.equal(spoken.length,1);
  narrator.widget(button,false,'Done');button.focused=true;now=1100;narrator.widget(button,false,'Done');now=1300;narrator.widget(button,false,'Done');assert.equal(spoken.length,2);
  now=1400;narrator.widget(button,true,'Changed');now=1600;narrator.widget(button,true,'Changed');assert.equal(spoken.length,3);
  button.enabled=false;now=1700;narrator.widget(button,true,'Disabled');now=2500;narrator.widget(button,true,'Disabled');assert.equal(spoken.length,3);
  g.settings.narrator=2;narrator.saySystem('no');assert.equal(spoken.length,3);g.settings.narrator=3;narrator.saySystem('system');assert.equal(spoken.at(-1),'system');
 }finally{globalThis.speechSynthesis=oldSpeech;globalThis.SpeechSynthesisUtterance=oldUtterance;}
});

if(Narrator)test('narrator modes filter chat/system and decode raw translated packets without reading formatting codes',()=>{
 const oldSpeech=globalThis.speechSynthesis,oldUtterance=globalThis.SpeechSynthesisUtterance,spoken=[];
 globalThis.speechSynthesis={speak:u=>spoken.push(u.text),cancel(){}};globalThis.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
 try{
  const g=fixture();g.assets={translate:(key,args)=>key==='chat.type.text.narrate'?args[0]+' says '+args[1]:key};const narrator=new Narrator(g);
  for(const [mode,expected] of [[0,[]],[1,['chat','system']],[2,['chat']],[3,['system']]]){
   g.settings.narrator=mode;spoken.length=0;narrator.onChat(0,'{"text":"chat"}');narrator.onChat(1,{text:'system'});narrator.onChat(2,{text:'action bar'});assert.deepEqual(spoken,expected);
  }
  g.settings.narrator=1;spoken.length=0;narrator.onChat(0,'{"translate":"chat.type.text","with":[{"text":"Alex"},{"text":"hello","bold":true}]}');assert.deepEqual(spoken,['Alex says hello']);
  narrator.say('§cColored');assert.equal(spoken.at(-1),'Colored');
 }finally{globalThis.speechSynthesis=oldSpeech;globalThis.SpeechSynthesisUtterance=oldUtterance;}
});
if(modern)test('narrator reads selected completion index, text and tooltip',()=>{
 const g=fixture(),spoken=[];g.narrator.saySystem=text=>spoken.push(text);const s=new ChatScreen(g,'/give');
 s._showMatches([{match:'stone'},{match:'sand',tooltip:{text:'A block'}}]);assert.equal(spoken[0],'narration.suggestion 1|2|stone');
 s._selectTab(1);assert.equal(spoken[1],'narration.suggestion.tooltip 2|2|sand|A block');
});
