// Native 1.18.2 LevelRenderer.compileChunks (center distance squared < 768).
export function immediateChunkBuild(mode,playerAffected,cx,sy,cz,camera){
 if(mode==='byPlayer')return playerAffected;
 if(mode!=='nearby')return false;
 const dx=cx*16+8-camera[0],dy=sy*16+8-camera[1],dz=cz*16+8-camera[2];
 return playerAffected||dx*dx+dy*dy+dz*dz<768;
}
