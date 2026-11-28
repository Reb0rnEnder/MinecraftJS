import com.google.gson.GsonBuilder;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.mojang.serialization.Lifecycle;
import io.netty.buffer.ByteBuf;
import io.netty.buffer.Unpooled;
import java.io.FileNotFoundException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.Reader;
import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.IdentityHashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Queue;
import java.util.Set;
import java.util.stream.Stream;

// Exact native 1.21.11 creative population; stacks use the target's real ItemStack.STREAM_CODEC.
public class ExtractCreative12111 {
  static final Map<String, String> classNames = new HashMap<>();
  static final Map<String, String> originalNames = new HashMap<>();
  static final Map<String, Map<String, String>> methodNames = new HashMap<>();
  static final Map<String, Map<String, String>> fieldNames = new HashMap<>();

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
            .putIfAbsent(member.substring(0, member.indexOf(')') + 1), p[1]);
        } else {
          fieldNames.computeIfAbsent(owner, k -> new HashMap<>()).putIfAbsent(member, p[1]);
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
    String key = name + "(" + String.join(",", Arrays.stream(args).map(ExtractCreative12111::original).toArray(String[]::new)) + ")";
    Queue<Class<?>> queue = new ArrayDeque<>();
    Set<Class<?>> seen = new HashSet<>();
    queue.add(c);
    while (!queue.isEmpty()) {
      Class<?> k = queue.poll();
      if (!seen.add(k)) continue;
      String alias = methodNames.getOrDefault(original(k), Map.of()).get(key);
      if (alias != null) {
        try {
          Method result = k.getDeclaredMethod(alias, args);
          result.setAccessible(true);
          return result;
        } catch (NoSuchMethodException ignored) {}
      }
      if (k.getSuperclass() != null) queue.add(k.getSuperclass());
      queue.addAll(Arrays.asList(k.getInterfaces()));
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

  static Object id(String name) throws Exception {
    return m(c("net.minecraft.resources.Identifier"), "parse", String.class).invoke(null, name);
  }

  static final Map<Object, List<Object>> holderTags = new IdentityHashMap<>();

  static Object tag(Object lookup, Object key, Map<Object, Object> cache) throws Exception {
    if (cache.containsKey(key)) return cache.get(key);
    Class<?> tagKeyClass = c("net.minecraft.tags.TagKey");
    Class<?> resourceKeyClass = c("net.minecraft.resources.ResourceKey");
    Class<?> identifierClass = c("net.minecraft.resources.Identifier");
    Object registry = m(tagKeyClass, "registry").invoke(key);
    Object loc = m(tagKeyClass, "location").invoke(key);
    String type = m(resourceKeyClass, "identifier").invoke(registry).toString().split(":", 2)[1];
    String[] path = loc.toString().split(":", 2);
    String resource = "data/" + path[0] + "/tags/" + type + "/" + path[1] + ".json";
    InputStream input = ExtractCreative12111.class.getClassLoader().getResourceAsStream(resource);
    if (input == null) throw new FileNotFoundException(resource);
    LinkedHashSet<Object> holders = new LinkedHashSet<>();
    try (Reader reader = new InputStreamReader(input, StandardCharsets.UTF_8)) {
      for (JsonElement entry : JsonParser.parseReader(reader).getAsJsonObject().getAsJsonArray("values")) {
        String name = entry.isJsonObject() ? entry.getAsJsonObject().get("id").getAsString() : entry.getAsString();
        Object entryId = id(name.startsWith("#") ? name.substring(1) : name);
        if (name.startsWith("#")) {
          Object nested = m(tagKeyClass, "create", resourceKeyClass, identifierClass).invoke(null, registry, entryId);
          for (Object holder : (Iterable<?>) tag(lookup, nested, cache)) holders.add(holder);
        } else {
          Object itemKey = m(resourceKeyClass, "create", resourceKeyClass, identifierClass).invoke(null, registry, entryId);
          holders.add(m(c("net.minecraft.core.HolderGetter"), "getOrThrow", resourceKeyClass).invoke(lookup, itemKey));
        }
      }
    }
    Constructor<?> constructor = c("net.minecraft.core.HolderSet$Named")
      .getDeclaredConstructor(c("net.minecraft.core.HolderOwner"), tagKeyClass);
    constructor.setAccessible(true);
    Object set = constructor.newInstance(lookup, key);
    m(set.getClass(), "bind", List.class).invoke(set, List.copyOf(holders));
    cache.put(key, set);
    for (Object holder : holders) holderTags.computeIfAbsent(holder, h -> new ArrayList<>()).add(key);
    return set;
  }

  static Object taggedLookup(Object provider, Path orderPath) throws Exception {
    Map<Object, Object> lookups = new HashMap<>();
    Class<?> lookupType = c("net.minecraft.core.HolderLookup$RegistryLookup");
    Class<?> providerType = c("net.minecraft.core.HolderLookup$Provider");
    Class<?> resourceKeyClass = c("net.minecraft.resources.ResourceKey");
    Class<?> identifierClass = c("net.minecraft.resources.Identifier");
    Class<?> tagKeyClass = c("net.minecraft.tags.TagKey");
    Method lookupOrThrow = m(providerType, "lookupOrThrow", resourceKeyClass);
    Method createRegistryKey = m(resourceKeyClass, "createRegistryKey", identifierClass);
    Method tagCreate = m(tagKeyClass, "create", resourceKeyClass, identifierClass);
    Method listElements = m(c("net.minecraft.core.HolderLookup"), "listElements");
    Method holderKey = m(c("net.minecraft.core.Holder$Reference"), "key");
    Method rkId = m(resourceKeyClass, "identifier");
    JsonObject orders = JsonParser.parseString(Files.readString(orderPath)).getAsJsonObject();

    for (String[] pair : new String[][]{{"instrument", "goat_horns"}, {"painting_variant", "placeable"}, {"enchantment", null}}) {
      Object registry = createRegistryKey.invoke(null, id("minecraft:" + pair[0]));
      Object lookup = lookupOrThrow.invoke(provider, registry);
      for (Object holder : ((Stream<?>) listElements.invoke(lookup)).toList()) {
        holderTags.computeIfAbsent(holder, h -> new ArrayList<>());
      }
      Map<String, Integer> orderMap = new HashMap<>();
      if (orders.has("minecraft:" + pair[0])) {
        int idx = 0;
        for (JsonElement el : orders.getAsJsonArray("minecraft:" + pair[0])) {
          orderMap.put(el.getAsString(), idx++);
        }
      }
      Map<Object, Object> tags = new HashMap<>();
      if (pair[1] != null) {
        Object key = tagCreate.invoke(null, registry, id("minecraft:" + pair[1]));
        tag(lookup, key, tags);
      }
      Object wrapper = Proxy.newProxyInstance(lookupType.getClassLoader(), new Class<?>[]{lookupType}, (proxy, method, args) -> {
        if (args != null && args.length == 1 && method.getReturnType() == Optional.class && tagKeyClass.isInstance(args[0])) {
          return tags.containsKey(args[0]) ? Optional.of(tags.get(args[0])) : Optional.of(tag(lookup, args[0], tags));
        }
        if ((args == null || args.length == 0) && method.getReturnType() == Stream.class && method.getName().equals(listElements.getName())) {
          List<Object> sorted = new ArrayList<>(((Stream<?>) method.invoke(lookup, args)).toList());
          sorted.sort((a, b) -> {
            try {
              String ka = rkId.invoke(holderKey.invoke(a)).toString();
              String kb = rkId.invoke(holderKey.invoke(b)).toString();
              int ia = orderMap.getOrDefault(ka, Integer.MAX_VALUE);
              int ib = orderMap.getOrDefault(kb, Integer.MAX_VALUE);
              return ia != ib ? Integer.compare(ia, ib) : ka.compareTo(kb);
            } catch (Exception e) {
              throw new RuntimeException(e);
            }
          });
          return sorted.stream();
        }
        if (method.isDefault()) return InvocationHandler.invokeDefault(proxy, method, args);
        return method.invoke(lookup, args);
      });
      lookups.put(registry, wrapper);
    }
    Method bindTags = m(c("net.minecraft.core.Holder$Reference"), "bindTags", Collection.class);
    for (Map.Entry<Object, List<Object>> entry : holderTags.entrySet()) {
      bindTags.invoke(entry.getKey(), entry.getValue());
    }
    return Proxy.newProxyInstance(providerType.getClassLoader(), new Class<?>[]{providerType}, (proxy, method, args) -> {
      if (method.isDefault()) return InvocationHandler.invokeDefault(proxy, method, args);
      if (args != null && args.length == 1 && lookups.containsKey(args[0])) return Optional.of(lookups.get(args[0]));
      return method.invoke(provider, args);
    });
  }

  static Object stackRegistries;
  static Object itemStackStreamCodec;
  static Constructor<?> registryBufConstructor;
  static Method streamEncode;

  static Object registryAccess(Object lookup, Path orderPath) throws Exception {
    Class<?> registryAccessClass = c("net.minecraft.core.RegistryAccess");
    Class<?> registryEntryClass = c("net.minecraft.core.RegistryAccess$RegistryEntry");
    Class<?> resourceKeyClass = c("net.minecraft.resources.ResourceKey");
    Class<?> identifierClass = c("net.minecraft.resources.Identifier");
    Class<?> mappedRegistryClass = c("net.minecraft.core.MappedRegistry");
    Class<?> regInfoClass = c("net.minecraft.core.RegistrationInfo");

    Object builtInRoot = f(c("net.minecraft.core.registries.BuiltInRegistries"), "REGISTRY").get(null);
    Object base = m(registryAccessClass, "fromRegistryOfRegistries", c("net.minecraft.core.Registry")).invoke(null, builtInRoot);
    Map<Object, Object> registries = new LinkedHashMap<>();
    Method entryKey = m(registryEntryClass, "key");
    Method entryValue = m(registryEntryClass, "value");
    for (Object entry : ((Stream<?>) m(registryAccessClass, "registries").invoke(base)).toList()) {
      registries.put(entryKey.invoke(entry), entryValue.invoke(entry));
    }

    Method createRegistryKey = m(resourceKeyClass, "createRegistryKey", identifierClass);
    Method createKey = m(resourceKeyClass, "create", resourceKeyClass, identifierClass);
    Method lookupOrThrow = m(c("net.minecraft.core.HolderLookup$Provider"), "lookupOrThrow", resourceKeyClass);
    Method getOrThrow = m(c("net.minecraft.core.HolderGetter"), "getOrThrow", resourceKeyClass);
    Method holderValue = m(c("net.minecraft.core.Holder"), "value");
    Method registerMethod = m(mappedRegistryClass, "register", resourceKeyClass, Object.class, regInfoClass);
    Method freezeMethod = m(c("net.minecraft.core.Registry"), "freeze");
    Object builtInInfo = f(regInfoClass, "BUILT_IN").get(null);
    Constructor<?> mappedRegCtor = mappedRegistryClass.getConstructor(resourceKeyClass, Lifecycle.class);

    JsonObject orders = JsonParser.parseString(Files.readString(orderPath)).getAsJsonObject();
    for (Map.Entry<String, JsonElement> entry : orders.entrySet()) {
      Object registryKey = createRegistryKey.invoke(null, id(entry.getKey()));
      Object source = lookupOrThrow.invoke(lookup, registryKey);
      Object registry = mappedRegCtor.newInstance(registryKey, Lifecycle.stable());
      for (JsonElement elem : entry.getValue().getAsJsonArray()) {
        Object key = createKey.invoke(null, registryKey, id(elem.getAsString()));
        Object holder = getOrThrow.invoke(source, key);
        Object value = holderValue.invoke(holder);
        registerMethod.invoke(registry, key, value, builtInInfo);
      }
      freezeMethod.invoke(registry);
      registries.put(registryKey, registry);
    }
    return c("net.minecraft.core.RegistryAccess$ImmutableRegistryAccess").getConstructor(Map.class).newInstance(registries);
  }

  static String stack(Object itemStack) throws Exception {
    ByteBuf raw = Unpooled.buffer();
    try {
      Object buf = registryBufConstructor.newInstance(raw, stackRegistries);
      streamEncode.invoke(itemStackStreamCodec, buf, itemStack);
      byte[] bytes = new byte[raw.readableBytes()];
      raw.getBytes(raw.readerIndex(), bytes);
      return Base64.getEncoder().encodeToString(bytes);
    } finally {
      raw.release();
    }
  }

  public static void main(String[] args) throws Exception {
    loadMappings(Path.of(args[1]));
    m(c("net.minecraft.SharedConstants"), "tryDetectVersion").invoke(null);
    m(c("net.minecraft.server.Bootstrap"), "bootStrap").invoke(null);

    Object lookup = taggedLookup(m(c("net.minecraft.data.registries.VanillaRegistries"), "createLookup").invoke(null), Path.of(args[2]));
    Object flagRegistry = f(c("net.minecraft.world.flag.FeatureFlags"), "REGISTRY").get(null);
    stackRegistries = registryAccess(lookup, Path.of(args[2]));
    itemStackStreamCodec = f(c("net.minecraft.world.item.ItemStack"), "STREAM_CODEC").get(null);
    registryBufConstructor = c("net.minecraft.network.RegistryFriendlyByteBuf")
      .getConstructor(ByteBuf.class, c("net.minecraft.core.RegistryAccess"));
    streamEncode = m(c("net.minecraft.network.codec.StreamEncoder"), "encode", Object.class, Object.class);

    Class<?> tabs = c("net.minecraft.world.item.CreativeModeTab");
    Class<?> allTabs = c("net.minecraft.world.item.CreativeModeTabs");
    Class<?> featureFlagSet = c("net.minecraft.world.flag.FeatureFlagSet");
    Class<?> providerType = c("net.minecraft.core.HolderLookup$Provider");
    Method fromNames = m(c("net.minecraft.world.flag.FeatureFlagRegistry"), "fromNames", Iterable.class);
    Method tryRebuild = m(allTabs, "tryRebuildTabContents", featureFlagSet, boolean.class, providerType);
    Method getAllTabs = m(allTabs, "allTabs");
    Method getDisplayName = m(tabs, "getDisplayName");
    Method getContents = m(c("net.minecraft.network.chat.Component"), "getContents");
    Method getKey = m(c("net.minecraft.network.chat.contents.TranslatableContents"), "getKey");
    Method getDisplayItems = m(tabs, "getDisplayItems");
    Method getIconItem = m(tabs, "getIconItem");
    Method showTitle = m(tabs, "showTitle");
    Method canScroll = m(tabs, "canScroll");
    Method column = m(tabs, "column");
    Method rowMethod = m(tabs, "row");
    Method isAlignedRight = m(tabs, "isAlignedRight");
    Method getType = m(tabs, "getType");
    Method getBackgroundTexture = m(tabs, "getBackgroundTexture");
    Method getPath = m(c("net.minecraft.resources.Identifier"), "getPath");

    String[] experimental = {"minecraft:trade_rebalance", "minecraft:redstone_experiments", "minecraft:minecart_improvements"};
    List<Object> catalogs = new ArrayList<>();
    for (int mask = 0; mask < 8; mask++) {
      List<Object> requested = new ArrayList<>();
      requested.add(id("minecraft:vanilla"));
      for (int bit = 0; bit < 3; bit++) {
        if ((mask & (1 << bit)) != 0) requested.add(id(experimental[bit]));
      }
      Object features = fromNames.invoke(flagRegistry, requested);
      Map<String, Object> catalog = new LinkedHashMap<>();
      catalog.put("mask", mask);
      for (boolean op : new boolean[]{false, true}) {
        tryRebuild.invoke(null, features, op, lookup);
        List<Object> rows = new ArrayList<>();
        int index = 0;
        for (Object tab : (List<?>) getAllTabs.invoke(null)) {
          Object title = getDisplayName.invoke(tab);
          Object contents = getContents.invoke(title);
          String label = (String) getKey.invoke(contents);
          Map<String, Object> row = new LinkedHashMap<>();
          row.put("index", index++);
          row.put("label", label.replace("itemGroup.", ""));
          List<String> items = new ArrayList<>();
          for (Object item : (Collection<?>) getDisplayItems.invoke(tab)) {
            items.add(stack(item));
          }
          row.put("items", items);
          row.put("icon", stack(getIconItem.invoke(tab)));
          row.put("title", showTitle.invoke(tab));
          row.put("scrollbar", canScroll.invoke(tab));
          row.put("column", column.invoke(tab));
          row.put("top", ((Enum<?>) rowMethod.invoke(tab)).ordinal() == 0);
          row.put("right", isAlignedRight.invoke(tab));
          row.put("type", ((Enum<?>) getType.invoke(tab)).name().toLowerCase(Locale.ROOT));
          String bgPath = (String) getPath.invoke(getBackgroundTexture.invoke(tab));
          row.put("background", bgPath.replace("textures/gui/container/creative_inventory/tab_", ""));
          rows.add(row);
        }
        catalog.put(op ? "operatorTabs" : "tabs", rows);
      }
      catalogs.add(catalog);
    }
    Files.writeString(Path.of(args[0]), new GsonBuilder().disableHtmlEscaping().create().toJson(Map.of("featureCatalogs", catalogs)));
  }
}
