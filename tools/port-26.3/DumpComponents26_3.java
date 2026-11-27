// Harvests one real value of every 26.3 data component that appears on a vanilla item and
// encodes it with Mojang's own network codec. The JS gate decodes each entry and requires
// the reader to consume exactly the bytes the vanilla encoder wrote.
import io.netty.buffer.ByteBuf;
import io.netty.buffer.Unpooled;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import net.minecraft.SharedConstants;
import net.minecraft.core.HolderLookup;
import net.minecraft.core.Registry;
import net.minecraft.core.RegistryAccess;
import net.minecraft.core.component.DataComponentInitializers;
import net.minecraft.core.component.DataComponentMap;
import net.minecraft.core.component.DataComponentType;
import net.minecraft.core.component.DataComponents;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.network.RegistryFriendlyByteBuf;
import net.minecraft.network.codec.StreamCodec;
import net.minecraft.data.registries.VanillaRegistries;
import net.minecraft.resources.Identifier;
import net.minecraft.world.item.component.ResolvableProfile;
import net.minecraft.server.Bootstrap;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.ItemStackTemplate;
import net.minecraft.world.item.component.BundleContents;
import net.minecraft.world.item.component.ChargedProjectiles;
import net.minecraft.world.item.component.ItemContainerContents;
import net.minecraft.world.level.block.entity.PotDecorations;

public final class DumpComponents26_3 {
  private static String hex(ByteBuf buf) {
    StringBuilder out = new StringBuilder();
    for (int i = 0; i < buf.readableBytes(); i++) out.append(String.format("%02x", buf.getUnsignedByte(i)));
    return out.toString();
  }

  private static String json(String value) {
    StringBuilder out = new StringBuilder("\"");
    for (char c : value.toCharArray()) {
      if (c == '"' || c == '\\') out.append('\\').append(c);
      else if (c < 0x20) out.append(String.format("\\u%04x", (int) c));
      else out.append(c);
    }
    return out.append('"').toString();
  }

  @SuppressWarnings({"rawtypes", "unchecked"})
  private static String encodeValue(RegistryAccess access, DataComponentType type, Object value) {
    RegistryFriendlyByteBuf buf = new RegistryFriendlyByteBuf(Unpooled.buffer(), access);
    StreamCodec codec = type.streamCodec();
    codec.encode(buf, value);
    return hex(buf);
  }

  @SuppressWarnings({"rawtypes", "unchecked"})
  public static void main(String[] args) throws Exception {
    SharedConstants.tryDetectVersion();
    Bootstrap.bootStrap();
    HolderLookup.Provider lookup = VanillaRegistries.createReloadableLookup(VanillaRegistries.createWorldLookup());
    for (DataComponentInitializers.PendingComponents<?> pending : BuiltInRegistries.DATA_COMPONENT_INITIALIZERS.build(lookup)) pending.apply();
    // Component codecs may reference dynamic registries (trim materials, banner patterns, ...),
    // so merge the built-ins with every registry the world lookup exposes.
    Map<net.minecraft.resources.ResourceKey<? extends Registry<?>>, Registry<?>> registries = new LinkedHashMap<>();
    for (Registry<?> registry : BuiltInRegistries.REGISTRY) registries.put(registry.key(), registry);
    lookup.listRegistries().forEach(candidate -> {
      if (candidate instanceof Registry<?> registry) registries.putIfAbsent(registry.key(), registry);
    });
    RegistryAccess access = new RegistryAccess.ImmutableRegistryAccess(registries);
    Map<String, String> encoded = new LinkedHashMap<>();
    Map<String, Integer> examples = new LinkedHashMap<>();
    for (Item item : BuiltInRegistries.ITEM) {
      ItemStack stack = new ItemStack(item);
      DataComponentMap components = stack.getComponents();
      for (DataComponentType type : BuiltInRegistries.DATA_COMPONENT_TYPE) {
        String name = BuiltInRegistries.DATA_COMPONENT_TYPE.getKey(type).getPath();
        if (encoded.containsKey(name)) continue;
        Object value = components.get(type);
        if (value == null) continue;
        RegistryFriendlyByteBuf buf = new RegistryFriendlyByteBuf(Unpooled.buffer(), access);
        StreamCodec codec = type.streamCodec();
        try {
          codec.encode(buf, value);
        } catch (IllegalStateException missing) {
          // Data-pack-only registries (trim materials, banner patterns, ...) are absent from the
          // code-side lookup; those components are covered by their own native fixtures.
          continue;
        }
        encoded.put(name, hex(buf));
        int id = BuiltInRegistries.ITEM.getId(item);
        examples.put(name, id);
      }
    }

    encoded.put("tooltip_style", encodeValue(access, DataComponents.TOOLTIP_STYLE, Identifier.fromNamespaceAndPath("minecraft", "default")));
    encoded.put("profile", encodeValue(access, DataComponents.PROFILE, ResolvableProfile.createUnresolved("Dev")));

    // Item-container components must be exercised with occupied slots. Empty vanilla defaults
    // would pass any incorrectly optional template reader and hide a desynchronising bool.
    ItemStackTemplate apple = ItemStackTemplate.fromNonEmptyStack(new ItemStack(net.minecraft.world.item.Items.APPLE, 3));
    ItemStackTemplate stick = ItemStackTemplate.fromNonEmptyStack(new ItemStack(net.minecraft.world.item.Items.STICK, 8));
    ItemStackTemplate arrow = ItemStackTemplate.fromNonEmptyStack(new ItemStack(net.minecraft.world.item.Items.ARROW, 16));
    encoded.put("container", encodeValue(access, DataComponents.CONTAINER, ItemContainerContents.fromItems(List.of(apple.create(), stick.create()))));
    encoded.put("bundle_contents", encodeValue(access, DataComponents.BUNDLE_CONTENTS, new BundleContents(List.of(apple, stick))));
    encoded.put("charged_projectiles", encodeValue(access, DataComponents.CHARGED_PROJECTILES, new ChargedProjectiles(List.of(arrow))));
    encoded.put("pot_decorations", encodeValue(access, DataComponents.POT_DECORATIONS, new PotDecorations(Optional.of(apple), Optional.of(stick), Optional.empty(), Optional.empty())));

    List<String> names = new ArrayList<>(encoded.keySet());
    names.sort(Comparator.naturalOrder());
    StringBuilder out = new StringBuilder("{\n");
    for (int i = 0; i < names.size(); i++) {
      String name = names.get(i);
      if (i > 0) out.append(",\n");
      out.append("  ").append(json(name)).append(": {\"hex\": ").append(json(encoded.get(name)))
          .append(", \"item\": ").append(examples.getOrDefault(name, -1)).append('}');
    }
    out.append("\n}\n");
    System.out.print(out);
  }
}
