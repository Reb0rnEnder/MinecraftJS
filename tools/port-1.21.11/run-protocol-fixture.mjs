// Isolated, loopback-only 1.21.11 native fixture. Never edits the user's server/world.
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { cache, target, verify } from './prepare.mjs';

const host = '127.0.0.1';
const port = 25571;

const probe = createServer();
await new Promise((resolve, reject) => {
  probe.once('error', reject);
  probe.listen(port, host, resolve);
});
await new Promise((resolve) => probe.close(resolve));

const jar = join(cache, 'server.jar');
verify(await readFile(jar), target.downloads.server, 'server.jar');

const directory = join(cache, 'fixture-server');
await mkdir(directory, { recursive: true });

const opName = 'PresentProbe';
const uuidBytes = createHash('md5').update('OfflinePlayer:' + opName).digest();
uuidBytes[6] = (uuidBytes[6] & 0x0f) | 0x30;
uuidBytes[8] = (uuidBytes[8] & 0x3f) | 0x80;
const hex = uuidBytes.toString('hex');
const uuid = [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');

await writeFile(join(directory, 'eula.txt'), 'eula=true\n');
await writeFile(
  join(directory, 'ops.json'),
  JSON.stringify([{ uuid, name: opName, level: 4, bypassesPlayerLimit: true }], null, 2) + '\n'
);
await writeFile(
  join(directory, 'server.properties'),
  [
    `server-ip=${host}`,
    `server-port=${port}`,
    'online-mode=false',
    'enforce-secure-profile=false',
    'spawn-protection=0',
    'view-distance=2',
    'simulation-distance=2',
    'difficulty=peaceful',
    'gamemode=survival',
    'allow-flight=true',
    'level-name=protocol-fixture',
    'level-type=minecraft:flat',
    'generator-settings={"layers":[{"block":"minecraft:bedrock","height":1},{"block":"minecraft:stone","height":2}],"biome":"minecraft:plains","structure_overrides":[]}',
    'initial-enabled-packs=vanilla',
    'motd=MCJS isolated 1.21.11 protocol fixture',
    ''
  ].join('\n')
);

console.log('Isolated fixture: ' + directory);
const child = spawn(process.env.JAVA || 'java', ['-Xms256M', '-Xmx512M', '-jar', jar, '--nogui'], {
  cwd: directory,
  stdio: 'inherit'
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (!child.killed) child.kill(signal);
  });
}

child.on('exit', (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0));
});
