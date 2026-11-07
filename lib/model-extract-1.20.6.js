const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { nativeClasspath } = require("./native-classpath");

const EXPECTED = "05b6f1c6b46a29d6ea82b4e0d42190e42402030f";

function sha1(data) {
  return crypto.createHash("sha1").update(data).digest("hex");
}

function unsignedClient(cache, client) {
  const output = path.join(cache, "client-model-oracle.jar");
  const marker = output + ".sha1";
  if (fs.existsSync(output) && fs.existsSync(marker) && fs.readFileSync(marker, "utf8").trim() === EXPECTED) {
    return output;
  }

  const work = path.join(cache, "client-model-oracle-unpack");
  fs.rmSync(work, { recursive: true, force: true });
  fs.mkdirSync(work, { recursive: true });
  execFileSync(process.env.JAR || "jar", ["xf", path.resolve(client)], { cwd: work, stdio: "ignore" });

  const meta = path.join(work, "META-INF");
  if (fs.existsSync(meta)) {
    for (const name of fs.readdirSync(meta)) {
      if (/\.(?:SF|RSA|DSA|EC)$/i.test(name)) fs.rmSync(path.join(meta, name), { force: true });
    }
  }

  execFileSync(process.env.JAR || "jar", ["cf", path.resolve(output), "-C", path.resolve(work), "."], {
    cwd: cache,
    stdio: "ignore"
  });
  fs.rmSync(work, { recursive: true, force: true });
  fs.writeFileSync(marker, EXPECTED + "\n");
  return output;
}

exports.extractModels = function extractModels(jar) {
  const root = path.join(__dirname, "..");
  const cache = path.join(root, "cache", "port-1.20.6");
  const client = path.join(cache, "client.jar");
  if (sha1(jar.data) !== EXPECTED || sha1(fs.readFileSync(client)) !== EXPECTED) {
    throw new Error("Native model extraction requires the pinned 1.20.6 jar");
  }

  const unsigned = unsignedClient(cache, client);
  const parts = nativeClasspath(cache).split(path.delimiter);
  parts[0] = unsigned;
  const classpath = parts.join(path.delimiter);
  const layersPath = path.join(cache, "layers-1.20.6.json");

  execFileSync(
    process.env.JAVA || "java",
    [
      "-cp",
      classpath,
      path.join(root, "tools", "port-1.19.4", "ExtractLayers.java"),
      layersPath,
      path.join(cache, "client.txt")
    ],
    { cwd: cache, stdio: ["ignore", "pipe", "pipe"], maxBuffer: 16 * 1024 * 1024 }
  );

  const layers = JSON.parse(fs.readFileSync(layersPath));
  const specs = JSON.parse(fs.readFileSync(path.join(root, "tools", "port-1.19.4", "model-layers.json")));
  const models = {};
  const errors = [];
  const named = (layer) => new Map(layer.parts.flatMap((part) => Object.entries(part.namedChildren)));

  for (const [key, spec] of Object.entries(specs)) {
    try {
      if (key === "bed") {
        const head = layers[spec.headLayer];
        const foot = layers[spec.footLayer];
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
        models[key] = {
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
          nativeLayer: [spec.headLayer, spec.footLayer]
        };
        continue;
      }

      const layer = layers[spec.layer];
      if (!layer) throw new Error("Missing native layer " + spec.layer);
      const names = named(layer);
      const id = (name) => {
        if (name === null) return null;
        if (name === "$root") return layer.root;
        const value = names.get(name);
        if (value === undefined) throw new Error("Missing native part " + name);
        return value;
      };
      models[key] = {
        parts: layer.parts,
        fields: spec.fields.map((value) => Array.isArray(value) ? value.map(id) : id(value)),
        nums: [],
        slotNames: spec.fields,
        nativeLayer: spec.layer
      };
    } catch (error) {
      errors.push(key + ": " + error.message);
    }
  }

  return { models, errors };
};
