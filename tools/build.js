#!/usr/bin/env node
// MinecraftJS build.
//
//   node tools/build.js assets         extract the game assets into client/assets/ (for running client/ as is)
//   node tools/build.js html           dist/minecraftjs.html: one file with the code, game data and assets
//   node tools/build.js html --no-assets   same, but the page loads assets/ and data/ next to it instead
//
// Options: --audio=opus|vorbis|copy (default opus)  --sfx-kbps=N (32)  --music-kbps=N (48)  --no-music (leave out music and records)
//          --out=path   --config=path (config.json embedded as the defaults of the html build)
//
// Asset layout (folder and embedded zip alike):
//   pack.mcmeta, pack.png              default pack metadata (language list) and icon
//   minecraft/...                      textures, models, blockstates, lang, texts, font, sounds.json, sounds/
//   bundles/models.json, textures.bin  folder only: block models and block/item textures in one request each
//   data/*.json                        zip only: the client's game data tables (client/data in the source tree)
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { ZipFile } = require('../lib/zip');
const mcassets = require('../lib/mcassets');

const ROOT = path.join(__dirname, '..');
const CLIENT = path.join(ROOT, 'client');

function parseArgs(argv) {
  const out = { _: [] };
  for (const a of argv) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) out[m[1]] = m[2] === undefined ? true : m[2];
    else out._.push(a);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Audio compression (ffmpeg: $FFMPEG, PATH, or the ffmpeg-static dev dependency)
// ---------------------------------------------------------------------------

function findFfmpeg() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    for (const exe of ['ffmpeg', 'ffmpeg.exe']) {
      const p = path.join(dir, exe);
      if (fs.existsSync(p)) return p;
    }
  }
  try { return require('ffmpeg-static'); } catch (e) { return null; }
}

function run(exe, args, input) {
  return new Promise((resolve, reject) => {
    const child = execFile(exe, args, { encoding: 'buffer', maxBuffer: 1 << 30 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr.toString().trim().split('\n').pop() || err.message));
      else resolve(stdout);
    });
    child.stdin.end(input);
  });
}

class AudioEncoder {
  constructor(opts) {
    this.codec = opts.audio || 'opus';
    this.sfxKbps = parseInt(opts['sfx-kbps'], 10) || 32;
    this.musicKbps = parseInt(opts['music-kbps'], 10) || 48;
    this.ffmpeg = this.codec === 'copy' ? null : findFfmpeg();
    if (this.codec !== 'copy' && !this.ffmpeg) {
      console.warn('ffmpeg not found (install it, set FFMPEG, or `npm install`): sounds are copied uncompressed');
      this.codec = 'copy';
    }
    this.cacheDir = path.join(mcassets.CACHE_DIR, 'audio');
  }

  // Music and records are stereo at a higher bitrate; positional effects are mono (vanilla plays them as mono sources)
  async encode(rel, bytes) {
    if (this.codec === 'copy') return bytes;
    const music = /^(music|records)\//.test(rel);
    const kbps = music ? this.musicKbps : this.sfxKbps;
    const key = crypto.createHash('sha1').update(bytes).digest('hex') + `-${this.codec}-${kbps}${music ? 's' : 'm'}.ogg`;
    const cached = path.join(this.cacheDir, key);
    if (fs.existsSync(cached) && fs.statSync(cached).size > 0) return fs.readFileSync(cached);
    if (!bytes.length) throw new Error('Empty sound file ' + rel);
    const codecArgs = this.codec === 'opus'
      ? ['-c:a', 'libopus', '-b:a', kbps + 'k', '-vbr', 'on', '-application', 'audio']
      : ['-c:a', 'libvorbis', '-b:a', kbps + 'k'];
    const out = await run(this.ffmpeg, ['-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', '-vn', '-map_metadata', '-1',
      ...(music ? [] : ['-ac', '1']), ...codecArgs, '-f', 'ogg', 'pipe:1'], bytes);
    // Keep the original when re-encoding does not make it smaller (tiny clips)
    const result = out.length && out.length < bytes.length ? out : bytes;
    fs.mkdirSync(this.cacheDir, { recursive: true });
    fs.writeFileSync(cached + '.tmp', result); // rename: an interrupted build never leaves a partial entry
    fs.renameSync(cached + '.tmp', cached);
    return result;
  }
}

async function pool(items, n, fn) {
  let i = 0;
  const workers = Array.from({ length: n }, async () => {
    while (i < items.length) { const k = i++; await fn(items[k], k); }
  });
  await Promise.all(workers);
}

