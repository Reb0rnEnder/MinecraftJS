import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { delimiter, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { ZipFile } from "../../lib/zip.js";
import { nativeClasspath } from "../../lib/native-classpath.js";
import { root, cache, target, verify } from "./prepare.mjs";
import { KNOWN_PACK_774 } from "../../client/js/net/known-pack-1.21.11.js";
import { decodePlayBody774 } from "../../client/js/net/play-codec-1.21.11.js";
import { readScoreFormat774, formatScore774 } from "../../client/js/game/score-format-1.21.11.js";
import { chatToLegacy } from "../../client/js/gui/chat.js";

const javaSource = `import com.google.gson.Gson;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.google.gson.JsonPrimitive;
import com.mojang.serialization.Codec;
import com.mojang.serialization.DynamicOps;
import com.mojang.serialization.JsonOps;
import com.mojang.serialization.Lifecycle;
import io.netty.buffer.ByteBuf;
import io.netty.buffer.Unpooled;
import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;

public class ExtractScoreFormats12111 {
  static Map<String, String> classNames = new HashMap<>(), originalNames = new HashMap<>();
  static Map<String, Map<String, String>> methodNames = new HashMap<>(), fieldNames = new HashMap<>();
  static Object lookup, jsonOps, regAccess;

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
    String key = name + "(" + String.join(",", Arrays.stream(args).map(ExtractScoreFormats12111::original).toArray(String[]::new)) + ")";
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

  static Object id(String s) throws Exception {
    return m(c("net.minecraft.resources.Identifier"), "parse", String.class).invoke(null, s);
  }

  static Object registryAccess(Object prov, Path orderPath) throws Exception {
    Class<?> registryAccessClass = c("net.minecraft.core.RegistryAccess");
    Object builtInRoot = f(c("net.minecraft.core.registries.BuiltInRegistries"), "REGISTRY").get(null);
    Object base = m(registryAccessClass, "fromRegistryOfRegistries", c("net.minecraft.core.Registry")).invoke(null, builtInRoot);
    Map<Object, Object> registries = new LinkedHashMap<>();
    List<?> entries = ((java.util.stream.Stream<?>) m(registryAccessClass, "registries").invoke(base)).toList();
    Class<?> entryClass = c("net.minecraft.core.RegistryAccess$RegistryEntry");
    Method entryKey = m(entryClass, "key");
    Method entryValue = m(entryClass, "value");
    for (Object entry : entries) {
      registries.put(entryKey.invoke(entry), entryValue.invoke(entry));
    }

    Class<?> rkClass = c("net.minecraft.resources.ResourceKey");
    Class<?> idClass = c("net.minecraft.resources.Identifier");
    Class<?> providerClass = c("net.minecraft.core.HolderLookup$Provider");
    Class<?> holderGetterClass = c("net.minecraft.core.HolderGetter");
    Class<?> holderClass = c("net.minecraft.core.Holder");
    Class<?> regInfoClass = c("net.minecraft.core.RegistrationInfo");
    Class<?> mappedClass = c("net.minecraft.core.MappedRegistry");
    Method createRegKey = m(rkClass, "createRegistryKey", idClass);
    Method createKey = m(rkClass, "create", rkClass, idClass);
    Method lookupOrThrow = m(providerClass, "lookupOrThrow", rkClass);
    Method getOrThrow = m(holderGetterClass, "getOrThrow", rkClass);
    Method holderValue = m(holderClass, "value");
    Method register = m(mappedClass, "register", rkClass, Object.class, regInfoClass);
    Method freeze = m(c("net.minecraft.core.Registry"), "freeze");
    Object builtInInfo = f(regInfoClass, "BUILT_IN").get(null);
    Constructor<?> mappedCtor = mappedClass.getConstructor(rkClass, Lifecycle.class);

    JsonObject orders = JsonParser.parseString(Files.readString(orderPath)).getAsJsonObject();
    for (Map.Entry<String, JsonElement> entry : orders.entrySet()) {
      Object regKey = createRegKey.invoke(null, id(entry.getKey()));
      Object source = lookupOrThrow.invoke(prov, regKey);
      Object registry = mappedCtor.newInstance(regKey, Lifecycle.stable());
      for (JsonElement el : entry.getValue().getAsJsonArray()) {
        Object key = createKey.invoke(null, regKey, id(el.getAsString()));
        Object holder = getOrThrow.invoke(source, key);
        Object val = holderValue.invoke(holder);
        register.invoke(registry, key, val, builtInInfo);
      }
      freeze.invoke(registry);
      registries.put(regKey, registry);
    }
    return c("net.minecraft.core.RegistryAccess$ImmutableRegistryAccess").getConstructor(Map.class).newInstance(registries);
  }

  @SuppressWarnings("unchecked")
  static Object component(JsonElement json) throws Exception {
    Codec<Object> codec = (Codec<Object>) f(c("net.minecraft.network.chat.ComponentSerialization"), "CODEC").get(null);
    return codec.parse((DynamicOps<JsonElement>) jsonOps, json).getOrThrow();
  }

  @SuppressWarnings("unchecked")
  static JsonElement json(Object comp) throws Exception {
    Codec<Object> codec = (Codec<Object>) f(c("net.minecraft.network.chat.ComponentSerialization"), "CODEC").get(null);
    return codec.encodeStart((DynamicOps<JsonElement>) jsonOps, comp).getOrThrow();
  }

  static String wire(Object packet, String owner) throws Exception {
    ByteBuf bytes = Unpooled.buffer();
    try {
      Object codec = f(c(owner), "STREAM_CODEC").get(null);
      Object buf = c("net.minecraft.network.RegistryFriendlyByteBuf")
        .getConstructor(ByteBuf.class, c("net.minecraft.core.RegistryAccess"))
        .newInstance(bytes, regAccess);
      m(c("net.minecraft.network.codec.StreamEncoder"), "encode", Object.class, Object.class).invoke(codec, buf, packet);
      byte[] data = new byte[bytes.readableBytes()];
      bytes.readBytes(data);
      return Base64.getEncoder().encodeToString(data);
    } finally {
      bytes.release();
    }
  }

  @SuppressWarnings("unchecked")
  public static void main(String[] args) throws Exception {
    loadMappings(Path.of(args[1]));
    m(c("net.minecraft.SharedConstants"), "tryDetectVersion").invoke(null);
    m(c("net.minecraft.server.Bootstrap"), "bootStrap").invoke(null);

    lookup = m(c("net.minecraft.data.registries.VanillaRegistries"), "createLookup").invoke(null);
    regAccess = registryAccess(lookup, Path.of(args[2]));
    jsonOps = m(c("net.minecraft.resources.RegistryOps"), "create", DynamicOps.class, c("net.minecraft.core.HolderLookup$Provider"))
      .invoke(null, JsonOps.INSTANCE, lookup);
    Codec<Object> nfCodec = (Codec<Object>) f(c("net.minecraft.network.chat.numbers.NumberFormatTypes"), "CODEC").get(null);

    Class<?> compClass = c("net.minecraft.network.chat.Component");
    Class<?> nfClass = c("net.minecraft.network.chat.numbers.NumberFormat");
    Class<?> styledClass = c("net.minecraft.network.chat.numbers.StyledFormat");
    Class<?> entryClass = c("net.minecraft.world.scores.PlayerScoreEntry");
    Constructor<?> entryCtor = entryClass.getConstructor(String.class, int.class, compClass, nfClass);
    Method formatValue = m(entryClass, "formatValue", nfClass);

    Class<?> scorePacketClass = c("net.minecraft.network.protocol.game.ClientboundSetScorePacket");
    Constructor<?> scorePacketCtor = scorePacketClass.getConstructor(String.class, String.class, int.class, Optional.class, Optional.class);

    Class<?> boardClass = c("net.minecraft.world.scores.Scoreboard");
    Class<?> criteriaClass = c("net.minecraft.world.scores.criteria.ObjectiveCriteria");
    Class<?> renderTypeClass = c("net.minecraft.world.scores.criteria.ObjectiveCriteria$RenderType");
    Class<?> objectiveClass = c("net.minecraft.world.scores.Objective");
    Class<?> objPacketClass = c("net.minecraft.network.protocol.game.ClientboundSetObjectivePacket");

    Object board = boardClass.getConstructor().newInstance();
    Object criteria = f(criteriaClass, "DUMMY").get(null);
    Object renderType = f(renderTypeClass, "INTEGER").get(null);
    Constructor<?> objectiveCtor = objectiveClass.getConstructor(
      boardClass, String.class, criteriaClass, compClass, renderTypeClass, boolean.class, nfClass
    );
    Constructor<?> objPacketCtor = objPacketClass.getConstructor(objectiveClass, int.class);

    List<Object> out = new ArrayList<>();
    for (JsonElement input : JsonParser.parseString(Files.readString(Path.of(args[3]))).getAsJsonArray()) {
      JsonObject entry = input.getAsJsonObject();
      Object format = entry.has("format") ? nfCodec.parse((DynamicOps<JsonElement>) jsonOps, entry.get("format")).getOrThrow() : null;
      int value = entry.get("value").getAsInt();
      Object display = component(entry.get("display"));
      Map<String, Object> formatted = new TreeMap<>();
      for (String context : new String[]{"sidebar", "list", "name"}) {
        String field = context.equals("sidebar") ? "SIDEBAR_DEFAULT" : context.equals("list") ? "PLAYER_LIST_DEFAULT" : "NO_STYLE";
        Object fallback = f(styledClass, field).get(null);
        Object score = entryCtor.newInstance("owner", value, display, format);
        formatted.put(context, json(formatValue.invoke(score, fallback)));
      }
      Object scorePacket = scorePacketCtor.newInstance("owner", "objective", value, Optional.ofNullable(display), Optional.ofNullable(format));
      Object objective = objectiveCtor.newInstance(board, "objective", criteria, component(new JsonPrimitive("Title")), renderType, false, format);
      List<String> objectives = new ArrayList<>();
      for (int mode : new int[]{0, 2}) {
        Object packet = objPacketCtor.newInstance(objective, mode);
        objectives.add(wire(packet, "net.minecraft.network.protocol.game.ClientboundSetObjectivePacket"));
      }
      Map<String, Object> row = new TreeMap<>();
      row.put("label", entry.get("label").getAsString());
      row.put("formatted", formatted);
      row.put("scorePacket", wire(scorePacket, "net.minecraft.network.protocol.game.ClientboundSetScorePacket"));
      row.put("objectivePackets", objectives);
      out.add(row);
    }

    List<Object> slots = new ArrayList<>();
    Class<?> slotClass = c("net.minecraft.world.scores.DisplaySlot");
    Method getSerializedName = m(slotClass, "getSerializedName");
    for (Object slot : slotClass.getEnumConstants()) {
      slots.add(getSerializedName.invoke(slot));
    }
    Files.writeString(Path.of(args[0]), new Gson().toJson(Map.of("samples", out, "displaySlots", slots)));
  }
}
`;

function canonical(v) {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === "object") {
    return Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical(v[k])]));
  }
  return v;
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

