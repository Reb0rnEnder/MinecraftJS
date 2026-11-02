// Generate IDs and a dependency-checked inheritance boundary. A matching packet
// body alone is insufficient when slot, metadata or particle shared types changed.
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {input,target} from './prepare.mjs';
const before=JSON.parse(await input('protocol-1.18.2.json',target.minecraftData.inputs['protocol-1.18.2.json']));
const after=JSON.parse(await input('protocol-1.19.4.json',target.minecraftData.inputs['protocol-1.19.4.json']));
import {compatible} from './protocol-compatibility.mjs';

const ids=(schema,direction)=>Object.fromEntries(Object.entries(schema.play[direction].types.packet[1][0].type[1].mappings).map(([id,name])=>[name,Number(id)]));
const body={};for(const[direction,label]of[['toClient','CLIENTBOUND'],['toServer','SERVERBOUND']]){
 body[label+'_762']=ids(after,direction);body[label+'_INHERITED_762']=Object.keys(body[label+'_762']).filter(name=>compatible(before,after,'play',direction,name));
}
const code='// Generated from SHA-1-pinned protocol schemas by tools/port-1.19.4/packet-ids.mjs.\n'+Object.entries(body).map(([key,value])=>'export const '+key+' = '+JSON.stringify(value,null,2)+';\n').join('');
const output=new URL('../../client/js/net/protocol-1.19.4-ids.js',import.meta.url);
if(process.argv.includes('--check'))assert.equal(await readFile(output,'utf8'),code);else await writeFile(output,code);
console.log(`762 IDs: ${Object.keys(body.CLIENTBOUND_762).length} clientbound, ${Object.keys(body.SERVERBOUND_762).length} serverbound; schema-compatible bodies: ${body.CLIENTBOUND_INHERITED_762.length}/${body.SERVERBOUND_INHERITED_762.length}`);
