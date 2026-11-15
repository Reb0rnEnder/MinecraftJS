import{PAWS_DATA_766}from'../game/paws-data-1.20.6.js';
import{simplify}from'../net/nbt.js';import{registryEntries}from'../net/registry-codec.js';import{KNOWN_PACK_766}from'../net/known-pack-1.20.6.js';
const cache=new WeakMap();let vanilla;
export function wolfTexture766(game={},e){
 const source=game.dimensionCodec;let entries;if(source){entries=cache.get(source);if(!entries){entries=registryEntries(simplify(source),'minecraft:wolf_variant');cache.set(source,entries);}}else entries=vanilla??=KNOWN_PACK_766.registries['minecraft:wolf_variant'].map((entry,id)=>({id,name:entry.key,element:simplify(entry.value)}));
 const variant=e.wolfVariant===undefined?entries.find(v=>v.name==='minecraft:pale'):entries.find(v=>v.id===e.wolfVariant),texture=variant?.element?.[e.tamed?'tame_texture':e.angry?'angry_texture':'wild_texture'];
 if(typeof texture!=='string')return null;return texture.replace(/^minecraft:/,'')+'.png';
}
export function wolfArmor766(items,stack){
 if(!stack||items.name(stack.id)!=='wolf_armor')return null;
 const max=items.maxDurability(stack),damage=items.damage(stack),fraction=Math.fround(1-Math.fround(damage/max)),crack=!items.isDamageable(stack)?null:fraction<PAWS_DATA_766.crackThresholds.fractionHigh?'high':fraction<PAWS_DATA_766.crackThresholds.fractionMedium?'medium':fraction<PAWS_DATA_766.crackThresholds.fractionLow?'low':null;
 const dye=items.component(stack,'dyed_color'),rgb=(dye?.rgb??dye?.color??0)>>>0;
 return{crack,color:dye===undefined?null:[(rgb>>16&255)/255,(rgb>>8&255)/255,(rgb&255)/255]};
}
