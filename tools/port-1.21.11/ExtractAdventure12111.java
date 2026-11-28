import com.google.gson.*;
import com.mojang.serialization.*;
import java.io.FileNotFoundException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.lang.reflect.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

// Native 1.21.11 BlockPredicate.matchesState + AdventureModePredicate + property domains oracle.
public class ExtractAdventure12111 extends ExtractCreative12111 {
  static Object call(Object o, String name, Class<?>[] types, Object... args) throws Exception {
    return m(o.getClass(), name, types).invoke(o, args);
  }
  static Object reg(String name) throws Exception {
    return f(c("net.minecraft.core.registries.BuiltInRegistries"), name).get(null);
  }

  static Object blockTag(Object lookup, Object key, Map<Object, Object> cache) throws Exception {
    if (cache.containsKey(key)) return cache.get(key);
    Object registry = call(key, "registry", new Class<?>[]{});
    Object location = call(key, "location", new Class<?>[]{});
    String[] idParts = location.toString().split(":", 2);
    String path = "data/" + idParts[0] + "/tags/block/" + idParts[1] + ".json";
    LinkedHashSet<Object> holders = new LinkedHashSet<>();
    try (InputStream input = ExtractAdventure12111.class.getClassLoader().getResourceAsStream(path)) {
      if (input == null) throw new FileNotFoundException(path);
      for (JsonElement entry : JsonParser.parseReader(new InputStreamReader(input, StandardCharsets.UTF_8)).getAsJsonObject().getAsJsonArray("values")) {
        String name = entry.isJsonObject() ? entry.getAsJsonObject().get("id").getAsString() : entry.getAsString();
        Object value = id(name.startsWith("#") ? name.substring(1) : name);
        if (name.startsWith("#")) {
          Object nested = m(c("net.minecraft.tags.TagKey"), "create", c("net.minecraft.resources.ResourceKey"), c("net.minecraft.resources.Identifier")).invoke(null, registry, value);
          for (Object holder : (Iterable<?>) blockTag(lookup, nested, cache)) holders.add(holder);
        } else {
          Object item = m(c("net.minecraft.resources.ResourceKey"), "create", c("net.minecraft.resources.ResourceKey"), c("net.minecraft.resources.Identifier")).invoke(null, registry, value);
          holders.add(m(c("net.minecraft.core.HolderGetter"), "getOrThrow", c("net.minecraft.resources.ResourceKey")).invoke(lookup, item));
        }
      }
    }
    Constructor<?> ctor = c("net.minecraft.core.HolderSet$Named").getDeclaredConstructor(c("net.minecraft.core.HolderOwner"), c("net.minecraft.tags.TagKey"));
    ctor.setAccessible(true);
    Object set = ctor.newInstance(lookup, key);
    m(set.getClass(), "bind", List.class).invoke(set, List.copyOf(holders));
    cache.put(key, set);
    for (Object holder : holders) holderTags.computeIfAbsent(holder, h -> new ArrayList<>()).add(key);
    return set;
  }

  static Object blockLookup(Object provider) throws Exception {
    Class<?> p = c("net.minecraft.core.HolderLookup$Provider");
    Class<?> l = c("net.minecraft.core.HolderLookup$RegistryLookup");
    Object key = f(c("net.minecraft.core.registries.Registries"), "BLOCK").get(null);
    Object lookup = m(p, "lookupOrThrow", c("net.minecraft.resources.ResourceKey")).invoke(provider, key);
    Map<Object, Object> tags = new HashMap<>();
    Object wrapped = Proxy.newProxyInstance(l.getClassLoader(), new Class<?>[]{l}, (o, method, a) -> {
      if (a != null && a.length == 1 && method.getReturnType() == Optional.class && c("net.minecraft.tags.TagKey").isInstance(a[0])) {
        return Optional.of(blockTag(lookup, a[0], tags));
      }
      if (method.isDefault()) return InvocationHandler.invokeDefault(o, method, a);
      return method.invoke(lookup, a);
    });
    return Proxy.newProxyInstance(p.getClassLoader(), new Class<?>[]{p}, (o, method, a) -> {
      if (method.isDefault()) return InvocationHandler.invokeDefault(o, method, a);
      if (a != null && a.length == 1 && key.equals(a[0])) return Optional.of(wrapped);
      return method.invoke(provider, a);
    });
  }

