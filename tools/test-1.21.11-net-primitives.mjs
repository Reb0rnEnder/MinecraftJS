import { test } from "node:test";
import assert from "node:assert/strict";
import { Reader, Writer } from "../client/js/net/buffer.js";
import { readLpVec3, writeLpVec3 } from "../client/js/net/lpvec3.js";
import { readAnonymousNbt, writeAnonymousNbt } from "../client/js/net/nbt-anonymous.js";
import {
  componentFromNbt,
  componentToNbt,
  readComponentNbt,
  writeComponentNbt
} from "../client/js/net/component-nbt-1.21.11.js";
import {
  HashOps,
  crc32c,
  padToLong,
  hashTag,
  hashValue,
  hashNbtValue,
  readHashedStack774,
  writeHashedStack774,
  hashSlot774
} from "../client/js/net/hashed-stack-1.21.11.js";

const hexToBytes = (hex) => Uint8Array.from(Buffer.from(hex, "hex"));
const bytesToHex = (bytes) => Buffer.from(bytes).toString("hex");

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

// ---------------------------------------------------------------------------
// 1. buffer.js (u32)
// ---------------------------------------------------------------------------

test("buffer.js Writer.u32 and Reader.u32 roundtrip unsigned 32-bit values", () => {
  const values = [0, 1, 0x7fffffff, 0x80000000, 0xdeadbeef, 0xffffffff];
  const writer = new Writer();
  for (const v of values) writer.u32(v);
  const bytes = writer.build();
  assert.equal(bytes.length, values.length * 4);
  assert.equal(bytesToHex(bytes.subarray(12, 16)), "80000000");
  assert.equal(bytesToHex(bytes.subarray(20, 24)), "ffffffff");

  const reader = new Reader(bytes);
  for (const expected of values) {
    assert.equal(reader.u32(), expected);
  }
  assert.equal(reader.remaining(), 0);
  assert.throws(() => new Reader(Uint8Array.of(1, 2, 3)).u32(), RangeError);
});

// ---------------------------------------------------------------------------
// 2. lpvec3.js (Java LpVec3 parity)
// ---------------------------------------------------------------------------

const JAVA_LPVEC3_FIXTURES = [
  { vec: { x: 0, y: 0, z: 0 }, hex: "00", decoded: { x: 0, y: 0, z: 0 } },
  { vec: { x: 1, y: -0.5, z: 0.25 }, hex: "f1ff9ffe8003", decoded: { x: 1.0, y: -0.49996948055911616, z: 0.2500152597204419 } },
  { vec: { x: 3, y: -2.5, z: 1.5 }, hex: "f3ffbffe2aab", decoded: { x: 3.0, y: -2.5000915583226515, z: 1.5000915583226515 } },
  { vec: { x: 10.5, y: -120.25, z: 0.001 }, hex: "6d2c7ffe019a1e", decoded: { x: 10.502472074711594, y: -120.24665812122322, z: 0.0 } },
  { vec: { x: 1e6, y: -1e6, z: 500 }, hex: "f4ff800e000390a10f", decoded: { x: 1000000.0, y: -1000000.0, z: 488.31105414159913 } }
];

test("lpvec3.js matches Java LpVec3 wire bytes exactly", () => {
  for (const { vec, hex, decoded: expected } of JAVA_LPVEC3_FIXTURES) {
    const written = writeLpVec3(new Writer(), vec).build();
    assert.equal(bytesToHex(written), hex);

    const reader = new Reader(hexToBytes(hex));
    const decoded = readLpVec3(reader);
    assert.equal(reader.remaining(), 0);
    assert.ok(Math.abs(decoded.x - expected.x) < 1e-9);
    assert.ok(Math.abs(decoded.y - expected.y) < 1e-9);
    assert.ok(Math.abs(decoded.z - expected.z) < 1e-9);
  }

  // NaN sanitizes to 0 and clamps to ABS_MAX
  assert.equal(bytesToHex(writeLpVec3(new Writer(), { x: Number.NaN, y: 0, z: 0 }).build()), "00");
  const clamped = readLpVec3(new Reader(writeLpVec3(new Writer(), { x: 1e20, y: -1e20, z: 0 }).build()));
  assert.ok(clamped.x <= 1.7179869183e10 && clamped.x > 1.7e10);
  assert.ok(clamped.y >= -1.7179869183e10 && clamped.y < -1.7e10);
});

