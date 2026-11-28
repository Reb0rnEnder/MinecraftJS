import com.google.gson.*;
import java.nio.file.*;
import java.lang.reflect.*;
import java.util.*;

// Runs the pinned native WorldBorder. No server, wall clock or graphics metrics.
class ExtractBorder12111 {
  static Class<?> border;
  static Map<String,String> methods = new HashMap<>();
  static Object call(Object object, String name, Class<?>[] types, Object... args) throws Exception {
    return border.getMethod(methods.get(name), types).invoke(object, args);
  }
  static Object get(Object object, String name) throws Exception { return call(object, name, new Class<?>[0]); }
  static JsonObject sample(Object b, int tick) throws Exception {
    JsonObject out = new JsonObject();
    out.addProperty("tick", tick);
    for (String name : new String[]{"getSize","getLerpTime","getLerpSpeed","getWarningTime","getWarningBlocks"})
      out.addProperty(name, (Number)get(b, name));
    JsonArray bounds = new JsonArray();
    for (float partial : new float[]{0, .25f, .5f, 1}) {
      JsonArray row = new JsonArray();
      for (String name : new String[]{"getMinX","getMinZ","getMaxX","getMaxZ"})
        row.add((Number)call(b, name, new Class<?>[]{float.class}, partial));
      bounds.add(row);
    }
    out.add("bounds", bounds);
    return out;
  }
  public static void main(String[] args) throws Exception {
    boolean owner = false;
    for (String line : Files.readAllLines(Path.of(args[1]))) {
      if (!line.startsWith(" ") && line.contains(" -> ")) {
        owner = line.startsWith("net.minecraft.world.level.border.WorldBorder -> ");
        if (owner) border = Class.forName(line.split(" -> ")[1].replace(":", ""));
      } else if (owner && line.contains("(")) {
        String[] parts = line.trim().split(" -> ");
        String signature = parts[0].replaceFirst("^(?:[0-9]+:[0-9]+:)+", "");
        String name = signature.substring(signature.indexOf(' ') + 1, signature.indexOf('('));
        methods.put(name, parts[1]);
      }
    }
    JsonArray cases = new JsonArray();
    for (long duration : new long[]{1, 4, 300, 5000000000L, Long.MAX_VALUE}) {
      for (double target : new double[]{20, 200, 100}) {
        Object b = border.getConstructor().newInstance();
        call(b,"setCenter",new Class<?>[]{double.class,double.class},4d,-3d);
        call(b,"lerpSizeBetween",new Class<?>[]{double.class,double.class,long.class,long.class},100d,target,duration,42L);
        JsonObject c = new JsonObject();
        c.addProperty("duration",Long.toString(duration)); c.addProperty("target",target);
        JsonArray samples = new JsonArray();
        for (int tick = 0; tick <= 5; tick++) {
          samples.add(sample(b,tick));
          call(b,"tick",new Class<?>[0]);
        }
        c.add("samples",samples); cases.add(c);
      }
    }
    JsonObject out = new JsonObject(); out.add("cases",cases);
    Files.writeString(Path.of(args[0]),new GsonBuilder().setPrettyPrinting().create().toJson(out)+"\n");
  }
}
