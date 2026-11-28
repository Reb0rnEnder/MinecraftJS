import java.awt.image.BufferedImage;
import java.io.InputStream;
import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;
import javax.imageio.ImageIO;
import com.google.gson.*;

// Native 1.21.11 GrassColor, FoliageColor, DryFoliageColor, Biome, and BlockColors oracle.
public class ExtractFoliage12111 extends ExtractCreative12111 {
  static Object call(Object o, String name, Class<?>[] types, Object... args) throws Exception {
    return m(o.getClass(), name, types).invoke(o, args);
  }
  static int[] pngPixels(String path) throws Exception {
    try (InputStream in = ExtractFoliage12111.class.getClassLoader().getResourceAsStream(path)) {
      if (in == null) throw new IllegalStateException("Missing colormap resource: " + path);
      BufferedImage img = ImageIO.read(in);
      return img.getRGB(0, 0, 256, 256, null, 0, 256);
    }
  }

  public static void main(String[] args) throws Exception {
    loadMappings(Path.of(args[1]));
    m(c("net.minecraft.SharedConstants"), "tryDetectVersion").invoke(null);
    m(c("net.minecraft.server.Bootstrap"), "bootStrap").invoke(null);

    for (String cn : List.of("net.minecraft.world.level.GrassColor", "net.minecraft.world.level.FoliageColor", "net.minecraft.world.level.DryFoliageColor")) {
      String res = cn.endsWith("GrassColor") ? "grass" : cn.endsWith("FoliageColor") && !cn.contains("Dry") ? "foliage" : "dry_foliage";
      Class<?> cc = c(cn);
      Method initM = Arrays.stream(cc.getDeclaredMethods()).filter(mm -> mm.getParameterCount() == 1 && mm.getParameterTypes()[0] == int[].class).findFirst().orElseThrow();
      initM.setAccessible(true);
      initM.invoke(null, (Object) pngPixels("assets/minecraft/textures/colormap/" + res + ".png"));
    }

    Object lookup = m(c("net.minecraft.data.registries.VanillaRegistries"), "createLookup").invoke(null);
    Object biomeKey = f(c("net.minecraft.core.registries.Registries"), "BIOME").get(null);
    Object biomes = m(c("net.minecraft.core.HolderLookup$Provider"), "lookupOrThrow", c("net.minecraft.resources.ResourceKey")).invoke(lookup, biomeKey);
    Class<?> holderClass = c("net.minecraft.core.Holder");
    Class<?> rkClass = c("net.minecraft.resources.ResourceKey");
    Class<?> holderRef = c("net.minecraft.core.Holder$Reference");
    Method holderKey = m(holderRef, "key");
    Method rkId = m(rkClass, "identifier");
    Method holderValue = m(holderClass, "value");
    Method getGrass = m(c("net.minecraft.world.level.biome.Biome"), "getGrassColor", double.class, double.class);
    Method getFoliage = m(c("net.minecraft.world.level.biome.Biome"), "getFoliageColor");
    Method getDryFoliage = m(c("net.minecraft.world.level.biome.Biome"), "getDryFoliageColor");

    int[][] coords = {{0, 0}, {77, -19}, {-100, 200}, {121, 57}};
    Map<String, Object> biomeOut = new TreeMap<>();
    List<?> elements = ((java.util.stream.Stream<?>) m(c("net.minecraft.core.HolderLookup"), "listElements").invoke(biomes)).toList();
    for (Object h : elements) {
      String id = rkId.invoke(holderKey.invoke(h)).toString();
      Object b = holderValue.invoke(h);
      int foliage = ((Integer) getFoliage.invoke(b)) & 0xFFFFFF;
      int dryFoliage = ((Integer) getDryFoliage.invoke(b)) & 0xFFFFFF;
      List<Object> samples = new ArrayList<>();
      for (int[] xz : coords) {
        int grass = ((Integer) getGrass.invoke(b, (double) xz[0], (double) xz[1])) & 0xFFFFFF;
        samples.add(Map.of("x", xz[0], "z", xz[1], "grass", grass, "foliage", foliage, "dryFoliage", dryFoliage));
      }
      biomeOut.put(id, samples);
    }

    // Extract Biome.BIOME_INFO_NOISE + BlockColors defaults
    Object noiseObj = f(c("net.minecraft.world.level.biome.Biome"), "BIOME_INFO_NOISE").get(null);
    Method noiseVal = m(noiseObj.getClass(), "getValue", double.class, double.class, boolean.class);
    Object swampMod = f(c("net.minecraft.world.level.biome.BiomeSpecialEffects$GrassColorModifier"), "SWAMP").get(null);
    Method modColor = m(c("net.minecraft.world.level.biome.BiomeSpecialEffects$GrassColorModifier"), "modifyColor", double.class, double.class, int.class);
    List<Object> noiseSamples = new ArrayList<>();
    for (int x = -100; x <= 100 && noiseSamples.size() < 192; x += 15) {
      for (int z = -100; z <= 100 && noiseSamples.size() < 192; z += 15) {
        double v = (Double) noiseVal.invoke(noiseObj, (double) x, (double) z, false);
        int grass = ((Integer) modColor.invoke(swampMod, (double) x, (double) z, 0)) & 0xFFFFFF;
        noiseSamples.add(Map.of("x", x, "z", z, "value", v, "grass", grass));
      }
    }

    Class<?> blockColorsClass = c("net.minecraft.client.color.block.BlockColors");
    Object blockColors = m(blockColorsClass, "createDefault").invoke(null);
    Method getColor4 = m(blockColorsClass, "getColor",
      c("net.minecraft.world.level.block.state.BlockState"),
      c("net.minecraft.world.level.BlockAndTintGetter"),
      c("net.minecraft.core.BlockPos"),
      int.class);
    Method getColor3 = m(blockColorsClass, "getColor",
      c("net.minecraft.world.level.block.state.BlockState"),
      c("net.minecraft.world.level.Level"),
      c("net.minecraft.core.BlockPos"));
    Object emptyTintGetter = f(c("net.minecraft.world.level.EmptyBlockAndTintGetter"), "INSTANCE").get(null);
    Class<?> btGetter = c("net.minecraft.world.level.BlockAndTintGetter");
    Class<?> crClass = c("net.minecraft.world.level.ColorResolver");
    Method resolve = m(crClass, "getColor", c("net.minecraft.world.level.biome.Biome"), double.class, double.class);
    Object plainsHolder = m(c("net.minecraft.core.HolderGetter"), "getOrThrow", rkClass).invoke(
      biomes, m(rkClass, "create", rkClass, c("net.minecraft.resources.Identifier")).invoke(null, biomeKey, id("minecraft:plains"))
    );
    Object plainsBiome = holderValue.invoke(plainsHolder);
    Object swampHolder = m(c("net.minecraft.core.HolderGetter"), "getOrThrow", rkClass).invoke(
      biomes, m(rkClass, "create", rkClass, c("net.minecraft.resources.Identifier")).invoke(null, biomeKey, id("minecraft:swamp"))
    );
    Object swampBiome = holderValue.invoke(swampHolder);
    Class<?> posClass = c("net.minecraft.core.BlockPos");
    Constructor<?> posCtor = posClass.getConstructor(int.class, int.class, int.class);
    Object pos0 = posCtor.newInstance(0, 64, 0);
    Object worldPlains = Proxy.newProxyInstance(btGetter.getClassLoader(), new Class<?>[]{btGetter}, (o, meth, a) -> {
      if (a != null && a.length == 2 && crClass.isInstance(a[1])) {
        Object bp = a[0];
        int bx = ((Number) call(bp, "getX", new Class<?>[]{})).intValue();
        int bz = ((Number) call(bp, "getZ", new Class<?>[]{})).intValue();
        return resolve.invoke(a[1], plainsBiome, (double) bx, (double) bz);
      }
      return meth.invoke(emptyTintGetter, a);
    });
    Object blockReg = f(c("net.minecraft.core.registries.BuiltInRegistries"), "BLOCK").get(null);
    Method regGet = m(c("net.minecraft.core.Registry"), "getValue", c("net.minecraft.resources.Identifier"));
    List<String> blockIds = List.of(
      "minecraft:grass_block", "minecraft:fern", "minecraft:short_grass", "minecraft:tall_grass", "minecraft:large_fern",
      "minecraft:bush", "minecraft:pink_petals", "minecraft:wildflowers", "minecraft:potted_fern", "minecraft:sugar_cane",
      "minecraft:oak_leaves", "minecraft:spruce_leaves", "minecraft:birch_leaves", "minecraft:jungle_leaves",
      "minecraft:acacia_leaves", "minecraft:dark_oak_leaves", "minecraft:mangrove_leaves", "minecraft:vine",
      "minecraft:leaf_litter", "minecraft:lily_pad", "minecraft:water", "minecraft:seagrass", "minecraft:tall_seagrass"
    );
    Map<String, Object> blockOut = new TreeMap<>();
    for (String bid : blockIds) {
      Object blk = regGet.invoke(blockReg, id(bid));
      Object state = call(blk, "defaultBlockState", new Class<?>[]{});
      int w0 = ((Integer) getColor4.invoke(blockColors, state, worldPlains, pos0, 0)) & 0xFFFFFFFF;
      int w1 = ((Integer) getColor4.invoke(blockColors, state, worldPlains, pos0, 1)) & 0xFFFFFFFF;
      int nw0 = ((Integer) getColor4.invoke(blockColors, state, null, null, 0)) & 0xFFFFFFFF;
      int nw1 = ((Integer) getColor4.invoke(blockColors, state, null, null, 1)) & 0xFFFFFFFF;
      int it0 = ((Integer) getColor3.invoke(blockColors, state, null, null)) & 0xFFFFFFFF;
      blockOut.put(bid, Map.of(
        "world", List.of(w0 == -1 ? -1 : (w0 & 0xFFFFFF), w1 == -1 ? -1 : (w1 & 0xFFFFFF)),
        "withoutWorld", List.of(nw0 == -1 ? -1 : (nw0 & 0xFFFFFF), nw1 == -1 ? -1 : (nw1 & 0xFFFFFF)),
        "item", List.of(it0 == -1 ? -1 : (it0 & 0xFFFFFF), it0 == -1 ? -1 : (it0 & 0xFFFFFF))
      ));
    }

    Files.writeString(Path.of(args[0]), new GsonBuilder().setPrettyPrinting().create().toJson(Map.of(
      "biomes", biomeOut,
      "noise", noiseSamples,
      "blocks", blockOut
    )));
  }
}
