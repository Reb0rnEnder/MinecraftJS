// A small TLS 1.3 client (RFC 8446) over any byte stream ({ write, close, on('data'|'close') }) on WebCrypto, so
// it runs in browsers and Node alike: P-256 key share, TLS_AES_128_GCM_SHA256 / TLS_AES_256_GCM_SHA384, server
// CertificateVerify with RSA-PSS or ECDSA, certificate chains to the bundled roots (x509.js) and Finished checks.
// No client certificates, resumption, 0-RTT or HelloRetryRequest; any protocol error closes the connection.
import { parseCertificate, verifyChain, ecdsaRaw, CURVES } from './x509.js';
import { TLS_ROOTS } from './tls-roots.js';

const subtle = () => globalThis.crypto.subtle;
const enc = new TextEncoder();
const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};
const u8 = (n) => Uint8Array.of(n), u16 = (n) => Uint8Array.of(n >> 8, n & 255), u24 = (n) => Uint8Array.of(n >> 16, (n >> 8) & 255, n & 255);
const vec8 = (b) => concat(u8(b.length), b), vec16 = (b) => concat(u16(b.length), b), vec24 = (b) => concat(u24(b.length), b);
const random = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));
const b64 = (s) => { const bin = atob(s), out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; };
let rootCache = null;
export const tlsRoots = () => (rootCache ||= TLS_ROOTS.map((s) => parseCertificate(b64(s))));

const SUITES = { 0x1301: { hash: 'SHA-256', size: 32, key: 16 }, 0x1302: { hash: 'SHA-384', size: 48, key: 32 } };
const ext = (type, body) => concat(u16(type), vec16(body));

// ---------------------------------------------------------------- HKDF (RFC 5869 / 8446 §7.1) over WebCrypto HMAC
async function hmac(hash, key, data) {
  const k = await subtle().importKey('raw', key.length ? key : new Uint8Array(1), { name: 'HMAC', hash }, false, ['sign']);
  // An empty HMAC key equals a single zero byte after padding to the block size
  return new Uint8Array(await subtle().sign('HMAC', k, data));
}
const extract = (s, salt, ikm) => hmac(s.hash, salt, ikm);
async function expand(s, prk, info, length) {
  let t = new Uint8Array(0), out = new Uint8Array(0);
  for (let i = 1; out.length < length; i++) { t = await hmac(s.hash, prk, concat(t, info, u8(i))); out = concat(out, t); }
  return out.subarray(0, length);
}
const expandLabel = (s, secret, label, context, length) => expand(s, secret, concat(u16(length), vec8(enc.encode('tls13 ' + label)), vec8(context)), length);
const digest = async (s, data) => new Uint8Array(await subtle().digest(s.hash, data));
const deriveSecret = async (s, secret, label, transcript) => expandLabel(s, secret, label, await digest(s, transcript), s.size);

// Traffic keys for one direction: AES-GCM with a per-record nonce of iv XOR sequence number
async function trafficKeys(s, secret) {
  const key = await subtle().importKey('raw', await expandLabel(s, secret, 'key', new Uint8Array(0), s.key), 'AES-GCM', false, ['encrypt', 'decrypt']);
  return { key, iv: await expandLabel(s, secret, 'iv', new Uint8Array(0), 12), seq: 0n };
}
const nonce = (k) => { const n = k.iv.slice(); let seq = k.seq++; for (let i = 11; i >= 4; i--) { n[i] ^= Number(seq & 255n); seq >>= 8n; } return n; };

export class TlsSocket {
  constructor(stream, host) {
    this.stream = stream; this.host = host; this.handlers = {}; this.buffer = new Uint8Array(0);
    this.queue = Promise.resolve(); this.closed = false;
  }
  on(ev, fn) { (this.handlers[ev] ||= []).push(fn); }
  emit(ev, v) { for (const fn of this.handlers[ev] || []) fn(v); }

