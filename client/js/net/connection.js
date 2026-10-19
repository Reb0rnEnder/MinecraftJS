// Socket link to the game server. Vanilla servers go through the selected proxy: a MinecraftJS proxy
// (platform().openSocket, the proxy logs in), or a Java relay / Wisp server carrying raw TCP (tcp.js, the client logs
// in); Eaglercraft servers (ws:// / wss:// addresses) are reached directly over their own WebSocket (eagler.js). All
// sockets look the same: binary frames carry raw play packets (varint id + body), text frames JSON control messages.
import { decodePacket, PROTOCOL_VERSION } from './packets.js';
import { platform } from '../platform/platform.js';
import { parseAddress } from './address.js';
import { openEaglerSocket, pingEagler } from './eagler.js';
import { currentProxy, proxyType } from './proxies.js';
import { VanillaSocket } from './tcp.js';

const NO_PROXY = 'No proxy selected: add one in Proxy Servers on the title screen (or join an Eaglercraft wss:// server)';

// A socket to the selected proxy (MinecraftJS proxy, or a relay / Wisp link handled in the client)
async function openProxySocket() {
  const p = currentProxy();
  if (!p) throw new Error(NO_PROXY);
  if (proxyType(p) !== 'minecraftjs') return new VanillaSocket({ ...p, type: proxyType(p) });
  try { return await platform().openSocket(p.url); } catch (e) { throw new Error('Could not reach the MinecraftJS proxy'); }
}

export class Connection {
  constructor() {
    this.ws = null;
    this.handlers = {};
    this.state = 'idle';
    this.bytesIn = 0;
    this.bytesOut = 0;
    this.packetsIn = 0;
  }

  on(ev, fn) { (this.handlers[ev] ||= []).push(fn); }
  emit(ev, ...a) { for (const fn of this.handlers[ev] || []) fn(...a); }

  async open(eagler) {
    if (this.ws) return;
    let sock;
    if (eagler) sock = await openEaglerSocket(eagler);
    else sock = await openProxySocket();
    this.ws = sock;
    sock.on('close', () => {
      const was = this.state;
      this.state = 'closed';
      this.ws = null;
      this.emit('close', was);
    });
    sock.on('text', (text) => {
      let msg;
      try { msg = JSON.parse(text); } catch (err) { return; }
      this.emit('control', msg);
    });
    sock.on('binary', (bytes) => {
      this.bytesIn += bytes.length;
      this.packetsIn++;
      let p;
      try {
        p = decodePacket(bytes);
      } catch (err) {
        console.warn('Failed to decode packet', bytes[0], err);
        return;
      }
      this.emit('packet', p);
    });
  }

  // auth: { accessToken, uuid } for online-mode servers (Microsoft accounts), else null.
  // host may be an Eaglercraft address (then port is ignored).
  async connect(host, port, username, auth = null) {
    const a = parseAddress(host);
    const eagler = a && a.kind === 'eagler' ? a : null;
    await this.open(eagler);
    this.state = 'login';
    this.ws.sendText(JSON.stringify({ type: 'connect', host, port, username, auth: eagler ? null : auth, protocol: PROTOCOL_VERSION }));
  }

  async ping(host, port) {
    const a = parseAddress(host);
    if (a && a.kind === 'eagler') return pingEagler(a);
    // Use a separate socket so pings don't interfere with a live session
    let sock;
    try { sock = await openProxySocket(); } catch (e) { return { error: currentProxy() ? 'Proxy unreachable' : 'No proxy' }; }
    return new Promise((resolve) => {
      let done = false;
      const finish = (r) => { if (done) return; done = true; clearTimeout(timer); sock.close(); resolve(r); };
      const timer = setTimeout(() => finish({ error: 'Timed out' }), 6000);
      sock.on('text', (t) => { try { const m = JSON.parse(t); if (m.type === 'ping_result') finish(m); } catch (err) { finish({ error: 'Bad response' }); } });
      sock.on('close', () => finish({ error: 'Proxy closed the connection' }));
      sock.sendText(JSON.stringify({ type: 'ping', host, port, id: 1, protocol: PROTOCOL_VERSION }));
    });
  }

  send(bytes) {
    if (this.ws) {
      this.ws.sendBinary(bytes);
      this.bytesOut += bytes.length;
    }
  }

  close() {
    if (this.ws) this.ws.close();
  }
}
