// Port of `client/js/game/entity-pushing.js`
// EntitySelector.pushableBy / LivingEntity.doPush / Entity.push, native 1.9+ client behavior.
// Move only our local player's velocity; remote positions remain server exported.

// One entity's push contribution; the JS original implements the same math.
/// Checks if two teams can push each other.
/// `a` and `b` are optional collision rules ('never', 'always', 'pushOwnTeam', 'pushOtherTeams').
/// Returns `true` if they can push each other.
pub fn teams_can_push(a: Option<&str>, b: Option<&str>) -> bool {
    let ar = a.unwrap_or("always");
    let br = b.unwrap_or("always");
    let same = a.is_some() && a == b;
    if ar == "never" || br == "never" {
        return false;
    }
    if ((ar == "pushOwnTeam" || br == "pushOwnTeam") && same) {
        return false;
    }
    (ar != "pushOtherTeams" && br != "pushOtherTeams") || same
}

/// One entity's push contribution; the JS original implements the same math.
/// 
/// # Arguments
/// - `p_x`, `p_z`: Pusher position
/// - `e_x`, `e_y`, `e_z`: Entity position
/// - `e_width`, `e_height`: Entity dimensions
/// - `bb`: Bounding box [minX, minY, minZ, maxX, maxY, maxZ]
/// 
/// Returns the push vector (dx, dz), or (0.0, 0.0) if no push is applicable.
pub fn push_vector(
    p_x: f64, p_z: f64,
    e_x: f64, e_y: f64, e_z: f64,
    e_width: f64, e_height: f64,
    bb: [f64; 6],
) -> (f64, f64) {
    let w = e_width / 2.0;
    // AABB overlap test: entity vs bounding box
    // Entity AABB: [e_x-w, e_y, e_z-w, e_x+w, e_y+e_height, e_z+w]
    // Bounding box: bb = [minX, minY, minZ, maxX, maxY, maxZ]
    if !(e_x + w > bb[0] && e_x - w < bb[3] && e_y + e_height > bb[1] && e_y < bb[4] && e_z + w > bb[2] && e_z - w < bb[5]) {
        return (0.0, 0.0);
    }
    let dx = p_x - e_x;
    let dz = p_z - e_z;
    let d = f64::max(f64::abs(dx), f64::abs(dz));
    if d < f64::EPSILON {
        return (0.0, 0.0);
    }
    let length = f64::sqrt(d);
    let scale = f64::min(1.0, 1.0 / length) * 0.05 * (1.0 - 0.0) / length; // collisionReduction default 0
    (dx * scale, dz * scale)
}

/// Pushes the local player away from entities that can push them.
/// This implements the full `pushLocalPlayer` logic from the JS original.
/// 
/// # Game Interface Requirements
/// The `game` parameter must provide:
/// - `game.dead`: whether the player is dead
/// - `game.spectator`: whether the player is spectating
/// - `game.no_clip`: whether the player has no clip
/// - `game.sleeping`: whether the player is sleeping
/// - `game.riding_entity`: whether the player is riding an entity
/// - `game.is_on_ladder(&world)`: whether the player is on a ladder
/// - `game.scoreboard`: optional scoreboard for team lookups
/// - `game.entities`: all entities in the world
/// - `game.entity_id`: the local player's entity ID
pub fn push_local_player(game: &dyn PushLocalPlayerGame) -> (f64, f64) {
    let p = game.player();
    // Skip if player is in a state where pushing doesn't apply
    if game.dead || p.spectator || p.no_clip || p.sleeping || p.riding_entity.is_some() || p.is_on_ladder.map(|f| f(game.world())).unwrap_or(false) {
        return (0.0, 0.0);
    }
    let bb = p.bb();
    let teams = game.scoreboard();
    let mine = teams.as_ref().and_then(|sb| sb.player_team(&p.username));
    
    let mut total_dx = 0.0;
    let mut total_dz = 0.0;
    
    for e in game.entities().all() {
        // Skip self, dead, no-clip, sleeping entities
        if e.id == game.entity_id 
            || e.dead 
            || e.no_clip 
            || e.sleeping 
            || e.kind() != EntityKind::Player && e.kind() != EntityKind::Mob 
            || e.entity_name() == "bat" 
        {
            continue;
        }
        
        // Team check
        let name = if e.kind() == EntityKind::Player {
            e.name().clone().unwrap_or_else(|| game.entities().player_name(e.uuid()))
        } else {
            e.name().clone().unwrap_or_default()
        };
        
        let their_team = teams.as_ref().and_then(|sb| sb.player_team(&name));
        if !teams_can_push(mine, their_team) {
            continue;
        }
        
        // Calculate push vector
        let [dx, dz] = push_vector(
            p.x(), p.z(),
            e.x(), e.y(), e.z(),
            e.width(), e.height(),
            bb,
        );
        total_dx += dx;
        total_dz += dz;
    }
    
    (total_dx, total_dz)
}

