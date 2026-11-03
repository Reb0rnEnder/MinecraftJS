import java.lang.reflect.*;import java.nio.file.*;import java.util.*;import java.io.*;import com.google.gson.*;
public class ExtractSupport {
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
  String key=name+"("+String.join(",",Arrays.stream(args).map(ExtractSupport::original).toArray(String[]::new))+")";
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
  InputStream resource=ExtractSupport.class.getClassLoader().getResourceAsStream(name);
  if(resource==null)resource=ExtractSupport.class.getClassLoader().getResourceAsStream("data/minecraft/datapacks/update_1_20/"+name);
  try(InputStream input=resource){
   if(input==null)throw new FileNotFoundException(name);JsonObject definition=new JsonParser().parse(new InputStreamReader(input,java.nio.charset.StandardCharsets.UTF_8)).getAsJsonObject();
   for(JsonElement el:definition.getAsJsonArray("values")){String value=el.isJsonObject()?el.getAsJsonObject().get("id").getAsString():el.getAsString();if(value.startsWith("#"))values.addAll(blockTag(value.substring(1),registry,memo));else values.add(m(c("net.minecraft.core.Registry"),"get",c("net.minecraft.resources.ResourceLocation")).invoke(registry,c("net.minecraft.resources.ResourceLocation").getConstructor(String.class).newInstance(value)));}
  }return values;
 }
 public static void main(String[] args)throws Exception{
  loadMappings(Path.of(args[1]));
  try{m(c("net.minecraft.SharedConstants"),"tryDetectVersion").invoke(null);}catch(NoSuchMethodException e){}
  m(c("net.minecraft.server.Bootstrap"),"bootStrap").invoke(null);
  Class<?> block=c("net.minecraft.world.level.block.Block"),state=c("net.minecraft.world.level.block.state.BlockState"),access=c("net.minecraft.world.level.BlockGetter"),reader=c("net.minecraft.world.level.LevelReader"),pos=c("net.minecraft.core.BlockPos"),dir=c("net.minecraft.core.Direction");
  Object origin=pos.getConstructor(int.class,int.class,int.class).newInstance(0,0,0),air=m(block,"stateById",int.class).invoke(null,0);final Object[] current={air};
  Object world=Proxy.newProxyInstance(reader.getClassLoader(),new Class[]{reader},(o,method,a)->{Object s=a!=null&&a.length>0&&origin.equals(a[0])?current[0]:air;if(method.getReturnType()==state)return s;if(method.getReturnType()==boolean.class)return false;if(method.getReturnType()==int.class)return 256;return null;});
  String nativeVersion=args.length>3?args[3]:"";
  if(nativeVersion.equals("1.16.5")||nativeVersion.equals("1.17.1")){
   Object blocksRegistry=f(c("net.minecraft.core.Registry"),"BLOCK").get(null);Map<String,Set<Object>> tags=new LinkedHashMap<>();
   List<?> wrappers=nativeVersion.equals("1.16.5")?(List<?>)m(c("net.minecraft.tags.BlockTags"),"getWrappers").invoke(null):(List<?>)f(c("net.minecraft.tags.StaticTagHelper"),"wrappers").get(f(c("net.minecraft.tags.BlockTags"),"HELPER").get(null));
   for(Object wrapper:wrappers){String name=m(c("net.minecraft.tags.Tag$Named"),"getName").invoke(wrapper).toString();f(wrapper.getClass(),"tag").set(wrapper,m(c("net.minecraft.tags.Tag"),"fromSet",Set.class).invoke(null,blockTag(name,blocksRegistry,tags)));}
  }
  if(classNames.containsKey("net.minecraft.tags.TagKey")){
   Object registry=f(c(classNames.containsKey("net.minecraft.core.registries.BuiltInRegistries")?"net.minecraft.core.registries.BuiltInRegistries":"net.minecraft.core.Registry"),"BLOCK").get(null);Map<String,Set<Object>> tags=new LinkedHashMap<>();Map<Object,List<Object>> bindings=new LinkedHashMap<>();
   for(Field tf:c("net.minecraft.tags.BlockTags").getDeclaredFields())if(Modifier.isStatic(tf.getModifiers())&&tf.getType()==c("net.minecraft.tags.TagKey")){tf.setAccessible(true);Object key=tf.get(null);String name=m(c("net.minecraft.tags.TagKey"),"location").invoke(key).toString();List<Object> holders=new ArrayList<>();for(Object value:blockTag(name,registry,tags)){int id=(int)m(c("net.minecraft.core.Registry"),"getId",Object.class).invoke(registry,value);holders.add(((Optional<?>)m(c("net.minecraft.core.Registry"),"getHolder",int.class).invoke(registry,id)).orElseThrow());}bindings.put(key,holders);}m(c("net.minecraft.core.Registry"),"bindTags",Map.class).invoke(registry,bindings);
  }
  Method center=m(block,"canSupportCenter",reader,pos,dir),full=m(state,"isFaceSturdy",access,pos,dir);
  Object[] directions=(Object[])m(dir,"values").invoke(null);List<Object> result=new ArrayList<>();
  for(int id=0;id<Integer.parseInt(args[2]);id++){Object s=m(block,"stateById",int.class).invoke(null,id);current[0]=s;int centers=0,faces=0;for(int i=0;i<directions.length;i++){if((boolean)center.invoke(null,world,origin,directions[i]))centers|=1<<i;if((boolean)full.invoke(s,world,origin,directions[i]))faces|=1<<i;}result.add(Arrays.asList(centers,faces));}
  Files.writeString(Path.of(args[0]),new Gson().toJson(result));System.out.println("Native support states: "+result.size());
 }
}
