// Asset manager: base game assets (an assets/ folder next to the page, or the zip embedded in a single-file build)
// layered under user resource packs.
import { setJarModels } from './render/entity-models.js';
import { platform } from './platform/platform.js';
import { defaultAssetSource } from './asset-source.js';
import { decodePng } from './util/png.js';
import { ZipArchive } from './util/zip.js';
import { Atlas } from './render/atlas.js';
import { initBlocks } from './world/blocks.js';
import { initBiomes } from './world/biomes.js';
import { ModelStore } from './render/models.js';
import { MeshPool } from './render/mesh-service.js';
import { MINECRAFTJS_EN } from './gui/i18n.js';
import { decodeUtf8 } from './util/utf8.js';

const MC = 'assets/minecraft/';
const PACK_PREFIX = 'packs/';

export class ResourcePack {
  constructor(id, bytes) {
    this.id = id;
    this.zip = new ZipArchive(bytes);
    this.prefix = this.zip.rootPrefix();
    this.name = id.replace(/\.zip$/i, '');
    this.description = '';
    this.format = 1;
    try {
      const meta = JSON.parse(this.zip.readText(this.prefix + 'pack.mcmeta'));
      const d = meta.pack && meta.pack.description;
      this.description = typeof d === 'string' ? d : d && d.text ? d.text : '';
      this.format = meta.pack && meta.pack.pack_format;
      if (meta.language && typeof meta.language === 'object') this.languages = meta.language;
    } catch (e) { /* pack.mcmeta missing or malformed */ }
    try { const icon = this.zip.read(this.prefix + 'pack.png'); this.icon = icon ? decodePng(icon) : null; } catch (e) { this.icon = null; }
  }
  path(rel) { return this.prefix + MC + rel; }
  has(rel) { return this.zip.has(this.path(rel)); }
  read(rel) { return this.zip.read(this.path(rel)); }
  list(relPrefix) { return this.zip.list(this.path(relPrefix)).map((n) => n.slice(this.prefix.length + MC.length)); }
}

export class Assets {
  constructor() {
    this.images = new Map();   // rel -> decoded image | null (loading) | false (missing)
    this.textures = new Map(); // rel -> device texture
    this.data = {};
    this.packs = [];           // active packs, highest priority first
    this.serverPack = null;    // the current server's resource pack (serverpacks.js), first in packs while set
    this.device = null;
    this.version = 0;          // bumps on every (re)load so caches elsewhere can invalidate
    this.language = 'en_us';   // selected language code (lowercase since 1.11, as the .lang files)
    this.mipmapLevels = 4;     // terrain atlas mipmap levels (video setting)
    this.languages = {};       // code -> { name, region, bidirectional }
    this.langUnicode = false;  // language needs the unicode font (LanguageManager.isCurrentLocaleUnicode)
    this.langBidi = false;     // right-to-left language
    this.source = defaultAssetSource(); // base assets (asset-source.js)
  }

  setDevice(device) { this.device = device; }

  // ---------------------------------------------------------------- resource packs

  async listPacks() {
    const ids = await platform().files.list(PACK_PREFIX).catch(() => []);
    const out = [];
    for (const key of ids) {
      const id = key.slice(PACK_PREFIX.length);
      try {
        const bytes = await platform().files.get(key);
        out.push(new ResourcePack(id, bytes));
      } catch (e) { console.warn('Bad resource pack', id, e.message); }
    }
    return out;
  }

  async addPack(name, bytes) {
    const pack = new ResourcePack(name, bytes); // validates that it is a zip
    if (!pack.zip.has(pack.prefix + 'pack.mcmeta')) throw new Error('Not a resource pack (pack.mcmeta missing)');
    await platform().files.put(PACK_PREFIX + name, bytes);
    return pack;
  }

  async removePack(id) { await platform().files.delete(PACK_PREFIX + id); }

  async activatePacks(ids) {
    const all = await this.listPacks();
    this.packs = ids.map((id) => all.find((p) => p.id === id)).filter(Boolean);
    if (this.serverPack) this.packs.unshift(this.serverPack); // a server's pack stays on top while connected
  }

  // ---------------------------------------------------------------- file access (pack-aware)

  async readBytes(rel) {
    for (const p of this.packs) if (p.has(rel)) return p.read(rel);
    return this.source.bytes('minecraft/' + rel);
  }

