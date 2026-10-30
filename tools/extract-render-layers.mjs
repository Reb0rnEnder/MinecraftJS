import {nativeClasspath} from '../lib/native-classpath.js';
// Execute the target-native client render-layer lookup; no graphics context.
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';import {join,delimiter} from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
import mcassets from '../lib/mcassets.js';
const root=fileURLToPath(new URL('../',import.meta.url)),version=mcassets.MC_VERSION,cache=join(root,'cache','port-'+version),mode=process.argv[2]||'--write';
assert.ok(['--write','--check'].includes(mode));
const target=JSON.parse(await readFile(join(root,'tools','port-'+version,'target.json'))),jar=join(cache,'client.jar');assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),target.downloads.client.sha1);
const temp=await mkdtemp(join(tmpdir(),'mc-render-layers-'));
try{
 const out=join(temp,'layers.json');try{execFileSync(process.env.JAVA||'java',['-cp',nativeClasspath(cache),join(root,'tools','ExtractRenderLayers.java'),join(cache,'client.txt'),join(root,'client/data/blocks.json'),out],{cwd:cache,stdio:'pipe'});}catch(e){throw Error(String(e.stdout||'')+String(e.stderr||''));}
 const layers=JSON.parse(await readFile(out)),blocks=JSON.parse(await readFile(join(root,'client/data/blocks.json'))),file=join(root,'client/data/blockCollisionShapes.json'),data=JSON.parse(await readFile(file));
 assert.ok(data.render,'Native render properties must exist before render-layer extraction');assert.equal(Object.keys(layers).length,blocks.length);
 for(const block of blocks)assert.ok(['solid','cutoutMipped','cutout','translucent','tripwire'].includes(layers[block.name]),'Missing native render layer: '+block.name);
 if(mode==='--check')assert.deepEqual(data.render.layers,layers);else{data.render.layers=layers;await writeFile(file,JSON.stringify(data)+'\n');}
 console.log(version+': '+blocks.length+' native render layers '+(mode==='--check'?'verified':'written'));
}finally{await rm(temp,{recursive:true,force:true});}
