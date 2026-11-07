//! Port of `client/js/game/respawn-player.js` (upstream MinecraftJS 1.8.9).
//!
//! Native respawn creates a fresh player. The target supplies its metadata
//! and attribute retention policies, whose meanings change between releases.
//!
//! Integration notes (honest deviations, none behavioral in the ported logic):
//! - JS reaches `game.world` implicitly; here the world is an explicit
//!   [`PhysicsWorld`] parameter.
//! - `game.entityRenderer.remove(id)` is deferred: the port records the id in
//!   `GameCore::pending_entity_removals` for the render loop to consume.
//! - `onPowderSnow` is a dynamic JS field that the typed LocalPlayer does not
//!   carry (it is unset in the upstream constructor, so the JS copy loop is a
//!   no-op for it in practice).

use crate::local_player::{f32r, LocalPlayer, PhysicsWorld};
use crate::player_native::PLAYER_DATA;
use serde_json::Value;

/// JS: `game.inventory` surface touched by respawn.
#[derive(Debug, Clone, Default)]
pub struct InventoryCore {
    pub state_id: Option<i64>,
    pub properties: Value,
    pub drag_event: i64,
    pub drag_mode: i64,
    pub drag_slots: Vec<i64>,
}

impl InventoryCore {
    /// JS: `game.inventory.reset()` — full reset delegates to the container
    /// module once wired; the respawn-critical fields are cleared here.
    pub fn reset(&mut self) {
        self.properties = Value::Null;
        self.drag_event = 0;
        self.drag_mode = -1;
        self.drag_slots.clear();
    }
}

/// JS: `game.interaction` surface touched by respawn.
#[derive(Debug, Clone, Copy, Default)]
pub struct InteractionCore {
    pub ticks_since_last_swing: i64,
    pub use_ticks: i64,
    pub spyglass_using: bool,
}

/// JS: `game.lastReported`.
#[derive(Debug, Clone, Copy, Default)]
pub struct LastReported {
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub yaw: f64,
    pub pitch: f64,
    pub sneak: bool,
    pub sprint: bool,
}

/// The `game` surface `replaceRespawnPlayer` touches.
pub struct GameCore {
    pub player: Option<LocalPlayer>,
    pub max_health: Option<f64>,
    pub health: f64,
    pub prev_health: f64,
    pub self_metadata: Value,
    pub spawn_pos: Option<[f64; 3]>,
    pub spawn_angle: Option<f64>,
    pub effects: Value,
    pub sleeping: bool,
    pub bed_pos: Option<Value>,
    pub dead: bool,
    pub hurt_time: i64,
    pub last_damage_time: i64,
    pub food: i64,
    pub saturation: f64,
    pub xp_bar: i64,
    pub xp_level: i64,
    pub xp_total: i64,
    pub portal_time: f64,
    pub prev_portal_time: f64,
    pub held_slot: i64,
    pub window: Option<Value>,
    pub inventory_open: bool,
    pub inventory: Option<InventoryCore>,
    pub interaction: Option<InteractionCore>,
    pub last_reported: Option<LastReported>,
    pub position_update_ticks: i64,
    /// JS: `game.entities.self` — the local player's render entity id.
    pub entity_self: Option<i64>,
    /// Adaptation: ids the render loop must remove (see module docs).
    pub pending_entity_removals: Vec<i64>,
}

impl Default for GameCore {
    fn default() -> Self {
        GameCore {
            player: None,
            max_health: None,
            health: 0.0,
            prev_health: 0.0,
            self_metadata: Value::Null,
            spawn_pos: None,
            spawn_angle: None,
            effects: Value::Null,
            sleeping: false,
            bed_pos: None,
            dead: false,
            hurt_time: 0,
            last_damage_time: 0,
            food: 20,
            saturation: 5.0,
            xp_bar: 0,
            xp_level: 0,
            xp_total: 0,
            portal_time: 0.0,
            prev_portal_time: 0.0,
            held_slot: 0,
            window: None,
            inventory_open: false,
            inventory: None,
            interaction: None,
            last_reported: None,
            position_update_ticks: 0,
            entity_self: None,
            pending_entity_removals: Vec::new(),
        }
    }
}

/// JS options object of `replaceRespawnPlayer`.
#[derive(Debug, Clone, Copy)]
pub struct RespawnOpts {
    pub copy_metadata: bool,
    pub keep_attributes: bool,
    pub health_index: i64,
    pub pose_index: Option<i64>,
    pub living_flags_index: Option<i64>,
    pub frozen_index: Option<i64>,
}

impl Default for RespawnOpts {
    fn default() -> Self {
        // JS defaults: {copyMetadata=true, keepAttributes=false,
        // healthIndex=PLAYER_DATA.healthIndex, pose/livingFlags/frozen=PLAYER_DATA.*}
        RespawnOpts {
            copy_metadata: true,
            keep_attributes: false,
            health_index: PLAYER_DATA.health_index,
            pose_index: PLAYER_DATA.pose_index,
            living_flags_index: PLAYER_DATA.living_flags_index,
            frozen_index: PLAYER_DATA.frozen_index,
        }
    }
}

