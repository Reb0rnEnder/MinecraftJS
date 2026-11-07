/* tslint:disable */
/* eslint-disable */

export class AdvancementProgress {
    free(): void;
    [Symbol.dispose](): void;
    constructor();
    done: boolean;
    get obtained_tick(): bigint | undefined;
    set obtained_tick(value: bigint | null | undefined);
}

export class AdvancementsCore {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Get all advancement IDs as JSON array.
     */
    all_ids_json(): string;
    /**
     * Clear all advancements and progress.
     */
    clear(): void;
    /**
     * Get an advancement by ID as JSON.
     */
    get_json(id: string): string | undefined;
    /**
     * Get progress for an advancement as JSON.
     */
    get_progress_json(id: string): string | undefined;
    /**
     * Check if we have any progress data for an advancement.
     */
    has_progress(id: string): boolean;
    /**
     * Check if an advancement is fully completed.
     */
    is_done(id: string): boolean;
    constructor();
    /**
     * Process an advancement packet from the server.
     * Returns JSON array of advancement IDs that should show a toast.
     */
    on_packet(packet_json: string): string;
    /**
     * Get completion percentage (0.0 to 1.0).
     */
    percent(id: string): number;
    /**
     * Get progress text like "3/5".
     */
    progress_text(id: string): string | undefined;
    /**
     * Select a tab by advancement ID.
     */
    select_tab(id: string): boolean;
    /**
     * Get the currently selected tab ID.
     */
    selected_tab(): string | undefined;
    /**
     * Get root advancements with display (tabs) as JSON array.
     */
    tabs_json(): string;
    /**
     * Serialize the full state to JSON.
     */
    to_json(): string;
}

export class AttributeModifier {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    amount: number;
    operation: number;
}

/**
 * Banner configuration: base color + up to 6 pattern layers (max 7 total including base).
 */
export class Banner {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Add a pattern layer.
     */
    add_pattern(pattern: string, color: number): void;
    /**
     * Get the base color.
     */
    base_color(): number;
    /**
     * Get all layers (base + patterns) as a flat array for JS interop.
     * Returns [base_pattern, base_color, pattern1_code, pattern1_color, ...]
     */
    layers_flat(): Uint8Array;
    /**
     * Create a new Banner with a base color (0-15).
     */
    constructor(base_color: number);
    /**
     * Get the pattern count.
     */
    pattern_count(): number;
}

/**
 * Bed facing direction.
 */
export enum BedFacing {
    South = 0,
    West = 90,
    North = 180,
    East = 270,
}

/**
 * BedSleep handles all bed-related sleep logic.
 */
export class BedSleep {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Get current bed position.
     */
    bed_pos(): BlockPos | undefined;
    /**
     * Check if an entity can sleep at the current time.
     * Returns true if it's night time, not in combat, and bed is valid.
     */
    can_sleep(world_time: bigint, in_combat: boolean, bed_valid: boolean): boolean;
    /**
     * Find a valid bed near the given position.
     * Returns the bed position if found, null otherwise.
     */
    find_bed(world: WorldView, start_x: number, start_y: number, start_z: number, range: number): BlockPos | undefined;
    /**
     * Get current sleep state.
     */
    is_sleeping(): boolean;
    constructor();
    /**
     * Set the sleep start tick (for wake time calculation).
     */
    set_sleep_start_tick(tick: bigint): void;
    /**
     * Get the sleep start tick.
     */
    sleep_start_tick(): bigint | undefined;
    /**
     * Start sleeping at the given bed position.
     */
    start_sleeping(pos: BlockPos, player: SleepState): void;
    /**
     * Stop sleeping and reset state.
     */
    stop_sleeping(player: SleepState): void;
    /**
     * Wake up the sleeper (explicit wake up).
     */
    wake_up(player: SleepState): void;
}

/**
 * WASM-exposed wrapper for BedValidationResult.
 */
export class BedValidationResult {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    readonly facing: BedFacing | undefined;
    readonly foot_pos: BlockPos | undefined;
    readonly head_pos: BlockPos | undefined;
    readonly valid: boolean;
}

/**
 * One-shot sound events (pollinate, sting, death, etc.).
 * These are triggered by game events, not per-tick.
 */
export enum BeeSoundEvent {
    /**
     * Bee pollinated a flower/crop.
     */
    Pollinate = 0,
    /**
     * Bee became angry.
     */
    Angry = 1,
    /**
     * Bee died.
     */
    Death = 2,
    /**
     * Bee stung a target.
     */
    Sting = 3,
    /**
     * Bee entered a hive/nest.
     */
    EnterHive = 4,
    /**
     * Bee exited a hive/nest.
     */
    ExitHive = 5,
    /**
     * Bee is working (returning with pollen).
     */
    Work = 6,
}

/**
 * Sound loop name to play.
 */
export enum BeeSoundLoop {
    /**
     * Normal bee loop sound.
     */
    Normal = 0,
    /**
     * Aggressive/angry bee loop sound.
     */
    Aggressive = 1,
}

/**
 * Output sound parameters: volume and pitch.
 */
export class BeeSoundOutput {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Pitch multiplier (1.0 = normal).
     */
    pitch: number;
    /**
     * Volume in range [0.0, 1.0].
     */
    volume: number;
}

/**
 * Input parameters for bee sound computation (matches the JS entity fields used).
 */
export class BeeSoundParams {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Whether the bee is angry/aggressive.
     */
    angry: boolean;
    /**
     * Current sound name (loop variant).
     */
    bee_sound_name: string;
    /**
     * Current sound token (opaque identifier for sound instance validity).
     */
    bee_sound_token: bigint;
    /**
     * Whether the bee is a child (baby).
     */
    child: boolean;
    /**
     * Whether the bee is dead.
     */
    dead: boolean;
    /**
     * Horizontal motion X component.
     */
    motion_x: number;
    /**
     * Horizontal motion Z component.
     */
    motion_z: number;
    /**
     * Whether the bee is silent (metadata flag).
     */
    silent: boolean;
    /**
     * Current X position.
     */
    x: number;
    /**
     * Current Y position.
     */
    y: number;
    /**
     * Current Z position.
     */
    z: number;
}

/**
 * Result of a tick: what the sound system should do.
 */
export class BeeSoundTickResult {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * New sound token (0 means stop/clear).
     */
    new_token: bigint;
    /**
     * Computed pitch.
     */
    pitch: number;
    /**
     * Position to set on the sound [x, y, z].
     */
    position: Float64Array;
    /**
     * Whether to stop the current sound entirely.
     */
    should_stop: boolean;
    /**
     * Sound loop to play (if any).
     */
    get sound_loop(): BeeSoundLoop | undefined;
    /**
     * Sound loop to play (if any).
     */
    set sound_loop(value: BeeSoundLoop | null | undefined);
    /**
     * Computed volume.
     */
    volume: number;
}

/**
 * One zoomer instance. The cache is bounded like the JavaScript `Map`; its
 * eviction policy does not affect results because every entry is memoised
 * from deterministic arithmetic.
 */
export class BiomeZoom {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * The corner chosen for a block position: `(qx, qy, qz)`.
     */
    cell(x: number, y: number, z: number): Int32Array;
    constructor(seed: bigint);
    /**
     * Jitter offsets for a corner, in the same order as the JavaScript.
     */
    offset(x: number, y: number, z: number): Float64Array;
    seed(): bigint;
}

/**
 * Represents a block position in the world.
 */
export class BlockPos {
    free(): void;
    [Symbol.dispose](): void;
    constructor(x: number, y: number, z: number);
    x: number;
    y: number;
    z: number;
}

export class BlockRegistryCore {
    free(): void;
    [Symbol.dispose](): void;
    block_id(state: number): number;
    block_name(state: number): string;
    collision_boxes(state: number): Float64Array;
    emit_light(state: number): number;
    filter_light(state: number): number;
    find_state(name: string, props_json: string): number;
    has_model(state: number): boolean;
    is_liquid(state: number): boolean;
    is_stairs(state: number): boolean;
    constructor(blocks_json: string, shapes_json: string);
    opaque(state: number): boolean;
    properties_json(state: number): string;
    slipperiness(state: number): number;
    state_count(): number;
    state_name(state: number): string;
}

export class BoxModelCore {
    free(): void;
    [Symbol.dispose](): void;
    add_child(child: BoxModelCore): void;
    /**
     * Bake this part and all children to entity vertices.
     */
    bake(reg: BlockRegistryCore): Float32Array;
    box_elem(x: number, y: number, z: number, dx: number, dy: number, dz: number, inflate: number, mirror?: boolean | null): void;
    mirror(mirror: boolean): void;
    constructor(tex_w: number, tex_h: number);
    pivot(x: number, y: number, z: number): void;
    rot(x: number, y: number, z: number): void;
    tex(u: number, v: number): void;
    /**
     * Export as JSON for debugging/serialization.
     */
    to_json(): string;
    visible(visible: boolean): void;
}

export class CameraEye {
    free(): void;
    [Symbol.dispose](): void;
    height(partial: number, target: number): number;
    constructor();
    reset(): void;
    tick(height: number): void;
}

/**
 * AES/CFB8 with key = iv = the shared secret, matching
 * `CryptManager.createNetCipherInstance`.
 */
export class Cfb8 {
    free(): void;
    [Symbol.dispose](): void;
    constructor(secret: Uint8Array, decrypt: boolean);
    update(data: Uint8Array): Uint8Array;
}

/**
 * Decoded column. Sections are indexed by section Y (0..16).
 */
export class ChunkColumn {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    biomes(): Uint32Array;
    /**
     * Block states for a section, or an empty vector when it is absent.
     */
    blocks(y: number): Uint32Array;
    has_biomes(): boolean;
    non_air(y: number): number;
    present(y: number): boolean;
    wire_non_air(y: number): number;
}

export class CommandResult {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    readonly message: string;
    success: boolean;
}

export class CraftingTableCore {
    free(): void;
    [Symbol.dispose](): void;
    craft(grid_json: string, n: number, durability_json: string): string;
    constructor(json: string);
    shaped_count(): number;
    shapeless_count(): number;
}

/**
 * Result of packet deserialization
 */
export class DecodedPacket {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    data(): Uint8Array;
    packet_id(): number;
    packet_name(): string | undefined;
}

/**
 * Difficulty levels
 */
export enum Difficulty {
    Peaceful = 0,
    Easy = 1,
    Normal = 2,
    Hard = 3,
}

/**
 * Dimensions
 */
export enum Dimension {
    Overworld = 0,
    Nether = -1,
    End = 1,
}

export class EffectState {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    ambient: boolean;
    amplifier: number;
    duration: number;
    hide_particles: boolean;
    show_icon: boolean;
    start_tick: bigint;
}

/**
 * Entity effect type for particle generation.
 */
export enum EntityEffectType {
    /**
     * End crystal healing beam
     */
    CrystalBeam = 0,
    /**
     * Guardian laser beam
     */
    GuardianBeam = 1,
    /**
     * Ender dragon death rays
     */
    DragonDeathRays = 2,
    /**
     * Potion effect particles (swirly)
     */
    PotionSwirl = 3,
    /**
     * Glowing effect outline
     */
    Glowing = 4,
}

/**
 * JS: an `EVENT_SOUNDS` entry for wasm consumers. `pitch_kind`:
 * 0 = `() => 1`, 1 = `() => 1.2`, 2 = `r()*0.1+0.9`, 3 = `2.6+(r-r)*0.8`,
 * 4 = `(r-r)*0.2+1`.
 */
export class EventSoundInfo {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    event: string;
    found: boolean;
    pitch_kind: number;
    volume: number;
}

/**
 * Falling block entity state.
 *
 * Mirrors the JS entity fields used by `tickFallingBlock`:
 * - position (x, y, z)
 * - motion (motion_x, motion_y, motion_z)
 * - block_state: the block state ID being carried
 * - age: ticks existed
 * - falling_started: whether the first-tick source-block removal has run
 * - no_gravity: whether to skip gravity (e.g. from metadata)
 * - on_ground: whether the entity landed this tick
 */
export class FallingBlock {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Get the entity's bounding box in world coordinates as a flat array:
     * [minX, minY, minZ, maxX, maxY, maxZ].
     */
    bounding_box(): Float64Array;
    constructor(x: number, y: number, z: number, block_state: number);
    /**
     * Tick the falling block physics for one game tick.
     *
     * Returns `true` if the entity should be removed (landed or expired),
     * `false` if it should continue existing.
     *
     * # Arguments
     * * `world` - WorldCore for collision queries and block state access
     * * `registry` - BlockRegistryCore for block property lookups
     */
    tick(world: WorldCore, registry: BlockRegistryCore): boolean;
    age: number;
    block_state: number;
    falling_started: boolean;
    height: number;
    motion_x: number;
    motion_y: number;
    motion_z: number;
    no_gravity: boolean;
    on_ground: boolean;
    width: number;
    x: number;
    y: number;
    z: number;
}

/**
 * Input entity for fire rendering.
 */
export class FireEntity {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Entity type ID (for immunity check)
     */
    entity_type: number;
    /**
     * Player gamemode (3 = spectator)
     */
    gamemode: number;
    /**
     * Entity height (default 1.8)
     */
    height: number;
    /**
     * Entity unique ID (not used in geometry, but useful for debugging)
     */
    id: number;
    /**
     * Entity kind: 0 = mob, 1 = player, 2 = other
     */
    kind: number;
    /**
     * Whether the entity is on fire
     */
    on_fire: boolean;
    /**
     * Entity width (default 0.6)
     */
    width: number;
    /**
     * Whether it's a wither (special case for type 51)
     */
    wither: boolean;
    /**
     * Interpolated position X
     */
    x: number;
    /**
     * Interpolated position Y
     */
    y: number;
    /**
     * Interpolated position Z
     */
    z: number;
}

/**
 * Result of fire geometry generation.
 * Returns a flat Float32Array: [x, y, z, u, v, r, g, b, a, ...] per vertex.
 * Each quad has 4 vertices = 36 floats (9 per vertex * 4).
 */
export class FireGeometryResult {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Returns true if there are no vertices (empty result).
     */
    readonly is_empty: boolean;
    /**
     * Number of quads (each quad = 2 triangles = 6 indices).
     */
    readonly quad_count: number;
    /**
     * Number of vertices (each quad = 4 vertices).
     */
    readonly vertex_count: number;
    /**
     * Get the vertices as a flat array (9 floats per vertex: x,y,z, u,v, r,g,b,a).
     */
    readonly vertices: Float32Array;
}

/**
 * Result of fire overlay geometry generation.
 * Returns a flat array of f32: [x, y, z, u, v, r, g, b, a, ...] per vertex.
 * Two intersecting planes, 4 vertices each = 8 vertices = 72 floats.
 */
export class FireOverlayGeometryResult {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Returns true if there are no vertices (empty result).
     */
    readonly is_empty: boolean;
    /**
     * Number of vertices (always 8 for the fire overlay: 2 planes × 4 vertices).
     */
    readonly vertex_count: number;
    /**
     * Get the vertices as a flat array (9 floats per vertex: x,y,z, u,v, r,g,b,a).
     */
    readonly vertices: Float32Array;
}

/**
 * UV coordinates for a fire texture in the atlas.
 * JS expects [u0, v0, u1, v1] where (u0,v0) is top-left and (u1,v1) is bottom-right.
 */
export class FireUv {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    u0: number;
    u1: number;
    v0: number;
    v1: number;
}

export class FluidState {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    readonly height: number;
    readonly is_lava: boolean;
    readonly is_water: boolean;
    readonly level: number;
    readonly source: boolean;
}

/**
 * AI tick result for wasm return.
 */
export class FoxAITickResult {
    free(): void;
    [Symbol.dispose](): void;
    constructor(behavior: FoxBehavior, target: FoxTargetResult);
    readonly behavior: FoxBehavior;
    readonly target: FoxTargetResult;
}

/**
 * Animation arguments returned to JS for fox model rendering.
 */
export class FoxAnimationArgs {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    fox_crouch_amount: number;
    fox_crouching: boolean;
    fox_faceplanted: boolean;
    fox_head_roll: number;
    fox_sleeping: boolean;
}

/**
 * Fox AI behavior state machine.
 */
export enum FoxBehavior {
    Idle = 0,
    Sleeping = 1,
    Sitting = 2,
    Wandering = 3,
    Hunting = 4,
    Fleeing = 5,
    Pouncing = 6,
    Faceplanted = 7,
    Breeding = 8,
    FollowingOwner = 9,
    Defending = 10,
    Eating = 11,
}

/**
 * Fox sound event types.
 */
export enum FoxSound {
    None = 0,
    Ambient = 1,
    Hurt = 2,
    Death = 3,
    Sleep = 4,
    Wake = 5,
    Screech = 6,
    Sniff = 7,
    Eat = 8,
    Pounce = 9,
    Faceplant = 10,
}

/**
 * Internal fox state for AI tick (mirrors entity fields used by JS).
 */
export class FoxState {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Prepare animation arguments for render (matches `foxAnimationArgs`).
     */
    animation_args(partial: number): FoxAnimationArgs;
    /**
     * Apply fox flags from metadata byte (matches `applyFoxFlags`).
     */
    apply_flags(flags: number): void;
    /**
     * Get current flags byte.
     */
    flags(): number;
    constructor();
    /**
     * Per-tick interpolation update (matches `tickFox`).
     */
    tick(): void;
    age: number;
    child: boolean;
    fox_crouch_amount: number;
    fox_crouching: boolean;
    fox_defending: boolean;
    fox_faceplanted: boolean;
    fox_flags: number;
    fox_interest_amount: number;
    fox_interested: boolean;
    fox_pouncing: boolean;
    fox_sleeping: boolean;
    fox_type: number;
    prev_fox_crouch_amount: number;
    prev_fox_interested: number;
    sitting: boolean;
    trusted_uuid_0: bigint;
    trusted_uuid_1: bigint;
}

/**
 * Result of target selection.
 */
export class FoxTargetResult {
    free(): void;
    [Symbol.dispose](): void;
    constructor();
    readonly distance_sq: number;
    readonly target_entity_id: number;
    readonly target_type: FoxTargetType;
    readonly target_x: number;
    readonly target_y: number;
    readonly target_z: number;
    readonly valid: boolean;
}

/**
 * Target type for fox AI.
 */
export enum FoxTargetType {
    None = 0,
    Prey = 1,
    Predator = 2,
    Player = 3,
    BreedingPartner = 4,
    Food = 5,
}

/**
 * Trust UUID pair for wasm return.
 */
export class FoxTrustPair {
    free(): void;
    [Symbol.dispose](): void;
    constructor(uuid_0: bigint, uuid_1: bigint);
    uuid_0: bigint;
    uuid_1: bigint;
}

export class FrameResult {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    fps: number;
    partial_tick: number;
    ticks_run: number;
}

/**
 * Persistent frustum used by the renderer: `from_matrix` runs once per
 * camera change, then every culling call is just the box test.
 */
export class Frustum {
    free(): void;
    [Symbol.dispose](): void;
    contains_aabb(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): boolean;
    /**
     * Update from a column-major view-projection matrix (`Float32Array(16)`).
     */
    from_matrix(matrix: Float32Array): void;
    constructor();
    /**
     * Flattened planes, for tests and debugging.
     */
    planes(): Float64Array;
}

/**
 * Core game logic handler. This is the main entry point for the WASM game loop.
 * The JS side owns the live state (Game instance); this struct holds the
 * pure computation kernel.
 */
export class GameCore {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Apply game mode settings to player capabilities
     */
    apply_game_mode(): void;
    /**
     * Get interpolated camera position
     */
    camera_position(partial: number, eye_height: number): Vec3;
    /**
     * Frame update - called every render frame
     */
    frame(now: number): FrameResult;
    /**
     * Get profiler data
     */
    get_profiler_data(): any;
    /**
     * Get current game state (for serialization/debugging)
     */
    get_state(): any;
    /**
     * Initialize the game state with connection parameters
     */
    initialize(entity_id: number, dimension: number, difficulty: number, game_mode: number, level_type: string, world_age: bigint, time_of_day: bigint, do_daylight_cycle: boolean, max_players: number, seed: bigint, reduced_debug: boolean): void;
    /**
     * Get look vector
     */
    look_vector(partial: number): Vec3;
    constructor();
    /**
     * Process pending commands (chat commands, etc.)
     */
    process_commands(commands: string[]): CommandResult[];
    /**
     * Record chunk update for stats
     */
    record_chunk_update(): void;
    /**
     * Remove effect
     */
    remove_effect(effect_id: number): void;
    /**
     * Handle respawn
     */
    respawn(): void;
    /**
     * Update difficulty from server
     */
    set_difficulty(difficulty: number): void;
    /**
     * Update dimension
     */
    set_dimension(dimension: number, difficulty?: number | null, game_mode?: number | null, level_type?: string | null, seed?: bigint | null): void;
    /**
     * Add/remove effect
     */
    set_effect(effect_id: number, amplifier: number, duration: number, hide_particles: boolean, ambient: boolean, show_icon: boolean): void;
    /**
     * Update game mode from server
     */
    set_game_mode(game_mode: number): void;
    /**
     * Update held slot
     */
    set_held_slot(slot: number): void;
    /**
     * Enable/disable profiler
     */
    set_profiler_enabled(enabled: boolean): void;
    /**
     * Start/stop sleeping
     */
    set_sleeping(sleeping: boolean, bed_pos?: BlockPos | null): void;
    /**
     * Set game state (for loading/sync)
     */
    set_state(state: any): void;
    /**
     * Main game tick - called at 20 TPS
     */
    tick(delta_ms: number): GameTickResult;
    /**
     * Decrement active effect durations (EffectInstance.tick in vanilla).
     */
    update_effects(): void;
    /**
     * Update player health/food
     */
    update_player_health(health: number, food: number, saturation: number): void;
    /**
     * Update player position and movement state
     */
    update_player_position(x: number, y: number, z: number, yaw: number, pitch: number, on_ground: boolean, motion_x: number, motion_y: number, motion_z: number, sprinting: boolean, sneaking: boolean): void;
    /**
     * Update player XP
     */
    update_player_xp(xp_bar: number, xp_level: number, xp_total: number): void;
    /**
     * Update world border
     */
    update_world_border(action: number, x: number, z: number, radius: number, new_radius: number, warning_time: number, warning_blocks: number): void;
    /**
     * Update world-level systems (weather, border, etc.)
     */
    update_world(): WorldUpdateResult;
}

/**
 * Game modes
 */
export enum GameMode {
    Survival = 0,
    Creative = 1,
    Adventure = 2,
    Spectator = 3,
}

/**
 * Core game state that can be serialized and shared between JS and WASM
 */
export class GameState {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    allow_flying: boolean;
    blind: boolean;
    get camera_entity(): number | undefined;
    set camera_entity(value: number | null | undefined);
    chunk_updates: number;
    connected: boolean;
    creative: boolean;
    dead: boolean;
    difficulty: Difficulty;
    dimension: Dimension;
    do_daylight_cycle: boolean;
    done_loading_terrain: boolean;
    entity_id: number;
    flying: boolean;
    food: number;
    fov_modifier: number;
    fps: number;
    frame_time_index: number;
    game_mode: GameMode;
    hardcore: boolean;
    health: number;
    held_slot: number;
    hide_gui: boolean;
    hurt_time: number;
    in_world: boolean;
    inventory_open: boolean;
    get jump_boost(): number | undefined;
    set jump_boost(value: number | null | undefined);
    get levitation(): number | undefined;
    set levitation(value: number | null | undefined);
    max_health: number;
    max_players: number;
    motion_x: number;
    motion_y: number;
    motion_z: number;
    on_ground: boolean;
    permission_level: number;
    pitch: number;
    portal_time: number;
    prev_fov_modifier: number;
    prev_health: number;
    prev_portal_time: number;
    prev_rain: number;
    get previous_game_mode(): GameMode | undefined;
    set previous_game_mode(value: GameMode | null | undefined);
    rain_strength: number;
    raining: boolean;
    reduced_debug: boolean;
    saturation: number;
    show_chunk_borders: boolean;
    show_debug: boolean;
    show_hitboxes: boolean;
    show_lagometer: boolean;
    show_profiler: boolean;
    sleeping: boolean;
    sneaking: boolean;
    get spawn_pos(): BlockPos | undefined;
    set spawn_pos(value: BlockPos | null | undefined);
    spectator: boolean;
    sprinting: boolean;
    third_person: number;
    thunder_strength: number;
    thundering: boolean;
    ticks: bigint;
    time_of_day: bigint;
    using_item: boolean;
    get window_id(): number | undefined;
    set window_id(value: number | null | undefined);
    world_age: bigint;
    world_border_radius: number;
    world_border_warning_blocks: number;
    world_border_warning_time: number;
    world_border_x: number;
    world_border_z: number;
    x: number;
    xp_bar: number;
    xp_level: number;
    xp_total: number;
    y: number;
    yaw: number;
    z: number;
}

export class GameTickResult {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    hurt_time: number;
    portal_time: number;
    ticks: bigint;
    time_of_day: bigint;
    world_age: bigint;
}

export class ItemTableCore {
    free(): void;
    [Symbol.dispose](): void;
    can_always_eat(id: number): boolean;
    can_harvest(id: number, harvest_tools_json: string): boolean;
    cursor_color(id: string): string;
    egg_entity(id: number, tag_json: string): string;
    egg_info(id: number): string;
    enchantment_key(id: string): string;
    enchantments(id: number, tag_json: string): string;
    has_effect(id: number, tag_json: string): boolean;
    is_enchanted(id: number, tag_json: string): boolean;
    is_food(id: number): boolean;
    is_single_level(id: string): boolean;
    item_key(id: number): string;
    max_durability(id: number): number;
    max_stack(id: number): number;
    name(id: number): string;
    constructor(json_text: string);
    potion_color(id: number, tag_json: string): bigint;
    potion_effects(id: number, tag_json: string): string;
    rarity(id: number, tag_json: string): number;
    str_vs_block(id: number, block_name: string, material: string): number;
    use_action(id: number): string;
    use_duration(id: number, tag_json: string): number;
}

export class JavaRandom {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * `seed` is a Java long, so JavaScript passes a BigInt.
     */
    constructor(seed?: bigint | null);
    next_double(): number;
    next(bits: number): number;
    next_float(): number;
    /**
     * `bound = undefined` is represented by `None`.
     */
    next_int(bound?: number | null): number;
    set_seed(seed: bigint): void;
}

export class ModelStoreCore {
    free(): void;
    [Symbol.dispose](): void;
    bake_model_json(name: string, rx: number, ry: number, uvlock: boolean): string;
    bake_variant_json(file: string, props_json: string, exact_key: string, rand: number): string;
    find_variant_json(file: string, props_json: string, exact_key: string): string;
    constructor(models_json: string, blockstates_json: string, atlas_json: string);
    stats(): string;
}

/**
 * JS: `_musicType()` result for wasm consumers.
 */
export class MusicTrackInfo {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    event: string;
    max_delay: number;
    min_delay: number;
}

/**
 * Direction of packet flow
 */
export enum PacketDirection {
    Clientbound = 0,
    Serverbound = 1,
}

export class PacketReader {
    free(): void;
    [Symbol.dispose](): void;
    angle(): number;
    bytes_n(count: number): Uint8Array;
    f32(): number;
    f64(): number;
    i16(): number;
    i32(): number;
    i64(): bigint;
    i8(): number;
    constructor(bytes: Uint8Array);
    offset(): number;
    /**
     * Packed block position -> [x, y, z].
     */
    position(): Int32Array;
    read_bool(): boolean;
    remaining(): number;
    rest(): Uint8Array;
    string(): string;
    u16(): number;
    u8(): number;
    uuid(): string;
    /**
     * Signed VarInt, matching `Reader.varint()`.
     */
    varint(): number;
    /**
     * Signed VarLong, matching `Reader.varlong()`.
     */
    varlong(): bigint;
}

export class PacketWriter {
    free(): void;
    [Symbol.dispose](): void;
    build(): Uint8Array;
    f32(value: number): void;
    f64(value: number): void;
    i16(value: number): void;
    i32(value: number): void;
    i64(value: bigint): void;
    i8(value: number): void;
    is_empty(): boolean;
    len(): number;
    constructor();
    position(x: number, y: number, z: number): void;
    raw(bytes: Uint8Array): void;
    string(value: string): void;
    u16(value: number): void;
    u8(value: number): void;
    uuid(value: string): void;
    varint(value: number): void;
    varlong(value: bigint): void;
    write_bool(value: boolean): void;
}

export class PistonCore {
    free(): void;
    [Symbol.dispose](): void;
    constructor();
}

/**
 * Decoded image: 8-bit RGBA, row-major.
 */
export class PngImage {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    data_len(): number;
    /**
     * RGBA bytes (`Uint8Array` in JavaScript; copied out of WASM memory).
     */
    readonly data: Uint8Array;
    readonly height: number;
    readonly width: number;
}

/**
 * Profiling data for a section
 */
export class ProfileSection {
    free(): void;
    [Symbol.dispose](): void;
    name(): string;
    constructor(name: string);
    readonly avg_time: number;
    readonly count: number;
    readonly start_time: number;
    readonly total_time: number;
}

/**
 * Profiling manager
 */
export class ProfilingData {
    free(): void;
    [Symbol.dispose](): void;
    constructor();
    sections_json(): string;
    enabled: boolean;
    frame_start: number;
}

/**
 * Supported protocol versions
 */
export enum ProtocolVersion {
    V498 = 498,
    V578 = 578,
}

