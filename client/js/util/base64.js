// Base64 decoding without host globals.
const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const LUT = new Int16Array(128).fill(-1);
for (let i = 0; i < 64; i++) LUT[A.charCodeAt(i)] = i;

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