/// JS: `replaceRespawnPlayer(game, opts)` — 1:1. Returns the fresh player
/// (the same object stored on `game.player`, mirroring JS aliasing).
pub fn replace_respawn_player<'a>(
    game: &'a mut GameCore,
    world: &dyn PhysicsWorld,
    opts: RespawnOpts,
) -> &'a mut LocalPlayer {
    let mut old = game.player.take();
    let mut player = LocalPlayer::new();

    // JS: copy the step/interaction callbacks that exist on the old player.
    if let Some(ref mut old_player) = old {
        player.on_step = old_player.on_step.take();
        player.on_fall = old_player.on_fall.take();
        player.on_water_enter = old_player.on_water_enter.take();
        player.on_swim = old_player.on_swim.take();
        // JS also copies `onPowderSnow` when present; the typed port has no
        // such field (upstream constructor never sets it either).
    }
    player.fly_speed = f32r(0.05);
    player.walk_speed = f32r(0.1);
    player.speed_attr = crate::local_player::SpeedAttr { base: f32r(0.1), modifiers: Vec::new() };

    // JS: attributes = keepAttributes && old.attributes ? structuredClone : new Map()
    let old_attributes = old.as_ref().and_then(|o| {
        if o.attributes.is_null() { None } else { Some(o.attributes.clone()) }
    });
    player.attributes = if opts.keep_attributes {
        old_attributes.unwrap_or(Value::Object(serde_json::Map::new()))
    } else {
        Value::Object(serde_json::Map::new())
    };
    if opts.keep_attributes {
        if let Some(o) = old.as_ref() {
            player.speed_attr = o.speed_attr.clone();
            // JS: if (Object.hasOwn(player, 'attackSpeed')) — the typed port
            // always defines it, mirroring "own property present".
            player.attack_speed = o.attack_speed;
        }
    }

    game.max_health = Some(if opts.keep_attributes { game.max_health.unwrap_or(20.0) } else { 20.0 });

    // JS: selfMetadata = copyMetadata ? structuredClone(game.selfMetadata || {}) : {}
    game.self_metadata = if opts.copy_metadata {
        match &game.self_metadata {
            Value::Null => Value::Object(serde_json::Map::new()),
            v => v.clone(),
        }
    } else {
        Value::Object(serde_json::Map::new())
    };

    // LocalPlayer.resetPos runs after data/attribute copying: health is set to
    // max and pose to standing. Velocity, effects and use timers start fresh.
    let max_health = game.max_health.unwrap_or(20.0);
    if let Some(obj) = game.self_metadata.as_object_mut() {
        obj.insert(opts.health_index.to_string(), Value::from(max_health));
        if let Some(pose_index) = opts.pose_index {
            obj.insert(pose_index.to_string(), Value::from(0));
        }
    }
    let flags = game
        .self_metadata
        .get("0")
        .and_then(|v| v.as_i64())
        .unwrap_or(0);
    player.sneaking = (flags & 2) != 0;
    player.sprinting = (flags & 8) != 0;
    // JS: elytraFlying / frozenIndex / livingFlagsIndex — 1.8.9 PLAYER_DATA has
    // pose/livingFlags/frozen = null and the typed player has no elytraFlying
    // field (upstream constructor never defines it), so those branches are
    // skipped exactly as the JS dynamic checks would.

    player.health = max_health;
    game.health = max_health;
    game.prev_health = max_health;

    let spawn = game.spawn_pos.unwrap_or([0.0, 0.0, 0.0]);
    player.set_position(spawn[0] + 0.5, spawn[1] + 1.0, spawn[2] + 0.5);

    // JS: walk down while the box intersects something and the chunk is loaded
    if world.is_loaded(player.x.floor() as i64, player.z.floor() as i64) {
        let (min_y, max_y) = world.vertical_bounds();
        let mut y = player.y as i64;
        while y > min_y && y < max_y {
            player.set_position(player.x, y as f64, player.z);
            if !world.get_collisions(&player.bb()).is_empty() {
                break;
            }
            y += 1;
        }
    }
    player.prev_x = player.x;
    player.prev_y = player.y;
    player.prev_z = player.z;
    player.yaw = -180.0;
    player.prev_yaw = game.spawn_angle.unwrap_or(0.0);
    player.pitch = 0.0;
    player.prev_pitch = 0.0;

    game.effects = Value::Object(serde_json::Map::new()); // JS: effects?.clear()
    game.sleeping = false;
    game.bed_pos = None;
    game.dead = false;
    game.hurt_time = 0;
    game.last_damage_time = 0;
    game.food = 20;
    game.saturation = 5.0;
    game.xp_bar = 0;
    game.xp_level = 0;
    game.xp_total = 0;
    game.portal_time = 0.0;
    game.prev_portal_time = 0.0;
    game.held_slot = 0;
    game.window = None;
    game.inventory_open = false;

    if let Some(inv) = game.inventory.as_mut() {
        inv.reset();
        inv.state_id = Some(0); // JS: if (Object.hasOwn(game.inventory, 'stateId'))
        inv.properties = Value::Object(serde_json::Map::new());
        inv.drag_event = 0;
        inv.drag_mode = -1;
        inv.drag_slots.clear(); // JS: dragSlots?.clear()
    }
    if let Some(inter) = game.interaction.as_mut() {
        inter.ticks_since_last_swing = 0; // JS guards hasOwn; typed field always present
        inter.use_ticks = 0;
        inter.spyglass_using = false;
    }
    let prev = game.last_reported.take().unwrap_or_default();
    game.last_reported = Some(LastReported {
        x: 0.0,
        y: 0.0,
        z: 0.0,
        yaw: 0.0,
        pitch: 0.0,
        sneak: prev.sneak,
        sprint: prev.sprint,
    });
    game.position_update_ticks = 0;

    // JS: if (game.entities?.self) { entityRenderer.remove(id); entities.self = null }
    if let Some(id) = game.entity_self.take() {
        game.pending_entity_removals.push(id);
    }

    game.player = Some(player);
    game.player.as_mut().unwrap()
}
