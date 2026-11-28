// Base64 decoding without host globals.
const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const LUT = new Int16Array(128).fill(-1);
for (let i = 0; i < 64; i++) LUT[A.charCodeAt(i)] = i;

export function encodeBase64(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let out = '';
  for (let i = 0; i < b.length; i += 3) {
    const a = b[i], c = i + 1 < b.length ? b[i + 1] : 0, d = i + 2 < b.length ? b[i + 2] : 0;
    const n = (a << 16) | (c << 8) | d;
    out += A[(n >> 18) & 63] + A[(n >> 12) & 63] + (i + 1 < b.length ? A[(n >> 6) & 63] : '=') + (i + 2 < b.length ? A[n & 63] : '=');
  }
  return out;
}

export function decodeBase64(s) {
  const out = new Uint8Array(Math.floor(s.length * 3 / 4) + 3);
  let buf = 0, bits = 0, n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    const v = c < 128 ? LUT[c] : -1;
    if (v < 0) continue;
    buf = ((buf << 6) | v) & 0xffffff; bits += 6;
    if (bits >= 8) { bits -= 8; out[n++] = (buf >> bits) & 255; }
  }
  return out.subarray(0, n);
}
