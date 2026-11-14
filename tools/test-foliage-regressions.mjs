import{test}from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';import mcassets from'../lib/mcassets.js';
import * as B from'../client/js/world/blocks.js';import * as Biomes from'../client/js/world/biomes.js';import{biomeInfoNoise}from'../client/js/world/biome-info-noise.js';import{Mesher}from'../client/js/render/mesher.js';import{ItemRenderer}from'../client/js/render/item-renderer.js';
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url))),fixture=read('fixtures/biome-info-noise.json'),rows=fixture.nativeNoiseSamples,v=mcassets.MC_VERSION,legacy=['1.8.9','1.12.2'].includes(v),heightColors=['1.8.9','1.12.2','1.13.2','1.14.4'].includes(v);
B.initBlocks(read('../client/data/blocks.json'),read('../client/data/blockCollisionShapes.json'));
const pixels=new Uint8ClampedArray(65536*4);for(let i=0;i<65536;i++)pixels.set([i&255,i>>8,80,255],i*4);
Biomes.setServerBiomes?.(null);Biomes.initBiomes([{id:1,name:'plains',temperature:.5,rainfall:1},{id:3,name:'test:float_climate',temperature:.6,rainfall:.6},{id:2,name:'swamp',temperature:.8,rainfall:.9}],pixels,pixels);
assert.equal(fixture.minecraftVersion,v);
test('native single-octave swamp noise and both swamp grass colors are preserved',()=>{for(const p of rows){assert.ok(Math.abs(biomeInfoNoise(p.x*.0225,p.z*.0225)-p.value)<1e-12);assert.equal(Biomes.grassColor(2,100,p.x,p.z),p.grass);}});
test('native float climate fields select the correct colormap pixel',()=>{assert.equal(Biomes.grassColor(3,64),0x65a350);assert.equal(Biomes.foliageColor(3,64),0x65a350);});
test('foliage height dependence remains native to this release',()=>{for(const fn of [Biomes.grassColor,Biomes.foliageColor])assert.equal(fn(1,64)===fn(1,250),!heightColors);});
test('biome blending forwards actual horizontal coordinates to the grass resolver',()=>{
 const m={options:{biomeBlendRadius:0},world:{getBiome:()=>2}},actual=Mesher.prototype.biomeBlend.call(m,77,64,-19,Biomes.grassColor),radius=legacy?1:0,colors=[];
 for(let z=-radius;z<=radius;z++)for(let x=-radius;x<=radius;x++)colors.push(Biomes.grassColor(2,64,77+x,-19+z));
 const channel=s=>Math.floor(colors.reduce((a,c)=>a+((c>>s)&255),0)/colors.length);assert.equal(actual,(channel(16)<<16)|(channel(8)<<8)|channel(0));
});
test('only native registered leaf types are tinted; modern plant halves and potted ferns sample the correct biome',()=>{
 const m={biomeBlend:()=>0x123456},item={assets:{grassPixels:pixels}};
 for(const n of ['azalea_leaves','flowering_azalea_leaves','cherry_leaves'])if(B.blocksByName[n]){assert.equal(Mesher.prototype.tintFor.call(m,B.blocksByName[n].defaultState,0,0,100,0),0xffffff);assert.equal(ItemRenderer.prototype._defaultTint.call(item,n),0xffffff);}
 if(!legacy){for(const n of ['tall_grass','large_fern']){let y;const m={biomeBlend:(x,v)=>{y=v;return 0;}};Mesher.prototype.tintFor.call(m,B.findState(n,{half:'upper'}),0,0,100,0);assert.equal(y,99);}assert.equal(Mesher.prototype.tintFor.call(m,B.blocksByName.potted_fern.defaultState,0,0,64,0),0x123456);}
 if(v==='1.19.4'){assert.equal(Mesher.prototype.tintFor.call(m,B.blocksByName.pink_petals.defaultState,0,0,64,0),0xffffff);assert.equal(Mesher.prototype.tintFor.call(m,B.blocksByName.pink_petals.defaultState,1,0,64,0),0x123456);assert.equal(ItemRenderer.prototype._defaultTint.call(item,'mangrove_leaves'),0x92c648);}
});
test('registry grass modifiers apply to custom biome names and explicit color overrides when supported',()=>{
 if(!Biomes.setServerBiomes)return;
 Biomes.setServerBiomes({'minecraft:worldgen/biome':{value:[{id:201,name:'test:forest',element:{temperature:.5,downfall:1,effects:{grass_color:0xabcdef,grass_color_modifier:'dark_forest'}}},{id:202,name:'test:swamp',element:{temperature:.5,downfall:1,effects:{grass_color:0xabcdef,grass_color_modifier:'swamp'}}}]}});
 assert.equal(Biomes.grassColor(201,250),((0xabcdef&0xfefefe)+0x28340a)>>1);for(const p of rows)assert.equal(Biomes.grassColor(202,250,p.x,p.z),p.grass);Biomes.setServerBiomes(null);
});