export class RecipeBookCore {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Check if a single recipe can be crafted.
     */
    can_craft(recipe_json: string, counts_json: string): boolean;
    /**
     * Clear fresh recipes.
     */
    clear_fresh(): void;
    /**
     * Get cooking state for a kind.
     */
    cooking_state_json(kind: string): string;
    /**
     * Evaluate a recipe list for craftability.
     */
    evaluate_list(list_json: string, counts_json: string, grid_width: number, grid_height: number): string;
    /**
     * Get fresh recipe IDs as JSON array.
     */
    fresh_recipes_json(): string;
    /**
     * Get known recipe IDs as JSON array.
     */
    known_recipes_json(): string;
    constructor();
    /**
     * Handle a recipe book packet from the server.
     */
    on_packet(server_recipes_json: string, asset_recipes_json: string, tags_json: string, packet_json: string): void;
    /**
     * Parse recipes and build tab lists. Returns JSON of all recipes.
     */
    parse(server_recipes_json: string, asset_recipes_json: string, tags_json: string): string;
    /**
     * Compute stacked contents from inventory and grid.
     */
    stacked_contents(inventory_json: string, grid_json: string): string;
    /**
     * Get recipe lists for a tab as JSON.
     */
    tab_lists_json(server_recipes_json: string, asset_recipes_json: string, tags_json: string, tab: string): string;
    /**
     * Get craftable filtering state.
     */
    filtering: boolean;
    /**
     * Get crafting book open state.
     */
    open: boolean;
}

/**
 * Recipe book state
 */
export class RecipeBookState {
    free(): void;
    [Symbol.dispose](): void;
    book_type(): string;
    highlighted(): string[];
    constructor();
    search_query(): string;
    unlocked(): string[];
    is_filtering: boolean;
    is_open: boolean;
    set book_type(value: string);
    set search_query(value: string);
}

export class RegistryTagsCore {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Check if an entry ID is in a tag for a registry kind.
     */
    contains(kind: string, tag_name: string, id: number): boolean;
    /**
     * Get all tags containing the given entry ID for a registry kind.
     */
    for_entry(kind: string, id: number): string[];
    /**
     * Get all tag names for a registry kind ("blocks", "items", "fluids", "entities").
     */
    names(kind: string): string[];
    /**
     * Create an empty RegistryTagsCore (no tags loaded).
     */
    static newEmpty(): RegistryTagsCore;
    constructor(tags_json: string);
    /**
     * Replace all tag data from a JSON string.
     */
    replace(tags_json: string): void;
}

export class ScoreboardCore {
    free(): void;
    [Symbol.dispose](): void;
    display_name(uuid: string, fallback?: string | null): string | undefined;
    format_name(name: string): string;
    get_below_name(): string | undefined;
    get_footer(): string;
    get_header(): string;
    get_list(): string | undefined;
    get_objectives_json(): string;
    get_players_json(): string;
    get_sidebar(): string | undefined;
    get_teams_json(): string;
    constructor(username: string);
    on_display(position: number, objective?: string | null): void;
    on_objective(action: number, objective: string, display_text: string, obj_type: string): void;
    on_player_info(action: number, data_json: string): void;
    on_score(action: number, score_name: string, item_name: string, value: number): void;
    on_team(mode: number, team: string, data_json: string): void;
    reset(): void;
    set_footer(footer: string): void;
    set_header(header: string): void;
    set_sidebar(name?: string | null): void;
    set_username(username: string): void;
    sorted_players_json(): string;
    tab_name(name: string, display_name?: string | null): string;
}

export class SectionCullerCore {
    free(): void;
    [Symbol.dispose](): void;
    is_visible(x: number, y: number, z: number): boolean;
    constructor();
    reached_count(): number;
    /**
     * Returns the reached section indices in walk order.
     */
    update(keys: BigInt64Array, flags: Uint8Array, vis: Uint8Array, planes: Float64Array, cam: Float64Array, render_distance: number, columns: Uint8Array, camera_in_opaque: boolean, max_dist: number, enabled: boolean): Int32Array;
}

/**
 * Camera position for sleeping view.
 */
export class SleepCamera {
    free(): void;
    [Symbol.dispose](): void;
    constructor(x: number, y: number, z: number, yaw: number, pitch: number);
    pitch: number;
    x: number;
    y: number;
    yaw: number;
    z: number;
}

/**
 * WASM-exposed wrapper for SleepDelta.
 */
export class SleepDelta {
    free(): void;
    [Symbol.dispose](): void;
    constructor();
    /**
     * Positions as a JSON array; each entry is null or [x, y, z].
     */
    positions_json: string;
}

/**
 * WASM-exposed wrapper for SleepState.
 */
export class SleepState {
    free(): void;
    [Symbol.dispose](): void;
    constructor();
    get bed_pos(): BlockPos | undefined;
    set bed_pos(value: BlockPos | null | undefined);
    crouching: boolean;
    height: number;
    motion_x: number;
    motion_y: number;
    motion_z: number;
    pitch: number;
    pose: string;
    prev_pitch: number;
    prev_x: number;
    prev_y: number;
    prev_z: number;
    sleeping: boolean;
    width: number;
    x: number;
    y: number;
    z: number;
}

/**
 * The Rust equivalent of `world/slice.js`'s `{ states, light, biomes, ... }`.
 */
export class SliceData {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    readonly biome_layers: number;
    readonly biome_ox: number;
    readonly biome_oz: number;
    readonly biome_size: number;
    readonly biomes: Uint8Array;
    readonly has_sky: boolean;
    readonly light: Uint8Array;
    readonly ox: number;
    readonly oy: number;
    readonly oz: number;
    readonly states: Uint16Array;
    readonly x: number;
    readonly y: number;
    readonly z: number;
}

/**
 * The software device. Browser-bound presentation stays in JS; this owns the
 * buffers, textures, meshes, globals and the whole draw path.
 */
export class SoftwareDevice {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * `beginFrame(clear)`.
     */
    begin_frame(r: number, g: number, b: number): void;
    /**
     * `busy()`: the software rasteriser is never behind.
     */
    busy(): boolean;
    /**
     * `capture()`: pixels of the last completed frame (the promise stays in JS).
     */
    capture(): Uint8Array;
    /**
     * `setRenderTarget(t, clear)` colour+depth clear of the bound target.
     */
    clear_current(r: number, g: number, b: number, a: number): void;
    clear_depth(): void;
    clear_scissor(): void;
    /**
     * `createMesh(format, vertices, opts)` with raw bytes -> handle.
     */
    create_mesh(format: string, data: Uint8Array, quads: boolean, indices: Uint32Array): number;
    /**
     * `createMesh` with `Float32Array` data.
     */
    create_mesh_f32(format: string, data: Float32Array, quads: boolean, indices: Uint32Array): number;
    /**
     * `createRenderTarget(w, h)` -> handle.
     */
    create_render_target(w: number, h: number): number;
    /**
     * `createTexture({...})` -> handle.
     */
    create_texture(width: number, height: number, filter: string, wrap: string, mipmaps: boolean, mipmap_levels: number): number;
    destroy_mesh(handle: number): void;
    destroy_texture(handle: number): void;
    /**
     * `draw(d)` from a JSON descriptor.
     */
    draw_json(json: string): boolean;
    /**
     * `endFrame()`: the screen as RGBA bytes (top-left origin, for ImageData).
     */
    end_frame(): Uint8Array;
    /**
     * `endFrame()` pixels as packed texels.
     */
    end_frame_u32(): Uint32Array;
    mesh_index_count(handle: number): number;
    mesh_vertex_count(handle: number): number;
    constructor(width: number, height: number);
    /**
     * `resize(w, h)`.
     */
    resize(w: number, h: number): void;
    /**
     * `setGlobals(g)` from a JSON object.
     */
    set_globals_json(json: string): boolean;
    /**
     * `setRenderTarget(target)`: bind a render target, or the screen (-1).
     */
    set_render_target(handle: number): void;
    /**
     * `setScissor(rect)`, rect = [x, y, w, h] in pixels, origin top-left.
     */
    set_scissor(x: number, y: number, w: number, h: number): void;
    /**
     * Packed texels of a texture (level 0), for JS-side inspection.
     */
    texel_data(handle: number): Uint32Array;
    /**
     * `updateMesh(m, vertices, opts)`. `quads`: -1 = undefined, 0 = false, 1 = true.
     */
    update_mesh(handle: number, data: Uint8Array, quads: number, indices: Uint32Array): void;
    /**
     * `updateMesh` with `Float32Array` data.
     */
    update_mesh_f32(handle: number, data: Float32Array, quads: number, indices: Uint32Array): void;
    /**
     * `updateTexture(t, data, x, y, w, h)` with RGBA bytes.
     */
    upload_texture(handle: number, data: Uint8Array, x: number, y: number, w: number, h: number): void;
    readonly height: number;
    readonly width: number;
}

/**
 * Animation parameters for the title screen splash text.
 *
 * Ported from `client/js/gui/screens/menus.js` lines 118-127.
 */
export class SplashAnimation {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Alpha (always 1.0 for splash text)
     */
    alpha: number;
    /**
     * Rotation in radians (-20 degrees)
     */
    rotation: number;
    /**
     * Scale factor (animated pulsing)
     */
    scale: number;
    /**
     * X translation (center of screen + 90)
     */
    x: number;
    /**
     * Y translation (70px from top)
     */
    y: number;
}

/**
 * Startup splash configuration (ported from splash.js)
 */
export class SplashConfig {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Base scale factor (2x for high-DPI)
     */
    base_scale: number;
    /**
     * Logo texture size (256x256 for mojang.png)
     */
    logo_size: number;
}

/**
 * Result of startup splash scale calculation
 */
export class SplashScale {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * X offset to center logo
     */
    logo_x: number;
    /**
     * Y offset to center logo
     */
    logo_y: number;
    /**
     * Computed integer scale factor
     */
    scale: number;
    /**
     * Scaled viewport height (css pixels / scale)
     */
    scaled_height: number;
    /**
     * Scaled viewport width (css pixels / scale)
     */
    scaled_width: number;
}

export class TileRendererCore {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Banner swing angle.
     */
    banner_swing(time: number): number;
    /**
     * Calculate beacon beam brightness.
     */
    beacon_beam_brightness(world_age: number, beam_counter: number, beam_fade: number): number;
    /**
     * Get bed piece vertices.
     */
    bed_piece_vertices(head: boolean, facing: number): Float32Array;
    /**
     * Calculate block tint color.
     */
    block_tint_color(block_name: string, biome_id: number, biome_name: string, temperature: number, rainfall: number, y: number, grass_map: Uint8Array, foliage_map: Uint8Array): Float32Array | undefined;
    /**
     * Get breaking overlay UV for a stage.
     */
    breaking_uv(stage: number): Float32Array;
    /**
     * Build beacon beam geometry.
     */
    build_beam_geometry(segments_json: string, world_age: number, partial: number, beam_fade: number): any;
    /**
     * Check if a face should be culled.
     */
    cull_face(face: number, neighbor_state: number): boolean;
    /**
     * Get dye RGB colors.
     */
    dye_rgb(): Float32Array;
    /**
     * Get end portal colors.
     */
    end_portal_colors(): Float32Array;
    /**
     * Get flower pot contents.
     */
    flower_pot_contents(item_id: number, data: number): string | undefined;
    /**
     * Get fluid UV coordinates.
     */
    fluid_uv(fluid_type: number, flow: number): Float32Array;
    /**
     * Get block model JSON for a tile entity type.
     */
    get_block_model(tile_type: string, props_json: string): string;
    /**
     * Get face UV coordinates.
     */
    get_face_uv(face: number, from: Float64Array, to: Float64Array, element_uv?: Float64Array | null): Float64Array;
    constructor(blocks_json: string, shapes_json: string);
    /**
     * Get the block registry for external use.
     */
    registry(): BlockRegistryCore;
    /**
     * Calculate shulker box bounds.
     */
    shulker_bounds(x: number, y: number, z: number, facing: number, progress: number): Float64Array;
    /**
     * Get shulker box vertices (base, lid).
     */
    shulker_box_vertices(facing_index: number): any;
    /**
     * Get skull model vertices.
     */
    skull_model_vertices(skull_type: number): Float32Array;
    /**
     * Get skull type from block name.
     */
    skull_type(name: string): number | undefined;
}

/**
 * Update sleep result from delta.
 */
export enum UpdateSleepResult {
    None = 0,
    Start = 1,
    Stop = 2,
}

/**
 * Minimal 3-component vector (f64) used by camera/look helpers.
 */
export class Vec3 {
    free(): void;
    [Symbol.dispose](): void;
    constructor(x: number, y: number, z: number);
    x: number;
    y: number;
    z: number;
}

/**
 * Reusable visibility tracer: the per-state flag table is built once when the
 * block registry is initialised, so meshing only copies the 8 KiB section.
 */
export class VisGraph {
    free(): void;
    [Symbol.dispose](): void;
    compute(states: Uint16Array, fancy_leaves: boolean): Uint8Array;
    flags_len(): number;
    constructor(state_flags: Uint8Array);
    update_flags(state_flags: Uint8Array): void;
}

/**
 * World data exposed to JavaScript and native tests.
 */
export class WorldCore {
    free(): void;
    [Symbol.dispose](): void;
    begin_batch(): void;
    /**
     * Build the 20^3 section neighbourhood the mesher consumes
     * (`world/slice.js`). Coordinates are section coordinates.
     */
    build_slice(cx: number, sy: number, cz: number, biome_blend_radius: number): SliceData;
    chunk_biomes(cx: number, cz: number): Uint32Array;
    chunk_count(): number;
    clear(): void;
    end_batch(): void;
    get_biome(x: number, z: number, y: number): number;
    get_block_light(x: number, y: number, z: number): number;
    get_sky_light(x: number, y: number, z: number): number;
    get_state(x: number, y: number, z: number): number;
    has_sky(): boolean;
    height_map(cx: number, cz: number): Uint8Array;
    is_loaded(cx: number, cz: number): boolean;
    last_dirty(): Int32Array;
    /**
     * `World.loadChunk` for the 1.9+/1.13 chunk-data packet. Returns bytes consumed.
     */
    load_chunk_113(cx: number, cz: number, ground_up: boolean, bit_map: number, data: Uint8Array, offset: number, sky_light: boolean): number;
    /**
     * `opacity[state]` = 0..15 (15 = fully opaque); `emit[state]` = 0..15.
     */
    constructor(opacity: Uint8Array, emit: Uint8Array);
    section_block_light(cx: number, sy: number, cz: number): Uint8Array;
    section_blocks(cx: number, sy: number, cz: number): Uint32Array;
    section_sky_light(cx: number, sy: number, cz: number): Uint8Array;
    set_has_sky(has_sky: boolean): void;
    set_state(x: number, y: number, z: number, state: number): boolean;
    unload_chunk(cx: number, cz: number): void;
}

export class WorldUpdateResult {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    rain_strength: number;
    raining: boolean;
    thunder_strength: number;
    thundering: boolean;
    world_border_radius: number;
    world_border_x: number;
    world_border_z: number;
}

/**
 * World view trait for bed validation (minimal interface).
 */
export class WorldView {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Get block state at position (to be implemented by JS side).
     */
    get_state(_x: number, _y: number, _z: number): number;
    constructor();
}

export class ZipArchive {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    entry_count(): number;
    has(name: string): boolean;
    list(prefix: string): string[];
    read(name: string): Uint8Array | undefined;
    read_text(name: string): string | undefined;
    /**
     * Some packs wrap everything in one top-level folder; find the one that
     * contains pack.mcmeta (same rule as ZipArchive.rootPrefix).
     */
    root_prefix(): string;
}

export function active_glsl_wasm(source: string, definitions_json: string): string;

export function add_coord_wasm(bb: Float64Array, x: number, y: number, z: number): Float64Array;

/**
 * Add to a statistic (for incrementing).
 */
export function add_statistic(stats_json: string, name: string, delta: bigint): string;

export function animate_biped_model(model_json: string, args_json: string): string;

export function animate_quadruped_model(model_json: string, args_json: string): string;

export function animate_skeleton_model(model_json: string, args_json: string): string;

export function animate_zombie_model(model_json: string, args_json: string): string;

export function animation_lookup_wasm(rules_json: string, states_json: string): string;

/**
 * Apply fox flags to a JSON entity object (standalone, matches `applyFoxFlags(e, flags)`).
 */
export function apply_fox_flags(entity_json: string, flags: number): string;

/**
 * Apply entity metadata from wire format to entity state.
 * This is a simplified version - the full logic is in entities.js _applyMeta.
 */
export function apply_metadata(entity_json: string, metadata_json: string): string;

/**
 * Rider yaw adjustment
 */
export function apply_to_rider(rider_yaw: number, delta_rotation: number, yaw: number): number;

/**
 * Composites banner layers into a single texture (algorithm port from composeBanner).
 *
 * This is the CPU-side compositing that the JS does with canvas.
 * Input: base texture (RGBA), pattern masks (RGBA), layers (pattern + color)
 * Output: Composite RGBA texture data, or empty vec on failure
 */
export function banner_composite(base_texture: Uint8Array, base_width: number, base_height: number, pattern_masks: Uint8Array, pattern_width: number, pattern_height: number, layers: Uint8Array): Uint8Array;

/**
 * Get all available pattern names.
 */
export function banner_pattern_names(): string[];

/**
 * Generate UV coordinates for a banner pattern.
 * Returns [u0, v0, u1, v1] as f32 array, or empty vec if pattern not found.
 */
export function banner_pattern_uv(pattern_name: string, _layer: number): Float32Array;

/**
 * Generate vertices for banner rendering (pattern layering).
 *
 * Input: `patterns` is a flat array of [pattern_code_len, pattern_code_bytes..., color, ...] terminated by 0xFF
 *        `base_color` is the base dye color (0-15)
 * Returns: Flat array of vertices [x, y, z, u, v, r, g, b, a, ...] or empty vec on failure
 */
export function banner_vertices(patterns: Uint8Array, base_color: number): Float32Array;

export function base_fog_color_wasm(angle: number): Float64Array;

/**
 * Get the sound event name for a `BeeSoundEvent`.
 */
export function bee_sound_event_name(event: BeeSoundEvent): string;

/**
 * Convenience: compute the sound name for a given loop variant.
 */
export function bee_sound_loop_name(loop_: BeeSoundLoop): string;

/**
 * Compute sound parameters for the current bee state.
 * Port of `beeSoundParameters(e)`.
 * Returns `BeeSoundOutput` with volume and pitch, or volume=0/pitch=0 for silence.
 */
export function bee_sound_parameters(params: BeeSoundParams): BeeSoundOutput;

/**
 * Stop the bee sound: clear token and name.
 * Port of `stopBeeSound(e)`.
 */
export function bee_sound_stop(params: BeeSoundParams): void;

/**
 * Main tick function: compute what the sound system should do this frame.
 * Port of `tickBeeSound(manager, e)`.
 *
 * The JS version handles async sound loading and token validation.
 * This pure version returns the desired state; the JS layer handles
 * the actual `playLoop` call and promise resolution.
 */
export function bee_sound_tick(params: BeeSoundParams): BeeSoundTickResult;

/**
 * Trigger a one-shot bee sound event.
 * Returns the sound name to play, or empty string if invalid.
 */
export function bee_sound_trigger(event: BeeSoundEvent, _x: number, _y: number, _z: number): string;

export function biome_rain_type(precipitation: string, temperature: number, rainfall: number, y: number): string;

/**
 * Boat status check
 */
export function boat_status(underwater: string, check_in_water: boolean, boat_glide: number): string;

export function boot_launch_action(connect?: string | null, user?: string | null): string;

export function boot_step_count(): number;

export function boot_step_label(index: number): string | undefined;

/**
 * Bake a complete box model (hierarchy of parts) to vertex data.
 * `model_json` is a JSON string representing the model hierarchy.
 * `reg` is the block registry for culling context.
 * `block_state` is the block state ID for culling context (0 for entities).
 * Returns a JSON string with vertices and metadata, or "null" on failure.
 */
export function boxmodel_bake(model_json: string, reg: BlockRegistryCore, block_state: number): string;

/**
 * Transform a part's boxes by its pivot and rotation (for JS-side scene graph).
 * Returns a JSON string with transformed boxes.
 */
export function boxmodel_transform_part(part_json: string): string;

export function brightness_table_wasm(dimension: number): Float64Array;

/**
 * JS keydown blocking as a WASM kernel.
 */
export function browser_key_prevent_default(code: string, ctrl: boolean): boolean;

/**
 * JS `_resize()` math as a WASM kernel: returns
 * `[dpr, cssWidth, cssHeight, width, height, pxScale]` for the no-device path
 * (`pxScale = canvas.width / cw`; with a device the caller substitutes the
 * device's own `canvas.width`).
 */
export function browser_potato_layout(inner_width: number, inner_height: number, dpr: number, potato: boolean): Float64Array;

/**
 * JS wheel normalization as a WASM kernel (0 models the suppressed emit).
 */
export function browser_wheel_delta(delta_y: number, delta_mode: number): number;

export function build_star_positions_wasm(): Float64Array;

/**
 * `Entity.calculateXOffset`‑style sweep clamp on the X axis.
 */
export function calc_x_offset(box_: Float64Array, bb: Float64Array, offset: number): number;

/**
 * `Entity.calculateYOffset`‑style sweep clamp on the Y axis.
 */
export function calc_y_offset(box_: Float64Array, bb: Float64Array, offset: number): number;

/**
 * `Entity.calculateZOffset`‑style sweep clamp on the Z axis.
 */
export function calc_z_offset(box_: Float64Array, bb: Float64Array, offset: number): number;

export function calculate_attribute_value(base: number, modifiers: any): number;

/**
 * Calculate regional difficulty based on:
 * - Base difficulty setting
 * - World time (longer worlds = harder)
 * - Chunk inhabited time (longer inhabited = harder)
 * - Moon phase (full moon = harder)
 */
export function calculate_regional_difficulty(difficulty: number, world_time: bigint, inhabited_time: bigint, moon_phase: number): number;

/**
 * Calculate sleeping camera position (ported from JS sleepingCamera).
 */
export function calculate_sleeping_camera(game_sleeping: boolean, camera_entity: boolean, debug_cam: boolean, third_person: number, player: SleepState, bed_facing: BedFacing | null | undefined, camera_eye_height: number | null | undefined, partial_tick: number): SleepCamera | undefined;

/**
 * Calculate the wake-up time when sleeping.
 * Returns the target world time to wake up at.
 */
export function calculate_wake_time(current_time: bigint): bigint;

/**
 * Check if enough players are sleeping to skip night.
 * Vanilla requires > 50% of players in the overworld to be sleeping.
 */
export function can_skip_night(total_players: number, sleeping_players: number): boolean;

/**
 * Check if players can sleep (night time in overworld)
 */
export function can_sleep(time_of_day: bigint, dimension: number): boolean;

export function celestial_angle_wasm(world_time: number, partial: number): number;

/**
 * Advancement checking. Input/output are JSON objects keyed by advancement id.
 */
export function check_advancements(advancements_json: string, criteria_json: string): string;

/**
 * Clear all recipes
 */
export function clear_recipes(recipe_book: RecipeBookState): void;

export function cloud_color_wasm(angle: number, rain: number, thunder: number): Float64Array;

/**
 * Allocation-free convenience wrapper for the JS glue.
 */
export function compute_visibility_mask(states: Uint16Array, state_flags: Uint8Array, fancy_leaves: boolean): Uint8Array;

export function container_armor_points(item_json: string, registry_json: string): number;

export function container_armor_type(item_json: string, registry_json: string): number;

/**
 * `Inventory.addToInventory(item)`; returns the mutated inventory + item state.
 */
export function container_full_add_to_inventory(main_json: string, item_json: string, max_stack: number): string;

/**
 * `armorPoints` over the four armor slots (boots, legs, chest, helmet).
 */
export function container_full_armor_points(armor_json: string, registry_json: string): number;

/**
 * `armorType`, registry supplied as a JSON map (or `"null"`).
 */
export function container_full_armor_type(item_json: string, registry_json: string): number;

/**
 * `Inventory._buildSlots` as JSON.
 */
export function container_full_build_inventory_slots(): string;

/**
 * `ContainerWindow._buildSlots` as JSON.
 */
export function container_full_build_window_slots(ctype: string, size: number): string;

export function container_full_can_hold_potion(item_json: string, registry_json: string): boolean;

/**
 * `ContainerWindow._configureSlot` rules for one slot, as JSON.
 */
export function container_full_configure_slot(ctype: string, i: number): string;

/**
 * `consumeGrid(container, from, to)` — the slot range that is decremented.
 */
export function container_full_consume_grid(from: number, to: number): Int32Array;

/**
 * `ItemStack.copy`.
 */
export function container_full_copy(item_json: string): string;

/**
 * `Inventory.firstEmpty` for a JSON array of the 36 main slots.
 */
export function container_full_first_empty(main_json: string): number;

/**
 * `Inventory.transferStackInSlot` routing for one slot, as JSON.
 */
export function container_full_inventory_transfer_plan(i: number): string;

export function container_full_is_beacon_payment(name: string): boolean;

export function container_full_is_brewing_ingredient(name: string): boolean;

export function container_full_is_chest_type(name: string): boolean;

export function container_full_is_fuel(name: string): boolean;

export function container_full_is_horse_armor(name: string): boolean;

export function container_full_is_smelatable(name: string): boolean;

/**
 * `itemName(item, registry)` with the `minecraft:` prefix stripped.
 */
export function container_full_item_name(item_json: string, registry_json: string): string;

/**
 * `ContainerBase.mergeItemStack(stack, start, end, reverse)` over a main
 * inventory, for the shift-click routing tests.
 */
export function container_full_merge_item_stack(state_json: string, start: number, end: number, reverse: boolean): string;

/**
 * `nbtEqual(a, b)`.
 */
export function container_full_nbt_equal(a_json: string, b_json: string): boolean;

/**
 * `Inventory.nextAction` — the 15-bit wrapping action counter.
 */
export function container_full_next_action(counter: number): number;

/**
 * `ContainerWindow.onClose` — the container slots cleared on close.
 */
export function container_full_on_close_indices(ctype: string): Int32Array;

/**
 * `ContainerWindow.onPickupFromSlot(i, taken)`: output-slot consumption and
 * result re-offer for the workstation containers.
 */
export function container_full_on_pickup_from_slot(state_json: string, i: number, taken_json: string): string;

/**
 * `ContainerWindow.onSlotChanged(i)` prediction hook: recomputes the crafting
 * result from the 3x3 grid using the recipe table in `model.craftRecipes`.
 */
export function container_full_on_slot_changed(state_json: string, i: number): string;

/**
 * `ContainerWindow.decr` result-slot override.
 */
export function container_full_result_slot_takes_all(ctype: string, is_output: boolean): boolean;

/**
 * Faithful port of `ContainerBase.slotClick(slotId, button, mode)`.
 *
 * `state_json` is the model described in the module docs; the returned string is
 * the same model with `result` (vanilla's "clicked item") and `lastClick`
 * added. `clicked` is the item vanilla would have sent to the server, which the
 * JS `click()` wrapper still has to packetise.
 */
export function container_full_slot_click(state_json: string, slot_id: number, button: number, mode: number): string;

/**
 * `stackable(a, b)`.
 */
export function container_full_stackable(a_json: string, b_json: string): boolean;

/**
 * `ContainerWindow.transferStackInSlot` routing for one slot, as JSON.
 */
export function container_full_transfer_plan(ctype: string, i: number, size: number, total: number, item_name: string): string;

/**
 * `ContainerWindow` slot count after the fixed-size table is applied.
 */
export function container_full_window_size(ctype: string, slot_count: number): number;

export function container_is_beacon_payment(name: string): boolean;

export function container_is_brewing_ingredient(name: string): boolean;

export function container_is_fuel(name: string): boolean;

export function container_is_horse_armor(name: string): boolean;

export function container_is_smelatable(name: string): boolean;

export function container_item_wasm(item_id: number, count: number, damage: number): string;

export function container_slot_click(slot_id: number, button: number, mode: number, inventory_json: string, items_registry_json: string): string;

/**
 * Version of the ported core, shown by the WASM self-test.
 */
export function core_version(): string;

/**
 * `Section.recount()`: number of non-air cells.
 *
 * The JS original used `AIR_STATES_498.includes()` for every cell; the air
 * list is passed in so the registry stays in JavaScript.
 */
export function count_non_air(blocks: Uint32Array, air_states: Uint32Array): number;

/**
 * Create an arm animation packet
 */
export function create_arm_animation_packet(hand: number | null | undefined, protocol_version: number): Uint8Array;

/**
 * Create a block dig packet
 */
export function create_block_dig_packet(status: number, x: number, y: number, z: number, face: number, protocol_version: number): Uint8Array;

/**
 * Create a block place packet
 */
export function create_block_place_packet(hand: number, x: number, y: number, z: number, face: number, cursor_x: number, cursor_y: number, cursor_z: number, inside_block: boolean, protocol_version: number): Uint8Array;

/**
 * Create a chat message packet
 */
export function create_chat_packet(message: string, protocol_version: number): Uint8Array;

/**
 * Create a client command packet
 */
export function create_client_command_packet(action: number, protocol_version: number): Uint8Array;

/**
 * Create a close window packet
 */
export function create_close_window_packet(window_id: number, protocol_version: number): Uint8Array;

/**
 * Create a custom payload packet
 */
export function create_custom_payload_packet(channel: string, data: Uint8Array, protocol_version: number): Uint8Array;

/**
 * Create an entity action packet
 */
export function create_entity_action_packet(eid: number, action: number, jump_boost: number, protocol_version: number): Uint8Array;

/**
 * Create a flying packet (position + look)
 */
export function create_flying_packet(on_ground: boolean, protocol_version: number): Uint8Array;

/**
 * Create a held item slot packet
 */
export function create_held_item_slot_packet(slot: number, protocol_version: number): Uint8Array;

/**
 * Create a keep alive packet
 */
export function create_keep_alive_packet(keep_alive_id: bigint, protocol_version: number): Uint8Array;

/**
 * Create a look packet
 */
export function create_look_packet(yaw: number, pitch: number, on_ground: boolean, protocol_version: number): Uint8Array;

/**
 * Create a name item packet
 */