export async function scoreFormatFixtures(check = false) {
  verify(await readFile(join(cache, "client.jar")), target.downloads.client, "score format client jar");
  verify(await readFile(join(cache, "client.txt")), target.downloads.client_mappings, "score format mappings");

  const rows = [];
  const formats = [
    null,
    { type: "blank" },
    { type: "styled", style: {} },
    { type: "styled", style: { color: "green", bold: true } },
    { type: "styled", style: { color: "#123456", italic: true, bold: false, font: "minecraft:uniform" } },
    { type: "fixed", value: { text: "ą Coins", color: "aqua", extra: [{ text: "!", bold: true }] } },
    { type: "fixed", value: "" }
  ];
  for (const [formatId, format] of formats.entries()) {
    for (const value of [0, 17, -3, 2147483647]) {
      rows.push({
        label: "format " + formatId + " value " + value,
        value,
        display: { text: "Alias", color: "gold" },
        ...(format === null ? {} : { format })
      });
    }
  }

  const folder = join(cache, "scores-audit");
  const out = join(folder, "native.json");
  const input = join(folder, "input.json");
  const order = join(folder, "registry-order.json");
  const javaPath = join(folder, "ExtractScoreFormats12111.java");
  await rm(folder, { recursive: true, force: true });
  await mkdir(folder, { recursive: true });
  await writeFile(input, JSON.stringify(rows));
  await writeFile(
    order,
    JSON.stringify(
      Object.fromEntries(Object.entries(KNOWN_PACK_774.registries).map(([k, entries]) => [k, entries.map((e) => e.key)]))
    )
  );
  await writeFile(javaPath, javaSource);

  const cp = cleanClientClasspath();
  const proc = spawnSync(
    process.env.JAVA || "java",
    ["-cp", cp, resolve(javaPath), resolve(out), resolve(join(cache, "client.txt")), resolve(order), resolve(input)],
    { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }
  );
  if (proc.status !== 0) {
    throw new Error("Native score format oracle failed:\n" + (proc.stderr || proc.stdout || proc.status));
  }

  const native = JSON.parse(await readFile(out, "utf8"));
  assert.equal(native.samples.length, rows.length, "Unexpected score format sample count");

  // Verify readScoreFormat774 and formatScore774 via decodePlayBody774 on every sample
  for (let i = 0; i < rows.length; i++) {
    const spec = rows[i];
    const row = native.samples[i];

    const decodedScore = decodePlayBody774("scoreboard_score", Buffer.from(row.scorePacket, "base64"));
    assert.equal(decodedScore.value, spec.value);
    const fmt = decodedScore.numberFormat;
    if (spec.format === undefined) {
      assert.equal(fmt, null, row.label + " expected null numberFormat");
    } else if (spec.format.type === "blank") {
      assert.deepEqual(fmt, { type: "blank" }, row.label + " blank mismatch");
    } else if (spec.format.type === "styled") {
      assert.equal(fmt.type, "styled", row.label + " styled type mismatch");
    } else if (spec.format.type === "fixed") {
      assert.equal(fmt.type, "fixed", row.label + " fixed type mismatch");
    }

    for (const objB64 of row.objectivePackets) {
      const decodedObj = decodePlayBody774("scoreboard_objective", Buffer.from(objB64, "base64"));
      assert.deepEqual(decodedObj.numberFormat, fmt, row.label + " objective vs score numberFormat mismatch");
    }

    for (const context of ["sidebar", "list", "name"]) {
      const jsText = formatScore774(spec.value, fmt, context);
      const nativeText = chatToLegacy(row.formatted[context], { parsed: true });
      assert.equal(jsText, nativeText, row.label + " (" + context + ") formatScore774 mismatch");
    }
  }

  // Also test readScoreFormat774 invalid input error handling
  assert.throws(() => readScoreFormat774(1, null), /Invalid scoreboard number format/);
  assert.throws(() => readScoreFormat774(99, { t: 10, v: {} }), /Invalid scoreboard number format/);

  const data = {
    version: target.minecraftVersion,
    clientJarSha1: target.downloads.client.sha1,
    oracleSha256: createHash("sha256").update(javaSource).digest("hex"),
    ...native
  };
  const text = JSON.stringify(canonical(data), null, 2) + "\n";
  const file = join(root, "tools/fixtures/score-formats-1.21.11.json");
  if (check) {
    assert.equal(await readFile(file, "utf8"), text, "Stale score format fixture");
    console.log("Verified " + native.samples.length + " score format cases + objective/score packet bodies + formatScore774");
  } else {
    await writeFile(file, text);
    console.log("Recorded " + native.samples.length + " score format cases + objective/score packet bodies + formatScore774");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await scoreFormatFixtures(process.argv.includes("--check"));
}
