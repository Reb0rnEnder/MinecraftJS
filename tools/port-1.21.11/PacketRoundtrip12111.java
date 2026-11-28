import com.google.gson.GsonBuilder;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.mojang.serialization.Lifecycle;
import io.netty.buffer.ByteBuf;
import io.netty.buffer.Unpooled;
import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;
import java.util.function.Function;

// Self-contained JEP 330 native protocol oracle for 1.21.11 Play (protocol 774).
// Decodes and re-encodes through GameProtocols.CLIENTBOUND_TEMPLATE and SERVERBOUND_TEMPLATE.
public class PacketRoundtrip12111 {
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
    String key = name + "(" + String.join(",", Arrays.stream(args).map(PacketRoundtrip12111::original).toArray(String[]::new)) + ")";
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

  static Object id(String s) throws Exception {
    return m(c("net.minecraft.resources.Identifier"), "parse", String.class).invoke(null, s);
  }

  static Object registryAccess(Object lookup, Path orderPath) throws Exception {
    Class<?> registryAccessClass = c("net.minecraft.core.RegistryAccess");
    Object builtInRoot = f(c("net.minecraft.core.registries.BuiltInRegistries"), "REGISTRY").get(null);
    Object base = m(registryAccessClass, "fromRegistryOfRegistries", c("net.minecraft.core.Registry")).invoke(null, builtInRoot);
    Map<Object, Object> registries = new LinkedHashMap<>();
    List<?> entries = ((java.util.stream.Stream<?>) m(registryAccessClass, "registries").invoke(base)).toList();
    Class<?> entryClass = c("net.minecraft.core.RegistryAccess$RegistryEntry");
    Method entryKey = m(entryClass, "key");
    Method entryValue = m(entryClass, "value");
    for (Object entry : entries) {
      registries.put(entryKey.invoke(entry), entryValue.invoke(entry));
    }

    Class<?> rkClass = c("net.minecraft.resources.ResourceKey");
    Class<?> idClass = c("net.minecraft.resources.Identifier");
    Class<?> providerClass = c("net.minecraft.core.HolderLookup$Provider");
    Class<?> holderGetterClass = c("net.minecraft.core.HolderGetter");
    Class<?> holderClass = c("net.minecraft.core.Holder");
    Class<?> regInfoClass = c("net.minecraft.core.RegistrationInfo");
    Class<?> mappedClass = c("net.minecraft.core.MappedRegistry");
    Method createRegKey = m(rkClass, "createRegistryKey", idClass);
    Method createKey = m(rkClass, "create", rkClass, idClass);
    Method lookupOrThrow = m(providerClass, "lookupOrThrow", rkClass);
    Method getOrThrow = m(holderGetterClass, "getOrThrow", rkClass);
    Method holderValue = m(holderClass, "value");
    Method register = m(mappedClass, "register", rkClass, Object.class, regInfoClass);
    Method freeze = m(c("net.minecraft.core.Registry"), "freeze");
    Object builtInInfo = f(regInfoClass, "BUILT_IN").get(null);
    Constructor<?> mappedCtor = mappedClass.getConstructor(rkClass, Lifecycle.class);

    Class<?> tagKeyClass = c("net.minecraft.tags.TagKey");
    Class<?> loadResultClass = c("net.minecraft.tags.TagLoader$LoadResult");
    Class<?> pendingTagsClass = c("net.minecraft.core.Registry$PendingTags");
    Method tagCreate = m(tagKeyClass, "create", rkClass, idClass);
    Method listElements = m(c("net.minecraft.core.HolderLookup"), "listElements");
    Method listTags = m(c("net.minecraft.core.HolderLookup"), "listTags");
    Method prepareTagReload = m(c("net.minecraft.core.Registry"), "prepareTagReload", loadResultClass);
    Method applyPendingTags = m(pendingTagsClass, "apply");
    Method regKeyMethod = m(c("net.minecraft.core.Registry"), "key");
    Method tagKeyMethod = m(c("net.minecraft.core.HolderSet$Named"), "key");
    Constructor<?> loadResultCtor = loadResultClass.getConstructor(rkClass, Map.class);
    Object fixtureId = id("minecraft:fixture");

    JsonObject orders = JsonParser.parseString(Files.readString(orderPath)).getAsJsonObject();
    for (Map.Entry<String, JsonElement> entry : orders.entrySet()) {
      Object regKey = createRegKey.invoke(null, id(entry.getKey()));
      Object source = lookupOrThrow.invoke(lookup, regKey);
      Object registry = mappedCtor.newInstance(regKey, Lifecycle.stable());
      for (JsonElement el : entry.getValue().getAsJsonArray()) {
        Object key = createKey.invoke(null, regKey, id(el.getAsString()));
        Object holder = getOrThrow.invoke(source, key);
        Object val = holderValue.invoke(holder);
        register.invoke(registry, key, val, builtInInfo);
      }
      freeze.invoke(registry);
      registries.put(regKey, registry);
    }
    for (Object reg : registries.values()) {
      if (!mappedClass.isInstance(reg)) continue;
      List<?> regHolders = ((java.util.stream.Stream<?>) listElements.invoke(reg)).toList();
      if (regHolders.isEmpty()) continue;
      Object sampleHolder = regHolders.size() > 1 ? regHolders.get(1) : regHolders.get(0);
      Map<Object, List<Object>> tagsMap = new LinkedHashMap<>();
      for (Object namedSet : ((java.util.stream.Stream<?>) listTags.invoke(reg)).toList()) {
        List<Object> members = new ArrayList<>();
        for (Object h : (Iterable<?>) namedSet) members.add(h);
        tagsMap.put(tagKeyMethod.invoke(namedSet), members);
      }
      Object regKey = regKeyMethod.invoke(reg);
      tagsMap.put(tagCreate.invoke(null, regKey, fixtureId), List.of(sampleHolder));
      Object pending = prepareTagReload.invoke(reg, loadResultCtor.newInstance(regKey, tagsMap));
      applyPendingTags.invoke(pending);
    }
    return c("net.minecraft.core.RegistryAccess$ImmutableRegistryAccess").getConstructor(Map.class).newInstance(registries);
  }

