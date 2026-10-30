import java.lang.reflect.*;import java.nio.file.*;import java.util.*;import java.io.*;import com.google.gson.*;
// Pinned 1.14.4 aliases verified in official client.txt. No graphics context is created.
public class ExtractRuntime {
 static Class<?> c(String n)throws Exception{return Class.forName(n);}static Object call(Object o,String n,Class<?>[] t,Object...a)throws Exception{return o.getClass().getMethod(n,t).invoke(o,a);}
 static List<Double> box(Object b)throws Exception{List<Double> v=new ArrayList<>();for(String n:new String[]{"a","b","c","d","e","f"})v.add(b.getClass().getField(n).getDouble(b));return v;}
 public static void main(String[] args)throws Exception{
  c("qx").getMethod("a").invoke(null);Class<?> tabs=c("bba"),stack=c("bcj"),item=c("bce"),list=c("fk"),tag=c("id");
  Map<String,Object> output=new LinkedHashMap<>();List<Object> catalog=new ArrayList<>();
  for(Object tab:(Object[])tabs.getField("a").get(null)){
   Object values=list.getMethod("a").invoke(null);String label=(String)tabs.getMethod("b").invoke(tab);if(!Arrays.asList("hotbar","inventory").contains(label))tabs.getMethod("a",list).invoke(tab,values);
   Map<String,Object> t=new LinkedHashMap<>();t.put("index",tabs.getMethod("a").invoke(tab));t.put("label",tabs.getMethod("b").invoke(tab));
   List<Object> entries=new ArrayList<>();for(Object it:(List<?>)values){Object ob=stack.getMethod("b").invoke(it);int id=(int)item.getMethod("a",item).invoke(null,ob);Object nbt=stack.getMethod("o").invoke(it);String bytes=null;if(nbt!=null){ByteArrayOutputStream b=new ByteArrayOutputStream();c("io").getMethod("a",tag,DataOutput.class).invoke(null,nbt,new DataOutputStream(b));bytes=Base64.getEncoder().encodeToString(b.toByteArray());}entries.add(Arrays.asList(id,0,bytes));}
   Object icon=tabs.getMethod("e").invoke(tab);int iconId=(int)item.getMethod("a",item).invoke(null,stack.getMethod("b").invoke(icon));t.put("icon",Arrays.asList(iconId,0,null));t.put("items",entries);t.put("title",tabs.getMethod("h").invoke(tab));t.put("scroll",tabs.getMethod("j").invoke(tab));t.put("column",tabs.getMethod("l").invoke(tab));t.put("top",tabs.getMethod("m").invoke(tab));t.put("background",tabs.getMethod("g").invoke(tab));catalog.add(t);
  }output.put("tabs",catalog);
  Map<String,Object> mechanics=new LinkedHashMap<>(),eggs=new LinkedHashMap<>(),effects=new LinkedHashMap<>(),enchants=new LinkedHashMap<>();
  for(int id=0;id<877;id++){
   Object it=item.getMethod("b",int.class).invoke(null,id),s=item.getMethod("q").invoke(it);Map<String,Object> m=new LinkedHashMap<>();
   m.put("action",((Enum<?>)item.getMethod("e_",stack).invoke(it,s)).name().toLowerCase(Locale.ROOT));m.put("duration",item.getMethod("f_",stack).invoke(it,s));m.put("food",item.getMethod("r").invoke(it));
   Object food=item.getMethod("s").invoke(it);if(food!=null){Class<?> f=c("ayh");m.put("alwaysEat",f.getMethod("d").invoke(food));m.put("nutrition",f.getMethod("a").invoke(food));m.put("saturation",f.getMethod("b").invoke(food));}
   mechanics.put(""+id,m);
   if(c("bdh").isInstance(it))eggs.put(""+id,Arrays.asList(c("bdh").getMethod("a",int.class).invoke(it,0),c("bdh").getMethod("a",int.class).invoke(it,1)));
  }
  Class<?> effect=c("aig");for(int id=1;id<=32;id++){Object e=effect.getMethod("a",int.class).invoke(null,id);Map<String,Object> m=new LinkedHashMap<>();m.put("name",effect.getMethod("c").invoke(e));m.put("color",effect.getMethod("f").invoke(e));m.put("bad",((Enum<?>)effect.getMethod("e").invoke(e)).ordinal()==1);m.put("beneficial",effect.getMethod("h").invoke(e));effects.put(""+id,m);}
  Class<?> enchant=c("bfs");for(int id=0;id<37;id++){Object e=enchant.getMethod("c",int.class).invoke(null,id);Map<String,Object> m=new LinkedHashMap<>();m.put("maxLevel",enchant.getMethod("a").invoke(e));m.put("treasureOnly",enchant.getMethod("b").invoke(e));m.put("curse",enchant.getMethod("c").invoke(e));enchants.put(""+id,m);}
  output.put("itemMechanics",mechanics);output.put("eggs",eggs);output.put("effects",effects);output.put("enchantments",enchants);
  Class<?> gene=c("arl$a");Method variant=gene.getDeclaredMethod("b",gene,gene);variant.setAccessible(true);List<Object> pandaVariants=new ArrayList<>();
  for(Object main:(Object[])gene.getMethod("values").invoke(null)){List<Object> row=new ArrayList<>();for(Object hidden:(Object[])gene.getMethod("values").invoke(null))row.add(gene.getMethod("b").invoke(variant.invoke(null,main,hidden)));pandaVariants.add(row);}output.put("pandaVariants",pandaVariants);
  Field poseField=c("awg").getDeclaredField("b");poseField.setAccessible(true);Map<String,Object> poses=new LinkedHashMap<>();
  for(Map.Entry<?,?> entry:((Map<?,?>)poseField.get(null)).entrySet()){Object d=entry.getValue();poses.put(((Enum<?>)entry.getKey()).name().toLowerCase(Locale.ROOT),Arrays.asList(d.getClass().getField("a").getFloat(d),d.getClass().getField("b").getFloat(d)));}output.put("playerPoses",poses);
  Map<String,Object> textColors=new LinkedHashMap<>();for(Object dye:(Object[])c("bbg").getMethod("values").invoke(null))textColors.put((String)c("bbg").getMethod("b").invoke(dye),c("bbg").getMethod("g").invoke(dye));output.put("dyeTextColors",textColors);
  Class<?> block=c("bmv"),state=c("bvt"),access=c("bhb"),pos=c("ew");Object origin=pos.getConstructor(int.class,int.class,int.class).newInstance(0,0,0),air=block.getMethod("a",int.class).invoke(null,0);final Object[] current={air};
  Object world=Proxy.newProxyInstance(access.getClassLoader(),new Class[]{access},(o,m,a)->{Object s=a!=null&&a.length>0&&origin.equals(a[0])?current[0]:air;if(m.getReturnType()==state)return s;if(m.getReturnType().getName().equals("clk"))return state.getMethod("p").invoke(s);if(m.getReturnType()==int.class)return m.getName().equals("H")?15:256;if(m.getReturnType()==boolean.class)return false;return null;});
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
    Object sound=state.getMethod("r").invoke(s);Class<?> soundType=c("bry");List<Object> sounds=new ArrayList<>();
    for(String method:new String[]{"d","c","e"})sounds.add(c("yo").getMethod("a").invoke(soundType.getMethod(method).invoke(sound)).toString().replace("minecraft:",""));
    sounds.add(soundType.getMethod("a").invoke(sound));sounds.add(soundType.getMethod("b").invoke(sound));
    for(String method:new String[]{"f","g"})sounds.add(c("yo").getMethod("a").invoke(soundType.getMethod(method).invoke(sound)).toString().replace("minecraft:",""));render.put("sound",sounds);
    Object occlusion=state.getMethod("j",access,pos).invoke(s,world,origin);List<Object> ob=new ArrayList<>();
    for(Object b:(List<?>)call(occlusion,"d",new Class[]{}))ob.add(box(b));render.put("occlusion",ob);
    rendering.add(render);
  }catch(Exception e){selections.add(null);collisions.add(null);errors.add(id+":"+e.toString());}}
  output.put("selections",selections);output.put("collisions",collisions);Map<String,Object> metadata=new LinkedHashMap<>();
  for(String[] pair:new String[][]{{"player","awg"},{"cat","arb"},{"fox","arh"},{"panda","arl"},{"villager","avt"},{"zombie_villager","avn"}}){
    Map<String,Object> fields=new LinkedHashMap<>();
    for(Class<?> cls=c(pair[1]);cls!=null;cls=cls.getSuperclass())for(Field f:cls.getDeclaredFields())if(Modifier.isStatic(f.getModifiers())&&f.getType()==c("qk")){f.setAccessible(true);fields.put(cls.getName()+"."+f.getName(),c("qk").getMethod("a").invoke(f.get(null)));}
    metadata.put(pair[0],fields);
  }
  output.put("entityMetadata",metadata);
  output.put("rendering",rendering);output.put("errors",errors);Files.writeString(Path.of(args[0]),new Gson().toJson(output));
 }
}
