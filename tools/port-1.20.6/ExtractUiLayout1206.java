import java.util.*;
import java.util.function.Consumer;
import com.google.gson.Gson;
public class ExtractUiLayout1206 {
 static class Element implements fkv {
  int x,y,w,h; Element(int w,int h){this.w=w;this.h=h;}
  public void m(int x){this.x=x;} public void n(int y){this.y=y;} public int C(){return x;} public int D(){return y;} public int x(){return w;} public int v(){return h;} public void a(Consumer<fhe> c){}
  int[] box(){return new int[]{x,y,w,h};}
 }
 static class Screen extends fnf { Screen(int w,int h){super(xp.b("oracle"));n=w;o=h;} }
 public static void main(String[] args) throws Exception {
  List<Object> results=new ArrayList<>();
  for(int[] size:new int[][]{{320,240},{427,240},{640,360},{960,540}}){
   Screen screen=new Screen(size[0],size[1]); fkt layout=new fkt(screen,61,33);
   fkx header=layout.a(fkx.d().a(8));Element title=header.a(new Element(40,9),fkw::b);
   fkx row=header.a(fkx.e().a(8));Element fov=row.a(new Element(150,20)),online=row.a(new Element(150,20));
   fks grid=new fks();grid.c().f(4).e(4).b();fks.b helper=grid.d(2);List<Element> buttons=new ArrayList<>();
   for(int i=0;i<10;i++)buttons.add(helper.a(new Element(150,20)));
   layout.c(grid);Element done=layout.b(new Element(200,20));layout.a();
   Map<String,Object> r=new LinkedHashMap<>();r.put("size",size);r.put("title",title.box());r.put("fov",fov.box());r.put("online",online.box());r.put("buttons",buttons.stream().map(Element::box).toList());r.put("done",done.box());
   fkt packs=new fkt(screen);fkx packHeader=packs.a(fkx.d().a(5));packHeader.c().b();
   Element packTitle=packHeader.a(new Element(40,9)),drop=packHeader.a(new Element(80,9));
   fkx footer=packs.b(fkx.e().a(8));Element folder=footer.a(new Element(150,20)),packDone=footer.a(new Element(150,20));packs.a();
   Map<String,Object> p=new LinkedHashMap<>();p.put("title",packTitle.box());p.put("drop",drop.box());p.put("folder",folder.box());p.put("done",packDone.box());r.put("packs",p);
   results.add(r);
  }
  System.out.println(new Gson().toJson(results));
 }
}
