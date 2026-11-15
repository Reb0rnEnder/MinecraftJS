import java.nio.file.*;import java.lang.reflect.*;import java.util.*;import com.google.gson.*;
public class ExtractPackMetadata {
 static Map<String,String> names=new HashMap<>(),methods=new HashMap<>();
 static void mappings(String file)throws Exception{String owner="";for(String line:Files.readAllLines(Path.of(file))){if(!line.startsWith(" ")&&line.contains(" -> ")){String[] p=line.substring(0,line.length()-1).split(" -> ");owner=p[0];names.put(owner,p[1]);}else if(line.startsWith("    ")&&line.contains(" -> ")){String[] p=line.trim().split(" -> ");String s=p[0].replaceFirst("^(?:[0-9]+:[0-9]+:)+","");int i=s.indexOf(' ');if(i>=0)methods.put(owner+"."+s.substring(i+1),p[1]);}}}
 static Class<?> c(String name)throws Exception{return Class.forName(names.get(name));}
 public static void main(String[] args)throws Exception{
  mappings(args[0]);List<Object> out=new ArrayList<>();Class<?> serializer=c("net.minecraft.server.packs.metadata.MetadataSectionSerializer");Method parse=serializer.getMethod(methods.get("net.minecraft.server.packs.metadata.MetadataSectionSerializer.fromJson(com.google.gson.JsonObject)"),JsonObject.class);
  for(JsonElement input:JsonParser.parseString(Files.readString(Path.of(args[1]))).getAsJsonArray()){
   JsonObject row=input.getAsJsonObject();String section=row.get("section").getAsString(),owner=section.equals("filter")?"net.minecraft.server.packs.resources.ResourceFilterSection":"net.minecraft.server.packs.OverlayMetadataSection";Map<String,Object> result=new LinkedHashMap<>();result.put("label",row.get("label").getAsString());
   try{
    Class<?> type=c(owner);Field field=Arrays.stream(type.getDeclaredFields()).filter(f->Modifier.isStatic(f.getModifiers())&&serializer.isAssignableFrom(f.getType())).findFirst().orElseThrow();field.setAccessible(true);Object value=parse.invoke(field.get(null),row.getAsJsonObject("value"));List<Object> results=new ArrayList<>();
    for(JsonElement q:row.getAsJsonArray("queries"))if(section.equals("filter")){
     JsonObject query=q.getAsJsonObject();boolean ns=(Boolean)type.getMethod(methods.get(owner+".isNamespaceFiltered(java.lang.String)"),String.class).invoke(value,query.get("namespace").getAsString()),path=(Boolean)type.getMethod(methods.get(owner+".isPathFiltered(java.lang.String)"),String.class).invoke(value,query.get("path").getAsString());results.add(ns&&path);
    }else results.add(type.getMethod(methods.get(owner+".overlaysForVersion(int)"),int.class).invoke(value,q.getAsInt()));
    result.put("valid",true);result.put("results",results);
   }catch(InvocationTargetException e){result.put("valid",false);}out.add(result);
  }
  Files.writeString(Path.of(args[2]),new Gson().toJson(out));
 }
}
