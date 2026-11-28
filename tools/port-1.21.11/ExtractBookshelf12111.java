import com.google.gson.*;
import java.lang.invoke.*;
import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;

// Native 1.21.11 ChiseledBookShelfBlock getHitSlot + InteractionResult oracle.
public class ExtractBookshelf12111 extends ExtractCreative12111 {
  static Object call(Object o, String name, Class<?>[] types, Object... args) throws Exception {
    return m(o.getClass(), name, types).invoke(o, args);
  }
  static Object blank(Class<?> cls) throws Exception {
    Field f = sun.misc.Unsafe.class.getDeclaredField("theUnsafe");
    f.setAccessible(true);
    return ((sun.misc.Unsafe) f.get(null)).allocateInstance(cls);
  }
  static Class<?> getterSubclass(String name, Class<?> parent, String field, Class<?> value, String getter, Class<?> argument) throws Exception {
    String descriptor = "L" + value.getName().replace('.', '/') + ";";
    String method = "(L" + argument.getName().replace('.', '/') + ";)" + descriptor;
    var bytes = new java.io.ByteArrayOutputStream();
    var out = new java.io.DataOutputStream(bytes);
    out.writeInt(0xCAFEBABE); out.writeShort(0); out.writeShort(61); out.writeShort(12);
    out.writeByte(1); out.writeUTF(name); out.writeByte(7); out.writeShort(1);
    out.writeByte(1); out.writeUTF(parent.getName().replace('.', '/')); out.writeByte(7); out.writeShort(3);
    out.writeByte(1); out.writeUTF(field); out.writeByte(1); out.writeUTF(descriptor);
    out.writeByte(12); out.writeShort(5); out.writeShort(6); out.writeByte(9); out.writeShort(2); out.writeShort(7);
    out.writeByte(1); out.writeUTF(getter); out.writeByte(1); out.writeUTF(method);
    out.writeByte(1); out.writeUTF("Code");
    out.writeShort(0x21); out.writeShort(2); out.writeShort(4); out.writeShort(0);
    out.writeShort(1); out.writeShort(9); out.writeShort(5); out.writeShort(6); out.writeShort(0);
    out.writeShort(1); out.writeShort(1); out.writeShort(9); out.writeShort(10); out.writeShort(1); out.writeShort(11);
    out.writeInt(16); out.writeShort(1); out.writeShort(2); out.writeInt(4);
    out.writeByte(0xb2); out.writeShort(8); out.writeByte(0xb0);
    out.writeShort(0); out.writeShort(0); out.writeShort(0);
    return MethodHandles.lookup().defineClass(bytes.toByteArray());
  }

  static String irName(Object res, Object tryEmpty, Object pass, Object fail, Object consume, Object success, Object successServer, Class<?> succClass) {
    if (res == tryEmpty) return "TRY_WITH_EMPTY_HAND";
    if (res == pass) return "PASS";
    if (res == fail) return "FAIL";
    if (res == consume) return "CONSUME";
    if (res == success) return "SUCCESS";
    if (res == successServer) return "SUCCESS_SERVER";
    if (succClass.isInstance(res)) return "SUCCESS";
    return res.getClass().getSimpleName();
  }

