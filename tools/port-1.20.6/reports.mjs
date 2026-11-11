import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { ZipFile } from "../../lib/zip.js";
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
  const serverJar = join(cache, "versions", "1.20.6", "server-1.20.6.jar");
  const { stdout } = await run(
    process.env.JAVAP || "javap",
    ["-classpath", serverJar, "-c", "-p", "cpp"],
    { maxBuffer: 4 * 1024 * 1024, timeout: 30000 }
  );
  const names = [...new Set(
    [...stdout.matchAll(/\/\/ String ([a-z0-9_]+)/g)]
      .map((match) => match[1])
      .filter((name) => name !== "main")
  )];
  assert.equal(names[0], "vanilla", "Native default feature must be vanilla");
  assert.match(stdout, /getstatic\s+#\d+\s+\/\/ Field g:Lcpn;[\s\S]*?putstatic\s+#\d+\s+\/\/ Field h:Lcpn;/, "Native DEFAULT_FLAGS must reference VANILLA_SET");
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
    packMetadata: JSON.parse(jar.read("pack.mcmeta")),
    jar: {
      textures: list("assets/minecraft/textures/", ".png").length,
      guiSprites: list("assets/minecraft/textures/gui/sprites/", ".png").length,
      models: list("assets/minecraft/models/", ".json").length,
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
      unifontInclude: namedObject("minecraft/font/include/unifont.json")
    }
  };
}

export async function reports(check = false) {
  const { hashes } = await prepare();
  const generated = await generateNativeReports();
  const reportNames = ["blocks", "commands", "items", "registries"];
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
    for (const component of item.components || []) {
      assert.ok(componentRegistry[component.type], itemName + " uses unknown component " + component.type);
      assert.ok(!seen.has(component.type), itemName + " duplicates default component " + component.type);
      seen.add(component.type);
      componentUsage[component.type]++;
      defaultComponentEntries++;
    }
  }
  assertContiguousIds("minecraft:data_component_type", componentRegistry);

  const schema1204 = JSON.parse(await readFile(join(cache, "protocol-1.20.4.json")));
  const schema1206 = JSON.parse(await readFile(join(cache, "protocol-1.20.6.json")));
  const jar = new ZipFile(join(cache, "client.jar"));
  const assetIndex = JSON.parse(await readFile(join(cache, "asset-index.json")));

  const summary = {
    minecraftVersion: target.minecraftVersion,
    protocol: target.protocol,
    dataVersion: target.dataVersion,
    resourcePackFormat: target.resourcePackFormat,
    dataPackFormat: target.dataPackFormat,
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
      "1.20.4": protocolCounts(schema1204),
      "1.20.6": protocolCounts(schema1206)
    },
    resources: resourceInventory(jar, assetIndex)
  };

  if (check) {
    assert.deepEqual(summary, JSON.parse(await readFile(baselineUrl, "utf8")), "Regenerated native 1.20.6 baseline differs");
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
