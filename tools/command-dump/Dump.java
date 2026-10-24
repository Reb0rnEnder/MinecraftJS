import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;
import com.google.gson.*;
import com.mojang.brigadier.*;
import com.mojang.brigadier.tree.*;
import com.mojang.brigadier.context.*;
import io.netty.buffer.*;
// Pinned vanilla 1.13.2 wire/syntax oracle. Client jar first, matching server jar supplies dependencies.
public class Dump {
 static Class<?> cls(String n)throws Exception{return Class.forName(n);}
 static Method method(Class<?> c,String n,Class<?>...p)throws Exception{Method m=c.getMethod(n,p);m.setAccessible(true);return m;}
 public static void main(String[]args)throws Exception {
  method(cls("pf"),"c").invoke(null);
  Object manager=cls("bv").getConstructor(boolean.class).newInstance(true);CommandDispatcher dispatcher=null;
  for(Method m:cls("bv").getMethods())if(m.getReturnType()==CommandDispatcher.class&&m.getParameterCount()==0){m.setAccessible(true);dispatcher=(CommandDispatcher)m.invoke(manager);break;}
  Object packet=cls("jq").getConstructor(RootCommandNode.class).newInstance(dispatcher.getRoot());
  ByteBuf bytes=Unpooled.buffer();Object buffer=cls("hy").getConstructor(ByteBuf.class).newInstance(bytes);
  method(cls("jq"),"b",cls("hy")).invoke(packet,buffer);
  byte[] body=new byte[bytes.readableBytes()];bytes.getBytes(0,body);
  Object clientPacket=cls("jq").getConstructor().newInstance();method(cls("jq"),"a",cls("hy")).invoke(clientPacket,buffer);
  CommandDispatcher client=new CommandDispatcher((RootCommandNode)method(cls("jq"),"b").invoke(clientPacket));
  List<Object> cases=new ArrayList<>();
  for(String text:new String[]{"/give Steve minecraft:sand 2","/give Steve minecraft:sand nope","/give Steve minecraft:not_an_item","/tp Steve ~ ~ ~","/tp Steve ^ ^ ^","/gamemode creative Steve","/time set day","/not_a_command","/execute as @a run give @s minecraft:sand 3","/scoreboard players set Alex test 12","/scoreboard players set Alex test nope","/setblock ~ ~ ~ minecraft:oak_stairs[facing=east]","/setblock ~ ~ ~ minecraft:oak_stairs[facing=invalid]","/say hello world","/say it's fine","/give Steve minecraft:sand 0","/give @e minecraft:sand","/give @e[type=minecraft:player] minecraft:sand","/team add test \"red team\"","/effect give Steve minecraft:speed 30 1 true"}) {
   StringReader reader=new StringReader(text);reader.skip();ParseResults parsed=client.parse(reader,null);
   List<Object> ranges=new ArrayList<>();CommandContextBuilder context=parsed.getContext();
   for(;context!=null;context=context.getChild())for(Object object:context.getArguments().values()){ParsedArgument a=(ParsedArgument)object;ranges.add(List.of(a.getRange().getStart(),a.getRange().getEnd()));}
   Map<String,Object> row=new LinkedHashMap<>();row.put("input",text);row.put("cursor",parsed.getReader().getCursor());row.put("ranges",ranges);row.put("unread",parsed.getReader().canRead());cases.add(row);
  }
  Map<String,Object> result=new LinkedHashMap<>();result.put("body",Base64.getEncoder().encodeToString(body));result.put("cases",cases);
  result.put("source",Map.of("version","1.13.2","clientJarSha1","30bfe37a8db404db11c7edf02cb5165817afb4d9","generator","tools/command-dump/Dump.java"));
  Files.writeString(Path.of(args[0]),new GsonBuilder().setPrettyPrinting().create().toJson(result));
 }
}