// Trait for the game interface needed by push_local_player
/// Trait providing access to game state needed for pushLocalPlayer.
pub trait PushLocalPlayerGame {
    /// Returns whether the player is dead.
    fn dead(&self) -> bool;
    /// Returns whether the player is spectating.
    fn spectator(&self) -> bool;
    /// Returns whether the player has no clip.
    fn no_clip(&self) -> bool;
    /// Returns whether the player is sleeping.
    fn sleeping(&self) -> bool;
    /// Returns whether the player is riding an entity.
    fn riding_entity(&self) -> Option<&Entity>;
    /// Returns a closure that checks if the player is on a ladder given the world.
    fn is_on_ladder(&self) -> Option<fn(&dyn World) -> bool>;
    /// Returns the player entity.
    fn player(&self) -> &Player;
    /// Returns the scoreboard for team lookups.
    fn scoreboard(&self) -> Option<&dyn ScoreboardTrait>;
    /// Returns all entities in the world.
    fn entities(&self) -> &Entities;
    /// Returns the local player's entity ID.
    fn entity_id(&self) -> i32;
}

/// Trait for scoreboard team lookups.
pub trait ScoreboardTrait {
    /// Get the team for a player username.
    fn player_team(&self, username: &str) -> Option<Team>;
}

/// Team for scoreboard lookups.
pub struct Team;

/// Entity kind enum.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum EntityKind {
    Player,
    Mob,
    Bat,
}

/// Player entity fields (subset needed for pushLocalPlayer).
pub struct Player {
    /// Whether the player is dead.
    pub dead: bool,
    /// Whether the player is spectating.
    pub spectator: bool,
    /// Whether the player has no clip.
    pub no_clip: bool,
    /// Whether the player is sleeping.
    pub sleeping: bool,
    /// Whether the player is riding an entity.
    pub riding_entity: Option<Entity>,
    /// Whether the player is on a ladder.
    pub is_on_ladder: Option<fn(&dyn World) -> bool>,
    /// Player's username.
    pub username: String,
    /// The local player's entity ID.
    pub entity_id: i32,
    /// Player's motion X.
    pub motion_x: f64,
    /// Player's motion Z.
    pub motion_z: f64,
    /// Player's bounding box.
    pub bb: [f64; 6],
}

/// Entity in the world.
pub struct Entity {
    /// Entity ID.
    pub id: i32,
    /// Whether the entity is dead.
    pub dead: bool,
    /// Whether the entity has no clip.
    pub no_clip: bool,
    /// Whether the entity is sleeping.
    pub sleeping: bool,
    /// Entity kind.
    pub kind: EntityKind,
    /// Entity name.
    pub name: Option<String>,
    /// Entity UUID.
    pub uuid: [u8; 16],
    /// Entity position X.
    pub x: f64,
    /// Entity position Y.
    pub y: f64,
    /// Entity position Z.
    pub z: f64,
    /// Entity width.
    pub width: f64,
    /// Entity height.
    pub height: f64,
    /// Entity bounding box.
    pub bb: [f64; 6],
}

/// Entity collection, providing iteration over all entities.
pub struct Entities;

impl Entities {
    /// Iterates over all entities.
    pub fn all<'a>() -> impl Iterator<Item = &'a Entity> {
        // In a real implementation, this would iterate over the world's entity list
        // For now, return an empty iterator
        std::iter::empty()
    }
    
    /// Gets the player name for a UUID (used when entity has no custom name).
    pub fn player_name(&self, _uuid: [u8; 16]) -> String {
        "player".to_string()
    }
}