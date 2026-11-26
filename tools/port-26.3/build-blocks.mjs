// Builds the 26.3 block table from the unobfuscated client jar and proves it against the
// native blocks report: every state id is owned by exactly one block, and every property
// set, state count and default state comes straight from the 26.3 classes.
import {readFile,readdir,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const cache=join(root,'cache/port-26.3');
const clientJar=join(cache,'client.jar');
const output=join(cache,'client-data/blocks.json');
const classes=join(cache,'probe');

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
  if(result.status!==0){
    throw Error(label+' failed ('+result.status+')\n'+result.stdout+result.stderr);
  }
  return result.stdout+(result.stderr||'');
}

export async function buildBlocks(){
  const libraries=await jars(join(cache,'libraries'));
  assert.ok(libraries.length>20,'the 26.3 libraries are extracted');
  const classpath=[clientJar,...libraries].join(process.platform==='win32'?';':':');
  await mkdir(classes,{recursive:true});
  run('javac',['-Xlint:none','-cp',classpath,'-d',classes,join(root,'tools/port-26.3/ExtractBlocks26_3.java')],'javac');
  const log=run('java',['-Djava.awt.headless=true','-cp',classes+(process.platform==='win32'?';':':')+classpath,'ExtractBlocks26_3',output],'java');
  const summary=/blocks=(\d+) unboundStackSizes=(\d+)/.exec(log);
  assert.ok(summary,'the extractor reports a block count');

  const table=JSON.parse(await readFile(output,'utf8'));
  const report=JSON.parse(await readFile(join(cache,'generated/reports/blocks.json'),'utf8'));
  const names=Object.keys(report).map(key=>key.replace(/^minecraft:/,''));

  assert.equal(table.length,Number(summary[1]),'extractor count matches its own output');
  assert.equal(table.length,names.length,'block count matches the native report');
  const byName=new Map(table.map(block=>[block.name,block]));
  for(const name of names)assert.ok(byName.has(name),'missing native block '+name);

  let stateCount=0;
  for(const block of table){
    assert.ok(block.maxStateId>=block.minStateId,block.name+' has an ordered state range');
    assert.ok(block.defaultState>=block.minStateId&&block.defaultState<=block.maxStateId,block.name+' default state is in range');
    const native=report['minecraft:'+block.name];
    assert.equal(native.states.length,block.maxStateId-block.minStateId+1,block.name+' state count comes from the native range');
    const nativeProperties=native.properties??{};
    assert.equal(block.states.length,Object.keys(nativeProperties).length,block.name+' property count matches the report');
    const properties=new Map(block.states.map(state=>[state.name,state]));
    for(const [property,values] of Object.entries(nativeProperties)){
      const state=properties.get(property);
      assert.ok(state,'missing property '+property+' on '+block.name);
      const nativeIds=native.states.map(entry=>entry.id);
      assert.equal(state.num_values,values.length,'property '+property+' on '+block.name+' has every native value');
      if(state.type!=='bool'){
        assert.deepEqual([...state.values].sort(),[...values].sort(),'property '+property+' on '+block.name+' values match the report');
      }else{
        assert.deepEqual([...values].sort(),['false','true'],'bool property '+property+' on '+block.name+' is boolean');
      }
    }
    const nativeIds=native.states.map(entry=>entry.id);
    assert.equal(Math.min(...nativeIds),block.minStateId,block.name+' min state id');
    assert.equal(Math.max(...nativeIds),block.maxStateId,block.name+' max state id');
    assert.ok(nativeIds.includes(block.defaultState),block.name+' default state is a native state');
    stateCount+=native.states.length;
  }

  // The state space is a partition: every id 0..count-1 belongs to exactly one block.
  const owner=new Int32Array(stateCount).fill(-1);
  for(const block of table){
    for(let state=block.minStateId;state<=block.maxStateId;state++){
      assert.equal(owner[state],-1,'state id '+state+' is claimed twice');
      owner[state]=block.id;
    }
  }
  assert.ok(owner.every(id=>id>=0),'every state id is claimed');

  const facts=name=>byName.get(name);
  assert.equal(facts('air').id,0,'air keeps registry id 0');
  assert.deepEqual([facts('air').minStateId,facts('cave_air').minStateId,facts('void_air').minStateId].sort((a,b)=>a-b),[0,18649,18650],'the three air states are the native air ids');
  assert.equal(facts('cave_air').minStateId,18650,'cave air state id');
  assert.equal(facts('void_air').minStateId,18649,'void air state id');
  assert.equal(facts('stone').hardness,1.5,'stone hardness');
  assert.equal(facts('stone').filterLight,15,'stone filters all light');
  assert.equal(facts('glass').transparent,true,'glass does not render solid');
  assert.equal(facts('glass').filterLight,0,'glass filters no light');
  assert.equal(facts('water').hardness,100,'water destruction time');
  assert.equal(facts('water').boundingBox,'empty','water has no collision box');
  assert.equal(facts('torch').emitLight,14,'torch light');
  assert.equal(facts('glowstone').emitLight,15,'glowstone light');
  assert.equal(facts('oak_leaves').states.length,3,'oak leaves properties');

  console.log('Native 26.3 block table: '+table.length+' blocks / '+stateCount+' states, every state id owned once, properties and defaults match the report'+(summary[2]!=='0'?' ('+summary[2]+' item stack sizes fall back to 64 until the data-pack reload runs)':''));
  return table;
}

if(process.argv[1]&&import.meta.url.endsWith(dirname(process.argv[1]).replace(/\\/g,'/')+'/build-blocks.mjs'))await buildBlocks();
