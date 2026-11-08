#![recursion_limit = "512"]

//! Rust/WebAssembly core for the Gravrust browser client.
//!
//! Every module in this crate is a port of a JavaScript module from
//! `client/js/`. The originals stay in place as the reference implementation
//! and the fallback path; the JS glue in `client/js/wasm/` selects the WASM
//! kernel when it is available.
//!
//! Ported so far:
//!   advancements.rs <- client/js/game/advancements.js
//!   chunk.rs     <- client/js/world/chunk.js, client/js/world/native-light.js
//!   chunk_legacy.rs <- client/js/world/chunk-1.14.4.js, chunk-1.15.2.js
//!   address.rs   <- client/js/net/address.js
//!   world.rs     <- client/js/world/world.js, chunk.js, slice.js (voxel engine)
//!   visgraph.rs  <- client/js/render/visgraph.js
//!   math.rs      <- client/js/gfx/math.js (mat4 + frustum)
//!   png.rs       <- client/js/util/png.js (decoder + encoder)
//!   nbt.rs       <- client/js/net/nbt.js
//!   packets.rs   <- client/js/net/packets.js, protocol-*.js (protocol primitives + packet helpers)
//!   buffer.rs    <- client/js/net/buffer.js (protocol primitives)
//!   physics.rs   <- client/js/game/physics.js (AABB sweep + ray cast)
//!   utf8.rs      <- client/js/util/utf8.js (WHATWG decoder)
//!   base64.rs    <- client/js/util/base64.js
//!   biome_zoom.rs <- client/js/world/biome-zoom.js
//!   command_tree.rs <- client/js/net/command-tree.js
//!   recipes.rs   <- client/js/net/recipes.js
//!   mccrypto.rs  <- client/js/util/mccrypto.js
//!   snbt.rs      <- client/js/net/snbt.js
//!   entity_poses.rs <- client/js/render/leash.js, fox-pose.js, ocelot-pose.js
//!   entity_pushing.rs <- client/js/game/entity-pushing.js
//!   technical.rs <- client/js/net/technical-packets.js
//!   zoom.rs      <- client/js/game/zoom.js
//!   base85.rs    <- client/js/util/base85.js (packed HTML)
//!   uuid.rs      <- client/js/util/uuid-md5.js (Java name UUIDs)
//!   poses.rs     <- client/js/game/player-poses-1.14.4.js / 1.15.2.js
//!   collision.rs <- placement-collision.js, world/scaffolding.js
//!   jrandom.rs   <- client/js/util/jrandom.js (java.util.Random)
//!   lod.rs       <- client/js/render/lod.js
//!   leash_knot.rs <- client/js/game/leash-knot.js
//!   camera.rs    <- client/js/render/camera-eye.js
//!   protocol_ids.rs <- protocol-1.14.4-ids.js / 1.15.2-ids.js
//!   fluids.rs    <- client/js/world/fluids.js
//!   biomes.rs    <- client/js/world/biomes.js, water-biomes.js
//!   particles.rs <- client/js/render/particle-collision.js, client/js/render/particles.js (particle physics & factories)
//!   water_fog.rs <- client/js/render/water-fog.js
//!   crafting.rs  <- client/js/game/crafting.js, server-recipes.js
//!   recipebook.rs <- client/js/game/recipebook.js
//!   scoreboard.rs <- client/js/game/scoreboard.js
//!   culling.rs   <- client/js/render/culling.js
//!   debug_lines.rs <- client/js/render/debug-lines.js
//!   entity_fire.rs <- client/js/render/entity-fire.js
//!   boxmodel.rs    <- client/js/render/boxmodel.js
//!   glsl_functions.rs <- client/js/render/glsl-functions.js
//!   glsl_preprocess.rs <- client/js/render/glsl-preprocessor.js
//!   shader_lighting.rs <- client/js/render/shader-lighting.js
//!   shader_library.rs <- client/js/render/shader-library.js
//!   sky.rs       <- client/js/render/sky.js (celestial, lightmap, stars)
//!   splash.rs    <- client/js/render/splash.js

//!
//! The browser-bound layers (WebGL/WebGPU, DOM screens, WebSocket proxy,
//! WebAudio, workers, model/resource baking) deliberately remain JavaScript:
//! they are calls into browser APIs or consume data produced by them, not
//! portable algorithms. See `docs/rust-wasm-port.md` for the full inventory.

