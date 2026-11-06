// Runs the pinned native ADD/REMOVE/SET handler and packet writer headlessly.
import java.lang.reflect.*;
import java.util.*;
public class VerifyCustomCompletions {
 public static void main(String[] args)throws Exception {
  ClassLoader loader=VerifyCustomCompletions.class.getClassLoader();
  Class<?> provider=Class.forName("fdm"),action=Class.forName("wb$a"),packet=Class.forName("wb"),buf=Class.forName("ss"),bytebuf=Class.forName("io.netty.buffer.ByteBuf");
  Object p=provider.getConstructor(Class.forName("fdk",false,loader),Class.forName("emh",false,loader)).newInstance(null,null);
  Field entries=provider.getDeclaredField("e");entries.setAccessible(true);
  int[] actions={0,0,1,2,1};List<List<String>> lists=List.of(List.of("Alice","Alpine","Alice"),List.of("Bob"),List.of("Alice","missing"),List.of("Bob","Beta","Bob"),List.of("Bob"));
  System.out.print("[");
  for(int i=0;i<actions.length;i++){
   Object a=action.getEnumConstants()[actions[i]];List<String> list=lists.get(i);provider.getMethod("a",action,List.class).invoke(p,a,list);
   Object buffer=Class.forName("io.netty.buffer.Unpooled").getMethod("buffer").invoke(null),wrapper=buf.getConstructor(bytebuf).newInstance(buffer);
   packet.getMethod("a",buf).invoke(packet.getConstructor(action,List.class).newInstance(a,list),wrapper);
   byte[] bytes=new byte[(Integer)bytebuf.getMethod("readableBytes").invoke(buffer)];bytebuf.getMethod("readBytes",byte[].class).invoke(buffer,(Object)bytes);
   List<String> sorted=new ArrayList<>((Set<String>)entries.get(p));Collections.sort(sorted);
   if(i>0)System.out.print(",");System.out.print("{\"action\":"+actions[i]+",\"wireHex\":\""+HexFormat.of().formatHex(bytes)+"\",\"entries\":["+String.join(",",list.stream().map(s->"\""+s+"\"").toList())+"],\"result\":["+String.join(",",sorted.stream().map(s->"\""+s+"\"").toList())+"]}");bytebuf.getMethod("release").invoke(buffer);
  }
  System.out.print("]");
 }
}
