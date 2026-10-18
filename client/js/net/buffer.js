// Binary reader/writer for the Minecraft 1.8 protocol.
import { readNbtRoot, writeNbtRoot } from './nbt.js';

const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

export class Reader {
  constructor(bytes, offset = 0) {
    this.bytes = bytes;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.offset = offset;
  }

  remaining() { return this.bytes.length - this.offset; }

  _check(n) {
    if (this.offset + n > this.bytes.length) throw new RangeError('Packet underflow');
  }

  i8() { this._check(1); return this.view.getInt8(this.offset++); }
  u8() { this._check(1); return this.bytes[this.offset++]; }
  bool() { return this.u8() !== 0; }
  i16() { this._check(2); const v = this.view.getInt16(this.offset); this.offset += 2; return v; }
  u16() { this._check(2); const v = this.view.getUint16(this.offset); this.offset += 2; return v; }
  i32() { this._check(4); const v = this.view.getInt32(this.offset); this.offset += 4; return v; }
  i64() { this._check(8); const v = this.view.getBigInt64(this.offset); this.offset += 8; return v; }
  f32() { this._check(4); const v = this.view.getFloat32(this.offset); this.offset += 4; return v; }
  f64() { this._check(8); const v = this.view.getFloat64(this.offset); this.offset += 8; return v; }

  varint() {
    let value = 0;
    let shift = 0;
    let b;
    do {
      b = this.u8();
      value |= (b & 0x7f) << shift;
      shift += 7;
      if (shift > 35) throw new Error('VarInt too big');
    } while (b & 0x80);
    return value | 0;
  }

  varlong() {
    let value = 0n;
    let shift = 0n;
    let b;
    do {
      b = this.u8();
      value |= BigInt(b & 0x7f) << shift;
      shift += 7n;
    } while (b & 0x80);
    return BigInt.asIntN(64, value);
  }

  string() {
    const len = this.varint();
    this._check(len);
    const s = textDecoder.decode(this.bytes.subarray(this.offset, this.offset + len));
    this.offset += len;
    return s;
  }

  bytesN(n) {
    this._check(n);
    const b = this.bytes.subarray(this.offset, this.offset + n);
    this.offset += n;
    return b;
  }

  rest() { return this.bytesN(this.remaining()); }

  uuid() {
    const b = this.bytesN(16);
    let hex = '';
    for (let i = 0; i < 16; i++) hex += b[i].toString(16).padStart(2, '0');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  position() {
    const v = this.i64();
    const x = Number(BigInt.asIntN(26, v >> 38n));
    const y = Number(BigInt.asIntN(12, (v >> 26n) & 0xfffn));
    const z = Number(BigInt.asIntN(26, v & 0x3ffffffn));
    return { x, y, z };
  }

  angle() { return this.i8() * 360 / 256; }

  // Slot: { id, count, damage, nbt, nbtRaw } or null
  slot() {
    const id = this.i16();
    if (id < 0) return null;
    const count = this.i8();
    const damage = this.i16();
    const start = this.offset;
    const tag = this.u8();
    let nbt = null;
    let nbtRaw = null;
    if (tag !== 0) {
      this.offset = start;
      nbt = readNbtRoot(this);
      nbtRaw = this.bytes.slice(start, this.offset);
    }
    return { id, count, damage, nbt, nbtRaw };
  }

  optionalNbt() {
    const start = this.offset;
    const tag = this.u8();
    if (tag === 0) return null;
    this.offset = start;
    return readNbtRoot(this);
  }

  metadata() {
    const meta = {};
    for (;;) {
      const item = this.u8();
      if (item === 0x7f) break;
      const index = item & 0x1f;
      const type = item >> 5;
      switch (type) {
        case 0: meta[index] = this.i8(); break;
        case 1: meta[index] = this.i16(); break;
        case 2: meta[index] = this.i32(); break;
        case 3: meta[index] = this.f32(); break;
        case 4: meta[index] = this.string(); break;
        case 5: meta[index] = this.slot(); break;
        case 6: meta[index] = { x: this.i32(), y: this.i32(), z: this.i32() }; break;
        case 7: meta[index] = { pitch: this.f32(), yaw: this.f32(), roll: this.f32() }; break;
        default: throw new Error('Unknown metadata type ' + type);
      }
    }
    return meta;
  }
}

export class Writer {
  constructor(size = 64) {
    this.bytes = new Uint8Array(size);
    this.view = new DataView(this.bytes.buffer);
    this.offset = 0;
  }

  _ensure(n) {
    if (this.offset + n <= this.bytes.length) return;
    let size = this.bytes.length * 2;
    while (size < this.offset + n) size *= 2;
    const nb = new Uint8Array(size);
    nb.set(this.bytes);
    this.bytes = nb;
    this.view = new DataView(nb.buffer);
  }

  i8(v) { this._ensure(1); this.view.setInt8(this.offset++, v); return this; }
  u8(v) { this._ensure(1); this.bytes[this.offset++] = v & 0xff; return this; }
  bool(v) { return this.u8(v ? 1 : 0); }
  i16(v) { this._ensure(2); this.view.setInt16(this.offset, v); this.offset += 2; return this; }
  u16(v) { this._ensure(2); this.view.setUint16(this.offset, v); this.offset += 2; return this; }
  i32(v) { this._ensure(4); this.view.setInt32(this.offset, v); this.offset += 4; return this; }
  i64(v) { this._ensure(8); this.view.setBigInt64(this.offset, BigInt(v)); this.offset += 8; return this; }
  f32(v) { this._ensure(4); this.view.setFloat32(this.offset, v); this.offset += 4; return this; }
  f64(v) { this._ensure(8); this.view.setFloat64(this.offset, v); this.offset += 8; return this; }

  varint(v) {
    v >>>= 0;
    do {
      let b = v & 0x7f;
      v >>>= 7;
      if (v !== 0) b |= 0x80;
      this.u8(b);
    } while (v !== 0);
    return this;
  }

  string(s) {
    const b = textEncoder.encode(s);
    this.varint(b.length);
    return this.raw(b);
  }

  raw(b) {
    this._ensure(b.length);
    this.bytes.set(b, this.offset);
    this.offset += b.length;
    return this;
  }

  uuid(str) {
    const hex = str.replace(/-/g, '');
    for (let i = 0; i < 16; i++) this.u8(parseInt(hex.substr(i * 2, 2), 16));
    return this;
  }

  position(x, y, z) {
    const v = ((BigInt(x) & 0x3ffffffn) << 38n) | ((BigInt(y) & 0xfffn) << 26n) | (BigInt(z) & 0x3ffffffn);
    return this.i64(BigInt.asIntN(64, v));
  }

  slot(item) {
    if (!item || item.id < 0) return this.i16(-1);
    this.i16(item.id).i8(item.count).i16(item.damage || 0);
    if (item.nbtRaw) return this.raw(item.nbtRaw);
    if (item.nbt) return writeNbtRoot(this, item.nbt);
    return this.u8(0);
  }

  build() { return this.bytes.slice(0, this.offset); }
}