// # Compilation status of the ported sources
//
// Only the modules below are compiled into the crate. They are the subset that
// type-checks today.
//
// A second, larger set of ported files sits in this directory without a `mod`
// declaration. Those files are NOT compiled and are listed at the bottom of
// this file under `unsupported_port`. They are unfinished ports: each one
// references a module tree that does not exist in the crate yet (for example
// the JS-only layers `crate::gui::*`, `crate::assets`, `crate::input`,
// `crate::runtime` and `crate::network`), so declaring them makes `cargo check`
// fail. They are kept on disk so the port work is not lost and so the audit can
// inspect them; enable the `unsupported` feature to attempt them.
//
// Rationale for gating instead of deleting: a module that does not compile must
// not silently disappear from the tree. Anything not compiled here is reported
// explicitly in the Phase 0 report rather than removed.

// `crate::game` is a forward-declared stand-in for the real Game state class.
//
// src/game.rs (the full port) is an unfinished skeleton and is NOT compiled -
// see `unsupported_port` at the bottom of this file. `main_boot.rs` owns the
// live boot path with its own Assets/Settings/GraphicsDevice/Game.
//
// `interaction.rs` is compiled and six of its methods take `&crate::game::Game`
// as a parameter, so the crate root must expose that path for it to resolve.
// Every one of those parameters is unused (`_game`): the method bodies are the
// ported JS still under migration. This type carries no state on purpose - it
// exists only so those signatures stay faithful to `client/js/game/game.js`
// until the real Game lands.
pub mod game {
    /// Stand-in for the ported `Game` class. See the note above this module.
    #[derive(Debug, Default)]
    pub struct Game;
}
pub mod mouse_look;
pub mod function_keys;
pub mod item_pickup;
pub mod dropped_item;
pub mod local_player;
pub mod player_native;
pub mod respawn_player;
pub mod pickup_animation;
pub mod entity_pick_radius;
pub mod adventure;
pub mod slab_placement;
pub mod potionhelper;
pub mod audio_sound_gain;
pub mod audio_sample_attenuation;
pub mod audio_consume_sounds;
pub mod render_dye_colors;
pub mod render_visibility_cache;
pub mod render_mesh_build_queue;
pub mod render_mesh_residency;
pub mod render_texture_preload;
pub mod render_dirty_mips;
pub mod render_water_reflections;
pub mod render_painting;

pub mod advancements;
pub mod address;
pub mod net;
pub mod signs;
pub mod base64;
pub mod base85;
pub mod banner;
pub mod bee_sound;
pub mod biome_zoom;
pub mod blocks;
pub mod block_entity_data_1152;
pub mod blockstates;
pub mod biomes;
pub mod buffer;
pub mod camera;
pub mod chunk;
pub mod chunk_legacy;
pub mod collision;
pub mod command_tree;
pub mod container;
pub mod container_full;
pub mod crafting;
pub mod recipebook;
pub mod culling;
pub mod boxmodel;
pub mod debug_lines;
pub mod entity_fire;
pub mod entities;
pub mod entity_models;
pub mod fluids;
pub mod glsl_functions;
pub mod glsl_preprocess;
pub mod interaction;
pub mod items;
pub mod jrandom;
pub mod leash_knot;
pub mod lod;
pub mod math;
pub mod mccrypto;
pub mod mesher;
pub mod models;
pub mod nbt;
pub mod narrator;
pub mod packets;
pub mod particles;
pub mod physics;
pub mod png;
pub mod pistons;
pub mod poses;
pub mod protocol_ids;
pub mod recipes;
pub mod recipe_book;
pub mod scoreboard;
pub mod screen_containers;
pub mod screens;
pub mod shader_lighting;
pub mod shader_library;
pub mod sky;
pub mod snbt;
pub mod software;
pub mod tags;
pub mod technical;
pub mod wisp_net;
pub mod proxies_js;
pub mod utf8;
pub mod uuid;
pub mod vehicle;
pub mod visgraph;
pub mod workstations;
pub mod water_fog;
// The voxel engine (ported from client/js/world/world.js + slice.js) lives in
// `world/world_core.rs`; there is no `src/world.rs`, so `world` is declared as
// a directory module pointing at that file.
#[path = "world/world_core.rs"]
pub mod world;
pub mod world_collision;
pub mod zip;
pub mod zoom;
use wasm_bindgen::prelude::*;

/// Version of the ported core, shown by the WASM self-test.
#[wasm_bindgen]
pub fn core_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

