import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;
import com.google.gson.*;

// Native 1.21.11 BatModel animation oracle, BatAnimation keyframes, and HumanoidModel shield-blocking arm pose oracle.
public class ExtractPresentation12111 extends ExtractCreative12111 {
  static Object call(Object o, String name, Class<?>[] types, Object... args) throws Exception {
    return m(o.getClass(), name, types).invoke(o, args);
  }
  static Object extractAnim(Object def, Map<Object, String> targets, Map<Object, String> interpolations, Method vx, Method vy, Method vz, Class<?> defClass, Class<?> chanClass, Class<?> keyClass) throws Exception {
    Map<String, Object> bones = new TreeMap<>();
    @SuppressWarnings("unchecked")
    Map<String, List<?>> boneMap = (Map<String, List<?>>) f(defClass, "boneAnimations").get(def);
    for (var bone : boneMap.entrySet()) {
      List<Object> channels = new ArrayList<>();
      for (Object channel : bone.getValue()) {
        List<Object> frames = new ArrayList<>();
        for (Object frame : (Object[]) f(chanClass, "keyframes").get(channel)) {
          Object v = f(keyClass, "postTarget").get(frame);
          if (v == null) v = f(keyClass, "preTarget").get(frame);
          List<Object> row = new ArrayList<>();
          row.add(f(keyClass, "timestamp").get(frame));
          row.add(List.of(vx.invoke(v), vy.invoke(v), vz.invoke(v)));
          row.add(interpolations.get(f(keyClass, "interpolation").get(frame)));
          frames.add(row);
        }
        channels.add(Map.of(
          "target", targets.get(f(chanClass, "target").get(channel)),
          "frames", frames
        ));
      }
      bones.put(bone.getKey(), channels);
    }
    return Map.of(
      "length", f(defClass, "lengthInSeconds").get(def),
      "looping", f(defClass, "looping").get(def),
      "bones", bones
    );
  }

