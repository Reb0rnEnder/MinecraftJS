import java.lang.reflect.*;import java.nio.file.*;import java.util.*;import com.google.gson.*;
// Pinned pre-official-mapping aliases agree with tools/block-shapes/Extract.java.
// The offset enum is the sole three-member enum nested in Block returned by a
// zero-argument method. Geometry uses native methods; no rendering context.
class ExtractLegacyOffsets {
 static Method method(Class<?> c,String n,Class<?>...p)throws Exception{Method m=c.getMethod(n,p);m.setAccessible(true);return m;}
 static List<Double> doubles(Object o)throws Exception{List<Double> r=new ArrayList<>();for(Field f:o.getClass().getFields())if(f.getType()==double.class&&!Modifier.isStatic(f.getModifiers()))r.add(f.getDouble(o));return r;}
 static boolean different(List<Double>a,List<Double>b,List<Double>from,List<Double>to){if(Objects.equals(a,b))return false;if(a==null||b==null)throw new IllegalStateException("Offset changed shape presence");for(int i=0;i<6;i++)if(Math.abs(b.get(i)-a.get(i)-(to.get(i%3)-from.get(i%3)))>1e-7)throw new IllegalStateException("Offset shape is not a translation");return true;}
 public static void main(String[]a)throws Exception{
  String version=a[0];boolean old=version.equals("1.8.9"),flat=version.equals("1.13.2");if(!old&&!flat&&!version.equals("1.12.2"))throw new IllegalArgumentException(version);
  Class<?> boot=Class.forName(flat?"pf":old?"kb":"ni"),block=Class.forName(flat?"bcs":old?"afh":"aow"),state=Class.forName(flat?"blc":old?"alz":"awt"),access=Class.forName(flat?"axk":old?"adq":"amy"),pos=Class.forName(flat?"el":old?"cj":"et"),math=Class.forName(flat?"xq":old?"ns":"rk");method(boot,"c").invoke(null);
  List<Method> candidates=new ArrayList<>();for(Method m:block.getDeclaredMethods())if(m.getParameterCount()==0&&m.getReturnType().isEnum()&&m.getReturnType().getName().startsWith(block.getName()+"$")&&m.getReturnType().getEnumConstants().length==3){m.setAccessible(true);candidates.add(m);}if(candidates.size()!=1)throw new IllegalStateException("Ambiguous native block offset enum: "+candidates);Method kind=candidates.get(0),offset=null,seed=null,vectorSeed=null;
  for(Method m:block.getMethods())if(Arrays.equals(m.getParameterTypes(),new Class[]{state,access,pos})){int n=0;for(Field f:m.getReturnType().getFields())if(f.getType()==double.class&&!Modifier.isStatic(f.getModifiers()))n++;if(n==3){if(offset!=null)throw new IllegalStateException("Ambiguous native vector offset");offset=m;}}
  for(Method m:math.getMethods())if(Modifier.isStatic(m.getModifiers())&&m.getReturnType()==long.class&&Arrays.equals(m.getParameterTypes(),new Class[]{int.class,int.class,int.class}))seed=m;
  for(Method m:math.getMethods())if(Modifier.isStatic(m.getModifiers())&&m.getReturnType()==long.class&&m.getParameterCount()==1&&m.getParameterTypes()[0].isAssignableFrom(pos))vectorSeed=m;
  if(offset==null&&seed==null)throw new IllegalStateException("Missing native position seed");
  Object origin=pos.getConstructor(int.class,int.class,int.class).newInstance(0,0,0),other=pos.getConstructor(int.class,int.class,int.class).newInstance(37,11,91),air=flat?method(block,"a",int.class).invoke(null,0):method(block,"a",int.class).invoke(method(block,"c",int.class).invoke(null,0),0);Object[] current={air},at={origin};
  Object world=Proxy.newProxyInstance(access.getClassLoader(),new Class[]{access},(o,m,p)->{Object s=p!=null&&p.length>0&&at[0].equals(p[0])?current[0]:air;if(m.getReturnType()==state)return s;if(flat&&m.getReturnType().getName().equals("byw"))return method(state,"s").invoke(s);if(m.getReturnType()==int.class)return 15;if(m.getReturnType()==boolean.class)return false;return null;});
  JsonArray defs=new JsonParser().parse(Files.readString(Path.of(a[1]))).getAsJsonArray();Map<String,Object> blocks=new LinkedHashMap<>();List<Object> samples=new ArrayList<>();
  for(JsonElement e:defs){JsonObject d=e.getAsJsonObject();int id=d.get("id").getAsInt();Object s=flat?method(block,"a",int.class).invoke(null,d.get("defaultState").getAsInt()):method(block,"a",int.class).invoke(method(block,"c",int.class).invoke(null,id),0),b=flat?method(state,"c").invoke(s):method(block,"c",int.class).invoke(null,id);int type=((Enum<?>)kind.invoke(b)).ordinal();if(type==0)continue;
   List<List<Double>> offsets=new ArrayList<>();List<Double> bounds0=null,bounds1=null;
   int[][] positions={{0,0,0},{37,11,91},{-29,64,43},{29999999,100,-29999999}};
   for(int i=0;i<positions.length;i++){int[] p=positions[i];Object where=pos.getConstructor(int.class,int.class,int.class).newInstance(p[0],p[1],p[2]);current[0]=s;at[0]=where;List<Double> v;
    if(offset!=null)v=doubles(offset.invoke(b,s,world,where));else{long hash=((Number)(vectorSeed!=null?vectorSeed.invoke(null,where):seed.invoke(null,p[0],0,p[2]))).longValue();v=Arrays.asList(((double)((float)(hash>>16&15)/15f)-.5)*.5,type==2?((double)((float)(hash>>20&15)/15f)-1)*.2:0,((double)((float)(hash>>24&15)/15f)-.5)*.5);}if(v.size()!=3)throw new IllegalStateException("Invalid native offset vector");offsets.add(v);
    samples.add(Map.of("name",d.get("name").getAsString(),"position",p,"offset",v));
    if(i<2&&!old){List<Double> box;if(flat){Object shape=method(block,"a",state,access,pos).invoke(b,s,world,where);box=(Boolean)method(shape.getClass(),"b").invoke(shape)?null:doubles(method(shape.getClass(),"a").invoke(shape));}else box=doubles(method(block,"b",state,access,pos).invoke(b,s,world,where));if(i==0)bounds0=box;else bounds1=box;}
   }
   boolean selection=!old&&different(bounds0,bounds1,offsets.get(0),offsets.get(1));blocks.put(d.get("name").getAsString(),Map.of("type",type,"horizontal",.25,"vertical",type==2?Math.abs(offsets.get(0).get(1)):.2,"origin",offsets.get(0),"selection",selection,"collision",false));
  }
  Files.writeString(Path.of(a[2]),new Gson().toJson(Map.of("blocks",blocks,"samples",samples)));System.err.println("Native "+version+" offset blocks: "+blocks.size());
 }
}
