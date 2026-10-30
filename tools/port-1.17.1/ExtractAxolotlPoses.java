import java.lang.reflect.*;import java.nio.file.*;import java.util.*;import com.google.gson.Gson;
// Invoke only the native model's numeric pose methods. No entity/world/server or
// graphics context is constructed. Member aliases come from official mappings.
class ExtractAxolotlPoses {
 static Map<String,String> classes=new HashMap<>();static Map<String,Map<String,String>> members=new HashMap<>();
 static void mappings(Path path)throws Exception{String owner=null;for(String line:Files.readAllLines(path)){
  if(!line.startsWith(" ")&&line.contains(" -> ")){String[] p=line.substring(0,line.length()-1).split(" -> ");owner=p[0];classes.put(owner,p[1]);}
  else if(owner!=null&&line.startsWith("    ")&&line.contains(" -> ")){String[] p=line.trim().split(" -> ");String left=p[0].replaceFirst("^(?:[0-9]+:[0-9]+:)+","");int space=left.indexOf(' ');if(space>=0)members.computeIfAbsent(owner,k->new HashMap<>()).put(left.substring(space+1),p[1]);}
 }}
 static Class<?> cls(String name)throws Exception{return Class.forName(classes.getOrDefault(name,name));}
 static Field field(String owner,String name)throws Exception{Field f=cls(owner).getDeclaredField(members.get(owner).get(name));f.setAccessible(true);return f;}
 static final String MODEL="net.minecraft.client.model.AxolotlModel",PART="net.minecraft.client.model.geom.ModelPart";
 static String[] names={"body","head","tail","rightFrontLeg","leftFrontLeg","rightHindLeg","leftHindLeg","topGills","leftGills","rightGills"};
 public static void main(String[]args)throws Exception{
  mappings(Path.of(args[0]));Class<?> u=Class.forName("sun.misc.Unsafe");Field uf=u.getDeclaredField("theUnsafe");uf.setAccessible(true);Object unsafe=uf.get(null);Method allocate=u.getMethod("allocateInstance",Class.class);
  List<Object> cases=new ArrayList<>();String[] states={"groundIdle","groundMoving","waterIdle","waterMoving","playingDead"};
  for(String state:states){Object model=allocate.invoke(unsafe,cls(MODEL));Map<String,Object> parts=new LinkedHashMap<>();
   for(String name:names){Object part=allocate.invoke(unsafe,cls(PART));field(MODEL,name).set(model,part);parts.put(name,part);}
   field(PART,"xRot").setFloat(parts.get("body"),(float)(12*Math.PI/180));field(PART,"yRot").setFloat(parts.get("body"),(float)(25*Math.PI/180));
   String method=switch(state){case "groundIdle"->"setupLayStillOnGroundAnimation";case "groundMoving"->"setupGroundCrawlingAnimation";case "waterIdle"->"setupWaterHoveringAnimation";case "waterMoving"->"setupSwimmingAnimation";default->"setupPlayDeadAnimation";};
   boolean one=state.equals("waterIdle")||state.equals("playingDead");String signature=method+(one?"(float)":"(float,float)");
   Method pose=cls(MODEL).getDeclaredMethod(members.get(MODEL).get(signature),one?new Class<?>[]{float.class}:new Class<?>[]{float.class,float.class});pose.setAccessible(true);
   for(int frame=0;frame<45;frame++){
    float age=frame/2f+7f;field(PART,"y").setFloat(parts.get("body"),20f);
    if(one)pose.invoke(model,state.equals("playingDead")?25f:age);else pose.invoke(model,age,state.equals("waterMoving")?12f:25f);
    if(frame==0||frame==1||frame==9||frame==44){Map<String,Object> values=new LinkedHashMap<>();for(var entry:parts.entrySet()){Object p=entry.getValue();List<Float> transform=new ArrayList<>();for(String key:new String[]{"xRot","yRot","zRot","y"})transform.add(field(PART,key).getFloat(p));values.put(entry.getKey(),transform);}cases.add(Map.of("state",state,"frame",frame,"age",age,"yaw",25,"pitch",12,"parts",values));}
   }
  }
  Files.writeString(Path.of(args[1]),new Gson().toJson(cases));System.out.println("Native axolotl pose samples: "+cases.size());
 }
}
