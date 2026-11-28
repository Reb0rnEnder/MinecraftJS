const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { nativeClasspath } = require("./native-classpath");

const EXPECTED = "ba2df812c2d12e0219c489c4cd9a5e1f0760f5bd";

function sha1(data) {
  return crypto.createHash("sha1").update(data).digest("hex");
}

function unsignedClient(cache, client) {
  const existingUnsigned = path.join(cache, "client-unsigned.jar");
  if (fs.existsSync(existingUnsigned)) return existingUnsigned;
  const output = path.join(cache, "client-model-oracle.jar");
  const marker = output + ".sha1";
  if (fs.existsSync(output) && fs.existsSync(marker) && fs.readFileSync(marker, "utf8").trim() === EXPECTED) {
    return output;
  }
  const { ZipFile } = require("./zip");
  const zip = new ZipFile(client);
  const work = path.join(cache, "client-model-oracle-unpack");
  fs.rmSync(work, { recursive: true, force: true });
  fs.mkdirSync(work, { recursive: true });
  for (const name of zip.list("")) {
    if (/^META-INF\/[^/]+\.(?:SF|RSA|DSA|EC)$/i.test(name)) continue;
    const target = path.join(work, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, zip.read(name));
  }
  // Repack via python3 zipfile since jar/zip CLI binaries may not be installed
  execFileSync("python3", [
    "-c",
    "import os,sys,zipfile\nsrc,dst=sys.argv[1],sys.argv[2]\nwith zipfile.ZipFile(dst,'w',zipfile.ZIP_STORED) as z:\n for r,_,fs in os.walk(src):\n  for f in fs:\n   p=os.path.join(r,f);z.write(p,os.path.relpath(p,src))",
    work,
    output + ".tmp"
  ], { stdio: "pipe" });
  fs.renameSync(output + ".tmp", output);
  fs.writeFileSync(marker, EXPECTED + "\n");
  return output;
}

exports.extractModels = function extractModels(jar) {
  const root = path.join(__dirname, "..");
  const cache = path.join(root, "cache", "port-1.21.11");
  const client = path.join(cache, "client.jar");
  if (!fs.existsSync(client)) throw new Error("Missing native 1.21.11 client jar: " + client);
  const hash = sha1(fs.readFileSync(client));
  if (hash !== EXPECTED) throw new Error("Unexpected 1.21.11 client jar SHA-1 " + hash);

  const unsigned = unsignedClient(cache, client);
  const parts = nativeClasspath(cache)
    .split(path.delimiter)
    .filter((entry) => !entry.includes(path.join("bundler", "META-INF", "versions")));
  parts[0] = unsigned;
  const classpath = parts.join(path.delimiter);
  const layersPath = path.join(cache, "layers-1.21.11.json");

  execFileSync(
    process.env.JAVA || "java",
    [
      "-Xmx512M",
      "-cp",
      classpath,
      path.join(root, "tools", "port-1.21.11", "ExtractLayers12111.java"),
      layersPath,
      path.join(cache, "client.txt")
    ],
    { stdio: "pipe", maxBuffer: 64 * 1024 * 1024 }
  );

  const layers = JSON.parse(fs.readFileSync(layersPath, "utf8"));
  const specs = {
    ...JSON.parse(fs.readFileSync(path.join(root, "tools", "port-1.19.4", "model-layers.json"), "utf8")),
    ...JSON.parse(fs.readFileSync(path.join(root, "tools", "port-1.20.6", "model-layers.json"), "utf8")),
    ...JSON.parse(fs.readFileSync(path.join(root, "tools", "port-1.21.11", "model-layers.json"), "utf8"))
  };

  const models = {};
  const errors = [];
  const named = (layer) => new Map(layer.parts.flatMap((part) => Object.entries(part.namedChildren)));

  for (const [key, spec] of Object.entries(specs)) {
    try {
      if (spec.headLayer) {
        const head = layers[spec.headLayer];
        const foot = layers[spec.footLayer];
        if (!head || !foot) {
          errors.push(key + ": missing split layer " + spec.headLayer + " / " + spec.footLayer);
          continue;
        }
        const offset = head.parts.length;
        const h = named(head);
        const f = named(foot);
        const mergedParts = [
          ...head.parts.map(({ namedChildren, ...p }) => p),
          ...foot.parts.map(({ namedChildren, ...p }) => ({ ...p, children: p.children.map((i) => i + offset) }))
        ];
        models[key] = {
          fields: [
            h.get("head") ?? h.get("main"),
            (f.get("foot") ?? f.get("main")) + offset,
            [
              f.get("left_leg") !== undefined ? f.get("left_leg") + offset : h.get("left_leg"),
              h.get("left_leg"),
              f.get("right_leg") !== undefined ? f.get("right_leg") + offset : h.get("right_leg"),
              h.get("right_leg")
            ]
          ],
          parts: mergedParts,
          nums: [],
          nativeLayer: [spec.headLayer, spec.footLayer]
        };
        continue;
      }

      const layer = layers[spec.layer];
      if (!layer) {
        errors.push(key + ": missing native layer " + spec.layer);
        continue;
      }

      const mergedParts = layer.parts.map(({ namedChildren, ...p }) => ({ ...p }));
      const nameMap = named(layer);
      for (const extraName of spec.extraLayers || []) {
        const extra = layers[extraName];
        if (!extra) {
          errors.push(key + ": missing extra layer " + extraName);
          continue;
        }
        const offset = mergedParts.length;
        for (const p of extra.parts) {
          const { namedChildren, ...rest } = p;
          mergedParts.push({ ...rest, children: rest.children.map((i) => i + offset) });
        }
        for (const [childName, idx] of named(extra)) {
          const existing = nameMap.get(childName);
          const candidateHasBoxes = (partIdx) => {
            const p = mergedParts[partIdx];
            if (!p) return false;
            if (p.boxes && p.boxes.length) return true;
            return (p.children || []).some(candidateHasBoxes);
          };
          if (existing === undefined || (!candidateHasBoxes(existing) && candidateHasBoxes(idx + offset))) {
            nameMap.set(childName, idx + offset);
          }
        }
      }

      const id = (name) => {
        if (name === null) return null;
        if (name === "$root") return layer.root;
        const value = nameMap.get(name);
        if (value === undefined) {
          if (spec.optionalEmptyFields) {
            const idx = mergedParts.length;
            mergedParts.push({
              tw: 1,
              th: 1,
              p: [0, 0, 0],
              r: [0, 0, 0],
              s: [1, 1, 1],
              mirror: false,
              show: false,
              boxes: [],
              children: []
            });
            return idx;
          }
          throw new Error("Missing part " + name + " in " + spec.layer);
        }
        return value;
      };

      const fields = spec.fields.map((entry) => (Array.isArray(entry) ? entry.map(id) : id(entry)));
      models[key] = {
        fields,
        parts: mergedParts,
        nums: [],
        slotNames: spec.fields,
        nativeLayer: spec.layer
      };
    } catch (e) {
      errors.push(key + ": " + e.message);
    }
  }

  return { models, errors };
};
