import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, readdir, rm, unlink, writeFile } from "node:fs/promises";
import { delimiter, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { prepare, cache, target } from "./prepare.mjs";

const fixtureUrl = new URL("./component-fixtures.json", import.meta.url);
const oracleJar = join(cache, "server-component-oracle.jar");
const oracleDir = join(cache, "component-oracle");
const unpackDir = join(cache, "component-oracle-server");

const valid = [
  {
    name: "plain string",
    value: "hello"
  },
  {
    name: "styled click event",
    value: {
      text: "Hello",
      color: "red",
      bold: true,
      clickEvent: { action: "open_url", value: "https://example.com" }
    }
  },
  {
    name: "root sibling list",
    value: ["A", { text: "B", italic: true }]
  },
  {
    name: "translation mixed list and hover",
    value: {
      translate: "chat.type.text",
      with: ["Alice", { text: "Hi", color: "gold" }],
      hoverEvent: { action: "show_text", contents: { text: "tip", bold: true } }
    }
  },
  {
    name: "locate result with nested coordinate arguments",
    value: {
      translate: "commands.locate.structure.success",
      with: ["minecraft:village_plains", {
        translate: "chat.coordinates",
        with: [{translate:"argument.pos3d.incomplete",with:[120,-64,315]},"~",315],
        color:"green",
        clickEvent:{action:"suggest_command",value:"/tp @s 120 ~ 315"},
        hoverEvent:{action:"show_text",contents:{translate:"chat.coordinates.tooltip"}}
      }, 248]
    }
  },
  {name:"primitive translation arguments",value:{translate:"fixture.arguments",with:[7,1.25,-20,true,false,"text"]}}

];

const invalid = [
  { name: "numeric root", value: 7 },
  { name: "boolean root", value: true },
  { name: "null root", value: null },
  { name: "empty root list", value: [] }
];

const javaSource = `import com.google.gson.JsonParser;
import com.mojang.serialization.JsonOps;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;

public class ComponentOracle {
    public static void main(String[] args) throws Exception {
        aa.a();
        alh.a();
        BufferedReader input = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.UTF_8));
        for (String line; (line = input.readLine()) != null;) {
            try {
                xp component = xr.a.parse(JsonOps.INSTANCE, JsonParser.parseString(line)).getOrThrow();
                vp tag = xr.a.encodeStart(vg.a, component).getOrThrow();
                ByteArrayOutputStream bytes = new ByteArrayOutputStream();
                DataOutputStream out = new DataOutputStream(bytes);
                vf.a(tag, out);
                out.flush();
                xp decoded = xr.a.parse(vg.a, tag).getOrThrow();
                String json = xr.a.encodeStart(JsonOps.INSTANCE, decoded).getOrThrow().toString();
                System.out.println("OK " + HexFormat.of().formatHex(bytes.toByteArray()) + " " + json);
            } catch (Throwable error) {
                String message = error.getMessage();
                System.out.println("ERROR " + (message == null ? error.getClass().getSimpleName() : message.replace("\\n", " ")));
            }
        }
    }
}
`;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    ...options
  });
  if (result.status !== 0) {
    throw new Error(command + " failed: " + (result.stderr || result.stdout || "exit " + result.status));
  }
  return result;
}

async function jarsUnder(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await jarsUnder(path));
    else if (entry.isFile() && entry.name.endsWith(".jar")) out.push(path);
  }
  return out;
}

async function unsignedServerJar() {
  try {
    await readFile(oracleJar);
    return oracleJar;
  } catch {}
  await rm(unpackDir, { recursive: true, force: true });
  await mkdir(unpackDir, { recursive: true });
  run(process.env.JAR || "jar", ["xf", resolve(join(cache, "bundler", "META-INF", "versions", "1.20.6", "server-1.20.6.jar"))], { cwd: unpackDir });
  const meta = join(unpackDir, "META-INF");
  try {
    for (const entry of await readdir(meta)) {
      if (/\.(?:SF|RSA|DSA|EC)$/i.test(entry)) await unlink(join(meta, entry));
    }
  } catch {}
  run(process.env.JAR || "jar", ["cf", resolve(oracleJar), "-C", resolve(unpackDir), "."]);
  await rm(unpackDir, { recursive: true, force: true });
  return oracleJar;
}

export async function componentFixtures(check = false) {
  await prepare();
  await rm(oracleDir, { recursive: true, force: true });
  await mkdir(oracleDir, { recursive: true });
  await writeFile(join(oracleDir, "ComponentOracle.java"), javaSource);

  const server = await unsignedServerJar();
  const libraries = await jarsUnder(join(cache, "libraries"));
  const classpath = [server, ...libraries].map((path) => resolve(path)).join(delimiter);
  run(process.env.JAVAC || "javac", ["-cp", classpath, "-d", resolve(oracleDir), resolve(join(oracleDir, "ComponentOracle.java"))]);

  const inputs = [...valid, ...invalid];
  const result = run(process.env.JAVA || "java", ["-cp", classpath + delimiter + resolve(oracleDir), "ComponentOracle"], {
    input: inputs.map((entry) => JSON.stringify(entry.value)).join("\n") + "\n"
  });
  const lines = result.stdout.trim().split(/\r?\n/).map((line) => {
    const wrapped = line.match(/\[STDOUT\]: (OK [0-9a-f]+ .+|ERROR .*)$/);
    return wrapped ? wrapped[1] : line;
  }).filter((line) => /^(?:OK [0-9a-f]+ |ERROR )/.test(line));
  assert.equal(lines.length, inputs.length, "Native component oracle returned an unexpected number of results");

  const fixtures = valid.map((entry, index) => {
    const line = lines[index];
    assert.match(line, /^OK [0-9a-f]+ .+$/, "Native component fixture rejected: " + entry.name + " -> " + line);
    const [,wire,decoded]=/^OK ([0-9a-f]+) (.+)$/.exec(line);
    return {...entry,wire,decoded:JSON.parse(decoded)};
  });
  const rejected = invalid.map((entry, index) => {
    const line = lines[valid.length + index];
    assert.match(line, /^ERROR /, "Native component unexpectedly accepted: " + entry.name);
    return entry.name;
  });

  const output = {
    minecraftVersion: target.minecraftVersion,
    protocol: target.protocol,
    clientSha1: target.downloads.client.sha1,
    fixtures,
    rejected
  };

  if (check) {
    assert.deepEqual(output, JSON.parse(await readFile(fixtureUrl, "utf8")), "Native 1.20.6 component fixtures differ");
    console.log("Verified " + fixtures.length + " native component fixtures and " + rejected.length + " native rejection cases");
  } else {
    await writeFile(fixtureUrl, JSON.stringify(output, null, 2) + "\n");
    console.log("Recorded " + fixtures.length + " native component fixtures and " + rejected.length + " native rejection cases");
  }
  return output;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await componentFixtures(process.argv.includes("--check"));
}
