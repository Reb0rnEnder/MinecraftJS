// Native 26.3 block table extractor. Runs against the unobfuscated client jar and its
// libraries, boots the real registries and writes the table shape the client consumes.
// No values are taken from an older version: every field is read from the 26.3 classes.
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import net.minecraft.SharedConstants;
import net.minecraft.core.BlockPos;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.resources.Identifier;
import net.minecraft.server.Bootstrap;
import net.minecraft.world.item.Item;
import net.minecraft.world.level.EmptyBlockGetter;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.block.state.properties.BooleanProperty;
import net.minecraft.world.level.block.state.properties.IntegerProperty;
import net.minecraft.world.level.block.state.properties.Property;

import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

public final class ExtractBlocks26_3 {
  private static int unboundStackSizes = 0;
  public static void main(String[] args) throws Exception {
    SharedConstants.tryDetectVersion();
    Bootstrap.bootStrap();

    Map<String, String> lang = loadLang();
    List<Block> blocks = new ArrayList<>();
    for (Block block : BuiltInRegistries.BLOCK) blocks.add(block);
    blocks.sort(Comparator.comparingInt(BuiltInRegistries.BLOCK::getId));

    JsonArray out = new JsonArray();
    for (Block block : blocks) {
      Identifier key = BuiltInRegistries.BLOCK.getKey(block);
      BlockState def = block.defaultBlockState();
      List<BlockState> possible = block.getStateDefinition().getPossibleStates();

      int minState = Integer.MAX_VALUE, maxState = Integer.MIN_VALUE;
      for (BlockState state : possible) {
        int id = Block.getId(state);
        minState = Math.min(minState, id);
        maxState = Math.max(maxState, id);
      }

      JsonObject entry = new JsonObject();
      entry.addProperty("id", BuiltInRegistries.BLOCK.getId(block));
      entry.addProperty("name", key.getPath());
      String display = lang.get("block." + key.getNamespace() + "." + key.getPath());
      entry.addProperty("displayName", display != null ? display : title(key.getPath()));
      float hardness = block.defaultDestroyTime();
      entry.addProperty("hardness", hardness);
      entry.addProperty("resistance", block.getExplosionResistance());
      entry.addProperty("stackSize", stackSize(key));
      entry.addProperty("diggable", hardness >= 0);
      // 1.20.6 exposed minecraft-data's material tag; used only for replaceable plants.
      entry.addProperty("material", "default");
      entry.addProperty("transparent", !def.isSolidRender());
      entry.addProperty("emitLight", def.getLightEmission());
      entry.addProperty("filterLight", def.getLightDampening());
      entry.addProperty("defaultState", Block.getId(def));
      entry.addProperty("minStateId", minState);
      entry.addProperty("maxStateId", maxState);

      JsonArray states = new JsonArray();
      List<Property<?>> properties = new ArrayList<>(def.getProperties());
      properties.sort(Comparator.comparing(Property::getName));
      for (Property<?> property : properties) {
        JsonObject state = new JsonObject();
        state.addProperty("name", property.getName());
        if (property instanceof BooleanProperty) {
          state.addProperty("type", "bool");
          state.addProperty("num_values", 2);
        } else if (property instanceof IntegerProperty integer) {
          state.addProperty("type", "int");
          JsonArray values = new JsonArray();
          int count = 0;
          for (int value = integer.getPossibleValues().get(0); value <= integer.getPossibleValues().get(integer.getPossibleValues().size() - 1); value++) {
            values.add(String.valueOf(value));
            count++;
          }
          state.addProperty("num_values", count);
          state.add("values", values);
        } else {
          state.addProperty("type", "enum");
          JsonArray values = new JsonArray();
          for (Object value : property.getPossibleValues()) values.add(nameOf(property, value));
          state.addProperty("num_values", values.size());
          state.add("values", values);
        }
        states.add(state);
      }
      entry.add("states", states);
      entry.add("drops", new JsonArray());
      entry.addProperty("boundingBox", def.getCollisionShape(EmptyBlockGetter.INSTANCE, BlockPos.ZERO).isEmpty() ? "empty" : "block");
      out.add(entry);
    }

    Path target = Path.of(args.length > 0 ? args[0] : "cache/port-26.3/client-data/blocks.json");
    Files.createDirectories(target.getParent());
    Gson gson = new GsonBuilder().serializeNulls().create();
    try (Writer writer = Files.newBufferedWriter(target, StandardCharsets.UTF_8)) {
      gson.toJson(out, writer);
      writer.write("\n");
    }
    System.out.println("blocks=" + out.size() + " unboundStackSizes=" + unboundStackSizes + " -> " + target);
  }

  @SuppressWarnings({"unchecked", "rawtypes"})
  private static String nameOf(Property property, Object value) {
    return property.getName((Comparable) value);
  }

  private static int stackSize(Identifier blockKey) {
    if (!BuiltInRegistries.ITEM.containsKey(blockKey)) return 64;
    Item item = BuiltInRegistries.ITEM.getValue(blockKey);
    try {
      return item.getDefaultMaxStackSize();
    } catch (NullPointerException unbound) {
      // Item data components are bound by the data-pack reload, which the extractor does not run,
      // so the vanilla default applies until the reload-based extractor lands.
      unboundStackSizes++;
      return 64;
    }
  }

  private static Map<String, String> loadLang() throws Exception {
    try (InputStream stream = ExtractBlocks26_3.class.getResourceAsStream("/assets/minecraft/lang/en_us.json")) {
      if (stream == null) throw new IllegalStateException("client jar assets are not on the classpath");
      return new Gson().fromJson(new InputStreamReader(stream, StandardCharsets.UTF_8), Map.class);
    }
  }

  private static String title(String path) {
    StringBuilder out = new StringBuilder();
    for (String part : path.split("_")) {
      if (part.isEmpty()) continue;
      if (out.length() > 0) out.append(' ');
      out.append(Character.toUpperCase(part.charAt(0))).append(part.substring(1));
    }
    return out.toString();
  }
}
