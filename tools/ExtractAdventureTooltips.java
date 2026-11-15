// Runs unmodified native ItemStack tooltip generation, including legacy jars.
import java.lang.reflect.*;import java.nio.file.*;import java.util.*;import com.google.gson.*;
public class ExtractAdventureTooltips {
 static Map<String,String> names=new HashMap<>(),members=new HashMap<>();
 static Class<?> c(String s)throws Exception{return Class.forName(names.get(s));}
 static void mappings(String path)throws Exception{String owner="";for(String line:Files.readAllLines(Path.of(path))){if(!line.startsWith(" ")&&line.contains(" -> ")){String[] p=line.substring(0,line.length()-1).split(" -> ");owner=p[0];names.put(owner,p[1]);}else if(line.startsWith("    ")&&line.contains(" -> ")){String[] p=line.trim().split(" -> ");String left=p[0].replaceFirst("^(?:[0-9]+:[0-9]+:)+","");int i=left.indexOf(' ');if(i>=0)members.put(owner+"."+left.substring(i+1),p[1]);}}}
 static Object flag(Class<?> type,boolean advanced)throws Exception{if(type==boolean.class)return advanced;List<Object> flags=new ArrayList<>();for(Field field:type.getDeclaredFields())if(Modifier.isStatic(field.getModifiers())&&type.isAssignableFrom(field.getType())){field.setAccessible(true);flags.add(field.get(null));}if(flags.size()==2)return flags.get(advanced?1:0);for(Class<?> nested:type.getDeclaredClasses())if(nested.isEnum())return nested.getEnumConstants()[advanced?1:0];throw new IllegalStateException("Missing native tooltip flags "+type);}
 static JsonElement component(Object value,Class<?> type)throws Exception{
  if(value instanceof String s)return new JsonPrimitive(s);
  for(Class<?> nested:type.getDeclaredClasses())for(Method method:nested.getDeclaredMethods())if(Modifier.isStatic(method.getModifiers())&&method.getReturnType()==String.class&&Arrays.equals(method.getParameterTypes(),new Class<?>[]{type})){method.setAccessible(true);return new JsonParser().parse((String)method.invoke(null,value));}
  throw new IllegalStateException("Missing native component serializer "+type);
 }
 public static void main(String[] args)throws Exception{
  JsonObject config=new JsonParser().parse(Files.readString(Path.of(args[0]))).getAsJsonObject();String version=config.get("version").getAsString();boolean ancient=version.equals("1.8.9")||version.equals("1.12.2");
  if(config.has("mappings"))mappings(config.get("mappings").getAsString());
  if(members.containsKey("net.minecraft.SharedConstants.tryDetectVersion()"))c("net.minecraft.SharedConstants").getDeclaredMethod(members.get("net.minecraft.SharedConstants.tryDetectVersion()")).invoke(null);
  Class<?> bootstrap=config.has("bootstrap")?Class.forName(config.get("bootstrap").getAsString()):c("net.minecraft.server.Bootstrap");String boot=config.has("bootstrap")?"c":members.get("net.minecraft.server.Bootstrap.bootStrap()");Method start=bootstrap.getDeclaredMethod(boot);start.setAccessible(true);start.invoke(null);
  if(ancient){Class<?> translator=Class.forName(version.equals("1.8.9")?"di":"ft");for(Field field:translator.getDeclaredFields())if(Modifier.isStatic(field.getModifiers())&&!field.getType().isPrimitive()){
   field.setAccessible(true);Object language=field.get(null);for(Field map:language.getClass().getDeclaredFields())if(Map.class.isAssignableFrom(map.getType())){map.setAccessible(true);Map<String,String> values=(Map<String,String>)map.get(language);for(String key:new ArrayList<>(values.keySet()))values.put(key,key);}
  }}
  Class<?> stack=config.has("stack")?Class.forName(config.get("stack").getAsString()):c("net.minecraft.world.item.ItemStack"),parser=config.has("parser")?Class.forName(config.get("parser").getAsString()):c("net.minecraft.nbt.TagParser");
  Method parse=Arrays.stream(parser.getDeclaredMethods()).filter(m->Modifier.isStatic(m.getModifiers())&&m.getParameterCount()==1&&m.getParameterTypes()[0]==String.class&&!m.getReturnType().isPrimitive()).findFirst().orElseThrow();parse.setAccessible(true);Class<?> tagType=parse.getReturnType();
  Method load=Arrays.stream(stack.getDeclaredMethods()).filter(m->Modifier.isStatic(m.getModifiers())&&m.getReturnType()==stack&&Arrays.equals(m.getParameterTypes(),new Class<?>[]{tagType})).findFirst().orElse(null);if(load!=null)load.setAccessible(true);
  Method tooltip=Arrays.stream(stack.getDeclaredMethods()).filter(m->m.getReturnType()==List.class&&m.getParameterCount()==2&&m.getParameterTypes()[0]!=int.class).findFirst().orElseThrow();tooltip.setAccessible(true);
  Class<?> text=ancient?String.class:(Class<?>)((ParameterizedType)tooltip.getGenericReturnType()).getActualTypeArguments()[0];
  List<Object> cases=new ArrayList<>();for(JsonElement input:config.getAsJsonArray("cases")){
   JsonObject row=input.getAsJsonObject();Object tag=parse.invoke(null,"{id:\"minecraft:stone\",Count:1b,tag:"+row.get("nbt").getAsString()+"}"),item=load!=null?load.invoke(null,tag):stack.getConstructor(tagType).newInstance(tag);Map<String,Object> output=new LinkedHashMap<>();output.put("label",row.get("label").getAsString());output.put("nbt",row.get("nbt").getAsString());
   for(boolean advanced:new boolean[]{false,true}){List<Object> lines=new ArrayList<>();for(Object line:(List<?>)tooltip.invoke(item,null,flag(tooltip.getParameterTypes()[1],advanced)))lines.add(component(line,text));output.put(advanced?"advanced":"normal",lines);}cases.add(output);
  }
  Map<String,Object> blockNames=new TreeMap<>();if(ancient){Class<?> block=Class.forName(version.equals("1.8.9")?"afh":"aow");Method get=Arrays.stream(block.getDeclaredMethods()).filter(m->Modifier.isStatic(m.getModifiers())&&m.getReturnType()==block&&Arrays.equals(m.getParameterTypes(),new Class<?>[]{int.class})).findFirst().orElseThrow(),name=block.getMethod(version.equals("1.8.9")?"f":"c");for(int i=0;i<256;i++){Object b=get.invoke(null,i);if(b!=null)blockNames.put(String.valueOf(i),name.invoke(b));}}
  else{
   Object registry;Class<?> location;String description;
   if(version.equals("1.13.2")){registry=Class.forName("fc").getField("g").get(null);location=Class.forName("pc");description="m";}
   else{String owner=names.containsKey("net.minecraft.core.registries.BuiltInRegistries")?"net.minecraft.core.registries.BuiltInRegistries":"net.minecraft.core.Registry";Field field=c(owner).getDeclaredField(members.get(owner+".BLOCK"));field.setAccessible(true);registry=field.get(null);location=c("net.minecraft.resources.ResourceLocation");description=members.get("net.minecraft.world.level.block.Block.getDescriptionId()");}
   Method get=Arrays.stream(registry.getClass().getMethods()).filter(m->m.getReturnType()==Object.class&&Arrays.equals(m.getParameterTypes(),new Class<?>[]{location})).findFirst().orElseThrow();
   for(JsonElement block:config.getAsJsonArray("blocks")){Object value=get.invoke(registry,location.getConstructor(String.class).newInstance("minecraft:"+block.getAsString()));blockNames.put(block.getAsString(),value.getClass().getMethod(description).invoke(value));}
  }
  Files.writeString(Path.of(args[1]),new Gson().toJson(Map.of("cases",cases,"blockNames",blockNames)));
 }
}
