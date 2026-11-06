// Exact 1.17.1 player data and native respawn retention policy.
export const PLAYER_DATA={healthIndex:9,poseIndex:6,livingFlagsIndex:8,frozenIndex:7};
export function respawnPolicy(packet){return{...PLAYER_DATA,copyMetadata:true,keepAttributes:!!(packet.keepAttributes??packet.copyMetadata)};}
export function clampMaxHealth(value){return Number.isNaN(value)?1:Math.max(1,Math.min(1024,value));}
