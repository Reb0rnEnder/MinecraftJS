// Pure JS crypto for the client's TLS where WebCrypto (crypto.subtle) is missing: insecure http:// pages, file://
// pages and minimal runtimes. SHA-256/384/512, HMAC, AES-128/256-GCM, P-256/P-384 ECDH and ECDSA verification
// (BigInt, Jacobian coordinates) and RSA PKCS#1 v1.5 / PSS verification. Only crypto.getRandomValues is needed
// from the platform, which every browser exposes on any page.
import { sha256 } from './signature-crypto.js';

// ---------------------------------------------------------------- SHA-384 / SHA-512 (32-bit word pairs)
const K512 = [
  0x428a2f98, 0xd728ae22, 0x71374491, 0x23ef65cd, 0xb5c0fbcf, 0xec4d3b2f, 0xe9b5dba5, 0x8189dbbc, 0x3956c25b, 0xf348b538, 0x59f111f1, 0xb605d019, 0x923f82a4, 0xaf194f9b, 0xab1c5ed5, 0xda6d8118,
  0xd807aa98, 0xa3030242, 0x12835b01, 0x45706fbe, 0x243185be, 0x4ee4b28c, 0x550c7dc3, 0xd5ffb4e2, 0x72be5d74, 0xf27b896f, 0x80deb1fe, 0x3b1696b1, 0x9bdc06a7, 0x25c71235, 0xc19bf174, 0xcf692694,
  0xe49b69c1, 0x9ef14ad2, 0xefbe4786, 0x384f25e3, 0x0fc19dc6, 0x8b8cd5b5, 0x240ca1cc, 0x77ac9c65, 0x2de92c6f, 0x592b0275, 0x4a7484aa, 0x6ea6e483, 0x5cb0a9dc, 0xbd41fbd4, 0x76f988da, 0x831153b5,
  0x983e5152, 0xee66dfab, 0xa831c66d, 0x2db43210, 0xb00327c8, 0x98fb213f, 0xbf597fc7, 0xbeef0ee4, 0xc6e00bf3, 0x3da88fc2, 0xd5a79147, 0x930aa725, 0x06ca6351, 0xe003826f, 0x14292967, 0x0a0e6e70,
  0x27b70a85, 0x46d22ffc, 0x2e1b2138, 0x5c26c926, 0x4d2c6dfc, 0x5ac42aed, 0x53380d13, 0x9d95b3df, 0x650a7354, 0x8baf63de, 0x766a0abb, 0x3c77b2a8, 0x81c2c92e, 0x47edaee6, 0x92722c85, 0x1482353b,
  0xa2bfe8a1, 0x4cf10364, 0xa81a664b, 0xbc423001, 0xc24b8b70, 0xd0f89791, 0xc76c51a3, 0x0654be30, 0xd192e819, 0xd6ef5218, 0xd6990624, 0x5565a910, 0xf40e3585, 0x5771202a, 0x106aa070, 0x32bbd1b8,
  0x19a4c116, 0xb8d2d0c8, 0x1e376c08, 0x5141ab53, 0x2748774c, 0xdf8eeb99, 0x34b0bcb5, 0xe19b48a8, 0x391c0cb3, 0xc5c95a63, 0x4ed8aa4a, 0xe3418acb, 0x5b9cca4f, 0x7763e373, 0x682e6ff3, 0xd6b2b8a3,
  0x748f82ee, 0x5defb2fc, 0x78a5636f, 0x43172f60, 0x84c87814, 0xa1f0ab72, 0x8cc70208, 0x1a6439ec, 0x90befffa, 0x23631e28, 0xa4506ceb, 0xde82bde9, 0xbef9a3f7, 0xb2c67915, 0xc67178f2, 0xe372532b,
  0xca273ece, 0xea26619c, 0xd186b8c7, 0x21c0c207, 0xeada7dd6, 0xcde0eb1e, 0xf57d4f7f, 0xee6ed178, 0x06f067aa, 0x72176fba, 0x0a637dc5, 0xa2c898a6, 0x113f9804, 0xbef90dae, 0x1b710b35, 0x131c471b,
  0x28db77f5, 0x23047d84, 0x32caab7b, 0x40c72493, 0x3c9ebe0a, 0x15c9bebc, 0x431d67c4, 0x9c100d4c, 0x4cc5d4be, 0xcb3e42b6, 0x597f299c, 0xfc657e2a, 0x5fcb6fab, 0x3ad6faec, 0x6c44198c, 0x4a475817,
];
const IV512 = [0x6a09e667, 0xf3bcc908, 0xbb67ae85, 0x84caa73b, 0x3c6ef372, 0xfe94f82b, 0xa54ff53a, 0x5f1d36f1, 0x510e527f, 0xade682d1, 0x9b05688c, 0x2b3e6c1f, 0x1f83d9ab, 0xfb41bd6b, 0x5be0cd19, 0x137e2179];
const IV384 = [0xcbbb9d5d, 0xc1059ed8, 0x629a292a, 0x367cd507, 0x9159015a, 0x3070dd17, 0x152fecd8, 0xf70e5939, 0x67332667, 0xffc00b31, 0x8eb44a87, 0x68581511, 0xdb0c2e0d, 0x64f98fa7, 0x47b5481d, 0xbefa4fa4];
function sha512core(data, iv, outLen) {
  const size = Math.ceil((data.length + 17) / 128) * 128, bytes = new Uint8Array(size);
  bytes.set(data); bytes[data.length] = 0x80;
  const view = new DataView(bytes.buffer);
  view.setBigUint64(size - 8, BigInt(data.length) * 8n);
  const h = Uint32Array.from(iv), w = new Uint32Array(160);
  for (let off = 0; off < size; off += 128) {
    for (let i = 0; i < 32; i++) w[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 80; i++) {
      const xh = w[(i - 15) * 2], xl = w[(i - 15) * 2 + 1], yh = w[(i - 2) * 2], yl = w[(i - 2) * 2 + 1];
      // sigma0: rotr1 ^ rotr8 ^ shr7 ; sigma1: rotr19 ^ rotr61 ^ shr6
      const s0h = ((xh >>> 1) | (xl << 31)) ^ ((xh >>> 8) | (xl << 24)) ^ (xh >>> 7);
      const s0l = ((xl >>> 1) | (xh << 31)) ^ ((xl >>> 8) | (xh << 24)) ^ ((xl >>> 7) | (xh << 25));
      const s1h = ((yh >>> 19) | (yl << 13)) ^ ((yl >>> 29) | (yh << 3)) ^ (yh >>> 6);
      const s1l = ((yl >>> 19) | (yh << 13)) ^ ((yh >>> 29) | (yl << 3)) ^ ((yl >>> 6) | (yh << 26));
      let lo = (s0l >>> 0) + (s1l >>> 0) + w[(i - 7) * 2 + 1] + w[(i - 16) * 2 + 1];
      const hi = s0h + s1h + w[(i - 7) * 2] + w[(i - 16) * 2] + Math.floor(lo / 0x100000000);
      w[i * 2] = hi >>> 0; w[i * 2 + 1] = lo >>> 0;
    }
    let [ah, al, bh, bl, ch, cl, dh, dl, eh, el, fh, fl, gh, gl, hh, hl] = h;
    for (let i = 0; i < 80; i++) {
      const S1h = ((eh >>> 14) | (el << 18)) ^ ((eh >>> 18) | (el << 14)) ^ ((el >>> 9) | (eh << 23));
      const S1l = ((el >>> 14) | (eh << 18)) ^ ((el >>> 18) | (eh << 14)) ^ ((eh >>> 9) | (el << 23));
      const chh = (eh & fh) ^ (~eh & gh), chl = (el & fl) ^ (~el & gl);
      let t1l = (hl >>> 0) + (S1l >>> 0) + (chl >>> 0) + K512[i * 2 + 1] + w[i * 2 + 1];
      const t1h = (hh + S1h + chh + K512[i * 2] + w[i * 2] + Math.floor(t1l / 0x100000000)) >>> 0;
      t1l >>>= 0;
      const S0h = ((ah >>> 28) | (al << 4)) ^ ((al >>> 2) | (ah << 30)) ^ ((al >>> 7) | (ah << 25));
      const S0l = ((al >>> 28) | (ah << 4)) ^ ((ah >>> 2) | (al << 30)) ^ ((ah >>> 7) | (al << 25));
      const mjh = (ah & bh) ^ (ah & ch) ^ (bh & ch), mjl = (al & bl) ^ (al & cl) ^ (bl & cl);
      let t2l = (S0l >>> 0) + (mjl >>> 0);
      const t2h = (S0h + mjh + Math.floor(t2l / 0x100000000)) >>> 0;
      t2l >>>= 0;
      hh = gh; hl = gl; gh = fh; gl = fl; fh = eh; fl = el;
      let nl = (dl >>> 0) + t1l; eh = (dh + t1h + Math.floor(nl / 0x100000000)) >>> 0; el = nl >>> 0;
      dh = ch; dl = cl; ch = bh; cl = bl; bh = ah; bl = al;
      nl = t1l + t2l; ah = (t1h + t2h + Math.floor(nl / 0x100000000)) >>> 0; al = nl >>> 0;
    }
    const v = [ah, al, bh, bl, ch, cl, dh, dl, eh, el, fh, fl, gh, gl, hh, hl];
    for (let i = 0; i < 16; i += 2) {
      const lo = h[i + 1] + (v[i + 1] >>> 0);
      h[i] = (h[i] + (v[i] >>> 0) + Math.floor(lo / 0x100000000)) >>> 0; h[i + 1] = lo >>> 0;
    }
  }
  const out = new Uint8Array(64), ov = new DataView(out.buffer);
  h.forEach((v, i) => ov.setUint32(i * 4, v));
  return out.slice(0, outLen);
}
export const sha512 = (d) => sha512core(d, IV512, 64);
export const sha384 = (d) => sha512core(d, IV384, 48);
export const HASHES = { 'SHA-256': { fn: sha256, size: 32, block: 64 }, 'SHA-384': { fn: sha384, size: 48, block: 128 }, 'SHA-512': { fn: sha512, size: 64, block: 128 } };
export const digest = (hash, data) => HASHES[hash].fn(data);

