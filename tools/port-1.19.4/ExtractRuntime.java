import com.mojang.serialization.Codec;import com.mojang.serialization.JsonOps;
import java.lang.reflect.*;import java.nio.file.*;import java.util.*;import java.io.*;import com.google.gson.*;
// Native 1.19.4 runtime tables. Reflection uses official member names and mappings.
public class ExtractRuntime {
 static Map<String,String> classNames=new HashMap<>(),originalNames=new HashMap<>();
 static Map<String,Map<String,String>> methodNames=new HashMap<>(),fieldNames=new HashMap<>();
 static void loadMappings(Path path)throws Exception{
  String owner=null;
  for(String line:Files.readAllLines(path)){
   if(!line.startsWith(" ")&&line.contains(" -> ")){String[] p=line.substring(0,line.length()-1).split(" -> ");owner=p[0];classNames.put(p[0],p[1]);originalNames.put(p[1],p[0]);}
   else if(owner!=null&&line.startsWith("    ")&&line.contains(" -> ")){
    String[] p=line.trim().split(" -> ");String left=p[0].replaceFirst("^(?:[0-9]+:[0-9]+:)+","");int space=left.indexOf(' ');if(space<0)continue;String member=left.substring(space+1);
    if(member.contains("("))methodNames.computeIfAbsent(owner,k->new HashMap<>()).put(member.substring(0,member.indexOf(')')+1),p[1]);
    else fieldNames.computeIfAbsent(owner,k->new HashMap<>()).put(member,p[1]);
   }
  }
 }
 static String original(Class<?> c){return originalNames.getOrDefault(c.getName(),c.getName());}
 static Method m(Class<?> c,String name,Class<?>...args)throws Exception{
  String key=name+"("+String.join(",",Arrays.stream(args).map(ExtractRuntime::original).toArray(String[]::new))+")";
  for(Class<?> k=c;k!=null;k=k.getSuperclass()){
   String alias=methodNames.getOrDefault(original(k),Map.of()).get(key);if(alias==null)continue;
   Method result=k.getDeclaredMethod(alias,args);result.setAccessible(true);return result;
  }
  return c.getMethod(name,args);
 }
 static Field f(Class<?> c,String name)throws Exception{
  for(Class<?> k=c;k!=null;k=k.getSuperclass()){
   String alias=fieldNames.getOrDefault(original(k),Map.of()).get(name);if(alias==null)continue;
   Field result=k.getDeclaredField(alias);result.setAccessible(true);return result;
  }
  return c.getField(name);
 }

