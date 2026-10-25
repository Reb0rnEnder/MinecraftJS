// Raw TCP to Minecraft servers through WebSocket relays that only carry bytes, with the Minecraft protocol
// (handshake, login, compression, encryption) done here in the client:
//
//   relay  Eaglercraft 26.2 relay ("minecraft-java-byte-stream-v1"): wss://relay/minecraft?target=host[:port][&token=]
//          one WebSocket per connection, binary frames in both directions are the TCP stream. Without a port the
//          relay resolves _minecraft._tcp SRV records itself; the handshake port must match the target port.
//   wisp   Wisp v1 (Mercury Workshop): one WebSocket multiplexing TCP streams. Frames are
//          [type u8][stream id u32 LE][payload]: 0x01 CONNECT [0x01 tcp][port u16 LE][host], 0x02 DATA,
//          0x03 CONTINUE [buffer u32 LE] (flow control: DATA frames the server can still take), 0x04 CLOSE [reason],
//          0x05 INFO (v2 servers; answered with a v2 INFO without extensions).
//
// VanillaSocket wraps either stream in the MinecraftJS proxy-link interface (sendText JSON control messages,
// sendBinary / 'binary' raw play packets, 'text' control messages back), so Connection drives it like a proxy.
import { platform } from '../platform/platform.js';
import { inflate, deflate } from '../lib/pako.esm.mjs';
import { decodeUtf8, encodeUtf8 } from '../util/utf8.js';
import { Cfb8, serverHash, rsaEncrypt } from '../util/mccrypto.js';
import { proxyRoute } from './proxies.js';
import { wispUrl, wispPacket } from './wisp.js';

class Emitter {
  constructor(buffered = false) { this.handlers = {}; this.pending = buffered ? {} : null; }
  on(ev, fn) {
    (this.handlers[ev] ||= []).push(fn);
    const pending = this.pending?.[ev];
    if (pending) { delete this.pending[ev]; for (const value of pending) fn(value); }
  }
  emit(ev, a) {
    const handlers = this.handlers[ev] || [];
    if (!handlers.length && this.pending) (this.pending[ev] ||= []).push(a);
    else for (const fn of handlers) fn(a);
  }
}

const randomBytes = (n) => { const b = new Uint8Array(n); crypto.getRandomValues(b); return b; };
const isIp = (h) => /^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(':');
const hostPort = (host, port, omitDefault) => {
  const h = host.includes(':') ? '[' + host + ']' : host;
  return omitDefault && port === 25565 ? h : h + ':' + port;
};

// ---------------------------------------------------------------- transports: { write(u8), close(), on('data'|'close') }

// Eaglercraft 26.2 relay: the WebSocket is the TCP connection
async function openRelay(entry, host, port) {
  let base = entry.url.replace(/\/+$/, '');
  if (!/\/minecraft$/.test(base)) base += '/minecraft';
  // no explicit default port for hostnames: the relay looks up the SRV record like the vanilla client
  let url = base + '?target=' + encodeURIComponent(hostPort(host, port, !isIp(host) && host !== 'localhost'));
  if (entry.token) url += '&token=' + encodeURIComponent(entry.token);
  let sock;
  try { sock = await platform().openSocket(url); } catch (e) { throw new Error('Could not reach the relay ' + entry.url); }
  const s = new Emitter();
  s.write = (b) => sock.sendBinary(b);
  s.close = () => sock.close();
  sock.on('binary', (b) => s.emit('data', b));
  sock.on('close', (e) => s.emit('close', e && e.reason ? e.reason : null));
  return s;
}

