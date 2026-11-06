// Exact 1.16.5 player data and native respawn retention policy.
export const PLAYER_DATA={healthIndex:8,poseIndex:6,livingFlagsIndex:7,frozenIndex:null};
export function respawnPolicy(packet){return{...PLAYER_DATA,copyMetadata:true,keepAttributes:!!(packet.keepAttributes??packet.copyMetadata)};}
export function clampMaxHealth(value){return Number.isNaN(value)?1:Math.max(1,Math.min(1024,value));}
