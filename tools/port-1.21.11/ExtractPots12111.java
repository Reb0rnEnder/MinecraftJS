import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;
import com.google.gson.*;

// Native 1.21.11 DecoratedPot + BrushableBlock + BrushTransform oracle.
public class ExtractPots12111 extends ExtractCreative12111 {
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

    // 1. DecoratedPotPatterns registry (ITEM -> DecoratedPotPattern.assetId)
    Object itemReg = f(c("net.minecraft.core.registries.BuiltInRegistries"), "ITEM").get(null);
    Object potReg = f(c("net.minecraft.core.registries.BuiltInRegistries"), "DECORATED_POT_PATTERN").get(null);
    Class<?> regClass = c("net.minecraft.core.Registry");
    Method regGetKey = m(regClass, "getKey", Object.class);
    Method regGetValueKey = m(regClass, "getValue", c("net.minecraft.resources.ResourceKey"));
    Class<?> patClass = c("net.minecraft.world.level.block.entity.DecoratedPotPatterns");
    Method fromItem = m(patClass, "getPatternFromItem", c("net.minecraft.world.item.Item"));
    Method assetId = m(c("net.minecraft.world.level.block.entity.DecoratedPotPattern"), "assetId");
    Map<String, String> patterns = new TreeMap<>();
    for (Object item : (Iterable<?>) itemReg) {
      Object rk = fromItem.invoke(null, item);
      if (rk == null) continue;
      Object pat = regGetValueKey.invoke(potReg, rk);
      Object aid = assetId.invoke(pat);
      String itemKey = regGetKey.invoke(itemReg, item).toString();
      patterns.put(itemKey, aid.toString());
    }

    // 2. Wobble durations & triggerEvent + default itemFacing
    Class<?> potBeClass = c("net.minecraft.world.level.block.entity.DecoratedPotBlockEntity");
    Class<?> wobbleClass = c("net.minecraft.world.level.block.entity.DecoratedPotBlockEntity$WobbleStyle");
    Map<String, Object> durations = new TreeMap<>();
    for (Object w : wobbleClass.getEnumConstants()) {
      durations.put(((Enum<?>) w).name(), f(wobbleClass, "duration").getInt(w));
    }

    Object potBlock = f(c("net.minecraft.world.level.block.Blocks"), "DECORATED_POT").get(null);
    Object defaultPotState = call(potBlock, "defaultBlockState", new Class<?>[]{});
    Class<?> posClass = c("net.minecraft.core.BlockPos");
    Object pos0 = posClass.getConstructor(int.class, int.class, int.class).newInstance(0, 64, 0);
    Object be = potBeClass.getConstructor(posClass, c("net.minecraft.world.level.block.state.BlockState")).newInstance(pos0, defaultPotState);
    String itemFacing = ((Enum<?>) call(be, "getDirection", new Class<?>[]{})).name().toLowerCase(Locale.ROOT);

    // Fake client Level for triggerEvent
    Class<?> levelClass = c("net.minecraft.world.level.Level");
    Object fakeLevel = blank(c("net.minecraft.client.multiplayer.ClientLevel"));
    Object levelData = blank(c("net.minecraft.client.multiplayer.ClientLevel$ClientLevelData"));
    f(c("net.minecraft.client.multiplayer.ClientLevel"), "clientLevelData").set(fakeLevel, levelData);
    f(levelClass, "isClientSide").setBoolean(fakeLevel, true);
    f(c("net.minecraft.world.level.block.entity.BlockEntity"), "level").set(be, fakeLevel);
    Method trig = m(potBeClass, "triggerEvent", int.class, int.class);
    List<Object> events = new ArrayList<>();
    for (int evId : new int[]{0, 1}) {
      for (int param = -1; param <= 6; param++) {
        f(potBeClass, "lastWobbleStyle").set(be, null);
        boolean accepted = (Boolean) trig.invoke(be, evId, param);
        Object last = f(potBeClass, "lastWobbleStyle").get(be);
        events.add(Map.of(
          "eventId", evId,
          "accepted", accepted,
          "style", last == null ? -1 : ((Enum<?>) last).ordinal()
        ));
      }
    }

