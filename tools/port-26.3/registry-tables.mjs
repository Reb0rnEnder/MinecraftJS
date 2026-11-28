// Regenerates the client's id -> name tables from Mojang's own 26.3 registry report.
// Sound events and particle types are wire ids, so an older table silently maps every id
// added after 1.20.6 to the wrong sound/particle.
import {readFileSync,writeFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const reports=join(root,'cache/port-26.3/generated/reports/registries.json');
const registries=JSON.parse(readFileSync(reports,'utf8'));

function table(registry,expected){
  const entries=registries[registry];
  assert.ok(entries,'26.3 registry report carries '+registry);
  const rows=Object.entries(entries.entries)
    .map(([key,value])=>({id:value.protocol_id,name:key.replace(/^minecraft:/,'')}))
    .sort((a,b)=>a.id-b.id);
  assert.equal(rows.length,expected,registry+' has '+expected+' native entries');
  assert.deepEqual(rows.map(row=>row.id),Array.from({length:expected},(_,id)=>id),registry+' ids are contiguous from zero');
  return rows;
}

const outputs=[
  ['minecraft:sound_event',1991,'sounds.json'],
  ['minecraft:particle_type',128,'particles.json']
];
const check=process.argv.includes('--check');
for(const [registry,count,file] of outputs){
  const rows=table(registry,count);
  const text=JSON.stringify(rows)+'\n';
  const path=join(root,'client/data',file);
  if(check){
    assert.equal(readFileSync(path,'utf8'),text,file+' needs regeneration (run npm run tables:26.3)');
  }else{
    writeFileSync(path,text);
  }
  console.log((check?'Verified':'Wrote')+' native 26.3 '+file+': '+rows.length+' ids');
}
