// Port of `client/js/game/bed-sleep.js`

use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};

/// Represents a block position in the world.
#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
#[wasm_bindgen]
pub struct BlockPos {
    pub x: i32,
    pub y: i32,
    pub z: i32,
}

#[wasm_bindgen]
impl BlockPos {
    #[wasm_bindgen(constructor)]
    pub fn new(x: i32, y: i32, z: i32) -> BlockPos {
        BlockPos { x, y, z }
    }
}

/// Bed facing direction.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[wasm_bindgen]
#[serde(rename_all = "lowercase")]
pub enum BedFacing {
    South = 0,
    West = 90,
    North = 180,
    East = 270,
}

/// Result of bed validation (internal).
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct BedValidationResultInner {
    pub valid: bool,
    pub facing: Option<BedFacing>,
    pub head_pos: Option<BlockPos>,
    pub foot_pos: Option<BlockPos>,
}

/// WASM-exposed wrapper for BedValidationResult.
#[wasm_bindgen]
pub struct BedValidationResult {
    inner: BedValidationResultInner,
}

#[wasm_bindgen]
impl BedValidationResult {
    #[wasm_bindgen(getter)]
    pub fn valid(&self) -> bool {
        self.inner.valid
    }
    
    #[wasm_bindgen(getter)]
    pub fn facing(&self) -> Option<BedFacing> {
        self.inner.facing
    }
    
    #[wasm_bindgen(getter)]
    pub fn head_pos(&self) -> Option<BlockPos> {
        self.inner.head_pos
    }
    
    #[wasm_bindgen(getter)]
    pub fn foot_pos(&self) -> Option<BlockPos> {
        self.inner.foot_pos
    }
}

impl From<BedValidationResultInner> for BedValidationResult {
    fn from(inner: BedValidationResultInner) -> Self {
        BedValidationResult { inner }
    }
}

/// Sleep state for an entity (internal).
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SleepStateInner {
    pub sleeping: bool,
    pub bed_pos: Option<BlockPos>,
    pub pose: String,
    pub crouching: bool,
    pub width: f32,
    pub height: f32,
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub prev_x: f64,
    pub prev_y: f64,
    pub prev_z: f64,
    pub motion_x: f64,
    pub motion_y: f64,
    pub motion_z: f64,
    pub pitch: f32,
    pub prev_pitch: f32,
}

/// WASM-exposed wrapper for SleepState.
#[wasm_bindgen]
pub struct SleepState {
    inner: SleepStateInner,
}

#[wasm_bindgen]
impl SleepState {
    #[wasm_bindgen(constructor)]
    pub fn new() -> SleepState {
        SleepState {
            inner: SleepStateInner {
                sleeping: false,
                bed_pos: None,
                pose: "standing".to_string(),
                crouching: false,
                width: 0.6,
                height: 1.8,
                x: 0.0,
                y: 0.0,
                z: 0.0,
                prev_x: 0.0,
                prev_y: 0.0,
                prev_z: 0.0,
                motion_x: 0.0,
                motion_y: 0.0,
                motion_z: 0.0,
                pitch: 0.0,
                prev_pitch: 0.0,
            },
        }
    }
    
    #[wasm_bindgen(getter)]
    pub fn sleeping(&self) -> bool {
        self.inner.sleeping
    }
    
    #[wasm_bindgen(setter)]
    pub fn set_sleeping(&mut self, val: bool) {
        self.inner.sleeping = val;
    }
    
    #[wasm_bindgen(getter)]
    pub fn bed_pos(&self) -> Option<BlockPos> {
        self.inner.bed_pos
    }
    
    #[wasm_bindgen(setter)]
    pub fn set_bed_pos(&mut self, val: Option<BlockPos>) {
        self.inner.bed_pos = val;
    }
    
    #[wasm_bindgen(getter, getter_with_clone)]
    pub fn pose(&self) -> String {
        self.inner.pose.clone()
    }
    
    #[wasm_bindgen(setter)]
    pub fn set_pose(&mut self, val: String) {
        self.inner.pose = val;
    }
    
    #[wasm_bindgen(getter)]
    pub fn crouching(&self) -> bool {
        self.inner.crouching
    }
    
    #[wasm_bindgen(setter)]
    pub fn set_crouching(&mut self, val: bool) {
        self.inner.crouching = val;
    }
    
    #[wasm_bindgen(getter)]
    pub fn width(&self) -> f32 {
        self.inner.width
    }
    
    #[wasm_bindgen(setter)]
    pub fn set_width(&mut self, val: f32) {
        self.inner.width = val;
    }
    