export function create_name_item_packet(name: string, protocol_version: number): Uint8Array;

/**
 * Create a place recipe packet
 */
export function create_place_recipe_packet(window_id: number, recipe: string, all: boolean, protocol_version: number): Uint8Array;

/**
 * Create a position + look packet
 */
export function create_position_look_packet(x: number, y: number, z: number, yaw: number, pitch: number, on_ground: boolean, protocol_version: number): Uint8Array;

/**
 * Create a position packet
 */
export function create_position_packet(x: number, y: number, z: number, on_ground: boolean, protocol_version: number): Uint8Array;

/**
 * Create a recipe info settings packet
 */
export function create_recipe_info_settings_packet(open: boolean, filtering: boolean, smelting_open: boolean, smelting_filtering: boolean, blasting_open: boolean, blasting_filtering: boolean, smoking_open: boolean, smoking_filtering: boolean, protocol_version: number): Uint8Array;

/**
 * Create a recipe info shown packet
 */
export function create_recipe_info_shown_packet(recipe: string, protocol_version: number): Uint8Array;

/**
 * Create a resource pack status packet
 */
export function create_resource_pack_status_packet(result: number, protocol_version: number): Uint8Array;

/**
 * Create a seen advancements packet
 */
export function create_seen_advancements_packet(tab: string | null | undefined, protocol_version: number): Uint8Array;

/**
 * Create a select trade packet
 */
export function create_select_trade_packet(index: number, protocol_version: number): Uint8Array;

/**
 * Create a set beacon effects packet
 */
export function create_set_beacon_effects_packet(primary: number, secondary: number, protocol_version: number): Uint8Array;

/**
 * Create a settings packet
 */
export function create_settings_packet(locale: string, view_distance: number, chat_flags: number, chat_colors: boolean, skin_parts: number, main_hand: number, protocol_version: number): Uint8Array;

/**
 * Create a spectate packet
 */
export function create_spectate_packet(uuid: string, protocol_version: number): Uint8Array;

/**
 * Create a steer vehicle packet
 */
export function create_steer_vehicle_packet(sideways: number, forward: number, flags: number, protocol_version: number): Uint8Array;

/**
 * Create a tab complete packet
 */
export function create_tab_complete_packet(text: string, transaction_id: number, protocol_version: number): Uint8Array;

/**
 * Create a teleport confirm packet
 */
export function create_teleport_confirm_packet(id: number, protocol_version: number): Uint8Array;

/**
 * Create a transaction packet
 */
export function create_transaction_packet(window_id: number, action: number, accepted: boolean, protocol_version: number): Uint8Array;

/**
 * Create a use entity packet
 */
export function create_use_entity_packet(target: number, mouse: number, x: number | null | undefined, y: number | null | undefined, z: number | null | undefined, hand: number | null | undefined, protocol_version: number): Uint8Array;

/**
 * Create a use item packet
 */
export function create_use_item_packet(hand: number | null | undefined, protocol_version: number): Uint8Array;

/**
 * `crystalBeam(start, end, age)` - RenderDragon's octagonal taper.
 * Black at the dragon (start) and white at the crystal (end).
 *
 * Returns a `Vec<f32>` with stride 9 (x, y, z, u, v, r, g, b, a) for each vertex.
 * The vertices form quads (4 vertices per face, 8 faces = 32 vertices).
 */
export function crystal_beam(start: Float32Array, end: Float32Array, age: number): Float32Array;

/**
 * Crystal bob animation: `crystalBob(age)`.
 * Returns the vertical offset for the end crystal beam endpoint.
 */
export function crystal_bob(age: number): number;

/**
 * Calculate wake-up time when sleeping
 */
export function day_cycle_calculate_wake_time(current_time: bigint): bigint;

/**
 * Get celestial angle (0.0 = noon, 0.5 = midnight)
 * Ported from sky.js celestialAngle function
 */
export function day_cycle_celestial_angle(world_time: bigint, partial: number): number;

/**
 * Generate vertices for multiple line segments at once (batch API).
 *
 * # Arguments
 * * `lines` - Flat array of [x0, y0, z0, x1, y1, z1, r, g, b, a, ...] per segment.
 *             Length must be a multiple of 10 (or 9 with implicit alpha=1).
 *             If 9 floats per segment, alpha defaults to 1.0.
 *
 * Returns a Float32Array with all vertices or null on failure.
 */
export function debug_lines_batch(lines: Float32Array): Float32Array | undefined;

/**
 * Generate vertices for an axis-aligned box outline (12 edges, 24 vertices).
 *
 * # Arguments
 * * `min`   - [x, y, z] minimum corner
 * * `max`   - [x, y, z] maximum corner
 * * `color` - [r, g, b, a] color (alpha defaults to 1.0)
 *
 * Returns a Float32Array with 216 floats (24 vertices × 9 floats) or null on failure.
 */
export function debug_lines_box(min: Float32Array, max: Float32Array, color: Float32Array): Float32Array | undefined;

/**
 * Generate chunk border debug lines (port of `_chunkBorders`).
 *
 * # Arguments
 * * `player_x` - Player X position
 * * `player_z` - Player Z position
 * * `max_y`    - Maximum Y for vertical lines (default 256)
 *
 * Returns a Float32Array with all chunk border vertices or null on failure.
 */
export function debug_lines_chunk_borders(player_x: number, player_z: number, max_y: number): Float32Array | undefined;

/**
 * Generate hitbox debug lines for an entity (port of the hitbox rendering in `update`).
 *
 * # Arguments
 * * `x, y, z`      - Entity position (interpolated)
 * * `width`        - Entity width
 * * `height`       - Entity height
 * * `eye_height`   - Entity eye height (optional, defaults to height * 0.85)
 * * `yaw`          - Head yaw in degrees (optional)
 * * `pitch`        - Head pitch in degrees (optional)
 * * `show_eyes`    - Whether to render eye height box and look vector
 *
 * Returns a Float32Array with hitbox vertices or null on failure.
 */
export function debug_lines_entity_hitbox(x: number, y: number, z: number, width: number, height: number, eye_height: number | null | undefined, yaw: number | null | undefined, pitch: number | null | undefined, show_eyes: boolean): Float32Array | undefined;

/**
 * Generate vertices for a single line segment.
 *
 * # Arguments
 * * `start` - [x, y, z] start point
 * * `end`   - [x, y, z] end point
 * * `color` - [r, g, b, a] color (alpha defaults to 1.0)
 *
 * Returns a Float32Array with 18 floats (2 vertices × 9 floats) or null on failure.
 */
export function debug_lines_line(start: Float32Array, end: Float32Array, color: Float32Array): Float32Array | undefined;

export function decode_base64(value: string): Uint8Array;

/**
 * Decode `text` to exactly `length` bytes. Returns `None` for malformed data,
 * an invalid length, or a word above 32 bits.
 */
export function decode_base85(text: string, length: number): Uint8Array | undefined;

/**
 * Decode a 1.14.4 (protocol 498) chunk column. `None` on any validation error.
 */
export function decode_chunk_498(data: Uint8Array, bit_map: number, state_count: number, ground_up: boolean): ChunkColumn | undefined;

/**
 * Decode a 1.15.2 (protocol 578) chunk column. Biomes live on the packet and
 * are not part of `data`.
 */
export function decode_chunk_578(data: Uint8Array, bit_map: number, state_count: number): ChunkColumn | undefined;

/**
 * Decode entity metadata from a packet buffer.
 * Returns a Map of index -> Value (matching the JS wire format).
 */
export function decode_entity_metadata(data: Uint8Array): string;

/**
 * Wasm boundary: the decoded packet object as JSON (the JS callers consume a
 * plain object; `crate::recipes` established the JSON-string convention).
 */
export function decode_packet_498_json(bytes: Uint8Array): string;

/**
 * Wasm boundary: the decoded 578 packet object as JSON.
 */
export function decode_packet_578_json(bytes: Uint8Array): string;

/**
 * Decode a PNG into RGBA. Returns `None` for malformed or unsupported data,
 * in which case the JavaScript caller uses its own decoder.
 */
export function decode_png(bytes: Uint8Array): PngImage | undefined;

/**
 * Decode the block states of one chunk section (1.9+ `ChunkSection`).
 *
 * This is the inner loop of `Chunk.load`: a palette bit width, an optional
 * local palette (for widths <= 8), the packed big-endian longs, and the
 * per-cell unpacking. It returns the number of input bytes consumed (the
 * caller then reads the two 2048-byte light arrays), or 0 when the input is
 * malformed so the JavaScript caller can fall back.
 *
 * `out` must be the section's `Uint32Array(4096)`.
 */
export function decode_section(data: Uint8Array, out: Uint32Array): number;

/**
 * Decode a slot from bytes
 */
export function decode_slot(bytes: Uint8Array): any | undefined;

/**
 * Decode a slice of a byte array, mirroring `decodeUtf8(bytes, start, end)`.
 */
export function decode_utf8(bytes: Uint8Array, start: number, end: number): string;

/**
 * Check if a difficulty allows hostile spawns
 */
export function difficulty_allows_hostile_spawns(difficulty: number): boolean;

/**
 * Get spawn probability multiplier for difficulty
 */
export function difficulty_spawn_multiplier(difficulty: number): number;

export function door_props_wasm(reg: BlockRegistryCore, state: number, below: number, above: number): string;

/**
 * `dragonCorpseMatrix(e, partial)` - Calculate the corpse transformation matrix.
 * `ring` should be a slice of f64 pairs [yaw, y] of length 128 (64 entries).
 */
export function dragon_corpse_matrix(yaw: number, y: number, ring: Float64Array, ring_idx: number, dead: boolean, partial: number): Float32Array;

/**
 * `dragonDeathRays(e, partial)` - Ender dragon death ray geometry.
 * `ring` should be a slice of f64 pairs [yaw, y] of length 128 (64 entries).
 *
 * Returns a `Vec<f32>` with stride 9 (x, y, z, u, v, r, g, b, a).
 */
export function dragon_death_rays(x: number, y: number, z: number, yaw: number, death_time: number, ring: Float64Array, ring_idx: number, dead: boolean, partial: number): Float32Array;

/**
 * Ender dragon part hitboxes (returns array of [id, name_idx, x, y, z, width, height]).
 */
export function dragon_parts(entity_id: number, x: number, y: number, z: number, yaw: number, ring: Float64Array, ring_idx: number, dead: boolean, _anim_time: number, _prev_anim_time: number): Float64Array;

/**
 * Get the dye color RGB value for a color index (0-15).
 */
export function dye_color_rgb(color_index: number): number;

export function encode_base64(bytes: Uint8Array): string;

/**
 * Encode 8-bit RGBA pixels as a PNG (filter 0 on every row).
 */
export function encode_png(width: number, height: number, rgba: Uint8Array): Uint8Array | undefined;

/**
 * Encode a slot (item) - simplified version
 */
export function encode_slot(item_id: number, count: number, nbt_data?: Uint8Array | null): Uint8Array;

/**
 * Encode a string as UTF-8. Rust strings cannot contain lone surrogates, so
 * this is the standard UTF-8 encoding the JS `encodeUtf8` produces for every
 * well-formed JS string.
 */
export function encode_utf8(value: string): Uint8Array;

/**
 * Generate entity effect particles for a given effect type.
 * This is a higher-level helper that creates particle data for JS rendering.
 *
 * Returns a JSON string containing particle data, or empty string on failure.
 */
export function entity_effect_particles(entity_x: number, entity_y: number, entity_z: number, entity_width: number, entity_height: number, effect_type: EntityEffectType, amplifier: number, age: number, rng_seed?: bigint | null): string;

/**
 * Generate fire geometry for a list of entities.
 *
 * This is the main WASM export that replaces `EntityFire.update`.
 *
 * Parameters:
 * - `entities_json`: JSON array of FireEntity objects
 * - `view_yaw`: Camera yaw in degrees (player view Y rotation)
 * - `fire0_u0, fire0_v0, fire0_u1, fire0_v1`: UV for block/fire_0
 * - `fire1_u0, fire1_v0, fire1_u1, fire1_v1`: UV for block/fire_1
 * - `ticks`: Game ticks (used for potential future animation)
 *
 * Returns FireGeometryResult with vertices and count, or an empty result on failure.
 */
export function entity_fire_geometry(entities_json: string, view_yaw: number, fire0_u0: number, fire0_v0: number, fire0_u1: number, fire0_v1: number, fire1_u0: number, fire1_v0: number, fire1_u1: number, fire1_v1: number, _ticks: number): FireGeometryResult;

/**
 * Calculate glowing effect outline vertices for an entity.
 * Returns a JSON string with vertex data for rendering the glowing outline,
 * or empty string on failure.
 *
 * The glowing effect renders as a slightly scaled version of the entity model
 * with a pulsing outline color. This function generates the vertex positions
 * for a simple box outline around the entity bounds.
 */
export function entity_glow_vertices(entity_x: number, entity_y: number, entity_z: number, entity_width: number, entity_height: number, entity_eye_height: number, age: number): string;

/**
 * Check if an entity should render fire (ported from `EntityFire.burning`).
 */
export function entity_should_burn(entity: FireEntity): boolean;

/**
 * Attempt to place the falling block at the given position.
 *
 * Returns `true` if placement succeeded (block was air/replaceable),
 * `false` if the position is occupied by a non-replaceable block.
 */
export function falling_block_land(world: WorldCore, registry: BlockRegistryCore, x: number, y: number, z: number, block_state: number): boolean;

/**
 * Core falling-block physics step without entity state mutation.
 *
 * Given a position, motion, and world, returns the new position, new motion,
 * and whether the block landed.
 *
 * This is the pure function form used for server-side simulation or testing.
 */
export function falling_block_physics(x: number, y: number, z: number, motion_x: number, motion_y: number, motion_z: number, block_state: number, no_gravity: boolean, world: WorldCore, registry: BlockRegistryCore): Float64Array;

/**
 * `MathHelper.fastInvSqrt`: double bit trick plus one Newton step.
 */
export function fast_inv_sqrt(value: number): number;

export function fast_inv_sqrt_wasm(value: number): number;

/**
 * Generate fire overlay geometry (ported from `fireOverlayVertices`).
 *
 * Parameters:
 * - `fire0_u0, fire0_v0, fire0_u1, fire0_v1`: UV for block/fire_0 texture (top-left, bottom-right)
 * - `fire1_u0, fire1_v0, fire1_u1, fire1_v1`: UV for block/fire_1 texture (top-left, bottom-right)
 * - `ticks`: Game ticks (used for frame animation selection between fire_0 and fire_1)
 *
 * The JS alternates between fire_0 and fire_1 every tick. This function
 * generates geometry for both planes using the provided UVs, and the caller
 * can select which texture to bind per frame based on ticks.
 *
 * Returns FireOverlayGeometryResult with vertices, or an empty result on failure.
 */
export function fire_overlay_geometry(fire0_u0: number, fire0_v0: number, fire0_u1: number, fire0_v1: number, fire1_u0: number, fire1_v0: number, fire1_u1: number, fire1_v1: number, _ticks: number): FireOverlayGeometryResult;

/**
 * Generate fire overlay projection matrix (ported from `fireOverlayProjection`).
 *
 * Parameters:
 * - `width`: Viewport width
 * - `height`: Viewport height
 *
 * Returns a column-major 4x4 matrix (16 floats) as Vec<f32>,
 * or an empty Vec on failure (for JS fallback).
 *
 * The JS logic:
 * 1. Creates orthographic projection: mat4.ortho(0, width, height, 0, -400000, 400000)
 * 2. Inverts it
 * 3. Multiplies with perspective: mat4.perspective(70° FOV, width/height, 0.05, 10)
 */
export function fire_overlay_projection(width: number, height: number): Float32Array;

/**
 * JS: `const fishPattern = e => Math.min(5, ((e.fishVariant || 0) >>> 8) & 255) + 1;`
 * (`>>>` is an unsigned shift, so the variant is treated as u32 here.)
 */
export function fish_pattern(fish_variant: number): number;

/**
 * JS: `const fishShape = e => ((e.fishVariant || 0) & 255) === 1 ? 1 : 0;`
 */
export function fish_shape(fish_variant: number): number;

/**
 * `fluidHeightAt` after the caller has looked up the cell above.
 */
export function fluid_height(above_same_fluid: boolean, height: number): number;

/**
 * `getFluidState` with the block registry facts passed in explicitly.
 */
export function fluid_state(is_liquid: boolean, is_lava: boolean, level: number, waterlogged: boolean, is_water_plant: boolean): FluidState | undefined;

export function foliage_color(name: string, temperature: number, rainfall: number, y: number, map: Uint8Array): number;

/**
 * `formatAddress(host, port)`.
 */
export function format_address(host: string, port?: number | null): string;

/**
 * Fox AI tick - main behavior update.
 * Returns FoxAITickResult with new behavior state and target.
 */
export function fox_ai_tick(fox_state: FoxState, fox_x: number, _fox_y: number, fox_z: number, _on_ground: boolean, time_of_day: number, sky_light: number, block_light: number, is_raining: boolean, prey_entities: Float64Array, predator_entities: Float64Array, player_entities: Float64Array, food_items: Float64Array, breeding_partners: Float64Array): FoxAITickResult;

/**
 * Get fox animation args from a JSON entity object (standalone, matches `foxAnimationArgs(e, partial)`).
 */
export function fox_animation_args(entity_json: string, partial: number): string;

/**
 * Check if fox can breed with another fox.
 * Returns true if breeding conditions met.
 */
export function fox_can_breed(fox_age: number, partner_age: number, fox_has_food: boolean, partner_has_food: boolean, distance_sq: number, both_trust_player: boolean): boolean;

/**
 * Check if fox can navigate to position (simplified pathfind check).
 * Returns true if path seems clear.
 */
export function fox_can_navigate(start_x: number, start_y: number, start_z: number, target_x: number, target_y: number, target_z: number): boolean;

/**
 * Calculate flee velocity from a threat.
 * Returns [motion_x, motion_y, motion_z].
 */
export function fox_flee(fox_x: number, _fox_y: number, fox_z: number, threat_x: number, _threat_y: number, threat_z: number, speed: number): Float64Array;

/**
 * Check if fox is holding an item in its mouth.
 * Returns item ID or -1 if not holding.
 */
export function fox_held_item(entity_json: string): number;

/**
 * Calculate movement vector towards a target.
 * Returns [move_x, move_z] normalized * speed.
 */
export function fox_move_towards(fox_x: number, fox_z: number, target_x: number, target_z: number, speed: number): Float64Array;

/**
 * `animateFox`: 33 values in a fixed order — body(rx,ry,py,pz,rz),
 * tail(rx,pz), head(rx,ry,rz,px,py,pz), then legs rightHind, leftHind,
 * rightFront, leftFront with (rx,rz,py,pz,visible).
 */
export function fox_pose(ls: number, lsa: number, head_roll: number, crouching: boolean, crouch_amount: number, sleeping: boolean, child: boolean, sitting: boolean, pitch: number, yaw: number, age: number, faceplanted: boolean): Float64Array;

/**
 * Calculate pounce velocity for fox hunting.
 * Returns [motion_x, motion_y, motion_z] or [0,0,0] if can't pounce.
 */
export function fox_pounce(fox_x: number, fox_y: number, fox_z: number, target_x: number, target_y: number, target_z: number, on_ground: boolean): Float64Array;

/**
 * `scaleFoxChild`: head scale/position and body scale/position.
 */
export function fox_scale(child: boolean): Float64Array;

/**
 * Select the best target for a fox based on its state and surroundings.
 * Returns a FoxTargetResult (valid=false if no target found - JS fallback).
 */
export function fox_select_target(fox_x: number, fox_y: number, fox_z: number, fox_state: FoxState, prey_entities: Float64Array, predator_entities: Float64Array, player_entities: Float64Array, food_items: Float64Array, breeding_partners: Float64Array): FoxTargetResult;

/**
 * Set item held by fox.
 */
export function fox_set_held_item(entity_json: string, item_id: number): string;

/**
 * Determine if fox should sleep based on time and conditions.
 * Returns true if fox should start sleeping.
 */
export function fox_should_sleep(time_of_day: number, _fox_y: number, sky_light: number, block_light: number, is_raining: boolean, has_predator_nearby: boolean, is_sitting: boolean): boolean;

/**
 * Determine if fox should wake up.
 * Returns true if fox should stop sleeping.
 */
export function fox_should_wake(time_of_day: number, sky_light: number, block_light: number, is_raining: boolean, has_predator_nearby: boolean, player_nearby: boolean, trusted_player_nearby: boolean): boolean;

/**
 * Determine if fox should play a sound this tick.
 * Returns the sound to play, or None.
 */
export function fox_sound_trigger(fox_state: FoxState, prev_state: FoxState, random: number): FoxSound;

/**
 * Update trust/owner system for fox.
 * Returns new trust UUID pair.
 */
export function fox_update_trust(current_trusted_0: bigint, current_trusted_1: bigint, player_uuid_0: bigint, player_uuid_1: bigint, player_fed_fox: boolean, player_attacked_fox: boolean): FoxTrustPair;

export function game_get_statistic(stats_json: string, name: string): bigint;

export function game_profiler_mark_end(profiler_json: string, section: string): string;

export function game_profiler_mark_start(profiler_json: string, section: string): string;

export function game_update_recipe_book(unlocked_json: string, highlighted_json: string): string;

/**
 * Statistics tracking (JSON maps cross the boundary as strings).
 */
export function game_update_statistic(stats_json: string, name: string, value: bigint): string;

/**
 * Get the bed facing direction from a block state.
 */
export function get_bed_facing(block_name: string, facing_prop: string): BedFacing | undefined;

export function get_block_light(light: Uint8Array, index: number): number;

/**
 * Get block model for a tile entity type.
 * Returns a JSON string representing the model parts, or "null" on failure.
 */
export function get_block_model_json(tile_type: string, props_json: string): string;

/**
 * Get day phase name
 */
export function get_day_phase(time_of_day: bigint): string;

/**
 * Get mob spawn cap for category
 */
export function get_mob_cap(category: string, difficulty: number, total_players: number): number;

/**
 * Helper to get packet ID by name for a given protocol version
 */
export function get_packet_id(name: string, protocol_version: number, clientbound: boolean): number | undefined;

/**
 * Helper to get packet name by ID for a given protocol version
 */
export function get_packet_name(id: number, protocol_version: number, clientbound: boolean): string | undefined;

/**
 * `Section.getSky(i)` (nibble order: low nibble is the even index).
 */
export function get_sky_light(light: Uint8Array, index: number): number;

/**
 * Get spawn weight for biome/mob combination
 */
export function get_spawn_weight(biome: string, mob_type: string): number;

/**
 * Get a statistic value.
 */
export function get_statistic(stats_json: string, name: string): bigint;

/**
 * Get recipe count
 */
export function get_unlocked_count(recipe_book: RecipeBookState): number;

export function glsl_condition_wasm(expression: string, macros_json: string): number;

export function glsl_float_literals_wasm(source: string): string;

export function grass_color(name: string, temperature: number, rainfall: number, y: number, map: Uint8Array): number;

/**
 * `guardianBeam(start, end, age, ticks, charge)` - Guardian laser beam.
 * Two rotating crossed planes plus alternating end cap.
 * Attack charge changes the beam colour.
 *
 * Returns a `Vec<f32>` with stride 9 (x, y, z, u, v, r, g, b, a).
 */
export function guardian_beam(start: Float32Array, end: Float32Array, age: number, ticks: number, charge: number): Float32Array;

/**
 * `hangingBox` for paintings: `[minX, minY, minZ, maxX, maxY, maxZ]`.
 */
export function hanging_box(hx: number, hy: number, hz: number, facing: number, w_px: number, h_px: number): Float64Array;

export function has_jar_model(name: string): boolean;

export function honey_fall_multiplier_wasm(block_name: string): number;

export function honey_jump_factor_wasm(block_name: string): number;

export function honey_movement_factor_wasm(block_name: string): number;

/**
 * Horse jump power calculation
 */
export function horse_jump_power(p: number): number;

export function interaction_block_break_progress(cur_damage: number, rel_hardness: number): number;

export function interaction_cooldown_period(attack_speed: number): number;

export function interaction_cooled_attack_strength(ticks: number, attack_speed: number, adjust: number): number;

/**
 * Entity interpolation: `interp(e, partial)` → `{x, y, z}`.
 */
export function interpolate_position(prev_x: number, prev_y: number, prev_z: number, x: number, y: number, z: number, partial: number): Float64Array;

/**
 * Check if it's day time (sun above horizon)
 */
export function is_day_time(time_of_day: bigint): boolean;

/**
 * Check if entity is an Ender Dragon (type 63, kind 'mob').
 */
export function is_dragon(kind: string, type_id: number): boolean;

export function is_eagler_address(text: string): boolean;

export function is_interactive_entity(kind: string, entity_name: string, held_item_name?: string | null): boolean;

export function is_lighting_option_wasm(name: string): boolean;

/**
 * Check if it's night time (hostile mobs can spawn)
 */
export function is_night_time(time_of_day: bigint): boolean;

/**
 * Check if recipe is highlighted (can be crafted)
 */
export function is_recipe_highlighted(recipe_book: RecipeBookState, recipe_id: string): boolean;

/**
 * Check if recipe is unlocked
 */
export function is_recipe_unlocked(recipe_book: RecipeBookState, recipe_id: string): boolean;

export function is_snap_kind(kind: string): boolean;

/**
 * Check if position is valid for spawning (solid block below, air above)
 */
export function is_valid_spawn_position(block_below_solid: boolean, block_at_air: boolean, block_above_air: boolean): boolean;

/**
 * `itemFrameBox` for item frames (6-direction facing).
 */
export function item_frame_box(x: number, y: number, z: number, face: number): Float64Array;

export function item_model_name_wasm(item: string, damage: number): string;

/**
 * JS: `CATEGORY_OF` (internal in JS, exported here for wasm glue).
 */
export function js_category_of(name: string): string;

export function js_clamp_pitch(pitch: number): number;

/**
 * JS: `EVENT_SOUNDS[effectId]` (internal in JS, exported here for wasm glue).
 */
export function js_event_sound(id: number): EventSoundInfo;

/**
 * JS: `GLOBAL_EVENTS[effectId]` (internal in JS, exported here for wasm glue).
 */
export function js_global_event_sound(id: number): string | undefined;

/**
 * JS: `HOSTILE_TYPES.has(name)` (internal in JS, exported here for wasm glue).
 */
export function js_is_hostile_type(name: string): boolean;

export function js_max_distance(volume: number): number;

export function js_mood_lcg_next(lcg: number): number;

export function js_options_default_key(binding: string): string;

export function js_options_difficulty_name(difficulty: number): string;

export function js_options_fov_label(value: number): string;

export function js_options_gamma_label(value: number): string;

export function js_options_key_binding_category(index: number): string;

export function js_options_key_binding_description(index: number): string;

export function js_options_mouse_wheel_label(value: number): string;

export function js_options_render_distance_label(value: number): string;

/**
 * JS: `export { soundAssetName, soundTypeOf }` (soundAssetName half, for wasm).
 */
export function js_sound_asset_name(name: string): string;

export function js_voice_volume(volume: number, def_volume: number, category_volume: number): number;

/**
 * JS: end-portal texgen exposed to JavaScript.
 */
export function js_webgpu_endportal_texgen(frag_x: number, frag_y: number, target_w: number, target_h: number, scale: number, angle: number, off_u: number, off_v: number): Float32Array;

/**
 * JS: entity shade term exposed to JavaScript.
 */
export function js_webgpu_entity_shade(nx: number, ny: number, nz: number, lighting: number): number;

/**
 * JS: WGSL `fogFactor` exposed to JavaScript.
 */
export function js_webgpu_fog_factor(d: number, fog: Float32Array): number;

/**
 * JS: WGSL `lightmap` lookup coordinates exposed to JavaScript.
 */
export function js_webgpu_lightmap_uv(sky: number, block: number): Float32Array;

/**
 * JS: `endFrame` readback bytes-per-row formula exposed to JavaScript.
 */
export function js_webgpu_readback_bytes_per_row(width: number): number;

/**
 * JS: terrain vertex decode exposed to JavaScript.
 */
export function js_webgpu_terrain_vertex_pos(x: number, y: number, z: number): Float32Array;

/**
 * `leashEndpoints`: returns `[startX, startY, startZ, endX, endY, endZ, height]`.
 */
export function leash_endpoints(mob_x: number, mob_y: number, mob_z: number, mob_prev_x: number, mob_prev_y: number, mob_prev_z: number, mob_width: number, mob_body_yaw: number, mob_prev_body_yaw: number, mob_height: number, holder_x: number, holder_y: number, holder_z: number, holder_prev_x: number, holder_prev_y: number, holder_prev_z: number, holder_yaw: number, holder_prev_yaw: number, holder_pitch: number, holder_prev_pitch: number, holder_eye_height: number, holder_is_leash: boolean, partial: number): Float64Array;

/**
 * `leashGeometry`: two crossed 24-segment strips, 8 floats per vertex.
 */
export function leash_geometry(start_x: number, start_y: number, start_z: number, end_x: number, end_y: number, end_z: number, height: number): Float32Array;

/**
 * Centre of the leash knot block position, as used by rope endpoints.
 */
export function leash_knot_center(bx: number, by: number, bz: number): Float64Array;

export function lighting_frame_wasm(colors_json: string, world_time: number, dimension: number, rain: number): string;

/**
 * `EntityLivingBase.onLivingUpdate` client-side parts: limb swing, cape, etc.
 * Returns [limb_swing, limb_swing_amount].
 */
export function living_update(_prev_limb_swing: number, _prev_limb_swing_amount: number, limb_swing: number, limb_swing_amount: number, on_ground: boolean, sprinting: boolean, speed: number): Float64Array;

/**
 * JS: `(bytes.length / 1024).toFixed(1)` — exposed for the JS glue's log line.
 */
export function loader_kib_label(bytes_len: number): string;

