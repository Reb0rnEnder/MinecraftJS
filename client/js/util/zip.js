// Read-only ZIP archive reader (for resource packs), pure JS.
import { inflateRaw } from '../lib/pako.esm.mjs';
import { decodeUtf8 } from './utf8.js';

export class ZipArchive {
  constructor(bytes) {
    this.bytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    this.dv = new DataView(this.bytes.buffer, this.bytes.byteOffset, this.bytes.byteLength);
    this.entries = new Map();
    this._readDirectory();
  }

  _readDirectory() {
    const b = this.bytes, dv = this.dv;
    let eocd = -1;
    for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('Not a zip file');
    const count = dv.getUint16(eocd + 10, true);
    let off = dv.getUint32(eocd + 16, true);
    for (let i = 0; i < count; i++) {
      if (dv.getUint32(off, true) !== 0x02014b50) break;
      const method = dv.getUint16(off + 10, true);
      const compSize = dv.getUint32(off + 20, true);
      const nameLen = dv.getUint16(off + 28, true);
      const extraLen = dv.getUint16(off + 30, true);
      const commentLen = dv.getUint16(off + 32, true);
      const localOff = dv.getUint32(off + 42, true);
      const name = decodeUtf8(b.subarray(off + 46, off + 46 + nameLen)).replace(/\\/g, '/');
      if (!name.endsWith('/')) this.entries.set(name, { method, compSize, localOff });
      off += 46 + nameLen + extraLen + commentLen;
    }
  }

  // Some packs wrap everything in a single top-level folder; find the folder containing pack.mcmeta
  rootPrefix() {
    if (this.entries.has('pack.mcmeta')) return '';
    for (const n of this.entries.keys()) {
      const m = n.match(/^([^/]+\/)pack\.mcmeta$/);
      if (m) return m[1];
    }
    return '';
  }

  has(name) { return this.entries.has(name); }

  list(prefix) {
    const out = [];
    for (const n of this.entries.keys()) if (n.startsWith(prefix)) out.push(n);
    return out;
  }

  read(name) {
    const e = this.entries.get(name);
    if (!e) return null;
    const dv = this.dv;
    const nameLen = dv.getUint16(e.localOff + 26, true);
    const extraLen = dv.getUint16(e.localOff + 28, true);
    const start = e.localOff + 30 + nameLen + extraLen;
    const raw = this.bytes.subarray(start, start + e.compSize);
    if (e.method === 0) return raw.slice();
    if (e.method === 8) return inflateRaw(raw);
    throw new Error('Unsupported zip compression ' + e.method);
  }

  readText(name) { const b = this.read(name); return b ? decodeUtf8(b) : null; }
}
