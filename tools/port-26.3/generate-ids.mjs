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
if(process.argv.includes('--check')){
  let current;
  try{current=await readFile(path,'utf8');}catch(e){if(e.code==='ENOENT')throw Error('Protocol IDs need generation: run node tools/port-26.3/generate-ids.mjs');throw e;}
  if(current!==source)throw Error('Protocol IDs need regeneration');
  console.log('Verified native 26.3 packet ID tables');
}else{
  await writeFile(path,source);
  const play=Object.keys(report.play.clientbound).length+'/'+Object.keys(report.play.serverbound).length;
  console.log('Generated '+path+' (play '+play+')');
}
