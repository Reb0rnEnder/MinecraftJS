// Executes the exact pinned 1.19.4 Component.Serializer, without a game window.
// Use the verified client jar + bundled third-party libraries as the classpath.
public class VerifyComponentText {
 public static void main(String[] args)throws Exception {
  Class<?> component=Class.forName("tj"),serializer=Class.forName("tj$a");
  Object text=serializer.getMethod("a",String.class).invoke(null,args[0]);
  System.out.print(component.getMethod("getString").invoke(text));
 }
}
