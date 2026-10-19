// Eaglercraft servers (EaglerXBungee and compatible WebSocket listeners): plain 1.8 play packets over a WebSocket,
// one packet per binary message (varint id + body, no length prefix, compression or encryption). Logging in uses
// the EaglercraftX handshake instead of the vanilla login state:
//
//   C 0x01 client version   S 0x02 server version (or 0x03 version mismatch)
//   C 0x04 request login    S 0x05 allow login (or 0x06 deny)
//   C 0x07 profile data (skin)  C 0x08 finish login   S 0x09 finish login -> play state
//   S 0xFF error (any time during the handshake)
//
// The client offers handshake protocols 2 and 3 (EaglerXBungee); a server answering in the legacy v1 format
// (early EaglercraftX proxies such as eaglerxbungee-ts) is accepted too, the later packets are the same.
//
// EaglerSocket has the socket interface of the proxy link (platform().openSocket), so Connection drives it the same
// way: a { type: 'connect' } text message starts the login, and progress comes back as proxy-style control messages.

const BRAND = 'MinecraftJS';
const VERSION = '1.8.9';
const GAME_PROTOCOL = 47;
const AUTH_NONE = 0, AUTH_PLAINTEXT = 3;

class Emitter {
  constructor() { this.handlers = {}; }
  on(ev, fn) { (this.handlers[ev] ||= []).push(fn); }
  emit(ev, a) { for (const fn of this.handlers[ev] || []) fn(a); }
}

class Writer {
  constructor() { this.b = []; }
  byte(v) { this.b.push(v & 0xff); return this; }
  short(v) { this.b.push((v >> 8) & 0xff, v & 0xff); return this; }
  int(v) { return this.short(v >>> 16).short(v & 0xffff); }
  bytes(a) { for (const v of a) this.b.push(v); return this; }
  str8(s) { const a = new TextEncoder().encode(s); return this.byte(a.length).bytes(a); }
  str16(s) { const a = new TextEncoder().encode(s); return this.short(a.length).bytes(a); }
  done() { return new Uint8Array(this.b); }
}

class Reader {
  constructor(b) { this.b = b; this.o = 0; }
  get left() { return this.b.length - this.o; }
  byte() { if (this.o >= this.b.length) throw new Error('Truncated handshake packet'); return this.b[this.o++]; }
  short() { return (this.byte() << 8) | this.byte(); }
  bytes(n) { if (this.o + n > this.b.length) throw new Error('Truncated handshake packet'); const r = this.b.subarray(this.o, this.o + n); this.o += n; return r; }
  str8() { return new TextDecoder().decode(this.bytes(this.byte())); }
  str16() { return new TextDecoder().decode(this.bytes(this.short())); }
}