// ---------------------------------------------------------------------------
// 3. component-nbt-1.21.11.js (Java ComponentSerialization parity)
// ---------------------------------------------------------------------------

const JAVA_COMPONENT_FIXTURES = [
  {
    name: "object atlas (default atlas omitted)",
    value: { sprite: "minecraft:block/stone" },
    wire: "0a08000673707269746500156d696e6563726166743a626c6f636b2f73746f6e6500"
  },
  {
    name: "object atlas (custom atlas)",
    value: { atlas: "minecraft:gui", sprite: "minecraft:icon/checkmark" },
    wire: "0a08000561746c6173000d6d696e6563726166743a67756908000673707269746500186d696e6563726166743a69636f6e2f636865636b6d61726b00"
  },
  {
    name: "object player (name object)",
    value: { player: { name: "Steve" } },
    wire: "0a0a0006706c617965720800046e616d65000553746576650000"
  },
  {
    name: "object player (hat=false)",
    value: { hat: false, player: { name: "Alex" } },
    wire: "0a010003686174000a0006706c617965720800046e616d650004416c65780000"
  },
  {
    name: "shadow_color integer",
    value: { text: "shadow", shadow_color: -2130771968 },
    wire: "0a03000c736861646f775f636f6c6f7280ff0000080004746578740006736861646f7700"
  },
  {
    name: "click_event open_url",
    value: { text: "link", click_event: { action: "open_url", url: "https://example.com/path?a=1" } },
    wire: "0a0a000b636c69636b5f6576656e74080006616374696f6e00086f70656e5f75726c08000375726c001c68747470733a2f2f6578616d706c652e636f6d2f706174683f613d31000800047465787400046c696e6b00"
  },
  {
    name: "click_event run_command",
    value: { text: "run", click_event: { action: "run_command", command: "/say hi" } },
    wire: "0a0a000b636c69636b5f6576656e74080006616374696f6e000b72756e5f636f6d6d616e64080007636f6d6d616e6400072f7361792068690008000474657874000372756e00"
  },
  {
    name: "click_event suggest_command",
    value: { text: "sug", click_event: { action: "suggest_command", command: "/msg " } },
    wire: "0a0a000b636c69636b5f6576656e74080006616374696f6e000f737567676573745f636f6d6d616e64080007636f6d6d616e6400052f6d7367200008000474657874000373756700"
  },
  {
    name: "click_event change_page",
    value: { text: "pg", click_event: { action: "change_page", page: 3 } },
    wire: "0a0a000b636c69636b5f6576656e74080006616374696f6e000b6368616e67655f70616765030004706167650000000300080004746578740002706700"
  },
  {
    name: "click_event copy_to_clipboard",
    value: { text: "cp", click_event: { action: "copy_to_clipboard", value: "copied" } },
    wire: "0a0a000b636c69636b5f6576656e74080006616374696f6e0011636f70795f746f5f636c6970626f61726408000576616c75650006636f7069656400080004746578740002637000"
  },
  {
    name: "click_event custom",
    value: { text: "cust", click_event: { action: "custom", id: "minecraft:test", payload: { k: 7 } } },
    wire: "0a0a000b636c69636b5f6576656e740a00077061796c6f61640300016b0000000700080006616374696f6e0006637573746f6d0800026964000e6d696e6563726166743a74657374000800047465787400046375737400"
  },
  {
    name: "hover_event show_text",
    value: { text: "ht", hover_event: { action: "show_text", value: { text: "inner", color: "gold" } } },
    wire: "0a08000474657874000268740a000b686f7665725f6576656e74080006616374696f6e000973686f775f746578740a000576616c7565080005636f6c6f720004676f6c64080004746578740005696e6e6572000000"
  },
  {
    name: "hover_event show_item (inlined)",
    value: { text: "hi", hover_event: { action: "show_item", id: "minecraft:diamond", count: 2 } },
    wire: "0a08000474657874000268690a000b686f7665725f6576656e74030005636f756e7400000002080006616374696f6e000973686f775f6974656d080002696400116d696e6563726166743a6469616d6f6e640000"
  },
  {
    name: "hover_event show_entity (inlined)",
    value: {
      text: "he",
      hover_event: {
        action: "show_entity",
        id: "minecraft:pig",
        uuid: [0x12345678, 0x12344234, -2110516684, 1450744508],
        name: "Mob"
      }
    },
    wire: "0a08000474657874000268650a000b686f7665725f6576656e740800046e616d6500034d6f62080006616374696f6e000b73686f775f656e746974790800026964000d6d696e6563726166743a7069670b0004757569640000000412345678123442348234123456789abc0000"
  }
];

