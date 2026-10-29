import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;
import com.google.gson.*;
import com.mojang.brigadier.*;
import com.mojang.brigadier.tree.*;
import com.mojang.brigadier.context.*;
import io.netty.buffer.*;
// Pinned vanilla wire/syntax oracle. Client jar first, matching server jar supplies dependencies.
public class Dump {
 static Class<?> cls(String n)throws Exception{return Class.forName(n);}
 static Method method(Class<?> c,String n,Class<?>...p)throws Exception{Method m=c.getMethod(n,p);m.setAccessible(true);return m;}
 public static void main(String[]args)throws Exception {
  String version=args.length>1?args[1]:"1.13.2";
  String bootstrap=args.length>2?args[2]:"pf",commands=args.length>3?args[3]:"bv",packetName=args.length>4?args[4]:"jq",bufferName=args.length>5?args[5]:"hy";
  method(cls(bootstrap),version.equals("1.13.2")?"c":"a").invoke(null);
  Object manager;
  if(version.startsWith("1.16")){
   Class<?> selection=cls(commands+"$a");manager=cls(commands).getConstructor(selection).newInstance(selection.getEnumConstants()[0]);
  }else manager=cls(commands).getConstructor(boolean.class).newInstance(true);
  CommandDispatcher dispatcher=null;
  for(Method m:cls(commands).getMethods())if(m.getReturnType()==CommandDispatcher.class&&m.getParameterCount()==0){m.setAccessible(true);dispatcher=(CommandDispatcher)m.invoke(manager);break;}
  Object packet=cls(packetName).getConstructor(RootCommandNode.class).newInstance(dispatcher.getRoot());
  ByteBuf bytes=Unpooled.buffer();Object buffer=cls(bufferName).getConstructor(ByteBuf.class).newInstance(bytes);
  method(cls(packetName),"b",cls(bufferName)).invoke(packet,buffer);
  byte[] body=new byte[bytes.readableBytes()];bytes.getBytes(0,body);
  Object clientPacket=cls(packetName).getConstructor().newInstance();method(cls(packetName),"a",cls(bufferName)).invoke(clientPacket,buffer);
  CommandDispatcher client=new CommandDispatcher((RootCommandNode)method(cls(packetName),"b").invoke(clientPacket));
  List<Object> cases=new ArrayList<>();
  for(String text:new String[]{"/give Steve minecraft:sand 2","/give Steve minecraft:sand nope","/give Steve minecraft:not_an_item","/tp Steve ~ ~ ~","/tp Steve ^ ^ ^","/gamemode creative Steve","/time set day","/not_a_command","/execute as @a run give @s minecraft:sand 3","/scoreboard players set Alex test 12","/scoreboard players set Alex test nope","/setblock ~ ~ ~ minecraft:oak_stairs[facing=east]","/setblock ~ ~ ~ minecraft:oak_stairs[facing=invalid]","/say hello world","/say it's fine","/give Steve minecraft:sand 0","/give @e minecraft:sand","/give @e[type=minecraft:player] minecraft:sand","/team add test \"red team\"","/effect give Steve minecraft:speed 30 1 true","/team add test 'red team'","/team add test \"red\\q\"","/teleport Steve 1 2 3","/teleport Steve ~1 ^2 ~3","/teleport Steve 1 2","/execute as @e[limit=1] run say hello","/give @e[limit=1] minecraft:stone","/give @e[limit=1,type=player] minecraft:stone","/give Steve minecraft:stone{display:{Name:'{\"text\":\"Hello world\"}'}} 2","/data get entity @s foo.bar[0]","/data merge entity @s {test:1b}","/data merge entity @s []","/setblock 0 64 0 stone[facing=north]","/setblock 0 64 0 oak_stairs[facing=east,half=top]","/setblock 0 64 0 oak_stairs[facing=east,facing=west]","/time set 1s","/time set -1","/scoreboard players set Alex test +1","/scoreboard players set Alex test 2147483648","/execute positioned .5 -.5 2. run say okay","/tellraw @a {\"text\":\"hello world\"}","/tellraw @a \"Hello world\"","/tellraw @a [\"one\",\"two\"]","/tellraw @a {\"text\":","/say","/say ","/say  hello","/give Steve minecraft:stone 2 extra","/gamerule keepInventory yes","/gamerule keepInventory true","/execute run say hello","/playsound minecraft:block.note_block.harp master @a ~ ~ ~ .5 1 0","/replaceitem entity @s slot.weapon.mainhand stone","/replaceitem entity @s foo stone","/replaceitem entity @s container.54 stone","/replaceitem entity @s container.0 stone","/scoreboard objectives add abcdefghijklmnopq dummy","/scoreboard objectives add test nonsense","/execute if score @s test matches .. run say okay","/execute if score @s test matches 1.. run say okay","/execute if score @s test matches 2..1 run say okay","/give @a[limit=0] stone","/give @a[sort=asdf] stone","/give @a[foo=bar] stone","/give @a[gamemode=nonsense] stone","/give @a[distance=2..1] stone","/give @a[name=Steve,name=Alex] stone","/give @a[limit=1,sort=nearest] stone","/give Steve stone{a} 1","/give Steve stone{a:[1b,2]} 1","/setblock 0 64 0 stone{a} ","/give Steve stone{a:1b} 1","/data get entity @s foo[invalid]","/data get entity @s foo[]","/data get entity @s \"hello world\"","/data get entity @s foo{a:1}","/data get entity @s foo.","/particle nonsense ~ ~ ~ 0 0 0 1 1","/summon minecraft:not_an_entity ~ ~ ~","/tp @s 2147483648 64 0","/fill 2147483648 64 0 0 64 0 stone","/spawnpoint @s ~ ~ ~ ~","/spawnpoint @s ~ ~ ~ ~45.5","/spawnpoint @s ~ ~ ~ 90","/spawnpoint @s ~ ~ ~ ^90","/spawnpoint @s ~ ~ ~ nonsense","/spawnpoint @s ~ ~ ~ 90abc","/spawnpoint @s ~ ~ ~ ~nope","/attribute @s minecraft:generic.max_health modifier remove dd12be42-52a9-4a91-a8a1-11c01849e498","/attribute @s minecraft:generic.max_health modifier remove 1-1-1-1-1","/attribute @s minecraft:generic.max_health modifier remove invalid","/attribute @s minecraft:generic.max_health modifier remove dd12be42-52a9-4a91-a8a1-11c01849e498x","/give @s minecraft:netherite_sword 1","/execute in minecraft:the_nether run say hello"}) {
   StringReader reader=new StringReader(text);reader.skip();ParseResults parsed=client.parse(reader,null);
   List<Object> ranges=new ArrayList<>();CommandContextBuilder context=parsed.getContext();
   for(;context!=null;context=context.getChild())for(Object object:context.getArguments().values()){ParsedArgument a=(ParsedArgument)object;ranges.add(List.of(a.getRange().getStart(),a.getRange().getEnd()));}
   Map<String,Object> row=new LinkedHashMap<>();row.put("input",text);row.put("cursor",parsed.getReader().getCursor());row.put("ranges",ranges);row.put("unread",parsed.getReader().canRead());cases.add(row);
  }
  Map<String,Object> result=new LinkedHashMap<>();result.put("body",Base64.getEncoder().encodeToString(body));result.put("cases",cases);
  result.put("source",Map.of("version",version,"clientJarSha1",args.length>6?args[6]:"30bfe37a8db404db11c7edf02cb5165817afb4d9","generator","tools/command-dump/Dump.java"));
  Files.writeString(Path.of(args[0]),new GsonBuilder().setPrettyPrinting().create().toJson(result));
 }
}
