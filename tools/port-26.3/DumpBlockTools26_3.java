// Dumps the native 26.3 blocks whose default state requires the correct tool for drops.
// The JS generator turns this into the runtime set used by Items.canHarvest.
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import net.minecraft.SharedConstants;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.server.Bootstrap;
import net.minecraft.world.level.block.Block;

public final class DumpBlockTools26_3 {
  public static void main(String[] args) {
    SharedConstants.tryDetectVersion();
    Bootstrap.bootStrap();
    List<String> names = new ArrayList<>();
    for (Block block : BuiltInRegistries.BLOCK) {
      if (block.defaultBlockState().requiresCorrectToolForDrops()) {
        names.add(BuiltInRegistries.BLOCK.getKey(block).toString());
      }
    }
    Collections.sort(names);
    StringBuilder out = new StringBuilder("[");
    for (int i = 0; i < names.size(); i++) {
      if (i > 0) out.append(',');
      out.append('"').append(names.get(i)).append('"');
    }
    out.append("]\n");
    System.out.print(out);
  }
}
