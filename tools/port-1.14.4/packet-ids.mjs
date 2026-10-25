import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {input,target} from './prepare.mjs';
const schema=JSON.parse(await input('protocol-1.14.4.json',target.minecraftData.inputs['protocol-1.14.4.json']));
const ids=direction=>Object.fromEntries(Object.entries(schema.play[direction].types.packet[1][0].type[1].mappings).map(([id,name])=>[name,Number(id)]));
const source='// Generated from the SHA-1-pinned protocol-498 schema in tools/port-1.14.4/target.json.\n'+
  'export const CLIENTBOUND_498 = '+JSON.stringify(ids('toClient'),null,2)+';\n'+
  'export const SERVERBOUND_498 = '+JSON.stringify(ids('toServer'),null,2)+';\n';
const output=new URL('../../client/js/net/protocol-1.14.4-ids.js',import.meta.url);
if(process.argv.includes('--check'))assert.equal(await readFile(output,'utf8'),source,'498 packet IDs need regeneration');
else await writeFile(output,source);
console.log('Verified 93 clientbound and 46 serverbound packet IDs from the pinned schema');
// Reuse only packet bodies whose declared wire schemas are unchanged.
const previous=JSON.parse(await input('protocol-1.13.2.json',target.minecraftData.inputs['protocol-1.13.2.json']));
const map=(s,d)=>Object.fromEntries(Object.entries(s.play[d].types.packet[1][0].type[1].mappings).map(([id,n])=>[n,Number(id)]));
const oldIn=map(previous,'toClient'),newIn=map(schema,'toClient'),oldOut=map(previous,'toServer'),newOut=map(schema,'toServer');
const bodies={},outbound={};
for(const [name,id] of Object.entries(oldIn))if(newIn[name]!==undefined&&JSON.stringify(previous.play.toClient.types['packet_'+name])===JSON.stringify(schema.play.toClient.types['packet_'+name]))bodies[newIn[name]]=id;
for(const [name,id] of Object.entries(oldOut))if(newOut[name]!==undefined)outbound[id]=newOut[name];
const reused='// Packet-name/schema matches from the pinned 404/498 schemas. Positions, metadata and particles use Reader498.\nexport const BODY_404 = '+JSON.stringify(bodies,null,2)+';\nexport const OUT_498 = '+JSON.stringify(outbound,null,2)+';\n';
const reuseOutput=new URL('../../client/js/net/protocol-1.14.4-reuse.js',import.meta.url);
if(process.argv.includes('--check'))assert.equal(await readFile(reuseOutput,'utf8'),reused,'498 reuse mapping needs regeneration');
else await writeFile(reuseOutput,reused);
