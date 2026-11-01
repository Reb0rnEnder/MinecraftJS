import {test} from 'node:test';import assert from 'node:assert/strict';
import {MultiplayerSafetyScreen} from '../client/js/gui/screens/menus.js';
import mcassets from '../lib/mcassets.js';
const version=mcassets.MC_VERSION,old=version==='1.15.2',ordered=version==='1.18.2';
test('native multiplayer warning layout, checkbox atlas and keyboard order',()=>{
 const calls=[],gui={width:854,height:480,font:{wrap:()=>['one','two']},blit:(...a)=>calls.push(['blit',...a]),text:(...a)=>calls.push(['text',...a]),textCentered:(...a)=>calls.push(['center',...a])};
 const game={gui,settings:{},screens:{open(){}}},screen=new MultiplayerSafetyScreen(game,null);screen.init();
 const offset=3*(old?9:18),check=screen.buttons.find(b=>b.id===2);
 assert.ok(check,'checkbox exists');assert.equal(check.x,352);assert.equal(check.y,76+offset);
 assert.equal(screen.buttons.find(b=>b.id===0).y,100+offset);
 assert.deepEqual(screen.buttons.map(b=>b.id),ordered?[2,0,1]:[0,1,2]);
 screen.renderContent(gui);assert.equal(calls[0][0],old?'center':'text');assert.equal(calls[0][2],old?427:25);assert.equal(calls[2][3],70+(old?9:18));
 calls.length=0;check.render(gui);assert.deepEqual(calls[0].slice(4),[0,0,20,20,old?32:64,64]);
 screen.skip=true;check.focused=true;calls.length=0;check.render(gui);assert.deepEqual(calls[0].slice(4),[old?0:20,20,20,20,old?32:64,64]);
 check.focused=false;screen.key({code:'Tab'});assert.equal(screen.focusedWidget,screen.buttons[0]);
});
