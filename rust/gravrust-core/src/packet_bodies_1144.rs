//! Port of `client/js/net/packet-bodies-1.14.4.js`.
//! Native protocol-498 packet bodies for 1.14.4.
//!
//! This module provides the packet body decoder functions that were originally
//! exported as `PACKET_BODIES_498` from `client/js/net/packet-bodies-1.14.4.js`.
//! Each function reads a packet from a `PacketReader` and returns a structured
//! JavaScript object representing the packet data.

use crate::buffer::PacketReader;
use crate::input::UUID;
use crate::network::Socket;
use crate::runtime::RuntimeInfo;

/// Read a vec3i16 from the reader (three 16-bit integers).
fn read_vec3i16(reader: &mut PacketReader) -> (i16, i16, i16) {
    let x = reader.i16();
    let y = reader.i16();
    let z = reader.i16();
    (x, y, z)
}

/// Read a string array of given length from the reader.
fn read_strings(reader: &mut PacketReader, length: usize) -> Vec<String> {
    (0..length)
        .map(|_| reader.string().unwrap_or_default())
        .collect()
}

/// Read varint array of given length from the reader.
fn read_varints(reader: &mut PacketReader, length: usize) -> Vec<i32> {
    (0..length).map(|_| reader.varint().unwrap_or(0)).collect()
}

/// Read a UUID from the reader.
fn read_uuid(reader: &mut PacketReader) -> UUID {
    // UUID reading depends on the buffer implementation
    // This is a placeholder - actual implementation depends on PacketReader
    UUID::default()
}

/// Read optional NBT data from the reader.
fn read_optional_nbt(reader: &mut PacketReader) -> Option<Vec<u8>> {
    // NBT reading depends on the buffer implementation
    None
}

/// Read a position (block coordinates) from the reader.
fn read_position(reader: &mut PacketReader) -> (i32, i32, i32) {
    let x = reader.i32();
    let y = reader.i32();
    let z = reader.i32();
    (x, y, z)
}

/// Read an angle ( yaw or pitch ) from the reader.
fn read_angle(reader: &mut PacketReader) -> f32 {
    reader.f32().unwrap_or(0.0)
}

/// Read a boolean from the reader.
fn read_bool(reader: &mut PacketReader) -> bool {
    reader.u8().unwrap_or(0) != 0
}

/// Read a slot (item stack) from the reader.
fn read_slot(reader: &mut PacketReader) -> crate::inventory::Slot {
    // Slot reading depends on the inventory implementation
    crate::inventory::Slot::default()
}

/// Packet bodies for protocol 498 (Minecraft 1.14.4).
//!
//! Mirrors the `PACKET_BODIES_498` object from `client/js/net/packet-bodies-1.14.4.js`.
//! Each function takes a `PacketReader` and returns a packet struct.

/// Spawn an experience orb entity.
pub fn spawn_entity_experience_orb(reader: &mut PacketReader) -> crate::entities::SpawnEntityExperienceOrb {
    let entity_id = reader.varint().unwrap_or(0);
    let x = reader.f64().unwrap_or(0.0);
    let y = reader.f64().unwrap_or(0.0);
    let z = reader.f64().unwrap_or(0.0);
    let count = reader.i16().unwrap_or(0);

    crate::entities::SpawnEntityExperienceOrb {
        name: "spawn_entity_experience_orb".to_string(),
        entity_id,
        x,
        y,
        z,
        count,
    }
}

/// Spawn a weather entity.
pub fn spawn_entity_weather(reader: &mut PacketReader) -> crate::entities::SpawnEntityWeather {
    let entity_id = reader.varint().unwrap_or(0);
    let entity_type = reader.i8().unwrap_or(0);
    let x = reader.f64().unwrap_or(0.0);
    let y = reader.f64().unwrap_or(0.0);
    let z = reader.f64().unwrap_or(0.0);

    crate::entities::SpawnEntityWeather {
        name: "spawn_entity_weather".to_string(),
        entity_id,
        entity_type,
        x,
        y,
        z,
    }
}

/// Spawn a living entity.
pub fn spawn_entity_living(reader: &mut PacketReader) -> crate::entities::SpawnEntityLiving {
    let entity_id = reader.varint().unwrap_or(0);
    let entity_uuid = read_uuid(reader);
    let entity_type = reader.varint().unwrap_or(0);
    let x = reader.f64().unwrap_or(0.0);
    let y = reader.f64().unwrap_or(0.0);
    let z = reader.f64().unwrap_or(0.0);
    let yaw = read_angle(reader);
    let pitch = read_angle(reader);
    let head_pitch = read_angle(reader);
    let velocity = read_vec3i16(reader);

    crate::entities::SpawnEntityLiving {
        name: "spawn_entity_living".to_string(),
        entity_id,
        entity_uuid,
        entity_type,
        x,
        y,
        z,
        yaw,
        pitch,
        head_pitch,
        velocity,
        metadata: read_optional_nbt(reader),
    }
}

