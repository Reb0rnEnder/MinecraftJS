import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;
import com.google.gson.*;

// Native 1.21.11 Armadillo keyframe definitions extracted from ArmadilloAnimation.
public class ExtractPawsAnimations12111 {
  public static void main(String[] args) throws Exception {
    ExtractMetadata12111.loadMappings(Path.of(args[1]));
    Map<Object, String> targets = Map.of(
      ExtractMetadata12111.f(ExtractMetadata12111.c("net.minecraft.client.animation.AnimationChannel$Targets"), "POSITION").get(null), "position",
      ExtractMetadata12111.f(ExtractMetadata12111.c("net.minecraft.client.animation.AnimationChannel$Targets"), "ROTATION").get(null), "rotation",
      ExtractMetadata12111.f(ExtractMetadata12111.c("net.minecraft.client.animation.AnimationChannel$Targets"), "SCALE").get(null), "scale"
    );
    Map<Object, String> interpolations = Map.of(
      ExtractMetadata12111.f(ExtractMetadata12111.c("net.minecraft.client.animation.AnimationChannel$Interpolations"), "LINEAR").get(null), "linear",
      ExtractMetadata12111.f(ExtractMetadata12111.c("net.minecraft.client.animation.AnimationChannel$Interpolations"), "CATMULLROM").get(null), "catmullrom"
    );
    Class<?> vec = Class.forName("org.joml.Vector3fc");
    Method vx = vec.getMethod("x"), vy = vec.getMethod("y"), vz = vec.getMethod("z");
    Class<?> armadilloAnim = ExtractMetadata12111.c("net.minecraft.client.animation.definitions.ArmadilloAnimation");
    Class<?> defClass = ExtractMetadata12111.c("net.minecraft.client.animation.AnimationDefinition");
    Class<?> chanClass = ExtractMetadata12111.c("net.minecraft.client.animation.AnimationChannel");
    Class<?> keyClass = ExtractMetadata12111.c("net.minecraft.client.animation.Keyframe");

    Map<String, Object> armadillo = new TreeMap<>();
    for (String name : List.of("ARMADILLO_ROLL_UP", "ARMADILLO_WALK", "ARMADILLO_PEEK", "ARMADILLO_ROLL_OUT")) {
      Object def = ExtractMetadata12111.f(armadilloAnim, name).get(null);
      Map<String, Object> bones = new TreeMap<>();
      @SuppressWarnings("unchecked")
      Map<String, List<?>> boneMap = (Map<String, List<?>>) ExtractMetadata12111.f(defClass, "boneAnimations").get(def);
      for (var bone : boneMap.entrySet()) {
        List<Object> channels = new ArrayList<>();
        for (Object channel : bone.getValue()) {
          List<Object> frames = new ArrayList<>();
          for (Object frame : (Object[]) ExtractMetadata12111.f(chanClass, "keyframes").get(channel)) {
            Object v = ExtractMetadata12111.f(keyClass, "postTarget").get(frame);
            if (v == null) v = ExtractMetadata12111.f(keyClass, "preTarget").get(frame);
            List<Object> row = new ArrayList<>();
            row.add(ExtractMetadata12111.f(keyClass, "timestamp").get(frame));
            row.add(List.of(vx.invoke(v), vy.invoke(v), vz.invoke(v)));
            row.add(interpolations.get(ExtractMetadata12111.f(keyClass, "interpolation").get(frame)));
            frames.add(row);
          }
          channels.add(Map.of(
            "target", targets.get(ExtractMetadata12111.f(chanClass, "target").get(channel)),
            "frames", frames
          ));
        }
        bones.put(bone.getKey(), channels);
      }
      armadillo.put(name, Map.of(
        "length", ExtractMetadata12111.f(defClass, "lengthInSeconds").get(def),
        "looping", ExtractMetadata12111.f(defClass, "looping").get(def),
        "bones", bones
      ));
    }
    Files.writeString(Path.of(args[0]), new Gson().toJson(Map.of("armadillo", armadillo)));
  }
}