    #[wasm_bindgen(getter)]
    pub fn height(&self) -> f32 {
        self.inner.height
    }
    
    #[wasm_bindgen(setter)]
    pub fn set_height(&mut self, val: f32) {
        self.inner.height = val;
    }
    
    #[wasm_bindgen(getter)]
    pub fn x(&self) -> f64 {
        self.inner.x
    }
    
    #[wasm_bindgen(setter)]
    pub fn set_x(&mut self, val: f64) {
        self.inner.x = val;
    }
    
    #[wasm_bindgen(getter)]
    pub fn y(&self) -> f64 {
        self.inner.y
    }
    
    #[wasm_bindgen(setter)]
    pub fn set_y(&mut self, val: f64) {
        self.inner.y = val;
    }
    
    #[wasm_bindgen(getter)]
    pub fn z(&self) -> f64 {
        self.inner.z
    }
    
    #[wasm_bindgen(setter)]
    pub fn set_z(&mut self, val: f64) {
        self.inner.z = val;
    }
    
    #[wasm_bindgen(getter)]
    pub fn prev_x(&self) -> f64 {
        self.inner.prev_x
    }
    
    #[wasm_bindgen(setter)]
    pub fn set_prev_x(&mut self, val: f64) {
        self.inner.prev_x = val;
    }
    
    #[wasm_bindgen(getter)]
    pub fn prev_y(&self) -> f64 {
        self.inner.prev_y
    }
    
    #[wasm_bindgen(setter)]
    pub fn set_prev_y(&mut self, val: f64) {
        self.inner.prev_y = val;
    }
    
    #[wasm_bindgen(getter)]
    pub fn prev_z(&self) -> f64 {
        self.inner.prev_z
    }
    
    #[wasm_bindgen(setter)]
    pub fn set_prev_z(&mut self, val: f64) {
        self.inner.prev_z = val;
    }
    
    #[wasm_bindgen(getter)]
    pub fn motion_x(&self) -> f64 {
        self.inner.motion_x
    }
    
    #[wasm_bindgen(setter)]
    pub fn set_motion_x(&mut self, val: f64) {
        self.inner.motion_x = val;
    }
    
    #[wasm_bindgen(getter)]
    pub fn motion_y(&self) -> f64 {
        self.inner.motion_y
    }
    
    #[wasm_bindgen(setter)]
    pub fn set_motion_y(&mut self, val: f64) {
        self.inner.motion_y = val;
    }
    
    #[wasm_bindgen(getter)]
    pub fn motion_z(&self) -> f64 {
        self.inner.motion_z
    }
    
    #[wasm_bindgen(setter)]
    pub fn set_motion_z(&mut self, val: f64) {
        self.inner.motion_z = val;
    }
    
    #[wasm_bindgen(getter)]
    pub fn pitch(&self) -> f32 {
        self.inner.pitch
    }
    
    #[wasm_bindgen(setter)]
    pub fn set_pitch(&mut self, val: f32) {
        self.inner.pitch = val;
    }
    
    #[wasm_bindgen(getter)]
    pub fn prev_pitch(&self) -> f32 {
        self.inner.prev_pitch
    }
    
    #[wasm_bindgen(setter)]
    pub fn set_prev_pitch(&mut self, val: f32) {
        self.inner.prev_pitch = val;
    }
}

/// Camera position for sleeping view.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[wasm_bindgen]
pub struct SleepCamera {
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub yaw: f32,
    pub pitch: f32,
}

#[wasm_bindgen]
impl SleepCamera {
    #[wasm_bindgen(constructor)]
    pub fn new(x: f64, y: f64, z: f64, yaw: f32, pitch: f32) -> SleepCamera {
        SleepCamera { x, y, z, yaw, pitch }
    }
}

/// Update sleep result from delta.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[wasm_bindgen]
pub enum UpdateSleepResult {
    None = 0,
    Start = 1,
    Stop = 2,
}

/// BedSleep handles all bed-related sleep logic.
#[wasm_bindgen]
pub struct BedSleep {
    /// Time when sleep started (ticks since world start)
    sleep_start_tick: Option<i64>,
    /// Current bed position
    bed_pos: Option<BlockPos>,
    /// Whether currently sleeping
    sleeping: bool,
}

#[wasm_bindgen]
impl BedSleep {
    #[wasm_bindgen(constructor)]
    pub fn new() -> BedSleep {
        BedSleep {
            sleep_start_tick: None,
            bed_pos: None,
            sleeping: false,
        }
    }