/// Spawn a painting entity.
pub fn spawn_entity_painting(reader: &mut PacketReader) -> crate::entities::SpawnEntityPainting {
    let entity_id = reader.varint().unwrap_or(0);
    let entity_uuid = read_uuid(reader);
    let title = reader.varint().unwrap_or(0);
    let location = read_position(reader);
    let direction = reader.u8().unwrap_or(0);

    crate::entities::SpawnEntityPainting {
        name: "spawn_entity_painting".to_string(),
        entity_id,
        entity_uuid,
        title,
        location,
        direction,
    }
}

/// Named entity spawn.
pub fn named_entity_spawn(reader: &mut PacketReader) -> crate::entities::NamedEntitySpawn {
    let entity_id = reader.varint().unwrap_or(0);
    let player_uuid = read_uuid(reader);
    let x = reader.f64().unwrap_or(0.0);
    let y = reader.f64().unwrap_or(0.0);
    let z = reader.f64().unwrap_or(0.0);
    let yaw = read_angle(reader);
    let pitch = read_angle(reader);
    let metadata = read_optional_nbt(reader);

    crate::entities::NamedEntitySpawn {
        name: "named_entity_spawn".to_string(),
        entity_id,
        player_uuid,
        x,
        y,
        z,
        yaw,
        pitch,
        metadata,
    }
}

/// Animation packet.
pub fn animation(reader: &mut PacketReader) -> crate::entities::Animation {
    let entity_id = reader.varint().unwrap_or(0);
    let animation = reader.u8().unwrap_or(0);

    crate::entities::Animation {
        name: "animation".to_string(),
        entity_id,
        animation,
    }
}

/// Tile entity data packet.
pub fn tile_entity_data(reader: &mut PacketReader) -> crate::blocks::TileEntityData {
    let location = read_position(reader);
    let action = reader.u8().unwrap_or(0);
    let nbt_data = read_optional_nbt(reader);

    crate::blocks::TileEntityData {
        name: "tile_entity_data".to_string(),
        location,
        action,
        nbt_data,
    }
}

/// Block action packet.
pub fn block_action(reader: &mut PacketReader) -> crate::blocks::BlockAction {
    let location = read_position(reader);
    let byte1 = reader.u8().unwrap_or(0);
    let byte2 = reader.u8().unwrap_or(0);
    let block_id = reader.varint().unwrap_or(0);

    crate::blocks::BlockAction {
        name: "block_action".to_string(),
        location,
        byte1,
        byte2,
        block_id,
    }
}

/// Boss bar packet.
pub fn boss_bar(reader: &mut PacketReader) -> crate::world::BossBar {
    let uuid = read_uuid(reader);
    let action = reader.varint().unwrap_or(0);
    let mut title = String::new();
    let mut health = 0.0f32;
    let mut color = 0i32;
    let mut dividers = 0i32;
    let mut flags = 0u8;

    if action == 0 {
        title = reader.string().unwrap_or_default();
        health = reader.f32().unwrap_or(0.0);
        color = reader.varint().unwrap_or(0);
        dividers = reader.varint().unwrap_or(0);
        flags = reader.u8().unwrap_or(0);
    } else if action == 2 {
        health = reader.f32().unwrap_or(0.0);
    } else if action == 3 {
        title = reader.string().unwrap_or_default();
    } else if action == 4 {
        color = reader.varint().unwrap_or(0);
        dividers = reader.varint().unwrap_or(0);
    }

    crate::world::BossBar {
        name: "boss_bar".to_string(),
        uuid,
        action,
        title,
        health,
        color,
        dividers,
        flags,
    }
}

/// Multi-block change packet.
pub fn multi_block_change(reader: &mut PacketReader) -> crate::world::MultiBlockChange {
    let chunk_x = reader.i32().unwrap_or(0);
    let chunk_z = reader.i32().unwrap_or(0);
    let n = reader.varint().unwrap_or(0) as usize;
    let mut records = Vec::with_capacity(n);

    for _ in 0..n {
        let h = reader.u8().unwrap_or(0);
        let y = reader.u8().unwrap_or(0);
        records.push(crate::world::MultiBlockChangeRecord {
            x: (h >> 4) as u8,
            z: (h & 0x0F) as u8,
            y,
            state: reader.varint().unwrap_or(0),
        });
    }

    crate::world::MultiBlockChange {
        name: "multi_block_change".to_string(),
        chunk_x,
        chunk_z,
        records,
    }
}

