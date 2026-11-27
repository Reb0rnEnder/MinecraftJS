import com.google.common.hash.HashCode;
import com.google.gson.*;
import io.netty.buffer.ByteBuf;
import io.netty.buffer.Unpooled;
import java.io.InputStreamReader;
import java.lang.reflect.Constructor;
import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;
import net.minecraft.core.Holder;
import net.minecraft.core.HolderLookup;
import net.minecraft.core.Registry;
import net.minecraft.core.RegistryAccess;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.data.registries.VanillaRegistries;
import net.minecraft.network.HashedPatchMap;
import net.minecraft.network.HashedStack;
import net.minecraft.network.RegistryFriendlyByteBuf;
import net.minecraft.network.chat.contents.TranslatableContents;
import net.minecraft.resources.Identifier;
import net.minecraft.resources.RegistryOps;
import net.minecraft.resources.ResourceKey;
import net.minecraft.core.registries.Registries;
import net.minecraft.tags.TagKey;
import net.minecraft.server.Bootstrap;
import net.minecraft.util.HashOps;
import net.minecraft.world.flag.FeatureFlagSet;
import net.minecraft.world.flag.FeatureFlags;
import net.minecraft.world.item.CreativeModeTab;
import net.minecraft.world.item.CreativeModeTabs;
import net.minecraft.world.item.ItemStack;

// Native 26.3 Creative catalogue. Uses the pinned client's own tab generators and
// OPTIONAL_STREAM_CODEC, so item ids and component patches match the play protocol.
public class ExtractCreative263 {
  static final Map<String, List<String>> tagDocs = new HashMap<>();
  static final Map<Object, Object> instrumentSets = new HashMap<>();
  static final Map<String, Map<String, Object>> hashedStacks = new LinkedHashMap<>();
  static HashedPatchMap.HashGenerator hasher;
  static final Method bindTags;
  static {
    try {
      bindTags = Holder.Reference.class.getDeclaredMethod("bindTags", Collection.class);
      bindTags.setAccessible(true);
    } catch (ReflectiveOperationException error) {
      throw new ExceptionInInitializerError(error);
    }
  }

  static void loadTagDocs(Path jar, String dir) throws Exception {
    String prefix = "data/minecraft/tags/" + dir + "/";
    try (ZipFile zip = new ZipFile(jar.toFile())) {
      Enumeration<? extends ZipEntry> entries = zip.entries();
      while (entries.hasMoreElements()) {
        ZipEntry entry = entries.nextElement();
        if (entry.isDirectory() || !entry.getName().startsWith(prefix) || !entry.getName().endsWith(".json")) continue;
        String id = "minecraft:" + entry.getName().substring(prefix.length(), entry.getName().length() - 5);
        try (InputStreamReader reader = new InputStreamReader(zip.getInputStream(entry), StandardCharsets.UTF_8)) {
          List<String> values = new ArrayList<>();
          for (JsonElement value : JsonParser.parseReader(reader).getAsJsonObject().getAsJsonArray("values")) {
            values.add(value.isJsonObject() ? value.getAsJsonObject().get("id").getAsString() : value.getAsString());
          }
          tagDocs.put(id, values);
        }
      }
    }
  }

  static <T> void bindRegistryTags(HolderLookup.RegistryLookup<T> registry, String dir, Path jar) throws Exception {
    loadTagDocs(jar, dir);
    Map<String, Holder.Reference<T>> holders = new LinkedHashMap<>();
    registry.listElements().forEach(holder -> holders.put(holder.key().identifier().toString(), holder));
    Map<String, List<Holder.Reference<T>>> resolved = new HashMap<>();
    for (String id : List.copyOf(tagDocs.keySet())) resolveTag(id, holders, resolved, new HashSet<>());
    for (Map.Entry<String, Holder.Reference<T>> entry : holders.entrySet()) {
      List<TagKey<T>> tags = new ArrayList<>();
      for (Map.Entry<String, List<Holder.Reference<T>>> tag : resolved.entrySet()) {
        if (tag.getValue().contains(entry.getValue())) tags.add((TagKey<T>)createTag(registry.key(), Identifier.parse(tag.getKey())));
      }
      bindTags.invoke(entry.getValue(), tags);
    }
    // Construction lookups expose Named holder sets with no bound contents. Creative
    // dereferences them directly (instrument/pattern tags), so bind those too.
    Method bindSet = net.minecraft.core.HolderSet.Named.class.getDeclaredMethod("bind", List.class);
    bindSet.setAccessible(true);
    for (Map.Entry<String, List<Holder.Reference<T>>> tag : resolved.entrySet()) {
      TagKey<T> key = (TagKey<T>)createTag(registry.key(), Identifier.parse(tag.getKey()));
      Object set = registry.get(key).orElse(null);
      if (set instanceof net.minecraft.core.HolderSet.Named) bindSet.invoke(set, tag.getValue());
    }
  }