    // 3. DecoratedPotRenderer wobble transforms via PoseStack + SubmitNodeCollector proxy
    Class<?> potRendererClass = c("net.minecraft.client.renderer.blockentity.DecoratedPotRenderer");
    Class<?> potStateClass = c("net.minecraft.client.renderer.blockentity.state.DecoratedPotRenderState");
    Class<?> collectorClass = c("net.minecraft.client.renderer.SubmitNodeCollector");
    Class<?> poseStackClass = c("com.mojang.blaze3d.vertex.PoseStack");
    Class<?> camClass = c("net.minecraft.client.renderer.state.CameraRenderState");
    Object dummyPotRenderer = blank(potRendererClass);
    // Stub MaterialSet so submit() -> submitModelPart receives exact transformed PoseStack
    Class<?> matSetClass = c("net.minecraft.client.resources.model.MaterialSet");
    Object dummyMatSet = Proxy.newProxyInstance(matSetClass.getClassLoader(), new Class<?>[]{matSetClass}, (p, mth, a) -> null);
    // MaterialMapper / Atlas Material? DecoratedPotRenderer.a(Material, Function) reads hpj.E (static), returns ijs
    f(potRendererClass, "materials").set(dummyPotRenderer, dummyMatSet);
    float[][] capturedMat = new float[1][16];
    Object captureCollector = Proxy.newProxyInstance(collectorClass.getClassLoader(), new Class<?>[]{collectorClass}, (p, mth, a) -> {
      if (a != null) {
        for (Object arg : a) {
          if (poseStackClass.isInstance(arg)) {
            Object last = call(arg, "last", new Class<?>[]{});
            Object matrix = call(last, "pose", new Class<?>[]{});
            matrix.getClass().getMethod("get", float[].class).invoke(matrix, (Object) capturedMat[0]);
            break;
          }
        }
      }
      return null;
    });

    // Use real PotRenderState fields: wobbleProgress (c), direction (e), wobbleStyle (b), decorations (d), lightCoords (i)
    Object camState = camClass.getConstructor().newInstance();
    Class<?> dirClass = c("net.minecraft.core.Direction");
    Class<?> potDecClass = c("net.minecraft.world.level.block.entity.PotDecorations");
    Object emptyDec = f(potDecClass, "EMPTY").get(null);
    Object[] wobbleVals = wobbleClass.getEnumConstants();
    Method submitPot = m(potRendererClass, "submit", potStateClass, poseStackClass, collectorClass, camClass);
    List<Object> frames = new ArrayList<>();
    for (int dOrd = 2; dOrd < 6; dOrd++) {
      Object dir = dirClass.getEnumConstants()[dOrd];
      String dName = ((Enum<?>) dir).name().toLowerCase(Locale.ROOT);
      for (int styleIdx : new int[]{-1, 0, 1}) {
        Object wobbleStyle = styleIdx < 0 ? null : wobbleVals[styleIdx];
        int dur = styleIdx < 0 ? 10 : f(wobbleClass, "duration").getInt(wobbleStyle);
        for (int elapsed : new int[]{0, 2, 4, 6, 8, 10}) {
          for (float partial : new float[]{0f, 0.5f}) {
            Object ps = poseStackClass.getConstructor().newInstance();
            Object pState = potStateClass.getConstructor().newInstance();
            f(potStateClass, "direction").set(pState, dir);
            f(potStateClass, "wobbleStyle").set(pState, wobbleStyle);
            f(potStateClass, "decorations").set(pState, emptyDec);
            float progress = wobbleStyle == null ? 0f : ((float) elapsed + partial) / (float) dur;
            f(potStateClass, "wobbleProgress").setFloat(pState, progress);
            Arrays.fill(capturedMat[0], 0f);
            submitPot.invoke(dummyPotRenderer, pState, ps, captureCollector, camState);
            List<Float> mat = new ArrayList<>(16);
            for (float v : capturedMat[0]) mat.add(v);
            Map<String, Object> row = new TreeMap<>();
            row.put("elapsed", elapsed);
            row.put("facing", dName);
            row.put("partial", partial);
            row.put("style", styleIdx);
            row.put("matrix", mat);
            frames.add(row);
          }
        }
      }
    }

