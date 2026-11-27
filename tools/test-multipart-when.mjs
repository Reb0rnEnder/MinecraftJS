// Multipart "when" (Selector.Deserializer): a lone OR / AND key nests conditions, several keys all match, and a
// leading "!" negates the value list. The chiseled bookshelf's per-slot parts use AND.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ModelStore} from '../client/js/render/models.js';
const face={texture:'#t'};
const box=(from,to)=>({textures:{t:'block/stone'},elements:[{from,to,faces:{up:face}}]});
const models={'block/a':box([0,0,0],[16,16,16]),'block/b':box([0,0,0],[8,8,8]),'block/c':box([8,8,8],[16,16,16]),'block/d':box([0,0,0],[4,4,4])};
const blockstates={x:{multipart:[
  {apply:{model:'a'},when:{facing:'north'}},
  {apply:{model:'b'},when:{AND:[{facing:'north'},{slot:'true'}]}},
  {apply:{model:'c'},when:{OR:[{facing:'south'},{AND:[{facing:'east'},{slot:'false'}]}]}},
  {apply:{model:'d'},when:{facing:'!north|south',slot:true}},
]}};
const store=()=>new ModelStore(models,blockstates,{uv:()=>[0,0,1,1],hasAlpha:()=>false});
const parts=(props)=>store().bakeVariant('x',props).quads.length;
test('AND, nested OR/AND, several keys and negation select the native parts',()=>{
  assert.equal(parts({facing:'north',slot:'true'}),2);   // a + b
  assert.equal(parts({facing:'north',slot:'false'}),1);  // a
  assert.equal(parts({facing:'east',slot:'false'}),1);   // c
  assert.equal(parts({facing:'east',slot:'true'}),1);    // d (not north/south, slot)
  assert.equal(parts({facing:'south',slot:'true'}),1);   // c
});
