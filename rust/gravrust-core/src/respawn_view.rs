// Port of `client/js/game/respawn-view.js`.
//
// Native respawn creates a new local player and restores the camera to it.
// Retain authoritative game data here, but never retain another entity's
// view/mount.

/// The game surface `resetPlayerView` touches. The JS mutates `game.*`
/// directly; the host implements this against its game state so the ported
/// logic never holds a second competing Game type.
pub trait RespawnViewGame {
    /// JS: `game.cameraEntity = null`.
    fn clear_camera_entity(&mut self);
    /// JS: `game.ridingEntityId = -1`.
    fn set_riding_entity_id(&mut self, id: i32);
    /// JS: `game.player` — whether a local player exists.
    fn has_player(&self) -> bool;
    /// JS: `game.player.ridingEntity = null; game.player.ridingBoat = false;`.
    fn clear_player_mount(&mut self);
    /// JS: `game._dropVehicle?.()` — the vehicle teardown hook, when present.
    fn drop_vehicle(&mut self);
    /// JS: `game.cameraEye?.reset()` — the camera-eye helper, when present.
    fn reset_camera_eye(&mut self);
    /// JS: `game.horseJumpCounter = 0`.
    fn set_horse_jump_counter(&mut self, v: i32);
    /// JS: `game.horseJump = undefined`.
    fn clear_horse_jump(&mut self);
    /// JS: `game._rideJump = false`.
    fn set_ride_jump(&mut self, v: bool);
}

/// JS: `export function resetPlayerView(game)`.
pub fn reset_player_view(game: &mut dyn RespawnViewGame) {
    // JS: game.cameraEntity=null; game.ridingEntityId=-1;
    game.clear_camera_entity();
    game.set_riding_entity_id(-1);
    // JS: if(game.player){game.player.ridingEntity=null;game.player.ridingBoat=false;}
    if game.has_player() {
        game.clear_player_mount();
    }
    // JS: game._dropVehicle?.(); game.cameraEye?.reset();
    game.drop_vehicle();
    game.reset_camera_eye();
    // JS: game.horseJumpCounter=0; game.horseJump=undefined; game._rideJump=false;
    game.set_horse_jump_counter(0);
    game.clear_horse_jump();
    game.set_ride_jump(false);
}
