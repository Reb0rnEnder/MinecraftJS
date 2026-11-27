const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { nativeClasspath } = require("./native-classpath");

// Pinned native 26.3 client jar (see HANDOFF-26.3.md).
const EXPECTED = "e877b6a07acd633fb3bb475002175cec036e7b87";

function sha1(data) {
  return crypto.createHash("sha1").update(data).digest("hex");
}

// 26.3 moved beds, signs and hanging signs out of LayerDefinitions and into block
// models. Their 1.20.6 geometry still matches the unchanged textures, so the
// bundle keeps those three families from the pinned 1.20.6 layer dump and every
// other model comes from 26.3.
function fallbackLayers(root) {
  const file = path.join(root, "cache", "port-1.20.6", "layers-1.20.6.json");
  if (!fs.existsSync(file)) throw new Error("Native 26.3 model extraction needs the 1.20.6 layer dump for bed/sign geometry");
  return JSON.parse(fs.readFileSync(file));
}

// A layer whose definitions were split across equipment slots (26.3 armor) is one
// biped per slot; merge each part's boxes in slot order so the client's two-pass
// armor renderer keeps its shape.
function combineLayers(names, layers) {
  const source = names.map((name) => {
    const layer = layers[name];
    if (!layer) throw new Error("Missing native layer " + name);
    return layer;
  });
  const base = source[0];
  for (const layer of source.slice(1)) {
    if (layer.parts.length !== base.parts.length) throw new Error("Native layers " + names.join("/") + " do not share a part layout");
  }
  const parts = base.parts.map((part, index) => ({
    ...part,
    boxes: source.flatMap((layer) => layer.parts[index].boxes)
  }));
  return { root: base.root, parts };
}

// A layer split into disjoint part trees (26.3 banners keep the pole/bar apart
// from the flag) is appended whole; child indices move by the current offset.
function appendLayers(names, layers) {
  const parts = [];
  const names_ = new Map();
  let root = 0;
  for (const name of names) {
    const layer = layers[name];
    if (!layer) throw new Error("Missing native layer " + name);
    const offset = parts.length;
    if (!offset) root = layer.root;
    for (const part of layer.parts) {
      parts.push({ ...part, children: part.children.map((index) => index + offset) });
    }
    for (const part of layer.parts) {
      for (const [child, index] of Object.entries(part.namedChildren)) names_.set(child, index + offset);
    }
  }
  return { root, parts, names: names_ };
}

// Merge extra native layers onto a base layer by named path (player ears/cape,
// horse/camel saddle). Existing parts keep the base geometry so duplicate base
// boxes are not drawn twice; only parts that do not exist yet (and their boxes)
// are appended under the matching parent.
function mergeLayers(names, layers) {
  const base = layers[names[0]];
  if (!base) throw new Error("Missing native layer " + names[0]);
  const parts = base.parts.map((part) => ({
    ...part,
    children: [...part.children],
    namedChildren: { ...part.namedChildren },
    boxes: [...part.boxes]
  }));
  const paths = new Map();
  const walk = (index, path) => {
    paths.set(path, index);
    for (const [name, child] of Object.entries(parts[index].namedChildren)) {
      walk(child, path ? path + "/" + name : name);
    }
  };
  walk(base.root, "");

  const add = (part, parent, name, path, sourceParts) => {
    const targetPath = path ? path + "/" + name : name;
    const existing = paths.get(targetPath);
    if (existing !== undefined) {
      for (const [childName, child] of Object.entries(part.namedChildren)) add(sourceParts[child], existing, childName, targetPath, sourceParts);
      return;
    }
    const index = parts.length;
    parts.push({
      ...part,
      children: [],
      namedChildren: {},
      boxes: [...part.boxes]
    });
    parts[parent].children.push(index);
    parts[parent].namedChildren[name] = index;
    paths.set(targetPath, index);
    for (const [childName, child] of Object.entries(part.namedChildren)) add(sourceParts[child], index, childName, targetPath, sourceParts);
  };

  for (const name of names.slice(1)) {
    const layer = layers[name];
    if (!layer) throw new Error("Missing native layer " + name);
    const root = layer.parts[layer.root];
    for (const [childName, child] of Object.entries(root.namedChildren)) add(layer.parts[child], base.root, childName, "", layer.parts);
  }

  const names_ = new Map();
  for (const [path, index] of paths) names_.set(path.split("/").pop(), index);
  return { root: base.root, parts, names: names_ };
}