  async readText(rel) { const b = await this.readBytes(rel); return b ? decodeUtf8(b) : null; }
  async readJson(rel) { const t = await this.readText(rel); return t ? JSON.parse(t) : null; }

  async readSound(rel) {
    for (const p of this.packs) if (p.has('sounds/' + rel)) return p.read('sounds/' + rel);
    return this.source.bytes('minecraft/sounds/' + rel);
  }

  // sounds.json: packs add events, or replace them when "replace": true
  async loadSoundDefinitions() {
    let defs = {};
    try { defs = JSON.parse(decodeUtf8(await this.source.bytes('minecraft/sounds.json'))); } catch (e) { defs = {}; }
    for (const p of [...this.packs].reverse()) {
      if (!p.has('sounds.json')) continue;
      try {
        const add = JSON.parse(decodeUtf8(p.read('sounds.json')));
        for (const [ev, d] of Object.entries(add)) {
          if (d.replace || !defs[ev]) defs[ev] = { ...d };
          else defs[ev] = { ...defs[ev], sounds: [...(defs[ev].sounds || []), ...(d.sounds || [])] };
        }
      } catch (e) { console.warn('Bad sounds.json in', p.id); }
    }
    return defs;
  }

  // ---------------------------------------------------------------- images & textures

  // Decoded image or null while loading / missing. rel is relative to textures/.
  image(rel) {
    const cur = this.images.get(rel);
    if (cur !== undefined) return cur || null;
    this.images.set(rel, null);
    this.imageAsync(rel).catch(() => this.images.set(rel, false));
    return null;
  }

  async imageAsync(rel) {
    const cur = this.images.get(rel);
    if (cur) return cur;
    const bytes = await this.readBytes('textures/' + rel);
    if (!bytes) { this.images.set(rel, false); throw new Error('Missing texture ' + rel); }
    const img = decodePng(bytes);
    this.images.set(rel, img);
    return img;
  }

  // Device texture for a texture path (null until decoded)
  texture(rel, opts = {}) {
    const key = rel + (opts.wrap === 'repeat' ? '#r' : '');
    let t = this.textures.get(key);
    if (t) return t;
    const img = this.image(rel);
    if (!img) return null;
    t = this.device.createTexture({ width: img.width, height: img.height, data: img.data, filter: opts.filter || 'nearest', wrap: opts.wrap || 'clamp' });
    this.textures.set(key, t);
    return t;
  }

  // Texture from raw RGBA data, cached by key (e.g. composed banner textures)
  makeTexture(key, width, height, data, opts = {}) {
    const old = this.textures.get(key);
    if (old) this.device.destroyTexture(old);
    const t = this.device.createTexture({ width, height, data, filter: opts.filter || 'nearest', wrap: opts.wrap || 'clamp' });
    this.textures.set(key, t);
    return t;
  }

  // ---------------------------------------------------------------- loading

  async load(progress) {
    const step = (msg, pct) => progress && progress(msg, pct);
    step('Checking assets...', 2);
    const meta = await this.source.bytes('pack.mcmeta');
    if (!meta) throw new Error('Game assets not found: put the assets/ folder (built with `npm run assets`) next to index.html');
    try { this.defaultPackMeta = JSON.parse(decodeUtf8(meta)); } catch (e) { this.defaultPackMeta = {}; }
    step('Loading game data...', 5);
    const names = ['blocks', 'items', 'entities', 'blockCollisionShapes', 'biomes', 'foods', 'effects', 'enchantments', 'windows', 'particles', 'materials', 'recipes', 'sounds', 'creative'];
    const datas = await Promise.all(names.map((n) => this.source.data(n)));
    names.forEach((n, i) => { this.data[n] = datas[i]; });
    // CraftingManager recipes in id order (id = 11 + index; 0 - 10 are the special recipes)
    this.recipes = await this.source.recipes();
    // Entity and block entity models, extracted from the jar when the assets were built
    const em = await this.source.entityModels();
    if (!em) throw new Error('The assets have no entity models (bundles/entity-models.json): rebuild them with `npm run assets` / `npm run build`');
    setJarModels(em);
    // SoundEvent registry: id -> event name (sound effect packets carry ids)
    this.soundNames = [];
    for (const s of this.data.sounds) this.soundNames[s.id] = s.name;
    this.itemsById = new Map();
    this.itemsByName = new Map();
    for (const b of this.data.blocks) { this.itemsById.set(b.id, b); this.itemsByName.set(b.name, b); }
    for (const it of this.data.items) { this.itemsById.set(it.id, it); this.itemsByName.set(it.name, it); }
    await this.loadResources(progress);
  }

