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
import net.minecraft.network.RegistryFriendlyByteBuf;
import net.minecraft.network.chat.contents.TranslatableContents;
import net.minecraft.resources.Identifier;
import net.minecraft.resources.ResourceKey;
import net.minecraft.core.registries.Registries;
import net.minecraft.tags.TagKey;
import net.minecraft.server.Bootstrap;
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
      if (method.getName().equals("asHolderIdMap")) return holderIdMap((HolderLookup.RegistryLookup)lookup);
      if (method.getName().equals("key")) return lookup.key();
      if (method.getName().equals("listElements")) return lookup.listElements();
      if (method.getName().equals("listTags")) return lookup.listTags();
      if (method.getName().equals("get") && args != null && args.length == 1 && args[0] instanceof net.minecraft.tags.TagKey) return lookup.get((net.minecraft.tags.TagKey)args[0]);
      if (method.isDefault()) return InvocationHandler.invokeDefault(proxy, method, args);
      throw new UnsupportedOperationException("Creative encoding needs " + method.getName() + " on dynamic registry");
    });
  }

  static String stack(ItemStack stack, RegistryAccess access, RegistryAccess dynamic) {
    ByteBuf raw = Unpooled.buffer();
    try {
      ItemStack.OPTIONAL_STREAM_CODEC.encode(new RegistryFriendlyByteBuf(raw, access) {
        @Override public RegistryAccess registryAccess() { return dynamic; }
      }, stack);
      byte[] bytes = new byte[raw.readableBytes()];
      raw.getBytes(raw.readerIndex(), bytes);
      return Base64.getEncoder().encodeToString(bytes);
    } finally {
      raw.release();
    }
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
    Files.writeString(Path.of(args[0]), new GsonBuilder().disableHtmlEscaping().create().toJson(Map.of("featureCatalogs", catalogs)));
  }
}