// ---------------------------------------------------------------------------
// Collect the asset tree: Map<path, Buffer>
// ---------------------------------------------------------------------------

async function collectAssets(opts) {
  const files = new Map();
  const jarPath = await mcassets.locateJar();
  console.log('Client jar:', jarPath);
  const jar = new ZipFile(jarPath);
  const P = 'assets/minecraft/';
  for (const name of jar.list(P)) {
    if (name.startsWith(P + 'shaders/')) continue; // post-processing shaders are not used by this client
    files.set('minecraft/' + name.slice(P.length), jar.read(name));
  }
  const icon = jar.read('pack.png');
  if (icon) files.set('pack.png', icon);

  const index = await mcassets.loadAssetIndex();
  const meta = await index.read('pack.mcmeta');
  const mcmeta = meta ? JSON.parse(meta.toString('utf8')) : {};
  mcmeta.pack = { pack_format: 1, description: 'The default look and feel of Minecraft' };
  files.set('pack.mcmeta', Buffer.from(JSON.stringify(mcmeta)));

  const names = Object.keys(index.objects).filter((n) => n === 'minecraft/sounds.json' || n.startsWith('minecraft/lang/') || n.startsWith('minecraft/sounds/'))
    .filter((n) => !opts['no-music'] || !/^minecraft\/sounds\/(music|records)\//.test(n));
  const sounds = names.filter((n) => n.startsWith('minecraft/sounds/'));
  const enc = new AudioEncoder(opts);
  console.log(`Sounds: ${sounds.length} files (${enc.codec === 'copy' ? 'original' : enc.codec + ` ${enc.sfxKbps}k mono / ${enc.musicKbps}k stereo music`})`);
  let done = 0, before = 0, after = 0;
  await pool(names, Math.max(2, os.cpus().length), async (name) => {
    let buf = await index.read(name);
    if (name.startsWith('minecraft/sounds/') && name.endsWith('.ogg')) {
      before += buf.length;
      buf = await enc.encode(name.slice('minecraft/sounds/'.length), buf);
      after += buf.length;
      if (++done % 100 === 0) process.stdout.write(`  ${done}/${sounds.length}\r`);
    }
    if (name === 'minecraft/lang/en_us.lang' && files.has(name)) return; // the jar's copy is authoritative
    files.set(name, buf);
  });
  console.log(`  audio ${(before / 1048576).toFixed(1)} MB -> ${(after / 1048576).toFixed(1)} MB`);
  return files;
}

// Block models + blockstates in one JSON, block/item textures in one binary container
// (u32 headerLength, JSON header { files: [[name, offset, length]], mcmeta }, then the PNG bytes)
function buildBundles(files) {
  const dec = (b) => JSON.parse(b.toString('utf8'));
  const models = { blockstates: {}, models: {} };
  const tex = [], blobs = [], mcmeta = {};
  let offset = 0;
  for (const [name, buf] of files) {
    if (name.startsWith('minecraft/blockstates/') && name.endsWith('.json')) models.blockstates[name.slice(22, -5)] = dec(buf);
    else if (name.startsWith('minecraft/models/') && name.endsWith('.json')) models.models[name.slice(17, -5)] = dec(buf);
    else if (/^minecraft\/textures\/(blocks|items)\//.test(name)) {
      const rel = name.slice('minecraft/textures/'.length);
      if (name.endsWith('.png')) { tex.push([rel.slice(0, -4), offset, buf.length]); blobs.push(buf); offset += buf.length; }
      else if (name.endsWith('.png.mcmeta')) { try { mcmeta[rel.slice(0, -11)] = dec(buf); } catch (e) { /* skip */ } }
    }
  }
  const header = Buffer.from(JSON.stringify({ files: tex, mcmeta }));
  const len = Buffer.alloc(4);
  len.writeUInt32LE(header.length);
  return {
    'bundles/models.json': Buffer.from(JSON.stringify(models)),
    'bundles/textures.bin': Buffer.concat([len, header, ...blobs]),
  };
}

function writeFolder(dir, files) {
  fs.rmSync(dir, { recursive: true, force: true });
  for (const [name, buf] of files) {
    const p = path.join(dir, name);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, buf);
  }
}

// ---------------------------------------------------------------------------
// Minimal zip writer (stored for already-compressed files, deflate for the rest)
// ---------------------------------------------------------------------------

