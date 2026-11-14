import com.mojang.serialization.JsonOps;
import java.nio.file.*;import java.lang.reflect.*;import java.util.*;import javax.imageio.ImageIO;import com.google.gson.*;
// Pinned 1.20.6 names, using the actual registered BlockColors and ItemColors.
public class ExtractFoliage1206 {
 public static void main(String[] args)throws Exception {
  aa.a();alh.a();
  int[] pixels=new int[65536];for(int i=0;i<pixels.length;i++)pixels[i]=0xff000050|((i&255)<<16)|((i>>8)<<8);
  dby.a(pixels);dbu.a(pixels);
  fgk blocks=fgk.a();fgo items=fgo.a(blocks);
  dbd world=(dbd)Proxy.newProxyInstance(dbd.class.getClassLoader(),new Class<?>[]{dbd.class},(p,m,a)->{
   if(a!=null&&a.length==2&&a[0] instanceof iz&&a[1] instanceof dbl){
    if(a[1]==gdc.a)return 0x123456;if(a[1]==gdc.b)return 0x654321;if(a[1]==gdc.c)return 0xabcdef;
   }
   throw new UnsupportedOperationException(m.toString());
  });
  Map<String,Object> out=new TreeMap<>();
  for(dfb b:lp.e){
   String name=lp.e.b(b).toString();
   if(!name.matches(".*(grass.*|.*leaves|.*fern|.*vine|pink_petals|sugar_cane|lily_pad)"))continue;
   List<Integer> live=new ArrayList<>(),absent=new ArrayList<>(),item=new ArrayList<>();
   for(int tint=0;tint<2;tint++){live.add(blocks.a(b.o(),world,new iz(3,64,7),tint)&0xffffff);absent.add(blocks.a(b.o(),null,null,tint)&0xffffff);item.add(items.a(new cur(b),tint)&0xffffff);}
   out.put(name,Map.of("world",live,"withoutWorld",absent,"item",item));
  }
  List<Object> noise=new ArrayList<>();for(int x=-100;x<=100;x+=13)for(int z=-100;z<=100;z+=17)noise.add(Map.of("x",x,"z",z,"value",dcz.e.a(x*.0225,z*.0225,false),"grass",ddf.b.c.a(x,z,0)));
  Map<String,Object> biomes=new TreeMap<>();
  for(Map.Entry<String,JsonElement> entry:JsonParser.parseString(Files.readString(Path.of(args[1]))).getAsJsonObject().entrySet()){
   dcz biome=dcz.b.parse(JsonOps.INSTANCE,entry.getValue()).getOrThrow();List<Object> points=new ArrayList<>();
   for(int[] pos:new int[][]{{0,0},{77,-19},{-100,200},{121,57}})points.add(Map.of("x",pos[0],"z",pos[1],"grass",biome.a(pos[0],pos[1])&0xffffff,"foliage",biome.f()&0xffffff));
   biomes.put(entry.getKey(),points);
  }
  Files.writeString(Path.of(args[0]),new Gson().toJson(Map.of("blocks",out,"noise",noise,"biomes",biomes)));
 }
}
