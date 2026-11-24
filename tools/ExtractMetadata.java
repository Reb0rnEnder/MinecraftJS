// Native EntityDataAccessor ids per entity type, for any Mojang-mapped release (1.14.4+).
// Usage: java -cp <client.jar + libraries> ExtractMetadata.java <client.txt mappings>
import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;

public class ExtractMetadata {
  static final Map<String,String> classes = new HashMap<>(), reverse = new HashMap<>();
  static final Map<String,Map<String,String>> fields = new HashMap<>(), methods = new HashMap<>();
  static void load(Path p) throws Exception {
    String cur = null;
    for (String line : Files.readAllLines(p)) {
      if (line.startsWith("#") || line.isBlank()) continue;
      if (!line.startsWith(" ")) { String[] a = line.substring(0, line.length() - 1).split(" -> "); cur = a[0]; classes.put(a[0], a[1]); reverse.put(a[1], a[0]); continue; }
      String[] a = line.trim().split(" -> "); String left = a[0].replaceAll("^\\d+:\\d+:", "");
      if (left.contains("(")) { String name = left.substring(left.indexOf(' ') + 1, left.indexOf('(')); methods.computeIfAbsent(cur, k -> new HashMap<>()).putIfAbsent(name, a[1]); }
      else fields.computeIfAbsent(cur, k -> new HashMap<>()).put(left.substring(left.indexOf(' ') + 1), a[1]);
    }
  }
  static Class<?> c(String name) throws Exception { return Class.forName(classes.get(name)); }
  static boolean has(String name) { return classes.containsKey(name); }
  static Object sf(String cls, String name) throws Exception { Field x = c(cls).getDeclaredField(fields.get(cls).get(name)); x.setAccessible(true); return x.get(null); }
  public static void main(String[] args) throws Exception {
    load(Path.of(args[0]));
    if (has("net.minecraft.SharedConstants") && methods.get("net.minecraft.SharedConstants").containsKey("tryDetectVersion")) { Method m = c("net.minecraft.SharedConstants").getDeclaredMethod(methods.get("net.minecraft.SharedConstants").get("tryDetectVersion")); m.setAccessible(true); m.invoke(null); }
    Method boot = c("net.minecraft.server.Bootstrap").getDeclaredMethod(methods.get("net.minecraft.server.Bootstrap").get("bootStrap")); boot.setAccessible(true); boot.invoke(null);
    String regs = has("net.minecraft.core.registries.BuiltInRegistries") ? "net.minecraft.core.registries.BuiltInRegistries" : "net.minecraft.core.Registry";
    Object registry = sf(regs, "ENTITY_TYPE");
    Class<?> rl = c("net.minecraft.resources.ResourceLocation"), types = c("net.minecraft.world.entity.EntityType"), accessor = c("net.minecraft.network.syncher.EntityDataAccessor");
    Method getKey = null; for (Method x : c("net.minecraft.core.Registry").getMethods()) if (x.getParameterCount() == 1 && x.getParameterTypes()[0] == Object.class && x.getReturnType() == rl && !Modifier.isStatic(x.getModifiers())) { getKey = x; break; }
    Field idField = accessor.getDeclaredField(fields.get("net.minecraft.network.syncher.EntityDataAccessor").get("id")); idField.setAccessible(true);
    StringBuilder out = new StringBuilder("{"); boolean first = true;
    for (Field field : types.getDeclaredFields()) {
      if (!Modifier.isStatic(field.getModifiers()) || field.getType() != types || !(field.getGenericType() instanceof ParameterizedType pt)) continue;
      if (!(pt.getActualTypeArguments()[0] instanceof Class<?> cls)) continue;
      field.setAccessible(true); String name = getKey.invoke(registry, field.get(null)).toString().replace("minecraft:", "");
      TreeMap<String,Integer> ids = new TreeMap<>();
      for (Class<?> k = cls; k != null; k = k.getSuperclass()) {
        String mojang = reverse.get(k.getName()); if (mojang == null) continue;
        for (Map.Entry<String,String> f : fields.getOrDefault(mojang, Map.of()).entrySet()) {
          Field df; try { df = k.getDeclaredField(f.getValue()); } catch (NoSuchFieldException e) { continue; }
          if (!Modifier.isStatic(df.getModifiers()) || df.getType() != accessor) continue;
          df.setAccessible(true); ids.put(f.getKey(), idField.getInt(df.get(null)));
        }
      }
      out.append(first ? "" : ",").append('"').append(name).append("\":{"); first = false;
      boolean f2 = true; for (var e : ids.entrySet()) { out.append(f2 ? "" : ",").append('"').append(e.getKey()).append("\":").append(e.getValue()); f2 = false; }
      out.append('}');
    }
    System.out.println(out.append('}'));
  }
}
