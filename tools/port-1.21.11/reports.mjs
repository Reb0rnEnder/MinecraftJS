import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { ZipFile } from "../../lib/zip.js";
import classfile from "../../lib/classfile.js";
const { parseClass } = classfile;
import { prepare, cache, target } from "./prepare.mjs";
import { canonicalReport } from "./canonical-report.mjs";

const run = promisify(execFile);
const baselineUrl = new URL("./baseline.json", import.meta.url);
const sha1 = (bytes) => createHash("sha1").update(bytes).digest("hex");

function assertContiguousIds(label, entries) {
  const ids = Object.values(entries)
    .map((entry) => entry.protocol_id)
    .filter((id) => Number.isInteger(id))
    .sort((a, b) => a - b);
  assert.ok(ids.length, label + " has no protocol IDs");
  assert.ok(ids.every((id, index) => id === index), label + " protocol IDs must be contiguous from zero");
}

function protocolCounts(schema) {
  const phase = (name) => {
    const value = schema[name];
    if (!value) return null;
    const count = (direction) => Object.keys(value[direction].types.packet[1][0].type[1].mappings).length;
    return { toClient: count("toClient"), toServer: count("toServer") };
  };
  return {
    handshaking: phase("handshaking"),
    status: phase("status"),
    login: phase("login"),
    configuration: phase("configuration"),
    play: phase("play")
  };
}

async function generateNativeReports() {
  const generated = join(cache, "generated");
  await rm(generated, { recursive: true, force: true });
  const result = await run(
    process.env.JAVA || "java",
    [
      "-DbundlerMainClass=net.minecraft.data.Main",
      "-jar",
      join(cache, "server.jar"),
      "--reports",
      "--output",
      generated
    ],
    {
      cwd: cache,
      maxBuffer: 16 * 1024 * 1024,
      timeout: 60000
    }
  );
  await writeFile(join(cache, "data-generator.log"), result.stdout + result.stderr);
  return generated;
}

async function featureFlags() {
  const mappings = await readFile(join(cache, "server.txt"), "utf8");
  const match = /^net\.minecraft\.world\.flag\.FeatureFlags -> ([^\s:]+):$/m.exec(mappings);
  assert.ok(match, "Missing FeatureFlags mapping in server.txt");
  const obf = match[1];
  const serverZip = new ZipFile(join(cache, "bundler", "META-INF", "versions", "1.21.11", "server-1.21.11.jar"));
  const cls = parseClass(serverZip.read(obf + ".class"));
  const strings = [];
  for (let i = 1; i < cls.cp.length; i++) {
    const entry = cls.cp[i];
    if (entry?.tag === 8) {
      const value = cls.cp[entry.ref]?.value;
      if (typeof value === "string") strings.push(value);
    }
  }
  const names = [...new Set(strings.filter((s) => /^[a-z0-9_]+$/.test(s) && s !== "main"))];
  assert.equal(names[0], "vanilla", "Native default feature must be vanilla");
  return {
    registered: names.map((name) => "minecraft:" + name),
    defaults: ["minecraft:vanilla"],
    experimental: names.slice(1).map((name) => "minecraft:" + name)
  };
}

function resourceInventory(jar, assetIndex) {
  const list = (prefix, suffix = null) => jar.list(prefix).filter((name) => !suffix || name.endsWith(suffix));
  const fileHashes = (prefix) => list(prefix, ".json")
    .sort()
    .map((name) => ({ name, sha1: sha1(jar.read(name)) }));
  const objects = Object.entries(assetIndex.objects);
  const external = (prefix) => objects.filter(([name]) => name.startsWith(prefix));
  const namedObject = (name) => {
    const value = assetIndex.objects[name];
    assert.ok(value, "Missing asset-index object " + name);
    return { name, hash: value.hash, size: value.size };
  };
  return {
    versionJson: JSON.parse(jar.read("version.json")),
    packMcmetaObject: namedObject("pack.mcmeta"),
    jar: {
      textures: list("assets/minecraft/textures/", ".png").length,
      guiSprites: list("assets/minecraft/textures/gui/sprites/", ".png").length,
      models: list("assets/minecraft/models/", ".json").length,
      items: list("assets/minecraft/items/", ".json").length,
      equipment: list("assets/minecraft/equipment/", ".json").length,
      blockstates: list("assets/minecraft/blockstates/", ".json").length,
      languages: list("assets/minecraft/lang/", ".json").length,
      atlasDefinitions: fileHashes("assets/minecraft/atlases/"),
      fontDefinitions: fileHashes("assets/minecraft/font/")
    },
    assetIndex: {
      id: target.assetIndex.id,
      sha1: target.assetIndex.sha1,
      objects: objects.length,
      languages: external("minecraft/lang/").length,
      sounds: external("minecraft/sounds/").length,
      fonts: external("minecraft/font/").length,
      unifont: namedObject("minecraft/font/unifont.zip"),
      unifontJapanese: namedObject("minecraft/font/unifont_jp.zip"),
      unifontPua: namedObject("minecraft/font/unifont_pua.zip"),
      unifontInclude: namedObject("minecraft/font/include/unifont.json"),
      unifontPuaInclude: namedObject("minecraft/font/include/unifont_pua.json")
    }
  };
}

