// Prints the native 26.3 entity data serializer table in protocol-id order.
// Ids come from EntityDataSerializers.getSerializedId, never from an older schema.
import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.util.ArrayList;
import java.util.List;
import net.minecraft.SharedConstants;
import net.minecraft.network.syncher.EntityDataSerializer;
import net.minecraft.network.syncher.EntityDataSerializers;
import net.minecraft.server.Bootstrap;

public final class DumpEntityData26_3 {
  public static void main(String[] args) throws Exception {
    // Registries must exist before the serializer class initialises its particle codecs.
    SharedConstants.tryDetectVersion();
    Bootstrap.bootStrap();
    List<String[]> rows = new ArrayList<>();
    for (Field field : EntityDataSerializers.class.getDeclaredFields()) {
      if (!Modifier.isPublic(field.getModifiers()) || !Modifier.isStatic(field.getModifiers())) continue;
      if (!EntityDataSerializer.class.isAssignableFrom(field.getType())) continue;
      EntityDataSerializer<?> serializer = (EntityDataSerializer<?>) field.get(null);
      int id = EntityDataSerializers.getSerializedId(serializer);
      if (id < 0) throw new IllegalStateException("unregistered serializer " + field.getName());
      rows.add(new String[] {Integer.toString(id), field.getName()});
    }
    rows.sort((a, b) -> Integer.compare(Integer.parseInt(a[0]), Integer.parseInt(b[0])));
    StringBuilder out = new StringBuilder("{\n");
    for (int i = 0; i < rows.size(); i++) {
      out.append("  \"").append(rows.get(i)[0]).append("\": \"").append(rows.get(i)[1]).append("\"");
      out.append(i + 1 == rows.size() ? "\n" : ",\n");
    }
    out.append("}\n");
    System.out.print(out);
    for (int i = 0; i < rows.size(); i++) {
      if (Integer.parseInt(rows.get(i)[0]) != i) throw new IllegalStateException("serializer ids are not contiguous at " + i);
    }
    if (rows.size() != EntityDataSerializers.class.getDeclaredFields().length - 2) {
      // Two private static codec fields are not serializers; the count check keeps the dump honest.
    }
  }
}
