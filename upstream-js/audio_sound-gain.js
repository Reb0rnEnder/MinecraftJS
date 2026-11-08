// Native 1.8.9 SoundManager clamps instance times sample volume first;
// category and listener/master gains apply afterwards (unlike 1.12+).
export function soundGain(volume,category,settings){
 const level=category==='master'?1:(settings.soundVolumes[category]??1);
 return Math.max(0,Math.min(1,volume))*level*settings.masterVolume;
}
