// DNS over HTTPS (RFC 8484 wire format: GET /dns-query?dns=<base64url query>, application/dns-message), used for
// the _minecraft._tcp SRV lookup the vanilla client does before connecting. Servers come from the Network
// Settings > DNS Servers list: a bare address or host means https://<it>/dns-query, a full URL is used as is.
import { platform } from '../platform/platform.js';

export const DEFAULT_DNS_SERVERS = ['1.1.1.1', '8.8.8.8'];
let servers = DEFAULT_DNS_SERVERS.slice();
export function setDnsServers(list) { servers = Array.isArray(list) && list.length ? list.slice() : DEFAULT_DNS_SERVERS.slice(); }
export function dnsServers() { return servers.slice(); }
export function dohUrl(server) {
  const s = String(server).trim();
  if (/^https?:\/\//i.test(s)) return s;
  return 'https://' + (s.includes(':') && !s.startsWith('[') && /^[0-9a-f:]+$/i.test(s) ? '[' + s + ']' : s) + '/dns-query';
}
export const validDnsServer = (s) => { try { const u = new URL(dohUrl(s)); return u.protocol === 'https:' || u.protocol === 'http:'; } catch { return false; } };

// RFC 1035 query: id 0 (RFC 8484 cache friendliness), recursion desired, one question, class IN
export function encodeDnsQuery(name, type) {
  const labels = String(name).replace(/\.$/, '').split('.').filter(Boolean).map((l) => new TextEncoder().encode(l));
  if (labels.some((l) => l.length > 63)) throw Error('DNS label too long');
  const out = new Uint8Array(12 + labels.reduce((n, l) => n + 1 + l.length, 0) + 1 + 4);
  out.set([0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0]);
  let o = 12;
  for (const l of labels) { out[o++] = l.length; out.set(l, o); o += l.length; }
  out[o++] = 0;
  out[o++] = type >> 8; out[o++] = type & 255; out[o++] = 0; out[o++] = 1;
  return out;
}

// A name at `at` (with compression pointers) -> { name, end }
function readName(b, at) {
  const parts = [];
  let end = -1, jumps = 0;
  for (;;) {
    if (at >= b.length) throw Error('Truncated DNS name');
    const len = b[at];
    if ((len & 0xc0) === 0xc0) {
      if (++jumps > 32) throw Error('DNS pointer loop');
      if (end < 0) end = at + 2;
      at = ((len & 0x3f) << 8) | b[at + 1];
      continue;
    }
    if (len === 0) { if (end < 0) end = at + 1; break; }
    parts.push(new TextDecoder().decode(b.subarray(at + 1, at + 1 + len)));
    at += 1 + len;
  }
  return { name: parts.join('.'), end };
}

// -> { rcode, answers: [{ type, srv?: { priority, weight, port, target } }] }
export function parseDnsResponse(b) {
  if (b.length < 12) throw Error('Truncated DNS response');
  const u16 = (i) => (b[i] << 8) | b[i + 1], rcode = b[3] & 15, qd = u16(4), an = u16(6);
  let at = 12;
  for (let i = 0; i < qd; i++) at = readName(b, at).end + 4;
  const answers = [];
  for (let i = 0; i < an; i++) {
    at = readName(b, at).end;
    const type = u16(at), rdlen = u16(at + 8), data = at + 10;
    if (data + rdlen > b.length) throw Error('Truncated DNS record');
    const answer = { type };
    if (type === 33) answer.srv = { priority: u16(data), weight: u16(data + 2), port: u16(data + 4), target: readName(b, data + 6).name };
    answers.push(answer);
    at = data + rdlen;
  }
  return { rcode, answers };
}

const base64url = (bytes) => { let s = ''; for (const c of bytes) s += String.fromCharCode(c); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };

// The best SRV record (lowest priority, then highest weight) -> { records, answered }
export async function lookupSrv(name, { list = servers, fetchBytes = (url) => platform().fetchBytes(url) } = {}) {
  const query = base64url(encodeDnsQuery(name, 33));
  for (const server of list) {
    try {
      const bytes = await fetchBytes(dohUrl(server) + (dohUrl(server).includes('?') ? '&' : '?') + 'dns=' + query);
      if (!bytes) continue;
      const r = parseDnsResponse(bytes);
      if (r.rcode !== 0 && r.rcode !== 3) continue; // NXDOMAIN (3) is an answer: no record
      const records = r.answers.filter((a) => a.srv).map((a) => a.srv).sort((a, b) => a.priority - b.priority || b.weight - a.weight);
      return { records, answered: true };
    } catch { /* the next server */ }
  }
  return { records: [], answered: false };
}