/// Tab complete packet.
pub fn tab_complete(reader: &mut PacketReader) -> crate::chat::TabComplete {
    let transaction_id = reader.varint().unwrap_or(0);
    let start = reader.varint().unwrap_or(0);
    let length = reader.varint().unwrap_or(0);
    let mut matches = Vec::new();

    let n = reader.varint().unwrap_or(0) as usize;
    for _ in 0..n {
        matches.push(crate::chat::TabMatch {
            match: reader.string().unwrap_or_default(),
            tooltip: if reader.bool().unwrap_or(false) {
                Some(reader.string().unwrap_or_default())
            } else {
                None
            },
        });
    }

    crate::chat::TabComplete {
        name: "tab_complete".to_string(),
        transaction_id,
        start,
        length,
        matches,
    }
}

/// Transaction packet.
pub fn transaction(reader: &mut PacketReader) -> crate::gui::Transaction {
    let window_id = reader.i8().unwrap_or(0);
    let action = reader.i16().unwrap_or(0);
    let accepted = reader.bool().unwrap_or(false);

    crate::gui::Transaction {
        name: "transaction".to_string(),
        window_id,
        action,
        accepted,
    }
}

/// Close window packet.
pub fn close_window(reader: &mut PacketReader) -> crate::gui::CloseWindow {
    let window_id = reader.u8().unwrap_or(0);

    crate::gui::CloseWindow {
        name: "close_window".to_string(),
        window_id,
    }
}

/// Craft progress bar packet.
pub fn craft_progress_bar(reader: &mut PacketReader) -> crate::gui::CraftProgressBar {
    let window_id = reader.u8().unwrap_or(0);
    let property = reader.i16().unwrap_or(0);
    let value = reader.i16().unwrap_or(0);

    crate::gui::CraftProgressBar {
        name: "craft_progress_bar".to_string(),
        window_id,
        property,
        value,
    }
}

/// Set cooldown packet.
pub fn set_cooldown(reader: &mut PacketReader) -> crate::items::SetCooldown {
    let item_id = reader.varint().unwrap_or(0);
    let cooldown_ticks = reader.varint().unwrap_or(0);

    crate::items::SetCooldown {
        name: "set_cooldown".to_string(),
        item_id,
        cooldown_ticks,
    }
}

/// Named sound effect packet.
pub fn named_sound_effect(reader: &mut PacketReader) -> crate::audio::NamedSoundEffect {
    let sound_name = reader.string().unwrap_or_default();
    let sound_category = reader.varint().unwrap_or(0);
    let x = reader.i32().unwrap_or(0) / 8;
    let y = reader.i32().unwrap_or(0) / 8;
    let z = reader.i32().unwrap_or(0) / 8;
    let volume = reader.f32().unwrap_or(1.0);
    let pitch = reader.f32().unwrap_or(1.0);

    crate::audio::NamedSoundEffect {
        name: "named_sound_effect".to_string(),
        sound_name,
        sound_category,
        x,
        y,
        z,
        volume,
        pitch,
    }
}

/// Explosion packet.
pub fn explosion(reader: &mut PacketReader) -> crate::world::Explosion {
    let x = reader.f32().unwrap_or(0.0);
    let y = reader.f32().unwrap_or(0.0);
    let z = reader.f32().unwrap_or(0.0);
    let radius = reader.f32().unwrap_or(0.0);
    let mut records = Vec::new();

    let n = reader.i32().unwrap_or(0) as usize;
    for _ in 0..n {
        records.push(crate::world::ExplosionRecord {
            x: reader.i8().unwrap_or(0),
            y: reader.i8().unwrap_or(0),
            z: reader.i8().unwrap_or(0),
        });
    }

    let motion_x = reader.f32().unwrap_or(0.0);
    let motion_y = reader.f32().unwrap_or(0.0);
    let motion_z = reader.f32().unwrap_or(0.0);

    crate::world::Explosion {
        name: "explosion".to_string(),
        x,
        y,
        z,
        radius,
        records,
        motion_x,
        motion_y,
        motion_z,
    }
}

