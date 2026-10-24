// Generate authoritative static selection bounds by executing the pinned vanilla client.
// Requires Java 11+ and third-party libraries, usually supplied by the matching vanilla server jar.
// MC_LIBRARIES=/path/to/server.jar node tools/block-shapes/extract.mjs --write|--check
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, delimiter, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import mcassets from '../../lib/mcassets.js';
const root=fileURLToPath(new URL('../../',import.meta.url));
const mode=process.argv[2];assert.ok(['--write','--check'].includes(mode),'Use --write or --check');
assert.ok(process.env.MC_LIBRARIES,'Set MC_LIBRARIES to a matching vanilla server jar or third-party library classpath');
const jar=await mcassets.locateJar(),version=mcassets.MC_VERSION,temp=mkdtempSync(join(tmpdir(),'minecraft-shapes-'));
try {
  const output=join(temp,'shapes.json');
  const libraries=process.env.MC_LIBRARIES.split(delimiter).map(p=>resolve(p)).join(delimiter);
  const proc=spawnSync('java',['-cp',jar+delimiter+libraries,join(root,'tools/block-shapes/Extract.java'),version,join(root,'client/data/blocks.json'),output],{cwd:temp,encoding:'utf8',maxBuffer:8*1024*1024});
  if(proc.status!==0)throw Error(proc.stdout+proc.stderr);
  const raw=JSON.parse(readFileSync(output)),boxes=[null],indices=new Map([['null',0]]),states=[];
  const defs=JSON.parse(readFileSync(join(root,'client/data/blocks.json'))),byId=new Map(defs.map(d=>[d.id,d]));
  // Older jars compute these shapes from neighbours, which cannot be represented by metadata alone.
  // Keep the existing live-neighbour resolver for these blocks instead of recording an empty-world shape.
  const contextual=n=> /stairs|fence|pane|chest|piston|(^|_)door$/.test(n)||['cobblestone_wall','vine','iron_bars','redstone_wire','tripwire','fire','skull','double_plant'].includes(n);
  for(const [key,row] of Object.entries(raw.entries)) {
    if(version!=='1.13.2' && contextual(byId.get(Number(key)>>4)?.name||''))continue;
    const str=JSON.stringify(row.selection);if(!indices.has(str)){indices.set(str,boxes.length);boxes.push(row.selection);}states[Number(key)]=indices.get(str);
  }
  assert.ok(version!=='1.13.2'||raw.errors.length===0,raw.errors.join('\n'));
  const selection={source:{version,clientJarSha1:createHash('sha1').update(readFileSync(jar)).digest('hex')},boxes,states:Array.from(states,i=>i??null)};
  const path=join(root,'client/data/blockCollisionShapes.json'),text=readFileSync(path,'utf8'),data=JSON.parse(text);
  if(mode==='--check')assert.deepEqual(data.selection,selection,'Committed selection bounds match the jar');
  else {const base=text.includes(',\n"selection":')?text.slice(0,text.indexOf(',\n"selection":')):text.trimEnd().slice(0,-1);writeFileSync(path,base+',\n"selection":'+JSON.stringify(selection)+'\n}\n');}
  console.log(`${version}: ${states.filter(i=>i!==null&&i!==undefined).length} states, ${boxes.length} unique selection boxes; ${raw.errors.length} invalid or context-dependent legacy states omitted`);
} finally {rmSync(temp,{recursive:true,force:true});}
