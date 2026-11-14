// Native 1.19.4 StringUtil and MobEffectInstance.compareTo. Effect IDs remain
// the 1-based registry used by this release; only presentation is shared.
export function effectDuration1194(duration,translate){
 if(duration===-1)return translate('effect.duration.infinite');
 const seconds=Math.trunc(duration/20),minutes=Math.trunc(seconds/60),hours=Math.trunc(minutes/60);
 return(hours?String(hours).padStart(2,'0')+':':'')+String(minutes%60).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
}
export function compareEffects1194([id,a],[otherId,b],definitions){
 const ambient=Number(!!a.ambient)-Number(!!b.ambient),color=(definitions[id]?.color??0)-(definitions[otherId]?.color??0);
 if(a.duration>32147&&b.duration>32147||a.ambient&&b.ambient)return ambient||color;
 return ambient||Number(a.duration===-1)-Number(b.duration===-1)||a.duration-b.duration||color;
}