pub mod bed_sleep;
pub mod day_cycle;
pub mod portal;
pub mod difficulty;
pub mod entity_effects;
pub mod entity_poses;
pub mod entity_pushing;
pub mod falling_block;
pub mod fire_overlay;
pub mod fox;
// `game` is NOT compiled: see the `unsupported_port` block at the end of this
// file. src/game.rs is an unfinished skeleton (31 undefined types, 3 undefined
// methods, 3 of 50+ fields in its own constructor) superseded by main_boot.rs.
pub mod particle_sprites;
pub mod profiling;
pub mod spawning;
pub mod splash;
pub mod statistics;
pub mod tile_renderer;

// Graphics device + platform + UI/audio/protocol layer ports.
// Each module documents its JavaScript source file at the top.
pub mod boot_alg;
pub mod browser;
pub mod browser_alg;
pub mod entity_render_alg;
pub mod entity_renderer;
pub mod hand_renderer;
pub mod item_renderer;
pub mod main_alg;
pub mod main_boot;
pub mod main_boot2;
pub mod music_system;
pub mod options;
pub mod options_alg;
pub mod options_screen;
pub mod platform;
pub mod platform_contract;
pub mod protocol;
pub mod protocol_1144;
pub mod protocol_1152;
pub mod protocol_1152_ids;
pub mod sound;
pub mod sound_alg2;
pub mod wasm_alg;
pub mod webgl2;
pub mod webgl2_alg;
pub mod webgpu;
pub mod webgpu_math;
pub mod widgets;
pub mod widgets_alg;
pub mod widgets_alg2;
pub mod widgets_alg3;

// ---------------------------------------------------------------------------
// Per-file port targets (client/js modules without a prior Rust counterpart).
// Each is a stub until its per-file porting pass completes the 1:1 port;
// a stub compiles as an empty module, so the default build stays green.
pub mod gui_js;
// ---------------------------------------------------------------------------
pub mod asset_source;
pub mod attachment_placement;
pub mod block_overlay;
pub mod capture_network;
pub mod clipboard;
pub mod debug_overlay;
pub mod demo;
pub mod door_prediction;
pub mod dynamic_lighting;
pub mod dynamic_lights;
pub mod eagler;
pub mod gui;
pub mod hud;
pub mod i18n;
pub mod inventory_lighting;
pub mod loading;
pub mod loading_overlay;
pub mod menus;
pub mod mesh_service;
pub mod mesh_worker;
pub mod option_focus;
pub mod proxies;
pub mod renderer;
pub mod resource_models;
pub mod respawn_view;
pub mod riding_lifecycle;
pub mod riptide_layer;
pub mod scene;
pub mod section_key;
pub mod shader_compat;
pub mod shader_frame;
pub mod shader_menu;
pub mod shader_pack;
pub mod shader_tooltip;
pub mod shaders;
pub mod shadows;
pub mod sign;
pub mod squid_animation;
pub mod stats;
pub mod structure;
pub mod tcp;
pub mod text_capture;
pub mod text_mesh;
pub mod truetype_wasm;
pub mod villager_data;
pub mod villager_layers;
pub mod weather;
pub mod dirty_sections;
pub mod gui_player_equipment;
pub mod shader_stages;
pub mod slice;
pub mod world_border;
pub mod client_sound_triggers;
pub mod iron_golem_cracks;
pub mod keybind_components;
pub mod light_update;
pub mod look_at;
pub mod native_angles;
pub mod placement_families;

// ---------------------------------------------------------------------------
// Compatibility trees matching the `client/js/` directory layout.
//
// The ported modules were written against paths such as `crate::gui::font` and
// `crate::assets::VANILLA_UI` because that is where their JavaScript originals
// live. Those Rust trees did not exist, which is why the gated sources could
// not compile. Each tree below re-exports the real implementation from the flat
// module that holds it (or provides the small missing piece), so no logic is
// duplicated and no invented parallel API is introduced.
//
// These names are JavaScript *directory* names, not Rust concepts: `crate::gui`
// exposes the `crate::widgets::Gui` drawing contract, `crate::network` exposes
// `crate::buffer`/`crate::packets`, and so on.
// ---------------------------------------------------------------------------
pub mod assets;
pub mod audio;
pub mod graphics;
pub mod inventory;
pub mod network;
pub mod runtime;
pub mod util;

// Gated modules that other gated sources import at the crate root. These
// re-exports exist only while the sources remain behind the unsupported gate;
// when a module graduates to the default build its entry here is removed.
#[cfg(feature = "unsupported")]
pub use crate::unsupported_port::chat;
#[cfg(feature = "unsupported")]
pub use crate::unsupported_port::gfx_math;
#[cfg(feature = "unsupported")]
pub use crate::unsupported_port::input;