// Wisp: one WebSocket per stream (stream id 1), DATA frames held back while the server's buffer is full
async function openWisp(entry, host, port) {
  if (port === 25565 && !isIp(host) && host !== 'localhost') ({ host, port } = await resolveSrv(host, port));
  let sock;
  try { sock = await platform().openSocket(wispUrl(entry.url)); } catch (e) { throw new Error('Could not reach the Wisp server ' + entry.url); }
  const s = new Emitter(true);
  const ID = 1;
  let credit = -1; // DATA frames the server will take (-1: no CONTINUE yet)
  const queue = [];
  let closed = false;
  const frame = (type, id, payload) => {
    const f = new Uint8Array(5 + payload.length);
    f[0] = type; f[1] = id & 255; f[2] = (id >>> 8) & 255; f[3] = (id >>> 16) & 255; f[4] = id >>> 24;
    f.set(payload, 5);
    return f;
  };
  const flush = () => {
    while (!closed && queue.length && credit > 0) { sock.sendBinary(frame(0x02, ID, queue.shift())); credit--; }
  };
  const hostBytes = encodeUtf8(host);
  const connect = new Uint8Array(3 + hostBytes.length);
  connect[0] = 0x01; connect[1] = port & 255; connect[2] = port >>> 8;
  connect.set(hostBytes, 3);
  let opened = false;
  const open = () => { if (!closed && !opened) { opened = true; sock.sendBinary(frame(0x01, ID, connect)); } };
  const timer = setTimeout(() => {
    if (!opened && !closed) { closed = true; s.emit('close', 'Wisp: no initial CONTINUE received'); sock.close(); }
  }, 6000);
  sock.on('binary', (b) => {
    if (closed) return;
    const packet = wispPacket(b);
    if (!packet) return;
    const { type, id, payload: p } = packet;
    if (type === 0x05 && id === 0 && !opened) {
      // v2 INFO: answer with v2.0 and no extensions, then the server continues as for v1 clients
      sock.sendBinary(frame(0x05, 0, new Uint8Array([2, 0])));
    } else if (type === 0x03 && ((!opened && id === 0) || (opened && id === ID))) {
      clearTimeout(timer);
      credit = packet.credit;
      open();
      flush();
    } else if (type === 0x02 && id === ID) s.emit('data', p);
    else if (type === 0x04 && (id === ID || id === 0)) {
      closed = true; clearTimeout(timer); queue.length = 0;
      const reason = { 0x03: 'network error', 0x41: 'invalid connection information', 0x42: 'could not connect', 0x43: 'connection timed out', 0x44: 'connection refused', 0x47: 'transfer timed out', 0x48: 'blocked by the Wisp server', 0x49: 'connection throttled' }[p[0]];
      s.emit('close', reason ? 'Wisp: ' + reason : null);
      sock.close();
    }
  });
  sock.on('close', () => { clearTimeout(timer); queue.length = 0; if (!closed) { closed = true; s.emit('close', null); } });
  s.write = (b) => { if (closed) return; queue.push(b); if (opened) flush(); };
  s.close = () => { if (!closed) { closed = true; clearTimeout(timer); queue.length = 0; if (opened) sock.sendBinary(frame(0x04, ID, new Uint8Array([0x02]))); sock.close(); } };
  return s;
}

// _minecraft._tcp SRV record over DNS-over-HTTPS (Wisp servers only resolve plain hostnames)
async function resolveSrv(host, port) {
  try {
    const j = JSON.parse(decodeUtf8(await platform().fetchBytes('https://cloudflare-dns.com/dns-query?ct=application/dns-json&type=SRV&name=_minecraft._tcp.' + encodeURIComponent(host))));
    const recs = (j.Answer || []).filter((a) => a.type === 33).map((a) => a.data.split(/\s+/)).map(([pr, w, p, t]) => ({ pr: +pr, w: +w, port: +p, host: t.replace(/\.$/, '') }));
    recs.sort((a, b) => a.pr - b.pr || b.w - a.w);
    if (recs[0]) return { host: recs[0].host, port: recs[0].port };
  } catch (e) { /* no record or no DNS-over-HTTPS: the plain host */ }
  return { host, port };
}

export function openStream(entry, host, port) {
  return entry.type === 'wisp' ? openWisp(entry, host, port) : openRelay(entry, host, port);
}

// ---------------------------------------------------------------- Minecraft framing

function varint(v) {
  const out = [];
  v >>>= 0;
  do { let b = v & 0x7f; v >>>= 7; if (v) b |= 0x80; out.push(b); } while (v);
  return out;
}
function readVarint(b, o) {
  let v = 0, n = 0, x;
  do {
    if (o + n >= b.length) return null;
    x = b[o + n];
    v |= (x & 0x7f) << (7 * n);
    n++;
    if (n > 5) throw new Error('VarInt too big');
  } while (x & 0x80);
  return { value: v >>> 0, length: n };
}
const concat = (parts) => {
  let n = 0;
  for (const p of parts) n += p.length;
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};
const mcString = (s) => { const b = encodeUtf8(s); return concat([new Uint8Array(varint(b.length)), b]); };
const readString = (b, o) => { const l = readVarint(b, o); return { value: decodeUtf8(b.subarray(o + l.length, o + l.length + l.value)), end: o + l.length + l.value }; };