  @SuppressWarnings({"rawtypes","unchecked"})
  static TagKey createTag(ResourceKey registry, Identifier id) {
    return TagKey.create(registry, id);
  }

  @SuppressWarnings({"rawtypes","unchecked"})
  static <T> Map<TagKey<T>, net.minecraft.core.HolderSet.Named<T>> boundTagSets(HolderLookup.RegistryLookup<T> registry, String dir, Path jar) throws Exception {
    loadTagDocs(jar, dir);
    Map<String, Holder.Reference<T>> holders = new LinkedHashMap<>();
    registry.listElements().forEach(holder -> holders.put(holder.key().identifier().toString(), holder));
    Map<String, List<Holder.Reference<T>>> resolved = new HashMap<>();
    for (String id : List.copyOf(tagDocs.keySet())) resolveTag(id, holders, resolved, new HashSet<>());
    Constructor<net.minecraft.core.HolderSet.Named> constructor = net.minecraft.core.HolderSet.Named.class.getDeclaredConstructor(net.minecraft.core.HolderOwner.class, TagKey.class);
    constructor.setAccessible(true);
    Method bind = net.minecraft.core.HolderSet.Named.class.getDeclaredMethod("bind", List.class);
    bind.setAccessible(true);
    Map<TagKey<T>, net.minecraft.core.HolderSet.Named<T>> sets = new HashMap<>();
    for (Map.Entry<String, List<Holder.Reference<T>>> tag : resolved.entrySet()) {
      TagKey<T> key = (TagKey<T>)createTag(registry.key(), Identifier.parse(tag.getKey()));
      net.minecraft.core.HolderSet.Named<T> set = constructor.newInstance(registry, key);
      bind.invoke(set, tag.getValue());
      sets.put(key, set);
    }
    return sets;
  }

  static HolderLookup.RegistryLookup<?> sortedLookup(HolderLookup.RegistryLookup<?> lookup, Map<?, ?> sets) {
    return (HolderLookup.RegistryLookup<?>)Proxy.newProxyInstance(HolderLookup.RegistryLookup.class.getClassLoader(), new Class<?>[]{HolderLookup.RegistryLookup.class}, (proxy, method, args) -> {
      if (method.getName().equals("listElements")) return lookup.listElements().sorted(Comparator.comparing(holder -> holder.key().identifier().toString()));
      if (sets != null && method.getName().equals("get") && args != null && args.length == 1 && args[0] instanceof TagKey) {
        Object set = sets.get(args[0]);
        if (set != null) return Optional.of(set);
      }
      if (method.isDefault()) return InvocationHandler.invokeDefault(proxy, method, args);
      return method.invoke(lookup, args);
    });
  }

  @SuppressWarnings({"rawtypes","unchecked"})
  static HolderLookup.Provider taggedLookup(HolderLookup.Provider provider, Map<?, ?> instrumentSets) {
    Set<Identifier> builtins = BuiltInRegistries.REGISTRY.keySet();
    return (HolderLookup.Provider)Proxy.newProxyInstance(HolderLookup.Provider.class.getClassLoader(), new Class<?>[]{HolderLookup.Provider.class}, (proxy, method, args) -> {
      if (args != null && args.length == 1 && (method.getName().equals("lookup") || method.getName().equals("lookupOrThrow"))) {
        ResourceKey key = (ResourceKey)args[0];
        Object original = method.invoke(provider, args);
        if (builtins.contains(key.identifier())) return original;
        if (method.getName().equals("lookup")) return ((Optional<?>)original).map(value -> sortedLookup((HolderLookup.RegistryLookup<?>)value, key == Registries.INSTRUMENT ? instrumentSets : null));
        return sortedLookup((HolderLookup.RegistryLookup<?>)original, key == Registries.INSTRUMENT ? instrumentSets : null);
      }
      if (method.isDefault()) return InvocationHandler.invokeDefault(proxy, method, args);
      return method.invoke(provider, args);
    });
  }

