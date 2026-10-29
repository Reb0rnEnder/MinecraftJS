import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {input,target} from './prepare.mjs';
const schema=JSON.parse(await input('protocol-1.16.5.json',target.minecraftData.inputs['protocol-1.16.5.json']));
const ids=direction=>Object.fromEntries(Object.entries(schema.play[direction].types.packet[1][0].type[1].mappings).map(([id,name])=>[name,Number(id)]));
const source='// Generated from the SHA-1-pinned protocol-754 schema in tools/port-1.16.5/target.json.\n'+
  'export const CLIENTBOUND_754 = '+JSON.stringify(ids('toClient'),null,2)+';\n'+
  'export const SERVERBOUND_754 = '+JSON.stringify(ids('toServer'),null,2)+';\n';
const output=new URL('../../client/js/net/protocol-1.16.5-ids.js',import.meta.url);
if(process.argv.includes('--check'))assert.equal(await readFile(output,'utf8'),source,'754 packet IDs need regeneration');
else await writeFile(output,source);
console.log(`Verified ${Object.keys(ids('toClient')).length} clientbound and ${Object.keys(ids('toServer')).length} serverbound packet IDs from the pinned schema`);
