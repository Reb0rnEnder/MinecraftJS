import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Reader766,
  Writer766,
  decodeConfiguration766,
  decodeBootstrapPlay766
} from "../client/js/net/configuration-1.20.6.js";
import { readAnonymousNbt, writeAnonymousNbt } from "../client/js/net/nbt-anonymous.js";
import { componentFromNbt, componentToNbt } from "../client/js/net/component-nbt-1.20.6.js";
import {
  CONFIGURATION_CLIENTBOUND_766 as IN,
  PLAY_CLIENTBOUND_766 as PI
} from "../client/js/net/protocol-1.20.6-ids.js";

const native = JSON.parse(
  readFileSync(new URL("./port-1.20.6/component-fixtures.json", import.meta.url), "utf8")
);

const decoded = {
  "plain string": "hello",
  "styled click event": {
    clickEvent: { action: "open_url", value: "https://example.com" },
    color: "red",
    text: "Hello",
    bold: true
  },
  "root sibling list": {
    extra: [{ text: "B", italic: true }],
    text: "A"
  },
  "translation mixed list and hover": {
    hoverEvent: {
      contents: { text: "tip", bold: true },
      action: "show_text"
    },
    with: ["Alice", { color: "gold", text: "Hi" }],
    translate: "chat.type.text"
  }
};

const fixtures = native.fixtures.map((fixture) => ({
  ...fixture,
  decoded: decoded[fixture.name]
}));
const hex = (value) => Uint8Array.from(Buffer.from(value, "hex"));
const packet = (id) => new Writer766().varint(id);

function canonicalNbt(value) {
  if (value === null) return null;
  const normalize = (entry) => {
    const out = { t: entry.t };
    if (entry.t === 7 || entry.t === 11 || entry.t === 12) {
      out.v = Array.from(entry.v, String);
    } else if (entry.t === 9) {
      out.v = {
        et: entry.v.et,
        items: entry.v.items.map((item) => normalize({ t: entry.v.et, v: item }).v)
      };
    } else if (entry.t === 10) {
      out.v = Object.fromEntries(
        Object.keys(entry.v)
          .sort()
          .map((key) => [key, normalize(entry.v[key])])
      );
    } else {
      out.v = typeof entry.v === "bigint" ? String(entry.v) : entry.v;
    }
    return out;
  };
  return normalize(value);
}

test("native component fixture identity is pinned to 1.20.6", () => {
  assert.equal(native.minecraftVersion, "1.20.6");
  assert.equal(native.protocol, 766);
  assert.equal(native.clientSha1, "05b6f1c6b46a29d6ea82b4e0d42190e42402030f");
  assert.deepEqual(native.rejected, [
    "numeric root",
    "boolean root",
    "null root",
    "empty root list"
  ]);
  assert.ok(fixtures.every((fixture) => fixture.decoded !== undefined));
});

test("anonymous NBT writes and reads every native primitive family", () => {
  const source = {
    t: 10,
    v: {
      byte: { t: 1, v: -5 },
      short: { t: 2, v: -300 },
      int: { t: 3, v: 123456 },
      long: { t: 4, v: 1234567890123n },
      float: { t: 5, v: 1.25 },
      double: { t: 6, v: -3.5 },
      bytes: { t: 7, v: Int8Array.from([-1, 0, 1]) },
      string: { t: 8, v: "A\0é🌿" },
      list: { t: 9, v: { et: 8, items: ["x", "y"] } },
      ints: { t: 11, v: Int32Array.from([-1, 2]) },
      longs: { t: 12, v: BigInt64Array.from([-3n, 4n]) }
    }
  };
  const writer = new Writer766();
  writeAnonymousNbt(writer, source);
  const reader = new Reader766(writer.build());
  const decodedValue = readAnonymousNbt(reader);
  assert.deepEqual(canonicalNbt(decodedValue), canonicalNbt(source));
  assert.equal(reader.remaining(), 0);
  assert.throws(
    () => writeAnonymousNbt(new Writer766(), { t: 9, v: { et: 0, items: ["bad"] } }),
    /end-tag/
  );
});

for (const fixture of fixtures) {
  test("native component fixture: " + fixture.name, () => {
    const nativeBytes = hex(fixture.wire);
    const reader = new Reader766(nativeBytes);
    assert.deepEqual(reader.component(), fixture.decoded);
    assert.equal(reader.remaining(), 0);

    const written = new Writer766().component(fixture.value).build();
    const nativeNbt = readAnonymousNbt(new Reader766(nativeBytes));
    const writtenNbt = readAnonymousNbt(new Reader766(written));
    assert.deepEqual(canonicalNbt(writtenNbt), canonicalNbt(nativeNbt));
    assert.deepEqual(componentFromNbt(componentToNbt(fixture.value)), fixture.decoded);
  });
}

test("1.20.3 strict component rules reject legacy primitive and empty representations", () => {
  assert.throws(() => new Writer766().component(7), /text component/i);
  assert.throws(() => new Writer766().component(true), /text component/i);
  assert.throws(() => new Writer766().component([]), /Empty text component/);
  assert.throws(() => new Writer766().component({ text: 42 }), /text component payload/);
  assert.throws(
    () => new Reader766(new Writer766().u8(3).i32(7).build()).component(),
    /text component/i
  );
});

test("configuration and play text-bearing packets use component NBT and reject trailing bytes", () => {
  const reason = fixtures.find((fixture) => fixture.name === "styled click event");
  const plain = fixtures.find((fixture) => fixture.name === "plain string");

  const disconnect = packet(IN.disconnect).raw(hex(reason.wire)).build();
  assert.deepEqual(decodeConfiguration766(disconnect).reason, reason.decoded);
  assert.throws(
    () => decodeConfiguration766(packet(IN.disconnect).raw(hex(reason.wire)).u8(1).build()),
    /Trailing/
  );

  const pack = packet(IN.add_resource_pack)
    .uuid("12345678-1234-4234-8234-123456789abc")
    .string("https://example.com/pack.zip")
    .string("")
    .bool(false)
    .bool(true)
    .raw(hex(plain.wire))
    .build();
  assert.equal(decodeConfiguration766(pack).prompt, "hello");

  assert.deepEqual(
    decodeBootstrapPlay766(packet(PI.kick_disconnect).raw(hex(reason.wire)).build()).reason,
    reason.decoded
  );
});