  static <T> List<Holder.Reference<T>> resolveTag(String id, Map<String, Holder.Reference<T>> holders, Map<String, List<Holder.Reference<T>>> resolved, Set<String> active) {
    if (resolved.containsKey(id)) return resolved.get(id);
    if (!active.add(id)) throw new IllegalStateException("Recursive tag " + id);
    List<Holder.Reference<T>> result = new ArrayList<>();
    for (String value : tagDocs.getOrDefault(id, List.of())) {
      if (value.startsWith("#")) result.addAll(resolveTag(value.substring(1), holders, resolved, active));
      else {
        Holder.Reference<T> holder = holders.get(value.contains(":") ? value : "minecraft:" + value);
        if (holder != null) result.add(holder);
      }
    }
    active.remove(id);
    resolved.put(id, result);
    return result;
  }

  static RegistryAccess dynamicAccess(HolderLookup.Provider provider, RegistryAccess builtins) {
    return (RegistryAccess)Proxy.newProxyInstance(RegistryAccess.class.getClassLoader(), new Class<?>[]{RegistryAccess.class}, (proxy, method, args) -> {
      if (args != null && args.length == 1 && (method.getName().equals("lookup") || method.getName().equals("lookupOrThrow"))) {
        ResourceKey key = (ResourceKey)args[0];
        Optional<Registry> builtin = builtins.lookup(key);
        Object value = builtin.isPresent() ? builtin.get() : provider.lookup(key).map(found -> registryProxy((HolderLookup.RegistryLookup<?>)found)).orElse(null);
        if (value == null) throw new IllegalStateException("Missing registry " + key);
        return method.getName().equals("lookup") ? Optional.of(value) : value;
      }
      if (method.isDefault()) return InvocationHandler.invokeDefault(proxy, method, args);
      return method.invoke(builtins, args);
    });
  }

  static <T> net.minecraft.core.IdMap<Holder<T>> holderIdMap(HolderLookup.RegistryLookup<T> lookup) {
    // Network/registry data order is by identifier (the 1.20.6 known-pack order has the
    // same property). VanillaRegistries' construction lookups iterate hash maps, so sort
    // before assigning holder ids or every run would emit different component ids.
    List<Holder.Reference<T>> holders = lookup.listElements().sorted(Comparator.comparing(holder -> holder.key().identifier().toString())).toList();
    return new net.minecraft.core.IdMap<>() {
      public int getId(Holder<T> holder) { for (int i = 0; i < holders.size(); i++) if (holders.get(i) == holder) return i; return -1; }
      public Holder<T> byId(int id) { return holders.get(id); }
      public int size() { return holders.size(); }
      @SuppressWarnings("unchecked")
      public Iterator<Holder<T>> iterator() { return (Iterator<Holder<T>>)(Iterator<?>)holders.iterator(); }
    };
  }

  @SuppressWarnings({"rawtypes","unchecked"})
  static Registry<?> registryProxy(HolderLookup.RegistryLookup<?> lookup) {
    return (Registry<?>)Proxy.newProxyInstance(Registry.class.getClassLoader(), new Class<?>[]{Registry.class}, (proxy, method, args) -> {
      String name = method.getName();
      if (name.equals("asHolderIdMap")) return holderIdMap((HolderLookup.RegistryLookup)lookup);
      if (name.equals("key")) return lookup.key();
      if (name.equals("listElements")) return lookup.listElements();
      if (name.equals("listTags")) return lookup.listTags();
      if (name.equals("get") && args != null && args.length == 1) {
        if (args[0] instanceof TagKey) return lookup.get((TagKey)args[0]);
        if (args[0] instanceof ResourceKey) return lookup.get((ResourceKey)args[0]);
        if (args[0] instanceof Identifier) {
          return lookup.listElements().filter(holder -> holder.key().identifier().equals(args[0])).findFirst();
        }
      }
      if ((name.equals("getKey") || name.equals("getResourceKey")) && args != null && args.length == 1) {
        Optional<Holder.Reference> holder = (Optional)lookup.listElements().filter(found -> found.value() == args[0]).findFirst();
        if (name.equals("getKey")) return holder.map(found -> found.key().identifier()).orElse(null);
        return holder.map(Holder.Reference::key);
      }
      if ((name.equals("getValue") || name.equals("getOptional")) && args != null && args.length == 1) {
        Optional<Holder.Reference> holder = (Optional)(args[0] instanceof ResourceKey
          ? lookup.get((ResourceKey)args[0])
          : lookup.listElements().filter(found -> found.key().identifier().equals(args[0])).findFirst());
        return name.equals("getValue") ? holder.map(Holder.Reference::value).orElse(null) : holder.map(Holder.Reference::value);
      }
      if (name.equals("containsKey") && args != null && args.length == 1) {
        if (args[0] instanceof ResourceKey) return lookup.get((ResourceKey)args[0]).isPresent();
        return lookup.listElements().anyMatch(holder -> holder.key().identifier().equals(args[0]));
      }
      if (name.equals("keySet")) return lookup.listElements().map(holder -> holder.key().identifier()).collect(java.util.stream.Collectors.toSet());
      if (name.equals("registryKeySet")) return lookup.listElements().map(Holder.Reference::key).collect(java.util.stream.Collectors.toSet());
      if (name.equals("entrySet")) return lookup.listElements().collect(java.util.stream.Collectors.toMap(Holder.Reference::key, Holder.Reference::value));
      if (name.equals("registryLifecycle")) return com.mojang.serialization.Lifecycle.stable();
      // Holders retain the original provider as their owner; the proxy is a view of that
      // same registry, so it must accept the owner's references when a component hashes.
      if (name.equals("canSerialize")) return true;
      if (method.isDefault()) return InvocationHandler.invokeDefault(proxy, method, args);
      throw new UnsupportedOperationException("Creative encoding needs " + name + " on dynamic registry");
    });
  }

