import com.mojang.serialization.Codec;import com.mojang.serialization.JsonOps;
import java.lang.reflect.*;import java.nio.file.*;import java.util.*;import java.io.*;import com.google.gson.*;
// Native 1.19.4 runtime tables. Reflection uses official member names and mappings.
public class VerifyAdventure {
 static Map<String,String> classNames=new HashMap<>(),originalNames=new HashMap<>();
 static Map<String,Map<String,String>> methodNames=new HashMap<>(),fieldNames=new HashMap<>();
 static void loadMappings(Path path)throws Exception{
  String owner=null;
  for(String line:Files.readAllLines(path)){
   if(!line.startsWith(" ")&&line.contains(" -> ")){String[] p=line.substring(0,line.length()-1).split(" -> ");owner=p[0];classNames.put(p[0],p[1]);originalNames.put(p[1],p[0]);}
   else if(owner!=null&&line.startsWith("    ")&&line.contains(" -> ")){
    String[] p=line.trim().split(" -> ");String left=p[0].replaceFirst("^(?:[0-9]+:[0-9]+:)+","");int space=left.indexOf(' ');if(space<0)continue;String member=left.substring(space+1);
    if(member.contains("("))methodNames.computeIfAbsent(owner,k->new HashMap<>()).put(member.substring(0,member.indexOf(')')+1),p[1]);
    else fieldNames.computeIfAbsent(owner,k->new HashMap<>()).put(member,p[1]);
   }
  }
 }
 static String original(Class<?> c){return originalNames.getOrDefault(c.getName(),c.getName());}
 static Method m(Class<?> c,String name,Class<?>...args)throws Exception{
  String key=name+"("+String.join(",",Arrays.stream(args).map(VerifyAdventure::original).toArray(String[]::new))+")";
  for(Class<?> k=c;k!=null;k=k.getSuperclass()){
   String alias=methodNames.getOrDefault(original(k),Map.of()).get(key);if(alias==null)continue;
   Method result=k.getDeclaredMethod(alias,args);result.setAccessible(true);return result;
  }
  return c.getMethod(name,args);
 }
 static Field f(Class<?> c,String name)throws Exception{
  for(Class<?> k=c;k!=null;k=k.getSuperclass()){
   String alias=fieldNames.getOrDefault(original(k),Map.of()).get(name);if(alias==null)continue;
   Field result=k.getDeclaredField(alias);result.setAccessible(true);return result;
  }
  return c.getField(name);
 }

 static Class<?> c(String n)throws Exception{return Class.forName(classNames.getOrDefault(n,n));}static Object call(Object o,String n,Class<?>[] t,Object...a)throws Exception{return m(o.getClass(),n,t).invoke(o,a);}
 public static void main(String[] args)throws Exception{
  loadMappings(Path.of(args[0]));m(c("net.minecraft.SharedConstants"),"tryDetectVersion").invoke(null);m(c("net.minecraft.server.Bootstrap"),"bootStrap").invoke(null);
  Class<?> registryClass=c("net.minecraft.core.Registry"),location=c("net.minecraft.resources.ResourceLocation"),posClass=c("net.minecraft.core.BlockPos"),stateClass=c("net.minecraft.world.level.block.state.BlockState"),level=c("net.minecraft.world.level.LevelReader"),entityClass=c("net.minecraft.world.level.block.entity.BlockEntity"),blockClass=c("net.minecraft.world.level.block.Block"),entityBlock=c("net.minecraft.world.level.block.EntityBlock"),compound=c("net.minecraft.nbt.CompoundTag");
  Object registry=f(c("net.minecraft.core.registries.BuiltInRegistries"),"BLOCK").get(null),lookup=m(registryClass,"asLookup").invoke(registry),origin=posClass.getConstructor(int.class,int.class,int.class).newInstance(0,64,0);
  Map<Object,List<Object>> tags=new LinkedHashMap<>();Map<String,List<String>> tagNames=Map.of("minecraft:logs",List.of("minecraft:oak_log","minecraft:spruce_log"),"minecraft:mixed",List.of("minecraft:oak_log","minecraft:stone"),"minecraft:empty",List.of());
  for(var e:tagNames.entrySet()){
   Object key=m(c("net.minecraft.tags.TagKey"),"create",c("net.minecraft.resources.ResourceKey"),location).invoke(null,m(registryClass,"key").invoke(registry),location.getConstructor(String.class).newInstance(e.getKey()));List<Object> holders=new ArrayList<>();
   for(String name:e.getValue()){Object block=m(registryClass,"get",location).invoke(registry,location.getConstructor(String.class).newInstance(name));holders.add(m(registryClass,"wrapAsHolder",Object.class).invoke(registry,block));}tags.put(key,holders);
  }m(registryClass,"bindTags",Map.class).invoke(registry,tags);
  JsonArray input=JsonParser.parseString(Files.readString(Path.of(args[1]))).getAsJsonArray();List<Object> output=new ArrayList<>();
  for(JsonElement entry:input){JsonObject row=entry.getAsJsonObject();String stateText=row.get("state").getAsString(),predicate=row.get("predicate").getAsString();
   Object result=m(c("net.minecraft.commands.arguments.blocks.BlockStateParser"),"parseForBlock",c("net.minecraft.core.HolderLookup"),String.class,boolean.class).invoke(null,lookup,stateText,true),state=m(c("net.minecraft.commands.arguments.blocks.BlockStateParser$BlockResult"),"blockState").invoke(result);
   Object block=m(stateClass,"getBlock").invoke(state),entity=null;
   if(entityBlock.isInstance(block)){entity=m(entityBlock,"newBlockEntity",posClass,stateClass).invoke(block,origin,state);if(row.has("load"))m(entityClass,"load",compound).invoke(entity,m(c("net.minecraft.nbt.TagParser"),"parseTag",String.class).invoke(null,row.get("load").getAsString()));}
   final Object currentEntity=entity,currentState=state;
   Object world=Proxy.newProxyInstance(level.getClassLoader(),new Class[]{level},(o,method,a)->{
    if(method.getReturnType()==stateClass)return currentState;if(method.getReturnType()==entityClass)return currentEntity;if(method.getReturnType()==boolean.class)return true;if(method.getReturnType()==int.class)return 0;return null;
   });Object context=c("net.minecraft.world.level.block.state.pattern.BlockInWorld").getConstructor(level,posClass,boolean.class).newInstance(world,origin,false);
   boolean matched=false;String error=null;
   try{Object parsed=m(c("net.minecraft.commands.arguments.blocks.BlockPredicateArgument"),"parse",c("net.minecraft.core.HolderLookup"),c("com.mojang.brigadier.StringReader")).invoke(null,lookup,c("com.mojang.brigadier.StringReader").getConstructor(String.class).newInstance(predicate));matched=((java.util.function.Predicate<Object>)parsed).test(context);}catch(InvocationTargetException e){error=e.getCause().getClass().getName();}
   Map<String,Object> out=new LinkedHashMap<>();out.put("state",stateText);out.put("predicate",predicate);out.put("matched",matched);if(error!=null)out.put("error",error);if(entity!=null)out.put("blockEntityNbt",m(entityClass,"saveWithFullMetadata").invoke(entity).toString());output.add(out);
  }Files.writeString(Path.of(args[2]),new GsonBuilder().setPrettyPrinting().disableHtmlEscaping().create().toJson(Map.of("version","1.19.4","clientJarSha1","958928a560c9167687bea0cefeb7375da1e552a8","tags",tagNames,"cases",output))+"\n");
 }
}
