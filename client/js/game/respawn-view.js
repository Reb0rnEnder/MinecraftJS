// Native respawn creates a new local player and restores the camera to it.
// Retain authoritative game data here, but never retain another entity's view/mount.
export function resetPlayerView(game){
 game.cameraEntity=null;game.ridingEntityId=-1;
 if(game.player){game.player.ridingEntity=null;game.player.ridingBoat=false;}
 game._dropVehicle?.();game.cameraEye?.reset();
 game.horseJumpCounter=0;game.horseJump=undefined;game._rideJump=false;
}
