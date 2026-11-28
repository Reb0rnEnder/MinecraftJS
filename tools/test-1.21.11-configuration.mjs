import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  Reader774,
  Writer774,
  C774,
  Configuration774,
  decodeLogin774,
  decodeConfiguration774
} from "../client/js/net/configuration-1.21.11.js";
import { decodePlayPacket774 } from "../client/js/net/play-codec-1.21.11.js";
import { readModifiedUtf, writeModifiedUtf, readAnonymousNbt } from "../client/js/net/nbt-anonymous.js";
import { VanillaSocket774 } from "../client/js/net/tcp-1.21.11.js";
import { KNOWN_PACK_774, KNOWN_PACK_774_SHA1 } from "../client/js/net/known-pack-1.21.11.js";
import {
  CONFIGURATION_CLIENTBOUND_774 as IN,
  CONFIGURATION_SERVERBOUND_774 as OUT,
  LOGIN_CLIENTBOUND_774 as LI,
  LOGIN_SERVERBOUND_774 as LO,
  PLAY_CLIENTBOUND_774 as PI
} from "../client/js/net/protocol-1.21.11-ids.js";

const uuid = "12345678-1234-4234-8234-123456789abc";
const packet = (id) => new Writer774().varint(id);
const registry = () => {
  const w = packet(IN.registry_data).string("minecraft:dimension_type").varint(1).string("minecraft:overworld").bool(true).u8(10);
  w.u8(3);
  writeModifiedUtf(w, "min_y");
  w.i32(-64).u8(3);
  writeModifiedUtf(w, "height");
  return w.i32(384).u8(0).build();
};

test("phase IDs agree with the pinned 1.21.11 upstream schema, including links, dialogs, and code of conduct", () => {
  const schema = JSON.parse(readFileSync(new URL("../cache/port-1.21.11/upstream/protocol.json", import.meta.url), "utf8"));
  for (const [direction, ids] of [["toClient", IN], ["toServer", OUT]]) {
    const native = schema.configuration[direction].types.packet[1][0].type[1].mappings;
    assert.deepEqual(ids, Object.fromEntries(Object.entries(native).map(([id, name]) => [name, Number(id)])));
  }
  assert.equal(Object.keys(IN).length, 20);
  assert.equal(Object.keys(OUT).length, 10);
});

test("modified UTF-8 matches Java DataOutputStream oracle for NUL and a surrogate-pair emoji", () => {
  const bytes = Uint8Array.from(Buffer.from("000b41c080c3a9eda0bcedbcbf", "hex"));
  assert.equal(readModifiedUtf(new Reader774(bytes)), "A\0é🌿");
  const w = new Writer774();
  writeModifiedUtf(w, "A\0é🌿");
  assert.deepEqual(w.build(), bytes);
  assert.throws(() => readModifiedUtf(new Reader774(new Uint8Array([0, 1, 0xff]))), /UTF/);
});

test("anonymous NBT is typed, nameless and rejects malformed array/list lengths", () => {
  const p = decodeConfiguration774(registry());
  assert.equal(p.entries[0].value.name, "");
  assert.equal(p.entries[0].value.v.min_y.v, -64);
  assert.equal(p.entries[0].value.v.height.v, 384);
  assert.throws(() => readAnonymousNbt(new Reader774(new Writer774().u8(9).u8(1).i32(-1).build())), /length/);
  assert.throws(() => readAnonymousNbt(new Reader774(new Writer774().u8(7).i32(10).u8(1).build())), /length/);
  assert.throws(() => decodeConfiguration774(new Writer774().varint(IN.custom_payload).varint(-1).build()), /length/);
});

test("login success, mandatory UUID and encryption flag preserve native 1.21.11 fields", () => {
  const p = decodeLogin774(packet(LI.success).uuid(uuid).string("Probe").varint(1).string("textures").string("payload").bool(false).build());
  assert.equal(p.uuid, uuid);
  assert.equal(p.username, "Probe");
  assert.equal(p.properties[0].signature, null);
  const r = new Reader774(C774.loginStart("Probe", uuid));
  assert.equal(r.varint(), LO.login_start);
  assert.equal(r.string(), "Probe");
  assert.equal(r.uuid(), uuid);
  assert.equal(r.remaining(), 0);
  const e = decodeLogin774(packet(LI.encryption_begin).string("").varint(1).u8(1).varint(1).u8(2).bool(false).build());
  assert.equal(e.shouldAuthenticate, false);
});

