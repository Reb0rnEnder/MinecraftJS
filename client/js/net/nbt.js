// Uncompressed big-endian NBT as used inside 1.8 packets.
// Tags are kept typed ({ t, v }) so they can be written back verbatim;
// use simplify() for convenient plain-JS access.
import { decodeUtf8, encodeUtf8 } from '../util/utf8.js';

export const TAG = {
  END: 0, BYTE: 1, SHORT: 2, INT: 3, LONG: 4, FLOAT: 5, DOUBLE: 6,
  BYTE_ARRAY: 7, STRING: 8, LIST: 9, COMPOUND: 10, INT_ARRAY: 11,
};

function readPayload(r, t, depth) {
  if (depth > 512) throw new Error('NBT too deep');
  switch (t) {
    case TAG.BYTE: return r.i8();
    case TAG.SHORT: return r.i16();
    case TAG.INT: return r.i32();
    case TAG.LONG: return r.i64();
    case TAG.FLOAT: return r.f32();
    case TAG.DOUBLE: return r.f64();
    case TAG.BYTE_ARRAY: { const n = r.i32(); return Int8Array.from(r.bytesN(n)); }
    case TAG.STRING: return readUtf(r);
    case TAG.LIST: {
      const et = r.u8();
      const n = r.i32();
      const items = [];
      for (let i = 0; i < n; i++) items.push(readPayload(r, et, depth + 1));
      return { et, items };
    }
    case TAG.COMPOUND: {
      const obj = {};
      for (;;) {
        const ct = r.u8();
        if (ct === TAG.END) break;
        const name = readUtf(r);
        obj[name] = { t: ct, v: readPayload(r, ct, depth + 1) };
      }
      return obj;
    }
    case TAG.INT_ARRAY: {
      const n = r.i32();
      const a = new Int32Array(n);
      for (let i = 0; i < n; i++) a[i] = r.i32();
      return a;
    }
    default: throw new Error('Unknown NBT tag ' + t);
  }
}

function readUtf(r) {
  const len = r.u16();
  const b = r.bytesN(len);
  // Java "modified UTF-8" is close enough to UTF-8 for display purposes
  return decodeUtf8(b);
}

// Reads a named root tag. Returns { t, name, v }.
export function readNbtRoot(r) {
  const t = r.u8();
  if (t === TAG.END) return null;
  const name = readUtf(r);
  return { t, name, v: readPayload(r, t, 0) };
}

function writeUtf(w, s) {
  const b = encodeUtf8(s);
  w.u16(b.length);
  w.raw(b);
}

function writePayload(w, t, v) {
  switch (t) {
    case TAG.BYTE: w.i8(v); break;
    case TAG.SHORT: w.i16(v); break;
    case TAG.INT: w.i32(v); break;
    case TAG.LONG: w.i64(v); break;
    case TAG.FLOAT: w.f32(v); break;
    case TAG.DOUBLE: w.f64(v); break;
    case TAG.BYTE_ARRAY: w.i32(v.length); for (const b of v) w.i8(b); break;
    case TAG.STRING: writeUtf(w, v); break;
    case TAG.LIST:
      w.u8(v.items.length ? v.et : 0);
      w.i32(v.items.length);
      for (const it of v.items) writePayload(w, v.et, it);
      break;
    case TAG.COMPOUND:
      for (const [k, tag] of Object.entries(v)) {
        w.u8(tag.t);
        writeUtf(w, k);
        writePayload(w, tag.t, tag.v);
      }
      w.u8(0);
      break;
    case TAG.INT_ARRAY: w.i32(v.length); for (const x of v) w.i32(x); break;
    default: throw new Error('Unknown NBT tag ' + t);
  }
}

export function writeNbtRoot(w, root) {
  if (!root) return w.u8(0);
  w.u8(root.t);
  writeUtf(w, root.name || '');
  writePayload(w, root.t, root.v);
  return w;
}

// Typed tag -> plain JS (compounds become objects, lists become arrays)
export function simplify(tag) {
  if (!tag) return null;
  return simplifyValue(tag.t, tag.v);
}

function simplifyValue(t, v) {
  if (t === TAG.COMPOUND) {
    const o = {};
    for (const [k, c] of Object.entries(v)) o[k] = simplifyValue(c.t, c.v);
    return o;
  }
  if (t === TAG.LIST) return v.items.map((it) => simplifyValue(v.et, it));
  if (t === TAG.LONG) return Number(v);
  return v;
}

// Helpers for building typed NBT
export const nbt = {
  compound: (obj) => ({ t: TAG.COMPOUND, v: obj }),
  string: (s) => ({ t: TAG.STRING, v: s }),
  int: (n) => ({ t: TAG.INT, v: n }),
  short: (n) => ({ t: TAG.SHORT, v: n }),
  byte: (n) => ({ t: TAG.BYTE, v: n }),
  list: (et, items) => ({ t: TAG.LIST, v: { et, items } }),
};
