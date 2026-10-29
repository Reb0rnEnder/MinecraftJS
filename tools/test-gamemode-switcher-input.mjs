import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Input} from '../client/js/game/input.js';
import {setPlatform} from '../client/js/platform/platform.js';
import {ScreenManager} from '../client/js/gui/screens/manager.js';
import {GameModeSwitcherScreen} from '../client/js/gui/screens/gamemode-switcher.js';
import {Game} from '../client/js/game/game.js';
import {Reader} from '../client/js/net/buffer.js';
function fixture(){
 const handlers={},emit=(event,value)=>{for(const fn of handlers[event]||[])fn(value);};
 setPlatform({on(event,fn){(handlers[event]||=[]).push(fn);},lockPointer(){emit('pointerlock',true);},unlockPointer(){emit('pointerlock',false);}});
 const g={settings:{keys:{}},gameMode:0,previousGameMode:1,permissionLevel:2,gui:{width:480,height:240},inWorld:true,sent:[],showDebug:false,send(bytes){this.sent.push(bytes);}};
 g.input=new Input(g.settings);g.screens=new ScreenManager(g);g.input.on('key',e=>Game.prototype.onKey.call(g,e));g._debugCombo=Game.prototype._debugCombo;g.input.on('lock',locked=>Game.prototype.onLockChange.call(g,locked));
 emit('pointerlock',true);return {g,emit};
}
test('F3+F4 stays open across real input pointer-unlock events until F3 is released',()=>{
 const {g,emit}=fixture();emit('keydown',{code:'F3'});emit('keydown',{code:'F4'});
 const screen=g.screens.current;assert.ok(screen instanceof GameModeSwitcherScreen);assert.equal(g.input.locked,false);assert.equal(g.input.down.has('F3'),false);assert.equal(g.input.isKeyHeld('F3'),true);
 for(let tick=0;tick<20;tick++)g.screens.tick();assert.equal(g.screens.current,screen);assert.equal(g.sent.length,0);
 emit('keyup',{code:'F4'});emit('keydown',{code:'F4'});assert.equal(screen.selected,1);emit('keyup',{code:'F4'});emit('keydown',{code:'F4'});assert.equal(screen.selected,2);
 emit('keyup',{code:'F3'});assert.equal(g.screens.current,null);assert.equal(g.input.locked,true);assert.equal(g.sent.length,1);
 const r=new Reader(g.sent[0]);r.varint();assert.equal(r.string(),'/gamemode adventure');assert.equal(g.showDebug,false);
 screen.tick();screen.keyUp({code:'F3'});assert.equal(g.sent.length,1,'release commits only once');
});
test('focus loss clears physical keys and cannot leave the switcher stuck',()=>{
 const {g,emit}=fixture();emit('keydown',{code:'F3'});emit('keydown',{code:'F4'});emit('blur');assert.equal(g.input.isKeyHeld('F3'),false);g.screens.tick();assert.equal(g.screens.current,null);assert.equal(g.sent.length,1);
 emit('keyup',{code:'F3'});assert.equal(g.showDebug,false,'the consumed debug combo must not toggle F3 after focus returns');
});
test('Escape cancels the mode change and gameplay movement remains cleared while the menu is open',()=>{
 const {g,emit}=fixture();emit('keydown',{code:'KeyW'});emit('keydown',{code:'F3'});emit('keydown',{code:'F4'});assert.equal(g.input.down.has('KeyW'),false);
 emit('keydown',{code:'Escape'});emit('keyup',{code:'F3'});assert.equal(g.sent.length,0);assert.equal(g.showDebug,false);
});
