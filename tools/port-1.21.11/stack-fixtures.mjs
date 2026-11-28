import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { delimiter, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { ZipFile } from "../../lib/zip.js";
import { nativeClasspath } from "../../lib/native-classpath.js";
import { prepare, cache, target, verify } from "./prepare.mjs";
import { KNOWN_PACK_774 } from "../../client/js/net/known-pack-1.21.11.js";
import { Reader, Writer } from "../../client/js/net/buffer.js";
import {
  readSlot774,
  writeSlot774,
  readUntrustedSlot774,
  writeUntrustedSlot774
} from "../../client/js/net/item-components-1.21.11.js";

const fixtureUrl = new URL("./stack-fixtures.json", import.meta.url);
const oracleDir = join(cache, "stack-oracle");

const javaSource = `import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.mojang.serialization.Lifecycle;
import io.netty.buffer.ByteBuf;
import io.netty.buffer.Unpooled;
import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;

public class StackOracle12111 {
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
    String key = name + "(" + String.join(",", Arrays.stream(args).map(StackOracle12111::original).toArray(String[]::new)) + ")";
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

  static Object registryAccess(Object lookup, Path orderPath) throws Exception {
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
      Object source = lookupOrThrow.invoke(lookup, regKey);
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

  static String encode(Object codec, Object stack, Object regAccess) throws Exception {
    ByteBuf raw = Unpooled.buffer();
    try {
      Object buf = c("net.minecraft.network.RegistryFriendlyByteBuf")
        .getConstructor(ByteBuf.class, c("net.minecraft.core.RegistryAccess"))
        .newInstance(raw, regAccess);
      m(c("net.minecraft.network.codec.StreamEncoder"), "encode", Object.class, Object.class)
        .invoke(codec, buf, stack);
      byte[] out = new byte[raw.readableBytes()];
      raw.getBytes(raw.readerIndex(), out);
      return HexFormat.of().formatHex(out);
    } finally {
      raw.release();
    }
  }

  static void emit(String name, Object trustedCodec, Object untrustedCodec, Object stack, Object regAccess) throws Exception {
    String trusted = encode(trustedCodec, stack, regAccess);
    String untrusted = encode(untrustedCodec, stack, regAccess);
    System.out.println("STACK " + name + " " + trusted + " " + untrusted);
  }

  public static void main(String[] args) throws Exception {
    loadMappings(Path.of(args[0]));
    m(c("net.minecraft.SharedConstants"), "tryDetectVersion").invoke(null);
    m(c("net.minecraft.server.Bootstrap"), "bootStrap").invoke(null);

    Object lookup = m(c("net.minecraft.data.registries.VanillaRegistries"), "createLookup").invoke(null);
    Object regAccess = registryAccess(lookup, Path.of(args[1]));

    Class<?> itemStackClass = c("net.minecraft.world.item.ItemStack");
    Class<?> itemLikeClass = c("net.minecraft.world.level.ItemLike");
    Class<?> itemsClass = c("net.minecraft.world.item.Items");
    Class<?> dcClass = c("net.minecraft.core.component.DataComponents");
    Class<?> dctClass = c("net.minecraft.core.component.DataComponentType");
    Class<?> componentClass = c("net.minecraft.network.chat.Component");

    Object empty = f(itemStackClass, "EMPTY").get(null);
    Object streamCodec = f(itemStackClass, "STREAM_CODEC").get(null);
    Object optStreamCodec = f(itemStackClass, "OPTIONAL_STREAM_CODEC").get(null);
    Object untrustedCodec = f(itemStackClass, "OPTIONAL_UNTRUSTED_STREAM_CODEC").get(null);

    Constructor<?> stackCtor = itemStackClass.getConstructor(itemLikeClass, int.class);
    Method setDamage = m(itemStackClass, "setDamageValue", int.class);
    Method setComp = m(itemStackClass, "set", dctClass, Object.class);
    Method removeComp = m(itemStackClass, "remove", dctClass);
    Method literal = m(componentClass, "literal", String.class);

    Object stoneItem = f(itemsClass, "STONE").get(null);
    Object diamondSwordItem = f(itemsClass, "DIAMOND_SWORD").get(null);
    Object bundleItem = f(itemsClass, "BUNDLE").get(null);

    Object dcCustomName = f(dcClass, "CUSTOM_NAME").get(null);
    Object dcRepairCost = f(dcClass, "REPAIR_COST").get(null);
    Object dcMaxStack = f(dcClass, "MAX_STACK_SIZE").get(null);
    Object dcBundleContents = f(dcClass, "BUNDLE_CONTENTS").get(null);
    Object dcKineticWeapon = f(dcClass, "KINETIC_WEAPON").get(null);
    Object dcEquippable = f(dcClass, "EQUIPPABLE").get(null);
    Object dcTooltipDisplay = f(dcClass, "TOOLTIP_DISPLAY").get(null);
    Object dcDamage = f(dcClass, "DAMAGE").get(null);
    Object dcEnchantments = f(dcClass, "ENCHANTMENTS").get(null);

    // 1. empty
    emit("empty", optStreamCodec, untrustedCodec, empty, regAccess);

    // 2. stone
    Object stone = stackCtor.newInstance(stoneItem, 1);
    emit("stone", streamCodec, untrustedCodec, stone, regAccess);

    // 3. damaged_sword
    Object sword = stackCtor.newInstance(diamondSwordItem, 1);
    setDamage.invoke(sword, 37);
    emit("damaged_sword", streamCodec, untrustedCodec, sword, regAccess);

    // 4. named_removed_sword (custom_name + removed repair_cost)
    Object named = stackCtor.newInstance(diamondSwordItem, 1);
    setDamage.invoke(named, 37);
    setComp.invoke(named, dcCustomName, literal.invoke(null, "Parity Blade"));
    removeComp.invoke(named, dcRepairCost);
    emit("named_removed_sword", streamCodec, untrustedCodec, named, regAccess);

    // 5. stone_remove_max_stack (removed max_stack_size)
    Object removedMax = stackCtor.newInstance(stoneItem, 1);
    removeComp.invoke(removedMax, dcMaxStack);
    emit("stone_remove_max_stack", streamCodec, untrustedCodec, removedMax, regAccess);

    // 6. bundle_nested (bundle_contents)
    Object nestedSword = stackCtor.newInstance(diamondSwordItem, 1);
    setDamage.invoke(nestedSword, 5);
    Object bundleContents = c("net.minecraft.world.item.component.BundleContents")
      .getConstructor(List.class)
      .newInstance(List.of(nestedSword));
    Object bundle = stackCtor.newInstance(bundleItem, 1);
    setComp.invoke(bundle, dcBundleContents, bundleContents);
    emit("bundle_nested", streamCodec, untrustedCodec, bundle, regAccess);

    // 7. kinetic_weapon
    Class<?> kwClass = c("net.minecraft.world.item.component.KineticWeapon");
    Class<?> kwCondClass = c("net.minecraft.world.item.component.KineticWeapon$Condition");
    Constructor<?> condCtor = kwCondClass.getConstructor(int.class, float.class, float.class);
    Object dismount = Optional.of(condCtor.newInstance(20, 1.5f, 0.5f));
    Object damageCond = Optional.of(condCtor.newInstance(15, 0.25f, 1.0f));
    Constructor<?> kwCtor = kwClass.getConstructor(
      int.class, int.class, Optional.class, Optional.class, Optional.class,
      float.class, float.class, Optional.class, Optional.class
    );
    Object kw = kwCtor.newInstance(10, 4, dismount, Optional.empty(), damageCond, 0.1f, 1.5f, Optional.empty(), Optional.empty());
    Object kineticStack = stackCtor.newInstance(stoneItem, 1);
    setComp.invoke(kineticStack, dcKineticWeapon, kw);
    emit("kinetic_weapon", streamCodec, untrustedCodec, kineticStack, regAccess);

    // 8. equippable
    Class<?> eqClass = c("net.minecraft.world.item.equipment.Equippable");
    Class<?> eqBuilderClass = c("net.minecraft.world.item.equipment.Equippable$Builder");
    Class<?> slotEnum = c("net.minecraft.world.entity.EquipmentSlot");
    Object headSlot = f(slotEnum, "HEAD").get(null);
    Object eqBuilder = m(eqClass, "builder", slotEnum).invoke(null, headSlot);
    m(eqBuilderClass, "setSwappable", boolean.class).invoke(eqBuilder, false);
    m(eqBuilderClass, "setCameraOverlay", c("net.minecraft.resources.Identifier"))
      .invoke(eqBuilder, id("minecraft:misc/pumpkinblur"));
    Object equippable = m(eqBuilderClass, "build").invoke(eqBuilder);
    Object equipStack = stackCtor.newInstance(stoneItem, 1);
    setComp.invoke(equipStack, dcEquippable, equippable);
    emit("equippable", streamCodec, untrustedCodec, equipStack, regAccess);

    // 9. tooltip_display
    Class<?> tdClass = c("net.minecraft.world.item.component.TooltipDisplay");
    Object td = f(tdClass, "DEFAULT").get(null);
    Method withHidden = m(tdClass, "withHidden", dctClass, boolean.class);
    td = withHidden.invoke(td, dcDamage, true);
    td = withHidden.invoke(td, dcEnchantments, true);
    Object tdStack = stackCtor.newInstance(diamondSwordItem, 1);
    setComp.invoke(tdStack, dcTooltipDisplay, td);
    emit("tooltip_display", streamCodec, untrustedCodec, tdStack, regAccess);
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

export async function stackFixtures(check = false) {
  verify(await readFile(join(cache, "client.jar")), target.downloads.client, "stack client jar");
  verify(await readFile(join(cache, "client.txt")), target.downloads.client_mappings, "stack client mappings");

  await rm(oracleDir, { recursive: true, force: true });
  await mkdir(oracleDir, { recursive: true });
  const javaPath = join(oracleDir, "StackOracle12111.java");
  const orderPath = join(oracleDir, "registry-order.json");
  await writeFile(javaPath, javaSource);

  const registryOrders = Object.fromEntries(
    Object.entries(KNOWN_PACK_774.registries).map(([key, entries]) => [key, entries.map((e) => e.key)])
  );
  assert.equal(Object.keys(registryOrders).length, 23, "Expected 23 registries in KNOWN_PACK_774");
  await writeFile(orderPath, JSON.stringify(registryOrders));

  const classpath = cleanClientClasspath();
  const result = run(
    process.env.JAVA || "java",
    ["-cp", classpath, resolve(javaPath), resolve(join(cache, "client.txt")), resolve(orderPath)]
  );

  const fixtures = {};
  for (const line of result.stdout.split(/\r?\n/)) {
    const match = line.match(/(?:\[STDOUT\]: )?STACK ([a-z0-9_]+) ([0-9a-f]+) ([0-9a-f]+)$/);
    if (match) {
      fixtures[match[1]] = { trusted: match[2], untrusted: match[3] };
    }
  }

  const expectedNames = [
    "empty",
    "stone",
    "damaged_sword",
    "named_removed_sword",
    "stone_remove_max_stack",
    "bundle_nested",
    "kinetic_weapon",
    "equippable",
    "tooltip_display"
  ];
  assert.deepEqual(Object.keys(fixtures), expectedNames, "Unexpected stack fixture keys");

  // Verify byte-identical roundtrips with readSlot774/writeSlot774 and readUntrustedSlot774/writeUntrustedSlot774
  for (const name of expectedNames) {
    const { trusted, untrusted } = fixtures[name];

    const trustedReader = new Reader(Buffer.from(trusted, "hex"));
    const decodedTrusted = readSlot774(trustedReader);
    assert.equal(trustedReader.remaining(), 0, "Trailing trusted bytes for " + name);
    const reencodedTrusted = Buffer.from(writeSlot774(new Writer(), decodedTrusted).build()).toString("hex");
    assert.equal(reencodedTrusted, trusted, "Trusted Slot byte mismatch for " + name);

    const untrustedReader = new Reader(Buffer.from(untrusted, "hex"));
    const decodedUntrusted = readUntrustedSlot774(untrustedReader);
    assert.equal(untrustedReader.remaining(), 0, "Trailing untrusted bytes for " + name);
    const reencodedUntrusted = Buffer.from(writeUntrustedSlot774(new Writer(), decodedUntrusted).build()).toString("hex");
    assert.equal(reencodedUntrusted, untrusted, "UntrustedSlot byte mismatch for " + name);
  }

  const output = {
    minecraftVersion: target.minecraftVersion,
    protocol: target.protocol,
    clientSha1: target.downloads.client.sha1,
    registryCount: Object.keys(registryOrders).length,
    fixtures
  };

  if (check) {
    assert.deepEqual(output, JSON.parse(await readFile(fixtureUrl, "utf8")), "Native 1.21.11 stack fixtures differ");
    console.log("Verified " + expectedNames.length + " native ItemStack fixtures (trusted + untrusted byte-identical roundtrips)");
  } else {
    await writeFile(fixtureUrl, JSON.stringify(output, null, 2) + "\n");
    console.log("Recorded " + expectedNames.length + " native ItemStack fixtures (trusted + untrusted byte-identical roundtrips)");
  }
  return output;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await stackFixtures(process.argv.includes("--check"));
}