  // Everything that resource packs can change (called on start and on pack changes)
  async loadResources(progress) {
    const step = (msg, pct) => progress && progress(msg, pct);
    this.version++;
    for (const t of this.textures.values()) this.device.destroyTexture(t);
    this.textures.clear();
    this.images.clear();
    const packsLowFirst = [...this.packs].reverse();

    step('Loading block models...', 15);
    const models = await this.source.models();
    this.models = models.models;
    this.blockstates = models.blockstates;
    for (const p of packsLowFirst) {
      for (const f of p.list('models/')) if (f.endsWith('.json')) { try { this.models[f.slice(7, -5)] = JSON.parse(decodeUtf8(p.read(f))); } catch (e) { /* skip bad json */ } }
      for (const f of p.list('blockstates/')) if (f.endsWith('.json')) { try { this.blockstates[f.slice(12, -5)] = JSON.parse(decodeUtf8(p.read(f))); } catch (e) { /* skip */ } }
    }

    step('Loading textures...', 35);
    const { files, mcmeta } = await this.source.blockTextures();
    for (const p of packsLowFirst) {
      for (const dir of ['textures/blocks/', 'textures/items/']) {
        for (const f of p.list(dir)) {
          const rel = f.slice('textures/'.length);
          if (f.endsWith('.png')) files.set(rel.slice(0, -4), () => p.read(f));
          else if (f.endsWith('.png.mcmeta')) { try { mcmeta[rel.slice(0, -11)] = JSON.parse(decodeUtf8(p.read(f))); } catch (e) { /* skip */ } }
        }
      }
    }
    step('Building texture atlas...', 50);
    const textures = [];
    for (const [name, get] of files) {
      try { textures.push({ name, image: decodePng(get()) }); } catch (e) { /* undecodable texture */ }
    }
    this.atlas = new Atlas();
    this.atlas.build(textures, mcmeta);
    if (this.atlasTexture) this.device.destroyTexture(this.atlasTexture);
    this.atlasTexture = this.device.createTexture({ width: this.atlas.size, height: this.atlas.size, data: this.atlas.data, filter: 'nearest', mipmaps: this.mipmapLevels });

    step('Loading colour maps...', 65);
    const [grass, foliage] = await Promise.all([this.imageAsync('colormap/grass.png'), this.imageAsync('colormap/foliage.png')]);
    this.grassPixels = grass.data;
    this.foliagePixels = foliage.data;
    initBlocks(this.data.blocks, this.data.blockCollisionShapes);
    initBiomes(this.data.biomes, this.grassPixels, this.foliagePixels);
    this.modelStore = new ModelStore(this.models, this.blockstates, this.atlas);

    step('Loading language...', 70);
    await this.loadLanguageList();
    await this.loadLanguage(this.language);
    this.splashes = ((await this.readText('texts/splashes.txt')) || '').split('\n').map((s) => s.trim()).filter(Boolean);

    step('Loading interface...', 75);
    await Promise.all([
      'gui/widgets.png', 'gui/icons.png', 'font/ascii.png', 'font/ascii_sga.png', 'gui/options_background.png', 'gui/title/minecraft.png', 'gui/title/edition.png',
      'gui/container/inventory.png', 'environment/sun.png', 'environment/moon_phases.png', 'environment/clouds.png',
      'misc/vignette.png', 'particle/particles.png', 'misc/shadow.png',
    ].map((p) => this.imageAsync(p).catch(() => null)));
    try { this.glyphSizes = await this.readBytes('font/glyph_sizes.bin'); } catch (e) { this.glyphSizes = null; }

    step('Starting mesh worker...', 85);
    await this.startMeshWorker();
    step('Ready', 100);
  }

