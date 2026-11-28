import { Writer774 } from "./configuration-1.21.11.js";
import { PLAY_SERVERBOUND_774 as OUT } from "./protocol-1.21.11-ids.js";

const same = (a, b) => a && b && a.length === b.length && a.every((value, index) => value === b[index]);

function signatureChecksum(bytes) {
  let hash = 1;
  for (let i = 0; i < bytes.length; i++) {
    const signed = bytes[i] > 127 ? bytes[i] - 256 : bytes[i];
    hash = (Math.imul(31, hash) + signed) | 0;
  }
  return hash;
}

export function computeLastSeenChecksum(signatures) {
  let sum = 1;
  for (const sig of signatures) {
    sum = (Math.imul(31, sum) + signatureChecksum(sig)) | 0;
  }
  const b = (sum << 24) >> 24;
  return b === 0 ? 1 : (b & 0xff);
}

export class ChatState774 {
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
    return { offset, acknowledged, signatures, checksum: computeLastSeenChecksum(signatures) };
  }

  flush() {
    const count = this.offset;
    this.offset = 0;
    return new Writer774().varint(OUT.message_acknowledgement).varint(count).build();
  }

  encode(text, { now = Date.now(), salt = 0n, signature = null } = {}) {
    const command = text.startsWith("/");
    const body = (command ? text.slice(1) : text).slice(0, 256);
    if (command) return new Writer774().varint(OUT.chat_command).string(body).build();

    const { offset, acknowledged, checksum } = this.collect();
    const writer = new Writer774()
      .varint(OUT.chat_message)
      .string(body)
      .i64(BigInt(now))
      .i64(BigInt(salt))
      .bool(!!signature);
    if (signature) {
      if (!(signature instanceof Uint8Array) || signature.length !== 256) {
        throw new Error("Protocol 774 chat signature must be 256 bytes");
      }
      writer.raw(signature);
    }
    return writer.varint(offset).raw(acknowledged).u8(checksum).build();
  }
}
