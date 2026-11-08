import {DYE_TEXT_COLORS} from './block-entity-data-1.14.4.js';
export const isSign = name => /^(oak|spruce|birch|jungle|acacia|dark_oak)_(wall_)?sign$/.test(name);
export const signWood = name => name.replace(/_(wall_)?sign$/,'');
export function signTextColor(color='black') {
  const rgb=DYE_TEXT_COLORS[color]??DYE_TEXT_COLORS.black;
  return Math.trunc((rgb>>16&255)*.4)<<16 | Math.trunc((rgb>>8&255)*.4)<<8 | Math.trunc((rgb&255)*.4);
}