    /// Check if an entity can sleep at the current time.
    /// Returns true if it's night time, not in combat, and bed is valid.
    pub fn can_sleep(&self, world_time: i64, in_combat: bool, bed_valid: bool) -> bool {
        let is_night = world_time % 24000 >= 13000 && world_time % 24000 <= 23000;
        is_night && !in_combat && bed_valid
    }

    /// Find a valid bed near the given position.
    /// Returns the bed position if found, null otherwise.
    pub fn find_bed(&self, world: &WorldView, start_x: i32, start_y: i32, start_z: i32, range: i32) -> Option<BlockPos> {
        for dx in -range..=range {
            for dz in -range..=range {
                for dy in -2..=2 {
                    let x = start_x + dx;
                    let y = start_y + dy;
                    let z = start_z + dz;
                    
                    if let Some(validation) = validate_bed_position(world, x, y, z) {
                        if validation.valid() {
                            return Some(BlockPos::new(x, y, z));
                        }
                    }
                }
            }
        }
        None
    }

    /// Start sleeping at the given bed position.
    pub fn start_sleeping(&mut self, pos: BlockPos, player: &mut SleepState) {
        self.sleeping = true;
        self.bed_pos = Some(pos);
        self.sleep_start_tick = None;

        player.set_sleeping(true);
        player.set_pose("sleeping".to_string());
        player.set_crouching(false);
        player.set_width(0.2);
        player.set_height(0.2);
        
        player.set_x(pos.x as f64 + 0.5);
        player.set_y(pos.y as f64 + 0.6875);
        player.set_z(pos.z as f64 + 0.5);
        
        player.set_prev_x(player.x());
        player.set_prev_y(player.y());
        player.set_prev_z(player.z());
        player.set_motion_x(0.0);
        player.set_motion_y(0.0);
        player.set_motion_z(0.0);
        player.set_pitch(0.0);
        player.set_prev_pitch(0.0);
    }

    /// Stop sleeping and reset state.
    pub fn stop_sleeping(&mut self, player: &mut SleepState) {
        self.sleeping = false;
        self.bed_pos = None;
        self.sleep_start_tick = None;

        player.set_sleeping(false);
        player.set_pose("standing".to_string());
        player.set_width(0.6);
        player.set_height(1.8);
    }

    /// Wake up the sleeper (explicit wake up).
    pub fn wake_up(&mut self, player: &mut SleepState) {
        self.stop_sleeping(player);
    }

    /// Get current sleep state.
    pub fn is_sleeping(&self) -> bool {
        self.sleeping
    }

    /// Get current bed position.
    pub fn bed_pos(&self) -> Option<BlockPos> {
        self.bed_pos
    }

    /// Set the sleep start tick (for wake time calculation).
    pub fn set_sleep_start_tick(&mut self, tick: i64) {
        self.sleep_start_tick = Some(tick);
    }

    /// Get the sleep start tick.
    pub fn sleep_start_tick(&self) -> Option<i64> {
        self.sleep_start_tick
    }
}

/// World view trait for bed validation (minimal interface).
#[wasm_bindgen]
pub struct WorldView {
}

#[wasm_bindgen]
impl WorldView {
    #[wasm_bindgen(constructor)]
    pub fn new() -> WorldView {
        WorldView {}
    }

    /// Get block state at position (to be implemented by JS side).
    pub fn get_state(&self, _x: i32, _y: i32, _z: i32) -> u32 {
        0
    }
}

/// Validate a bed position - checks if it's a bed, not obstructed, and has space for player.
/// Returns validation result with facing direction and head/foot positions.
#[wasm_bindgen]
pub fn validate_bed_position(world: &WorldView, x: i32, y: i32, z: i32) -> Option<BedValidationResult> {
    let state = world.get_state(x, y, z);
    
    let is_bed = state != 0;
    
    if !is_bed {
        return None;
    }
    
    let facing = BedFacing::South;
    
    let (head_x, head_z) = match facing {
        BedFacing::South => (x, z + 1),
        BedFacing::North => (x, z - 1),
        BedFacing::West => (x - 1, z),
        BedFacing::East => (x + 1, z),
    };
    
    let head_pos = BlockPos::new(head_x, y, head_z);
    let foot_pos = BlockPos::new(x, y, z);
    
    let head_state = world.get_state(head_x, y, head_z);
    let head_obstructed = head_state != 0;
    
    let space_above_foot = world.get_state(x, y + 1, z) == 0;
    let space_above_head = world.get_state(head_x, y + 1, head_z) == 0;
    
    let valid = !head_obstructed && space_above_foot && space_above_head;
    
    Some(BedValidationResultInner {
        valid,
        facing: Some(facing),
        head_pos: Some(head_pos),
        foot_pos: Some(foot_pos),
    }.into())
}

