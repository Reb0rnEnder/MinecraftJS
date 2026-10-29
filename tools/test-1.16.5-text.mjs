import {test}from'node:test';import assert from'node:assert/strict';
import {FontRenderer,stripCodes}from'../client/js/gui/font.js';
import {chatToLegacy,chatToPlain,chatSegments,wrapChatSegments}from'../client/js/gui/chat.js';import {chatHoverTooltip}from'../client/js/gui/chat-hover.js';
const font=Object.assign(Object.create(FontRenderer.prototype),{_ready:()=>true,_providerSet:()=>null,charW:()=>6,assets:{texture:()=>null},_glyph(out,_tex,ch,x,y,color){out.push({ch,color});return 6;}});
test('RGB component colors render exactly and stay atomic through width, wrapping, clipping and hover slicing',()=>{
 const component={text:'abcdef',color:'#1234ab',hoverEvent:{action:'show_text',contents:{text:'modern hover'}}},text=chatToLegacy(component),segments=chatSegments(component);
 assert.equal(chatToPlain(component),'abcdef');assert.equal(font.width(text),36);const q=font.layout(text,0,0,0xffffff,false).quads;assert.deepEqual(q[0].color,[0x12/255,0x34/255,0xab/255,1]);
 const lines=font.wrap(text,18);assert.deepEqual(lines.map(stripCodes),['abc','def']);assert.equal(stripCodes(font.trimToWidth(text,12)),'ab');
 for(const run of wrapChatSegments(segments,lines).flat()){assert.deepEqual(font.layout(run.text,0,0,0xffffff,false).quads[0].color,q[0].color);assert.equal(run.hoverText,'modern hover');}
});
test('modern hover contents preserve item SNBT and formatted entity names',()=>{
 let inspected;const game={settings:{advancedItemTooltips:true},items:{byName:new Map([['netherite_sword',{id:610}]]),def:id=>id===610,tooltip:it=>{inspected=it;return ['Sword'];}},assets:{translate:(key,args)=>args?key+':'+args.join(','):key}};
 assert.deepEqual(chatHoverTooltip(game,{hover:{action:'show_item',contents:{id:'minecraft:netherite_sword',count:1,tag:'{Damage:7,display:{Name:\'"Named"\'}}'}}}),['Sword']);assert.equal(inspected.nbt.v.Damage.v,7);
 const entity=chatHoverTooltip(game,{hover:{action:'show_entity',contents:{type:'minecraft:piglin',id:'uuid',name:{text:'Named piglin',color:'#123456'}}}});assert.equal(stripCodes(entity[0]),'Named piglin');assert.equal(entity.at(-1),'uuid');
});
test('component font selection changes glyph metrics and survives wrapped lines',()=>{
 const glyph=advance=>({advance,x:0,y:0,width:5,height:8,boldOffset:1,shadowOffset:1,texture:()=>({})}),normal={glyph:()=>glyph(6)},custom={glyph:()=>glyph(10)};
 const f=Object.assign(Object.create(FontRenderer.prototype),{assets:{version:1,fontSets:{default:normal,'example:wide':custom},texture:()=>null},texPath:'font/ascii.png',_ready:()=>true});
 const value=chatToLegacy({text:'ABCD',font:'example:wide',color:'#123456'});assert.equal(stripCodes(value),'ABCD');assert.equal(f.width(value),40);
 const lines=f.wrap(value,20);assert.deepEqual(lines.map(stripCodes),['AB','CD']);assert.ok(lines.every(l=>f.width(l)===20));assert.equal(f.layout(lines[1],0,0,0xffffff,false).width,20);
});
