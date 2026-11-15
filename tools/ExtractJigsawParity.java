// Runs against the exact target client and mappings; no replacement game classes.
import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;
import com.google.gson.*;
public class ExtractJigsawParity {
  static Map<String,String> classes=new HashMap<>(),methods=new HashMap<>();
  static Class<?> c(String name)throws Exception{return Class.forName(classes.get(name));}
  static void mappings(String file)throws Exception{
    String owner="";
    for(String line:Files.readAllLines(Path.of(file))){
      if(!line.startsWith(" ")&&line.contains(" -> ")){String[] p=line.substring(0,line.length()-1).split(" -> ");owner=p[0];classes.put(owner,p[1]);}
      else if(line.startsWith("    ")&&line.contains(" -> ")){String[] p=line.trim().split(" -> ");String left=p[0].replaceFirst("^(?:[0-9]+:[0-9]+:)+","");int i=left.indexOf(' ');if(i>=0)methods.put(owner+"."+left.substring(i+1),p[1]);}
    }
  }
  static byte[] wire(Object packet)throws Exception{
    Class<?> buf=c("net.minecraft.network.FriendlyByteBuf"),byteBuf=Class.forName("io.netty.buffer.ByteBuf");
    Object raw=Class.forName("io.netty.buffer.Unpooled").getMethod("buffer").invoke(null),wrapped=buf.getConstructor(byteBuf).newInstance(raw);
    String owner="net.minecraft.network.protocol.game."+(packet.getClass()==c("net.minecraft.network.protocol.game.ServerboundSetJigsawBlockPacket")?"ServerboundSetJigsawBlockPacket":"ServerboundJigsawGeneratePacket");
    Method write=packet.getClass().getDeclaredMethod(methods.get(owner+".write(net.minecraft.network.FriendlyByteBuf)"),buf);write.setAccessible(true);write.invoke(packet,wrapped);
    byte[] bytes=new byte[(int)byteBuf.getMethod("readableBytes").invoke(raw)];byteBuf.getMethod("readBytes",byte[].class).invoke(raw,(Object)bytes);byteBuf.getMethod("release").invoke(raw);return bytes;
  }
  public static void main(String[] args)throws Exception{
    mappings(args[0]);boolean modern=Boolean.parseBoolean(args[2]),priorities=Boolean.parseBoolean(args[3]);
    Class<?> location=c("net.minecraft.resources.ResourceLocation");Constructor<?> resource=location.getConstructor(String.class);
    Method valid=location.getDeclaredMethod(methods.get("net.minecraft.resources.ResourceLocation.isValidResourceLocation(java.lang.String)"),String.class);
    Map<String,Object> result=new LinkedHashMap<>();List<Object> resources=new ArrayList<>();
    for(String text:new String[]{"",":","minecraft:","stone",":stone","minecraft:stone","custom:path/a.b-c_d","UPPER:stone","minecraft:Stone","mine craft:stone","a:b:c","a:[]","a:/","a:..","a:\\path","ą:stone","a:stone\n"}){
      Map<String,Object> row=new LinkedHashMap<>();row.put("input",text);row.put("valid",valid.invoke(null,text));
      try{row.put("normalized",resource.newInstance(text).toString());}catch(InvocationTargetException e){row.put("error",e.getCause().getMessage());}resources.add(row);
    }
    result.put("resources",resources);List<Object> packets=new ArrayList<>();
    if(priorities){List<Object> integers=new ArrayList<>();for(String text:new String[]{"","+2","-2","-2147483648","2147483648"," 2","2x","2\n","１２","١٢","-०१","²","𝟙","-0"}){int value;try{value=Integer.parseInt(text);}catch(NumberFormatException e){value=0;}integers.add(Map.of("input",text,"value",value));}result.put("integers",integers);}
    Class<?> pos=c("net.minecraft.core.BlockPos"),update=c("net.minecraft.network.protocol.game.ServerboundSetJigsawBlockPacket");Object position=pos.getConstructor(int.class,int.class,int.class).newInstance(-31,72,481);
    for(String jointName:new String[]{"rollable","aligned"}){
      Object packet;
      if(!modern)packet=update.getConstructor(pos,location,location,String.class).newInstance(position,resource.newInstance("minecraft:anchor"),resource.newInstance("custom:pool"),"minecraft:oak_log[axis=x]");
      else{
        Class<?> joint=c("net.minecraft.world.level.block.entity.JigsawBlockEntity$JointType");Object value=joint.getEnumConstants()[jointName.equals("rollable")?0:1];
        if(priorities)packet=update.getConstructor(pos,location,location,location,String.class,joint,int.class,int.class).newInstance(position,resource.newInstance("minecraft:anchor"),resource.newInstance("custom:target"),resource.newInstance("custom:pool"),"minecraft:oak_log[axis=x]",value,-12,37);
        else packet=update.getConstructor(pos,location,location,location,String.class,joint).newInstance(position,resource.newInstance("minecraft:anchor"),resource.newInstance("custom:target"),resource.newInstance("custom:pool"),"minecraft:oak_log[axis=x]",value);
      }
      packets.add(Map.of("kind","update","joint",jointName,"body",HexFormat.of().formatHex(wire(packet))));if(!modern)break;
    }
    if(modern)for(boolean keep:new boolean[]{true,false})for(int level:new int[]{0,7,20}){
      Object packet=c("net.minecraft.network.protocol.game.ServerboundJigsawGeneratePacket").getConstructor(pos,int.class,boolean.class).newInstance(position,level,keep);
      packets.add(Map.of("kind","generate","levels",level,"keep",keep,"body",HexFormat.of().formatHex(wire(packet))));
    }
    result.put("packets",packets);Files.writeString(Path.of(args[1]),new GsonBuilder().setPrettyPrinting().disableHtmlEscaping().create().toJson(result)+"\n");
  }
}
