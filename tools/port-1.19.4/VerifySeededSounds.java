// Executes native WeighedSoundEvents and RandomSource, with native sound JSON parsing.
import java.lang.reflect.*;
public class VerifySeededSounds {
 public static void main(String[] args)throws Exception {
  java.io.PrintStream output=System.out;
  Class.forName("aa").getMethod("a").invoke(null);
  Class.forName("adf").getMethod("a").invoke(null);
  Class<?> random=Class.forName("apo"),events=Class.forName("fxk"),weighted=Class.forName("fxl"),sound=Class.forName("fwc"),serializer=Class.forName("fwe"),json=Class.forName("com.google.gson.JsonObject");
  Object parser=serializer.getConstructor().newInstance(),set=events.getConstructor(Class.forName("add"),String.class).newInstance(null,null);
  Method parse=serializer.getDeclaredMethod("b",json);parse.setAccessible(true);
  String[] defs={"{\"name\":\"test/a\",\"weight\":3,\"volume\":0.5,\"attenuation_distance\":24}","{\"name\":\"test/b\",\"weight\":5}","{\"name\":\"test/c\",\"weight\":11,\"pitch\":1.5}"};
  for(String def:defs){Object el=Class.forName("com.google.gson.JsonParser").getMethod("parseString",String.class).invoke(null,def);events.getMethod("a",weighted).invoke(set,parse.invoke(parser,el));}
  long[] seeds={0,1,2,17,42,123456789,-1,Long.MIN_VALUE,Long.MAX_VALUE};
  output.print("[");
  for(int i=0;i<seeds.length;i++){
   Object rng=random.getMethod("a",long.class).invoke(null,seeds[i]);if(i>0)output.print(",");output.print("{\"seed\":\""+seeds[i]+"\",\"files\":[");
   for(int j=0;j<8;j++){Object picked=events.getMethod("a",random).invoke(set,rng);if(j>0)output.print(",");output.print("\""+sound.getMethod("a").invoke(picked)+"\"");}
   output.print("]}");
  }
  output.print("]");
 }
}
