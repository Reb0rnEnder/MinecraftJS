import { Writer766 } from "./configuration-1.20.6.js";
import { PLAY_SERVERBOUND_766 as OUT } from "./protocol-1.20.6-ids.js";

const same = (a, b) => a && b && a.length === b.length && a.every((value, index) => value === b[index]);

export class ChatState766 {
  constructor() {
    this.reset();
  }

  reset() {
    this.entries = Array(20).fill(null);
    this.tail = 0;
    this.offset = 0;
    this.last = null;
  }

  process(signature, shown = true) {
    if (!signature || same(this.last, signature)) return false;
    this.last = signature.slice();
    this.entries[this.tail] = shown ? { signature: signature.slice(), pending: true } : null;
    this.tail = (this.tail + 1) % 20;
    this.offset++;
    return true;
  }

  ignore(signature) {
    const index = this.entries.findIndex((entry) => entry?.pending && same(entry.signature, signature));
    if (index >= 0) this.entries[index] = null;
  }

  collect() {
    const offset = this.offset;
    this.offset = 0;
    const acknowledged = new Uint8Array(3);
    const signatures = [];
    for (let i = 0; i < 20; i++) {
      const entry = this.entries[(this.tail + i) % 20];
      if (!entry) continue;
      acknowledged[i >> 3] |= 1 << (i & 7);
      signatures.push(entry.signature);
      entry.pending = false;
    }
    return { offset, acknowledged, signatures };
  }

  flush() {
    const count = this.offset;
    this.offset = 0;
    return new Writer766().varint(OUT.message_acknowledgement).varint(count).build();
  }

  encode(text, { now = Date.now(), salt = 0n, signature = null } = {}) {
    const command = text.startsWith("/");
    const body = (command ? text.slice(1) : text).slice(0, 256);
    if (command) return new Writer766().varint(OUT.chat_command).string(body).build();

    const { offset, acknowledged } = this.collect();
    const writer = new Writer766()
      .varint(OUT.chat_message)
      .string(body)
      .i64(BigInt(now))
      .i64(BigInt(salt))
      .bool(!!signature);
    if (signature) {
      if (!(signature instanceof Uint8Array) || signature.length !== 256) {
        throw new Error("Protocol 766 chat signature must be 256 bytes");
      }
      writer.raw(signature);
    }
    return writer.varint(offset).raw(acknowledged).build();
  }
}
