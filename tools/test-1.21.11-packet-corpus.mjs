import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decodePlayPacket774, decodePlayBody774 } from "../client/js/net/play-codec-1.21.11.js";
import { Reader774, Writer774 } from "../client/js/net/configuration-1.21.11.js";
import { readComponentData774, writeComponentData774 } from "../client/js/net/item-components-1.21.11.js";
import { PLAY_SCHEMA_774 } from "../client/js/net/play-schema-1.21.11.js";
import { PLAY_CLIENTBOUND_774, PLAY_SERVERBOUND_774 } from "../client/js/net/protocol-1.21.11-ids.js";
import { KNOWN_PACK_774 } from "../client/js/net/known-pack-1.21.11.js";
import { C } from "../client/js/net/packets.js";
import { builderSamples } from "./port-1.21.11/packet-builder-samples.mjs";
import { Game } from "../client/js/game/game.js";
import { ChunkBatchCalculator } from "../client/js/net/chunk-batch.js";
import { VanillaSocket774 } from "../client/js/net/tcp-1.21.11.js";
import { setPlatform } from "../client/js/platform/platform.js";

const json = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const corpus = json("./fixtures/play-packets-1.21.11.json");
const context = {
  features: ["minecraft:vanilla"],
  registries: new Map(
    Object.entries(KNOWN_PACK_774.registries).map(([k, v]) => [k, v.map((e, id) => ({ ...e, id }))])
  )
};
const bytes = (s) => Buffer.from(s.wire, "base64");
const decode = (s) => decodePlayPacket774(bytes(s), context);

const EXPECTED_NON_GAME_CB = new Set([
  // transport
  "bundle_delimiter",
  "cookie_request",
  "start_configuration",
  "store_cookie",
  "transfer",
  // optional/unhandled 1.21.11 debug, test, dialog, server_links, waypoint, minecart packets
  "clear_dialog",
  "custom_report_details",
  "debug_block_value",
  "debug_chunk_value",
  "debug_entity_value",
  "debug_event",
  "game_test_highlight_pos",
  "move_minecart",
  "server_links",
  "show_dialog",
  "test_instance_block_status",
  "tracked_waypoint"
]);

test("every incoming Play ID consumes native Java canonical fixtures, including reachable branches", () => {
  assert.equal(corpus.minecraftVersion, "1.21.11");
  assert.equal(corpus.protocol, 774);
  assert.equal(corpus.clientJarSha1, "ba2df812c2d12e0219c489c4cd9a5e1f0760f5bd");
  assert.equal(PLAY_SCHEMA_774.packets.length, 139);
  const incoming = corpus.samples.filter((s) => s.direction === "CLIENTBOUND");
  assert.deepEqual(new Set(incoming.map((s) => s.name)), new Set(PLAY_SCHEMA_774.packets));

  const seenNormalizedWithoutHandler = new Set();
  for (const s of incoming) {
    const decoded = decode(s);
    assert.equal(decoded.name, s.normalizedName, s.label);
    if (typeof Game.prototype["on_" + decoded.name] !== "function") {
      seenNormalizedWithoutHandler.add(decoded.name);
    }
  }
  assert.deepEqual(seenNormalizedWithoutHandler, EXPECTED_NON_GAME_CB);
});

test("actual runtime senders cover 64 outgoing IDs and equal native decode/re-encode bytes", () => {
  const actual = builderSamples();
  const native = new Map(corpus.samples.map((s) => [s.label, s]));
  const allServerbound = Object.keys(PLAY_SERVERBOUND_774);
  assert.equal(allServerbound.length, 66);
  const builtNames = new Set(actual.map((s) => s.name));
  assert.deepEqual(
    allServerbound.filter((name) => !builtNames.has(name)),
    ["set_test_block", "test_instance_block_action"]
  );
  for (const s of actual) {
    assert.equal(s.wire, native.get(s.label)?.wire, s.label);
  }
  assert.deepEqual(
    C.debugSubscriptionRequest([1, 2]),
    new Writer774().varint(PLAY_SERVERBOUND_774.debug_subscription_request).varint(2).varint(1).varint(2).build()
  );
});

