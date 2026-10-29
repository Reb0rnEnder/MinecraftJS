// Player.POSES dimensions extracted from the pinned native 1.17.1 jar.
export const PLAYER_POSES={"standing":[0.6,1.8],"sleeping":[0.2,0.2],"fall_flying":[0.6,0.6],"swimming":[0.6,0.6],"spin_attack":[0.6,0.6],"crouching":[0.6,1.5],"dying":[0.2,0.2]};
export function playerPoseDimensions(pose){return PLAYER_POSES[pose==='sneaking'?'crouching':pose];}
