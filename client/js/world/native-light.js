import { maskHighest } from '../net/bitset.js';
// SkyLightSectionStorage: above the highest retained sky layer is open sky.
// Empty packet masks below it remain dark; empty layers above it are not a roof.
// Boundary layers are valid data, including the sections below/above build height.
export function nativeSkyLight(light,x,y,z,hasSky){
 if(!hasSky)return 0;
 let section=(y>>4)-(light.minSection||0)+1,localY=y&15;
 if(light.skyKnown){
  const mask=light.skyDataMask||0;
  if(light._skyMask!==mask){light._skyMask=mask;light._skyHighest=maskHighest(mask);}
  const highest=light._skyHighest;
  if(section>highest)return 15;
  while(section<=highest){const bytes=light.sky[section];if(bytes){const i=(localY<<8)|(z<<4)|x;return (bytes[i>>1]>>((i&1)<<2))&15;}section++;localY=0;}
  return 15;
 }
 const bytes=light.sky[section],i=(localY<<8)|(z<<4)|x;
 return bytes?(bytes[i>>1]>>((i&1)<<2))&15:y>=(light.maxY??256)?15:0;
}
