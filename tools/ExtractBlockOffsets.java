
import java.lang.reflect.*;import java.nio.file.*;import java.util.*;import java.io.*;import com.google.gson.*;
// Executes ItemBlockRenderTypes from each pinned client, without a graphics context.
public class ExtractBlockOffsets {
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
  String key=name+"("+String.join(",",Arrays.stream(args).map(ExtractBlockOffsets::original).toArray(String[]::new))+")";
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
 static List<Double> vector(Object v)throws Exception{List<Double> r=new ArrayList<>();for(String n:new String[]{"x","y","z"})r.add(f(v.getClass(),n).getDouble(v));return r;}
 static List<List<Double>> boxes(Object shape)throws Exception{List<List<Double>> r=new ArrayList<>();for(Object b:(List<?>)call(shape,"toAabbs",new Class[]{}))r.add(box(b));return r;}
 static boolean shifted(List<List<Double>> a,List<List<Double>> b,List<Double> from,List<Double> to)throws Exception{
  if(a.equals(b))return false;if(a.size()!=b.size())throw new IllegalStateException("Position-dependent offset shape changed topology");
  for(int i=0;i<a.size();i++)for(int j=0;j<6;j++)if(Math.abs(b.get(i).get(j)-a.get(i).get(j)-(to.get(j%3)-from.get(j%3)))>1e-7)throw new IllegalStateException("Offset shape is not a translation");return true;
 }
 public static void main(String[] args)throws Exception{
  loadMappings(Path.of(args[0]));if(methodNames.getOrDefault("net.minecraft.SharedConstants",Map.of()).containsKey("tryDetectVersion()"))m(c("net.minecraft.SharedConstants"),"tryDetectVersion").invoke(null);m(c("net.minecraft.server.Bootstrap"),"bootStrap").invoke(null);
  Class<?> block=c("net.minecraft.world.level.block.Block"),state=c("net.minecraft.world.level.block.state.BlockState"),access=c("net.minecraft.world.level.BlockGetter"),pos=c("net.minecraft.core.BlockPos");
  Object origin=pos.getConstructor(int.class,int.class,int.class).newInstance(0,0,0),other=pos.getConstructor(int.class,int.class,int.class).newInstance(37,11,91),air=m(block,"stateById",int.class).invoke(null,0);final Object[] current={air},at={origin};
  Object world=Proxy.newProxyInstance(access.getClassLoader(),new Class[]{access},(o,method,a)->{Object s=a!=null&&a.length>0&&at[0].equals(a[0])?current[0]:air;if(method.getReturnType()==state)return s;if(method.getReturnType()==c("net.minecraft.world.level.material.FluidState"))return m(state,"getFluidState").invoke(s);if(method.getReturnType()==int.class)return 15;if(method.getReturnType()==boolean.class)return false;return null;});
  JsonArray definitions=new JsonParser().parse(Files.readString(Path.of(args[1]))).getAsJsonArray();Map<String,Object> offsets=new LinkedHashMap<>();List<Object> samples=new ArrayList<>();
  for(JsonElement row:definitions){JsonObject def=row.getAsJsonObject();Object s=m(block,"stateById",int.class).invoke(null,def.get("defaultState").getAsInt()),b=m(state,"getBlock").invoke(s);int type=((Enum<?>)m(block,"getOffsetType").invoke(b)).ordinal();if(type==0)continue;
   current[0]=s;at[0]=origin;List<Double> off=vector(m(state,"getOffset",access,pos).invoke(s,world,origin));double h=Math.abs(off.get(0)),v=type==2?Math.abs(off.get(1)):.2;
   try{h=((Number)m(block,"getMaxHorizontalOffset").invoke(b)).doubleValue();}catch(NoSuchMethodException ignored){}try{v=((Number)m(block,"getMaxVerticalOffset").invoke(b)).doubleValue();}catch(NoSuchMethodException ignored){}
   boolean selection=false,collision=false;
   for(int id=def.get("minStateId").getAsInt();id<=def.get("maxStateId").getAsInt();id++){
    current[0]=m(block,"stateById",int.class).invoke(null,id);at[0]=origin;List<List<Double>> sa=boxes(m(state,"getShape",access,pos).invoke(current[0],world,origin)),ca=boxes(m(state,"getCollisionShape",access,pos).invoke(current[0],world,origin));
    at[0]=other;List<Double> next=vector(m(state,"getOffset",access,pos).invoke(current[0],world,other));List<List<Double>> sb=boxes(m(state,"getShape",access,pos).invoke(current[0],world,other)),cb=boxes(m(state,"getCollisionShape",access,pos).invoke(current[0],world,other));
    selection|=shifted(sa,sb,off,next);collision|=shifted(ca,cb,off,next);
   }
   offsets.put(def.get("name").getAsString(),Map.of("type",type,"horizontal",h,"vertical",v,"origin",off,"selection",selection,"collision",collision));
   for(int[] coords:new int[][]{{0,0,0},{37,11,91},{-29,64,43},{29999999,100,-29999999}}){Object p=pos.getConstructor(int.class,int.class,int.class).newInstance(coords[0],coords[1],coords[2]);at[0]=p;current[0]=s;samples.add(Map.of("name",def.get("name").getAsString(),"position",coords,"offset",vector(m(state,"getOffset",access,pos).invoke(s,world,p))));}
  }
  Files.writeString(Path.of(args[2]),new Gson().toJson(Map.of("blocks",offsets,"samples",samples)));System.err.println("Native offset blocks: "+offsets.size());
 }
}