/**
 * JS: `export function wasmReady()` — host-facing ready query.
 */
export function loader_ready(ready: boolean): boolean;

export function loading_error_message(message: string): string;

export function lod_distance(distance?: number | null, chunks?: number | null): number;

export function look_vec_wasm(pitch: number, yaw: number): Float64Array;

export function map_apply_columns_wasm(colors: Uint8Array, x: number, y: number, columns: number, rows: number, data: Uint8Array): void;

export function mat4_invert(a: Float32Array): Float32Array | undefined;

export function mat4_multiply(a: Float32Array, b: Float32Array): Float32Array;

export function mat4_ortho(left: number, right: number, bottom: number, top: number, near: number, far: number): Float32Array;

export function mat4_perspective(fovy_radians: number, aspect: number, near: number, far: number): Float32Array;

export function mat4_rotate(a: Float32Array, radians: number, x: number, y: number, z: number): Float32Array;

export function mat4_scale(a: Float32Array, x: number, y: number, z: number): Float32Array;

export function mat4_transform_dir(m: Float32Array, x: number, y: number, z: number): Float32Array;

export function mat4_transform_point(m: Float32Array, x: number, y: number, z: number): Float32Array;

export function mat4_translate(a: Float32Array, x: number, y: number, z: number): Float32Array;

export function mc_cos_wasm(value: number): number;

export function mc_sin_wasm(value: number): number;

/**
 * JS: `const rand = (a, b) => ...` with the Math.random() draw supplied by the
 * caller (wasm-friendly form of [`music_rand`]).
 */
export function music_rand_with_draw(a: number, b: number, draw: number): number;

/**
 * JS: `SoundManager._musicType()` (internal in JS, exported here for wasm glue).
 */
export function music_type_for(is_credits: boolean, in_world: boolean, dimension: number, end_boss: boolean, creative_flight: boolean): MusicTrackInfo;

export function name_uuid(bytes: Uint8Array): string;

/**
 * Root tag name, or an empty string when the input is not valid NBT.
 */
export function nbt_root_name(bytes: Uint8Array): string;

/**
 * Parse and re-encode an NBT root. An empty result means the input was not
 * valid NBT (the JavaScript caller keeps its own parser for error messages).
 */
export function nbt_roundtrip(bytes: Uint8Array): Uint8Array;

/**
 * `simplify(readNbtRoot(bytes))` as JSON; `None` when the input is invalid.
 */
export function nbt_simplify_json(bytes: Uint8Array): string | undefined;

export function nbt_valid(bytes: Uint8Array): boolean;

/**
 * `animateOcelot`: 22 values — body(rx,py,pz), head(rx,ry,py,pz),
 * tail(rx,py,pz), tail2(rx,py,pz), then frontLeft, frontRight, backLeft,
 * backRight with (rx,py,pz).
 */
export function ocelot_pose(cat: boolean, pitch: number, yaw: number, sitting: boolean, ls: number, lsa: number): Float64Array;

export function offset_bb_wasm(bb: Float64Array, x: number, y: number, z: number): Float64Array;

export function pack_lighting_wasm(options_json: string, values_json: string): string;

/**
 * Deserialize a packet from bytes
 */
export function packet_deserialize(bytes: Uint8Array, protocol_version: number, clientbound: boolean): DecodedPacket;

export function packet_id_1152(name_value: string, clientbound: boolean): number | undefined;

export function packet_id_498(name_value: string, clientbound: boolean): number | undefined;

export function packet_id_578(name_value: string, clientbound: boolean): number | undefined;

export function packet_name_1152(id_value: number, clientbound: boolean): string | undefined;

export function packet_name_498(id_value: number, clientbound: boolean): string | undefined;

export function packet_name_578(id_value: number, clientbound: boolean): string | undefined;

/**
 * Serialize a packet by ID and data
 */
export function packet_serialize(packet_id: number, data: Uint8Array, protocol_version: number, clientbound: boolean): Uint8Array;

export function parse_address(text: string): string | undefined;

/**
 * Parse a `DeclareCommands` payload into the same shape as the JS parser.
 * Returns `None` on an unsupported parser, truncation, or a broken reference.
 */
export function parse_command_tree(data: Uint8Array): string | undefined;

/**
 * `parseProxyUrl`: returns a ws(s) URL, or `None`.
 */
export function parse_proxy_url(text: string): string | undefined;

/**
 * Parse a recipe array from a `DeclareRecipes` payload. `protocol` is 404,
 * 498 or 578; only 404 reorders the type/id pair.
 */
export function parse_recipes(data: Uint8Array, protocol: number): string | undefined;

/**
 * Parse SNBT into a `{ t, v }` tree as JSON. `None` for malformed input.
 */
export function parse_snbt(text: string): string | undefined;

export function particle_bubble(x: number, y: number, z: number, mx: number, my: number, mz: number, rng_seed?: bigint | null): string;

export function particle_campfire_smoke(x: number, y: number, z: number, signal: boolean, rng_seed?: bigint | null): string;

export function particle_crit(x: number, y: number, z: number, mx: number, my: number, mz: number, magic: boolean, rng_seed?: bigint | null): string;

export function particle_drip(x: number, y: number, z: number, lava: boolean, rng_seed?: bigint | null): string;

export function particle_enchant(x: number, y: number, z: number, mx: number, my: number, mz: number, rng_seed?: bigint | null): string;

export function particle_entity_effect(entity_x: number, entity_y: number, entity_z: number, entity_width: number, entity_height: number, kind: string, rng_seed?: bigint | null): string;

export function particle_entity_fire(entity_x: number, entity_y: number, entity_z: number, entity_width: number, entity_height: number, rng_seed?: bigint | null): string;

export function particle_eval_alpha(particle_json: string, partial: number): number;

export function particle_eval_size(particle_json: string, partial: number): number;

export function particle_eval_tex(particle_json: string): number;

export function particle_explosion(x: number, y: number, z: number, radius: number, rng_seed?: bigint | null): string;

export function particle_falling_drop(x: number, y: number, z: number, lava: boolean, landing: boolean, rng_seed?: bigint | null): string;

export function particle_flame(x: number, y: number, z: number, mx: number, my: number, mz: number, rng_seed?: bigint | null): string;

export function particle_honey_drip(x: number, y: number, z: number, falling: boolean, landing: boolean, rng_seed?: bigint | null): string;

export function particle_huge_explode(x: number, y: number, z: number): string;

export function particle_large_explode(x: number, y: number, z: number, scale: number, rng_seed?: bigint | null): string;

export function particle_lava(x: number, y: number, z: number, rng_seed?: bigint | null): string;

/**
 * WASM export for particle collision (used by JS fallback too).
 */
export function particle_move(x: number, y: number, z: number, motion_x: number, motion_y: number, motion_z: number, width: number, height: number, collide: boolean, boxes: Float64Array): Float64Array;

export function particle_native(x: number, y: number, z: number, mx: number, my: number, mz: number, kind: string, rng_seed?: bigint | null): string;

export function particle_note(x: number, y: number, z: number, pitch: number, rng_seed?: bigint | null): string;

export function particle_poof(x: number, y: number, z: number, mx: number, my: number, mz: number, rng_seed?: bigint | null): string;

export function particle_portal(x: number, y: number, z: number, mx: number, my: number, mz: number, rng_seed?: bigint | null): string;

export function particle_rain(x: number, y: number, z: number, rng_seed?: bigint | null): string;

export function particle_reddust(x: number, y: number, z: number, r: number, g: number, b: number, rng_seed?: bigint | null): string;

export function particle_simple_rising(x: number, y: number, z: number, tex: number, sprite: string | null | undefined, mx: number, my: number, mz: number, max_age: number, scale: number, r: number, g: number, b: number, rng_seed?: bigint | null): string;

export function particle_smoke(x: number, y: number, z: number, mx: number, my: number, mz: number, scale_mul: number, rng_seed?: bigint | null): string;

export function particle_spell(x: number, y: number, z: number, mx: number, my: number, mz: number, r: number, g: number, b: number, instant: boolean, witch: boolean, rng_seed?: bigint | null): string;

export function particle_splash(x: number, y: number, z: number, mx: number, my: number, mz: number, rng_seed?: bigint | null): string;

/**
 * Check if a particle type exists in the registry.
 */
export function particle_sprite_exists(particle_type: string): boolean;

/**
 * Get the number of animation frames for a particle type.
 */
export function particle_sprite_frame_count(particle_type: string): number;

/**
 * Get UV coordinates for a particle sprite.
 *
 * # Arguments
 * * `particle_type` - Particle type name (e.g., "smoke", "flame", "portal")
 * * `age` - Current particle age in ticks
 * * `max_age` - Maximum particle age in ticks
 * * `partial_tick` - Partial tick interpolation [0, 1)
 * * `sprite_mode` - 0=sequential, 1=random, 2=static
 * * `random_seed` - Random value in [0, 1) for random mode
 *
 * # Returns
 * UV coordinates as [u0, v0, u1, v1], or null if particle type not found.
 */
export function particle_sprite_get(particle_type: string, age: number, max_age: number, partial_tick: number, sprite_mode: number, random_seed: number): Float32Array | undefined;

/**
 * Get UV coordinates for a particle sprite by explicit frame index.
 *
 * # Arguments
 * * `particle_type` - Particle type name
 * * `frame` - Explicit frame index
 *
 * # Returns
 * UV coordinates as [u0, v0, u1, v1], or null if particle type/frame not found.
 */
export function particle_sprite_get_frame(particle_type: string, frame: number): Float32Array | undefined;

/**
 * Get all registered particle type names.
 */
export function particle_sprite_list(): string[];

/**
 * Serializable representation of the particle sprite registry (for debugging).
 */
export function particle_sprite_registry_json(): string;

/**
 * Get the texture names for a particle type (for debugging/inspection).
 */
export function particle_sprite_textures(particle_type: string): string[] | undefined;

/**
 * Initialize or update the UV lookup table from JavaScript.
 * Called by JS after building the texture atlas.
 */
export function particle_sprites_set_uv_lookup(uv_data: any): void;

/**
 * Tick all particles for one frame.
 * Returns updated particles and any newly spawned particles as JSON.
 */
export function particle_tick(particles_json: string, explosion_emitters_json: string, emitters_json: string, collision_boxes: Float64Array, settings: number, rng_seed?: bigint | null): string;

export function piston_can_push(reg_json: string, state: number, px: number, py: number, pz: number, facing: number, destroy_blocks: boolean, f2: number): boolean;

export function piston_is_piston(name: string): boolean;

export function piston_is_sticky_block(name: string): boolean;

export function piston_mobility(name: string): string;

/**
 * Set up an EntityLeashKnot / LeashFenceKnotEntity with position and dimensions.
 *
 * Mirrors `placeLeashKnot(e, x, z)` from the JavaScript original. The JS call
 * sites default `x` to the entity's `y` and `z` to its `z`; here both are
 * always supplied, and `y` is read from the entity when present.
 */
export function place_leash_knot(e: object, x: number, z: number): void;

/**
 * Strict overlap between an entity box and any occupied block-shape box.
 * Touching a face is allowed.
 */
export function placement_intersects(boxes: Float64Array, pos: Float64Array, entity: Float64Array): boolean;

export function player_pose_height_114(pose: string): number;

export function player_pose_height_115(pose: string): number;

export function player_pose_width_114(pose: string): number;

/**
 * 1.15.2 maps the legacy `sneaking` input to the `crouching` pose.
 */
export function player_pose_width_115(pose: string): number;

export function pose_interval(distance: number, distance_squared: number): number;

export function potato_decision(super_potato: boolean, device_name: string): boolean;

/**
 * Blend potion effect colors based on effect type and amplifier.
 * Matches Minecraft's potion color blending logic.
 *
 * Returns [r, g, b, a] as f32 values in 0..1 range.
 */
export function potion_effect_color(effect_id: number, amplifier: number, ambient: boolean): Float32Array;

/**
 * End frame and return total time
 */
export function profiler_end_frame(profiler: ProfilingData): number;

/**
 * Get profiler data as formatted string (for debug overlay)
 */
export function profiler_get_formatted(profiler: ProfilingData): string;

/**
 * Get profiler results as a JSON string.
 */
export function profiler_get_results(profiler: ProfilingData): string;

/**
 * End a profiling section
 */
export function profiler_mark_end(profiler: ProfilingData, section: string): void;

/**
 * Start a profiling section
 */
export function profiler_mark_start(profiler: ProfilingData, section: string): void;

/**
 * Reset profiler data
 */
export function profiler_reset(profiler: ProfilingData): void;

/**
 * Start a new frame
 */
export function profiler_start_frame(profiler: ProfilingData): void;

/**
 * `proxyHttpBase`: ws(s) URL -> http(s) base without trailing slashes.
 */
export function proxy_http_base(url: string): string | undefined;

/**
 * One entity's contribution to the local player's motion.
 *
 * `bb` is the player's AABB `[x0, y0, z0, x1, y1, z1]`; the entity is the
 * potential pusher. Returns `[dx, dz]` to add to `motionX` / `motionZ`, or
 * `[0, 0]` when the boxes do not overlap.
 */
export function push_offset(bb_x0: number, bb_y0: number, bb_z0: number, bb_x1: number, bb_y1: number, bb_z1: number, player_x: number, player_z: number, entity_x: number, entity_y: number, entity_z: number, entity_width: number, entity_height: number, collision_reduction: number): Float64Array;

/**
 * Ray/AABB slab test, same face numbering as `rayBox` (`DOWN/UP/NORTH/SOUTH/WEST/EAST`).
 * Returns `(hit, t, face)`; `hit` is false when the ray misses.
 */
export function ray_box(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): Float64Array;

/**
 * Remove unlocked recipe
 */
export function remove_recipe(recipe_book: RecipeBookState, recipe_id: string): void;

export function resolve_state_wasm(reg: BlockRegistryCore, state: number, neighbours: Uint32Array): string;

/**
 * Riding position offset for a vehicle (boat, minecart, horse, etc.)
 * Returns [x, y, z].
 */
export function rider_position(v_x: number, v_y: number, v_z: number, v_yaw: number, v_kind: string, v_type: number, v_height: number, rider_kind: string, rider_index: number, passenger_count: number): Float64Array;

/**
 * PKCS#1 v1.5 type 2 encryption. `random` is consumed in stream order; a
 * zero padding byte advances to the next random byte, matching the JS
 * `random(1)` retry loop.
 */
export function rsa_encrypt(spki: Uint8Array, data: Uint8Array, random: Uint8Array): Uint8Array | undefined;

/**
 * `ScaffoldingBlock.getCollisionShape` with the native `isAbove` check.
 * `feet` is the mover's bounding-box minimum Y; `Infinity` models no mover.
 */
export function scaffolding_collision(distance: number, bottom: boolean, feet: number, y: number, sneaking: boolean): Float64Array;

/**
 * Apply a scoreboard action and return the resulting score.
 * action: 0 = set, 1 = add, 2 = remove
 */
export function scoreboard_apply_action(current: number, value: number, action: number): number;

/**
 * `drawEffects`: the amplifier suffix key (`enchantment.level.N`) or an empty
 * string when there is none.
 */
export function screen_containers_amplifier_key(amplifier: number): string;

/**
 * `AnvilScreen.drawForeground`: the repair-cost label colour.
 */
export function screen_containers_anvil_cost_color(cost: number, has_output: boolean, xp_level: number, creative: boolean): number;

/**
 * `AnvilScreen` slot positions.
 */
export function screen_containers_anvil_slots(): Int32Array;

/**
 * `BeaconScreen.drawOverlay`: the tooltip suffix for a tier-3 button.
 */
export function screen_containers_beacon_button_suffix(tier: number, effect: number): string;

/**
 * `GuiBeacon.Button.drawButton`: the 22x22 frame `u` offset
 * (0 default, +22 selected, +44 disabled, +66 hovered).
 */
export function screen_containers_beacon_button_u(enabled: boolean, selected: boolean, hovered: boolean): number;

/**
 * `BeaconScreen._buttons()`: the power button list.
 *
 * `levels`/`primary`/`secondary` are `field(0..2)`; `has_payment` mirrors
 * `!!this.container.get(0)`. Returns a JSON array of button records with the
 * same fields the JS version builds (`x`, `y`, `effect`, `tier`, `enabled`,
 * `selected`, plus `confirm`/`cancel`/`u`/`v` for the two footer buttons).
 * Coordinates are GUI-relative offsets, exactly as in JS minus `guiLeft`/
 * `guiTop`, which the caller adds back.
 */
export function screen_containers_beacon_buttons(levels: number, primary: number, secondary: number, has_payment: boolean): string;

/**
 * `BeaconScreen.field(i)`: the locally overridden value wins over the
 * container property. `local` is `-1` for "not overridden".
 */
export function screen_containers_beacon_field(local: number, property: number): number;

/**
 * `BeaconScreen` slot positions: payment slot plus the player inventory.
 */
export function screen_containers_beacon_slots(): Int32Array;

/**
 * `GuiEnchantment._drawBook`: the interpolated book angles for one frame.
 * Returns `[f3, f4, f5]` (`f3` = open amount, `f4`/`f5` = page flips).
 */
export function screen_containers_book_angles(o_open: number, open: number, o_flip: number, flip: number, partial: number): Float64Array;

/**
 * `ModelBook.setRotationAngles(0, f4, f5, f3)`: the part rotations and the
 * shared X offset. Returns `[coverRightRy, coverLeftRy, pagesRightRy,
 * pagesLeftRy, flipRightRy, flipLeftRy, pagesX]` where `flipRightRy`/
 * `flipLeftRy` are the raw `f - f*2*f4` / `f - f*2*f5` values.
 */
export function screen_containers_book_rotations(f3: number, f4: number, f5: number): Float64Array;

/**
 * `BrewingScreen.drawBackground`: `[j1, b]` where `j1` is the brew-arrow
 * height and `b` the bubble height. Returns an empty vector when `t <= 0`.
 */
export function screen_containers_brewing_bubbles(t: number): Int32Array;

/**
 * `BrewingScreen.drawBackground`: the fuel bar width.
 */
export function screen_containers_brewing_fuel_width(fuel: number): number;

/**
 * `BrewingScreen` slot positions.
 */
export function screen_containers_brewing_slots(): Int32Array;

/**
 * `ContainerScreen.init()`: `guiLeft`/`guiTop` from the window and GUI size.
 * Returns `[guiLeft, guiTop]`.
 */
export function screen_containers_center(width: number, height: number, x_size: number, y_size: number): Float64Array;

/**
 * `ChestScreen.drawBackground` Y offset of the second (player inventory)
 * sprite: `rows * 18 + 17`.
 */
export function screen_containers_chest_lower_offset(rows: number): number;

/**
 * `ChestScreen`: `rows = floor(size / 9)`, then the player inventory.
 * Returns `[ySize, ...flat slots]` so the caller gets the derived height too.
 */
export function screen_containers_chest_slots(size: number): Int32Array;

/**
 * `creativeCatalog(game)`: builds the three lookup tables from the creative
 * data (the `tabs` array of `creative.json`).
 *
 * Returns JSON `{ tabs: {label: [items]}, tabOfId: {id: label},
 * enchantmentTabs: {enchantmentId: label}, labels: [...], indices: [...] }`.
 */
export function screen_containers_creative_catalog(creative_json: string): string;

/**
 * `CreativeScreen.mouseDown` inventory-slot branch: which slots changed
 * enough to need a `sendCreativeSlot` round trip.
 *
 * `before_json` / `after_json` are JSON arrays of the copied stacks before
 * and after the click; `stackable_json` is a 0/1 array saying whether each
 * changed pair is stackable with equal counts. Returns the changed indices.
 */
export function screen_containers_creative_changed_slots(before_json: string, after_json: string, same_stack_json: string): string;

/**
 * `CreativeScreen.mouseDown`: the outside-drop branch.
 *
 * Returns `{ "slot": -1, "item": <stack> }` for the stack that should be sent
 * to creative slot `-1`, or `"null"` when nothing drops.
 */
export function screen_containers_creative_drop(btn: number, outside: boolean, tab_hit: boolean, cursor_json: string): string;

/**
 * `CreativeScreen.mouseDown` grid-item branch.
 *
 * `cursor_json` is the cursor stack (`"null"` when empty), `item_json` the
 * grid item. Returns JSON `{ "cursor": <item or null>, "taken": bool }` with
 * the resulting cursor; `max_stack` is `items.maxStack(id)` for the item.
 */
export function screen_containers_creative_grid_click(cursor_json: string, item_json: string, btn: number, shift: boolean, max_stack_item: number, max_stack_cursor: number, stackable: boolean): string;

/**
 * `CreativeScreen.gridItemAt(mx, my)`.
 *
 * Returns JSON `{"idx":n,"x":px,"y":py,"visible":bool}` or `"null"` when the
 * point misses the 9x5 grid (or the tab is the survival inventory tab).
 */
export function screen_containers_creative_grid_item_at(is_inventory_tab: boolean, gui_left: number, gui_top: number, mx: number, my: number, scroll: number, list_len: number): string;

/**
 * `CreativeScreen.render`: the first visible list index
 * (`round(scroll * maxScrollRows()) * 9`).
 */
export function screen_containers_creative_grid_start(scroll: number, max_rows: number): number;

/**
 * `CreativeScreen.key`: whether a number key over the grid/inventory should
 * pull the item into the hotbar, and what the two swapped stacks are.
 *
 * `grid_item_json` is `"null"` when the cursor is not over a grid item.
 * Returns JSON `{ "action": "grid"|"swap"|"none", "item": .., "before": ..,
 * "cur": .. }`.
 */
export function screen_containers_creative_hotbar_key(grid_item_json: string, slot: number, hotbar_slot: number, slot_item_json: string, max_stack_grid: number, locked: boolean): string;

/**
 * `CreativeScreen._layout()`: the player-inventory slot list (which is the
 * whole layout on every tab except `inventory`).
 *
 * `inventory` mirrors `tabLabel() === 'inventory'`: when true the armor 2x2
 * and off-hand slots are added ahead of the main inventory and hotbar.
 */
export function screen_containers_creative_layout(inventory: boolean): Int32Array;

/**
 * `creativeLocked(it)`: `it.locked || it.nbt.v.CustomCreativeLock`.
 */
export function screen_containers_creative_locked(item_json: string): boolean;

/**
 * `CreativeScreen.render`: whether the point is over the survival tab's
 * destroy-item highlight rect (the `dx, dy = 173, 112` sprite test).
 */
export function screen_containers_creative_on_destroy_rect(gui_left: number, gui_top: number, mx: number, my: number): boolean;

/**
 * `CreativeScreen.render`: whether the mouse is over the survival tab's
 * destroy-item slot (`L+172..L+190`, `T+111..T+129`).
 */
export function screen_containers_creative_on_destroy_slot(gui_left: number, gui_top: number, mx: number, my: number): boolean;

/**
 * `CreativeScreen.mouseDown`: whether the point is on the scrollbar track
 * (`mx` in `[L+175, L+187)`, `my` in `[T+18, T+130)`).
 */
export function screen_containers_creative_on_scrollbar(gui_left: number, gui_top: number, mx: number, my: number): boolean;

/**
 * `CreativeScreen._scrollTo(my)`: the scroll fraction for a thumb drag.
 */
export function screen_containers_creative_scroll_to(gui_top: number, my: number): number;

/**
 * `CreativeScreen.render`: the creative scrollbar thumb position
 * `[sx, sy, u]`.
 */
export function screen_containers_creative_scrollbar(gui_left: number, gui_top: number, scroll: number, max_rows: number): Float64Array;

/**
 * `CreativeScreen.setTab`: the chat-key tab index used by `key()`.
 */
export function screen_containers_creative_search_tab_index(): number;

/**
 * `CreativeScreen._tabAt(mx, my)`: the tab index under the cursor, or `-1`.
 *
 * `tabs_json` is the output of [`screen_containers_tab_meta`].
 */
export function screen_containers_creative_tab_at(tabs_json: string, gui_left: number, gui_top: number, x_size: number, y_size: number, mx: number, my: number): number;

/**
 * `CreativeScreen._drawTab`: the tab icon position `[ix, iy]`.
 */
export function screen_containers_creative_tab_icon_pos(tab_x: number, tab_y: number, top: boolean): Float64Array;

/**
 * `creativeTabOf(game, id)`: the first tab listing the id, else `"misc"`.
 */
export function screen_containers_creative_tab_of(catalog_json: string, id: bigint): string;

/**
 * `CreativeScreen._tabRect(t)`: the tab sprite rectangle.
 * Returns `[x, y, col, top]` in screen coordinates.
 */
export function screen_containers_creative_tab_rect(gui_left: number, gui_top: number, x_size: number, y_size: number, column: number, top: boolean, right: boolean): Float64Array;

/**
 * `CreativeScreen._drawTab`: the sprite `v` offset (0 or 64, +32 selected).
 */
export function screen_containers_creative_tab_v(top: boolean, selected: boolean): number;

/**
 * `CreativeScreen.wheel(d)`: the new scroll fraction.
 */
export function screen_containers_creative_wheel(scroll: number, d: number, max_rows: number): number;

/**
 * `ContainerScreen.render` drag-split preview for one slot.
 *
 * Returns JSON `{"show":bool,"count":n,"countText":str|null}` where `count`
 * is the previewed stack size and `countText` the `§eN` overflow label.
 */
export function screen_containers_drag_preview(drag_limit: number, cursor_count: number, drag_slots: number, item_count: number, max_stack: number, can_add: boolean, is_valid: boolean): string;

/**
 * `ContainerScreen.render` cursor-item remainder while drag splitting.
 *
 * `slot_item_counts` are the current counts in each drag slot (0 for empty).
 * Returns `[left, text]` where `text` is `"§e0"` when nothing would be left.
 */
export function screen_containers_drag_remainder(cursor_count: number, drag_limit: number, max_stack_cursor: number, slot_item_counts: Int32Array): string;

/**
 * `ContainerScreen.key`: the drop-key action.
 * Returns `-1` for "not the drop key", otherwise the button (`1` for ctrl).
 */
export function screen_containers_drop_button(code: string, drop_code: string, ctrl: boolean): number;

/**
 * `drawEffects`: the duration label. `"**:**"` above 32767 ticks, otherwise
 * `M:SS` with the seconds zero-padded to two digits.
 */
export function screen_containers_effect_duration(duration: number): string;

/**
 * `drawEffects`/`BeaconScreen`: the localization key of an effect id from the
 * creative data, or `effect.none` when the id is unknown.
 */
export function screen_containers_effect_key(creative_json: string, id: number): string;

/**
 * `drawEffects`: the vertical step between effect rows
 * (`33`, or `floor(132 / (n - 1))` when there are more than five).
 */
export function screen_containers_effects_dy(n: number): number;

/**
 * `InventoryEffectRenderer` shift used by `InventoryScreen.init` and
 * `CreativeScreen.init`: `floor(160 + (width - xSize - 200) / 2)`.
 */
export function screen_containers_effects_shift_left(width: number, x_size: number): number;

/**
 * `EnchantmentNameParts` reseeded from `xpSeed`: the three clue strings.
 *
 * The JS builds `JavaRandom(seed)`, then for each of the three lines draws
 * `nextInt(2) + 3` words from `NAME_PARTS`. `widths` are the wrapped-line
 * budgets (`86 - textWidth(cost)`) supplied by the caller, since text
 * measurement stays in JS. Word selection happens here; wrapping is done by
 * [`screen_containers_wrap_clue`].
 */
export function screen_containers_enchant_clues(seed: bigint): string;

/**
 * `EnchantScreen.drawBackground` / `drawOverlay` base colours.
 */
export function screen_containers_enchant_colors(variant: number): Int32Array;

/**
 * `EnchantScreen.drawBackground`: whether a level row is affordable, which
 * selects the grey (unaffordable) or normal sprite.
 */
export function screen_containers_enchant_enabled(lapis_count: number, level_index: number, xp_level: number, cost: number, creative: boolean): boolean;

/**
 * `EnchantScreen.drawOverlay`: the tooltip line prefix codes.
 */
export function screen_containers_enchant_overlay_line(lapis_count: number, k: number): string;

/**
 * `EnchantScreen` slot positions.
 */
export function screen_containers_enchant_slots(): Int32Array;

/**
 * `GuiEnchantment.tickBook` step.
 *
 * `flip`/`oFlip`/`flipT`/`flipA`/`open`/`oOpen` are the previous animation
 * state; `item_key` is the JS `JSON.stringify([id, damage, count, nbt])` of
 * the input slot (or an empty string for no item); `props` are the three
 * `container.properties` costs; `roll` is `Math.random()` for the page flip.
 * `partial` is the render partial tick.
 *
 * Returns a JSON object with the new state.
 */
export function screen_containers_enchant_tick(flip: number, _o_flip: number, flip_t: number, flip_a: number, open: number, _o_open: number, last_item: string, item_key: string, p0: number, p1: number, p2: number, roll: number): string;

/**
 * `FurnaceScreen.drawBackground`: the cook progress arrow width.
 * Returns `l + 1`.
 */
export function screen_containers_furnace_cook(cook: number, total_cook: number): number;

/**
 * `FurnaceScreen.drawBackground`: the burn flame.
 * Returns `[k, srcY, srcH]` or an empty vector when `burn <= 0`.
 */
export function screen_containers_furnace_flame(burn: number, total: number): Int32Array;

/**
 * `FurnaceScreen` slot positions: `[[0,56,17],[1,56,53],[2,116,35]]`.
 */
export function screen_containers_furnace_slots(): Int32Array;

/**
 * `FurnaceScreen`: the texture name for a furnace-like window type.
 */
export function screen_containers_furnace_texture(win_type: string): string;

/**
 * `HorseScreen`: two horse slots, an optional 3x5 chest, player inventory.
 * `chest` mirrors `win.size > 2`.
 */
export function screen_containers_horse_slots(size: number, chest: boolean): Int32Array;