/// Calculate the wake-up time when sleeping.
/// Returns the target world time to wake up at.
#[wasm_bindgen]
pub fn calculate_wake_time(current_time: i64) -> i64 {
    let time_of_day = current_time % 24000;
    
    if time_of_day >= 13000 {
        current_time + (24000 - time_of_day)
    } else if time_of_day < 13000 {
        current_time + (24000 - time_of_day)
    } else {
        current_time
    }
}

/// Calculate sleep percentage for multiplayer sleep coordination.
/// Returns the percentage of players sleeping (0.0 to 1.0).
#[wasm_bindgen]
pub fn sleep_percentage(total_players: u32, sleeping_players: u32) -> f64 {
    if total_players == 0 {
        return 0.0;
    }
    (sleeping_players as f64) / (total_players as f64)
}

/// Check if enough players are sleeping to skip night.
/// Vanilla requires > 50% of players in the overworld to be sleeping.
#[wasm_bindgen]
pub fn can_skip_night(total_players: u32, sleeping_players: u32) -> bool {
    if total_players == 0 {
        return false;
    }
    sleeping_players * 2 > total_players
}

/// Get the bed facing direction from a block state.
#[wasm_bindgen]
pub fn get_bed_facing(block_name: &str, facing_prop: &str) -> Option<BedFacing> {
    if !block_name.ends_with("_bed") {
        return None;
    }
    
    match facing_prop {
        "south" => Some(BedFacing::South),
        "west" => Some(BedFacing::West),
        "north" => Some(BedFacing::North),
        "east" => Some(BedFacing::East),
        _ => None,
    }
}

/// Delta structure for sleeping position updates (internal).
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SleepDeltaInner {
    pub positions: Vec<Option<BlockPos>>,
}

/// WASM-exposed wrapper for SleepDelta.
#[wasm_bindgen]
pub struct SleepDelta {
    inner: SleepDeltaInner,
}

#[wasm_bindgen]
impl SleepDelta {
    #[wasm_bindgen(constructor)]
    pub fn new() -> SleepDelta {
        SleepDelta { inner: SleepDeltaInner { positions: Vec::new() } }
    }

    /// Positions as a JSON array; each entry is null or [x, y, z].
    #[wasm_bindgen(getter)]
    pub fn positions_json(&self) -> String {
        let vals: Vec<serde_json::Value> = self
            .inner
            .positions
            .iter()
            .map(|p| match p {
                Some(b) => serde_json::json!([b.x, b.y, b.z]),
                None => serde_json::Value::Null,
            })
            .collect();
        serde_json::to_string(&vals).unwrap_or_else(|_| "[]".to_string())
    }

    #[wasm_bindgen(setter)]
    pub fn set_positions_json(&mut self, val: &str) {
        let parsed: Vec<serde_json::Value> = serde_json::from_str(val).unwrap_or_default();
        self.inner.positions = parsed
            .into_iter()
            .map(|v| {
                v.as_array().and_then(|a| {
                    if a.len() >= 3 {
                        Some(BlockPos {
                            x: a[0].as_i64().unwrap_or(0) as i32,
                            y: a[1].as_i64().unwrap_or(0) as i32,
                            z: a[2].as_i64().unwrap_or(0) as i32,
                        })
                    } else {
                        None
                    }
                })
            })
            .collect();
    }
}

/// Update sleeping state from network delta (ported from JS updateSleeping).
/// Returns UpdateSleepResult indicating what changed.
#[wasm_bindgen]
pub fn update_sleeping_from_delta(
    game_sleeping: bool,
    game_bed_pos: Option<BlockPos>,
    delta: &SleepDelta,
    index: usize,
    pose_field: u32,
) -> UpdateSleepResult {
    if index < delta.inner.positions.len() {
        let pos = &delta.inner.positions[index];
        if let Some(pos) = pos {
            let changed = !game_sleeping 
                || game_bed_pos.is_none() 
                || game_bed_pos.unwrap().x != pos.x 
                || game_bed_pos.unwrap().y != pos.y 
                || game_bed_pos.unwrap().z != pos.z;
            
            if changed {
                return UpdateSleepResult::Start;
            }
        } else if game_sleeping {
            return UpdateSleepResult::Stop;
        }
    }
    
    if pose_field != 2 && game_sleeping {
        return UpdateSleepResult::Stop;
    }
    
    UpdateSleepResult::None
}

