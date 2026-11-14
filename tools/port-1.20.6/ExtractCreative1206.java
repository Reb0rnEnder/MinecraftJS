import com.mojang.serialization.Lifecycle;
import java.lang.reflect.*;import java.nio.file.*;import java.util.*;import java.io.*;import com.google.gson.*;
import io.netty.buffer.ByteBuf;import io.netty.buffer.Unpooled;
// Exact native creative population; stacks use the target's real network codec.
public class ExtractCreative1206 {
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
  String key=name+"("+String.join(",",Arrays.stream(args).map(ExtractCreative1206::original).toArray(String[]::new))+")";
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

 // VanillaRegistries is a construction lookup: its deferred tags cannot be
 // dereferenced. Creative generation needs the exact shipped instrument and
 // painting tags, so bind those from the pinned jar, preserving native holders.
 static Map<Object,List<Object>> holderTags=new IdentityHashMap<>();
 static Object tag(Object lookup,Object key,Map<Object,Object> cache)throws Exception{
  if(cache.containsKey(key))return cache.get(key);
  Object registry=m(c("net.minecraft.tags.TagKey"),"registry").invoke(key),loc=m(c("net.minecraft.tags.TagKey"),"location").invoke(key);
  String type=m(c("net.minecraft.resources.ResourceKey"),"location").invoke(registry).toString().split(":",2)[1];
  String[] path=loc.toString().split(":",2);String resource="data/"+path[0]+"/tags/"+type+"/"+path[1]+".json";
  InputStream input=ExtractCreative1206.class.getClassLoader().getResourceAsStream(resource);if(input==null)throw new FileNotFoundException(resource);
  LinkedHashSet<Object> holders=new LinkedHashSet<>();
  try(Reader reader=new InputStreamReader(input,java.nio.charset.StandardCharsets.UTF_8)){
   for(JsonElement entry:JsonParser.parseReader(reader).getAsJsonObject().getAsJsonArray("values")){
    String name=entry.isJsonObject()?entry.getAsJsonObject().get("id").getAsString():entry.getAsString();
    Object id=c("net.minecraft.resources.ResourceLocation").getConstructor(String.class).newInstance(name.startsWith("#")?name.substring(1):name);
    if(name.startsWith("#")){
     Object nested=m(c("net.minecraft.tags.TagKey"),"create",c("net.minecraft.resources.ResourceKey"),c("net.minecraft.resources.ResourceLocation")).invoke(null,registry,id);
     for(Object holder:(Iterable<?>)tag(lookup,nested,cache))holders.add(holder);
    }else{
     Object itemKey=m(c("net.minecraft.resources.ResourceKey"),"create",c("net.minecraft.resources.ResourceKey"),c("net.minecraft.resources.ResourceLocation")).invoke(null,registry,id);
     holders.add(m(c("net.minecraft.core.HolderGetter"),"getOrThrow",c("net.minecraft.resources.ResourceKey")).invoke(lookup,itemKey));
    }
   }
  }
  Constructor<?> constructor=c("net.minecraft.core.HolderSet$Named").getDeclaredConstructor(c("net.minecraft.core.HolderOwner"),c("net.minecraft.tags.TagKey"));constructor.setAccessible(true);
  Object set=constructor.newInstance(lookup,key);m(set.getClass(),"bind",List.class).invoke(set,List.copyOf(holders));cache.put(key,set);
  for(Object holder:holders)holderTags.computeIfAbsent(holder,h->new ArrayList<>()).add(key);
  return set;
 }
 static Object taggedLookup(Object provider)throws Exception{
  Map<Object,Object> lookups=new HashMap<>();Class<?> lookupType=c("net.minecraft.core.HolderLookup$RegistryLookup"),providerType=c("net.minecraft.core.HolderLookup$Provider");
  for(String[] pair:new String[][]{{"instrument","goat_horns"},{"painting_variant","placeable"}}){
   Object registry=m(c("net.minecraft.resources.ResourceKey"),"createRegistryKey",c("net.minecraft.resources.ResourceLocation")).invoke(null,c("net.minecraft.resources.ResourceLocation").getConstructor(String.class).newInstance("minecraft:"+pair[0]));
   Object lookup=m(providerType,"lookupOrThrow",c("net.minecraft.resources.ResourceKey")).invoke(provider,registry);Map<Object,Object> tags=new HashMap<>();
   Object key=m(c("net.minecraft.tags.TagKey"),"create",c("net.minecraft.resources.ResourceKey"),c("net.minecraft.resources.ResourceLocation")).invoke(null,registry,c("net.minecraft.resources.ResourceLocation").getConstructor(String.class).newInstance("minecraft:"+pair[1]));
   tag(lookup,key,tags);
   Object wrapper=Proxy.newProxyInstance(lookupType.getClassLoader(),new Class<?>[]{lookupType},(proxy,method,args)->{
    if(args!=null&&args.length==1&&method.getReturnType()==Optional.class&&c("net.minecraft.tags.TagKey").isInstance(args[0]))return Optional.of(tag(lookup,args[0],tags));
    if(method.isDefault())return InvocationHandler.invokeDefault(proxy,method,args);
    return method.invoke(lookup,args);
   });lookups.put(registry,wrapper);
  }
  for(Map.Entry<Object,List<Object>> entry:holderTags.entrySet())m(c("net.minecraft.core.Holder$Reference"),"bindTags",Collection.class).invoke(entry.getKey(),entry.getValue());
  return Proxy.newProxyInstance(providerType.getClassLoader(),new Class<?>[]{providerType},(proxy,method,args)->{
   if(method.isDefault())return InvocationHandler.invokeDefault(proxy,method,args);
   if(args!=null&&args.length==1&&lookups.containsKey(args[0]))return Optional.of(lookups.get(args[0]));
   return method.invoke(provider,args);
  });
 }
 static jw stackRegistries;
 static jw registryAccess(Object lookup,Path orderPath)throws Exception{
  jw base=jw.a(lp.aw);Map<Object,Object> registries=new LinkedHashMap<>();
  for(Object entry:base.c().toList())registries.put(m(c("net.minecraft.core.RegistryAccess$RegistryEntry"),"key").invoke(entry),m(c("net.minecraft.core.RegistryAccess$RegistryEntry"),"value").invoke(entry));
  JsonObject orders=JsonParser.parseString(Files.readString(orderPath)).getAsJsonObject();
  for(Map.Entry<String,JsonElement> entry:orders.entrySet()){
   Object registryKey=m(c("net.minecraft.resources.ResourceKey"),"createRegistryKey",c("net.minecraft.resources.ResourceLocation")).invoke(null,c("net.minecraft.resources.ResourceLocation").getConstructor(String.class).newInstance(entry.getKey()));
   Object source=m(c("net.minecraft.core.HolderLookup$Provider"),"lookupOrThrow",c("net.minecraft.resources.ResourceKey")).invoke(lookup,registryKey);
   Object registry=c("net.minecraft.core.MappedRegistry").getConstructor(c("net.minecraft.resources.ResourceKey"),Lifecycle.class).newInstance(registryKey,Lifecycle.stable());
   for(JsonElement id:entry.getValue().getAsJsonArray()){
    Object key=m(c("net.minecraft.resources.ResourceKey"),"create",c("net.minecraft.resources.ResourceKey"),c("net.minecraft.resources.ResourceLocation")).invoke(null,registryKey,c("net.minecraft.resources.ResourceLocation").getConstructor(String.class).newInstance(id.getAsString()));
    Object holder=m(c("net.minecraft.core.HolderGetter"),"getOrThrow",c("net.minecraft.resources.ResourceKey")).invoke(source,key),value=m(c("net.minecraft.core.Holder"),"value").invoke(holder);
    m(c("net.minecraft.core.MappedRegistry"),"register",c("net.minecraft.resources.ResourceKey"),Object.class,c("net.minecraft.core.RegistrationInfo")).invoke(registry,key,value,f(c("net.minecraft.core.RegistrationInfo"),"BUILT_IN").get(null));
   }
   m(c("net.minecraft.core.Registry"),"freeze").invoke(registry);registries.put(registryKey,registry);
  }
  return (jw)c("net.minecraft.core.RegistryAccess$ImmutableRegistryAccess").getConstructor(Map.class).newInstance(registries);
 }
 static String stack(cur stack,Object provider) {
  ByteBuf raw=Unpooled.buffer();
  try{cur.h.encode(new xa(raw,stackRegistries),stack);byte[] bytes=new byte[raw.readableBytes()];raw.getBytes(raw.readerIndex(),bytes);return Base64.getEncoder().encodeToString(bytes);}finally{raw.release();}
 }
 public static void main(String[] args)throws Exception {
  loadMappings(Path.of(args[1]));
  m(c("net.minecraft.SharedConstants"),"tryDetectVersion").invoke(null);m(c("net.minecraft.server.Bootstrap"),"bootStrap").invoke(null);
  Object lookup=taggedLookup(m(c("net.minecraft.data.registries.VanillaRegistries"),"createLookup").invoke(null));
  Object registry=f(c("net.minecraft.world.flag.FeatureFlags"),"REGISTRY").get(null);
  stackRegistries=registryAccess(lookup,Path.of(args[2]));
  Class<?> tabs=c("net.minecraft.world.item.CreativeModeTab"),allTabs=c("net.minecraft.world.item.CreativeModeTabs"),location=c("net.minecraft.resources.ResourceLocation");
  List<Object> catalogs=new ArrayList<>();
  for(int mask=0;mask<8;mask++){
   List<Object> requested=new ArrayList<>();requested.add(location.getConstructor(String.class).newInstance("minecraft:vanilla"));
   for(int bit=0;bit<3;bit++)if((mask&(1<<bit))!=0)requested.add(location.getConstructor(String.class).newInstance(new String[]{"minecraft:update_1_21","minecraft:bundle","minecraft:trade_rebalance"}[bit]));
   Object features=m(c("net.minecraft.world.flag.FeatureFlagRegistry"),"fromNames",Iterable.class).invoke(registry,requested);
   Map<String,Object> catalog=new LinkedHashMap<>();catalog.put("mask",mask);
   for(boolean op:new boolean[]{false,true}){
    m(allTabs,"tryRebuildTabContents",c("net.minecraft.world.flag.FeatureFlagSet"),boolean.class,c("net.minecraft.core.HolderLookup$Provider")).invoke(null,features,op,lookup);
    List<Object> rows=new ArrayList<>();int index=0;
    for(Object tab:(List<?>)m(allTabs,"allTabs").invoke(null)){
     Object title=m(tabs,"getDisplayName").invoke(tab),contents=m(c("net.minecraft.network.chat.Component"),"getContents").invoke(title);
     String label=(String)m(c("net.minecraft.network.chat.contents.TranslatableContents"),"getKey").invoke(contents);
     Map<String,Object> row=new LinkedHashMap<>();row.put("index",index++);row.put("label",label.replace("itemGroup.",""));
     List<String> items=new ArrayList<>();for(Object item:(Collection<?>)m(tabs,"getDisplayItems").invoke(tab))items.add(stack((cur)item,lookup));
     row.put("items",items);row.put("icon",stack((cur)m(tabs,"getIconItem").invoke(tab),lookup));
     row.put("title",m(tabs,"showTitle").invoke(tab));row.put("scrollbar",m(tabs,"canScroll").invoke(tab));row.put("column",m(tabs,"column").invoke(tab));row.put("top",((Enum<?>)m(tabs,"row").invoke(tab)).ordinal()==0);row.put("right",m(tabs,"isAlignedRight").invoke(tab));row.put("type",((Enum<?>)m(tabs,"getType").invoke(tab)).name().toLowerCase(Locale.ROOT));row.put("background",m(tabs,"getBackgroundSuffix").invoke(tab));rows.add(row);
    }
    catalog.put(op?"operatorTabs":"tabs",rows);
   }
   catalogs.add(catalog);
  }
  Files.writeString(Path.of(args[0]),new GsonBuilder().disableHtmlEscaping().create().toJson(Map.of("featureCatalogs",catalogs)));
 }
}