test("all advancement flags and player-info action masks preserve semantic fields", () => {
  for (let mask = 0; mask < 8; mask++) {
    const p = decode(corpus.samples.find((s) => s.label === "CLIENTBOUND:advancements:flags-" + mask));
    const display = p.added[0].display;
    assert.equal(display.hidden, !!(mask & 4));
    assert.equal(display.showToast, !!(mask & 2));
    assert.equal(display.background, mask & 1 ? "minecraft:fixture" : undefined);
  }
  for (const mask of [...Array(64).keys(), 64, 128, 255]) {
    const p = decode(corpus.samples.find((s) => s.label === "CLIENTBOUND:player_info:actions-" + mask));
    assert.equal(p.actions, mask);
    assert.equal(p.data[0].name, mask & 1 ? "Fixture" : undefined);
    assert.equal(p.data[0].listed, mask & 8 ? true : undefined);
    if (mask & 64) assert.equal(typeof p.data[0].listPriority, "number");
    else assert.equal(p.data[0].listPriority, undefined);
    if (mask & 128) assert.equal(typeof p.data[0].showHat, "boolean");
    else assert.equal(p.data[0].showHat, undefined);
  }
});

test("fixed-length signed chat buffers leave message body and following fields intact", () => {
  const p = decode(corpus.samples.find((s) => s.label === "CLIENTBOUND:player_chat:dense"));
  assert.equal(p.signature.length, 256);
  assert.equal(p.plainMessage, "minecraft:fixture");
  assert.equal(p.timestamp, 23n);
  assert.equal(p.salt, 23n);
  assert.ok(p.networkName.includes("Packet fixture"));
});

test("native registry-backed entity metadata preserves zero IDs and GlobalPos coordinates", () => {
  for (const type of [21, 22, 23, 24, 25, 26, 27, 28]) {
    for (const id of [0, 1, 2]) {
      const w = new Writer774().varint(7).u8(12).varint(type).varint(id).u8(255);
      assert.equal(decodePlayBody774("entity_metadata", w.build()).metadata[12], id);
    }
  }
  for (const id of [0, 1, 2]) {
    const w = new Writer774().varint(7).u8(12).varint(30).varint(id + 1).u8(255);
    assert.deepEqual(decodePlayBody774("entity_metadata", w.build()).metadata[12], { variantId: id });
  }
  const w = new Writer774()
    .varint(7).u8(12).varint(29)
    .bool(true).string("minecraft:the_nether").position(-123, -63, 4321)
    .u8(255);
  assert.deepEqual(decodePlayBody774("entity_metadata", w.build()).metadata[12], {
    dimensionName: "minecraft:the_nether",
    location: { x: -123, y: -63, z: 4321 }
  });
});

test("1.21.11 creative slot builders and food/consumable/instrument components use exact 774 layouts", () => {
  const fullSlot = corpus.samples.find((s) => s.label.startsWith("BUILDER:set_creative_slot:C.creativeSlot:") && s.label.endsWith(":39"));
  const r1 = new Reader774(bytes(fullSlot));
  assert.equal(r1.varint(), PLAY_SERVERBOUND_774.set_creative_slot);
  assert.equal(r1.i16(), 36);
  const stone = r1.slot();
  assert.equal(stone.itemKey, "minecraft:stone");
  assert.equal(stone.count, 12);
  assert.equal(r1.remaining(), 0);

  const emptySlot = corpus.samples.find((s) => s.label.startsWith("BUILDER:set_creative_slot:C.creativeSlot:") && s.label.endsWith(":40"));
  const r2 = new Reader774(bytes(emptySlot));
  assert.equal(r2.varint(), PLAY_SERVERBOUND_774.set_creative_slot);
  assert.equal(r2.i16(), -1);
  assert.equal(r2.slot(), null);
  assert.equal(r2.remaining(), 0);

  const foodWriter = new Writer774();
  writeComponentData774(foodWriter, "food", { nutrition: 4, saturationModifier: 0.75, canAlwaysEat: true });
  const food = readComponentData774(new Reader774(foodWriter.build()), "food");
  assert.equal(food.nutrition, 4);
  assert.equal(food.canAlwaysEat, true);
  assert.ok(!Object.hasOwn(food, "effects"));

  const consumeWriter = new Writer774();
  writeComponentData774(consumeWriter, "consumable", {
    consume_seconds: 0.75,
    animation: "eat",
    sound: { soundId: 1 },
    makes_particles: true,
    effects: [{
      type: "apply_effects",
      effects: [{ id: 1, details: { amplifier: 0, duration: 80, ambient: false, showParticles: true, showIcon: true, hiddenEffect: null } }],
      probability: 1
    }]
  });
  const consumable = readComponentData774(new Reader774(consumeWriter.build()), "consumable");
  assert.equal(consumable.consume_seconds, 0.75);
  assert.equal(consumable.effects[0].effects[0].details.duration, 80);

  const hornWriter = new Writer774();
  writeComponentData774(hornWriter, "instrument", {
    hasHolder: true,
    data: { data: { soundEvent: { soundId: 1 }, useDuration: 17, range: 64, description: { t: 8, v: "Horn" } } }
  });
  const horn = readComponentData774(new Reader774(hornWriter.build()), "instrument");
  assert.equal(horn.hasHolder, true);
  assert.equal(horn.data.data.useDuration, 17);
  assert.equal(horn.data.data.range, 64);
  assert.equal(horn.data.data.description.v, "Horn");
});

