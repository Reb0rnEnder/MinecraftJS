import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {Items} from '../client/js/game/items.js';import {Interaction} from '../client/js/game/interaction.js';import {RecipeBook} from '../client/js/game/recipebook.js';
const read=n=>JSON.parse(readFileSync(new URL('../client/data/'+n+'.json',import.meta.url))),items=new Items({data:{items:read('items'),creative:read('creative')}});
test('native full-hunger food exceptions include chorus fruit and exclude golden carrots',()=>{
 for(const [name,expected] of [['chorus_fruit',true],['golden_apple',true],['enchanted_golden_apple',true],['golden_carrot',false],['apple',false]]){
  const stack={id:items.byName.get(name).id,count:1},g={items,player:{},gameMode:0,food:20,cooldownFraction:()=>0,inventory:{getHand:()=>stack},send(){}};const interaction=new Interaction(g);assert.equal(interaction.sendUseItem(stack),expected,name);
 }
});
test('recipe book uses native resource names and expands native item tags rather than legacy numeric IDs',()=>{
 const defs=new Map(read('items').map(i=>[i.name,i])),planks=defs.get('oak_planks').id,stick=defs.get('stick').id;
 const g={assets:{itemsByName:defs,recipes:[{name:'stick',type:'minecraft:crafting_shaped',pattern:['P','P'],key:{P:{tag:'minecraft:planks'}},result:{item:'minecraft:stick',count:4}}]},tags:{registries:{items:new Map([['minecraft:planks',[planks]]])}},inventory:{main:[{id:planks,count:2,damage:0}]}};
 const book=new RecipeBook(g);book.categoryOf=()=> 'misc';const recipe=book.recipe('minecraft:stick');assert.ok(recipe);assert.equal(recipe.id,'minecraft:stick');assert.equal(recipe.result.id,stick);assert.equal(recipe.result.count,4);assert.deepEqual(recipe.cells.map(c=>c.map(s=>s.id)),[[planks],[planks]]);assert.equal(book.canCraft(recipe,book.stackedContents([])),true);assert.equal(book.recipe(11),null);
});

test('native jar recipe tree supplies all 524 recipes and creates a name-keyed recipe book',async()=>{
 const {ZipFile}=await import('../lib/zip.js');const jar=new ZipFile(new URL('../cache/1.13.2.jar',import.meta.url));const recipes=jar.list('data/minecraft/recipes/').filter(n=>n.endsWith('.json')).map(path=>({name:path.slice('data/minecraft/recipes/'.length,-5),...JSON.parse(jar.read(path))}));assert.equal(recipes.length,524);
 const g={assets:{itemsByName:new Map(read('items').map(i=>[i.name,i])),recipes}},book=new RecipeBook(g);book.categoryOf=()=> 'misc';assert.ok(book.recipe('minecraft:stick'));assert.ok(book.recipe('minecraft:oak_planks'));
});