  public static void main(String[] args) throws Exception {
    loadMappings(Path.of(args[1]));
    m(c("net.minecraft.SharedConstants"), "tryDetectVersion").invoke(null);
    m(c("net.minecraft.server.Bootstrap"), "bootStrap").invoke(null);

    Class<?> batModelClass = c("net.minecraft.client.model.ambient.BatModel");
    Class<?> batStateClass = c("net.minecraft.client.renderer.entity.state.BatRenderState");
    Class<?> entityStateClass = c("net.minecraft.client.renderer.entity.state.EntityRenderState");
    Class<?> livingStateClass = c("net.minecraft.client.renderer.entity.state.LivingEntityRenderState");
    Class<?> animStateClass = c("net.minecraft.world.entity.AnimationState");
    Class<?> mp = c("net.minecraft.client.model.geom.ModelPart");
    Object layer = m(batModelClass, "createBodyLayer").invoke(null);
    Method bakeRoot = m(c("net.minecraft.client.model.geom.builders.LayerDefinition"), "bakeRoot");
    Constructor<?> batCtor = batModelClass.getConstructor(mp);
    Method batSetup = m(batModelClass, "setupAnim", batStateClass);
    Method animStart = m(animStateClass, "start", int.class);
    Method animStop = m(animStateClass, "stop");

    List<Object> batPoses = new ArrayList<>();
    for (boolean resting : new boolean[]{true, false}) {
      for (int start : new int[]{0, 3}) {
        for (float yaw : new float[]{-40f, 0f, 35f, 120f}) {
          for (float age : new float[]{0f, 2.5f, 7f, 12.25f}) {
            Object brRoot = bakeRoot.invoke(layer);
            Object bm = batCtor.newInstance(brRoot);
            Object state = batStateClass.getConstructor().newInstance();
            f(batStateClass, "isResting").setBoolean(state, resting);
            f(entityStateClass, "ageInTicks").setFloat(state, age);
            f(livingStateClass, "yRot").setFloat(state, yaw);
            Object flyAnim = f(batStateClass, "flyAnimationState").get(state);
            Object restAnim = f(batStateClass, "restAnimationState").get(state);
            if (resting) {
              animStart.invoke(restAnim, start);
              animStop.invoke(flyAnim);
            } else {
              animStart.invoke(flyAnim, start);
              animStop.invoke(restAnim);
            }
            batSetup.invoke(bm, state);
            Map<String, Object> parts = new TreeMap<>();
            dumpParts(brRoot, "$root", parts, mp);
            Map<String, Object> pose = new TreeMap<>();
            pose.put("resting", resting);
            pose.put("start", start);
            pose.put("yaw", yaw);
            pose.put("age", age);
            pose.put("parts", parts);
            batPoses.add(pose);
          }
        }
      }
    }

    int batFlagsId = ((Number) call(
      f(c("net.minecraft.world.entity.ambient.Bat"), "DATA_ID_FLAGS").get(null),
      "id", new Class<?>[]{}
    )).intValue();

    // Shield blocking poses
    Class<?> humanClass = c("net.minecraft.client.model.HumanoidModel");
    Class<?> humanStateClass = c("net.minecraft.client.renderer.entity.state.HumanoidRenderState");
    Class<?> cubeDefClass = c("net.minecraft.client.model.geom.builders.CubeDeformation");
    Object noneDef = f(cubeDefClass, "NONE").get(null);
    Object humanMesh = m(humanClass, "createMesh", cubeDefClass, float.class).invoke(null, noneDef, 0.0f);
    Object humanLayer = m(c("net.minecraft.client.model.geom.builders.LayerDefinition"), "create",
      c("net.minecraft.client.model.geom.builders.MeshDefinition"), int.class, int.class).invoke(null, humanMesh, 64, 64);
    Object humanRoot = bakeRoot.invoke(humanLayer);
    Object humanModel = humanClass.getConstructor(mp).newInstance(humanRoot);
    Object headPart = f(humanClass, "head").get(humanModel);
    Object rightArmPart = f(humanClass, "rightArm").get(humanModel);
    Object leftArmPart = f(humanClass, "leftArm").get(humanModel);
    Object blockPose = f(c("net.minecraft.client.model.HumanoidModel$ArmPose"), "BLOCK").get(null);
    Method poseRight = m(humanClass, "poseRightArm", humanStateClass);
    Method poseLeft = m(humanClass, "poseLeftArm", humanStateClass);

    List<Object> shields = new ArrayList<>();
    float[] headXs = {-2.0943952f, -1.0f, 0.0f, 0.7f, 1.5707964f};
    float[] headYs = {-1.5707964f, -0.17453292f, 0.0f, 0.43633232f, 1.5707964f};
    float[] initials = {0.0f, 0.7f};
    for (float hx : headXs) {
      for (float hy : headYs) {
        for (float init : initials) {
          for (boolean right : new boolean[]{true, false}) {
            Object state = humanStateClass.getConstructor().newInstance();
            f(humanStateClass, "rightArmPose").set(state, blockPose);
            f(humanStateClass, "leftArmPose").set(state, blockPose);
            f(mp, "xRot").setFloat(headPart, hx);
            f(mp, "yRot").setFloat(headPart, hy);
            Object arm = right ? rightArmPart : leftArmPart;
            f(mp, "xRot").setFloat(arm, init);
            f(mp, "yRot").setFloat(arm, 0.0f);
            if (right) poseRight.invoke(humanModel, state);
            else poseLeft.invoke(humanModel, state);
            Map<String, Object> row = new TreeMap<>();
            row.put("headX", hx);
            row.put("headY", hy);
            row.put("initial", init);
            row.put("right", right);
            row.put("rx", f(mp, "xRot").getFloat(arm));
            row.put("ry", f(mp, "yRot").getFloat(arm));
            shields.add(row);
          }
        }
      }
    }

    // BatAnimation keyframes
    Map<Object, String> targets = Map.of(
      f(c("net.minecraft.client.animation.AnimationChannel$Targets"), "POSITION").get(null), "position",
      f(c("net.minecraft.client.animation.AnimationChannel$Targets"), "ROTATION").get(null), "rotation",
      f(c("net.minecraft.client.animation.AnimationChannel$Targets"), "SCALE").get(null), "scale"
    );
    Map<Object, String> interpolations = Map.of(
      f(c("net.minecraft.client.animation.AnimationChannel$Interpolations"), "LINEAR").get(null), "linear",
      f(c("net.minecraft.client.animation.AnimationChannel$Interpolations"), "CATMULLROM").get(null), "catmullrom"
    );
    Class<?> vec = Class.forName("org.joml.Vector3fc");
    Method vx = vec.getMethod("x"), vy = vec.getMethod("y"), vz = vec.getMethod("z");
    Class<?> defClass = c("net.minecraft.client.animation.AnimationDefinition");
    Class<?> chanClass = c("net.minecraft.client.animation.AnimationChannel");
    Class<?> keyClass = c("net.minecraft.client.animation.Keyframe");
    Class<?> batAnimClass = c("net.minecraft.client.animation.definitions.BatAnimation");
    Map<String, Object> batAnim = new TreeMap<>();
    for (String k : List.of("BAT_FLYING", "BAT_RESTING")) {
      batAnim.put(k, extractAnim(f(batAnimClass, k).get(null), targets, interpolations, vx, vy, vz, defClass, chanClass, keyClass));
    }

    Map<String, Object> out = new TreeMap<>();
    out.put("batFlagsId", batFlagsId);
    out.put("batPoses", batPoses);
    out.put("shields", shields);
    out.put("animations", Map.of("bat", batAnim));
    Files.writeString(Path.of(args[0]), new Gson().toJson(out));
  }

  static void dumpParts(Object part, String name, Map<String, Object> out, Class<?> mp) throws Exception {
    out.put(name, List.of(
      f(mp, "x").getFloat(part),
      f(mp, "y").getFloat(part),
      f(mp, "z").getFloat(part),
      f(mp, "xRot").getFloat(part),
      f(mp, "yRot").getFloat(part),
      f(mp, "zRot").getFloat(part),
      f(mp, "xScale").getFloat(part),
      f(mp, "yScale").getFloat(part),
      f(mp, "zScale").getFloat(part),
      f(mp, "visible").getBoolean(part),
      f(mp, "skipDraw").getBoolean(part)
    ));
    @SuppressWarnings("unchecked")
    Map<String, Object> children = (Map<String, Object>) f(mp, "children").get(part);
    List<String> keys = new ArrayList<>(children.keySet());
    Collections.sort(keys);
    for (String k : keys) dumpParts(children.get(k), k, out, mp);
  }
}
