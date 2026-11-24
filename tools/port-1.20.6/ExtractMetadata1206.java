import java.lang.reflect.*;import java.nio.file.*;import java.util.*;import com.google.gson.*;
// Native 1.20.6 EntityDataAccessor ids for every entity type: the EntityType<T> static fields name each type and
// their generic argument is its class, whose (inherited) accessors give symbol -> id.
public class ExtractMetadata1206 extends ExtractPaws1206 {
 public static void main(String[] args)throws Exception{
  loadMappings(Path.of(args[1]));m(c("net.minecraft.SharedConstants"),"tryDetectVersion").invoke(null);m(c("net.minecraft.server.Bootstrap"),"bootStrap").invoke(null);
  Class<?> types=c("net.minecraft.world.entity.EntityType");Object registry=f(c("net.minecraft.core.registries.BuiltInRegistries"),"ENTITY_TYPE").get(null);
  Method getKey=null;for(Method x:c("net.minecraft.core.Registry").getMethods())if(x.getParameterCount()==1&&x.getParameterTypes()[0]==Object.class&&x.getReturnType()==c("net.minecraft.resources.ResourceLocation")){getKey=x;break;}
  Map<String,Object> out=new TreeMap<>();
  for(Field field:types.getDeclaredFields()){
   if(!Modifier.isStatic(field.getModifiers())||field.getType()!=types||!(field.getGenericType() instanceof ParameterizedType pt))continue;
   Type arg=pt.getActualTypeArguments()[0];if(!(arg instanceof Class<?> cls))continue;
   field.setAccessible(true);String name=getKey.invoke(registry,field.get(null)).toString().replace("minecraft:","");
   Map<String,Object> ids=new TreeMap<>();for(var e:accessors(cls).entrySet())ids.put(e.getKey(),((Number)call(e.getValue(),"id",new Class<?>[]{})).intValue());
   out.put(name,ids);
  }
  Files.writeString(Path.of(args[0]),new Gson().toJson(out));
 }
}