test("configuration selects only the exact native 1.21.11 known pack, handles links/report/conduct, and atomically finishes", () => {
  const sent = [], events = [], c = new Configuration774((p) => sent.push(p), (p) => events.push(p));
  c.start();
  assert.equal(new Reader774(sent[0]).varint(), OUT.custom_payload);
  assert.equal(new Reader774(sent[1]).varint(), OUT.settings);

  c.handle(packet(IN.select_known_packs).varint(1).string("minecraft").string("core").string("1.21.11").build());
  const packs = new Reader774(sent.at(-1));
  assert.equal(packs.varint(), OUT.select_known_packs);
  assert.equal(packs.varint(), 1);
  assert.equal(packs.string(), "minecraft");
  assert.equal(packs.string(), "core");
  assert.equal(packs.string(), "1.21.11");
  assert.equal(packs.remaining(), 0);

  const omitted = packet(IN.registry_data).string("minecraft:dimension_type").varint(1).string("minecraft:overworld").bool(false).build();
  c.handle(omitted);
  assert.equal(c.cachedRegistryValues, 1);
  assert.ok(c.registries.get("minecraft:dimension_type")[0].value);

  c.handle(packet(IN.custom_report_details).varint(1).string("client").string("minecraftjs").build());
  assert.deepEqual(c.customReportDetails, [{ key: "client", value: "minecraftjs" }]);
  c.handle(packet(IN.server_links).varint(1).bool(true).varint(0).string("https://example.com").build());
  assert.deepEqual(c.serverLinks, [{ hasKnownType: true, knownType: 0, link: "https://example.com" }]);
  c.handle(packet(IN.code_of_conduct).string("Be kind").build());
  assert.equal(c.codeOfConduct, "Be kind");

  c.handle(packet(IN.keep_alive).i64(123n).build());
  assert.deepEqual(sent.at(-1), C774.keepAlive(123n));
  c.handle(packet(IN.ping).i32(42).build());
  assert.deepEqual(sent.at(-1), C774.pong(42));
  c.handle(packet(IN.feature_flags).varint(1).string("minecraft:vanilla").build());
  c.handle(packet(IN.finish_configuration).build());
  assert.equal(c.complete, true);
  assert.deepEqual(c.features, ["minecraft:vanilla"]);
  assert.deepEqual(sent.at(-1), C774.finishConfiguration());
  assert.throws(() => c.handle(registry()), /finished/);
});

test("known-pack cache is target-pinned to 1.21.11 and mismatched versions fall back to full registry payloads", () => {
  assert.equal(KNOWN_PACK_774.minecraftVersion, "1.21.11");
  assert.equal(KNOWN_PACK_774.protocol, 774);
  assert.equal(KNOWN_PACK_774.serverSha1, "64bb6d763bed0a9f1d632ec347938594144943ed");
  assert.equal(KNOWN_PACK_774_SHA1, "ff6ad11590a1c34402493d0c6f3f5b3c2f6bbd3a");
  assert.equal(Object.keys(KNOWN_PACK_774.registryCounts).length, 23);
  assert.equal(Object.values(KNOWN_PACK_774.registryCounts).reduce((a, b) => a + b, 0), 371);

  const sent = [], c = new Configuration774((p) => sent.push(p));
  c.handle(packet(IN.select_known_packs).varint(1).string("minecraft").string("core").string("1.20.6").build());
  const reply = new Reader774(sent.at(-1));
  assert.equal(reply.varint(), OUT.select_known_packs);
  assert.equal(reply.varint(), 0);
  assert.equal(reply.remaining(), 0);
  assert.deepEqual(c.selectedKnownPacks, []);
  assert.throws(() => c.handle(packet(IN.registry_data).string("minecraft:dimension_type").varint(1).string("minecraft:overworld").bool(false).build()), /Omitted/);
});

