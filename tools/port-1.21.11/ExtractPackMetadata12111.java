import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;
import com.google.gson.*;

// Native 1.21.11 PackMetadataSection, OverlayMetadataSection, and ResourceFilterSection oracle.
public class ExtractPackMetadata12111 extends ExtractCreative12111 {
  public static void main(String[] args) throws Exception {
    loadMappings(Path.of(args[1]));
    m(c("net.minecraft.SharedConstants"), "tryDetectVersion").invoke(null);
    m(c("net.minecraft.server.Bootstrap"), "bootStrap").invoke(null);

    Class<?> packSectionClass = c("net.minecraft.server.packs.metadata.pack.PackMetadataSection");
    Class<?> overlayClass = c("net.minecraft.server.packs.OverlayMetadataSection");
    Class<?> filterClass = c("net.minecraft.server.packs.resources.ResourceFilterSection");
    Class<?> metaTypeClass = c("net.minecraft.server.packs.metadata.MetadataSectionType");
    Class<?> packFormatClass = c("net.minecraft.server.packs.metadata.pack.PackFormat");
    Method codecMethod = m(metaTypeClass, "codec");
    Method formatOf = m(packFormatClass, "of", int.class, int.class);
    Method overlaysForVersion = m(overlayClass, "overlaysForVersion", packFormatClass);
    Method isNsFiltered = m(filterClass, "isNamespaceFiltered", String.class);
    Method isPathFiltered = m(filterClass, "isPathFiltered", String.class);

    Object packCodec = codecMethod.invoke(f(packSectionClass, "CLIENT_TYPE").get(null));
    Object overlayCodec = codecMethod.invoke(f(overlayClass, "CLIENT_TYPE").get(null));
    Object filterCodec = codecMethod.invoke(f(filterClass, "TYPE").get(null));

    List<Object> results = new ArrayList<>();
    for (JsonElement el : JsonParser.parseString(Files.readString(Path.of(args[2]))).getAsJsonArray()) {
      JsonObject input = el.getAsJsonObject();
      String section = input.get("section").getAsString();
      JsonElement value = input.get("value");
      Map<String, Object> out = new LinkedHashMap<>();
      out.put("label", input.get("label").getAsString());
      out.put("section", section);
      if ("filter".equals(section)) {
        var parsed = ((com.mojang.serialization.Codec<?>) filterCodec).parse(com.mojang.serialization.JsonOps.INSTANCE, value);
        out.put("valid", parsed.isSuccess());
        if (parsed.isSuccess()) {
          Object sec = parsed.getOrThrow();
          List<Object> qOut = new ArrayList<>();
          for (JsonElement qEl : input.getAsJsonArray("queries")) {
            JsonObject q = qEl.getAsJsonObject();
            String ns = q.get("namespace").getAsString(), p = q.get("path").getAsString();
            qOut.add(Map.of(
              "namespace", ns,
              "path", p,
              "blocked", (Boolean) isNsFiltered.invoke(sec, ns) || (Boolean) isPathFiltered.invoke(sec, p)
            ));
          }
          out.put("queries", qOut);
        }
      } else if ("overlays".equals(section)) {
        var parsed = ((com.mojang.serialization.Codec<?>) overlayCodec).parse(com.mojang.serialization.JsonOps.INSTANCE, value);
        out.put("valid", parsed.isSuccess());
        if (parsed.isSuccess()) {
          Object sec = parsed.getOrThrow();
          List<Object> qOut = new ArrayList<>();
          for (JsonElement qEl : input.getAsJsonArray("formats")) {
            JsonArray arr = qEl.getAsJsonArray();
            int maj = arr.get(0).getAsInt(), min = arr.size() > 1 ? arr.get(1).getAsInt() : 0;
            Object fmt = formatOf.invoke(null, maj, min);
            qOut.add(Map.of("format", List.of(maj, min), "overlays", overlaysForVersion.invoke(sec, fmt)));
          }
          out.put("queries", qOut);
        }
      } else if ("pack".equals(section)) {
        var parsed = ((com.mojang.serialization.Codec<?>) packCodec).parse(com.mojang.serialization.JsonOps.INSTANCE, value);
        out.put("valid", parsed.isSuccess());
      }
      results.add(out);
    }
    Files.writeString(Path.of(args[0]), new GsonBuilder().setPrettyPrinting().create().toJson(results));
  }
}
