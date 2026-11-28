import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Reader774,
  Writer774,
  decodeConfiguration774
} from "../client/js/net/configuration-1.21.11.js";
import { decodePlayPacket774 } from "../client/js/net/play-codec-1.21.11.js";
import { readAnonymousNbt, writeAnonymousNbt } from "../client/js/net/nbt-anonymous.js";
import { componentFromNbt, componentToNbt } from "../client/js/net/component-nbt-1.21.11.js";
import { readLpVec3, writeLpVec3 } from "../client/js/net/lpvec3.js";
import {
  CONFIGURATION_CLIENTBOUND_774 as IN,
  PLAY_CLIENTBOUND_774 as PI
} from "../client/js/net/protocol-1.21.11-ids.js";

const native = JSON.parse(
  readFileSync(new URL("./port-1.21.11/component-fixtures.json", import.meta.url), "utf8")
);

const fixtures = native.fixtures;
const hex = (value) => Uint8Array.from(Buffer.from(value, "hex"));
const packet = (id) => new Writer774().varint(id);

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

test("native component fixture identity is pinned to 1.21.11", () => {
  assert.equal(native.minecraftVersion, "1.21.11");
  assert.equal(native.protocol, 774);
  assert.equal(native.clientSha1, "ba2df812c2d12e0219c489c4cd9a5e1f0760f5bd");
  assert.deepEqual(native.rejected, [
    "numeric root",
    "boolean root",
    "null root",
    "empty root list",
    "disallowed open_file click_event",
    "invalid change_page page",
    "empty extra list",
    "invalid object kind"
  ]);
  assert.equal(fixtures.length, 12);
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
  const writer = new Writer774();
  writeAnonymousNbt(writer, source);
  const reader = new Reader774(writer.build());
  const decodedValue = readAnonymousNbt(reader);
  assert.deepEqual(canonicalNbt(decodedValue), canonicalNbt(source));
  assert.equal(reader.remaining(), 0);
  assert.throws(
    () => writeAnonymousNbt(new Writer774(), { t: 9, v: { et: 0, items: ["bad"] } }),
    /end-tag/
  );
});

for (const fixture of fixtures) {
  test("native component fixture: " + fixture.name, () => {
    const nativeBytes = hex(fixture.wire);
    const reader = new Reader774(nativeBytes);
    assert.deepEqual(reader.component(), fixture.decoded);
    assert.equal(reader.remaining(), 0);

    const writtenDecoded = new Writer774().component(fixture.decoded).build();
    const nativeNbt = readAnonymousNbt(new Reader774(nativeBytes));
    const writtenDecodedNbt = readAnonymousNbt(new Reader774(writtenDecoded));
    assert.deepEqual(canonicalNbt(writtenDecodedNbt), canonicalNbt(nativeNbt));
    assert.deepEqual(componentFromNbt(componentToNbt(fixture.decoded)), fixture.decoded);

    const writtenValue = new Writer774().component(fixture.value).build();
    const roundtrippedValue = new Reader774(writtenValue).component();
    assert.deepEqual(new Writer774().component(roundtrippedValue).build(), writtenValue);
  });
}

test("1.21.11 strict component rules reject legacy, invalid click_event, and malformed object representations", () => {
  assert.throws(() => new Writer774().component(7), /text component/i);
  assert.throws(() => new Writer774().component(true), /text component/i);
  assert.throws(() => new Writer774().component(null), /text component/i);
  assert.throws(() => new Writer774().component([]), /Empty text component/);
  assert.throws(
    () => new Writer774().component({ text: "x", click_event: { action: "open_file", path: "/tmp/x" } }),
    /disallowed click_event action/i
  );
  assert.throws(
    () => new Writer774().component({ text: "x", click_event: { action: "change_page", page: 0 } }),
    /change_page page/i
  );
  assert.throws(
    () => new Writer774().component({ text: "x", extra: [] }),
    /extra component list/i
  );
  assert.throws(
    () => new Writer774().component({ object: "bogus", sprite: "minecraft:block/stone" }),
    /object component kind/i
  );
  assert.throws(() => new Writer774().component({ text: 42 }), /text component payload/);
  assert.throws(
    () => new Reader774(new Writer774().u8(3).i32(7).build()).component(),
    /text component/i
  );
});

test("LpVec3 packed velocity encoding handles zero, unit, and continued-scale vectors", () => {
  const zeroBytes = writeLpVec3(new Writer774(), { x: 0, y: 0, z: 0 }).build();
  assert.deepEqual(zeroBytes, new Uint8Array([0]));
  const zeroReader = new Reader774(zeroBytes);
  assert.deepEqual(readLpVec3(zeroReader), { x: 0, y: 0, z: 0 });
  assert.equal(zeroReader.remaining(), 0);

  const unitBytes = writeLpVec3(new Writer774(), { x: 0.5, y: -0.25, z: 0.75 }).build();
  assert.equal(unitBytes.length, 6);
  const unitReader = new Reader774(unitBytes);
  const unitDecoded = readLpVec3(unitReader);
  assert.equal(unitReader.remaining(), 0);
  assert.ok(Math.abs(unitDecoded.x - 0.5) < 1e-3);
  assert.ok(Math.abs(unitDecoded.y + 0.25) < 1e-3);
  assert.ok(Math.abs(unitDecoded.z - 0.75) < 1e-3);

  const scaledBytes = writeLpVec3(new Writer774(), { x: 4.5, y: -2.25, z: 6.0 }).build();
  assert.equal(scaledBytes[0] & 4, 4);
  const scaledReader = new Reader774(scaledBytes);
  const scaledDecoded = readLpVec3(scaledReader);
  assert.equal(scaledReader.remaining(), 0);
  assert.ok(Math.abs(scaledDecoded.x - 4.5) < 1e-3);
  assert.ok(Math.abs(scaledDecoded.y + 2.25) < 1e-3);
  assert.ok(Math.abs(scaledDecoded.z - 6.0) < 1e-3);

  const nanBytes = writeLpVec3(new Writer774(), { x: Number.NaN, y: 0, z: 0 }).build();
  assert.deepEqual(nanBytes, new Uint8Array([0]));
});

test("configuration and play text-bearing packets use component NBT and reject trailing bytes", () => {
  const reason = fixtures.find((fixture) => fixture.name === "styled click_event open_url");
  const plain = fixtures.find((fixture) => fixture.name === "plain string");

  const disconnect = packet(IN.disconnect).raw(hex(reason.wire)).build();
  assert.deepEqual(decodeConfiguration774(disconnect).reason, reason.decoded);
  assert.throws(
    () => decodeConfiguration774(packet(IN.disconnect).raw(hex(reason.wire)).u8(1).build()),
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
  assert.equal(decodeConfiguration774(pack).prompt, "hello");

  assert.deepEqual(
    decodePlayPacket774(packet(PI.kick_disconnect).raw(hex(reason.wire)).build()).reason,
    reason.decoded
  );
});
