import com.google.gson.*;
import com.mojang.serialization.*;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.lang.reflect.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.function.BiConsumer;

// Exact native 1.21.11 item UX metadata & sample tooltip/color/wire oracle.
public class ExtractItemUx12111 extends ExtractCreative12111 {
  static Object call(Object o, String name, Class<?>[] types, Object... args) throws Exception {
    return m(o.getClass(), name, types).invoke(o, args);
  }
  static Object blank(Class<?> cls) throws Exception {
    Field f = sun.misc.Unsafe.class.getDeclaredField("theUnsafe");
    f.setAccessible(true);
    return ((sun.misc.Unsafe) f.get(null)).allocateInstance(cls);
  }

  public static Object tooltipLookup(Object provider) throws Exception {
    // Delegate lookup and attach enchantment tooltip_order tag
    return taggedLookup(provider, orderPathRef);
  }
  static Path orderPathRef;

  static int[] extractItemColors(Object stack, String itemId, @SuppressWarnings("rawtypes") Codec tintCodec, Method calcTint) throws Exception {
    String shortName = itemId.replace("minecraft:", "");
    String path = "assets/minecraft/items/" + shortName + ".json";
    List<Integer> colors = new ArrayList<>();
    try (InputStream in = ExtractItemUx12111.class.getClassLoader().getResourceAsStream(path)) {
      if (in != null) {
        JsonObject root = JsonParser.parseReader(new InputStreamReader(in, StandardCharsets.UTF_8)).getAsJsonObject();
        collectTints(root, stack, tintCodec, calcTint, colors);
      }
    }
    while (colors.size() < 2) colors.add(0xFFFFFF);
    return new int[]{colors.get(0) & 0xFFFFFF, colors.get(1) & 0xFFFFFF};
  }

  static void collectTints(JsonElement node, Object stack, @SuppressWarnings("rawtypes") Codec tintCodec, Method calcTint, List<Integer> out) throws Exception {
    if (node == null || !out.isEmpty()) return;
    if (node.isJsonObject()) {
      JsonObject obj = node.getAsJsonObject();
      if (obj.has("tints") && obj.get("tints").isJsonArray()) {
        for (JsonElement tEl : obj.getAsJsonArray("tints")) {
          var res = tintCodec.parse(JsonOps.INSTANCE, tEl);
          if (res.isSuccess()) {
            int argb = ((Number) calcTint.invoke(res.getOrThrow(), stack, null, null)).intValue();
            out.add(argb & 0xFFFFFF);
          } else {
            out.add(0xFFFFFF);
          }
        }
        return;
      }
      if (obj.has("model")) collectTints(obj.get("model"), stack, tintCodec, calcTint, out);
      if (obj.has("fallback")) collectTints(obj.get("fallback"), stack, tintCodec, calcTint, out);
      if (obj.has("on_false")) collectTints(obj.get("on_false"), stack, tintCodec, calcTint, out);
    }
  }