function writeZip(files) {
  const locals = [], central = [];
  let offset = 0;
  for (const [name, data] of files) {
    const nameBuf = Buffer.from(name, 'utf8');
    const store = /\.(ogg|png|bin)$/.test(name);
    const body = store ? data : zlib.deflateRawSync(data, { level: 9 });
    const crc = zlib.crc32(data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6);
    lh.writeUInt16LE(store ? 0 : 8, 8); lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(body.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(nameBuf.length, 26);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(store ? 0 : 8, 10); ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(body.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(nameBuf.length, 28);
    ch.writeUInt32LE(offset, 42);
    locals.push(lh, nameBuf, body);
    central.push(ch, nameBuf);
    offset += 30 + nameBuf.length + body.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.size, 8); end.writeUInt16LE(files.size, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

// ---------------------------------------------------------------------------
// Single-file html
// ---------------------------------------------------------------------------

async function bundleJs() {
  const esbuild = require('esbuild');
  const common = { bundle: true, minify: true, write: false, target: 'es2022', legalComments: 'none', logLevel: 'warning' };
  const worker = await esbuild.build({ ...common, entryPoints: [path.join(CLIENT, 'js/render/mesh-worker.js')], format: 'iife' });
  const main = await esbuild.build({
    ...common,
    entryPoints: [path.join(CLIENT, 'js/main.js')],
    format: 'esm',
    define: { __MESH_WORKER_SOURCE__: JSON.stringify(worker.outputFiles[0].text) },
  });
  return main.outputFiles[0].text;
}

// Text that is safe inside <script>…</script>
const scriptSafe = (s) => s.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');

async function buildHtml(opts) {
  const out = opts.out ? path.resolve(opts.out) : path.join(ROOT, 'dist', 'minecraftjs.html');
  console.log('Bundling code...');
  const js = await bundleJs();
  const css = fs.readFileSync(path.join(CLIENT, 'style.css'), 'utf8');
  let config = null;
  const configPath = opts.config ? path.resolve(opts.config) : null;
  if (configPath) config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

  let assetsTag = '';
  if (!opts['no-assets']) {
    const files = await collectAssets(opts);
    for (const f of fs.readdirSync(path.join(CLIENT, 'data'))) {
      if (f.endsWith('.json')) files.set('data/' + f, fs.readFileSync(path.join(CLIENT, 'data', f)));
    }
    const zip = writeZip(new Map([...files].sort((a, b) => (a[0] < b[0] ? -1 : 1))));
    console.log(`Embedded assets: ${(zip.length / 1048576).toFixed(1)} MB (${files.size} files)`);
    assetsTag = `<script id="minecraftjs-assets" type="application/octet-stream">${zip.toString('base64')}</script>\n`;
  }

  else {
    // The page reads assets/ (npm run assets) and data/ next to it
    const dataOut = path.join(path.dirname(out), 'data');
    fs.rmSync(dataOut, { recursive: true, force: true });
    fs.cpSync(path.join(CLIENT, 'data'), dataOut, { recursive: true });
    console.log(`Copied data/ next to the page; put the assets/ folder there too`);
  }

  const src = fs.readFileSync(path.join(CLIENT, 'index.html'), 'utf8');
  const html = src
    .replace(/<link rel="stylesheet" href="style.css">/, () => `<style>\n${css}</style>`)
    .replace(/<script type="module" src="js\/main.js"><\/script>/, () =>
      (config ? `<script id="minecraftjs-config" type="application/json">${scriptSafe(JSON.stringify(config))}</script>\n` : '') +
      assetsTag +
      `<script type="module">\n${scriptSafe(js)}\n</script>`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
  console.log(`Wrote ${path.relative(ROOT, out)} (${(html.length / 1048576).toFixed(1)} MB)`);
}

async function buildAssets(opts) {
  const out = opts.out ? path.resolve(opts.out) : path.join(CLIENT, 'assets');
  const files = await collectAssets(opts);
  for (const [k, v] of Object.entries(buildBundles(files))) files.set(k, v);
  writeFolder(out, files);
  let total = 0;
  for (const b of files.values()) total += b.length;
  console.log(`Wrote ${path.relative(ROOT, out) || out}/ (${files.size} files, ${(total / 1048576).toFixed(1)} MB)`);
}

(async () => {
  const opts = parseArgs(process.argv.slice(2));
  const task = opts._[0] || 'html';
  if (task === 'assets') await buildAssets(opts);
  else if (task === 'html') await buildHtml(opts);
  else throw new Error('Unknown task ' + task + ' (expected "assets" or "html")');
})().catch((e) => { console.error(e.message); process.exit(1); });