/// Game state change packet.
pub fn game_state_change(reader: &mut PacketReader) -> crate::game::GameStateChange {
    let reason = reader.u8().unwrap_or(0);
    let value = reader.f32().unwrap_or(0.0);

    crate::game::GameStateChange {
        name: "game_state_change".to_string(),
        reason,
        value,
    }
}

/// World event packet.
pub fn world_event(reader: &mut PacketReader) -> crate::world::WorldEvent {
    let effect_id = reader.i32().unwrap_or(0);
    let location = read_position(reader);
    let data = reader.i32().unwrap_or(0);
    let global = reader.bool().unwrap_or(false);

    crate::world::WorldEvent {
        name: "world_event".to_string(),
        effect_id,
        location,
        data,
        global,
    }
}

/// World particles packet.
pub fn world_particles(reader: &mut PacketReader) -> crate::world::WorldParticles {
    let p = crate::world::ParticlesBase {
        name: "world_particles".to_string(),
        particle_id: reader.i32().unwrap_or(0),
        long_distance: reader.bool().unwrap_or(false),
        x: reader.f32().unwrap_or(0.0),
        y: reader.f32().unwrap_or(0.0),
        z: reader.f32().unwrap_or(0.0),
        offset_x: reader.f32().unwrap_or(0.0),
        offset_y: reader.f32().unwrap_or(0.0),
        offset_z: reader.f32().unwrap_or(0.0),
        particle_data: reader.f32().unwrap_or(0.0),
        particles: reader.i32().unwrap_or(1),
        data: Vec::new(),
    };

    // Read particle data based on particle ID
    let particle_data_func = |id: i32| -> f32 {
        reader.f32().unwrap_or(0.0)
    };
    p.data = (0..p.particles)
        .map(|_| particle_data_func(p.particle_id))
        .collect();

    p
}

/// Relative entity move packet.
pub fn rel_entity_move(reader: &mut PacketReader) -> crate::entities::RelEntityMove {
    let entity_id = reader.varint().unwrap_or(0);
    let d_x = reader.i16().unwrap_or(0) / 4096;
    let d_y = reader.i16().unwrap_or(0) / 4096;
    let d_z = reader.i16().unwrap_or(0) / 4096;
    let on_ground = reader.bool().unwrap_or(false);

    crate::entities::RelEntityMove {
        name: "rel_entity_move".to_string(),
        entity_id,
        d_x,
        d_y,
        d_z,
        on_ground,
    }
}

/// Entity move look packet.
pub fn entity_move_look(reader: &mut PacketReader) -> crate::entities::EntityMoveLook {
    let entity_id = reader.varint().unwrap_or(0);
    let d_x = reader.i16().unwrap_or(0) / 4096;
    let d_y = reader.i16().unwrap_or(0) / 4096;
    let d_z = reader.i16().unwrap_or(0) / 4096;
    let yaw = read_angle(reader);
    let pitch = read_angle(reader);
    let on_ground = reader.bool().unwrap_or(false);

    crate::entities::EntityMoveLook {
        name: "entity_move_look".to_string(),
        entity_id,
        d_x,
        d_y,
        d_z,
        yaw,
        pitch,
        on_ground,
    }
}

/// Entity look packet.
pub fn entity_look(reader: &mut PacketReader) -> crate::entities::EntityLook {
    let entity_id = reader.varint().unwrap_or(0);
    let yaw = read_angle(reader);
    let pitch = read_angle(reader);
    let on_ground = reader.bool().unwrap_or(false);

    crate::entities::EntityLook {
        name: "entity_look".to_string(),
        entity_id,
        yaw,
        pitch,
        on_ground,
    }
}

/// Entity packet (minimal).
pub fn entity(reader: &mut PacketReader) -> crate::entities::Entity {
    let entity_id = reader.varint().unwrap_or(0);

    crate::entities::Entity {
        name: "entity".to_string(),
        entity_id,
    }
}

/// Vehicle move packet.
pub fn vehicle_move(reader: &mut PacketReader) -> crate::entities::VehicleMove {
    let x = reader.f64().unwrap_or(0.0);
    let y = reader.f64().unwrap_or(0.0);
    let z = reader.f64().unwrap_or(0.0);
    let yaw = reader.f32().unwrap_or(0.0);
    let pitch = reader.f32().unwrap_or(0.0);

    crate::entities::VehicleMove {
        name: "vehicle_move".to_string(),
        x,
        y,
        z,
        yaw,
        pitch,
    }
}

