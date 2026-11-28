import com.google.gson.*;
import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;

// Native 1.21.11 Window.calculateScale + TitleScreen fade timing oracle.
public class ExtractUiState12111 extends ExtractCreative12111 {
  static Object call(Object o, String name, Class<?>[] types, Object... args) throws Exception {
    return m(o.getClass(), name, types).invoke(o, args);
  }
  static Object blank(Class<?> cls) throws Exception {
    Field f = sun.misc.Unsafe.class.getDeclaredField("theUnsafe");
    f.setAccessible(true);
    return ((sun.misc.Unsafe) f.get(null)).allocateInstance(cls);
  }

  public static void main(String[] args) throws Exception {
    loadMappings(Path.of(args[1]));
    m(c("net.minecraft.SharedConstants"), "tryDetectVersion").invoke(null);
    Map<String, Object> out = new TreeMap<>();

    Object window = blank(c("com.mojang.blaze3d.platform.Window"));
    List<Object> scales = new ArrayList<>();
    for (int[] size : new int[][]{{320, 240}, {640, 480}, {854, 480}, {1280, 720}, {3440, 1440}, {3840, 2160}}) {
      for (int requested : new int[]{0, 1, 2, 3, 4, 8}) {
        for (boolean unicode : new boolean[]{false, true}) {
          f(window.getClass(), "framebufferWidth").setInt(window, size[0]);
          f(window.getClass(), "framebufferHeight").setInt(window, size[1]);
          scales.add(Map.of(
            "size", List.of(size[0], size[1]),
            "requested", requested,
            "unicode", unicode,
            "scale", call(window, "calculateScale", new Class<?>[]{int.class, boolean.class}, requested, unicode)
          ));
        }
      }
    }
    out.put("scales", scales);

    long[] now = {10000};
    Field clock = f(c("net.minecraft.util.Util"), "timeSource");
    Object old = clock.get(null);
    Object time = Proxy.newProxyInstance(ExtractUiState12111.class.getClassLoader(), new Class<?>[]{clock.getType()}, (p, meth, vals) -> now[0] * 1000000L);
    List<Object> fade = new ArrayList<>();
    Class<?> titleClass = c("net.minecraft.client.gui.screens.TitleScreen");
    Class<?> screenClass = c("net.minecraft.client.gui.screens.Screen");
    Class<?> widgetClass = c("net.minecraft.client.gui.components.AbstractWidget");
    try {
      clock.set(null, time);
      for (int elapsed : new int[]{0, 250, 500, 750, 999, 1000, 1250, 1500, 1750, 2000, 2001, 3000}) {
        Object title = blank(titleClass);
        Object button = blank(c("net.minecraft.client.gui.components.Button$Plain"));
        f(titleClass, "fading").setBoolean(title, true);
        f(titleClass, "fadeInStart").setLong(title, 10000L);
        f(screenClass, "children").set(title, new ArrayList<>(List.of(button)));
        f(widgetClass, "alpha").setFloat(button, 1f);
        now[0] = 10000 + elapsed;
        try {
          call(title, "render", new Class<?>[]{c("net.minecraft.client.gui.GuiGraphics"), int.class, int.class, float.class}, null, 0, 0, 0f);
          throw new AssertionError("Render must need a client context");
        } catch (InvocationTargetException expected) {
          if (!(expected.getCause() instanceof NullPointerException)) throw expected;
        }
        fade.add(Map.of(
          "elapsed", elapsed,
          "widgets", f(widgetClass, "alpha").getFloat(button),
          "fading", f(titleClass, "fading").getBoolean(title)
        ));
      }
    } finally {
      clock.set(null, old);
    }
    out.put("titleFade", fade);
    Files.writeString(Path.of(args[0]), new Gson().toJson(out));
  }
}
