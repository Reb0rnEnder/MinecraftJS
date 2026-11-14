import java.nio.file.*;import java.lang.reflect.*;import java.util.*;
// Standalone oracle for the version-native single-octave biome noise wrappers.
public class ExtractLegacyBiomeNoise {
 public static void main(String[] args)throws Exception{
  Class<?> type=Class.forName(args[0]);Object noise;
  if(args.length==2)noise=type.getConstructor(Random.class,int.class).newInstance(new Random(2345),1);
  else {
   Class<?> random=Class.forName(args[2]);Object rng;
   try{rng=random.getConstructor(long.class).newInstance(2345L);}catch(NoSuchMethodException e){Object inner=Class.forName(args[3]).getConstructor(long.class).newInstance(2345L);Constructor<?> wrapper=Arrays.stream(random.getConstructors()).filter(c->c.getParameterCount()==1&&c.getParameterTypes()[0].isInstance(inner)).findFirst().orElseThrow();rng=wrapper.newInstance(inner);}
   final Object source=rng;Constructor<?> ctor=Arrays.stream(type.getConstructors()).filter(c->c.getParameterTypes()[0].isInstance(source)&&(c.getParameterCount()==3||c.getParameterCount()==2&&c.getParameterTypes()[1]==List.class)).findFirst().orElseThrow();
   noise=ctor.getParameterCount()==3?ctor.newInstance(rng,0,0):ctor.newInstance(rng,List.of(0));
  }
  Method sample;try{sample=type.getMethod("a",double.class,double.class);}catch(NoSuchMethodException e){sample=type.getMethod("a",double.class,double.class,boolean.class);}List<String> rows=new ArrayList<>();
  for(int x=-100;x<=100;x+=13)for(int z=-100;z<=100;z+=17){double v=(Double)(sample.getParameterCount()==2?sample.invoke(noise,x*.0225,z*.0225):sample.invoke(noise,x*.0225,z*.0225,false));rows.add("{\"x\":"+x+",\"z\":"+z+",\"value\":"+v+",\"grass\":"+(v<-.1?5011004:6975545)+"}");}
  Files.writeString(Path.of(args[1]),"["+String.join(",",rows)+"]\n");
 }
}
