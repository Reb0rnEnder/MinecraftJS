import java.io.*;
import java.lang.reflect.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import com.google.gson.*;

//// Target-native 1.21.11 placement support predicates. Reflection uses official mappings.
public class ExtractSupport12111 {
  static Map<String,String> classNames = new HashMap<>(), originalNames = new HashMap<>();
  static Map<String,Map<String,String>> methodNames = new HashMap<>(), fieldNames = new HashMap<>();

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
    String key = name + "(" + String.join(",", Arrays.stream(args).map(ExtractSupport12111::original).toArray(String[]::new)) + ")";
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

  static Set<Object> blockTag(String id, Object registry, Method getValue, Method parseId, Map<String,Set<Object>> memo) throws Exception {
    if (memo.containsKey(id)) return memo.get(id);
    Set<Object> values = new LinkedHashSet<>();
    memo.put(id, values);
    String[] key = id.split(":", 2);
    String name = "data/" + key[0] + "/tags/block/" + key[1] + ".json";
    InputStream resource = ExtractSupport12111.class.getClassLoader().getResourceAsStream(name);
    for (String pack : new String[]{"minecart_improvements", "redstone_experiments", "trade_rebalance"}) {
      if (resource == null) {
        resource = ExtractSupport12111.class.getClassLoader().getResourceAsStream("data/minecraft/datapacks/" + pack + "/" + name);
      }
    }
    try (InputStream input = resource) {
      if (input == null) throw new FileNotFoundException(name);
      JsonObject definition = JsonParser.parseReader(new InputStreamReader(input, StandardCharsets.UTF_8)).getAsJsonObject();
      for (JsonElement el : definition.getAsJsonArray("values")) {
        String value = el.isJsonObject() ? el.getAsJsonObject().get("id").getAsString() : el.getAsString();
        boolean required = !el.isJsonObject() || !el.getAsJsonObject().has("required") || el.getAsJsonObject().get("required").getAsBoolean();
        if (value.startsWith("#")) {
          values.addAll(blockTag(value.substring(1), registry, getValue, parseId, memo));
        } else {
          Object block = getValue.invoke(registry, parseId.invoke(null, value));
          if (block != null) values.add(block);
          else if (required) throw new IllegalStateException("Missing block in tag " + id + ": " + value);
        }
      }
    }
    return values;
  }

  public static void main(String[] args) throws Exception {
    loadMappings(Path.of(args[1]));
    int stateCount = Integer.parseInt(args[2]);

    m(c("net.minecraft.SharedConstants"), "tryDetectVersion").invoke(null);
    m(c("net.minecraft.server.Bootstrap"), "bootStrap").invoke(null);

    Class<?> block = c("net.minecraft.world.level.block.Block");
    Class<?> state = c("net.minecraft.world.level.block.state.BlockState");
    Class<?> access = c("net.minecraft.world.level.BlockGetter");
    Class<?> reader = c("net.minecraft.world.level.LevelReader");
    Class<?> heightAccess = c("net.minecraft.world.level.LevelHeightAccessor");
    Class<?> pos = c("net.minecraft.core.BlockPos");
    Class<?> dir = c("net.minecraft.core.Direction");
    Class<?> registryClass = c("net.minecraft.core.Registry");
    Class<?> identifierClass = c("net.minecraft.resources.Identifier");

    Object origin = pos.getConstructor(int.class, int.class, int.class).newInstance(0, 0, 0);
    Method stateById = m(block, "stateById", int.class);
    Object air = stateById.invoke(null, 0);
    final Object[] current = { air };
    String minYName = m(heightAccess, "getMinY").getName();

    Object world = Proxy.newProxyInstance(reader.getClassLoader(), new Class[]{reader}, (o, method, a) -> {
      Object s = a != null && a.length > 0 && origin.equals(a[0]) ? current[0] : air;
      if (method.getReturnType() == state) return s;
      if (method.getReturnType() == boolean.class) return false;
      if (method.getReturnType() == int.class) return method.getName().equals(minYName) ? 0 : 256;
      return null;
    });

    Object registry = f(c("net.minecraft.core.registries.BuiltInRegistries"), "BLOCK").get(null);
    Method getValue = m(registryClass, "getValue", identifierClass);
    Method parseId = m(identifierClass, "parse", String.class);
    Method getId = m(registryClass, "getId", Object.class);
    Method getById = m(registryClass, "get", int.class);
    Method tagLocation = m(c("net.minecraft.tags.TagKey"), "location");

    Map<String,Set<Object>> tags = new LinkedHashMap<>();
    Map<Object,List<Object>> bindings = new LinkedHashMap<>();
    for (Field tf : c("net.minecraft.tags.BlockTags").getDeclaredFields()) {
      if (Modifier.isStatic(tf.getModifiers()) && tf.getType() == c("net.minecraft.tags.TagKey")) {
        tf.setAccessible(true);
        Object key = tf.get(null);
        String name = tagLocation.invoke(key).toString();
        List<Object> holders = new ArrayList<>();
        for (Object value : blockTag(name, registry, getValue, parseId, tags)) {
          int id = (int) getId.invoke(registry, value);
          holders.add(((Optional<?>) getById.invoke(registry, id)).orElseThrow());
        }
        bindings.put(key, holders);
      }
    }
    Object regKey = m(registryClass, "key").invoke(registry);
    Constructor<?> loadResultCtor = c("net.minecraft.tags.TagLoader$LoadResult")
      .getDeclaredConstructor(c("net.minecraft.resources.ResourceKey"), Map.class);
    loadResultCtor.setAccessible(true);
    Object loadResult = loadResultCtor.newInstance(regKey, bindings);
    Object pending = m(registryClass, "prepareTagReload", c("net.minecraft.tags.TagLoader$LoadResult")).invoke(registry, loadResult);
    m(c("net.minecraft.core.Registry$PendingTags"), "apply").invoke(pending);

    Method center = m(block, "canSupportCenter", reader, pos, dir);
    Method full = m(state, "isFaceSturdy", access, pos, dir);
    Object[] directions = (Object[]) m(dir, "values").invoke(null);
    List<Object> result = new ArrayList<>();
    for (int id = 0; id < stateCount; id++) {
      Object s = stateById.invoke(null, id);
      current[0] = s;
      int centers = 0, faces = 0;
      for (int i = 0; i < directions.length; i++) {
        if ((boolean) center.invoke(null, world, origin, directions[i])) centers |= 1 << i;
        if ((boolean) full.invoke(s, world, origin, directions[i])) faces |= 1 << i;
      }
      result.add(Arrays.asList(centers, faces));
    }
    Files.writeString(Path.of(args[0]), new Gson().toJson(result));
    System.out.println("Native 1.21.11 support states: " + result.size());
  }
}
