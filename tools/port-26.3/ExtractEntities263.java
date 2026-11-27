import com.google.gson.GsonBuilder;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import java.nio.file.Files;
import java.nio.file.Path;
import net.minecraft.SharedConstants;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.server.Bootstrap;
import net.minecraft.world.entity.EntityDimensions;
import net.minecraft.world.entity.EntityType;

// Dump the pinned 26.3 EntityType registry in protocol_id order. EntityType.getWidth/getHeight
// are the native defaults, and EntityDimensions also carries the eye height 26.3 renderers use.
// No protocol wiki or version-mixed table is involved.
public class ExtractEntities263 {
  public static void main(String[] args) throws Exception {
    if (args.length != 1) throw new IllegalArgumentException("usage: ExtractEntities263 <output.json>");
    SharedConstants.tryDetectVersion();
    Bootstrap.bootStrap();
    JsonArray out = new JsonArray();
    for (EntityType<?> type : BuiltInRegistries.ENTITY_TYPE) {
      String key = EntityType.getKey(type).toString();
      EntityDimensions dimensions = type.getDimensions();
      JsonObject row = new JsonObject();
      row.addProperty("name", key.substring(key.indexOf(':') + 1));
      row.addProperty("width", dimensions.width());
      row.addProperty("height", dimensions.height());
      row.addProperty("eyeHeight", dimensions.eyeHeight());
      row.addProperty("category", type.getCategory().getSerializedName());
      out.add(row);
    }
    Files.writeString(Path.of(args[0]), new GsonBuilder().disableHtmlEscaping().create().toJson(out) + "\n");
  }
}