test("unavailable registry payloads, duplicate keys and trailing packets fail explicitly", () => {
  const c = new Configuration774(() => {});
  assert.throws(() => c.handle(packet(IN.registry_data).string("x").varint(1).string("y").bool(false).build()), /Omitted/);
  const w = packet(IN.registry_data).string("x").varint(2);
  for (let i = 0; i < 2; i++) w.string("y").bool(true).u8(10).u8(0);
  assert.throws(() => c.handle(w.build()), /Duplicate/);
  assert.throws(() => decodeConfiguration774(packet(IN.finish_configuration).u8(1).build()), /Trailing/);
  assert.throws(() => decodeConfiguration774(new Uint8Array([127])), /Unknown/);
});

test("cookies retain bounded owned bytes and answer with the configuration cookie opcode", () => {
  const sent = [], c = new Configuration774((p) => sent.push(p)), source = packet(IN.store_cookie).string("minecraft:test").varint(2).u8(1).u8(2).build();
  c.handle(source);
  source[source.length - 1] = 9;
  c.handle(packet(IN.cookie_request).string("minecraft:test").build());
  const r = new Reader774(sent.at(-1));
  assert.equal(r.varint(), OUT.cookie_response);
  assert.equal(r.string(), "minecraft:test");
  assert.equal(r.bool(), true);
  assert.equal(r.varint(), 2);
  assert.deepEqual([...r.rest()], [1, 2]);
  assert.throws(() => C774.cookieResponse("x", new Uint8Array(5121)), /limit/);
});

test("transport reconfiguration resets ephemeral state while retaining cookies and resource-pack metadata", () => {
  const s = new VanillaSocket774({}), sent = [], play = [];
  s._send = (p) => sent.push(p);
  s._control = () => {};
  s.state = "login";
  s.on("binary", (p) => play.push(p));

  s._packet(packet(LI.success).uuid(uuid).string("Probe").varint(0).build());
  assert.equal(s.state, "configuration");
  assert.equal(new Reader774(sent[0]).varint(), LO.login_acknowledged);

  s._packet(packet(IN.store_cookie).string("minecraft:session").varint(2).u8(4).u8(2).build());
  const packId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
  s._packet(packet(IN.add_resource_pack).uuid(packId).string("https://example.com/pack.zip").string("hash").bool(false).bool(false).build());
  assert.equal(s.resourcePacks.size, 1);

  s._packet(packet(IN.code_of_conduct).string("Rules").build());
  assert.equal(new Reader774(sent.at(-1)).varint(), OUT.accept_code_of_conduct);

  s._packet(registry());
  s._packet(packet(IN.finish_configuration).build());
  assert.equal(s.state, "play");
  assert.equal(play.length, 0);

  s._packet(packet(PI.start_configuration).build());
  assert.equal(s.state, "configuration");
  assert.equal(s.configurationGeneration, 2);
  assert.equal(s.configuration.registries.size, 0);
  assert.deepEqual(s.configuration.selectedKnownPacks, []);
  assert.equal(s.configuration.cachedRegistryValues, 0);
  assert.deepEqual([...s.cookies.get("minecraft:session")], [4, 2]);
  assert.equal(s.resourcePacks.size, 1);
  assert.equal(play.length, 0);

  s._packet(packet(IN.remove_resource_pack).bool(true).uuid(packId).build());
  assert.equal(s.resourcePacks.size, 0);
  s.close();
});

test("first-play layout includes numeric dimensions, limited crafting, death location, portal cooldown, and seaLevel", () => {
  const w = packet(PI.login)
    .i32(42)
    .bool(false)
    .varint(1).string("minecraft:overworld")
    .varint(5).varint(2).varint(2)
    .bool(false).bool(true).bool(false)
    .varint(0).string("minecraft:overworld").i64(1n).i8(0).u8(255).bool(false).bool(true)
    .bool(true).string("minecraft:overworld").position(-5, -64, 12)
    .varint(0)
    .varint(63)
    .bool(false);
  const p = decodePlayPacket774(w.build());
  assert.equal(p.dimensionType, 0);
  assert.equal(p.hashedSeed, 1n);
  assert.deepEqual(p.death.location, { x: -5, y: -64, z: 12 });
  assert.equal(p.seaLevel, 63);
  assert.equal(p.enforcesSecureChat, false);
  assert.equal(new Reader774(new Uint8Array([0])).slot(), null);
  assert.deepEqual(new Writer774().slot(null).build(), new Uint8Array([0]));
});