export async function reports(check = false) {
  const { hashes } = await prepare();
  const generated = check
    ? join(cache, "generated")
    : await generateNativeReports();
  const reportNames = ["blocks", "commands", "items", "registries", "packets"];
  const report = {};
  for (const name of reportNames) {
    const bytes = await readFile(join(generated, "reports", name + ".json"));
    report[name] = JSON.parse(bytes);
    hashes["report_" + name] = sha1(Buffer.from(canonicalReport(name, report[name])));
  }

  const blockStateIds = [];
  for (const [name, block] of Object.entries(report.blocks)) {
    assert.equal(block.states.filter((state) => state.default).length, 1, name + " must have one default state");
    for (const state of block.states) blockStateIds.push(state.id);
  }
  blockStateIds.sort((a, b) => a - b);
  assert.ok(blockStateIds.every((id, index) => id === index), "Block-state IDs must be contiguous from zero");

  for (const [name, registry] of Object.entries(report.registries)) {
    assertContiguousIds(name, registry.entries);
  }

  const itemRegistry = report.registries["minecraft:item"].entries;
  const componentRegistry = report.registries["minecraft:data_component_type"].entries;
  assert.equal(Object.keys(itemRegistry).length, Object.keys(report.items).length, "Item report and registry must have the same size");

  let defaultComponentEntries = 0;
  const componentUsage = Object.fromEntries(Object.keys(componentRegistry).map((name) => [name, 0]));
  for (const [itemName, item] of Object.entries(report.items)) {
    assert.ok(itemRegistry[itemName], "Item report contains unknown item " + itemName);
    const seen = new Set();
    const list = Array.isArray(item.components)
      ? item.components.map((c) => c.type)
      : Object.keys(item.components || {});
    for (const type of list) {
      assert.ok(componentRegistry[type], itemName + " uses unknown component " + type);
      assert.ok(!seen.has(type), itemName + " duplicates default component " + type);
      seen.add(type);
      componentUsage[type]++;
      defaultComponentEntries++;
    }
  }
  assertContiguousIds("minecraft:data_component_type", componentRegistry);

  const schema1206 = JSON.parse(await readFile(join(cache, "upstream/1.20.6-protocol.json")));
  const schema12111 = JSON.parse(await readFile(join(cache, "upstream/protocol.json")));
  const jar = new ZipFile(join(cache, "client.jar"));
  const assetIndex = JSON.parse(await readFile(join(cache, "asset-index.json")));

  const summary = {
    minecraftVersion: target.minecraftVersion,
    protocol: target.protocol,
    dataVersion: target.dataVersion,
    resourcePackFormat: target.resourcePackFormat,
    resourcePackMinorFormat: target.resourcePackMinorFormat,
    dataPackFormat: target.dataPackFormat,
    dataPackMinorFormat: target.dataPackMinorFormat,
    javaVersion: target.javaVersion,
    sources: {
      ...hashes,
      assetIndex: target.assetIndex.sha1,
      minecraftDataRevision: target.minecraftData.revision
    },
    blocks: Object.keys(report.blocks).length,
    blockStates: blockStateIds.length,
    lastBlockState: blockStateIds.at(-1),
    items: Object.keys(report.items).length,
    defaultComponentEntries,
    componentTypes: Object.fromEntries(
      Object.entries(componentRegistry)
        .sort((a, b) => a[1].protocol_id - b[1].protocol_id)
        .map(([name, entry]) => [name, entry.protocol_id])
    ),
    componentUsage,
    registries: Object.fromEntries(
      Object.entries(report.registries)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, registry]) => [name, Object.keys(registry.entries).length])
    ),
    commands: Object.keys(report.commands.children || {}).sort(),
    featureFlags: await featureFlags(),
    protocolCounts: {
      "1.20.6": protocolCounts(schema1206),
      "1.21.11": protocolCounts(schema12111)
    },
    resources: resourceInventory(jar, assetIndex)
  };

  if (check) {
    assert.deepEqual(summary, JSON.parse(await readFile(baselineUrl, "utf8")), "Regenerated native 1.21.11 baseline differs");
  } else {
    await writeFile(baselineUrl, JSON.stringify(summary, null, 2) + "\n");
  }

  console.log(
    (check ? "Verified" : "Recorded") +
    " " + summary.blocks + " blocks / " + summary.blockStates + " states, " +
    summary.items + " items / " + Object.keys(summary.componentTypes).length + " component types, " +
    Object.keys(summary.registries).length + " registries"
  );
  return summary;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await reports(process.argv.includes("--check"));
}
