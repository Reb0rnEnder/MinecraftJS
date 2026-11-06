// Exact 1.13.2 player data and native respawn retention policy.
export const PLAYER_DATA={healthIndex:7,poseIndex:null,livingFlagsIndex:6,frozenIndex:null};
export function respawnPolicy(packet){return{...PLAYER_DATA,copyMetadata:true,keepAttributes:false};}
export function clampMaxHealth(value){return Math.max(0,Math.min(1024,value));}
