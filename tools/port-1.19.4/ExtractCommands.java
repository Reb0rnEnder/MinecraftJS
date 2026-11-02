import com.mojang.brigadier.StringReader;import com.mojang.brigadier.suggestion.Suggestions;import com.mojang.brigadier.suggestion.SuggestionsBuilder;import com.mojang.brigadier.suggestion.Suggestion;import java.util.function.Consumer;import java.util.concurrent.CompletableFuture;
import com.mojang.brigadier.*;import com.mojang.brigadier.tree.*;import com.mojang.brigadier.context.*;import io.netty.buffer.*;
import com.mojang.serialization.Codec;import com.mojang.serialization.JsonOps;
import java.lang.reflect.*;import java.nio.file.*;import java.util.*;import java.io.*;import com.google.gson.*;
// Native 1.19.4 runtime tables. Reflection uses official member names and mappings.
public class ExtractCommands {
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
  String key=name+"("+String.join(",",Arrays.stream(args).map(ExtractCommands::original).toArray(String[]::new))+")";
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
  InputStream resource=ExtractCommands.class.getClassLoader().getResourceAsStream(name);
  if(resource==null)resource=ExtractCommands.class.getClassLoader().getResourceAsStream("data/minecraft/datapacks/update_1_20/"+name);
  try(InputStream input=resource){
   if(input==null)throw new FileNotFoundException(name);JsonObject definition=new JsonParser().parse(new InputStreamReader(input,java.nio.charset.StandardCharsets.UTF_8)).getAsJsonObject();
   for(JsonElement el:definition.getAsJsonArray("values")){String value=el.isJsonObject()?el.getAsJsonObject().get("id").getAsString():el.getAsString();if(value.startsWith("#"))values.addAll(blockTag(value.substring(1),registry,memo));else values.add(m(c("net.minecraft.core.Registry"),"get",c("net.minecraft.resources.ResourceLocation")).invoke(registry,c("net.minecraft.resources.ResourceLocation").getConstructor(String.class).newInstance(value)));}
  }return values;
 }
 public static void main(String[] args)throws Exception{
  loadMappings(Path.of(args[1]));m(c("net.minecraft.SharedConstants"),"tryDetectVersion").invoke(null);m(c("net.minecraft.server.Bootstrap"),"bootStrap").invoke(null);
  Object lookup=m(c("net.minecraft.data.registries.VanillaRegistries"),"createLookup").invoke(null),features=f(c("net.minecraft.world.flag.FeatureFlags"),"VANILLA_SET").get(null);
  Object context=m(c("net.minecraft.commands.CommandBuildContext"),"simple",c("net.minecraft.core.HolderLookup$Provider"),c("net.minecraft.world.flag.FeatureFlagSet")).invoke(null,lookup,features);
  Object manager=c("net.minecraft.commands.Commands").getConstructor(c("net.minecraft.commands.Commands$CommandSelection"),c("net.minecraft.commands.CommandBuildContext")).newInstance(f(c("net.minecraft.commands.Commands$CommandSelection"),"ALL").get(null),context);
  CommandDispatcher dispatcher=(CommandDispatcher)m(c("net.minecraft.commands.Commands"),"getDispatcher").invoke(manager);
  Class<?> packetType=c("net.minecraft.network.protocol.game.ClientboundCommandsPacket"),bufferType=c("net.minecraft.network.FriendlyByteBuf");
  Object packet=packetType.getConstructor(RootCommandNode.class).newInstance(dispatcher.getRoot());ByteBuf bytes=Unpooled.buffer();Object buffer=bufferType.getConstructor(ByteBuf.class).newInstance(bytes);m(packetType,"write",bufferType).invoke(packet,buffer);
  byte[] body=new byte[bytes.readableBytes()];bytes.getBytes(0,body);Object readPacket=packetType.getConstructor(bufferType).newInstance(buffer);
  CommandDispatcher client=new CommandDispatcher((RootCommandNode)m(packetType,"getRoot",c("net.minecraft.commands.CommandBuildContext")).invoke(readPacket,context));List<Object> cases=new ArrayList<>();
  JsonArray inputs=JsonParser.parseString(Files.readString(Path.of(args[2]))).getAsJsonArray();
  for(JsonElement input:inputs){String text=input.getAsString();StringReader reader=new StringReader(text);if(reader.canRead()&&reader.peek()=='/')reader.skip();ParseResults parsed=client.parse(reader,null);List<Object> ranges=new ArrayList<>(),lastRanges=new ArrayList<>();CommandContextBuilder ctx=parsed.getContext();while(ctx!=null){lastRanges.clear();for(Object arg:ctx.getArguments().values()){ParsedArgument a=(ParsedArgument)arg;List<Integer> range=List.of(a.getRange().getStart(),a.getRange().getEnd());ranges.add(range);lastRanges.add(range);}ctx=ctx.getChild();}
   Map<String,Object> row=new LinkedHashMap<>();row.put("input",text);row.put("cursor",parsed.getReader().getCursor());row.put("unread",parsed.getReader().canRead());row.put("ranges",ranges);row.put("lastRanges",new ArrayList<>(lastRanges));
   SuggestionContext sc=parsed.getContext().findSuggestionContext(text.length());Map<CommandNode,String> usages=client.getSmartUsage(sc.parent,null);List<String> usage=new ArrayList<>();for(Map.Entry<CommandNode,String> entry:usages.entrySet())if(!(entry.getKey() instanceof LiteralCommandNode))usage.add(entry.getValue());row.put("usage",usage);row.put("usageStart",sc.startPos);cases.add(row);
  }
  List<Object> selectorCases=new ArrayList<>();Class<?> selector=c("net.minecraft.commands.arguments.selector.EntitySelectorParser");
  for(String text:List.of("/kill @e[type=","/kill @e[type=zo","/kill @e[type=!zo","/kill @e[sort=","/kill @e[gamemode=","/kill @e[distance=1..3,ty","/kill @e[")){
   StringReader reader=new StringReader(text);reader.setCursor(6);Object parser=selector.getConstructor(StringReader.class,boolean.class).newInstance(reader,true);try{m(selector,"parse").invoke(parser);}catch(InvocationTargetException expected){}
   SuggestionsBuilder builder=new SuggestionsBuilder(text,6);
   Consumer<SuggestionsBuilder> names=b->{};
   CompletableFuture<?> future=(CompletableFuture<?>)m(selector,"fillSuggestions",SuggestionsBuilder.class,Consumer.class).invoke(parser,builder,names);
   Suggestions suggestions=(Suggestions)future.join();List<Object> rows=new ArrayList<>();for(Suggestion suggestion:suggestions.getList())rows.add(Map.of("match",suggestion.getText()));selectorCases.add(Map.of("input",text,"start",suggestions.getRange().getStart(),"end",suggestions.getRange().getEnd(),"matches",rows));
  }
  Files.writeString(Path.of(args[0]),new Gson().toJson(Map.of("source",Map.of("version","1.19.4","clientJarSha1","958928a560c9167687bea0cefeb7375da1e552a8"),"body",Base64.getEncoder().encodeToString(body),"cases",cases,"selectors",selectorCases)));System.out.println("Native command cases: "+cases.size());
 }
}