for (const fixture of JAVA_COMPONENT_FIXTURES) {
  test("component-nbt-1.21.11 matches Java fixture: " + fixture.name, () => {
    const javaBytes = hexToBytes(fixture.wire);
    const reader = new Reader(javaBytes);
    const decoded = readComponentNbt(reader);
    assert.equal(reader.remaining(), 0);
    assert.deepEqual(decoded, fixture.value);

    const written = writeComponentNbt(new Writer(), fixture.value).build();
    const javaNbt = readAnonymousNbt(new Reader(javaBytes));
    const jsNbt = readAnonymousNbt(new Reader(written));
    assert.deepEqual(canonicalNbt(jsNbt), canonicalNbt(javaNbt));
  });
}

test("component-nbt-1.21.11 handles shadow_color 4-float, tryCollapseToString, extra, and heterogeneous with", () => {
  // 4-float shadow_color encodes strictly as TAG_List of TAG_Float (et: 5)
  const floatShadow = { text: "f4", shadow_color: [1, 0.5, 0, 0.75] };
  const nbtShadow = componentToNbt(floatShadow);
  assert.equal(nbtShadow.v.shadow_color.t, 9);
  assert.equal(nbtShadow.v.shadow_color.v.et, 5);
  assert.deepEqual(componentFromNbt(nbtShadow), { text: "f4", shadow_color: [1, 0.5, 0, 0.75] });

  // tryCollapseToString: plain text collapses to TAG_String, styled keeps TAG_Compound
  const plainNbt = componentToNbt({ text: "hello" });
  assert.equal(plainNbt.t, 8);
  assert.equal(plainNbt.v, "hello");
  assert.equal(readComponentNbt(new Reader(writeComponentNbt(new Writer(), { text: "hello" }).build())), "hello");

  // Top-level component list encodes as { text, extra: [...] } compound, never TAG_List
  const listComp = ["a", { text: "b", bold: true }];
  const listNbt = componentToNbt(listComp);
  assert.equal(listNbt.t, 10);
  assert.deepEqual(componentFromNbt(listNbt), { text: "a", extra: [{ text: "b", bold: true }] });

  // Heterogeneous `with` wraps non-compound elements in {"": ...}
  const trans = { translate: "chat.type.text", with: ["Steve", 42, true, { text: "hi", color: "red" }] };
  const transNbt = componentToNbt(trans);
  assert.equal(transNbt.v.with.t, 9);
  assert.equal(transNbt.v.with.v.et, 10);
  assert.deepEqual(transNbt.v.with.v.items[0], { "": { t: 8, v: "Steve" } });
  assert.deepEqual(transNbt.v.with.v.items[1], { "": { t: 1, v: 42 } });
  assert.deepEqual(componentFromNbt(transNbt), {
    translate: "chat.type.text",
    with: ["Steve", 42, 1, { text: "hi", color: "red" }]
  });

  // show_dialog click_event
  const dlg = { text: "open", click_event: { action: "show_dialog", dialog: "minecraft:notice" } };
  assert.deepEqual(componentFromNbt(componentToNbt(dlg)), dlg);

  // Explicit type: "object"
  const explicitObj = { type: "object", object: "player", player: "Notch", hat: false };
  assert.deepEqual(componentFromNbt(componentToNbt(explicitObj)), explicitObj);
});