export function hmac(hash, key, data) {
  const h = HASHES[hash];
  if (key.length > h.block) key = h.fn(key);
  const k = new Uint8Array(h.block); k.set(key);
  const inner = new Uint8Array(h.block + data.length), outer = new Uint8Array(h.block + h.size);
  for (let i = 0; i < h.block; i++) { inner[i] = k[i] ^ 0x36; outer[i] = k[i] ^ 0x5c; }
  inner.set(data, h.block); outer.set(h.fn(inner), h.block);
  return h.fn(outer);
}

// ---------------------------------------------------------------- AES-128/256 + GCM
const SBOX = new Uint8Array(256), T = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
(() => {
  let p = 1, q = 1;
  do {
    p = p ^ ((p << 1) & 0xff) ^ (p & 0x80 ? 0x1b : 0);
    q ^= q << 1; q ^= q << 2; q ^= q << 4; q &= 0xff; if (q & 0x80) q ^= 0x09;
    const x = q ^ ((q << 1) | (q >> 7)) ^ ((q << 2) | (q >> 6)) ^ ((q << 3) | (q >> 5)) ^ ((q << 4) | (q >> 4));
    SBOX[p] = (x ^ 0x63) & 0xff;
  } while (p !== 1);
  SBOX[0] = 0x63;
  for (let i = 0; i < 256; i++) {
    const s = SBOX[i], s2 = ((s << 1) ^ (s & 0x80 ? 0x1b : 0)) & 0xff, s3 = s2 ^ s;
    const t = ((s2 << 24) | (s << 16) | (s << 8) | s3) >>> 0;
    T[0][i] = t; T[1][i] = ((t >>> 8) | (t << 24)) >>> 0; T[2][i] = ((t >>> 16) | (t << 16)) >>> 0; T[3][i] = ((t >>> 24) | (t << 8)) >>> 0;
  }
})();
function aesExpand(key) {
  const nk = key.length / 4, rounds = nk + 6, w = new Uint32Array(4 * (rounds + 1));
  for (let i = 0; i < nk; i++) w[i] = ((key[i * 4] << 24) | (key[i * 4 + 1] << 16) | (key[i * 4 + 2] << 8) | key[i * 4 + 3]) >>> 0;
  const sub = (t) => ((SBOX[t >>> 24] << 24) | (SBOX[(t >>> 16) & 255] << 16) | (SBOX[(t >>> 8) & 255] << 8) | SBOX[t & 255]) >>> 0;
  let rcon = 1;
  for (let i = nk; i < w.length; i++) {
    let t = w[i - 1];
    if (i % nk === 0) { t = (sub(((t << 8) | (t >>> 24)) >>> 0) ^ (rcon << 24)) >>> 0; rcon = ((rcon << 1) ^ (rcon & 0x80 ? 0x1b : 0)) & 0xff; }
    else if (nk > 6 && i % nk === 4) t = sub(t);
    w[i] = (w[i - nk] ^ t) >>> 0;
  }
  return { w, rounds };
}
function aesBlock({ w, rounds }, src, out) {
  let s0 = (((src[0] << 24) | (src[1] << 16) | (src[2] << 8) | src[3]) ^ w[0]) >>> 0, s1 = (((src[4] << 24) | (src[5] << 16) | (src[6] << 8) | src[7]) ^ w[1]) >>> 0;
  let s2 = (((src[8] << 24) | (src[9] << 16) | (src[10] << 8) | src[11]) ^ w[2]) >>> 0, s3 = (((src[12] << 24) | (src[13] << 16) | (src[14] << 8) | src[15]) ^ w[3]) >>> 0;
  let k = 4;
  for (let r = 1; r < rounds; r++, k += 4) {
    const t0 = T[0][s0 >>> 24] ^ T[1][(s1 >>> 16) & 255] ^ T[2][(s2 >>> 8) & 255] ^ T[3][s3 & 255] ^ w[k];
    const t1 = T[0][s1 >>> 24] ^ T[1][(s2 >>> 16) & 255] ^ T[2][(s3 >>> 8) & 255] ^ T[3][s0 & 255] ^ w[k + 1];
    const t2 = T[0][s2 >>> 24] ^ T[1][(s3 >>> 16) & 255] ^ T[2][(s0 >>> 8) & 255] ^ T[3][s1 & 255] ^ w[k + 2];
    const t3 = T[0][s3 >>> 24] ^ T[1][(s0 >>> 16) & 255] ^ T[2][(s1 >>> 8) & 255] ^ T[3][s2 & 255] ^ w[k + 3];
    s0 = t0 >>> 0; s1 = t1 >>> 0; s2 = t2 >>> 0; s3 = t3 >>> 0;
  }
  const last = (a, b, c, d, kw) => ((((SBOX[a >>> 24] << 24) | (SBOX[(b >>> 16) & 255] << 16) | (SBOX[(c >>> 8) & 255] << 8) | SBOX[d & 255]) ^ kw) >>> 0);
  const o = [last(s0, s1, s2, s3, w[k]), last(s1, s2, s3, s0, w[k + 1]), last(s2, s3, s0, s1, w[k + 2]), last(s3, s0, s1, s2, w[k + 3])];
  for (let i = 0; i < 4; i++) { out[i * 4] = o[i] >>> 24; out[i * 4 + 1] = (o[i] >>> 16) & 255; out[i * 4 + 2] = (o[i] >>> 8) & 255; out[i * 4 + 3] = o[i] & 255; }
}
// GF(2^128) multiply (GCM bit order) on four 32-bit words
function gmul(x, y) {
  let z0 = 0, z1 = 0, z2 = 0, z3 = 0, v0 = y[0], v1 = y[1], v2 = y[2], v3 = y[3];
  for (let i = 0; i < 128; i++) {
    if ((x[i >>> 5] >>> (31 - (i & 31))) & 1) { z0 ^= v0; z1 ^= v1; z2 ^= v2; z3 ^= v3; }
    const lsb = v3 & 1;
    v3 = (v3 >>> 1) | (v2 << 31); v2 = (v2 >>> 1) | (v1 << 31); v1 = (v1 >>> 1) | (v0 << 31); v0 >>>= 1;
    if (lsb) v0 ^= 0xe1000000;
  }
  return [z0 >>> 0, z1 >>> 0, z2 >>> 0, z3 >>> 0];
}
const words = (b, o = 0) => [0, 1, 2, 3].map((i) => ((b[o + i * 4] << 24) | (b[o + i * 4 + 1] << 16) | (b[o + i * 4 + 2] << 8) | b[o + i * 4 + 3]) >>> 0);
function ghash(h, aad, ct) {
  let y = [0, 0, 0, 0];
  const absorb = (data) => {
    for (let o = 0; o < data.length; o += 16) {
      const block = new Uint8Array(16); block.set(data.subarray(o, o + 16));
      const x = words(block); y = gmul([y[0] ^ x[0], y[1] ^ x[1], y[2] ^ x[2], y[3] ^ x[3]], h);
    }
  };
  absorb(aad); absorb(ct);
  const lens = new Uint8Array(16), lv = new DataView(lens.buffer);
  lv.setBigUint64(0, BigInt(aad.length) * 8n); lv.setBigUint64(8, BigInt(ct.length) * 8n);
  absorb(lens);
  const out = new Uint8Array(16), ov = new DataView(out.buffer);
  y.forEach((v, i) => ov.setUint32(i * 4, v));
  return out;
}
export function aesGcm(keyBytes) {
  const key = aesExpand(keyBytes), hb = new Uint8Array(16);
  aesBlock(key, new Uint8Array(16), hb);
  const h = words(hb);
  const ctr = (iv, data) => {
    const counter = new Uint8Array(16), stream = new Uint8Array(16), out = new Uint8Array(data.length);
    counter.set(iv); counter[15] = 2; // J0 = iv || 1, data starts at inc32(J0)
    for (let o = 0; o < data.length; o += 16) {
      aesBlock(key, counter, stream);
      for (let i = 0; i < 16 && o + i < data.length; i++) out[o + i] = data[o + i] ^ stream[i];
      for (let i = 15; i >= 12; i--) if (++counter[i] !== 256) break; else counter[i] = 0;
    }
    return out;
  };
  const tag = (iv, aad, ct) => {
    const j0 = new Uint8Array(16), mask = new Uint8Array(16); j0.set(iv); j0[15] = 1;
    aesBlock(key, j0, mask);
    const g = ghash(h, aad, ct);
    for (let i = 0; i < 16; i++) g[i] ^= mask[i];
    return g;
  };
  return {
    seal(iv, aad, pt) { const ct = ctr(iv, pt), out = new Uint8Array(ct.length + 16); out.set(ct); out.set(tag(iv, aad, ct), ct.length); return out; },
    open(iv, aad, sealed) {
      if (sealed.length < 16) throw Error('AES-GCM input too short');
      const ct = sealed.subarray(0, sealed.length - 16), t = tag(iv, aad, ct);
      let diff = 0; for (let i = 0; i < 16; i++) diff |= t[i] ^ sealed[ct.length + i];
      if (diff) throw Error('AES-GCM authentication failed');
      return ctr(iv, ct);
    },
  };
}

