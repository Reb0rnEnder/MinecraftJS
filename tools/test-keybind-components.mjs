import{test}from'node:test';import assert from'node:assert/strict';
import{Settings,DEFAULT_KEYS}from'../client/js/game/settings.js';
import{bindingResolver}from'../client/js/game/keybind-components.js';
import{chatToPlain,chatToLegacy,chatComponentString,chatSegments,setTranslator,setKeybindResolver}from'../client/js/gui/chat.js';
const translate=key=>({'key.keyboard.space':'Space','key.keyboard.unknown':'Not Bound','custom.unregistered':'Translated fallback'})[key]??key;
setTranslator(translate);const settings={keys:{...DEFAULT_KEYS},keyName:Settings.prototype.keyName};setKeybindResolver(bindingResolver(settings,translate));
test('keybind content follows current binding in plain, styled, translated and string paths',()=>{
 const c={keybind:'key.jump',bold:true};assert.equal(chatToPlain(c),settings.keyName(settings.keys.jump));assert.ok(chatToLegacy(c).startsWith('§l'));assert.equal(chatComponentString(c),settings.keyName(settings.keys.jump));
 settings.keys.jump='KeyR';assert.equal(chatToPlain(c),settings.keyName('KeyR'));assert.equal(chatComponentString(c),settings.keyName('KeyR'));settings.keys.jump=DEFAULT_KEYS.jump;
});
test('unbound keys, mouse bindings, hotbar slots and unknown translated keys',()=>{
 settings.keys.jump='';assert.equal(chatToPlain({keybind:'key.jump'}),settings.keyName(''));settings.keys.jump=DEFAULT_KEYS.jump;
 for(const [name,field]of[['key.attack','attack'],['key.hotbar.3','hotbar3'],['key.togglePerspective','perspective']])assert.equal(chatToPlain({keybind:name}),settings.keyName(settings.keys[field]));
 assert.equal(chatToPlain({keybind:'custom.unregistered'}),'Translated fallback');assert.equal(chatToPlain({keybind:'key.missing'}),'key.missing');
});
test('hover/event segments resolve keybind names and preserve their event and style',()=>{
 const hover={action:'show_text',value:{keybind:'key.jump'}},c={keybind:'key.attack',color:'red',hoverEvent:hover,clickEvent:{action:'suggest_command',value:'/help'}};
 const [part]=chatSegments(c);assert.equal(part.text,'§c'+settings.keyName(settings.keys.attack));assert.equal(part.hoverText,settings.keyName(settings.keys.jump));assert.equal(part.hover,hover);assert.equal(part.click.value,'/help');
});
