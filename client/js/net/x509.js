// Minimal X.509 for the client's TLS: DER parsing, chain building to a bundled root, signature checks through
// WebCrypto (RSA PKCS#1 v1.5 SHA-256/384/512, ECDSA P-256/P-384), validity dates and DNS SAN hostname matching.

const subtle = () => globalThis.crypto.subtle;

// DER TLV at `at`: { tag, start (content), end, header }
export function der(bytes, at = 0) {
  if (at + 2 > bytes.length) throw Error('Truncated DER');
  const tag = bytes[at];
  let len = bytes[at + 1], p = at + 2;
  if (len & 0x80) {
    const n = len & 0x7f;
    if (n < 1 || n > 4) throw Error('Unsupported DER length');
    len = 0;
    for (let i = 0; i < n; i++) len = len * 256 + bytes[p++];
  }
  if (p + len > bytes.length) throw Error('Truncated DER');
  return { tag, start: p, end: p + len, header: at };
}
const children = (bytes, node) => {
  const out = [];
  for (let at = node.start; at < node.end;) { const c = der(bytes, at); out.push(c); at = c.end; }
  return out;
};
const slice = (bytes, node) => bytes.subarray(node.header, node.end);
const oid = (bytes, node) => {
  const b = bytes.subarray(node.start, node.end), parts = [Math.floor(b[0] / 40), b[0] % 40];
  let v = 0;
  for (let i = 1; i < b.length; i++) { v = v * 128 + (b[i] & 0x7f); if (!(b[i] & 0x80)) { parts.push(v); v = 0; } }
  return parts.join('.');
};
const text = (bytes, node) => new TextDecoder().decode(bytes.subarray(node.start, node.end));
function time(bytes, node) {
  const s = text(bytes, node);
  const m = node.tag === 0x17 ? /^(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)Z$/.exec(s) : /^(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)Z$/.exec(s);
  if (!m) throw Error('Unsupported certificate time');
  let year = +m[1];
  if (node.tag === 0x17) year += year < 50 ? 2000 : 1900;
  return Date.UTC(year, +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
}
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

export function parseCertificate(bytes) {
  const cert = der(bytes, 0), [tbs, sigAlg, sigValue] = children(bytes, cert);
  let fields = children(bytes, tbs), i = 0;
  if (fields[0].tag === 0xa0) i++; // [0] version
  const [, signature, issuer, validity, subject, spki] = fields.slice(i, i + 6);
  const [notBefore, notAfter] = children(bytes, validity);
  const out = {
    der: bytes, tbs: slice(bytes, tbs), sigAlg: oid(bytes, children(bytes, sigAlg)[0]),
    signature: bytes.subarray(sigValue.start + 1, sigValue.end), // BIT STRING: skip the unused-bits byte
    issuer: slice(bytes, issuer), subject: slice(bytes, subject), spki: slice(bytes, spki),
    notBefore: time(bytes, notBefore), notAfter: time(bytes, notAfter), dnsNames: [], ca: false,
  };
  const spkiAlg = children(bytes, children(bytes, spki)[0]);
  out.keyType = oid(bytes, spkiAlg[0]);
  if (out.keyType === '1.2.840.10045.2.1') out.curve = oid(bytes, spkiAlg[1]);
  void signature;
  const ext = fields.slice(i + 6).find((f) => f.tag === 0xa3);
  if (ext) for (const e of children(bytes, children(bytes, ext)[0])) {
    const parts = children(bytes, e), id = oid(bytes, parts[0]), value = der(bytes, parts[parts.length - 1].start);
    if (id === '2.5.29.17') for (const name of children(bytes, value)) { if (name.tag === 0x82) out.dnsNames.push(text(bytes, name).toLowerCase()); }
    if (id === '2.5.29.19') { const bc = children(bytes, value); out.ca = bc.length > 0 && bc[0].tag === 0x01 && bytes[bc[0].start] !== 0; }
  }
  return out;
}

// RFC 6125: exact match, or one wildcard as the whole left-most label
export function hostnameMatches(cert, host) {
  host = host.toLowerCase().replace(/\.$/, '');
  return cert.dnsNames.some((name) => {
    if (name === host) return true;
    if (!name.startsWith('*.')) return false;
    const rest = name.slice(1), dot = host.indexOf('.');
    return dot > 0 && host.slice(dot) === rest;
  });
}

// ECDSA DER signature -> r||s for WebCrypto
export function ecdsaRaw(sig, size) {
  const seq = der(sig, 0), [r, s] = children(sig, seq), out = new Uint8Array(size * 2);
  const put = (node, at) => { let v = sig.subarray(node.start, node.end); while (v.length > size && v[0] === 0) v = v.subarray(1); out.set(v, at + size - v.length); };
  put(r, 0); put(s, size);
  return out;
}
const CERT_ALGS = {
  '1.2.840.113549.1.1.11': { kind: 'rsa', hash: 'SHA-256' }, '1.2.840.113549.1.1.12': { kind: 'rsa', hash: 'SHA-384' },
  '1.2.840.113549.1.1.13': { kind: 'rsa', hash: 'SHA-512' }, '1.2.840.10045.4.3.2': { kind: 'ecdsa', hash: 'SHA-256' },
  '1.2.840.10045.4.3.3': { kind: 'ecdsa', hash: 'SHA-384' },
};
export const CURVES = { '1.2.840.10045.3.1.7': ['P-256', 32], '1.3.132.0.34': ['P-384', 48] };

// The issuer's key verifies `cert`'s signature
export async function verifySignedBy(cert, issuer) {
  const alg = CERT_ALGS[cert.sigAlg];
  if (!alg) return false;
  try {
    if (alg.kind === 'rsa') {
      if (issuer.keyType !== '1.2.840.113549.1.1.1') return false;
      const key = await subtle().importKey('spki', issuer.spki, { name: 'RSASSA-PKCS1-v1_5', hash: alg.hash }, false, ['verify']);
      return await subtle().verify('RSASSA-PKCS1-v1_5', key, cert.signature, cert.tbs);
    }
    const curve = CURVES[issuer.curve];
    if (!curve) return false;
    const key = await subtle().importKey('spki', issuer.spki, { name: 'ECDSA', namedCurve: curve[0] }, false, ['verify']);
    return await subtle().verify({ name: 'ECDSA', hash: alg.hash }, key, ecdsaRaw(cert.signature, curve[1]), cert.tbs);
  } catch { return false; }
}

// Leaf first as the server sent it; intermediates may come in any order and extra certificates are ignored.
// Throws unless the leaf names `host`, every certificate is in date and the chain ends at a trusted root.
export async function verifyChain(certs, host, roots, now = Date.now()) {
  if (!certs.length) throw Error('Server sent no certificate');
  const leaf = certs[0];
  if (!hostnameMatches(leaf, host)) throw Error('Certificate is not valid for ' + host);
  let current = leaf;
  const pool = certs.slice(1);
  for (let depth = 0; depth < 8; depth++) {
    if (now < current.notBefore || now > current.notAfter) throw Error('Certificate expired or not yet valid');
    // A trusted root (identical, or the issuer) ends the chain
    if (roots.some((r) => same(r.der, current.der))) return true;
    for (const root of roots) if (same(root.subject, current.issuer) && await verifySignedBy(current, root)) return true;
    let next = null;
    for (const c of pool) if (c.ca && same(c.subject, current.issuer) && await verifySignedBy(current, c)) { next = c; break; }
    if (!next) throw Error('Certificate chain does not reach a trusted root');
    pool.splice(pool.indexOf(next), 1);
    current = next;
  }
  throw Error('Certificate chain is too long');
}