  static String stack(ItemStack stack, RegistryAccess access, RegistryAccess dynamic) {
    ByteBuf raw = Unpooled.buffer();
    try {
      RegistryFriendlyByteBuf buffer = new RegistryFriendlyByteBuf(raw, access) {
        @Override public RegistryAccess registryAccess() { return dynamic; }
      };
      ItemStack.OPTIONAL_STREAM_CODEC.encode(buffer, stack);
      byte[] bytes = new byte[raw.readableBytes()];
      raw.getBytes(raw.readerIndex(), bytes);
      String wire = Base64.getEncoder().encodeToString(bytes);
      recordHashes(wire, stack, access, dynamic);
      return wire;
    } finally {
      raw.release();
    }
  }

  // The client hashes each added component by encoding its value through HashOps.CRC32C.
  // Store the native HashedStack fields and wire bytes so the JS click writer never has to
  // guess a component hash and a byte gate can compare it with Mojang's own encoder.
  static void recordHashes(String wire, ItemStack stack, RegistryAccess access, RegistryAccess dynamic) {
    if (hasher == null || stack.isEmpty()) return;
    HashedStack value = HashedStack.create(stack, hasher);
    if (!(value instanceof HashedStack.ActualItem actual)) return;
    HashedPatchMap patch = actual.components();
    if (patch.addedComponents().isEmpty() && patch.removedComponents().isEmpty()) return;
    List<Map.Entry<Integer, Integer>> added = new ArrayList<>();
    patch.addedComponents().forEach((type, hash) -> added.add(Map.entry(BuiltInRegistries.DATA_COMPONENT_TYPE.getId(type), hash)));
    added.sort(Map.Entry.comparingByKey());
    List<Integer> removed = new ArrayList<>();
    for (var type : patch.removedComponents()) removed.add(BuiltInRegistries.DATA_COMPONENT_TYPE.getId(type));
    removed.sort(Integer::compareTo);
    List<List<Integer>> pairs = new ArrayList<>();
    Map<net.minecraft.core.component.DataComponentType<?>, Integer> sortedAdded = new LinkedHashMap<>();
    for (var entry : added) {
      pairs.add(List.of(entry.getKey(), entry.getValue()));
      sortedAdded.put(BuiltInRegistries.DATA_COMPONENT_TYPE.byId(entry.getKey()), entry.getValue());
    }
    Set<net.minecraft.core.component.DataComponentType<?>> sortedRemoved = new LinkedHashSet<>();
    for (int id : removed) sortedRemoved.add(BuiltInRegistries.DATA_COMPONENT_TYPE.byId(id));
    HashedStack ordered = new HashedStack.ActualItem(actual.item(), actual.count(), new HashedPatchMap(sortedAdded, sortedRemoved));
    ByteBuf raw = Unpooled.buffer();
    String hashedWire;
    try {
      HashedStack.STREAM_CODEC.encode(new RegistryFriendlyByteBuf(raw, access) {
        @Override public RegistryAccess registryAccess() { return dynamic; }
      }, ordered);
      byte[] bytes = new byte[raw.readableBytes()];
      raw.getBytes(raw.readerIndex(), bytes);
      hashedWire = Base64.getEncoder().encodeToString(bytes);
    } finally {
      raw.release();
    }
    Map<String, Object> doc = new LinkedHashMap<>();
    doc.put("added", pairs);
    doc.put("removed", removed);
    doc.put("wire", hashedWire);
    Map<String, Object> previous = hashedStacks.putIfAbsent(wire, doc);
    if (previous != null && !previous.equals(doc)) throw new IllegalStateException("Two identical Creative stacks hash differently");
  }

