import java.lang.reflect.*;import java.util.*;import com.google.gson.*;
// Differential oracle: call the target jar's BiomeZoomer with a source that
// records the selected quart coordinate, without starting a world/renderer.
class ProbeBiomeZoom {
 public static void main(String[]args)throws Exception{
  Class<?> zoom=Class.forName("bma"),source=Class.forName("bkv$a");Object nativeZoom=zoom.getField("a").get(null);Method sample=zoom.getMethod("a",long.class,int.class,int.class,int.class,source);
  List<Object> cases=new ArrayList<>();Random random=new Random(11502);long[] seeds={0,-1,Long.MAX_VALUE,Long.MIN_VALUE,1234567890123456789L};
  for(long seed:seeds)for(int i=0;i<20;i++){
   int x=random.nextInt(60001)-30000,y=random.nextInt(600)-100,z=random.nextInt(60001)-30000;final int[][] selected={null};
   Object noise=Proxy.newProxyInstance(source.getClassLoader(),new Class[]{source},(o,m,a)->{selected[0]=new int[]{(int)a[0],(int)a[1],(int)a[2]};return null;});sample.invoke(nativeZoom,seed,x,y,z,noise);
   cases.add(Map.of("seed",Long.toString(seed),"position",new int[]{x,y,z},"cell",selected[0]));
  }
  System.out.println(new Gson().toJson(Map.of("clientJarSha1","e3f78cd16f9eb9a52307ed96ebec64241cc5b32d","cases",cases)));
 }
}
