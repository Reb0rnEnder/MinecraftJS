import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalJson, canonicalReport } from './port-1.20.6/canonical-report.mjs';

test('native report hashes ignore component-map order but preserve semantic list order', () => {
  const components = [{type:'minecraft:lore',value:['first','second']}, {type:'minecraft:damage',value:3}];
  const a = {'minecraft:test':{components}};
  const b = {'minecraft:test':{components:[...components].reverse()}};
  assert.equal(canonicalReport('items', a), canonicalReport('items', b));
  assert.notEqual(canonicalReport('items', a), canonicalReport('items', {'minecraft:test':{components:[
    {type:'minecraft:lore',value:['second','first']}, components[1]
  ]}}));
  assert.notEqual(canonicalReport('items', a), canonicalReport('items', {'minecraft:test':{components:[
    components[0],{type:'minecraft:damage',value:4}
  ]}}));
  assert.deepEqual(a['minecraft:test'].components, components);
  assert.equal(canonicalJson({b:1,a:{z:2,c:3}}), canonicalJson({a:{c:3,z:2},b:1}));
});