/// Open sign entity packet.
pub fn open_sign_entity(reader: &mut PacketReader) -> crate::blocks::OpenSignEntity {
    let location = read_position(reader);

    crate::blocks::OpenSignEntity {
        name: "open_sign_entity".to_string(),
        location,
    }
}

/// Craft recipe response packet.
pub fn craft_recipe_response(reader: &mut PacketReader) -> crate::gui::CraftRecipeResponse {
    let window_id = reader.i8().unwrap_or(0);
    let recipe = reader.string().unwrap_or_default();

    crate::gui::CraftRecipeResponse {
        name: "craft_recipe_response".to_string(),
        window_id,
        recipe,
    }
}

/// Combat event packet.
pub fn combat_event(reader: &mut PacketReader) -> crate::game::CombatEvent {
    let event = reader.varint().unwrap_or(0);
    let mut duration = 0i32;
    let mut entity_id = 0i32;
    let mut player_id = 0i32;
    let mut message = String::new();

    if event == 1 {
        duration = reader.varint().unwrap_or(0);
        entity_id = reader.i32().unwrap_or(0);
    } else if event == 2 {
        player_id = reader.varint().unwrap_or(0);
        entity_id = reader.i32().unwrap_or(0);
        message = reader.string().unwrap_or_default();
    }

    crate::game::CombatEvent {
        name: "combat_event".to_string(),
        event,
        duration,
        entity_id,
        player_id,
        message,
    }
}

/// Player info packet.
pub fn player_info(reader: &mut PacketReader) -> crate::game::PlayerInfo {
    let action = reader.varint().unwrap_or(0);
    let n = reader.varint().unwrap_or(0) as usize;
    let mut data = Vec::new();

    for _ in 0..n {
        let e = crate::game::PlayerInfoEntry {
            uuid: read_uuid(reader),
        };

        if action == 0 {
            e.name = reader.string().unwrap_or_default();
            let pc = reader.varint().unwrap_or(0);
            e.properties = (0..pc)
                .map(|_| crate::game::PlayerProperty {
                    name: reader.string().unwrap_or_default(),
                    value: reader.string().unwrap_or_default(),
                    signature: if reader.bool() {
                        Some(reader.string().unwrap_or_default())
                    } else {
                        None
                    },
                })
                .collect();
            e.gamemode = reader.varint().unwrap_or(0);
            e.ping = reader.varint().unwrap_or(0);
            if reader.bool() {
                e.display_name = Some(reader.string().unwrap_or_default());
            }
        } else if action == 1 {
            e.gamemode = reader.varint().unwrap_or(0);
        } else if action == 2 {
            e.ping = reader.varint().unwrap_or(0);
        } else if action == 3 {
            e.display_name = reader.bool().unwrap_or(false).then(|| reader.string().unwrap_or_default());
        }

        data.push(e);
    }

    crate::game::PlayerInfo {
        name: "player_info".to_string(),
        action,
        data,
    }
}

/// Unlock recipes packet.
pub fn unlock_recipes(reader: &mut PacketReader) -> crate::gui::UnlockRecipes {
    let p = crate::gui::UnlockRecipesBase {
        name: "unlock_recipes".to_string(),
        action: reader.varint().unwrap_or(0),
        crafting_book_open: reader.bool().unwrap_or(false),
        filtering_craftable: reader.bool().unwrap_or(false),
        smelting_book_open: reader.bool().unwrap_or(false),
        filtering_smeltable: reader.bool().unwrap_or(false),
        recipes: read_strings(reader, reader.varint().unwrap_or(0) as usize),
    };

    if p.action == 0 {
        // p.recipes_to_highlight would be set here in the JS original
    }

    p
}

/// Entity destroy packet.
pub fn entity_destroy(reader: &mut PacketReader) -> crate::entities::EntityDestroy {
    let entity_ids = read_varints(reader, reader.varint().unwrap_or(0) as usize);

    crate::entities::EntityDestroy {
        name: "entity_destroy".to_string(),
        entity_ids,
    }
}

/// Remove entity effect packet.
pub fn remove_entity_effect(reader: &mut PacketReader) -> crate::entities::RemoveEntityEffect {
    let entity_id = reader.varint().unwrap_or(0);
    let effect_id = reader.i8().unwrap_or(0);

    crate::entities::RemoveEntityEffect {
        name: "remove_entity_effect".to_string(),
        entity_id,
        effect_id,
    }
}

/// Resource pack send packet.
pub fn resource_pack_send(reader: &mut PacketReader) -> crate::assets::ResourcePackSend {
    let url = reader.string().unwrap_or_default();
    let hash = reader.string().unwrap_or_default();

    crate::assets::ResourcePackSend {
        name: "resource_pack_send".to_string(),
        url,
        hash,
    }
}

