import net from "node:net";
import { once } from "node:events";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { VanillaSocket766 } from "../../client/js/net/tcp-1.20.6.js";
import { setPlatform } from "../../client/js/platform/platform.js";
import { target } from "./prepare.mjs";

setPlatform({ now: () => performance.now() });

class Direct extends VanillaSocket766 {
  constructor() {
    super({ type: "native-capture" }, { distance: 2 });
  }

  async _open(host, port, onPacket, onClose) {
    const tcp = net.createConnection({ host, port });
    tcp.setNoDelay(true);
    this.stream = { write: (bytes) => tcp.write(bytes), close: () => tcp.destroy() };
    tcp.on("data", (bytes) => {
      try {
        this.split.feed(new Uint8Array(bytes), onPacket);
      } catch (error) {
        this._control({ type: "error", message: error.stack });
        this.close();
      }
    });
    tcp.on("close", () => {
      onClose?.(null);
      this.close();
    });
    tcp.on("error", (error) => {
      this._control({ type: "error", message: error.message });
      this.close();
    });
    await once(tcp, "connect");
  }
}

function js(value) {
  if (typeof value === "bigint") return "BigInt(" + JSON.stringify(value.toString()) + ")";
  if (value instanceof Int8Array) return "Int8Array.from(" + JSON.stringify(Array.from(value)) + ")";
  if (value instanceof Uint8Array) return "Uint8Array.from(" + JSON.stringify(Array.from(value)) + ")";
  if (value instanceof Int32Array) return "Int32Array.from(" + JSON.stringify(Array.from(value)) + ")";
  if (value instanceof BigInt64Array) {
    return "BigInt64Array.from(" + JSON.stringify(Array.from(value, String)) + ",BigInt)";
  }
  if (Array.isArray(value)) return "[" + value.map(js).join(",") + "]";
  if (value && typeof value === "object") {
    return "{" + Object.entries(value).map(([key, entry]) => JSON.stringify(key) + ":" + js(entry)).join(",") + "}";
  }
  return JSON.stringify(value);
}

export async function captureKnownPack({
  host = "127.0.0.1",
  port = 25568,
  out = new URL("../../client/js/net/known-pack-1.20.6.js", import.meta.url)
} = {}) {
  const socket = new Direct();
  let failure = null;
  let configuration = null;
  let offered = null;

  socket.on("text", (text) => {
    const message = JSON.parse(text);
    if (message.type === "error" || message.type === "kicked") {
      failure = new Error(message.message || message.reason);
    }
  });
  socket.on("configuration", (packet) => {
    if (packet.name === "select_known_packs") offered = packet.packs;
  });
  socket.on("configuration_complete", (value) => {
    configuration = value;
  });

  socket.sendText(JSON.stringify({
    type: "connect",
    host,
    port,
    username: "KnownPackCapture",
    protocol: 766
  }));

  try {
    const deadline = Date.now() + 20000;
    while (!configuration) {
      if (failure) throw failure;
      if (socket.closed) throw new Error("Native capture connection closed");
      if (Date.now() > deadline) throw new Error("Native known-pack capture timed out");
      await new Promise((resolveWait) => setTimeout(resolveWait, 20));
    }

    if (!offered?.length) throw new Error("Native server did not offer any known packs");
    const core = offered.find((pack) =>
      pack.namespace === "minecraft" &&
      pack.id === "core" &&
      pack.version === target.minecraftVersion
    );
    if (!core) throw new Error("Native server did not offer minecraft:core@" + target.minecraftVersion);

    const registries = Object.fromEntries(
      [...configuration.registries]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, entries]) => [name, entries.map(({ key, value }) => ({ key, value }))])
    );
    const metadata = {
      minecraftVersion: target.minecraftVersion,
      protocol: target.protocol,
      serverSha1: target.downloads.server.sha1,
      pack: core,
      registryCounts: Object.fromEntries(
        Object.entries(registries).map(([name, entries]) => [name, entries.length])
      )
    };
    const body = "// Captured from the SHA-1-pinned vanilla 1.20.6 server with known packs declined.\n" +
      "export const KNOWN_PACK_766 = " + js({ ...metadata, registries }) + ";\n";
    const sha1 = createHash("sha1").update(body).digest("hex");
    const final = body.replace(
      "export const KNOWN_PACK_766 = ",
      "export const KNOWN_PACK_766_SHA1 = " + JSON.stringify(sha1) + ";\nexport const KNOWN_PACK_766 = "
    );
    await writeFile(out, final);
    console.log(JSON.stringify({ ...metadata, sourceSha1: sha1 }, null, 2));
    return { ...metadata, sourceSha1: sha1 };
  } finally {
    socket.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await captureKnownPack();
}