pub mod accounts;

// ---------------------------------------------------------------------------
// Unfinished ports - not compiled by default.
//
// Every `mod` below names a real .rs file in this directory, but the file (and
// the files it pulls in) references types and modules that do not exist in the
// crate yet, so compiling it fails. They are declared only under the
// `unsupported` feature so that the default `cargo check` is green while no
// source file is deleted or hidden from the tree.
//
// Verified blockers in this group (first errors from `cargo check`):
//   * game.rs        - references 31 undefined types (Assets, Settings, Device,
//                      Gui, Items, Renderer, Hud, LocalPlayer, EntityManager,
//                      Weather, ...); `Game::new` initialises 3 of 50+ fields;
//                      calls setup_worker/setup_world_listeners/
//                      apply_graphics_settings, none of which are defined.
//                      Superseded by main_boot.rs, which defines its own
//                      Assets/Settings/GraphicsDevice/Game.
//   * credits.rs, pause.rs, packs.rs, tutorial.rs, jigsaw.rs, packet_bodies_1144.rs
//                    - need `crate::game::Game` plus a `crate::gui::*` /
//                      `crate::assets` / `crate::i18n` / `crate::util` tree
//                      that has no Rust source at all (those names are
//                      JavaScript module paths, not Rust modules).
//   * legacy duplicates kept for the duplicate-name reconciliation:
//                     chunk_1144.rs, chunk_1152.rs (old `chunk-1.14.4.rs`,
//                     `chunk-1.15.2.rs`), entity_registry_1144.rs,
//                     entity_registry_1152.rs (old `EntityRegistry-*.rs`),
//                     packet_bodies_1144.rs (old `packet-bodies-1.14.4.rs`),
//                     manager_legacy.rs (old `src/manager.rs`),
//                     connection_legacy.rs (old `src/connection.rs`).
// ---------------------------------------------------------------------------
#[cfg(feature = "unsupported")]
mod unsupported_port {
    #[path = "../atlas.rs"]
    pub mod atlas;
    #[path = "../bee_sound_params.rs"]
    pub mod bee_sound_params;
    #[path = "../block_entity_data_1144.rs"]
    pub mod block_entity_data_1144;
    #[path = "../book.rs"]
    pub mod book;
    #[path = "../breaking.rs"]
    pub mod breaking;
    #[path = "../camera_eye.rs"]
    pub mod camera_eye;
    #[path = "../chat.rs"]
    pub mod chat;
    #[path = "../chat_hover.rs"]
    pub mod chat_hover;
    #[path = "../chat_options.rs"]
    pub mod chat_options;
    #[path = "../command_block.rs"]
    pub mod command_block;
    #[path = "../commands.rs"]
    pub mod commands;
    #[path = "../containers.rs"]
    pub mod containers;
    #[path = "../crash.rs"]
    pub mod crash;
    #[path = "../credits.rs"]
    pub mod credits;
    #[path = "../death.rs"]
    pub mod death;
    #[path = "../debug_targets.rs"]
    pub mod debug_targets;
    #[path = "../default_tags.rs"]
    pub mod default_tags;
    #[path = "../eagler_presets.rs"]
    pub mod eagler_presets;
    #[path = "../eagler_textures.rs"]
    pub mod eagler_textures;
    #[path = "../effect_icons.rs"]
    pub mod effect_icons;
    #[path = "../entity_metadata.rs"]
    pub mod entity_metadata;
    #[path = "../entity_types.rs"]
    pub mod entity_types;
    #[path = "../font.rs"]
    pub mod font;
    #[path = "../font_providers.rs"]
    pub mod font_providers;
    #[path = "../gfx_math.rs"]
    pub mod gfx_math;
    #[path = "../glsl_float_literals.rs"]
    pub mod glsl_float_literals;
    #[path = "../input.rs"]
    pub mod input;
    #[path = "../interaction_full.rs"]
    pub mod interaction_full;
    #[path = "../itemmetadata_1144.rs"]
    pub mod itemmetadata_1144;
    #[path = "../itemmetadata_1152.rs"]
    pub mod itemmetadata_1152;
    #[path = "../itemnames.rs"]
    pub mod itemnames;
    #[path = "../jigsaw.rs"]
    pub mod jigsaw;
    #[path = "../key_names.rs"]
    pub mod key_names;
    #[path = "../menus_1144.rs"]
    pub mod menus_1144;
    #[path = "../native_light.rs"]
    pub mod native_light;
    #[path = "../nbt_queries.rs"]
    pub mod nbt_queries;
    #[path = "../packs.rs"]
    pub mod packs;
    #[path = "../panda_variants_1144.rs"]
    pub mod panda_variants_1144;
    #[path = "../panda_variants_1152.rs"]
    pub mod panda_variants_1152;
    #[path = "../particle_collision.rs"]
    pub mod particle_collision;
    #[path = "../pause.rs"]
    pub mod pause;
    #[path = "../placement_collision.rs"]
    pub mod placement_collision;
    #[path = "../player_poses.rs"]
    pub mod player_poses;
    #[path = "../player_poses_1144.rs"]
    pub mod player_poses_1144;
    #[path = "../player_poses_1152.rs"]
    pub mod player_poses_1152;
    #[path = "../post.rs"]
    pub mod post;
    #[path = "../profiler.rs"]
    pub mod profiler;
    #[path = "../scaffolding.rs"]
    pub mod scaffolding;
    #[path = "../server_recipes.rs"]
    pub mod server_recipes;
    #[path = "../serverpacks.rs"]
    pub mod serverpacks;
    #[path = "../settings.rs"]
    pub mod settings;
    #[path = "../shader_lighting_alg.rs"]
    pub mod shader_lighting_alg;
    #[path = "../shader_options.rs"]
    pub mod shader_options;
    #[path = "../shader_uniforms.rs"]
    pub mod shader_uniforms;
    #[path = "../signs_1144.rs"]
    pub mod signs_1144;
    #[path = "../signs_1152.rs"]
    pub mod signs_1152;
    #[path = "../signs_advanced.rs"]
    pub mod signs_advanced;
    #[path = "../spectator.rs"]
    pub mod spectator;
    #[path = "../technical_packets.rs"]
    pub mod technical_packets;
    #[path = "../text_editor.rs"]
    pub mod text_editor;
    #[path = "../tutorial.rs"]
    pub mod tutorial;
    // villager_data graduated to the default build.
    #[path = "../wisp.rs"]
    pub mod wisp;

