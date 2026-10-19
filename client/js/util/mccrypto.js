// Pure-JS crypto for logging in to online-mode servers without a MinecraftJS proxy (no WebCrypto):
// AES-128-CFB8 (the stream cipher after the encryption request), SHA-1 with Minecraft's signed hex digest
// (the session server id) and RSA PKCS#1 v1.5 encryption with the server's public key (BigInt).

// ---------------------------------------------------------------- AES-128 (encryption direction only: CFB8 needs no decrypt)

const SBOX = new Uint8Array(256);
const T0 = new Uint32Array(256), T1 = new Uint32Array(256), T2 = new Uint32Array(256), T3 = new Uint32Array(256);
(() => {
  // multiplicative inverse via log tables over GF(2^8), then the affine transform
  const exp = new Uint8Array(512), log = new Uint8Array(256);
  let x = 1;
  for (let i = 0; i < 255; i++) { exp[i] = x; log[x] = i; x ^= (x << 1) ^ (x & 0x80 ? 0x1b : 0); x &= 0xff; }
  for (let i = 255; i < 512; i++) exp[i] = exp[i - 255];
  for (let i = 0; i < 256; i++) {
    let s = i === 0 ? 0 : exp[255 - log[i]];
    s = s ^ ((s << 1) | (s >> 7)) ^ ((s << 2) | (s >> 6)) ^ ((s << 3) | (s >> 5)) ^ ((s << 4) | (s >> 4)) ^ 0x63;
    SBOX[i] = s & 0xff;
  }
  for (let i = 0; i < 256; i++) {
    const s = SBOX[i], s2 = ((s << 1) ^ (s & 0x80 ? 0x1b : 0)) & 0xff, s3 = s2 ^ s;
    T0[i] = ((s2 << 24) | (s << 16) | (s << 8) | s3) >>> 0;
    T1[i] = ((s3 << 24) | (s2 << 16) | (s << 8) | s) >>> 0;
    T2[i] = ((s << 24) | (s3 << 16) | (s2 << 8) | s) >>> 0;
    T3[i] = ((s << 24) | (s << 16) | (s3 << 8) | s2) >>> 0;
  }
})();

function expandKey(key) {
  const w = new Uint32Array(44);
  for (let i = 0; i < 4; i++) w[i] = ((key[i * 4] << 24) | (key[i * 4 + 1] << 16) | (key[i * 4 + 2] << 8) | key[i * 4 + 3]) >>> 0;
  let rcon = 1;
  for (let i = 4; i < 44; i++) {
    let t = w[i - 1];
    if (i % 4 === 0) {
      t = ((SBOX[(t >>> 16) & 255] << 24) | (SBOX[(t >>> 8) & 255] << 16) | (SBOX[t & 255] << 8) | SBOX[t >>> 24]) ^ (rcon << 24);
      rcon = ((rcon << 1) ^ (rcon & 0x80 ? 0x1b : 0)) & 0xff;
    }
    w[i] = (w[i - 4] ^ t) >>> 0;
  }
  return w;
}

// Encrypt one 16-byte block in place (in -> out may alias)
function encryptBlock(w, src, out) {
  let s0 = (((src[0] << 24) | (src[1] << 16) | (src[2] << 8) | src[3]) ^ w[0]) >>> 0;
  let s1 = (((src[4] << 24) | (src[5] << 16) | (src[6] << 8) | src[7]) ^ w[1]) >>> 0;
  let s2 = (((src[8] << 24) | (src[9] << 16) | (src[10] << 8) | src[11]) ^ w[2]) >>> 0;
  let s3 = (((src[12] << 24) | (src[13] << 16) | (src[14] << 8) | src[15]) ^ w[3]) >>> 0;
  let k = 4;
  for (let r = 1; r < 10; r++, k += 4) {
    const t0 = T0[s0 >>> 24] ^ T1[(s1 >>> 16) & 255] ^ T2[(s2 >>> 8) & 255] ^ T3[s3 & 255] ^ w[k];
    const t1 = T0[s1 >>> 24] ^ T1[(s2 >>> 16) & 255] ^ T2[(s3 >>> 8) & 255] ^ T3[s0 & 255] ^ w[k + 1];
    const t2 = T0[s2 >>> 24] ^ T1[(s3 >>> 16) & 255] ^ T2[(s0 >>> 8) & 255] ^ T3[s1 & 255] ^ w[k + 2];
    const t3 = T0[s3 >>> 24] ^ T1[(s0 >>> 16) & 255] ^ T2[(s1 >>> 8) & 255] ^ T3[s2 & 255] ^ w[k + 3];
    s0 = t0 >>> 0; s1 = t1 >>> 0; s2 = t2 >>> 0; s3 = t3 >>> 0;
  }
  const last = (a, b, c, d, kw) => ((((SBOX[a >>> 24] << 24) | (SBOX[(b >>> 16) & 255] << 16) | (SBOX[(c >>> 8) & 255] << 8) | SBOX[d & 255]) ^ kw) >>> 0);
  const o = [last(s0, s1, s2, s3, w[40]), last(s1, s2, s3, s0, w[41]), last(s2, s3, s0, s1, w[42]), last(s3, s0, s1, s2, w[43])];
  for (let i = 0; i < 4; i++) { out[i * 4] = o[i] >>> 24; out[i * 4 + 1] = (o[i] >>> 16) & 255; out[i * 4 + 2] = (o[i] >>> 8) & 255; out[i * 4 + 3] = o[i] & 255; }
}

