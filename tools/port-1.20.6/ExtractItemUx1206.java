import java.nio.file.*;import java.util.*;import java.lang.reflect.*;import java.util.function.*;import com.google.gson.*;import com.mojang.serialization.*;
// Reuse the pinned mapping and real registry/ItemStack codec helpers.
public class ExtractItemUx1206 extends ExtractCreative1206 {
 static Object reg(String name)throws Exception{return f(c("net.minecraft.core.registries.BuiltInRegistries"),name).get(null);}
 static int id(Object registry,Object value)throws Exception{return (Integer)m(c("net.minecraft.core.Registry"),"getId",Object.class).invoke(registry,value);}
 static String key(Object registry,Object value)throws Exception{return m(c("net.minecraft.core.Registry"),"getKey",Object.class).invoke(registry,value).toString();}
 static Map<String,Object> effect(Object effect)throws Exception{
  Object holder=call(effect,"getEffect",new Class<?>[]{}),value=call(holder,"value",new Class<?>[]{});
  return Map.of("id",id(reg("MOB_EFFECT"),value),"duration",call(effect,"getDuration",new Class<?>[]{}),"amplifier",call(effect,"getAmplifier",new Class<?>[]{}),"particles",call(effect,"isVisible",new Class<?>[]{}),"ambient",call(effect,"isAmbient",new Class<?>[]{}),"icon",call(effect,"showIcon",new Class<?>[]{}));
 }
 static Object text(Object value)throws Exception{return m(c("net.minecraft.network.chat.Component"),"getString").invoke(value);}
 static Object component(Object value)throws Exception{
  Codec codec=(Codec)f(c("net.minecraft.network.chat.ComponentSerialization"),"CODEC").get(null);return codec.encodeStart(JsonOps.INSTANCE,value).getOrThrow();
 }
 static List<Integer> enchantmentOrder=new ArrayList<>();
 static Object tooltipLookup(Object originalProvider)throws Exception{
  Object provider=taggedLookup(originalProvider);Class<?> providerType=c("net.minecraft.core.HolderLookup$Provider"),lookupType=c("net.minecraft.core.HolderLookup$RegistryLookup");
  Object registry=f(c("net.minecraft.core.registries.Registries"),"ENCHANTMENT").get(null),lookup=m(providerType,"lookupOrThrow",c("net.minecraft.resources.ResourceKey")).invoke(provider,registry);
  Object key=m(c("net.minecraft.tags.TagKey"),"create",c("net.minecraft.resources.ResourceKey"),c("net.minecraft.resources.ResourceLocation")).invoke(null,registry,c("net.minecraft.resources.ResourceLocation").getConstructor(String.class).newInstance("minecraft:tooltip_order"));
  Map<Object,Object> tags=new HashMap<>();Object order=tag(lookup,key,tags);
  for(Object holder:(Iterable<?>)order)enchantmentOrder.add(id(reg("ENCHANTMENT"),call(holder,"value",new Class<?>[]{})));
  for(Map.Entry<Object,List<Object>> entry:holderTags.entrySet())m(c("net.minecraft.core.Holder$Reference"),"bindTags",Collection.class).invoke(entry.getKey(),entry.getValue());
  Object wrapper=Proxy.newProxyInstance(lookupType.getClassLoader(),new Class<?>[]{lookupType},(p,method,a)->{
   if(a!=null&&a.length==1&&method.getReturnType()==Optional.class&&c("net.minecraft.tags.TagKey").isInstance(a[0]))return Optional.of(tag(lookup,a[0],tags));
   if(method.isDefault())return InvocationHandler.invokeDefault(p,method,a);return method.invoke(lookup,a);
  });
  return Proxy.newProxyInstance(providerType.getClassLoader(),new Class<?>[]{providerType},(p,method,a)->{
   if(method.isDefault())return InvocationHandler.invokeDefault(p,method,a);if(a!=null&&a.length==1&&registry.equals(a[0]))return Optional.of(wrapper);return method.invoke(provider,a);
  });
 }
 static List<Object> blendSamples()throws Exception{
  List<Object> out=new ArrayList<>();Class<?> type=c("net.minecraft.world.effect.MobEffectInstance"),blendType=c("net.minecraft.world.effect.MobEffectInstance$BlendState");
  Object darkness=f(c("net.minecraft.world.effect.MobEffects"),"DARKNESS").get(null);
  for(int duration:new int[]{100,26,-1})for(boolean smooth:new boolean[]{false,true}){
   Object effect=type.getConstructor(c("net.minecraft.core.Holder"),int.class,int.class).newInstance(darkness,duration,0);
   if(!smooth)m(type,"skipBlending").invoke(effect);
   Object blend=f(type,"blendState").get(effect);List<Object> frames=new ArrayList<>();
   for(int i=0;i<=26;i++){
    if(i>0){int left=f(type,"duration").getInt(effect);if(left>0)f(type,"duration").setInt(effect,left-1);m(blendType,"tick",type).invoke(blend,effect);}
    frames.add(Map.of("duration",f(type,"duration").getInt(effect),"current",f(blendType,"factor").getFloat(blend),"previous",f(blendType,"factorPreviousFrame").getFloat(blend)));
   }
   out.add(Map.of("duration",duration,"smooth",smooth,"frames",frames));
  }return out;
 }
 public static void main(String[] args)throws Exception{
  loadMappings(Path.of(args[1]));m(c("net.minecraft.SharedConstants"),"tryDetectVersion").invoke(null);m(c("net.minecraft.server.Bootstrap"),"bootStrap").invoke(null);
  Object lookup=tooltipLookup(m(c("net.minecraft.data.registries.VanillaRegistries"),"createLookup").invoke(null));stackRegistries=registryAccess(lookup,Path.of(args[2]));
  Object ops=m(c("net.minecraft.resources.RegistryOps"),"create",DynamicOps.class,c("net.minecraft.core.HolderLookup$Provider")).invoke(null,JsonOps.INSTANCE,lookup);
  Map<String,Object> out=new TreeMap<>(),registries=new TreeMap<>(),effects=new TreeMap<>(),potions=new TreeMap<>(),items=new TreeMap<>(),eggs=new TreeMap<>(),instruments=new TreeMap<>();
  for(String kind:new String[]{"MOB_EFFECT","ENCHANTMENT","ATTRIBUTE","POTION","INSTRUMENT"}){
   Object r=reg(kind);Map<Integer,String> names=new TreeMap<>();for(Object value:(Iterable<?>)r)names.put(id(r,value),key(r,value));registries.put(kind.toLowerCase(Locale.ROOT),names);
  }
  for(Object value:(Iterable<?>)reg("MOB_EFFECT")){
   List<Object> mods=new ArrayList<>();BiConsumer<Object,Object> consumer=(attr,mod)->{try{Object a=call(attr,"value",new Class<?>[]{});mods.add(List.of(key(reg("ATTRIBUTE"),a),call(mod,"amount",new Class<?>[]{}),((Enum<?>)call(mod,"operation",new Class<?>[]{})).ordinal()));}catch(Exception e){throw new RuntimeException(e);}};
   m(c("net.minecraft.world.effect.MobEffect"),"createModifiers",int.class,BiConsumer.class).invoke(value,0,consumer);
   effects.put(String.valueOf(id(reg("MOB_EFFECT"),value)),Map.of("key",key(reg("MOB_EFFECT"),value),"color",call(value,"getColor",new Class<?>[]{}),"bad",((Enum<?>)call(value,"getCategory",new Class<?>[]{})).ordinal()==1,"beneficial",((Enum<?>)call(value,"getCategory",new Class<?>[]{})).ordinal()==0,"blendTicks",call(value,"getBlendDurationTicks",new Class<?>[]{}),"modifiers",mods));
  }
  for(Object value:(Iterable<?>)reg("POTION")){
   List<Object> fx=new ArrayList<>();for(Object e:(List<?>)call(value,"getEffects",new Class<?>[]{}))fx.add(effect(e));
   Object k=Optional.of(m(c("net.minecraft.core.Registry"),"wrapAsHolder",Object.class).invoke(reg("POTION"),value));
   potions.put(String.valueOf(id(reg("POTION"),value)),Map.of("key",key(reg("POTION"),value),"name",m(c("net.minecraft.world.item.alchemy.Potion"),"getName",Optional.class,String.class).invoke(value,k,""),"effects",fx));
  }
  for(Object value:(Iterable<?>)reg("INSTRUMENT"))instruments.put(String.valueOf(id(reg("INSTRUMENT"),value)),Map.of("key",key(reg("INSTRUMENT"),value),"duration",call(value,"useDuration",new Class<?>[]{}),"range",call(value,"range",new Class<?>[]{})));
  for(Object value:(Iterable<?>)reg("ITEM")){
   Object stack=call(value,"getDefaultInstance",new Class<?>[]{});items.put(String.valueOf(id(reg("ITEM"),value)),Map.of("action",((Enum<?>)call(stack,"getUseAnimation",new Class<?>[]{})).name().toLowerCase(Locale.ROOT),"duration",call(stack,"getUseDuration",new Class<?>[]{}),"foil",call(stack,"hasFoil",new Class<?>[]{}),"defaultAttributes",((Codec)f(c("net.minecraft.world.item.component.ItemAttributeModifiers"),"CODEC").get(null)).encodeStart((DynamicOps)ops,call(value,"getDefaultAttributeModifiers",new Class<?>[]{})).getOrThrow()));
   if(c("net.minecraft.world.item.SpawnEggItem").isInstance(value))eggs.put(key(reg("ITEM"),value),List.of(m(c("net.minecraft.world.item.SpawnEggItem"),"getColor",int.class).invoke(value,0),m(c("net.minecraft.world.item.SpawnEggItem"),"getColor",int.class).invoke(value,1)));
  }
  Codec codec=(Codec)f(c("net.minecraft.world.item.ItemStack"),"CODEC").get(null);List<Object> samples=new ArrayList<>();Object colors=m(c("net.minecraft.client.color.item.ItemColors"),"createDefault",c("net.minecraft.client.color.block.BlockColors")).invoke(null,m(c("net.minecraft.client.color.block.BlockColors"),"createDefault").invoke(null));
  Object tooltipContext=m(c("net.minecraft.world.item.Item$TooltipContext"),"of",c("net.minecraft.core.HolderLookup$Provider")).invoke(null,lookup);
  for(JsonElement input:JsonParser.parseString(Files.readString(Path.of(args[3]))).getAsJsonArray()){
   JsonObject entry=input.getAsJsonObject();Object stack=codec.parse((DynamicOps)ops,entry.get("stack")).getOrThrow();Map<String,Object> result=new TreeMap<>();result.put("label",entry.get("label").getAsString());result.put("input",entry.get("stack"));result.put("wire",stack((cur)stack,lookup));
   for(String[] pair:new String[][]{{"damage","getDamageValue"},{"maxDamage","getMaxDamage"},{"maxStack","getMaxStackSize"},{"damageable","isDamageableItem"},{"foil","hasFoil"},{"duration","getUseDuration"}})result.put(pair[0],call(stack,pair[1],new Class<?>[]{}));
   result.put("name",text(call(stack,"getHoverName",new Class<?>[]{})));result.put("rarity",((Enum<?>)call(stack,"getRarity",new Class<?>[]{})).name().toLowerCase(Locale.ROOT));result.put("action",((Enum<?>)call(stack,"getUseAnimation",new Class<?>[]{})).name().toLowerCase(Locale.ROOT));
   List<Object> tips=new ArrayList<>();for(Object line:(List<?>)m(c("net.minecraft.world.item.ItemStack"),"getTooltipLines",c("net.minecraft.world.item.Item$TooltipContext"),c("net.minecraft.world.entity.player.Player"),c("net.minecraft.world.item.TooltipFlag")).invoke(stack,tooltipContext,null,f(c("net.minecraft.world.item.TooltipFlag"),"NORMAL").get(null)))tips.add(component(line));result.put("tooltip",tips);
   List<Object> advanced=new ArrayList<>();for(Object line:(List<?>)m(c("net.minecraft.world.item.ItemStack"),"getTooltipLines",c("net.minecraft.world.item.Item$TooltipContext"),c("net.minecraft.world.entity.player.Player"),c("net.minecraft.world.item.TooltipFlag")).invoke(stack,tooltipContext,null,f(c("net.minecraft.world.item.TooltipFlag"),"ADVANCED").get(null)))advanced.add(component(line));result.put("advancedTooltip",advanced);
   List<Integer> tint=new ArrayList<>();for(int i=0;i<2;i++)tint.add(((Integer)m(c("net.minecraft.client.color.item.ItemColors"),"getColor",c("net.minecraft.world.item.ItemStack"),int.class).invoke(colors,stack,i))&0xffffff);result.put("colors",tint);samples.add(result);
  }
  Map<Integer,String> fireworkColors=new TreeMap<>();for(Object dye:c("net.minecraft.world.item.DyeColor").getEnumConstants())fireworkColors.put((Integer)call(dye,"getFireworkColor",new Class<?>[]{}),(String)call(dye,"getName",new Class<?>[]{}));out.put("fireworkColors",fireworkColors);out.put("baseAttackDamageUuid",f(c("net.minecraft.world.item.Item"),"BASE_ATTACK_DAMAGE_UUID").get(null).toString());out.put("baseAttackSpeedUuid",f(c("net.minecraft.world.item.Item"),"BASE_ATTACK_SPEED_UUID").get(null).toString());out.put("enchantmentOrder",enchantmentOrder);out.put("registries",registries);out.put("effects",effects);out.put("potions",potions);out.put("items",items);out.put("eggs",eggs);out.put("instruments",instruments);out.put("samples",samples);out.put("blendSamples",blendSamples());
  Files.writeString(Path.of(args[0]),new GsonBuilder().disableHtmlEscaping().create().toJson(out));
 }
}
