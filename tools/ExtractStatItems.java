// Native Block.asItem() / BlockItem.getBlock() pairs whose names differ, for the statistics item list.
// Usage: java -cp <client.jar + libraries> ExtractStatItems.java <client.txt mappings>
import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;

public class ExtractStatItems {
  static final Map<String,String> classes = new HashMap<>();
  static final Map<String,Map<String,String>> fields = new HashMap<>(), methods = new HashMap<>();

  static void load(Path p) throws Exception {
    String cur = null;
    for (String line : Files.readAllLines(p)) {
      if (line.startsWith("#") || line.isBlank()) continue;
      if (!line.startsWith(" ")) { String[] a = line.substring(0, line.length() - 1).split(" -> "); cur = a[0]; classes.put(a[0], a[1]); continue; }
      String[] a = line.trim().split(" -> "); String left = a[0].replaceAll("^\\d+:\\d+:", "");
      if (left.contains("(")) { String name = left.substring(left.indexOf(' ') + 1, left.indexOf('(')); methods.computeIfAbsent(cur, k -> new HashMap<>()).putIfAbsent(name, a[1]); }
      else fields.computeIfAbsent(cur, k -> new HashMap<>()).put(left.substring(left.indexOf(' ') + 1), a[1]);
    }
  }
  static Class<?> c(String name) throws Exception { return Class.forName(classes.get(name)); }
  static boolean has(String name) { return classes.containsKey(name); }
  static Method m(String cls, String name, Class<?>... args) throws Exception {
    Method x = c(cls).getDeclaredMethod(methods.get(cls).get(name), args); x.setAccessible(true); return x;
  }
  static Object f(String cls, String name) throws Exception { Field x = c(cls).getDeclaredField(fields.get(cls).get(name)); x.setAccessible(true); return x.get(null); }

  public static void main(String[] args) throws Exception {
    load(Path.of(args[0]));
    if (has("net.minecraft.SharedConstants") && methods.get("net.minecraft.SharedConstants").containsKey("tryDetectVersion")) m("net.minecraft.SharedConstants", "tryDetectVersion").invoke(null);
    m("net.minecraft.server.Bootstrap", "bootStrap").invoke(null);
    String regs = has("net.minecraft.core.registries.BuiltInRegistries") ? "net.minecraft.core.registries.BuiltInRegistries" : "net.minecraft.core.Registry";
    Object blocks = f(regs, "BLOCK"), items = f(regs, "ITEM");
    Class<?> registry = c("net.minecraft.core.Registry");
    Method getKey = null;
    Class<?> rl = c(has("net.minecraft.resources.ResourceLocation") ? "net.minecraft.resources.ResourceLocation" : "net.minecraft.resources.Identifier");
    for (Method x : registry.getMethods()) if (x.getParameterCount() == 1 && x.getParameterTypes()[0] == Object.class && x.getReturnType() == rl && !Modifier.isStatic(x.getModifiers())) { getKey = x; break; }
    Method asItem = m("net.minecraft.world.level.block.Block", "asItem");
    Class<?> blockItem = c("net.minecraft.world.item.BlockItem");
    Method getBlock = m("net.minecraft.world.item.BlockItem", "getBlock");
    StringBuilder out = new StringBuilder("{\"blockToItem\":{");
    boolean first = true;
    for (Object b : (Iterable<?>) blocks) {
      String bn = getKey.invoke(blocks, b).toString().replace("minecraft:", ""), in = getKey.invoke(items, asItem.invoke(b)).toString().replace("minecraft:", "");
      if (bn.equals(in)) continue;
      out.append(first ? "" : ",").append('"').append(bn).append("\":\"").append(in).append('"'); first = false;
    }
    out.append("},\"itemToBlock\":{"); first = true;
    for (Object i : (Iterable<?>) items) {
      String in = getKey.invoke(items, i).toString().replace("minecraft:", "");
      String bn = blockItem.isInstance(i) ? getKey.invoke(blocks, getBlock.invoke(i)).toString().replace("minecraft:", "") : null;
      if (in.equals(bn)) continue;
      // Only record items that are block items under another name, or non-block items that share a block's name.
      boolean sharesBlockName = false; for (Object b : (Iterable<?>) blocks) if (getKey.invoke(blocks, b).toString().equals("minecraft:" + in)) { sharesBlockName = true; break; }
      if (bn == null && !sharesBlockName) continue;
      out.append(first ? "" : ",").append('"').append(in).append("\":").append(bn == null ? "null" : "\"" + bn + "\""); first = false;
    }
    System.out.println(out.append("}}"));
  }
}
