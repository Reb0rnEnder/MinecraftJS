// Native 1.21.11 packet identities directly from Mojang's verified packets.json report (and verified against server.jar).
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { root, cache, target, verify } from './prepare.mjs';

verify(await readFile(join(cache, 'client.jar')), target.downloads.client, 'client jar');
verify(await readFile(join(cache, 'server.jar')), target.downloads.server, 'server jar');

const packets = JSON.parse(await readFile(join(cache, 'generated/reports/packets.json'), 'utf8'));
const byOrder = (entries, expectedCount, label) => {
  const list = Object.entries(entries || {})
    .map(([key, info]) => [info.protocol_id, key.replace(/^minecraft:/, '')])
    .sort((a, b) => a[0] - b[0]);
  if (list.length !== expectedCount || !list.every(([id], idx) => id === idx)) {
    throw new Error(`Unexpected native ${label} packet table: count=${list.length}`);
  }
  return list.map(([, name]) => name);
};

const clientbound = byOrder(packets.play?.clientbound, 139, 'Play clientbound');
const serverbound = byOrder(packets.play?.serverbound, 66, 'Play serverbound');
const configClientbound = byOrder(packets.configuration?.clientbound, 20, 'Configuration clientbound');
const configServerbound = byOrder(packets.configuration?.serverbound, 10, 'Configuration serverbound');

const source = [
  `// Native 1.21.11 GameProtocols & ConfigurationProtocols registration order; server SHA-1 ${target.downloads.server.sha1}.`,
  `export const NATIVE_PLAY_CLIENTBOUND_NAMES_774 = Object.freeze(${JSON.stringify(clientbound)});`,
  `export const NATIVE_PLAY_SERVERBOUND_NAMES_774 = Object.freeze(${JSON.stringify(serverbound)});`,
  `export const NATIVE_CONFIGURATION_CLIENTBOUND_NAMES_774 = Object.freeze(${JSON.stringify(configClientbound)});`,
  `export const NATIVE_CONFIGURATION_SERVERBOUND_NAMES_774 = Object.freeze(${JSON.stringify(configServerbound)});`
].join('\n') + '\n';

const file = join(root, 'client/js/net/native-packet-names-1.21.11.js');
if (process.argv.includes('--check')) {
  if (await readFile(file, 'utf8') !== source) throw Error('Stale native packet identities');
  console.log('Verified native 1.21.11 packet identities (139/66 play, 20/10 configuration)');
} else {
  await writeFile(file, source);
  console.log('Generated native 1.21.11 packet identities (139/66 play, 20/10 configuration)');
}
