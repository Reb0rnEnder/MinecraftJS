import com.mojang.serialization.Codec;import com.mojang.serialization.JsonOps;
import java.lang.reflect.*;import java.nio.file.*;import java.util.*;import java.io.*;import com.google.gson.*;
// Native 1.19.4 runtime tables. Reflection uses official member names and mappings.
public class SampleAnimations {
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
  String key=name+"("+String.join(",",Arrays.stream(args).map(SampleAnimations::original).toArray(String[]::new))+")";
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
 static List<Double> box(Object b)throws Exception{List<Double> v=new ArrayList<>();for(String n:new String[]{"minX","minY","minZ","maxX","maxY","maxZ"})v.add(f(b.getClass(),n).getDouble(b));return v;}
 static Set<Object> blockTag(String id,Object registry,Map<String,Set<Object>> memo)throws Exception{
  if(memo.containsKey(id))return memo.get(id);Set<Object> values=new LinkedHashSet<>();memo.put(id,values);
  String[] key=id.split(":",2);String name="data/"+key[0]+"/tags/blocks/"+key[1]+".json";
  InputStream resource=SampleAnimations.class.getClassLoader().getResourceAsStream(name);
  if(resource==null)resource=SampleAnimations.class.getClassLoader().getResourceAsStream("data/minecraft/datapacks/update_1_20/"+name);
  try(InputStream input=resource){
   if(input==null)throw new FileNotFoundException(name);JsonObject definition=new JsonParser().parse(new InputStreamReader(input,java.nio.charset.StandardCharsets.UTF_8)).getAsJsonObject();
   for(JsonElement el:definition.getAsJsonArray("values")){String value=el.isJsonObject()?el.getAsJsonObject().get("id").getAsString():el.getAsString();if(value.startsWith("#"))values.addAll(blockTag(value.substring(1),registry,memo));else values.add(m(c("net.minecraft.core.Registry"),"get",c("net.minecraft.resources.ResourceLocation")).invoke(registry,c("net.minecraft.resources.ResourceLocation").getConstructor(String.class).newInstance(value)));}
  }return values;
 }
 public static void main(String[] args)throws Exception{
  loadMappings(Path.of(args[1]));m(c("net.minecraft.SharedConstants"),"tryDetectVersion").invoke(null);m(c("net.minecraft.server.Bootstrap"),"bootStrap").invoke(null);
  Map<?,?> layers=(Map<?,?>)m(c("net.minecraft.client.model.geom.LayerDefinitions"),"createRoots").invoke(null);Class<?> part=c("net.minecraft.client.model.geom.ModelPart"),hierarchical=c("net.minecraft.client.model.HierarchicalModel"),definition=c("net.minecraft.client.animation.AnimationDefinition");List<Object> samples=new ArrayList<>();
  for(String family:new String[]{"Frog","Warden","Camel","Sniffer"}){
   Object layer=layers.entrySet().stream().filter(e->e.getKey().toString().equals("minecraft:"+family.toLowerCase(Locale.ROOT)+"#main")).findFirst().orElseThrow().getValue();Object root=m(c("net.minecraft.client.model.geom.builders.LayerDefinition"),"bakeRoot").invoke(layer),model=c("net.minecraft.client.model."+family+"Model").getConstructor(part).newInstance(root),modelRoot=m(hierarchical,"root").invoke(model);Class<?> defs=c("net.minecraft.client.animation.definitions."+family+"Animation");
   for(Map.Entry<String,String> entry:fieldNames.get(original(defs)).entrySet()){
    Field field=defs.getDeclaredField(entry.getValue());if(field.getType()!=definition)continue;field.setAccessible(true);Object animation=field.get(null);Map<?,?> bones=(Map<?,?>)m(definition,"boneAnimations").invoke(animation);
    for(long time:new long[]{123,1789}){
     for(Object p:((java.util.stream.Stream<?>)m(part,"getAllParts").invoke(modelRoot)).toList())m(part,"resetPose").invoke(p);
     m(c("net.minecraft.client.animation.KeyframeAnimations"),"animate",hierarchical,definition,long.class,float.class,c("org.joml.Vector3f")).invoke(null,model,animation,time,.75f,c("org.joml.Vector3f").getConstructor().newInstance());
     Map<String,Object> poses=new LinkedHashMap<>();for(Object bone:bones.keySet()){
      Optional<?> found=(Optional<?>)m(hierarchical,"getAnyDescendantWithName",String.class).invoke(model,bone.toString());if(found.isEmpty())continue;Object p=found.get();List<Float> values=new ArrayList<>();for(String key:new String[]{"x","y","z","xRot","yRot","zRot","xScale","yScale","zScale"})values.add(f(part,key).getFloat(p));poses.put(bone.toString(),values);
     }samples.add(Map.of("family",family.toLowerCase(Locale.ROOT),"clip",entry.getKey(),"millis",time,"weight",.75,"parts",poses));
    }
   }
  }Files.writeString(Path.of(args[0]),new Gson().toJson(Map.of("version","1.19.4","clientJarSha1","958928a560c9167687bea0cefeb7375da1e552a8","samples",samples)));System.out.println("Native keyframe pose samples: "+samples.size());
 }
}