  // Pool of mesh workers (one per spare CPU core, up to 6); re-initialised on resource reloads
  startMeshWorker() {
    if (!this.worker) {
      // The single-file build inlines the worker bundle (tools/build.js defines __MESH_WORKER_SOURCE__) as a classic
      // script in a data: URL: a file:// page has an opaque origin, and Chrome refuses blob: workers there
      const inlined = typeof __MESH_WORKER_SOURCE__ === 'string';
      const url = inlined
        ? 'data:text/javascript;charset=utf-8,' + encodeURIComponent(__MESH_WORKER_SOURCE__)
        : new URL('./render/mesh-worker.js', import.meta.url).href;
      const cores = platform().cpuCount || 4;
      this.worker = new MeshPool(url, Math.max(1, Math.min(6, cores - 1)), { classic: inlined });
    }
    return this.worker.init({
      type: 'init',
      models: this.models,
      blockstates: this.blockstates,
      atlas: this.atlas.exportLookup(),
      blocksJson: this.data.blocks,
      shapesJson: this.data.blockCollisionShapes,
      biomesJson: this.data.biomes,
      grass: this.grassPixels,
      foliage: this.foliagePixels,
    });
  }

  // Mipmap Levels video setting: rebuild the atlas texture with the new chain
  setMipmapLevels(n) {
    n = Math.max(0, Math.min(4, n | 0));
    if (n === this.mipmapLevels && this.atlasTexture) return;
    this.mipmapLevels = n;
    if (!this.atlas || !this.atlasTexture) return;
    this.device.destroyTexture(this.atlasTexture);
    this.atlasTexture = this.device.createTexture({ width: this.atlas.size, height: this.atlas.size, data: this.atlas.data, filter: 'nearest', mipmaps: n });
  }

  // ---------------------------------------------------------------- languages (vanilla LanguageManager)

  // All languages: the game's list plus the "language" sections of active resource packs
  async loadLanguageList() {
    const list = { ...((this.defaultPackMeta && this.defaultPackMeta.language) || {}) };
    if (!list.en_us) list.en_us = { name: 'English', region: 'US', bidirectional: false };
    for (const p of [...this.packs].reverse()) if (p.languages) Object.assign(list, p.languages);
    this.languages = list;
    return list;
  }

  // en_us is always loaded first so untranslated keys fall back to English (vanilla Locale behaviour);
  // the selected language and every active pack's .lang files are layered on top.
  async loadLanguage(code) {
    code = String(code || 'en_us').toLowerCase();
    if (!this.languages[code]) code = 'en_us';
    const packsLowFirst = [...this.packs].reverse();
    const lang = { ...MINECRAFTJS_EN };
    const own = {};
    const parse = (text, into) => {
      for (const line of text.split('\n')) {
        if (!line || line.startsWith('#')) continue;
        const i = line.indexOf('=');
        if (i > 0) into[line.slice(0, i)] = line.slice(i + 1).replace(/\r$/, '');
      }
    };
    const layer = async (c, into) => {
      const base = await this.source.bytes('minecraft/lang/' + c + '.lang').catch(() => null);
      if (base) parse(decodeUtf8(base), into);
      for (const p of packsLowFirst) if (p.has('lang/' + c + '.lang')) parse(decodeUtf8(p.read('lang/' + c + '.lang')), into);
    };
    await layer('en_us', lang);
    this.langEn = { ...lang }; // English table, used to map English data names to keys
    if (code !== 'en_us') { await layer(code, own); Object.assign(lang, own); }
    this.lang = lang;
    this.language = code;
    // Locale.checkUnicode: more than 10% of the characters are outside Latin-1
    let total = 0, wide = 0;
    for (const v of Object.values(own)) for (let i = 0; i < v.length; i++) { total++; if (v.charCodeAt(i) > 255) wide++; }
    this.langUnicode = total > 0 && wide / total > 0.1;
    this.langBidi = !!(this.languages[code] && this.languages[code].bidirectional);
    this.langVersion = (this.langVersion || 0) + 1;
    return code;
  }

  // String.format-like: %s, %d, %1$s positional arguments and %% escapes
  translate(key, args = []) {
    let s = this.lang[key];
    if (s === undefined) return key;
    let i = 0;
    s = s.replace(/%(%|(\d+\$)?[sd])/g, (m, spec, pos) => {
      if (spec === '%') return '%';
      const idx = pos ? parseInt(pos, 10) - 1 : i++;
      return args[idx] !== undefined ? args[idx] : '';
    });
    return s;
  }
}