 static Class<?> c(String n)throws Exception{return Class.forName(classNames.getOrDefault(n,n));}static Object call(Object o,String n,Class<?>[] t,Object...a)throws Exception{return m(o.getClass(),n,t).invoke(o,a);}
 static List<Double> box(Object b)throws Exception{List<Double> v=new ArrayList<>();for(String n:new String[]{"minX","minY","minZ","maxX","maxY","maxZ"})v.add(f(b.getClass(),n).getDouble(b));return v;}
 static Set<Object> blockTag(String id,Object registry,Map<String,Set<Object>> memo)throws Exception{
  if(memo.containsKey(id))return memo.get(id);Set<Object> values=new LinkedHashSet<>();memo.put(id,values);
  String[] key=id.split(":",2);String name="data/"+key[0]+"/tags/blocks/"+key[1]+".json";
  InputStream resource=ExtractRuntime.class.getClassLoader().getResourceAsStream(name);
  if(resource==null)resource=ExtractRuntime.class.getClassLoader().getResourceAsStream("data/minecraft/datapacks/update_1_20/"+name);
  try(InputStream input=resource){
   if(input==null)throw new FileNotFoundException(name);JsonObject definition=new JsonParser().parse(new InputStreamReader(input,java.nio.charset.StandardCharsets.UTF_8)).getAsJsonObject();
   for(JsonElement el:definition.getAsJsonArray("values")){String value=el.isJsonObject()?el.getAsJsonObject().get("id").getAsString():el.getAsString();if(value.startsWith("#"))values.addAll(blockTag(value.substring(1),registry,memo));else values.add(m(c("net.minecraft.core.Registry"),"get",c("net.minecraft.resources.ResourceLocation")).invoke(registry,c("net.minecraft.resources.ResourceLocation").getConstructor(String.class).newInstance(value)));}
  }return values;
 }
 public static void main(String[] args)throws Exception{
  loadMappings(Path.of(args[1]));
  m(c("net.minecraft.SharedConstants"),"tryDetectVersion").invoke(null);m(c("net.minecraft.server.Bootstrap"),"bootStrap").invoke(null);Class<?> tabs=c("net.minecraft.world.item.CreativeModeTab"),stack=c("net.minecraft.world.item.ItemStack"),item=c("net.minecraft.world.item.Item"),list=c("net.minecraft.core.NonNullList"),tag=c("net.minecraft.nbt.CompoundTag");
  Map<String,Object> output=new LinkedHashMap<>();List<Object> catalog=new ArrayList<>();
  Object lookupProvider=m(c("net.minecraft.data.registries.VanillaRegistries"),"createLookup").invoke(null);
  Class<?> allTabs=c("net.minecraft.world.item.CreativeModeTabs");
  Object features=f(c("net.minecraft.world.flag.FeatureFlags"),"VANILLA_SET").get(null);
  for(boolean permissions:new boolean[]{false,true}){
  m(allTabs,"tryRebuildTabContents",c("net.minecraft.world.flag.FeatureFlagSet"),boolean.class,c("net.minecraft.core.HolderLookup$Provider")).invoke(null,features,permissions,lookupProvider);
  catalog=new ArrayList<>();int tabIndex=0;
  for(Object tab:(List<?>)m(allTabs,"allTabs").invoke(null)){
   Collection<?> values=(Collection<?>)m(tabs,"getDisplayItems").invoke(tab);
   Object title=m(tabs,"getDisplayName").invoke(tab),contents=m(c("net.minecraft.network.chat.Component"),"getContents").invoke(title);
   String label=(String)m(c("net.minecraft.network.chat.contents.TranslatableContents"),"getKey").invoke(contents);
   Map<String,Object> t=new LinkedHashMap<>();t.put("index",tabIndex++);t.put("label",label.replace("itemGroup.",""));
   List<Object> entries=new ArrayList<>();for(Object it:values){Object ob=m(stack,"getItem").invoke(it);int id=(int)m(item,"getId",item).invoke(null,ob);Object nbt=m(stack,"getTag").invoke(it);String bytes=null;if(nbt!=null){ByteArrayOutputStream b=new ByteArrayOutputStream();m(c("net.minecraft.nbt.NbtIo"),"write",tag,DataOutput.class).invoke(null,nbt,new DataOutputStream(b));bytes=Base64.getEncoder().encodeToString(b.toByteArray());}entries.add(Arrays.asList(id,0,bytes));}
   Object icon=m(tabs,"getIconItem").invoke(tab);int iconId=(int)m(item,"getId",item).invoke(null,m(stack,"getItem").invoke(icon));t.put("icon",Arrays.asList(iconId,0,null));t.put("items",entries);t.put("title",m(tabs,"showTitle").invoke(tab));t.put("scroll",m(tabs,"canScroll").invoke(tab));t.put("column",m(tabs,"column").invoke(tab));t.put("top",((Enum<?>)m(tabs,"row").invoke(tab)).ordinal()==0);t.put("right",m(tabs,"isAlignedRight").invoke(tab));t.put("type",((Enum<?>)m(tabs,"getType").invoke(tab)).name().toLowerCase(Locale.ROOT));t.put("background",m(tabs,"getBackgroundSuffix").invoke(tab));catalog.add(t);
  }output.put(permissions?"operatorTabs":"tabs",catalog);
  }
  Map<String,Object> mechanics=new LinkedHashMap<>(),eggs=new LinkedHashMap<>(),effects=new LinkedHashMap<>(),enchants=new LinkedHashMap<>();
  int itemCount=0;for(Object registeredItem:(Iterable<?>)f(c("net.minecraft.core.registries.BuiltInRegistries"),"ITEM").get(null))itemCount++;
  for(int id=0;id<itemCount;id++){
   Object it=m(item,"byId",int.class).invoke(null,id),s=m(item,"getDefaultInstance").invoke(it);Map<String,Object> m=new LinkedHashMap<>();
   m.put("action",((Enum<?>)m(item,"getUseAnimation",stack).invoke(it,s)).name().toLowerCase(Locale.ROOT));m.put("duration",m(item,"getUseDuration",stack).invoke(it,s));m.put("food",m(item,"isEdible").invoke(it));
   Object food=m(item,"getFoodProperties").invoke(it);if(food!=null){Class<?> f=c("net.minecraft.world.food.FoodProperties");m.put("alwaysEat",m(f,"canAlwaysEat").invoke(food));m.put("nutrition",m(f,"getNutrition").invoke(food));m.put("saturation",m(f,"getSaturationModifier").invoke(food));}
   mechanics.put(""+id,m);
   if(c("net.minecraft.world.item.SpawnEggItem").isInstance(it))eggs.put(""+id,Arrays.asList(m(c("net.minecraft.world.item.SpawnEggItem"),"getColor",int.class).invoke(it,0),m(c("net.minecraft.world.item.SpawnEggItem"),"getColor",int.class).invoke(it,1)));
  }
  Class<?> effect=c("net.minecraft.world.effect.MobEffect");for(int id=1;id<=33;id++){Object e=m(effect,"byId",int.class).invoke(null,id);Map<String,Object> m=new LinkedHashMap<>();m.put("name",m(effect,"getDescriptionId").invoke(e));m.put("color",m(effect,"getColor").invoke(e));m.put("bad",((Enum<?>)m(effect,"getCategory").invoke(e)).ordinal()==1);m.put("beneficial",m(effect,"isBeneficial").invoke(e));effects.put(""+id,m);}
  Class<?> enchant=c("net.minecraft.world.item.enchantment.Enchantment");for(int id=0;id<39;id++){Object e=m(enchant,"byId",int.class).invoke(null,id);Map<String,Object> m=new LinkedHashMap<>();m.put("maxLevel",m(enchant,"getMaxLevel").invoke(e));m.put("treasureOnly",m(enchant,"isTreasureOnly").invoke(e));m.put("curse",m(enchant,"isCurse").invoke(e));enchants.put(""+id,m);}
  List<String> boatTypes=new ArrayList<>();for(Object type:(Object[])m(c("net.minecraft.world.entity.vehicle.Boat$Type"),"values").invoke(null))boatTypes.add((String)m(c("net.minecraft.world.entity.vehicle.Boat$Type"),"getSerializedName").invoke(type));output.put("boatTypes",boatTypes);
  Map<String,Object> instruments=new LinkedHashMap<>();Object instrumentRegistry=f(c("net.minecraft.core.registries.BuiltInRegistries"),"INSTRUMENT").get(null);for(Object instrument:(Iterable<?>)instrumentRegistry){String key=m(c("net.minecraft.core.Registry"),"getKey",Object.class).invoke(instrumentRegistry,instrument).toString();instruments.put(key,Map.of("duration",m(c("net.minecraft.world.item.Instrument"),"useDuration").invoke(instrument),"range",m(c("net.minecraft.world.item.Instrument"),"range").invoke(instrument)));}output.put("instruments",instruments);
  output.put("itemMechanics",mechanics);output.put("eggs",eggs);output.put("effects",effects);output.put("enchantments",enchants);
  Class<?> gene=c("net.minecraft.world.entity.animal.Panda$Gene");Method variant=m(gene,"getVariantFromGenes",gene,gene);variant.setAccessible(true);List<Object> pandaVariants=new ArrayList<>();
  for(Object main:(Object[])m(gene,"values").invoke(null)){List<Object> row=new ArrayList<>();for(Object hidden:(Object[])m(gene,"values").invoke(null))row.add(m(c("net.minecraft.util.StringRepresentable"),"getSerializedName").invoke(variant.invoke(null,main,hidden)));pandaVariants.add(row);}output.put("pandaVariants",pandaVariants);
  Field poseField=f(c("net.minecraft.world.entity.player.Player"),"POSES");poseField.setAccessible(true);Map<String,Object> poses=new LinkedHashMap<>();
  for(Map.Entry<?,?> entry:((Map<?,?>)poseField.get(null)).entrySet()){Object d=entry.getValue();poses.put(((Enum<?>)entry.getKey()).name().toLowerCase(Locale.ROOT),Arrays.asList(f(d.getClass(),"width").getFloat(d),f(d.getClass(),"height").getFloat(d)));}output.put("playerPoses",poses);
  Map<String,Object> textColors=new LinkedHashMap<>();for(Object dye:(Object[])m(c("net.minecraft.world.item.DyeColor"),"values").invoke(null))textColors.put((String)m(c("net.minecraft.world.item.DyeColor"),"getName").invoke(dye),m(c("net.minecraft.world.item.DyeColor"),"getTextColor").invoke(dye));output.put("dyeTextColors",textColors);
  Class<?> block=c("net.minecraft.world.level.block.Block"),state=c("net.minecraft.world.level.block.state.BlockState"),access=c("net.minecraft.world.level.BlockGetter"),pos=c("net.minecraft.core.BlockPos");Object origin=pos.getConstructor(int.class,int.class,int.class).newInstance(0,0,0),air=m(block,"stateById",int.class).invoke(null,0);final Object[] current={air};
  Object world=Proxy.newProxyInstance(access.getClassLoader(),new Class[]{access},(o,m,a)->{Object s=a!=null&&a.length>0&&origin.equals(a[0])?current[0]:air;if(m.getReturnType()==state)return s;if(m.getReturnType()==c("net.minecraft.world.level.material.FluidState"))return m(state,"getFluidState").invoke(s);if(m.getReturnType()==int.class)return m.getName().equals(m(access,"getMaxLightLevel").getName())?15:256;if(m.getReturnType()==boolean.class)return false;return null;});
  List<Object> selections=new ArrayList<>(),collisions=new ArrayList<>(),rendering=new ArrayList<>();List<String> errors=new ArrayList<>();
  for(int id=0;id<23725;id++){Object s=m(block,"stateById",int.class).invoke(null,id);current[0]=s;try{Object shape=m(state,"getShape",access,pos).invoke(s,world,origin);boolean empty=(boolean)call(shape,"isEmpty",new Class[]{});selections.add(empty?null:box(call(shape,"bounds",new Class[]{})));Object col=m(state,"getCollisionShape",access,pos).invoke(s,world,origin);List<Object> boxes=new ArrayList<>();for(Object b:(List<?>)call(col,"toAabbs",new Class[]{}))boxes.add(box(b));collisions.add(boxes);
    Map<String,Object> render=new LinkedHashMap<>();
    render.put("renderType",((Enum<?>)m(state,"getRenderShape").invoke(s)).ordinal());
    render.put("suffocates",m(state,"isSuffocating",access,pos).invoke(s,world,origin));
    render.put("viewBlocking",m(state,"isViewBlocking",access,pos).invoke(s,world,origin));
    render.put("solid",m(state,"isSolidRender",access,pos).invoke(s,world,origin));
    render.put("occludes",m(state,"canOcclude").invoke(s));
    render.put("lightBlock",m(state,"getLightBlock",access,pos).invoke(s,world,origin));
    render.put("shade",m(state,"getShadeBrightness",access,pos).invoke(s,world,origin));
    render.put("emission",m(state,"getLightEmission").invoke(s));
    render.put("collisionFull",m(state,"isCollisionShapeFullBlock",access,pos).invoke(s,world,origin));
    render.put("sturdyTop",m(state,"isFaceSturdy",access,pos,c("net.minecraft.core.Direction")).invoke(s,world,origin,f(c("net.minecraft.core.Direction"),"UP").get(null)));
    render.put("sturdyBottom",m(state,"isFaceSturdy",access,pos,c("net.minecraft.core.Direction")).invoke(s,world,origin,f(c("net.minecraft.core.Direction"),"DOWN").get(null)));
    Object sound=m(state,"getSoundType").invoke(s);Class<?> soundType=c("net.minecraft.world.level.block.SoundType");List<Object> sounds=new ArrayList<>();
    for(String method:new String[]{"getStepSound","getBreakSound","getPlaceSound"})sounds.add(m(c("net.minecraft.sounds.SoundEvent"),"getLocation").invoke(m(soundType,method).invoke(sound)).toString().replace("minecraft:",""));
    sounds.add(m(soundType,"getVolume").invoke(sound));sounds.add(m(soundType,"getPitch").invoke(sound));
    for(String method:new String[]{"getHitSound","getFallSound"})sounds.add(m(c("net.minecraft.sounds.SoundEvent"),"getLocation").invoke(m(soundType,method).invoke(sound)).toString().replace("minecraft:",""));render.put("sound",sounds);
    Object occlusion=m(state,"getOcclusionShape",access,pos).invoke(s,world,origin);List<Object> ob=new ArrayList<>();
    for(Object b:(List<?>)call(occlusion,"toAabbs",new Class[]{}))ob.add(box(b));render.put("occlusion",ob);
    rendering.add(render);
  }catch(Exception e){selections.add(null);collisions.add(null);errors.add(id+":"+e.toString());}}
  output.put("selections",selections);output.put("collisions",collisions);Map<String,Object> metadata=new LinkedHashMap<>();
  for(Object type:(Iterable<?>)f(c("net.minecraft.core.registries.BuiltInRegistries"),"ENTITY_TYPE").get(null)){
   String name=m(c("net.minecraft.core.Registry"),"getKey",Object.class).invoke(f(c("net.minecraft.core.registries.BuiltInRegistries"),"ENTITY_TYPE").get(null),type).toString().replace("minecraft:","");
   // EntityType's implementation class is erased; native create would require a
   // level. Resolve the canonical mapped classes instead and fail missing ones.
   String className="net.minecraft.world.entity.";
   Map<String,Object> fields=new LinkedHashMap<>();
   String needle=Arrays.stream(name.split("_")).map(w->w.substring(0,1).toUpperCase(Locale.ROOT)+w.substring(1)).reduce("",String::concat);
   if(name.equals("mooshroom"))needle="MushroomCow";if(name.equals("snow_golem"))needle="SnowGolem";if(name.equals("potion"))needle="ThrownPotion";if(name.equals("experience_bottle"))needle="ThrownExperienceBottle";if(name.equals("ender_pearl"))needle="ThrownEnderpearl";if(name.equals("egg"))needle="ThrownEgg";if(name.equals("fireball"))needle="LargeFireball";
   String suffix="."+needle;List<String> matches=classNames.keySet().stream().filter(n->n.startsWith(className)&&(n.endsWith(suffix)||n.endsWith("$"+suffix.substring(1)))).toList();
   if(matches.size()==1)for(Class<?> cls=c(matches.get(0));cls!=null;cls=cls.getSuperclass())for(Field f:cls.getDeclaredFields())if(Modifier.isStatic(f.getModifiers())&&f.getType()==c("net.minecraft.network.syncher.EntityDataAccessor")){f.setAccessible(true);fields.put(cls.getName()+"."+f.getName(),m(c("net.minecraft.network.syncher.EntityDataAccessor"),"getId").invoke(f.get(null)));}
   metadata.put(name,fields);
  }
  Object biomeRegistry=m(c("net.minecraft.core.HolderLookup$Provider"),"lookupOrThrow",c("net.minecraft.resources.ResourceKey")).invoke(lookupProvider,f(c("net.minecraft.core.registries.Registries"),"BIOME").get(null));Map<String,Object> biomes=new LinkedHashMap<>();
  Codec<Object> effectsCodec=(Codec<Object>)f(c("net.minecraft.world.level.biome.BiomeSpecialEffects"),"CODEC").get(null);
  for(Object holder:((java.util.stream.Stream<?>)m(c("net.minecraft.core.HolderLookup"),"listElements").invoke(biomeRegistry)).toList()){
   Object biome=m(c("net.minecraft.core.Holder"),"value").invoke(holder),key=m(c("net.minecraft.core.Holder$Reference"),"key").invoke(holder);
   String name=m(c("net.minecraft.resources.ResourceKey"),"location").invoke(key).toString();Object special=m(c("net.minecraft.world.level.biome.Biome"),"getSpecialEffects").invoke(biome);
   JsonObject data=effectsCodec.encodeStart(JsonOps.INSTANCE,special).result().orElseThrow().getAsJsonObject();
   Object climate=f(c("net.minecraft.world.level.biome.Biome"),"climateSettings").get(biome);
   data.addProperty("native_temperature",(Number)m(c("net.minecraft.world.level.biome.Biome"),"getBaseTemperature").invoke(biome));
   data.addProperty("native_downfall",(Number)m(c("net.minecraft.world.level.biome.Biome$ClimateSettings"),"downfall").invoke(climate));
   data.addProperty("native_has_precipitation",(Boolean)m(c("net.minecraft.world.level.biome.Biome"),"hasPrecipitation").invoke(biome));
   biomes.put(name,data);
  }output.put("biomeEffects",biomes);
  Object blocksRegistry=f(c("net.minecraft.core.registries.BuiltInRegistries"),"BLOCK").get(null);Map<String,Object> toolSpeeds=new LinkedHashMap<>();
  Map<String,Set<Object>> blockTags=new LinkedHashMap<>();
  Map<Object,List<Object>> bindings=new LinkedHashMap<>();
  for(Field tf:c("net.minecraft.tags.BlockTags").getDeclaredFields())if(Modifier.isStatic(tf.getModifiers())&&tf.getType()==c("net.minecraft.tags.TagKey")){
   tf.setAccessible(true);Object key=tf.get(null);String name=m(c("net.minecraft.tags.TagKey"),"location").invoke(key).toString();List<Object> holders=new ArrayList<>();
   for(Object value:blockTag(name,blocksRegistry,blockTags)){int id=((Number)m(c("net.minecraft.core.Registry"),"getId",Object.class).invoke(blocksRegistry,value)).intValue();holders.add(((Optional<?>)m(c("net.minecraft.core.Registry"),"getHolder",int.class).invoke(blocksRegistry,id)).orElseThrow());}
   bindings.put(key,holders);
  }
  m(c("net.minecraft.core.Registry"),"bindTags",Map.class).invoke(blocksRegistry,bindings);
  Method speed=m(item,"getDestroySpeed",stack,state),defaultStack=m(item,"getDefaultInstance"),defaultState=m(block,"defaultBlockState"),blockKey=m(c("net.minecraft.core.Registry"),"getKey",Object.class);
  for(int id=0;id<itemCount;id++){Object tool=m(item,"byId",int.class).invoke(null,id);if(!c("net.minecraft.world.item.DiggerItem").isInstance(tool)&&!c("net.minecraft.world.item.SwordItem").isInstance(tool)&&!c("net.minecraft.world.item.ShearsItem").isInstance(tool))continue;
   Map<String,Object> speeds=new LinkedHashMap<>();Object toolStack=defaultStack.invoke(tool);
   for(Object b:(Iterable<?>)blocksRegistry){float value=((Number)speed.invoke(tool,toolStack,defaultState.invoke(b))).floatValue();if(value!=1)speeds.put(blockKey.invoke(blocksRegistry,b).toString().replace("minecraft:",""),value);}toolSpeeds.put(""+id,speeds);
  }output.put("toolSpeeds",toolSpeeds);
  output.put("entityMetadata",metadata);
  output.put("rendering",rendering);output.put("errors",errors);Files.writeString(Path.of(args[0]),new Gson().toJson(output));
 }
}