  // Resolves once the handshake completes and the server's certificate chain checked out
  connect({ now = Date.now(), roots = tlsRoots(), alpn = ['http/1.1'] } = {}) {
    this.now = now; this.roots = roots;
    return new Promise((resolve, reject) => {
      this.ready = { resolve, reject };
      this.stream.on('data', (bytes) => { this.queue = this.queue.then(() => this._receive(bytes)).catch((e) => this._fail(e)); });
      // Handled after any records still being decrypted; once established, a TCP close ends the stream cleanly
      this.stream.on('close', () => {
        this.queue = this.queue.then(() => {
          if (this.closed) return;
          if (!this.application) return this._fail(Error('Connection closed during TLS'));
          this.closed = true; this.emit('close', null);
        });
      });
      this._hello(alpn).catch((e) => this._fail(e));
    });
  }

  async _hello(alpn) {
    this.ecdh = await subtle().generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
    const share = new Uint8Array(await subtle().exportKey('raw', this.ecdh.publicKey));
    const exts = concat(
      ext(0x0000, vec16(concat(u8(0), vec16(enc.encode(this.host))))),                      // server_name
      ext(0x000a, vec16(u16(0x0017))),                                                      // supported_groups: secp256r1
      ext(0x000d, vec16(concat(...[0x0403, 0x0503, 0x0804, 0x0805, 0x0806].map(u16)))),     // signature_algorithms
      ext(0x0010, vec16(concat(...alpn.map((p) => vec8(enc.encode(p)))))),                  // ALPN
      ext(0x002b, vec8(u16(0x0304))),                                                       // supported_versions: TLS 1.3
      ext(0x0033, vec16(concat(u16(0x0017), vec16(share)))),                                // key_share
    );
    const body = concat(u16(0x0303), random(32), vec8(random(32)), vec16(concat(u16(0x1301), u16(0x1302))), vec8(u8(0)), vec16(exts));
    const hello = concat(u8(1), vec24(body));
    this.transcript = hello;
    this.stream.write(concat(u8(22), u16(0x0301), vec16(hello)));
  }

  _fail(error) {
    if (this.closed) return;
    this.closed = true;
    try { this.stream.close(); } catch { /* already closed */ }
    if (this.ready) { this.ready.reject(error); this.ready = null; } else this.emit('close', error);
  }

  // Records: [type][0x0303][length u16][fragment]
  async _receive(bytes) {
    if (this.closed) return;
    this.buffer = concat(this.buffer, bytes);
    while (this.buffer.length >= 5) {
      const length = (this.buffer[3] << 8) | this.buffer[4];
      if (length > 16384 + 256) throw Error('TLS record too long');
      if (this.buffer.length < 5 + length) return;
      const header = this.buffer.subarray(0, 5), fragment = this.buffer.slice(5, 5 + length);
      this.buffer = this.buffer.slice(5 + length);
      await this._record(header[0], header.slice(), fragment);
      if (this.closed) return;
    }
  }