// NettyCompressionEncoder + NettyVarint21FrameEncoder
function frame(payload, threshold) {
  if (threshold >= 0) {
    if (payload.length >= threshold) {
      const z = deflate(payload);
      const dl = varint(payload.length);
      return concat([new Uint8Array(varint(dl.length + z.length)), new Uint8Array(dl), z]);
    }
    return concat([new Uint8Array(varint(payload.length + 1)), new Uint8Array([0]), payload]);
  }
  return concat([new Uint8Array(varint(payload.length)), payload]);
}

class Splitter {
  constructor() { this.buf = new Uint8Array(0); this.threshold = -1; }
  feed(chunk, onPacket) {
    this.buf = this.buf.length ? concat([this.buf, chunk]) : chunk;
    for (;;) {
      const len = readVarint(this.buf, 0);
      if (!len) break;
      const total = len.length + len.value;
      if (this.buf.length < total) break;
      let body = this.buf.subarray(len.length, total);
      this.buf = this.buf.subarray(total);
      if (this.threshold >= 0) {
        const dl = readVarint(body, 0);
        body = body.subarray(dl.length);
        if (dl.value > 0) body = inflate(body);
      }
      onPacket(body.slice());
    }
  }
}

const handshake = (protocol, host, port, next) => concat([
  new Uint8Array(varint(0x00)), new Uint8Array(varint(protocol)), mcString(host), new Uint8Array([(port >> 8) & 255, port & 255]), new Uint8Array(varint(next)),
]);

// ---------------------------------------------------------------- the proxy-link socket

export class VanillaSocket extends Emitter {
  constructor(entry) {
    super();
    this.entry = entry; // { type: 'relay' | 'wisp', url, token? }
    this.stream = null;
    this.state = 'idle';
    this.split = new Splitter();
    this.cipher = null; this.decipher = null;
    this.closed = false;
  }

  _control(obj) { this.emit('text', JSON.stringify(obj)); }
  _write(b) { if (this.stream) this.stream.write(this.cipher ? this.cipher.update(b) : b); }
  _send(payload) { this._write(frame(payload, this.split.threshold)); }
  _kick(reason) { this._control({ type: 'kicked', reason }); this.close(); }

  sendText(text) {
    let msg;
    try { msg = JSON.parse(text); } catch (e) { return; }
    if (msg.type === 'connect' && this.state === 'idle') this._connect(msg);
    else if (msg.type === 'ping' && this.state === 'idle') this._ping(msg);
  }
  sendBinary(b) { if (this.state === 'play') this._send(b); }
  close() {
    if (this.closed) return;
    this.closed = true;
    if (this.stream) this.stream.close();
    this.emit('close');
  }

  // onClose(reason) runs before the socket reports its own close
  async _open(host, port, onPacket, onClose) {
    this.stream = await openStream(this.entry, host, port);
    this.stream.on('close', (reason) => {
      if (onClose) onClose(reason);
      else if (reason && reason !== 'target closed' && this.state !== 'play') this._control({ type: 'error', message: reason });
      this.close();
    });
    this.stream.on('data', (raw) => {
      try {
        this.split.feed(this.decipher ? this.decipher.update(raw) : raw, onPacket);
      } catch (e) {
        this._control({ type: 'error', message: 'Bad data from server: ' + e.message });
        this.close();
      }
    });
  }

  async _connect(msg) {
    const host = msg.host || 'localhost', port = msg.port || 25565, protocol = msg.protocol | 0;
    this.auth = msg.auth && msg.auth.accessToken && msg.auth.uuid ? msg.auth : null;
    this.state = 'login';
    this._control({ type: 'status', key: 'connect.connecting', message: `Connecting to ${host}:${port}...` });
    try {
      await this._open(host, port, (p) => this._packet(p));
    } catch (e) {
      this._control({ type: 'error', message: e.message });
      this.close();
      return;
    }
    this._control({ type: 'status', key: 'connect.authorizing', message: 'Logging in...' });
    this._send(handshake(protocol, host, port, 2));
    this._send(concat([new Uint8Array([0x00]), mcString((msg.username || 'Player').slice(0, 16))]));
  }

