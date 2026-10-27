import{test}from'node:test';import assert from'node:assert/strict';import{MultiplayerSafetyScreen,MultiplayerScreen,openMultiplayer}from'../client/js/gui/screens/menus.js';import{Game}from'../client/js/game/game.js';import{Settings}from'../client/js/game/settings.js';import{setPlatform}from'../client/js/platform/platform.js';
test('multiplayer disclaimer persists opt-out only on Proceed; Back/Escape return to the previous menu',()=>{
 let current,saves=0;const parent={},g={gui:{width:640,height:360,font:{wrap:()=>['one','two','three']}},settings:{skipMultiplayerWarning:false,save(){saves++;}},screens:{open(screen){current=screen;}}};
 openMultiplayer(g,parent);assert.ok(current instanceof MultiplayerSafetyScreen);current.init();assert.equal(current.buttons[0].y,136);current.buttons[2].onClick();current.close();assert.equal(current,parent);assert.equal(saves,0);assert.equal(g.settings.skipMultiplayerWarning,false);
 openMultiplayer(g,parent);current.init();current.buttons[2].onClick();current.buttons[0].onClick();assert.equal(saves,1);assert.equal(g.settings.skipMultiplayerWarning,true);assert.ok(current instanceof MultiplayerScreen);openMultiplayer(g,parent);assert.ok(current instanceof MultiplayerScreen);
});
test('multiplayer warning preference survives Settings serialization',()=>{
 const store=new Map();setPlatform({loadSetting:k=>store.get(k),saveSetting:(k,v)=>store.set(k,v)});const s=new Settings();assert.equal(s.skipMultiplayerWarning,false);s.skipMultiplayerWarning=true;s.save();assert.equal(new Settings().skipMultiplayerWarning,true);
});
test('window title includes the native session type only while in a world',()=>{
 let title;setPlatform({setTitle:t=>title=t});const g={inWorld:true,assets:{translate:k=>({'minecraftjs.version':'MinecraftJS 1.15.2','title.multiplayer.other':'Multiplayer (3rd-party)'})[k]}};Game.prototype.updateWindowTitle.call(g);assert.equal(title,'MinecraftJS 1.15.2 - Multiplayer (3rd-party)');g.inWorld=false;Game.prototype.updateWindowTitle.call(g);assert.equal(title,'MinecraftJS 1.15.2');
});