    // Files renamed during the illegal-filename / duplicate-name pass.
    #[path = "../chunk_1144.rs"]
    pub mod chunk_1144;
    #[path = "../chunk_1152.rs"]
    pub mod chunk_1152;
    #[path = "../entity_registry_1144.rs"]
    pub mod entity_registry_1144;
    #[path = "../entity_registry_1152.rs"]
    pub mod entity_registry_1152;
    #[path = "../packet_bodies_1144.rs"]
    pub mod packet_bodies_1144;
    #[path = "../manager_legacy.rs"]
    pub mod manager_legacy;
    #[path = "../connection_legacy.rs"]
    pub mod connection_legacy;

    // Legacy duplicates whose file names still start with an upper-case letter
    // (a Rust module file name should be snake_case; these are reached through
    // `#[path]` so the files keep their audited names on disk).
    #[path = "../EntityFire.rs"]
    pub mod entity_fire_upper;
    #[path = "../EntityPushing.rs"]
    pub mod entity_pushing_upper;
    #[path = "../EntityTypes.rs"]
    pub mod entity_types_upper;
    #[path = "../EntityMetadata_1144.rs"]
    pub mod entity_metadata_1144_upper;
    #[path = "../EntityMetadata_1152.rs"]
    pub mod entity_metadata_1152_upper;
    #[path = "../EntityMetadata_1165.rs"]
    pub mod entity_metadata_1165_upper;

    // The full game.rs port (unfinished). Reached through `#[path]` because the
    // crate root already defines an inline `game` stand-in module.
    #[path = "../game.rs"]
    pub mod game_full;
}

// Note: src/game.rs still exists on disk - nothing was deleted. The crate root
// exposes a minimal inline `game::Game` stand-in (see the top of this file) and
// the unfinished full port is compiled only as `unsupported_port::game_full`.

// ---------------------------------------------------------------------------
// Modules referenced by the unfinished files above but absent from the crate.
// Declaring them here documents the missing surface; they are intentionally not
// declared outside this block because no such .rs file exists.
//
// Missing, needed by `unsupported_port`: assets, audio, graphics, gui, i18n,
// input, inventory, network, runtime, util.
// These are JavaScript directory names under client/js/, not Rust modules.
// ---------------------------------------------------------------------------// MARKER_TEST_12345

