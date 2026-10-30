import com.mojang.serialization.Codec;import com.mojang.serialization.JsonOps;
import java.lang.reflect.*;import java.nio.file.*;import java.util.*;import java.io.*;import com.google.gson.*;
// Native 1.18.2 runtime tables. Reflection uses official member names and mappings.
public class ExtractLayers {
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
  String key=name+"("+String.join(",",Arrays.stream(args).map(ExtractLayers::original).toArray(String[]::new))+")";
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

 static List<Float> vector(Object value)throws Exception{List<Float> out=new ArrayList<>();for(String key:new String[]{"x","y","z"})out.add(((Number)f(value.getClass(),key).get(value)).floatValue());return out;}
 static List<Object> parts;static IdentityHashMap<Object,Integer> ids;
 static int part(Object value)throws Exception{
  if(ids.containsKey(value))return ids.get(value);int id=parts.size();ids.put(value,id);Map<String,Object> result=new LinkedHashMap<>();parts.add(result);
  result.put("tw",1);result.put("th",1);List<Object> position=new ArrayList<>(),rotation=new ArrayList<>();for(String key:new String[]{"x","y","z"})position.add(f(value.getClass(),key).get(value));for(String key:new String[]{"xRot","yRot","zRot"})rotation.add(f(value.getClass(),key).get(value));result.put("p",position);result.put("r",rotation);result.put("mirror",false);result.put("show",f(value.getClass(),"visible").get(value));
  List<Object> cubes=new ArrayList<>();for(Object cube:(List<?>)f(value.getClass(),"cubes").get(value)){
   List<Float> quads=new ArrayList<>();for(Object polygon:(Object[])f(cube.getClass(),"polygons").get(cube)){List<Float> normal=vector(f(polygon.getClass(),"normal").get(polygon));for(Object vertex:(Object[])f(polygon.getClass(),"vertices").get(polygon)){quads.addAll(vector(f(vertex.getClass(),"pos").get(vertex)));quads.add(((Number)f(vertex.getClass(),"u").get(vertex)).floatValue());quads.add(((Number)f(vertex.getClass(),"v").get(vertex)).floatValue());quads.addAll(normal);}}
   double x=((Number)f(cube.getClass(),"minX").get(cube)).doubleValue(),y=((Number)f(cube.getClass(),"minY").get(cube)).doubleValue(),z=((Number)f(cube.getClass(),"minZ").get(cube)).doubleValue();cubes.add(Arrays.asList(0,0,x,y,z,((Number)f(cube.getClass(),"maxX").get(cube)).doubleValue()-x,((Number)f(cube.getClass(),"maxY").get(cube)).doubleValue()-y,((Number)f(cube.getClass(),"maxZ").get(cube)).doubleValue()-z,0,false,quads));
  }result.put("boxes",cubes);
  Map<String,Integer> children=new LinkedHashMap<>();for(Map.Entry<?,?> entry:((Map<?,?>)f(value.getClass(),"children").get(value)).entrySet())children.put(entry.getKey().toString(),part(entry.getValue()));result.put("children",new ArrayList<>(children.values()));result.put("namedChildren",children);return id;
 }
 public static void main(String[]args)throws Exception{
  loadMappings(Path.of(args[1]));m(c("net.minecraft.SharedConstants"),"tryDetectVersion").invoke(null);m(c("net.minecraft.server.Bootstrap"),"bootStrap").invoke(null);
  Map<?,?> definitions=(Map<?,?>)m(c("net.minecraft.client.model.geom.LayerDefinitions"),"createRoots").invoke(null);Map<String,Object> output=new LinkedHashMap<>();
  for(Map.Entry<?,?> entry:definitions.entrySet()){Object root=m(c("net.minecraft.client.model.geom.builders.LayerDefinition"),"bakeRoot").invoke(entry.getValue());parts=new ArrayList<>();ids=new IdentityHashMap<>();int index=part(root);output.put(entry.getKey().toString(),Map.of("root",index,"parts",parts));}
  Files.writeString(Path.of(args[0]),new Gson().toJson(output));System.out.println("Extracted native model layers: "+output.size());
 }
}
