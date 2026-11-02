import org.joml.Matrix4f;import org.joml.Matrix3f;
import com.mojang.serialization.Codec;import com.mojang.serialization.JsonOps;
import java.lang.reflect.*;import java.nio.file.*;import java.util.*;import java.io.*;import com.google.gson.*;
// Native 1.19.4 runtime tables. Reflection uses official member names and mappings.
public class ExtractDecal {
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
  String key=name+"("+String.join(",",Arrays.stream(args).map(ExtractDecal::original).toArray(String[]::new))+")";
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
  InputStream resource=ExtractDecal.class.getClassLoader().getResourceAsStream(name);
  if(resource==null)resource=ExtractDecal.class.getClassLoader().getResourceAsStream("data/minecraft/datapacks/update_1_20/"+name);
  try(InputStream input=resource){
   if(input==null)throw new FileNotFoundException(name);JsonObject definition=new JsonParser().parse(new InputStreamReader(input,java.nio.charset.StandardCharsets.UTF_8)).getAsJsonObject();
   for(JsonElement el:definition.getAsJsonArray("values")){String value=el.isJsonObject()?el.getAsJsonObject().get("id").getAsString():el.getAsString();if(value.startsWith("#"))values.addAll(blockTag(value.substring(1),registry,memo));else values.add(m(c("net.minecraft.core.Registry"),"get",c("net.minecraft.resources.ResourceLocation")).invoke(registry,c("net.minecraft.resources.ResourceLocation").getConstructor(String.class).newInstance(value)));}
  }return values;
 }
 public static void main(String[] args)throws Exception{
  loadMappings(Path.of(args[1]));Class<?> vertex=c("com.mojang.blaze3d.vertex.VertexConsumer"),decal=c("com.mojang.blaze3d.vertex.SheetedDecalTextureGenerator");
  List<Object> result=new ArrayList<>();double[][] normals={{0,-1,0},{0,1,0},{0,0,-1},{0,0,1},{-1,0,0},{1,0,0}},positions={{1,0,0},{0,1,0},{0,0,1},{.125,.75,-.375}};
  for(double[] normal:normals)for(double[] position:positions){float[] uv=new float[2];Object consumer=Proxy.newProxyInstance(vertex.getClassLoader(),new Class[]{vertex},(proxy,method,values)->{if(method.getName().equals(m(vertex,"uv",float.class,float.class).getName())&&Arrays.equals(method.getParameterTypes(),new Class[]{float.class,float.class})){uv[0]=(float)values[0];uv[1]=(float)values[1];}return method.getReturnType()==void.class?null:proxy;});
   Object generator=decal.getConstructor(vertex,Matrix4f.class,Matrix3f.class,float.class).newInstance(consumer,new Matrix4f(),new Matrix3f(),1f);
   m(vertex,"vertex",double.class,double.class,double.class).invoke(generator,position[0],position[1],position[2]);m(vertex,"normal",float.class,float.class,float.class).invoke(generator,(float)normal[0],(float)normal[1],(float)normal[2]);m(vertex,"endVertex").invoke(generator);result.add(Map.of("position",position,"normal",normal,"uv",uv));
  }Files.writeString(Path.of(args[0]),new Gson().toJson(Map.of("version","1.19.4","samples",result)));System.out.println("Native decal samples: "+result.size());
 }
}
