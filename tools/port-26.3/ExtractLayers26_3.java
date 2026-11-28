import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;
import com.google.gson.*;

// Native 26.3 model layers. Unlike the 1.19.4 harness this jar is not obfuscated, so the real
// class, field and method names are used directly and no mappings file is needed.
public class ExtractLayers26_3 {
 static List<Float> vector(Object value) throws Exception {
  List<Float> out = new ArrayList<>();
  for (String key : new String[]{"x", "y", "z"}) out.add(((Number) value.getClass().getField(key).get(value)).floatValue());
  return out;
 }

 static Field f(Class<?> c, String name) throws Exception {
  for (Class<?> k = c; k != null; k = k.getSuperclass()) {
   try { Field result = k.getDeclaredField(name); result.setAccessible(true); return result; } catch (NoSuchFieldException ignored) { }
  }
  throw new NoSuchFieldException(name);
 }

 static float num(Object o, String name) throws Exception {
  return ((Number) f(o.getClass(), name).get(o)).floatValue();
 }

 // 26.3 leaves the pose scale/rotation fields NaN until a pose is loaded; JSON cannot carry NaN.
 static float finite(float value, float fallback) {
  return Float.isFinite(value) ? value : fallback;
 }

 static List<Object> parts;
 static IdentityHashMap<Object, Integer> ids;

 static int part(Object value) throws Exception {
  if (ids.containsKey(value)) return ids.get(value);
  int id = parts.size();
  ids.put(value, id);
  Map<String, Object> result = new LinkedHashMap<>();
  parts.add(result);
  result.put("tw", 1);
  result.put("th", 1);
  result.put("p", Arrays.asList(finite(num(value, "x"), 0), finite(num(value, "y"), 0), finite(num(value, "z"), 0)));
  result.put("r", Arrays.asList(finite(num(value, "xRot"), 0), finite(num(value, "yRot"), 0), finite(num(value, "zRot"), 0)));
  result.put("s", Arrays.asList(finite(num(value, "xScale"), 1), finite(num(value, "yScale"), 1), finite(num(value, "zScale"), 1)));
  result.put("mirror", false);
  result.put("show", f(value.getClass(), "visible").get(value));

  List<Object> cubes = new ArrayList<>();
  for (Object cube : (List<?>) f(value.getClass(), "cubes").get(value)) {
   List<Float> quads = new ArrayList<>();
   for (Object polygon : (Object[]) cube.getClass().getField("polygons").get(cube)) {
    List<Float> normal = vector(polygon.getClass().getMethod("normal").invoke(polygon));
    for (Object vertex : (Object[]) polygon.getClass().getMethod("vertices").invoke(polygon)) {
     for (String key : new String[]{"x", "y", "z"}) quads.add(((Number) vertex.getClass().getMethod(key).invoke(vertex)).floatValue());
     quads.add(finite(((Number) vertex.getClass().getMethod("u").invoke(vertex)).floatValue(), 0));
     quads.add(finite(((Number) vertex.getClass().getMethod("v").invoke(vertex)).floatValue(), 0));
     quads.addAll(normal);
    }
   }
   double x = num(cube, "minX"), y = num(cube, "minY"), z = num(cube, "minZ");
   cubes.add(Arrays.asList(0, 0, x, y, z, num(cube, "maxX") - x, num(cube, "maxY") - y, num(cube, "maxZ") - z, 0, false, quads));
  }
  result.put("boxes", cubes);

  Map<String, Integer> children = new LinkedHashMap<>();
  for (Map.Entry<?, ?> entry : ((Map<?, ?>) f(value.getClass(), "children").get(value)).entrySet()) {
   children.put(entry.getKey().toString(), part(entry.getValue()));
  }
  result.put("children", new ArrayList<>(children.values()));
  result.put("namedChildren", children);
  return id;
 }

 public static void main(String[] args) throws Exception {
  Class.forName("net.minecraft.SharedConstants").getMethod("tryDetectVersion").invoke(null);
  Class.forName("net.minecraft.server.Bootstrap").getMethod("bootStrap").invoke(null);
  Map<?, ?> definitions = (Map<?, ?>) Class.forName("net.minecraft.client.model.geom.LayerDefinitions").getMethod("createRoots").invoke(null);
  Map<String, Object> output = new LinkedHashMap<>();
  for (Map.Entry<?, ?> entry : definitions.entrySet()) {
   Object root = Class.forName("net.minecraft.client.model.geom.builders.LayerDefinition").getMethod("bakeRoot").invoke(entry.getValue());
   parts = new ArrayList<>();
   ids = new IdentityHashMap<>();
   int index = part(root);
   output.put(entry.getKey().toString(), Map.of("root", index, "parts", parts));
  }
  Files.writeString(Path.of(args[0]), new Gson().toJson(output));
  System.out.println("Extracted native model layers: " + output.size());
 }
}