// ---------------------------------------------------------------- NIST P-256 / P-384
const big = (bytes) => { let n = 0n; for (const b of bytes) n = (n << 8n) | BigInt(b); return n; };
const bytesOf = (n, len) => { const out = new Uint8Array(len); for (let i = len - 1; i >= 0; i--) { out[i] = Number(n & 255n); n >>= 8n; } return out; };
const powMod = (b, e, m) => { let r = 1n; b %= m; while (e > 0n) { if (e & 1n) r = r * b % m; b = b * b % m; e >>= 1n; } return r; };
export const CURVE = {
  'P-256': { size: 32, p: 0xffffffff00000001000000000000000000000000ffffffffffffffffffffffffn, b: 0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604bn, n: 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n, gx: 0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296n, gy: 0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5n },
  'P-384': { size: 48, p: 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffeffffffff0000000000000000ffffffffn, b: 0xb3312fa7e23ee7e4988e056be3f82d19181d9c6efe8141120314088f5013875ac656398d8a2ed19d2a85c8edd3ec2aefn, n: 0xffffffffffffffffffffffffffffffffffffffffffffffffc7634d81f4372ddf581a0db248b0a77aecec196accc52973n, gx: 0xaa87ca22be8b05378eb1c71ef320ad746e1d3b628ba79b9859f741e082542a385502f25dbf55296c3a545e3872760ab7n, gy: 0x3617de4a96262c6f5d9e98bf9292dc29f8f41dbd289a147ce9da3113b5f0b8c00a60b1ce1d7e819d7a431d7c90ea0e5fn },
};
// Jacobian (X, Y, Z) with a = -3; Z = 0n is the point at infinity
function dbl(c, P) {
  const p = c.p, [X, Y, Z] = P;
  if (Z === 0n || Y === 0n) return [0n, 1n, 0n];
  const delta = Z * Z % p, gamma = Y * Y % p, beta = X * gamma % p;
  const alpha = 3n * ((X - delta + p) % p) % p * ((X + delta) % p) % p;
  const X3 = ((alpha * alpha - 8n * beta) % p + p) % p;
  const Z3 = (((Y + Z) * (Y + Z) - gamma - delta) % p + 2n * p) % p;
  const Y3 = ((alpha * ((4n * beta - X3) % p + p) - 8n * gamma % p * gamma) % p + p) % p;
  return [X3, Y3, Z3];
}
function add(c, P, Q) {
  const p = c.p;
  if (P[2] === 0n) return Q;
  if (Q[2] === 0n) return P;
  const z1z1 = P[2] * P[2] % p, z2z2 = Q[2] * Q[2] % p;
  const u1 = P[0] * z2z2 % p, u2 = Q[0] * z1z1 % p, s1 = P[1] * Q[2] % p * z2z2 % p, s2 = Q[1] * P[2] % p * z1z1 % p;
  if (u1 === u2) return s1 === s2 ? dbl(c, P) : [0n, 1n, 0n];
  const h = (u2 - u1 + p) % p, r = (s2 - s1 + p) % p, hh = h * h % p, hhh = h * hh % p, v = u1 * hh % p;
  const X3 = ((r * r - hhh - 2n * v) % p + 3n * p) % p;
  const Y3 = ((r * ((v - X3 + p) % p) - s1 * hhh) % p + p) % p;
  return [X3, Y3, h * P[2] % p * Q[2] % p];
}
function mul(c, k, P) {
  let R = [0n, 1n, 0n];
  for (let i = BigInt(k.toString(2).length) - 1n; i >= 0n; i--) { R = dbl(c, R); if ((k >> i) & 1n) R = add(c, R, P); }
  return R;
}
function affine(c, P) {
  if (P[2] === 0n) return null;
  const zi = powMod(P[2], c.p - 2n, c.p), zi2 = zi * zi % c.p;
  return [P[0] * zi2 % c.p, P[1] * zi2 % c.p * zi % c.p];
}
// Uncompressed 0x04 || X || Y, checked to lie on the curve
export function decodePoint(c, raw) {
  if (raw.length !== 1 + 2 * c.size || raw[0] !== 4) throw Error('Unsupported EC point');
  const x = big(raw.subarray(1, 1 + c.size)), y = big(raw.subarray(1 + c.size)), p = c.p;
  const rhs = ((x * x % p * x - 3n * x + c.b) % p + p) % p;
  if (x >= p || y >= p || y * y % p !== rhs) throw Error('EC point is not on the curve');
  return [x, y, 1n];
}
// ECDH: a fresh private scalar; derive(peer) returns the shared X coordinate
export function ecdh(curve = 'P-256', random = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n))) {
  const c = CURVE[curve];
  let d = 0n;
  while (d === 0n || d >= c.n) d = big(random(c.size));
  const pub = affine(c, mul(c, d, [c.gx, c.gy, 1n]));
  return {
    publicKey: Uint8Array.of(4, ...bytesOf(pub[0], c.size), ...bytesOf(pub[1], c.size)),
    derive(peerRaw) {
      const s = affine(c, mul(c, d, decodePoint(c, peerRaw)));
      if (!s) throw Error('Invalid ECDH result');
      return bytesOf(s[0], c.size);
    },
  };
}
// ECDSA verification over raw r||s
export function ecdsaVerify(curve, pointRaw, hash, rawSig, data) {
  const c = CURVE[curve], n = c.n, r = big(rawSig.subarray(0, c.size)), s = big(rawSig.subarray(c.size));
  if (r <= 0n || r >= n || s <= 0n || s >= n) return false;
  let e = big(digest(hash, data));
  const hashBits = HASHES[hash].size * 8, nBits = c.size * 8;
  if (hashBits > nBits) e >>= BigInt(hashBits - nBits);
  const w = powMod(s, n - 2n, n), u1 = e % n * w % n, u2 = r * w % n;
  const X = affine(c, add(c, mul(c, u1, [c.gx, c.gy, 1n]), mul(c, u2, decodePoint(c, pointRaw))));
  return !!X && X[0] % n === r;
}