test("component-nbt-1.21.11 strictly rejects invalid roots and disallowed events", () => {
  assert.throws(() => componentToNbt(7), /text component/i);
  assert.throws(() => componentToNbt(true), /text component/i);
  assert.throws(() => componentToNbt(null), /text component/i);
  assert.throws(() => componentToNbt([]), /Empty text component/);
  assert.throws(() => readComponentNbt(new Reader(new Writer().u8(3).i32(7).build())), /text component/i);
  assert.throws(() => readComponentNbt(new Reader(new Writer().u8(0).build())), /Missing text component/);
  assert.throws(
    () => componentToNbt({ text: "bad", click_event: { action: "open_file", path: "/etc/passwd" } }),
    /open_file/
  );
  assert.throws(
    () => componentToNbt({ text: "bad", click_event: { action: "change_page", page: 0 } }),
    /change_page/
  );
  assert.throws(
    () => componentToNbt({ text: "bad", click_event: { action: "open_url", url: "javascript:alert(1)" } }),
    /open_url/
  );
  assert.throws(
    () => componentToNbt({ text: "bad", click_event: { action: "run_command", command: "say §bad" } }),
    /command/
  );
  assert.throws(
    () => componentToNbt({ text: "bad", shadow_color: [1, 2, 3] }),
    /shadow_color/
  );
  assert.throws(
    () => componentToNbt({ object: "atlas", sprite: "a", player: "b" }),
    /Ambiguous|Unexpected/
  );
});

// ---------------------------------------------------------------------------
// 4. hashed-stack-1.21.11.js (Java HashOps.CRC32C_INSTANCE & HashedStack parity)
// ---------------------------------------------------------------------------

test("HashOps.CRC32C_INSTANCE matches real Java HashOps.java on every tag type", () => {
  const ops = HashOps.CRC32C_INSTANCE;

  assert.equal(ops.empty(), -1609117614);
  assert.equal(ops.emptyMap(), -982207288);
  assert.equal(ops.emptyList(), -1978007022);
  assert.equal(ops.createBoolean(false), 828198337);
  assert.equal(ops.createBoolean(true), -1019818302);
  assert.equal(ops.createByte(0), -1733417248);
  assert.equal(ops.createByte(-1), 903050673);
  assert.equal(ops.createByte(127), -1222291767);
  assert.equal(ops.createByte(-128), 441982360);
  assert.equal(ops.createShort(-300), 1041873889);
  assert.equal(ops.createShort(32767), -1728279623);
  assert.equal(ops.createInt(0), -2146075228);
  assert.equal(ops.createInt(123456), -629611337);
  assert.equal(ops.createInt(-1), 932039068);
  assert.equal(ops.createLong(0n), -139965316);
  assert.equal(ops.createLong(1234567890123n), -556570646);
  assert.equal(ops.createLong(-1n), 870823217);
  assert.equal(ops.createFloat(0.0), -264789252);
  assert.equal(ops.createFloat(-0.0), 1925290372);
  assert.equal(ops.createFloat(1.25), 445632146);
  assert.equal(ops.createDouble(0.0), 439981597);
  assert.equal(ops.createDouble(-0.0), -1731220123);
  assert.equal(ops.createDouble(-3.5), 170529469);
  assert.equal(ops.createString(""), 1615905556);
  assert.equal(ops.createString("hello"), 773640809);
  assert.equal(ops.createString("A\0é🌿"), -2003135913);
  assert.equal(ops.createByteList(new Uint8Array(0)), 1537857916);
  assert.equal(ops.createByteList(Int8Array.from([-1, 0, 1])), 1975537757);
  assert.equal(ops.createIntList([]), 747749951);
  assert.equal(ops.createIntList([-1, 2, 0x12345678]), -1614766006);
  assert.equal(ops.createLongList([]), -353402330);
  assert.equal(ops.createLongList([-3n, 4n, 1234567890123n]), 405301107);
  assert.equal(ops.createList([ops.createString("x"), ops.createString("y")]), 1388650676);

  // Unsigned 64-bit padToLong() ordering verification
  assert.equal(padToLong(ops.createString("z")), 3133873703n);
  assert.equal(padToLong(ops.createString("a")), 754812039n);
  assert.equal(padToLong(ops.createString("m")), 4284688099n);

  const nestedMap = ops.createMap([
    [ops.createString("z"), ops.createInt(1)],
    [ops.createString("a"), ops.createBoolean(true)],
    [ops.createString("m"), ops.createList([ops.createByte(7), ops.createString("ok")])]
  ]);
  assert.equal(nestedMap, -1257478476);
  assert.equal(crc32c(Uint8Array.of(1)), ops.empty());
});

