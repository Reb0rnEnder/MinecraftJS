// Encodes one update_advancements packet with Mojang's own 26.3 StreamCodec, then
// re-decodes it. The printed hex is the wire truth the JS codec is gated against; the
// printed summary is read back from the codec's decoded object.
import io.netty.buffer.ByteBuf;
import io.netty.buffer.Unpooled;
import java.lang.reflect.Constructor;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import net.minecraft.SharedConstants;
import net.minecraft.advancements.Advancement;
import net.minecraft.advancements.AdvancementHolder;
import net.minecraft.advancements.AdvancementProgress;
import net.minecraft.advancements.AdvancementRequirements;
import net.minecraft.advancements.AdvancementRewards;
import net.minecraft.advancements.AdvancementType;
import net.minecraft.advancements.CriterionProgress;
import net.minecraft.advancements.DisplayInfo;
import net.minecraft.core.ClientAsset;
import net.minecraft.core.RegistryAccess;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.network.RegistryFriendlyByteBuf;
import net.minecraft.network.chat.Component;
import net.minecraft.network.protocol.game.ClientboundUpdateAdvancementsPacket;
import net.minecraft.resources.Identifier;
import net.minecraft.server.Bootstrap;
import net.minecraft.world.item.ItemStackTemplate;
import net.minecraft.world.item.Items;

public final class DumpAdvancements26_3 {
  private static RegistryFriendlyByteBuf buffer() {
    return new RegistryFriendlyByteBuf(Unpooled.buffer(), RegistryAccess.fromRegistryOfRegistries(BuiltInRegistries.REGISTRY));
  }

  private static String hex(ByteBuf buf) {
    StringBuilder out = new StringBuilder();
    for (int i = 0; i < buf.readableBytes(); i++) out.append(String.format("%02x", buf.getUnsignedByte(i)));
    return out.toString();
  }

  // AdvancementProgress's map constructor is private; the fixture needs fixed instants so
  // the oracle stays byte-for-byte reproducible.
  @SuppressWarnings("unchecked")
  private static AdvancementProgress progress(Map<String, CriterionProgress> criteria) throws Exception {
    Constructor<AdvancementProgress> ctor = AdvancementProgress.class.getDeclaredConstructor(Map.class);
    ctor.setAccessible(true);
    return ctor.newInstance(criteria);
  }

  private static String json(String value) {
    return '"' + value.replace("\\", "\\\\").replace("\"", "\\\"") + '"';
  }

  public static void main(String[] args) throws Exception {
    SharedConstants.tryDetectVersion();
    Bootstrap.bootStrap();

    AdvancementRequirements requirements = new AdvancementRequirements(List.of(
        List.of("get_stone"),
        List.of("get_dirt", "get_gravel")));
    DisplayInfo display = new DisplayInfo(
        new ItemStackTemplate(Items.STONE),
        Component.literal("Stone Age"),
        Component.literal("Mine stone"),
        Optional.of(new ClientAsset.ResourceTexture(Identifier.parse("minecraft:textures/block/stone.png"))),
        AdvancementType.TASK, true, false, false);
    Advancement advancement = new Advancement(Optional.empty(), Optional.of(display),
        AdvancementRewards.EMPTY, Map.of(), requirements, true);
    AdvancementHolder holder = new AdvancementHolder(Identifier.parse("minecraft:story/stone"), advancement);

    LinkedHashMap<String, CriterionProgress> criteria = new LinkedHashMap<>();
    criteria.put("get_stone", new CriterionProgress(Instant.ofEpochMilli(1700000000000L)));
    criteria.put("get_dirt", new CriterionProgress());
    AdvancementProgress progress = progress(criteria);
    progress.update(requirements);

    Map<Identifier, AdvancementProgress> progressMap = new LinkedHashMap<>();
    progressMap.put(holder.id(), progress);
    Set<Identifier> removed = new LinkedHashSet<>(List.of(Identifier.parse("minecraft:story/old")));
    ClientboundUpdateAdvancementsPacket advancements = new ClientboundUpdateAdvancementsPacket(
        false,
        List.of(new ClientboundUpdateAdvancementsPacket.PositionedAdvancement(holder, 1.5f, 2.25f)),
        removed, progressMap, true);

    RegistryFriendlyByteBuf buf = buffer();
    ClientboundUpdateAdvancementsPacket.STREAM_CODEC.encode(buf, advancements);
    String packetHex = hex(buf);
    ClientboundUpdateAdvancementsPacket readBack = ClientboundUpdateAdvancementsPacket.STREAM_CODEC.decode(buf);
    if (buf.readableBytes() != 0) throw new IllegalStateException("advancements codec left bytes");

    ClientboundUpdateAdvancementsPacket.PositionedAdvancement positioned = readBack.added().get(0);
    DisplayInfo readDisplay = positioned.advancement().value().display().orElseThrow();
    StringBuilder out = new StringBuilder();
    out.append("{\n");
    out.append("  \"hex\": ").append(json(packetHex)).append(",\n");
    out.append("  \"expected\": {\n");
    out.append("    \"reset\": ").append(readBack.shouldReset()).append(",\n");
    out.append("    \"show\": ").append(readBack.showAdvancements()).append(",\n");
    out.append("    \"id\": ").append(json(positioned.advancement().id().toString())).append(",\n");
    out.append("    \"x\": ").append(positioned.x()).append(",\n");
    out.append("    \"y\": ").append(positioned.y()).append(",\n");
    out.append("    \"parent\": null,\n");
    out.append("    \"title\": ").append(json(readDisplay.title().getString())).append(",\n");
    out.append("    \"description\": ").append(json(readDisplay.description().getString())).append(",\n");
    out.append("    \"frame\": ").append(readDisplay.type().ordinal()).append(",\n");
    out.append("    \"background\": ").append(json(readDisplay.background().orElseThrow().id().toString())).append(",\n");
    out.append("    \"showToast\": ").append(readDisplay.showToast()).append(",\n");
    out.append("    \"hidden\": ").append(readDisplay.hidden()).append(",\n");
    out.append("    \"iconItem\": ").append(json(BuiltInRegistries.ITEM.getKey(readDisplay.icon().typeHolder().value()).toString())).append(",\n");
    out.append("    \"iconCount\": ").append(readDisplay.icon().count()).append(",\n");
    out.append("    \"requirements\": [[\"get_stone\"], [\"get_dirt\", \"get_gravel\"]],\n");
    out.append("    \"telemetry\": ").append(positioned.advancement().value().sendsTelemetryEvent()).append(",\n");
    out.append("    \"removed\": [").append(json(readBack.removed().iterator().next().toString())).append("],\n");
    out.append("    \"progress\": [{\"criterion\": \"get_stone\", \"obtained\": 1700000000000}, {\"criterion\": \"get_dirt\", \"obtained\": null}]\n");
    out.append("  }\n");
    out.append("}\n");
    System.out.print(out);
  }
}
