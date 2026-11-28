// Dumps the synched metadata indices for the 26.3-only entity classes, including inherited
// accessors, by reading the static EntityDataAccessor fields after Bootstrap assigns ids.
import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.util.LinkedHashMap;
import java.util.Map;
import net.minecraft.SharedConstants;
import net.minecraft.network.syncher.EntityDataAccessor;
import net.minecraft.server.Bootstrap;

public final class DumpEntityMetadata26_3 {
  private static final String[][] ENTITIES = {
    {"bogged", "net.minecraft.world.entity.monster.skeleton.Bogged"},
    {"breeze", "net.minecraft.world.entity.monster.breeze.Breeze"},
    {"camel_husk", "net.minecraft.world.entity.animal.camel.CamelHusk"},
    {"copper_golem", "net.minecraft.world.entity.animal.golem.CopperGolem"},
    {"creaking", "net.minecraft.world.entity.monster.creaking.Creaking"},
    {"cushion", "net.minecraft.world.entity.decoration.Cushion"},
    {"happy_ghast", "net.minecraft.world.entity.animal.happyghast.HappyGhast"},
    {"mannequin", "net.minecraft.world.entity.decoration.Mannequin"},
    {"nautilus", "net.minecraft.world.entity.animal.nautilus.Nautilus"},
    {"parched", "net.minecraft.world.entity.monster.skeleton.Parched"},
    {"sulfur_cube", "net.minecraft.world.entity.monster.cubemob.SulfurCube"},
    {"zombie_nautilus", "net.minecraft.world.entity.animal.nautilus.ZombieNautilus"}
  };

  public static void main(String[] args) throws Exception {
    SharedConstants.tryDetectVersion();
    Bootstrap.bootStrap();
    StringBuilder out = new StringBuilder("{\n");
    for (int i = 0; i < ENTITIES.length; i++) {
      Map<String, Integer> rows = new LinkedHashMap<>();
      for (Class<?> type = Class.forName(ENTITIES[i][1]); type != null && type != Object.class; type = type.getSuperclass()) {
        for (Field field : type.getDeclaredFields()) {
          if (!Modifier.isStatic(field.getModifiers()) || !EntityDataAccessor.class.isAssignableFrom(field.getType())) continue;
          field.setAccessible(true);
          EntityDataAccessor<?> accessor = (EntityDataAccessor<?>) field.get(null);
          rows.putIfAbsent(field.getName(), accessor.id());
        }
      }
      out.append("  \"").append(ENTITIES[i][0]).append("\": {");
      int j = 0;
      for (Map.Entry<String, Integer> row : rows.entrySet()) {
        if (j++ > 0) out.append(", ");
        out.append("\"").append(row.getKey()).append("\": ").append(row.getValue());
      }
      out.append("}").append(i + 1 == ENTITIES.length ? "\n" : ",\n");
    }
    out.append("}\n");
    System.out.print(out);
  }
}
