// HTTPS from the client itself: HTTP/1.1 over the TLS 1.3 client (tls13.js) over a raw TCP stream from the
// selected proxy entry (MinecraftJS raw bridge, Wisp or relay), so account sign in and Mojang services work
// without a server that relays HTTP and without CORS. One request per connection ("Connection: close").
import { openStream } from './tcp.js';
import { currentProxy, proxyType } from './proxies.js';
import { TlsSocket } from './tls13.js';

const enc = new TextEncoder(), dec = new TextDecoder();
const concat = (a, b) => { const out = new Uint8Array(a.length + b.length); out.set(a); out.set(b, a.length); return out; };

// The raw TCP route of a proxy entry, as game connections use it
export function rawRoute(entry = currentProxy()) {
  if (!entry) return null;
  const type = proxyType(entry);
  return { ...entry, type: type === 'minecraftjs' ? 'minecraftjs-raw' : type };
}

// Parse a complete or partial response buffer; returns null until the body is complete (or `closed`)
export function parseResponse(buffer, closed = false) {
  let head = -1;
  for (let i = 0; i + 3 < buffer.length; i++) if (buffer[i] === 13 && buffer[i + 1] === 10 && buffer[i + 2] === 13 && buffer[i + 3] === 10) { head = i; break; }
  if (head < 0) { if (closed) throw Error('Incomplete HTTP response'); return null; }
  const lines = dec.decode(buffer.subarray(0, head)).split('\r\n'), status = /^HTTP\/1\.[01] (\d{3})/.exec(lines[0]);
  if (!status) throw Error('Invalid HTTP response');
  const headers = {};
  for (const line of lines.slice(1)) { const c = line.indexOf(':'); if (c > 0) headers[line.slice(0, c).trim().toLowerCase()] = line.slice(c + 1).trim(); }
  let rest = buffer.subarray(head + 4), body;
  if (/chunked/i.test(headers['transfer-encoding'] || '')) {
    const parts = [];
    for (;;) {
      let eol = -1;
      for (let i = 0; i + 1 < rest.length; i++) if (rest[i] === 13 && rest[i + 1] === 10) { eol = i; break; }
      if (eol < 0) { if (closed) throw Error('Truncated chunked response'); return null; }
      const size = parseInt(dec.decode(rest.subarray(0, eol)).split(';')[0], 16);
      if (!Number.isFinite(size)) throw Error('Invalid chunk size');
      if (rest.length < eol + 2 + size + 2) { if (closed) throw Error('Truncated chunked response'); return null; }
      if (size === 0) break;
      parts.push(rest.subarray(eol + 2, eol + 2 + size));
      rest = rest.subarray(eol + 2 + size + 2);
    }
    body = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let o = 0; for (const p of parts) { body.set(p, o); o += p.length; }
  } else if (headers['content-length'] !== undefined) {
    const length = parseInt(headers['content-length'], 10);
    if (rest.length < length) { if (closed) throw Error('Truncated HTTP response'); return null; }
    body = rest.subarray(0, length);
  } else {
    if (!closed) return null;
    body = rest;
  }
  return { status: +status[1], headers, bytes: body.slice(), text: () => dec.decode(body), json: () => { try { return JSON.parse(dec.decode(body)); } catch { return null; } } };
}

export function encodeRequest(url, { method = 'GET', headers = {}, body = null } = {}) {
  const u = new URL(url), payload = body == null ? null : body instanceof Uint8Array ? body : enc.encode(body);
  const all = { Host: u.host, 'User-Agent': 'MinecraftJS', Accept: 'application/json', Connection: 'close', ...headers };
  if (payload) all['Content-Length'] = String(payload.length);
  const head = `${method} ${u.pathname}${u.search} HTTP/1.1\r\n` + Object.entries(all).map(([k, v]) => `${k}: ${v}\r\n`).join('') + '\r\n';
  return payload ? concat(enc.encode(head), payload) : enc.encode(head);
}

export async function httpsRequest(url, { method = 'GET', headers = {}, body = null, timeout = 15000, route = rawRoute(), open = openStream } = {}) {
  const u = new URL(url);
  if (u.protocol !== 'https:') throw Error('Only https URLs are supported');
  if (!route) throw Error('Signing in needs a proxy, Wisp server or relay in the Proxy Servers list');
  const stream = await open(route, u.hostname, +(u.port || 443));
  const tls = new TlsSocket(stream, u.hostname);
  return new Promise((resolve, reject) => {
    let buffer = new Uint8Array(0), done = false;
    const finish = (error, response) => { if (done) return; done = true; clearTimeout(timer); try { tls.close(); } catch { /* closed */ } error ? reject(error) : resolve(response); };
    const timer = setTimeout(() => finish(Error('Request to ' + u.host + ' timed out')), timeout);
    tls.on('data', (bytes) => { buffer = concat(buffer, bytes); try { const r = parseResponse(buffer); if (r) finish(null, r); } catch (e) { finish(e); } });
    tls.on('close', (error) => { if (error) return finish(error); try { finish(null, parseResponse(buffer, true)); } catch (e) { finish(e); } });
    tls.connect().then(() => tls.write(encodeRequest(url, { method, headers, body })), (e) => finish(e));
  });
}

export const postJson = (url, json, headers = {}, options = {}) => httpsRequest(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(json), ...options });
export const postForm = (url, params, options = {}) => httpsRequest(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params).toString(), ...options });
