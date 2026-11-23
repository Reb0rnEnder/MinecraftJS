// Native 1.20.6 SocialInteractionsScreen geometry (decompiled fro/frn/frl): header/footer layout, background panel,
// bordered search box, 73-wide tabs, 36-pixel rows and the 1.20.5+ list scrollbar.
import{test}from'node:test';import assert from'node:assert/strict';import{SocialInteractionsScreen}from'../client/js/gui/screens/social.js';import{setPlatform}from'../client/js/platform/platform.js';
let now=0;setPlatform({now:()=>now});
function fixture(height=303){const calls={rect:[],sprite:[],text:[],tooltip:[]},gui={width:401,height,textWidth:s=>s.length*6,rect:(...a)=>calls.rect.push(a),sprite:(...a)=>calls.sprite.push(a),blit(){},text:(...a)=>calls.text.push(a),textCentered:(...a)=>calls.text.push(a),scissor(){},clearScissor(){},tex:()=>null,drawImage(){},tooltip:(...a)=>calls.tooltip.push(a),font:{wrap:s=>[s],width:s=>String(s).length*6,trimToWidth:s=>s},button(){},menuBackground(){},dirtBackground(){}},g={gui,scoreboard:{players:new Map([['other',{name:'Alpha'}],['self',{name:'Zulu'}]])},playerUuid:'self',entityRenderer:{skinImage:()=>null},sound:{playUi(){}},hud:{addChat(){}},settings:{keys:{}},screens:{open(s){this.current=s;},close(){this.closed=true;}}},s=new SocialInteractionsScreen(g);s.init();return{s,g,calls};}
test('1.20.6 social layout: header/footer, panel, bordered search and tabs, preserving search on resize',()=>{
 const{s,calls}=fixture();assert.equal(s.rowLeft,92);assert.deepEqual(s.buttons.slice(0,3).map(b=>[b.x,b.y,b.w,b.h]),[[92,45,73,20],[166,45,73,20],[240,45,73,20]]);
 assert.equal(s.listTop,88);assert.equal(s.bottom,88+159);assert.deepEqual([s.search.x,s.search.y,s.search.w,s.search.h,s.search.drawBackground],[109,74,200,15,true]);
 assert.deepEqual([s.manage.x,s.manage.y,s.manage.w],[100,64+159,200]);assert.deepEqual([s.buttons.at(-1).x,s.buttons.at(-1).y,s.buttons.at(-1).w],[100,303-26,200]);
 s.renderContent(s.gui,-100,-100);assert.ok(calls.sprite.some(a=>a[0]==='social_interactions/background'&&a[1]===84&&a[2]===64&&a[3]===236&&a[4]===175));assert.ok(calls.sprite.some(a=>a[0]==='icon/search'&&a[1]===94&&a[2]===76));
 s.search.text='Al';s.onResize();assert.equal(s.search.text,'Al');
});
test('rows: self first, 32-pixel bodies, native name/icon placement and disabled report sprite',()=>{
 const{s,calls}=fixture();assert.deepEqual(s.entries().map(e=>e.name),['Zulu','Alpha']);s.renderContent(s.gui,-100,-100);
 assert.ok(calls.rect.some(a=>a[0]===92&&a[1]===92&&a[2]===312&&a[3]===124));assert.ok(calls.rect.some(a=>a[1]===128&&a[3]===160));
 assert.ok(calls.text.some(a=>a[0]==='Alpha'&&a[1]===124&&a[2]===128+11));assert.deepEqual(s.rows.map(r=>[r.x,r.y]),[[264,134]]);
 assert.ok(calls.sprite.some(a=>a[0]==='social_interactions/mute_button'&&a[1]===264));assert.ok(calls.sprite.some(a=>a[0]==='social_interactions/report_button_disabled'&&a[1]===288));
});
test('hide/show toggles on its icon and the tooltip waits for the native 500 ms delay',()=>{
 const{s,g,calls}=fixture();s.renderContent(s.gui,-100,-100);const row=s.rows[0];
 now=0;s.renderContent(s.gui,row.x+1,row.y+1);s.render(s.gui,row.x+1,row.y+1);assert.equal(calls.tooltip.length,0);
 now=600;s.renderContent(s.gui,row.x+1,row.y+1);s.render(s.gui,row.x+1,row.y+1);assert.ok(calls.tooltip.length>0);
 assert.equal(s.mouseDown(row.x+1,row.y+1,0),true);assert.ok(g.hiddenPlayers.has('other'));s.renderContent(s.gui,-100,-100);
 assert.ok(calls.sprite.some(a=>a[0]==='social_interactions/unmute_button'));s.mouseDown(row.x+1,row.y+1,0);assert.equal(g.hiddenPlayers.has('other'),false);
});
test('overflow lists show the 1.20.5+ scroller sprites with bounded dragging, and Done returns to the parent',()=>{
 const{s,g,calls}=fixture();for(let i=0;i<50;i++)g.scoreboard.players.set('p'+i,{name:'Player'+i});s.renderContent(s.gui,-100,-100);
 assert.equal(s.scrollBarX(),320);assert.ok(calls.sprite.some(a=>a[0]==='widget/scroller_background'&&a[1]===320&&a[2]===88));
 s.mouseDown(321,110,0);s.mouseMove(321,130);assert.ok(s.scroll>0);s.mouseMove(321,500);assert.equal(s.scroll,s.scrollbar.max);s.mouseUp(321,500,0);const old=s.scroll;s.mouseMove(321,100);assert.equal(s.scroll,old);
 const parent={};const child=new SocialInteractionsScreen(g,parent);child.init();child.buttons.at(-1).onClick();assert.equal(g.screens.current,parent);
});
