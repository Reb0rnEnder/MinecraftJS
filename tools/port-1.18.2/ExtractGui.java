import com.mojang.serialization.Codec;import com.mojang.serialization.JsonOps;
import java.lang.reflect.*;import java.nio.file.*;import java.util.*;import java.io.*;import com.google.gson.*;
// Native 1.18.2 runtime tables. Reflection uses official member names and mappings.
public class ExtractGui {
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
  String key=name+"("+String.join(",",Arrays.stream(args).map(ExtractGui::original).toArray(String[]::new))+")";
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
  loadMappings(Path.of(args[1]));m(c("net.minecraft.SharedConstants"),"tryDetectVersion").invoke(null);m(c("net.minecraft.server.Bootstrap"),"bootStrap").invoke(null);
  Map<String,Object> output=new LinkedHashMap<>();
  for(String[] entry:new String[][]{{"videoOptions","net.minecraft.client.gui.screens.VideoSettingsScreen","OPTIONS"},{"chatOptions","net.minecraft.client.gui.screens.ChatOptionsScreen","CHAT_OPTIONS"},{"accessibilityOptions","net.minecraft.client.gui.screens.AccessibilityOptionsScreen","OPTIONS"},{"mouseOptions","net.minecraft.client.gui.screens.MouseSettingsScreen","OPTIONS"}}){
   List<String> captions=new ArrayList<>();for(Object option:(Object[])f(c(entry[1]),entry[2]).get(null)){Object caption=m(c("net.minecraft.client.Option"),"getCaption").invoke(option);captions.add((String)m(c("net.minecraft.network.chat.TranslatableComponent"),"getKey").invoke(caption));}output.put(entry[0],captions);
  }Files.writeString(Path.of(args[0]),new Gson().toJson(output));
 }
}
