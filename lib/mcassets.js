// Locates the vanilla 1.12.2 game files: the client jar (textures, models, en_us) and the asset index
// objects (sounds, sounds.json, other languages, pack.mcmeta). Uses an installed launcher's files when
// present, otherwise downloads them from Mojang into cache/.
const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');

const MC_VERSION = '1.12.2';
const ROOT = path.join(__dirname, '..');
const CACHE_DIR = path.join(ROOT, 'cache');

function minecraftDirs() {
  const dirs = [];
  if (process.env.MC_DIR) dirs.push(process.env.MC_DIR);
  if (process.env.APPDATA) dirs.push(path.join(process.env.APPDATA, '.minecraft'));
  if (process.env.XDG_DATA_HOME) dirs.push(path.join(process.env.XDG_DATA_HOME, 'minecraft'));
  dirs.push(path.join(os.homedir(), '.minecraft'));
  dirs.push(path.join(os.homedir(), 'Library', 'Application Support', 'minecraft'));
  // Flatpak / Prism / MultiMC style installs keep the vanilla layout under these
  dirs.push(path.join(os.homedir(), '.var', 'app', 'com.mojang.Minecraft', '.minecraft'));
  dirs.push(path.join(os.homedir(), '.local', 'share', 'PrismLauncher'));
  return dirs;
}

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return fetchBuffer(res.headers.location).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function versionDirs() {
  // ./1.12.2/ next to the repo holds a copied versions/1.12.2 folder
  return [path.join(ROOT, MC_VERSION), ...minecraftDirs().map((d) => path.join(d, 'versions', MC_VERSION))];
}

async function getVersionJson() {
  for (const dir of versionDirs()) {
    const p = path.join(dir, MC_VERSION + '.json');
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  }
  const cached = path.join(CACHE_DIR, MC_VERSION + '.json');
  if (fs.existsSync(cached)) return JSON.parse(fs.readFileSync(cached, 'utf8'));
  console.log('Downloading version manifest from Mojang...');
  const manifest = JSON.parse(await fetchBuffer('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'));
  const entry = manifest.versions.find((v) => v.id === MC_VERSION);
  const buf = await fetchBuffer(entry.url);
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(cached, buf);
  return JSON.parse(buf);
}

async function locateJar() {
  if (process.env.MC_JAR && fs.existsSync(process.env.MC_JAR)) return process.env.MC_JAR;
  for (const dir of versionDirs()) {
    const p = path.join(dir, MC_VERSION + '.jar');
    if (fs.existsSync(p)) return p;
  }
  const cached = path.join(CACHE_DIR, MC_VERSION + '.jar');
  if (fs.existsSync(cached)) return cached;
  const vjson = await getVersionJson();
  console.log('Downloading the ' + MC_VERSION + ' client jar...');
  const buf = await fetchBuffer(vjson.downloads.client.url);
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(cached, buf);
  return cached;
}

// { objects: { 'minecraft/sounds/...': { hash, size } } } plus a reader for those objects
async function loadAssetIndex() {
  const vjson = await getVersionJson();
  const id = vjson.assetIndex ? vjson.assetIndex.id : '1.8';
  let index = null;
  for (const dir of minecraftDirs()) {
    const p = path.join(dir, 'assets', 'indexes', id + '.json');
    if (fs.existsSync(p)) { index = JSON.parse(fs.readFileSync(p, 'utf8')); break; }
  }
  if (!index) {
    const cached = path.join(CACHE_DIR, 'assets-' + id + '.json');
    if (!fs.existsSync(cached)) {
      console.log('Downloading asset index...');
      fs.mkdirSync(CACHE_DIR, { recursive: true });
      fs.writeFileSync(cached, await fetchBuffer(vjson.assetIndex.url));
    }
    index = JSON.parse(fs.readFileSync(cached, 'utf8'));
  }
  const objectDirs = minecraftDirs().map((d) => path.join(d, 'assets', 'objects'));
  objectDirs.push(path.join(CACHE_DIR, 'objects'));
  index.read = async (name) => {
    const obj = index.objects[name];
    if (!obj) return null;
    const sub = obj.hash.slice(0, 2);
    for (const dir of objectDirs) {
      const p = path.join(dir, sub, obj.hash);
      // size check: a truncated download is fetched again
      if (fs.existsSync(p) && fs.statSync(p).size === obj.size) return fs.readFileSync(p);
    }
    const buf = await fetchBuffer(`https://resources.download.minecraft.net/${sub}/${obj.hash}`);
    if (buf.length !== obj.size) throw new Error(`Download of ${name} was cut short`);
    const outDir = path.join(CACHE_DIR, 'objects', sub);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, obj.hash), buf);
    return buf;
  };
  return index;
}

module.exports = { MC_VERSION, CACHE_DIR, getVersionJson, locateJar, loadAssetIndex, fetchBuffer };
