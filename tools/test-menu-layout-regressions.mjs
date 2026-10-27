import{test}from'node:test';import assert from'node:assert/strict';
import{ServerEditScreen,MultiplayerScreen}from'../client/js/gui/screens/menus.js';
import{ShaderPacksScreen,ShaderOptionsScreen}from'../client/js/gui/screens/shaders.js';
import{shaderMenu}from'../client/js/render/shader-menu.js';import{supportedShaderOptions}from'../client/js/render/shader-pack.js';
import{readFileSync,readdirSync}from'node:fs';
const game=()=>({gui:{width:641,height:361},settings:{servers:[]},shaderPack:{error:'',availableOptions:[],options:{},enabled:true},device:{createFinalShaderPass(){}}});
test('Direct Connect and Add Server use separate native button offsets and integer list coordinates',()=>{
 for(const direct of [true,false]){const g=game(),s=new ServerEditScreen(g,{},null,direct);s.init();assert.equal(s.buttons.find(b=>b.id===0).y,Math.floor(361/4+96+(direct?12:18)));assert.equal(s.addrField.y,direct?116:106);}
 const s=new MultiplayerScreen(game(),{});s.init();assert.equal(s.list.slotLeft(),170);assert.equal(s.list.scrollBarX(),474);
});
test('both shader screens use opaque dirt outside a world and world dimming inside one',()=>{
 for(const inWorld of [false,true]){const g=game();g.inWorld=inWorld;for(const Screen of [ShaderPacksScreen,ShaderOptionsScreen])assert.equal(new Screen(g,{}).background,inWorld?'world':'dirt');}
});
for(const name of readdirSync(new URL('../',import.meta.url)).filter(n=>/Sildur|Astra/.test(n)&&n.endsWith('.zip')))test(name+' keeps supported options in author-defined categories and uses declared sliders',()=>{
 const bytes=readFileSync(new URL('../'+name,import.meta.url)),options=supportedShaderOptions(bytes),menu=shaderMenu(bytes,options),seen=new Set(),walk=m=>{for(const e of m.entries){if(e?.menu)walk(e.menu);else if(e?.option)seen.add(e.option);}};walk(menu.root);
 assert.ok(menu.root.entries.some(e=>e?.menu));assert.ok(menu.sliders.size>0);assert.ok([...seen].every(name=>options.some(o=>o.name===name)));
 assert.ok(menu.root.entries.every(e=>!e?.option||!/_R$|_G$|_B$/.test(e.option)),'RGB controls belong inside colour submenus');
});

test('shader list keeps multiple packs and skips dirt overlays while a world is visible',()=>{
 for(const inWorld of [false,true]){const g=game();g.inWorld=inWorld;g.assets={texture:()=>null};g.shaderLibrary={entries:[{id:'a',name:'A.zip'},{id:'b',name:'B.zip'}],selected:'a',enabled:true};const s=new ShaderPacksScreen(g,{});s.init();assert.equal(s.list.size(),4);assert.equal(s.list.isSelected(2),true);let dirt=0;s.list._dirt({rect(){dirt++;}},32,60,32,0);assert.equal(dirt,inWorld?0:1);}
});
