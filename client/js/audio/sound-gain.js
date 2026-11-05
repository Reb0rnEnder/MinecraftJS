// SoundEngine.calculateVolume clamps instance/sample volume times category,
// then the listener's master gain applies. Do not clamp instance volume first.
export function soundGain(volume,category,settings){
 const level=category==='master'?1:(settings.soundVolumes[category]??1);
 return Math.max(0,Math.min(1,volume*level))*settings.masterVolume;
}
