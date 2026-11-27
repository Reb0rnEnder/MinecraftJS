import { Writer766 } from "./configuration-1.20.6.js";
import { PLAY_SERVERBOUND_766 as OUT } from "./protocol-1.20.6-ids.js";
import { randomSalt } from "./chat-signing-1.20.6.js";

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

  // ClientPacketListener.sendChat / sendCommand. this.signer(body) signs a SignedMessageBody with the local chat
  // session (null without one); this.signableArguments(command) lists the command's message arguments
  // (SignableCommand.of). Commands with such arguments always use chat_command_signed, signed or not.
  encode(text, { now = Date.now(), salt = randomSalt(), signature = null } = {}) {
    const command = text.startsWith("/");
    const body = (command ? text.slice(1) : text).slice(0, 256);
    if (command) {
      const args = this.signableArguments?.(body) || [];
      if (!args.length) return new Writer766().varint(OUT.chat_command).string(body).build();
      const { offset, acknowledged, signatures } = this.collect();
      const signed = [];
      for (const arg of args) {
        const sig = this.signer?.({ content: arg.value, timestamp: now, salt: BigInt(salt), lastSeen: signatures });
        if (sig) signed.push({ name: arg.name, sig });
      }
      const writer = new Writer766().varint(OUT.chat_command_signed).string(body).i64(BigInt(now)).i64(BigInt(salt)).varint(signed.length);
      for (const { name, sig } of signed) {
        if (!(sig instanceof Uint8Array) || sig.length !== 256) throw new Error("Protocol 766 argument signature must be 256 bytes");
        writer.string(name).raw(sig);
      }
      return writer.varint(offset).raw(acknowledged).build();
    }

    const { offset, acknowledged, signatures } = this.collect();
    signature ||= this.signer?.({ content: body, timestamp: now, salt: BigInt(salt), lastSeen: signatures }) || null;
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