// ---------------------------------------------------------------- RSA verification ({ n, e, size } public keys)
const PREFIX = {
  'SHA-256': Uint8Array.from([48, 49, 48, 13, 6, 9, 96, 134, 72, 1, 101, 3, 4, 2, 1, 5, 0, 4, 32]),
  'SHA-384': Uint8Array.from([48, 65, 48, 13, 6, 9, 96, 134, 72, 1, 101, 3, 4, 2, 2, 5, 0, 4, 48]),
  'SHA-512': Uint8Array.from([48, 81, 48, 13, 6, 9, 96, 134, 72, 1, 101, 3, 4, 2, 3, 5, 0, 4, 64]),
};
export function rsaVerifyPkcs1(key, hash, sig, data) {
  if (sig.length !== key.size) return false;
  const m = big(sig);
  if (m >= key.n) return false;
  const em = bytesOf(powMod(m, key.e, key.n), key.size), h = digest(hash, data), prefix = PREFIX[hash], sep = em.length - prefix.length - h.length - 1;
  if (sep < 10 || em[0] !== 0 || em[1] !== 1 || em[sep] !== 0) return false;
  let diff = 0;
  for (let i = 2; i < sep; i++) diff |= em[i] ^ 255;
  for (let i = 0; i < prefix.length; i++) diff |= em[sep + 1 + i] ^ prefix[i];
  for (let i = 0; i < h.length; i++) diff |= em[sep + 1 + prefix.length + i] ^ h[i];
  return diff === 0;
}
function mgf1(hash, seed, length) {
  const out = new Uint8Array(length), h = HASHES[hash];
  for (let i = 0, o = 0; o < length; i++, o += h.size) {
    const c = new Uint8Array(seed.length + 4); c.set(seed); new DataView(c.buffer).setUint32(seed.length, i);
    out.set(h.fn(c).subarray(0, Math.min(h.size, length - o)), o);
  }
  return out;
}
export function rsaVerifyPss(key, hash, saltLength, sig, data) {
  if (sig.length !== key.size) return false;
  const m = big(sig);
  if (m >= key.n) return false;
  const hLen = HASHES[hash].size, modBits = key.n.toString(2).length, emBits = modBits - 1, emLen = Math.ceil(emBits / 8);
  const em = bytesOf(powMod(m, key.e, key.n), emLen);
  if (emLen < hLen + saltLength + 2 || em[emLen - 1] !== 0xbc) return false;
  const masked = em.subarray(0, emLen - hLen - 1), H = em.subarray(emLen - hLen - 1, emLen - 1), top = 8 * emLen - emBits;
  if (masked[0] & (0xff << (8 - top)) & 0xff) return false;
  const db = mgf1(hash, H, masked.length);
  for (let i = 0; i < db.length; i++) db[i] ^= masked[i];
  db[0] &= 0xff >> top;
  const ps = emLen - hLen - saltLength - 2;
  for (let i = 0; i < ps; i++) if (db[i] !== 0) return false;
  if (db[ps] !== 1) return false;
  const salt = db.subarray(db.length - saltLength), mPrime = new Uint8Array(8 + hLen + saltLength);
  mPrime.set(digest(hash, data), 8); mPrime.set(salt, 8 + hLen);
  const h2 = digest(hash, mPrime);
  let diff = 0; for (let i = 0; i < hLen; i++) diff |= h2[i] ^ H[i];
  return diff === 0;
}
