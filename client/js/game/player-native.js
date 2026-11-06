// Exact 1.20.6 player data and native respawn retention policy.
export const PLAYER_DATA={healthIndex:9,poseIndex:6,livingFlagsIndex:8,frozenIndex:7};
export function respawnPolicy(packet){return{...PLAYER_DATA,copyMetadata:!!(packet.dataToKeep&2),keepAttributes:!!(packet.dataToKeep&1)};}
export function clampMaxHealth(value){return Number.isNaN(value)?1:Math.max(1,Math.min(1024,value));}