  static String background(CreativeModeTab tab) {
    String path = tab.getBackgroundTexture().getPath();
    int marker = path.lastIndexOf("tab_");
    return marker < 0 ? path.substring(path.lastIndexOf('/') + 1) : path.substring(marker + 4);
  }

  public static void main(String[] args) throws Exception {
    net.minecraft.SharedConstants.tryDetectVersion();
    Bootstrap.bootStrap();
    HolderLookup.Provider lookup = VanillaRegistries.createWorldLookup();
    Path jar = Path.of(args[1]);
    // Built-in and worldgen holders do not have data-pack tags unless a resource
    // reload runs. Creative needs item, painting and instrument tags to filter tabs.
    bindRegistryTags(BuiltInRegistries.ITEM, "item", jar);
    bindRegistryTags(lookup.lookupOrThrow(Registries.PAINTING_VARIANT), "painting_variant", jar);
    HolderLookup.RegistryLookup<net.minecraft.world.item.Instrument> instruments = lookup.lookupOrThrow(Registries.INSTRUMENT);
    bindRegistryTags(instruments, "instrument", jar);
    Map<TagKey<net.minecraft.world.item.Instrument>, net.minecraft.core.HolderSet.Named<net.minecraft.world.item.Instrument>> instrumentTagSets = boundTagSets(instruments, "instrument", jar);
    HolderLookup.Provider tabLookup = taggedLookup(lookup, instrumentTagSets);
    // 26.3 initializes item components separately from the item registry. Creative
    // generation constructs ItemStacks, so every holder must have its baked map bound.
    for (var pending : BuiltInRegistries.DATA_COMPONENT_INITIALIZERS.build(lookup)) pending.apply();
    RegistryAccess access = RegistryAccess.fromRegistryOfRegistries(BuiltInRegistries.REGISTRY);
    RegistryAccess dynamic = dynamicAccess(lookup, access);
    RegistryOps<HashCode> hashOps = dynamic.createSerializationContext(HashOps.CRC32C_INSTANCE);
    hasher = component -> component.encodeValue(hashOps).getOrThrow(message -> new IllegalArgumentException("Failed to hash " + component + ": " + message)).asInt();
    List<Map<String, Object>> catalogs = new ArrayList<>();
    String[] optional = {"minecraft:trade_rebalance", "minecraft:redstone_experiments", "minecraft:minecart_improvements"};
    for (int mask = 0; mask < 8; mask++) {
      List<Identifier> requested = new ArrayList<>();
      requested.add(Identifier.parse("minecraft:vanilla"));
      for (int bit = 0; bit < optional.length; bit++) if ((mask & (1 << bit)) != 0) requested.add(Identifier.parse(optional[bit]));
      FeatureFlagSet features = FeatureFlags.REGISTRY.fromNames(requested);
      Map<String, Object> catalog = new LinkedHashMap<>();
      catalog.put("mask", mask);
      for (boolean op : new boolean[]{false, true}) {
        if (!CreativeModeTabs.tryRebuildTabContents(features, op, tabLookup)) throw new IllegalStateException("Creative tab rebuild failed");
        List<Map<String, Object>> rows = new ArrayList<>();
        int index = 0;
        for (CreativeModeTab tab : CreativeModeTabs.allTabs()) {
          Map<String, Object> row = new LinkedHashMap<>();
          row.put("index", index++);
          row.put("label", ((TranslatableContents) tab.getDisplayName().getContents()).getKey().replace("itemGroup.", ""));
          List<String> items = new ArrayList<>();
          for (ItemStack item : tab.getDisplayItems()) items.add(stack(item, access, dynamic));
          row.put("items", items);
          row.put("icon", stack(tab.getIconItem(), access, dynamic));
          row.put("title", tab.showTitle());
          row.put("scrollbar", tab.canScroll());
          row.put("column", tab.column());
          row.put("top", tab.row().ordinal() == 0);
          row.put("right", tab.isAlignedRight());
          row.put("type", tab.getType().name().toLowerCase(Locale.ROOT));
          row.put("background", background(tab));
          rows.add(row);
        }
        catalog.put(op ? "operatorTabs" : "tabs", rows);
      }
      catalogs.add(catalog);
    }
    Map<String, Object> output = new LinkedHashMap<>();
    output.put("featureCatalogs", catalogs);
    output.put("hashes", hashedStacks);
    Files.writeString(Path.of(args[0]), new GsonBuilder().disableHtmlEscaping().create().toJson(output));
  }
}
