// Minimal read-only ZIP reader (enough for Minecraft client jars).
const fs = require('fs');
const zlib = require('zlib');

class ZipFile {
  constructor(filePath) {
    this.path = filePath;
    this.data = fs.readFileSync(filePath);
    this.entries = new Map();
    this._readCentralDirectory();
  }

  _readCentralDirectory() {
    const buf = this.data;
    // Find End Of Central Directory record (scan backwards, max comment 64k)
    let eocd = -1;
    for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
      if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('Not a zip file: ' + this.path);
    const count = buf.readUInt16LE(eocd + 10);
    let off = buf.readUInt32LE(eocd + 16);
    for (let i = 0; i < count; i++) {
      if (buf.readUInt32LE(off) !== 0x02014b50) break;
      const method = buf.readUInt16LE(off + 10);
      const compSize = buf.readUInt32LE(off + 20);
      const size = buf.readUInt32LE(off + 24);
      const nameLen = buf.readUInt16LE(off + 28);
      const extraLen = buf.readUInt16LE(off + 30);
      const commentLen = buf.readUInt16LE(off + 32);
      const localOff = buf.readUInt32LE(off + 42);
      const name = buf.toString('utf8', off + 46, off + 46 + nameLen);
      this.entries.set(name, { method, compSize, size, localOff });
      off += 46 + nameLen + extraLen + commentLen;
    }
  }

  has(name) { return this.entries.has(name); }

  list(prefix) {
    const out = [];
    for (const name of this.entries.keys()) {
      if (name.startsWith(prefix) && !name.endsWith('/')) out.push(name);
    }
    return out;
  }

  read(name) {
    const e = this.entries.get(name);
    if (!e) return null;
    const buf = this.data;
    const nameLen = buf.readUInt16LE(e.localOff + 26);
    const extraLen = buf.readUInt16LE(e.localOff + 28);
    const start = e.localOff + 30 + nameLen + extraLen;
    const raw = buf.subarray(start, start + e.compSize);
    if (e.method === 0) return Buffer.from(raw);
    if (e.method === 8) return zlib.inflateRawSync(raw);
    throw new Error('Unsupported zip method ' + e.method);
  }
}

module.exports = { ZipFile };
