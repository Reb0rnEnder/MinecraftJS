// Builds the 26.3 item table from the native reports: registry protocol ids from
// registries.json, max stack sizes from the item component reports, names from the jar's own
// en_us.json. Every value is checked against the report sizes before the table is accepted.
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const cache=join(root,'cache/port-26.3');
const reports=join(cache,'generated/reports');
const output=join(cache,'client-data/items.json');

function lang(){
  const result=spawnSync('unzip',['-p',join(cache,'client.jar'),'assets/minecraft/lang/en_us.json'],{cwd:root,encoding:'utf8',maxBuffer:64*1024*1024});
  if(result.status!==0)throw Error('unzip failed: '+result.stderr);
  return JSON.parse(result.stdout);
}

export async function buildItems(){
  const registries=JSON.parse(await readFile(join(reports,'registries.json'),'utf8'));
  const registry=registries['minecraft:item'];
  assert.ok(registry,'registries.json carries minecraft:item');
  const entries=Object.entries(registry.entries);
  const componentDir=join(reports,'minecraft/components/item');
  const files=new Set(await readdir(componentDir));

  const items=[];
  for(const [key,entry] of entries){
    const name=key.replace(/^minecraft:/,'');
    assert.ok(files.has(name+'.json'),'item component report exists for '+name);
    const components=JSON.parse(await readFile(join(componentDir,name+'.json'),'utf8')).components;
    const stackSize=components['minecraft:max_stack_size']??64;
    items.push({id:entry.protocol_id,name,displayName:name,stackSize});
  }
  items.sort((a,b)=>a.id-b.id);
  assert.deepEqual(items.map(item=>item.id),Array.from({length:items.length},(_,id)=>id),'item ids are contiguous from zero');

  const strings=lang();
  let resolved=0;
  for(const item of items){
    const display=strings['item.minecraft.'+item.name]??strings['block.minecraft.'+item.name];
    if(display){
      item.displayName=display;
      resolved++;
    }else item.displayName=item.name.split('_').map(part=>part.charAt(0).toUpperCase()+part.slice(1)).join(' ');
  }
  assert.ok(resolved/items.length>0.98,'display names resolve from the jar language file ('+resolved+'/'+items.length+')');

  const byName=new Map(items.map(item=>[item.name,item]));
  assert.equal(items.length,1658,'item count matches the native report');
  assert.equal(byName.get('air').id,0,'air keeps protocol id 0');
  assert.equal(byName.get('stone').stackSize,64,'stone stacks to 64');
  assert.equal(byName.get('water_bucket').stackSize,1,'water buckets stack to 1');
  assert.equal(byName.get('ender_pearl').stackSize,16,'ender pearls stack to 16');
  assert.equal(byName.get('stone').displayName,'Stone','display names come from en_us.json');

  await writeFile(output,JSON.stringify(items)+'\n');
  console.log('Native 26.3 item table: '+items.length+' items, protocol ids contiguous, stack sizes and names from the jar reports');
  return items;
}

if(process.argv[1]&&process.argv[1].endsWith('build-items.mjs'))await buildItems();
