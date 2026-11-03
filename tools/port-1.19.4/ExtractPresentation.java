import java.lang.reflect.*;import java.nio.file.*;import java.util.*;import java.io.*;import com.google.gson.*;
public class ExtractPresentation {
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
  String key=name+"("+String.join(",",Arrays.stream(args).map(ExtractPresentation::original).toArray(String[]::new))+")";
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
  Class<?> registry=c("net.minecraft.core.Registry"),stack=c("net.minecraft.world.item.ItemStack"),item=c("net.minecraft.world.item.Item"),tag=c("net.minecraft.nbt.CompoundTag"),bundle=c("net.minecraft.world.item.BundleItem");
  Object paintings=f(c("net.minecraft.core.registries.BuiltInRegistries"),"PAINTING_VARIANT").get(null);List<Object> variants=new ArrayList<>();
  for(Object v:(Iterable<?>)paintings)variants.add(Map.of("id",m(registry,"getId",Object.class).invoke(paintings,v),"name",m(registry,"getKey",Object.class).invoke(paintings,v).toString(),"width",m(c("net.minecraft.world.entity.decoration.PaintingVariant"),"getWidth").invoke(v),"height",m(c("net.minecraft.world.entity.decoration.PaintingVariant"),"getHeight").invoke(v)));
  Object accessor=f(c("net.minecraft.world.entity.decoration.Painting"),"DATA_PAINTING_VARIANT_ID").get(null);int index=(int)m(c("net.minecraft.network.syncher.EntityDataAccessor"),"getId").invoke(accessor);
  List<Integer> forbidden=new ArrayList<>();Object items=f(c("net.minecraft.core.registries.BuiltInRegistries"),"ITEM").get(null);for(Object value:(Iterable<?>)items)if(!(boolean)m(item,"canFitInsideContainerItems").invoke(value))forbidden.add((int)m(item,"getId",item).invoke(null,value));
  List<Object> cases=new ArrayList<>();
  for(String nbt:List.of("{id:'minecraft:bundle',Count:1b}","{id:'minecraft:stone',Count:10b}","{id:'minecraft:ender_pearl',Count:16b}","{id:'minecraft:diamond_sword',Count:1b}","{id:'minecraft:beehive',Count:1b,tag:{BlockEntityTag:{Bees:[{EntityData:{id:'minecraft:bee'}}]}}}","{id:'minecraft:bundle',Count:1b,tag:{Items:[{id:'minecraft:stone',Count:12b}]}}")){
   Object data=m(c("net.minecraft.nbt.TagParser"),"parseTag",String.class).invoke(null,nbt),value=m(stack,"of",tag).invoke(null,data);cases.add(Map.of("nbt",nbt,"weight",m(bundle,"getWeight",stack).invoke(null,value),"contentWeight",m(bundle,"getContentWeight",stack).invoke(null,value)));
  }
  Files.writeString(Path.of(args[0]),new Gson().toJson(Map.of("paintings",variants,"paintingVariantIndex",index,"bundleForbiddenItems",forbidden,"bundleBarColor",f(bundle,"BAR_COLOR").get(null),"bundleWeightCases",cases)));
 }
}
