import{drawModernEffects}from'../client/js/gui/screens/containers.js';import{Hud}from'../client/js/gui/hud.js';import{tickPortal}from'../client/js/game/portal.js';import{initBlocks}from'../client/js/world/blocks.js';
import{test}from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';
import{Items}from'../client/js/game/items.js';import{Assets}from'../client/js/assets.js';import{ZipFile}from'../lib/zip.js';
const json=p=>JSON.parse(readFileSync(new URL(p,import.meta.url))),jar=new ZipFile(new URL('../cache/port-1.19.4/client.jar',import.meta.url));
function fixture(){const assets={data:{items:json('../client/data/items.json'),creative:json('../client/data/creative.json')},lang:JSON.parse(jar.read('assets/minecraft/lang/en_us.json')),translate:Assets.prototype.translate},items=new Items(assets);return{items,assets};}
function tooltip(items,duration,amplifier=0){
 const stack={id:items.byName.get('potion').id,count:1,nbt:{t:10,name:'',v:{CustomPotionEffects:{t:9,v:{et:10,items:[{Id:{t:1,v:10},Amplifier:{t:1,v:amplifier},Duration:{t:3,v:duration}}]}}}}},lines=[];
 items.potionTooltip(stack,lines,1);return lines.map(s=>s.replace(/§./g,''));
}
test('finite potion durations match the exact 1.19.4 Java formatter, including hours and large durations',()=>{
 const{items}=fixture(),native=json('./fixtures/potion-durations-1.19.4.json');assert.equal(native.clientJarSha1,'958928a560c9167687bea0cefeb7375da1e552a8');
 for(const f of native.values)assert.deepEqual(tooltip(items,f.ticks),['Regeneration ('+f.text+')']);
});
test('infinite effects and amplifier/duration labels use native translation templates',()=>{
 const{items,assets}=fixture();assert.deepEqual(tooltip(items,-1),['Regeneration (∞)']);
 assets.lang['potion.withAmplifier']='%2$s | %1$s';assets.lang['potion.withDuration']='%2$s <- %1$s';assets.lang['effect.duration.infinite']='forever';
 assert.deepEqual(tooltip(items,-1,1),['forever <- II | Regeneration']);
});

test('inventory and HUD preserve infinite effect presentation and native padded long durations',()=>{
 const{items,assets}=fixture(),calls=[],quads=[],g={items,assets,effects:new Map([[10,{duration:-1,amplifier:0}]]),screens:{current:null}},gui={width:500,blit(){},tex:()=>({}),quad:(...a)=>quads.push(a),text:(s)=>calls.push(s)};
 drawModernEffects(g,gui,{guiLeft:100,guiTop:40,xSize:195},0,0);assert.equal(calls[1],'∞');
 Hud.prototype.renderStatusEffects.call({game:g},gui);assert.equal(quads.at(-1)[9][3],1);
 g.effects.get(10).duration=75000;calls.length=0;drawModernEffects(g,gui,{guiLeft:100,guiTop:40,xSize:195},0,0);assert.equal(calls[1],'01:02:30');
});
test('infinite nausea drives portal distortion using the native 1.19.4 ID',()=>{
 initBlocks(json('../client/data/blocks.json'),null);const g={player:{x:0,y:64,z:0},world:{getState:()=>0},effects:new Map([[9,{duration:-1}]]),portalTime:0};
 tickPortal(g);assert.ok(g.portalTime>0);g.effects.delete(9);tickPortal(g);assert.equal(g.portalTime,0);
});
