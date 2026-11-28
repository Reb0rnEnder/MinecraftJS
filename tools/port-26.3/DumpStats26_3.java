// Prints the native 26.3 stat_type and custom_stat registry order, then encodes one
// ClientboundAwardStatsPacket with Mojang's own StreamCodec and re-decodes it.
import io.netty.buffer.ByteBuf;
import io.netty.buffer.Unpooled;
import it.unimi.dsi.fastutil.objects.Object2IntMap;
import it.unimi.dsi.fastutil.objects.Object2IntOpenHashMap;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import net.minecraft.SharedConstants;
import net.minecraft.core.Registry;
import net.minecraft.core.RegistryAccess;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.network.RegistryFriendlyByteBuf;
import net.minecraft.network.protocol.game.ClientboundAwardStatsPacket;
import net.minecraft.resources.Identifier;
import net.minecraft.server.Bootstrap;
import net.minecraft.stats.Stat;
import net.minecraft.stats.StatType;
import net.minecraft.stats.Stats;
import net.minecraft.world.item.Items;
import net.minecraft.world.level.block.Blocks;

public final class DumpStats26_3 {
  private static RegistryFriendlyByteBuf buffer() {
    return new RegistryFriendlyByteBuf(Unpooled.buffer(), RegistryAccess.fromRegistryOfRegistries(BuiltInRegistries.REGISTRY));
  }

  private static String hex(ByteBuf buf) {
    StringBuilder out = new StringBuilder();
    for (int i = 0; i < buf.readableBytes(); i++) out.append(String.format("%02x", buf.getUnsignedByte(i)));
    return out.toString();
  }

  private static String json(String value) {
    return '"' + value.replace("\\", "\\\\").replace("\"", "\\\"") + '"';
  }

  @SuppressWarnings({"rawtypes", "unchecked"})
  private static List<String> registryOrder(Registry<?> registry) {
    List<String> names = new ArrayList<>();
    Registry raw = registry;
    for (int id = 0; id < raw.size(); id++) {
      Object value = raw.byId(id);
      Identifier key = raw.getKey(value);
      names.add(key == null ? null : key.getPath());
    }
    return names;
  }

  public static void main(String[] args) throws Exception {
    SharedConstants.tryDetectVersion();
    Bootstrap.bootStrap();

    List<String> types = registryOrder(BuiltInRegistries.STAT_TYPE);
    List<String> custom = registryOrder(BuiltInRegistries.CUSTOM_STAT);

    Object2IntMap<Stat<?>> stats = new Object2IntOpenHashMap<>();
    stats.put(Stats.BLOCK_MINED.get(Blocks.STONE), 42);
    stats.put(Stats.ITEM_USED.get(Items.DIAMOND_SWORD), 7);
    stats.put(Stats.CUSTOM.get(Stats.PLAY_TIME), 72000);
    ClientboundAwardStatsPacket packet = new ClientboundAwardStatsPacket(stats);

    RegistryFriendlyByteBuf buf = buffer();
    ClientboundAwardStatsPacket.STREAM_CODEC.encode(buf, packet);
    String packetHex = hex(buf);
    ClientboundAwardStatsPacket readBack = ClientboundAwardStatsPacket.STREAM_CODEC.decode(buf);
    if (buf.readableBytes() != 0) throw new IllegalStateException("award_stats codec left bytes");

    StringBuilder out = new StringBuilder();
    out.append("{\n  \"hex\": ").append(json(packetHex)).append(",\n  \"types\": [");
    for (int i = 0; i < types.size(); i++) out.append(i == 0 ? "" : ", ").append(json(types.get(i)));
    out.append("],\n  \"custom\": [");
    for (int i = 0; i < custom.size(); i++) out.append(i == 0 ? "" : ", ").append(json(custom.get(i)));
    out.append("],\n  \"expected\": [");
    boolean first = true;
    // The fixture lists entries in wire order, which is the encoded map's iteration order;
    // readBack uses a new map whose hash order can differ.
    for (Object2IntMap.Entry<Stat<?>> entry : packet.stats().object2IntEntrySet()) {
      Stat<?> stat = entry.getKey();
      StatType<?> type = stat.getType();
      Identifier typeKey = BuiltInRegistries.STAT_TYPE.getKey(type);
      Registry rawRegistry = type.getRegistry();
      Identifier valueKey = rawRegistry.getKey(stat.getValue());
      if (valueKey == null) throw new IllegalStateException("stat value has no registry key");
      out.append(first ? "" : ", ");
      out.append("{\"type\": ").append(json(typeKey.getPath()))
          .append(", \"value\": ").append(json(valueKey.getPath()))
          .append(", \"count\": ").append(entry.getIntValue()).append("}");
      first = false;
    }
    out.append("]\n}\n");
    System.out.print(out);
  }
}