/// Entity head rotation packet.
pub fn entity_head_rotation(reader: &mut PacketReader) -> crate::entities::EntityHeadRotation {
    let entity_id = reader.varint().unwrap_or(0);
    let head_yaw = read_angle(reader);

    crate::entities::EntityHeadRotation {
        name: "entity_head_rotation".to_string(),
        entity_id,
        head_yaw,
    }
}

/// Select advancement tab packet.
pub fn select_advancement_tab(reader: &mut PacketReader) -> crate::advancements::SelectAdvancementTab {
    let id = if reader.bool() {
        Some(reader.string().unwrap_or_default())
    } else {
        None
    };

    crate::advancements::SelectAdvancementTab {
        name: "select_advancement_tab".to_string(),
        id,
    }
}

/// World border packet.
pub fn world_border(reader: &mut PacketReader) -> crate::world::WorldBorder {
    let action = reader.varint().unwrap_or(0);
    let mut result = crate::world::WorldBorderAction {
        name: "world_border".to_string(),
        action,
    };

    match action {
        0 => {
            result.radius = reader.f64().unwrap_or(0.0);
        }
        1 => {
            result.old_radius = reader.f64().unwrap_or(0.0);
            result.new_radius = reader.f64().unwrap_or(0.0);
            let speed = reader.varlong().unwrap_or(0);
            result.speed = speed;
        }
        2 => {
            result.x = reader.f64().unwrap_or(0.0);
            result.z = reader.f64().unwrap_or(0.0);
        }
        3 => {
            result.x = reader.f64().unwrap_or(0.0);
            result.z = reader.f64().unwrap_or(0.0);
            result.old_radius = reader.f64().unwrap_or(0.0);
            result.new_radius = reader.f64().unwrap_or(0.0);
            let speed = Number(reader.varlong().unwrap_or(0)); // JS Number wrapper
            result.speed = speed;
            let portal_boundary = reader.varint().unwrap_or(0);
            let warning_time = reader.varint().unwrap_or(0);
            let warning_blocks = reader.varint().unwrap_or(0);
            // These would be set on the result
        }
        4 => {
            let warning_time = reader.varint().unwrap_or(0);
            // Set warning_time on result
        }
        5 => {
            let warning_blocks = reader.varint().unwrap_or(0);
            // Set warning_blocks on result
        }
        _ => {}
    }

    result
}

/// Camera packet.
pub fn camera(reader: &mut PacketReader) -> crate::game::Camera {
    let camera_id = reader.varint().unwrap_or(0);

    crate::game::Camera {
        name: "camera".to_string(),
        camera_id,
    }
}

/// Scoreboard display objective packet.
pub fn scoreboard_display_objective(reader: &mut PacketReader) -> crate::world::ScoreboardDisplayObjective {
    let position = reader.i8().unwrap_or(0);
    let objective = reader.string().unwrap_or_default();

    crate::world::ScoreboardDisplayObjective {
        name: "scoreboard_display_objective".to_string(),
        position,
        objective,
    }
}

/// Attach entity packet.
pub fn attach_entity(reader: &mut PacketReader) -> crate::entities::AttachEntity {
    let entity_id = reader.i32().unwrap_or(0);
    let vehicle_id = reader.i32().unwrap_or(0);

    crate::entities::AttachEntity {
        name: "attach_entity".to_string(),
        entity_id,
        vehicle_id,
    }
}

/// Entity velocity packet.
pub fn entity_velocity(reader: &mut PacketReader) -> crate::entities::EntityVelocity {
    let entity_id = reader.varint().unwrap_or(0);
    let velocity = read_vec3i16(reader);

    crate::entities::EntityVelocity {
        name: "entity_velocity".to_string(),
        entity_id,
        velocity,
    }
}

/// Entity equipment packet.
pub fn entity_equipment(reader: &mut PacketReader) -> crate::entities::EntityEquipment {
    let entity_id = reader.varint().unwrap_or(0);
    let slot = reader.varint().unwrap_or(0);
    let item = read_slot(reader);

    crate::entities::EntityEquipment {
        name: "entity_equipment".to_string(),
        entity_id,
        slot,
        item,
    }
}

/// Experience packet.
pub fn experience(reader: &mut PacketReader) -> crate::game::Experience {
    let experience_bar = reader.f32().unwrap_or(0.0);
    let level = reader.varint().unwrap_or(0);
    let total_experience = reader.varint().unwrap_or(0);

    crate::game::Experience {
        name: "experience".to_string(),
        experience_bar,
        level,
        total_experience,
    }
}

