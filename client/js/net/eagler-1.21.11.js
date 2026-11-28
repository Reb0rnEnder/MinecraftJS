import { VanillaSocket774 } from './tcp-1.21.11.js';
import { openEaglerSocket } from './eagler.js';

export class EaglerSocket774 extends VanillaSocket774 {
  constructor(address, options = {}) {
    super({}, options);
    this.address = address;
    this.isEagler = true;
  }

  async open() {
    this.link = await openEaglerSocket(this.address);
    this.stream = { close: () => this.link.close() };
    this.link.on('close', () => this.close());
    this.link.on('text', (text) => {
      let message;
      try { message = JSON.parse(text); } catch { return; }
      if (message.type === 'login_success') {
        this.profile = { uuid: message.uuid, username: message.username };
        this._beginConfiguration();
      } else {
        this._control(message);
      }
    });
    this.link.on('binary', (bytes) => {
      try { this._packet(bytes); } catch (error) { this._badPacket(error); }
    });
    return this;
  }

  _send(bytes) { if (!this.closed) this.link.sendBinary(bytes); }
  sendText(text) { this.link.sendText(text); }
}
