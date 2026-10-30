
import java.lang.reflect.*;import java.nio.file.*;import java.util.*;import java.io.*;import com.google.gson.*;
// Executes ItemBlockRenderTypes from each pinned client, without a graphics context.
public class ExtractRenderLayers {
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
  String key=name+"("+String.join(",",Arrays.stream(args).map(ExtractRenderLayers::original).toArray(String[]::new))+")";
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
 public static void main(String[] args)throws Exception{
  loadMappings(Path.of(args[0]));if(methodNames.getOrDefault("net.minecraft.SharedConstants",Map.of()).containsKey("tryDetectVersion()"))m(c("net.minecraft.SharedConstants"),"tryDetectVersion").invoke(null);m(c("net.minecraft.server.Bootstrap"),"bootStrap").invoke(null);
  Class<?> block=c("net.minecraft.world.level.block.Block"),state=c("net.minecraft.world.level.block.state.BlockState"),lookup=c("net.minecraft.client.renderer.ItemBlockRenderTypes"),type=c("net.minecraft.client.renderer.RenderType");
  Map<Object,String> names=new IdentityHashMap<>();
  for(String name:new String[]{"solid","cutoutMipped","cutout","translucent","tripwire"})if(methodNames.getOrDefault(original(type),Map.of()).containsKey(name+"()"))names.put(m(type,name).invoke(null),name);
  m(lookup,"setFancy",boolean.class).invoke(null,true);
  JsonArray definitions=new JsonParser().parse(Files.readString(Path.of(args[1]))).getAsJsonArray();Map<String,String> layers=new LinkedHashMap<>();
  for(JsonElement row:definitions){JsonObject def=row.getAsJsonObject();Object s=m(block,"stateById",int.class).invoke(null,def.get("defaultState").getAsInt());Object layer=m(lookup,"getChunkRenderType",state).invoke(null,s);String name=names.get(layer);if(name==null)throw new IllegalStateException("Unmapped render layer: "+layer);layers.put(def.get("name").getAsString(),name);}
  Files.writeString(Path.of(args[2]),new Gson().toJson(layers));System.err.println("Native block render layers: "+layers.size());
 }
}
