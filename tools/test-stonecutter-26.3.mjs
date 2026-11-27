import {test} from 'node:test';
import assert from 'node:assert/strict';
import {stonecutterRecipes} from '../client/js/game/workstations-1.14.4.js';

const game=(extra={})=>({items:{isBlockItem:()=>false,name:id=>'item'+id},...extra});

test('26.3 stonecutter uses the native ingredient/display list', () => {
  const g=game({stonecutterRecipes:[
    {input:{items:[1,2]},option:{type:'item_stack',stack:{itemId:9,count:4}}},
    {input:{items:[3]},option:{type:'item',item:7}},
    {input:{tag:'minecraft:stone_crafting_materials'},option:{type:'item',item:8}}
  ]});
  const rows=stonecutterRecipes(g,{id:2});
  assert.equal(rows.length,1);
  assert.deepEqual(rows[0].data.result,{id:9,count:4});
  assert.equal(rows[0].data.ingredient.includes(2),true);
});

test('26.3 stonecutter falls back to the legacy table only when no native list arrived', () => {
  const legacy={serverRecipes:[{type:'minecraft:stonecutting',data:{result:{id:5,count:1},ingredient:[{id:1}]}}]};
  assert.equal(stonecutterRecipes(game(legacy),{id:1}).length,1);
  assert.deepEqual(stonecutterRecipes(game({stonecutterRecipes:[]}),{id:1}),[]);
});