  _packet(p) {
    if (this.state === 'play') { this.emit('binary', p); return; }
    const id = readVarint(p, 0), body = p.subarray(id.length);
    switch (id.value) {
      case 0x00: this._kick(readString(body, 0).value); break; // login disconnect (JSON chat)
      case 0x01: this._encryption(body); break;
      case 0x02: {
        const uuid = readString(body, 0), name = readString(body, uuid.end);
        this.state = 'play';
        this._control({ type: 'login_success', uuid: uuid.value, username: name.value });
        break;
      }
      case 0x03: this.split.threshold = readVarint(body, 0).value | 0; break; // set compression
      default: break;
    }
  }

  // Online mode: session join (through a MinecraftJS proxy when one is listed: the session server has no CORS),
  // then the RSA-encrypted secret, then AES/CFB8 both ways
  async _encryption(body) {
    if (!this.auth) { this._kick(JSON.stringify({ translate: 'minecraftjs.disconnect.online' })); return; }
    this.state = 'encrypting';
    let o = 0;
    const sid = readString(body, o); o = sid.end;
    const kl = readVarint(body, o); o += kl.length;
    const key = body.slice(o, o + kl.value); o += kl.value;
    const tl = readVarint(body, o); o += tl.length;
    const token = body.slice(o, o + tl.value);
    const secret = randomBytes(16);
    try {
      await joinSession(this.auth, serverHash(sid.value, secret, key));
    } catch (e) {
      this._kick(JSON.stringify({ translate: 'disconnect.loginFailedInfo', with: [e.message] }));
      return;
    }
    const es = rsaEncrypt(key, secret, randomBytes), et = rsaEncrypt(key, token, randomBytes);
    this._send(concat([new Uint8Array([0x01]), new Uint8Array(varint(es.length)), es, new Uint8Array(varint(et.length)), et]));
    this.cipher = new Cfb8(secret, false);
    this.decipher = new Cfb8(secret, true);
    this.state = 'login';
  }

  // Server list ping (status state): the same reply the MinecraftJS proxy sends
  async _ping(msg) {
    const host = msg.host || 'localhost', port = msg.port || 25565;
    this.state = 'status';
    let sent = 0, status = null;
    const done = (r) => { if (this.state === 'done') return; this.state = 'done'; this._control({ type: 'ping_result', id: msg.id, ...r }); this.close(); };
    try {
      await this._open(host, port, (p) => {
        const id = readVarint(p, 0);
        if (id.value === 0x00) {
          status = JSON.parse(readString(p, id.length).value);
          sent = platform().now();
          this._send(new Uint8Array([0x01, 0, 0, 0, 0, 0, 0, 0, 1]));
        } else if (id.value === 0x01 && status) {
          status.ping = Math.round(platform().now() - sent);
          done({ status });
        }
      }, (reason) => done(status ? { status } : { error: reason === 'target closed' || !reason ? 'Connection closed' : reason }));
    } catch (e) { done({ error: e.message }); return; }
    this._send(handshake(msg.protocol | 0, host, port, 1));
    this._send(new Uint8Array([0x00]));
  }
}

async function joinSession(auth, hash) {
  const body = { accessToken: auth.accessToken, selectedProfile: auth.uuid.replace(/-/g, ''), serverId: hash };
  const viaProxy = proxyRoute('/auth/join');
  const url = viaProxy || 'https://sessionserver.mojang.com/session/minecraft/join';
  let r;
  try { r = await platform().postJson(url, viaProxy ? { accessToken: body.accessToken, uuid: auth.uuid, hash } : body); } catch (e) {
    throw new Error(viaProxy ? 'The MinecraftJS proxy could not be reached for the session join' : 'Online-mode servers need a MinecraftJS proxy in the list (the session server blocks browsers)');
  }
  if (r.status === 200 || r.status === 204) return;
  throw new Error((r.json && (r.json.error || r.json.errorMessage)) || 'Session join failed (HTTP ' + r.status + ')');
}
