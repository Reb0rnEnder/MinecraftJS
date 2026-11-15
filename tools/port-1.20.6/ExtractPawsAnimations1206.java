import java.lang.reflect.*;import java.nio.file.*;import java.util.*;import com.google.gson.*;
public class ExtractPawsAnimations1206 extends ExtractCreative1206 {
 public static void main(String[] args)throws Exception{
  loadMappings(Path.of(args[1]));m(c("net.minecraft.SharedConstants"),"tryDetectVersion").invoke(null);m(c("net.minecraft.server.Bootstrap"),"bootStrap").invoke(null);
  Class<?> definition=c("net.minecraft.client.animation.AnimationDefinition"),channel=c("net.minecraft.client.animation.AnimationChannel"),keyframe=c("net.minecraft.client.animation.Keyframe"),targets=c("net.minecraft.client.animation.AnimationChannel$Targets"),interpolations=c("net.minecraft.client.animation.AnimationChannel$Interpolations");
  Map<Object,String> targetNames=new IdentityHashMap<>(),interpolationNames=new IdentityHashMap<>();for(String n:new String[]{"POSITION","ROTATION","SCALE"})targetNames.put(f(targets,n).get(null),n.toLowerCase(Locale.ROOT));for(String n:new String[]{"LINEAR","CATMULLROM"})interpolationNames.put(f(interpolations,n).get(null),n.toLowerCase(Locale.ROOT));
  Map<String,Object> result=new LinkedHashMap<>();
  for(String model:new String[]{"Armadillo"}){
   String owner="net.minecraft.client.animation.definitions."+model+"Animation";Class<?> cls=c(owner);Map<String,Object> animations=new LinkedHashMap<>();
   for(Map.Entry<String,String> entry:fieldNames.get(owner).entrySet()){
    Field field=cls.getDeclaredField(entry.getValue());if(field.getType()!=definition)continue;field.setAccessible(true);Object animation=field.get(null);Map<String,Object> bones=new LinkedHashMap<>();
    for(Map.Entry<?,?> bone:((Map<?,?>)m(definition,"boneAnimations").invoke(animation)).entrySet()){
     List<Object> channels=new ArrayList<>();for(Object ch:(List<?>)bone.getValue()){
      List<Object> frames=new ArrayList<>();for(Object frame:(Object[])m(channel,"keyframes").invoke(ch)){
       Object vector=m(keyframe,"target").invoke(frame);List<Float> xyz=new ArrayList<>();for(String n:new String[]{"x","y","z"})xyz.add(f(vector.getClass(),n).getFloat(vector));String interpolation=interpolationNames.get(m(keyframe,"interpolation").invoke(frame));if(interpolation==null)throw new IllegalStateException("Unmapped interpolation");frames.add(Arrays.asList(m(keyframe,"timestamp").invoke(frame),xyz,interpolation));
      }String target=targetNames.get(m(channel,"target").invoke(ch));if(target==null)throw new IllegalStateException("Unmapped animation target");channels.add(Map.of("target",target,"frames",frames));
     }bones.put(bone.getKey().toString(),channels);
    }animations.put(entry.getKey(),Map.of("length",m(definition,"lengthInSeconds").invoke(animation),"looping",m(definition,"looping").invoke(animation),"bones",bones));
   }result.put(model.toLowerCase(Locale.ROOT),animations);
  }Files.writeString(Path.of(args[0]),new Gson().toJson(result));System.out.println("Extracted native keyframe animation families: "+result.size());
 }
}
