import {DYE_TEXT_COLORS} from './block-entity-data-1.14.4.js';
export const isSign = name => /^(oak|spruce|birch|jungle|acacia|dark_oak|crimson|warped)_(wall_)?sign$/.test(name);
export const signWood = name => name.replace(/_(wall_)?sign$/,'');
export function signTextColor(color='black') {
  const rgb=DYE_TEXT_COLORS[color]??DYE_TEXT_COLORS.black;
  return Math.trunc((rgb>>16&255)*.4)<<16 | Math.trunc((rgb>>8&255)*.4)<<8 | Math.trunc((rgb&255)*.4);
}

// Native 1.17.1 SignRenderer: black glow text always has its pale outline;
// other dyes have a dark outline within 16 blocks or through a spyglass.
export function glowingSignStyle(color = 'black', glowing = false, distanceSquared = Infinity, scoping = false) {
  const dark = signTextColor(color);
  return {
    color: glowing ? (DYE_TEXT_COLORS[color] ?? DYE_TEXT_COLORS.black) : dark,
    outlineColor: glowing && (color === 'black' || distanceSquared < 256 || scoping)
      ? (color === 'black' ? 0xf0ebcc : dark) : undefined,
  };
}
