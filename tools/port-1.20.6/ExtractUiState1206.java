import java.lang.reflect.*;import java.nio.file.*;import java.util.*;import com.google.gson.*;
public class ExtractUiState1206 extends ExtractPaws1206 {
 public static void main(String[] args)throws Exception{
  loadMappings(Path.of(args[1]));m(c("net.minecraft.SharedConstants"),"tryDetectVersion").invoke(null);Map<String,Object> out=new TreeMap<>();
  Object window=blank(c("com.mojang.blaze3d.platform.Window"));List<Object> scales=new ArrayList<>();for(int[] size:new int[][]{{320,240},{640,480},{854,480},{1280,720},{3440,1440},{3840,2160}})for(int requested:new int[]{0,1,2,3,4,8})for(boolean unicode:new boolean[]{false,true}){f(window.getClass(),"framebufferWidth").setInt(window,size[0]);f(window.getClass(),"framebufferHeight").setInt(window,size[1]);scales.add(Map.of("size",size,"requested",requested,"unicode",unicode,"scale",call(window,"calculateScale",new Class<?>[]{int.class,boolean.class},requested,unicode)));}out.put("scales",scales);
  long[] now={10000};Field clock=f(c("net.minecraft.Util"),"timeSource");Object old=clock.get(null),time=Proxy.newProxyInstance(ExtractUiState1206.class.getClassLoader(),new Class<?>[]{clock.getType()},(proxy,method,values)->now[0]*1000000L);List<Object> fade=new ArrayList<>();
  try{clock.set(null,time);for(int elapsed:new int[]{0,250,500,750,999,1000,1250,1500,1750,2000,2001,3000}){
   Object title=blank(c("net.minecraft.client.gui.screens.TitleScreen")),button=blank(c("net.minecraft.client.gui.components.Button"));f(title.getClass(),"fading").setBoolean(title,true);f(title.getClass(),"fadeInStart").setLong(title,10000);f(title.getClass(),"panoramaFade").setFloat(title,1f);f(c("net.minecraft.client.gui.screens.Screen"),"children").set(title,new ArrayList<>(List.of(button)));f(c("net.minecraft.client.gui.components.AbstractWidget"),"alpha").setFloat(button,1f);now[0]=10000+elapsed;
   try{call(title,"render",new Class<?>[]{c("net.minecraft.client.gui.GuiGraphics"),int.class,int.class,float.class},null,0,0,0f);throw new AssertionError("Render must need a client context");}catch(InvocationTargetException expected){if(!(expected.getCause() instanceof NullPointerException))throw expected;}
   fade.add(Map.of("elapsed",elapsed,"panorama",f(title.getClass(),"panoramaFade").getFloat(title),"widgets",f(c("net.minecraft.client.gui.components.AbstractWidget"),"alpha").getFloat(button),"fading",f(title.getClass(),"fading").getBoolean(title)));
  }}finally{clock.set(null,old);}out.put("titleFade",fade);Files.writeString(Path.of(args[0]),new Gson().toJson(out));
 }
}