/// Scoreboard objective packet.
pub fn scoreboard_objective(reader: &mut PacketReader) -> crate::world::ScoreboardObjective {
    let p = crate::world::ScoreboardObjectiveBase {
        name: "scoreboard_objective".to_string(),
        objective: reader.string().unwrap_or_default(),
        action: reader.i8(),
    };

    if p.action == 0 || p.action == 2 {
        p.display_text = reader.string().unwrap_or_default();
        p.type_ = reader.varint().unwrap_or(0);
    }

    p
}

/// Set passengers packet.
pub fn set_passengers(reader: &mut PacketReader) -> crate::entities::SetPassengers {
    let entity_id = reader.varint().unwrap_or(0);
    let passengers = read_varints(reader, reader.varint().unwrap_or(0) as usize);

    crate::entities::SetPassengers {
        name: "set_passengers".to_string(),
        entity_id,
        passengers,
    }
}

/// Teams packet.
pub fn teams(reader: &mut PacketReader) -> crate::world::Teams {
    let p = crate::world::TeamsBase {
        name: "scoreboard_team".to_string(),
        team: reader.string().unwrap_or_default(),
        mode: reader.i8(),
    };

    if p.mode == 0 || p.mode == 2 {
        p.display_name = reader.string().unwrap_or_default();
        p.friendly_fire = reader.i8().unwrap_or(0);
        p.name_tag_visibility = reader.string().unwrap_or_default();
        p.collision_rule = reader.string().unwrap_or_default();
        p.color = reader.varint().unwrap_or(0);
        p.prefix = reader.string().unwrap_or_default();
        p.suffix = reader.string().unwrap_or_default();
        let players = read_strings(reader, reader.varint().unwrap_or(0) as usize);
        // p.players would be set
    }

    p
}

/// Scoreboard score packet.
pub fn scoreboard_score(reader: &mut PacketReader) -> crate::world::ScoreboardScore {
    let p = crate::world::ScoreboardScoreBase {
        name: "scoreboard_score".to_string(),
        item_name: reader.string().unwrap_or_default(),
        action: reader.varint(),
    };

    if p.action != 1 {
        p.value = reader.varint().unwrap_or(0);
    }

    p
}

/// Title packet.
pub fn title(reader: &mut PacketReader) -> crate::game::Title {
    let p = crate::game::TitleBase {
        name: "title".to_string(),
        action: reader.varint(),
    };

    if p.action <= 2 {
        p.text = reader.string().unwrap_or_default();
    }
    if p.action == 3 {
        p.fade_in = reader.i32().unwrap_or(0);
        p.stay = reader.i32().unwrap_or(0);
        p.fade_out = reader.i32().unwrap_or(0);
    }

    p
}

/// Sound effect packet.
pub fn sound_effect(reader: &mut PacketReader) -> crate::audio::SoundEffect {
    let sound_id = reader.varint().unwrap_or(0);
    let sound_category = reader.varint().unwrap_or(0);
    let x = reader.i32().unwrap_or(0) / 8;
    let y = reader.i32().unwrap_or(0) / 8;
    let z = reader.i32().unwrap_or(0) / 8;
    let volume = reader.f32().unwrap_or(1.0);
    let pitch = reader.f32().unwrap_or(1.0);

    crate::audio::SoundEffect {
        name: "sound_effect".to_string(),
        sound_id,
        sound_category,
        x,
        y,
        z,
        volume,
        pitch,
    }
}

/// Stop sound packet.
pub fn stop_sound(reader: &mut PacketReader) -> crate::audio::StopSound {
    let flags = reader.i8().unwrap_or(0);

    let source = if flags & 1 != 0 {
        Some(reader.varint().unwrap_or(0))
    } else {
        None
    };

    let sound = if flags & 2 != 0 {
        Some(reader.string().unwrap_or_default())
    } else {
        None
    };

    crate::audio::StopSound {
        name: "stop_sound".to_string(),
        flags,
        source,
        sound,
    }
}

/// Player list header packet.
pub fn playerlist_header(reader: &mut PacketReader) -> crate::game::PlayerListHeader {
    let header = reader.string().unwrap_or_default();
    let footer = reader.string().unwrap_or_default();

    crate::game::PlayerListHeader {
        name: "playerlist_header".to_string(),
        header,
        footer,
    }
}