  public static void main(String[] args) throws Exception {
    loadMappings(Path.of(args[1]));
    m(c("net.minecraft.SharedConstants"), "tryDetectVersion").invoke(null);
    m(c("net.minecraft.server.Bootstrap"), "bootStrap").invoke(null);

    Path orderPath = Path.of(args[2]);
    Object rawLookup = m(c("net.minecraft.data.registries.VanillaRegistries"), "createLookup").invoke(null);
    Object lookup = blockLookup(taggedLookup(rawLookup, orderPath));
    stackRegistries = registryAccess(lookup, orderPath);
    itemStackStreamCodec = f(c("net.minecraft.world.item.ItemStack"), "STREAM_CODEC").get(null);
    registryBufConstructor = c("net.minecraft.network.RegistryFriendlyByteBuf")
      .getConstructor(io.netty.buffer.ByteBuf.class, c("net.minecraft.core.RegistryAccess"));
    streamEncode = m(c("net.minecraft.network.codec.StreamEncoder"), "encode", Object.class, Object.class);

    @SuppressWarnings("rawtypes") DynamicOps ops = (DynamicOps) m(c("net.minecraft.resources.RegistryOps"), "create",
      DynamicOps.class, c("net.minecraft.core.HolderLookup$Provider")).invoke(null, JsonOps.INSTANCE, lookup);
    Object blocks = reg("BLOCK");
    Method regKey = m(c("net.minecraft.core.Registry"), "getKey", Object.class);
    Method regVal = m(c("net.minecraft.core.Registry"), "getValue", c("net.minecraft.resources.Identifier"));
    Map<String, Object> blockProperties = new TreeMap<>(), blockNames = new TreeMap<>();
    List<Object> propertyTypes = new ArrayList<>();
    for (Object block : (Iterable<?>) blocks) {
      String bName = regKey.invoke(blocks, block).toString().replace("minecraft:", "");
      blockNames.put(bName, call(block, "getDescriptionId", new Class<?>[]{}));
      Map<String, Integer> props = new TreeMap<>();
      Object definition = call(block, "getStateDefinition", new Class<?>[]{});
      for (Object property : (Collection<?>) call(definition, "getProperties", new Class<?>[]{})) {
        @SuppressWarnings("unchecked")
        List<Comparable<?>> allowed = new ArrayList<>((Collection<Comparable<?>>) call(property, "getPossibleValues", new Class<?>[]{}));
        allowed.sort(null);
        List<String> names = new ArrayList<>();
        for (Comparable<?> value : allowed) names.add((String) call(property, "getName", new Class<?>[]{Comparable.class}, value));
        Object type = Map.of("integer", allowed.getFirst() instanceof Integer, "values", names);
        int index = propertyTypes.indexOf(type);
        if (index < 0) {
          index = propertyTypes.size();
          propertyTypes.add(type);
        }
        props.put((String) call(property, "getName", new Class<?>[]{}), index);
      }
      if (!props.isEmpty()) blockProperties.put(bName, props);
    }

    @SuppressWarnings("rawtypes") Codec stackCodec = (Codec) f(c("net.minecraft.world.item.ItemStack"), "CODEC").get(null);
    @SuppressWarnings("rawtypes") Codec componentCodec = (Codec) f(c("net.minecraft.network.chat.ComponentSerialization"), "CODEC").get(null);
    Object context = m(c("net.minecraft.world.item.Item$TooltipContext"), "of", c("net.minecraft.core.HolderLookup$Provider")).invoke(null, lookup);
    Method getTooltips = m(c("net.minecraft.world.item.ItemStack"), "getTooltipLines",
      c("net.minecraft.world.item.Item$TooltipContext"), c("net.minecraft.world.entity.player.Player"), c("net.minecraft.world.item.TooltipFlag"));

    List<Object> cases = new ArrayList<>();
    for (JsonElement input : JsonParser.parseString(Files.readString(Path.of(args[3]))).getAsJsonArray()) {
      JsonObject entry = input.getAsJsonObject();
      @SuppressWarnings("unchecked") Object stack = stackCodec.parse(ops, entry.get("stack")).getOrThrow();
      String key = entry.get("component").getAsString();
      Object component = f(c("net.minecraft.core.component.DataComponents"), "can_break".equals(key) ? "CAN_BREAK" : "CAN_PLACE_ON").get(null);
      if (entry.has("directEmpty")) {
        Object empty = c("net.minecraft.world.item.AdventureModePredicate").getConstructor(List.class).newInstance(List.of());
        m(c("net.minecraft.world.item.ItemStack"), "set", c("net.minecraft.core.component.DataComponentType"), Object.class).invoke(stack, component, empty);
      }
      Object predicates = m(c("net.minecraft.core.component.DataComponentHolder"), "get", c("net.minecraft.core.component.DataComponentType")).invoke(stack, component);
      Object block = regVal.invoke(blocks, id(entry.get("block").getAsString()));
      Object state = call(block, "defaultBlockState", new Class<?>[]{});
      Object definition = call(block, "getStateDefinition", new Class<?>[]{});
      for (Map.Entry<String, JsonElement> e : entry.getAsJsonObject("state").entrySet()) {
        Object property = call(definition, "getProperty", new Class<?>[]{String.class}, e.getKey());
        Optional<?> value = (Optional<?>) call(property, "getValue", new Class<?>[]{String.class}, e.getValue().getAsString());
        state = call(state, "setValue", new Class<?>[]{c("net.minecraft.world.level.block.state.properties.Property"), Comparable.class}, property, value.orElseThrow());
      }
      Method bindTags = m(c("net.minecraft.core.Holder$Reference"), "bindTags", Collection.class);
      for (Map.Entry<Object, List<Object>> e : holderTags.entrySet()) bindTags.invoke(e.getKey(), e.getValue());

      boolean matched = false;
      for (Object predicate : (List<?>) f(predicates.getClass(), "predicates").get(predicates)) {
        if (!(Boolean) m(c("net.minecraft.advancements.criterion.BlockPredicate"), "matchesState", c("net.minecraft.world.level.block.state.BlockState")).invoke(predicate, state)) continue;
        Optional<?> nbt = (Optional<?>) call(predicate, "nbt", new Class<?>[]{});
        boolean nbtMatches = nbt.isEmpty();
        if (nbt.isPresent() && entry.has("actualNbt")) {
          Object actual = m(c("net.minecraft.nbt.TagParser"), "parseCompoundFully", String.class).invoke(null, entry.get("actualNbt").getAsString());
          nbtMatches = (Boolean) call(nbt.get(), "matches", new Class<?>[]{c("net.minecraft.nbt.Tag")}, actual);
        }
        if (nbtMatches) { matched = true; break; }
      }
      Map<String, Object> output = new LinkedHashMap<>();
      output.put("label", entry.get("label").getAsString());
      output.put("wire", stack(stack));
      output.put("matched", matched);
      for (String mode : entry.get("label").getAsString().startsWith("tooltip") ? new String[]{"NORMAL", "ADVANCED", "NORMAL_CREATIVE", "ADVANCED_CREATIVE"} : new String[]{"NORMAL", "ADVANCED"}) {
        Object flag = f(c("net.minecraft.world.item.TooltipFlag"), mode.split("_")[0]).get(null);
        if (mode.endsWith("_CREATIVE")) flag = call(flag, "asCreative", new Class<?>[]{});
        List<Object> lines = new ArrayList<>();
        for (Object line : (List<?>) getTooltips.invoke(stack, context, null, flag)) {
          @SuppressWarnings("unchecked") JsonElement enc = (JsonElement) componentCodec.encodeStart(ops, line).getOrThrow();
          lines.add(enc);
        }
        output.put(mode.toLowerCase(Locale.ROOT), lines);
      }
      cases.add(output);
    }

    Files.writeString(Path.of(args[0]), new GsonBuilder().disableHtmlEscaping().create().toJson(Map.of(
      "cases", cases, "properties", blockProperties, "propertyTypes", propertyTypes, "blockNames", blockNames
    )));
  }
}
