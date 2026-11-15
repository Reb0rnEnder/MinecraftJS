import java.nio.file.*;import java.util.*;import java.lang.reflect.*;import com.google.gson.*;import com.mojang.serialization.*;
public class ExtractAdventure1206 extends ExtractCreative1206 {
 static Object reg(String name)throws Exception{return f(c("net.minecraft.core.registries.BuiltInRegistries"),name).get(null);}
 static Object blockTag(Object lookup,Object key,Map<Object,Object> cache)throws Exception{
  if(cache.containsKey(key))return cache.get(key);
  Object registry=call(key,"registry",new Class<?>[]{}),location=call(key,"location",new Class<?>[]{});String[] id=location.toString().split(":",2);
  String path="data/"+id[0]+"/tags/blocks/"+id[1]+".json";LinkedHashSet<Object> holders=new LinkedHashSet<>();
  try(java.io.InputStream input=ExtractAdventure1206.class.getClassLoader().getResourceAsStream(path)){
   if(input==null)throw new java.io.FileNotFoundException(path);
   for(JsonElement entry:JsonParser.parseReader(new java.io.InputStreamReader(input,java.nio.charset.StandardCharsets.UTF_8)).getAsJsonObject().getAsJsonArray("values")){
    String name=entry.isJsonObject()?entry.getAsJsonObject().get("id").getAsString():entry.getAsString();Object value=c("net.minecraft.resources.ResourceLocation").getConstructor(String.class).newInstance(name.startsWith("#")?name.substring(1):name);
    if(name.startsWith("#")){Object nested=m(c("net.minecraft.tags.TagKey"),"create",c("net.minecraft.resources.ResourceKey"),c("net.minecraft.resources.ResourceLocation")).invoke(null,registry,value);for(Object holder:(Iterable<?>)blockTag(lookup,nested,cache))holders.add(holder);}
    else{Object item=m(c("net.minecraft.resources.ResourceKey"),"create",c("net.minecraft.resources.ResourceKey"),c("net.minecraft.resources.ResourceLocation")).invoke(null,registry,value);holders.add(m(c("net.minecraft.core.HolderGetter"),"getOrThrow",c("net.minecraft.resources.ResourceKey")).invoke(lookup,item));}
   }
  }
  Constructor<?> constructor=c("net.minecraft.core.HolderSet$Named").getDeclaredConstructor(c("net.minecraft.core.HolderOwner"),c("net.minecraft.tags.TagKey"));constructor.setAccessible(true);Object set=constructor.newInstance(lookup,key);m(set.getClass(),"bind",List.class).invoke(set,List.copyOf(holders));cache.put(key,set);
  for(Object holder:holders)holderTags.computeIfAbsent(holder,h->new ArrayList<>()).add(key);return set;
 }
 static Object blockLookup(Object provider)throws Exception{
  Class<?> p=c("net.minecraft.core.HolderLookup$Provider"),l=c("net.minecraft.core.HolderLookup$RegistryLookup");Object key=f(c("net.minecraft.core.registries.Registries"),"BLOCK").get(null),lookup=m(p,"lookupOrThrow",c("net.minecraft.resources.ResourceKey")).invoke(provider,key);Map<Object,Object> tags=new HashMap<>();
  Object wrapped=Proxy.newProxyInstance(l.getClassLoader(),new Class<?>[]{l},(o,method,a)->{
   if(a!=null&&a.length==1&&method.getReturnType()==Optional.class&&c("net.minecraft.tags.TagKey").isInstance(a[0]))return Optional.of(blockTag(lookup,a[0],tags));
   if(method.isDefault())return InvocationHandler.invokeDefault(o,method,a);return method.invoke(lookup,a);
  });
  return Proxy.newProxyInstance(p.getClassLoader(),new Class<?>[]{p},(o,method,a)->{
   if(method.isDefault())return InvocationHandler.invokeDefault(o,method,a);if(a!=null&&a.length==1&&key.equals(a[0]))return Optional.of(wrapped);return method.invoke(provider,a);
  });
 }
 public static void main(String[] args)throws Exception{
  loadMappings(Path.of(args[1]));m(c("net.minecraft.SharedConstants"),"tryDetectVersion").invoke(null);m(c("net.minecraft.server.Bootstrap"),"bootStrap").invoke(null);
  Object rawLookup=m(c("net.minecraft.data.registries.VanillaRegistries"),"createLookup").invoke(null),lookup=blockLookup(rawLookup);stackRegistries=registryAccess(rawLookup,Path.of(args[2]));
  Object ops=m(c("net.minecraft.resources.RegistryOps"),"create",DynamicOps.class,c("net.minecraft.core.HolderLookup$Provider")).invoke(null,JsonOps.INSTANCE,lookup);
  Object blocks=reg("BLOCK");Map<String,Object> blockProperties=new TreeMap<>();List<Object> propertyTypes=new ArrayList<>();
  for(Object block:(Iterable<?>)blocks){
   Map<String,Integer> props=new TreeMap<>();Object definition=call(block,"getStateDefinition",new Class<?>[]{});
   for(Object property:(Collection<?>)call(definition,"getProperties",new Class<?>[]{})){
    List<Comparable> allowed=new ArrayList<>((Collection<? extends Comparable>)call(property,"getPossibleValues",new Class<?>[]{}));Collections.sort(allowed);List<String> names=new ArrayList<>();for(Comparable value:allowed)names.add((String)call(property,"getName",new Class<?>[]{Comparable.class},value));
    Object type=Map.of("integer",allowed.getFirst() instanceof Integer,"values",names);int index=propertyTypes.indexOf(type);if(index<0){index=propertyTypes.size();propertyTypes.add(type);}props.put((String)call(property,"getName",new Class<?>[]{}),index);
   }
   if(!props.isEmpty())blockProperties.put(m(c("net.minecraft.core.Registry"),"getKey",Object.class).invoke(blocks,block).toString().replace("minecraft:",""),props);
  }
  Codec stackCodec=(Codec)f(c("net.minecraft.world.item.ItemStack"),"CODEC").get(null);List<Object> cases=new ArrayList<>();
  for(JsonElement input:JsonParser.parseString(Files.readString(Path.of(args[3]))).getAsJsonArray()){
   JsonObject entry=input.getAsJsonObject();Object stack=stackCodec.parse((DynamicOps)ops,entry.get("stack")).getOrThrow();String key=entry.get("component").getAsString();Object component=f(c("net.minecraft.core.component.DataComponents"),key.equals("can_break")?"CAN_BREAK":"CAN_PLACE_ON").get(null);
   if(entry.has("directEmpty")){Object empty=c("net.minecraft.world.item.AdventureModePredicate").getConstructor(List.class,boolean.class).newInstance(List.of(),true);m(c("net.minecraft.world.item.ItemStack"),"set",c("net.minecraft.core.component.DataComponentType"),Object.class).invoke(stack,component,empty);}
   Object predicates=m(c("net.minecraft.core.component.DataComponentHolder"),"get",c("net.minecraft.core.component.DataComponentType")).invoke(stack,component);
   Object block=m(c("net.minecraft.core.Registry"),"get",c("net.minecraft.resources.ResourceLocation")).invoke(blocks,c("net.minecraft.resources.ResourceLocation").getConstructor(String.class).newInstance(entry.get("block").getAsString()));Object state=call(block,"defaultBlockState",new Class<?>[]{}),definition=call(block,"getStateDefinition",new Class<?>[]{});
   for(Map.Entry<String,JsonElement> e:entry.getAsJsonObject("state").entrySet()){
    Object property=call(definition,"getProperty",new Class<?>[]{String.class},e.getKey());Optional<?> value=(Optional<?>)call(property,"getValue",new Class<?>[]{String.class},e.getValue().getAsString());state=call(state,"setValue",new Class<?>[]{c("net.minecraft.world.level.block.state.properties.Property"),Comparable.class},property,value.orElseThrow());
   }
   for(Map.Entry<Object,List<Object>> e:holderTags.entrySet())m(c("net.minecraft.core.Holder$Reference"),"bindTags",Collection.class).invoke(e.getKey(),e.getValue());
   boolean matched=false;for(Object predicate:(List<?>)f(predicates.getClass(),"predicates").get(predicates)){
    if(!(Boolean)m(c("net.minecraft.advancements.critereon.BlockPredicate"),"matchesState",c("net.minecraft.world.level.block.state.BlockState")).invoke(predicate,state))continue;
    Optional<?> nbt=(Optional<?>)call(predicate,"nbt",new Class<?>[]{});boolean nbtMatches=nbt.isEmpty();if(nbt.isPresent()&&entry.has("actualNbt")){
     Object actual=m(c("net.minecraft.nbt.TagParser"),"parseTag",String.class).invoke(null,entry.get("actualNbt").getAsString());nbtMatches=(Boolean)call(nbt.get(),"matches",new Class<?>[]{c("net.minecraft.nbt.Tag")},actual);
    }
    if(nbtMatches){matched=true;break;}
   }
   cases.add(Map.of("label",entry.get("label").getAsString(),"wire",stack((cur)stack,lookup),"matched",matched));
  }
  Files.writeString(Path.of(args[0]),new Gson().toJson(Map.of("cases",cases,"properties",blockProperties,"propertyTypes",propertyTypes)));
 }
}
