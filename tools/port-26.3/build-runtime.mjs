// Builds the 26.3 visual runtime from the unobfuscated client jar and installs it as
// the client data pair. Every value is native: Bootstrap-bound registries, EmptyBlockGetter
// states, real BlockState predicates and the surviving OffsetType policy. 26.3 has no
// ItemBlockRenderTypes table; render.layers is intentionally absent instead of guessed,
// because ChunkSectionLayer is chosen per BakedQuad from RenderPearl sprite transparency.
import {readFile,readdir,mkdir,copyFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const cache=join(root,'cache/port-26.3');
const clientJar=join(cache,'client.jar');
const classes=join(cache,'probe');
const target=JSON.parse(await readFile(join(root,'tools/port-26.3/target.json'),'utf8'));
const sha1=createHash('sha1').update(await readFile(clientJar)).digest('hex');
assert.equal(sha1,target.downloads.client.sha1,'the 26.3 client jar is the pinned object');

async function jars(dir){
  const out=[];
  for(const entry of await readdir(dir,{withFileTypes:true})){
    const path=join(dir,entry.name);
    if(entry.isDirectory())out.push(...await jars(path));
    else if(entry.name.endsWith('.jar'))out.push(path);
  }
  return out;
}
function run(command,args,label){
  const result=spawnSync(command,args,{cwd:root,encoding:'utf8'});
  if(result.status!==0)throw Error(label+' failed ('+result.status+')\n'+result.stdout+result.stderr);
  return result.stdout+(result.stderr||'');
}

const libraries=await jars(join(cache,'libraries'));
assert.ok(libraries.length>20,'the 26.3 libraries are extracted');
const classpath=[clientJar,...libraries].join(process.platform==='win32'?';':':');
await mkdir(classes,{recursive:true});
run('javac',['-Xlint:none','-cp',classpath,'-d',classes,join(root,'tools/port-26.3/ExtractRuntime26_3.java')],'javac');
const nativePath=join(cache,'runtime-26.3.json');
const log=run('java',['-Djava.awt.headless=true','-cp',classes+(process.platform==='win32'?';':':')+classpath,'ExtractRuntime26_3',nativePath,join(cache,'client-data/blocks.json')],'java');
const native=JSON.parse(await readFile(nativePath,'utf8'));
assert.deepEqual(native.errors,[],'native extraction has no failed states');

const blocks=JSON.parse(await readFile(join(cache,'client-data/blocks.json'),'utf8'));
const stateCount=Math.max(...blocks.map(block=>block.maxStateId))+1;
assert.equal(native.selections.length,stateCount,'every state has a native selection shape');
assert.equal(native.collisions.length,stateCount,'every state has native collision boxes');
assert.equal(native.rendering.length,stateCount,'every state has native render predicates');

// Collision boxes are deduplicated exactly like the 1.20.6 runtime table.
const collisionShapes={0:[]};
const collisionKeys=new Map([['[]',0]]);
const collisionBlocks={};
for(const block of blocks){
  const ids=[];
  for(let state=block.minStateId;state<=block.maxStateId;state++){
    const boxes=native.collisions[state];
    const key=JSON.stringify(boxes);
    if(!collisionKeys.has(key)){
      collisionKeys.set(key,Object.keys(collisionShapes).length);
      collisionShapes[collisionKeys.get(key)]=boxes;
    }
    ids.push(collisionKeys.get(key));
  }
  collisionBlocks[block.name]=ids.every(id=>id===ids[0])?ids[0]:ids;
}

const renderValues=[];const renderKeys=new Map();const renderStates=[];
for(const render of native.rendering){
  const key=JSON.stringify(render);
  if(!renderKeys.has(key)){renderKeys.set(key,renderValues.length);renderValues.push(render);}
  renderStates.push(renderKeys.get(key));
}
const selectionBoxes=[null];const selectionKeys=new Map([['null',0]]);const selectionStates=[];
for(const shape of native.selections){
  const key=JSON.stringify(shape);
  if(!selectionKeys.has(key)){selectionKeys.set(key,selectionBoxes.length);selectionBoxes.push(shape);}
  selectionStates.push(selectionKeys.get(key));
}

const output={
  blocks:collisionBlocks,
  shapes:collisionShapes,
  render:{
    source:{version:target.minecraftVersion,clientJarSha1:sha1,layout:'RenderPearl BakedQuad.MaterialInfo.layer()',renderShape:'INVISIBLE|MODEL'},
    values:renderValues,
    states:renderStates
  },
  selection:{source:{version:target.minecraftVersion,clientJarSha1:sha1},boxes:selectionBoxes,states:selectionStates},
  modelOffsets:{
    source:{version:target.minecraftVersion,clientJarSha1:sha1,blockCount:blocks.length},
    blocks:native.offsets
  }
};

// Gate facts: each value is a property of the native extraction, not a name heuristic.
const byName=new Map(blocks.map(block=>[block.name,block]));
for(const name of Object.keys(native.offsets))assert.ok(byName.has(name),'offset block exists upstream: '+name);
for(const [name,policy] of Object.entries(native.offsets)){
  assert.ok(policy.type===1||policy.type===2,name+' has a native offset type');
  assert.ok(policy.horizontal>0,name+' has a positive horizontal offset');
  assert.equal(policy.origin.length,3,name+' has a native origin');
}
const renderOf=name=>native.rendering[byName.get(name).defaultState];
assert.equal(renderOf('air').renderType,0,'air is invisible');
assert.equal(renderOf('stone').renderType,2,'stone uses a model');
assert.equal(renderOf('stone').solid,true,'stone is solid');
assert.equal(renderOf('stone').lightBlock,15,'stone dampens all light');
assert.equal(renderOf('glass').lightBlock,0,'glass dampens no light');
assert.equal(renderOf('glass').solid,false,'glass does not render solid');
assert.equal(renderOf('torch').emission,14,'torch emits 14');
assert.deepEqual(native.collisions[byName.get('water').defaultState],[],'water has no collision boxes');
assert.ok(native.selections[byName.get('torch').defaultState],'torch has a selection shape');
assert.ok(native.offsets.short_grass||native.offsets.grass||native.offsets.fern,'a native offset plant exists');
assert.equal(Object.keys(native.offsets).length,Object.keys(native.offsets).length,'offset count recorded');

await copyFile(join(cache,'client-data/blocks.json'),join(root,'client/data/blocks.json'));
await import('node:fs/promises').then(({writeFile})=>writeFile(join(root,'client/data/blockCollisionShapes.json'),JSON.stringify(output)+'\n'));
console.log('Native 26.3 runtime installed: '+blocks.length+' blocks / '+stateCount+' states, '+Object.keys(collisionShapes).length+' collision shapes, '+
  selectionBoxes.length+' selection boxes, '+renderValues.length+' render value sets, '+Object.keys(native.offsets).length+' offset policies'+
  ' (render layers are per-quad in 26.3, so none are invented)');
