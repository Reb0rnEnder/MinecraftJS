import java.lang.reflect.*;import java.nio.file.*;import java.util.*;import com.google.gson.*;
// Run native 1.15.2 constructors and record their final parts and actual UV-mapped quads.
// No renderer, window, graphics context, world or server is started.
class ExtractModels {
 static Map<String,String> classes=new HashMap<>(),original=new HashMap<>();static Map<String,Map<String,String>> fields=new HashMap<>();
 static Class<?> cls(String n)throws Exception{return Class.forName(classes.getOrDefault(n,n));}
 static Object field(Object o,String name)throws Exception{for(Class<?> c=o.getClass();c!=null;c=c.getSuperclass()){String own=original.get(c.getName()),ob=fields.getOrDefault(own,Map.of()).get(name);if(ob!=null){Field f=c.getDeclaredField(ob);f.setAccessible(true);return f.get(o);}}throw new NoSuchFieldException(o.getClass()+" "+name);}
 static float f(Object o,String name)throws Exception{return ((Number)field(o,name)).floatValue();}
 static Field modelField(Class<?> c,String owner,String name)throws Exception{
  Class<?> declared=cls(owner);if(declared.isAssignableFrom(c)){String ob=fields.getOrDefault(owner,Map.of()).get(name);if(ob!=null){Field f=declared.getDeclaredField(ob);f.setAccessible(true);return f;}}
  for(Class<?> k=c;k!=null;k=k.getSuperclass()){String ob=fields.getOrDefault(original.get(k.getName()),Map.of()).get(name);if(ob!=null){Field f=k.getDeclaredField(ob);f.setAccessible(true);return f;}}throw new NoSuchFieldException(c+" "+owner+"."+name);
 }
 static List<Float> vec(Object o)throws Exception{return Arrays.asList(f(o,"x"),f(o,"y"),f(o,"z"));}
 static List<Object> parts;static IdentityHashMap<Object,Integer> ids;
 static Integer part(Object p)throws Exception{
  if(p==null)return null;if(ids.containsKey(p))return ids.get(p);int id=parts.size();ids.put(p,id);Map<String,Object> result=new LinkedHashMap<>();parts.add(result);
  result.put("tw",f(p,"xTexSize"));result.put("th",f(p,"yTexSize"));result.put("p",Arrays.asList(f(p,"x"),f(p,"y"),f(p,"z")));result.put("r",Arrays.asList(f(p,"xRot"),f(p,"yRot"),f(p,"zRot")));result.put("mirror",field(p,"mirror"));result.put("show",field(p,"visible"));
  List<Object> boxes=new ArrayList<>();for(Object cube:(List<?>)field(p,"cubes")){
   List<Float> quads=new ArrayList<>();Object[] polygons=(Object[])field(cube,"polygons");
   for(Object polygon:polygons){if(polygon==null)continue;List<Float> n=vec(field(polygon,"normal"));for(Object v:(Object[])field(polygon,"vertices")){quads.addAll(vec(field(v,"pos")));quads.add(f(v,"u"));quads.add(f(v,"v"));quads.addAll(n);}}
   float x=f(cube,"minX"),y=f(cube,"minY"),z=f(cube,"minZ");boxes.add(Arrays.asList(0,0,x,y,z,f(cube,"maxX")-x,f(cube,"maxY")-y,f(cube,"maxZ")-z,0,false,quads));
  }result.put("boxes",boxes);List<Integer> children=new ArrayList<>();for(Object child:(List<?>)field(p,"children"))children.add(part(child));result.put("children",children);return id;
 }
 static Class<?>[] types(String d)throws Exception{List<Class<?>> out=new ArrayList<>();for(int i=1;d.charAt(i)!=')';i++){char c=d.charAt(i);if(c=='L'){int end=d.indexOf(';',i);out.add(Class.forName(classes.getOrDefault(d.substring(i+1,end).replace('/','.'),d.substring(i+1,end).replace('/','.')),false,ExtractModels.class.getClassLoader()));i=end;}else out.add(c=='F'?float.class:c=='Z'?boolean.class:c=='I'?int.class:c=='D'?double.class:long.class);}return out.toArray(Class<?>[]::new);}
 static Object value(JsonElement j,Class<?> type){if(j.isJsonNull())return null;if(type==float.class)return Float.valueOf(j.getAsFloat());if(type==boolean.class)return Boolean.valueOf(j.isJsonPrimitive()&&j.getAsJsonPrimitive().isBoolean()?j.getAsBoolean():j.getAsInt()!=0);if(type==int.class)return Integer.valueOf(j.getAsInt());if(type==double.class)return Double.valueOf(j.getAsDouble());return Long.valueOf(j.getAsLong());}
 public static void main(String[]args)throws Exception{
  String owner=null;for(String line:Files.readAllLines(Path.of(args[0]))){if(!line.startsWith(" ")&&line.contains(" -> ")){String[] s=line.substring(0,line.length()-1).split(" -> ");owner=s[0];classes.put(s[0],s[1]);original.put(s[1],s[0]);}else if(line.startsWith("    ")&&!line.contains("(")&&line.contains(" -> ")){String[] s=line.trim().split(" -> "),left=s[0].split(" ");fields.computeIfAbsent(owner,k->new HashMap<>()).put(left[1],s[1]);}}
  cls("net.minecraft.server.Bootstrap").getMethod("a").invoke(null);
  JsonObject specs=new JsonParser().parse(Files.readString(Path.of(args[1]))).getAsJsonObject();Map<String,Object> models=new LinkedHashMap<>(),errors=new LinkedHashMap<>();
  for(Map.Entry<String,JsonElement> entry:specs.entrySet())try{
   JsonObject s=entry.getValue().getAsJsonObject();Class<?> c=cls(s.get("class").getAsString());Class<?>[] types=types(s.get("descriptor").getAsString());Object[] a=new Object[types.length];for(int i=0;i<a.length;i++)a[i]=value(s.getAsJsonArray("args").get(i),types[i]);Constructor<?> constructor=c.getDeclaredConstructor(types);constructor.setAccessible(true);Object model=constructor.newInstance(a);
   parts=new ArrayList<>();ids=new IdentityHashMap<>();List<Object> indexes=new ArrayList<>();
   for(JsonElement el:s.getAsJsonArray("fields")){JsonObject q=el.getAsJsonObject();Object val=modelField(c,q.get("owner").getAsString(),q.get("name").getAsString()).get(model);if(q.has("index"))val=((List<?>)val).get(q.get("index").getAsInt());if(q.has("children"))for(JsonElement child:q.getAsJsonArray("children"))val=((List<?>)field(val,"children")).get(child.getAsInt());if(val instanceof Iterable<?>){List<Integer> ar=new ArrayList<>();for(Object p:(Iterable<?>)val)ar.add(part(p));indexes.add(ar);}else if(val!=null&&val.getClass().isArray()){List<Integer> ar=new ArrayList<>();for(Object p:(Object[])val)ar.add(part(p));indexes.add(ar);}else indexes.add(part(val));}
   List<Object> nums=new ArrayList<>();try{nums.add(field(model,"yHeadOffset"));nums.add(field(model,"zHeadOffset"));}catch(NoSuchFieldException ignored){}
   models.put(entry.getKey(),Map.of("fields",indexes,"parts",parts,"nums",nums,"nativeClass",s.get("class").getAsString()));
  }catch(Throwable ex){Throwable cause=ex instanceof InvocationTargetException?ex.getCause():ex;cause.printStackTrace();errors.put(entry.getKey(),cause.toString());}
  Files.writeString(Path.of(args[2]),new Gson().toJson(Map.of("models",models,"errors",errors)));
 }
}