    // 4. BrushableBlockRenderer.translations(Direction, int)
    Class<?> brushRendererClass = c("net.minecraft.client.renderer.blockentity.BrushableBlockRenderer");
    Object dummyBrushRenderer = blank(brushRendererClass);
    Method transMethod = m(brushRendererClass, "translations", dirClass, int.class);
    List<Object> translations = new ArrayList<>();
    for (int fIdx = 0; fIdx < 6; fIdx++) {
      Object dir = dirClass.getEnumConstants()[fIdx];
      for (int dusted = 0; dusted < 4; dusted++) {
        float[] vec = (float[]) transMethod.invoke(dummyBrushRenderer, dir, dusted);
        translations.add(Map.of("face", fIdx, "dusted", dusted, "translation", List.of(vec[0], vec[1], vec[2])));
      }
    }

    // 5. BrushItem.DustParticlesDelta.fromDirection(Vec3, Direction)
    Class<?> vec3Class = c("net.minecraft.world.phys.Vec3");
    Class<?> dustClass = c("net.minecraft.world.item.BrushItem$DustParticlesDelta");
    Method fromDir = m(dustClass, "fromDirection", vec3Class, dirClass);
    Constructor<?> vec3Ctor = vec3Class.getConstructor(double.class, double.class, double.class);
    List<Object> dust = new ArrayList<>();
    double[][] views = {{0, 0, 1}, {0.3, 0.2, -0.7}, {-0.6, 0.8, 0}};
    for (int fIdx = 0; fIdx < 6; fIdx++) {
      Object dir = dirClass.getEnumConstants()[fIdx];
      for (double[] view : views) {
        Object dp = fromDir.invoke(null, vec3Ctor.newInstance(view[0], view[1], view[2]), dir);
        dust.add(Map.of(
          "face", fIdx,
          "view", List.of(view[0], view[1], view[2]),
          "delta", List.of(
            ((Number) call(dp, "xd", new Class<?>[]{})).doubleValue(),
            ((Number) call(dp, "yd", new Class<?>[]{})).doubleValue(),
            ((Number) call(dp, "zd", new Class<?>[]{})).doubleValue()
          )
        ));
      }
    }

    // 6. Brush sounds from Blocks.SUSPICIOUS_SAND and SUSPICIOUS_GRAVEL
    Map<String, Object> brushSounds = new TreeMap<>();
    Class<?> blocksClass = c("net.minecraft.world.level.block.Blocks");
    Class<?> seClass = c("net.minecraft.sounds.SoundEvent");
    for (String pair[] : new String[][]{{"SUSPICIOUS_SAND", "suspicious_sand"}, {"SUSPICIOUS_GRAVEL", "suspicious_gravel"}}) {
      Object blk = f(blocksClass, pair[0]).get(null);
      Object bSound = call(blk, "getBrushSound", new Class<?>[]{});
      Object cSound = call(blk, "getBrushCompletedSound", new Class<?>[]{});
      brushSounds.put(pair[1], Map.of(
        "brush", call(bSound, "location", new Class<?>[]{}).toString(),
        "complete", call(cSound, "location", new Class<?>[]{}).toString()
      ));
    }