  public static void main(String[] args) throws Exception {
    loadMappings(Path.of(args[1]));
    m(c("net.minecraft.SharedConstants"), "tryDetectVersion").invoke(null);
    m(c("net.minecraft.server.Bootstrap"), "bootStrap").invoke(null);
    m(c("net.minecraft.client.color.item.ItemTintSources"), "bootstrap").invoke(null);

    orderPathRef = Path.of(args[2]);
    JsonObject orders = JsonParser.parseString(Files.readString(orderPathRef)).getAsJsonObject();

    Object rawLookup = m(c("net.minecraft.data.registries.VanillaRegistries"), "createLookup").invoke(null);
    Object lookup = taggedLookup(rawLookup, orderPathRef);
    stackRegistries = registryAccess(lookup, orderPathRef);
    itemStackStreamCodec = f(c("net.minecraft.world.item.ItemStack"), "STREAM_CODEC").get(null);
    registryBufConstructor = c("net.minecraft.network.RegistryFriendlyByteBuf")
      .getConstructor(io.netty.buffer.ByteBuf.class, c("net.minecraft.core.RegistryAccess"));
    streamEncode = m(c("net.minecraft.network.codec.StreamEncoder"), "encode", Object.class, Object.class);

    Class<?> regClass = c("net.minecraft.core.Registry");
    Method regGetKey = m(regClass, "getKey", Object.class);
    Method regGetId = m(regClass, "getId", Object.class);
    Object itemReg = f(c("net.minecraft.core.registries.BuiltInRegistries"), "ITEM").get(null);
    Object effReg = f(c("net.minecraft.core.registries.BuiltInRegistries"), "MOB_EFFECT").get(null);
    Object potReg = f(c("net.minecraft.core.registries.BuiltInRegistries"), "POTION").get(null);
    Object attrReg = f(c("net.minecraft.core.registries.BuiltInRegistries"), "ATTRIBUTE").get(null);

    // 1. Registries (matching server sync / KNOWN_PACK order where dynamic)
    Map<String, Map<String, String>> registries = new TreeMap<>();
    for (String rKey : List.of("attribute", "enchantment", "instrument", "mob_effect", "potion")) {
      Map<String, String> rm = new TreeMap<>();
      if (orders.has("minecraft:" + rKey)) {
        JsonArray arr = orders.getAsJsonArray("minecraft:" + rKey);
        for (int i = 0; i < arr.size(); i++) rm.put(String.valueOf(i), arr.get(i).getAsString());
      } else {
        Object reg = "attribute".equals(rKey) ? attrReg : ("mob_effect".equals(rKey) ? effReg : potReg);
        for (Object obj : (Iterable<?>) reg) {
          int numId = ((Number) regGetId.invoke(reg, obj)).intValue();
          rm.put(String.valueOf(numId), regGetKey.invoke(reg, obj).toString());
        }
      }
      registries.put(rKey, rm);
    }

    // 2. Effects
    Class<?> mobEffectClass = c("net.minecraft.world.effect.MobEffect");
    Class<?> harmfulEnum = c("net.minecraft.world.effect.MobEffectCategory");
    Object harmful = f(harmfulEnum, "HARMFUL").get(null);
    Method createMods = m(mobEffectClass, "createModifiers", int.class, BiConsumer.class);
    Method modAmount = m(c("net.minecraft.world.entity.ai.attributes.AttributeModifier"), "amount");
    Method modOp = m(c("net.minecraft.world.entity.ai.attributes.AttributeModifier"), "operation");
    Map<String, Object> effects = new TreeMap<>();
    for (Object eff : (Iterable<?>) effReg) {
      int id = ((Number) regGetId.invoke(effReg, eff)).intValue();
      String key = regGetKey.invoke(effReg, eff).toString();
      Object cat = call(eff, "getCategory", new Class<?>[]{});
      boolean bad = cat == harmful;
      boolean beneficial = (Boolean) call(eff, "isBeneficial", new Class<?>[]{});
      int blendTicks = ((Number) call(eff, "getBlendInDurationTicks", new Class<?>[]{})).intValue();
      int color = ((Number) call(eff, "getColor", new Class<?>[]{})).intValue();
      List<Object> mods = new ArrayList<>();
      createMods.invoke(eff, 0, (BiConsumer<Object, Object>) (attrHolder, attrMod) -> {
        try {
          Object attrVal = call(attrHolder, "value", new Class<?>[]{});
          String aKey = regGetKey.invoke(attrReg, attrVal).toString();
          double amt = ((Number) modAmount.invoke(attrMod)).doubleValue();
          int op = ((Enum<?>) modOp.invoke(attrMod)).ordinal();
          mods.add(List.of(aKey, amt, op));
        } catch (Exception ex) { throw new RuntimeException(ex); }
      });
      effects.put(String.valueOf(id), Map.of(
        "bad", bad, "beneficial", beneficial, "blendTicks", blendTicks, "color", color, "key", key, "modifiers", mods
      ));
    }

    // 3. Potions
    Class<?> meiClass = c("net.minecraft.world.effect.MobEffectInstance");
    Method getPotEffs = m(c("net.minecraft.world.item.alchemy.Potion"), "getEffects");
    Method getPotName = m(c("net.minecraft.world.item.alchemy.Potion"), "name");
    Map<String, Object> potions = new TreeMap<>();
    for (Object pot : (Iterable<?>) potReg) {
      int id = ((Number) regGetId.invoke(potReg, pot)).intValue();
      String key = regGetKey.invoke(potReg, pot).toString();
      List<Object> effList = new ArrayList<>();
      for (Object mei : (List<?>) getPotEffs.invoke(pot)) {
        Object effHolder = call(mei, "getEffect", new Class<?>[]{});
        Object effVal = call(effHolder, "value", new Class<?>[]{});
        int effId = ((Number) regGetId.invoke(effReg, effVal)).intValue();
        effList.add(Map.of(
          "id", effId,
          "duration", call(mei, "getDuration", new Class<?>[]{}),
          "amplifier", call(mei, "getAmplifier", new Class<?>[]{}),
          "ambient", call(mei, "isAmbient", new Class<?>[]{}),
          "particles", call(mei, "isVisible", new Class<?>[]{}),
          "icon", call(mei, "showIcon", new Class<?>[]{})
        ));
      }
      potions.put(String.valueOf(id), Map.of("key", key, "name", getPotName.invoke(pot), "effects", effList));
    }

    // 4. Instruments (from registry in sync order)
    Object instKey = f(c("net.minecraft.core.registries.Registries"), "INSTRUMENT").get(null);
    Object instLookup = m(c("net.minecraft.core.HolderLookup$Provider"), "lookupOrThrow", c("net.minecraft.resources.ResourceKey")).invoke(lookup, instKey);
    Class<?> rkClass = c("net.minecraft.resources.ResourceKey");
    Method createRk = m(rkClass, "create", rkClass, c("net.minecraft.resources.Identifier"));
    Method getOrThrow = m(c("net.minecraft.core.HolderGetter"), "getOrThrow", rkClass);
    Map<String, Object> instruments = new TreeMap<>();
    for (var entry : registries.get("instrument").entrySet()) {
      Object rk = createRk.invoke(null, instKey, id(entry.getValue()));
      Object inst = call(getOrThrow.invoke(instLookup, rk), "value", new Class<?>[]{});
      instruments.put(entry.getKey(), Map.of(
        "key", entry.getValue(),
        "duration", ((Number) call(inst, "useDuration", new Class<?>[]{})).floatValue(),
        "range", ((Number) call(inst, "range", new Class<?>[]{})).floatValue()
      ));
    }

    // 5. Enchantment tooltip order + bindTags on Holders so HolderSet.contains & CURSE work accurately
    Object enchKey = f(c("net.minecraft.core.registries.Registries"), "ENCHANTMENT").get(null);
    Object enchLookup = m(c("net.minecraft.core.HolderLookup$Provider"), "lookupOrThrow", rkClass).invoke(lookup, enchKey);
    Object orderTagKey = f(c("net.minecraft.tags.EnchantmentTags"), "TOOLTIP_ORDER").get(null);
    Object curseTagKey = f(c("net.minecraft.tags.EnchantmentTags"), "CURSE").get(null);
    Optional<?> orderSetOpt = (Optional<?>) call(enchLookup, "get", new Class<?>[]{c("net.minecraft.tags.TagKey")}, orderTagKey);
    Set<String> curseKeys = new HashSet<>();
    try (InputStream cin = ExtractItemUx12111.class.getClassLoader().getResourceAsStream("data/minecraft/tags/enchantment/curse.json")) {
      if (cin != null) {
        for (JsonElement e : JsonParser.parseReader(new InputStreamReader(cin, StandardCharsets.UTF_8)).getAsJsonObject().getAsJsonArray("values")) {
          curseKeys.add(e.getAsString());
        }
      }
    }
    Method bindEnchTags = m(c("net.minecraft.core.Holder$Reference"), "bindTags", Collection.class);
    Map<Object, List<Object>> enchHolderTags = new IdentityHashMap<>();
    Map<String, Integer> enchKeyToId = new HashMap<>();
    for (var e : registries.get("enchantment").entrySet()) enchKeyToId.put(e.getValue(), Integer.parseInt(e.getKey()));
    List<Integer> enchantmentOrder = new ArrayList<>();
    Method holderKey = m(c("net.minecraft.core.Holder"), "unwrapKey");
    Method rkId = m(rkClass, "identifier");
    for (Object h : (Iterable<?>) orderSetOpt.orElseThrow()) {
      String k = rkId.invoke(((Optional<?>) holderKey.invoke(h)).orElseThrow()).toString();
      enchHolderTags.computeIfAbsent(h, ignored -> new ArrayList<>()).add(orderTagKey);
      if (curseKeys.contains(k)) enchHolderTags.get(h).add(curseTagKey);
      Integer numId = enchKeyToId.get(k);
      if (numId != null) enchantmentOrder.add(numId);
    }
    for (String ck : curseKeys) {
      Object rk = createRk.invoke(null, enchKey, id(ck));
      Object h = getOrThrow.invoke(enchLookup, rk);
      List<Object> list = enchHolderTags.computeIfAbsent(h, ignored -> new ArrayList<>());
      if (!list.contains(curseTagKey)) list.add(curseTagKey);
    }
    for (var entry : enchHolderTags.entrySet()) {
      bindEnchTags.invoke(entry.getKey(), entry.getValue());
    }

    // 6. Firework colors
    Map<String, String> fireworkColors = new TreeMap<>();
    Class<?> dyeClass = c("net.minecraft.world.item.DyeColor");
    for (Object d : dyeClass.getEnumConstants()) {
      int fc = ((Number) call(d, "getFireworkColor", new Class<?>[]{})).intValue();
      fireworkColors.put(String.valueOf(fc), call(d, "getName", new Class<?>[]{}).toString());
    }

    // 7. Items default UX
    Object attrComp = f(c("net.minecraft.core.component.DataComponents"), "ATTRIBUTE_MODIFIERS").get(null);
    Object emptyAttrMod = f(c("net.minecraft.world.item.component.ItemAttributeModifiers"), "EMPTY").get(null);
    Object fakeLevel = blank(c("net.minecraft.client.multiplayer.ClientLevel"));
    f(c("net.minecraft.world.level.Level"), "isClientSide").setBoolean(fakeLevel, true);
    f(c("net.minecraft.world.level.Level"), "registryAccess").set(fakeLevel, stackRegistries);
    Object fakeLiving = blank(c("net.minecraft.client.player.LocalPlayer"));
    f(c("net.minecraft.world.entity.Entity"), "level").set(fakeLiving, fakeLevel);
    Class<?> itemStackClass = c("net.minecraft.world.item.ItemStack");
    Method getDefault = m(c("net.minecraft.world.item.Item"), "getDefaultInstance");
    Method getUseAnim = m(itemStackClass, "getUseAnimation");
    Method getUseDur = m(itemStackClass, "getUseDuration", c("net.minecraft.world.entity.LivingEntity"));
    Method hasFoil = m(itemStackClass, "hasFoil");
    Method compGet = m(c("net.minecraft.core.component.DataComponentHolder"), "getOrDefault", c("net.minecraft.core.component.DataComponentType"), Object.class);
    Class<?> entryClass = c("net.minecraft.world.item.component.ItemAttributeModifiers$Entry");
    Map<String, Object> items = new TreeMap<>();
    for (Object item : (Iterable<?>) itemReg) {
      int id = ((Number) regGetId.invoke(itemReg, item)).intValue();
      Object stack = getDefault.invoke(item);
      String action = call(getUseAnim.invoke(stack), "getSerializedName", new Class<?>[]{}).toString();
      int dur = ((Number) getUseDur.invoke(stack, fakeLiving)).intValue();
      boolean foil = (Boolean) hasFoil.invoke(stack);
      Object iam = compGet.invoke(stack, attrComp, emptyAttrMod);
      List<Object> modsOut = new ArrayList<>();
      for (Object e : (List<?>) call(iam, "modifiers", new Class<?>[]{})) {
        Object aHolder = call(e, "attribute", new Class<?>[]{});
        Object mod = call(e, "modifier", new Class<?>[]{});
        Object slot = call(e, "slot", new Class<?>[]{});
        Object attrVal = call(aHolder, "value", new Class<?>[]{});
        Map<String, Object> row = new TreeMap<>();
        row.put("type", regGetKey.invoke(attrReg, attrVal).toString());
        row.put("id", call(mod, "id", new Class<?>[]{}).toString());
        row.put("amount", modAmount.invoke(mod));
        row.put("operation", call(modOp.invoke(mod), "getSerializedName", new Class<?>[]{}).toString());
        row.put("slot", call(slot, "getSerializedName", new Class<?>[]{}).toString());
        modsOut.add(row);
      }
      items.put(String.valueOf(id), Map.of(
        "action", action,
        "duration", dur,
        "foil", foil,
        "defaultAttributes", Map.of("modifiers", modsOut)
      ));
    }

    // 8. BlendSamples (MobEffectInstance.BlendState on Darkness / Night Vision)
    Field blendField = f(meiClass, "blendState");
    Field durField = f(meiClass, "duration");
    Class<?> bsClass = c("net.minecraft.world.effect.MobEffectInstance$BlendState");
    Method bsTick = m(bsClass, "tick", meiClass);
    Method bsFactor = m(bsClass, "getFactor", c("net.minecraft.world.entity.LivingEntity"), float.class);
    Constructor<?> meiCtor = meiClass.getConstructor(c("net.minecraft.core.Holder"), int.class, int.class);
    Object mobEffectHolderReg = m(regClass, "wrapAsHolder", Object.class).invoke(effReg, m(regClass, "getValue", c("net.minecraft.resources.Identifier")).invoke(effReg, id("minecraft:darkness")));
    Object nightVisionHolder = m(regClass, "wrapAsHolder", Object.class).invoke(effReg, m(regClass, "getValue", c("net.minecraft.resources.Identifier")).invoke(effReg, id("minecraft:night_vision")));
    List<Object> blendSamples = new ArrayList<>();
    for (Object[] spec : new Object[][]{{mobEffectHolderReg, 100}, {mobEffectHolderReg, 22}, {mobEffectHolderReg, 10}, {nightVisionHolder, 100}, {nightVisionHolder, 20}, {nightVisionHolder, 5}}) {
      int totalDur = (Integer) spec[1];
      Object inst = meiCtor.newInstance(spec[0], totalDur, 0);
      Object bs = blendField.get(inst);
      List<Object> frames = new ArrayList<>();
      for (int rem = totalDur; rem >= 0; rem--) {
        durField.setInt(inst, rem);
        float prev = ((Number) bsFactor.invoke(bs, fakeLiving, 0f)).floatValue();
        bsTick.invoke(bs, inst);
        float cur = ((Number) bsFactor.invoke(bs, fakeLiving, 0f)).floatValue();
        frames.add(Map.of("duration", rem, "previous", prev, "current", cur));
      }
      blendSamples.add(Map.of("duration", totalDur, "frames", frames));
    }

    // 9. Samples evaluation
    Object ops = m(c("net.minecraft.resources.RegistryOps"), "create", DynamicOps.class, c("net.minecraft.core.HolderLookup$Provider"))
      .invoke(null, JsonOps.INSTANCE, lookup);
    @SuppressWarnings("rawtypes") Codec stackCodec = (Codec) f(itemStackClass, "CODEC").get(null);
    @SuppressWarnings("rawtypes") Codec compCodec = (Codec) f(c("net.minecraft.network.chat.ComponentSerialization"), "CODEC").get(null);
    @SuppressWarnings("rawtypes") Codec tintCodec = (Codec) f(c("net.minecraft.client.color.item.ItemTintSources"), "CODEC").get(null);
    Method calcTint = m(c("net.minecraft.client.color.item.ItemTintSource"), "calculate",
      itemStackClass, c("net.minecraft.client.multiplayer.ClientLevel"), c("net.minecraft.world.entity.LivingEntity"));
    Object context = m(c("net.minecraft.world.item.Item$TooltipContext"), "of", c("net.minecraft.core.HolderLookup$Provider")).invoke(null, lookup);
    Object normalFlag = f(c("net.minecraft.world.item.TooltipFlag"), "NORMAL").get(null);
    Object advFlag = f(c("net.minecraft.world.item.TooltipFlag"), "ADVANCED").get(null);
    Method getTooltips = m(itemStackClass, "getTooltipLines",
      c("net.minecraft.world.item.Item$TooltipContext"), c("net.minecraft.world.entity.player.Player"), c("net.minecraft.world.item.TooltipFlag"));

    List<Object> samples = new ArrayList<>();
    for (JsonElement el : JsonParser.parseString(Files.readString(Path.of(args[3]))).getAsJsonArray()) {
      JsonObject input = el.getAsJsonObject();
      String label = input.get("label").getAsString();
      JsonObject stJson = input.getAsJsonObject("stack");
      Object st = stackCodec.parse((DynamicOps) ops, stJson).getOrThrow();
      String hoverName = call(call(st, "getHoverName", new Class<?>[]{}), "getString", new Class<?>[]{}).toString();
      String action = call(getUseAnim.invoke(st), "getSerializedName", new Class<?>[]{}).toString();
      int dur = ((Number) getUseDur.invoke(st, fakeLiving)).intValue();
      boolean foil = (Boolean) hasFoil.invoke(st);
      int maxStack = ((Number) call(st, "getMaxStackSize", new Class<?>[]{})).intValue();
      int maxDmg = ((Number) call(st, "getMaxDamage", new Class<?>[]{})).intValue();
      int dmg = ((Number) call(st, "getDamageValue", new Class<?>[]{})).intValue();
      boolean damageable = (Boolean) call(st, "isDamageableItem", new Class<?>[]{});
      String rarity = call(call(st, "getRarity", new Class<?>[]{}), "getSerializedName", new Class<?>[]{}).toString();
      int[] cols = extractItemColors(st, stJson.get("id").getAsString(), tintCodec, calcTint);

      List<Object> normLines = new ArrayList<>();
      for (Object cLine : (List<?>) getTooltips.invoke(st, context, null, normalFlag)) {
        normLines.add(compCodec.encodeStart((DynamicOps) ops, cLine).getOrThrow());
      }
      List<Object> advLines = new ArrayList<>();
      for (Object cLine : (List<?>) getTooltips.invoke(st, context, null, advFlag)) {
        advLines.add(compCodec.encodeStart((DynamicOps) ops, cLine).getOrThrow());
      }

      Map<String, Object> s = new TreeMap<>();
      s.put("label", label);
      s.put("input", stJson);
      s.put("wire", stack(st));
      s.put("name", hoverName);
      s.put("action", action);
      s.put("duration", dur);
      s.put("foil", foil);
      s.put("maxStack", maxStack);
      s.put("maxDamage", maxDmg);
      s.put("damage", dmg);
      s.put("damageable", damageable);
      s.put("rarity", rarity);
      s.put("colors", List.of(cols[0], cols[1]));
      s.put("tooltip", normLines);
      s.put("advancedTooltip", advLines);
      samples.add(s);
    }

    Map<String, Object> out = new TreeMap<>();
    out.put("baseAttackDamageId", f(c("net.minecraft.world.item.Item"), "BASE_ATTACK_DAMAGE_ID").get(null).toString());
    out.put("baseAttackSpeedId", f(c("net.minecraft.world.item.Item"), "BASE_ATTACK_SPEED_ID").get(null).toString());
    out.put("registries", registries);
    out.put("effects", effects);
    out.put("eggs", Map.of());
    out.put("potions", potions);
    out.put("instruments", instruments);
    out.put("enchantmentOrder", enchantmentOrder);
    out.put("fireworkColors", fireworkColors);
    out.put("items", items);
    out.put("blendSamples", blendSamples);
    out.put("samples", samples);
    Files.writeString(Path.of(args[0]), new GsonBuilder().disableHtmlEscaping().create().toJson(out));
  }
}