  public static void main(String[] args) throws Exception {
    loadMappings(Path.of(args[1]));
    m(c("net.minecraft.SharedConstants"), "tryDetectVersion").invoke(null);
    m(c("net.minecraft.server.Bootstrap"), "bootStrap").invoke(null);

    Object lookup = m(c("net.minecraft.data.registries.VanillaRegistries"), "createLookup").invoke(null);
    Object regAccess = registryAccess(lookup, Path.of(args[2]));

    Constructor<?> regBufCtor = c("net.minecraft.network.RegistryFriendlyByteBuf")
      .getConstructor(ByteBuf.class, c("net.minecraft.core.RegistryAccess"));
    Function<ByteBuf, Object> wrapper = buf -> {
      try {
        return regBufCtor.newInstance(buf, regAccess);
      } catch (Exception e) {
        throw new RuntimeException(e);
      }
    };

    Class<?> gpClass = c("net.minecraft.network.protocol.game.GameProtocols");
    Class<?> piClass = c("net.minecraft.network.ProtocolInfo");
    Method getCodec = m(piClass, "codec");

    Object cbTemplate = f(gpClass, "CLIENTBOUND_TEMPLATE").get(null);
    Object cbInfo = m(c("net.minecraft.network.protocol.SimpleUnboundProtocol"), "bind", Function.class)
      .invoke(cbTemplate, wrapper);

    Class<?> ctxClass = c("net.minecraft.network.protocol.game.GameProtocols$Context");
    Object ctx = Proxy.newProxyInstance(ctxClass.getClassLoader(), new Class<?>[]{ctxClass}, (p, method, mArgs) -> {
      if (method.getReturnType() == boolean.class) return Boolean.TRUE;
      if (method.isDefault()) return InvocationHandler.invokeDefault(p, method, mArgs);
      return null;
    });
    Object sbTemplate = f(gpClass, "SERVERBOUND_TEMPLATE").get(null);
    Object sbInfo = m(c("net.minecraft.network.protocol.UnboundProtocol"), "bind", Function.class, Object.class)
      .invoke(sbTemplate, wrapper, ctx);

    Map<String, Object> codecs = new HashMap<>();
    codecs.put("CLIENTBOUND", getCodec.invoke(cbInfo));
    codecs.put("SERVERBOUND", getCodec.invoke(sbInfo));

    Method decode = m(c("net.minecraft.network.codec.StreamDecoder"), "decode", Object.class);
    Method encode = m(c("net.minecraft.network.codec.StreamEncoder"), "encode", Object.class, Object.class);
    Method packetType = m(c("net.minecraft.network.protocol.Packet"), "type");

    List<Object> results = new ArrayList<>();
    for (JsonElement input : JsonParser.parseString(Files.readString(Path.of(args[3]))).getAsJsonArray()) {
      JsonObject entry = input.getAsJsonObject();
      Map<String, Object> row = new TreeMap<>();
      row.put("label", entry.get("label").getAsString());
      ByteBuf bytes = Unpooled.wrappedBuffer(Base64.getDecoder().decode(entry.get("wire").getAsString()));
      ByteBuf encoded = Unpooled.buffer();
      try {
        Object codec = codecs.get(entry.get("direction").getAsString());
        Object packet = decode.invoke(codec, bytes);
        row.put("remaining", bytes.readableBytes());
        row.put("nativeType", packetType.invoke(packet).toString());
        encode.invoke(codec, encoded, packet);
        byte[] output = new byte[encoded.readableBytes()];
        encoded.getBytes(encoded.readerIndex(), output);
        row.put("wire", Base64.getEncoder().encodeToString(output));
      } catch (Throwable error) {
        Throwable cause = error;
        while (cause.getCause() != null) cause = cause.getCause();
        row.put("error", cause.getClass().getSimpleName() + ": " + cause.getMessage());
        row.put("remaining", bytes.readableBytes());
      } finally {
        bytes.release();
        encoded.release();
      }
      results.add(row);
    }
    Files.writeString(Path.of(args[0]), new GsonBuilder().disableHtmlEscaping().create().toJson(results));
  }
}