/**
 * `fromJson` reviver: validates and unwraps the `{$ta, a}` / `{$big}`
 * envelope. Returns JSON, or `"null"` for an invalid payload (the JS throws).
 */
export function screen_containers_hotbar_from_json(saved_json: string): string;

/**
 * `ContainerScreen.key`: the hotbar-swap decision.
 *
 * Returns the hotbar index `0..9` that the key matched, or `-1`.
 */
export function screen_containers_hotbar_key(code: string, hotbar_codes_json: string): number;

/**
 * `handleHotbarSnapshots`: the load branch's per-slot payloads
 * (`creativeCopy(list[n][i])` for `36 + i`), as JSON.
 */
export function screen_containers_hotbar_load_payload(list_json: string, n: number): string;

/**
 * `CreativeScreen.setTab` on the `hotbar` tab: the list for one empty saved
 * bar, where the placeholder paper sits at column `n` of its own row.
 *
 * `paper_id` is `game.items.byName.get('paper').id` and `name_json` the
 * already-serialized `inventory.hotbarInfo` translate component.
 */
export function screen_containers_hotbar_placeholder(n: number, paper_id: bigint, name_json: string): string;

/**
 * `handleHotbarSnapshots`: the save branch — copies the nine hotbar stacks,
 * nulling locked ones, into slot `n` of the list.
 */
export function screen_containers_hotbar_save_payload(list_json: string, n: number, main_json: string): string;

/**
 * `hotbarSnapshots()`: validates and copies the stored toolbars.
 *
 * `saved_json` is the raw stored string (`null` when absent). Returns JSON
 * `[bar][slot] -> item|null`, always nine by nine.
 */
export function screen_containers_hotbar_snapshots(saved_json: string): string;

/**
 * `CreativeScreen.setTab` on the `hotbar` tab: concatenates the nine bars,
 * substituting placeholders for empty ones.
 *
 * `paper_id`/`names_json` (a nine-element array of the serialized
 * `inventory.hotbarInfo` components) are supplied by the JS side.
 */
export function screen_containers_hotbar_tab_list(snapshots_json: string, paper_id: bigint, names_json: string): string;

/**
 * `toJson` replacer: rewrites `ArrayBuffer` views and `bigint` values into the
 * `{$ta, a}` / `{$big}` envelope the loader understands.
 *
 * `value_json` is plain JSON; `typed_arrays_json` is a parallel map of
 * pointer-free paths to typed-array payloads the JS side supplies, since Rust
 * has no access to the live buffers.
 */
export function screen_containers_hotbar_to_json(value_json: string): string;

/**
 * The `HOTBARS_KEY` storage key.
 */
export function screen_containers_hotbars_key(): string;

/**
 * `InventoryScreen` (ContainerPlayer 1.9+): result, 2x2 crafting grid, armor,
 * player inventory, off hand.
 */
export function screen_containers_inventory_slots(): Int32Array;

/**
 * `ContainerScreen.isOutside(mx, my)`.
 */
export function screen_containers_is_outside(mx: number, my: number, gui_left: number, gui_top: number, x_size: number, y_size: number): boolean;

/**
 * `CreativeScreen._refreshCatalog` / `setTab`: the search-tab reset rule —
 * the query is preserved only when staying on the search tab.
 */
export function screen_containers_keep_search_query(new_label: string): boolean;

/**
 * The `openContainerScreen` switch for the simple in-line layouts.
 *
 * Returns a JSON object `{ kind, tex, titleX, titleY, xSize, ySize, invX,
 * invY, hotbarY, slots }` describing the `SimpleScreen` subclass (or chest /
 * horse) that the caller should construct. The workstation screens created by
 * `createWorkstationScreen` and the recipe-book wrappers stay in JS; the
 * caller keeps its early-return for those.
 */
export function screen_containers_layout_for(win_type: string, size: number): string;

/**
 * `CreativeScreen.filter` entry point: does this item match the query?
 *
 * A convenience wrapper combining [`screen_containers_parse_search_query`],
 * [`screen_containers_tag_query_hit`] and [`screen_containers_search_hit`].
 */
export function screen_containers_matches(raw_query: string, item_id: bigint, def_name: string | null | undefined, tooltip_json: string, item_tags_json: string): boolean;

/**
 * `CreativeScreen.maxScrollRows()`.
 */
export function screen_containers_max_scroll_rows(list_len: number): number;

/**
 * `ContainerScreen.mouseDown` state machine (the part after the widget and
 * `extraMouseDown` hooks).
 *
 * `dom_button` is the DOM button (0 left, 1 middle, 2 right); `slot` is the
 * `slotAt` result (`-1` for `null`); `inside` is `!isOutside(mx, my)`;
 * `has_cursor` is `!!this.inv.cursor`; `now` the platform time.
 * Returns the JSON decided by [`mouse_down_result`].
 */
export function screen_containers_mouse_down(dom_button: number, slot: number, inside: boolean, has_cursor: boolean, shift: boolean, now: number, last_click_slot: number, last_click_time: number, last_click_button: number, drag_splitting: boolean): string;

/**
 * `ContainerScreen.mouseUp` state machine.
 *
 * Returns JSON `{ clicks: [{slotId, button, mode}], doubleClick, dragSplitting,
 * ignoreMouseUp, lastClickTime, dropCursor }`. `clicks` are the
 * `handleClick` calls in order. The double-click shift-merge scan is provided
 * separately by [`screen_containers_double_click_merge`] because it needs the
 * container's slot rules.
 */
export function screen_containers_mouse_up(dom_button: number, slot: number, inside: boolean, shift: boolean, _has_cursor: boolean, cursor_survives: boolean, double_click: boolean, drag_splitting: boolean, drag_button: number, drag_slots: Int32Array, ignore_mouse_up: boolean, can_merge_slot: boolean): string;

/**
 * `CreativeScreen.filter`: the query parsing step.
 *
 * Splits `q` into the `#` tag query, the namespace and the term, applying the
 * `'minecraft'.includes(...)` namespace test from the JS.
 * Returns `{"tag":bool,"term":str,"namespaceOk":bool,"empty":bool}`.
 */
export function screen_containers_parse_search_query(raw: string): string;

/**
 * `playerInvSlots(start, x0, y0, hotbarY)`.
 *
 * Returns a flat `Vec<i32>` of `[slot, x, y]` triples (the JS version returns
 * an array of 3-element arrays; a flat vector keeps the wasm boundary simple).
 */
export function screen_containers_player_inv_slots(start: number, x0: number, y0: number, hotbar_y: number): Int32Array;

/**
 * `drawEffects`: `POTION_ICON` lookup for an effect id, `-1` when absent.
 */
export function screen_containers_potion_icon(id: number): number;

/**
 * `ContainerScreen.mouseUp` quickcraft emission for a multi-slot drag.
 *
 * Returns JSON `[{slotId, button, mode}]`: the stage-0 begin, one stage-1
 * entry per drag slot, and the stage-2 end — exactly the JS sequence.
 */
export function screen_containers_quickcraft_clicks(drag_limit: number, drag_slots: Int32Array): string;

/**
 * `withRecipeBook`: the recipe-book button rectangle
 * `[x, y, w, h]` from the button offsets and the screen height.
 */
export function screen_containers_recipe_button(gui_left: number, height: number, bx: number, by: number): Float64Array;

/**
 * `GuiButtonImage` hover row for the recipe-book button: `v + 19` when
 * hovered, `v` otherwise.
 */
export function screen_containers_recipe_button_v(v: number, hovered: boolean): number;

/**
 * `ContainerScreen.mouseUp` double-click shift-merge: whether slot `i`
 * belongs to the same inventory as the clicked slot
 * (`(c.slots[i].playerIndex !== undefined) === (c.slots[slot].playerIndex !== undefined)`).
 */
export function screen_containers_same_inventory(i_has_player_index: boolean, slot_has_player_index: boolean): boolean;

/**
 * `saveHotbarSnapshots(list)`: the wrapper written to storage.
 *
 * Returns JSON `{version, minecraftVersion, protocol, dataVersion, bars}`.
 */
export function screen_containers_save_hotbar_snapshots(list_json: string): string;

/**
 * `CreativeScreen.init`: the search field rectangle `[x, y, w, h]`.
 */
export function screen_containers_search_field(gui_left: number, gui_top: number): Float64Array;

/**
 * `CreativeScreen.filter`: the whole match test for one item.
 *
 * `def_name` is `items.def(id).name`, `tooltip_lines` the item's tooltip
 * lines (formatting codes are stripped here, as `stripCodes` does in JS).
 */
export function screen_containers_search_hit(query_json: string, def_name: string | null | undefined, tooltip_lines: string): boolean;

/**
 * `CreativeScreen._tooltip`: the extra group / tag lines inserted at index 1
 * on the search tab.
 *
 * Returns a JSON array of the lines to splice in, in JS order (the group line
 * first, then the `Â§5#tag` lines).
 */
export function screen_containers_search_tooltip_lines(group: string | null | undefined, tag_lines: string): string;

/**
 * `ContainerScreen.slotAt(mx, my)`.
 *
 * `slots_flat` is the flat `[slot, x, y]` layout (see
 * [`screen_containers_player_inv_slots`]). Returns the slot index or `-1`
 * for the JS `null`.
 */
export function screen_containers_slot_at(slots_flat: Float64Array, gui_left: number, gui_top: number, mx: number, my: number): number;

/**
 * `stackOf` exposed for the tab icons (`_drawTab`),
 * Returns the JSON item for a creative tuple `[id, , tag]`.
 */
export function screen_containers_stack_of(id: bigint, tag_json: string): string;

/**
 * `CreativeScreen.key`: the hotbar-swap validity test
 * (`!before || (isValid(slot, before) && before.count <= slotLimit(slot, before))`).
 */
export function screen_containers_swap_ok(before_present: boolean, is_valid: boolean, before_count: number, slot_limit: number): boolean;

/**
 * `tabInfo(game, i)`: the index of the tab with that index, or `-1`.
 */
export function screen_containers_tab_index(creative_json: string, index: number): number;

/**
 * `CreativeScreen.render`: the tab tooltip label key (`itemGroup.<label>`).
 */
export function screen_containers_tab_label_key(label: string): string;

/**
 * `tabData(game)` reduced to the per-tab geometry fields.
 * Returns a JSON array of `{index, label, column, top, right, title,
 * scrollbar, background}`.
 */
export function screen_containers_tab_meta(creative_json: string): string;

/**
 * `SearchTreeManager.ITEMS` tag match for a `#tag` query.
 *
 * `tags_json` is the entry's tag list (`game.tags.forEntry('items', id)`).
 */
export function screen_containers_tag_query_hit(tags_json: string, term: string): boolean;

/**
 * `CreativeScreen._tooltip`: the group for an enchanted book, which uses the
 * enchantment's own tab when the book carries exactly one enchantment.
 */
export function screen_containers_tooltip_group(catalog_json: string, item_id: bigint, item_name: string, enchantment_ids_json: string): string;

/**
 * `ContainerScreen._tryAddDrag(slot)`.
 *
 * `can_add` mirrors `c._canAdd(slot, cursor, true)`, `is_valid` mirrors
 * `c.isValid(slot, cursor)` and `can_drag` mirrors `c.canDragIntoSlot(slot)`,
 * all computed by the JS container (which owns the slot rules).
 */
export function screen_containers_try_add_drag(cursor_count: number, drag_slot_count: number, can_add: boolean, is_valid: boolean, can_drag: boolean): boolean;

/**
 * `FontRenderer.wrap` reduced to what the enchantment clue needs: greedily
 * fill lines up to `width` using a character-width table.
 *
 * `widths_json` maps a character to its pixel width; missing characters fall
 * back to `6` (the Standard Galactic Font's default). `max_lines` limits the
 * result the way `.slice(0, 2)` does in JS.
 */
export function screen_containers_wrap_clue(text: string, width: number, widths_json: string, max_lines: number): string;

export function section_lod(distance: number, camera_x: number, camera_y: number, camera_z: number, cx: number, sy: number, cz: number, previous: boolean): boolean;

export function select_glsl_functions_wasm(source: string, root: string): string;

export function server_craft_result(grid_json: string, n: number, records_json: string): string;

/**
 * `new BigInteger(sha1(serverId, secret, publicKey)).toString(16)`:
 * two's-complement signed hex with no leading zeros.
 */
export function server_hash(server_id: string, secret: Uint8Array, public_key: Uint8Array): string;

export function set_block_light(light: Uint8Array, index: number, value: number): void;

export function set_jar_models(models_json: string): boolean;

export function set_sky_light(light: Uint8Array, index: number, value: number): void;

export function sha1(data: Uint8Array): Uint8Array;

export function shader_block_rules_wasm(source: string, version: number): string;

export function shader_library_add(metadata_json: string, revision: number, name: string, bytes_json: string): string;

export function shader_library_migrate_legacy(legacy_bytes_json?: string | null, legacy_meta_json?: string | null): string;

export function shader_library_new_id(): string;

export function shader_library_normalize_metadata(json_text: string): string;

export function shader_library_remove(metadata_json: string, revision: number, id?: string | null): string;

export function shader_library_save_current(metadata_json: string, revision: number, pack_bytes_json: string | null | undefined, pack_options_json: string | null | undefined, pack_enabled: boolean): string;

export function shader_library_select(metadata_json: string, revision: number, id: string | null | undefined, enabled: boolean): string;

/**
 * Check if a mob should spawn at given conditions
 */
export function should_spawn_mob(difficulty: number, light_level: number, sky_light: number, block_light: number, y: number, is_slime_chunk: boolean, is_swamp: boolean): boolean;

/**
 * Wake up conditions check.
 * Returns true if the player should wake up.
 */
export function should_wake_up(world_time: bigint, took_damage: boolean, bed_destroyed: boolean, left_bed: boolean, in_combat: boolean): boolean;

/**
 * `shulkerBox(e, peek)` → `[minX, minY, minZ, maxX, maxY, maxZ]` in block coordinates.
 */
export function shulker_box(x: number, y: number, z: number, peek: number, attach_face: number): Float64Array;

/**
 * Shulker push vector for a given attach face (0..5).
 */
export function shulker_push_vector(attach_face: number): Float64Array;

/**
 * Simulate projectile motion for one tick (arrows, fireballs, etc.)
 * Returns new [x, y, z, motionX, motionY, motionZ].
 */
export function simulate_projectile(x: number, y: number, z: number, motion_x: number, motion_y: number, motion_z: number, accel_x: number, accel_y: number, accel_z: number, drag: number, gravity: number, no_gravity: boolean, in_ground: boolean, block_at_feet_opaque: boolean): Float64Array;

export function sky_color_wasm(angle: number, temperature: number, rain: number, thunder: number): Float64Array;

/**
 * Calculate sleep percentage for multiplayer sleep coordination.
 * Returns the percentage of players sleeping (0.0 to 1.0).
 */
export function sleep_percentage(total_players: number, sleeping_players: number): number;

/**
 * JS: `CATEGORIES` for wasm consumers.
 */
export function sound_categories(): string[];

/**
 * Calculate title screen splash animation parameters.
 *
 * `progress` is a time value in milliseconds (typically `Date.now() % 1000`).
 * `text_width` is the rendered width of the splash text in pixels.
 * `screen_width` is the canvas width.
 *
 * Returns None on invalid input for JS fallback.
 */
export function splash_animation(progress: number, text_width: number, screen_width: number): SplashAnimation | undefined;

/**
 * Vertex data for the startup splash logo quad.
 *
 * Ported from `client/js/render/splash.js` lines 52-57.
 * Returns 36 floats (4 vertices * 9 components: x,y,z, u,v, r,g,b,a).
 * Returns None on invalid input for JS fallback.
 */
export function splash_logo_vertices(logo_x: number, logo_y: number, logo_size: number): Float64Array | undefined;

/**
 * Orthographic projection matrix for the startup splash.
 *
 * Ported from `client/js/render/splash.js` line 58.
 * Returns a 16-element column-major matrix (WebGL compatible).
 * Returns None on invalid input for JS fallback.
 */
export function splash_ortho_matrix(scaled_width: number, scaled_height: number): Float64Array | undefined;

/**
 * Calculate the startup splash scale and logo position.
 *
 * Ported from `client/js/render/splash.js` lines 46-48, 51.
 * Returns null on invalid input for JS fallback.
 */
export function splash_scale(viewport_width: number, viewport_height: number, dpr: number, config?: SplashConfig | null): SplashScale | undefined;

/**
 * Select a splash text from the list.
 *
 * Ported from `client/js/gui/screens/menus.js` lines 29-35.
 * Handles special dates: Christmas (Dec 24) and New Year (Jan 1).
 * `index` is used for deterministic selection (e.g., from Java's Random).
 * Returns null/empty string on failure for JS fallback.
 */
export function splash_text(splashes: Array<any>, index: number): string | undefined;

/**
 * Select a random splash text from the list (convenience function).
 *
 * Uses JS Math.random() via wasm_bindgen for true randomness.
 * Returns null on failure for JS fallback.
 */
export function splash_text_random(splashes: Array<any>): string | undefined;

export function stairs_shape_wasm(reg: BlockRegistryCore, state: number, neighbours: Uint32Array): string;

export function star_brightness_wasm(angle: number): number;

/**
 * Generate a statistic key for a block/item/entity
 */
export function stat_key(category: string, namespace: string, name: string): string;

/**
 * Decode a UTF-8 string with VarInt length prefix
 */
export function string_decode(bytes: Uint8Array): string;

/**
 * Encode a UTF-8 string with VarInt length prefix
 */
export function string_encode(value: string): Uint8Array;

export function sun_brightness_wasm(angle: number, rain: number, thunder: number): number;

export function sunrise_colors_wasm(angle: number): Float64Array;

/**
 * `updateMesh` decode: bytes -> unified float vertex layout.
 */
export function sw_decode_vertices(format: string, data: Uint8Array): Float32Array;

/**
 * `DEFAULT_PARAMS[pipeline]`.
 */
export function sw_default_params(pipeline: string): Float64Array;

/**
 * `lightmap(tex, sky, block)` against a table built by `sw_lightmap_table`.
 */
export function sw_lightmap_sample(table: Float32Array, sky: number, block: number): Float64Array;

/**
 * `buildLightmapTable(tex)` -> the 61 x 61 x 3 lookup table.
 */
export function sw_lightmap_table(px: Uint32Array, w: number, h: number): Float32Array;

/**
 * `mul4(out, a, b)` returning the product.
 */
export function sw_mul4(a: Float64Array, b: Float64Array): Float64Array;

/**
 * `packColor(r, g, b, a)`.
 */
export function sw_pack_color(r: number, g: number, b: number, a: number): number;

/**
 * `PIPELINE_FORMAT[pipeline]`'s format name.
 */
export function sw_pipeline_format(pipeline: string): string;

/**
 * `_post(d)` as a standalone full-screen pass.
 */
export function sw_post_process(params: Float64Array, src: Uint32Array, src_w: number, src_h: number, aux: Uint32Array, aux_w: number, aux_h: number, dst: Uint32Array, dst_w: number, dst_h: number, blend_alpha: boolean): Uint32Array;

/**
 * `vertexLayout(FORMAT[name])` as JSON.
 */
export function sw_vertex_layout(name: string): string;

/**
 * `teamsCanPush(a, b)`: `same` is the JavaScript identity comparison.
 */
export function teams_can_push(a: string | null | undefined, b: string | null | undefined, same: boolean): boolean;

/**
 * Tick dragon death animation - port of `tickDragonDeath(e, g)`.
 * Returns updated entity JSON.
 */
export function tick_dragon_death(entity_json: string): string;

/**
 * Tick entity effects - port of `tickEntityEffects(e, entities)`.
 * This handles guardian beam charging and dragon crystal searching.
 * Returns a JSON string with updated entity data, or empty string on failure.
 */
export function tick_entity_effects(entity_json: string, entities_json: string): string;

/**
 * Tick fox interpolation on a JSON entity object (standalone, matches `tickFox(e)`).
 */
export function tick_fox(entity_json: string): string;

/**
 * Get time until next morning (ticks)
 */
export function ticks_until_morning(time_of_day: bigint): bigint;

/**
 * Get time until next night (ticks)
 */
export function ticks_until_night(time_of_day: bigint): bigint;

/**
 * Add unlocked recipe
 */
export function unlock_recipe(recipe_book: RecipeBookState, recipe_id: string): void;

/**
 * `EntityPlayer.updateCape` - cape trailing point.
 * Returns [chasingX, chasingY, chasingZ, prevChasingX, prevChasingY, prevChasingZ].
 */
export function update_cape(chasing_x: number, chasing_y: number, chasing_z: number, prev_chasing_x: number, prev_chasing_y: number, prev_chasing_z: number, x: number, y: number, z: number): Float64Array;

/**
 * `update_command_block` payload (position, command, mode enum, flags).
 */
export function update_command_block(x: number, y: number, z: number, command: string, mode: string, track: boolean, conditional: boolean, automatic: boolean): Uint8Array;

/**
 * `update_command_block_minecart` payload.
 */
export function update_command_minecart(id: number, command: string, track: boolean): Uint8Array;

export function update_lightmap_wasm(data: Uint8Array, sun: number, dimension: number, torch_flicker: number, gamma: number, night_vision: number, lightning: number): void;

/**
 * Update recipe book state
 */
export function update_recipe_book(recipe_book: RecipeBookState, unlocked_recipes: string[], highlighted_recipes: string[]): void;

/**
 * Update sleeping state from network delta (ported from JS updateSleeping).
 * Returns UpdateSleepResult indicating what changed.
 */
export function update_sleeping_from_delta(game_sleeping: boolean, game_bed_pos: BlockPos | null | undefined, delta: SleepDelta, index: number, pose_field: number): UpdateSleepResult;

/**
 * Update a statistic value. Stats cross the JS boundary as a JSON object.
 */
export function update_statistic(stats_json: string, name: string, value: bigint): string;

/**
 * `update_structure_block` payload. Enum names use the same strings as the
 * JavaScript caller; unknown values serialize as -1, exactly like `indexOf`.
 */
export function update_structure_block(x: number, y: number, z: number, action: number, mode: string, name: string, pos_x: number, pos_y: number, pos_z: number, size_x: number, size_y: number, size_z: number, mirror: string, rotation: string, metadata: string, integrity: number, seed: bigint, ignore_entities: boolean, show_air: boolean, show_bounding_box: boolean): Uint8Array;

/**
 * Validate a bed position - checks if it's a bed, not obstructed, and has space for player.
 * Returns validation result with facing direction and head/foot positions.
 */
export function validate_bed_position(world: WorldView, x: number, y: number, z: number): BedValidationResult | undefined;

/**
 * Decode a VarInt from bytes
 */
export function varint_decode(bytes: Uint8Array): number;

/**
 * Encode a VarInt (signed 32-bit)
 */
export function varint_encode(value: number): Uint8Array;

/**
 * Decode a VarLong from bytes
 */
export function varlong_decode(bytes: Uint8Array): bigint;

/**
 * Encode a VarLong (signed 64-bit)
 */
export function varlong_encode(value: bigint): Uint8Array;

/**
 * Convert degrees to radians
 */
export function vehicle_deg_to_rad(deg: number): number;

/**
 * Wrap angle to [-180, 180]
 */
export function vehicle_wrap(a: number): number;

export function wasm_decode_terrain_position(x: number, y: number, z: number, w: number): Float32Array;

export function wasm_fog_factor(d: number, fog_start: number, fog_end: number, fog_density: number, fog_mode: number): number;

export function wasm_lightmap_uv(x: number, y: number): Float32Array;

export function wasm_quad_indices(quads: number): Uint32Array;

/**
 * `override_color` is `None` when the biome record has no `waterColor`.
 */
export function water_color(id: number, name: string, override_color?: number | null): number;

/**
 * JSON-based wasm-bindgen wrapper around `water_fog`.
 * `state_json`: `{"biomeId": 1, "waterVision": 0.5}`; `previous_json`: `{"target":..,"from":..,"time":..}` or null.
 */
export function water_fog_json(state_json: string, previous_json: string | null | undefined, now: number): string;

/**
 * JS: `BLENDS` names for wasm consumers.
 */
export function webgpu_blend_names(): string[];

/**
 * JS: `DRAW_STRIDE` / `GLOBAL_STRIDE` for wasm consumers.
 */
export function webgpu_draw_stride(): number;

export function webgpu_global_stride(): number;

export function world_collision_boxes(world: WorldCore, reg: BlockRegistryCore, x: number, y: number, z: number): Float64Array;

export function world_get_collisions(world: WorldCore, reg: BlockRegistryCore, bb: Float64Array): Float64Array;

export function world_is_raining_at(world: WorldCore, reg: BlockRegistryCore, x: number, y: number, z: number, precipitation: string, rain_strength: number): boolean;

export function world_raycast(world: WorldCore, reg: BlockRegistryCore, origin: Float64Array, dir: Float64Array, max_dist: number, liquid_mode: number, collider: boolean): string;

/**
 * Wrap angle to [-180, 180]
 */
export function wrap(a: number): number;

export function zip_open(bytes: Uint8Array): ZipArchive | undefined;

/**
 * Returns `[fov, from, to, started]`.
 */
