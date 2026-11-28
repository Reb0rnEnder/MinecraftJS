// 1.20 armor trims: PalettedPermutations colour mapping, ArmorTrim texture names with material overrides,
// the trim_type predicate and the native smithing screen helpers.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {paletteMapping,applyPalette,palettedPermutationSprites} from '../client/js/render/paletted-permutations.js';
import {itemTrim,trimTextureName,trimTypePredicate,armorMaterialOf} from '../client/js/render/armor-trims-1.20.6.js';
import {CyclingSlotBackground,smithingTemplateKind,SMITHING_SLOTS} from '../client/js/gui/screens/smithing-1.20.6.js';
const img=(w,h,px)=>({width:w,height:h,data:Uint8Array.from(px)});
test('palette mapping: key colours ignore alpha, alpha multiplies, unmatched keep RGB, transparent pixels untouched',()=>{
 const key=img(2,1,[10,20,30,255, 40,50,60,0]),val=img(2,1,[1,2,3,128, 4,5,6,255]);
 const map=paletteMapping(key.data,val.data);assert.equal(map.size,1,'transparent key colours are skipped');
 const out=applyPalette(img(3,1,[10,20,30,200, 99,99,99,255, 10,20,30,0]),map).data;
 assert.deepEqual([...out],[1,2,3,Math.trunc(200*128/255), 99,99,99,255, 10,20,30,0]);
 assert.throws(()=>paletteMapping(key.data,img(1,1,[0,0,0,0]).data));
});
test('atlas definitions produce <texture>_<permutation> sprites',async()=>{
 const images={'trims/items/a':img(1,1,[10,20,30,255]),'trims/color_palettes/key':img(1,1,[10,20,30,255]),'trims/color_palettes/red':img(1,1,[255,0,0,255])};
 const sprites=await palettedPermutationSprites([{sources:[{type:'minecraft:paletted_permutations',textures:['minecraft:trims/items/a'],palette_key:'trims/color_palettes/key',permutations:{red:'trims/color_palettes/red'}}]}],async p=>images[p]??null);
 assert.deepEqual(sprites.map(s=>[s.name,[...s.image.data]]),[['trims/items/a_red',[255,0,0,255]]]);
});
const game=(trim,tags=null)=>({items:{name:id=>({1:'minecraft:iron_chestplate',2:'minecraft:iron_leggings',3:'minecraft:stick',4:'minecraft:golden_boots'})[id],component:(it,c)=>c==='trim'?trim:undefined},tags,dimensionCodec:null});
test('trim textures use the material override for matching armor (iron on iron -> iron_darker)',()=>{
 const iron={material:{materialId:5},pattern:{patternId:0}};// KNOWN_PACK registry order: material 5 = iron, pattern 0 = coast
 const g=game(iron);assert.equal(itemTrim(g,{id:1}).material.assetName,'iron');
 assert.equal(trimTextureName(g,{id:1},false),'trims/models/armor/coast_iron_darker');assert.equal(trimTextureName(g,{id:2},true),'trims/models/armor/coast_leggings_iron_darker');
 const gold=game({material:{materialId:5},pattern:{patternId:0}});assert.equal(trimTextureName(gold,{id:4},false),'trims/models/armor/coast_iron');
 const inline=game({material:{data:{assetName:'custom',itemModelIndex:0.55,overrideArmorMaterials:[{armorMaterialId:2,assetName:'custom_iron'}]}},pattern:{data:{assetId:'minecraft:shiny',decal:true}}});
 assert.equal(trimTextureName(inline,{id:1},false),'trims/models/armor/shiny_custom_iron');assert.equal(trimTypePredicate(inline,{id:1}),0.55);
 assert.equal(armorMaterialOf('minecraft:golden_boots'),'minecraft:gold');
});
test('trim_type: -inf unless trimmable armor, 0 untrimmed, the material index otherwise',()=>{
 assert.equal(trimTypePredicate(game(undefined),{id:3}),-Infinity);assert.equal(trimTypePredicate(game(undefined),{id:1}),0);
 assert.equal(trimTypePredicate(game({material:{materialId:5},pattern:{patternId:0}}),{id:1}),Math.fround(0.2));
});
test('smithing screen: four native slots, template kinds and the 30-tick cycling icon fade',()=>{
 assert.deepEqual(SMITHING_SLOTS,[[0,8,48],[1,26,48],[2,44,48],[3,98,48]]);
 const g={items:{name:id=>({1:'minecraft:netherite_upgrade_smithing_template',2:'minecraft:coast_armor_trim_smithing_template'})[id]}};
 assert.equal(smithingTemplateKind(g,{id:1}),'upgrade');assert.equal(smithingTemplateKind(g,{id:2}),'trim');assert.equal(smithingTemplateKind(g,null),null);
 const c=new CyclingSlotBackground(0),icons=['a','b'];for(let i=0;i<29;i++)c.update(icons);assert.deepEqual(c.layers(0),[['a',1]]);
 c.update(icons);assert.equal(c.index,1);assert.deepEqual(c.layers(0.5).map(l=>[l[0],Math.round(l[1]*1000)/1000]),[['a',0.875],['b',0.125]]);
});
