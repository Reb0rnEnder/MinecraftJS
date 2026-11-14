import {ITEM_DATA_766} from './item-data-1.20.6.js';
// The native registry starts at zero. Gameplay, particles, labels and sprites all
// retain that same ID; never mix it with the older 1-based effect identifiers.
export const EFFECT_766=Object.freeze(Object.fromEntries(Object.entries(ITEM_DATA_766.registries.mob_effect).map(([id,key])=>[key.replace(/^minecraft:/,''),Number(id)])));
export function effectLabel766(game,id,amplifier=0){
 const def=game.items.effects[id];if(!def)return '';
 let label=game.assets.translate('effect.'+def.key.replace(':','.'));
 if(amplifier>=1&&amplifier<=9)label+=' '+game.assets.translate('enchantment.level.'+(amplifier+1));
 return label;
}
export function effectDuration766(duration,translate,tickRate=20){
 if(duration===-1)return translate('effect.duration.infinite');
 const seconds=Math.trunc(duration/tickRate),minutes=Math.trunc(seconds/60),hours=Math.trunc(minutes/60);
 return (hours?String(hours).padStart(2,'0')+':':'')+String(minutes%60).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
}
// MobEffectInstance.compareTo; inventory uses natural order, the HUD reverses it.
export function compareEffects766([id,a],[otherId,b],definitions=ITEM_DATA_766.effects){
 const ambient=Number(!!a.ambient)-Number(!!b.ambient),color=(definitions[id]?.color??0)-(definitions[otherId]?.color??0);
 if(a.duration>32147&&b.duration>32147||a.ambient&&b.ambient)return ambient||color;
 return ambient||Number(a.duration===-1)-Number(b.duration===-1)||a.duration-b.duration||color;
}

const f=Math.fround;
export function createEffectBlend766(id,duration,smooth,previous){
 const ticks=ITEM_DATA_766.effects[id]?.blendTicks??0;
 const target=duration===-1||duration>ticks?1:0;
 const current=smooth?(previous?.factor_current??0):target;
 return{padding_duration:ticks,factor_current:current,factor_previous_frame:smooth?(previous?.factor_previous_frame??0):target};
}
export function tickEffectBlend766(effect){
 const d=effect.factor;if(!d)return;d.factor_previous_frame=d.factor_current;
 if(!d.padding_duration){d.factor_current=1;return;}
 const target=effect.duration===-1||effect.duration>d.padding_duration?1:0,step=f(1/d.padding_duration);
 d.factor_current=f(d.factor_current+Math.max(-step,Math.min(step,f(target-d.factor_current))));
}
