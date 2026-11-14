import java.nio.file.*;import java.lang.reflect.*;import java.util.*;import java.util.function.*;import com.google.gson.*;import io.netty.buffer.*;
// Decode and re-encode through the actual complete native protocol dispatch,
// not an independent copy of the JS schema or mocked packet constructors.
public class PacketRoundtrip1206 extends ExtractCreative1206 {
 public static void main(String[] args)throws Exception{
  loadMappings(Path.of(args[1]));m(c("net.minecraft.SharedConstants"),"tryDetectVersion").invoke(null);m(c("net.minecraft.server.Bootstrap"),"bootStrap").invoke(null);
  Object lookup=taggedLookup(m(c("net.minecraft.data.registries.VanillaRegistries"),"createLookup").invoke(null));stackRegistries=registryAccess(lookup,Path.of(args[2]));
  Map<String,Object> codecs=new HashMap<>();
  for(String direction:new String[]{"CLIENTBOUND","SERVERBOUND"}){
   Object unbound=f(c("net.minecraft.network.protocol.game.GameProtocols"),direction).get(null);
   Function<ByteBuf,xa> wrapper=bytes->new xa(bytes,stackRegistries);
   Object info=m(c("net.minecraft.network.ProtocolInfo$Unbound"),"bind",Function.class).invoke(unbound,wrapper);
   codecs.put(direction,m(c("net.minecraft.network.ProtocolInfo"),"codec").invoke(info));
  }
  List<Object> results=new ArrayList<>();
  for(JsonElement input:JsonParser.parseString(Files.readString(Path.of(args[3]))).getAsJsonArray()){
   JsonObject entry=input.getAsJsonObject();Map<String,Object> row=new TreeMap<>();row.put("label",entry.get("label").getAsString());
   ByteBuf bytes=Unpooled.wrappedBuffer(Base64.getDecoder().decode(entry.get("wire").getAsString())),encoded=Unpooled.buffer();
   try{
    Object codec=codecs.get(entry.get("direction").getAsString());
    Object packet=m(c("net.minecraft.network.codec.StreamDecoder"),"decode",Object.class).invoke(codec,bytes);
    row.put("remaining",bytes.readableBytes());row.put("nativeType",m(c("net.minecraft.network.protocol.Packet"),"type").invoke(packet).toString());
    m(c("net.minecraft.network.codec.StreamEncoder"),"encode",Object.class,Object.class).invoke(codec,encoded,packet);byte[] output=new byte[encoded.readableBytes()];encoded.getBytes(encoded.readerIndex(),output);row.put("wire",Base64.getEncoder().encodeToString(output));
   }catch(Throwable error){Throwable cause=error;while(cause.getCause()!=null)cause=cause.getCause();row.put("error",cause.getClass().getSimpleName()+": "+cause.getMessage());row.put("remaining",bytes.readableBytes());}
   finally{bytes.release();encoded.release();}
   results.add(row);
  }
  Files.writeString(Path.of(args[0]),new GsonBuilder().disableHtmlEscaping().create().toJson(results));
 }
}
