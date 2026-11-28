// Reproduce target IDs without relying on a moving minecraft-data checkout.
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cache, root, target, verify } from './prepare.mjs';

const bytes = await readFile(join(cache, 'upstream/protocol.json'));
verify(bytes, target.minecraftData.inputs['upstream/protocol.json'], 'protocol schema');
const schema = JSON.parse(bytes);
const nativePackets = JSON.parse(await readFile(join(cache, 'generated/reports/packets.json'), 'utf8'));

const lines = [
  '// Generated from the pinned 1.21.11 / protocol-774 schema; native phase registrations are audited against Mojang packets.json.',
  'export const PROTOCOL_774 = 774;'
];

for (const phase of ['login', 'configuration', 'play']) {
  for (const [direction, nativeDir, suffix] of [['toClient', 'clientbound', 'CLIENTBOUND'], ['toServer', 'serverbound', 'SERVERBOUND']]) {
    const ids = Object.fromEntries(
      Object.entries(schema[phase][direction].types.packet[1][0].type[1].mappings)
        .map(([id, name]) => [name, Number(id)])
    );
    const nativeCount = Object.keys(nativePackets[phase]?.[nativeDir] || {}).length;
    if (Object.keys(ids).length !== nativeCount) {
      throw new Error(`Packet count mismatch for ${phase}.${direction}: schema=${Object.keys(ids).length} native=${nativeCount}`);
    }
    lines.push('export const ' + phase.toUpperCase() + '_' + suffix + '_774 = Object.freeze(' + JSON.stringify(ids) + ');');
  }
}

const path = join(root, 'client/js/net/protocol-1.21.11-ids.js');
const source = lines.join('\n') + '\n';
if (process.argv.includes('--check')) {
  if (await readFile(path, 'utf8') !== source) throw Error('Protocol IDs need regeneration');
  console.log('Verified protocol-1.21.11-ids.js');
} else {
  await writeFile(path, source);
  console.log('Generated protocol-1.21.11-ids.js');
}
