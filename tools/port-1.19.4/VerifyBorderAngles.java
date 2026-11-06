// Executes native WorldBorder and Mth directly, without starting a game window.
import java.lang.reflect.Method;
public class VerifyBorderAngles {
  public static void main(String[] args)throws Exception {
    Class<?> math=Class.forName("apj"),border=Class.forName("ddi");
    Method atan=math.getMethod("d",double.class,double.class),wrap=math.getMethod("g",float.class);
    double[][] vectors={{0,1,0},{1,0,0},{-1,0,0},{0,-1,0},{3,7,-2},{-.001,-17,30000000},{0,0,0},{-17.25,11.75,91.125}};
    System.out.print("{\"angles\":[");
    boolean comma=false;
    for(double[] v:vectors){
      double x=v[0],y=v[1],z=v[2],horizontal=Math.sqrt(x*x+z*z);
      float pitch=(float)wrap.invoke(null,(float)(-((Double)atan.invoke(null,y,horizontal))*57.2957763671875));
      float yaw=(float)wrap.invoke(null,(float)(((Double)atan.invoke(null,z,x))*57.2957763671875)-90f);
      if(comma)System.out.print(",");comma=true;
      System.out.print("{\"delta\":["+x+","+y+","+z+"],\"yaw\":"+Double.toString(yaw)+",\"pitch\":"+Double.toString(pitch)+"}");
    }
    System.out.print("],\"borders\":[");comma=false;
    double[][] cases={{0,0,59999968,29999984,0,0},{2.75,-7.125,11.25,29999984,2.5,-11.8},{105,0,30,100,99,-14},{-105,0,30,100,-99,14},{0,0,0,29999984,.5,.5}};
    for(double[] c:cases){
      Object b=border.getConstructor().newInstance();
      border.getMethod("c",double.class,double.class).invoke(b,c[0],c[1]);
      border.getMethod("a",double.class).invoke(b,c[2]);
      border.getMethod("a",int.class).invoke(b,(int)c[3]);
      if(comma)System.out.print(",");comma=true;
      System.out.print("{\"center\":["+c[0]+","+c[1]+"],\"size\":"+c[2]+",\"limit\":"+c[3]+",\"point\":["+c[4]+","+c[5]+"],\"bounds\":[");
      String[] names={"e","f","g","h"};for(int i=0;i<names.length;i++){if(i>0)System.out.print(",");System.out.print(border.getMethod(names[i]).invoke(b));}
      System.out.print("],\"distance\":"+border.getMethod("b",double.class,double.class).invoke(b,c[4],c[5])+"}");
    }
    System.out.print("]}");
  }
}
