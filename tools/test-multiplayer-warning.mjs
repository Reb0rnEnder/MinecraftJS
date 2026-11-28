import {test} from 'node:test';import assert from 'node:assert/strict';
import {MultiplayerSafetyScreen, warningLayout} from '../client/js/gui/screens/menus.js';
test('native multiplayer warning layout, checkbox sprites and keyboard order',()=>{
 const calls=[],textWidth=s=>String(s).length*6,gui={width:854,height:480,font:{wrap:()=>['one','two']},textWidth,blit:(...a)=>calls.push(['blit',...a]),sprite:(...a)=>calls.push(['sprite',...a]),rect:(...a)=>calls.push(['rect',...a]),text:(...a)=>calls.push(['text',...a]),textCentered:(...a)=>calls.push(['center',...a])};
 const game={gui,settings:{},screens:{open(){}}},screen=new MultiplayerSafetyScreen(game,null);screen.init();
 const expected=warningLayout(854,480,Object.assign(s=>textWidth(s),{title:textWidth('§lmultiplayerWarning.header')}),['one','two'],textWidth('multiplayerWarning.check'));
 const check=screen.buttons.find(b=>b.id===2),proceed=screen.buttons.find(b=>b.id===0);
 assert.ok(check,'checkbox exists');assert.equal(check.x,expected.checkbox[0]);assert.equal(check.y,expected.checkbox[1]);
 assert.equal(proceed.y,expected.proceed[1]);
 assert.deepEqual(screen.buttons.map(b=>b.id),[2,0,1]);
 screen.renderContent(gui);
 assert.equal(calls[0][0],'text');assert.equal(calls[0][2],expected.title[0]);assert.equal(calls[0][3],expected.title[1]);
 assert.equal(calls.find(c=>c[0]==='text'&&c[1]==='one')[3],expected.text[1]);
 calls.length=0;check.render(gui);assert.deepEqual(calls[0],['sprite','widget/checkbox',expected.checkbox[0],expected.checkbox[1],17,17]);
 screen.skip=true;check.focused=true;calls.length=0;check.render(gui);assert.deepEqual(calls[0],['sprite','widget/checkbox_selected_highlighted',expected.checkbox[0],expected.checkbox[1],17,17]);
 check.focused=false;screen.key({code:'Tab'});assert.equal(screen.focusedWidget,screen.buttons[0]);
});
