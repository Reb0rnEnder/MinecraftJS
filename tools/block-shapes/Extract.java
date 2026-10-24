import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;
import com.google.gson.*;

// Executes the pinned client jar. Extra classpath entries supply only third-party libraries.
// The Node wrapper verifies the jar version/hash and compacts these results for the client.
public class Extract {
  static Method method(Class<?> c,String n,Class<?>... a)throws Exception{Method m=c.getMethod(n,a);m.setAccessible(true);return m;}
  static Class<?> cls(String n)throws Exception{return Class.forName(n);}
  static Object invoke(Object o,String n,Class<?>[] types,Object...args)throws Exception{return method(o.getClass(),n,types).invoke(o,args);}
  static List<Double> box(Object a)throws Exception{
    if(a==null)return null;
    List<Double> out=new ArrayList<>();
    for(Field f:a.getClass().getFields())if(f.getType()==double.class&&!Modifier.isStatic(f.getModifiers())){f.setAccessible(true);out.add(f.getDouble(a));}
    if(out.size()!=6)throw new IllegalStateException("Expected six AABB coordinates: "+a);
    return out;
  }
  public static void main(String[] args)throws Exception{
    String version=args[0];boolean native13=version.equals("1.13.2"),old=version.equals("1.8.9");
    Class<?> boot=cls(native13?"pf":old?"kb":"ni");method(boot,"c").invoke(null);
    Class<?> block=cls(native13?"bcs":old?"afh":"aow"),state=cls(native13?"blc":old?"alz":"awt"),access=cls(native13?"axk":old?"adq":"amy"),pos=cls(native13?"el":old?"cj":"et");
    Object origin=pos.getConstructor(int.class,int.class,int.class).newInstance(0,0,0);
    Object air=native13?method(block,"a",int.class).invoke(null,0):method(block,"c",int.class).invoke(null,0);
    if(!native13)air=method(block,"a",int.class).invoke(air,0);
    final Object empty=air;final Object[] current={air};
    Object world=Proxy.newProxyInstance(access.getClassLoader(),new Class[]{access},(o,m,a)->{
      if(m.getReturnType()==state)return a!=null&&a.length>0&&origin.equals(a[0])?current[0]:empty;
      if(native13 && m.getReturnType().getName().equals("byw"))return method(state,"s").invoke(a!=null&&origin.equals(a[0])?current[0]:empty);
      if(m.getReturnType()==int.class)return 15;
      if(m.getReturnType()==boolean.class)return false;
      if(m.getName().equals("toString"))return "ShapeExtractionWorld";
      return null;
    });
    Gson gson=new GsonBuilder().serializeNulls().create();
    JsonArray defs=new JsonParser().parse(Files.readString(Path.of(args[1]))).getAsJsonArray();
    Map<String,Object> entries=new TreeMap<>();List<String> errors=new ArrayList<>();
    for(JsonElement entry:defs){JsonObject def=entry.getAsJsonObject();int id=def.get("id").getAsInt();String name=def.get("name").getAsString();
      int min=native13?def.get("minStateId").getAsInt():id<<4,max=native13?def.get("maxStateId").getAsInt():(id<<4)+15;
      Object legacy=native13?null:method(block,"c",int.class).invoke(null,id);
      for(int key=min;key<=max;key++)try{
        Object s=native13?method(block,"a",int.class).invoke(null,key):method(block,"a",int.class).invoke(legacy,key&15);current[0]=s;
        Object b=native13?method(state,"c").invoke(s):legacy;
        List<Double> bounds;
        Map<String,Object> row=new LinkedHashMap<>();
        if(native13){
          String actual=s.toString();if(!actual.startsWith("Block{minecraft:"+name+"}"))throw new IllegalStateException("Registry mismatch "+key+": "+actual+" expected "+name);
          Object shape=method(block,"a",state,access,pos).invoke(b,s,world,origin);
          boolean isEmpty=(Boolean)invoke(shape,"b",new Class[]{});
          bounds=isEmpty?null:box(invoke(shape,"a",new Class[]{}));
          Object collision=method(block,"f",state,access,pos).invoke(b,s,world,origin);
          List<?> boxes=(List<?>)invoke(collision,"d",new Class[]{});List<Object> coll=new ArrayList<>();for(Object bx:boxes)coll.add(box(bx));row.put("collision",coll);
          row.put("fullCube",method(block,"a",state).invoke(b,s));
          row.put("state",actual);
        }else if(!old){
          Object actual=method(block,"d",state,access,pos).invoke(b,s,world,origin);
          bounds=box(method(block,"b",state,access,pos).invoke(b,actual,world,origin));
        }else{
          Method reset=block.getDeclaredMethod("a",float.class,float.class,float.class,float.class,float.class,float.class);reset.setAccessible(true);reset.invoke(b,0f,0f,0f,1f,1f,1f);
          method(block,"a",access,pos).invoke(b,world,origin);
          try { bounds=box(method(block,"b",cls("adm"),pos).invoke(b,null,origin)); }
          catch (InvocationTargetException e) {
            // Some 1.8 render bounds methods redundantly ask the World for state. The live
            // IBlockAccess update just set those same six fields; only use that fallback
            // when the block actually overrides the state-dependent bounds update.
            if (b.getClass().getMethod("a",access,pos).getDeclaringClass()==block) throw e;
            bounds=new ArrayList<>();for(String field:new String[]{"B","C","D","E","F","G"}){Field f=block.getDeclaredField(field);f.setAccessible(true);bounds.add(f.getDouble(b));}
          }
        }
        row.put("selection",bounds);entries.put(Integer.toString(key),row);
      }catch(Exception e){Throwable cause=e instanceof InvocationTargetException?e.getCause():e;errors.add(key+" "+name+": "+cause);}
    }
    Map<String,Object> result=new LinkedHashMap<>();result.put("entries",entries);result.put("errors",errors);
    Files.writeString(Path.of(args[2]),gson.toJson(result));
    System.err.println(version+": "+entries.size()+" states, "+errors.size()+" failures");
  }
}
