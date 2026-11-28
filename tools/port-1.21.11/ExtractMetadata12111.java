import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;
import com.google.gson.*;

// Native 1.21.11 EntityDataAccessor IDs and EntityType dimensions from the pinned client jar.
public class ExtractMetadata12111 {
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
          methodNames.computeIfAbsent(owner, k -> new HashMap<>()).put(member.substring(0, member.indexOf(')') + 1), p[1]);
        } else {
          fieldNames.computeIfAbsent(owner, k -> new HashMap<>()).put(member, p[1]);
        }
      }
    }
  }

  static String original(Class<?> c) {
    return originalNames.getOrDefault(c.getName(), c.getName());
  }

  static Class<?> c(String name) throws Exception {
    return Class.forName(classNames.getOrDefault(name, name));
  }

  static Method m(Class<?> c, String name, Class<?>... args) throws Exception {
    String key = name + "(" + String.join(",", Arrays.stream(args).map(ExtractMetadata12111::original).toArray(String[]::new)) + ")";
    for (Class<?> k = c; k != null; k = k.getSuperclass()) {
      String alias = methodNames.getOrDefault(original(k), Map.of()).get(key);
      if (alias == null) continue;
      Method result = k.getDeclaredMethod(alias, args);
      result.setAccessible(true);
      return result;
    }
    return c.getMethod(name, args);
  }

  static Field f(Class<?> c, String name) throws Exception {
    for (Class<?> k = c; k != null; k = k.getSuperclass()) {
      String alias = fieldNames.getOrDefault(original(k), Map.of()).get(name);
      if (alias == null) continue;
      Field result = k.getDeclaredField(alias);
      result.setAccessible(true);
      return result;
    }
    return c.getField(name);
  }

  static Object call(Object o, String name, Class<?>[] types, Object... args) throws Exception {
    return m(o.getClass(), name, types).invoke(o, args);
  }

  static Map<String, Object> accessors(Class<?> type) throws Exception {
    Map<String, Object> out = new TreeMap<>();
    Class<?> accessorClass = c("net.minecraft.network.syncher.EntityDataAccessor");
    for (Class<?> k = type; k != null; k = k.getSuperclass()) {
      for (var entry : fieldNames.getOrDefault(original(k), Map.of()).entrySet()) {
        Field field = k.getDeclaredField(entry.getValue());
        if (Modifier.isStatic(field.getModifiers()) && field.getType() == accessorClass) {
          field.setAccessible(true);
          out.put(entry.getKey(), field.get(null));
        }
      }
    }
    return out;
  }

  public static void main(String[] args) throws Exception {
    loadMappings(Path.of(args[1]));
    m(c("net.minecraft.SharedConstants"), "tryDetectVersion").invoke(null);
    m(c("net.minecraft.server.Bootstrap"), "bootStrap").invoke(null);

    Class<?> types = c("net.minecraft.world.entity.EntityType");
    Object registry = f(c("net.minecraft.core.registries.BuiltInRegistries"), "ENTITY_TYPE").get(null);
    Class<?> idClass = c("net.minecraft.resources.Identifier");
    Method getKey = null;
    for (Method x : c("net.minecraft.core.Registry").getMethods()) {
      if (x.getParameterCount() == 1 && x.getParameterTypes()[0] == Object.class && x.getReturnType() == idClass) {
        getKey = x;
        break;
      }
    }
    if (getKey == null) throw new IllegalStateException("Missing Registry.getKey(Object) -> Identifier");

    Map<String, Object> metadata = new TreeMap<>();
    for (Field field : types.getDeclaredFields()) {
      if (!Modifier.isStatic(field.getModifiers()) || field.getType() != types ||
          !(field.getGenericType() instanceof ParameterizedType pt)) {
        continue;
      }
      Type arg = pt.getActualTypeArguments()[0];
      if (!(arg instanceof Class<?> cls)) continue;
      field.setAccessible(true);
      Object entityType = field.get(null);
      String name = getKey.invoke(registry, entityType).toString().replace("minecraft:", "");
      Map<String, Object> ids = new TreeMap<>();
      for (var e : accessors(cls).entrySet()) {
        ids.put(e.getKey(), ((Number) call(e.getValue(), "id", new Class<?>[]{})).intValue());
      }
      metadata.put(name, ids);
    }

    List<Object> entities = new ArrayList<>();
    for (Object entityType : (Iterable<?>) registry) {
      String name = getKey.invoke(registry, entityType).toString().replace("minecraft:", "");
      Object dims = call(entityType, "getDimensions", new Class<?>[]{});
      float width = f(dims.getClass(), "width").getFloat(dims);
      float height = f(dims.getClass(), "height").getFloat(dims);
      entities.add(List.of(name, width, height));
    }

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("metadata", metadata);
    out.put("entities", entities);
    Files.writeString(Path.of(args[0]), new GsonBuilder().disableHtmlEscaping().create().toJson(out));
  }
}
