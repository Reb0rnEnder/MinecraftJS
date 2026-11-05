// Reproduce target IDs without relying on a moving minecraft-data checkout.
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {cache,root,target,verify} from './prepare.mjs';
const bytes=await readFile(join(cache,'protocol-1.20.6.json'));
verify(bytes,target.minecraftData.inputs['protocol-1.20.6.json'],'protocol schema');
const schema=JSON.parse(bytes),lines=['// Generated from the pinned protocol-766 schema; native phase registrations are audited separately.','export const PROTOCOL_766=766;'];
for(const phase of ['login','configuration','play'])for(const [direction,suffix] of [['toClient','CLIENTBOUND'],['toServer','SERVERBOUND']]){
 const ids=Object.fromEntries(Object.entries(schema[phase][direction].types.packet[1][0].type[1].mappings).map(([id,name])=>[name,Number(id)]));
 lines.push('export const '+phase.toUpperCase()+'_'+suffix+'_766=Object.freeze('+JSON.stringify(ids)+');');
}
const path=join(root,'client/js/net/protocol-1.20.6-ids.js'),source=lines.join('\n')+'\n';
if(process.argv.includes('--check')){if(await readFile(path,'utf8')!==source)throw Error('Protocol IDs need regeneration');}else await writeFile(path,source);