/// Calculate sleeping camera position (ported from JS sleepingCamera).
#[wasm_bindgen]
pub fn calculate_sleeping_camera(
    game_sleeping: bool,
    camera_entity: bool,
    debug_cam: bool,
    third_person: i32,
    player: &SleepState,
    bed_facing: Option<BedFacing>,
    camera_eye_height: Option<f64>,
    partial_tick: f64,
) -> Option<SleepCamera> {
    if !game_sleeping || camera_entity || debug_cam || third_person > 0 {
        return None;
    }
    
    let angle = bed_facing.map(|f| f as i32).unwrap_or(0);
    let yaw = (angle - 180) as f32;
    
    let x = player.inner.prev_x + (player.inner.x - player.inner.prev_x) * partial_tick;
    let y = player.inner.prev_y + (player.inner.y - player.inner.prev_y) * partial_tick;
    let z = player.inner.prev_z + (player.inner.z - player.inner.prev_z) * partial_tick;
    
    let eye_height = camera_eye_height.unwrap_or(0.2);
    let y = y + eye_height + 0.3;
    
    Some(SleepCamera::new(x, y, z, yaw, 0.0))
}

/// Wake up conditions check.
/// Returns true if the player should wake up.
#[wasm_bindgen]
pub fn should_wake_up(
    world_time: i64,
    took_damage: bool,
    bed_destroyed: bool,
    left_bed: bool,
    in_combat: bool,
) -> bool {
    let time_of_day = world_time % 24000;
    let is_morning = time_of_day < 13000 && time_of_day > 0;
    
    is_morning || took_damage || bed_destroyed || left_bed || in_combat
}

impl Default for BedSleep {
    fn default() -> Self {
        Self::new()
    }
}

impl Default for SleepState {
    fn default() -> Self {
        Self::new()
    }
}

impl Default for SleepDelta {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_wake_time() {
        assert_eq!(calculate_wake_time(18000), 24000);
        assert_eq!(calculate_wake_time(13000), 24000);
        assert_eq!(calculate_wake_time(1000), 24000);
    }

    #[test]
    fn test_sleep_percentage() {
        assert_eq!(sleep_percentage(0, 0), 0.0);
        assert_eq!(sleep_percentage(4, 2), 0.5);
        assert_eq!(sleep_percentage(4, 3), 0.75);
        assert_eq!(sleep_percentage(1, 1), 1.0);
    }

    #[test]
    fn test_can_skip_night() {
        assert!(!can_skip_night(0, 0));
        assert!(!can_skip_night(4, 2));
        assert!(can_skip_night(4, 3));
        assert!(can_skip_night(1, 1));
        assert!(!can_skip_night(3, 1));
        assert!(can_skip_night(3, 2));
    }

    #[test]
    fn test_get_bed_facing() {
        assert_eq!(get_bed_facing("white_bed", "south"), Some(BedFacing::South));
        assert_eq!(get_bed_facing("white_bed", "north"), Some(BedFacing::North));
        assert_eq!(get_bed_facing("white_bed", "west"), Some(BedFacing::West));
        assert_eq!(get_bed_facing("white_bed", "east"), Some(BedFacing::East));
        assert_eq!(get_bed_facing("white_bed", "up"), None);
        assert_eq!(get_bed_facing("stone", "south"), None);
    }

    #[test]
    fn test_should_wake_up() {
        assert!(should_wake_up(1000, false, false, false, false));
        assert!(!should_wake_up(18000, false, false, false, false));
        assert!(should_wake_up(18000, true, false, false, false));
        assert!(should_wake_up(18000, false, true, false, false));
        assert!(should_wake_up(18000, false, false, true, false));
        assert!(should_wake_up(18000, false, false, false, true));
    }

    #[test]
    fn test_bed_sleep_start_stop() {
        let mut bed_sleep = BedSleep::new();
        let mut player = SleepState::new();
        let pos = BlockPos::new(100, 64, 100);
        
        assert!(!bed_sleep.is_sleeping());
        
        bed_sleep.start_sleeping(pos, &mut player);
        
        assert!(bed_sleep.is_sleeping());
        assert_eq!(bed_sleep.bed_pos(), Some(pos));
        assert!(player.sleeping());
        assert_eq!(player.pose(), "sleeping");
        assert_eq!(player.width(), 0.2);
        assert_eq!(player.height(), 0.2);
        assert_eq!(player.x(), 100.5);
        assert_eq!(player.y(), 64.6875);
        assert_eq!(player.z(), 100.5);
        
        bed_sleep.stop_sleeping(&mut player);
        
        assert!(!bed_sleep.is_sleeping());
        assert_eq!(bed_sleep.bed_pos(), None);
        assert!(!player.sleeping());
        assert_eq!(player.pose(), "standing");
        assert_eq!(player.width(), 0.6);
        assert_eq!(player.height(), 1.8);
    }
}
