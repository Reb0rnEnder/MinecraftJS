import java.nio.file.*;import java.util.*;import java.lang.reflect.*;import com.google.gson.*;import com.mojang.serialization.*;
// Calls native sign frame transforms and chain visibility, without constructing
// a renderer context, window, world or graphics backend.
public class ExtractSignTransforms1206 extends ExtractCreative1206 {
 public static void main(String[] args)throws Exception{
  loadMappings(Path.of(args[1]));m(c("net.minecraft.SharedConstants"),"tryDetectVersion").invoke(null);m(c("net.minecraft.server.Bootstrap"),"bootStrap").invoke(null);
  Field unsafeField=sun.misc.Unsafe.class.getDeclaredField("theUnsafe");unsafeField.setAccessible(true);sun.misc.Unsafe unsafe=(sun.misc.Unsafe)unsafeField.get(null);List<Object> samples=new ArrayList<>();
  for(JsonElement input:JsonParser.parseString(Files.readString(Path.of(args[2]))).getAsJsonArray()){
   JsonObject e=input.getAsJsonObject();int id=e.get("state").getAsInt();Object state=m(c("net.minecraft.world.level.block.Block"),"stateById",int.class).invoke(null,id),block=call(state,"getBlock",new Class<?>[]{});boolean hanging=c("net.minecraft.world.level.block.CeilingHangingSignBlock").isInstance(block)||c("net.minecraft.world.level.block.WallHangingSignBlock").isInstance(block);
   Class<?> renderer=c(hanging?"net.minecraft.client.renderer.blockentity.HangingSignRenderer":"net.minecraft.client.renderer.blockentity.SignRenderer");Object r=unsafe.allocateInstance(renderer),pose=c("com.mojang.blaze3d.vertex.PoseStack").getConstructor().newInstance();float rotation=-((Number)m(c("net.minecraft.world.level.block.SignBlock"),"getYRotationDegrees",c("net.minecraft.world.level.block.state.BlockState")).invoke(block,state)).floatValue();
   m(renderer,"translateSign",pose.getClass(),float.class,c("net.minecraft.world.level.block.state.BlockState")).invoke(r,pose,rotation,state);Object last=call(pose,"last",new Class<?>[]{}),matrix=call(last,"pose",new Class<?>[]{});float[] transform=new float[16];matrix.getClass().getMethod("get",float[].class).invoke(matrix,(Object)transform);
   Map<String,Object> out=new TreeMap<>();out.put("label",e.get("label").getAsString());out.put("state",id);out.put("transform",transform);out.put("modelScale",call(r,"getSignModelRenderScale",new Class<?>[]{}));out.put("textScale",call(r,"getSignTextRenderScale",new Class<?>[]{}));Object offset=call(r,"getTextOffset",new Class<?>[]{});out.put("textOffset",List.of(f(offset.getClass(),"x").get(offset),f(offset.getClass(),"y").get(offset),f(offset.getClass(),"z").get(offset)));
   if(hanging){Object layer=m(renderer,"createHangingSignLayer").invoke(null),root=call(layer,"bakeRoot",new Class<?>[]{});Class<?> model=c("net.minecraft.client.renderer.blockentity.HangingSignRenderer$HangingSignModel");Object sign=model.getConstructor(c("net.minecraft.client.model.geom.ModelPart")).newInstance(root);m(model,"evaluateVisibleParts",state.getClass()).invoke(sign,state);Map<String,Object> visible=new TreeMap<>();for(String key:List.of("plank","vChains","normalChains"))visible.put(key,f(c("net.minecraft.client.model.geom.ModelPart"),"visible").get(f(model,key).get(sign)));out.put("visible",visible);}
   samples.add(out);
  }
  Codec textCodec=(Codec)f(c("net.minecraft.world.level.block.entity.SignText"),"DIRECT_CODEC").get(null);
  JsonObject textInput=new JsonObject();JsonArray messages=new JsonArray();messages.add("{\"text\":\"Zażółć \\\"test\\\"\",\"bold\":true}");messages.add("\"back\"");messages.add("\"\"");messages.add("\"\"");textInput.add("messages",messages);textInput.addProperty("color","red");textInput.addProperty("has_glowing_text",true);Object signText=textCodec.parse(JsonOps.INSTANCE,textInput).getOrThrow();
  Files.writeString(Path.of(args[0]),new Gson().toJson(Map.of("samples",samples,"signText",textCodec.encodeStart(JsonOps.INSTANCE,signText).getOrThrow())));
 }
}
