import java.nio.file.*;import java.nio.*;import java.io.*;import java.util.*;import java.util.zip.*;import java.security.*;import com.google.gson.*;import com.mojang.serialization.*;
// Runs native Unihex loading, metrics and CPU pixel unpacking; no GL context.
public class ExtractFonts1206 extends ExtractCreative1206 {
 public static void main(String[] args)throws Exception{
  loadMappings(Path.of(args[1]));List<Object> result=new ArrayList<>();
  Class<?> definition=c("net.minecraft.client.gui.font.providers.UnihexProvider$Definition"),provider=c("net.minecraft.client.gui.font.providers.UnihexProvider"),info=c("com.mojang.blaze3d.font.GlyphInfo"),lines=c("net.minecraft.client.gui.font.providers.UnihexProvider$LineData");
  Codec codec=((MapCodec)f(definition,"CODEC").get(null)).codec();
  for(JsonElement input:JsonParser.parseString(Files.readString(Path.of(args[2]))).getAsJsonArray()){
   JsonObject entry=input.getAsJsonObject();Object def=codec.parse(JsonOps.INSTANCE,entry.get("definition")).getOrThrow();
   byte[] bytes;
   if(entry.has("hex")){ByteArrayOutputStream buffer=new ByteArrayOutputStream();try(ZipOutputStream zip=new ZipOutputStream(buffer)){zip.putNextEntry(new ZipEntry("test.hex"));zip.write(entry.get("hex").getAsString().getBytes(java.nio.charset.StandardCharsets.US_ASCII));zip.closeEntry();}bytes=buffer.toByteArray();}else bytes=Files.readAllBytes(Path.of(entry.get("path").getAsString()));
   Object font=m(definition,"loadData",InputStream.class).invoke(def,new ByteArrayInputStream(bytes));List<Object> glyphs=new ArrayList<>();
   for(JsonElement ch:entry.getAsJsonArray("characters")){
    int code=ch.getAsString().codePointAt(0);Object glyph=m(provider,"getGlyph",int.class).invoke(font,code);
    Map<String,Object> g=new TreeMap<>();g.put("character",ch.getAsString());
    if(glyph!=null){int left=f(glyph.getClass(),"left").getInt(glyph),right=f(glyph.getClass(),"right").getInt(glyph),width=right-left+1;IntBuffer pixels=IntBuffer.allocate(width*16);m(provider,"unpackBitsToBytes",IntBuffer.class,lines,int.class,int.class).invoke(null,pixels,f(glyph.getClass(),"contents").get(glyph),left,right);byte[] alpha=new byte[width*16];for(int i=0;i<alpha.length;i++)alpha[i]=(byte)(pixels.get(i)==0?0:255);
     g.put("advance",m(info,"getAdvance").invoke(glyph));g.put("boldAdvance",m(info,"getAdvance",boolean.class).invoke(glyph,true));g.put("shadowOffset",m(info,"getShadowOffset").invoke(glyph));g.put("width",width/2.0);g.put("pixelWidth",width);g.put("alphaSha256",HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(alpha)));
    }else g.put("missing",true);glyphs.add(g);
   }
   result.add(Map.of("label",entry.get("label").getAsString(),"glyphs",glyphs));
  }
  Files.writeString(Path.of(args[0]),new GsonBuilder().disableHtmlEscaping().create().toJson(result));
 }
}
