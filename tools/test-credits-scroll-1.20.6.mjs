// 1.20.6 WinScreen: render receives Minecraft.getDeltaFrameTime and advances the scroll by delta * speed each frame;
// tick only ends the credits once the scroll passes the text.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setPlatform} from '../client/js/platform/platform.js';
import {setTranslator} from '../client/js/gui/i18n.js';
import {CreditsScreen} from '../client/js/gui/screens/credits.js';
let now=0;setPlatform({now:()=>now,loadSetting:()=>null,saveSetting(){}});setTranslator(k=>k);
test('scroll advances per frame by elapsed ticks, not per tick',()=>{
 const gui={width:400,height:240,menuBackground(){},pushMatrix(){},popMatrix(){},translate(){},blit(){},text(){},textCentered(){},tex:()=>null,setBlend(){},quad(){}};
 const game={gui,assets:{readText:async()=>'',texture:()=>null},inWorld:false,world:null,device:{width:800,height:480},send(){},screens:{open(){}}};
 const s=new CreditsScreen(game,{poem:false,onFinished:()=>{}});s.lines=['a','b'];s.totalHeight=24;
 s.render(gui,0,0,0);assert.equal(s.scroll,0);
 now=100;s.render(gui,0,0,0);assert.ok(Math.abs(s.scroll-2*0.75)<1e-9,'two ticks at 0.75');
 s.tick();s.tick();assert.ok(Math.abs(s.scroll-1.5)<1e-9,'ticks do not move it');
 s.speed=-0.75;now=1000;s.render(gui,0,0,0);assert.equal(s.scroll,0,'never below zero');
});