const hex = (b) => Array.from(b, (v) => v.toString(16).padStart(2, '0')).join('');
const uuidString = (b) => { const h = hex(b); return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`; };

// 0xFF server error. v2+: byte code, short length, UTF-16 chars; v1 proxies: byte code, varint length, UTF-8.
function readError(b) {
  if (b.length < 2) return 'Server error';
  const body = b.subarray(2);
  if (body.length >= 2) {
    const n = (body[0] << 8) | body[1];
    if (body.length === 2 + n * 2) {
      let s = '';
      for (let i = 0; i < n; i++) s += String.fromCharCode((body[2 + i * 2] << 8) | body[3 + i * 2]);
      return s;
    }
    if (body.length === 2 + n) return new TextDecoder().decode(body.subarray(2));
  }
  let len = 0, shift = 0, o = 0;
  while (o < body.length) { const v = body[o++]; len |= (v & 0x7f) << shift; shift += 7; if (!(v & 0x80)) break; }
  return new TextDecoder().decode(body.subarray(o, o + len));
}

const chatJson = (text) => JSON.stringify({ text });

export class EaglerSocket extends Emitter {
  constructor(address) {
    super();
    this.address = address; // parseAddress() result with kind 'eagler'
    this.state = 'idle';    // idle -> version -> login -> profile -> finish -> play | closed
    this.ws = null;
  }

  // Resolves once the WebSocket is open
  open() {
    return new Promise((resolve, reject) => {
      let ws;
      try { ws = new WebSocket(this.address.url); } catch (e) { reject(new Error('Bad server address')); return; }
      ws.binaryType = 'arraybuffer';
      this.ws = ws;
      let opened = false;
      ws.onopen = () => { opened = true; resolve(this); };
      ws.onerror = () => { if (!opened) reject(new Error('Could not connect to ' + this.address.url)); };
      ws.onclose = () => { this.state = 'closed'; clearTimeout(this.timer); this.emit('close'); };
      ws.onmessage = (e) => {
        if (typeof e.data === 'string') return; // only the MOTD query answers with text
        const b = new Uint8Array(e.data);
        if (this.state === 'play') this.emit('binary', b);
        else this._handshake(b);
      };
    });
  }

  // ---------------------------------------------------------------- proxy-link socket interface

  sendText(text) {
    let msg;
    try { msg = JSON.parse(text); } catch (e) { return; }
    if (msg.type === 'connect' && this.state === 'idle') this._start(msg.username || 'Player');
  }
  sendBinary(b) { if (this.state === 'play' && this.ws.readyState === 1) this.ws.send(b); }
  close() { if (this.ws) this.ws.close(); }

  _control(obj) { this.emit('text', JSON.stringify(obj)); }

  _fail(message) {
    this._control({ type: 'kicked', reason: chatJson(message) });
    this.close();
  }

  // ---------------------------------------------------------------- handshake

  _start(username) {
    const a = this.address;
    this.username = (a.user || username).slice(0, 16);
    this.password = a.pass;
    this._control({ type: 'status', key: 'connect.authorizing', message: 'Logging in...' });
    this.state = 'version';
    this.timer = setTimeout(() => { if (this.state !== 'play') this._fail('Timed out during the Eaglercraft handshake'); }, 15000);
    this.ws.send(new Writer()
      .byte(0x01).byte(0x02)                        // client version, handshake format 2
      .short(2).short(2).short(3)                   // eagler protocols
      .short(1).short(GAME_PROTOCOL)                // game protocols
      .str8(BRAND).str8(VERSION)
      .byte(this.password !== null ? 1 : 0)
      .str8(this.username)
      .done());
  }

  _handshake(b) {
    try {
      if (b[0] === 0xff) { this._fail(readError(b)); return; }
      const r = new Reader(b);
      const id = r.byte();
      if (this.state === 'version') {
        if (id === 0x03) { this._fail('Incompatible Eaglercraft server (protocol mismatch)'); return; }
        if (id !== 0x02) throw new Error('Unexpected packet 0x' + id.toString(16));
        let auth = AUTH_NONE;
        if (b[1] === 0x01) {
          // legacy v1: byte protocol, brand, version, auth method, short salt length
          r.byte();
          this.serverBrand = r.str8(); this.serverVersion = r.str8();
          if (r.left >= 1) auth = r.byte();
        } else {
          this.protocol = r.short();
          const game = r.short();
          if (game !== GAME_PROTOCOL) { this._fail('This server is not a 1.8 server'); return; }
          this.serverBrand = r.str8(); this.serverVersion = r.str8();
          auth = r.byte();
          r.bytes(r.short()); // auth salt (only used by the SHA-256 methods)
        }
        let pass = new Uint8Array(0);
        if (auth !== AUTH_NONE) {
          if (this.password === null) { this._fail('This server needs a password: add it to the address as name:password@wss://...'); return; }
          if (auth !== AUTH_PLAINTEXT) { this._fail('This server uses an Eaglercraft password method MinecraftJS does not support yet'); return; }
          pass = new TextEncoder().encode(this.password);
        }
        this.state = 'login';
        this.ws.send(new Writer().byte(0x04).str8(this.username).str8('default').byte(pass.length).bytes(pass).done());
      } else if (this.state === 'login') {
        if (id === 0x06) { this._control({ type: 'kicked', reason: r.str16() }); this.close(); return; }
        if (id !== 0x05) throw new Error('Unexpected packet 0x' + id.toString(16));
        this.username = r.str8();
        this.uuid = uuidString(r.bytes(16));
        // Profile: built-in skin preset 0 (default), then finish
        this.ws.send(new Writer().byte(0x07).str8('skin_v1').short(5).byte(0x01).int(0).done());
        this.ws.send(new Uint8Array([0x08]));
        this.state = 'finish';
      } else if (this.state === 'finish') {
        if (id !== 0x09) throw new Error('Unexpected packet 0x' + id.toString(16));
        clearTimeout(this.timer);
        this.state = 'play';
        this._control({ type: 'login_success', uuid: this.uuid, username: this.username });
      }
    } catch (e) {
      this._fail('Eaglercraft handshake failed: ' + e.message);
    }
  }
}

export async function openEaglerSocket(address) {
  return new EaglerSocket(address).open();
}

// Server list ping: "Accept: MOTD" answers with a JSON description and, when the server has one, a 64x64 icon as
// raw pixels in a following binary message. Returns a vanilla-style status object (with iconPixels).
export function pingEagler(address, timeout = 6000) {
  return new Promise((resolve) => {
    let ws, done = false, status = null, sent = 0, iconTimer = null;
    const finish = (r) => {
      if (done) return;
      done = true;
      clearTimeout(timer); clearTimeout(iconTimer);
      try { ws.close(); } catch (e) { /* closed */ }
      resolve(r);
    };
    const timer = setTimeout(() => finish(status ? { status } : { error: 'Timed out' }), timeout);
    try { ws = new WebSocket(address.url); } catch (e) { finish({ error: 'Bad address' }); return; }
    ws.binaryType = 'arraybuffer';
    ws.onopen = () => { sent = performance.now(); ws.send('Accept: MOTD'); };
    ws.onerror = () => finish({ error: 'Could not connect' });
    ws.onclose = () => finish(status ? { status } : { error: 'Connection closed' });
    ws.onmessage = (e) => {
      if (typeof e.data === 'string') {
        let j;
        try { j = JSON.parse(e.data); } catch (err) { finish({ error: 'Bad response' }); return; }
        const d = (j && j.data) || {};
        const motd = Array.isArray(d.motd) ? d.motd.join('\n') : String(d.motd || '');
        status = {
          description: motd,
          players: { online: d.online | 0, max: d.max | 0, sample: (Array.isArray(d.players) ? d.players : []).map((name) => ({ name: String(name) })) },
          version: { name: j.vers || j.brand || 'Eaglercraft', protocol: GAME_PROTOCOL },
          ping: Math.round(performance.now() - sent),
        };
        if (d.icon) iconTimer = setTimeout(() => finish({ status }), 1000);
        else finish({ status });
      } else if (status) {
        const b = new Uint8Array(e.data);
        if (b.length === 64 * 64 * 4 || b.length === 64 * 64 * 3) {
          const px = new Uint8Array(64 * 64 * 4);
          const n = b.length / (64 * 64);
          for (let i = 0; i < 64 * 64; i++) {
            px[i * 4] = b[i * n]; px[i * 4 + 1] = b[i * n + 1]; px[i * 4 + 2] = b[i * n + 2];
            px[i * 4 + 3] = n === 4 ? b[i * 4 + 3] : 255;
          }
          status.iconPixels = px;
        }
        finish({ status });
      }
    };
  });
}
