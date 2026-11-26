// Reproduce target IDs from the native 26.3 packet report. No minecraft-data checkout is involved:
// Mojang already reports every registered packet ID, and the target is unobfuscated.
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {cache,root,target} from './prepare.mjs';

const report=JSON.parse(await readFile(join(cache,'generated','reports','packets.json'),'utf8'));
const lines=['// Generated from the native 26.3 packet report (protocol 777); do not hand-edit.','export const PROTOCOL_26_3='+target.protocol+';'];
const short=name=>name.replace(/^minecraft:/,'');
for(const phase of ['login','configuration','play']){
  for(const [direction,suffix] of [['clientbound','CLIENTBOUND'],['serverbound','SERVERBOUND']]){
    const entries=report[phase]?.[direction];
    if(!entries)throw Error('Native packet report has no '+phase+'/'+direction);
    const ids=Object.fromEntries(Object.entries(entries).sort((a,b)=>a[1].protocol_id-b[1].protocol_id).map(([name,entry])=>[short(name),entry.protocol_id]));
    lines.push('export const '+phase.toUpperCase()+'_'+suffix+'_26_3=Object.freeze('+JSON.stringify(ids)+');');
  }
}
const path=join(root,'client/js/net/protocol-26.3-ids.js'),source=lines.join('\n')+'\n';

// Block-state table facts the join path needs before any client/data rebuild exists:
// the registry size and the canonical air state ids, both from the native block report.
const blocks=JSON.parse(await readFile(join(cache,'generated','reports','blocks.json'),'utf8'));
let stateCount=0;
for(const block of Object.values(blocks))for(const state of block.states)stateCount=Math.max(stateCount,state.id+1);
const airNames=['minecraft:air','minecraft:cave_air','minecraft:void_air'];
const airStates=airNames.flatMap(name=>{
  if(!blocks[name])throw Error('Native block report has no '+name);
  return blocks[name].states.map(state=>state.id);
}).sort((a,b)=>a-b);
const blocksSource=['// Generated from the native 26.3 block report; do not hand-edit.','export const BLOCK_STATE_COUNT_26_3='+stateCount+';','export const AIR_STATES_26_3=Object.freeze(['+airStates.join(',')+']);'].join('\n')+'\n';
const blocksPath=join(root,'client/js/net/blocks-26.3.js');

// The game's handlers are keyed by the 1.20.6 (minecraft-data) packet vocabulary, while both
// native tables use Mojang names. Align the 766 id table with its native name table to recover
// that vocabulary, then reuse it for every 26.3 packet that kept its native name.
const {PLAY_CLIENTBOUND_766,PLAY_SERVERBOUND_766}=await import('../../client/js/net/protocol-1.20.6-ids.js');
const {NATIVE_PLAY_CLIENTBOUND_NAMES_766,NATIVE_PLAY_SERVERBOUND_NAMES_766}=await import('../../client/js/net/native-packet-names-1.20.6.js');
const shortNative=entry=>entry.slice(entry.indexOf('minecraft:')+'minecraft:'.length);
function legacyVocabulary(ids,native){
  const byId=new Map(Object.entries(ids).map(([name,id])=>[id,name]));
  if(native.length!==byId.size)throw Error('Native 766 name table does not match its id table');
  const vocabulary=new Map();
  for(const [id,name] of byId)vocabulary.set(shortNative(native[id]),name);
  return vocabulary;
}
const clientVocabulary=legacyVocabulary(PLAY_CLIENTBOUND_766,NATIVE_PLAY_CLIENTBOUND_NAMES_766);
const serverVocabulary=legacyVocabulary(PLAY_SERVERBOUND_766,NATIVE_PLAY_SERVERBOUND_NAMES_766);
function gameNames(phase,direction,vocabulary){
  const out={};
  for(const name of Object.keys(report[phase][direction])){
    const key=short(name);
    out[key]=vocabulary.get(key)??key;
  }
  return out;
}
// The game's own handler table is the final word: a translated name is only usable when
// game.js implements on_<name>. Where 26.3 renamed a packet past the 1.20.6 vocabulary,
// the alias is recorded here instead of being guessed at call time.
// 26.3 title packets keep native names but share the game's single on_title handler, and the
// carried-stack packet has its own handler instead of the old set_slot -1/-1 form.
const ALIASES_26_3={set_held_slot:'held_item_slot',entity_position_sync:'entity_teleport',set_player_inventory:'set_slot',
 set_title_text:'title',set_subtitle_text:'title',set_action_bar_text:'title',set_titles_animation:'title',clear_titles:'title'};
