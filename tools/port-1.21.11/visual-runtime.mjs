import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { delimiter, join } from "node:path";
import { nativeClasspath } from "../../lib/native-classpath.js";
import { cache, root, target } from "./prepare.mjs";

const output = join(cache, "runtime-data");
const client = join(cache, "client.jar");
const unsigned = join(cache, "client-unsigned.jar");
const expected = target.downloads.client.sha1;
assert.equal(createHash("sha1").update(await readFile(client)).digest("hex"), expected);

if (!existsSync(unsigned)) {
  throw new Error("Missing " + unsigned + "; create unsigned client.jar omitting META-INF/*.{SF,RSA,DSA,EC}");
}

await mkdir(output, { recursive: true });
const blocksPath = existsSync(join(output, "blocks.json"))
  ? join(output, "blocks.json")
  : join(cache, "upstream", "blocks.json");
const shapesPath = existsSync(join(output, "blockCollisionShapes.json"))
  ? join(output, "blockCollisionShapes.json")
  : join(cache, "upstream", "blockCollisionShapes.json");

const definitions = JSON.parse(await readFile(blocksPath));
const stateCount = Math.max(...definitions.map((b) => b.maxStateId)) + 1;

const parts = nativeClasspath(cache).split(delimiter);
parts[0] = unsigned;
const classpath = parts.join(delimiter);
const nativeOut = join(cache, "visual-runtime-1.21.11.json");

execFileSync(
  process.env.JAVA || "java",
  [
    "-cp",
    classpath,
    join(root, "tools", "port-1.21.11", "ExtractVisualRuntime12111.java"),
    nativeOut,
    join(cache, "client.txt"),
    String(stateCount)
  ],
  { cwd: cache, stdio: "inherit", maxBuffer: 64 * 1024 * 1024 }
);

const native = JSON.parse(await readFile(nativeOut));
if (native.errors.length) throw new Error(native.errors.slice(0, 20).join("\n"));
assert.equal(native.rendering.length, stateCount);
assert.equal(native.selections.length, stateCount);
assert.equal(native.collisions.length, stateCount);

const sourceShapes = JSON.parse(await readFile(shapesPath));
const collisionShapes = { 0: [] };
const collisionKeys = new Map([["[]", 0]]);
const collisionBlocks = {};

for (const block of definitions) {
  const ids = [];
  for (let state = block.minStateId; state <= block.maxStateId; state++) {
    const boxes = native.collisions[state];
    const key = JSON.stringify(boxes);
    if (!collisionKeys.has(key)) {
      const id = collisionKeys.size;
      collisionKeys.set(key, id);
      collisionShapes[id] = boxes;
    }
    ids.push(collisionKeys.get(key));
  }
  collisionBlocks[block.name] = ids.every((id) => id === ids[0]) ? ids[0] : ids;
}

const renderValues = [];
const renderKeys = new Map();
const renderStates = [];
for (const render of native.rendering) {
  const key = JSON.stringify(render);
  if (!renderKeys.has(key)) {
    renderKeys.set(key, renderValues.length);
    renderValues.push(render);
  }
  renderStates.push(renderKeys.get(key));
}

const boxes = [null];
const selectionKeys = new Map([["null", 0]]);
const selectionStates = [];
for (const shape of native.selections) {
  const key = JSON.stringify(shape);
  if (!selectionKeys.has(key)) {
    selectionKeys.set(key, boxes.length);
    boxes.push(shape);
  }
  selectionStates.push(selectionKeys.get(key));
}

sourceShapes.blocks = collisionBlocks;
sourceShapes.shapes = collisionShapes;
sourceShapes.render = {
  source: { version: target.minecraftVersion, clientJarSha1: expected },
  values: renderValues,
  states: renderStates
};
sourceShapes.selection = {
  source: { version: target.minecraftVersion, clientJarSha1: expected },
  boxes,
  states: selectionStates
};

await writeFile(join(output, "blockCollisionShapes.json"), JSON.stringify(sourceShapes) + "\n");
console.log(JSON.stringify({
  states: renderStates.length,
  renderValues: renderValues.length,
  collisionShapes: Object.keys(collisionShapes).length,
  selectionShapes: boxes.length
}, null, 2));

// Attachment prediction consumes these predicates independently of opacity.
const { supportData } = await import("./support-data.mjs");
await supportData({ output: join(output, "blockCollisionShapes.json") });
