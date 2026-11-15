import java.nio.file.*;import java.util.*;import com.google.gson.*;import com.mojang.serialization.*;
public class ExtractBannerStacks1206 extends ExtractCreative1206 {
 public static void main(String[] args)throws Exception{
  loadMappings(Path.of(args[1]));m(c("net.minecraft.SharedConstants"),"tryDetectVersion").invoke(null);m(c("net.minecraft.server.Bootstrap"),"bootStrap").invoke(null);Object lookup=m(c("net.minecraft.data.registries.VanillaRegistries"),"createLookup").invoke(null);stackRegistries=registryAccess(lookup,Path.of(args[2]));Object ops=m(c("net.minecraft.resources.RegistryOps"),"create",DynamicOps.class,c("net.minecraft.core.HolderLookup$Provider")).invoke(null,JsonOps.INSTANCE,lookup);Codec codec=(Codec)f(c("net.minecraft.world.item.ItemStack"),"CODEC").get(null);List<Object> out=new ArrayList<>();
  for(JsonElement input:JsonParser.parseString(Files.readString(Path.of(args[3]))).getAsJsonArray()){
   JsonObject entry=input.getAsJsonObject();Object stack=codec.parse((DynamicOps)ops,entry.get("stack")).getOrThrow(),patterns=m(c("net.minecraft.core.component.DataComponentHolder"),"get",c("net.minecraft.core.component.DataComponentType")).invoke(stack,f(c("net.minecraft.core.component.DataComponents"),"BANNER_PATTERNS").get(null));List<Object> layers=new ArrayList<>();
   for(Object layer:(List<?>)call(patterns,"layers",new Class<?>[]{})){Object holder=call(layer,"pattern",new Class<?>[]{}),pattern=call(holder,"value",new Class<?>[]{}),color=call(layer,"color",new Class<?>[]{});layers.add(Map.of("asset",call(pattern,"assetId",new Class<?>[]{}).toString(),"dye",call(color,"getId",new Class<?>[]{})));}
   out.add(Map.of("label",entry.get("label").getAsString(),"wire",stack((cur)stack,lookup),"layers",layers));
  }
  Files.writeString(Path.of(args[0]),new Gson().toJson(out));
 }
}
