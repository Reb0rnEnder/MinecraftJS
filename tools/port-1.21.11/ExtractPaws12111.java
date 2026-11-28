import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;
import com.google.gson.*;

// Native 1.21.11 Wolf + Armadillo oracle: synched data IDs, state timings, Crackiness, dyes, poses, tails, variants.
public class ExtractPaws12111 extends ExtractCreative12111 {
  static Object call(Object o, String name, Class<?>[] types, Object... args) throws Exception {
    return m(o.getClass(), name, types).invoke(o, args);
  }
  static Object blank(Class<?> cls) throws Exception {
    Field f = sun.misc.Unsafe.class.getDeclaredField("theUnsafe");
    f.setAccessible(true);
    return ((sun.misc.Unsafe) f.get(null)).allocateInstance(cls);
  }

  static Map<String, Integer> accessors(Class<?> type) throws Exception {
    Map<String, Integer> out = new TreeMap<>();
    Class<?> acc = c("net.minecraft.network.syncher.EntityDataAccessor");
    Method idM = m(acc, "id");
    for (Class<?> k = type; k != null; k = k.getSuperclass()) {
      for (var entry : fieldNames.getOrDefault(original(k), Map.of()).entrySet()) {
        Field field = k.getDeclaredField(entry.getValue());
        if (Modifier.isStatic(field.getModifiers()) && field.getType() == acc) {
          field.setAccessible(true);
          out.put(entry.getKey(), ((Number) idM.invoke(field.get(null))).intValue());
        }
      }
    }
    return out;
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

  public static void main(String[] args) throws Exception {
    loadMappings(Path.of(args[1]));
    m(c("net.minecraft.SharedConstants"), "tryDetectVersion").invoke(null);
    m(c("net.minecraft.server.Bootstrap"), "bootStrap").invoke(null);

    Class<?> mp = c("net.minecraft.client.model.geom.ModelPart");
    Class<?> armadilloClass = c("net.minecraft.world.entity.animal.armadillo.Armadillo");
    Class<?> wolfClass = c("net.minecraft.world.entity.animal.wolf.Wolf");
    Class<?> armModelClass = c("net.minecraft.client.model.animal.armadillo.ArmadilloModel");
    Class<?> wolfModelClass = c("net.minecraft.client.model.animal.wolf.WolfModel");

    // 1. Metadata accessor IDs
    Map<String, Object> metadata = Map.of(
      "armadillo", accessors(armadilloClass),
      "wolf", accessors(wolfClass)
    );

    // 2. EntityDimensions & Baby transform parameters
    Object armType = f(c("net.minecraft.world.entity.EntityType"), "ARMADILLO").get(null);
    Object dims = call(armType, "getDimensions", new Class<?>[]{});
    Class<?> edClass = c("net.minecraft.world.entity.EntityDimensions");
    float babyScale = f(armadilloClass, "BABY_SCALE").getFloat(null);
    Object babyDims = m(edClass, "scale", float.class).invoke(dims, babyScale);
    Map<String, Object> armadilloDimensions = Map.of(
      "adult", List.of(f(edClass, "width").getFloat(dims), f(edClass, "height").getFloat(dims), f(edClass, "eyeHeight").getFloat(dims)),
      "baby", List.of(f(edClass, "width").getFloat(babyDims), f(edClass, "height").getFloat(babyDims), f(edClass, "eyeHeight").getFloat(babyDims))
    );

    Class<?> ldClass = c("net.minecraft.client.model.geom.builders.LayerDefinition");
    Class<?> mtClass = c("net.minecraft.client.model.geom.builders.MeshTransformer");
    Method applyMT = m(ldClass, "apply", mtClass);
    Method bakeRoot = m(ldClass, "bakeRoot");

    Object armLayer = m(armModelClass, "createBodyLayer").invoke(null);
    Object armBabyRoot = bakeRoot.invoke(applyMT.invoke(armLayer, f(armModelClass, "BABY_TRANSFORMER").get(null)));
    Object armBabyBody = call(armBabyRoot, "getChild", new Class<?>[]{String.class}, "body");
    Map<String, Object> armadilloAgeable = Map.of(
      "scale", babyScale,
      "translateY", 24.016f * (1.0f - babyScale),
      "bodyY", f(mp, "y").getFloat(armBabyBody)
    );

    Object wolfBabyXf = f(wolfModelClass, "BABY_TRANSFORMER").get(null);
    Class<?> bmtClass = c("net.minecraft.client.model.BabyModelTransform");
    Map<String, Object> wolfAgeable = new TreeMap<>();
    wolfAgeable.put("scaleHead", f(bmtClass, "scaleHead").getBoolean(wolfBabyXf));
    wolfAgeable.put("babyYHeadOffset", f(bmtClass, "babyYHeadOffset").getFloat(wolfBabyXf));
    wolfAgeable.put("babyZHeadOffset", f(bmtClass, "babyZHeadOffset").getFloat(wolfBabyXf));
    wolfAgeable.put("babyHeadScale", f(bmtClass, "babyHeadScale").getFloat(wolfBabyXf));
    wolfAgeable.put("babyBodyScale", f(bmtClass, "babyBodyScale").getFloat(wolfBabyXf));
    wolfAgeable.put("bodyYOffset", f(bmtClass, "bodyYOffset").getFloat(wolfBabyXf));

    // 3. Crackiness.WOLF_ARMOR + cracks
    Class<?> crackClass = c("net.minecraft.world.entity.Crackiness");
    Object wolfArmorCrack = f(crackClass, "WOLF_ARMOR").get(null);
    Map<String, Object> crackThresholds = new TreeMap<>();
    crackThresholds.put("fractionLow", f(crackClass, "fractionLow").getFloat(wolfArmorCrack));
    crackThresholds.put("fractionMedium", f(crackClass, "fractionMedium").getFloat(wolfArmorCrack));
    crackThresholds.put("fractionHigh", f(crackClass, "fractionHigh").getFloat(wolfArmorCrack));
    Object wolfArmorItem = f(c("net.minecraft.world.item.Items"), "WOLF_ARMOR").get(null);
    Object wolfArmorStack = call(wolfArmorItem, "getDefaultInstance", new Class<?>[]{});
    int maxDamage = ((Number) call(wolfArmorStack, "getMaxDamage", new Class<?>[]{})).intValue();
    Method byDamage = m(crackClass, "byDamage", int.class, int.class);
    List<Object> cracks = new ArrayList<>();
    for (int d = 0; d <= maxDamage; d++) {
      cracks.add(Map.of(
        "damage", d,
        "maxDamage", maxDamage,
        "level", ((Enum<?>) byDamage.invoke(wolfArmorCrack, d, maxDamage)).name()
      ));
    }

    // 4. Dyes (0..15 normalized RGB)
    Class<?> dyeClass = c("net.minecraft.world.item.DyeColor");
    List<Object> dyes = new ArrayList<>();
    for (Object dye : dyeClass.getEnumConstants()) {
      int rgb = ((Number) call(dye, "getTextureDiffuseColor", new Class<?>[]{})).intValue();
      dyes.add(List.of(((rgb >> 16) & 255) / 255.0f, ((rgb >> 8) & 255) / 255.0f, (rgb & 255) / 255.0f));
    }

    // 5. ArmadilloState timings
    Class<?> stateEnum = c("net.minecraft.world.entity.animal.armadillo.Armadillo$ArmadilloState");
    Method hiddenAt = m(stateEnum, "shouldHideInShell", long.class);
    List<Object> states = new ArrayList<>();
    for (Object st : stateEnum.getEnumConstants()) {
      List<Boolean> hidden = new ArrayList<>();
      for (long t = 0; t < 36; t++) hidden.add((Boolean) hiddenAt.invoke(st, t));
      states.add(Map.of(
        "id", f(stateEnum, "id").getInt(st),
        "name", ((Enum<?>) st).name().toLowerCase(Locale.ROOT),
        "duration", f(stateEnum, "animationDuration").getInt(st),
        "hidden", hidden
      ));
    }

    // 6. WolfVariant registry textures (wild, tame, angry)
    Object lookup = m(c("net.minecraft.data.registries.VanillaRegistries"), "createLookup").invoke(null);
    Object wvKey = f(c("net.minecraft.core.registries.Registries"), "WOLF_VARIANT").get(null);
    Object wvLookup = m(c("net.minecraft.core.HolderLookup$Provider"), "lookupOrThrow", c("net.minecraft.resources.ResourceKey")).invoke(lookup, wvKey);
    Method holderKey = m(c("net.minecraft.core.Holder$Reference"), "key");
    Method rkId = m(c("net.minecraft.resources.ResourceKey"), "identifier");
    Method holderVal = m(c("net.minecraft.core.Holder"), "value");
    List<?> wvList = ((java.util.stream.Stream<?>) m(c("net.minecraft.core.HolderLookup"), "listElements").invoke(wvLookup)).toList();
    List<Object> variants = new ArrayList<>();
    for (Object h : wvList) {
      String key = rkId.invoke(holderKey.invoke(h)).toString();
      Object wv = holderVal.invoke(h);
      Object info = call(wv, "assetInfo", new Class<?>[]{});
      for (String mode : List.of("wild", "tame", "angry")) {
        Object resTex = call(info, mode, new Class<?>[]{});
        String tex = call(resTex, "texturePath", new Class<?>[]{}).toString();
        variants.add(Map.of("key", key, "tame", "tame".equals(mode), "angry", "angry".equals(mode), "texture", tex));
      }
    }

    // 7. Wolf tail angles using real Wolf.getTailAngle() via SynchedEntityData + AttributeMap
    Class<?> entityClass = c("net.minecraft.world.entity.Entity");
    Class<?> livingClass = c("net.minecraft.world.entity.LivingEntity");
    Class<?> tamableClass = c("net.minecraft.world.entity.TamableAnimal");
    Class<?> sdClass = c("net.minecraft.network.syncher.SynchedEntityData");
    Class<?> diClass = c("net.minecraft.network.syncher.SynchedEntityData$DataItem");
    Class<?> levelClass = c("net.minecraft.world.level.Level");
    Class<?> attrMapClass = c("net.minecraft.world.entity.ai.attributes.AttributeMap");
    Class<?> attrSuppClass = c("net.minecraft.world.entity.ai.attributes.AttributeSupplier");
    Object fakeLevel = blank(c("net.minecraft.client.multiplayer.ClientLevel"));
    Object levelData = blank(c("net.minecraft.client.multiplayer.ClientLevel$ClientLevelData"));
    f(c("net.minecraft.client.multiplayer.ClientLevel"), "clientLevelData").set(fakeLevel, levelData);
    f(levelClass, "isClientSide").setBoolean(fakeLevel, true);

    Object wolfAttrSupp = m(c("net.minecraft.world.entity.ai.attributes.DefaultAttributes"), "getSupplier", c("net.minecraft.world.entity.EntityType"))
      .invoke(null, f(c("net.minecraft.world.entity.EntityType"), "WOLF").get(null));
    Object accFlags = f(tamableClass, "DATA_FLAGS_ID").get(null);
    Object accAngerEnd = f(wolfClass, "DATA_ANGER_END_TIME").get(null);
    Object accHealth = f(livingClass, "DATA_HEALTH_ID").get(null);
    Method accId = m(c("net.minecraft.network.syncher.EntityDataAccessor"), "id");
    int maxAcc = Math.max(Math.max(((Number) accId.invoke(accFlags)).intValue(), ((Number) accId.invoke(accAngerEnd)).intValue()), ((Number) accId.invoke(accHealth)).intValue());

    Object wolfObj = blank(wolfClass);
    f(entityClass, "level").set(wolfObj, fakeLevel);
    Constructor<?> diCtor = diClass.getDeclaredConstructor(c("net.minecraft.network.syncher.EntityDataAccessor"), Object.class);
    diCtor.setAccessible(true);
    Object[] items = (Object[]) Array.newInstance(diClass, maxAcc + 1);
    items[((Number) accId.invoke(accFlags)).intValue()] = diCtor.newInstance(accFlags, (byte) 0);
    items[((Number) accId.invoke(accAngerEnd)).intValue()] = diCtor.newInstance(accAngerEnd, -1L);
    items[((Number) accId.invoke(accHealth)).intValue()] = diCtor.newInstance(accHealth, 8.0f);
    Constructor<?> sdCtor = sdClass.getDeclaredConstructor(c("net.minecraft.network.syncher.SyncedDataHolder"), items.getClass());
    sdCtor.setAccessible(true);
    Object sd = sdCtor.newInstance(wolfObj, items);
    f(entityClass, "entityData").set(wolfObj, sd);
    Object attrMap = attrMapClass.getConstructor(attrSuppClass).newInstance(wolfAttrSupp);
    f(livingClass, "attributes").set(wolfObj, attrMap);

    Object maxHealthAttr = f(c("net.minecraft.world.entity.ai.attributes.Attributes"), "MAX_HEALTH").get(null);
    Method getAttr = m(livingClass, "getAttribute", c("net.minecraft.core.Holder"));
    Method setBaseVal = m(c("net.minecraft.world.entity.ai.attributes.AttributeInstance"), "setBaseValue", double.class);
    Method sdSet = m(sdClass, "set", c("net.minecraft.network.syncher.EntityDataAccessor"), Object.class);
    Method getTailAngle = m(wolfClass, "getTailAngle");

    List<Object> tails = new ArrayList<>();
    for (boolean angry : new boolean[]{false, true}) {
      for (boolean tamed : new boolean[]{false, true}) {
        double maxH = tamed ? 40.0 : 8.0;
        for (float hp : new float[]{0f, 4f, 8f, 20f, 40f}) {
          sdSet.invoke(sd, accAngerEnd, angry ? 100L : -1L);
          sdSet.invoke(sd, accFlags, (byte) (tamed ? 4 : 0));
          setBaseVal.invoke(getAttr.invoke(wolfObj, maxHealthAttr), maxH);
          sdSet.invoke(sd, accHealth, hp);
          tails.add(Map.of(
            "angry", angry,
            "tamed", tamed,
            "maxHealth", maxH,
            "health", hp,
            "angle", getTailAngle.invoke(wolfObj)
          ));
        }
      }
    }

    // 8. ArmadilloModel poses (36 cases across 4 states)
    Class<?> armStateClass = c("net.minecraft.client.renderer.entity.state.ArmadilloRenderState");
    Class<?> entityStateClass = c("net.minecraft.client.renderer.entity.state.EntityRenderState");
    Class<?> livingStateClass = c("net.minecraft.client.renderer.entity.state.LivingEntityRenderState");
    Class<?> animStateClass = c("net.minecraft.world.entity.AnimationState");
    Constructor<?> armCtor = armModelClass.getConstructor(mp);
    Method armSetup = m(armModelClass, "setupAnim", armStateClass);
    Method animStart = m(animStateClass, "start", int.class);
    Method animFastForward = m(animStateClass, "fastForward", int.class, float.class);
    Method animStop = m(animStateClass, "stop");
    List<Object> armadilloPoses = new ArrayList<>();
    float[] ages = {0.5f, 4.25f, 11.75f};
    for (int st = 0; st < 4; st++) {
      for (int i = 0; i < 3; i++) {
        for (float pitch : new float[]{-50f, 0f, 45f}) {
          float age = ages[i], ls = i == 0 ? 1.25f : (i == 1 ? 3.5f : 0f), lsa = i == 2 ? 0f : 0.7f, yaw = i == 0 ? 45f : (i == 1 ? -40f : 0f);
          int ticks = 0;
          Object root = bakeRoot.invoke(armLayer);
          Object model = armCtor.newInstance(root);
          Object rs = armStateClass.getConstructor().newInstance();
          f(armStateClass, "isHidingInShell").setBoolean(rs, st >= 2);
          f(entityStateClass, "ageInTicks").setFloat(rs, age);
          f(livingStateClass, "walkAnimationPos").setFloat(rs, ls);
          f(livingStateClass, "walkAnimationSpeed").setFloat(rs, lsa);
          f(livingStateClass, "xRot").setFloat(rs, pitch);
          f(livingStateClass, "yRot").setFloat(rs, yaw);
          Object rollUp = f(armStateClass, "rollUpAnimationState").get(rs);
          Object peek = f(armStateClass, "peekAnimationState").get(rs);
          Object rollOut = f(armStateClass, "rollOutAnimationState").get(rs);
          animStop.invoke(rollUp); animStop.invoke(peek); animStop.invoke(rollOut);
          if (st == 1) animStart.invoke(rollUp, ticks);
          else if (st == 2) { animStart.invoke(peek, ticks); animFastForward.invoke(peek, 50, 1.0f); }
          else if (st == 3) animStart.invoke(rollOut, ticks);
          armSetup.invoke(model, rs);
          Map<String, Object> parts = new TreeMap<>();
          dumpParts(root, "$root", parts, mp);
          Map<String, Object> row = new TreeMap<>();
          row.put("state", st); row.put("ticks", ticks); row.put("age", age);
          row.put("ls", ls); row.put("lsa", lsa); row.put("pitch", pitch); row.put("yaw", yaw);
          row.put("parts", parts);
          armadilloPoses.add(row);
        }
      }
    }

    // 9. WolfModel poses
    Class<?> wolfStateClass = c("net.minecraft.client.renderer.entity.state.WolfRenderState");
    Class<?> cdClass = c("net.minecraft.client.model.geom.builders.CubeDeformation");
    Object wolfMesh = m(wolfModelClass, "createMeshDefinition", cdClass).invoke(null, f(cdClass, "NONE").get(null));
    Object wolfLayer = m(ldClass, "create", c("net.minecraft.client.model.geom.builders.MeshDefinition"), int.class, int.class).invoke(null, wolfMesh, 64, 32);
    Constructor<?> wolfCtor = wolfModelClass.getConstructor(mp);
    Method wolfSetup = m(wolfModelClass, "setupAnim", wolfStateClass);
    List<Object> wolfPoses = new ArrayList<>();
    for (boolean angry : new boolean[]{false, true}) {
      for (boolean sitting : new boolean[]{false, true}) {
        for (float ls : new float[]{0f, 1.5f}) {
          for (float pitch : new float[]{-13f, 22f}) {
            float lsa = 0.7f, yaw = 27f, tail = 1.4765486f;
            Object root = bakeRoot.invoke(wolfLayer);
            Object model = wolfCtor.newInstance(root);
            Object rs = wolfStateClass.getConstructor().newInstance();
            f(wolfStateClass, "isAngry").setBoolean(rs, angry);
            f(wolfStateClass, "isSitting").setBoolean(rs, sitting);
            f(wolfStateClass, "tailAngle").setFloat(rs, tail);
            f(livingStateClass, "walkAnimationPos").setFloat(rs, ls);
            f(livingStateClass, "walkAnimationSpeed").setFloat(rs, lsa);
            f(livingStateClass, "xRot").setFloat(rs, pitch);
            f(livingStateClass, "yRot").setFloat(rs, yaw);
            f(livingStateClass, "ageScale").setFloat(rs, 1.0f);
            wolfSetup.invoke(model, rs);
            Map<String, Object> parts = new TreeMap<>();
            dumpParts(root, "$root", parts, mp);
            Map<String, Object> row = new TreeMap<>();
            row.put("angry", angry); row.put("sitting", sitting); row.put("ls", ls); row.put("lsa", lsa);
            row.put("pitch", pitch); row.put("yaw", yaw); row.put("tail", tail); row.put("layer", "minecraft:wolf#main");
            row.put("parts", parts);
            wolfPoses.add(row);
          }
        }
      }
    }

    Map<String, Object> out = new TreeMap<>();
    out.put("metadata", metadata);
    out.put("armadilloDimensions", armadilloDimensions);
    out.put("armadilloAgeable", armadilloAgeable);
    out.put("wolfAgeable", wolfAgeable);
    out.put("crackThresholds", crackThresholds);
    out.put("cracks", cracks);
    out.put("dyes", dyes);
    out.put("states", states);
    out.put("variants", variants);
    out.put("tails", tails);
    out.put("armadilloPoses", armadilloPoses);
    out.put("wolfPoses", wolfPoses);
    Files.writeString(Path.of(args[0]), new Gson().toJson(out));
  }
}
