import java.lang.reflect.*;import java.nio.file.*;import java.util.*;import java.io.*;import com.google.gson.*;
// Pinned 1.14.4 aliases verified in official client.txt. No graphics context is created.
public class ExtractRuntime {
 static Class<?> c(String n)throws Exception{return Class.forName(n);}static Object call(Object o,String n,Class<?>[] t,Object...a)throws Exception{return o.getClass().getMethod(n,t).invoke(o,a);}
 static List<Double> box(Object b)throws Exception{List<Double> v=new ArrayList<>();for(String n:new String[]{"a","b","c","d","e","f"})v.add(b.getClass().getField(n).getDouble(b));return v;}
 public static void main(String[] args)throws Exception{
  c("qx").getMethod("a").invoke(null);Class<?> tabs=c("bba"),stack=c("bcj"),item=c("bce"),list=c("fk"),tag=c("id");
  Map<String,Object> output=new LinkedHashMap<>();List<Object> catalog=new ArrayList<>();
  for(Object tab:(Object[])tabs.getField("a").get(null)){
   Object values=list.getMethod("a").invoke(null);String label=(String)tabs.getMethod("b").invoke(tab);if(!Arrays.asList("search","hotbar","inventory").contains(label))tabs.getMethod("a",list).invoke(tab,values);
   Map<String,Object> t=new LinkedHashMap<>();t.put("index",tabs.getMethod("a").invoke(tab));t.put("label",tabs.getMethod("b").invoke(tab));
   List<Object> entries=new ArrayList<>();for(Object it:(List<?>)values){Object ob=stack.getMethod("b").invoke(it);int id=(int)item.getMethod("a",item).invoke(null,ob);Object nbt=stack.getMethod("o").invoke(it);String bytes=null;if(nbt!=null){ByteArrayOutputStream b=new ByteArrayOutputStream();c("io").getMethod("a",tag,DataOutput.class).invoke(null,nbt,new DataOutputStream(b));bytes=Base64.getEncoder().encodeToString(b.toByteArray());}entries.add(Arrays.asList(id,0,bytes));}
   Object icon=tabs.getMethod("e").invoke(tab);int iconId=(int)item.getMethod("a",item).invoke(null,stack.getMethod("b").invoke(icon));t.put("icon",Arrays.asList(iconId,0,null));t.put("items",entries);t.put("title",tabs.getMethod("h").invoke(tab));t.put("scroll",tabs.getMethod("j").invoke(tab));t.put("column",tabs.getMethod("l").invoke(tab));t.put("top",tabs.getMethod("m").invoke(tab));t.put("background",tabs.getMethod("g").invoke(tab));catalog.add(t);
  }output.put("tabs",catalog);
  Class<?> block=c("bmv"),state=c("bvt"),access=c("bhb"),pos=c("ew");Object origin=pos.getConstructor(int.class,int.class,int.class).newInstance(0,0,0),air=block.getMethod("a",int.class).invoke(null,0);final Object[] current={air};
  Object world=Proxy.newProxyInstance(access.getClassLoader(),new Class[]{access},(o,m,a)->{Object s=a!=null&&a.length>0&&origin.equals(a[0])?current[0]:air;if(m.getReturnType()==state)return s;if(m.getReturnType().getName().equals("clk"))return state.getMethod("p").invoke(s);if(m.getReturnType()==int.class)return 256;if(m.getReturnType()==boolean.class)return false;return null;});
  List<Object> selections=new ArrayList<>(),collisions=new ArrayList<>(),rendering=new ArrayList<>();List<String> errors=new ArrayList<>();
  for(int id=0;id<11271;id++){Object s=block.getMethod("a",int.class).invoke(null,id);current[0]=s;try{Object shape=state.getMethod("h",access,pos).invoke(s,world,origin);boolean empty=(boolean)call(shape,"b",new Class[]{});selections.add(empty?null:box(call(shape,"a",new Class[]{})));Object col=state.getMethod("i",access,pos).invoke(s,world,origin);List<Object> boxes=new ArrayList<>();for(Object b:(List<?>)call(col,"d",new Class[]{}))boxes.add(box(b));collisions.add(boxes);
    Map<String,Object> render=new LinkedHashMap<>();
    render.put("renderType",((Enum<?>)state.getMethod("k").invoke(s)).ordinal());
    render.put("viewBlocking",state.getMethod("m",access,pos).invoke(s,world,origin));
    render.put("solid",state.getMethod("g",access,pos).invoke(s,world,origin));
    render.put("occludes",state.getMethod("o").invoke(s));
    render.put("lightBlock",state.getMethod("b",access,pos).invoke(s,world,origin));
    render.put("shade",state.getMethod("d",access,pos).invoke(s,world,origin));
    render.put("emission",state.getMethod("h").invoke(s));
    render.put("collisionFull",state.getMethod("o",access,pos).invoke(s,world,origin));
    Object occlusion=state.getMethod("j",access,pos).invoke(s,world,origin);List<Object> ob=new ArrayList<>();
    for(Object b:(List<?>)call(occlusion,"d",new Class[]{}))ob.add(box(b));render.put("occlusion",ob);
    rendering.add(render);
  }catch(Exception e){selections.add(null);collisions.add(null);errors.add(id+":"+e.toString());}}
  output.put("selections",selections);output.put("collisions",collisions);Map<String,Object> metadata=new LinkedHashMap<>();
  for(String[] pair:new String[][]{{"cat","arb"},{"fox","arh"},{"panda","arl"},{"villager","avt"},{"zombie_villager","avn"}}){
    Map<String,Object> fields=new LinkedHashMap<>();
    for(Class<?> cls=c(pair[1]);cls!=null;cls=cls.getSuperclass())for(Field f:cls.getDeclaredFields())if(Modifier.isStatic(f.getModifiers())&&f.getType()==c("qk")){f.setAccessible(true);fields.put(cls.getName()+"."+f.getName(),c("qk").getMethod("a").invoke(f.get(null)));}
    metadata.put(pair[0],fields);
  }
  output.put("entityMetadata",metadata);
  output.put("rendering",rendering);output.put("errors",errors);Files.writeString(Path.of(args[0]),new Gson().toJson(output));
 }
}
