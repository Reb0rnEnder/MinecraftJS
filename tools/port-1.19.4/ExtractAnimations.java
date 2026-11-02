import com.mojang.serialization.Codec;import com.mojang.serialization.JsonOps;
import java.lang.reflect.*;import java.nio.file.*;import java.util.*;import java.io.*;import com.google.gson.*;
// Native 1.19.4 runtime tables. Reflection uses official member names and mappings.
public class ExtractAnimations {
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
  String key=name+"("+String.join(",",Arrays.stream(args).map(ExtractAnimations::original).toArray(String[]::new))+")";
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
  InputStream resource=ExtractAnimations.class.getClassLoader().getResourceAsStream(name);
  if(resource==null)resource=ExtractAnimations.class.getClassLoader().getResourceAsStream("data/minecraft/datapacks/update_1_20/"+name);
  try(InputStream input=resource){
   if(input==null)throw new FileNotFoundException(name);JsonObject definition=new JsonParser().parse(new InputStreamReader(input,java.nio.charset.StandardCharsets.UTF_8)).getAsJsonObject();
   for(JsonElement el:definition.getAsJsonArray("values")){String value=el.isJsonObject()?el.getAsJsonObject().get("id").getAsString():el.getAsString();if(value.startsWith("#"))values.addAll(blockTag(value.substring(1),registry,memo));else values.add(m(c("net.minecraft.core.Registry"),"get",c("net.minecraft.resources.ResourceLocation")).invoke(registry,c("net.minecraft.resources.ResourceLocation").getConstructor(String.class).newInstance(value)));}
  }return values;
 }
 public static void main(String[] args)throws Exception{
  loadMappings(Path.of(args[1]));m(c("net.minecraft.SharedConstants"),"tryDetectVersion").invoke(null);m(c("net.minecraft.server.Bootstrap"),"bootStrap").invoke(null);
  Class<?> definition=c("net.minecraft.client.animation.AnimationDefinition"),channel=c("net.minecraft.client.animation.AnimationChannel"),keyframe=c("net.minecraft.client.animation.Keyframe"),targets=c("net.minecraft.client.animation.AnimationChannel$Targets"),interpolations=c("net.minecraft.client.animation.AnimationChannel$Interpolations");
  Map<Object,String> targetNames=new IdentityHashMap<>(),interpolationNames=new IdentityHashMap<>();for(String n:new String[]{"POSITION","ROTATION","SCALE"})targetNames.put(f(targets,n).get(null),n.toLowerCase(Locale.ROOT));for(String n:new String[]{"LINEAR","CATMULLROM"})interpolationNames.put(f(interpolations,n).get(null),n.toLowerCase(Locale.ROOT));
  Map<String,Object> result=new LinkedHashMap<>();
  for(String model:new String[]{"Frog","Warden","Camel","Sniffer"}){
   String owner="net.minecraft.client.animation.definitions."+model+"Animation";Class<?> cls=c(owner);Map<String,Object> animations=new LinkedHashMap<>();
   for(Map.Entry<String,String> entry:fieldNames.get(owner).entrySet()){
    Field field=cls.getDeclaredField(entry.getValue());if(field.getType()!=definition)continue;field.setAccessible(true);Object animation=field.get(null);Map<String,Object> bones=new LinkedHashMap<>();
    for(Map.Entry<?,?> bone:((Map<?,?>)m(definition,"boneAnimations").invoke(animation)).entrySet()){
     List<Object> channels=new ArrayList<>();for(Object ch:(List<?>)bone.getValue()){
      List<Object> frames=new ArrayList<>();for(Object frame:(Object[])m(channel,"keyframes").invoke(ch)){
       Object vector=m(keyframe,"target").invoke(frame);List<Float> xyz=new ArrayList<>();for(String n:new String[]{"x","y","z"})xyz.add(f(vector.getClass(),n).getFloat(vector));String interpolation=interpolationNames.get(m(keyframe,"interpolation").invoke(frame));if(interpolation==null)throw new IllegalStateException("Unmapped interpolation");frames.add(Arrays.asList(m(keyframe,"timestamp").invoke(frame),xyz,interpolation));
      }String target=targetNames.get(m(channel,"target").invoke(ch));if(target==null)throw new IllegalStateException("Unmapped animation target");channels.add(Map.of("target",target,"frames",frames));
     }bones.put(bone.getKey().toString(),channels);
    }animations.put(entry.getKey(),Map.of("length",m(definition,"lengthInSeconds").invoke(animation),"looping",m(definition,"looping").invoke(animation),"bones",bones));
   }result.put(model.toLowerCase(Locale.ROOT),animations);
  }Files.writeString(Path.of(args[0]),new Gson().toJson(result));System.out.println("Extracted native keyframe animation families: "+result.size());
 }
}
