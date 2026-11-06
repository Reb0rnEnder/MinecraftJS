// Exact 1.15.2 player data and native respawn retention policy.
export const PLAYER_DATA={healthIndex:8,poseIndex:6,livingFlagsIndex:7,frozenIndex:null};
export function respawnPolicy(packet){return{...PLAYER_DATA,copyMetadata:true,keepAttributes:true};}
export function clampMaxHealth(value){return Math.max(0,Math.min(1024,value));}