  async _record(type, header, fragment) {
    if (type === 20) return; // middlebox-compatibility ChangeCipherSpec
    if (type === 21) { if (fragment[1] === 0) this.close(); else throw Error('TLS alert ' + fragment[1]); return; }
    if (type === 22 && !this.read) return this._handshakeBytes(fragment);
    if (type !== 23 || !this.read) throw Error('Unexpected TLS record ' + type);
    const plain = new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv: nonce(this.read), additionalData: header, tagLength: 128 }, this.read.key, fragment));
    let end = plain.length - 1;
    while (end >= 0 && plain[end] === 0) end--; // TLSInnerPlaintext padding
    const inner = plain[end], content = plain.subarray(0, end);
    if (inner === 21) { if (content[1] === 0) this.close(); else throw Error('TLS alert ' + content[1]); return; }
    if (inner === 22) return this._handshakeBytes(content);
    if (inner === 23 && this.application) { this.emit('data', content.slice()); return; }
    throw Error('Unexpected TLS content ' + inner);
  }

  // Handshake messages may span or share records
  async _handshakeBytes(bytes) {
    this.pendingHs = this.pendingHs ? concat(this.pendingHs, bytes) : bytes;
    while (this.pendingHs.length >= 4) {
      const len = (this.pendingHs[1] << 16) | (this.pendingHs[2] << 8) | this.pendingHs[3];
      if (this.pendingHs.length < 4 + len) return;
      const message = this.pendingHs.slice(0, 4 + len);
      this.pendingHs = this.pendingHs.slice(4 + len);
      await this._handshake(message[0], message.subarray(4), message);
    }
  }

  async _handshake(type, body, message) {
    if (this.application) { if (type === 4) return; throw Error('Unsupported post-handshake message ' + type); } // tickets ignored
    if (type === 2) return this._serverHello(body, message);
    if (!this.suite) throw Error('TLS handshake out of order');
    const before = this.transcript;
    this.transcript = concat(this.transcript, message);
    if (type === 8) return; // EncryptedExtensions
    if (type === 11) { this._certificates(body); return; }
    if (type === 15) return this._certificateVerify(body, before);
    if (type === 20) return this._finished(body, before);
    throw Error('Unexpected TLS handshake message ' + type);
  }

  async _serverHello(body, message) {
    if (this.suite) throw Error('Duplicate ServerHello');
    let p = 2;
    const random = body.subarray(p, p + 32); p += 32;
    if (random.every((v, i) => v === HRR[i])) throw Error('Server asked for a HelloRetryRequest');
    p += 1 + body[p]; // session id echo
    const suite = SUITES[(body[p] << 8) | body[p + 1]]; p += 3;
    if (!suite) throw Error('Server chose an unsupported cipher suite');
    const end = p + 2 + ((body[p] << 8) | body[p + 1]);
    let share = null, version = 0;
    for (p += 2; p < end;) {
      const t = (body[p] << 8) | body[p + 1], l = (body[p + 2] << 8) | body[p + 3], v = body.subarray(p + 4, p + 4 + l);
      if (t === 0x002b) version = (v[0] << 8) | v[1];
      if (t === 0x0033) { if (((v[0] << 8) | v[1]) !== 0x0017) throw Error('Unsupported key share'); share = v.subarray(4, 4 + ((v[2] << 8) | v[3])); }
      p += 4 + l;
    }
    if (version !== 0x0304 || !share) throw Error('Server does not speak TLS 1.3');
    this.suite = suite;
    this.transcript = concat(this.transcript, message);
    const peer = await subtle().importKey('raw', share, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const shared = new Uint8Array(await subtle().deriveBits({ name: 'ECDH', public: peer }, this.ecdh.privateKey, 256));
    const s = suite, zero = new Uint8Array(s.size);
    const early = await extract(s, new Uint8Array(0), zero);
    const hs = await extract(s, await deriveSecret(s, early, 'derived', new Uint8Array(0)), shared);
    this.clientHs = await deriveSecret(s, hs, 'c hs traffic', this.transcript);
    this.serverHs = await deriveSecret(s, hs, 's hs traffic', this.transcript);
    this.master = await extract(s, await deriveSecret(s, hs, 'derived', new Uint8Array(0)), zero);
    this.read = await trafficKeys(s, this.serverHs);
  }

  _certificates(body) {
    let p = 1 + body[0];
    const end = p + 3 + ((body[p] << 16) | (body[p + 1] << 8) | body[p + 2]);
    const certs = [];
    for (p += 3; p < end;) {
      const l = (body[p] << 16) | (body[p + 1] << 8) | body[p + 2];
      certs.push(parseCertificate(body.slice(p + 3, p + 3 + l)));
      p += 3 + l;
      p += 2 + ((body[p] << 8) | body[p + 1]); // per-certificate extensions
    }
    this.certs = certs;
  }

  async _certificateVerify(body, transcript) {
    if (!this.certs) throw Error('CertificateVerify before Certificate');
    await verifyChain(this.certs, this.host, this.roots, this.now);
    const scheme = (body[0] << 8) | body[1], sig = body.subarray(4, 4 + ((body[2] << 8) | body[3])), leaf = this.certs[0];
    const content = concat(new Uint8Array(64).fill(0x20), enc.encode('TLS 1.3, server CertificateVerify'), u8(0), await digest(this.suite, transcript));
    let ok = false;
    if (scheme >= 0x0804 && scheme <= 0x0806 && leaf.keyType === '1.2.840.113549.1.1.1') {
      const hash = ['SHA-256', 'SHA-384', 'SHA-512'][scheme - 0x0804];
      const key = await subtle().importKey('spki', leaf.spki, { name: 'RSA-PSS', hash }, false, ['verify']);
      ok = await subtle().verify({ name: 'RSA-PSS', saltLength: [32, 48, 64][scheme - 0x0804] }, key, sig, content);
    } else if ((scheme === 0x0403 || scheme === 0x0503) && CURVES[leaf.curve]) {
      const [curve, size] = CURVES[leaf.curve];
      const key = await subtle().importKey('spki', leaf.spki, { name: 'ECDSA', namedCurve: curve }, false, ['verify']);
      ok = await subtle().verify({ name: 'ECDSA', hash: scheme === 0x0403 ? 'SHA-256' : 'SHA-384' }, key, ecdsaRaw(sig, size), content);
    }
    if (!ok) throw Error('Server CertificateVerify signature is invalid');
    this.verified = true;
  }

  async _finished(body, transcript) {
    if (!this.verified) throw Error('Finished before CertificateVerify');
    const s = this.suite;
    const expected = await hmac(s.hash, await expandLabel(s, this.serverHs, 'finished', new Uint8Array(0), s.size), await digest(s, transcript));
    if (expected.length !== body.length || expected.some((v, i) => v !== body[i])) throw Error('Server Finished does not verify');
    // Application secrets cover the transcript through the server Finished
    const clientAp = await deriveSecret(s, this.master, 'c ap traffic', this.transcript);
    const serverAp = await deriveSecret(s, this.master, 's ap traffic', this.transcript);
    const write = await trafficKeys(s, this.clientHs);
    const verify = await hmac(s.hash, await expandLabel(s, this.clientHs, 'finished', new Uint8Array(0), s.size), await digest(s, this.transcript));
    this.writeKeys = write;
    this.stream.write(concat(u8(20), u16(0x0303), vec16(u8(1)))); // compatibility ChangeCipherSpec
    await this._send(22, concat(u8(20), vec24(verify)));
    this.read = await trafficKeys(s, serverAp);
    this.writeKeys = await trafficKeys(s, clientAp);
    this.application = true;
    const ready = this.ready; this.ready = null;
    ready?.resolve(this);
  }

  async _send(type, data) {
    for (let o = 0; o < data.length || o === 0; o += 16384) {
      const chunk = data.subarray(o, o + 16384), inner = concat(chunk, u8(type));
      const header = concat(u8(23), u16(0x0303), u16(inner.length + 16));
      const sealed = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv: nonce(this.writeKeys), additionalData: header, tagLength: 128 }, this.writeKeys.key, inner));
      this.stream.write(concat(header, sealed));
      if (!data.length) break;
    }
  }

  // Application data, encrypted in order
  write(bytes) {
    if (!this.application || this.closed) throw Error('TLS connection is not open');
    this.queue = this.queue.then(() => this._send(23, bytes)).catch((e) => this._fail(e));
    return this.queue;
  }
  close() {
    if (this.closed) return;
    const finish = () => { this.closed = true; try { this.stream.close(); } catch { /* closed */ } this.emit('close', null); };
    if (this.application) this.queue = this.queue.then(() => this._send(21, Uint8Array.of(1, 0))).then(finish, finish);
    else finish();
  }
}
// The special ServerHello.random of a HelloRetryRequest
const HRR = Uint8Array.from([0xcf, 0x21, 0xad, 0x74, 0xe5, 0x9a, 0x61, 0x11, 0xbe, 0x1d, 0x8c, 0x02, 0x1e, 0x65, 0xb8, 0x91, 0xc2, 0xa2, 0x11, 0x16, 0x7a, 0xbb, 0x8c, 0x5e, 0x07, 0x9e, 0x09, 0xe2, 0xc8, 0xa8, 0x33, 0x9c]);
