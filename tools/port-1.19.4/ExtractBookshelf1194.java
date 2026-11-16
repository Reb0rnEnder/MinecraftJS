import java.lang.reflect.*;import java.lang.invoke.*;import java.nio.file.*;import java.util.*;import com.google.gson.*;
public class ExtractBookshelf1194 extends ExtractRuntime {
 static Object blank(Class<?> type)throws Exception{Field field=sun.misc.Unsafe.class.getDeclaredField("theUnsafe");field.setAccessible(true);return ((sun.misc.Unsafe)field.get(null)).allocateInstance(type);}
 static Class<?> getterSubclass(String name,Class<?> parent,String field,Class<?> value,String getter,Class<?> argument)throws Exception{
  // A branch-free test accessor; Java 17 class format, no constructors, no
  // modified native bytecode and no dependency on a newer classfile API.
  String descriptor="L"+value.getName().replace('.','/')+";",method="(L"+argument.getName().replace('.','/')+";)"+descriptor;
  var bytes=new java.io.ByteArrayOutputStream();var out=new java.io.DataOutputStream(bytes);out.writeInt(0xCAFEBABE);out.writeShort(0);out.writeShort(61);out.writeShort(12);
  out.writeByte(1);out.writeUTF(name);out.writeByte(7);out.writeShort(1);out.writeByte(1);out.writeUTF(parent.getName().replace('.','/'));out.writeByte(7);out.writeShort(3);
  out.writeByte(1);out.writeUTF(field);out.writeByte(1);out.writeUTF(descriptor);out.writeByte(12);out.writeShort(5);out.writeShort(6);out.writeByte(9);out.writeShort(2);out.writeShort(7);
  out.writeByte(1);out.writeUTF(getter);out.writeByte(1);out.writeUTF(method);out.writeByte(1);out.writeUTF("Code");
  out.writeShort(0x21);out.writeShort(2);out.writeShort(4);out.writeShort(0);out.writeShort(1);out.writeShort(9);out.writeShort(5);out.writeShort(6);out.writeShort(0);
  out.writeShort(1);out.writeShort(1);out.writeShort(9);out.writeShort(10);out.writeShort(1);out.writeShort(11);out.writeInt(16);out.writeShort(1);out.writeShort(2);out.writeInt(4);out.writeByte(0xb2);out.writeShort(8);out.writeByte(0xb0);out.writeShort(0);out.writeShort(0);out.writeShort(0);
  return MethodHandles.lookup().defineClass(bytes.toByteArray());
 }
 public static void main(String[] args)throws Exception{
  loadMappings(Path.of(args[1]));m(c("net.minecraft.SharedConstants"),"tryDetectVersion").invoke(null);m(c("net.minecraft.server.Bootstrap"),"bootStrap").invoke(null);
  Class<?> level=c("net.minecraft.client.multiplayer.ClientLevel"),be=c("net.minecraft.world.level.block.entity.BlockEntity"),posType=c("net.minecraft.core.BlockPos"),stateType=c("net.minecraft.world.level.block.state.BlockState"),hitType=c("net.minecraft.world.phys.BlockHitResult"),dirType=c("net.minecraft.core.Direction"),vecType=c("net.minecraft.world.phys.Vec3"),cls=c("net.minecraft.world.level.block.ChiseledBookShelfBlock");
  // An added test subclass supplies only getBlockEntity. All code under test
  // (block methods, item tags, hit selection and result enums) is unmodified.
  String getter=m(c("net.minecraft.world.level.Level"),"getBlockEntity",posType).getName();Class<?> fakeType=getterSubclass("BookshelfOracleLevel",level,"entity",be,getter,posType);Object world=blank(fakeType);f(c("net.minecraft.world.level.Level"),"isClientSide").setBoolean(world,true);
  Object block=f(c("net.minecraft.world.level.block.Blocks"),"CHISELED_BOOKSHELF").get(null),defaultState=call(block,"defaultBlockState",new Class<?>[]{}),facingProperty=f(c("net.minecraft.world.level.block.HorizontalDirectionalBlock"),"FACING").get(null),pos=posType.getConstructor(int.class,int.class,int.class).newInstance(-3,64,7);Method set=m(c("net.minecraft.world.level.block.state.StateHolder"),"setValue",c("net.minecraft.world.level.block.state.properties.Property"),Comparable.class);
  Object registry=f(c("net.minecraft.core.registries.BuiltInRegistries"),"ITEM").get(null),tag=f(c("net.minecraft.tags.ItemTags"),"BOOKSHELF_BOOKS").get(null);List<String> books=new ArrayList<>();try(var in=ExtractBookshelf1194.class.getClassLoader().getResourceAsStream("data/minecraft/datapacks/update_1_20/data/minecraft/tags/items/bookshelf_books.json")){for(JsonElement e:JsonParser.parseReader(new java.io.InputStreamReader(in)).getAsJsonObject().getAsJsonArray("values"))books.add(e.getAsString());}
  Map<String,Object> stacks=new LinkedHashMap<>();for(String name:List.of("minecraft:air","minecraft:book","minecraft:writable_book","minecraft:written_book","minecraft:enchanted_book","minecraft:knowledge_book","minecraft:stone")){Object item=m(c("net.minecraft.core.Registry"),"get",c("net.minecraft.resources.ResourceLocation")).invoke(registry,c("net.minecraft.resources.ResourceLocation").getConstructor(String.class).newInstance(name));Object holder=call(item,"builtInRegistryHolder",new Class<?>[]{});m(c("net.minecraft.core.Holder$Reference"),"bindTags",Collection.class).invoke(holder,books.contains(name)?List.of(tag):List.of());stacks.put(name,call(item,"getDefaultInstance",new Class<?>[]{}));}
  String handGetter=m(c("net.minecraft.world.entity.LivingEntity"),"getItemInHand",c("net.minecraft.world.InteractionHand")).getName();Class<?> playerType=getterSubclass("BookshelfOraclePlayer",c("net.minecraft.client.player.LocalPlayer"),"stack",c("net.minecraft.world.item.ItemStack"),handGetter,c("net.minecraft.world.InteractionHand"));Object player=blank(playerType);
  Object hand=c("net.minecraft.world.InteractionHand").getEnumConstants()[0];List<Object> hits=new ArrayList<>(),uses=new ArrayList<>();
  for(Object facing:dirType.getEnumConstants()){
   int facingId=((Enum<?>)facing).ordinal();if(facingId<2)continue;Object state=set.invoke(defaultState,facingProperty,facing);
   for(Object face:dirType.getEnumConstants())for(double u:face==facing?new double[]{0,.37499997,.375,.68749997,.6875,.9}:new double[]{.5})for(double y:face==facing?new double[]{.2,.5,.8}:new double[]{.5}){
    int faceId=((Enum<?>)face).ordinal();double[] point={-3+u,64+y,7+u};if(faceId==0)point[1]=64;if(faceId==1)point[1]=65;if(faceId==2)point[2]=7;if(faceId==3)point[2]=8;if(faceId==4)point[0]=-3;if(faceId==5)point[0]=-2;
    Object hit=hitType.getConstructor(vecType,dirType,posType,boolean.class).newInstance(vecType.getConstructor(double.class,double.class,double.class).newInstance(point[0],point[1],point[2]),face,pos,false);Optional<?> relative=(Optional<?>)m(cls,"getRelativeHitCoordinatesForBlockFace",hitType,dirType).invoke(null,hit,facing);OptionalInt slot=relative.isPresent()?OptionalInt.of(((Number)m(cls,"getHitSlot",c("net.minecraft.world.phys.Vec2")).invoke(null,relative.get())).intValue()):OptionalInt.empty();Map<String,Object> sample=new LinkedHashMap<>();sample.put("facing",((Enum<?>)facing).name().toLowerCase(Locale.ROOT));sample.put("face",faceId);sample.put("point",point);sample.put("slot",slot.orElse(-1));hits.add(sample);
    if(slot.isEmpty())continue;
    for(boolean occupied:new boolean[]{false,true}){Object prop=((List<?>)f(cls,"SLOT_OCCUPIED_PROPERTIES").get(null)).get(slot.getAsInt()),current=set.invoke(state,prop,occupied),entity=c("net.minecraft.world.level.block.entity.ChiseledBookShelfBlockEntity").getConstructor(posType,stateType).newInstance(pos,current);fakeType.getField("entity").set(null,entity);
     for(var stack:stacks.entrySet()){playerType.getField("stack").set(null,stack.getValue());Object result=m(cls,"use",stateType,c("net.minecraft.world.level.Level"),posType,c("net.minecraft.world.entity.player.Player"),c("net.minecraft.world.InteractionHand"),hitType).invoke(block,current,world,pos,player,hand,hit);uses.add(Map.of("hit",hits.size()-1,"item",stack.getKey(),"occupied",occupied,"result",((Enum<?>)result).name(),"consumes",call(result,"consumesAction",new Class<?>[]{}),"swing",call(result,"shouldSwing",new Class<?>[]{})));}

    }
   }
  }
  Files.writeString(Path.of(args[0]),new Gson().toJson(Map.of("hits",hits,"uses",uses,"books",books)));
 }
}
