// Every on_<packet>(p) handler for the 774 play schema reads only fields the schema or the codec actually produce,
// so a renamed or differently cased wire field (tick_rate, cooldownGroup, recipeDisplay, ...) cannot silently read undefined.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PLAY_SCHEMA_774 as S } from "../client/js/net/play-schema-1.21.11.js";
import { decodePlayBody774 } from "../client/js/net/play-codec-1.21.11.js";
import { Writer774 } from "../client/js/net/configuration-1.21.11.js";
import { Game } from "../client/js/game/game.js";

const read = (p) => readFileSync(new URL("../client/js/" + p, import.meta.url), "utf8");
const game = read("game/game.js"), codec = read("net/play-codec-1.21.11.js");
const types = S.types || S;

function names(t, out = new Set(), depth = 0) {
  if (depth > 8 || !t) return out;
  if (Array.isArray(t)) {
    if (t[0] === "container") {
      for (const f of t[1]) {
        if (f.name) out.add(f.name);
        names(f.type, out, depth + 1);
      }
    } else {
      for (const x of t.slice(1)) names(x, out, depth + 1);
    }
  } else if (typeof t === "object") {
    for (const v of Object.values(t)) names(v, out, depth + 1);
  } else if (typeof t === "string" && types[t] && depth < 6) {
    names(types[t], out, depth + 1);
  }
  return out;
}

function body(src, start) {
  let i = src.indexOf("{", start), d = 0, j = i;
  for (; j < src.length; j++) {
    if (src[j] === "{") d++;
    else if (src[j] === "}") { d--; if (!d) break; }
  }
  return src.slice(i, j + 1);
}

// Reads verified against the codec's normalizers/helpers (normalizeWorld, etc.)
// or explicitly guarded legacy fallback reads when 1.21.11 fields are primary.
const VERIFIED = {
  spawn_entity: ["entityTypeName"],
  explosion: ["nativeExplosion", "records"],
  open_window: ["slotCount", "entityId", "horseColumns"],
  position: ["dismountVehicle"],
  multi_block_change: ["chunkX", "chunkZ"],
  server_data: ["enforcesSecureChat"],
  entity_sound_effect: ["soundId"],
  sound_effect: ["soundId"],
  login: [
    "enabledFeatures", "commandTags", "registryTags", "biomeRegistrySize", "dimensionCodec",
    "blockStateRegistrySize", "airStates", "previousGameMode", "gameMode", "worldName",
    "dimensionData", "biomeEntries", "difficulty", "levelType"
  ],
  respawn: [
    "dimensionData", "worldType", "worldName", "biomeRegistrySize", "blockStateRegistrySize",
    "airStates", "biomeEntries", "dimensionCodec", "difficulty", "previousGameMode", "gameMode"
  ],
  set_cooldown: ["itemID", "itemId"],
  craft_recipe_response: ["recipe"],
  set_ticking_state: ["tickRate", "isFrozen"],
  step_tick: ["tickSteps"]
};

test("play handlers read fields the 774 schema or codec provide", () => {
  const problems = [];
  for (const pk of S.packets) {
    const t = types["packet_" + pk];
    if (!t) continue;
    const fields = names(t);
    const ci = codec.search(new RegExp(`name === ["']${pk}["']`));
    let keys = new Set(), handler = pk;
    if (ci >= 0) {
      const line = codec.slice(ci, codec.indexOf("\n", ci));
      const blk = line.includes("{") && !line.includes("return {") ? body(codec, ci) : line;
      for (const m of blk.matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*:/g)) keys.add(m[1]);
      const nm = /name:\s*["']([a-z_]+)["']/.exec(blk);
      if (nm) handler = nm[1];
    }
    const gi = game.search(new RegExp(`\\n  on_${handler}\\(p\\)\\s*\\{`));
    if (gi < 0) continue;
    const used = new Set([...body(game, gi).matchAll(/\bp\.([A-Za-z_][A-Za-z0-9_]*)/g)].map((m) => m[1]));
    const miss = [...used].filter(
      (u) => !fields.has(u) && !keys.has(u) && !["name", "data", "length"].includes(u) && !(VERIFIED[pk] || []).includes(u)
    );
    if (miss.length) problems.push(pk + ": " + miss.join(", "));
  }
  assert.deepEqual(problems, []);
});

test("protocol 774 renamed fields (tick_rate, cooldownGroup, recipeDisplay, spawn_position yaw, explosion particle) are wired", () => {
  assert.match(game, /p\.tick_rate/);
  assert.match(game, /p\.is_frozen/);
  assert.match(game, /p\.tick_steps/);
  assert.match(game, /p\.cooldownGroup/);
  assert.match(game, /p\.recipeDisplay/);

  const spawn = decodePlayBody774(
    "spawn_position",
    new Writer774().string("minecraft:overworld").position(10, 70, -12).f32(135.5).f32(-12.5).build()
  );
  const g = Object.assign(Object.create(Game.prototype), {
    spawnPos: null,
    spawnAngle: 0,
    sound: { play: () => {} },
    world: { setState: () => {} },
    player: { motionX: 0, motionY: 0, motionZ: 0 },
    particles: {
      calls: [],
      onPacket(pkt) { this.calls.push(pkt); }
    },
    assets: { soundNames: [] }
  });
  g.on_spawn_position(spawn);
  assert.deepEqual(g.spawnPos, { x: 10, y: 70, z: -12 });
  assert.equal(g.spawnAngle, 135.5);

  const explosion = decodePlayBody774(
    "explosion",
    new Writer774()
      .f64(4.5).f64(64).f64(-2.5)
      .f32(3.0)
      .i32(0)
      .bool(true).f64(0.25).f64(0.5).f64(-0.125)
      .varint(23) // particle id (explosion)
      .varint(0).string("minecraft:entity.generic.explode").bool(false) // sound inline
      .varint(0) // blockParticles empty
      .build()
  );
  g.on_explosion(explosion);
  assert.equal(g.particles.calls.length, 1);
  assert.equal(g.particles.calls[0].particleId, 23);
});
