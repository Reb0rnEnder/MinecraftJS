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
