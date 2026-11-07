import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;
import com.google.gson.*;

//// Target-native 1.20.6 block visual/shape table. Reflection uses official mappings.
public class ExtractVisualRuntime1206 {
  static Map<String,String> classNames = new HashMap<>(), originalNames = new HashMap<>();
  static Map<String,Map<String,String>> methodNames = new HashMap<>(), fieldNames = new HashMap<>();

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
    String key = name + "(" + String.join(",", Arrays.stream(args).map(ExtractVisualRuntime1206::original).toArray(String[]::new)) + ")";
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

  static Object call(Object object, String name, Class<?>[] types, Object... args) throws Exception {
    return m(object.getClass(), name, types).invoke(object, args);
  }

  static List<Double> box(Object box) throws Exception {
    List<Double> values = new ArrayList<>();
    for (String name : new String[]{"minX","minY","minZ","maxX","maxY","maxZ"}) {
      values.add(f(box.getClass(), name).getDouble(box));
    }
    return values;
  }

  public static void main(String[] args) throws Exception {
    loadMappings(Path.of(args[1]));
    int stateCount = Integer.parseInt(args[2]);

    m(c("net.minecraft.SharedConstants"), "tryDetectVersion").invoke(null);
    m(c("net.minecraft.server.Bootstrap"), "bootStrap").invoke(null);

    Class<?> block = c("net.minecraft.world.level.block.Block");
    Class<?> state = c("net.minecraft.world.level.block.state.BlockState");
    Class<?> access = c("net.minecraft.world.level.BlockGetter");
    Class<?> pos = c("net.minecraft.core.BlockPos");
    Object origin = pos.getConstructor(int.class, int.class, int.class).newInstance(0, 0, 0);
    Object air = m(block, "stateById", int.class).invoke(null, 0);
    final Object[] current = { air };

    Object world = Proxy.newProxyInstance(access.getClassLoader(), new Class[]{access}, (object, method, methodArgs) -> {
      Object s = methodArgs != null && methodArgs.length > 0 && origin.equals(methodArgs[0]) ? current[0] : air;
      if (method.getReturnType() == state) return s;
      if (method.getReturnType() == c("net.minecraft.world.level.material.FluidState")) {
        return m(state, "getFluidState").invoke(s);
      }
      if (method.getReturnType() == int.class) {
        return method.getName().equals(m(access, "getMaxLightLevel").getName()) ? 15 : 256;
      }
      if (method.getReturnType() == boolean.class) return false;
      return null;
    });

    List<Object> selections = new ArrayList<>();
    List<Object> collisions = new ArrayList<>();
    List<Object> rendering = new ArrayList<>();
    List<String> errors = new ArrayList<>();

    for (int id = 0; id < stateCount; id++) {
      Object s = m(block, "stateById", int.class).invoke(null, id);
      current[0] = s;
      try {
        Object shape = m(state, "getShape", access, pos).invoke(s, world, origin);
        boolean empty = (boolean) call(shape, "isEmpty", new Class[]{});
        selections.add(empty ? null : box(call(shape, "bounds", new Class[]{})));

        Object collision = m(state, "getCollisionShape", access, pos).invoke(s, world, origin);
        List<Object> collisionBoxes = new ArrayList<>();
        for (Object value : (List<?>) call(collision, "toAabbs", new Class[]{})) collisionBoxes.add(box(value));
        collisions.add(collisionBoxes);

        Map<String,Object> render = new LinkedHashMap<>();
        render.put("renderType", ((Enum<?>) m(state, "getRenderShape").invoke(s)).ordinal());
        render.put("suffocates", m(state, "isSuffocating", access, pos).invoke(s, world, origin));
        render.put("viewBlocking", m(state, "isViewBlocking", access, pos).invoke(s, world, origin));
        render.put("solid", m(state, "isSolidRender", access, pos).invoke(s, world, origin));
        render.put("occludes", m(state, "canOcclude").invoke(s));
        render.put("lightBlock", m(state, "getLightBlock", access, pos).invoke(s, world, origin));
        render.put("shade", m(state, "getShadeBrightness", access, pos).invoke(s, world, origin));
        render.put("emission", m(state, "getLightEmission").invoke(s));
        render.put("collisionFull", m(state, "isCollisionShapeFullBlock", access, pos).invoke(s, world, origin));
        render.put("sturdyTop", m(state, "isFaceSturdy", access, pos, c("net.minecraft.core.Direction"))
          .invoke(s, world, origin, f(c("net.minecraft.core.Direction"), "UP").get(null)));
        render.put("sturdyBottom", m(state, "isFaceSturdy", access, pos, c("net.minecraft.core.Direction"))
          .invoke(s, world, origin, f(c("net.minecraft.core.Direction"), "DOWN").get(null)));

        Object sound = m(state, "getSoundType").invoke(s);
        Class<?> soundType = c("net.minecraft.world.level.block.SoundType");
        List<Object> sounds = new ArrayList<>();
        for (String method : new String[]{"getStepSound","getBreakSound","getPlaceSound"}) {
          sounds.add(m(c("net.minecraft.sounds.SoundEvent"), "getLocation")
            .invoke(m(soundType, method).invoke(sound)).toString().replace("minecraft:", ""));
        }
        sounds.add(m(soundType, "getVolume").invoke(sound));
        sounds.add(m(soundType, "getPitch").invoke(sound));
        for (String method : new String[]{"getHitSound","getFallSound"}) {
          sounds.add(m(c("net.minecraft.sounds.SoundEvent"), "getLocation")
            .invoke(m(soundType, method).invoke(sound)).toString().replace("minecraft:", ""));
        }
        render.put("sound", sounds);

        Object occlusion = m(state, "getOcclusionShape", access, pos).invoke(s, world, origin);
        List<Object> occlusionBoxes = new ArrayList<>();
        for (Object value : (List<?>) call(occlusion, "toAabbs", new Class[]{})) occlusionBoxes.add(box(value));
        render.put("occlusion", occlusionBoxes);
        rendering.add(render);
      } catch (Throwable error) {
        selections.add(null);
        collisions.add(null);
        rendering.add(null);
        errors.add(id + ":" + error);
      }
    }

    Map<String,Object> output = new LinkedHashMap<>();
    output.put("selections", selections);
    output.put("collisions", collisions);
    output.put("rendering", rendering);
    output.put("errors", errors);
    Files.writeString(Path.of(args[0]), new Gson().toJson(output));
    System.out.println("Extracted native 1.20.6 visual states: " + stateCount + ", errors=" + errors.size());
  }
}