test("hashNbtValue / hashTag matches Java NbtOps.convertTo(HashOps.CRC32C_INSTANCE) on wire NBT", () => {
  // Exact wire bytes from Java Probe12111.java (CompoundTag with all primitives + heterogeneous ListTag)
  const javaWireHex =
    "0a080003737472000b41c080c3a9eda0bcedbcbf01000162fb02000173fed406000164c00c0000000000000c00026c61" +
    "00000003fffffffffffffffd00000000000000040000011f71fb04cb050001663fa000000900036865740a0000000308" +
    "000000026869000300000000002a000100016b01000b0002696100000003ffffffff0000000212345678030001690001" +
    "e2400400016c0000011f71fb04cb070002626100000003ff000100";
  const nbt = readAnonymousNbt(new Reader(hexToBytes(javaWireHex)));
  assert.equal(hashNbtValue(nbt), -742988529);
  assert.equal(hashTag(nbt), -742988529);

  // Also verify TypedDataComponent hashes from Java ProbeWire12111.java
  assert.equal(hashValue(10), -919192125); // damage = 10
  assert.equal(hashNbtValue(componentToNbt({ text: "Excalibur", color: "gold" })), 1544526040);
});

test("readHashedStack774, writeHashedStack774, and hashSlot774 match real Java HashedStack bytes", () => {
  // Empty HashedStack
  const emptyReader = new Reader(hexToBytes("00"));
  assert.equal(readHashedStack774(emptyReader), null);
  assert.equal(emptyReader.remaining(), 0);
  assert.equal(bytesToHex(writeHashedStack774(new Writer(), null).build()), "00");
  assert.equal(hashSlot774(null), null);

  // Real Java fixture: diamond (id=898), count=3, custom_name={text:"Excalibur",color:"gold"}, damage=10, removed=[repair_cost]
  const javaHex = "0182070302065c0f98d803c9363dc30113";
  const reader = new Reader(hexToBytes(javaHex));
  const decoded = readHashedStack774(reader);
  assert.equal(reader.remaining(), 0);
  assert.deepEqual(decoded, {
    itemId: 898,
    count: 3,
    components: [
      { type: 6, hash: 1544526040 },
      { type: 3, hash: -919192125 }
    ],
    removeComponents: [19]
  });

  const hashedFromSlot = hashSlot774({
    itemId: 898,
    count: 3,
    componentPatch: {
      added: [
        { type: "custom_name", data: componentToNbt({ text: "Excalibur", color: "gold" }) },
        { type: "damage", data: 10 }
      ],
      removed: ["repair_cost"]
    }
  });
  assert.deepEqual(hashedFromSlot, decoded);
  assert.equal(bytesToHex(writeHashedStack774(new Writer(), hashedFromSlot).build()), javaHex);

  // Custom hash generator callback and Map lookup
  const fromCallback = hashSlot774(
    { id: 898, count: 1, componentPatch: { added: [{ type: "damage", data: 10 }], removed: [] } },
    (_entry, typeId) => (typeId === 3 ? -919192125 : 0)
  );
  assert.deepEqual(fromCallback.components, [{ type: 3, hash: -919192125 }]);

  // Enforce 256-entry HashedPatchMap bound
  const over = Array.from({ length: 257 }, (_, i) => ({ type: 0, hash: i }));
  assert.throws(
    () => writeHashedStack774(new Writer(), { itemId: 1, count: 1, components: over, removeComponents: [] }),
    /257/
  );
});
