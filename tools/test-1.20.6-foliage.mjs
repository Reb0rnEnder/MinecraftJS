import{test}from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';
import{initBlocks,findState,blocksByName}from'../client/js/world/blocks.js';import{initBiomes,setServerBiomeEntries,grassColor,foliageColor,biomeInfo}from'../client/js/world/biomes.js';import{biomeInfoNoise}from'../client/js/world/biome-info-noise.js';
import{Mesher}from'../client/js/render/mesher.js';import{ItemRenderer}from'../client/js/render/item-renderer.js';import{KNOWN_PACK_766}from'../client/js/net/known-pack-1.20.6.js';import{simplify}from'../client/js/net/nbt.js';import{nativeBiomeData}from'./port-1.20.6/biome-data.mjs';
const json=p=>JSON.parse(readFileSync(new URL(p,import.meta.url))),oracle=json('fixtures/foliage-1.20.6.json'),biomes=json('../client/data/biomes.json');
initBlocks(json('../client/data/blocks.json'),json('../client/data/blockCollisionShapes.json'));
const pixels=new Uint8ClampedArray(65536*4);for(let i=0;i<65536;i++)pixels.set([i&255,i>>8,80,255],i*4);
initBiomes(biomes,pixels,pixels);setServerBiomeEntries([]);
test('native block and item color registrations match the target Java oracle, including short grass, pink petals and untinted leaves',()=>{
 const m={biomeBlend:(x,y,z,fn)=>fn===grassColor?0x123456:fn===foliageColor?0x654321:assert.fail('Unexpected resolver')},item={assets:{grassPixels:pixels}};
 for(const [key,expected]of Object.entries(oracle.blocks)){
  const name=key.slice(10),state=blocksByName[name].defaultState;
  for(let tint=0;tint<2;tint++)assert.equal(Mesher.prototype.tintFor.call(m,state,tint,3,64,7),expected.world[tint],key+' block '+tint);
  for(const color of expected.item)assert.equal(ItemRenderer.prototype._defaultTint.call(item,name),color,key+' item');
 }
});
test('all native fallback biomes contain the exact shipped climate and color effects',()=>{
 assert.deepEqual(biomes,nativeBiomeData(biomes));assert.equal(biomes.length,64);
 for(const [name,points]of Object.entries(oracle.biomes)){
  const id=biomes.find(b=>b.name===name.slice(10)).id;
  for(const p of points){for(const y of [-64,64,250,319]){assert.equal(grassColor(id,y,p.x,p.z),p.grass,name+' grass at '+y);assert.equal(foliageColor(id,y),p.foliage,name+' foliage at '+y);}}
 }
});
test('swamp noise and both native grass colors match actual native Java samples',()=>{
 const colors=new Set();for(const p of oracle.noise){assert.ok(Math.abs(biomeInfoNoise(p.x*.0225,p.z*.0225)-p.value)<1e-12);colors.add(p.grass);}assert.equal(colors.size,2);
});
test('server registry IDs, custom grass modifiers and overrides govern blended colors',()=>{
 const native=KNOWN_PACK_766.registries['minecraft:worldgen/biome'].find(e=>e.key==='minecraft:cherry_grove');
 setServerBiomeEntries([{id:400,name:native.key,element:simplify(native.value)},{id:401,name:'test:forest',element:{temperature:.4,downfall:.8,effects:{grass_color:0xabcdef,grass_color_modifier:'dark_forest',foliage_color:0x123456}}}]);
 const m={options:{biomeBlendRadius:0},world:{getBiome:()=>400}};
 assert.equal(Mesher.prototype.biomeBlend.call(m,100,200,50,grassColor),0xb6db61);
 assert.equal(grassColor(401,200),((0xabcdef&0xfefefe)+0x28340a)>>1);assert.equal(foliageColor(401,200),0x123456);
 setServerBiomeEntries([]);assert.notEqual(biomeInfo(400).name,'cherry_grove');
});
test('upper tall grass and fern color sample the lower half biome, and packed foliage uses the resource colormap',()=>{
 for(const name of ['tall_grass','large_fern']){const calls=[],m={biomeBlend:(...args)=>{calls.push(args);return 123;}};Mesher.prototype.tintFor.call(m,findState(name,{half:'upper'}),0,3,100,7);assert.equal(calls[0][1],99);}
 const p=pixels.slice(),k=(127*256+127)*4;p.set([12,34,56,255],k);
 assert.equal(ItemRenderer.prototype._defaultTint.call({assets:{grassPixels:p}},'short_grass'),0x0c2238);
});