// AES/CFB8/NoPadding with key = iv = the shared secret (CryptManager.createNetCipherInstance)
export class Cfb8 {
  constructor(secret, decrypt) {
    this.w = expandKey(secret);
    this.iv = new Uint8Array(secret);
    this.tmp = new Uint8Array(16);
    this.decrypt = decrypt;
  }
  update(data) {
    const out = new Uint8Array(data.length), iv = this.iv, tmp = this.tmp;
    for (let i = 0; i < data.length; i++) {
      encryptBlock(this.w, iv, tmp);
      const c = this.decrypt ? data[i] : (data[i] ^ tmp[0]);
      out[i] = this.decrypt ? (data[i] ^ tmp[0]) : c;
      iv.copyWithin(0, 1);
      iv[15] = c; // the ciphertext byte shifts into the register
    }
    return out;
  }
}

// ---------------------------------------------------------------- SHA-1

export function sha1(...parts) {
  let len = 0;
  for (const p of parts) len += p.length;
  const total = ((len + 9 + 63) >> 6) << 6;
  const m = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { m.set(p, o); o += p.length; }
  m[len] = 0x80;
  const bits = len * 8;
  const dv = new DataView(m.buffer);
  dv.setUint32(total - 8, Math.floor(bits / 0x100000000));
  dv.setUint32(total - 4, bits >>> 0);
  let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;
  const w = new Uint32Array(80);
  for (let b = 0; b < total; b += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(b + i * 4);
    for (let i = 16; i < 80; i++) { const x = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16]; w[i] = (x << 1) | (x >>> 31); }
    let a = h0, bb = h1, c = h2, d = h3, e = h4;
    for (let i = 0; i < 80; i++) {
      let f, k;
      if (i < 20) { f = (bb & c) | (~bb & d); k = 0x5a827999; } else if (i < 40) { f = bb ^ c ^ d; k = 0x6ed9eba1; } else if (i < 60) { f = (bb & c) | (bb & d) | (c & d); k = 0x8f1bbcdc; } else { f = bb ^ c ^ d; k = 0xca62c1d6; }
      const t = (((a << 5) | (a >>> 27)) + f + e + k + w[i]) >>> 0;
      e = d; d = c; c = (bb << 30) | (bb >>> 2); bb = a; a = t;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + bb) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0;
  }
  const out = new Uint8Array(20), ov = new DataView(out.buffer);
  [h0, h1, h2, h3, h4].forEach((h, i) => ov.setUint32(i * 4, h));
  return out;
}

// new BigInteger(sha1(serverId, secret, key)).toString(16): two's complement, signed, no leading zeros
export function serverHash(serverId, secret, publicKey) {
  const d = sha1(new Uint8Array([...serverId].map((c) => c.charCodeAt(0) & 255)), secret, publicKey);
  const negative = (d[0] & 0x80) !== 0;
  if (negative) {
    let carry = 1;
    for (let i = d.length - 1; i >= 0; i--) { const v = (~d[i] & 0xff) + carry; d[i] = v & 0xff; carry = v >> 8; }
  }
  const hex = Array.from(d, (v) => v.toString(16).padStart(2, '0')).join('').replace(/^0+/, '');
  return (negative ? '-' : '') + (hex || '0');
}

// ---------------------------------------------------------------- RSA (PKCS#1 v1.5 type 2) with an X.509 SubjectPublicKeyInfo

function derRead(b, o) {
  const tag = b[o++];
  let len = b[o++];
  if (len & 0x80) { const n = len & 0x7f; len = 0; for (let i = 0; i < n; i++) len = len * 256 + b[o++]; }
  return { tag, start: o, end: o + len };
}

function parseSpki(der) {
  // SEQUENCE { SEQUENCE { algorithm }, BIT STRING { 0x00, SEQUENCE { INTEGER n, INTEGER e } } }
  const outer = derRead(der, 0);
  const alg = derRead(der, outer.start);
  const bits = derRead(der, alg.end);
  const rsa = derRead(der, bits.start + 1);
  const nI = derRead(der, rsa.start);
  const eI = derRead(der, nI.end);
  const big = (s, e) => { let v = 0n; for (let i = s; i < e; i++) v = (v << 8n) | BigInt(der[i]); return v; };
  return { n: big(nI.start, nI.end), e: big(eI.start, eI.end) };
}

function modPow(b, e, m) {
  let r = 1n;
  b %= m;
  while (e > 0n) { if (e & 1n) r = (r * b) % m; b = (b * b) % m; e >>= 1n; }
  return r;
}

export function rsaEncrypt(spki, data, random) {
  const { n, e } = parseSpki(spki);
  const k = (n.toString(16).length + 1) >> 1;
  if (data.length > k - 11) throw new Error('RSA message too long');
  const em = new Uint8Array(k);
  em[1] = 2;
  const pad = k - data.length - 3;
  const rnd = random(pad);
  for (let i = 0; i < pad; i++) { let r = rnd[i]; while (r === 0) r = random(1)[0]; em[2 + i] = r; }
  em.set(data, k - data.length);
  let m = 0n;
  for (const v of em) m = (m << 8n) | BigInt(v);
  let c = modPow(m, e, n);
  const out = new Uint8Array(k);
  for (let i = k - 1; i >= 0; i--) { out[i] = Number(c & 255n); c >>= 8n; }
  return out;
}
