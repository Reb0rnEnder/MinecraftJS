import com.google.gson.*;
import com.mojang.serialization.*;
import java.io.*;
import java.lang.reflect.*;
import java.nio.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.*;
import java.util.zip.*;

// Runs native 1.21.11 Unihex loading, glyph metrics, and pixel unpacking; no GL context.
public class ExtractFonts12111 extends ExtractCreative12111 {
  static Object call(Object o, String name, Class<?>[] types, Object... args) throws Exception {
    return m(o.getClass(), name, types).invoke(o, args);
  }

  public static void main(String[] args) throws Exception {
    loadMappings(Path.of(args[1]));
    List<Object> result = new ArrayList<>();
    Class<?> definition = c("net.minecraft.client.gui.font.providers.UnihexProvider$Definition");
    Class<?> provider = c("net.minecraft.client.gui.font.providers.UnihexProvider");
    Class<?> glyphClass = c("net.minecraft.client.gui.font.providers.UnihexProvider$Glyph");
    Class<?> info = c("com.mojang.blaze3d.font.GlyphInfo");
    Class<?> lines = c("net.minecraft.client.gui.font.providers.UnihexProvider$LineData");
    @SuppressWarnings("rawtypes") Codec codec = ((MapCodec<?>) f(definition, "CODEC").get(null)).codec();

    Method loadData = m(definition, "loadData", InputStream.class);
    Method getGlyph = m(provider, "getGlyph", int.class);
    Method unpack = m(provider, "unpackBitsToBytes", IntBuffer.class, lines, int.class, int.class);
    Method glyphInfo = m(glyphClass, "info");
    Method adv = m(info, "getAdvance");
    Method advBold = m(info, "getAdvance", boolean.class);
    Method shadowOff = m(info, "getShadowOffset");
    Field leftF = f(glyphClass, "left");
    Field rightF = f(glyphClass, "right");
    Field contF = f(glyphClass, "contents");

    for (JsonElement input : JsonParser.parseString(Files.readString(Path.of(args[2]))).getAsJsonArray()) {
      JsonObject entry = input.getAsJsonObject();
      @SuppressWarnings("unchecked") Object def = codec.parse(JsonOps.INSTANCE, entry.get("definition")).getOrThrow();
      byte[] bytes;
      if (entry.has("hex")) {
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(buffer)) {
          zip.putNextEntry(new ZipEntry("test.hex"));
          zip.write(entry.get("hex").getAsString().getBytes(StandardCharsets.US_ASCII));
          zip.closeEntry();
        }
        bytes = buffer.toByteArray();
      } else {
        bytes = Files.readAllBytes(Path.of(entry.get("path").getAsString()));
      }
      Object font = loadData.invoke(def, new ByteArrayInputStream(bytes));
      List<Object> glyphs = new ArrayList<>();
      for (JsonElement ch : entry.getAsJsonArray("characters")) {
        int code = ch.getAsString().codePointAt(0);
        Object glyph = getGlyph.invoke(font, code);
        Map<String, Object> g = new TreeMap<>();
        g.put("character", ch.getAsString());
        if (glyph != null) {
          int left = leftF.getInt(glyph);
          int right = rightF.getInt(glyph);
          int width = right - left + 1;
          IntBuffer pixels = IntBuffer.allocate(width * 16);
          unpack.invoke(null, pixels, contF.get(glyph), left, right);
          byte[] alpha = new byte[width * 16];
          for (int i = 0; i < alpha.length; i++) alpha[i] = (byte) (pixels.get(i) == 0 ? 0 : 255);
          Object gi = glyphInfo.invoke(glyph);
          g.put("advance", adv.invoke(gi));
          g.put("boldAdvance", advBold.invoke(gi, true));
          g.put("shadowOffset", shadowOff.invoke(gi));
          g.put("width", width / 2.0);
          g.put("pixelWidth", width);
          g.put("alphaSha256", HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(alpha)));
        } else {
          g.put("missing", true);
        }
        glyphs.add(g);
      }
      result.add(Map.of("label", entry.get("label").getAsString(), "glyphs", glyphs));
    }
    Files.writeString(Path.of(args[0]), new GsonBuilder().disableHtmlEscaping().create().toJson(result));
  }
}
