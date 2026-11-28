import com.google.gson.*;
import com.mojang.serialization.*;
import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;

// Native 1.21.11 BannerPatternLayers Stack/Wire oracle.
public class ExtractBannerStacks12111 extends ExtractCreative12111 {
  static Object call(Object o, String name, Class<?>[] types, Object... args) throws Exception {
    return m(o.getClass(), name, types).invoke(o, args);
  }

  public static void main(String[] args) throws Exception {
    loadMappings(Path.of(args[1]));
    m(c("net.minecraft.SharedConstants"), "tryDetectVersion").invoke(null);
    m(c("net.minecraft.server.Bootstrap"), "bootStrap").invoke(null);

    Object rawLookup = m(c("net.minecraft.data.registries.VanillaRegistries"), "createLookup").invoke(null);
    Path orderPath = Path.of(args[2]);
    Object lookup = taggedLookup(rawLookup, orderPath);
    stackRegistries = registryAccess(lookup, orderPath);
    itemStackStreamCodec = f(c("net.minecraft.world.item.ItemStack"), "STREAM_CODEC").get(null);
    registryBufConstructor = c("net.minecraft.network.RegistryFriendlyByteBuf")
      .getConstructor(io.netty.buffer.ByteBuf.class, c("net.minecraft.core.RegistryAccess"));
    streamEncode = m(c("net.minecraft.network.codec.StreamEncoder"), "encode", Object.class, Object.class);

    @SuppressWarnings("rawtypes") DynamicOps ops = (DynamicOps) m(c("net.minecraft.resources.RegistryOps"), "create",
      DynamicOps.class, c("net.minecraft.core.HolderLookup$Provider")).invoke(null, JsonOps.INSTANCE, lookup);
    @SuppressWarnings("rawtypes") Codec codec = (Codec) f(c("net.minecraft.world.item.ItemStack"), "CODEC").get(null);
    Object patComp = f(c("net.minecraft.core.component.DataComponents"), "BANNER_PATTERNS").get(null);
    Method compGet = m(c("net.minecraft.core.component.DataComponentHolder"), "get", c("net.minecraft.core.component.DataComponentType"));

    List<Object> out = new ArrayList<>();
    for (JsonElement input : JsonParser.parseString(Files.readString(Path.of(args[3]))).getAsJsonArray()) {
      JsonObject entry = input.getAsJsonObject();
      @SuppressWarnings("unchecked") Object stack = codec.parse(ops, entry.get("stack")).getOrThrow();
      Object patterns = compGet.invoke(stack, patComp);
      List<Object> layers = new ArrayList<>();
      for (Object layer : (List<?>) call(patterns, "layers", new Class<?>[]{})) {
        Object holder = call(layer, "pattern", new Class<?>[]{});
        Object pattern = call(holder, "value", new Class<?>[]{});
        Object color = call(layer, "color", new Class<?>[]{});
        layers.add(Map.of(
          "asset", call(pattern, "assetId", new Class<?>[]{}).toString(),
          "dye", call(color, "getId", new Class<?>[]{})
        ));
      }
      out.add(Map.of("label", entry.get("label").getAsString(), "wire", stack(stack), "layers", layers));
    }
    Files.writeString(Path.of(args[0]), new GsonBuilder().disableHtmlEscaping().create().toJson(out));
  }
}
