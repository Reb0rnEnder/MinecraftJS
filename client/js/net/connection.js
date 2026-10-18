// Socket link to the proxy (through the platform layer). Binary frames carry raw play packets (varint id + body).
import { decodePacket } from './packets.js';
import { platform } from '../platform/platform.js';

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

  async open() {
    if (this.ws) return;
    const sock = await platform().openSocket();
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

  // auth: { accessToken, uuid } for online-mode servers (Microsoft accounts), else null
  async connect(host, port, username, auth = null) {
    await this.open();
    this.state = 'login';
    this.ws.sendText(JSON.stringify({ type: 'connect', host, port, username, auth }));
  }

  async ping(host, port) {
    // Use a separate socket so pings don't interfere with a live session
    let sock;
    try { sock = await platform().openSocket(); } catch (e) { return { error: 'Proxy unreachable' }; }
    return new Promise((resolve) => {
      let done = false;
      const finish = (r) => { if (done) return; done = true; clearTimeout(timer); sock.close(); resolve(r); };
      const timer = setTimeout(() => finish({ error: 'Timed out' }), 6000);
      sock.on('text', (t) => { try { finish(JSON.parse(t)); } catch (err) { finish({ error: 'Bad response' }); } });
      sock.on('close', () => finish({ error: 'Proxy closed the connection' }));
      sock.sendText(JSON.stringify({ type: 'ping', host, port, id: 1 }));
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
