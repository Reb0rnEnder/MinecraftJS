import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {auditFeatures} from './port-1.14.4/audit-features.mjs';

const root = new URL('../',import.meta.url);
const read = p => JSON.parse(readFileSync(new URL(p,root)));

test('feature review accounts for every recorded wiki topic and patch group with evidence and acceptance scenarios',()=>{
  const checklist=read('tools/port-1.14.4/feature-checklist.json');
  const rows=checklist.features;
  assert.equal(new Set(rows.map(f=>f.id)).size,rows.length);
  assert.equal(rows.filter(f=>f.section==='Additions').length,63);
  assert.equal(rows.filter(f=>f.section==='Changes').length,88);
  assert.equal(rows.filter(f=>f.section==='Patches').length,15);
  for(const f of rows){
    assert.ok(['verified','partial','missing','server-owned','not-applicable','unverified'].includes(f.status),f.id);
    if(f.status==='verified')assert.ok(f.verifiedBy?.length>25,'Record executed acceptance evidence: '+f.id);
    assert.ok(f.observation.length>25,f.id);
    assert.ok(f.acceptance.length>25,f.id);
    assert.ok(f.evidence.length,f.id);
    for(const path of f.evidence)assert.ok(existsSync(new URL(path,root)),f.id+': '+path);
  }
});

test('checked-in diagnostic results match current runtime, native registry IDs and asset paths',()=>{
  const actual=auditFeatures();
  assert.deepEqual(actual,read('docs/feature-audit-1.14.4-results.json'),'Regenerate the diagnostic after reviewing changed feature behavior');
  for(const probe of actual.probes){
    assert.equal(probe.result,JSON.stringify(probe.expected)===JSON.stringify(probe.actual)?'verified':'gap',probe.id);
  }
  for(const name of ['bow.use-action','apple.use-action','chicken-egg.colors']){
    assert.equal(actual.probes.find(p=>p.id==='control.'+name).result,'verified','Audit fixture positive control: '+name);
  }
  assert.equal(actual.contentInventory.blocks.length,actual.registryChecks.blocks.native);
  assert.equal(actual.contentInventory.items.length+1,actual.registryChecks.items.native,'air is intentionally not an inventory item');
  assert.equal(actual.contentInventory.blocks.reduce((n,b)=>n+b.states,0),actual.visuals.states);
});
