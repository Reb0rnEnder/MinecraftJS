import java.nio.file.*;import java.util.*;import java.util.jar.*;import java.lang.reflect.*;import java.nio.charset.StandardCharsets;
// Locate the jar's dye enum by its native constants, then read its float RGB
// accessor. Works before official obfuscation mappings were published as well.
public class ExtractDyes {
 public static void main(String[] args)throws Exception{
  List<Class<?>> dyes=new ArrayList<>();
  try(JarFile jar=new JarFile(args[0])){for(JarEntry entry:Collections.list(jar.entries()))if(entry.getName().endsWith(".class")){
   byte[] bytes=jar.getInputStream(entry).readAllBytes();String strings=new String(bytes,StandardCharsets.ISO_8859_1);
   if(!strings.contains("light_blue")||!strings.contains("magenta")||!strings.contains("java/lang/Enum"))continue;
   Class<?> c=Class.forName(entry.getName().replace('/','.').replaceAll("\\.class$",""));if(c.isEnum()&&c.getEnumConstants().length==16)dyes.add(c);
  }}
  if(dyes.size()!=1)throw new IllegalStateException("Ambiguous native dye enums: "+dyes);Class<?> type=dyes.get(0);List<Method> methods=Arrays.stream(type.getDeclaredMethods()).filter(m->m.getReturnType()==float[].class&&m.getParameterCount()==0).toList();Method rgb=methods.isEmpty()?null:methods.get(0);if(methods.size()>1)throw new IllegalStateException("Ambiguous native dye RGB accessor");if(rgb!=null)rgb.setAccessible(true);StringJoiner rows=new StringJoiner(",","[","]");
  for(Object value:type.getEnumConstants()){float[] color;
   if(rgb!=null)color=(float[])rgb.invoke(value);else{
    Object material=null;for(Method method:type.getDeclaredMethods())if(!Modifier.isStatic(method.getModifiers())&&method.getParameterCount()==0&&!method.getReturnType().isPrimitive()&&!method.getReturnType().isEnum()&&method.getReturnType()!=String.class&&Arrays.stream(method.getReturnType().getDeclaredFields()).anyMatch(f->f.getType().isArray()&&f.getType().getComponentType()==method.getReturnType())){method.setAccessible(true);material=method.invoke(value);break;}
    if(material==null)throw new IllegalStateException("Missing native dye material color");int packed=-1;for(Field field:material.getClass().getDeclaredFields())if(!Modifier.isStatic(field.getModifiers())&&field.getType()==int.class){field.setAccessible(true);int n=field.getInt(material);if(n>255)packed=n;}
    if(packed<0)throw new IllegalStateException("Missing native material RGB");color=new float[]{(packed>>16&255)/255f,(packed>>8&255)/255f,(packed&255)/255f};
   }
   if(color.length!=3)throw new IllegalStateException("Invalid dye RGB");rows.add("["+color[0]+","+color[1]+","+color[2]+"]");
  }
  Files.writeString(Path.of(args[1]),rows.toString()+"\n");System.out.println("Native dye enum: "+type.getName());
 }
}
