import java.nio.file.*;
import java.lang.reflect.*;
import java.util.*;
import com.google.gson.*;
// Pinned 1.13.2 registry; matching server jar supplies library dependencies.
public class Dump {
 public static void main(String[] args)throws Exception {
  Class.forName("pf").getMethod("c").invoke(null);
  Object registry=Class.forName("fc").getField("m").get(null);
  Method id=Class.forName("fc").getMethod("a",Object.class);id.setAccessible(true);
  Map<Integer,Object> colors=new TreeMap<>();
  for(Object biome:(Iterable<?>)registry){colors.put((Integer)id.invoke(registry,biome),List.of(Class.forName("ayu").getMethod("n").invoke(biome),Class.forName("ayu").getMethod("o").invoke(biome)));}
  Files.writeString(Path.of(args[0]),"// Generated from the pinned 1.13.2 biome registry by tools/biome-dump/Dump.java.\nexport const WATER_BIOMES = "+new Gson().toJson(colors)+";\n");
 }
}