exports.extractModels = function extractModels(jar) {
  const root = path.join(__dirname, "..");
  const cache = path.join(root, "cache", "port-26.3");
  const client = path.join(cache, "client.jar");
  if (sha1(jar.data) !== EXPECTED || sha1(fs.readFileSync(client)) !== EXPECTED) {
    throw new Error("Native model extraction requires the pinned 26.3 jar");
  }

  const classpath = nativeClasspath(cache);
  const source = path.join(root, "tools", "port-26.3", "ExtractLayers26_3.java");
  const buildDir = path.join(cache, "layers-build");
  const compiled = path.join(buildDir, "ExtractLayers26_3.class");
  if (!fs.existsSync(compiled) || fs.statSync(source).mtimeMs > fs.statSync(compiled).mtimeMs) {
    fs.mkdirSync(buildDir, { recursive: true });
    execFileSync(process.env.JAVAC || "javac", ["-cp", classpath, "-d", buildDir, source], { stdio: ["ignore", "pipe", "pipe"] });
  }

  // Callers (asset build and several node:test files) can run concurrently; a shared
  // output file would be truncated by another JVM while this process reads it.
  const layersPath = path.join(cache, `layers-26.3.${process.pid}.${Date.now()}.json`);
  execFileSync(
    process.env.JAVA || "java",
    ["-Djava.awt.headless=true", "-cp", buildDir + path.delimiter + classpath, "ExtractLayers26_3", layersPath],
    { cwd: cache, stdio: ["ignore", "pipe", "pipe"], maxBuffer: 32 * 1024 * 1024 }
  );

  const nativeLayers = JSON.parse(fs.readFileSync(layersPath));
  fs.rmSync(layersPath, {force: true});
  const legacy = fallbackLayers(root);
  const layers = new Proxy({}, { get: (_, name) => nativeLayers[name] || legacy[name] });
  const specs = {
    ...JSON.parse(fs.readFileSync(path.join(root, "tools", "port-1.19.4", "model-layers.json"))),
    ...JSON.parse(fs.readFileSync(path.join(root, "tools", "port-1.20.6", "model-layers.json"))),
    ...JSON.parse(fs.readFileSync(path.join(root, "tools", "port-26.3", "model-layers.json")))
  };
  const models = {};
  const errors = [];
  const named = (layer) => new Map(layer.parts.flatMap((part) => Object.entries(part.namedChildren)));

  // A model whose 26.3 rig no longer matches the client's animation code (the
  // dragon neck/tail chain and the end-crystal hierarchy) keeps the 1.20.6 rig,
  // whose part names the renderer animates. Everything else is baked from 26.3,
  // including merged player cape/ears and horse/camel saddle layers.
  const legacyModels = {};
  const bake = (key, spec, source, rigSource) => {
    try {
      if (key === "bed") {
        const head = source[spec.headLayer];
        const foot = source[spec.footLayer];
        if (!head || !foot) throw new Error("Missing native bed layer");
        const offset = head.parts.length;
        const h = named(head);
        const f = named(foot);
        const parts = [
          ...head.parts,
          ...foot.parts.map((part) => ({
            ...part,
            children: part.children.map((index) => index + offset)
          }))
        ];
        return {
          parts,
          fields: [
            h.get("main"),
            f.get("main") + offset,
            [
              f.get("left_leg") + offset,
              h.get("left_leg"),
              f.get("right_leg") + offset,
              h.get("right_leg")
            ]
          ],
          nums: [],
          nativeLayer: [spec.headLayer, spec.footLayer],
          rigSource
        };
      }

      const layer = spec.combine ? combineLayers(spec.combine, source) : spec.append ? appendLayers(spec.append, source) : spec.merge ? mergeLayers(spec.merge, source) : source[spec.layer];
      if (!layer) throw new Error("Missing native layer " + spec.layer);
      const names = layer.names || named(layer);
      const id = (name) => {
        if (name === null) return null;
        if (name === "$root") return layer.root;
        const value = names.get(name);
        if (value === undefined) throw new Error("Missing native part " + name);
        return value;
      };
      return {
        parts: layer.parts,
        fields: spec.fields.map((value) => Array.isArray(value) ? value.map(id) : id(value)),
        nums: [],
        slotNames: spec.fields,
        nativeLayer: spec.combine || spec.append || spec.merge || spec.layer,
        rigSource
      };
    } catch (error) {
      throw new Error(key + ": " + error.message);
    }
  };

  const legacyLayers = new Proxy({}, { get: (_, name) => legacy[name] });
  for (const [key, spec] of Object.entries(specs)) {
    try {
      models[key] = bake(key, spec, layers, "26.3");
    } catch (nativeError) {
      try {
        if (!legacyModels[key]) legacyModels[key] = bake(key, spec, legacyLayers, "1.20.6");
        models[key] = legacyModels[key];
      } catch (legacyError) {
        errors.push(nativeError.message);
      }
    }
  }

  return { models, errors };
};
