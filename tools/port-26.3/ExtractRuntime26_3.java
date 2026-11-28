import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;
import com.google.gson.*;

// Executes the unobfuscated 26.3 client. No graphics context is created: Bootstrap
// binds the registries, EmptyBlockGetter supplies the canonical empty world, and every
// value below is read from the native BlockState/Block methods. 26.3 removed
// ItemBlockRenderTypes and RenderShape.ENTITYBLOCK_ANIMATED; renderType is normalised
// to the historical 0/2 schema (INVISIBLE/MODEL) so the shared client keeps one shape.
public class ExtractRuntime26_3 {
  static Method m(Class<?> c,String name,Class<?>...args)throws Exception{
    for(Class<?> k=c;k!=null;k=k.getSuperclass()){
      try{Method x=k.getDeclaredMethod(name,args);x.setAccessible(true);return x;}catch(NoSuchMethodException ignored){}
    }
    throw new NoSuchMethodException(c.getName()+"."+name);
  }
  static Object call(Object o,String name,Class<?>[] types,Object...args)throws Exception{
    return m(o.getClass(),name,types).invoke(o,args);
  }
  static List<Double> box(Object aabb)throws Exception{
    List<Double> out=new ArrayList<>();
    for(String name:new String[]{"minX","minY","minZ","maxX","maxY","maxZ"})out.add(aabb.getClass().getField(name).getDouble(aabb));
    return out;
  }
  static List<Double> vector(Object vec)throws Exception{
    List<Double> out=new ArrayList<>();
    for(String name:new String[]{"x","y","z"})out.add(vec.getClass().getField(name).getDouble(vec));
    return out;
  }
  static List<List<Double>> boxes(Object shape)throws Exception{
    List<List<Double>> out=new ArrayList<>();
    for(Object aabb:(List<?>)call(shape,"toAabbs",new Class[]{}))out.add(box(aabb));
    return out;
  }
  static boolean shifted(List<List<Double>> a,List<List<Double>> b,List<Double> from,List<Double> to)throws Exception{
    if(a.equals(b))return false;
    if(a.size()!=b.size())throw new IllegalStateException("Position-dependent offset shape changed topology");
    for(int i=0;i<a.size();i++)for(int j=0;j<6;j++)
      if(Math.abs(b.get(i).get(j)-a.get(i).get(j)-(to.get(j%3)-from.get(j%3)))>1e-7)
        throw new IllegalStateException("Offset shape is not a translation");
    return true;
  }
  public static void main(String[] args)throws Exception{
    Path definitionsPath=Path.of(args[1]);
    m(Class.forName("net.minecraft.SharedConstants"),"tryDetectVersion").invoke(null);
    m(Class.forName("net.minecraft.server.Bootstrap"),"bootStrap").invoke(null);

    Class<?> block=Class.forName("net.minecraft.world.level.block.Block");
    Class<?> state=Class.forName("net.minecraft.world.level.block.state.BlockState");
    Class<?> access=Class.forName("net.minecraft.world.level.BlockGetter");
    Class<?> pos=Class.forName("net.minecraft.core.BlockPos");
    Class<?> direction=Class.forName("net.minecraft.core.Direction");
    Class<?> aabb=Class.forName("net.minecraft.world.phys.AABB");
    Object empty=Class.forName("net.minecraft.world.level.EmptyBlockGetter").getField("INSTANCE").get(null);
    Object origin=pos.getConstructor(int.class,int.class,int.class).newInstance(0,0,0);
    Object other=pos.getConstructor(int.class,int.class,int.class).newInstance(37,11,91);
    Object entityBox=aabb.getConstructor(double.class,double.class,double.class,double.class,double.class,double.class).newInstance(0.0,0.0,0.0,1.0,1.0,1.0);
    Object up=direction.getField("UP").get(null),down=direction.getField("DOWN").get(null);
    Object modelShape=Class.forName("net.minecraft.world.level.block.RenderShape").getField("MODEL").get(null);

    JsonArray definitions=new JsonParser().parse(Files.readString(definitionsPath)).getAsJsonArray();
    int stateCount=0;
    for(JsonElement row:definitions)stateCount=Math.max(stateCount,row.getAsJsonObject().get("maxStateId").getAsInt()+1);

    List<Object> selections=new ArrayList<>(),collisions=new ArrayList<>(),rendering=new ArrayList<>();
    List<String> errors=new ArrayList<>();
    for(int id=0;id<stateCount;id++){
      try{
        Object s=m(block,"stateById",int.class).invoke(null,id);
        Object shape=m(state,"getShape",access,pos).invoke(s,empty,origin);
        selections.add((boolean)call(shape,"isEmpty",new Class[]{})?null:box(call(shape,"bounds",new Class[]{})));
        collisions.add(boxes(m(state,"getCollisionShape",access,pos).invoke(s,empty,origin)));

        Map<String,Object> render=new LinkedHashMap<>();
        render.put("renderType",m(state,"getRenderShape").invoke(s).equals(modelShape)?2:0);
        render.put("suffocates",m(state,"isSuffocating",access,pos).invoke(s,empty,origin));
        render.put("viewBlocking",m(state,"isViewBlocking",access,pos,aabb).invoke(s,empty,origin,entityBox));
        render.put("solid",m(state,"isSolidRender").invoke(s));
        render.put("occludes",m(state,"canOcclude").invoke(s));
        render.put("lightBlock",m(state,"getLightDampening").invoke(s));
        render.put("shade",m(state,"getShadeBrightness",access,pos).invoke(s,empty,origin));
        render.put("emission",m(state,"getLightEmission").invoke(s));
        render.put("collisionFull",m(state,"isCollisionShapeFullBlock",access,pos).invoke(s,empty,origin));
        render.put("sturdyTop",m(state,"isFaceSturdy",access,pos,direction).invoke(s,empty,origin,up));
        render.put("sturdyBottom",m(state,"isFaceSturdy",access,pos,direction).invoke(s,empty,origin,down));

        Object sound=m(state,"getSoundType").invoke(s);
        Class<?> soundType=Class.forName("net.minecraft.world.level.block.SoundType");
        Class<?> soundEvent=Class.forName("net.minecraft.sounds.SoundEvent");
        List<Object> sounds=new ArrayList<>();
        for(String method:new String[]{"getStepSound","getBreakSound","getPlaceSound"})
          sounds.add(m(soundEvent,"location").invoke(m(soundType,method).invoke(sound)).toString().replace("minecraft:",""));
        sounds.add(m(soundType,"getVolume").invoke(sound));
        sounds.add(m(soundType,"getPitch").invoke(sound));
        for(String method:new String[]{"getHitSound","getFallSound"})
          sounds.add(m(soundEvent,"location").invoke(m(soundType,method).invoke(sound)).toString().replace("minecraft:",""));
        render.put("sound",sounds);
        render.put("occlusion",boxes(m(state,"getOcclusionShape").invoke(s)));
        rendering.add(render);
      }catch(Throwable error){
        selections.add(null);collisions.add(null);rendering.add(null);
        errors.add(id+":"+(error instanceof InvocationTargetException?error.getCause():error));
      }
    }

    // Block offset policy survives 26.3 as BlockBehaviour.Properties.offsetType(...).
    // OffsetType.XZ/XYZ both install a getOffset function; the vertical component is the
    // discriminator, and the maxima are the native protected getters.
    Map<String,Object> offsets=new LinkedHashMap<>();
    List<Object> samples=new ArrayList<>();
    int[][] probe={{0,0,0},{1,0,0},{0,0,1},{7,0,-3},{37,0,91},{-29,0,43},{29999999,0,-29999999},{12345,0,6789},{-17,0,31},{64,0,-64},{1024,0,2048},{-999,0,7}};
    for(JsonElement row:definitions){
      JsonObject def=row.getAsJsonObject();
      Object s=m(block,"stateById",int.class).invoke(null,def.get("defaultState").getAsInt());
      if(!(boolean)m(state,"hasOffsetFunction").invoke(s))continue;
      double vertical=0;
      for(int[] coords:probe){
        Object p=pos.getConstructor(int.class,int.class,int.class).newInstance(coords[0],coords[1],coords[2]);
        vertical=Math.max(vertical,Math.abs(vector(m(state,"getOffset",pos).invoke(s,p)).get(1)));
      }
      int type=vertical>1e-9?2:1;
      Object b=m(state,"getBlock").invoke(s);
      double horizontal=((Number)m(block,"getMaxHorizontalOffset").invoke(b)).doubleValue();
      double maxVertical=((Number)m(block,"getMaxVerticalOffset").invoke(b)).doubleValue();
      List<Double> off=vector(m(state,"getOffset",pos).invoke(s,origin));
      boolean selection=false,collision=false;
      for(int id=def.get("minStateId").getAsInt();id<=def.get("maxStateId").getAsInt();id++){
        Object current=m(block,"stateById",int.class).invoke(null,id);
        List<List<Double>> sa=boxes(m(state,"getShape",access,pos).invoke(current,empty,origin));
        List<List<Double>> ca=boxes(m(state,"getCollisionShape",access,pos).invoke(current,empty,origin));
        List<Double> next=vector(m(state,"getOffset",pos).invoke(current,other));
        List<List<Double>> sb=boxes(m(state,"getShape",access,pos).invoke(current,empty,other));
        List<List<Double>> cb=boxes(m(state,"getCollisionShape",access,pos).invoke(current,empty,other));
        selection|=shifted(sa,sb,off,next);
        collision|=shifted(ca,cb,off,next);
      }
      Map<String,Object> policy=new LinkedHashMap<>();
      policy.put("type",type);policy.put("horizontal",horizontal);policy.put("vertical",maxVertical);
      policy.put("origin",off);policy.put("selection",selection);policy.put("collision",collision);
      offsets.put(def.get("name").getAsString(),policy);
      for(int[] coords:probe){
        Object p=pos.getConstructor(int.class,int.class,int.class).newInstance(coords[0],coords[1],coords[2]);
        Map<String,Object> sample=new LinkedHashMap<>();
        sample.put("name",def.get("name").getAsString());
        sample.put("position",new int[]{coords[0],coords[1],coords[2]});
        sample.put("offset",vector(m(state,"getOffset",pos).invoke(s,p)));
        samples.add(sample);
      }
    }

    Map<String,Object> output=new LinkedHashMap<>();
    output.put("selections",selections);
    output.put("collisions",collisions);
    output.put("rendering",rendering);
    output.put("offsets",offsets);
    output.put("samples",samples);
    output.put("errors",errors);
    Files.writeString(Path.of(args[0]),new Gson().toJson(output));
    System.out.println("Native 26.3 runtime: states="+stateCount+" offsets="+offsets.size()+" errors="+errors.size());
    if(!errors.isEmpty())System.exit(1);
  }
}
