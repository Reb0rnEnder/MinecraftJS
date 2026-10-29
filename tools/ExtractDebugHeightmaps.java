import java.lang.reflect.*;import java.nio.file.*;import java.util.*;
// Runs native heightmap predicates using the target official mappings.
public class ExtractDebugHeightmaps {
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
  String key=name+"("+String.join(",",Arrays.stream(args).map(ExtractDebugHeightmaps::original).toArray(String[]::new))+")";
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
 public static void main(String[] args)throws Exception {
  loadMappings(Path.of(args[1]));
  if(classNames.containsKey("net.minecraft.SharedConstants")){try{m(c("net.minecraft.SharedConstants"),"tryDetectVersion").invoke(null);}catch(NoSuchMethodException ignored){}}
  m(c("net.minecraft.server.Bootstrap"),"bootStrap").invoke(null);
  Class<?> types=c("net.minecraft.world.level.levelgen.Heightmap$Types");
  String[] names={"WORLD_SURFACE","OCEAN_FLOOR","MOTION_BLOCKING","MOTION_BLOCKING_NO_LEAVES"};
  List<java.util.function.Predicate<Object>> predicates=new ArrayList<>();
  for(String name:names)predicates.add((java.util.function.Predicate<Object>)m(types,"isOpaque").invoke(f(types,name).get(null)));
  Method get=m(c("net.minecraft.world.level.block.Block"),"stateById",int.class);StringBuilder masks=new StringBuilder();
  for(int i=0;i<Integer.parseInt(args[2]);i++){Object state=get.invoke(null,i);int mask=0;for(int b=0;b<4;b++)if(predicates.get(b).test(state))mask|=1<<b;masks.append(Integer.toHexString(mask));}
  Files.writeString(Path.of(args[0]),masks.toString());
 }
}