test("chunk-batch feedback uses the native clamped, capped weighted average rather than batch count", () => {
  let t = 0;
  const calc = new ChunkBatchCalculator(() => t);
  assert.equal(calc.finish(0), 3.5);
  calc.start();
  t = 40;
  assert.equal(calc.finish(10), Math.fround(7 / 3));
  calc.start();
  assert.equal(calc.finish(10), 3);
  for (let i = 0; i < 100; i++) {
    calc.start();
    t += 10;
    calc.finish(1);
  }
  assert.equal(calc.weight, 49);

  let time = 0;
  setPlatform({ now: () => time });
  const sent = [], g = Object.assign(Object.create(Game.prototype), { send: (p) => sent.push(p) });
  g.on_chunk_batch_start();
  time = 40;
  g.on_chunk_batch_finished({ batchSize: 10 });
  const r = new Reader774(sent[0]);
  assert.equal(r.varint(), PLAY_SERVERBOUND_774.chunk_batch_received);
  assert.equal(r.f32(), Math.fround(7 / 3));
  assert.equal(r.remaining(), 0);
});

test("standalone transport uses the same batch calculator and graphical transport avoids duplicate acknowledgements", () => {
  for (const autoPlayAcks of [true, false]) {
    const s = new VanillaSocket774({}, { autoPlayAcks }), sent = [];
    let starts = 0, finishes = 0;
    s.state = "play";
    s._send = (p) => sent.push(p);
    s.chunkBatch = {
      start() { starts++; },
      finish(n) { assert.equal(n, 17); finishes++; return 2.75; }
    };
    s._packet(new Writer774().varint(PLAY_CLIENTBOUND_774.chunk_batch_start).build());
    s._packet(new Writer774().varint(PLAY_CLIENTBOUND_774.chunk_batch_finished).varint(17).build());
    assert.equal(starts, Number(autoPlayAcks));
    assert.equal(finishes, Number(autoPlayAcks));
    assert.equal(sent.length, Number(autoPlayAcks));
    if (autoPlayAcks) {
      const r = new Reader774(sent[0]);
      r.varint();
      assert.equal(r.f32(), 2.75);
    }
  }
});

test("projectile power handles decoded 1.21.11 accelerationPower packets, and diagnostic samples remain bounded", () => {
  const e = { entityName: "small_fireball", accelX: 0.1, accelY: -0.2, accelZ: 0.4 };
  const other = { entityName: "arrow" };
  const wind = { entityName: "wind_charge", accelX: 0.3, accelY: -0.4, accelZ: 0 };
  const map = new Map([[7, e], [8, other], [10, wind]]);
  const g = Object.assign(Object.create(Game.prototype), { entities: { get: (id) => map.get(id) } });

  for (const id of [7, 8, 9, 10]) {
    const wire = new Writer774().varint(PLAY_CLIENTBOUND_774.set_projectile_power).varint(id).f64(0.25).build();
    const decoded = decodePlayPacket774(wire);
    g.on_set_projectile_power(decoded);
  }
  assert.equal(e.accelerationPower, 0.25);
  assert.equal(wind.accelerationPower, 0.25);
  assert.ok(Math.abs(wind.accelX - 0.15) < 1e-12);
  assert.ok(Math.abs(wind.accelY + 0.2) < 1e-12);
  assert.equal(other.accelX, undefined);
  assert.equal(other.accelerationPower, undefined);

  let now = 1000;
  setPlatform({ now: () => now });
  for (let i = 0; i < 250; i++) {
    g.on_ping_response({ id: 900n });
    g.on_debug_sample({ type: 0, sample: [123n, 23n] });
  }
  assert.equal(g.pingSamples.length, 240);
  assert.equal(g.pingSamples[0], 100);
  assert.equal(g.serverTickSamples.length, 240);
  const sample = [44n];
  g.on_debug_sample({ type: 0, sample });
  sample[0] = 0n;
  assert.deepEqual(g.serverTickSamples.at(-1), [44n]);
});
