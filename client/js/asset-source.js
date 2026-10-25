// Where the base game assets come from: an assets/ folder next to the page (built by `npm run assets`),
// or a zip embedded in the page (the single-file build). Both use the layout written by tools/build.js:
//   pack.mcmeta, pack.png, minecraft/<textures|models|blockstates|lang|sounds|...>, data/*.json (zip only),
//   bundles/models.json + bundles/textures.bin (folder only), bundles/entity-models.json, bundles/recipes.json.
import { platform } from './platform/platform.js';
import { ZipArchive } from './util/zip.js';
import { decodeUtf8 } from './util/utf8.js';

export class FolderSource {
  constructor(base = 'assets/') { this.base = base; this.kind = 'folder'; }
  url(rel) { return this.base + rel + '?v=1.14.4-native-v3'; }
  bytes(rel) { return platform().fetchBytes(this.url(rel)).catch(() => null); }
  data(name) { return platform().fetchJson(`data/${name}.json`); }
  models() { return platform().fetchJson(this.url('bundles/models.json')); }
  recipes() { return platform().fetchJson(this.url('bundles/recipes.json')).catch(() => []); }
  entityModels() { return platform().fetchJson(this.url('bundles/entity-models.json')).catch(() => null); }

  // { files: Map<name, () => png bytes>, mcmeta } for textures/block and textures/item
  async blockTextures() {
    const bundle = await platform().fetchBytes(this.url('bundles/textures.bin'));
    if (!bundle) throw new Error('Missing ' + this.url('bundles/textures.bin'));
    const dv = new DataView(bundle.buffer, bundle.byteOffset, bundle.byteLength);
    const hlen = dv.getUint32(0, true);
    const header = JSON.parse(decodeUtf8(bundle.subarray(4, 4 + hlen)));
    const base = 4 + hlen;
    const files = new Map();
    for (const [name, off, len] of header.files) files.set(name, () => bundle.subarray(base + off, base + off + len));
    return { files, mcmeta: header.mcmeta };
  }
}

export class ZipSource {
  constructor(bytes) { this.zip = new ZipArchive(bytes); this.kind = 'embedded'; }
  async bytes(rel) { return this.zip.read(rel); }
  async data(name) {
    const t = this.zip.readText(`data/${name}.json`);
    if (t === null) throw new Error(`Missing data/${name}.json`);
    return JSON.parse(t);
  }

  async recipes() { const t = this.zip.readText('bundles/recipes.json'); return t ? JSON.parse(t) : []; }
  async entityModels() { const t = this.zip.readText('bundles/entity-models.json'); return t ? JSON.parse(t) : null; }

  async models() {
    const out = { blockstates: {}, models: {} };
    for (const n of this.zip.list('minecraft/blockstates/')) if (n.endsWith('.json')) out.blockstates[n.slice(22, -5)] = JSON.parse(this.zip.readText(n));
    for (const n of this.zip.list('minecraft/models/')) if (n.endsWith('.json')) out.models[n.slice(17, -5)] = JSON.parse(this.zip.readText(n));
    return out;
  }

  async blockTextures() {
    const files = new Map(), mcmeta = {};
    for (const dir of ['minecraft/textures/block/', 'minecraft/textures/item/']) {
      for (const n of this.zip.list(dir)) {
        const rel = n.slice('minecraft/textures/'.length);
        if (n.endsWith('.png')) files.set(rel.slice(0, -4), () => this.zip.read(n));
        else if (n.endsWith('.png.mcmeta')) { try { mcmeta[rel.slice(0, -11)] = JSON.parse(this.zip.readText(n)); } catch (e) { /* skip */ } }
      }
    }
    return { files, mcmeta };
  }
}

// The embedded zip when the page carries one, else the assets/ folder
export function defaultAssetSource() {
  const embedded = platform().embeddedAssets ? platform().embeddedAssets() : null;
  return embedded ? new ZipSource(embedded) : new FolderSource('assets/');
}