export function zoom_fov(now: number, fov: number, target: number, from: number, to: number, started: number): Float64Array;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_advancementprogress_free: (a: number, b: number) => void;
    readonly __wbg_advancementscore_free: (a: number, b: number) => void;
    readonly __wbg_attributemodifier_free: (a: number, b: number) => void;
    readonly __wbg_banner_free: (a: number, b: number) => void;
    readonly __wbg_bedsleep_free: (a: number, b: number) => void;
    readonly __wbg_bedvalidationresult_free: (a: number, b: number) => void;
    readonly __wbg_beesoundoutput_free: (a: number, b: number) => void;
    readonly __wbg_beesoundparams_free: (a: number, b: number) => void;
    readonly __wbg_beesoundtickresult_free: (a: number, b: number) => void;
    readonly __wbg_biomezoom_free: (a: number, b: number) => void;
    readonly __wbg_blockpos_free: (a: number, b: number) => void;
    readonly __wbg_blockregistrycore_free: (a: number, b: number) => void;
    readonly __wbg_boxmodelcore_free: (a: number, b: number) => void;
    readonly __wbg_cameraeye_free: (a: number, b: number) => void;
    readonly __wbg_cfb8_free: (a: number, b: number) => void;
    readonly __wbg_chunkcolumn_free: (a: number, b: number) => void;
    readonly __wbg_commandresult_free: (a: number, b: number) => void;
    readonly __wbg_craftingtablecore_free: (a: number, b: number) => void;
    readonly __wbg_decodedpacket_free: (a: number, b: number) => void;
    readonly __wbg_effectstate_free: (a: number, b: number) => void;
    readonly __wbg_eventsoundinfo_free: (a: number, b: number) => void;
    readonly __wbg_fallingblock_free: (a: number, b: number) => void;
    readonly __wbg_fireentity_free: (a: number, b: number) => void;
    readonly __wbg_firegeometryresult_free: (a: number, b: number) => void;
    readonly __wbg_fireoverlaygeometryresult_free: (a: number, b: number) => void;
    readonly __wbg_fireuv_free: (a: number, b: number) => void;
    readonly __wbg_fluidstate_free: (a: number, b: number) => void;
    readonly __wbg_foxaitickresult_free: (a: number, b: number) => void;
    readonly __wbg_foxanimationargs_free: (a: number, b: number) => void;
    readonly __wbg_foxstate_free: (a: number, b: number) => void;
    readonly __wbg_foxtargetresult_free: (a: number, b: number) => void;
    readonly __wbg_foxtrustpair_free: (a: number, b: number) => void;
    readonly __wbg_frameresult_free: (a: number, b: number) => void;
    readonly __wbg_frustum_free: (a: number, b: number) => void;
    readonly __wbg_gamecore_free: (a: number, b: number) => void;
    readonly __wbg_gamestate_free: (a: number, b: number) => void;
    readonly __wbg_gametickresult_free: (a: number, b: number) => void;
    readonly __wbg_get_advancementprogress_done: (a: number) => number;
    readonly __wbg_get_advancementprogress_obtained_tick: (a: number, b: number) => void;
    readonly __wbg_get_attributemodifier_amount: (a: number) => number;
    readonly __wbg_get_attributemodifier_operation: (a: number) => number;
    readonly __wbg_get_beesoundoutput_pitch: (a: number) => number;
    readonly __wbg_get_beesoundoutput_volume: (a: number) => number;
    readonly __wbg_get_beesoundparams_angry: (a: number) => number;
    readonly __wbg_get_beesoundparams_bee_sound_name: (a: number, b: number) => void;
    readonly __wbg_get_beesoundparams_bee_sound_token: (a: number) => bigint;
    readonly __wbg_get_beesoundparams_child: (a: number) => number;
    readonly __wbg_get_beesoundparams_dead: (a: number) => number;
    readonly __wbg_get_beesoundparams_motion_x: (a: number) => number;
    readonly __wbg_get_beesoundparams_motion_z: (a: number) => number;
    readonly __wbg_get_beesoundparams_silent: (a: number) => number;
    readonly __wbg_get_beesoundparams_x: (a: number) => number;
    readonly __wbg_get_beesoundparams_y: (a: number) => number;
    readonly __wbg_get_beesoundparams_z: (a: number) => number;
    readonly __wbg_get_beesoundtickresult_new_token: (a: number) => bigint;
    readonly __wbg_get_beesoundtickresult_pitch: (a: number) => number;
    readonly __wbg_get_beesoundtickresult_position: (a: number, b: number) => void;
    readonly __wbg_get_beesoundtickresult_should_stop: (a: number) => number;
    readonly __wbg_get_beesoundtickresult_sound_loop: (a: number) => number;
    readonly __wbg_get_beesoundtickresult_volume: (a: number) => number;
    readonly __wbg_get_blockpos_x: (a: number) => number;
    readonly __wbg_get_blockpos_y: (a: number) => number;
    readonly __wbg_get_blockpos_z: (a: number) => number;
    readonly __wbg_get_commandresult_success: (a: number) => number;
    readonly __wbg_get_effectstate_ambient: (a: number) => number;
    readonly __wbg_get_effectstate_amplifier: (a: number) => number;
    readonly __wbg_get_effectstate_duration: (a: number) => number;
    readonly __wbg_get_effectstate_hide_particles: (a: number) => number;
    readonly __wbg_get_effectstate_show_icon: (a: number) => number;
    readonly __wbg_get_effectstate_start_tick: (a: number) => bigint;
    readonly __wbg_get_eventsoundinfo_event: (a: number, b: number) => void;
    readonly __wbg_get_eventsoundinfo_found: (a: number) => number;
    readonly __wbg_get_eventsoundinfo_pitch_kind: (a: number) => number;
    readonly __wbg_get_eventsoundinfo_volume: (a: number) => number;
    readonly __wbg_get_fallingblock_age: (a: number) => number;
    readonly __wbg_get_fallingblock_block_state: (a: number) => number;
    readonly __wbg_get_fallingblock_falling_started: (a: number) => number;
    readonly __wbg_get_fallingblock_height: (a: number) => number;
    readonly __wbg_get_fallingblock_motion_x: (a: number) => number;
    readonly __wbg_get_fallingblock_motion_y: (a: number) => number;
    readonly __wbg_get_fallingblock_motion_z: (a: number) => number;
    readonly __wbg_get_fallingblock_no_gravity: (a: number) => number;
    readonly __wbg_get_fallingblock_on_ground: (a: number) => number;
    readonly __wbg_get_fallingblock_width: (a: number) => number;
    readonly __wbg_get_fallingblock_x: (a: number) => number;
    readonly __wbg_get_fallingblock_y: (a: number) => number;
    readonly __wbg_get_fallingblock_z: (a: number) => number;
    readonly __wbg_get_fireentity_entity_type: (a: number) => number;
    readonly __wbg_get_fireentity_gamemode: (a: number) => number;
    readonly __wbg_get_fireentity_height: (a: number) => number;
    readonly __wbg_get_fireentity_id: (a: number) => number;
    readonly __wbg_get_fireentity_kind: (a: number) => number;
    readonly __wbg_get_fireentity_on_fire: (a: number) => number;
    readonly __wbg_get_fireentity_width: (a: number) => number;
    readonly __wbg_get_fireentity_wither: (a: number) => number;
    readonly __wbg_get_fireentity_x: (a: number) => number;
    readonly __wbg_get_fireentity_y: (a: number) => number;
    readonly __wbg_get_fireentity_z: (a: number) => number;
    readonly __wbg_get_fireuv_u0: (a: number) => number;
    readonly __wbg_get_fireuv_u1: (a: number) => number;
    readonly __wbg_get_fireuv_v0: (a: number) => number;
    readonly __wbg_get_fireuv_v1: (a: number) => number;
    readonly __wbg_get_foxanimationargs_fox_crouch_amount: (a: number) => number;
    readonly __wbg_get_foxanimationargs_fox_crouching: (a: number) => number;
    readonly __wbg_get_foxanimationargs_fox_faceplanted: (a: number) => number;
    readonly __wbg_get_foxanimationargs_fox_head_roll: (a: number) => number;
    readonly __wbg_get_foxanimationargs_fox_sleeping: (a: number) => number;
    readonly __wbg_get_foxstate_age: (a: number) => number;
    readonly __wbg_get_foxstate_child: (a: number) => number;
    readonly __wbg_get_foxstate_fox_crouch_amount: (a: number) => number;
    readonly __wbg_get_foxstate_fox_crouching: (a: number) => number;
    readonly __wbg_get_foxstate_fox_defending: (a: number) => number;
    readonly __wbg_get_foxstate_fox_faceplanted: (a: number) => number;
    readonly __wbg_get_foxstate_fox_flags: (a: number) => number;
    readonly __wbg_get_foxstate_fox_interest_amount: (a: number) => number;
    readonly __wbg_get_foxstate_fox_interested: (a: number) => number;
    readonly __wbg_get_foxstate_fox_pouncing: (a: number) => number;
    readonly __wbg_get_foxstate_fox_sleeping: (a: number) => number;
    readonly __wbg_get_foxstate_fox_type: (a: number) => number;
    readonly __wbg_get_foxstate_prev_fox_crouch_amount: (a: number) => number;
    readonly __wbg_get_foxstate_prev_fox_interested: (a: number) => number;
    readonly __wbg_get_foxstate_sitting: (a: number) => number;
    readonly __wbg_get_foxstate_trusted_uuid_0: (a: number) => bigint;
    readonly __wbg_get_foxstate_trusted_uuid_1: (a: number) => bigint;
    readonly __wbg_get_foxtrustpair_uuid_0: (a: number) => bigint;
    readonly __wbg_get_foxtrustpair_uuid_1: (a: number) => bigint;
    readonly __wbg_get_frameresult_fps: (a: number) => number;
    readonly __wbg_get_frameresult_partial_tick: (a: number) => number;
    readonly __wbg_get_frameresult_ticks_run: (a: number) => number;
    readonly __wbg_get_gamestate_allow_flying: (a: number) => number;
    readonly __wbg_get_gamestate_blind: (a: number) => number;
    readonly __wbg_get_gamestate_camera_entity: (a: number) => number;
    readonly __wbg_get_gamestate_chunk_updates: (a: number) => number;
    readonly __wbg_get_gamestate_connected: (a: number) => number;
    readonly __wbg_get_gamestate_creative: (a: number) => number;
    readonly __wbg_get_gamestate_dead: (a: number) => number;
    readonly __wbg_get_gamestate_difficulty: (a: number) => number;
    readonly __wbg_get_gamestate_dimension: (a: number) => number;
    readonly __wbg_get_gamestate_do_daylight_cycle: (a: number) => number;
    readonly __wbg_get_gamestate_done_loading_terrain: (a: number) => number;
    readonly __wbg_get_gamestate_entity_id: (a: number) => number;
    readonly __wbg_get_gamestate_flying: (a: number) => number;
    readonly __wbg_get_gamestate_food: (a: number) => number;
    readonly __wbg_get_gamestate_fov_modifier: (a: number) => number;
    readonly __wbg_get_gamestate_fps: (a: number) => number;
    readonly __wbg_get_gamestate_frame_time_index: (a: number) => number;
    readonly __wbg_get_gamestate_game_mode: (a: number) => number;
    readonly __wbg_get_gamestate_hardcore: (a: number) => number;
    readonly __wbg_get_gamestate_health: (a: number) => number;
    readonly __wbg_get_gamestate_held_slot: (a: number) => number;
    readonly __wbg_get_gamestate_hide_gui: (a: number) => number;
    readonly __wbg_get_gamestate_hurt_time: (a: number) => number;
    readonly __wbg_get_gamestate_in_world: (a: number) => number;
    readonly __wbg_get_gamestate_inventory_open: (a: number) => number;
    readonly __wbg_get_gamestate_jump_boost: (a: number) => number;
    readonly __wbg_get_gamestate_levitation: (a: number) => number;
    readonly __wbg_get_gamestate_max_health: (a: number) => number;
    readonly __wbg_get_gamestate_max_players: (a: number) => number;
    readonly __wbg_get_gamestate_motion_x: (a: number) => number;
    readonly __wbg_get_gamestate_motion_y: (a: number) => number;
    readonly __wbg_get_gamestate_motion_z: (a: number) => number;
    readonly __wbg_get_gamestate_on_ground: (a: number) => number;
    readonly __wbg_get_gamestate_permission_level: (a: number) => number;
    readonly __wbg_get_gamestate_pitch: (a: number) => number;
    readonly __wbg_get_gamestate_portal_time: (a: number) => number;
    readonly __wbg_get_gamestate_prev_fov_modifier: (a: number) => number;
    readonly __wbg_get_gamestate_prev_health: (a: number) => number;
    readonly __wbg_get_gamestate_prev_portal_time: (a: number) => number;
    readonly __wbg_get_gamestate_prev_rain: (a: number) => number;
    readonly __wbg_get_gamestate_previous_game_mode: (a: number) => number;
    readonly __wbg_get_gamestate_rain_strength: (a: number) => number;
    readonly __wbg_get_gamestate_raining: (a: number) => number;
    readonly __wbg_get_gamestate_reduced_debug: (a: number) => number;
    readonly __wbg_get_gamestate_saturation: (a: number) => number;
    readonly __wbg_get_gamestate_show_chunk_borders: (a: number) => number;
    readonly __wbg_get_gamestate_show_debug: (a: number) => number;
    readonly __wbg_get_gamestate_show_hitboxes: (a: number) => number;
    readonly __wbg_get_gamestate_show_lagometer: (a: number) => number;
    readonly __wbg_get_gamestate_show_profiler: (a: number) => number;
    readonly __wbg_get_gamestate_sleeping: (a: number) => number;
    readonly __wbg_get_gamestate_sneaking: (a: number) => number;
    readonly __wbg_get_gamestate_spawn_pos: (a: number) => number;
    readonly __wbg_get_gamestate_spectator: (a: number) => number;
    readonly __wbg_get_gamestate_sprinting: (a: number) => number;
    readonly __wbg_get_gamestate_third_person: (a: number) => number;
    readonly __wbg_get_gamestate_thunder_strength: (a: number) => number;
    readonly __wbg_get_gamestate_thundering: (a: number) => number;
    readonly __wbg_get_gamestate_ticks: (a: number) => bigint;
    readonly __wbg_get_gamestate_time_of_day: (a: number) => bigint;
    readonly __wbg_get_gamestate_using_item: (a: number) => number;
    readonly __wbg_get_gamestate_window_id: (a: number) => number;
    readonly __wbg_get_gamestate_world_age: (a: number) => bigint;
    readonly __wbg_get_gamestate_world_border_radius: (a: number) => number;
    readonly __wbg_get_gamestate_world_border_warning_blocks: (a: number) => number;
    readonly __wbg_get_gamestate_world_border_warning_time: (a: number) => number;
    readonly __wbg_get_gamestate_world_border_x: (a: number) => number;
    readonly __wbg_get_gamestate_world_border_z: (a: number) => number;
    readonly __wbg_get_gamestate_x: (a: number) => number;
    readonly __wbg_get_gamestate_xp_bar: (a: number) => number;
    readonly __wbg_get_gamestate_xp_level: (a: number) => number;
    readonly __wbg_get_gamestate_xp_total: (a: number) => number;
    readonly __wbg_get_gamestate_y: (a: number) => number;
    readonly __wbg_get_gamestate_yaw: (a: number) => number;
    readonly __wbg_get_gamestate_z: (a: number) => number;
    readonly __wbg_get_gametickresult_hurt_time: (a: number) => number;
    readonly __wbg_get_gametickresult_portal_time: (a: number) => number;
    readonly __wbg_get_gametickresult_ticks: (a: number) => bigint;
    readonly __wbg_get_gametickresult_time_of_day: (a: number) => bigint;
    readonly __wbg_get_gametickresult_world_age: (a: number) => bigint;
    readonly __wbg_get_musictrackinfo_event: (a: number, b: number) => void;
    readonly __wbg_get_musictrackinfo_max_delay: (a: number) => number;
    readonly __wbg_get_musictrackinfo_min_delay: (a: number) => number;
    readonly __wbg_get_sleepcamera_pitch: (a: number) => number;
    readonly __wbg_get_sleepcamera_x: (a: number) => number;
    readonly __wbg_get_sleepcamera_y: (a: number) => number;
    readonly __wbg_get_sleepcamera_yaw: (a: number) => number;
    readonly __wbg_get_sleepcamera_z: (a: number) => number;
    readonly __wbg_get_splashanimation_alpha: (a: number) => number;
    readonly __wbg_get_splashanimation_rotation: (a: number) => number;
    readonly __wbg_get_splashanimation_scale: (a: number) => number;
    readonly __wbg_get_splashanimation_x: (a: number) => number;
    readonly __wbg_get_splashanimation_y: (a: number) => number;
    readonly __wbg_get_splashconfig_base_scale: (a: number) => number;
    readonly __wbg_get_splashconfig_logo_size: (a: number) => number;
    readonly __wbg_get_splashscale_logo_x: (a: number) => number;
    readonly __wbg_get_splashscale_logo_y: (a: number) => number;
    readonly __wbg_get_splashscale_scale: (a: number) => number;
    readonly __wbg_get_splashscale_scaled_height: (a: number) => number;
    readonly __wbg_get_splashscale_scaled_width: (a: number) => number;
    readonly __wbg_get_vec3_x: (a: number) => number;
    readonly __wbg_get_vec3_y: (a: number) => number;
    readonly __wbg_get_vec3_z: (a: number) => number;
    readonly __wbg_get_worldupdateresult_rain_strength: (a: number) => number;
    readonly __wbg_get_worldupdateresult_raining: (a: number) => number;
    readonly __wbg_get_worldupdateresult_thunder_strength: (a: number) => number;
    readonly __wbg_get_worldupdateresult_thundering: (a: number) => number;
    readonly __wbg_get_worldupdateresult_world_border_radius: (a: number) => number;
    readonly __wbg_get_worldupdateresult_world_border_x: (a: number) => number;
    readonly __wbg_get_worldupdateresult_world_border_z: (a: number) => number;
    readonly __wbg_itemtablecore_free: (a: number, b: number) => void;
    readonly __wbg_javarandom_free: (a: number, b: number) => void;
    readonly __wbg_modelstorecore_free: (a: number, b: number) => void;
    readonly __wbg_musictrackinfo_free: (a: number, b: number) => void;
    readonly __wbg_packetreader_free: (a: number, b: number) => void;
    readonly __wbg_packetwriter_free: (a: number, b: number) => void;
    readonly __wbg_pistoncore_free: (a: number, b: number) => void;
    readonly __wbg_pngimage_free: (a: number, b: number) => void;
    readonly __wbg_profilesection_free: (a: number, b: number) => void;
    readonly __wbg_profilingdata_free: (a: number, b: number) => void;
    readonly __wbg_recipebookcore_free: (a: number, b: number) => void;
    readonly __wbg_recipebookstate_free: (a: number, b: number) => void;
    readonly __wbg_registrytagscore_free: (a: number, b: number) => void;
    readonly __wbg_scoreboardcore_free: (a: number, b: number) => void;
    readonly __wbg_sectioncullercore_free: (a: number, b: number) => void;
    readonly __wbg_set_advancementprogress_done: (a: number, b: number) => void;
    readonly __wbg_set_advancementprogress_obtained_tick: (a: number, b: number, c: bigint) => void;
    readonly __wbg_set_attributemodifier_amount: (a: number, b: number) => void;
    readonly __wbg_set_attributemodifier_operation: (a: number, b: number) => void;
    readonly __wbg_set_beesoundoutput_pitch: (a: number, b: number) => void;
    readonly __wbg_set_beesoundoutput_volume: (a: number, b: number) => void;
    readonly __wbg_set_beesoundparams_angry: (a: number, b: number) => void;
    readonly __wbg_set_beesoundparams_bee_sound_name: (a: number, b: number, c: number) => void;
    readonly __wbg_set_beesoundparams_bee_sound_token: (a: number, b: bigint) => void;
    readonly __wbg_set_beesoundparams_child: (a: number, b: number) => void;
    readonly __wbg_set_beesoundparams_dead: (a: number, b: number) => void;
    readonly __wbg_set_beesoundparams_motion_x: (a: number, b: number) => void;
    readonly __wbg_set_beesoundparams_motion_z: (a: number, b: number) => void;
    readonly __wbg_set_beesoundparams_silent: (a: number, b: number) => void;
    readonly __wbg_set_beesoundparams_x: (a: number, b: number) => void;
    readonly __wbg_set_beesoundparams_y: (a: number, b: number) => void;
    readonly __wbg_set_beesoundparams_z: (a: number, b: number) => void;
    readonly __wbg_set_beesoundtickresult_new_token: (a: number, b: bigint) => void;
    readonly __wbg_set_beesoundtickresult_pitch: (a: number, b: number) => void;
    readonly __wbg_set_beesoundtickresult_position: (a: number, b: number, c: number) => void;
    readonly __wbg_set_beesoundtickresult_should_stop: (a: number, b: number) => void;
    readonly __wbg_set_beesoundtickresult_sound_loop: (a: number, b: number) => void;
    readonly __wbg_set_beesoundtickresult_volume: (a: number, b: number) => void;
    readonly __wbg_set_blockpos_x: (a: number, b: number) => void;
    readonly __wbg_set_blockpos_y: (a: number, b: number) => void;
    readonly __wbg_set_blockpos_z: (a: number, b: number) => void;
    readonly __wbg_set_commandresult_success: (a: number, b: number) => void;
    readonly __wbg_set_effectstate_ambient: (a: number, b: number) => void;
    readonly __wbg_set_effectstate_amplifier: (a: number, b: number) => void;
    readonly __wbg_set_effectstate_duration: (a: number, b: number) => void;
    readonly __wbg_set_effectstate_hide_particles: (a: number, b: number) => void;
    readonly __wbg_set_effectstate_show_icon: (a: number, b: number) => void;
    readonly __wbg_set_effectstate_start_tick: (a: number, b: bigint) => void;
    readonly __wbg_set_eventsoundinfo_event: (a: number, b: number, c: number) => void;
    readonly __wbg_set_eventsoundinfo_found: (a: number, b: number) => void;
    readonly __wbg_set_eventsoundinfo_pitch_kind: (a: number, b: number) => void;
    readonly __wbg_set_eventsoundinfo_volume: (a: number, b: number) => void;
    readonly __wbg_set_fallingblock_age: (a: number, b: number) => void;
    readonly __wbg_set_fallingblock_block_state: (a: number, b: number) => void;
    readonly __wbg_set_fallingblock_falling_started: (a: number, b: number) => void;
    readonly __wbg_set_fallingblock_height: (a: number, b: number) => void;
    readonly __wbg_set_fallingblock_motion_x: (a: number, b: number) => void;
    readonly __wbg_set_fallingblock_motion_y: (a: number, b: number) => void;
    readonly __wbg_set_fallingblock_motion_z: (a: number, b: number) => void;
    readonly __wbg_set_fallingblock_no_gravity: (a: number, b: number) => void;
    readonly __wbg_set_fallingblock_on_ground: (a: number, b: number) => void;
    readonly __wbg_set_fallingblock_width: (a: number, b: number) => void;
    readonly __wbg_set_fallingblock_x: (a: number, b: number) => void;
    readonly __wbg_set_fallingblock_y: (a: number, b: number) => void;
    readonly __wbg_set_fallingblock_z: (a: number, b: number) => void;
    readonly __wbg_set_fireentity_entity_type: (a: number, b: number) => void;
    readonly __wbg_set_fireentity_gamemode: (a: number, b: number) => void;
    readonly __wbg_set_fireentity_height: (a: number, b: number) => void;
    readonly __wbg_set_fireentity_id: (a: number, b: number) => void;
    readonly __wbg_set_fireentity_kind: (a: number, b: number) => void;
    readonly __wbg_set_fireentity_on_fire: (a: number, b: number) => void;
    readonly __wbg_set_fireentity_width: (a: number, b: number) => void;
    readonly __wbg_set_fireentity_wither: (a: number, b: number) => void;
    readonly __wbg_set_fireentity_x: (a: number, b: number) => void;
    readonly __wbg_set_fireentity_y: (a: number, b: number) => void;
    readonly __wbg_set_fireentity_z: (a: number, b: number) => void;
    readonly __wbg_set_fireuv_u0: (a: number, b: number) => void;
    readonly __wbg_set_fireuv_u1: (a: number, b: number) => void;
    readonly __wbg_set_fireuv_v0: (a: number, b: number) => void;
    readonly __wbg_set_fireuv_v1: (a: number, b: number) => void;
    readonly __wbg_set_foxanimationargs_fox_crouch_amount: (a: number, b: number) => void;
    readonly __wbg_set_foxanimationargs_fox_crouching: (a: number, b: number) => void;
    readonly __wbg_set_foxanimationargs_fox_faceplanted: (a: number, b: number) => void;
    readonly __wbg_set_foxanimationargs_fox_head_roll: (a: number, b: number) => void;
    readonly __wbg_set_foxanimationargs_fox_sleeping: (a: number, b: number) => void;
    readonly __wbg_set_foxstate_age: (a: number, b: number) => void;
    readonly __wbg_set_foxstate_child: (a: number, b: number) => void;
    readonly __wbg_set_foxstate_fox_crouch_amount: (a: number, b: number) => void;
    readonly __wbg_set_foxstate_fox_crouching: (a: number, b: number) => void;
    readonly __wbg_set_foxstate_fox_defending: (a: number, b: number) => void;
    readonly __wbg_set_foxstate_fox_faceplanted: (a: number, b: number) => void;
    readonly __wbg_set_foxstate_fox_flags: (a: number, b: number) => void;
    readonly __wbg_set_foxstate_fox_interest_amount: (a: number, b: number) => void;
    readonly __wbg_set_foxstate_fox_interested: (a: number, b: number) => void;
    readonly __wbg_set_foxstate_fox_pouncing: (a: number, b: number) => void;
    readonly __wbg_set_foxstate_fox_sleeping: (a: number, b: number) => void;
    readonly __wbg_set_foxstate_fox_type: (a: number, b: number) => void;
    readonly __wbg_set_foxstate_prev_fox_crouch_amount: (a: number, b: number) => void;
    readonly __wbg_set_foxstate_prev_fox_interested: (a: number, b: number) => void;
    readonly __wbg_set_foxstate_sitting: (a: number, b: number) => void;
    readonly __wbg_set_foxstate_trusted_uuid_0: (a: number, b: bigint) => void;
    readonly __wbg_set_foxstate_trusted_uuid_1: (a: number, b: bigint) => void;
    readonly __wbg_set_foxtrustpair_uuid_0: (a: number, b: bigint) => void;
    readonly __wbg_set_foxtrustpair_uuid_1: (a: number, b: bigint) => void;
    readonly __wbg_set_frameresult_fps: (a: number, b: number) => void;
    readonly __wbg_set_frameresult_partial_tick: (a: number, b: number) => void;
    readonly __wbg_set_frameresult_ticks_run: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_allow_flying: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_blind: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_camera_entity: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_chunk_updates: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_connected: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_creative: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_dead: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_difficulty: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_dimension: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_do_daylight_cycle: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_done_loading_terrain: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_entity_id: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_flying: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_food: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_fov_modifier: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_fps: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_frame_time_index: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_game_mode: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_hardcore: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_health: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_held_slot: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_hide_gui: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_hurt_time: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_in_world: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_inventory_open: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_jump_boost: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_levitation: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_max_health: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_max_players: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_motion_x: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_motion_y: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_motion_z: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_on_ground: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_permission_level: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_pitch: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_portal_time: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_prev_fov_modifier: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_prev_health: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_prev_portal_time: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_prev_rain: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_previous_game_mode: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_rain_strength: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_raining: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_reduced_debug: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_saturation: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_show_chunk_borders: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_show_debug: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_show_hitboxes: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_show_lagometer: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_show_profiler: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_sleeping: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_sneaking: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_spawn_pos: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_spectator: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_sprinting: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_third_person: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_thunder_strength: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_thundering: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_ticks: (a: number, b: bigint) => void;
    readonly __wbg_set_gamestate_time_of_day: (a: number, b: bigint) => void;
    readonly __wbg_set_gamestate_using_item: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_window_id: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_world_age: (a: number, b: bigint) => void;
    readonly __wbg_set_gamestate_world_border_radius: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_world_border_warning_blocks: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_world_border_warning_time: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_world_border_x: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_world_border_z: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_x: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_xp_bar: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_xp_level: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_xp_total: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_y: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_yaw: (a: number, b: number) => void;
    readonly __wbg_set_gamestate_z: (a: number, b: number) => void;
    readonly __wbg_set_gametickresult_hurt_time: (a: number, b: number) => void;
    readonly __wbg_set_gametickresult_portal_time: (a: number, b: number) => void;
    readonly __wbg_set_gametickresult_ticks: (a: number, b: bigint) => void;
    readonly __wbg_set_gametickresult_time_of_day: (a: number, b: bigint) => void;
    readonly __wbg_set_gametickresult_world_age: (a: number, b: bigint) => void;
    readonly __wbg_set_musictrackinfo_event: (a: number, b: number, c: number) => void;
    readonly __wbg_set_musictrackinfo_max_delay: (a: number, b: number) => void;
    readonly __wbg_set_musictrackinfo_min_delay: (a: number, b: number) => void;
    readonly __wbg_set_sleepcamera_pitch: (a: number, b: number) => void;
    readonly __wbg_set_sleepcamera_x: (a: number, b: number) => void;
    readonly __wbg_set_sleepcamera_y: (a: number, b: number) => void;
    readonly __wbg_set_sleepcamera_yaw: (a: number, b: number) => void;
    readonly __wbg_set_sleepcamera_z: (a: number, b: number) => void;
    readonly __wbg_set_splashanimation_alpha: (a: number, b: number) => void;
    readonly __wbg_set_splashanimation_rotation: (a: number, b: number) => void;
    readonly __wbg_set_splashanimation_scale: (a: number, b: number) => void;
    readonly __wbg_set_splashanimation_x: (a: number, b: number) => void;
    readonly __wbg_set_splashanimation_y: (a: number, b: number) => void;
    readonly __wbg_set_splashconfig_base_scale: (a: number, b: number) => void;
    readonly __wbg_set_splashconfig_logo_size: (a: number, b: number) => void;
    readonly __wbg_set_splashscale_logo_x: (a: number, b: number) => void;
    readonly __wbg_set_splashscale_logo_y: (a: number, b: number) => void;
    readonly __wbg_set_splashscale_scale: (a: number, b: number) => void;
    readonly __wbg_set_splashscale_scaled_height: (a: number, b: number) => void;
    readonly __wbg_set_splashscale_scaled_width: (a: number, b: number) => void;
    readonly __wbg_set_vec3_x: (a: number, b: number) => void;
    readonly __wbg_set_vec3_y: (a: number, b: number) => void;
    readonly __wbg_set_vec3_z: (a: number, b: number) => void;
    readonly __wbg_set_worldupdateresult_rain_strength: (a: number, b: number) => void;
    readonly __wbg_set_worldupdateresult_raining: (a: number, b: number) => void;
    readonly __wbg_set_worldupdateresult_thunder_strength: (a: number, b: number) => void;
    readonly __wbg_set_worldupdateresult_thundering: (a: number, b: number) => void;
    readonly __wbg_set_worldupdateresult_world_border_radius: (a: number, b: number) => void;
    readonly __wbg_set_worldupdateresult_world_border_x: (a: number, b: number) => void;
    readonly __wbg_set_worldupdateresult_world_border_z: (a: number, b: number) => void;
    readonly __wbg_sleepcamera_free: (a: number, b: number) => void;
    readonly __wbg_sleepdelta_free: (a: number, b: number) => void;
    readonly __wbg_sleepstate_free: (a: number, b: number) => void;
    readonly __wbg_slicedata_free: (a: number, b: number) => void;
    readonly __wbg_softwaredevice_free: (a: number, b: number) => void;
    readonly __wbg_splashanimation_free: (a: number, b: number) => void;
    readonly __wbg_splashconfig_free: (a: number, b: number) => void;
    readonly __wbg_splashscale_free: (a: number, b: number) => void;
    readonly __wbg_tilerenderercore_free: (a: number, b: number) => void;
    readonly __wbg_vec3_free: (a: number, b: number) => void;
    readonly __wbg_visgraph_free: (a: number, b: number) => void;
    readonly __wbg_worldcore_free: (a: number, b: number) => void;
    readonly __wbg_worldupdateresult_free: (a: number, b: number) => void;
    readonly __wbg_worldview_free: (a: number, b: number) => void;
    readonly __wbg_ziparchive_free: (a: number, b: number) => void;
    readonly active_glsl_wasm: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly add_coord_wasm: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly add_statistic: (a: number, b: number, c: number, d: number, e: number, f: bigint) => void;
    readonly advancementprogress_new: () => number;
    readonly advancementscore_all_ids_json: (a: number, b: number) => void;
    readonly advancementscore_clear: (a: number) => void;
    readonly advancementscore_get_json: (a: number, b: number, c: number, d: number) => void;
    readonly advancementscore_get_progress_json: (a: number, b: number, c: number, d: number) => void;
    readonly advancementscore_has_progress: (a: number, b: number, c: number) => number;
    readonly advancementscore_is_done: (a: number, b: number, c: number) => number;
    readonly advancementscore_new: () => number;
    readonly advancementscore_on_packet: (a: number, b: number, c: number, d: number) => void;
    readonly advancementscore_percent: (a: number, b: number, c: number) => number;
    readonly advancementscore_progress_text: (a: number, b: number, c: number, d: number) => void;
    readonly advancementscore_select_tab: (a: number, b: number, c: number) => number;
    readonly advancementscore_selected_tab: (a: number, b: number) => void;
    readonly advancementscore_tabs_json: (a: number, b: number) => void;
    readonly advancementscore_to_json: (a: number, b: number) => void;
    readonly animate_biped_model: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly animate_quadruped_model: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly animate_skeleton_model: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly animate_zombie_model: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly animation_lookup_wasm: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly apply_fox_flags: (a: number, b: number, c: number, d: number) => void;
    readonly apply_metadata: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly apply_to_rider: (a: number, b: number, c: number) => number;
    readonly banner_add_pattern: (a: number, b: number, c: number, d: number) => void;
    readonly banner_base_color: (a: number) => number;
    readonly banner_composite: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number) => void;
    readonly banner_layers_flat: (a: number, b: number) => void;
    readonly banner_new: (a: number) => number;
    readonly banner_pattern_count: (a: number) => number;
    readonly banner_pattern_names: (a: number) => void;
    readonly banner_pattern_uv: (a: number, b: number, c: number, d: number) => void;
    readonly banner_vertices: (a: number, b: number, c: number, d: number) => void;
    readonly base_fog_color_wasm: (a: number, b: number) => void;
    readonly bedsleep_bed_pos: (a: number) => number;
    readonly bedsleep_can_sleep: (a: number, b: bigint, c: number, d: number) => number;
    readonly bedsleep_find_bed: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
    readonly bedsleep_is_sleeping: (a: number) => number;
    readonly bedsleep_new: () => number;
    readonly bedsleep_set_sleep_start_tick: (a: number, b: bigint) => void;
    readonly bedsleep_sleep_start_tick: (a: number, b: number) => void;
    readonly bedsleep_start_sleeping: (a: number, b: number, c: number) => void;
    readonly bedsleep_stop_sleeping: (a: number, b: number) => void;
    readonly bedsleep_wake_up: (a: number, b: number) => void;
    readonly bedvalidationresult_facing: (a: number) => number;
    readonly bedvalidationresult_foot_pos: (a: number) => number;
    readonly bedvalidationresult_head_pos: (a: number) => number;
    readonly bedvalidationresult_valid: (a: number) => number;
    readonly bee_sound_event_name: (a: number, b: number) => void;
    readonly bee_sound_loop_name: (a: number, b: number) => void;
    readonly bee_sound_parameters: (a: number) => number;
    readonly bee_sound_stop: (a: number) => void;
    readonly bee_sound_tick: (a: number) => number;
    readonly bee_sound_trigger: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly biome_rain_type: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly biomezoom_cell: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly biomezoom_new: (a: bigint) => number;
    readonly biomezoom_offset: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly biomezoom_seed: (a: number) => bigint;
    readonly blockpos_new: (a: number, b: number, c: number) => number;
    readonly blockregistrycore_block_id: (a: number, b: number) => number;
    readonly blockregistrycore_block_name: (a: number, b: number, c: number) => void;
    readonly blockregistrycore_collision_boxes: (a: number, b: number, c: number) => void;
    readonly blockregistrycore_emit_light: (a: number, b: number) => number;
    readonly blockregistrycore_filter_light: (a: number, b: number) => number;
    readonly blockregistrycore_find_state: (a: number, b: number, c: number, d: number, e: number) => number;
    readonly blockregistrycore_has_model: (a: number, b: number) => number;
    readonly blockregistrycore_is_liquid: (a: number, b: number) => number;
    readonly blockregistrycore_is_stairs: (a: number, b: number) => number;
    readonly blockregistrycore_new: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly blockregistrycore_opaque: (a: number, b: number) => number;
    readonly blockregistrycore_properties_json: (a: number, b: number, c: number) => void;
    readonly blockregistrycore_slipperiness: (a: number, b: number) => number;
    readonly blockregistrycore_state_count: (a: number) => number;
    readonly blockregistrycore_state_name: (a: number, b: number, c: number) => void;
    readonly boat_status: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly boot_launch_action: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly boot_step_count: () => number;
    readonly boot_step_label: (a: number, b: number) => void;
    readonly boxmodel_bake: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly boxmodel_transform_part: (a: number, b: number, c: number) => void;
    readonly boxmodelcore_add_child: (a: number, b: number) => void;
    readonly boxmodelcore_bake: (a: number, b: number, c: number) => void;
    readonly boxmodelcore_box_elem: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => void;
    readonly boxmodelcore_mirror: (a: number, b: number) => void;
    readonly boxmodelcore_new: (a: number, b: number) => number;
    readonly boxmodelcore_pivot: (a: number, b: number, c: number, d: number) => void;
    readonly boxmodelcore_rot: (a: number, b: number, c: number, d: number) => void;
    readonly boxmodelcore_tex: (a: number, b: number, c: number) => void;
    readonly boxmodelcore_to_json: (a: number, b: number) => void;
    readonly boxmodelcore_visible: (a: number, b: number) => void;
    readonly brightness_table_wasm: (a: number, b: number) => void;
    readonly browser_key_prevent_default: (a: number, b: number, c: number) => number;
    readonly browser_potato_layout: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly browser_wheel_delta: (a: number, b: number) => number;
    readonly build_star_positions_wasm: (a: number) => void;
    readonly calc_x_offset: (a: number, b: number, c: number, d: number, e: number) => number;
    readonly calc_y_offset: (a: number, b: number, c: number, d: number, e: number) => number;
    readonly calc_z_offset: (a: number, b: number, c: number, d: number, e: number) => number;
    readonly calculate_attribute_value: (a: number, b: number) => number;
    readonly calculate_regional_difficulty: (a: number, b: bigint, c: bigint, d: number) => number;
    readonly calculate_sleeping_camera: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => number;
    readonly calculate_wake_time: (a: bigint) => bigint;
    readonly cameraeye_height: (a: number, b: number, c: number) => number;
    readonly cameraeye_new: () => number;
    readonly cameraeye_reset: (a: number) => void;
    readonly cameraeye_tick: (a: number, b: number) => void;
    readonly can_skip_night: (a: number, b: number) => number;
    readonly can_sleep: (a: bigint, b: number) => number;
    readonly celestial_angle_wasm: (a: number, b: number) => number;
    readonly cfb8_new: (a: number, b: number, c: number, d: number) => void;
    readonly cfb8_update: (a: number, b: number, c: number, d: number) => void;
    readonly check_advancements: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly chunkcolumn_biomes: (a: number, b: number) => void;
    readonly chunkcolumn_blocks: (a: number, b: number, c: number) => void;
    readonly chunkcolumn_has_biomes: (a: number) => number;
    readonly chunkcolumn_non_air: (a: number, b: number) => number;
    readonly chunkcolumn_present: (a: number, b: number) => number;
    readonly chunkcolumn_wire_non_air: (a: number, b: number) => number;
    readonly clear_recipes: (a: number) => void;
    readonly cloud_color_wasm: (a: number, b: number, c: number, d: number) => void;
    readonly commandresult_message: (a: number, b: number) => void;
    readonly compute_visibility_mask: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly container_armor_points: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly container_armor_type: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly container_full_add_to_inventory: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly container_full_armor_points: (a: number, b: number, c: number, d: number) => number;
    readonly container_full_armor_type: (a: number, b: number, c: number, d: number) => number;
    readonly container_full_build_inventory_slots: (a: number) => void;
    readonly container_full_build_window_slots: (a: number, b: number, c: number, d: number) => void;
    readonly container_full_can_hold_potion: (a: number, b: number, c: number, d: number) => number;
    readonly container_full_configure_slot: (a: number, b: number, c: number, d: number) => void;
    readonly container_full_consume_grid: (a: number, b: number, c: number) => void;
    readonly container_full_copy: (a: number, b: number, c: number) => void;
    readonly container_full_first_empty: (a: number, b: number) => number;
    readonly container_full_inventory_transfer_plan: (a: number, b: number) => void;
    readonly container_full_is_beacon_payment: (a: number, b: number) => number;
    readonly container_full_is_brewing_ingredient: (a: number, b: number) => number;
    readonly container_full_is_chest_type: (a: number, b: number) => number;
    readonly container_full_is_fuel: (a: number, b: number) => number;
    readonly container_full_is_horse_armor: (a: number, b: number) => number;
    readonly container_full_is_smelatable: (a: number, b: number) => number;
    readonly container_full_item_name: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly container_full_merge_item_stack: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly container_full_nbt_equal: (a: number, b: number, c: number, d: number) => number;
    readonly container_full_next_action: (a: number) => number;
    readonly container_full_on_close_indices: (a: number, b: number, c: number) => void;
    readonly container_full_on_pickup_from_slot: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly container_full_on_slot_changed: (a: number, b: number, c: number, d: number) => void;
    readonly container_full_result_slot_takes_all: (a: number, b: number, c: number) => number;
    readonly container_full_slot_click: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly container_full_stackable: (a: number, b: number, c: number, d: number) => number;
    readonly container_full_transfer_plan: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => void;
    readonly container_full_window_size: (a: number, b: number, c: number) => number;
    readonly container_is_beacon_payment: (a: number, b: number) => number;
    readonly container_is_brewing_ingredient: (a: number, b: number) => number;
    readonly container_is_fuel: (a: number, b: number) => number;
    readonly container_is_horse_armor: (a: number, b: number) => number;
    readonly container_is_smelatable: (a: number, b: number) => number;
    readonly container_item_wasm: (a: number, b: number, c: number, d: number) => void;
    readonly container_slot_click: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => void;
    readonly core_version: (a: number) => void;
    readonly count_non_air: (a: number, b: number, c: number, d: number) => number;
    readonly craftingtablecore_craft: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly craftingtablecore_new: (a: number, b: number, c: number) => void;
    readonly craftingtablecore_shaped_count: (a: number) => number;
    readonly craftingtablecore_shapeless_count: (a: number) => number;
    readonly create_arm_animation_packet: (a: number, b: number, c: number) => void;
    readonly create_block_dig_packet: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly create_block_place_packet: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number) => void;
    readonly create_chat_packet: (a: number, b: number, c: number, d: number) => void;
    readonly create_client_command_packet: (a: number, b: number, c: number) => void;
    readonly create_close_window_packet: (a: number, b: number, c: number) => void;
    readonly create_custom_payload_packet: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly create_entity_action_packet: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly create_flying_packet: (a: number, b: number, c: number) => void;
    readonly create_held_item_slot_packet: (a: number, b: number, c: number) => void;
    readonly create_keep_alive_packet: (a: number, b: bigint, c: number) => void;
    readonly create_look_packet: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly create_name_item_packet: (a: number, b: number, c: number, d: number) => void;
    readonly create_place_recipe_packet: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly create_position_look_packet: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => void;
    readonly create_position_packet: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly create_recipe_info_settings_packet: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number) => void;
    readonly create_recipe_info_shown_packet: (a: number, b: number, c: number, d: number) => void;
    readonly create_resource_pack_status_packet: (a: number, b: number, c: number) => void;
    readonly create_seen_advancements_packet: (a: number, b: number, c: number, d: number) => void;
    readonly create_select_trade_packet: (a: number, b: number, c: number) => void;
    readonly create_set_beacon_effects_packet: (a: number, b: number, c: number, d: number) => void;
    readonly create_settings_packet: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => void;
    readonly create_spectate_packet: (a: number, b: number, c: number, d: number) => void;
    readonly create_steer_vehicle_packet: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly create_tab_complete_packet: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly create_teleport_confirm_packet: (a: number, b: number, c: number) => void;
    readonly create_transaction_packet: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly create_use_entity_packet: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => void;
    readonly create_use_item_packet: (a: number, b: number, c: number) => void;
    readonly crystal_beam: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly crystal_bob: (a: number) => number;
    readonly day_cycle_calculate_wake_time: (a: bigint) => bigint;
    readonly day_cycle_celestial_angle: (a: bigint, b: number) => number;
    readonly debug_lines_batch: (a: number, b: number, c: number) => void;
    readonly debug_lines_box: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly debug_lines_chunk_borders: (a: number, b: number, c: number, d: number) => void;
    readonly debug_lines_entity_hitbox: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number) => void;
    readonly debug_lines_line: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly decode_base64: (a: number, b: number, c: number) => void;
    readonly decode_base85: (a: number, b: number, c: number, d: number) => void;
    readonly decode_chunk_498: (a: number, b: number, c: number, d: number, e: number) => number;
    readonly decode_chunk_578: (a: number, b: number, c: number, d: number) => number;
    readonly decode_entity_metadata: (a: number, b: number, c: number) => void;
    readonly decode_packet_498_json: (a: number, b: number, c: number) => void;
    readonly decode_packet_578_json: (a: number, b: number, c: number) => void;
    readonly decode_png: (a: number, b: number) => number;
    readonly decode_section: (a: number, b: number, c: number, d: number, e: number) => number;
    readonly decode_slot: (a: number, b: number, c: number) => void;
    readonly decode_utf8: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly decodedpacket_data: (a: number, b: number) => void;
    readonly decodedpacket_packet_id: (a: number) => number;
    readonly decodedpacket_packet_name: (a: number, b: number) => void;
    readonly difficulty_allows_hostile_spawns: (a: number) => number;
    readonly difficulty_spawn_multiplier: (a: number) => number;
    readonly door_props_wasm: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly dragon_corpse_matrix: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => void;
    readonly dragon_death_rays: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number) => void;
    readonly dragon_parts: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number) => void;
    readonly dye_color_rgb: (a: number) => number;
    readonly encode_base64: (a: number, b: number, c: number) => void;
    readonly encode_png: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly encode_slot: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly encode_utf8: (a: number, b: number, c: number) => void;
    readonly entity_effect_particles: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: bigint) => void;
    readonly entity_fire_geometry: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number) => number;
    readonly entity_glow_vertices: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => void;
    readonly entity_should_burn: (a: number) => number;
    readonly falling_block_land: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
    readonly falling_block_physics: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number) => void;
    readonly fallingblock_bounding_box: (a: number, b: number) => void;
    readonly fallingblock_new: (a: number, b: number, c: number, d: number) => number;
    readonly fallingblock_tick: (a: number, b: number, c: number) => number;
    readonly fast_inv_sqrt: (a: number) => number;
    readonly fast_inv_sqrt_wasm: (a: number) => number;
    readonly fire_overlay_geometry: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => number;
    readonly fire_overlay_projection: (a: number, b: number, c: number) => void;
    readonly firegeometryresult_is_empty: (a: number) => number;
    readonly firegeometryresult_quad_count: (a: number) => number;
    readonly firegeometryresult_vertex_count: (a: number) => number;
    readonly firegeometryresult_vertices: (a: number, b: number) => void;
    readonly fireoverlaygeometryresult_is_empty: (a: number) => number;
    readonly fireoverlaygeometryresult_vertex_count: (a: number) => number;
    readonly fireoverlaygeometryresult_vertices: (a: number, b: number) => void;
    readonly fish_pattern: (a: number) => number;
    readonly fish_shape: (a: number) => number;
    readonly fluid_height: (a: number, b: number) => number;
    readonly fluid_state: (a: number, b: number, c: number, d: number, e: number) => number;
    readonly fluidstate_height: (a: number) => number;
    readonly fluidstate_is_lava: (a: number) => number;
    readonly fluidstate_is_water: (a: number) => number;
    readonly fluidstate_level: (a: number) => number;
    readonly fluidstate_source: (a: number) => number;
    readonly foliage_color: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => number;
    readonly format_address: (a: number, b: number, c: number, d: number) => void;
    readonly fox_ai_tick: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number, o: number, p: number, q: number, r: number, s: number) => number;
    readonly fox_animation_args: (a: number, b: number, c: number, d: number) => void;
    readonly fox_can_breed: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
    readonly fox_can_navigate: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
    readonly fox_flee: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => void;
    readonly fox_held_item: (a: number, b: number) => number;
    readonly fox_move_towards: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly fox_pose: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number) => void;
    readonly fox_pounce: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => void;
    readonly fox_scale: (a: number, b: number) => void;
    readonly fox_select_target: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number) => number;
    readonly fox_set_held_item: (a: number, b: number, c: number, d: number) => void;
    readonly fox_should_sleep: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => number;
    readonly fox_should_wake: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => number;
    readonly fox_sound_trigger: (a: number, b: number, c: number) => number;
    readonly fox_update_trust: (a: bigint, b: bigint, c: bigint, d: bigint, e: number, f: number) => number;
    readonly foxaitickresult_behavior: (a: number) => number;
    readonly foxaitickresult_new: (a: number, b: number) => number;
    readonly foxaitickresult_target: (a: number) => number;
    readonly foxstate_animation_args: (a: number, b: number) => number;
    readonly foxstate_apply_flags: (a: number, b: number) => void;
    readonly foxstate_flags: (a: number) => number;
    readonly foxstate_new: () => number;
    readonly foxstate_tick: (a: number) => void;
    readonly foxtargetresult_distance_sq: (a: number) => number;
    readonly foxtargetresult_new: () => number;
    readonly foxtargetresult_target_entity_id: (a: number) => number;
    readonly foxtargetresult_target_type: (a: number) => number;
    readonly foxtargetresult_target_x: (a: number) => number;
    readonly foxtargetresult_target_y: (a: number) => number;
    readonly foxtargetresult_target_z: (a: number) => number;
    readonly foxtargetresult_valid: (a: number) => number;
    readonly foxtrustpair_new: (a: bigint, b: bigint) => number;
    readonly frustum_contains_aabb: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => number;
    readonly frustum_from_matrix: (a: number, b: number, c: number) => void;
    readonly frustum_new: () => number;
    readonly frustum_planes: (a: number, b: number) => void;
    readonly game_get_statistic: (a: number, b: number, c: number, d: number) => bigint;
    readonly game_profiler_mark_end: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly game_profiler_mark_start: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly game_update_recipe_book: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly game_update_statistic: (a: number, b: number, c: number, d: number, e: number, f: bigint) => void;
    readonly gamecore_apply_game_mode: (a: number) => void;
    readonly gamecore_camera_position: (a: number, b: number, c: number) => number;
    readonly gamecore_frame: (a: number, b: number) => number;
    readonly gamecore_get_profiler_data: (a: number) => number;
    readonly gamecore_get_state: (a: number) => number;
    readonly gamecore_initialize: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: bigint, i: bigint, j: number, k: number, l: bigint, m: number) => void;
    readonly gamecore_look_vector: (a: number, b: number) => number;
    readonly gamecore_new: () => number;
    readonly gamecore_process_commands: (a: number, b: number, c: number, d: number) => void;
    readonly gamecore_record_chunk_update: (a: number) => void;
    readonly gamecore_remove_effect: (a: number, b: number) => void;
    readonly gamecore_respawn: (a: number) => void;
    readonly gamecore_set_difficulty: (a: number, b: number) => void;
    readonly gamecore_set_dimension: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: bigint) => void;
    readonly gamecore_set_effect: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly gamecore_set_game_mode: (a: number, b: number) => void;
    readonly gamecore_set_held_slot: (a: number, b: number) => void;
    readonly gamecore_set_profiler_enabled: (a: number, b: number) => void;
    readonly gamecore_set_sleeping: (a: number, b: number, c: number) => void;
    readonly gamecore_set_state: (a: number, b: number, c: number) => void;
    readonly gamecore_tick: (a: number, b: number) => number;
    readonly gamecore_update_effects: (a: number) => void;
    readonly gamecore_update_player_health: (a: number, b: number, c: number, d: number) => void;
    readonly gamecore_update_player_position: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number) => void;
    readonly gamecore_update_player_xp: (a: number, b: number, c: number, d: number) => void;
    readonly gamecore_update_world: (a: number) => number;
    readonly gamecore_update_world_border: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => void;
    readonly get_bed_facing: (a: number, b: number, c: number, d: number) => number;
    readonly get_block_light: (a: number, b: number, c: number) => number;
    readonly get_block_model_json: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly get_day_phase: (a: number, b: bigint) => void;
    readonly get_mob_cap: (a: number, b: number, c: number, d: number) => number;
    readonly get_packet_id: (a: number, b: number, c: number, d: number) => number;
    readonly get_packet_name: (a: number, b: number, c: number, d: number) => void;
    readonly get_sky_light: (a: number, b: number, c: number) => number;
    readonly get_spawn_weight: (a: number, b: number, c: number, d: number) => number;
    readonly get_statistic: (a: number, b: number, c: number, d: number) => bigint;
    readonly get_unlocked_count: (a: number) => number;
    readonly glsl_condition_wasm: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly glsl_float_literals_wasm: (a: number, b: number, c: number) => void;
    readonly grass_color: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => number;
    readonly guardian_beam: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => void;
    readonly hanging_box: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly has_jar_model: (a: number, b: number) => number;
    readonly honey_fall_multiplier_wasm: (a: number, b: number) => number;
    readonly honey_jump_factor_wasm: (a: number, b: number) => number;
    readonly honey_movement_factor_wasm: (a: number, b: number) => number;
    readonly horse_jump_power: (a: number) => number;
    readonly interaction_block_break_progress: (a: number, b: number) => number;
    readonly interaction_cooldown_period: (a: number) => number;
    readonly interaction_cooled_attack_strength: (a: number, b: number, c: number) => number;
    readonly interpolate_position: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => void;
    readonly is_day_time: (a: bigint) => number;
    readonly is_dragon: (a: number, b: number, c: number) => number;
    readonly is_eagler_address: (a: number, b: number) => number;
    readonly is_interactive_entity: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
    readonly is_lighting_option_wasm: (a: number, b: number) => number;
    readonly is_night_time: (a: bigint) => number;
    readonly is_recipe_highlighted: (a: number, b: number, c: number) => number;
    readonly is_recipe_unlocked: (a: number, b: number, c: number) => number;
    readonly is_snap_kind: (a: number, b: number) => number;
    readonly is_valid_spawn_position: (a: number, b: number, c: number) => number;
    readonly item_frame_box: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly item_model_name_wasm: (a: number, b: number, c: number, d: number) => void;
    readonly itemtablecore_can_always_eat: (a: number, b: number) => number;
    readonly itemtablecore_can_harvest: (a: number, b: number, c: number, d: number) => number;
    readonly itemtablecore_cursor_color: (a: number, b: number, c: number, d: number) => void;
    readonly itemtablecore_egg_entity: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly itemtablecore_egg_info: (a: number, b: number, c: number) => void;
    readonly itemtablecore_enchantment_key: (a: number, b: number, c: number, d: number) => void;
    readonly itemtablecore_enchantments: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly itemtablecore_has_effect: (a: number, b: number, c: number, d: number) => number;
    readonly itemtablecore_is_enchanted: (a: number, b: number, c: number, d: number) => number;
    readonly itemtablecore_is_food: (a: number, b: number) => number;
    readonly itemtablecore_is_single_level: (a: number, b: number, c: number) => number;
    readonly itemtablecore_item_key: (a: number, b: number, c: number) => void;
    readonly itemtablecore_max_durability: (a: number, b: number) => number;
    readonly itemtablecore_max_stack: (a: number, b: number) => number;
    readonly itemtablecore_name: (a: number, b: number, c: number) => void;
    readonly itemtablecore_new: (a: number, b: number, c: number) => void;
    readonly itemtablecore_potion_color: (a: number, b: number, c: number, d: number) => bigint;
    readonly itemtablecore_potion_effects: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly itemtablecore_rarity: (a: number, b: number, c: number, d: number) => number;
    readonly itemtablecore_str_vs_block: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
    readonly itemtablecore_use_action: (a: number, b: number, c: number) => void;
    readonly itemtablecore_use_duration: (a: number, b: number, c: number, d: number) => number;
    readonly javarandom_new: (a: number, b: bigint) => number;
    readonly javarandom_next: (a: number, b: number) => number;
    readonly javarandom_next_double: (a: number) => number;
    readonly javarandom_next_float: (a: number) => number;
    readonly javarandom_next_int: (a: number, b: number) => number;
    readonly javarandom_set_seed: (a: number, b: bigint) => void;
    readonly js_category_of: (a: number, b: number, c: number) => void;
    readonly js_clamp_pitch: (a: number) => number;
    readonly js_event_sound: (a: number) => number;
    readonly js_global_event_sound: (a: number, b: number) => void;
    readonly js_is_hostile_type: (a: number, b: number) => number;
    readonly js_max_distance: (a: number) => number;
    readonly js_mood_lcg_next: (a: number) => number;
    readonly js_options_default_key: (a: number, b: number, c: number) => void;
    readonly js_options_difficulty_name: (a: number, b: number) => void;
    readonly js_options_fov_label: (a: number, b: number) => void;
    readonly js_options_gamma_label: (a: number, b: number) => void;
    readonly js_options_key_binding_category: (a: number, b: number) => void;
    readonly js_options_key_binding_description: (a: number, b: number) => void;
    readonly js_options_mouse_wheel_label: (a: number, b: number) => void;
    readonly js_options_render_distance_label: (a: number, b: number) => void;
    readonly js_sound_asset_name: (a: number, b: number, c: number) => void;
    readonly js_voice_volume: (a: number, b: number, c: number) => number;
    readonly js_webgpu_endportal_texgen: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => void;
    readonly js_webgpu_entity_shade: (a: number, b: number, c: number, d: number) => number;
    readonly js_webgpu_fog_factor: (a: number, b: number, c: number) => number;
    readonly js_webgpu_lightmap_uv: (a: number, b: number, c: number) => void;
    readonly js_webgpu_readback_bytes_per_row: (a: number) => number;
    readonly js_webgpu_terrain_vertex_pos: (a: number, b: number, c: number, d: number) => void;
    readonly leash_endpoints: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number, o: number, p: number, q: number, r: number, s: number, t: number, u: number, v: number, w: number, x: number) => void;
    readonly leash_geometry: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => void;
    readonly leash_knot_center: (a: number, b: number, c: number, d: number) => void;
    readonly lighting_frame_wasm: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly living_update: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => void;
    readonly loader_kib_label: (a: number, b: number) => void;
    readonly loader_ready: (a: number) => number;
    readonly loading_error_message: (a: number, b: number, c: number) => void;
    readonly lod_distance: (a: number, b: number, c: number, d: number) => number;
    readonly look_vec_wasm: (a: number, b: number, c: number) => void;
    readonly map_apply_columns_wasm: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => void;
    readonly mat4_invert: (a: number, b: number, c: number) => void;
    readonly mat4_multiply: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly mat4_ortho: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly mat4_perspective: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly mat4_rotate: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly mat4_scale: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly mat4_transform_dir: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly mat4_transform_point: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly mat4_translate: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly mc_cos_wasm: (a: number) => number;
    readonly mc_sin_wasm: (a: number) => number;
    readonly modelstorecore_bake_model_json: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly modelstorecore_bake_variant_json: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => void;
    readonly modelstorecore_find_variant_json: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => void;
    readonly modelstorecore_new: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly modelstorecore_stats: (a: number, b: number) => void;
    readonly music_rand_with_draw: (a: number, b: number, c: number) => number;
    readonly music_type_for: (a: number, b: number, c: number, d: number, e: number) => number;
    readonly name_uuid: (a: number, b: number, c: number) => void;
    readonly nbt_root_name: (a: number, b: number, c: number) => void;
    readonly nbt_roundtrip: (a: number, b: number, c: number) => void;
    readonly nbt_simplify_json: (a: number, b: number, c: number) => void;
    readonly nbt_valid: (a: number, b: number) => number;
    readonly ocelot_pose: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly offset_bb_wasm: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly pack_lighting_wasm: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly packet_deserialize: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly packet_id_1152: (a: number, b: number, c: number) => number;
    readonly packet_id_498: (a: number, b: number, c: number) => number;
    readonly packet_id_578: (a: number, b: number, c: number) => number;
    readonly packet_name_1152: (a: number, b: number, c: number) => void;
    readonly packet_name_498: (a: number, b: number, c: number) => void;
    readonly packet_name_578: (a: number, b: number, c: number) => void;
    readonly packet_serialize: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly packetreader_angle: (a: number, b: number) => void;
    readonly packetreader_bytes_n: (a: number, b: number, c: number) => void;
    readonly packetreader_f32: (a: number, b: number) => void;
    readonly packetreader_f64: (a: number, b: number) => void;
    readonly packetreader_i16: (a: number, b: number) => void;
    readonly packetreader_i32: (a: number, b: number) => void;
    readonly packetreader_i64: (a: number, b: number) => void;
    readonly packetreader_i8: (a: number, b: number) => void;
    readonly packetreader_new: (a: number, b: number) => number;
    readonly packetreader_offset: (a: number) => number;
    readonly packetreader_position: (a: number, b: number) => void;
    readonly packetreader_read_bool: (a: number, b: number) => void;
    readonly packetreader_remaining: (a: number) => number;
    readonly packetreader_rest: (a: number, b: number) => void;
    readonly packetreader_string: (a: number, b: number) => void;
    readonly packetreader_u16: (a: number, b: number) => void;
    readonly packetreader_u8: (a: number, b: number) => void;
    readonly packetreader_uuid: (a: number, b: number) => void;
    readonly packetreader_varint: (a: number, b: number) => void;
    readonly packetreader_varlong: (a: number, b: number) => void;
    readonly packetwriter_build: (a: number, b: number) => void;
    readonly packetwriter_f32: (a: number, b: number) => void;
    readonly packetwriter_f64: (a: number, b: number) => void;
    readonly packetwriter_i16: (a: number, b: number) => void;
    readonly packetwriter_i32: (a: number, b: number) => void;
    readonly packetwriter_i64: (a: number, b: bigint) => void;
    readonly packetwriter_i8: (a: number, b: number) => void;
    readonly packetwriter_is_empty: (a: number) => number;
    readonly packetwriter_len: (a: number) => number;
    readonly packetwriter_new: () => number;
    readonly packetwriter_position: (a: number, b: number, c: number, d: number) => void;
    readonly packetwriter_raw: (a: number, b: number, c: number) => void;
    readonly packetwriter_string: (a: number, b: number, c: number) => void;
    readonly packetwriter_u16: (a: number, b: number) => void;
    readonly packetwriter_u8: (a: number, b: number) => void;
    readonly packetwriter_uuid: (a: number, b: number, c: number) => void;
    readonly packetwriter_varint: (a: number, b: number) => void;
    readonly packetwriter_varlong: (a: number, b: bigint) => void;
    readonly packetwriter_write_bool: (a: number, b: number) => void;
    readonly parse_address: (a: number, b: number, c: number) => void;
    readonly parse_command_tree: (a: number, b: number, c: number) => void;
    readonly parse_proxy_url: (a: number, b: number, c: number) => void;
    readonly parse_recipes: (a: number, b: number, c: number, d: number) => void;
    readonly parse_snbt: (a: number, b: number, c: number) => void;
    readonly particle_bubble: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: bigint) => void;
    readonly particle_campfire_smoke: (a: number, b: number, c: number, d: number, e: number, f: number, g: bigint) => void;
    readonly particle_crit: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: bigint) => void;
    readonly particle_drip: (a: number, b: number, c: number, d: number, e: number, f: number, g: bigint) => void;
    readonly particle_enchant: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: bigint) => void;
    readonly particle_entity_effect: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: bigint) => void;
    readonly particle_entity_fire: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: bigint) => void;
    readonly particle_eval_alpha: (a: number, b: number, c: number) => number;
    readonly particle_eval_size: (a: number, b: number, c: number) => number;
    readonly particle_eval_tex: (a: number, b: number) => number;
    readonly particle_explosion: (a: number, b: number, c: number, d: number, e: number, f: number, g: bigint) => void;
    readonly particle_falling_drop: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: bigint) => void;
    readonly particle_flame: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: bigint) => void;
    readonly particle_honey_drip: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: bigint) => void;
    readonly particle_huge_explode: (a: number, b: number, c: number, d: number) => void;
    readonly particle_large_explode: (a: number, b: number, c: number, d: number, e: number, f: number, g: bigint) => void;
    readonly particle_lava: (a: number, b: number, c: number, d: number, e: number, f: bigint) => void;
    readonly particle_move: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number) => void;
    readonly particle_native: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: bigint) => void;
    readonly particle_note: (a: number, b: number, c: number, d: number, e: number, f: number, g: bigint) => void;
    readonly particle_poof: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: bigint) => void;
    readonly particle_portal: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: bigint) => void;
    readonly particle_rain: (a: number, b: number, c: number, d: number, e: number, f: bigint) => void;
    readonly particle_reddust: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: bigint) => void;
    readonly particle_simple_rising: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number, o: number, p: number, q: bigint) => void;
    readonly particle_smoke: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: bigint) => void;
    readonly particle_spell: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: bigint) => void;
    readonly particle_splash: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: bigint) => void;
    readonly particle_sprite_exists: (a: number, b: number) => number;
    readonly particle_sprite_frame_count: (a: number, b: number) => number;
    readonly particle_sprite_get: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => void;
    readonly particle_sprite_get_frame: (a: number, b: number, c: number, d: number) => void;
    readonly particle_sprite_list: (a: number) => void;
    readonly particle_sprite_registry_json: (a: number) => void;
    readonly particle_sprite_textures: (a: number, b: number, c: number) => void;
    readonly particle_sprites_set_uv_lookup: (a: number, b: number) => void;
    readonly particle_tick: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: bigint) => void;
    readonly piston_can_push: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number) => void;
    readonly piston_is_piston: (a: number, b: number) => number;
    readonly piston_is_sticky_block: (a: number, b: number) => number;
    readonly piston_mobility: (a: number, b: number, c: number) => void;
    readonly pistoncore_new: () => number;
    readonly place_leash_knot: (a: number, b: number, c: number) => void;
    readonly placement_intersects: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
    readonly player_pose_height_114: (a: number, b: number) => number;
    readonly player_pose_height_115: (a: number, b: number) => number;
    readonly player_pose_width_114: (a: number, b: number) => number;
    readonly player_pose_width_115: (a: number, b: number) => number;
    readonly pngimage_data: (a: number, b: number) => void;
    readonly pngimage_data_len: (a: number) => number;
    readonly pngimage_height: (a: number) => number;
    readonly pngimage_width: (a: number) => number;
    readonly pose_interval: (a: number, b: number) => number;
    readonly potato_decision: (a: number, b: number, c: number) => number;
    readonly potion_effect_color: (a: number, b: number, c: number, d: number) => void;
    readonly profiler_end_frame: (a: number) => number;
    readonly profiler_get_formatted: (a: number, b: number) => void;
    readonly profiler_get_results: (a: number, b: number) => void;
    readonly profiler_mark_end: (a: number, b: number, c: number) => void;
    readonly profiler_mark_start: (a: number, b: number, c: number) => void;
    readonly profiler_reset: (a: number) => void;
    readonly profiler_start_frame: (a: number) => void;
    readonly profilesection_avg_time: (a: number) => number;
    readonly profilesection_count: (a: number) => number;
    readonly profilesection_name: (a: number, b: number) => void;
    readonly profilesection_new: (a: number, b: number) => number;
    readonly profilesection_start_time: (a: number) => number;
    readonly profilesection_total_time: (a: number) => number;
    readonly profilingdata_enabled: (a: number) => number;
    readonly profilingdata_frame_start: (a: number) => number;
    readonly profilingdata_new: () => number;
    readonly profilingdata_sections_json: (a: number, b: number) => void;
    readonly profilingdata_set_enabled: (a: number, b: number) => void;
    readonly profilingdata_set_frame_start: (a: number, b: number) => void;
    readonly proxy_http_base: (a: number, b: number, c: number) => void;
    readonly push_offset: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number, o: number) => void;
    readonly ray_box: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number) => void;
    readonly recipebookcore_can_craft: (a: number, b: number, c: number, d: number, e: number) => number;
    readonly recipebookcore_clear_fresh: (a: number) => void;
    readonly recipebookcore_cooking_state_json: (a: number, b: number, c: number, d: number) => void;
    readonly recipebookcore_evaluate_list: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => void;
    readonly recipebookcore_filtering: (a: number) => number;
    readonly recipebookcore_fresh_recipes_json: (a: number, b: number) => void;
    readonly recipebookcore_known_recipes_json: (a: number, b: number) => void;
    readonly recipebookcore_new: () => number;
    readonly recipebookcore_on_packet: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => void;
    readonly recipebookcore_open: (a: number) => number;
    readonly recipebookcore_parse: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => void;
    readonly recipebookcore_set_filtering: (a: number, b: number) => void;
    readonly recipebookcore_set_open: (a: number, b: number) => void;
    readonly recipebookcore_stacked_contents: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly recipebookcore_tab_lists_json: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number) => void;
    readonly recipebookstate_book_type: (a: number, b: number) => void;
    readonly recipebookstate_highlighted: (a: number, b: number) => void;
    readonly recipebookstate_is_filtering: (a: number) => number;
    readonly recipebookstate_is_open: (a: number) => number;
    readonly recipebookstate_new: () => number;
    readonly recipebookstate_search_query: (a: number, b: number) => void;
    readonly recipebookstate_set_book_type: (a: number, b: number, c: number) => void;
    readonly recipebookstate_set_is_filtering: (a: number, b: number) => void;
    readonly recipebookstate_set_is_open: (a: number, b: number) => void;
    readonly recipebookstate_set_search_query: (a: number, b: number, c: number) => void;
    readonly recipebookstate_unlocked: (a: number, b: number) => void;
    readonly registrytagscore_contains: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
    readonly registrytagscore_for_entry: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly registrytagscore_names: (a: number, b: number, c: number, d: number) => void;
    readonly registrytagscore_new: (a: number, b: number, c: number) => void;
    readonly registrytagscore_newEmpty: () => number;
    readonly registrytagscore_replace: (a: number, b: number, c: number, d: number) => void;
    readonly remove_recipe: (a: number, b: number, c: number) => void;
    readonly resolve_state_wasm: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly rider_position: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number) => void;
    readonly rsa_encrypt: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly scaffolding_collision: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly scoreboard_apply_action: (a: number, b: number, c: number) => number;
    readonly scoreboardcore_display_name: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly scoreboardcore_format_name: (a: number, b: number, c: number, d: number) => void;
    readonly scoreboardcore_get_below_name: (a: number, b: number) => void;
    readonly scoreboardcore_get_footer: (a: number, b: number) => void;
    readonly scoreboardcore_get_header: (a: number, b: number) => void;
    readonly scoreboardcore_get_list: (a: number, b: number) => void;
    readonly scoreboardcore_get_objectives_json: (a: number, b: number) => void;
    readonly scoreboardcore_get_players_json: (a: number, b: number) => void;
    readonly scoreboardcore_get_sidebar: (a: number, b: number) => void;
    readonly scoreboardcore_get_teams_json: (a: number, b: number) => void;
    readonly scoreboardcore_new: (a: number, b: number) => number;
    readonly scoreboardcore_on_display: (a: number, b: number, c: number, d: number) => void;
    readonly scoreboardcore_on_objective: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => void;
    readonly scoreboardcore_on_player_info: (a: number, b: number, c: number, d: number) => void;
    readonly scoreboardcore_on_score: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly scoreboardcore_on_team: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly scoreboardcore_reset: (a: number) => void;
    readonly scoreboardcore_set_footer: (a: number, b: number, c: number) => void;
    readonly scoreboardcore_set_header: (a: number, b: number, c: number) => void;
    readonly scoreboardcore_set_sidebar: (a: number, b: number, c: number) => void;
    readonly scoreboardcore_set_username: (a: number, b: number, c: number) => void;
    readonly scoreboardcore_sorted_players_json: (a: number, b: number) => void;
    readonly scoreboardcore_tab_name: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly screen_containers_amplifier_key: (a: number, b: number) => void;
    readonly screen_containers_anvil_cost_color: (a: number, b: number, c: number, d: number) => number;
    readonly screen_containers_anvil_slots: (a: number) => void;
    readonly screen_containers_beacon_button_suffix: (a: number, b: number, c: number) => void;
    readonly screen_containers_beacon_button_u: (a: number, b: number, c: number) => number;
    readonly screen_containers_beacon_buttons: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly screen_containers_beacon_field: (a: number, b: number) => number;
    readonly screen_containers_beacon_slots: (a: number) => void;
    readonly screen_containers_book_angles: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly screen_containers_book_rotations: (a: number, b: number, c: number, d: number) => void;
    readonly screen_containers_brewing_bubbles: (a: number, b: number) => void;
    readonly screen_containers_brewing_fuel_width: (a: number) => number;
    readonly screen_containers_brewing_slots: (a: number) => void;
    readonly screen_containers_center: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly screen_containers_chest_lower_offset: (a: number) => number;
    readonly screen_containers_chest_slots: (a: number, b: number) => void;
    readonly screen_containers_creative_catalog: (a: number, b: number, c: number) => void;
    readonly screen_containers_creative_changed_slots: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly screen_containers_creative_drop: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly screen_containers_creative_grid_click: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number) => void;
    readonly screen_containers_creative_grid_item_at: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => void;
    readonly screen_containers_creative_grid_start: (a: number, b: number) => number;
    readonly screen_containers_creative_hotbar_key: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => void;
    readonly screen_containers_creative_layout: (a: number, b: number) => void;
    readonly screen_containers_creative_locked: (a: number, b: number) => number;
    readonly screen_containers_creative_on_destroy_rect: (a: number, b: number, c: number, d: number) => number;
    readonly screen_containers_creative_on_destroy_slot: (a: number, b: number, c: number, d: number) => number;
    readonly screen_containers_creative_on_scrollbar: (a: number, b: number, c: number, d: number) => number;
    readonly screen_containers_creative_scroll_to: (a: number, b: number) => number;
    readonly screen_containers_creative_scrollbar: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly screen_containers_creative_search_tab_index: () => number;
    readonly screen_containers_creative_tab_at: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => number;
    readonly screen_containers_creative_tab_icon_pos: (a: number, b: number, c: number, d: number) => void;
    readonly screen_containers_creative_tab_of: (a: number, b: number, c: number, d: bigint) => void;
    readonly screen_containers_creative_tab_rect: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => void;
    readonly screen_containers_creative_tab_v: (a: number, b: number) => number;
    readonly screen_containers_creative_wheel: (a: number, b: number, c: number) => number;
    readonly screen_containers_drag_preview: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => void;
    readonly screen_containers_drag_remainder: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly screen_containers_drop_button: (a: number, b: number, c: number, d: number, e: number) => number;
    readonly screen_containers_effect_duration: (a: number, b: number) => void;
    readonly screen_containers_effect_key: (a: number, b: number, c: number, d: number) => void;
    readonly screen_containers_effects_dy: (a: number) => number;
    readonly screen_containers_effects_shift_left: (a: number, b: number) => number;
    readonly screen_containers_enchant_clues: (a: number, b: bigint) => void;
    readonly screen_containers_enchant_colors: (a: number, b: number) => void;
    readonly screen_containers_enchant_enabled: (a: number, b: number, c: number, d: number, e: number) => number;
    readonly screen_containers_enchant_overlay_line: (a: number, b: number, c: number) => void;
    readonly screen_containers_enchant_slots: (a: number) => void;
    readonly screen_containers_enchant_tick: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number, o: number) => void;
    readonly screen_containers_furnace_cook: (a: number, b: number) => number;
    readonly screen_containers_furnace_flame: (a: number, b: number, c: number) => void;
    readonly screen_containers_furnace_slots: (a: number) => void;
    readonly screen_containers_furnace_texture: (a: number, b: number, c: number) => void;
    readonly screen_containers_horse_slots: (a: number, b: number, c: number) => void;
    readonly screen_containers_hotbar_from_json: (a: number, b: number, c: number) => void;
    readonly screen_containers_hotbar_key: (a: number, b: number, c: number, d: number) => number;
    readonly screen_containers_hotbar_load_payload: (a: number, b: number, c: number, d: number) => void;
    readonly screen_containers_hotbar_placeholder: (a: number, b: number, c: bigint, d: number, e: number) => void;
    readonly screen_containers_hotbar_save_payload: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly screen_containers_hotbar_snapshots: (a: number, b: number, c: number) => void;
    readonly screen_containers_hotbar_tab_list: (a: number, b: number, c: number, d: bigint, e: number, f: number) => void;
    readonly screen_containers_hotbar_to_json: (a: number, b: number, c: number) => void;
    readonly screen_containers_hotbars_key: (a: number) => void;
    readonly screen_containers_inventory_slots: (a: number) => void;
    readonly screen_containers_is_outside: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
    readonly screen_containers_keep_search_query: (a: number, b: number) => number;
    readonly screen_containers_layout_for: (a: number, b: number, c: number, d: number) => void;
    readonly screen_containers_matches: (a: number, b: number, c: bigint, d: number, e: number, f: number, g: number, h: number, i: number) => number;
    readonly screen_containers_max_scroll_rows: (a: number) => number;
    readonly screen_containers_mouse_down: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number) => void;
    readonly screen_containers_mouse_up: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number) => void;
    readonly screen_containers_parse_search_query: (a: number, b: number, c: number) => void;
    readonly screen_containers_player_inv_slots: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly screen_containers_potion_icon: (a: number) => number;
    readonly screen_containers_quickcraft_clicks: (a: number, b: number, c: number, d: number) => void;
    readonly screen_containers_recipe_button: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly screen_containers_recipe_button_v: (a: number, b: number) => number;
    readonly screen_containers_same_inventory: (a: number, b: number) => number;
    readonly screen_containers_save_hotbar_snapshots: (a: number, b: number, c: number) => void;
    readonly screen_containers_search_field: (a: number, b: number, c: number) => void;
    readonly screen_containers_search_hit: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
    readonly screen_containers_search_tooltip_lines: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly screen_containers_slot_at: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
    readonly screen_containers_stack_of: (a: number, b: bigint, c: number, d: number) => void;
    readonly screen_containers_swap_ok: (a: number, b: number, c: number, d: number) => number;
    readonly screen_containers_tab_index: (a: number, b: number, c: number) => number;
    readonly screen_containers_tab_label_key: (a: number, b: number, c: number) => void;
    readonly screen_containers_tab_meta: (a: number, b: number, c: number) => void;
    readonly screen_containers_tag_query_hit: (a: number, b: number, c: number, d: number) => number;
    readonly screen_containers_tooltip_group: (a: number, b: number, c: number, d: bigint, e: number, f: number, g: number, h: number) => void;
    readonly screen_containers_try_add_drag: (a: number, b: number, c: number, d: number, e: number) => number;
    readonly screen_containers_wrap_clue: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly section_lod: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => number;
    readonly sectioncullercore_is_visible: (a: number, b: number, c: number, d: number) => number;
    readonly sectioncullercore_new: () => number;
    readonly sectioncullercore_reached_count: (a: number) => number;
    readonly sectioncullercore_update: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number, o: number, p: number, q: number, r: number) => void;
    readonly select_glsl_functions_wasm: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly server_craft_result: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly server_hash: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly set_block_light: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly set_jar_models: (a: number, b: number) => number;
    readonly set_sky_light: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly sha1: (a: number, b: number, c: number) => void;
    readonly shader_block_rules_wasm: (a: number, b: number, c: number, d: number) => void;
    readonly shader_library_add: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => void;
    readonly shader_library_migrate_legacy: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly shader_library_new_id: (a: number) => void;
    readonly shader_library_normalize_metadata: (a: number, b: number, c: number) => void;
    readonly shader_library_remove: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly shader_library_save_current: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => void;
    readonly shader_library_select: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly should_spawn_mob: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => number;
    readonly should_wake_up: (a: bigint, b: number, c: number, d: number, e: number) => number;
    readonly shulker_box: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly shulker_push_vector: (a: number, b: number) => void;
    readonly simulate_projectile: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number, o: number) => void;
    readonly sky_color_wasm: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly sleep_percentage: (a: number, b: number) => number;
    readonly sleepcamera_new: (a: number, b: number, c: number, d: number, e: number) => number;
    readonly sleepdelta_new: () => number;
    readonly sleepdelta_positions_json: (a: number, b: number) => void;
    readonly sleepdelta_set_positions_json: (a: number, b: number, c: number) => void;
    readonly sleepstate_bed_pos: (a: number) => number;
    readonly sleepstate_crouching: (a: number) => number;
    readonly sleepstate_height: (a: number) => number;
    readonly sleepstate_motion_x: (a: number) => number;
    readonly sleepstate_motion_y: (a: number) => number;
    readonly sleepstate_motion_z: (a: number) => number;
    readonly sleepstate_new: () => number;
    readonly sleepstate_pitch: (a: number) => number;
    readonly sleepstate_pose: (a: number, b: number) => void;
    readonly sleepstate_prev_pitch: (a: number) => number;
    readonly sleepstate_prev_x: (a: number) => number;
    readonly sleepstate_prev_y: (a: number) => number;
    readonly sleepstate_prev_z: (a: number) => number;
    readonly sleepstate_set_bed_pos: (a: number, b: number) => void;
    readonly sleepstate_set_crouching: (a: number, b: number) => void;
    readonly sleepstate_set_height: (a: number, b: number) => void;
    readonly sleepstate_set_motion_x: (a: number, b: number) => void;
    readonly sleepstate_set_motion_y: (a: number, b: number) => void;
    readonly sleepstate_set_motion_z: (a: number, b: number) => void;
    readonly sleepstate_set_pitch: (a: number, b: number) => void;
    readonly sleepstate_set_pose: (a: number, b: number, c: number) => void;
    readonly sleepstate_set_prev_pitch: (a: number, b: number) => void;
    readonly sleepstate_set_prev_x: (a: number, b: number) => void;
    readonly sleepstate_set_prev_y: (a: number, b: number) => void;
    readonly sleepstate_set_prev_z: (a: number, b: number) => void;
    readonly sleepstate_set_sleeping: (a: number, b: number) => void;
    readonly sleepstate_set_width: (a: number, b: number) => void;
    readonly sleepstate_set_x: (a: number, b: number) => void;
    readonly sleepstate_set_y: (a: number, b: number) => void;
    readonly sleepstate_set_z: (a: number, b: number) => void;
    readonly sleepstate_sleeping: (a: number) => number;
    readonly sleepstate_width: (a: number) => number;
    readonly sleepstate_x: (a: number) => number;
    readonly sleepstate_y: (a: number) => number;
    readonly sleepstate_z: (a: number) => number;
    readonly slicedata_biome_layers: (a: number) => number;
    readonly slicedata_biome_ox: (a: number) => number;
    readonly slicedata_biome_oz: (a: number) => number;
    readonly slicedata_biome_size: (a: number) => number;
    readonly slicedata_biomes: (a: number, b: number) => void;
    readonly slicedata_has_sky: (a: number) => number;
    readonly slicedata_light: (a: number, b: number) => void;
    readonly slicedata_ox: (a: number) => number;
    readonly slicedata_oy: (a: number) => number;
    readonly slicedata_oz: (a: number) => number;
    readonly slicedata_states: (a: number, b: number) => void;
    readonly slicedata_x: (a: number) => number;
    readonly slicedata_y: (a: number) => number;
    readonly slicedata_z: (a: number) => number;
    readonly softwaredevice_begin_frame: (a: number, b: number, c: number, d: number) => void;
    readonly softwaredevice_busy: (a: number) => number;
    readonly softwaredevice_capture: (a: number, b: number) => void;
    readonly softwaredevice_clear_current: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly softwaredevice_clear_depth: (a: number) => void;
    readonly softwaredevice_clear_scissor: (a: number) => void;
    readonly softwaredevice_create_mesh: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => number;
    readonly softwaredevice_create_mesh_f32: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => number;
    readonly softwaredevice_create_render_target: (a: number, b: number, c: number) => number;
    readonly softwaredevice_create_texture: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => number;
    readonly softwaredevice_destroy_mesh: (a: number, b: number) => void;
    readonly softwaredevice_destroy_texture: (a: number, b: number) => void;
    readonly softwaredevice_draw_json: (a: number, b: number, c: number) => number;
    readonly softwaredevice_end_frame: (a: number, b: number) => void;
    readonly softwaredevice_end_frame_u32: (a: number, b: number) => void;
    readonly softwaredevice_height: (a: number) => number;
    readonly softwaredevice_mesh_index_count: (a: number, b: number) => number;
    readonly softwaredevice_mesh_vertex_count: (a: number, b: number) => number;
    readonly softwaredevice_new: (a: number, b: number) => number;
    readonly softwaredevice_resize: (a: number, b: number, c: number) => void;
    readonly softwaredevice_set_globals_json: (a: number, b: number, c: number) => number;
    readonly softwaredevice_set_render_target: (a: number, b: number) => void;
    readonly softwaredevice_set_scissor: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly softwaredevice_texel_data: (a: number, b: number, c: number) => void;
    readonly softwaredevice_update_mesh: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly softwaredevice_update_mesh_f32: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly softwaredevice_upload_texture: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => void;
    readonly softwaredevice_width: (a: number) => number;
    readonly sound_categories: (a: number) => void;
    readonly splash_animation: (a: number, b: number, c: number) => number;
    readonly splash_logo_vertices: (a: number, b: number, c: number, d: number) => void;
    readonly splash_ortho_matrix: (a: number, b: number, c: number) => void;
    readonly splash_scale: (a: number, b: number, c: number, d: number) => number;
    readonly splash_text: (a: number, b: number, c: number) => void;
    readonly splash_text_random: (a: number, b: number) => void;
    readonly stairs_shape_wasm: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly star_brightness_wasm: (a: number) => number;
    readonly stat_key: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly string_decode: (a: number, b: number, c: number) => void;
    readonly string_encode: (a: number, b: number, c: number) => void;
    readonly sun_brightness_wasm: (a: number, b: number, c: number) => number;
    readonly sunrise_colors_wasm: (a: number, b: number) => void;
    readonly sw_decode_vertices: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly sw_default_params: (a: number, b: number, c: number) => void;
    readonly sw_lightmap_sample: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly sw_lightmap_table: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly sw_mul4: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly sw_pack_color: (a: number, b: number, c: number, d: number) => number;
    readonly sw_pipeline_format: (a: number, b: number, c: number) => void;
    readonly sw_post_process: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number, o: number, p: number) => void;
    readonly sw_vertex_layout: (a: number, b: number, c: number) => void;
    readonly teams_can_push: (a: number, b: number, c: number, d: number, e: number) => number;
    readonly tick_dragon_death: (a: number, b: number, c: number) => void;
    readonly tick_entity_effects: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly tick_fox: (a: number, b: number, c: number) => void;
    readonly ticks_until_morning: (a: bigint) => bigint;
    readonly ticks_until_night: (a: bigint) => bigint;
    readonly tilerenderercore_banner_swing: (a: number, b: number) => number;
    readonly tilerenderercore_beacon_beam_brightness: (a: number, b: number, c: number, d: number) => number;
    readonly tilerenderercore_bed_piece_vertices: (a: number, b: number, c: number, d: number) => void;
    readonly tilerenderercore_block_tint_color: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number) => void;
    readonly tilerenderercore_breaking_uv: (a: number, b: number, c: number) => void;
    readonly tilerenderercore_build_beam_geometry: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
    readonly tilerenderercore_cull_face: (a: number, b: number, c: number) => number;
    readonly tilerenderercore_dye_rgb: (a: number, b: number) => void;
    readonly tilerenderercore_end_portal_colors: (a: number, b: number) => void;
    readonly tilerenderercore_flower_pot_contents: (a: number, b: number, c: number, d: number) => void;
    readonly tilerenderercore_fluid_uv: (a: number, b: number, c: number, d: number) => void;
    readonly tilerenderercore_get_block_model: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly tilerenderercore_get_face_uv: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => void;
    readonly tilerenderercore_new: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly tilerenderercore_registry: (a: number) => number;
    readonly tilerenderercore_shulker_bounds: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly tilerenderercore_shulker_box_vertices: (a: number, b: number) => number;
    readonly tilerenderercore_skull_model_vertices: (a: number, b: number, c: number) => void;
    readonly tilerenderercore_skull_type: (a: number, b: number, c: number) => number;
    readonly unlock_recipe: (a: number, b: number, c: number) => void;
    readonly update_cape: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number) => void;
    readonly update_command_block: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number) => void;
    readonly update_command_minecart: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly update_lightmap_wasm: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => void;
    readonly update_recipe_book: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly update_sleeping_from_delta: (a: number, b: number, c: number, d: number, e: number) => number;
    readonly update_statistic: (a: number, b: number, c: number, d: number, e: number, f: bigint) => void;
    readonly update_structure_block: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number, o: number, p: number, q: number, r: number, s: number, t: number, u: number, v: number, w: bigint, x: number, y: number, z: number) => void;
    readonly validate_bed_position: (a: number, b: number, c: number, d: number) => number;
    readonly varint_decode: (a: number, b: number, c: number) => void;
    readonly varint_encode: (a: number, b: number) => void;
    readonly varlong_decode: (a: number, b: number, c: number) => void;
    readonly varlong_encode: (a: number, b: bigint) => void;
    readonly vec3_new: (a: number, b: number, c: number) => number;
    readonly vehicle_deg_to_rad: (a: number) => number;
    readonly vehicle_wrap: (a: number) => number;
    readonly visgraph_compute: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly visgraph_flags_len: (a: number) => number;
    readonly visgraph_new: (a: number, b: number) => number;
    readonly visgraph_update_flags: (a: number, b: number, c: number) => void;
    readonly wasm_decode_terrain_position: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly wasm_fog_factor: (a: number, b: number, c: number, d: number, e: number) => number;
    readonly wasm_lightmap_uv: (a: number, b: number, c: number) => void;
    readonly wasm_quad_indices: (a: number, b: number) => void;
    readonly water_color: (a: number, b: number, c: number, d: number) => number;
    readonly water_fog_json: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly webgpu_blend_names: (a: number) => void;
    readonly webgpu_draw_stride: () => number;
    readonly webgpu_global_stride: () => number;
    readonly world_collision_boxes: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly world_get_collisions: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly world_is_raining_at: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => number;
    readonly world_raycast: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number) => void;
    readonly worldcore_begin_batch: (a: number) => void;
    readonly worldcore_build_slice: (a: number, b: number, c: number, d: number, e: number) => number;
    readonly worldcore_chunk_biomes: (a: number, b: number, c: number, d: number) => void;
    readonly worldcore_chunk_count: (a: number) => number;
    readonly worldcore_clear: (a: number) => void;
    readonly worldcore_end_batch: (a: number) => void;
    readonly worldcore_get_biome: (a: number, b: number, c: number, d: number) => number;
    readonly worldcore_get_block_light: (a: number, b: number, c: number, d: number) => number;
    readonly worldcore_get_sky_light: (a: number, b: number, c: number, d: number) => number;
    readonly worldcore_get_state: (a: number, b: number, c: number, d: number) => number;
    readonly worldcore_has_sky: (a: number) => number;
    readonly worldcore_height_map: (a: number, b: number, c: number, d: number) => void;
    readonly worldcore_is_loaded: (a: number, b: number, c: number) => number;
    readonly worldcore_last_dirty: (a: number, b: number) => void;
    readonly worldcore_load_chunk_113: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => number;
    readonly worldcore_new: (a: number, b: number, c: number, d: number) => number;
    readonly worldcore_section_block_light: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly worldcore_section_blocks: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly worldcore_section_sky_light: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly worldcore_set_has_sky: (a: number, b: number) => void;
    readonly worldcore_set_state: (a: number, b: number, c: number, d: number, e: number) => number;
    readonly worldcore_unload_chunk: (a: number, b: number, c: number) => void;
    readonly worldview_get_state: (a: number, b: number, c: number, d: number) => number;
    readonly worldview_new: () => number;
    readonly wrap: (a: number) => number;
    readonly zip_open: (a: number, b: number) => number;
    readonly ziparchive_entry_count: (a: number) => number;
    readonly ziparchive_has: (a: number, b: number, c: number) => number;
    readonly ziparchive_list: (a: number, b: number, c: number, d: number) => void;
    readonly ziparchive_read: (a: number, b: number, c: number, d: number) => void;
    readonly ziparchive_read_text: (a: number, b: number, c: number, d: number) => void;
    readonly ziparchive_root_prefix: (a: number, b: number) => void;
    readonly zoom_fov: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly __wbindgen_export: (a: number, b: number) => number;
    readonly __wbindgen_export2: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_export3: (a: number) => void;
    readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
    readonly __wbindgen_export4: (a: number, b: number, c: number) => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