  public static void main(String[] args) throws Exception {
    loadMappings(Path.of(args[1]));
    m(c("net.minecraft.SharedConstants"), "tryDetectVersion").invoke(null);
    m(c("net.minecraft.server.Bootstrap"), "bootStrap").invoke(null);

    Class<?> level = c("net.minecraft.client.multiplayer.ClientLevel");
    Class<?> be = c("net.minecraft.world.level.block.entity.BlockEntity");
    Class<?> posType = c("net.minecraft.core.BlockPos");
    Class<?> stateType = c("net.minecraft.world.level.block.state.BlockState");
    Class<?> hitType = c("net.minecraft.world.phys.BlockHitResult");
    Class<?> dirType = c("net.minecraft.core.Direction");
    Class<?> vecType = c("net.minecraft.world.phys.Vec3");
    Class<?> cls = c("net.minecraft.world.level.block.ChiseledBookShelfBlock");
    Class<?> ssc = c("net.minecraft.world.level.block.SelectableSlotContainer");

    String getter = m(c("net.minecraft.world.level.Level"), "getBlockEntity", posType).getName();
    Class<?> fakeType = getterSubclass("BookshelfOracleLevel12111", level, "entity", be, getter, posType);
    Object world = blank(fakeType);
    f(c("net.minecraft.world.level.Level"), "isClientSide").setBoolean(world, true);

    Object block = f(c("net.minecraft.world.level.block.Blocks"), "CHISELED_BOOKSHELF").get(null);
    Object defaultState = call(block, "defaultBlockState", new Class<?>[]{});
    Object facingProperty = f(c("net.minecraft.world.level.block.HorizontalDirectionalBlock"), "FACING").get(null);
    Object pos = posType.getConstructor(int.class, int.class, int.class).newInstance(-3, 64, 7);
    Method set = m(c("net.minecraft.world.level.block.state.StateHolder"), "setValue",
      c("net.minecraft.world.level.block.state.properties.Property"), Comparable.class);

    Object registry = f(c("net.minecraft.core.registries.BuiltInRegistries"), "ITEM").get(null);
    Object tag = f(c("net.minecraft.tags.ItemTags"), "BOOKSHELF_BOOKS").get(null);
    List<String> books = new ArrayList<>();
    try (var in = ExtractBookshelf12111.class.getClassLoader().getResourceAsStream("data/minecraft/tags/item/bookshelf_books.json")) {
      for (JsonElement e : JsonParser.parseReader(new java.io.InputStreamReader(in)).getAsJsonObject().getAsJsonArray("values")) {
        books.add(e.getAsString());
      }
    }

    Map<String, Object> stacks = new LinkedHashMap<>();
    Method regGetVal = m(c("net.minecraft.core.Registry"), "getValue", c("net.minecraft.resources.Identifier"));
    Method bindTags = m(c("net.minecraft.core.Holder$Reference"), "bindTags", Collection.class);
    for (String name : List.of("minecraft:air", "minecraft:book", "minecraft:writable_book", "minecraft:written_book", "minecraft:enchanted_book", "minecraft:knowledge_book", "minecraft:stone")) {
      Object item = regGetVal.invoke(registry, id(name));
      Object holder = call(item, "builtInRegistryHolder", new Class<?>[]{});
      bindTags.invoke(holder, books.contains(name) ? List.of(tag) : List.of());
      stacks.put(name, call(item, "getDefaultInstance", new Class<?>[]{}));
    }

    Class<?> irClass = c("net.minecraft.world.InteractionResult");
    Class<?> irSuccClass = c("net.minecraft.world.InteractionResult$Success");
    Class<?> swingEnum = c("net.minecraft.world.InteractionResult$SwingSource");
    Object swingClient = f(swingEnum, "CLIENT").get(null);
    Object tryEmpty = f(irClass, "TRY_WITH_EMPTY_HAND").get(null);
    Object irPass = f(irClass, "PASS").get(null);
    Object irFail = f(irClass, "FAIL").get(null);
    Object irConsume = f(irClass, "CONSUME").get(null);
    Object irSuccess = f(irClass, "SUCCESS").get(null);
    Object irSuccessServer = f(irClass, "SUCCESS_SERVER").get(null);

    Object hand = c("net.minecraft.world.InteractionHand").getEnumConstants()[0];
    Method getHitSlot = m(ssc, "getHitSlot", hitType, dirType);
    Method useItemOn = m(cls, "useItemOn", c("net.minecraft.world.item.ItemStack"), stateType, c("net.minecraft.world.level.Level"), posType, c("net.minecraft.world.entity.player.Player"), c("net.minecraft.world.InteractionHand"), hitType);
    Method useWithout = m(cls, "useWithoutItem", stateType, c("net.minecraft.world.level.Level"), posType, c("net.minecraft.world.entity.player.Player"), hitType);
    Constructor<?> beCtor = c("net.minecraft.world.level.block.entity.ChiseledBookShelfBlockEntity").getConstructor(posType, stateType);

    List<Object> hits = new ArrayList<>(), uses = new ArrayList<>();
    for (Object facing : dirType.getEnumConstants()) {
      int facingId = ((Enum<?>) facing).ordinal();
      if (facingId < 2) continue;
      Object state = set.invoke(defaultState, facingProperty, facing);
      for (Object face : dirType.getEnumConstants()) {
        for (double u : face == facing ? new double[]{0, .37499997, .375, .68749997, .6875, .9} : new double[]{.5}) {
          for (double y : face == facing ? new double[]{.2, .5, .8} : new double[]{.5}) {
            int faceId = ((Enum<?>) face).ordinal();
            double[] point = {-3 + u, 64 + y, 7 + u};
            if (faceId == 0) point[1] = 64;
            if (faceId == 1) point[1] = 65;
            if (faceId == 2) point[2] = 7;
            if (faceId == 3) point[2] = 8;
            if (faceId == 4) point[0] = -3;
            if (faceId == 5) point[0] = -2;
            Object hit = hitType.getConstructor(vecType, dirType, posType, boolean.class)
              .newInstance(vecType.getConstructor(double.class, double.class, double.class).newInstance(point[0], point[1], point[2]), face, pos, false);
            OptionalInt slot = (OptionalInt) getHitSlot.invoke(block, hit, facing);
            Map<String, Object> sample = new LinkedHashMap<>();
            sample.put("facing", ((Enum<?>) facing).name().toLowerCase(Locale.ROOT));
            sample.put("face", faceId);
            sample.put("point", point);
            sample.put("slot", slot.orElse(-1));
            hits.add(sample);
            if (slot.isEmpty()) continue;
            for (boolean occupied : new boolean[]{false, true}) {
              Object prop = ((List<?>) f(cls, "SLOT_OCCUPIED_PROPERTIES").get(null)).get(slot.getAsInt());
              Object current = set.invoke(state, prop, occupied);
              Object entity = beCtor.newInstance(pos, current);
              fakeType.getField("entity").set(null, entity);
              for (var stack : stacks.entrySet()) {
                Object itemRes = useItemOn.invoke(block, stack.getValue(), current, world, pos, null, hand, hit);
                Object res = itemRes == tryEmpty ? useWithout.invoke(block, current, world, pos, null, hit) : itemRes;
                boolean consumes = (Boolean) call(res, "consumesAction", new Class<?>[]{});
                boolean swing = irSuccClass.isInstance(res) && call(res, "swingSource", new Class<?>[]{}) == swingClient;
                uses.add(Map.of(
                  "hit", hits.size() - 1,
                  "item", stack.getKey(),
                  "occupied", occupied,
                  "itemResult", irName(itemRes, tryEmpty, irPass, irFail, irConsume, irSuccess, irSuccessServer, irSuccClass),
                  "result", irName(res, tryEmpty, irPass, irFail, irConsume, irSuccess, irSuccessServer, irSuccClass),
                  "consumes", consumes,
                  "swing", swing
                ));
              }
            }
          }
        }
      }
    }
    Files.writeString(Path.of(args[0]), new Gson().toJson(Map.of("hits", hits, "uses", uses, "books", books)));
  }
}
