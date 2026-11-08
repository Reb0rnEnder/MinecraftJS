// Native SoundEngine uses sample attenuation, not the network SoundEvent fixed range.
export function sampleAttenuation(volume,sample){return Math.fround(Math.max(1,Math.fround(volume))*16);}
