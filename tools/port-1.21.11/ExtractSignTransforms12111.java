import com.google.gson.*;
import com.mojang.serialization.*;
import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;

// Native 1.21.11 Sign/HangingSign frame transforms, AttachmentType chain visibility, and SignText JSON codec oracle.
public class ExtractSignTransforms12111 extends ExtractCreative12111 {
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
    m(c("net.minecraft.server.Bootstrap"), "bootStrap").invoke(null);

    Class<?> blockClass = c("net.minecraft.world.level.block.Block");
    Class<?> stateClass = c("net.minecraft.world.level.block.state.BlockState");
    Class<?> poseClass = c("com.mojang.blaze3d.vertex.PoseStack");
    Class<?> hangSealClass = c("net.minecraft.world.level.block.CeilingHangingSignBlock");
    Class<?> hangWallClass = c("net.minecraft.world.level.block.WallHangingSignBlock");
    Class<?> signBlockClass = c("net.minecraft.world.level.block.SignBlock");
    Class<?> signRenClass = c("net.minecraft.client.renderer.blockentity.SignRenderer");
    Class<?> hangRenClass = c("net.minecraft.client.renderer.blockentity.HangingSignRenderer");
    Class<?> attClass = c("net.minecraft.client.renderer.blockentity.HangingSignRenderer$AttachmentType");
    Method stateById = m(blockClass, "stateById", int.class);
    Method getRot = m(signBlockClass, "getYRotationDegrees", stateClass);
    Method attByState = m(attClass, "byBlockState", stateClass);
    Method createHangLayer = m(hangRenClass, "createHangingSignLayer", attClass);
    Method bakeRoot = m(c("net.minecraft.client.model.geom.builders.LayerDefinition"), "bakeRoot");

    List<Object> samples = new ArrayList<>();
    for (JsonElement input : JsonParser.parseString(Files.readString(Path.of(args[2]))).getAsJsonArray()) {
      JsonObject e = input.getAsJsonObject();
      int id = e.get("state").getAsInt();
      Object state = stateById.invoke(null, id);
      Object block = call(state, "getBlock", new Class<?>[]{});
      boolean hanging = hangSealClass.isInstance(block) || hangWallClass.isInstance(block);
      Class<?> renderer = hanging ? hangRenClass : signRenClass;
      Object r = blank(renderer);
      Object pose = poseClass.getConstructor().newInstance();
      float rotation = -((Number) getRot.invoke(block, state)).floatValue();
      m(renderer, "translateSign", poseClass, float.class, stateClass).invoke(r, pose, rotation, state);
      Object last = call(pose, "last", new Class<?>[]{});
      Object matrix = call(last, "pose", new Class<?>[]{});
      float[] transform = new float[16];
      matrix.getClass().getMethod("get", float[].class).invoke(matrix, (Object) transform);

      Map<String, Object> out = new TreeMap<>();
      out.put("label", e.get("label").getAsString());
      out.put("state", id);
      out.put("transform", transform);
      out.put("modelScale", call(r, "getSignModelRenderScale", new Class<?>[]{}));
      out.put("textScale", call(r, "getSignTextRenderScale", new Class<?>[]{}));
      Object offset = call(r, "getTextOffset", new Class<?>[]{});
      out.put("textOffset", List.of(
        f(offset.getClass(), "x").get(offset),
        f(offset.getClass(), "y").get(offset),
        f(offset.getClass(), "z").get(offset)
      ));
      if (hanging) {
        Object att = attByState.invoke(null, state);
        Object root = bakeRoot.invoke(createHangLayer.invoke(null, att));
        Map<String, Object> visible = new TreeMap<>();
        for (String key : List.of("plank", "vChains", "normalChains")) {
          visible.put(key, call(root, "hasChild", new Class<?>[]{String.class}, key));
        }
        out.put("attachment", ((Enum<?>) att).name().toLowerCase(Locale.ROOT));
        out.put("visible", visible);
      }
      samples.add(out);
    }

    @SuppressWarnings("rawtypes") Codec textCodec = (Codec) f(c("net.minecraft.world.level.block.entity.SignText"), "DIRECT_CODEC").get(null);
    JsonObject textInput = new JsonObject();
    JsonArray messages = new JsonArray();
    messages.add(JsonParser.parseString("{\"text\":\"Zażółć \\\"test\\\"\",\"bold\":true}"));
    messages.add("back");
    messages.add("");
    messages.add("");
    textInput.add("messages", messages);
    textInput.addProperty("color", "red");
    textInput.addProperty("has_glowing_text", true);
    @SuppressWarnings("unchecked") Object signText = textCodec.parse(JsonOps.INSTANCE, textInput).getOrThrow();
    @SuppressWarnings("unchecked") JsonElement encodedText = (JsonElement) textCodec.encodeStart(JsonOps.INSTANCE, signText).getOrThrow();

    Files.writeString(Path.of(args[0]), new GsonBuilder().disableHtmlEscaping().create().toJson(Map.of(
      "samples", samples,
      "signText", encodedText
    )));
  }
}
