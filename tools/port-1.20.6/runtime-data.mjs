import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { initBlocks, getStateProperties } from "../../client/js/world/blocks.js";
import {nativeBiomeData} from './biome-data.mjs';
import { prepare, cache, target } from "./prepare.mjs";

const run = promisify(execFile);
const revision = target.minecraftData.revision;
const base = "https://raw.githubusercontent.com/PrismarineJS/minecraft-data/" + revision + "/data/";
const output = join(cache, "runtime-data");

async function get(path) {
  const file = join(cache, "upstream", path);
  let data;
  try {
    data = await readFile(file);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    const result = await run(
      "curl",
      ["--fail", "--silent", "--show-error", "--location", "--retry", "3", base + path],
      { encoding: "buffer", maxBuffer: 32 * 1024 * 1024 }
    );
    data = result.stdout;
    await mkdir(join(file, ".."), { recursive: true });
    await writeFile(file, data);
  }
  return {
    data: JSON.parse(data),
    sha1: createHash("sha1").update(data).digest("hex")
  };
}

await prepare();
await mkdir(output, { recursive: true });

const dataPaths = (await get("dataPaths.json")).data.pc[target.minecraftVersion];
if (!dataPaths) throw new Error("Missing minecraft-data paths for " + target.minecraftVersion);

const sources = {};
const tables = {};
const names = [
  "blocks",
  "items",
  "entities",
  "blockCollisionShapes",
  "biomes",
  "foods",
  "effects",
  "enchantments",
  "windows",
  "particles",
  "materials",
  "recipes",
  "sounds"
];

for (const name of names) {
  const path = dataPaths[name] + "/" + name + ".json";
  const input = await get(path);
  tables[name] = input.data;
  sources[name] = { path, sha1: input.sha1 };
}

tables.biomes=nativeBiomeData(tables.biomes);

const reports = JSON.parse(await readFile(join(cache, "generated", "reports", "registries.json")));
const blocks = JSON.parse(await readFile(join(cache, "generated", "reports", "blocks.json")));

const nativeSound = reports["minecraft:sound_event"].entries;
const oldSounds = new Map(tables.sounds.map((entry) => [entry.name, entry]));
tables.sounds = Object.entries(nativeSound)
  .map(([name, entry]) => ({
    ...oldSounds.get(name.replace(/^minecraft:/, "")),
    id: entry.protocol_id,
    name: name.replace(/^minecraft:/, "")
  }))
  .sort((a, b) => a.id - b.id);

for (const [file, registry] of [
  ["blocks", "block"],
  ["items", "item"],
  ["entities", "entity_type"],
  ["sounds", "sound_event"]
]) {
  for (const entry of tables[file]) {
    const native = reports["minecraft:" + registry].entries["minecraft:" + entry.name];
    if (native?.protocol_id !== entry.id) {
      throw new Error("Native registry mismatch " + file + " " + entry.name);
    }
  }
}

for (const block of tables.blocks) {
  const states = blocks["minecraft:" + block.name]?.states;
  if (!states ||
      states[0].id !== block.minStateId ||
      states.at(-1).id !== block.maxStateId ||
      states.find((state) => state.default)?.id !== block.defaultState) {
    throw new Error("Native states mismatch " + block.name);
  }
}

initBlocks(tables.blocks, null);
for (const [name, block] of Object.entries(blocks)) {
  for (const state of block.states) {
    const actual = getStateProperties(state.id);
    const expected = state.properties || {};
    if (JSON.stringify(Object.entries(actual).sort()) !== JSON.stringify(Object.entries(expected).sort())) {
      throw new Error("Property mismatch " + name + " " + state.id);
    }
  }
}

for (const [name, data] of Object.entries(tables)) {
  await writeFile(join(output, name + ".json"), JSON.stringify(data) + "\n");
}

//// Particle definitions are loaded directly from the target client asset pack at runtime.
await writeFile(join(output, "particleSprites.json"), "{}\n");

// The native Creative population is required by the GUI and includes target
// component patches. Regenerating startup tables must never restore empty tabs.
const {creativeData}=await import('./creative-data.mjs');
await creativeData();

//// Dynamic command registries arrive during Configuration in 1.20.6. Keep only
//// registries that are static in the target report here; runtime completion can
//// merge Configuration-owned registries later in P11.
const commandRegistries = {};
for (const name of ["minecraft:attribute", "minecraft:point_of_interest_type"]) {
  const registry = reports[name];
  if (registry) commandRegistries[name] = Object.keys(registry.entries).sort();
}
await writeFile(join(output, "commandRegistries.json"), JSON.stringify(commandRegistries) + "\n");

const manifest = {
  version: target.minecraftVersion,
  protocol: target.protocol,
  clientJarSha1: target.downloads.client.sha1,
  serverJarSha1: target.downloads.server.sha1,
  minecraftDataRevision: revision,
  sources,
  counts: {
    blocks: tables.blocks.length,
    blockStates: Object.values(blocks).reduce((total, block) => total + block.states.length, 0),
    items: tables.items.length,
    entities: tables.entities.length,
    biomes: tables.biomes.length,
    sounds: tables.sounds.length
  }
};
await writeFile(join(output, "runtime-source-1.20.6.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(JSON.stringify(manifest, null, 2));
