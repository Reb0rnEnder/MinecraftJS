// Keep a two-column margin outside the selected range. World data remains
// loaded; only GPU terrain meshes and obsolete build leases are released.
export function trimMeshResidency(game, camera) {
  if (!game.renderer.sections) return;
  const x=Math.floor(camera[0]/16),z=Math.floor(camera[2]/16),radius=game.settings.renderDistance+2;
  const key=x+','+z+','+radius+','+game.meshGen;
  if(game._meshRangeKey===key)return;
  game._meshRangeKey=key;
  const outside=(cx,cz)=>Math.abs(cx-x)>radius||Math.abs(cz-z)>radius;
  for(const [meshKey,section] of game.renderer.sections) {
    if(!outside(section.cx,section.cz))continue;
    const pending=section.cx+','+section.sy+','+section.cz;
    game.renderer.removeSection(meshKey);
    game.dirty.add(pending);
    game.meshedChunks.delete(section.cx+','+section.cz);
  }
  for(const pending of game.inFlight.keys()) {
    const [cx,,cz]=pending.split(',').map(Number);
    if(!outside(cx,cz))continue;
    game.inFlight.delete(pending);
    game.buildTokens.delete(pending);
    game.dirty.add(pending);
  }
}