    // 7. Brush arm poses from HumanoidModel + ItemInHandRenderer brush first-person transforms
    Class<?> humanClass = c("net.minecraft.client.model.HumanoidModel");
    Class<?> humanStateClass = c("net.minecraft.client.renderer.entity.state.HumanoidRenderState");
    Class<?> mp = c("net.minecraft.client.model.geom.ModelPart");
    Class<?> cubeDefClass = c("net.minecraft.client.model.geom.builders.CubeDeformation");
    Object humanMesh = m(humanClass, "createMesh", cubeDefClass, float.class).invoke(null, f(cubeDefClass, "NONE").get(null), 0.0f);
    Object humanLayer = m(c("net.minecraft.client.model.geom.builders.LayerDefinition"), "create",
      c("net.minecraft.client.model.geom.builders.MeshDefinition"), int.class, int.class).invoke(null, humanMesh, 64, 64);
    Object humanRoot = m(c("net.minecraft.client.model.geom.builders.LayerDefinition"), "bakeRoot").invoke(humanLayer);
    Object humanModel = humanClass.getConstructor(mp).newInstance(humanRoot);
    Object rightArm = f(humanClass, "rightArm").get(humanModel);
    Object leftArm = f(humanClass, "leftArm").get(humanModel);
    Object brushPose = f(c("net.minecraft.client.model.HumanoidModel$ArmPose"), "BRUSH").get(null);
    Method poseRight = m(humanClass, "poseRightArm", humanStateClass);
    Method poseLeft = m(humanClass, "poseLeftArm", humanStateClass);
    List<Object> armPoses = new ArrayList<>();
    for (float init : new float[]{0f, 0.75f, -0.5f}) {
      for (boolean right : new boolean[]{true, false}) {
        Object st = humanStateClass.getConstructor().newInstance();
        f(humanStateClass, "rightArmPose").set(st, brushPose);
        f(humanStateClass, "leftArmPose").set(st, brushPose);
        Object arm = right ? rightArm : leftArm;
        f(mp, "xRot").setFloat(arm, init);
        f(mp, "yRot").setFloat(arm, 0.25f);
        if (right) poseRight.invoke(humanModel, st);
        else poseLeft.invoke(humanModel, st);
        armPoses.add(Map.of(
          "initial", init,
          "right", right,
          "rx", f(mp, "xRot").getFloat(arm),
          "ry", f(mp, "yRot").getFloat(arm)
        ));
      }
    }

    Class<?> iihrClass = c("net.minecraft.client.renderer.ItemInHandRenderer");
    Class<?> armClass = c("net.minecraft.world.entity.HumanoidArm");
    Class<?> playerClass = c("net.minecraft.world.entity.player.Player");
    Object dummyRenderer = blank(iihrClass);
    Method armTrans = m(iihrClass, "applyItemArmTransform", poseStackClass, armClass, float.class);
    Method brushTrans = m(iihrClass, "applyBrushTransform", poseStackClass, float.class, armClass, playerClass);
    Object fakePlayer = blank(c("net.minecraft.client.player.LocalPlayer"));
    Field remField = f(c("net.minecraft.world.entity.LivingEntity"), "useItemRemaining");
    Object rightArmEnum = armClass.getEnumConstants()[1];
    Object leftArmEnum = armClass.getEnumConstants()[0];
    List<Object> brushFrames = new ArrayList<>();
    for (int side : new int[]{-1, 1}) {
      for (int ticks : new int[]{0, 3, 5, 8}) {
        for (float partial : new float[]{0f, 0.5f}) {
          for (float equip : new float[]{0f, 0.4f}) {
            Object ps = poseStackClass.getConstructor().newInstance();
            remField.setInt(fakePlayer, 200 - ticks);
            Object hArm = side < 0 ? leftArmEnum : rightArmEnum;
            armTrans.invoke(dummyRenderer, ps, hArm, equip);
            brushTrans.invoke(dummyRenderer, ps, partial, hArm, fakePlayer);
            Object last = call(ps, "last", new Class<?>[]{});
            Object matrix = call(last, "pose", new Class<?>[]{});
            float[] rawMat = new float[16];
            matrix.getClass().getMethod("get", float[].class).invoke(matrix, (Object) rawMat);
            List<Float> mat = new ArrayList<>(16);
            for (float v : rawMat) mat.add(v);
            brushFrames.add(Map.of("side", side, "ticks", ticks, "partial", partial, "equip", equip, "matrix", mat));
          }
        }
      }
    }

    Map<String, Object> out = new TreeMap<>();
    out.put("patterns", patterns);
    out.put("durations", durations);
    out.put("itemFacing", itemFacing);
    out.put("events", events);
    out.put("frames", frames);
    out.put("translations", translations);
    out.put("dust", dust);
    out.put("brushSounds", brushSounds);
    out.put("armPoses", armPoses);
    out.put("brushFrames", brushFrames);
    Files.writeString(Path.of(args[0]), new Gson().toJson(out));
  }
}
