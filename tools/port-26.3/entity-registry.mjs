// Native 26.3 EntityType registry. Runs the pinned client's own registry after SharedConstants
// and Bootstrap, so protocol ids, widths, heights, eye heights and MobCategory are all native.
import {execFileSync} from 'node:child_process';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {join,delimiter} from 'node:path';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {ENTITY_TYPES_26_3} from '../../client/js/net/entity-data-26.3.js';
import {cache,root,target,verify} from './prepare.mjs';

async function nativeClasspath(){
  const files=[join(cache,'client.jar')];
  async function walk(dir){
    for(const entry of await readdir(dir,{withFileTypes:true})){
      const path=join(dir,entry.name);
      if(entry.isDirectory())await walk(path);
      else if(entry.name.endsWith('.jar'))files.push(path);
    }
  }
  await walk(join(cache,'libraries'));
  return files.join(delimiter);
}

export async function entityRegistry({check=false}={}){
  verify(await readFile(join(cache,'client.jar')),target.downloads.client,'client jar');
  const java=join(root,'tools/port-26.3/ExtractEntities263.java'),rawFile=join(cache,'entities-native-263.json');
  execFileSync(process.env.JAVA||'java',['-Xmx1G','-cp',await nativeClasspath(),java,rawFile],{stdio:'pipe',maxBuffer:16*1024*1024});
  const raw=JSON.parse(await readFile(rawFile,'utf8'));
  if(raw.length!==ENTITY_TYPES_26_3.length)throw Error('Entity registry size '+raw.length+' does not match the native entity type table');
  const seen=new Set();
  for(let id=0;id<raw.length;id++){
    const row=raw[id];
    if(row.name!==ENTITY_TYPES_26_3[id])throw Error('Entity registry id '+id+' is '+row.name+', expected '+ENTITY_TYPES_26_3[id]);
    if(seen.has(row.name))throw Error('Duplicate native entity type '+row.name);
    seen.add(row.name);
    if(!(row.width>0||row.width===0)||!(row.height>0||row.height===0))throw Error('Entity '+row.name+' has non-finite dimensions');
    if(!(row.eyeHeight>=-1&&row.eyeHeight<=64))throw Error('Entity '+row.name+' has an invalid eye height');
    if(!row.category)throw Error('Entity '+row.name+' has no MobCategory');
  }
  const rows=raw.map(row=>[row.name,row.width,row.height,row.eyeHeight,row.category]);
  const text='// Native 26.3 EntityType registry, dimensions and MobCategory; do not hand-edit.\n'
    +'export const ENTITY_REGISTRY_26_3='+JSON.stringify(rows)+';\n';
  const file=join(root,'client/js/game/entity-registry-26.3.js');
  if(check){if(await readFile(file,'utf8')!==text)throw Error('Stale native 26.3 entity registry');}
  else await writeFile(file,text);
  // client/data/entities.json is the game-facing display table. It used to lag behind the
  // target; keep it in sync with the native registry so stats and entity ids cannot disagree.
  const mob=row=>row.category!=='misc'||row.name==='copper_golem';
  const title=name=>name.split('_').map(part=>part[0].toUpperCase()+part.slice(1)).join(' ');
  const categoryLabel={monster:'Hostile mobs',creature:'Passive mobs',ambient:'Ambient',axolotls:'Water mobs',underground_water_creature:'Water mobs',water_creature:'Water mobs',water_ambient:'Water mobs'};
  const entities=rows.map(([name,width,height,eyeHeight,category],id)=>({
    id,internalId:id,name,displayName:title(name),width,height,
    type:name==='player'?'player':mob({name,category})?'mob':'other',
    category:categoryLabel[category]||'UNKNOWN',metadataKeys:[]
  }));
  const dataText=JSON.stringify(entities,null,2)+'\n';
  const dataFile=join(root,'client/data/entities.json');
  if(check){if(await readFile(dataFile,'utf8')!==dataText)throw Error('Stale native 26.3 entity display table');}
  else await writeFile(dataFile,dataText);
  console.log('Native 26.3 entity registry: '+rows.length+' types / '+rows.filter(row=>row[4]!=='misc').length+' mob categories');
  return rows;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  await entityRegistry({check:process.argv.includes('--check')});
}