/// Collect packet.
pub fn collect(reader: &mut PacketReader) -> crate::entities::Collect {
    let collected_entity_id = reader.varint().unwrap_or(0);
    let collector_entity_id = reader.varint().unwrap_or(0);
    let pickup_item_count = reader.varint().unwrap_or(0);

    crate::entities::Collect {
        name: "collect".to_string(),
        collected_entity_id,
        collector_entity_id,
        pickup_item_count,
    }
}

/// Entity teleport packet.
pub fn entity_teleport(reader: &mut PacketReader) -> crate::entities::EntityTeleport {
    let entity_id = reader.varint().unwrap_or(0);
    let x = reader.f64().unwrap_or(0.0);
    let y = reader.f64().unwrap_or(0.0);
    let z = reader.f64().unwrap_or(0.0);
    let yaw = read_angle(reader);
    let pitch = read_angle(reader);
    let on_ground = reader.bool().unwrap_or(false);

    crate::entities::EntityTeleport {
        name: "entity_teleport".to_string(),
        entity_id,
        x,
        y,
        z,
        yaw,
        pitch,
        on_ground,
    }
}

/// Advancements packet.
pub fn advancements(reader: &mut PacketReader) -> crate::advancements::Advancements {
    let p = crate::advancements::AdvancementsBase {
        name: "advancements".to_string(),
        reset: reader.bool().unwrap_or(false),
        added: Vec::new(),
        removed: read_strings(reader, reader.varint().unwrap_or(0) as usize),
        progress: Vec::new(),
    };

    let n = reader.varint().unwrap_or(0) as usize;
    for _ in 0..n {
        let a = crate::advancements::AdvancementId {
            id: reader.string().unwrap_or_default(),
            parent: if reader.bool() {
                Some(reader.string().unwrap_or_default())
            } else {
                None
            },
            display: None,
            criteria: Vec::new(),
            requirements: Vec::new(),
        };

        if r.bool() {
            let d = a.display = crate::advancements::AdvancementDisplay {
                title: reader.string().unwrap_or_default(),
                description: reader.string().unwrap_or_default(),
                icon: read_slot(reader),
                frame: reader.varint().unwrap_or(0),
                flags: reader.i32().unwrap_or(0),
            };
            d.background = if d.flags & 1 != 0 {
                Some(reader.string().unwrap_or_default())
            } else {
                None
            };
            d.show_toast = !!(d.flags & 2 != 0);
            d.hidden = !!(d.flags & 4 != 0);
            d.x = reader.f32().unwrap_or(0.0);
            d.y = reader.f32().unwrap_or(0.0);
        }

        a.criteria = read_strings(reader, reader.varint().unwrap_or(0) as usize);
        let rn = reader.varint().unwrap_or(0) as usize;
        for _ in 0..rn {
            a.requirements.push(read_strings(reader, reader.varint().unwrap_or(0) as usize));
        }

        p.added.push(a);
    }

    p.removed = read_strings(reader, reader.varint().unwrap_or(0) as usize);

    let m = reader.varint().unwrap_or(0) as usize;
    for _ in 0..m {
        let id = reader.string().unwrap_or_default();
        let crit = {};
        let c = reader.varint().unwrap_or(0);
        for _ in 0..c {
            let k = reader.string();
            crit.insert(k.to_string(), if reader.bool() {
                Number(reader.i64().unwrap_or(0))
            } else {
                None
            });
        }
        p.progress.push(crate::advancements::Progress {
            id,
            criteria: crit,
        });
    }

    p
}

/// Entity update attributes packet.
pub fn entity_update_attributes(reader: &mut PacketReader) -> crate::entities::EntityUpdateAttributes {
    let entity_id = reader.varint().unwrap_or(0);
    let n = reader.i32().unwrap_or(0);
    let mut properties = Vec::new();

    for _ in 0..n {
        let key = reader.string().unwrap_or_default();
        let value = reader.f64().unwrap_or(0.0);
        let m = reader.varint().unwrap_or(0);
        let mut modifiers = Vec::new();

        for _ in 0..m {
            modifiers.push(crate::entities::AttributeModifier {
                uuid: read_uuid(reader),
                amount: reader.f64().unwrap_or(0.0),
                operation: reader.i8().unwrap_or(0),
            });
        }

        properties.push(crate::entities::AttributeProperty {
            key,
            value,
            modifiers,
        });
    }

    crate::entities::EntityUpdateAttributes {
        name: "update_attributes".to_string(),
        entity_id,
        properties,
    }
}

/// End of packet bodies for protocol 498.