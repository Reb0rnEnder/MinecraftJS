// Pure-JS PNG decode/encode (no browser image APIs). Decodes to { width, height, data: Uint8Array RGBA }.
import { inflate, deflate } from '../lib/pako.esm.mjs';

const SIG = [137, 80, 78, 71, 13, 10, 26, 10];

export function decodePng(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < 8; i++) if (b[i] !== SIG[i]) throw new Error('Not a PNG');
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let pos = 8;
  let width = 0, height = 0, depth = 8, ctype = 6, interlace = 0;
  let palette = null, trns = null;
  const idat = [];
  while (pos < b.length) {
    const len = dv.getUint32(pos);
    const type = String.fromCharCode(b[pos + 4], b[pos + 5], b[pos + 6], b[pos + 7]);
    const data = b.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = dv.getUint32(pos + 8); height = dv.getUint32(pos + 12);
      depth = data[8]; ctype = data[9]; interlace = data[12];
    } else if (type === 'PLTE') palette = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  let total = 0;
  for (const c of idat) total += c.length;
  const comp = new Uint8Array(total);
  let o = 0;
  for (const c of idat) { comp.set(c, o); o += c.length; }
  const raw = inflate(comp);
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ctype];
  const bpp = Math.max(1, (channels * depth) >> 3); // bytes per pixel for filtering
  const out = new Uint8Array(width * height * 4);

  const decodePass = (rawOff, pw, ph, mapX, mapY) => {
    const stride = Math.ceil((pw * channels * depth) / 8);
    let prev = new Uint8Array(stride);
    let cur = new Uint8Array(stride);
    let p = rawOff;
    for (let y = 0; y < ph; y++) {
      const ft = raw[p++];
      for (let i = 0; i < stride; i++) {
        const x = raw[p++];
        const a = i >= bpp ? cur[i - bpp] : 0;
        const up = prev[i];
        const c = i >= bpp ? prev[i - bpp] : 0;
        let v;
        switch (ft) {
          case 0: v = x; break;
          case 1: v = x + a; break;
          case 2: v = x + up; break;
          case 3: v = x + ((a + up) >> 1); break;
          case 4: { const pp = a + up - c; const pa = Math.abs(pp - a), pb = Math.abs(pp - up), pc = Math.abs(pp - c); v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? up : c); break; }
          default: v = x;
        }
        cur[i] = v & 255;
      }
      for (let xpix = 0; xpix < pw; xpix++) writePixel(cur, xpix, mapX(xpix), mapY(y));
      const t = prev; prev = cur; cur = t;
    }
    return p;
  };

  const sample = (row, idx) => {
    if (depth === 8) return row[idx];
    if (depth === 16) return row[idx * 2];
    const perByte = 8 / depth;
    const byte = row[Math.floor(idx / perByte)];
    const shift = 8 - depth * (idx % perByte + 1);
    return (byte >> shift) & ((1 << depth) - 1);
  };
  const scale = depth < 8 && ctype !== 3 ? 255 / ((1 << depth) - 1) : 1;

  function writePixel(row, x, ox, oy) {
    const o = (oy * width + ox) * 4;
    switch (ctype) {
      case 0: { const g = sample(row, x) * scale; out[o] = out[o + 1] = out[o + 2] = g; out[o + 3] = trns && ((trns[0] << 8) | trns[1]) === sample(row, x) ? 0 : 255; break; }
      case 2: { out[o] = sample(row, x * 3); out[o + 1] = sample(row, x * 3 + 1); out[o + 2] = sample(row, x * 3 + 2); out[o + 3] = 255; break; }
      case 3: { const i = sample(row, x); out[o] = palette[i * 3]; out[o + 1] = palette[i * 3 + 1]; out[o + 2] = palette[i * 3 + 2]; out[o + 3] = trns && i < trns.length ? trns[i] : 255; break; }
      case 4: { const g = sample(row, x * 2); out[o] = out[o + 1] = out[o + 2] = g; out[o + 3] = sample(row, x * 2 + 1); break; }
      default: { out[o] = sample(row, x * 4); out[o + 1] = sample(row, x * 4 + 1); out[o + 2] = sample(row, x * 4 + 2); out[o + 3] = sample(row, x * 4 + 3); }
    }
  }

  if (!interlace) decodePass(0, width, height, (x) => x, (y) => y);
  else {
    // Adam7
    const passes = [[0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4], [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2]];
    let off = 0;
    for (const [x0, y0, dx, dy] of passes) {
      const pw = Math.ceil((width - x0) / dx), ph = Math.ceil((height - y0) / dy);
      if (pw <= 0 || ph <= 0) continue;
      off = decodePass(off, pw, ph, (x) => x0 + x * dx, (y) => y0 + y * dy);
    }
  }
  return { width, height, data: out };
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function encodePng(width, height, rgba) {
  const raw = new Uint8Array((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), y * (width * 4 + 1) + 1);
  }
  const idat = deflate(raw);
  const chunks = [];
  const chunk = (type, data) => {
    const c = new Uint8Array(12 + data.length);
    const dv = new DataView(c.buffer);
    dv.setUint32(0, data.length);
    for (let i = 0; i < 4; i++) c[4 + i] = type.charCodeAt(i);
    c.set(data, 8);
    dv.setUint32(8 + data.length, crc32(c.subarray(4, 8 + data.length)));
    chunks.push(c);
  };
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, width); dv.setUint32(4, height);
  ihdr[8] = 8; ihdr[9] = 6;
  chunk('IHDR', ihdr);
  chunk('IDAT', idat);
  chunk('IEND', new Uint8Array(0));
  let len = 8;
  for (const c of chunks) len += c.length;
  const out = new Uint8Array(len);
  out.set(SIG, 0);
  let o = 8;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}
