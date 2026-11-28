// Extracts the 26.3 particle_type registry order and, for each data-carrying particle, the
// StreamCodec factory that ParticleTypes passes to register(...). The server sends a VarInt
// type id followed by that type's StreamCodec, so the reader needs the exact codec per type;
// nothing here is guessed from another protocol version.
//
//   node tools/port-26.3/particle-codecs.mjs [--check]
//
// Writes fixtures/data-particle-codecs-26.3.json.
import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../..');
const out = join(here, 'fixtures/data-particle-codecs-26.3.json');
const check = process.argv.includes('--check');

const classpath = [
  join(root, 'cache/port-26.3/client.jar'),
  ...execFileSync('bash', ['-lc', `find ${JSON.stringify(join(root, 'cache/port-26.3/libraries'))} -name '*.jar' | tr '\\n' ':'`], {encoding: 'utf8'})
    .trim().split(':').filter(Boolean),
].join(process.platform === 'win32' ? ';' : ':');

function javap(args) {
  return execFileSync('javap', [...args, '-classpath', classpath, 'net.minecraft.core.particles.ParticleTypes'], {encoding: 'utf8'});
}
const verbose = javap(['-p', '-v']);
const code = javap(['-p', '-c']);

// BootstrapMethods: index -> REF_invokeStatic target (the codec factory).
const boot = new Map();
{
  let inBoot = false, current = -1, argsMode = false;
  for (const line of verbose.split('\n')) {
    if (/^BootstrapMethods:/.test(line)) { inBoot = true; continue; }
    if (inBoot && /^\S/.test(line)) inBoot = false;
    if (!inBoot) continue;
    if (/Method arguments:/.test(line)) { argsMode = true; continue; }
    let m = /^\s{2}(\d+): #\d+ REF_invokeStatic/.exec(line);
    if (m) { current = Number(m[1]); argsMode = false; continue; }
    m = /REF_invokeStatic (net\/minecraft\/[^\s:]+)\.([A-Za-z$0-9_]+):/.exec(line);
    if (m && argsMode && current >= 0 && !boot.has(current)) {
      boot.set(current, `${m[1].replaceAll('/', '.')}.${m[2]}`);
    }
  }
}

// Walk <clinit>: `ldc`/`ldc_w "name"`, then the register site's invokedynamic bootstrap
// indices. The 4-arg register(String,boolean,Function,Function) passes the StreamCodec as
// its second lambda; the 2-arg register(String,boolean) is a SimpleParticleType.
const registrations = [];
{
  let inClinit = false, name = null, indys = [];
  for (const line of code.split('\n')) {
    if (/^  static \{\};/.test(line)) { inClinit = true; continue; }
    if (inClinit && /^  [a-z].*\(/.test(line)) { inClinit = false; continue; }
    if (!inClinit) continue;
    let m = /ldc(_w)?\s+#\d+\s+\/\/ String ([a-z0-9_]+)/.exec(line);
    if (m) { name = m[2]; indys = []; continue; }
    m = /invokedynamic #\d+,\s+\d+\s+\/\/ InvokeDynamic #(\d+):/.exec(line);
    if (m) { indys.push(Number(m[1])); continue; }
    m = /invokestatic\s+#\d+\s+\/\/ Method register:(\([^)]*\))/.exec(line);
    if (m) {
      const fourArg = /Function;Ljava\/util\/function\/Function;\)/.test(m[1]);
      registrations.push({
        name,
        data: fourArg,
        codec: fourArg && indys.length >= 2 ? boot.get(indys[indys.length - 1]) || null : null,
      });
      name = null; indys = [];
    }
  }
}

const particles = registrations.filter(r => r.name);
const registry = Object.entries(JSON.parse(readFileSync(join(root, 'cache/port-26.3/generated/reports/registries.json'), 'utf8'))['minecraft:particle_type'].entries)
  .map(([name, e]) => [e.protocol_id, name.replace('minecraft:', '')])
  .sort((a, b) => a[0] - b[0]);
const registered = new Set(particles.map(p => p.name));
const missing = registry.filter(([, name]) => !registered.has(name));
if (missing.length) {
  console.error('ParticleTypes bytecode did not yield registry entries:', missing.slice(0, 8));
  process.exit(1);
}

const fixture = {
  protocol: 777,
  version: '26.3',
  particles: registry.map(([id, name]) => {
    const r = particles.find(p => p.name === name);
    return {id, name, codec: r?.codec || null};
  }),
};
// Codec descriptor per factory method (each verified with javap on the option class).
const CODEC_BY_FACTORY = {
  'BlockParticleOption.streamCodec': 'block',
  'GeyserParticleOptions.streamCodec': 'geyser',
  'GeyserBaseParticleOptions.streamCodec': 'geyser_base',
  'PowerParticleOption.streamCodec': 'power',
  'SpellParticleOption.streamCodec': 'spell',
  'ColorParticleOption.streamCodec': 'color',
  'ItemParticleOption.streamCodec': 'item',
  'ParticleTypes.lambda$static$1': 'dust',
  'ParticleTypes.lambda$static$3': 'dust_color_transition',
  'ParticleTypes.lambda$static$5': 'sculk_charge',
  'ParticleTypes.lambda$static$7': 'vibration',
  'ParticleTypes.lambda$static$9': 'trail',
  'ParticleTypes.lambda$static$11': 'shriek',
};
for (const p of fixture.particles) {
  const local = p.codec && p.codec.replace(/^net\.minecraft\.core\.particles\./, '');
  if (local && !CODEC_BY_FACTORY[local]) throw new Error('unclassified particle codec ' + p.codec);
  p.codec = local ? CODEC_BY_FACTORY[local] : 'unit';
}

const text = JSON.stringify(fixture, null, 2) + '\n';
if (check) {
  if (!existsSync(out) || readFileSync(out, 'utf8') !== text) {
    console.error('particle codecs fixture is stale; run node tools/port-26.3/particle-codecs.mjs');
    process.exit(1);
  }
  console.log(`particle codecs fixture matches (${fixture.particles.filter(p => p.codec !== 'unit').length} data types)`);
} else {
  writeFileSync(out, text);
  const clientOut = join(root, 'client/js/net/particle-types-26.3.js');
  const table = Object.fromEntries(fixture.particles.map(p => [p.id, {name: p.name, codec: p.codec}]));
  writeFileSync(clientOut,
    '// Generated from the native 26.3 particle registrations; do not hand-edit.\n' +
    '// codec names the StreamCodec attached to the ParticleType, verified with javap.\n' +
    'export const PARTICLE_TYPES_26_3=Object.freeze(' + JSON.stringify(table) + ');\n');
  const data = fixture.particles.filter(p => p.codec !== 'unit');
  console.log(`wrote ${out} and ${clientOut}: ${fixture.particles.length} types, ${data.length} with data`);
  for (const p of data) console.log(String(p.id).padStart(3), p.name, '->', p.codec);
}