const gameSource=await readFile(join(root,'client/js/game/game.js'),'utf8');
const handlers=new Set([...gameSource.matchAll(/^  on_([a-z0-9_]+)\(/gm)].map(match=>match[1]));
function handledNames(phase,direction,vocabulary){
  const out={};
  for(const name of Object.keys(report[phase][direction])){
    const key=short(name);
    const candidates=[ALIASES_26_3[key],vocabulary.get(key),key];
    const handled=candidates.find(candidate=>candidate&&handlers.has(candidate));
    if(handled)out[key]=handled;
  }
  return out;
}
const gameNamesSource=[
  '// Generated mapping from native 26.3 packet names to the names the game handlers use.',
  '// Names absent from 1.20.6 keep their native spelling and have no handler yet.',
  'export const GAME_PLAY_CLIENTBOUND_26_3=Object.freeze('+JSON.stringify(gameNames('play','clientbound',clientVocabulary))+');',
  'export const GAME_PLAY_SERVERBOUND_26_3=Object.freeze('+JSON.stringify(gameNames('play','serverbound',serverVocabulary))+');',
  'export const HANDLED_PLAY_CLIENTBOUND_26_3=Object.freeze('+JSON.stringify(handledNames('play','clientbound',clientVocabulary))+');'
].join('\n')+'\n';
const gameNamesPath=join(root,'client/js/net/game-names-26.3.js');

// Native entity type registry, dense protocol ids 0..160, plus the native serializer ids.
// The adapter needs the registry to turn add_entity's VarInt into a name the entity layer
// can render, and the codec needs the serializer table to consume set_entity_data exactly.
const registries=JSON.parse(await readFile(join(cache,'generated','reports','registries.json'),'utf8'));
const entityEntries=registries['minecraft:entity_type'].entries;
const entityTypes=[];
for(const [name,entry] of Object.entries(entityEntries))entityTypes[entry.protocol_id]=short(name);
if(entityTypes.some(name=>!name))throw Error('Native entity type ids are not dense');
const serializers=JSON.parse(await readFile(join(root,'tools/port-26.3/fixtures/entity-data-serializers-26.3.json'),'utf8'));
const serializerIds=Object.keys(serializers).map(Number);
if(!serializerIds.every((id,index)=>id===index))throw Error('Entity data serializer ids are not dense');
const entityDataSource=[
  '// Generated from the native 26.3 entity type registry and serializer dump; do not hand-edit.',
  'export const ENTITY_TYPES_26_3=Object.freeze('+JSON.stringify(entityTypes)+');',
  'export const ENTITY_DATA_SERIALIZERS_26_3=Object.freeze('+JSON.stringify(serializers)+');'
].join('\n')+'\n';
const entityDataPath=join(root,'client/js/net/entity-data-26.3.js');

// Item and data component registries, dense protocol ids, straight from the native report.
// The item table feeds the adapter's itemKey and the component table is what the item codec
// resolves a patch id through; both are asserted dense so a missing entry can never be read
// as a neighbour's id.
function denseNames(registry,label){
  const entries=registries[registry].entries;
  const names=[];
  for(const [name,entry] of Object.entries(entries))names[entry.protocol_id]=short(name);
  if(names.some(name=>!name))throw Error(label+' ids are not dense');
  return names;
}
const itemNames=denseNames('minecraft:item','Item');
const componentNames=denseNames('minecraft:data_component_type','Data component');
const registrySource=[
  '// Generated from the native 26.3 item and data component registries; do not hand-edit.',
  'export const ITEM_NAMES_26_3=Object.freeze('+JSON.stringify(itemNames)+');',
  'export const DATA_COMPONENT_NAMES_26_3=Object.freeze('+JSON.stringify(componentNames)+');'
].join('\n')+'\n';
const registryPath=join(root,'client/js/net/items-26.3.js');

if(process.argv.includes('--check')){
  for(const [file,text,label] of [[path,source,'Protocol IDs'],[blocksPath,blocksSource,'Block-state table'],[gameNamesPath,gameNamesSource,'Game packet names'],[entityDataPath,entityDataSource,'Entity type and data serializer tables'],[registryPath,registrySource,'Item and data component registries']]){
    let current;
    try{current=await readFile(file,'utf8');}catch(e){if(e.code==='ENOENT')throw Error(label+' need generation: run node tools/port-26.3/generate-ids.mjs');throw e;}
    if(current!==text)throw Error(label+' need regeneration');
  }
  console.log('Verified native 26.3 packet ID and block-state tables');
}else{
  await writeFile(path,source);
  await writeFile(blocksPath,blocksSource);
  await writeFile(gameNamesPath,gameNamesSource);
  await writeFile(entityDataPath,entityDataSource);
  await writeFile(registryPath,registrySource);
  const play=Object.keys(report.play.clientbound).length+'/'+Object.keys(report.play.serverbound).length;
  console.log('Generated '+path+' (play '+play+')');
  console.log('Generated '+blocksPath+' ('+stateCount+' states, air '+airStates.join(',')+')');
  console.log('Generated '+entityDataPath+' ('+entityTypes.length+' entity types, '+serializerIds.length+' serializers)');
  console.log('Generated '+registryPath+' ('+itemNames.length+' items, '+componentNames.length+' data components)');
}
