// Encodes one ClientboundExplodePacket with Mojang's own 26.3 StreamCodec and re-decodes it.
// The hex is the wire truth the JS decoder is gated against; the summary is read back from
// the decoded object, including the weighted block-particle list.
import io.netty.buffer.ByteBuf;
import io.netty.buffer.Unpooled;
import java.util.Optional;
import net.minecraft.SharedConstants;
import net.minecraft.core.RegistryAccess;
import net.minecraft.core.particles.ExplosionParticleInfo;
import net.minecraft.core.particles.ParticleOptions;
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.network.RegistryFriendlyByteBuf;
import net.minecraft.network.protocol.game.ClientboundExplodePacket;
import net.minecraft.server.Bootstrap;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.util.random.Weighted;
import net.minecraft.util.random.WeightedList;
import net.minecraft.world.phys.Vec3;

public final class DumpExplode26_3 {
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

  private static String particleName(ParticleOptions particle) {
    return BuiltInRegistries.PARTICLE_TYPE.getKey(particle.getType()).toString().replace("minecraft:", "");
  }

  public static void main(String[] args) throws Exception {
    SharedConstants.tryDetectVersion();
    Bootstrap.bootStrap();

    WeightedList<ExplosionParticleInfo> blockParticles = WeightedList.of(
        new Weighted<>(new ExplosionParticleInfo(ParticleTypes.POOF, 1.0f, 1.0f), 3),
        new Weighted<>(new ExplosionParticleInfo(ParticleTypes.SMOKE, 0.5f, 0.25f), 1));
    ClientboundExplodePacket packet = new ClientboundExplodePacket(
        new Vec3(1.5, 64.25, -3.0), 4.0f, 12, Optional.of(new Vec3(0.1, 0.2, 0.3)),
        ParticleTypes.EXPLOSION, SoundEvents.GENERIC_EXPLODE, blockParticles, true);

    RegistryFriendlyByteBuf buf = buffer();
    ClientboundExplodePacket.STREAM_CODEC.encode(buf, packet);
    String packetHex = hex(buf);
    ClientboundExplodePacket readBack = ClientboundExplodePacket.STREAM_CODEC.decode(buf);
    if (buf.readableBytes() != 0) throw new IllegalStateException("explode codec left bytes");

    StringBuilder out = new StringBuilder();
    out.append("{\n");
    out.append("  \"hex\": ").append(json(packetHex)).append(",\n");
    out.append("  \"expected\": {\n");
    out.append("    \"x\": ").append(readBack.center().x).append(",\n");
    out.append("    \"y\": ").append(readBack.center().y).append(",\n");
    out.append("    \"z\": ").append(readBack.center().z).append(",\n");
    out.append("    \"radius\": ").append(readBack.radius()).append(",\n");
    out.append("    \"blockCount\": ").append(readBack.blockCount()).append(",\n");
    Vec3 knockback = readBack.playerKnockback().orElseThrow();
    out.append("    \"knockback\": {\"x\": ").append(knockback.x).append(", \"y\": ").append(knockback.y)
        .append(", \"z\": ").append(knockback.z).append("},\n");
    out.append("    \"particle\": ").append(json(particleName(readBack.explosionParticle()))).append(",\n");
    out.append("    \"sound\": ").append(json(readBack.explosionSound().value().location().toString())).append(",\n");
    out.append("    \"blockParticles\": [");
    for (int i = 0; i < readBack.blockParticles().unwrap().size(); i++) {
      Weighted<ExplosionParticleInfo> entry = readBack.blockParticles().unwrap().get(i);
      ExplosionParticleInfo info = entry.value();
      if (i > 0) out.append(", ");
      out.append("{\"particle\": ").append(json(particleName(info.particle())))
          .append(", \"scaling\": ").append(info.scaling())
          .append(", \"speed\": ").append(info.speed())
          .append(", \"weight\": ").append(entry.weight()).append("}");
    }
    out.append("],\n");
    out.append("    \"playSound\": ").append(readBack.playSound()).append("\n");
    out.append("  }\n");
    out.append("}\n");
    System.out.print(out);
  }
}
