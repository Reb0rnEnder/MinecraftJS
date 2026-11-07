// Exact 1.8.9 player data and native respawn retention policy.
export const PLAYER_DATA={healthIndex:6,poseIndex:null,livingFlagsIndex:null,frozenIndex:null};
export function respawnPolicy(packet){return{...PLAYER_DATA,copyMetadata:true,keepAttributes:false};}
export function clampMaxHealth(value){return Math.max(0,Math.min(1024,value));}
