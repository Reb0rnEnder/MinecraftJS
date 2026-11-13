import java.util.*;
import com.google.gson.Gson;
public class PrintPacketNames {
 public static void main(String[] args) throws Exception {
  List<String> names=new ArrayList<>();
  for(String entry:args){int dot=entry.indexOf('.');names.add(Class.forName(entry.substring(0,dot)).getField(entry.substring(dot+1)).get(null).toString());}
  System.out.println(new Gson().toJson(names));
 }
}
