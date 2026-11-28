import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { delimiter, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { ZipFile } from "../../lib/zip.js";
import { nativeClasspath } from "../../lib/native-classpath.js";
import { prepare, cache, target, verify } from "./prepare.mjs";
import { Reader, Writer } from "../../client/js/net/buffer.js";
import { readAnonymousNbt, writeAnonymousNbt } from "../../client/js/net/nbt-anonymous.js";
import { componentFromNbt, componentToNbt } from "../../client/js/net/component-nbt-1.21.11.js";

const fixtureUrl = new URL("./component-fixtures.json", import.meta.url);
const oracleDir = join(cache, "component-oracle");

const valid = [
  {
    name: "plain string",
    value: "hello"
  },
  {
    name: "styled click_event open_url",
    value: {
      text: "Hello",
      color: "red",
      bold: true,
      click_event: { action: "open_url", url: "https://example.com" }
    }
  },
  {
    name: "styled click_event commands and change_page",
    value: {
      text: "Run",
      click_event: { action: "run_command", command: "/say hi" },
      extra: [
        { text: "Page", click_event: { action: "change_page", page: 2 } },
        { text: "Copy", click_event: { action: "copy_to_clipboard", value: "copied" } }
      ]
    }
  },
  {
    name: "root sibling list",
    value: ["A", { text: "B", italic: true }]
  },
  {
    name: "translation mixed list and hover_event",
    value: {
      translate: "chat.type.text",
      with: ["Alice", { text: "Hi", color: "gold" }],
      hover_event: { action: "show_text", value: { text: "tip", bold: true } }
    }
  },
  {
    name: "locate result with nested coordinate arguments",
    value: {
      translate: "commands.locate.structure.success",
      with: [
        "minecraft:village_plains",
        {
          translate: "chat.coordinates",
          with: [
            { translate: "argument.pos3d.incomplete", with: [120, -64, 315] },
            "~",
            315
          ],
          color: "green",
          click_event: { action: "suggest_command", command: "/tp @s 120 ~ 315" },
          hover_event: { action: "show_text", value: { translate: "chat.coordinates.tooltip" } }
        },
        248
      ]
    }
  },
  {
    name: "primitive translation arguments",
    value: { translate: "fixture.arguments", with: [7, 1.25, -20, true, false, "text"] }
  },
  {
    name: "shadow_color int and float vector",
    value: {
      text: "ShadowInt",
      shadow_color: -16777216,
      extra: [{ text: "ShadowVec", shadow_color: [0.5, 0.25, 0.75, 1] }]
    }
  },
  {
    name: "object atlas component",
    value: { object: "atlas", atlas: "minecraft:blocks", sprite: "minecraft:block/stone" }
  },
  {
    name: "object atlas default",
    value: { object: "atlas", sprite: "minecraft:block/dirt" }
  },
  {
    name: "object player component",
    value: { object: "player", player: "Steve", hat: true }
  },
  {
    name: "hover_event show_item and show_entity",
    value: {
      text: "Hover",
      hover_event: { action: "show_item", id: "minecraft:stone", count: 3 },
      extra: [
        {
          text: "Pig",
          hover_event: {
            action: "show_entity",
            id: "minecraft:pig",
            uuid: "12345678-1234-4234-8234-123456789abc",
            name: { text: "Piggy" }
          }
        }
      ]
    }
  }
];

const invalid = [
  { name: "numeric root", value: 7 },
  { name: "boolean root", value: true },
  { name: "null root", value: null },
  { name: "empty root list", value: [] },
  { name: "disallowed open_file click_event", value: { text: "bad", click_event: { action: "open_file", path: "/etc/passwd" } } },
  { name: "invalid change_page page", value: { text: "bad", click_event: { action: "change_page", page: 0 } } },
  { name: "empty extra list", value: { text: "bad", extra: [] } },
  { name: "invalid object kind", value: { object: "unknown", sprite: "minecraft:block/stone" } }
];

const javaSource = `import com.google.gson.JsonElement;
import com.google.gson.JsonParser;
import com.mojang.serialization.Codec;
import com.mojang.serialization.DynamicOps;
import com.mojang.serialization.JsonOps;
import java.io.*;
import java.lang.reflect.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

public class ComponentOracle12111 {
  static Map<String, String> classNames = new HashMap<>(), originalNames = new HashMap<>();
  static Map<String, Map<String, String>> methodNames = new HashMap<>(), fieldNames = new HashMap<>();

  static void loadMappings(Path path) throws Exception {
    String owner = null;
    for (String line : Files.readAllLines(path)) {
      if (!line.startsWith(" ") && line.contains(" -> ")) {
        String[] p = line.substring(0, line.length() - 1).split(" -> ");
        owner = p[0];
        classNames.put(p[0], p[1]);
        originalNames.put(p[1], p[0]);
      } else if (owner != null && line.startsWith("    ") && line.contains(" -> ")) {
        String[] p = line.trim().split(" -> ");
        String left = p[0].replaceFirst("^(?:[0-9]+:[0-9]+:)+", "");
        int space = left.indexOf(' ');
        if (space < 0) continue;
        String member = left.substring(space + 1);
        if (member.contains("(")) {
          methodNames.computeIfAbsent(owner, k -> new HashMap<>())
            .put(member.substring(0, member.indexOf(')') + 1), p[1]);
        } else {
          fieldNames.computeIfAbsent(owner, k -> new HashMap<>()).put(member, p[1]);
        }
      }
    }
  }

  static String original(Class<?> c) {
    return originalNames.getOrDefault(c.getName(), c.getName());
  }

  static Method m(Class<?> c, String name, Class<?>... args) throws Exception {
    String key = name + "(" + String.join(",", Arrays.stream(args).map(ComponentOracle12111::original).toArray(String[]::new)) + ")";
    for (Class<?> k = c; k != null; k = k.getSuperclass()) {
      String alias = methodNames.getOrDefault(original(k), Map.of()).get(key);
      if (alias == null) continue;
      Method result = k.getDeclaredMethod(alias, args);
      result.setAccessible(true);
      return result;
    }
    Method result = c.getMethod(name, args);
    result.setAccessible(true);
    return result;
  }

  static Field f(Class<?> c, String name) throws Exception {
    for (Class<?> k = c; k != null; k = k.getSuperclass()) {
      String alias = fieldNames.getOrDefault(original(k), Map.of()).get(name);
      if (alias == null) continue;
      Field result = k.getDeclaredField(alias);
      result.setAccessible(true);
      return result;
    }
    Field result = c.getField(name);
    result.setAccessible(true);
    return result;
  }

  static Class<?> c(String name) throws Exception {
    return Class.forName(classNames.getOrDefault(name, name));
  }

  @SuppressWarnings("unchecked")
  public static void main(String[] args) throws Exception {
    loadMappings(Path.of(args[0]));
    m(c("net.minecraft.SharedConstants"), "tryDetectVersion").invoke(null);
    m(c("net.minecraft.server.Bootstrap"), "bootStrap").invoke(null);

    Object lookup = m(c("net.minecraft.data.registries.VanillaRegistries"), "createLookup").invoke(null);
    Class<?> providerClass = c("net.minecraft.core.HolderLookup$Provider");
    Class<?> registryOpsClass = c("net.minecraft.resources.RegistryOps");
    DynamicOps<JsonElement> jsonOps = (DynamicOps<JsonElement>) m(registryOpsClass, "create", DynamicOps.class, providerClass)
      .invoke(null, JsonOps.INSTANCE, lookup);
    Object nbtInstance = f(c("net.minecraft.nbt.NbtOps"), "INSTANCE").get(null);
    DynamicOps<Object> nbtOps = (DynamicOps<Object>) m(registryOpsClass, "create", DynamicOps.class, providerClass)
      .invoke(null, nbtInstance, lookup);

    Codec<Object> codec = (Codec<Object>) f(c("net.minecraft.network.chat.ComponentSerialization"), "CODEC").get(null);
    Class<?> tagClass = c("net.minecraft.nbt.Tag");
    Class<?> nbtIoClass = c("net.minecraft.nbt.NbtIo");
    Class<?> accounterClass = c("net.minecraft.nbt.NbtAccounter");
    Method writeAnyTag = m(nbtIoClass, "writeAnyTag", tagClass, DataOutput.class);
    Method readAnyTag = m(nbtIoClass, "readAnyTag", DataInput.class, accounterClass);
    Method unlimitedHeap = m(accounterClass, "unlimitedHeap");

    BufferedReader input = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.UTF_8));
    for (String line; (line = input.readLine()) != null;) {
      try {
        if (line.startsWith("HEX ")) {
          byte[] raw = HexFormat.of().parseHex(line.substring(4));
          DataInputStream in = new DataInputStream(new ByteArrayInputStream(raw));
          Object tag = readAnyTag.invoke(null, in, unlimitedHeap.invoke(null));
          if (in.available() != 0) throw new IllegalStateException("Trailing NBT bytes: " + in.available());
          Object decoded = codec.parse(nbtOps, tag).getOrThrow();
          String json = codec.encodeStart(jsonOps, decoded).getOrThrow().toString();
          System.out.println("HEX_OK " + json);
        } else {
          Object component = codec.parse(jsonOps, JsonParser.parseString(line)).getOrThrow();
          Object tag = codec.encodeStart(nbtOps, component).getOrThrow();
          ByteArrayOutputStream bytes = new ByteArrayOutputStream();
          DataOutputStream out = new DataOutputStream(bytes);
          writeAnyTag.invoke(null, tag, out);
          out.flush();
          Object decoded = codec.parse(nbtOps, tag).getOrThrow();
          String json = codec.encodeStart(jsonOps, decoded).getOrThrow().toString();
          System.out.println("OK " + HexFormat.of().formatHex(bytes.toByteArray()) + " " + json);
        }
      } catch (Throwable error) {
        Throwable cause = error instanceof InvocationTargetException && error.getCause() != null ? error.getCause() : error;
        String message = cause.getMessage();
        System.out.println("ERROR " + (message == null ? cause.getClass().getSimpleName() : message.replace("\\n", " ")));
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

function cleanClientClasspath() {
  const unsignedPath = join(cache, "client-unsigned.jar");
  const jar = new ZipFile(join(cache, "client.jar"));
  const unsigned = new ZipFile(unsignedPath);
  for (const name of jar.list("").filter((n) => n.endsWith(".class"))) {
    if (!jar.read(name).equals(unsigned.read(name))) {
      throw new Error("Modified native class in client-unsigned.jar: " + name);
    }
  }
  const parts = nativeClasspath(cache)
    .split(delimiter)
    .filter((entry) => !entry.includes(join("bundler", "META-INF", "versions")));
  parts[0] = unsignedPath;
  return parts.map((entry) => resolve(entry)).join(delimiter);
}

export async function componentFixtures(check = false) {
  verify(await readFile(join(cache, "client.jar")), target.downloads.client, "component client jar");
  verify(await readFile(join(cache, "client.txt")), target.downloads.client_mappings, "component client mappings");

  await rm(oracleDir, { recursive: true, force: true });
  await mkdir(oracleDir, { recursive: true });
  const javaPath = join(oracleDir, "ComponentOracle12111.java");
  await writeFile(javaPath, javaSource);

  const classpath = cleanClientClasspath();
  const inputs = [...valid, ...invalid];
  const jsEncodedLines = valid.map((entry) => {
    const nbt = componentToNbt(entry.value);
    const bytes = writeAnonymousNbt(new Writer(), nbt).build();
    return "HEX " + Buffer.from(bytes).toString("hex");
  });

  const allStdin = [
    ...inputs.map((entry) => JSON.stringify(entry.value)),
    ...jsEncodedLines
  ].join("\n") + "\n";

  const result = run(
    process.env.JAVA || "java",
    ["-cp", classpath, resolve(javaPath), resolve(join(cache, "client.txt"))],
    { input: allStdin }
  );

  const lines = result.stdout
    .trim()
    .split(/\r?\n/)
    .map((line) => {
      const wrapped = line.match(/\[STDOUT\]: ((?:OK [0-9a-f]+ .+|HEX_OK .+|ERROR .*))$/);
      return wrapped ? wrapped[1] : line;
    })
    .filter((line) => /^(?:OK [0-9a-f]+ |HEX_OK |ERROR )/.test(line));

  assert.equal(lines.length, inputs.length + valid.length, "Unexpected oracle output line count");

  const fixtures = valid.map((entry, index) => {
    const line = lines[index];
    assert.match(line, /^OK [0-9a-f]+ .+$/, "Native component fixture rejected: " + entry.name + " -> " + line);
    const [, wire, decoded] = /^OK ([0-9a-f]+) (.+)$/.exec(line);
    const decodedJson = JSON.parse(decoded);

    // 1. Verify JS componentFromNbt on native NBT wire bytes
    const wireBytes = Buffer.from(wire, "hex");
    const reader = new Reader(wireBytes);
    const jsDecoded = componentFromNbt(readAnonymousNbt(reader));
    assert.equal(reader.remaining(), 0, "Trailing bytes reading native component NBT for " + entry.name);
    assert.deepEqual(jsDecoded, decodedJson, "JS componentFromNbt mismatch vs native for " + entry.name);

    // 2. Verify JS componentToNbt roundtrips through native Java NbtIo + ComponentSerialization.CODEC
    const hexLine = lines[inputs.length + index];
    assert.match(hexLine, /^HEX_OK .+$/, "Native rejected JS componentToNbt for " + entry.name + " -> " + hexLine);
    const jsViaNative = JSON.parse(hexLine.slice("HEX_OK ".length));
    assert.deepEqual(jsViaNative, decodedJson, "JS componentToNbt mismatch vs native for " + entry.name);

    return { ...entry, wire, decoded: decodedJson, jsDecoded };
  });

  const rejected = invalid.map((entry, index) => {
    const line = lines[valid.length + index];
    assert.match(line, /^ERROR /, "Native component unexpectedly accepted: " + entry.name);
    assert.throws(() => componentToNbt(entry.value), "JS componentToNbt unexpectedly accepted: " + entry.name);
    return entry.name;
  });

  const output = {
    minecraftVersion: target.minecraftVersion,
    protocol: target.protocol,
    clientSha1: target.downloads.client.sha1,
    fixtures: fixtures.map(({ name, value, wire, decoded }) => ({ name, value, wire, decoded })),
    rejected
  };

  if (check) {
    assert.deepEqual(output, JSON.parse(await readFile(fixtureUrl, "utf8")), "Native 1.21.11 component fixtures differ");
    console.log("Verified " + fixtures.length + " native component fixtures and " + rejected.length + " rejection cases (JS componentFromNbt/componentToNbt parity OK)");
  } else {
    await writeFile(fixtureUrl, JSON.stringify(output, null, 2) + "\n");
    console.log("Recorded " + fixtures.length + " native component fixtures and " + rejected.length + " rejection cases (JS componentFromNbt/componentToNbt parity OK)");
  }
  return output;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await componentFixtures(process.argv.includes("--check"));
}
