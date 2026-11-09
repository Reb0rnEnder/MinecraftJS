export class AdvancementsCore {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        AdvancementsCoreFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_advancementscore_free(ptr, 0);
    }
    /**
     * Get all advancement IDs as JSON array.
     * @returns {string}
     */
    all_ids_json() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.advancementscore_all_ids_json(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * Clear all advancements and progress.
     */
    clear() {
        wasm.advancementscore_clear(this.__wbg_ptr);
    }
    /**
     * Get an advancement by ID as JSON.
     * @param {string} id
     * @returns {string | undefined}
     */
    get_json(id) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            const ptr0 = passStringToWasm0(id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            wasm.advancementscore_get_json(retptr, this.__wbg_ptr, ptr0, len0);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            let v2;
            if (r0 !== 0) {
                v2 = getStringFromWasm0(r0, r1);
                wasm.__wbindgen_export3(r0, r1 * 1, 1);
            }
            return v2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * Get progress for an advancement as JSON.
     * @param {string} id
     * @returns {string | undefined}
     */
    get_progress_json(id) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            const ptr0 = passStringToWasm0(id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            wasm.advancementscore_get_progress_json(retptr, this.__wbg_ptr, ptr0, len0);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            let v2;
            if (r0 !== 0) {
                v2 = getStringFromWasm0(r0, r1);
                wasm.__wbindgen_export3(r0, r1 * 1, 1);
            }
            return v2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * Check if we have any progress data for an advancement.
     * @param {string} id
     * @returns {boolean}
     */
    has_progress(id) {
        const ptr0 = passStringToWasm0(id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.advancementscore_has_progress(this.__wbg_ptr, ptr0, len0);
        return ret !== 0;
    }
    /**
     * Check if an advancement is fully completed.
     * @param {string} id
     * @returns {boolean}
     */
    is_done(id) {
        const ptr0 = passStringToWasm0(id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.advancementscore_is_done(this.__wbg_ptr, ptr0, len0);
        return ret !== 0;
    }
    constructor() {
        const ret = wasm.advancementscore_new();
        this.__wbg_ptr = ret;
        AdvancementsCoreFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Process an advancement packet from the server.
     * Returns JSON array of advancement IDs that should show a toast.
     * @param {string} packet_json
     * @returns {string}
     */
    on_packet(packet_json) {
        let deferred3_0;
        let deferred3_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            const ptr0 = passStringToWasm0(packet_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            wasm.advancementscore_on_packet(retptr, this.__wbg_ptr, ptr0, len0);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
            var ptr2 = r0;
            var len2 = r1;
            if (r3) {
                ptr2 = 0; len2 = 0;
                throw takeFromExternrefTable0(r2);
            }
            deferred3_0 = ptr2;
            deferred3_1 = len2;
            return getStringFromWasm0(ptr2, len2);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred3_0, deferred3_1, 1);
        }
    }
    /**
     * Get completion percentage (0.0 to 1.0).
     * @param {string} id
     * @returns {number}
     */
    percent(id) {
        const ptr0 = passStringToWasm0(id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.advancementscore_percent(this.__wbg_ptr, ptr0, len0);
        return ret;
    }
    /**
     * Get progress text like "3/5".
     * @param {string} id
     * @returns {string | undefined}
     */
    progress_text(id) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            const ptr0 = passStringToWasm0(id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            wasm.advancementscore_progress_text(retptr, this.__wbg_ptr, ptr0, len0);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            let v2;
            if (r0 !== 0) {
                v2 = getStringFromWasm0(r0, r1);
                wasm.__wbindgen_export3(r0, r1 * 1, 1);
            }
            return v2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * Select a tab by advancement ID.
     * @param {string} id
     * @returns {boolean}
     */
    select_tab(id) {
        const ptr0 = passStringToWasm0(id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.advancementscore_select_tab(this.__wbg_ptr, ptr0, len0);
        return ret !== 0;
    }
    /**
     * Get the currently selected tab ID.
     * @returns {string | undefined}
     */
    selected_tab() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.advancementscore_selected_tab(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            let v1;
            if (r0 !== 0) {
                v1 = getStringFromWasm0(r0, r1);
                wasm.__wbindgen_export3(r0, r1 * 1, 1);
            }
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * Get root advancements with display (tabs) as JSON array.
     * @returns {string}
     */
    tabs_json() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.advancementscore_tabs_json(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * Serialize the full state to JSON.
     * @returns {string}
     */
    to_json() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.advancementscore_to_json(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
        }
    }
}
if (Symbol.dispose) AdvancementsCore.prototype[Symbol.dispose] = AdvancementsCore.prototype.free;

/**
 * Banner configuration: base color + up to 6 pattern layers (max 7 total including base).
 */
export class Banner {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        BannerFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_banner_free(ptr, 0);
    }
    /**
     * Add a pattern layer.
     * @param {string} pattern
     * @param {number} color
     */
    add_pattern(pattern, color) {
        const val2 = +color;
        const ptr0 = passStringToWasm0(pattern, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.banner_add_pattern(this.__wbg_ptr, ptr0, len0, val2);
    }
    /**
     * Get the base color.
     * @returns {number}
     */
    base_color() {
        const ret = wasm.banner_base_color(this.__wbg_ptr);
        return ret;
    }
    /**
     * Get all layers (base + patterns) as a flat array for JS interop.
     * Returns [base_pattern, base_color, pattern1_code, pattern1_color, ...]
     * @returns {Uint8Array}
     */
    layers_flat() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.banner_layers_flat(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export3(r0, r1 * 1, 1);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * Create a new Banner with a base color (0-15).
     * @param {number} base_color
     */
    constructor(base_color) {
        const ret = wasm.banner_new(base_color);
        this.__wbg_ptr = ret;
        BannerFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Get the pattern count.
     * @returns {number}
     */
    pattern_count() {
        const ret = wasm.banner_pattern_count(this.__wbg_ptr);
        return ret >>> 0;
    }
}
if (Symbol.dispose) Banner.prototype[Symbol.dispose] = Banner.prototype.free;

/**
 * Bed facing direction.
 * @enum {0 | 90 | 180 | 270}
 */
export const BedFacing = Object.freeze({
    South: 0, "0": "South",
    West: 90, "90": "West",
    North: 180, "180": "North",
    East: 270, "270": "East",
});

/**
 * BedSleep handles all bed-related sleep logic.
 */
export class BedSleep {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        BedSleepFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_bedsleep_free(ptr, 0);
    }
    /**
     * Get current bed position.
     * @returns {BlockPos | undefined}
     */
    bed_pos() {
        const ret = wasm.bedsleep_bed_pos(this.__wbg_ptr);
        return ret === 0 ? undefined : BlockPos.__wrap(ret);
    }
    /**
     * Check if an entity can sleep at the current time.
     * Returns true if it's night time, not in combat, and bed is valid.
     * @param {bigint} world_time
     * @param {boolean} in_combat
     * @param {boolean} bed_valid
     * @returns {boolean}
     */
    can_sleep(world_time, in_combat, bed_valid) {
        const ret = wasm.bedsleep_can_sleep(this.__wbg_ptr, world_time, in_combat, bed_valid);
        return ret !== 0;
    }
    /**
     * Find a valid bed near the given position.
     * Returns the bed position if found, null otherwise.
     * @param {WorldView} world
     * @param {number} start_x
     * @param {number} start_y
     * @param {number} start_z
     * @param {number} range
     * @returns {BlockPos | undefined}
     */
    find_bed(world, start_x, start_y, start_z, range) {
        _assertClass(world, WorldView);
        const ret = wasm.bedsleep_find_bed(this.__wbg_ptr, world.__wbg_ptr, start_x, start_y, start_z, range);
        return ret === 0 ? undefined : BlockPos.__wrap(ret);
    }
    /**
     * Get current sleep state.
     * @returns {boolean}
     */
    is_sleeping() {
        const ret = wasm.bedsleep_is_sleeping(this.__wbg_ptr);
        return ret !== 0;
    }
    constructor() {
        const ret = wasm.bedsleep_new();
        this.__wbg_ptr = ret;
        BedSleepFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Set the sleep start tick (for wake time calculation).
     * @param {bigint} tick
     */
    set_sleep_start_tick(tick) {
        wasm.bedsleep_set_sleep_start_tick(this.__wbg_ptr, tick);
    }
    /**
     * Get the sleep start tick.
     * @returns {bigint | undefined}
     */
    sleep_start_tick() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.bedsleep_sleep_start_tick(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r2 = getDataViewMemory0().getBigInt64(retptr + 8 * 1, true);
            return r0 === 0 ? undefined : r2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * Start sleeping at the given bed position.
     * @param {BlockPos} pos
     * @param {SleepState} player
     */
    start_sleeping(pos, player) {
        _assertClass(player, SleepState);
        _assertClass(pos, BlockPos);
        var ptr0 = pos.__destroy_into_raw();
        wasm.bedsleep_start_sleeping(this.__wbg_ptr, ptr0, player.__wbg_ptr);
    }
    /**
     * Stop sleeping and reset state.
     * @param {SleepState} player
     */
    stop_sleeping(player) {
        _assertClass(player, SleepState);
        wasm.bedsleep_stop_sleeping(this.__wbg_ptr, player.__wbg_ptr);
    }
    /**
     * Wake up the sleeper (explicit wake up).
     * @param {SleepState} player
     */
    wake_up(player) {
        _assertClass(player, SleepState);
        wasm.bedsleep_wake_up(this.__wbg_ptr, player.__wbg_ptr);
    }
}
if (Symbol.dispose) BedSleep.prototype[Symbol.dispose] = BedSleep.prototype.free;

/**
 * WASM-exposed wrapper for BedValidationResult.
 */
export class BedValidationResult {
    static __wrap(ptr) {
        const obj = Object.create(BedValidationResult.prototype);
        obj.__wbg_ptr = ptr;
        BedValidationResultFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        BedValidationResultFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_bedvalidationresult_free(ptr, 0);
    }
    /**
     * @returns {BedFacing | undefined}
     */
    get facing() {
        const ret = wasm.bedvalidationresult_facing(this.__wbg_ptr);
        return ret === 1 ? undefined : ret;
    }
    /**
     * @returns {BlockPos | undefined}
     */
    get foot_pos() {
        const ret = wasm.bedvalidationresult_foot_pos(this.__wbg_ptr);
        return ret === 0 ? undefined : BlockPos.__wrap(ret);
    }
    /**
     * @returns {BlockPos | undefined}
     */
    get head_pos() {
        const ret = wasm.bedvalidationresult_head_pos(this.__wbg_ptr);
        return ret === 0 ? undefined : BlockPos.__wrap(ret);
    }
    /**
     * @returns {boolean}
     */
    get valid() {
        const ret = wasm.bedvalidationresult_valid(this.__wbg_ptr);
        return ret !== 0;
    }
}
if (Symbol.dispose) BedValidationResult.prototype[Symbol.dispose] = BedValidationResult.prototype.free;

/**
 * One zoomer instance. The cache is bounded like the JavaScript `Map`; its
 * eviction policy does not affect results because every entry is memoised
 * from deterministic arithmetic.
 */
export class BiomeZoom {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        BiomeZoomFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_biomezoom_free(ptr, 0);
    }
    /**
     * The corner chosen for a block position: `(qx, qy, qz)`.
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @returns {Int32Array}
     */
    cell(x, y, z) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.biomezoom_cell(retptr, this.__wbg_ptr, x, y, z);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayI32FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export3(r0, r1 * 4, 4);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @param {bigint} seed
     */
    constructor(seed) {
        const ret = wasm.biomezoom_new(seed);
        this.__wbg_ptr = ret;
        BiomeZoomFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Jitter offsets for a corner, in the same order as the JavaScript.
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @returns {Float64Array}
     */
    offset(x, y, z) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.biomezoom_offset(retptr, this.__wbg_ptr, x, y, z);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayF64FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export3(r0, r1 * 8, 8);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @returns {bigint}
     */
    seed() {
        const ret = wasm.biomezoom_seed(this.__wbg_ptr);
        return ret;
    }
}
if (Symbol.dispose) BiomeZoom.prototype[Symbol.dispose] = BiomeZoom.prototype.free;

/**
 * Represents a block position in the world.
 */
export class BlockPos {
    static __wrap(ptr) {
        const obj = Object.create(BlockPos.prototype);
        obj.__wbg_ptr = ptr;
        BlockPosFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        BlockPosFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_blockpos_free(ptr, 0);
    }
    /**
     * @param {number} x
     * @param {number} y
     * @param {number} z
     */
    constructor(x, y, z) {
        const ret = wasm.blockpos_new(x, y, z);
        this.__wbg_ptr = ret;
        BlockPosFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @returns {number}
     */
    get x() {
        const ret = wasm.__wbg_get_blockpos_x(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get y() {
        const ret = wasm.__wbg_get_blockpos_y(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get z() {
        const ret = wasm.__wbg_get_blockpos_z(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set x(arg0) {
        wasm.__wbg_set_blockpos_x(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set y(arg0) {
        wasm.__wbg_set_blockpos_y(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set z(arg0) {
        wasm.__wbg_set_blockpos_z(this.__wbg_ptr, arg0);
    }
}
if (Symbol.dispose) BlockPos.prototype[Symbol.dispose] = BlockPos.prototype.free;

export class BlockRegistryCore {
    static __wrap(ptr) {
        const obj = Object.create(BlockRegistryCore.prototype);
        obj.__wbg_ptr = ptr;
        BlockRegistryCoreFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        BlockRegistryCoreFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_blockregistrycore_free(ptr, 0);
    }
    /**
     * @param {number} state
     * @returns {number}
     */
    block_id(state) {
        const ret = wasm.blockregistrycore_block_id(this.__wbg_ptr, state);
        return ret >>> 0;
    }
    /**
     * @param {number} state
     * @returns {string}
     */
    block_name(state) {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.blockregistrycore_block_name(retptr, this.__wbg_ptr, state);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @param {number} state
     * @returns {Float64Array}
     */
    collision_boxes(state) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.blockregistrycore_collision_boxes(retptr, this.__wbg_ptr, state);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayF64FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export3(r0, r1 * 8, 8);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @param {number} state
     * @returns {number}
     */
    emit_light(state) {
        const ret = wasm.blockregistrycore_emit_light(this.__wbg_ptr, state);
        return ret >>> 0;
    }
    /**
     * @param {number} state
     * @returns {number}
     */
    filter_light(state) {
        const ret = wasm.blockregistrycore_filter_light(this.__wbg_ptr, state);
        return ret >>> 0;
    }
    /**
     * @param {string} name
     * @param {string} props_json
     * @returns {number}
     */
    find_state(name, props_json) {
        let ptr0, len0, ptr1, len1;
        try {
            ptr0 = passStringToWasm0(name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passStringToWasm0(props_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len1 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
            throw e;
        }
        const ret = wasm.blockregistrycore_find_state(this.__wbg_ptr, ptr0, len0, ptr1, len1);
        return ret >>> 0;
    }
    /**
     * @param {number} state
     * @returns {boolean}
     */
    has_model(state) {
        const ret = wasm.blockregistrycore_has_model(this.__wbg_ptr, state);
        return ret !== 0;
    }
    /**
     * @param {number} state
     * @returns {boolean}
     */
    is_liquid(state) {
        const ret = wasm.blockregistrycore_is_liquid(this.__wbg_ptr, state);
        return ret !== 0;
    }
    /**
     * @param {number} state
     * @returns {boolean}
     */
    is_stairs(state) {
        const ret = wasm.blockregistrycore_is_stairs(this.__wbg_ptr, state);
        return ret !== 0;
    }
    /**
     * @param {string} blocks_json
     * @param {string} shapes_json
     */
    constructor(blocks_json, shapes_json) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            let ptr0, len0, ptr1, len1;
            try {
                ptr0 = passStringToWasm0(blocks_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
                len0 = WASM_VECTOR_LEN;
                ptr1 = passStringToWasm0(shapes_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
                len1 = WASM_VECTOR_LEN;
            } catch (e) {
                if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
                if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
                throw e;
            }
            wasm.blockregistrycore_new(retptr, ptr0, len0, ptr1, len1);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            this.__wbg_ptr = r0;
            BlockRegistryCoreFinalization.register(this, this.__wbg_ptr, this);
            return this;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @param {number} state
     * @returns {boolean}
     */
    opaque(state) {
        const ret = wasm.blockregistrycore_opaque(this.__wbg_ptr, state);
        return ret !== 0;
    }
    /**
     * @param {number} state
     * @returns {string}
     */
    properties_json(state) {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.blockregistrycore_properties_json(retptr, this.__wbg_ptr, state);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @param {number} state
     * @returns {number}
     */
    slipperiness(state) {
        const ret = wasm.blockregistrycore_slipperiness(this.__wbg_ptr, state);
        return ret;
    }
    /**
     * @returns {number}
     */
    state_count() {
        const ret = wasm.blockregistrycore_state_count(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {number} state
     * @returns {string}
     */
    state_name(state) {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.blockregistrycore_state_name(retptr, this.__wbg_ptr, state);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
        }
    }
}
if (Symbol.dispose) BlockRegistryCore.prototype[Symbol.dispose] = BlockRegistryCore.prototype.free;

export class BoxModelCore {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        BoxModelCoreFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_boxmodelcore_free(ptr, 0);
    }
    /**
     * @param {BoxModelCore} child
     */
    add_child(child) {
        _assertClass(child, BoxModelCore);
        wasm.boxmodelcore_add_child(this.__wbg_ptr, child.__wbg_ptr);
    }
    /**
     * Bake this part and all children to entity vertices.
     * @param {BlockRegistryCore} reg
     * @returns {Float32Array}
     */
    bake(reg) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            _assertClass(reg, BlockRegistryCore);
            wasm.boxmodelcore_bake(retptr, this.__wbg_ptr, reg.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayF32FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export3(r0, r1 * 4, 4);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @param {number} dx
     * @param {number} dy
     * @param {number} dz
     * @param {number} inflate
     * @param {boolean | null} [mirror]
     */
    box_elem(x, y, z, dx, dy, dz, inflate, mirror) {
        wasm.boxmodelcore_box_elem(this.__wbg_ptr, x, y, z, dx, dy, dz, inflate, isLikeNone(mirror) ? 0xFFFFFF : mirror ? 1 : 0);
    }
    /**
     * @param {boolean} mirror
     */
    mirror(mirror) {
        wasm.boxmodelcore_mirror(this.__wbg_ptr, mirror);
    }
    /**
     * @param {number} tex_w
     * @param {number} tex_h
     */
    constructor(tex_w, tex_h) {
        const ret = wasm.boxmodelcore_new(tex_w, tex_h);
        this.__wbg_ptr = ret;
        BoxModelCoreFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {number} x
     * @param {number} y
     * @param {number} z
     */
    pivot(x, y, z) {
        wasm.boxmodelcore_pivot(this.__wbg_ptr, x, y, z);
    }
    /**
     * @param {number} x
     * @param {number} y
     * @param {number} z
     */
    rot(x, y, z) {
        wasm.boxmodelcore_rot(this.__wbg_ptr, x, y, z);
    }
    /**
     * @param {number} u
     * @param {number} v
     */
    tex(u, v) {
        wasm.boxmodelcore_tex(this.__wbg_ptr, u, v);
    }
    /**
     * Export as JSON for debugging/serialization.
     * @returns {string}
     */
    to_json() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.boxmodelcore_to_json(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @param {boolean} visible
     */
    visible(visible) {
        wasm.boxmodelcore_visible(this.__wbg_ptr, visible);
    }
}
if (Symbol.dispose) BoxModelCore.prototype[Symbol.dispose] = BoxModelCore.prototype.free;

export class CameraEye {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        CameraEyeFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_cameraeye_free(ptr, 0);
    }
    /**
     * @param {number} partial
     * @param {number} target
     * @returns {number}
     */
    height(partial, target) {
        const ret = wasm.cameraeye_height(this.__wbg_ptr, partial, target);
        return ret;
    }
    constructor() {
        const ret = wasm.cameraeye_new();
        this.__wbg_ptr = ret;
        CameraEyeFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    reset() {
        wasm.cameraeye_reset(this.__wbg_ptr);
    }
    /**
     * @param {number} height
     */
    tick(height) {
        wasm.cameraeye_tick(this.__wbg_ptr, height);
    }
}
if (Symbol.dispose) CameraEye.prototype[Symbol.dispose] = CameraEye.prototype.free;

/**
 * WASM-bound wrapper for CaptureNetwork.
 */
export class CaptureNetworkCore {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        CaptureNetworkCoreFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_capturenetworkcore_free(ptr, 0);
    }
    /**
     * Increment a packet name counter (called from JS hooking layer).
     * @param {string} name
     */
    count_packet(name) {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.capturenetworkcore_count_packet(this.__wbg_ptr, ptr0, len0);
    }
    /**
     * Current packet counts as a JSON string.
     * @returns {string}
     */
    counts() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.capturenetworkcore_counts(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * Dump all captured data as a JSON string.
     * @returns {string}
     */
    dump() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.capturenetworkcore_dump(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * Number of events currently in the buffer.
     * @returns {number}
     */
    event_count() {
        const ret = wasm.capturenetworkcore_event_count(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Start capturing network events with an optional event limit.
     * @param {number | null} [limit]
     */
    constructor(limit) {
        const ret = wasm.capturenetworkcore_new(isLikeNone(limit) ? Number.MAX_SAFE_INTEGER : (limit) >>> 0);
        this.__wbg_ptr = ret;
        CaptureNetworkCoreFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Record a network event (called from JS hooking layer).
     * `event_json` is a JSON string matching the NetworkEvent shape.
     * @param {string} event_json
     */
    record(event_json) {
        const ptr0 = passStringToWasm0(event_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.capturenetworkcore_record(this.__wbg_ptr, ptr0, len0);
    }
    /**
     * Stop capturing and return the dump as a JSON string.
     * @returns {string}
     */
    stop() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.capturenetworkcore_stop(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
        }
    }
}
if (Symbol.dispose) CaptureNetworkCore.prototype[Symbol.dispose] = CaptureNetworkCore.prototype.free;

/**
 * Decoded column. Sections are indexed by section Y (0..16).
 */
export class ChunkColumn {
    static __wrap(ptr) {
        const obj = Object.create(ChunkColumn.prototype);
        obj.__wbg_ptr = ptr;
        ChunkColumnFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ChunkColumnFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_chunkcolumn_free(ptr, 0);
    }
    /**
     * @returns {Uint32Array}
     */
    biomes() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.chunkcolumn_biomes(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayU32FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export3(r0, r1 * 4, 4);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * Block states for a section, or an empty vector when it is absent.
     * @param {number} y
     * @returns {Uint32Array}
     */
    blocks(y) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.chunkcolumn_blocks(retptr, this.__wbg_ptr, y);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayU32FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export3(r0, r1 * 4, 4);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @returns {boolean}
     */
    has_biomes() {
        const ret = wasm.chunkcolumn_has_biomes(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @param {number} y
     * @returns {number}
     */
    non_air(y) {
        const ret = wasm.chunkcolumn_non_air(this.__wbg_ptr, y);
        return ret >>> 0;
    }
    /**
     * @param {number} y
     * @returns {boolean}
     */
    present(y) {
        const ret = wasm.chunkcolumn_present(this.__wbg_ptr, y);
        return ret !== 0;
    }
    /**
     * @param {number} y
     * @returns {number}
     */
    wire_non_air(y) {
        const ret = wasm.chunkcolumn_wire_non_air(this.__wbg_ptr, y);
        return ret >>> 0;
    }
}
if (Symbol.dispose) ChunkColumn.prototype[Symbol.dispose] = ChunkColumn.prototype.free;

/**
 * Main Connection struct
 */
export class Connection {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ConnectionFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_connection_free(ptr, 0);
    }
    /**
     * Get bytes received
     * @returns {bigint}
     */
    get bytes_in() {
        const ret = wasm.connection_bytes_in(this.__wbg_ptr);
        return BigInt.asUintN(64, ret);
    }
    /**
     * Close the connection
     */
    close() {
        wasm.connection_close(this.__wbg_ptr);
    }
    /**
     * Connect to a host with the given credentials.
     * Sends a "connect" control message.
     * @param {string} host
     * @param {number} port
     * @param {string} username
     * @param {object | null} [auth]
     */
    connect(host, port, username, auth) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            const val3 = +port;
            let ptr0, len0, ptr1, len1;
            try {
                ptr0 = passStringToWasm0(host, wasm.__wbindgen_export, wasm.__wbindgen_export2);
                len0 = WASM_VECTOR_LEN;
                ptr1 = passStringToWasm0(username, wasm.__wbindgen_export, wasm.__wbindgen_export2);
                len1 = WASM_VECTOR_LEN;
            } catch (e) {
                if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
                if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
                throw e;
            }
            wasm.connection_connect(retptr, this.__wbg_ptr, ptr0, len0, val3, ptr1, len1, isLikeNone(auth) ? 0 : addToExternrefTable0(auth));
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            if (r1) {
                throw takeFromExternrefTable0(r0);
            }
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * Create a new Connection.
     */
    constructor() {
        const ret = wasm.connection_new();
        this.__wbg_ptr = ret;
        ConnectionFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Register an event handler for the given event name.
     * Event names: "close", "control", "packet"
     * @param {string} ev
     * @param {Function} callback
     */
    on(ev, callback) {
        const ptr0 = passStringToWasm0(ev, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.connection_on(this.__wbg_ptr, ptr0, len0, callback);
    }
    /**
     * Open a socket connection to the given address.
     * If the address is an Eaglercraft address (ws:// or wss://), connects directly.
     * Otherwise, uses the configured proxy.
     * @param {string} address
     */
    open(address) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            const ptr0 = passStringToWasm0(address, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            wasm.connection_open(retptr, this.__wbg_ptr, ptr0, len0);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            if (r1) {
                throw takeFromExternrefTable0(r0);
            }
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * Get packets received
     * @returns {bigint}
     */
    get packets_in() {
        const ret = wasm.connection_packets_in(this.__wbg_ptr);
        return BigInt.asUintN(64, ret);
    }
    /**
     * Ping a host (for server list) - synchronous version that initiates ping
     * Returns a Promise-like result via callback
     * @param {string} host
     * @param {number} port
     */
    ping(host, port) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            const val2 = +port;
            const ptr0 = passStringToWasm0(host, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            wasm.connection_ping(retptr, this.__wbg_ptr, ptr0, len0, val2);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            if (r1) {
                throw takeFromExternrefTable0(r0);
            }
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * Send binary data (play packets)
     * @param {Uint8Array | number[]} bytes
     */
    send(bytes) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_export);
            const len0 = WASM_VECTOR_LEN;
            wasm.connection_send(retptr, this.__wbg_ptr, ptr0, len0);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            if (r1) {
                throw takeFromExternrefTable0(r0);
            }
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * Get the current connection state
     * @returns {string}
     */
    get state() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.connection_state(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
        }
    }
}
if (Symbol.dispose) Connection.prototype[Symbol.dispose] = Connection.prototype.free;

/**
 * Events that can be emitted by the Connection
 * @enum {0 | 1 | 2}
 */
export const ConnectionEventKind = Object.freeze({
    Close: 0, "0": "Close",
    Control: 1, "1": "Control",
    Packet: 2, "2": "Packet",
});

export class CraftingTableCore {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        CraftingTableCoreFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_craftingtablecore_free(ptr, 0);
    }
    /**
     * @param {string} grid_json
     * @param {number} n
     * @param {string} durability_json
     * @returns {string}
     */
    craft(grid_json, n, durability_json) {
        let deferred4_0;
        let deferred4_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            const val3 = +n;
            let ptr0, len0, ptr1, len1;
            try {
                ptr0 = passStringToWasm0(grid_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
                len0 = WASM_VECTOR_LEN;
                ptr1 = passStringToWasm0(durability_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
                len1 = WASM_VECTOR_LEN;
            } catch (e) {
                if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
                if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
                throw e;
            }
            wasm.craftingtablecore_craft(retptr, this.__wbg_ptr, ptr0, len0, val3, ptr1, len1);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred4_0 = r0;
            deferred4_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred4_0, deferred4_1, 1);
        }
    }
    /**
     * @param {string} json
     */
    constructor(json) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            const ptr0 = passStringToWasm0(json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            wasm.craftingtablecore_new(retptr, ptr0, len0);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            this.__wbg_ptr = r0;
            CraftingTableCoreFinalization.register(this, this.__wbg_ptr, this);
            return this;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @returns {number}
     */
    shaped_count() {
        const ret = wasm.craftingtablecore_shaped_count(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    shapeless_count() {
        const ret = wasm.craftingtablecore_shapeless_count(this.__wbg_ptr);
        return ret >>> 0;
    }
}
if (Symbol.dispose) CraftingTableCore.prototype[Symbol.dispose] = CraftingTableCore.prototype.free;

/**
 * Result of packet deserialization
 */
export class DecodedPacket {
    static __wrap(ptr) {
        const obj = Object.create(DecodedPacket.prototype);
        obj.__wbg_ptr = ptr;
        DecodedPacketFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        DecodedPacketFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_decodedpacket_free(ptr, 0);
    }
    /**
     * @returns {Uint8Array}
     */
    data() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.decodedpacket_data(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export3(r0, r1 * 1, 1);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @returns {number}
     */
    packet_id() {
        const ret = wasm.decodedpacket_packet_id(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {string | undefined}
     */
    packet_name() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.decodedpacket_packet_name(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            let v1;
            if (r0 !== 0) {
                v1 = getStringFromWasm0(r0, r1);
                wasm.__wbindgen_export3(r0, r1 * 1, 1);
            }
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
}
if (Symbol.dispose) DecodedPacket.prototype[Symbol.dispose] = DecodedPacket.prototype.free;

/**
 * Entity effect type for particle generation.
 * @enum {0 | 1 | 2 | 3 | 4}
 */
export const EntityEffectType = Object.freeze({
    /**
     * End crystal healing beam
     */
    CrystalBeam: 0, "0": "CrystalBeam",
    /**
     * Guardian laser beam
     */
    GuardianBeam: 1, "1": "GuardianBeam",
    /**
     * Ender dragon death rays
     */
    DragonDeathRays: 2, "2": "DragonDeathRays",
    /**
     * Potion effect particles (swirly)
     */
    PotionSwirl: 3, "3": "PotionSwirl",
    /**
     * Glowing effect outline
     */
    Glowing: 4, "4": "Glowing",
});

/**
 * JS: an `EVENT_SOUNDS` entry for wasm consumers. `pitch_kind`:
 * 0 = `() => 1`, 1 = `() => 1.2`, 2 = `r()*0.1+0.9`, 3 = `2.6+(r-r)*0.8`,
 * 4 = `(r-r)*0.2+1`.
 */
export class EventSoundInfo {
    static __wrap(ptr) {
        const obj = Object.create(EventSoundInfo.prototype);
        obj.__wbg_ptr = ptr;
        EventSoundInfoFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        EventSoundInfoFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_eventsoundinfo_free(ptr, 0);
    }
    /**
     * @returns {string}
     */
    get event() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.__wbg_get_eventsoundinfo_event(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {boolean}
     */
    get found() {
        const ret = wasm.__wbg_get_eventsoundinfo_found(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {number}
     */
    get pitch_kind() {
        const ret = wasm.__wbg_get_eventsoundinfo_pitch_kind(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get volume() {
        const ret = wasm.__wbg_get_eventsoundinfo_volume(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {string} arg0
     */
    set event(arg0) {
        const ptr0 = passStringToWasm0(arg0, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_eventsoundinfo_event(this.__wbg_ptr, ptr0, len0);
    }
    /**
     * @param {boolean} arg0
     */
    set found(arg0) {
        wasm.__wbg_set_eventsoundinfo_found(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set pitch_kind(arg0) {
        wasm.__wbg_set_eventsoundinfo_pitch_kind(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set volume(arg0) {
        wasm.__wbg_set_eventsoundinfo_volume(this.__wbg_ptr, arg0);
    }
}
if (Symbol.dispose) EventSoundInfo.prototype[Symbol.dispose] = EventSoundInfo.prototype.free;

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
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        FallingBlockFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_fallingblock_free(ptr, 0);
    }
    /**
     * Get the entity's bounding box in world coordinates as a flat array:
     * [minX, minY, minZ, maxX, maxY, maxZ].
     * @returns {Float64Array}
     */
    bounding_box() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.fallingblock_bounding_box(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayF64FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export3(r0, r1 * 8, 8);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @param {number} block_state
     */
    constructor(x, y, z, block_state) {
        const ret = wasm.fallingblock_new(x, y, z, block_state);
        this.__wbg_ptr = ret;
        FallingBlockFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Tick the falling block physics for one game tick.
     *
     * Returns `true` if the entity should be removed (landed or expired),
     * `false` if it should continue existing.
     *
     * # Arguments
     * * `world` - WorldCore for collision queries and block state access
     * * `registry` - BlockRegistryCore for block property lookups
     * @param {WorldCore} world
     * @param {BlockRegistryCore} registry
     * @returns {boolean}
     */
    tick(world, registry) {
        _assertClass(world, WorldCore);
        _assertClass(registry, BlockRegistryCore);
        const ret = wasm.fallingblock_tick(this.__wbg_ptr, world.__wbg_ptr, registry.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {number}
     */
    get age() {
        const ret = wasm.__wbg_get_fallingblock_age(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get block_state() {
        const ret = wasm.__wbg_get_fallingblock_block_state(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {boolean}
     */
    get falling_started() {
        const ret = wasm.__wbg_get_fallingblock_falling_started(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {number}
     */
    get height() {
        const ret = wasm.__wbg_get_fallingblock_height(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get motion_x() {
        const ret = wasm.__wbg_get_fallingblock_motion_x(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get motion_y() {
        const ret = wasm.__wbg_get_fallingblock_motion_y(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get motion_z() {
        const ret = wasm.__wbg_get_fallingblock_motion_z(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {boolean}
     */
    get no_gravity() {
        const ret = wasm.__wbg_get_fallingblock_no_gravity(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {boolean}
     */
    get on_ground() {
        const ret = wasm.__wbg_get_fallingblock_on_ground(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {number}
     */
    get width() {
        const ret = wasm.__wbg_get_fallingblock_width(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get x() {
        const ret = wasm.__wbg_get_fallingblock_x(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get y() {
        const ret = wasm.__wbg_get_fallingblock_y(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get z() {
        const ret = wasm.__wbg_get_fallingblock_z(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set age(arg0) {
        wasm.__wbg_set_fallingblock_age(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set block_state(arg0) {
        wasm.__wbg_set_fallingblock_block_state(this.__wbg_ptr, arg0);
    }
    /**
     * @param {boolean} arg0
     */
    set falling_started(arg0) {
        wasm.__wbg_set_fallingblock_falling_started(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set height(arg0) {
        wasm.__wbg_set_fallingblock_height(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set motion_x(arg0) {
        wasm.__wbg_set_fallingblock_motion_x(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set motion_y(arg0) {
        wasm.__wbg_set_fallingblock_motion_y(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set motion_z(arg0) {
        wasm.__wbg_set_fallingblock_motion_z(this.__wbg_ptr, arg0);
    }
    /**
     * @param {boolean} arg0
     */
    set no_gravity(arg0) {
        wasm.__wbg_set_fallingblock_no_gravity(this.__wbg_ptr, arg0);
    }
    /**
     * @param {boolean} arg0
     */
    set on_ground(arg0) {
        wasm.__wbg_set_fallingblock_on_ground(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set width(arg0) {
        wasm.__wbg_set_fallingblock_width(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set x(arg0) {
        wasm.__wbg_set_fallingblock_x(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set y(arg0) {
        wasm.__wbg_set_fallingblock_y(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set z(arg0) {
        wasm.__wbg_set_fallingblock_z(this.__wbg_ptr, arg0);
    }
}
if (Symbol.dispose) FallingBlock.prototype[Symbol.dispose] = FallingBlock.prototype.free;

/**
 * Input entity for fire rendering.
 */
export class FireEntity {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        FireEntityFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_fireentity_free(ptr, 0);
    }
    /**
     * Entity type ID (for immunity check)
     * @returns {number}
     */
    get entity_type() {
        const ret = wasm.__wbg_get_fireentity_entity_type(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Player gamemode (3 = spectator)
     * @returns {number}
     */
    get gamemode() {
        const ret = wasm.__wbg_get_fireentity_gamemode(this.__wbg_ptr);
        return ret;
    }
    /**
     * Entity height (default 1.8)
     * @returns {number}
     */
    get height() {
        const ret = wasm.__wbg_get_fireentity_height(this.__wbg_ptr);
        return ret;
    }
    /**
     * Entity unique ID (not used in geometry, but useful for debugging)
     * @returns {number}
     */
    get id() {
        const ret = wasm.__wbg_get_fireentity_id(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Entity kind: 0 = mob, 1 = player, 2 = other
     * @returns {number}
     */
    get kind() {
        const ret = wasm.__wbg_get_fireentity_kind(this.__wbg_ptr);
        return ret;
    }
    /**
     * Whether the entity is on fire
     * @returns {boolean}
     */
    get on_fire() {
        const ret = wasm.__wbg_get_fireentity_on_fire(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * Entity width (default 0.6)
     * @returns {number}
     */
    get width() {
        const ret = wasm.__wbg_get_fireentity_width(this.__wbg_ptr);
        return ret;
    }
    /**
     * Whether it's a wither (special case for type 51)
     * @returns {boolean}
     */
    get wither() {
        const ret = wasm.__wbg_get_fireentity_wither(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * Interpolated position X
     * @returns {number}
     */
    get x() {
        const ret = wasm.__wbg_get_fireentity_x(this.__wbg_ptr);
        return ret;
    }
    /**
     * Interpolated position Y
     * @returns {number}
     */
    get y() {
        const ret = wasm.__wbg_get_fireentity_y(this.__wbg_ptr);
        return ret;
    }
    /**
     * Interpolated position Z
     * @returns {number}
     */
    get z() {
        const ret = wasm.__wbg_get_fireentity_z(this.__wbg_ptr);
        return ret;
    }
    /**
     * Entity type ID (for immunity check)
     * @param {number} arg0
     */
    set entity_type(arg0) {
        wasm.__wbg_set_fireentity_entity_type(this.__wbg_ptr, arg0);
    }
    /**
     * Player gamemode (3 = spectator)
     * @param {number} arg0
     */
    set gamemode(arg0) {
        wasm.__wbg_set_fireentity_gamemode(this.__wbg_ptr, arg0);
    }
    /**
     * Entity height (default 1.8)
     * @param {number} arg0
     */
    set height(arg0) {
        wasm.__wbg_set_fireentity_height(this.__wbg_ptr, arg0);
    }
    /**
     * Entity unique ID (not used in geometry, but useful for debugging)
     * @param {number} arg0
     */
    set id(arg0) {
        wasm.__wbg_set_fireentity_id(this.__wbg_ptr, arg0);
    }
    /**
     * Entity kind: 0 = mob, 1 = player, 2 = other
     * @param {number} arg0
     */
    set kind(arg0) {
        wasm.__wbg_set_fireentity_kind(this.__wbg_ptr, arg0);
    }
    /**
     * Whether the entity is on fire
     * @param {boolean} arg0
     */
    set on_fire(arg0) {
        wasm.__wbg_set_fireentity_on_fire(this.__wbg_ptr, arg0);
    }
    /**
     * Entity width (default 0.6)
     * @param {number} arg0
     */
    set width(arg0) {
        wasm.__wbg_set_fireentity_width(this.__wbg_ptr, arg0);
    }
    /**
     * Whether it's a wither (special case for type 51)
     * @param {boolean} arg0
     */
    set wither(arg0) {
        wasm.__wbg_set_fireentity_wither(this.__wbg_ptr, arg0);
    }
    /**
     * Interpolated position X
     * @param {number} arg0
     */
    set x(arg0) {
        wasm.__wbg_set_fireentity_x(this.__wbg_ptr, arg0);
    }
    /**
     * Interpolated position Y
     * @param {number} arg0
     */
    set y(arg0) {
        wasm.__wbg_set_fireentity_y(this.__wbg_ptr, arg0);
    }
    /**
     * Interpolated position Z
     * @param {number} arg0
     */
    set z(arg0) {
        wasm.__wbg_set_fireentity_z(this.__wbg_ptr, arg0);
    }
}
if (Symbol.dispose) FireEntity.prototype[Symbol.dispose] = FireEntity.prototype.free;

/**
 * Result of fire geometry generation.
 * Returns a flat Float32Array: [x, y, z, u, v, r, g, b, a, ...] per vertex.
 * Each quad has 4 vertices = 36 floats (9 per vertex * 4).
 */
export class FireGeometryResult {
    static __wrap(ptr) {
        const obj = Object.create(FireGeometryResult.prototype);
        obj.__wbg_ptr = ptr;
        FireGeometryResultFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        FireGeometryResultFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_firegeometryresult_free(ptr, 0);
    }
    /**
     * Returns true if there are no vertices (empty result).
     * @returns {boolean}
     */
    get is_empty() {
        const ret = wasm.firegeometryresult_is_empty(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * Number of quads (each quad = 2 triangles = 6 indices).
     * @returns {number}
     */
    get quad_count() {
        const ret = wasm.firegeometryresult_quad_count(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Number of vertices (each quad = 4 vertices).
     * @returns {number}
     */
    get vertex_count() {
        const ret = wasm.firegeometryresult_vertex_count(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Get the vertices as a flat array (9 floats per vertex: x,y,z, u,v, r,g,b,a).
     * @returns {Float32Array}
     */
    get vertices() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.firegeometryresult_vertices(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayF32FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export3(r0, r1 * 4, 4);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
}
if (Symbol.dispose) FireGeometryResult.prototype[Symbol.dispose] = FireGeometryResult.prototype.free;

/**
 * Result of fire overlay geometry generation.
 * Returns a flat array of f32: [x, y, z, u, v, r, g, b, a, ...] per vertex.
 * Two intersecting planes, 4 vertices each = 8 vertices = 72 floats.
 */
export class FireOverlayGeometryResult {
    static __wrap(ptr) {
        const obj = Object.create(FireOverlayGeometryResult.prototype);
        obj.__wbg_ptr = ptr;
        FireOverlayGeometryResultFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        FireOverlayGeometryResultFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_fireoverlaygeometryresult_free(ptr, 0);
    }
    /**
     * Returns true if there are no vertices (empty result).
     * @returns {boolean}
     */
    get is_empty() {
        const ret = wasm.fireoverlaygeometryresult_is_empty(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * Number of vertices (always 8 for the fire overlay: 2 planes × 4 vertices).
     * @returns {number}
     */
    get vertex_count() {
        const ret = wasm.fireoverlaygeometryresult_vertex_count(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Get the vertices as a flat array (9 floats per vertex: x,y,z, u,v, r,g,b,a).
     * @returns {Float32Array}
     */
    get vertices() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.fireoverlaygeometryresult_vertices(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayF32FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export3(r0, r1 * 4, 4);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
}
if (Symbol.dispose) FireOverlayGeometryResult.prototype[Symbol.dispose] = FireOverlayGeometryResult.prototype.free;

/**
 * UV coordinates for a fire texture in the atlas.
 * JS expects [u0, v0, u1, v1] where (u0,v0) is top-left and (u1,v1) is bottom-right.
 */
export class FireUv {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        FireUvFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_fireuv_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get u0() {
        const ret = wasm.__wbg_get_fireuv_u0(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get u1() {
        const ret = wasm.__wbg_get_fireuv_u1(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get v0() {
        const ret = wasm.__wbg_get_fireuv_v0(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get v1() {
        const ret = wasm.__wbg_get_fireuv_v1(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set u0(arg0) {
        wasm.__wbg_set_fireuv_u0(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set u1(arg0) {
        wasm.__wbg_set_fireuv_u1(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set v0(arg0) {
        wasm.__wbg_set_fireuv_v0(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set v1(arg0) {
        wasm.__wbg_set_fireuv_v1(this.__wbg_ptr, arg0);
    }
}
if (Symbol.dispose) FireUv.prototype[Symbol.dispose] = FireUv.prototype.free;

export class FluidState {
    static __wrap(ptr) {
        const obj = Object.create(FluidState.prototype);
        obj.__wbg_ptr = ptr;
        FluidStateFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        FluidStateFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_fluidstate_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get height() {
        const ret = wasm.fluidstate_height(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {boolean}
     */
    get is_lava() {
        const ret = wasm.fluidstate_is_lava(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {boolean}
     */
    get is_water() {
        const ret = wasm.fluidstate_is_water(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {number}
     */
    get level() {
        const ret = wasm.fluidstate_level(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {boolean}
     */
    get source() {
        const ret = wasm.fluidstate_source(this.__wbg_ptr);
        return ret !== 0;
    }
}
if (Symbol.dispose) FluidState.prototype[Symbol.dispose] = FluidState.prototype.free;

/**
 * AI tick result for wasm return.
 */
export class FoxAITickResult {
    static __wrap(ptr) {
        const obj = Object.create(FoxAITickResult.prototype);
        obj.__wbg_ptr = ptr;
        FoxAITickResultFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        FoxAITickResultFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_foxaitickresult_free(ptr, 0);
    }
    /**
     * @returns {FoxBehavior}
     */
    get behavior() {
        const ret = wasm.foxaitickresult_behavior(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {FoxBehavior} behavior
     * @param {FoxTargetResult} target
     */
    constructor(behavior, target) {
        const val2 = +behavior;
        _assertClass(target, FoxTargetResult);
        var ptr0 = target.__destroy_into_raw();
        const ret = wasm.foxaitickresult_new(val2, ptr0);
        this.__wbg_ptr = ret;
        FoxAITickResultFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @returns {FoxTargetResult}
     */
    get target() {
        const ret = wasm.foxaitickresult_target(this.__wbg_ptr);
        return FoxTargetResult.__wrap(ret);
    }
}
if (Symbol.dispose) FoxAITickResult.prototype[Symbol.dispose] = FoxAITickResult.prototype.free;

/**
 * Animation arguments returned to JS for fox model rendering.
 */
export class FoxAnimationArgs {
    static __wrap(ptr) {
        const obj = Object.create(FoxAnimationArgs.prototype);
        obj.__wbg_ptr = ptr;
        FoxAnimationArgsFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        FoxAnimationArgsFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_foxanimationargs_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get fox_crouch_amount() {
        const ret = wasm.__wbg_get_foxanimationargs_fox_crouch_amount(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {boolean}
     */
    get fox_crouching() {
        const ret = wasm.__wbg_get_foxanimationargs_fox_crouching(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {boolean}
     */
    get fox_faceplanted() {
        const ret = wasm.__wbg_get_foxanimationargs_fox_faceplanted(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {number}
     */
    get fox_head_roll() {
        const ret = wasm.__wbg_get_foxanimationargs_fox_head_roll(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {boolean}
     */
    get fox_sleeping() {
        const ret = wasm.__wbg_get_foxanimationargs_fox_sleeping(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @param {number} arg0
     */
    set fox_crouch_amount(arg0) {
        wasm.__wbg_set_foxanimationargs_fox_crouch_amount(this.__wbg_ptr, arg0);
    }
    /**
     * @param {boolean} arg0
     */
    set fox_crouching(arg0) {
        wasm.__wbg_set_foxanimationargs_fox_crouching(this.__wbg_ptr, arg0);
    }
    /**
     * @param {boolean} arg0
     */
    set fox_faceplanted(arg0) {
        wasm.__wbg_set_foxanimationargs_fox_faceplanted(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set fox_head_roll(arg0) {
        wasm.__wbg_set_foxanimationargs_fox_head_roll(this.__wbg_ptr, arg0);
    }
    /**
     * @param {boolean} arg0
     */
    set fox_sleeping(arg0) {
        wasm.__wbg_set_foxanimationargs_fox_sleeping(this.__wbg_ptr, arg0);
    }
}
if (Symbol.dispose) FoxAnimationArgs.prototype[Symbol.dispose] = FoxAnimationArgs.prototype.free;

/**
 * Fox AI behavior state machine.
 * @enum {0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11}
 */
export const FoxBehavior = Object.freeze({
    Idle: 0, "0": "Idle",
    Sleeping: 1, "1": "Sleeping",
    Sitting: 2, "2": "Sitting",
    Wandering: 3, "3": "Wandering",
    Hunting: 4, "4": "Hunting",
    Fleeing: 5, "5": "Fleeing",
    Pouncing: 6, "6": "Pouncing",
    Faceplanted: 7, "7": "Faceplanted",
    Breeding: 8, "8": "Breeding",
    FollowingOwner: 9, "9": "FollowingOwner",
    Defending: 10, "10": "Defending",
    Eating: 11, "11": "Eating",
});

/**
 * Fox sound event types.
 * @enum {0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10}
 */
export const FoxSound = Object.freeze({
    None: 0, "0": "None",
    Ambient: 1, "1": "Ambient",
    Hurt: 2, "2": "Hurt",
    Death: 3, "3": "Death",
    Sleep: 4, "4": "Sleep",
    Wake: 5, "5": "Wake",
    Screech: 6, "6": "Screech",
    Sniff: 7, "7": "Sniff",
    Eat: 8, "8": "Eat",
    Pounce: 9, "9": "Pounce",
    Faceplant: 10, "10": "Faceplant",
});

/**
 * Internal fox state for AI tick (mirrors entity fields used by JS).
 */
export class FoxState {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        FoxStateFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_foxstate_free(ptr, 0);
    }
    /**
     * Prepare animation arguments for render (matches `foxAnimationArgs`).
     * @param {number} partial
     * @returns {FoxAnimationArgs}
     */
    animation_args(partial) {
        const ret = wasm.foxstate_animation_args(this.__wbg_ptr, partial);
        return FoxAnimationArgs.__wrap(ret);
    }
    /**
     * Apply fox flags from metadata byte (matches `applyFoxFlags`).
     * @param {number} flags
     */
    apply_flags(flags) {
        wasm.foxstate_apply_flags(this.__wbg_ptr, flags);
    }
    /**
     * Get current flags byte.
     * @returns {number}
     */
    flags() {
        const ret = wasm.foxstate_flags(this.__wbg_ptr);
        return ret;
    }
    constructor() {
        const ret = wasm.foxstate_new();
        this.__wbg_ptr = ret;
        FoxStateFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Per-tick interpolation update (matches `tickFox`).
     */
    tick() {
        wasm.foxstate_tick(this.__wbg_ptr);
    }
    /**
     * @returns {number}
     */
    get age() {
        const ret = wasm.__wbg_get_foxstate_age(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {boolean}
     */
    get child() {
        const ret = wasm.__wbg_get_foxstate_child(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {number}
     */
    get fox_crouch_amount() {
        const ret = wasm.__wbg_get_foxstate_fox_crouch_amount(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {boolean}
     */
    get fox_crouching() {
        const ret = wasm.__wbg_get_foxstate_fox_crouching(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {boolean}
     */
    get fox_defending() {
        const ret = wasm.__wbg_get_foxstate_fox_defending(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {boolean}
     */
    get fox_faceplanted() {
        const ret = wasm.__wbg_get_foxstate_fox_faceplanted(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {number}
     */
    get fox_flags() {
        const ret = wasm.__wbg_get_foxstate_fox_flags(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get fox_interest_amount() {
        const ret = wasm.__wbg_get_foxstate_fox_interest_amount(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {boolean}
     */
    get fox_interested() {
        const ret = wasm.__wbg_get_foxstate_fox_interested(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {boolean}
     */
    get fox_pouncing() {
        const ret = wasm.__wbg_get_foxstate_fox_pouncing(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {boolean}
     */
    get fox_sleeping() {
        const ret = wasm.__wbg_get_foxstate_fox_sleeping(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {number}
     */
    get fox_type() {
        const ret = wasm.__wbg_get_foxstate_fox_type(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get prev_fox_crouch_amount() {
        const ret = wasm.__wbg_get_foxstate_prev_fox_crouch_amount(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get prev_fox_interested() {
        const ret = wasm.__wbg_get_foxstate_prev_fox_interested(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {boolean}
     */
    get sitting() {
        const ret = wasm.__wbg_get_foxstate_sitting(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {bigint}
     */
    get trusted_uuid_0() {
        const ret = wasm.__wbg_get_foxstate_trusted_uuid_0(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {bigint}
     */
    get trusted_uuid_1() {
        const ret = wasm.__wbg_get_foxstate_trusted_uuid_1(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set age(arg0) {
        wasm.__wbg_set_foxstate_age(this.__wbg_ptr, arg0);
    }
    /**
     * @param {boolean} arg0
     */
    set child(arg0) {
        wasm.__wbg_set_foxstate_child(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set fox_crouch_amount(arg0) {
        wasm.__wbg_set_foxstate_fox_crouch_amount(this.__wbg_ptr, arg0);
    }
    /**
     * @param {boolean} arg0
     */
    set fox_crouching(arg0) {
        wasm.__wbg_set_foxstate_fox_crouching(this.__wbg_ptr, arg0);
    }
    /**
     * @param {boolean} arg0
     */
    set fox_defending(arg0) {
        wasm.__wbg_set_foxstate_fox_defending(this.__wbg_ptr, arg0);
    }
    /**
     * @param {boolean} arg0
     */
    set fox_faceplanted(arg0) {
        wasm.__wbg_set_foxstate_fox_faceplanted(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set fox_flags(arg0) {
        wasm.__wbg_set_foxstate_fox_flags(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set fox_interest_amount(arg0) {
        wasm.__wbg_set_foxstate_fox_interest_amount(this.__wbg_ptr, arg0);
    }
    /**
     * @param {boolean} arg0
     */
    set fox_interested(arg0) {
        wasm.__wbg_set_foxstate_fox_interested(this.__wbg_ptr, arg0);
    }
    /**
     * @param {boolean} arg0
     */
    set fox_pouncing(arg0) {
        wasm.__wbg_set_foxstate_fox_pouncing(this.__wbg_ptr, arg0);
    }
    /**
     * @param {boolean} arg0
     */
    set fox_sleeping(arg0) {
        wasm.__wbg_set_foxstate_fox_sleeping(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set fox_type(arg0) {
        wasm.__wbg_set_foxstate_fox_type(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set prev_fox_crouch_amount(arg0) {
        wasm.__wbg_set_foxstate_prev_fox_crouch_amount(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set prev_fox_interested(arg0) {
        wasm.__wbg_set_foxstate_prev_fox_interested(this.__wbg_ptr, arg0);
    }
    /**
     * @param {boolean} arg0
     */
    set sitting(arg0) {
        wasm.__wbg_set_foxstate_sitting(this.__wbg_ptr, arg0);
    }
    /**
     * @param {bigint} arg0
     */
    set trusted_uuid_0(arg0) {
        wasm.__wbg_set_foxstate_trusted_uuid_0(this.__wbg_ptr, arg0);
    }
    /**
     * @param {bigint} arg0
     */
    set trusted_uuid_1(arg0) {
        wasm.__wbg_set_foxstate_trusted_uuid_1(this.__wbg_ptr, arg0);
    }
}
if (Symbol.dispose) FoxState.prototype[Symbol.dispose] = FoxState.prototype.free;

/**
 * Result of target selection.
 */
export class FoxTargetResult {
    static __wrap(ptr) {
        const obj = Object.create(FoxTargetResult.prototype);
        obj.__wbg_ptr = ptr;
        FoxTargetResultFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        FoxTargetResultFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_foxtargetresult_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get distance_sq() {
        const ret = wasm.foxtargetresult_distance_sq(this.__wbg_ptr);
        return ret;
    }
    constructor() {
        const ret = wasm.foxtargetresult_new();
        this.__wbg_ptr = ret;
        FoxTargetResultFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @returns {number}
     */
    get target_entity_id() {
        const ret = wasm.foxtargetresult_target_entity_id(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {FoxTargetType}
     */
    get target_type() {
        const ret = wasm.foxtargetresult_target_type(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get target_x() {
        const ret = wasm.foxtargetresult_target_x(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get target_y() {
        const ret = wasm.foxtargetresult_target_y(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get target_z() {
        const ret = wasm.foxtargetresult_target_z(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {boolean}
     */
    get valid() {
        const ret = wasm.foxtargetresult_valid(this.__wbg_ptr);
        return ret !== 0;
    }
}
if (Symbol.dispose) FoxTargetResult.prototype[Symbol.dispose] = FoxTargetResult.prototype.free;

/**
 * Target type for fox AI.
 * @enum {0 | 1 | 2 | 3 | 4 | 5}
 */
export const FoxTargetType = Object.freeze({
    None: 0, "0": "None",
    Prey: 1, "1": "Prey",
    Predator: 2, "2": "Predator",
    Player: 3, "3": "Player",
    BreedingPartner: 4, "4": "BreedingPartner",
    Food: 5, "5": "Food",
});

/**
 * Trust UUID pair for wasm return.
 */
export class FoxTrustPair {
    static __wrap(ptr) {
        const obj = Object.create(FoxTrustPair.prototype);
        obj.__wbg_ptr = ptr;
        FoxTrustPairFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        FoxTrustPairFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_foxtrustpair_free(ptr, 0);
    }
    /**
     * @param {bigint} uuid_0
     * @param {bigint} uuid_1
     */
    constructor(uuid_0, uuid_1) {
        const ret = wasm.foxtrustpair_new(uuid_0, uuid_1);
        this.__wbg_ptr = ret;
        FoxTrustPairFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @returns {bigint}
     */
    get uuid_0() {
        const ret = wasm.__wbg_get_foxtrustpair_uuid_0(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {bigint}
     */
    get uuid_1() {
        const ret = wasm.__wbg_get_foxtrustpair_uuid_1(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {bigint} arg0
     */
    set uuid_0(arg0) {
        wasm.__wbg_set_foxtrustpair_uuid_0(this.__wbg_ptr, arg0);
    }
    /**
     * @param {bigint} arg0
     */
    set uuid_1(arg0) {
        wasm.__wbg_set_foxtrustpair_uuid_1(this.__wbg_ptr, arg0);
    }
}
if (Symbol.dispose) FoxTrustPair.prototype[Symbol.dispose] = FoxTrustPair.prototype.free;

/**
 * Persistent frustum used by the renderer: `from_matrix` runs once per
 * camera change, then every culling call is just the box test.
 */
export class Frustum {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        FrustumFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_frustum_free(ptr, 0);
    }
    /**
     * @param {number} x0
     * @param {number} y0
     * @param {number} z0
     * @param {number} x1
     * @param {number} y1
     * @param {number} z1
     * @returns {boolean}
     */
    contains_aabb(x0, y0, z0, x1, y1, z1) {
        const ret = wasm.frustum_contains_aabb(this.__wbg_ptr, x0, y0, z0, x1, y1, z1);
        return ret !== 0;
    }
    /**
     * Update from a column-major view-projection matrix (`Float32Array(16)`).
     * @param {Float32Array | number[]} matrix
     */
    from_matrix(matrix) {
        const ptr0 = passArrayF32ToWasm0(matrix, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.frustum_from_matrix(this.__wbg_ptr, ptr0, len0);
    }
    constructor() {
        const ret = wasm.frustum_new();
        this.__wbg_ptr = ret;
        FrustumFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Flattened planes, for tests and debugging.
     * @returns {Float64Array}
     */
    planes() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.frustum_planes(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayF64FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export3(r0, r1 * 8, 8);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
}
if (Symbol.dispose) Frustum.prototype[Symbol.dispose] = Frustum.prototype.free;

export class ItemTableCore {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ItemTableCoreFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_itemtablecore_free(ptr, 0);
    }
    /**
     * @param {number} id
     * @returns {boolean}
     */
    can_always_eat(id) {
        const ret = wasm.itemtablecore_can_always_eat(this.__wbg_ptr, id);
        return ret !== 0;
    }
    /**
     * @param {number} id
     * @param {string} harvest_tools_json
     * @returns {boolean}
     */
    can_harvest(id, harvest_tools_json) {
        const val2 = +id;
        const ptr0 = passStringToWasm0(harvest_tools_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.itemtablecore_can_harvest(this.__wbg_ptr, val2, ptr0, len0);
        return ret !== 0;
    }
    /**
     * @param {string} id
     * @returns {string}
     */
    cursor_color(id) {
        let deferred2_0;
        let deferred2_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            const ptr0 = passStringToWasm0(id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            wasm.itemtablecore_cursor_color(retptr, this.__wbg_ptr, ptr0, len0);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred2_0 = r0;
            deferred2_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred2_0, deferred2_1, 1);
        }
    }
    /**
     * @param {number} id
     * @param {string} tag_json
     * @returns {string}
     */
    egg_entity(id, tag_json) {
        let deferred3_0;
        let deferred3_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            const val2 = +id;
            const ptr0 = passStringToWasm0(tag_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            wasm.itemtablecore_egg_entity(retptr, this.__wbg_ptr, val2, ptr0, len0);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred3_0 = r0;
            deferred3_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred3_0, deferred3_1, 1);
        }
    }
    /**
     * @param {number} id
     * @returns {string}
     */
    egg_info(id) {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.itemtablecore_egg_info(retptr, this.__wbg_ptr, id);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @param {string} id
     * @returns {string}
     */
    enchantment_key(id) {
        let deferred2_0;
        let deferred2_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            const ptr0 = passStringToWasm0(id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            wasm.itemtablecore_enchantment_key(retptr, this.__wbg_ptr, ptr0, len0);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred2_0 = r0;
            deferred2_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred2_0, deferred2_1, 1);
        }
    }
    /**
     * @param {number} id
     * @param {string} tag_json
     * @returns {string}
     */
    enchantments(id, tag_json) {
        let deferred3_0;
        let deferred3_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            const val2 = +id;
            const ptr0 = passStringToWasm0(tag_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            wasm.itemtablecore_enchantments(retptr, this.__wbg_ptr, val2, ptr0, len0);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred3_0 = r0;
            deferred3_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred3_0, deferred3_1, 1);
        }
    }
    /**
     * @param {number} id
     * @param {string} tag_json
     * @returns {boolean}
     */
    has_effect(id, tag_json) {
        const val2 = +id;
        const ptr0 = passStringToWasm0(tag_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.itemtablecore_has_effect(this.__wbg_ptr, val2, ptr0, len0);
        return ret !== 0;
    }
    /**
     * @param {number} id
     * @param {string} tag_json
     * @returns {boolean}
     */
    is_enchanted(id, tag_json) {
        const val2 = +id;
        const ptr0 = passStringToWasm0(tag_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.itemtablecore_is_enchanted(this.__wbg_ptr, val2, ptr0, len0);
        return ret !== 0;
    }
    /**
     * @param {number} id
     * @returns {boolean}
     */
    is_food(id) {
        const ret = wasm.itemtablecore_is_food(this.__wbg_ptr, id);
        return ret !== 0;
    }
    /**
     * @param {string} id
     * @returns {boolean}
     */
    is_single_level(id) {
        const ptr0 = passStringToWasm0(id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.itemtablecore_is_single_level(this.__wbg_ptr, ptr0, len0);
        return ret !== 0;
    }
    /**
     * @param {number} id
     * @returns {string}
     */
    item_key(id) {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.itemtablecore_item_key(retptr, this.__wbg_ptr, id);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @param {number} id
     * @returns {number}
     */
    max_durability(id) {
        const ret = wasm.itemtablecore_max_durability(this.__wbg_ptr, id);
        return ret;
    }
    /**
     * @param {number} id
     * @returns {number}
     */
    max_stack(id) {
        const ret = wasm.itemtablecore_max_stack(this.__wbg_ptr, id);
        return ret;
    }
    /**
     * @param {number} id
     * @returns {string}
     */
    name(id) {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.itemtablecore_name(retptr, this.__wbg_ptr, id);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @param {string} json_text
     */
    constructor(json_text) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            const ptr0 = passStringToWasm0(json_text, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            wasm.itemtablecore_new(retptr, ptr0, len0);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            this.__wbg_ptr = r0;
            ItemTableCoreFinalization.register(this, this.__wbg_ptr, this);
            return this;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @param {number} id
     * @param {string} tag_json
     * @returns {bigint}
     */
    potion_color(id, tag_json) {
        const val2 = +id;
        const ptr0 = passStringToWasm0(tag_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.itemtablecore_potion_color(this.__wbg_ptr, val2, ptr0, len0);
        return ret;
    }
    /**
     * @param {number} id
     * @param {string} tag_json
     * @returns {string}
     */
    potion_effects(id, tag_json) {
        let deferred3_0;
        let deferred3_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            const val2 = +id;
            const ptr0 = passStringToWasm0(tag_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            wasm.itemtablecore_potion_effects(retptr, this.__wbg_ptr, val2, ptr0, len0);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred3_0 = r0;
            deferred3_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred3_0, deferred3_1, 1);
        }
    }
    /**
     * @param {number} id
     * @param {string} tag_json
     * @returns {number}
     */
    rarity(id, tag_json) {
        const val2 = +id;
        const ptr0 = passStringToWasm0(tag_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.itemtablecore_rarity(this.__wbg_ptr, val2, ptr0, len0);
        return ret;
    }
    /**
     * @param {number} id
     * @param {string} block_name
     * @param {string} material
     * @returns {number}
     */
    str_vs_block(id, block_name, material) {
        const val3 = +id;
        let ptr0, len0, ptr1, len1;
        try {
            ptr0 = passStringToWasm0(block_name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passStringToWasm0(material, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len1 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
            throw e;
        }
        const ret = wasm.itemtablecore_str_vs_block(this.__wbg_ptr, val3, ptr0, len0, ptr1, len1);
        return ret;
    }
    /**
     * @param {number} id
     * @returns {string}
     */
    use_action(id) {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.itemtablecore_use_action(retptr, this.__wbg_ptr, id);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @param {number} id
     * @param {string} tag_json
     * @returns {number}
     */
    use_duration(id, tag_json) {
        const val2 = +id;
        const ptr0 = passStringToWasm0(tag_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.itemtablecore_use_duration(this.__wbg_ptr, val2, ptr0, len0);
        return ret;
    }
}
if (Symbol.dispose) ItemTableCore.prototype[Symbol.dispose] = ItemTableCore.prototype.free;

/**
 * Java-like Random class with 48-bit LCG state
 */
export class JavaRandom {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        JavaRandomFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_javarandom_free(ptr, 0);
    }
    /**
     * Create a new JavaRandom with the given seed
     * @param {number} seed
     */
    constructor(seed) {
        const ret = wasm.javarandom_new(seed);
        this.__wbg_ptr = ret;
        JavaRandomFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Generate a random double in [0, 1)
     * @returns {number}
     */
    next_double() {
        const ret = wasm.javarandom_next_double(this.__wbg_ptr);
        return ret;
    }
    /**
     * Generate a random word (default 32 bits), returns f64 in [0,1)
     * @param {number} bits
     * @returns {number}
     */
    next(bits) {
        const ret = wasm.javarandom_next(this.__wbg_ptr, bits);
        return ret;
    }
    /**
     * Generate a random float in [0, 1)
     * @returns {number}
     */
    next_float() {
        const ret = wasm.javarandom_next_float(this.__wbg_ptr);
        return ret;
    }
    /**
     * Generate a random integer between 0 and bound-1
     * @param {number} bound
     * @returns {number}
     */
    next_int(bound) {
        const ret = wasm.javarandom_next_int(this.__wbg_ptr, bound);
        return ret >>> 0;
    }
    /**
     * Set the seed
     * @param {number} seed
     */
    set_seed(seed) {
        wasm.javarandom_set_seed(this.__wbg_ptr, seed);
    }
}
if (Symbol.dispose) JavaRandom.prototype[Symbol.dispose] = JavaRandom.prototype.free;

export class ModelStoreCore {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ModelStoreCoreFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_modelstorecore_free(ptr, 0);
    }
    /**
     * @param {string} name
     * @param {number} rx
     * @param {number} ry
     * @param {boolean} uvlock
     * @returns {string}
     */
    bake_model_json(name, rx, ry, uvlock) {
        let deferred5_0;
        let deferred5_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            const val2 = +rx;
            const val3 = +ry;
            const val4 = +uvlock;
            const ptr0 = passStringToWasm0(name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            wasm.modelstorecore_bake_model_json(retptr, this.__wbg_ptr, ptr0, len0, val2, val3, val4);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred5_0 = r0;
            deferred5_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred5_0, deferred5_1, 1);
        }
    }
    /**
     * @param {string} file
     * @param {string} props_json
     * @param {string} exact_key
     * @param {number} rand
     * @returns {string}
     */
    bake_variant_json(file, props_json, exact_key, rand) {
        let deferred5_0;
        let deferred5_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            const val4 = +rand;
            let ptr0, len0, ptr1, len1, ptr2, len2;
            try {
                ptr0 = passStringToWasm0(file, wasm.__wbindgen_export, wasm.__wbindgen_export2);
                len0 = WASM_VECTOR_LEN;
                ptr1 = passStringToWasm0(props_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
                len1 = WASM_VECTOR_LEN;
                ptr2 = passStringToWasm0(exact_key, wasm.__wbindgen_export, wasm.__wbindgen_export2);
                len2 = WASM_VECTOR_LEN;
            } catch (e) {
                if (ptr2) { wasm.__wbindgen_export3(ptr2, len2 * 1, 1); }
                if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
                if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
                throw e;
            }
            wasm.modelstorecore_bake_variant_json(retptr, this.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2, val4);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred5_0 = r0;
            deferred5_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred5_0, deferred5_1, 1);
        }
    }
    /**
     * @param {string} file
     * @param {string} props_json
     * @param {string} exact_key
     * @returns {string}
     */
    find_variant_json(file, props_json, exact_key) {
        let deferred4_0;
        let deferred4_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            let ptr0, len0, ptr1, len1, ptr2, len2;
            try {
                ptr0 = passStringToWasm0(file, wasm.__wbindgen_export, wasm.__wbindgen_export2);
                len0 = WASM_VECTOR_LEN;
                ptr1 = passStringToWasm0(props_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
                len1 = WASM_VECTOR_LEN;
                ptr2 = passStringToWasm0(exact_key, wasm.__wbindgen_export, wasm.__wbindgen_export2);
                len2 = WASM_VECTOR_LEN;
            } catch (e) {
                if (ptr2) { wasm.__wbindgen_export3(ptr2, len2 * 1, 1); }
                if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
                if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
                throw e;
            }
            wasm.modelstorecore_find_variant_json(retptr, this.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred4_0 = r0;
            deferred4_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred4_0, deferred4_1, 1);
        }
    }
    /**
     * @param {string} models_json
     * @param {string} blockstates_json
     * @param {string} atlas_json
     */
    constructor(models_json, blockstates_json, atlas_json) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            let ptr0, len0, ptr1, len1, ptr2, len2;
            try {
                ptr0 = passStringToWasm0(models_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
                len0 = WASM_VECTOR_LEN;
                ptr1 = passStringToWasm0(blockstates_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
                len1 = WASM_VECTOR_LEN;
                ptr2 = passStringToWasm0(atlas_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
                len2 = WASM_VECTOR_LEN;
            } catch (e) {
                if (ptr2) { wasm.__wbindgen_export3(ptr2, len2 * 1, 1); }
                if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
                if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
                throw e;
            }
            wasm.modelstorecore_new(retptr, ptr0, len0, ptr1, len1, ptr2, len2);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            this.__wbg_ptr = r0;
            ModelStoreCoreFinalization.register(this, this.__wbg_ptr, this);
            return this;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @returns {string}
     */
    stats() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.modelstorecore_stats(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
        }
    }
}
if (Symbol.dispose) ModelStoreCore.prototype[Symbol.dispose] = ModelStoreCore.prototype.free;

/**
 * JS: `_musicType()` result for wasm consumers.
 */
export class MusicTrackInfo {
    static __wrap(ptr) {
        const obj = Object.create(MusicTrackInfo.prototype);
        obj.__wbg_ptr = ptr;
        MusicTrackInfoFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        MusicTrackInfoFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_musictrackinfo_free(ptr, 0);
    }
    /**
     * @returns {string}
     */
    get event() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.__wbg_get_musictrackinfo_event(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {number}
     */
    get max_delay() {
        const ret = wasm.__wbg_get_musictrackinfo_max_delay(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get min_delay() {
        const ret = wasm.__wbg_get_musictrackinfo_min_delay(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {string} arg0
     */
    set event(arg0) {
        const ptr0 = passStringToWasm0(arg0, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_musictrackinfo_event(this.__wbg_ptr, ptr0, len0);
    }
    /**
     * @param {number} arg0
     */
    set max_delay(arg0) {
        wasm.__wbg_set_musictrackinfo_max_delay(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set min_delay(arg0) {
        wasm.__wbg_set_musictrackinfo_min_delay(this.__wbg_ptr, arg0);
    }
}
if (Symbol.dispose) MusicTrackInfo.prototype[Symbol.dispose] = MusicTrackInfo.prototype.free;

/**
 * Direction of packet flow
 * @enum {0 | 1}
 */
export const PacketDirection = Object.freeze({
    Clientbound: 0, "0": "Clientbound",
    Serverbound: 1, "1": "Serverbound",
});

export class PacketReader {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        PacketReaderFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_packetreader_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    angle() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.packetreader_angle(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getFloat64(retptr + 8 * 0, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
            if (r3) {
                throw takeFromExternrefTable0(r2);
            }
            return r0;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @param {number} count
     * @returns {Uint8Array}
     */
    bytes_n(count) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.packetreader_bytes_n(retptr, this.__wbg_ptr, count);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
            if (r3) {
                throw takeFromExternrefTable0(r2);
            }
            var v1 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export3(r0, r1 * 1, 1);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @returns {number}
     */
    f32() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.packetreader_f32(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getFloat32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            return r0;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @returns {number}
     */
    f64() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.packetreader_f64(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getFloat64(retptr + 8 * 0, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
            if (r3) {
                throw takeFromExternrefTable0(r2);
            }
            return r0;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @returns {number}
     */
    i16() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.packetreader_i16(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            return r0;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @returns {number}
     */
    i32() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.packetreader_i32(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            return r0;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @returns {bigint}
     */
    i64() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.packetreader_i64(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getBigInt64(retptr + 8 * 0, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
            if (r3) {
                throw takeFromExternrefTable0(r2);
            }
            return r0;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @returns {number}
     */
    i8() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.packetreader_i8(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            return r0;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @param {Uint8Array | number[]} bytes
     */
    constructor(bytes) {
        const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.packetreader_new(ptr0, len0);
        this.__wbg_ptr = ret;
        PacketReaderFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @returns {number}
     */
    offset() {
        const ret = wasm.packetreader_offset(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Packed block position -> [x, y, z].
     * @returns {Int32Array}
     */
    position() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.packetreader_position(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
            if (r3) {
                throw takeFromExternrefTable0(r2);
            }
            var v1 = getArrayI32FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export3(r0, r1 * 4, 4);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @returns {boolean}
     */
    read_bool() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.packetreader_read_bool(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            return r0 !== 0;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @returns {number}
     */
    remaining() {
        const ret = wasm.packetreader_remaining(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {Uint8Array}
     */
    rest() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.packetreader_rest(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
            if (r3) {
                throw takeFromExternrefTable0(r2);
            }
            var v1 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export3(r0, r1 * 1, 1);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @returns {string}
     */
    string() {
        let deferred2_0;
        let deferred2_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.packetreader_string(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
            var ptr1 = r0;
            var len1 = r1;
            if (r3) {
                ptr1 = 0; len1 = 0;
                throw takeFromExternrefTable0(r2);
            }
            deferred2_0 = ptr1;
            deferred2_1 = len1;
            return getStringFromWasm0(ptr1, len1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred2_0, deferred2_1, 1);
        }
    }
    /**
     * @returns {number}
     */
    u16() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.packetreader_u16(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            return r0;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @returns {number}
     */
    u8() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.packetreader_u8(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            return r0;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @returns {string}
     */
    uuid() {
        let deferred2_0;
        let deferred2_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.packetreader_uuid(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
            var ptr1 = r0;
            var len1 = r1;
            if (r3) {
                ptr1 = 0; len1 = 0;
                throw takeFromExternrefTable0(r2);
            }
            deferred2_0 = ptr1;
            deferred2_1 = len1;
            return getStringFromWasm0(ptr1, len1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred2_0, deferred2_1, 1);
        }
    }
    /**
     * Signed VarInt, matching `Reader.varint()`.
     * @returns {number}
     */
    varint() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.packetreader_varint(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            return r0;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * Signed VarLong, matching `Reader.varlong()`.
     * @returns {bigint}
     */
    varlong() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.packetreader_varlong(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getBigInt64(retptr + 8 * 0, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
            if (r3) {
                throw takeFromExternrefTable0(r2);
            }
            return r0;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
}
if (Symbol.dispose) PacketReader.prototype[Symbol.dispose] = PacketReader.prototype.free;

export class PacketWriter {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        PacketWriterFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_packetwriter_free(ptr, 0);
    }
    /**
     * @returns {Uint8Array}
     */
    build() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.packetwriter_build(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export3(r0, r1 * 1, 1);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @param {number} value
     */
    f32(value) {
        wasm.packetwriter_f32(this.__wbg_ptr, value);
    }
    /**
     * @param {number} value
     */
    f64(value) {
        wasm.packetwriter_f64(this.__wbg_ptr, value);
    }
    /**
     * @param {number} value
     */
    i16(value) {
        wasm.packetwriter_i16(this.__wbg_ptr, value);
    }
    /**
     * @param {number} value
     */
    i32(value) {
        wasm.packetwriter_i32(this.__wbg_ptr, value);
    }
    /**
     * @param {bigint} value
     */
    i64(value) {
        wasm.packetwriter_i64(this.__wbg_ptr, value);
    }
    /**
     * @param {number} value
     */
    i8(value) {
        wasm.packetwriter_i8(this.__wbg_ptr, value);
    }
    /**
     * @returns {boolean}
     */
    is_empty() {
        const ret = wasm.packetwriter_is_empty(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {number}
     */
    len() {
        const ret = wasm.packetwriter_len(this.__wbg_ptr);
        return ret >>> 0;
    }
    constructor() {
        const ret = wasm.packetwriter_new();
        this.__wbg_ptr = ret;
        PacketWriterFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {number} x
     * @param {number} y
     * @param {number} z
     */
    position(x, y, z) {
        wasm.packetwriter_position(this.__wbg_ptr, x, y, z);
    }
    /**
     * @param {Uint8Array | number[]} bytes
     */
    raw(bytes) {
        const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.packetwriter_raw(this.__wbg_ptr, ptr0, len0);
    }
    /**
     * @param {string} value
     */
    string(value) {
        const ptr0 = passStringToWasm0(value, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.packetwriter_string(this.__wbg_ptr, ptr0, len0);
    }
    /**
     * @param {number} value
     */
    u16(value) {
        wasm.packetwriter_u16(this.__wbg_ptr, value);
    }
    /**
     * @param {number} value
     */
    u8(value) {
        wasm.packetwriter_u8(this.__wbg_ptr, value);
    }
    /**
     * @param {string} value
     */
    uuid(value) {
        const ptr0 = passStringToWasm0(value, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.packetwriter_uuid(this.__wbg_ptr, ptr0, len0);
    }
    /**
     * @param {number} value
     */
    varint(value) {
        wasm.packetwriter_varint(this.__wbg_ptr, value);
    }
    /**
     * @param {bigint} value
     */
    varlong(value) {
        wasm.packetwriter_varlong(this.__wbg_ptr, value);
    }
    /**
     * @param {boolean} value
     */
    write_bool(value) {
        wasm.packetwriter_write_bool(this.__wbg_ptr, value);
    }
}
if (Symbol.dispose) PacketWriter.prototype[Symbol.dispose] = PacketWriter.prototype.free;

export class PistonCore {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        PistonCoreFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_pistoncore_free(ptr, 0);
    }
    constructor() {
        const ret = wasm.pistoncore_new();
        this.__wbg_ptr = ret;
        PistonCoreFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}
if (Symbol.dispose) PistonCore.prototype[Symbol.dispose] = PistonCore.prototype.free;

/**
 * Decoded image: 8-bit RGBA, row-major.
 */
export class PngImage {
    static __wrap(ptr) {
        const obj = Object.create(PngImage.prototype);
        obj.__wbg_ptr = ptr;
        PngImageFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        PngImageFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_pngimage_free(ptr, 0);
    }
    /**
     * RGBA bytes (`Uint8Array` in JavaScript; copied out of WASM memory).
     * @returns {Uint8Array}
     */
    get data() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.pngimage_data(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export3(r0, r1 * 1, 1);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @returns {number}
     */
    data_len() {
        const ret = wasm.pngimage_data_len(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get height() {
        const ret = wasm.pngimage_height(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get width() {
        const ret = wasm.pngimage_width(this.__wbg_ptr);
        return ret >>> 0;
    }
}
if (Symbol.dispose) PngImage.prototype[Symbol.dispose] = PngImage.prototype.free;

/**
 * Profiling data for a section
 */
export class ProfileSection {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ProfileSectionFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_profilesection_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get avg_time() {
        const ret = wasm.profilesection_avg_time(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get count() {
        const ret = wasm.profilesection_count(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {string}
     */
    name() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.profilesection_name(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @param {string} name
     */
    constructor(name) {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.profilesection_new(ptr0, len0);
        this.__wbg_ptr = ret;
        ProfileSectionFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @returns {number}
     */
    get start_time() {
        const ret = wasm.profilesection_start_time(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get total_time() {
        const ret = wasm.profilesection_total_time(this.__wbg_ptr);
        return ret;
    }
}
if (Symbol.dispose) ProfileSection.prototype[Symbol.dispose] = ProfileSection.prototype.free;

/**
 * Profiling manager
 */
export class ProfilingData {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ProfilingDataFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_profilingdata_free(ptr, 0);
    }
    /**
     * @returns {boolean}
     */
    get enabled() {
        const ret = wasm.profilingdata_enabled(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {number}
     */
    get frame_start() {
        const ret = wasm.profilingdata_frame_start(this.__wbg_ptr);
        return ret;
    }
    constructor() {
        const ret = wasm.profilingdata_new();
        this.__wbg_ptr = ret;
        ProfilingDataFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @returns {string}
     */
    sections_json() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.profilingdata_sections_json(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @param {boolean} val
     */
    set enabled(val) {
        wasm.profilingdata_set_enabled(this.__wbg_ptr, val);
    }
    /**
     * @param {number} val
     */
    set frame_start(val) {
        wasm.profilingdata_set_frame_start(this.__wbg_ptr, val);
    }
}
if (Symbol.dispose) ProfilingData.prototype[Symbol.dispose] = ProfilingData.prototype.free;

/**
 * Supported protocol versions
 * @enum {498 | 578}
 */
export const ProtocolVersion = Object.freeze({
    V498: 498, "498": "V498",
    V578: 578, "578": "V578",
});

export class RecipeBookCore {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        RecipeBookCoreFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_recipebookcore_free(ptr, 0);
    }
    /**
     * Check if a single recipe can be crafted.
     * @param {string} recipe_json
     * @param {string} counts_json
     * @returns {boolean}
     */
    can_craft(recipe_json, counts_json) {
        let ptr0, len0, ptr1, len1;
        try {
            ptr0 = passStringToWasm0(recipe_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passStringToWasm0(counts_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len1 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
            throw e;
        }
        const ret = wasm.recipebookcore_can_craft(this.__wbg_ptr, ptr0, len0, ptr1, len1);
        return ret !== 0;
    }
    /**
     * Clear fresh recipes.
     */
    clear_fresh() {
        wasm.recipebookcore_clear_fresh(this.__wbg_ptr);
    }
    /**
     * Get cooking state for a kind.
     * @param {string} kind
     * @returns {string}
     */
    cooking_state_json(kind) {
        let deferred2_0;
        let deferred2_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            const ptr0 = passStringToWasm0(kind, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            wasm.recipebookcore_cooking_state_json(retptr, this.__wbg_ptr, ptr0, len0);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred2_0 = r0;
            deferred2_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred2_0, deferred2_1, 1);
        }
    }
    /**
     * Evaluate a recipe list for craftability.
     * @param {string} list_json
     * @param {string} counts_json
     * @param {number} grid_width
     * @param {number} grid_height
     * @returns {string}
     */
    evaluate_list(list_json, counts_json, grid_width, grid_height) {
        let deferred5_0;
        let deferred5_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            const val3 = +grid_width;
            const val4 = +grid_height;
            let ptr0, len0, ptr1, len1;
            try {
                ptr0 = passStringToWasm0(list_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
                len0 = WASM_VECTOR_LEN;
                ptr1 = passStringToWasm0(counts_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
                len1 = WASM_VECTOR_LEN;
            } catch (e) {
                if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
                if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
                throw e;
            }
            wasm.recipebookcore_evaluate_list(retptr, this.__wbg_ptr, ptr0, len0, ptr1, len1, val3, val4);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred5_0 = r0;
            deferred5_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred5_0, deferred5_1, 1);
        }
    }
    /**
     * Get craftable filtering state.
     * @returns {boolean}
     */
    get filtering() {
        const ret = wasm.recipebookcore_filtering(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * Get fresh recipe IDs as JSON array.
     * @returns {string}
     */
    fresh_recipes_json() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.recipebookcore_fresh_recipes_json(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * Get known recipe IDs as JSON array.
     * @returns {string}
     */
    known_recipes_json() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.recipebookcore_known_recipes_json(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
        }
    }
    constructor() {
        const ret = wasm.recipebookcore_new();
        this.__wbg_ptr = ret;
        RecipeBookCoreFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Handle a recipe book packet from the server.
     * @param {string} server_recipes_json
     * @param {string} asset_recipes_json
     * @param {string} tags_json
     * @param {string} packet_json
     */
    on_packet(server_recipes_json, asset_recipes_json, tags_json, packet_json) {
        let ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3;
        try {
            ptr0 = passStringToWasm0(server_recipes_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passStringToWasm0(asset_recipes_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len1 = WASM_VECTOR_LEN;
            ptr2 = passStringToWasm0(tags_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len2 = WASM_VECTOR_LEN;
            ptr3 = passStringToWasm0(packet_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len3 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr3) { wasm.__wbindgen_export3(ptr3, len3 * 1, 1); }
            if (ptr2) { wasm.__wbindgen_export3(ptr2, len2 * 1, 1); }
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
            throw e;
        }
        wasm.recipebookcore_on_packet(this.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3);
    }
    /**
     * Get crafting book open state.
     * @returns {boolean}
     */
    get open() {
        const ret = wasm.recipebookcore_open(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * Parse recipes and build tab lists. Returns JSON of all recipes.
     * @param {string} server_recipes_json
     * @param {string} asset_recipes_json
     * @param {string} tags_json
     * @returns {string}
     */
    parse(server_recipes_json, asset_recipes_json, tags_json) {
        let deferred4_0;
        let deferred4_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            let ptr0, len0, ptr1, len1, ptr2, len2;
            try {
                ptr0 = passStringToWasm0(server_recipes_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
                len0 = WASM_VECTOR_LEN;
                ptr1 = passStringToWasm0(asset_recipes_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
                len1 = WASM_VECTOR_LEN;
                ptr2 = passStringToWasm0(tags_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
                len2 = WASM_VECTOR_LEN;
            } catch (e) {
                if (ptr2) { wasm.__wbindgen_export3(ptr2, len2 * 1, 1); }
                if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
                if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
                throw e;
            }
            wasm.recipebookcore_parse(retptr, this.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred4_0 = r0;
            deferred4_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred4_0, deferred4_1, 1);
        }
    }
    /**
     * Set craftable filtering state.
     * @param {boolean} filtering
     */
    set filtering(filtering) {
        wasm.recipebookcore_set_filtering(this.__wbg_ptr, filtering);
    }
    /**
     * Set crafting book open state.
     * @param {boolean} open
     */
    set open(open) {
        wasm.recipebookcore_set_open(this.__wbg_ptr, open);
    }
    /**
     * Compute stacked contents from inventory and grid.
     * @param {string} inventory_json
     * @param {string} grid_json
     * @returns {string}
     */
    stacked_contents(inventory_json, grid_json) {
        let deferred3_0;
        let deferred3_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            let ptr0, len0, ptr1, len1;
            try {
                ptr0 = passStringToWasm0(inventory_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
                len0 = WASM_VECTOR_LEN;
                ptr1 = passStringToWasm0(grid_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
                len1 = WASM_VECTOR_LEN;
            } catch (e) {
                if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
                if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
                throw e;
            }
            wasm.recipebookcore_stacked_contents(retptr, this.__wbg_ptr, ptr0, len0, ptr1, len1);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred3_0 = r0;
            deferred3_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred3_0, deferred3_1, 1);
        }
    }
    /**
     * Get recipe lists for a tab as JSON.
     * @param {string} server_recipes_json
     * @param {string} asset_recipes_json
     * @param {string} tags_json
     * @param {string} tab
     * @returns {string}
     */
    tab_lists_json(server_recipes_json, asset_recipes_json, tags_json, tab) {
        let deferred5_0;
        let deferred5_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            let ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3;
            try {
                ptr0 = passStringToWasm0(server_recipes_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
                len0 = WASM_VECTOR_LEN;
                ptr1 = passStringToWasm0(asset_recipes_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
                len1 = WASM_VECTOR_LEN;
                ptr2 = passStringToWasm0(tags_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
                len2 = WASM_VECTOR_LEN;
                ptr3 = passStringToWasm0(tab, wasm.__wbindgen_export, wasm.__wbindgen_export2);
                len3 = WASM_VECTOR_LEN;
            } catch (e) {
                if (ptr3) { wasm.__wbindgen_export3(ptr3, len3 * 1, 1); }
                if (ptr2) { wasm.__wbindgen_export3(ptr2, len2 * 1, 1); }
                if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
                if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
                throw e;
            }
            wasm.recipebookcore_tab_lists_json(retptr, this.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred5_0 = r0;
            deferred5_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred5_0, deferred5_1, 1);
        }
    }
}
if (Symbol.dispose) RecipeBookCore.prototype[Symbol.dispose] = RecipeBookCore.prototype.free;

/**
 * Recipe book state
 */
export class RecipeBookState {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        RecipeBookStateFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_recipebookstate_free(ptr, 0);
    }
    /**
     * @returns {string}
     */
    book_type() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.recipebookstate_book_type(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string[]}
     */
    highlighted() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.recipebookstate_highlighted(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayJsValueFromWasm0(r0, r1);
            wasm.__wbindgen_export3(r0, r1 * 4, 4);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @returns {boolean}
     */
    get is_filtering() {
        const ret = wasm.recipebookstate_is_filtering(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {boolean}
     */
    get is_open() {
        const ret = wasm.recipebookstate_is_open(this.__wbg_ptr);
        return ret !== 0;
    }
    constructor() {
        const ret = wasm.recipebookstate_new();
        this.__wbg_ptr = ret;
        RecipeBookStateFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @returns {string}
     */
    search_query() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.recipebookstate_search_query(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @param {string} val
     */
    set book_type(val) {
        const ptr0 = passStringToWasm0(val, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.recipebookstate_set_book_type(this.__wbg_ptr, ptr0, len0);
    }
    /**
     * @param {boolean} val
     */
    set is_filtering(val) {
        wasm.recipebookstate_set_is_filtering(this.__wbg_ptr, val);
    }
    /**
     * @param {boolean} val
     */
    set is_open(val) {
        wasm.recipebookstate_set_is_open(this.__wbg_ptr, val);
    }
    /**
     * @param {string} val
     */
    set search_query(val) {
        const ptr0 = passStringToWasm0(val, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.recipebookstate_set_search_query(this.__wbg_ptr, ptr0, len0);
    }
    /**
     * @returns {string[]}
     */
    unlocked() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.recipebookstate_unlocked(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayJsValueFromWasm0(r0, r1);
            wasm.__wbindgen_export3(r0, r1 * 4, 4);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
}
if (Symbol.dispose) RecipeBookState.prototype[Symbol.dispose] = RecipeBookState.prototype.free;

export class RegistryTagsCore {
    static __wrap(ptr) {
        const obj = Object.create(RegistryTagsCore.prototype);
        obj.__wbg_ptr = ptr;
        RegistryTagsCoreFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        RegistryTagsCoreFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_registrytagscore_free(ptr, 0);
    }
    /**
     * Check if an entry ID is in a tag for a registry kind.
     * @param {string} kind
     * @param {string} tag_name
     * @param {number} id
     * @returns {boolean}
     */
    contains(kind, tag_name, id) {
        const val3 = +id;
        let ptr0, len0, ptr1, len1;
        try {
            ptr0 = passStringToWasm0(kind, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passStringToWasm0(tag_name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len1 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
            throw e;
        }
        const ret = wasm.registrytagscore_contains(this.__wbg_ptr, ptr0, len0, ptr1, len1, val3);
        return ret !== 0;
    }
    /**
     * Get all tags containing the given entry ID for a registry kind.
     * @param {string} kind
     * @param {number} id
     * @returns {string[]}
     */
    for_entry(kind, id) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            const val2 = +id;
            const ptr0 = passStringToWasm0(kind, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            wasm.registrytagscore_for_entry(retptr, this.__wbg_ptr, ptr0, len0, val2);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v3 = getArrayJsValueFromWasm0(r0, r1);
            wasm.__wbindgen_export3(r0, r1 * 4, 4);
            return v3;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * Get all tag names for a registry kind ("blocks", "items", "fluids", "entities").
     * @param {string} kind
     * @returns {string[]}
     */
    names(kind) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            const ptr0 = passStringToWasm0(kind, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            wasm.registrytagscore_names(retptr, this.__wbg_ptr, ptr0, len0);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v2 = getArrayJsValueFromWasm0(r0, r1);
            wasm.__wbindgen_export3(r0, r1 * 4, 4);
            return v2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * Create an empty RegistryTagsCore (no tags loaded).
     * @returns {RegistryTagsCore}
     */
    static newEmpty() {
        const ret = wasm.registrytagscore_newEmpty();
        return RegistryTagsCore.__wrap(ret);
    }
    /**
     * @param {string} tags_json
     */
    constructor(tags_json) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            const ptr0 = passStringToWasm0(tags_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            wasm.registrytagscore_new(retptr, ptr0, len0);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            this.__wbg_ptr = r0;
            RegistryTagsCoreFinalization.register(this, this.__wbg_ptr, this);
            return this;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * Replace all tag data from a JSON string.
     * @param {string} tags_json
     */
    replace(tags_json) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            const ptr0 = passStringToWasm0(tags_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            wasm.registrytagscore_replace(retptr, this.__wbg_ptr, ptr0, len0);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            if (r1) {
                throw takeFromExternrefTable0(r0);
            }
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
}
if (Symbol.dispose) RegistryTagsCore.prototype[Symbol.dispose] = RegistryTagsCore.prototype.free;

export class ScoreboardCore {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ScoreboardCoreFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_scoreboardcore_free(ptr, 0);
    }
    /**
     * @param {string} uuid
     * @param {string | null} [fallback]
     * @returns {string | undefined}
     */
    display_name(uuid, fallback) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            let ptr0, len0, ptr1, len1;
            try {
                ptr0 = passStringToWasm0(uuid, wasm.__wbindgen_export, wasm.__wbindgen_export2);
                len0 = WASM_VECTOR_LEN;
                ptr1 = isLikeNone(fallback) ? 0 : passStringToWasm0(fallback, wasm.__wbindgen_export, wasm.__wbindgen_export2);
                len1 = WASM_VECTOR_LEN;
            } catch (e) {
                if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
                if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
                throw e;
            }
            wasm.scoreboardcore_display_name(retptr, this.__wbg_ptr, ptr0, len0, ptr1, len1);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            let v3;
            if (r0 !== 0) {
                v3 = getStringFromWasm0(r0, r1);
                wasm.__wbindgen_export3(r0, r1 * 1, 1);
            }
            return v3;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @param {string} name
     * @returns {string}
     */
    format_name(name) {
        let deferred2_0;
        let deferred2_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            const ptr0 = passStringToWasm0(name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            wasm.scoreboardcore_format_name(retptr, this.__wbg_ptr, ptr0, len0);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred2_0 = r0;
            deferred2_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred2_0, deferred2_1, 1);
        }
    }
    /**
     * @returns {string | undefined}
     */
    get_below_name() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.scoreboardcore_get_below_name(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            let v1;
            if (r0 !== 0) {
                v1 = getStringFromWasm0(r0, r1);
                wasm.__wbindgen_export3(r0, r1 * 1, 1);
            }
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @returns {string}
     */
    get_footer() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.scoreboardcore_get_footer(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string}
     */
    get_header() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.scoreboardcore_get_header(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string | undefined}
     */
    get_list() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.scoreboardcore_get_list(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            let v1;
            if (r0 !== 0) {
                v1 = getStringFromWasm0(r0, r1);
                wasm.__wbindgen_export3(r0, r1 * 1, 1);
            }
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @returns {string}
     */
    get_objectives_json() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.scoreboardcore_get_objectives_json(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string}
     */
    get_players_json() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.scoreboardcore_get_players_json(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string | undefined}
     */
    get_sidebar() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.scoreboardcore_get_sidebar(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            let v1;
            if (r0 !== 0) {
                v1 = getStringFromWasm0(r0, r1);
                wasm.__wbindgen_export3(r0, r1 * 1, 1);
            }
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @returns {string}
     */
    get_teams_json() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.scoreboardcore_get_teams_json(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @param {string} username
     */
    constructor(username) {
        const ptr0 = passStringToWasm0(username, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.scoreboardcore_new(ptr0, len0);
        this.__wbg_ptr = ret;
        ScoreboardCoreFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {number} position
     * @param {string | null} [objective]
     */
    on_display(position, objective) {
        const val2 = +position;
        var ptr0 = isLikeNone(objective) ? 0 : passStringToWasm0(objective, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        var len0 = WASM_VECTOR_LEN;
        wasm.scoreboardcore_on_display(this.__wbg_ptr, val2, ptr0, len0);
    }
    /**
     * @param {number} action
     * @param {string} objective
     * @param {string} display_text
     * @param {string} obj_type
     */
    on_objective(action, objective, display_text, obj_type) {
        const val4 = +action;
        let ptr0, len0, ptr1, len1, ptr2, len2;
        try {
            ptr0 = passStringToWasm0(objective, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passStringToWasm0(display_text, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len1 = WASM_VECTOR_LEN;
            ptr2 = passStringToWasm0(obj_type, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len2 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr2) { wasm.__wbindgen_export3(ptr2, len2 * 1, 1); }
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
            throw e;
        }
        wasm.scoreboardcore_on_objective(this.__wbg_ptr, val4, ptr0, len0, ptr1, len1, ptr2, len2);
    }
    /**
     * @param {number} action
     * @param {string} data_json
     */
    on_player_info(action, data_json) {
        const val2 = +action;
        const ptr0 = passStringToWasm0(data_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.scoreboardcore_on_player_info(this.__wbg_ptr, val2, ptr0, len0);
    }
    /**
     * @param {number} action
     * @param {string} score_name
     * @param {string} item_name
     * @param {number} value
     */
    on_score(action, score_name, item_name, value) {
        const val3 = +action;
        const val4 = +value;
        let ptr0, len0, ptr1, len1;
        try {
            ptr0 = passStringToWasm0(score_name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passStringToWasm0(item_name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len1 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
            throw e;
        }
        wasm.scoreboardcore_on_score(this.__wbg_ptr, val3, ptr0, len0, ptr1, len1, val4);
    }
    /**
     * @param {number} mode
     * @param {string} team
     * @param {string} data_json
     */
    on_team(mode, team, data_json) {
        const val3 = +mode;
        let ptr0, len0, ptr1, len1;
        try {
            ptr0 = passStringToWasm0(team, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passStringToWasm0(data_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len1 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
            throw e;
        }
        wasm.scoreboardcore_on_team(this.__wbg_ptr, val3, ptr0, len0, ptr1, len1);
    }
    reset() {
        wasm.scoreboardcore_reset(this.__wbg_ptr);
    }
    /**
     * @param {string} footer
     */
    set_footer(footer) {
        const ptr0 = passStringToWasm0(footer, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.scoreboardcore_set_footer(this.__wbg_ptr, ptr0, len0);
    }
    /**
     * @param {string} header
     */
    set_header(header) {
        const ptr0 = passStringToWasm0(header, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.scoreboardcore_set_header(this.__wbg_ptr, ptr0, len0);
    }
    /**
     * @param {string | null} [name]
     */
    set_sidebar(name) {
        var ptr0 = isLikeNone(name) ? 0 : passStringToWasm0(name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        var len0 = WASM_VECTOR_LEN;
        wasm.scoreboardcore_set_sidebar(this.__wbg_ptr, ptr0, len0);
    }
    /**
     * @param {string} username
     */
    set_username(username) {
        const ptr0 = passStringToWasm0(username, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.scoreboardcore_set_username(this.__wbg_ptr, ptr0, len0);
    }
    /**
     * @returns {string}
     */
    sorted_players_json() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.scoreboardcore_sorted_players_json(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @param {string} name
     * @param {string | null} [display_name]
     * @returns {string}
     */
    tab_name(name, display_name) {
        let deferred3_0;
        let deferred3_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            let ptr0, len0, ptr1, len1;
            try {
                ptr0 = passStringToWasm0(name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
                len0 = WASM_VECTOR_LEN;
                ptr1 = isLikeNone(display_name) ? 0 : passStringToWasm0(display_name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
                len1 = WASM_VECTOR_LEN;
            } catch (e) {
                if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
                if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
                throw e;
            }
            wasm.scoreboardcore_tab_name(retptr, this.__wbg_ptr, ptr0, len0, ptr1, len1);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred3_0 = r0;
            deferred3_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred3_0, deferred3_1, 1);
        }
    }
}
if (Symbol.dispose) ScoreboardCore.prototype[Symbol.dispose] = ScoreboardCore.prototype.free;

export class SectionCullerCore {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        SectionCullerCoreFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_sectioncullercore_free(ptr, 0);
    }
    /**
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @returns {boolean}
     */
    is_visible(x, y, z) {
        const ret = wasm.sectioncullercore_is_visible(this.__wbg_ptr, x, y, z);
        return ret !== 0;
    }
    constructor() {
        const ret = wasm.sectioncullercore_new();
        this.__wbg_ptr = ret;
        SectionCullerCoreFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @returns {number}
     */
    reached_count() {
        const ret = wasm.sectioncullercore_reached_count(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Returns the reached section indices in walk order.
     * @param {BigInt64Array | bigint[]} keys
     * @param {Uint8Array | number[]} flags
     * @param {Uint8Array | number[]} vis
     * @param {Float64Array | number[]} planes
     * @param {Float64Array | number[]} cam
     * @param {number} render_distance
     * @param {Uint8Array | number[]} columns
     * @param {boolean} camera_in_opaque
     * @param {number} max_dist
     * @param {boolean} enabled
     * @returns {Int32Array}
     */
    update(keys, flags, vis, planes, cam, render_distance, columns, camera_in_opaque, max_dist, enabled) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            const val7 = +render_distance;
            const val8 = +camera_in_opaque;
            const val9 = +max_dist;
            const val10 = +enabled;
            let ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4, ptr5, len5;
            try {
                ptr0 = passArray64ToWasm0(keys, wasm.__wbindgen_export);
                len0 = WASM_VECTOR_LEN;
                ptr1 = passArray8ToWasm0(flags, wasm.__wbindgen_export);
                len1 = WASM_VECTOR_LEN;
                ptr2 = passArray8ToWasm0(vis, wasm.__wbindgen_export);
                len2 = WASM_VECTOR_LEN;
                ptr3 = passArrayF64ToWasm0(planes, wasm.__wbindgen_export);
                len3 = WASM_VECTOR_LEN;
                ptr4 = passArrayF64ToWasm0(cam, wasm.__wbindgen_export);
                len4 = WASM_VECTOR_LEN;
                ptr5 = passArray8ToWasm0(columns, wasm.__wbindgen_export);
                len5 = WASM_VECTOR_LEN;
            } catch (e) {
                if (ptr5) { wasm.__wbindgen_export3(ptr5, len5 * 1, 1); }
                if (ptr4) { wasm.__wbindgen_export3(ptr4, len4 * 8, 8); }
                if (ptr3) { wasm.__wbindgen_export3(ptr3, len3 * 8, 8); }
                if (ptr2) { wasm.__wbindgen_export3(ptr2, len2 * 1, 1); }
                if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
                if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 8, 8); }
                throw e;
            }
            wasm.sectioncullercore_update(retptr, this.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4, val7, ptr5, len5, val8, val9, val10);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v11 = getArrayI32FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export3(r0, r1 * 4, 4);
            return v11;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
}
if (Symbol.dispose) SectionCullerCore.prototype[Symbol.dispose] = SectionCullerCore.prototype.free;

/**
 * Camera position for sleeping view.
 */
export class SleepCamera {
    static __wrap(ptr) {
        const obj = Object.create(SleepCamera.prototype);
        obj.__wbg_ptr = ptr;
        SleepCameraFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        SleepCameraFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_sleepcamera_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get pitch() {
        const ret = wasm.__wbg_get_sleepcamera_pitch(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get x() {
        const ret = wasm.__wbg_get_sleepcamera_x(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get y() {
        const ret = wasm.__wbg_get_sleepcamera_y(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get yaw() {
        const ret = wasm.__wbg_get_sleepcamera_yaw(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get z() {
        const ret = wasm.__wbg_get_sleepcamera_z(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set pitch(arg0) {
        wasm.__wbg_set_sleepcamera_pitch(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set x(arg0) {
        wasm.__wbg_set_sleepcamera_x(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set y(arg0) {
        wasm.__wbg_set_sleepcamera_y(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set yaw(arg0) {
        wasm.__wbg_set_sleepcamera_yaw(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set z(arg0) {
        wasm.__wbg_set_sleepcamera_z(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @param {number} yaw
     * @param {number} pitch
     */
    constructor(x, y, z, yaw, pitch) {
        const ret = wasm.sleepcamera_new(x, y, z, yaw, pitch);
        this.__wbg_ptr = ret;
        SleepCameraFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}
if (Symbol.dispose) SleepCamera.prototype[Symbol.dispose] = SleepCamera.prototype.free;

/**
 * WASM-exposed wrapper for SleepDelta.
 */
export class SleepDelta {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        SleepDeltaFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_sleepdelta_free(ptr, 0);
    }
    constructor() {
        const ret = wasm.sleepdelta_new();
        this.__wbg_ptr = ret;
        SleepDeltaFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Positions as a JSON array; each entry is null or [x, y, z].
     * @returns {string}
     */
    get positions_json() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.sleepdelta_positions_json(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @param {string} val
     */
    set positions_json(val) {
        const ptr0 = passStringToWasm0(val, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.sleepdelta_set_positions_json(this.__wbg_ptr, ptr0, len0);
    }
}
if (Symbol.dispose) SleepDelta.prototype[Symbol.dispose] = SleepDelta.prototype.free;

/**
 * WASM-exposed wrapper for SleepState.
 */
export class SleepState {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        SleepStateFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_sleepstate_free(ptr, 0);
    }
    /**
     * @returns {BlockPos | undefined}
     */
    get bed_pos() {
        const ret = wasm.sleepstate_bed_pos(this.__wbg_ptr);
        return ret === 0 ? undefined : BlockPos.__wrap(ret);
    }
    /**
     * @returns {boolean}
     */
    get crouching() {
        const ret = wasm.sleepstate_crouching(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {number}
     */
    get height() {
        const ret = wasm.sleepstate_height(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get motion_x() {
        const ret = wasm.sleepstate_motion_x(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get motion_y() {
        const ret = wasm.sleepstate_motion_y(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get motion_z() {
        const ret = wasm.sleepstate_motion_z(this.__wbg_ptr);
        return ret;
    }
    constructor() {
        const ret = wasm.sleepstate_new();
        this.__wbg_ptr = ret;
        SleepStateFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @returns {number}
     */
    get pitch() {
        const ret = wasm.sleepstate_pitch(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {string}
     */
    get pose() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.sleepstate_pose(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {number}
     */
    get prev_pitch() {
        const ret = wasm.sleepstate_prev_pitch(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get prev_x() {
        const ret = wasm.sleepstate_prev_x(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get prev_y() {
        const ret = wasm.sleepstate_prev_y(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get prev_z() {
        const ret = wasm.sleepstate_prev_z(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {BlockPos | null} [val]
     */
    set bed_pos(val) {
        let ptr0 = 0;
        if (!isLikeNone(val)) {
            _assertClass(val, BlockPos);
            ptr0 = val.__destroy_into_raw();
        }
        wasm.sleepstate_set_bed_pos(this.__wbg_ptr, ptr0);
    }
    /**
     * @param {boolean} val
     */
    set crouching(val) {
        wasm.sleepstate_set_crouching(this.__wbg_ptr, val);
    }
    /**
     * @param {number} val
     */
    set height(val) {
        wasm.sleepstate_set_height(this.__wbg_ptr, val);
    }
    /**
     * @param {number} val
     */
    set motion_x(val) {
        wasm.sleepstate_set_motion_x(this.__wbg_ptr, val);
    }
    /**
     * @param {number} val
     */
    set motion_y(val) {
        wasm.sleepstate_set_motion_y(this.__wbg_ptr, val);
    }
    /**
     * @param {number} val
     */
    set motion_z(val) {
        wasm.sleepstate_set_motion_z(this.__wbg_ptr, val);
    }
    /**
     * @param {number} val
     */
    set pitch(val) {
        wasm.sleepstate_set_pitch(this.__wbg_ptr, val);
    }
    /**
     * @param {string} val
     */
    set pose(val) {
        const ptr0 = passStringToWasm0(val, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.sleepstate_set_pose(this.__wbg_ptr, ptr0, len0);
    }
    /**
     * @param {number} val
     */
    set prev_pitch(val) {
        wasm.sleepstate_set_prev_pitch(this.__wbg_ptr, val);
    }
    /**
     * @param {number} val
     */
    set prev_x(val) {
        wasm.sleepstate_set_prev_x(this.__wbg_ptr, val);
    }
    /**
     * @param {number} val
     */
    set prev_y(val) {
        wasm.sleepstate_set_prev_y(this.__wbg_ptr, val);
    }
    /**
     * @param {number} val
     */
    set prev_z(val) {
        wasm.sleepstate_set_prev_z(this.__wbg_ptr, val);
    }
    /**
     * @param {boolean} val
     */
    set sleeping(val) {
        wasm.sleepstate_set_sleeping(this.__wbg_ptr, val);
    }
    /**
     * @param {number} val
     */
    set width(val) {
        wasm.sleepstate_set_width(this.__wbg_ptr, val);
    }
    /**
     * @param {number} val
     */
    set x(val) {
        wasm.sleepstate_set_x(this.__wbg_ptr, val);
    }
    /**
     * @param {number} val
     */
    set y(val) {
        wasm.sleepstate_set_y(this.__wbg_ptr, val);
    }
    /**
     * @param {number} val
     */
    set z(val) {
        wasm.sleepstate_set_z(this.__wbg_ptr, val);
    }
    /**
     * @returns {boolean}
     */
    get sleeping() {
        const ret = wasm.sleepstate_sleeping(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {number}
     */
    get width() {
        const ret = wasm.sleepstate_width(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get x() {
        const ret = wasm.sleepstate_x(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get y() {
        const ret = wasm.sleepstate_y(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get z() {
        const ret = wasm.sleepstate_z(this.__wbg_ptr);
        return ret;
    }
}
if (Symbol.dispose) SleepState.prototype[Symbol.dispose] = SleepState.prototype.free;

/**
 * The Rust equivalent of `world/slice.js`'s `{ states, light, biomes, ... }`.
 */
export class SliceData {
    static __wrap(ptr) {
        const obj = Object.create(SliceData.prototype);
        obj.__wbg_ptr = ptr;
        SliceDataFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        SliceDataFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_slicedata_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get biome_layers() {
        const ret = wasm.slicedata_biome_layers(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get biome_ox() {
        const ret = wasm.slicedata_biome_ox(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get biome_oz() {
        const ret = wasm.slicedata_biome_oz(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get biome_size() {
        const ret = wasm.slicedata_biome_size(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {Uint8Array}
     */
    get biomes() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.slicedata_biomes(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export3(r0, r1 * 1, 1);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @returns {boolean}
     */
    get has_sky() {
        const ret = wasm.slicedata_has_sky(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {Uint8Array}
     */
    get light() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.slicedata_light(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export3(r0, r1 * 1, 1);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @returns {number}
     */
    get ox() {
        const ret = wasm.slicedata_ox(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get oy() {
        const ret = wasm.slicedata_oy(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get oz() {
        const ret = wasm.slicedata_oz(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {Uint16Array}
     */
    get states() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.slicedata_states(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayU16FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export3(r0, r1 * 2, 2);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @returns {number}
     */
    get x() {
        const ret = wasm.slicedata_x(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get y() {
        const ret = wasm.slicedata_y(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get z() {
        const ret = wasm.slicedata_z(this.__wbg_ptr);
        return ret;
    }
}
if (Symbol.dispose) SliceData.prototype[Symbol.dispose] = SliceData.prototype.free;

/**
 * The software device. Browser-bound presentation stays in JS; this owns the
 * buffers, textures, meshes, globals and the whole draw path.
 */
export class SoftwareDevice {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        SoftwareDeviceFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_softwaredevice_free(ptr, 0);
    }
    /**
     * `beginFrame(clear)`.
     * @param {number} r
     * @param {number} g
     * @param {number} b
     */
    begin_frame(r, g, b) {
        wasm.softwaredevice_begin_frame(this.__wbg_ptr, r, g, b);
    }
    /**
     * `busy()`: the software rasteriser is never behind.
     * @returns {boolean}
     */
    busy() {
        const ret = wasm.softwaredevice_busy(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * `capture()`: pixels of the last completed frame (the promise stays in JS).
     * @returns {Uint8Array}
     */
    capture() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.softwaredevice_capture(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export3(r0, r1 * 1, 1);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * `setRenderTarget(t, clear)` colour+depth clear of the bound target.
     * @param {number} r
     * @param {number} g
     * @param {number} b
     * @param {number} a
     */
    clear_current(r, g, b, a) {
        wasm.softwaredevice_clear_current(this.__wbg_ptr, r, g, b, a);
    }
    clear_depth() {
        wasm.softwaredevice_clear_depth(this.__wbg_ptr);
    }
    clear_scissor() {
        wasm.softwaredevice_clear_scissor(this.__wbg_ptr);
    }
    /**
     * `createMesh(format, vertices, opts)` with raw bytes -> handle.
     * @param {string} format
     * @param {Uint8Array | number[]} data
     * @param {boolean} quads
     * @param {Uint32Array | number[]} indices
     * @returns {number}
     */
    create_mesh(format, data, quads, indices) {
        const val4 = +quads;
        let ptr0, len0, ptr1, len1, ptr2, len2;
        try {
            ptr0 = passStringToWasm0(format, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passArray8ToWasm0(data, wasm.__wbindgen_export);
            len1 = WASM_VECTOR_LEN;
            ptr2 = passArray32ToWasm0(indices, wasm.__wbindgen_export);
            len2 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr2) { wasm.__wbindgen_export3(ptr2, len2 * 4, 4); }
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
            throw e;
        }
        const ret = wasm.softwaredevice_create_mesh(this.__wbg_ptr, ptr0, len0, ptr1, len1, val4, ptr2, len2);
        return ret >>> 0;
    }
    /**
     * `createMesh` with `Float32Array` data.
     * @param {string} format
     * @param {Float32Array | number[]} data
     * @param {boolean} quads
     * @param {Uint32Array | number[]} indices
     * @returns {number}
     */
    create_mesh_f32(format, data, quads, indices) {
        const val4 = +quads;
        let ptr0, len0, ptr1, len1, ptr2, len2;
        try {
            ptr0 = passStringToWasm0(format, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passArrayF32ToWasm0(data, wasm.__wbindgen_export);
            len1 = WASM_VECTOR_LEN;
            ptr2 = passArray32ToWasm0(indices, wasm.__wbindgen_export);
            len2 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr2) { wasm.__wbindgen_export3(ptr2, len2 * 4, 4); }
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 4, 4); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
            throw e;
        }
        const ret = wasm.softwaredevice_create_mesh_f32(this.__wbg_ptr, ptr0, len0, ptr1, len1, val4, ptr2, len2);
        return ret >>> 0;
    }
    /**
     * `createRenderTarget(w, h)` -> handle.
     * @param {number} w
     * @param {number} h
     * @returns {number}
     */
    create_render_target(w, h) {
        const ret = wasm.softwaredevice_create_render_target(this.__wbg_ptr, w, h);
        return ret >>> 0;
    }
    /**
     * `createTexture({...})` -> handle.
     * @param {number} width
     * @param {number} height
     * @param {string} filter
     * @param {string} wrap
     * @param {boolean} mipmaps
     * @param {number} mipmap_levels
     * @returns {number}
     */
    create_texture(width, height, filter, wrap, mipmaps, mipmap_levels) {
        const val3 = +width;
        const val4 = +height;
        const val5 = +mipmaps;
        const val6 = +mipmap_levels;
        let ptr0, len0, ptr1, len1;
        try {
            ptr0 = passStringToWasm0(filter, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passStringToWasm0(wrap, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len1 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
            throw e;
        }
        const ret = wasm.softwaredevice_create_texture(this.__wbg_ptr, val3, val4, ptr0, len0, ptr1, len1, val5, val6);
        return ret >>> 0;
    }
    /**
     * @param {number} handle
     */
    destroy_mesh(handle) {
        wasm.softwaredevice_destroy_mesh(this.__wbg_ptr, handle);
    }
    /**
     * @param {number} handle
     */
    destroy_texture(handle) {
        wasm.softwaredevice_destroy_texture(this.__wbg_ptr, handle);
    }
    /**
     * `draw(d)` from a JSON descriptor.
     * @param {string} json
     * @returns {boolean}
     */
    draw_json(json) {
        const ptr0 = passStringToWasm0(json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.softwaredevice_draw_json(this.__wbg_ptr, ptr0, len0);
        return ret !== 0;
    }
    /**
     * `endFrame()`: the screen as RGBA bytes (top-left origin, for ImageData).
     * @returns {Uint8Array}
     */
    end_frame() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.softwaredevice_end_frame(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export3(r0, r1 * 1, 1);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * `endFrame()` pixels as packed texels.
     * @returns {Uint32Array}
     */
    end_frame_u32() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.softwaredevice_end_frame_u32(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayU32FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export3(r0, r1 * 4, 4);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @returns {number}
     */
    get height() {
        const ret = wasm.softwaredevice_height(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {number} handle
     * @returns {number}
     */
    mesh_index_count(handle) {
        const ret = wasm.softwaredevice_mesh_index_count(this.__wbg_ptr, handle);
        return ret >>> 0;
    }
    /**
     * @param {number} handle
     * @returns {number}
     */
    mesh_vertex_count(handle) {
        const ret = wasm.softwaredevice_mesh_vertex_count(this.__wbg_ptr, handle);
        return ret >>> 0;
    }
    /**
     * @param {number} width
     * @param {number} height
     */
    constructor(width, height) {
        const ret = wasm.softwaredevice_new(width, height);
        this.__wbg_ptr = ret;
        SoftwareDeviceFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * `resize(w, h)`.
     * @param {number} w
     * @param {number} h
     */
    resize(w, h) {
        wasm.softwaredevice_resize(this.__wbg_ptr, w, h);
    }
    /**
     * `setGlobals(g)` from a JSON object.
     * @param {string} json
     * @returns {boolean}
     */
    set_globals_json(json) {
        const ptr0 = passStringToWasm0(json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.softwaredevice_set_globals_json(this.__wbg_ptr, ptr0, len0);
        return ret !== 0;
    }
    /**
     * `setRenderTarget(target)`: bind a render target, or the screen (-1).
     * @param {number} handle
     */
    set_render_target(handle) {
        wasm.softwaredevice_set_render_target(this.__wbg_ptr, handle);
    }
    /**
     * `setScissor(rect)`, rect = [x, y, w, h] in pixels, origin top-left.
     * @param {number} x
     * @param {number} y
     * @param {number} w
     * @param {number} h
     */
    set_scissor(x, y, w, h) {
        wasm.softwaredevice_set_scissor(this.__wbg_ptr, x, y, w, h);
    }
    /**
     * Packed texels of a texture (level 0), for JS-side inspection.
     * @param {number} handle
     * @returns {Uint32Array}
     */
    texel_data(handle) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.softwaredevice_texel_data(retptr, this.__wbg_ptr, handle);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayU32FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export3(r0, r1 * 4, 4);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * `updateMesh(m, vertices, opts)`. `quads`: -1 = undefined, 0 = false, 1 = true.
     * @param {number} handle
     * @param {Uint8Array | number[]} data
     * @param {number} quads
     * @param {Uint32Array | number[]} indices
     */
    update_mesh(handle, data, quads, indices) {
        const val3 = +handle;
        const val4 = +quads;
        let ptr0, len0, ptr1, len1;
        try {
            ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_export);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passArray32ToWasm0(indices, wasm.__wbindgen_export);
            len1 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 4, 4); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
            throw e;
        }
        wasm.softwaredevice_update_mesh(this.__wbg_ptr, val3, ptr0, len0, val4, ptr1, len1);
    }
    /**
     * `updateMesh` with `Float32Array` data.
     * @param {number} handle
     * @param {Float32Array | number[]} data
     * @param {number} quads
     * @param {Uint32Array | number[]} indices
     */
    update_mesh_f32(handle, data, quads, indices) {
        const val3 = +handle;
        const val4 = +quads;
        let ptr0, len0, ptr1, len1;
        try {
            ptr0 = passArrayF32ToWasm0(data, wasm.__wbindgen_export);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passArray32ToWasm0(indices, wasm.__wbindgen_export);
            len1 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 4, 4); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 4, 4); }
            throw e;
        }
        wasm.softwaredevice_update_mesh_f32(this.__wbg_ptr, val3, ptr0, len0, val4, ptr1, len1);
    }
    /**
     * `updateTexture(t, data, x, y, w, h)` with RGBA bytes.
     * @param {number} handle
     * @param {Uint8Array | number[]} data
     * @param {number} x
     * @param {number} y
     * @param {number} w
     * @param {number} h
     */
    upload_texture(handle, data, x, y, w, h) {
        const val2 = +handle;
        const val3 = +x;
        const val4 = +y;
        const val5 = +w;
        const val6 = +h;
        const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.softwaredevice_upload_texture(this.__wbg_ptr, val2, ptr0, len0, val3, val4, val5, val6);
    }
    /**
     * @returns {number}
     */
    get width() {
        const ret = wasm.softwaredevice_width(this.__wbg_ptr);
        return ret >>> 0;
    }
}
if (Symbol.dispose) SoftwareDevice.prototype[Symbol.dispose] = SoftwareDevice.prototype.free;

/**
 * Animation parameters for the title screen splash text.
 *
 * Ported from `client/js/gui/screens/menus.js` lines 118-127.
 */
export class SplashAnimation {
    static __wrap(ptr) {
        const obj = Object.create(SplashAnimation.prototype);
        obj.__wbg_ptr = ptr;
        SplashAnimationFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        SplashAnimationFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_splashanimation_free(ptr, 0);
    }
    /**
     * Alpha (always 1.0 for splash text)
     * @returns {number}
     */
    get alpha() {
        const ret = wasm.__wbg_get_splashanimation_alpha(this.__wbg_ptr);
        return ret;
    }
    /**
     * Rotation in radians (-20 degrees)
     * @returns {number}
     */
    get rotation() {
        const ret = wasm.__wbg_get_splashanimation_rotation(this.__wbg_ptr);
        return ret;
    }
    /**
     * Scale factor (animated pulsing)
     * @returns {number}
     */
    get scale() {
        const ret = wasm.__wbg_get_splashanimation_scale(this.__wbg_ptr);
        return ret;
    }
    /**
     * X translation (center of screen + 90)
     * @returns {number}
     */
    get x() {
        const ret = wasm.__wbg_get_splashanimation_x(this.__wbg_ptr);
        return ret;
    }
    /**
     * Y translation (70px from top)
     * @returns {number}
     */
    get y() {
        const ret = wasm.__wbg_get_splashanimation_y(this.__wbg_ptr);
        return ret;
    }
    /**
     * Alpha (always 1.0 for splash text)
     * @param {number} arg0
     */
    set alpha(arg0) {
        wasm.__wbg_set_splashanimation_alpha(this.__wbg_ptr, arg0);
    }
    /**
     * Rotation in radians (-20 degrees)
     * @param {number} arg0
     */
    set rotation(arg0) {
        wasm.__wbg_set_splashanimation_rotation(this.__wbg_ptr, arg0);
    }
    /**
     * Scale factor (animated pulsing)
     * @param {number} arg0
     */
    set scale(arg0) {
        wasm.__wbg_set_splashanimation_scale(this.__wbg_ptr, arg0);
    }
    /**
     * X translation (center of screen + 90)
     * @param {number} arg0
     */
    set x(arg0) {
        wasm.__wbg_set_splashanimation_x(this.__wbg_ptr, arg0);
    }
    /**
     * Y translation (70px from top)
     * @param {number} arg0
     */
    set y(arg0) {
        wasm.__wbg_set_splashanimation_y(this.__wbg_ptr, arg0);
    }
}
if (Symbol.dispose) SplashAnimation.prototype[Symbol.dispose] = SplashAnimation.prototype.free;

/**
 * Startup splash configuration (ported from splash.js)
 */
export class SplashConfig {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        SplashConfigFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_splashconfig_free(ptr, 0);
    }
    /**
     * Base scale factor (2x for high-DPI)
     * @returns {number}
     */
    get base_scale() {
        const ret = wasm.__wbg_get_splashconfig_base_scale(this.__wbg_ptr);
        return ret;
    }
    /**
     * Logo texture size (256x256 for mojang.png)
     * @returns {number}
     */
    get logo_size() {
        const ret = wasm.__wbg_get_splashconfig_logo_size(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Base scale factor (2x for high-DPI)
     * @param {number} arg0
     */
    set base_scale(arg0) {
        wasm.__wbg_set_splashconfig_base_scale(this.__wbg_ptr, arg0);
    }
    /**
     * Logo texture size (256x256 for mojang.png)
     * @param {number} arg0
     */
    set logo_size(arg0) {
        wasm.__wbg_set_splashconfig_logo_size(this.__wbg_ptr, arg0);
    }
}
if (Symbol.dispose) SplashConfig.prototype[Symbol.dispose] = SplashConfig.prototype.free;

/**
 * Result of startup splash scale calculation
 */
export class SplashScale {
    static __wrap(ptr) {
        const obj = Object.create(SplashScale.prototype);
        obj.__wbg_ptr = ptr;
        SplashScaleFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        SplashScaleFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_splashscale_free(ptr, 0);
    }
    /**
     * X offset to center logo
     * @returns {number}
     */
    get logo_x() {
        const ret = wasm.__wbg_get_splashscale_logo_x(this.__wbg_ptr);
        return ret;
    }
    /**
     * Y offset to center logo
     * @returns {number}
     */
    get logo_y() {
        const ret = wasm.__wbg_get_splashscale_logo_y(this.__wbg_ptr);
        return ret;
    }
    /**
     * Computed integer scale factor
     * @returns {number}
     */
    get scale() {
        const ret = wasm.__wbg_get_splashscale_scale(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Scaled viewport height (css pixels / scale)
     * @returns {number}
     */
    get scaled_height() {
        const ret = wasm.__wbg_get_splashscale_scaled_height(this.__wbg_ptr);
        return ret;
    }
    /**
     * Scaled viewport width (css pixels / scale)
     * @returns {number}
     */
    get scaled_width() {
        const ret = wasm.__wbg_get_splashscale_scaled_width(this.__wbg_ptr);
        return ret;
    }
    /**
     * X offset to center logo
     * @param {number} arg0
     */
    set logo_x(arg0) {
        wasm.__wbg_set_splashscale_logo_x(this.__wbg_ptr, arg0);
    }
    /**
     * Y offset to center logo
     * @param {number} arg0
     */
    set logo_y(arg0) {
        wasm.__wbg_set_splashscale_logo_y(this.__wbg_ptr, arg0);
    }
    /**
     * Computed integer scale factor
     * @param {number} arg0
     */
    set scale(arg0) {
        wasm.__wbg_set_splashscale_scale(this.__wbg_ptr, arg0);
    }
    /**
     * Scaled viewport height (css pixels / scale)
     * @param {number} arg0
     */
    set scaled_height(arg0) {
        wasm.__wbg_set_splashscale_scaled_height(this.__wbg_ptr, arg0);
    }
    /**
     * Scaled viewport width (css pixels / scale)
     * @param {number} arg0
     */
    set scaled_width(arg0) {
        wasm.__wbg_set_splashscale_scaled_width(this.__wbg_ptr, arg0);
    }
}
if (Symbol.dispose) SplashScale.prototype[Symbol.dispose] = SplashScale.prototype.free;

export class TileRendererCore {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        TileRendererCoreFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_tilerenderercore_free(ptr, 0);
    }
    /**
     * Banner swing angle.
     * @param {number} time
     * @returns {number}
     */
    banner_swing(time) {
        const ret = wasm.tilerenderercore_banner_swing(this.__wbg_ptr, time);
        return ret;
    }
    /**
     * Calculate beacon beam brightness.
     * @param {number} world_age
     * @param {number} beam_counter
     * @param {number} beam_fade
     * @returns {number}
     */
    beacon_beam_brightness(world_age, beam_counter, beam_fade) {
        const ret = wasm.tilerenderercore_beacon_beam_brightness(this.__wbg_ptr, world_age, beam_counter, beam_fade);
        return ret;
    }
    /**
     * Get bed piece vertices.
     * @param {boolean} head
     * @param {number} facing
     * @returns {Float32Array}
     */
    bed_piece_vertices(head, facing) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.tilerenderercore_bed_piece_vertices(retptr, this.__wbg_ptr, head, facing);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayF32FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export3(r0, r1 * 4, 4);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * Calculate block tint color.
     * @param {string} block_name
     * @param {number} biome_id
     * @param {string} biome_name
     * @param {number} temperature
     * @param {number} rainfall
     * @param {number} y
     * @param {Uint8Array | number[]} grass_map
     * @param {Uint8Array | number[]} foliage_map
     * @returns {Float32Array | undefined}
     */
    block_tint_color(block_name, biome_id, biome_name, temperature, rainfall, y, grass_map, foliage_map) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            const val5 = +biome_id;
            const val6 = +temperature;
            const val7 = +rainfall;
            const val8 = +y;
            let ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3;
            try {
                ptr0 = passStringToWasm0(block_name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
                len0 = WASM_VECTOR_LEN;
                ptr1 = passStringToWasm0(biome_name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
                len1 = WASM_VECTOR_LEN;
                ptr2 = passArray8ToWasm0(grass_map, wasm.__wbindgen_export);
                len2 = WASM_VECTOR_LEN;
                ptr3 = passArray8ToWasm0(foliage_map, wasm.__wbindgen_export);
                len3 = WASM_VECTOR_LEN;
            } catch (e) {
                if (ptr3) { wasm.__wbindgen_export3(ptr3, len3 * 1, 1); }
                if (ptr2) { wasm.__wbindgen_export3(ptr2, len2 * 1, 1); }
                if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
                if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
                throw e;
            }
            wasm.tilerenderercore_block_tint_color(retptr, this.__wbg_ptr, ptr0, len0, val5, ptr1, len1, val6, val7, val8, ptr2, len2, ptr3, len3);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            let v9;
            if (r0 !== 0) {
                v9 = getArrayF32FromWasm0(r0, r1).slice();
                wasm.__wbindgen_export3(r0, r1 * 4, 4);
            }
            return v9;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * Get breaking overlay UV for a stage.
     * @param {number} stage
     * @returns {Float32Array}
     */
    breaking_uv(stage) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.tilerenderercore_breaking_uv(retptr, this.__wbg_ptr, stage);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayF32FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export3(r0, r1 * 4, 4);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * Build beacon beam geometry.
     * @param {string} segments_json
     * @param {number} world_age
     * @param {number} partial
     * @param {number} beam_fade
     * @returns {any}
     */
    build_beam_geometry(segments_json, world_age, partial, beam_fade) {
        const val2 = +world_age;
        const val3 = +partial;
        const val4 = +beam_fade;
        const ptr0 = passStringToWasm0(segments_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.tilerenderercore_build_beam_geometry(this.__wbg_ptr, ptr0, len0, val2, val3, val4);
        return ret;
    }
    /**
     * Check if a face should be culled.
     * @param {number} face
     * @param {number} neighbor_state
     * @returns {boolean}
     */
    cull_face(face, neighbor_state) {
        const ret = wasm.tilerenderercore_cull_face(this.__wbg_ptr, face, neighbor_state);
        return ret !== 0;
    }
    /**
     * Get dye RGB colors.
     * @returns {Float32Array}
     */
    dye_rgb() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.tilerenderercore_dye_rgb(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayF32FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export3(r0, r1 * 4, 4);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * Get end portal colors.
     * @returns {Float32Array}
     */
    end_portal_colors() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.tilerenderercore_end_portal_colors(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayF32FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export3(r0, r1 * 4, 4);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * Get flower pot contents.
     * @param {number} item_id
     * @param {number} data
     * @returns {string | undefined}
     */
    flower_pot_contents(item_id, data) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.tilerenderercore_flower_pot_contents(retptr, this.__wbg_ptr, item_id, data);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            let v1;
            if (r0 !== 0) {
                v1 = getStringFromWasm0(r0, r1);
                wasm.__wbindgen_export3(r0, r1 * 1, 1);
            }
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * Get fluid UV coordinates.
     * @param {number} fluid_type
     * @param {number} flow
     * @returns {Float32Array}
     */
    fluid_uv(fluid_type, flow) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.tilerenderercore_fluid_uv(retptr, this.__wbg_ptr, fluid_type, flow);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayF32FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export3(r0, r1 * 4, 4);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * Get block model JSON for a tile entity type.
     * @param {string} tile_type
     * @param {string} props_json
     * @returns {string}
     */
    get_block_model(tile_type, props_json) {
        let deferred3_0;
        let deferred3_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            let ptr0, len0, ptr1, len1;
            try {
                ptr0 = passStringToWasm0(tile_type, wasm.__wbindgen_export, wasm.__wbindgen_export2);
                len0 = WASM_VECTOR_LEN;
                ptr1 = passStringToWasm0(props_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
                len1 = WASM_VECTOR_LEN;
            } catch (e) {
                if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
                if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
                throw e;
            }
            wasm.tilerenderercore_get_block_model(retptr, this.__wbg_ptr, ptr0, len0, ptr1, len1);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred3_0 = r0;
            deferred3_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred3_0, deferred3_1, 1);
        }
    }
    /**
     * Get face UV coordinates.
     * @param {number} face
     * @param {Float64Array | number[]} from
     * @param {Float64Array | number[]} to
     * @param {Float64Array | number[] | null} [element_uv]
     * @returns {Float64Array}
     */
    get_face_uv(face, from, to, element_uv) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            const val4 = +face;
            let ptr0, len0, ptr1, len1, ptr2, len2;
            try {
                ptr0 = passArrayF64ToWasm0(from, wasm.__wbindgen_export);
                len0 = WASM_VECTOR_LEN;
                ptr1 = passArrayF64ToWasm0(to, wasm.__wbindgen_export);
                len1 = WASM_VECTOR_LEN;
                ptr2 = isLikeNone(element_uv) ? 0 : passArrayF64ToWasm0(element_uv, wasm.__wbindgen_export);
                len2 = WASM_VECTOR_LEN;
            } catch (e) {
                if (ptr2) { wasm.__wbindgen_export3(ptr2, len2 * 8, 8); }
                if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 8, 8); }
                if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 8, 8); }
                throw e;
            }
            wasm.tilerenderercore_get_face_uv(retptr, this.__wbg_ptr, val4, ptr0, len0, ptr1, len1, ptr2, len2);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v5 = getArrayF64FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export3(r0, r1 * 8, 8);
            return v5;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @param {string} blocks_json
     * @param {string} shapes_json
     */
    constructor(blocks_json, shapes_json) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            let ptr0, len0, ptr1, len1;
            try {
                ptr0 = passStringToWasm0(blocks_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
                len0 = WASM_VECTOR_LEN;
                ptr1 = passStringToWasm0(shapes_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
                len1 = WASM_VECTOR_LEN;
            } catch (e) {
                if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
                if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
                throw e;
            }
            wasm.tilerenderercore_new(retptr, ptr0, len0, ptr1, len1);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            this.__wbg_ptr = r0;
            TileRendererCoreFinalization.register(this, this.__wbg_ptr, this);
            return this;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * Get the block registry for external use.
     * @returns {BlockRegistryCore}
     */
    registry() {
        const ret = wasm.tilerenderercore_registry(this.__wbg_ptr);
        return BlockRegistryCore.__wrap(ret);
    }
    /**
     * Calculate shulker box bounds.
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @param {number} facing
     * @param {number} progress
     * @returns {Float64Array}
     */
    shulker_bounds(x, y, z, facing, progress) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.tilerenderercore_shulker_bounds(retptr, this.__wbg_ptr, x, y, z, facing, progress);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayF64FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export3(r0, r1 * 8, 8);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * Get shulker box vertices (base, lid).
     * @param {number} facing_index
     * @returns {any}
     */
    shulker_box_vertices(facing_index) {
        const ret = wasm.tilerenderercore_shulker_box_vertices(this.__wbg_ptr, facing_index);
        return ret;
    }
    /**
     * Get skull model vertices.
     * @param {number} skull_type
     * @returns {Float32Array}
     */
    skull_model_vertices(skull_type) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.tilerenderercore_skull_model_vertices(retptr, this.__wbg_ptr, skull_type);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayF32FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export3(r0, r1 * 4, 4);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * Get skull type from block name.
     * @param {string} name
     * @returns {number | undefined}
     */
    skull_type(name) {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.tilerenderercore_skull_type(this.__wbg_ptr, ptr0, len0);
        return ret === 0xFFFFFF ? undefined : ret;
    }
}
if (Symbol.dispose) TileRendererCore.prototype[Symbol.dispose] = TileRendererCore.prototype.free;

/**
 * Update sleep result from delta.
 * @enum {0 | 1 | 2}
 */
export const UpdateSleepResult = Object.freeze({
    None: 0, "0": "None",
    Start: 1, "1": "Start",
    Stop: 2, "2": "Stop",
});

/**
 * Reusable visibility tracer: the per-state flag table is built once when the
 * block registry is initialised, so meshing only copies the 8 KiB section.
 */
export class VisGraph {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        VisGraphFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_visgraph_free(ptr, 0);
    }
    /**
     * @param {Uint16Array | number[]} states
     * @param {boolean} fancy_leaves
     * @returns {Uint8Array}
     */
    compute(states, fancy_leaves) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            const val2 = +fancy_leaves;
            const ptr0 = passArray16ToWasm0(states, wasm.__wbindgen_export);
            const len0 = WASM_VECTOR_LEN;
            wasm.visgraph_compute(retptr, this.__wbg_ptr, ptr0, len0, val2);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v3 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export3(r0, r1 * 1, 1);
            return v3;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @returns {number}
     */
    flags_len() {
        const ret = wasm.visgraph_flags_len(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {Uint8Array | number[]} state_flags
     */
    constructor(state_flags) {
        const ptr0 = passArray8ToWasm0(state_flags, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.visgraph_new(ptr0, len0);
        this.__wbg_ptr = ret;
        VisGraphFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {Uint8Array | number[]} state_flags
     */
    update_flags(state_flags) {
        const ptr0 = passArray8ToWasm0(state_flags, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.visgraph_update_flags(this.__wbg_ptr, ptr0, len0);
    }
}
if (Symbol.dispose) VisGraph.prototype[Symbol.dispose] = VisGraph.prototype.free;

/**
 * World data exposed to JavaScript and native tests.
 */
export class WorldCore {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WorldCoreFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_worldcore_free(ptr, 0);
    }
    begin_batch() {
        wasm.worldcore_begin_batch(this.__wbg_ptr);
    }
    /**
     * Build the 20^3 section neighbourhood the mesher consumes
     * (`world/slice.js`). Coordinates are section coordinates.
     * @param {number} cx
     * @param {number} sy
     * @param {number} cz
     * @param {number} biome_blend_radius
     * @returns {SliceData}
     */
    build_slice(cx, sy, cz, biome_blend_radius) {
        const ret = wasm.worldcore_build_slice(this.__wbg_ptr, cx, sy, cz, biome_blend_radius);
        return SliceData.__wrap(ret);
    }
    /**
     * @param {number} cx
     * @param {number} cz
     * @returns {Uint32Array}
     */
    chunk_biomes(cx, cz) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.worldcore_chunk_biomes(retptr, this.__wbg_ptr, cx, cz);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayU32FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export3(r0, r1 * 4, 4);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @returns {number}
     */
    chunk_count() {
        const ret = wasm.worldcore_chunk_count(this.__wbg_ptr);
        return ret >>> 0;
    }
    clear() {
        wasm.worldcore_clear(this.__wbg_ptr);
    }
    end_batch() {
        wasm.worldcore_end_batch(this.__wbg_ptr);
    }
    /**
     * @param {number} x
     * @param {number} z
     * @param {number} y
     * @returns {number}
     */
    get_biome(x, z, y) {
        const ret = wasm.worldcore_get_biome(this.__wbg_ptr, x, z, y);
        return ret >>> 0;
    }
    /**
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @returns {number}
     */
    get_block_light(x, y, z) {
        const ret = wasm.worldcore_get_block_light(this.__wbg_ptr, x, y, z);
        return ret;
    }
    /**
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @returns {number}
     */
    get_sky_light(x, y, z) {
        const ret = wasm.worldcore_get_sky_light(this.__wbg_ptr, x, y, z);
        return ret;
    }
    /**
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @returns {number}
     */
    get_state(x, y, z) {
        const ret = wasm.worldcore_get_state(this.__wbg_ptr, x, y, z);
        return ret >>> 0;
    }
    /**
     * @returns {boolean}
     */
    has_sky() {
        const ret = wasm.worldcore_has_sky(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @param {number} cx
     * @param {number} cz
     * @returns {Uint8Array}
     */
    height_map(cx, cz) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.worldcore_height_map(retptr, this.__wbg_ptr, cx, cz);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export3(r0, r1 * 1, 1);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @param {number} cx
     * @param {number} cz
     * @returns {boolean}
     */
    is_loaded(cx, cz) {
        const ret = wasm.worldcore_is_loaded(this.__wbg_ptr, cx, cz);
        return ret !== 0;
    }
    /**
     * @returns {Int32Array}
     */
    last_dirty() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.worldcore_last_dirty(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayI32FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export3(r0, r1 * 4, 4);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * `World.loadChunk` for the 1.9+/1.13 chunk-data packet. Returns bytes consumed.
     * @param {number} cx
     * @param {number} cz
     * @param {boolean} ground_up
     * @param {number} bit_map
     * @param {Uint8Array | number[]} data
     * @param {number} offset
     * @param {boolean} sky_light
     * @returns {number}
     */
    load_chunk_113(cx, cz, ground_up, bit_map, data, offset, sky_light) {
        const val2 = +cx;
        const val3 = +cz;
        const val4 = +ground_up;
        const val5 = +bit_map;
        const val6 = +offset;
        const val7 = +sky_light;
        const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.worldcore_load_chunk_113(this.__wbg_ptr, val2, val3, val4, val5, ptr0, len0, val6, val7);
        return ret >>> 0;
    }
    /**
     * `opacity[state]` = 0..15 (15 = fully opaque); `emit[state]` = 0..15.
     * @param {Uint8Array | number[]} opacity
     * @param {Uint8Array | number[]} emit
     */
    constructor(opacity, emit) {
        let ptr0, len0, ptr1, len1;
        try {
            ptr0 = passArray8ToWasm0(opacity, wasm.__wbindgen_export);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passArray8ToWasm0(emit, wasm.__wbindgen_export);
            len1 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
            throw e;
        }
        const ret = wasm.worldcore_new(ptr0, len0, ptr1, len1);
        this.__wbg_ptr = ret;
        WorldCoreFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {number} cx
     * @param {number} sy
     * @param {number} cz
     * @returns {Uint8Array}
     */
    section_block_light(cx, sy, cz) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.worldcore_section_block_light(retptr, this.__wbg_ptr, cx, sy, cz);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export3(r0, r1 * 1, 1);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @param {number} cx
     * @param {number} sy
     * @param {number} cz
     * @returns {Uint32Array}
     */
    section_blocks(cx, sy, cz) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.worldcore_section_blocks(retptr, this.__wbg_ptr, cx, sy, cz);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayU32FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export3(r0, r1 * 4, 4);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @param {number} cx
     * @param {number} sy
     * @param {number} cz
     * @returns {Uint8Array}
     */
    section_sky_light(cx, sy, cz) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.worldcore_section_sky_light(retptr, this.__wbg_ptr, cx, sy, cz);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export3(r0, r1 * 1, 1);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @param {boolean} has_sky
     */
    set_has_sky(has_sky) {
        wasm.worldcore_set_has_sky(this.__wbg_ptr, has_sky);
    }
    /**
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @param {number} state
     * @returns {boolean}
     */
    set_state(x, y, z, state) {
        const ret = wasm.worldcore_set_state(this.__wbg_ptr, x, y, z, state);
        return ret !== 0;
    }
    /**
     * @param {number} cx
     * @param {number} cz
     */
    unload_chunk(cx, cz) {
        wasm.worldcore_unload_chunk(this.__wbg_ptr, cx, cz);
    }
}
if (Symbol.dispose) WorldCore.prototype[Symbol.dispose] = WorldCore.prototype.free;

/**
 * World view trait for bed validation (minimal interface).
 */
export class WorldView {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WorldViewFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_worldview_free(ptr, 0);
    }
    /**
     * Get block state at position (to be implemented by JS side).
     * @param {number} _x
     * @param {number} _y
     * @param {number} _z
     * @returns {number}
     */
    get_state(_x, _y, _z) {
        const ret = wasm.worldview_get_state(this.__wbg_ptr, _x, _y, _z);
        return ret >>> 0;
    }
    constructor() {
        const ret = wasm.worldview_new();
        this.__wbg_ptr = ret;
        WorldViewFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}
if (Symbol.dispose) WorldView.prototype[Symbol.dispose] = WorldView.prototype.free;

export class ZipArchive {
    static __wrap(ptr) {
        const obj = Object.create(ZipArchive.prototype);
        obj.__wbg_ptr = ptr;
        ZipArchiveFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ZipArchiveFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_ziparchive_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    entry_count() {
        const ret = wasm.ziparchive_entry_count(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {string} name
     * @returns {boolean}
     */
    has(name) {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.ziparchive_has(this.__wbg_ptr, ptr0, len0);
        return ret !== 0;
    }
    /**
     * @param {string} prefix
     * @returns {string[]}
     */
    list(prefix) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            const ptr0 = passStringToWasm0(prefix, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            wasm.ziparchive_list(retptr, this.__wbg_ptr, ptr0, len0);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v2 = getArrayJsValueFromWasm0(r0, r1);
            wasm.__wbindgen_export3(r0, r1 * 4, 4);
            return v2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @param {string} name
     * @returns {Uint8Array | undefined}
     */
    read(name) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            const ptr0 = passStringToWasm0(name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            wasm.ziparchive_read(retptr, this.__wbg_ptr, ptr0, len0);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            let v2;
            if (r0 !== 0) {
                v2 = getArrayU8FromWasm0(r0, r1).slice();
                wasm.__wbindgen_export3(r0, r1 * 1, 1);
            }
            return v2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @param {string} name
     * @returns {string | undefined}
     */
    read_text(name) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            const ptr0 = passStringToWasm0(name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            wasm.ziparchive_read_text(retptr, this.__wbg_ptr, ptr0, len0);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            let v2;
            if (r0 !== 0) {
                v2 = getStringFromWasm0(r0, r1);
                wasm.__wbindgen_export3(r0, r1 * 1, 1);
            }
            return v2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * Some packs wrap everything in one top-level folder; find the one that
     * contains pack.mcmeta (same rule as ZipArchive.rootPrefix).
     * @returns {string}
     */
    root_prefix() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
            wasm.ziparchive_root_prefix(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
        }
    }
}
if (Symbol.dispose) ZipArchive.prototype[Symbol.dispose] = ZipArchive.prototype.free;

/**
 * @param {string} source
 * @param {string} definitions_json
 * @returns {string}
 */
export function active_glsl_wasm(source, definitions_json) {
    let deferred4_0;
    let deferred4_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        let ptr0, len0, ptr1, len1;
        try {
            ptr0 = passStringToWasm0(source, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passStringToWasm0(definitions_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len1 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
            throw e;
        }
        wasm.active_glsl_wasm(retptr, ptr0, len0, ptr1, len1);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        var ptr3 = r0;
        var len3 = r1;
        if (r3) {
            ptr3 = 0; len3 = 0;
            throw takeFromExternrefTable0(r2);
        }
        deferred4_0 = ptr3;
        deferred4_1 = len3;
        return getStringFromWasm0(ptr3, len3);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred4_0, deferred4_1, 1);
    }
}

/**
 * Add to a statistic (for incrementing).
 * @param {string} stats_json
 * @param {string} name
 * @param {bigint} delta
 * @returns {string}
 */
export function add_statistic(stats_json, name, delta) {
    let deferred4_0;
    let deferred4_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val3 = BigInt.asIntN(64, delta);
        let ptr0, len0, ptr1, len1;
        try {
            ptr0 = passStringToWasm0(stats_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passStringToWasm0(name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len1 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
            throw e;
        }
        wasm.add_statistic(retptr, ptr0, len0, ptr1, len1, val3);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred4_0 = r0;
        deferred4_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred4_0, deferred4_1, 1);
    }
}

/**
 * @param {string} model_json
 * @param {string} args_json
 * @returns {string}
 */
export function animate_biped_model(model_json, args_json) {
    let deferred3_0;
    let deferred3_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        let ptr0, len0, ptr1, len1;
        try {
            ptr0 = passStringToWasm0(model_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passStringToWasm0(args_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len1 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
            throw e;
        }
        wasm.animate_biped_model(retptr, ptr0, len0, ptr1, len1);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred3_0 = r0;
        deferred3_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred3_0, deferred3_1, 1);
    }
}

/**
 * @param {string} model_json
 * @param {string} args_json
 * @returns {string}
 */
export function animate_quadruped_model(model_json, args_json) {
    let deferred3_0;
    let deferred3_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        let ptr0, len0, ptr1, len1;
        try {
            ptr0 = passStringToWasm0(model_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passStringToWasm0(args_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len1 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
            throw e;
        }
        wasm.animate_quadruped_model(retptr, ptr0, len0, ptr1, len1);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred3_0 = r0;
        deferred3_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred3_0, deferred3_1, 1);
    }
}

/**
 * @param {string} model_json
 * @param {string} args_json
 * @returns {string}
 */
export function animate_skeleton_model(model_json, args_json) {
    let deferred3_0;
    let deferred3_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        let ptr0, len0, ptr1, len1;
        try {
            ptr0 = passStringToWasm0(model_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passStringToWasm0(args_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len1 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
            throw e;
        }
        wasm.animate_skeleton_model(retptr, ptr0, len0, ptr1, len1);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred3_0 = r0;
        deferred3_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred3_0, deferred3_1, 1);
    }
}

/**
 * @param {string} model_json
 * @param {string} args_json
 * @returns {string}
 */
export function animate_zombie_model(model_json, args_json) {
    let deferred3_0;
    let deferred3_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        let ptr0, len0, ptr1, len1;
        try {
            ptr0 = passStringToWasm0(model_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passStringToWasm0(args_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len1 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
            throw e;
        }
        wasm.animate_zombie_model(retptr, ptr0, len0, ptr1, len1);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred3_0 = r0;
        deferred3_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred3_0, deferred3_1, 1);
    }
}

/**
 * @param {string} rules_json
 * @param {string} states_json
 * @returns {string}
 */
export function animation_lookup_wasm(rules_json, states_json) {
    let deferred3_0;
    let deferred3_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        let ptr0, len0, ptr1, len1;
        try {
            ptr0 = passStringToWasm0(rules_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passStringToWasm0(states_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len1 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
            throw e;
        }
        wasm.animation_lookup_wasm(retptr, ptr0, len0, ptr1, len1);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred3_0 = r0;
        deferred3_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred3_0, deferred3_1, 1);
    }
}

/**
 * Apply fox flags to a JSON entity object (standalone, matches `applyFoxFlags(e, flags)`).
 * @param {string} entity_json
 * @param {number} flags
 * @returns {string}
 */
export function apply_fox_flags(entity_json, flags) {
    let deferred3_0;
    let deferred3_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val2 = +flags;
        const ptr0 = passStringToWasm0(entity_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.apply_fox_flags(retptr, ptr0, len0, val2);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred3_0 = r0;
        deferred3_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred3_0, deferred3_1, 1);
    }
}

/**
 * Apply entity metadata from wire format to entity state.
 * This is a simplified version - the full logic is in entities.js _applyMeta.
 * @param {string} entity_json
 * @param {string} metadata_json
 * @returns {string}
 */
export function apply_metadata(entity_json, metadata_json) {
    let deferred3_0;
    let deferred3_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        let ptr0, len0, ptr1, len1;
        try {
            ptr0 = passStringToWasm0(entity_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passStringToWasm0(metadata_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len1 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
            throw e;
        }
        wasm.apply_metadata(retptr, ptr0, len0, ptr1, len1);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred3_0 = r0;
        deferred3_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred3_0, deferred3_1, 1);
    }
}

/**
 * Rider yaw adjustment
 * @param {number} rider_yaw
 * @param {number} delta_rotation
 * @param {number} yaw
 * @returns {number}
 */
export function apply_to_rider(rider_yaw, delta_rotation, yaw) {
    const ret = wasm.apply_to_rider(rider_yaw, delta_rotation, yaw);
    return ret;
}

/**
 * Composites banner layers into a single texture (algorithm port from composeBanner).
 *
 * This is the CPU-side compositing that the JS does with canvas.
 * Input: base texture (RGBA), pattern masks (RGBA), layers (pattern + color)
 * Output: Composite RGBA texture data, or empty vec on failure
 * @param {Uint8Array | number[]} base_texture
 * @param {number} base_width
 * @param {number} base_height
 * @param {Uint8Array | number[]} pattern_masks
 * @param {number} pattern_width
 * @param {number} pattern_height
 * @param {Uint8Array | number[]} layers
 * @returns {Uint8Array}
 */
export function banner_composite(base_texture, base_width, base_height, pattern_masks, pattern_width, pattern_height, layers) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val4 = +base_width;
        const val5 = +base_height;
        const val6 = +pattern_width;
        const val7 = +pattern_height;
        let ptr0, len0, ptr1, len1, ptr2, len2;
        try {
            ptr0 = passArray8ToWasm0(base_texture, wasm.__wbindgen_export);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passArray8ToWasm0(pattern_masks, wasm.__wbindgen_export);
            len1 = WASM_VECTOR_LEN;
            ptr2 = passArray8ToWasm0(layers, wasm.__wbindgen_export);
            len2 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr2) { wasm.__wbindgen_export3(ptr2, len2 * 1, 1); }
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
            throw e;
        }
        wasm.banner_composite(retptr, ptr0, len0, val4, val5, ptr1, len1, val6, val7, ptr2, len2);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v8 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 1, 1);
        return v8;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Get all available pattern names.
 * @returns {string[]}
 */
export function banner_pattern_names() {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.banner_pattern_names(retptr);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayJsValueFromWasm0(r0, r1);
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Generate UV coordinates for a banner pattern.
 * Returns [u0, v0, u1, v1] as f32 array, or empty vec if pattern not found.
 * @param {string} pattern_name
 * @param {number} _layer
 * @returns {Float32Array}
 */
export function banner_pattern_uv(pattern_name, _layer) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val2 = +_layer;
        const ptr0 = passStringToWasm0(pattern_name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.banner_pattern_uv(retptr, ptr0, len0, val2);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v3 = getArrayF32FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v3;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Generate vertices for banner rendering (pattern layering).
 *
 * Input: `patterns` is a flat array of [pattern_code_len, pattern_code_bytes..., color, ...] terminated by 0xFF
 *        `base_color` is the base dye color (0-15)
 * Returns: Flat array of vertices [x, y, z, u, v, r, g, b, a, ...] or empty vec on failure
 * @param {Uint8Array | number[]} patterns
 * @param {number} base_color
 * @returns {Float32Array}
 */
export function banner_vertices(patterns, base_color) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val2 = +base_color;
        const ptr0 = passArray8ToWasm0(patterns, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.banner_vertices(retptr, ptr0, len0, val2);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v3 = getArrayF32FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v3;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * @param {number} angle
 * @returns {Float64Array}
 */
export function base_fog_color_wasm(angle) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.base_fog_color_wasm(retptr, angle);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayF64FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 8, 8);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * @param {string} precipitation
 * @param {number} temperature
 * @param {number} rainfall
 * @param {number} y
 * @returns {string}
 */
export function biome_rain_type(precipitation, temperature, rainfall, y) {
    let deferred5_0;
    let deferred5_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val2 = +temperature;
        const val3 = +rainfall;
        const val4 = +y;
        const ptr0 = passStringToWasm0(precipitation, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.biome_rain_type(retptr, ptr0, len0, val2, val3, val4);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred5_0 = r0;
        deferred5_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred5_0, deferred5_1, 1);
    }
}

/**
 * Boat status check
 * @param {string} underwater
 * @param {boolean} check_in_water
 * @param {number} boat_glide
 * @returns {string}
 */
export function boat_status(underwater, check_in_water, boat_glide) {
    let deferred4_0;
    let deferred4_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val2 = +check_in_water;
        const val3 = +boat_glide;
        const ptr0 = passStringToWasm0(underwater, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.boat_status(retptr, ptr0, len0, val2, val3);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred4_0 = r0;
        deferred4_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred4_0, deferred4_1, 1);
    }
}

/**
 * @param {string | null} [connect]
 * @param {string | null} [user]
 * @returns {string}
 */
export function boot_launch_action(connect, user) {
    let deferred3_0;
    let deferred3_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        let ptr0, len0, ptr1, len1;
        try {
            ptr0 = isLikeNone(connect) ? 0 : passStringToWasm0(connect, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len0 = WASM_VECTOR_LEN;
            ptr1 = isLikeNone(user) ? 0 : passStringToWasm0(user, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len1 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
            throw e;
        }
        wasm.boot_launch_action(retptr, ptr0, len0, ptr1, len1);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred3_0 = r0;
        deferred3_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred3_0, deferred3_1, 1);
    }
}

/**
 * @returns {number}
 */
export function boot_step_count() {
    const ret = wasm.boot_step_count();
    return ret >>> 0;
}

/**
 * @param {number} index
 * @returns {string | undefined}
 */
export function boot_step_label(index) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.boot_step_label(retptr, index);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        let v1;
        if (r0 !== 0) {
            v1 = getStringFromWasm0(r0, r1);
            wasm.__wbindgen_export3(r0, r1 * 1, 1);
        }
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Bake a complete box model (hierarchy of parts) to vertex data.
 * `model_json` is a JSON string representing the model hierarchy.
 * `reg` is the block registry for culling context.
 * `block_state` is the block state ID for culling context (0 for entities).
 * Returns a JSON string with vertices and metadata, or "null" on failure.
 * @param {string} model_json
 * @param {BlockRegistryCore} reg
 * @param {number} block_state
 * @returns {string}
 */
export function boxmodel_bake(model_json, reg, block_state) {
    let deferred3_0;
    let deferred3_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        _assertClass(reg, BlockRegistryCore);
        const val2 = +block_state;
        const ptr0 = passStringToWasm0(model_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.boxmodel_bake(retptr, ptr0, len0, reg.__wbg_ptr, val2);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred3_0 = r0;
        deferred3_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred3_0, deferred3_1, 1);
    }
}

/**
 * Transform a part's boxes by its pivot and rotation (for JS-side scene graph).
 * Returns a JSON string with transformed boxes.
 * @param {string} part_json
 * @returns {string}
 */
export function boxmodel_transform_part(part_json) {
    let deferred2_0;
    let deferred2_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const ptr0 = passStringToWasm0(part_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.boxmodel_transform_part(retptr, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred2_0 = r0;
        deferred2_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred2_0, deferred2_1, 1);
    }
}

/**
 * @param {number} dimension
 * @returns {Float64Array}
 */
export function brightness_table_wasm(dimension) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.brightness_table_wasm(retptr, dimension);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayF64FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 8, 8);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * JS keydown blocking as a WASM kernel.
 * @param {string} code
 * @param {boolean} ctrl
 * @returns {boolean}
 */
export function browser_key_prevent_default(code, ctrl) {
    const val2 = +ctrl;
    const ptr0 = passStringToWasm0(code, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.browser_key_prevent_default(ptr0, len0, val2);
    return ret !== 0;
}

/**
 * JS `_resize()` math as a WASM kernel: returns
 * `[dpr, cssWidth, cssHeight, width, height, pxScale]` for the no-device path
 * (`pxScale = canvas.width / cw`; with a device the caller substitutes the
 * device's own `canvas.width`).
 * @param {number} inner_width
 * @param {number} inner_height
 * @param {number} dpr
 * @param {boolean} potato
 * @returns {Float64Array}
 */
export function browser_potato_layout(inner_width, inner_height, dpr, potato) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.browser_potato_layout(retptr, inner_width, inner_height, dpr, potato);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayF64FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 8, 8);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * JS wheel normalization as a WASM kernel (0 models the suppressed emit).
 * @param {number} delta_y
 * @param {number} delta_mode
 * @returns {number}
 */
export function browser_wheel_delta(delta_y, delta_mode) {
    const ret = wasm.browser_wheel_delta(delta_y, delta_mode);
    return ret;
}

/**
 * @returns {Float64Array}
 */
export function build_star_positions_wasm() {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.build_star_positions_wasm(retptr);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayF64FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 8, 8);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Calculate regional difficulty based on:
 * - Base difficulty setting
 * - World time (longer worlds = harder)
 * - Chunk inhabited time (longer inhabited = harder)
 * - Moon phase (full moon = harder)
 * @param {number} difficulty
 * @param {bigint} world_time
 * @param {bigint} inhabited_time
 * @param {number} moon_phase
 * @returns {number}
 */
export function calculate_regional_difficulty(difficulty, world_time, inhabited_time, moon_phase) {
    const ret = wasm.calculate_regional_difficulty(difficulty, world_time, inhabited_time, moon_phase);
    return ret;
}

/**
 * Calculate sleeping camera position (ported from JS sleepingCamera).
 * @param {boolean} game_sleeping
 * @param {boolean} camera_entity
 * @param {boolean} debug_cam
 * @param {number} third_person
 * @param {SleepState} player
 * @param {BedFacing | null | undefined} bed_facing
 * @param {number | null | undefined} camera_eye_height
 * @param {number} partial_tick
 * @returns {SleepCamera | undefined}
 */
export function calculate_sleeping_camera(game_sleeping, camera_entity, debug_cam, third_person, player, bed_facing, camera_eye_height, partial_tick) {
    _assertClass(player, SleepState);
    const ret = wasm.calculate_sleeping_camera(game_sleeping, camera_entity, debug_cam, third_person, player.__wbg_ptr, isLikeNone(bed_facing) ? 1 : bed_facing, !isLikeNone(camera_eye_height), isLikeNone(camera_eye_height) ? 0 : camera_eye_height, partial_tick);
    return ret === 0 ? undefined : SleepCamera.__wrap(ret);
}

/**
 * Calculate the wake-up time when sleeping.
 * Returns the target world time to wake up at.
 * @param {bigint} current_time
 * @returns {bigint}
 */
export function calculate_wake_time(current_time) {
    const ret = wasm.calculate_wake_time(current_time);
    return ret;
}

/**
 * Check if enough players are sleeping to skip night.
 * Vanilla requires > 50% of players in the overworld to be sleeping.
 * @param {number} total_players
 * @param {number} sleeping_players
 * @returns {boolean}
 */
export function can_skip_night(total_players, sleeping_players) {
    const ret = wasm.can_skip_night(total_players, sleeping_players);
    return ret !== 0;
}

/**
 * Check if players can sleep (night time in overworld)
 * @param {bigint} time_of_day
 * @param {number} dimension
 * @returns {boolean}
 */
export function can_sleep(time_of_day, dimension) {
    const ret = wasm.can_sleep(time_of_day, dimension);
    return ret !== 0;
}

/**
 * @param {number} world_time
 * @param {number} partial
 * @returns {number}
 */
export function celestial_angle_wasm(world_time, partial) {
    const ret = wasm.celestial_angle_wasm(world_time, partial);
    return ret;
}

/**
 * Clear all recipes
 * @param {RecipeBookState} recipe_book
 */
export function clear_recipes(recipe_book) {
    _assertClass(recipe_book, RecipeBookState);
    wasm.clear_recipes(recipe_book.__wbg_ptr);
}

/**
 * @param {number} angle
 * @param {number} rain
 * @param {number} thunder
 * @returns {Float64Array}
 */
export function cloud_color_wasm(angle, rain, thunder) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.cloud_color_wasm(retptr, angle, rain, thunder);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayF64FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 8, 8);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Allocation-free convenience wrapper for the JS glue.
 * @param {Uint16Array | number[]} states
 * @param {Uint8Array | number[]} state_flags
 * @param {boolean} fancy_leaves
 * @returns {Uint8Array}
 */
export function compute_visibility_mask(states, state_flags, fancy_leaves) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val3 = +fancy_leaves;
        let ptr0, len0, ptr1, len1;
        try {
            ptr0 = passArray16ToWasm0(states, wasm.__wbindgen_export);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passArray8ToWasm0(state_flags, wasm.__wbindgen_export);
            len1 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 2, 2); }
            throw e;
        }
        wasm.compute_visibility_mask(retptr, ptr0, len0, ptr1, len1, val3);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v4 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 1, 1);
        return v4;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * @param {string} item_json
 * @param {string} registry_json
 * @returns {number}
 */
export function container_armor_points(item_json, registry_json) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        let ptr0, len0, ptr1, len1;
        try {
            ptr0 = passStringToWasm0(item_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passStringToWasm0(registry_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len1 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
            throw e;
        }
        wasm.container_armor_points(retptr, ptr0, len0, ptr1, len1);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        if (r2) {
            throw takeFromExternrefTable0(r1);
        }
        return r0;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * @param {string} item_json
 * @param {string} registry_json
 * @returns {number}
 */
export function container_armor_type(item_json, registry_json) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        let ptr0, len0, ptr1, len1;
        try {
            ptr0 = passStringToWasm0(item_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passStringToWasm0(registry_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len1 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
            throw e;
        }
        wasm.container_armor_type(retptr, ptr0, len0, ptr1, len1);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        if (r2) {
            throw takeFromExternrefTable0(r1);
        }
        return r0;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * `Inventory.addToInventory(item)`; returns the mutated inventory + item state.
 * @param {string} main_json
 * @param {string} item_json
 * @param {number} max_stack
 * @returns {string}
 */
export function container_full_add_to_inventory(main_json, item_json, max_stack) {
    let deferred4_0;
    let deferred4_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val3 = +max_stack;
        let ptr0, len0, ptr1, len1;
        try {
            ptr0 = passStringToWasm0(main_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passStringToWasm0(item_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len1 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
            throw e;
        }
        wasm.container_full_add_to_inventory(retptr, ptr0, len0, ptr1, len1, val3);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred4_0 = r0;
        deferred4_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred4_0, deferred4_1, 1);
    }
}

/**
 * `armorPoints` over the four armor slots (boots, legs, chest, helmet).
 * @param {string} armor_json
 * @param {string} registry_json
 * @returns {number}
 */
export function container_full_armor_points(armor_json, registry_json) {
    let ptr0, len0, ptr1, len1;
    try {
        ptr0 = passStringToWasm0(armor_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        len0 = WASM_VECTOR_LEN;
        ptr1 = passStringToWasm0(registry_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        len1 = WASM_VECTOR_LEN;
    } catch (e) {
        if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
        if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
        throw e;
    }
    const ret = wasm.container_full_armor_points(ptr0, len0, ptr1, len1);
    return ret;
}

/**
 * `armorType`, registry supplied as a JSON map (or `"null"`).
 * @param {string} item_json
 * @param {string} registry_json
 * @returns {number}
 */
export function container_full_armor_type(item_json, registry_json) {
    let ptr0, len0, ptr1, len1;
    try {
        ptr0 = passStringToWasm0(item_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        len0 = WASM_VECTOR_LEN;
        ptr1 = passStringToWasm0(registry_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        len1 = WASM_VECTOR_LEN;
    } catch (e) {
        if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
        if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
        throw e;
    }
    const ret = wasm.container_full_armor_type(ptr0, len0, ptr1, len1);
    return ret;
}

/**
 * `Inventory._buildSlots` as JSON.
 * @returns {string}
 */
export function container_full_build_inventory_slots() {
    let deferred1_0;
    let deferred1_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.container_full_build_inventory_slots(retptr);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred1_0 = r0;
        deferred1_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
    }
}

/**
 * `ContainerWindow._buildSlots` as JSON.
 * @param {string} ctype
 * @param {number} size
 * @returns {string}
 */
export function container_full_build_window_slots(ctype, size) {
    let deferred3_0;
    let deferred3_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val2 = +size;
        const ptr0 = passStringToWasm0(ctype, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.container_full_build_window_slots(retptr, ptr0, len0, val2);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred3_0 = r0;
        deferred3_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred3_0, deferred3_1, 1);
    }
}

/**
 * @param {string} item_json
 * @param {string} registry_json
 * @returns {boolean}
 */
export function container_full_can_hold_potion(item_json, registry_json) {
    let ptr0, len0, ptr1, len1;
    try {
        ptr0 = passStringToWasm0(item_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        len0 = WASM_VECTOR_LEN;
        ptr1 = passStringToWasm0(registry_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        len1 = WASM_VECTOR_LEN;
    } catch (e) {
        if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
        if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
        throw e;
    }
    const ret = wasm.container_full_can_hold_potion(ptr0, len0, ptr1, len1);
    return ret !== 0;
}

/**
 * `ContainerWindow._configureSlot` rules for one slot, as JSON.
 * @param {string} ctype
 * @param {number} i
 * @returns {string}
 */
export function container_full_configure_slot(ctype, i) {
    let deferred3_0;
    let deferred3_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val2 = +i;
        const ptr0 = passStringToWasm0(ctype, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.container_full_configure_slot(retptr, ptr0, len0, val2);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred3_0 = r0;
        deferred3_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred3_0, deferred3_1, 1);
    }
}

/**
 * `consumeGrid(container, from, to)` — the slot range that is decremented.
 * @param {number} from
 * @param {number} to
 * @returns {Int32Array}
 */
export function container_full_consume_grid(from, to) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.container_full_consume_grid(retptr, from, to);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayI32FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * `ItemStack.copy`.
 * @param {string} item_json
 * @returns {string}
 */
export function container_full_copy(item_json) {
    let deferred2_0;
    let deferred2_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const ptr0 = passStringToWasm0(item_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.container_full_copy(retptr, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred2_0 = r0;
        deferred2_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred2_0, deferred2_1, 1);
    }
}

/**
 * `Inventory.firstEmpty` for a JSON array of the 36 main slots.
 * @param {string} main_json
 * @returns {number}
 */
export function container_full_first_empty(main_json) {
    const ptr0 = passStringToWasm0(main_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.container_full_first_empty(ptr0, len0);
    return ret;
}

/**
 * `Inventory.transferStackInSlot` routing for one slot, as JSON.
 * @param {number} i
 * @returns {string}
 */
export function container_full_inventory_transfer_plan(i) {
    let deferred1_0;
    let deferred1_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.container_full_inventory_transfer_plan(retptr, i);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred1_0 = r0;
        deferred1_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @param {string} name
 * @returns {boolean}
 */
export function container_full_is_beacon_payment(name) {
    const ptr0 = passStringToWasm0(name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.container_full_is_beacon_payment(ptr0, len0);
    return ret !== 0;
}

/**
 * @param {string} name
 * @returns {boolean}
 */
export function container_full_is_brewing_ingredient(name) {
    const ptr0 = passStringToWasm0(name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.container_full_is_brewing_ingredient(ptr0, len0);
    return ret !== 0;
}

/**
 * @param {string} name
 * @returns {boolean}
 */
export function container_full_is_chest_type(name) {
    const ptr0 = passStringToWasm0(name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.container_full_is_chest_type(ptr0, len0);
    return ret !== 0;
}

/**
 * @param {string} name
 * @returns {boolean}
 */
export function container_full_is_fuel(name) {
    const ptr0 = passStringToWasm0(name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.container_full_is_fuel(ptr0, len0);
    return ret !== 0;
}

/**
 * @param {string} name
 * @returns {boolean}
 */
export function container_full_is_horse_armor(name) {
    const ptr0 = passStringToWasm0(name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.container_full_is_horse_armor(ptr0, len0);
    return ret !== 0;
}

/**
 * @param {string} name
 * @returns {boolean}
 */
export function container_full_is_smelatable(name) {
    const ptr0 = passStringToWasm0(name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.container_full_is_smelatable(ptr0, len0);
    return ret !== 0;
}

/**
 * `itemName(item, registry)` with the `minecraft:` prefix stripped.
 * @param {string} item_json
 * @param {string} registry_json
 * @returns {string}
 */
export function container_full_item_name(item_json, registry_json) {
    let deferred3_0;
    let deferred3_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        let ptr0, len0, ptr1, len1;
        try {
            ptr0 = passStringToWasm0(item_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passStringToWasm0(registry_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len1 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
            throw e;
        }
        wasm.container_full_item_name(retptr, ptr0, len0, ptr1, len1);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred3_0 = r0;
        deferred3_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred3_0, deferred3_1, 1);
    }
}

/**
 * `ContainerBase.mergeItemStack(stack, start, end, reverse)` over a main
 * inventory, for the shift-click routing tests.
 * @param {string} state_json
 * @param {number} start
 * @param {number} end
 * @param {boolean} reverse
 * @returns {string}
 */
export function container_full_merge_item_stack(state_json, start, end, reverse) {
    let deferred5_0;
    let deferred5_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val2 = +start;
        const val3 = +end;
        const val4 = +reverse;
        const ptr0 = passStringToWasm0(state_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.container_full_merge_item_stack(retptr, ptr0, len0, val2, val3, val4);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred5_0 = r0;
        deferred5_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred5_0, deferred5_1, 1);
    }
}

/**
 * `nbtEqual(a, b)`.
 * @param {string} a_json
 * @param {string} b_json
 * @returns {boolean}
 */
export function container_full_nbt_equal(a_json, b_json) {
    let ptr0, len0, ptr1, len1;
    try {
        ptr0 = passStringToWasm0(a_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        len0 = WASM_VECTOR_LEN;
        ptr1 = passStringToWasm0(b_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        len1 = WASM_VECTOR_LEN;
    } catch (e) {
        if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
        if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
        throw e;
    }
    const ret = wasm.container_full_nbt_equal(ptr0, len0, ptr1, len1);
    return ret !== 0;
}

/**
 * `Inventory.nextAction` — the 15-bit wrapping action counter.
 * @param {number} counter
 * @returns {number}
 */
export function container_full_next_action(counter) {
    const ret = wasm.container_full_next_action(counter);
    return ret;
}

/**
 * `ContainerWindow.onClose` — the container slots cleared on close.
 * @param {string} ctype
 * @returns {Int32Array}
 */
export function container_full_on_close_indices(ctype) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const ptr0 = passStringToWasm0(ctype, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.container_full_on_close_indices(retptr, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v2 = getArrayI32FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v2;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * `ContainerWindow.onPickupFromSlot(i, taken)`: output-slot consumption and
 * result re-offer for the workstation containers.
 * @param {string} state_json
 * @param {number} i
 * @param {string} taken_json
 * @returns {string}
 */
export function container_full_on_pickup_from_slot(state_json, i, taken_json) {
    let deferred4_0;
    let deferred4_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val3 = +i;
        let ptr0, len0, ptr1, len1;
        try {
            ptr0 = passStringToWasm0(state_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passStringToWasm0(taken_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len1 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
            throw e;
        }
        wasm.container_full_on_pickup_from_slot(retptr, ptr0, len0, val3, ptr1, len1);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred4_0 = r0;
        deferred4_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred4_0, deferred4_1, 1);
    }
}

/**
 * `ContainerWindow.onSlotChanged(i)` prediction hook: recomputes the crafting
 * result from the 3x3 grid using the recipe table in `model.craftRecipes`.
 * @param {string} state_json
 * @param {number} i
 * @returns {string}
 */
export function container_full_on_slot_changed(state_json, i) {
    let deferred3_0;
    let deferred3_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val2 = +i;
        const ptr0 = passStringToWasm0(state_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.container_full_on_slot_changed(retptr, ptr0, len0, val2);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred3_0 = r0;
        deferred3_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred3_0, deferred3_1, 1);
    }
}

/**
 * `ContainerWindow.decr` result-slot override.
 * @param {string} ctype
 * @param {boolean} is_output
 * @returns {boolean}
 */
export function container_full_result_slot_takes_all(ctype, is_output) {
    const val2 = +is_output;
    const ptr0 = passStringToWasm0(ctype, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.container_full_result_slot_takes_all(ptr0, len0, val2);
    return ret !== 0;
}

/**
 * Faithful port of `ContainerBase.slotClick(slotId, button, mode)`.
 *
 * `state_json` is the model described in the module docs; the returned string is
 * the same model with `result` (vanilla's "clicked item") and `lastClick`
 * added. `clicked` is the item vanilla would have sent to the server, which the
 * JS `click()` wrapper still has to packetise.
 * @param {string} state_json
 * @param {number} slot_id
 * @param {number} button
 * @param {number} mode
 * @returns {string}
 */
export function container_full_slot_click(state_json, slot_id, button, mode) {
    let deferred5_0;
    let deferred5_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val2 = +slot_id;
        const val3 = +button;
        const val4 = +mode;
        const ptr0 = passStringToWasm0(state_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.container_full_slot_click(retptr, ptr0, len0, val2, val3, val4);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred5_0 = r0;
        deferred5_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred5_0, deferred5_1, 1);
    }
}

/**
 * `stackable(a, b)`.
 * @param {string} a_json
 * @param {string} b_json
 * @returns {boolean}
 */
export function container_full_stackable(a_json, b_json) {
    let ptr0, len0, ptr1, len1;
    try {
        ptr0 = passStringToWasm0(a_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        len0 = WASM_VECTOR_LEN;
        ptr1 = passStringToWasm0(b_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        len1 = WASM_VECTOR_LEN;
    } catch (e) {
        if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
        if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
        throw e;
    }
    const ret = wasm.container_full_stackable(ptr0, len0, ptr1, len1);
    return ret !== 0;
}

/**
 * `ContainerWindow.transferStackInSlot` routing for one slot, as JSON.
 * @param {string} ctype
 * @param {number} i
 * @param {number} size
 * @param {number} total
 * @param {string} item_name
 * @returns {string}
 */
export function container_full_transfer_plan(ctype, i, size, total, item_name) {
    let deferred6_0;
    let deferred6_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val3 = +i;
        const val4 = +size;
        const val5 = +total;
        let ptr0, len0, ptr1, len1;
        try {
            ptr0 = passStringToWasm0(ctype, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passStringToWasm0(item_name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len1 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
            throw e;
        }
        wasm.container_full_transfer_plan(retptr, ptr0, len0, val3, val4, val5, ptr1, len1);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred6_0 = r0;
        deferred6_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred6_0, deferred6_1, 1);
    }
}

/**
 * `ContainerWindow` slot count after the fixed-size table is applied.
 * @param {string} ctype
 * @param {number} slot_count
 * @returns {number}
 */
export function container_full_window_size(ctype, slot_count) {
    const val2 = +slot_count;
    const ptr0 = passStringToWasm0(ctype, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.container_full_window_size(ptr0, len0, val2);
    return ret;
}

/**
 * @param {string} name
 * @returns {boolean}
 */
export function container_is_beacon_payment(name) {
    const ptr0 = passStringToWasm0(name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.container_is_beacon_payment(ptr0, len0);
    return ret !== 0;
}

/**
 * @param {string} name
 * @returns {boolean}
 */
export function container_is_brewing_ingredient(name) {
    const ptr0 = passStringToWasm0(name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.container_is_brewing_ingredient(ptr0, len0);
    return ret !== 0;
}

/**
 * @param {string} name
 * @returns {boolean}
 */
export function container_is_fuel(name) {
    const ptr0 = passStringToWasm0(name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.container_is_fuel(ptr0, len0);
    return ret !== 0;
}

/**
 * @param {string} name
 * @returns {boolean}
 */
export function container_is_horse_armor(name) {
    const ptr0 = passStringToWasm0(name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.container_is_horse_armor(ptr0, len0);
    return ret !== 0;
}

/**
 * @param {string} name
 * @returns {boolean}
 */
export function container_is_smelatable(name) {
    const ptr0 = passStringToWasm0(name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.container_is_smelatable(ptr0, len0);
    return ret !== 0;
}

/**
 * @param {number} item_id
 * @param {number} count
 * @param {number} damage
 * @returns {string}
 */
export function container_item_wasm(item_id, count, damage) {
    let deferred1_0;
    let deferred1_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.container_item_wasm(retptr, item_id, count, damage);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred1_0 = r0;
        deferred1_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @param {number} slot_id
 * @param {number} button
 * @param {number} mode
 * @param {string} inventory_json
 * @param {string} items_registry_json
 * @returns {string}
 */
export function container_slot_click(slot_id, button, mode, inventory_json, items_registry_json) {
    let deferred7_0;
    let deferred7_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val3 = +slot_id;
        const val4 = +button;
        const val5 = +mode;
        let ptr0, len0, ptr1, len1;
        try {
            ptr0 = passStringToWasm0(inventory_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passStringToWasm0(items_registry_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len1 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
            throw e;
        }
        wasm.container_slot_click(retptr, val3, val4, val5, ptr0, len0, ptr1, len1);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        var ptr6 = r0;
        var len6 = r1;
        if (r3) {
            ptr6 = 0; len6 = 0;
            throw takeFromExternrefTable0(r2);
        }
        deferred7_0 = ptr6;
        deferred7_1 = len6;
        return getStringFromWasm0(ptr6, len6);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred7_0, deferred7_1, 1);
    }
}

/**
 * Version of the ported core, shown by the WASM self-test.
 * @returns {string}
 */
export function core_version() {
    let deferred1_0;
    let deferred1_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.core_version(retptr);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred1_0 = r0;
        deferred1_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
    }
}

/**
 * `Section.recount()`: number of non-air cells.
 *
 * The JS original used `AIR_STATES_498.includes()` for every cell; the air
 * list is passed in so the registry stays in JavaScript.
 * @param {Uint32Array | number[]} blocks
 * @param {Uint32Array | number[]} air_states
 * @returns {number}
 */
export function count_non_air(blocks, air_states) {
    let ptr0, len0, ptr1, len1;
    try {
        ptr0 = passArray32ToWasm0(blocks, wasm.__wbindgen_export);
        len0 = WASM_VECTOR_LEN;
        ptr1 = passArray32ToWasm0(air_states, wasm.__wbindgen_export);
        len1 = WASM_VECTOR_LEN;
    } catch (e) {
        if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 4, 4); }
        if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 4, 4); }
        throw e;
    }
    const ret = wasm.count_non_air(ptr0, len0, ptr1, len1);
    return ret >>> 0;
}

/**
 * Create an arm animation packet
 * @param {number | null | undefined} hand
 * @param {number} protocol_version
 * @returns {Uint8Array}
 */
export function create_arm_animation_packet(hand, protocol_version) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.create_arm_animation_packet(retptr, isLikeNone(hand) ? Number.MAX_SAFE_INTEGER : (hand) >> 0, protocol_version);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        if (r3) {
            throw takeFromExternrefTable0(r2);
        }
        var v1 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 1, 1);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Create a block dig packet
 * @param {number} status
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} face
 * @param {number} protocol_version
 * @returns {Uint8Array}
 */
export function create_block_dig_packet(status, x, y, z, face, protocol_version) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.create_block_dig_packet(retptr, status, x, y, z, face, protocol_version);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        if (r3) {
            throw takeFromExternrefTable0(r2);
        }
        var v1 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 1, 1);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Create a block place packet
 * @param {number} hand
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} face
 * @param {number} cursor_x
 * @param {number} cursor_y
 * @param {number} cursor_z
 * @param {boolean} inside_block
 * @param {number} protocol_version
 * @returns {Uint8Array}
 */
export function create_block_place_packet(hand, x, y, z, face, cursor_x, cursor_y, cursor_z, inside_block, protocol_version) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.create_block_place_packet(retptr, hand, x, y, z, face, cursor_x, cursor_y, cursor_z, inside_block, protocol_version);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        if (r3) {
            throw takeFromExternrefTable0(r2);
        }
        var v1 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 1, 1);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Create a chat message packet
 * @param {string} message
 * @param {number} protocol_version
 * @returns {Uint8Array}
 */
export function create_chat_packet(message, protocol_version) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val2 = +protocol_version;
        const ptr0 = passStringToWasm0(message, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.create_chat_packet(retptr, ptr0, len0, val2);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        if (r3) {
            throw takeFromExternrefTable0(r2);
        }
        var v3 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 1, 1);
        return v3;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Create a client command packet
 * @param {number} action
 * @param {number} protocol_version
 * @returns {Uint8Array}
 */
export function create_client_command_packet(action, protocol_version) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.create_client_command_packet(retptr, action, protocol_version);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        if (r3) {
            throw takeFromExternrefTable0(r2);
        }
        var v1 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 1, 1);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Create a close window packet
 * @param {number} window_id
 * @param {number} protocol_version
 * @returns {Uint8Array}
 */
export function create_close_window_packet(window_id, protocol_version) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.create_close_window_packet(retptr, window_id, protocol_version);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        if (r3) {
            throw takeFromExternrefTable0(r2);
        }
        var v1 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 1, 1);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Create a custom payload packet
 * @param {string} channel
 * @param {Uint8Array | number[]} data
 * @param {number} protocol_version
 * @returns {Uint8Array}
 */
export function create_custom_payload_packet(channel, data, protocol_version) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val3 = +protocol_version;
        let ptr0, len0, ptr1, len1;
        try {
            ptr0 = passStringToWasm0(channel, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passArray8ToWasm0(data, wasm.__wbindgen_export);
            len1 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
            throw e;
        }
        wasm.create_custom_payload_packet(retptr, ptr0, len0, ptr1, len1, val3);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        if (r3) {
            throw takeFromExternrefTable0(r2);
        }
        var v4 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 1, 1);
        return v4;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Create an entity action packet
 * @param {number} eid
 * @param {number} action
 * @param {number} jump_boost
 * @param {number} protocol_version
 * @returns {Uint8Array}
 */
export function create_entity_action_packet(eid, action, jump_boost, protocol_version) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.create_entity_action_packet(retptr, eid, action, jump_boost, protocol_version);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        if (r3) {
            throw takeFromExternrefTable0(r2);
        }
        var v1 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 1, 1);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Create a flying packet (position + look)
 * @param {boolean} on_ground
 * @param {number} protocol_version
 * @returns {Uint8Array}
 */
export function create_flying_packet(on_ground, protocol_version) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.create_flying_packet(retptr, on_ground, protocol_version);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        if (r3) {
            throw takeFromExternrefTable0(r2);
        }
        var v1 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 1, 1);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Create a held item slot packet
 * @param {number} slot
 * @param {number} protocol_version
 * @returns {Uint8Array}
 */
export function create_held_item_slot_packet(slot, protocol_version) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.create_held_item_slot_packet(retptr, slot, protocol_version);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        if (r3) {
            throw takeFromExternrefTable0(r2);
        }
        var v1 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 1, 1);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Create a keep alive packet
 * @param {bigint} keep_alive_id
 * @param {number} protocol_version
 * @returns {Uint8Array}
 */
export function create_keep_alive_packet(keep_alive_id, protocol_version) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.create_keep_alive_packet(retptr, keep_alive_id, protocol_version);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        if (r3) {
            throw takeFromExternrefTable0(r2);
        }
        var v1 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 1, 1);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Create a look packet
 * @param {number} yaw
 * @param {number} pitch
 * @param {boolean} on_ground
 * @param {number} protocol_version
 * @returns {Uint8Array}
 */
export function create_look_packet(yaw, pitch, on_ground, protocol_version) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.create_look_packet(retptr, yaw, pitch, on_ground, protocol_version);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        if (r3) {
            throw takeFromExternrefTable0(r2);
        }
        var v1 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 1, 1);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Create a name item packet
 * @param {string} name
 * @param {number} protocol_version
 * @returns {Uint8Array}
 */
export function create_name_item_packet(name, protocol_version) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val2 = +protocol_version;
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.create_name_item_packet(retptr, ptr0, len0, val2);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        if (r3) {
            throw takeFromExternrefTable0(r2);
        }
        var v3 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 1, 1);
        return v3;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Create a place recipe packet
 * @param {number} window_id
 * @param {string} recipe
 * @param {boolean} all
 * @param {number} protocol_version
 * @returns {Uint8Array}
 */
export function create_place_recipe_packet(window_id, recipe, all, protocol_version) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val2 = +window_id;
        const val3 = +all;
        const val4 = +protocol_version;
        const ptr0 = passStringToWasm0(recipe, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.create_place_recipe_packet(retptr, val2, ptr0, len0, val3, val4);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        if (r3) {
            throw takeFromExternrefTable0(r2);
        }
        var v5 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 1, 1);
        return v5;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Create a position + look packet
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} yaw
 * @param {number} pitch
 * @param {boolean} on_ground
 * @param {number} protocol_version
 * @returns {Uint8Array}
 */
export function create_position_look_packet(x, y, z, yaw, pitch, on_ground, protocol_version) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.create_position_look_packet(retptr, x, y, z, yaw, pitch, on_ground, protocol_version);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        if (r3) {
            throw takeFromExternrefTable0(r2);
        }
        var v1 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 1, 1);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Create a position packet
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {boolean} on_ground
 * @param {number} protocol_version
 * @returns {Uint8Array}
 */
export function create_position_packet(x, y, z, on_ground, protocol_version) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.create_position_packet(retptr, x, y, z, on_ground, protocol_version);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        if (r3) {
            throw takeFromExternrefTable0(r2);
        }
        var v1 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 1, 1);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Create a recipe info settings packet
 * @param {boolean} open
 * @param {boolean} filtering
 * @param {boolean} smelting_open
 * @param {boolean} smelting_filtering
 * @param {boolean} blasting_open
 * @param {boolean} blasting_filtering
 * @param {boolean} smoking_open
 * @param {boolean} smoking_filtering
 * @param {number} protocol_version
 * @returns {Uint8Array}
 */
export function create_recipe_info_settings_packet(open, filtering, smelting_open, smelting_filtering, blasting_open, blasting_filtering, smoking_open, smoking_filtering, protocol_version) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.create_recipe_info_settings_packet(retptr, open, filtering, smelting_open, smelting_filtering, blasting_open, blasting_filtering, smoking_open, smoking_filtering, protocol_version);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        if (r3) {
            throw takeFromExternrefTable0(r2);
        }
        var v1 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 1, 1);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Create a recipe info shown packet
 * @param {string} recipe
 * @param {number} protocol_version
 * @returns {Uint8Array}
 */
export function create_recipe_info_shown_packet(recipe, protocol_version) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val2 = +protocol_version;
        const ptr0 = passStringToWasm0(recipe, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.create_recipe_info_shown_packet(retptr, ptr0, len0, val2);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        if (r3) {
            throw takeFromExternrefTable0(r2);
        }
        var v3 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 1, 1);
        return v3;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Create a resource pack status packet
 * @param {number} result
 * @param {number} protocol_version
 * @returns {Uint8Array}
 */
export function create_resource_pack_status_packet(result, protocol_version) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.create_resource_pack_status_packet(retptr, result, protocol_version);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        if (r3) {
            throw takeFromExternrefTable0(r2);
        }
        var v1 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 1, 1);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Create a seen advancements packet
 * @param {string | null | undefined} tab
 * @param {number} protocol_version
 * @returns {Uint8Array}
 */
export function create_seen_advancements_packet(tab, protocol_version) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val2 = +protocol_version;
        var ptr0 = isLikeNone(tab) ? 0 : passStringToWasm0(tab, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        var len0 = WASM_VECTOR_LEN;
        wasm.create_seen_advancements_packet(retptr, ptr0, len0, val2);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        if (r3) {
            throw takeFromExternrefTable0(r2);
        }
        var v3 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 1, 1);
        return v3;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Create a select trade packet
 * @param {number} index
 * @param {number} protocol_version
 * @returns {Uint8Array}
 */
export function create_select_trade_packet(index, protocol_version) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.create_select_trade_packet(retptr, index, protocol_version);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        if (r3) {
            throw takeFromExternrefTable0(r2);
        }
        var v1 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 1, 1);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Create a set beacon effects packet
 * @param {number} primary
 * @param {number} secondary
 * @param {number} protocol_version
 * @returns {Uint8Array}
 */
export function create_set_beacon_effects_packet(primary, secondary, protocol_version) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.create_set_beacon_effects_packet(retptr, primary, secondary, protocol_version);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        if (r3) {
            throw takeFromExternrefTable0(r2);
        }
        var v1 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 1, 1);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Create a settings packet
 * @param {string} locale
 * @param {number} view_distance
 * @param {number} chat_flags
 * @param {boolean} chat_colors
 * @param {number} skin_parts
 * @param {number} main_hand
 * @param {number} protocol_version
 * @returns {Uint8Array}
 */
export function create_settings_packet(locale, view_distance, chat_flags, chat_colors, skin_parts, main_hand, protocol_version) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val2 = +view_distance;
        const val3 = +chat_flags;
        const val4 = +chat_colors;
        const val5 = +skin_parts;
        const val6 = +main_hand;
        const val7 = +protocol_version;
        const ptr0 = passStringToWasm0(locale, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.create_settings_packet(retptr, ptr0, len0, val2, val3, val4, val5, val6, val7);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        if (r3) {
            throw takeFromExternrefTable0(r2);
        }
        var v8 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 1, 1);
        return v8;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Create a spectate packet
 * @param {string} uuid
 * @param {number} protocol_version
 * @returns {Uint8Array}
 */
export function create_spectate_packet(uuid, protocol_version) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val2 = +protocol_version;
        const ptr0 = passStringToWasm0(uuid, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.create_spectate_packet(retptr, ptr0, len0, val2);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        if (r3) {
            throw takeFromExternrefTable0(r2);
        }
        var v3 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 1, 1);
        return v3;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Create a steer vehicle packet
 * @param {number} sideways
 * @param {number} forward
 * @param {number} flags
 * @param {number} protocol_version
 * @returns {Uint8Array}
 */
export function create_steer_vehicle_packet(sideways, forward, flags, protocol_version) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.create_steer_vehicle_packet(retptr, sideways, forward, flags, protocol_version);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        if (r3) {
            throw takeFromExternrefTable0(r2);
        }
        var v1 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 1, 1);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Create a tab complete packet
 * @param {string} text
 * @param {number} transaction_id
 * @param {number} protocol_version
 * @returns {Uint8Array}
 */
export function create_tab_complete_packet(text, transaction_id, protocol_version) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val2 = +transaction_id;
        const val3 = +protocol_version;
        const ptr0 = passStringToWasm0(text, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.create_tab_complete_packet(retptr, ptr0, len0, val2, val3);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        if (r3) {
            throw takeFromExternrefTable0(r2);
        }
        var v4 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 1, 1);
        return v4;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Create a teleport confirm packet
 * @param {number} id
 * @param {number} protocol_version
 * @returns {Uint8Array}
 */
export function create_teleport_confirm_packet(id, protocol_version) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.create_teleport_confirm_packet(retptr, id, protocol_version);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        if (r3) {
            throw takeFromExternrefTable0(r2);
        }
        var v1 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 1, 1);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Create a transaction packet
 * @param {number} window_id
 * @param {number} action
 * @param {boolean} accepted
 * @param {number} protocol_version
 * @returns {Uint8Array}
 */
export function create_transaction_packet(window_id, action, accepted, protocol_version) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.create_transaction_packet(retptr, window_id, action, accepted, protocol_version);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        if (r3) {
            throw takeFromExternrefTable0(r2);
        }
        var v1 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 1, 1);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Create a use entity packet
 * @param {number} target
 * @param {number} mouse
 * @param {number | null | undefined} x
 * @param {number | null | undefined} y
 * @param {number | null | undefined} z
 * @param {number | null | undefined} hand
 * @param {number} protocol_version
 * @returns {Uint8Array}
 */
export function create_use_entity_packet(target, mouse, x, y, z, hand, protocol_version) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.create_use_entity_packet(retptr, target, mouse, isLikeNone(x) ? Number.MAX_SAFE_INTEGER : Math.fround(x), isLikeNone(y) ? Number.MAX_SAFE_INTEGER : Math.fround(y), isLikeNone(z) ? Number.MAX_SAFE_INTEGER : Math.fround(z), isLikeNone(hand) ? Number.MAX_SAFE_INTEGER : (hand) >> 0, protocol_version);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        if (r3) {
            throw takeFromExternrefTable0(r2);
        }
        var v1 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 1, 1);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Create a use item packet
 * @param {number | null | undefined} hand
 * @param {number} protocol_version
 * @returns {Uint8Array}
 */
export function create_use_item_packet(hand, protocol_version) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.create_use_item_packet(retptr, isLikeNone(hand) ? Number.MAX_SAFE_INTEGER : (hand) >> 0, protocol_version);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        if (r3) {
            throw takeFromExternrefTable0(r2);
        }
        var v1 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 1, 1);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * `crystalBeam(start, end, age)` - RenderDragon's octagonal taper.
 * Black at the dragon (start) and white at the crystal (end).
 *
 * Returns a `Vec<f32>` with stride 9 (x, y, z, u, v, r, g, b, a) for each vertex.
 * The vertices form quads (4 vertices per face, 8 faces = 32 vertices).
 * @param {Float32Array | number[]} start
 * @param {Float32Array | number[]} end
 * @param {number} age
 * @returns {Float32Array}
 */
export function crystal_beam(start, end, age) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val3 = +age;
        let ptr0, len0, ptr1, len1;
        try {
            ptr0 = passArrayF32ToWasm0(start, wasm.__wbindgen_export);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passArrayF32ToWasm0(end, wasm.__wbindgen_export);
            len1 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 4, 4); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 4, 4); }
            throw e;
        }
        wasm.crystal_beam(retptr, ptr0, len0, ptr1, len1, val3);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v4 = getArrayF32FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v4;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Crystal bob animation: `crystalBob(age)`.
 * Returns the vertical offset for the end crystal beam endpoint.
 * @param {number} age
 * @returns {number}
 */
export function crystal_bob(age) {
    const ret = wasm.crystal_bob(age);
    return ret;
}

/**
 * Calculate wake-up time when sleeping
 * @param {bigint} current_time
 * @returns {bigint}
 */
export function day_cycle_calculate_wake_time(current_time) {
    const ret = wasm.day_cycle_calculate_wake_time(current_time);
    return ret;
}

/**
 * Get celestial angle (0.0 = noon, 0.5 = midnight)
 * Ported from sky.js celestialAngle function
 * @param {bigint} world_time
 * @param {number} partial
 * @returns {number}
 */
export function day_cycle_celestial_angle(world_time, partial) {
    const ret = wasm.day_cycle_celestial_angle(world_time, partial);
    return ret;
}

/**
 * Generate vertices for multiple line segments at once (batch API).
 *
 * # Arguments
 * * `lines` - Flat array of [x0, y0, z0, x1, y1, z1, r, g, b, a, ...] per segment.
 *             Length must be a multiple of 10 (or 9 with implicit alpha=1).
 *             If 9 floats per segment, alpha defaults to 1.0.
 *
 * Returns a Float32Array with all vertices or null on failure.
 * @param {Float32Array | number[]} lines
 * @returns {Float32Array | undefined}
 */
export function debug_lines_batch(lines) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const ptr0 = passArrayF32ToWasm0(lines, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.debug_lines_batch(retptr, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        let v2;
        if (r0 !== 0) {
            v2 = getArrayF32FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export3(r0, r1 * 4, 4);
        }
        return v2;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Generate vertices for an axis-aligned box outline (12 edges, 24 vertices).
 *
 * # Arguments
 * * `min`   - [x, y, z] minimum corner
 * * `max`   - [x, y, z] maximum corner
 * * `color` - [r, g, b, a] color (alpha defaults to 1.0)
 *
 * Returns a Float32Array with 216 floats (24 vertices × 9 floats) or null on failure.
 * @param {Float32Array | number[]} min
 * @param {Float32Array | number[]} max
 * @param {Float32Array | number[]} color
 * @returns {Float32Array | undefined}
 */
export function debug_lines_box(min, max, color) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        let ptr0, len0, ptr1, len1, ptr2, len2;
        try {
            ptr0 = passArrayF32ToWasm0(min, wasm.__wbindgen_export);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passArrayF32ToWasm0(max, wasm.__wbindgen_export);
            len1 = WASM_VECTOR_LEN;
            ptr2 = passArrayF32ToWasm0(color, wasm.__wbindgen_export);
            len2 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr2) { wasm.__wbindgen_export3(ptr2, len2 * 4, 4); }
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 4, 4); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 4, 4); }
            throw e;
        }
        wasm.debug_lines_box(retptr, ptr0, len0, ptr1, len1, ptr2, len2);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        let v4;
        if (r0 !== 0) {
            v4 = getArrayF32FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export3(r0, r1 * 4, 4);
        }
        return v4;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Generate chunk border debug lines (port of `_chunkBorders`).
 *
 * # Arguments
 * * `player_x` - Player X position
 * * `player_z` - Player Z position
 * * `max_y`    - Maximum Y for vertical lines (default 256)
 *
 * Returns a Float32Array with all chunk border vertices or null on failure.
 * @param {number} player_x
 * @param {number} player_z
 * @param {number} max_y
 * @returns {Float32Array | undefined}
 */
export function debug_lines_chunk_borders(player_x, player_z, max_y) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.debug_lines_chunk_borders(retptr, player_x, player_z, max_y);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        let v1;
        if (r0 !== 0) {
            v1 = getArrayF32FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export3(r0, r1 * 4, 4);
        }
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

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
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} width
 * @param {number} height
 * @param {number | null | undefined} eye_height
 * @param {number | null | undefined} yaw
 * @param {number | null | undefined} pitch
 * @param {boolean} show_eyes
 * @returns {Float32Array | undefined}
 */
export function debug_lines_entity_hitbox(x, y, z, width, height, eye_height, yaw, pitch, show_eyes) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.debug_lines_entity_hitbox(retptr, x, y, z, width, height, isLikeNone(eye_height) ? Number.MAX_SAFE_INTEGER : Math.fround(eye_height), isLikeNone(yaw) ? Number.MAX_SAFE_INTEGER : Math.fround(yaw), isLikeNone(pitch) ? Number.MAX_SAFE_INTEGER : Math.fround(pitch), show_eyes);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        let v1;
        if (r0 !== 0) {
            v1 = getArrayF32FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export3(r0, r1 * 4, 4);
        }
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Generate vertices for a single line segment.
 *
 * # Arguments
 * * `start` - [x, y, z] start point
 * * `end`   - [x, y, z] end point
 * * `color` - [r, g, b, a] color (alpha defaults to 1.0)
 *
 * Returns a Float32Array with 18 floats (2 vertices × 9 floats) or null on failure.
 * @param {Float32Array | number[]} start
 * @param {Float32Array | number[]} end
 * @param {Float32Array | number[]} color
 * @returns {Float32Array | undefined}
 */
export function debug_lines_line(start, end, color) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        let ptr0, len0, ptr1, len1, ptr2, len2;
        try {
            ptr0 = passArrayF32ToWasm0(start, wasm.__wbindgen_export);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passArrayF32ToWasm0(end, wasm.__wbindgen_export);
            len1 = WASM_VECTOR_LEN;
            ptr2 = passArrayF32ToWasm0(color, wasm.__wbindgen_export);
            len2 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr2) { wasm.__wbindgen_export3(ptr2, len2 * 4, 4); }
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 4, 4); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 4, 4); }
            throw e;
        }
        wasm.debug_lines_line(retptr, ptr0, len0, ptr1, len1, ptr2, len2);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        let v4;
        if (r0 !== 0) {
            v4 = getArrayF32FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export3(r0, r1 * 4, 4);
        }
        return v4;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * @param {string} value
 * @returns {Uint8Array}
 */
export function decode_base64(value) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const ptr0 = passStringToWasm0(value, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.decode_base64(retptr, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v2 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 1, 1);
        return v2;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Decode `text` to exactly `length` bytes. Returns `None` for malformed data,
 * an invalid length, or a word above 32 bits.
 * @param {string} text
 * @param {number} length
 * @returns {Uint8Array | undefined}
 */
export function decode_base85(text, length) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val2 = +length;
        const ptr0 = passStringToWasm0(text, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.decode_base85(retptr, ptr0, len0, val2);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        let v3;
        if (r0 !== 0) {
            v3 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export3(r0, r1 * 1, 1);
        }
        return v3;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Decode a 1.14.4 (protocol 498) chunk column. `None` on any validation error.
 * @param {Uint8Array | number[]} data
 * @param {number} bit_map
 * @param {number} state_count
 * @param {boolean} ground_up
 * @returns {ChunkColumn | undefined}
 */
export function decode_chunk_498(data, bit_map, state_count, ground_up) {
    const val2 = +bit_map;
    const val3 = +state_count;
    const val4 = +ground_up;
    const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_export);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.decode_chunk_498(ptr0, len0, val2, val3, val4);
    return ret === 0 ? undefined : ChunkColumn.__wrap(ret);
}

/**
 * Decode a 1.15.2 (protocol 578) chunk column. Biomes live on the packet and
 * are not part of `data`.
 * @param {Uint8Array | number[]} data
 * @param {number} bit_map
 * @param {number} state_count
 * @returns {ChunkColumn | undefined}
 */
export function decode_chunk_578(data, bit_map, state_count) {
    const val2 = +bit_map;
    const val3 = +state_count;
    const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_export);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.decode_chunk_578(ptr0, len0, val2, val3);
    return ret === 0 ? undefined : ChunkColumn.__wrap(ret);
}

/**
 * Decode entity metadata from a packet buffer.
 * Returns a Map of index -> Value (matching the JS wire format).
 * @param {Uint8Array | number[]} data
 * @returns {string}
 */
export function decode_entity_metadata(data) {
    let deferred2_0;
    let deferred2_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.decode_entity_metadata(retptr, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred2_0 = r0;
        deferred2_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred2_0, deferred2_1, 1);
    }
}

/**
 * Wasm boundary: the decoded packet object as JSON (the JS callers consume a
 * plain object; `crate::recipes` established the JSON-string convention).
 * @param {Uint8Array | number[]} bytes
 * @returns {string}
 */
export function decode_packet_498_json(bytes) {
    let deferred3_0;
    let deferred3_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.decode_packet_498_json(retptr, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        var ptr2 = r0;
        var len2 = r1;
        if (r3) {
            ptr2 = 0; len2 = 0;
            throw takeFromExternrefTable0(r2);
        }
        deferred3_0 = ptr2;
        deferred3_1 = len2;
        return getStringFromWasm0(ptr2, len2);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred3_0, deferred3_1, 1);
    }
}

/**
 * Wasm boundary: the decoded 578 packet object as JSON.
 * @param {Uint8Array | number[]} bytes
 * @returns {string}
 */
export function decode_packet_578_json(bytes) {
    let deferred3_0;
    let deferred3_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.decode_packet_578_json(retptr, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        var ptr2 = r0;
        var len2 = r1;
        if (r3) {
            ptr2 = 0; len2 = 0;
            throw takeFromExternrefTable0(r2);
        }
        deferred3_0 = ptr2;
        deferred3_1 = len2;
        return getStringFromWasm0(ptr2, len2);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred3_0, deferred3_1, 1);
    }
}

/**
 * Decode a PNG into RGBA. Returns `None` for malformed or unsupported data,
 * in which case the JavaScript caller uses its own decoder.
 * @param {Uint8Array | number[]} bytes
 * @returns {PngImage | undefined}
 */
export function decode_png(bytes) {
    const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_export);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.decode_png(ptr0, len0);
    return ret === 0 ? undefined : PngImage.__wrap(ret);
}

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
 * @param {Uint8Array | number[]} data
 * @param {Uint32Array} out
 * @returns {number}
 */
export function decode_section(data, out) {
    let ptr0, len0, ptr1, len1;
    try {
        ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_export);
        len0 = WASM_VECTOR_LEN;
        ptr1 = passArray32ToWasm0(out, wasm.__wbindgen_export);
        len1 = WASM_VECTOR_LEN;
    } catch (e) {
        if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 4, 4); }
        if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
        throw e;
    }
    const ret = wasm.decode_section(ptr0, len0, ptr1, len1, out);
    return ret >>> 0;
}

/**
 * Decode a slot from bytes
 * @param {Uint8Array | number[]} bytes
 * @returns {any | undefined}
 */
export function decode_slot(bytes) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.decode_slot(retptr, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        if (r2) {
            throw takeFromExternrefTable0(r1);
        }
        return takeFromExternrefTable0(r0);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Decode UTF-8 bytes to a Rust String.
 * Matches JavaScript `TextDecoder` behavior: invalid input → U+FFFD replacement.
 * @param {Uint8Array | number[]} b
 * @returns {string}
 */
export function decode_utf8(b) {
    let deferred2_0;
    let deferred2_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const ptr0 = passArray8ToWasm0(b, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.decode_utf8(retptr, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred2_0 = r0;
        deferred2_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred2_0, deferred2_1, 1);
    }
}

/**
 * Decode UTF-8 bytes in a range.
 * @param {Uint8Array | number[]} b
 * @param {number} start
 * @param {number} end
 * @returns {string}
 */
export function decode_utf8_range(b, start, end) {
    let deferred4_0;
    let deferred4_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val2 = +start;
        const val3 = +end;
        const ptr0 = passArray8ToWasm0(b, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.decode_utf8_range(retptr, ptr0, len0, val2, val3);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred4_0 = r0;
        deferred4_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred4_0, deferred4_1, 1);
    }
}

/**
 * Check if a difficulty allows hostile spawns
 * @param {number} difficulty
 * @returns {boolean}
 */
export function difficulty_allows_hostile_spawns(difficulty) {
    const ret = wasm.difficulty_allows_hostile_spawns(difficulty);
    return ret !== 0;
}

/**
 * Get spawn probability multiplier for difficulty
 * @param {number} difficulty
 * @returns {number}
 */
export function difficulty_spawn_multiplier(difficulty) {
    const ret = wasm.difficulty_spawn_multiplier(difficulty);
    return ret;
}

/**
 * @param {BlockRegistryCore} reg
 * @param {number} state
 * @param {number} below
 * @param {number} above
 * @returns {string}
 */
export function door_props_wasm(reg, state, below, above) {
    let deferred1_0;
    let deferred1_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        _assertClass(reg, BlockRegistryCore);
        wasm.door_props_wasm(retptr, reg.__wbg_ptr, state, below, above);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred1_0 = r0;
        deferred1_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
    }
}

/**
 * `dragonCorpseMatrix(e, partial)` - Calculate the corpse transformation matrix.
 * `ring` should be a slice of f64 pairs [yaw, y] of length 128 (64 entries).
 * @param {number} yaw
 * @param {number} y
 * @param {Float64Array | number[]} ring
 * @param {number} ring_idx
 * @param {boolean} dead
 * @param {number} partial
 * @returns {Float32Array}
 */
export function dragon_corpse_matrix(yaw, y, ring, ring_idx, dead, partial) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val2 = +yaw;
        const val3 = +y;
        const val4 = +ring_idx;
        const val5 = +dead;
        const val6 = +partial;
        const ptr0 = passArrayF64ToWasm0(ring, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.dragon_corpse_matrix(retptr, val2, val3, ptr0, len0, val4, val5, val6);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v7 = getArrayF32FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v7;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * `dragonDeathRays(e, partial)` - Ender dragon death ray geometry.
 * `ring` should be a slice of f64 pairs [yaw, y] of length 128 (64 entries).
 *
 * Returns a `Vec<f32>` with stride 9 (x, y, z, u, v, r, g, b, a).
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} yaw
 * @param {number} death_time
 * @param {Float64Array | number[]} ring
 * @param {number} ring_idx
 * @param {boolean} dead
 * @param {number} partial
 * @returns {Float32Array}
 */
export function dragon_death_rays(x, y, z, yaw, death_time, ring, ring_idx, dead, partial) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val2 = +x;
        const val3 = +y;
        const val4 = +z;
        const val5 = +yaw;
        const val6 = +death_time;
        const val7 = +ring_idx;
        const val8 = +dead;
        const val9 = +partial;
        const ptr0 = passArrayF64ToWasm0(ring, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.dragon_death_rays(retptr, val2, val3, val4, val5, val6, ptr0, len0, val7, val8, val9);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v10 = getArrayF32FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v10;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Ender dragon part hitboxes (returns array of [id, name_idx, x, y, z, width, height]).
 * @param {number} entity_id
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} yaw
 * @param {Float64Array | number[]} ring
 * @param {number} ring_idx
 * @param {boolean} dead
 * @param {number} _anim_time
 * @param {number} _prev_anim_time
 * @returns {Float64Array}
 */
export function dragon_parts(entity_id, x, y, z, yaw, ring, ring_idx, dead, _anim_time, _prev_anim_time) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val2 = +entity_id;
        const val3 = +x;
        const val4 = +y;
        const val5 = +z;
        const val6 = +yaw;
        const val7 = +ring_idx;
        const val8 = +dead;
        const val9 = +_anim_time;
        const val10 = +_prev_anim_time;
        const ptr0 = passArrayF64ToWasm0(ring, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.dragon_parts(retptr, val2, val3, val4, val5, val6, ptr0, len0, val7, val8, val9, val10);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v11 = getArrayF64FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 8, 8);
        return v11;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Get the dye color RGB value for a color index (0-15).
 * @param {number} color_index
 * @returns {number}
 */
export function dye_color_rgb(color_index) {
    const ret = wasm.dye_color_rgb(color_index);
    return ret >>> 0;
}

/**
 * @param {Uint8Array | number[]} bytes
 * @returns {string}
 */
export function encode_base64(bytes) {
    let deferred2_0;
    let deferred2_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.encode_base64(retptr, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred2_0 = r0;
        deferred2_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred2_0, deferred2_1, 1);
    }
}

/**
 * Encode 8-bit RGBA pixels as a PNG (filter 0 on every row).
 * @param {number} width
 * @param {number} height
 * @param {Uint8Array | number[]} rgba
 * @returns {Uint8Array | undefined}
 */
export function encode_png(width, height, rgba) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val2 = +width;
        const val3 = +height;
        const ptr0 = passArray8ToWasm0(rgba, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.encode_png(retptr, val2, val3, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        let v4;
        if (r0 !== 0) {
            v4 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export3(r0, r1 * 1, 1);
        }
        return v4;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Encode a slot (item) - simplified version
 * @param {number} item_id
 * @param {number} count
 * @param {Uint8Array | number[] | null} [nbt_data]
 * @returns {Uint8Array}
 */
export function encode_slot(item_id, count, nbt_data) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val2 = +item_id;
        const val3 = +count;
        var ptr0 = isLikeNone(nbt_data) ? 0 : passArray8ToWasm0(nbt_data, wasm.__wbindgen_export);
        var len0 = WASM_VECTOR_LEN;
        wasm.encode_slot(retptr, val2, val3, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v4 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 1, 1);
        return v4;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Encode a Rust &str to UTF-8 bytes.
 * Matches JavaScript `TextEncoder` behavior: lone surrogates encode as U+FFFD.
 * @param {string} s
 * @returns {Uint8Array}
 */
export function encode_utf8(s) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const ptr0 = passStringToWasm0(s, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.encode_utf8(retptr, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v2 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 1, 1);
        return v2;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Generate entity effect particles for a given effect type.
 * This is a higher-level helper that creates particle data for JS rendering.
 *
 * Returns a JSON string containing particle data, or empty string on failure.
 * @param {number} entity_x
 * @param {number} entity_y
 * @param {number} entity_z
 * @param {number} entity_width
 * @param {number} entity_height
 * @param {EntityEffectType} effect_type
 * @param {number} amplifier
 * @param {number} age
 * @param {bigint | null} [rng_seed]
 * @returns {string}
 */
export function entity_effect_particles(entity_x, entity_y, entity_z, entity_width, entity_height, effect_type, amplifier, age, rng_seed) {
    let deferred1_0;
    let deferred1_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.entity_effect_particles(retptr, entity_x, entity_y, entity_z, entity_width, entity_height, effect_type, amplifier, age, !isLikeNone(rng_seed), isLikeNone(rng_seed) ? BigInt(0) : rng_seed);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred1_0 = r0;
        deferred1_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
    }
}

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
 * @param {string} entities_json
 * @param {number} view_yaw
 * @param {number} fire0_u0
 * @param {number} fire0_v0
 * @param {number} fire0_u1
 * @param {number} fire0_v1
 * @param {number} fire1_u0
 * @param {number} fire1_v0
 * @param {number} fire1_u1
 * @param {number} fire1_v1
 * @param {number} _ticks
 * @returns {FireGeometryResult}
 */
export function entity_fire_geometry(entities_json, view_yaw, fire0_u0, fire0_v0, fire0_u1, fire0_v1, fire1_u0, fire1_v0, fire1_u1, fire1_v1, _ticks) {
    const val2 = +view_yaw;
    const val3 = +fire0_u0;
    const val4 = +fire0_v0;
    const val5 = +fire0_u1;
    const val6 = +fire0_v1;
    const val7 = +fire1_u0;
    const val8 = +fire1_v0;
    const val9 = +fire1_u1;
    const val10 = +fire1_v1;
    const val11 = +_ticks;
    const ptr0 = passStringToWasm0(entities_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.entity_fire_geometry(ptr0, len0, val2, val3, val4, val5, val6, val7, val8, val9, val10, val11);
    return FireGeometryResult.__wrap(ret);
}

/**
 * Calculate glowing effect outline vertices for an entity.
 * Returns a JSON string with vertex data for rendering the glowing outline,
 * or empty string on failure.
 *
 * The glowing effect renders as a slightly scaled version of the entity model
 * with a pulsing outline color. This function generates the vertex positions
 * for a simple box outline around the entity bounds.
 * @param {number} entity_x
 * @param {number} entity_y
 * @param {number} entity_z
 * @param {number} entity_width
 * @param {number} entity_height
 * @param {number} entity_eye_height
 * @param {number} age
 * @returns {string}
 */
export function entity_glow_vertices(entity_x, entity_y, entity_z, entity_width, entity_height, entity_eye_height, age) {
    let deferred1_0;
    let deferred1_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.entity_glow_vertices(retptr, entity_x, entity_y, entity_z, entity_width, entity_height, entity_eye_height, age);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred1_0 = r0;
        deferred1_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
    }
}

/**
 * Check if an entity should render fire (ported from `EntityFire.burning`).
 * @param {FireEntity} entity
 * @returns {boolean}
 */
export function entity_should_burn(entity) {
    _assertClass(entity, FireEntity);
    const ret = wasm.entity_should_burn(entity.__wbg_ptr);
    return ret !== 0;
}

/**
 * Attempt to place the falling block at the given position.
 *
 * Returns `true` if placement succeeded (block was air/replaceable),
 * `false` if the position is occupied by a non-replaceable block.
 * @param {WorldCore} world
 * @param {BlockRegistryCore} registry
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} block_state
 * @returns {boolean}
 */
export function falling_block_land(world, registry, x, y, z, block_state) {
    _assertClass(world, WorldCore);
    _assertClass(registry, BlockRegistryCore);
    const ret = wasm.falling_block_land(world.__wbg_ptr, registry.__wbg_ptr, x, y, z, block_state);
    return ret !== 0;
}

/**
 * Core falling-block physics step without entity state mutation.
 *
 * Given a position, motion, and world, returns the new position, new motion,
 * and whether the block landed.
 *
 * This is the pure function form used for server-side simulation or testing.
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} motion_x
 * @param {number} motion_y
 * @param {number} motion_z
 * @param {number} block_state
 * @param {boolean} no_gravity
 * @param {WorldCore} world
 * @param {BlockRegistryCore} registry
 * @returns {Float64Array}
 */
export function falling_block_physics(x, y, z, motion_x, motion_y, motion_z, block_state, no_gravity, world, registry) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        _assertClass(world, WorldCore);
        _assertClass(registry, BlockRegistryCore);
        wasm.falling_block_physics(retptr, x, y, z, motion_x, motion_y, motion_z, block_state, no_gravity, world.__wbg_ptr, registry.__wbg_ptr);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayF64FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 8, 8);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

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
 * @param {number} fire0_u0
 * @param {number} fire0_v0
 * @param {number} fire0_u1
 * @param {number} fire0_v1
 * @param {number} fire1_u0
 * @param {number} fire1_v0
 * @param {number} fire1_u1
 * @param {number} fire1_v1
 * @param {number} _ticks
 * @returns {FireOverlayGeometryResult}
 */
export function fire_overlay_geometry(fire0_u0, fire0_v0, fire0_u1, fire0_v1, fire1_u0, fire1_v0, fire1_u1, fire1_v1, _ticks) {
    const ret = wasm.fire_overlay_geometry(fire0_u0, fire0_v0, fire0_u1, fire0_v1, fire1_u0, fire1_v0, fire1_u1, fire1_v1, _ticks);
    return FireOverlayGeometryResult.__wrap(ret);
}

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
 * @param {number} width
 * @param {number} height
 * @returns {Float32Array}
 */
export function fire_overlay_projection(width, height) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.fire_overlay_projection(retptr, width, height);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayF32FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * JS: `const fishPattern = e => Math.min(5, ((e.fishVariant || 0) >>> 8) & 255) + 1;`
 * (`>>>` is an unsigned shift, so the variant is treated as u32 here.)
 * @param {number} fish_variant
 * @returns {number}
 */
export function fish_pattern(fish_variant) {
    const ret = wasm.fish_pattern(fish_variant);
    return ret;
}

/**
 * JS: `const fishShape = e => ((e.fishVariant || 0) & 255) === 1 ? 1 : 0;`
 * @param {number} fish_variant
 * @returns {number}
 */
export function fish_shape(fish_variant) {
    const ret = wasm.fish_shape(fish_variant);
    return ret;
}

/**
 * `fluidHeightAt` after the caller has looked up the cell above.
 * @param {boolean} above_same_fluid
 * @param {number} height
 * @returns {number}
 */
export function fluid_height(above_same_fluid, height) {
    const ret = wasm.fluid_height(above_same_fluid, height);
    return ret;
}

/**
 * `getFluidState` with the block registry facts passed in explicitly.
 * @param {boolean} is_liquid
 * @param {boolean} is_lava
 * @param {number} level
 * @param {boolean} waterlogged
 * @param {boolean} is_water_plant
 * @returns {FluidState | undefined}
 */
export function fluid_state(is_liquid, is_lava, level, waterlogged, is_water_plant) {
    const ret = wasm.fluid_state(is_liquid, is_lava, level, waterlogged, is_water_plant);
    return ret === 0 ? undefined : FluidState.__wrap(ret);
}

/**
 * @param {string} name
 * @param {number} temperature
 * @param {number} rainfall
 * @param {number} y
 * @param {Uint8Array | number[]} map
 * @returns {number}
 */
export function foliage_color(name, temperature, rainfall, y, map) {
    const val3 = +temperature;
    const val4 = +rainfall;
    const val5 = +y;
    let ptr0, len0, ptr1, len1;
    try {
        ptr0 = passStringToWasm0(name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        len0 = WASM_VECTOR_LEN;
        ptr1 = passArray8ToWasm0(map, wasm.__wbindgen_export);
        len1 = WASM_VECTOR_LEN;
    } catch (e) {
        if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
        if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
        throw e;
    }
    const ret = wasm.foliage_color(ptr0, len0, val3, val4, val5, ptr1, len1);
    return ret >>> 0;
}

/**
 * `formatAddress(host, port)`.
 * @param {string} host
 * @param {number | null} [port]
 * @returns {string}
 */
export function format_address(host, port) {
    let deferred3_0;
    let deferred3_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val2 = +(isLikeNone(port) ? Number.MAX_SAFE_INTEGER : (port) >>> 0);
        const ptr0 = passStringToWasm0(host, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.format_address(retptr, ptr0, len0, val2);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred3_0 = r0;
        deferred3_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred3_0, deferred3_1, 1);
    }
}

/**
 * Fox AI tick - main behavior update.
 * Returns FoxAITickResult with new behavior state and target.
 * @param {FoxState} fox_state
 * @param {number} fox_x
 * @param {number} _fox_y
 * @param {number} fox_z
 * @param {boolean} _on_ground
 * @param {number} time_of_day
 * @param {number} sky_light
 * @param {number} block_light
 * @param {boolean} is_raining
 * @param {Float64Array | number[]} prey_entities
 * @param {Float64Array | number[]} predator_entities
 * @param {Float64Array | number[]} player_entities
 * @param {Float64Array | number[]} food_items
 * @param {Float64Array | number[]} breeding_partners
 * @returns {FoxAITickResult}
 */
export function fox_ai_tick(fox_state, fox_x, _fox_y, fox_z, _on_ground, time_of_day, sky_light, block_light, is_raining, prey_entities, predator_entities, player_entities, food_items, breeding_partners) {
    _assertClass(fox_state, FoxState);
    const val6 = +fox_x;
    const val7 = +_fox_y;
    const val8 = +fox_z;
    const val9 = +_on_ground;
    const val10 = +time_of_day;
    const val11 = +sky_light;
    const val12 = +block_light;
    const val13 = +is_raining;
    let ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4;
    try {
        ptr0 = passArrayF64ToWasm0(prey_entities, wasm.__wbindgen_export);
        len0 = WASM_VECTOR_LEN;
        ptr1 = passArrayF64ToWasm0(predator_entities, wasm.__wbindgen_export);
        len1 = WASM_VECTOR_LEN;
        ptr2 = passArrayF64ToWasm0(player_entities, wasm.__wbindgen_export);
        len2 = WASM_VECTOR_LEN;
        ptr3 = passArrayF64ToWasm0(food_items, wasm.__wbindgen_export);
        len3 = WASM_VECTOR_LEN;
        ptr4 = passArrayF64ToWasm0(breeding_partners, wasm.__wbindgen_export);
        len4 = WASM_VECTOR_LEN;
    } catch (e) {
        if (ptr4) { wasm.__wbindgen_export3(ptr4, len4 * 8, 8); }
        if (ptr3) { wasm.__wbindgen_export3(ptr3, len3 * 8, 8); }
        if (ptr2) { wasm.__wbindgen_export3(ptr2, len2 * 8, 8); }
        if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 8, 8); }
        if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 8, 8); }
        throw e;
    }
    const ret = wasm.fox_ai_tick(fox_state.__wbg_ptr, val6, val7, val8, val9, val10, val11, val12, val13, ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4);
    return FoxAITickResult.__wrap(ret);
}

/**
 * Get fox animation args from a JSON entity object (standalone, matches `foxAnimationArgs(e, partial)`).
 * @param {string} entity_json
 * @param {number} partial
 * @returns {string}
 */
export function fox_animation_args(entity_json, partial) {
    let deferred3_0;
    let deferred3_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val2 = +partial;
        const ptr0 = passStringToWasm0(entity_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.fox_animation_args(retptr, ptr0, len0, val2);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred3_0 = r0;
        deferred3_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred3_0, deferred3_1, 1);
    }
}

/**
 * Check if fox can breed with another fox.
 * Returns true if breeding conditions met.
 * @param {number} fox_age
 * @param {number} partner_age
 * @param {boolean} fox_has_food
 * @param {boolean} partner_has_food
 * @param {number} distance_sq
 * @param {boolean} both_trust_player
 * @returns {boolean}
 */
export function fox_can_breed(fox_age, partner_age, fox_has_food, partner_has_food, distance_sq, both_trust_player) {
    const ret = wasm.fox_can_breed(fox_age, partner_age, fox_has_food, partner_has_food, distance_sq, both_trust_player);
    return ret !== 0;
}

/**
 * Check if fox can navigate to position (simplified pathfind check).
 * Returns true if path seems clear.
 * @param {number} start_x
 * @param {number} start_y
 * @param {number} start_z
 * @param {number} target_x
 * @param {number} target_y
 * @param {number} target_z
 * @returns {boolean}
 */
export function fox_can_navigate(start_x, start_y, start_z, target_x, target_y, target_z) {
    const ret = wasm.fox_can_navigate(start_x, start_y, start_z, target_x, target_y, target_z);
    return ret !== 0;
}

/**
 * Calculate flee velocity from a threat.
 * Returns [motion_x, motion_y, motion_z].
 * @param {number} fox_x
 * @param {number} _fox_y
 * @param {number} fox_z
 * @param {number} threat_x
 * @param {number} _threat_y
 * @param {number} threat_z
 * @param {number} speed
 * @returns {Float64Array}
 */
export function fox_flee(fox_x, _fox_y, fox_z, threat_x, _threat_y, threat_z, speed) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.fox_flee(retptr, fox_x, _fox_y, fox_z, threat_x, _threat_y, threat_z, speed);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayF64FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 8, 8);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Check if fox is holding an item in its mouth.
 * Returns item ID or -1 if not holding.
 * @param {string} entity_json
 * @returns {number}
 */
export function fox_held_item(entity_json) {
    const ptr0 = passStringToWasm0(entity_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.fox_held_item(ptr0, len0);
    return ret;
}

/**
 * Calculate movement vector towards a target.
 * Returns [move_x, move_z] normalized * speed.
 * @param {number} fox_x
 * @param {number} fox_z
 * @param {number} target_x
 * @param {number} target_z
 * @param {number} speed
 * @returns {Float64Array}
 */
export function fox_move_towards(fox_x, fox_z, target_x, target_z, speed) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.fox_move_towards(retptr, fox_x, fox_z, target_x, target_z, speed);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayF64FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 8, 8);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * `animateFox`: 33 values in a fixed order — body(rx,ry,py,pz,rz),
 * tail(rx,pz), head(rx,ry,rz,px,py,pz), then legs rightHind, leftHind,
 * rightFront, leftFront with (rx,rz,py,pz,visible).
 * @param {number} ls
 * @param {number} lsa
 * @param {number} head_roll
 * @param {boolean} crouching
 * @param {number} crouch_amount
 * @param {boolean} sleeping
 * @param {boolean} child
 * @param {boolean} sitting
 * @param {number} pitch
 * @param {number} yaw
 * @param {number} age
 * @param {boolean} faceplanted
 * @returns {Float64Array}
 */
export function fox_pose(ls, lsa, head_roll, crouching, crouch_amount, sleeping, child, sitting, pitch, yaw, age, faceplanted) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.fox_pose(retptr, ls, lsa, head_roll, crouching, crouch_amount, sleeping, child, sitting, pitch, yaw, age, faceplanted);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayF64FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 8, 8);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Calculate pounce velocity for fox hunting.
 * Returns [motion_x, motion_y, motion_z] or [0,0,0] if can't pounce.
 * @param {number} fox_x
 * @param {number} fox_y
 * @param {number} fox_z
 * @param {number} target_x
 * @param {number} target_y
 * @param {number} target_z
 * @param {boolean} on_ground
 * @returns {Float64Array}
 */
export function fox_pounce(fox_x, fox_y, fox_z, target_x, target_y, target_z, on_ground) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.fox_pounce(retptr, fox_x, fox_y, fox_z, target_x, target_y, target_z, on_ground);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayF64FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 8, 8);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * `scaleFoxChild`: head scale/position and body scale/position.
 * @param {boolean} child
 * @returns {Float64Array}
 */
export function fox_scale(child) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.fox_scale(retptr, child);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayF64FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 8, 8);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Select the best target for a fox based on its state and surroundings.
 * Returns a FoxTargetResult (valid=false if no target found - JS fallback).
 * @param {number} fox_x
 * @param {number} fox_y
 * @param {number} fox_z
 * @param {FoxState} fox_state
 * @param {Float64Array | number[]} prey_entities
 * @param {Float64Array | number[]} predator_entities
 * @param {Float64Array | number[]} player_entities
 * @param {Float64Array | number[]} food_items
 * @param {Float64Array | number[]} breeding_partners
 * @returns {FoxTargetResult}
 */
export function fox_select_target(fox_x, fox_y, fox_z, fox_state, prey_entities, predator_entities, player_entities, food_items, breeding_partners) {
    _assertClass(fox_state, FoxState);
    const val6 = +fox_x;
    const val7 = +fox_y;
    const val8 = +fox_z;
    let ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4;
    try {
        ptr0 = passArrayF64ToWasm0(prey_entities, wasm.__wbindgen_export);
        len0 = WASM_VECTOR_LEN;
        ptr1 = passArrayF64ToWasm0(predator_entities, wasm.__wbindgen_export);
        len1 = WASM_VECTOR_LEN;
        ptr2 = passArrayF64ToWasm0(player_entities, wasm.__wbindgen_export);
        len2 = WASM_VECTOR_LEN;
        ptr3 = passArrayF64ToWasm0(food_items, wasm.__wbindgen_export);
        len3 = WASM_VECTOR_LEN;
        ptr4 = passArrayF64ToWasm0(breeding_partners, wasm.__wbindgen_export);
        len4 = WASM_VECTOR_LEN;
    } catch (e) {
        if (ptr4) { wasm.__wbindgen_export3(ptr4, len4 * 8, 8); }
        if (ptr3) { wasm.__wbindgen_export3(ptr3, len3 * 8, 8); }
        if (ptr2) { wasm.__wbindgen_export3(ptr2, len2 * 8, 8); }
        if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 8, 8); }
        if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 8, 8); }
        throw e;
    }
    const ret = wasm.fox_select_target(val6, val7, val8, fox_state.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4);
    return FoxTargetResult.__wrap(ret);
}

/**
 * Set item held by fox.
 * @param {string} entity_json
 * @param {number} item_id
 * @returns {string}
 */
export function fox_set_held_item(entity_json, item_id) {
    let deferred3_0;
    let deferred3_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val2 = +item_id;
        const ptr0 = passStringToWasm0(entity_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.fox_set_held_item(retptr, ptr0, len0, val2);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred3_0 = r0;
        deferred3_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred3_0, deferred3_1, 1);
    }
}

/**
 * Determine if fox should sleep based on time and conditions.
 * Returns true if fox should start sleeping.
 * @param {number} time_of_day
 * @param {number} _fox_y
 * @param {number} sky_light
 * @param {number} block_light
 * @param {boolean} is_raining
 * @param {boolean} has_predator_nearby
 * @param {boolean} is_sitting
 * @returns {boolean}
 */
export function fox_should_sleep(time_of_day, _fox_y, sky_light, block_light, is_raining, has_predator_nearby, is_sitting) {
    const ret = wasm.fox_should_sleep(time_of_day, _fox_y, sky_light, block_light, is_raining, has_predator_nearby, is_sitting);
    return ret !== 0;
}

/**
 * Determine if fox should wake up.
 * Returns true if fox should stop sleeping.
 * @param {number} time_of_day
 * @param {number} sky_light
 * @param {number} block_light
 * @param {boolean} is_raining
 * @param {boolean} has_predator_nearby
 * @param {boolean} player_nearby
 * @param {boolean} trusted_player_nearby
 * @returns {boolean}
 */
export function fox_should_wake(time_of_day, sky_light, block_light, is_raining, has_predator_nearby, player_nearby, trusted_player_nearby) {
    const ret = wasm.fox_should_wake(time_of_day, sky_light, block_light, is_raining, has_predator_nearby, player_nearby, trusted_player_nearby);
    return ret !== 0;
}

/**
 * Determine if fox should play a sound this tick.
 * Returns the sound to play, or None.
 * @param {FoxState} fox_state
 * @param {FoxState} prev_state
 * @param {number} random
 * @returns {FoxSound}
 */
export function fox_sound_trigger(fox_state, prev_state, random) {
    _assertClass(fox_state, FoxState);
    _assertClass(prev_state, FoxState);
    const ret = wasm.fox_sound_trigger(fox_state.__wbg_ptr, prev_state.__wbg_ptr, random);
    return ret;
}

/**
 * Update trust/owner system for fox.
 * Returns new trust UUID pair.
 * @param {bigint} current_trusted_0
 * @param {bigint} current_trusted_1
 * @param {bigint} player_uuid_0
 * @param {bigint} player_uuid_1
 * @param {boolean} player_fed_fox
 * @param {boolean} player_attacked_fox
 * @returns {FoxTrustPair}
 */
export function fox_update_trust(current_trusted_0, current_trusted_1, player_uuid_0, player_uuid_1, player_fed_fox, player_attacked_fox) {
    const ret = wasm.fox_update_trust(current_trusted_0, current_trusted_1, player_uuid_0, player_uuid_1, player_fed_fox, player_attacked_fox);
    return FoxTrustPair.__wrap(ret);
}

/**
 * Get the bed facing direction from a block state.
 * @param {string} block_name
 * @param {string} facing_prop
 * @returns {BedFacing | undefined}
 */
export function get_bed_facing(block_name, facing_prop) {
    let ptr0, len0, ptr1, len1;
    try {
        ptr0 = passStringToWasm0(block_name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        len0 = WASM_VECTOR_LEN;
        ptr1 = passStringToWasm0(facing_prop, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        len1 = WASM_VECTOR_LEN;
    } catch (e) {
        if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
        if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
        throw e;
    }
    const ret = wasm.get_bed_facing(ptr0, len0, ptr1, len1);
    return ret === 1 ? undefined : ret;
}

/**
 * @param {Uint8Array | number[]} light
 * @param {number} index
 * @returns {number}
 */
export function get_block_light(light, index) {
    const val2 = +index;
    const ptr0 = passArray8ToWasm0(light, wasm.__wbindgen_export);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_block_light(ptr0, len0, val2);
    return ret;
}

/**
 * Get block model for a tile entity type.
 * Returns a JSON string representing the model parts, or "null" on failure.
 * @param {string} tile_type
 * @param {string} props_json
 * @returns {string}
 */
export function get_block_model_json(tile_type, props_json) {
    let deferred3_0;
    let deferred3_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        let ptr0, len0, ptr1, len1;
        try {
            ptr0 = passStringToWasm0(tile_type, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passStringToWasm0(props_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len1 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
            throw e;
        }
        wasm.get_block_model_json(retptr, ptr0, len0, ptr1, len1);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred3_0 = r0;
        deferred3_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred3_0, deferred3_1, 1);
    }
}

/**
 * Get day phase name
 * @param {bigint} time_of_day
 * @returns {string}
 */
export function get_day_phase(time_of_day) {
    let deferred1_0;
    let deferred1_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.get_day_phase(retptr, time_of_day);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred1_0 = r0;
        deferred1_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
    }
}

/**
 * Get mob spawn cap for category
 * @param {string} category
 * @param {number} difficulty
 * @param {number} total_players
 * @returns {number}
 */
export function get_mob_cap(category, difficulty, total_players) {
    const val2 = +difficulty;
    const val3 = +total_players;
    const ptr0 = passStringToWasm0(category, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_mob_cap(ptr0, len0, val2, val3);
    return ret >>> 0;
}

/**
 * Helper to get packet ID by name for a given protocol version
 * @param {string} name
 * @param {number} protocol_version
 * @param {boolean} clientbound
 * @returns {number | undefined}
 */
export function get_packet_id(name, protocol_version, clientbound) {
    const val2 = +protocol_version;
    const val3 = +clientbound;
    const ptr0 = passStringToWasm0(name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_packet_id(ptr0, len0, val2, val3);
    return ret === Number.MAX_SAFE_INTEGER ? undefined : ret;
}

/**
 * Helper to get packet name by ID for a given protocol version
 * @param {number} id
 * @param {number} protocol_version
 * @param {boolean} clientbound
 * @returns {string | undefined}
 */
export function get_packet_name(id, protocol_version, clientbound) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.get_packet_name(retptr, id, protocol_version, clientbound);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        let v1;
        if (r0 !== 0) {
            v1 = getStringFromWasm0(r0, r1);
            wasm.__wbindgen_export3(r0, r1 * 1, 1);
        }
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * `Section.getSky(i)` (nibble order: low nibble is the even index).
 * @param {Uint8Array | number[]} light
 * @param {number} index
 * @returns {number}
 */
export function get_sky_light(light, index) {
    const val2 = +index;
    const ptr0 = passArray8ToWasm0(light, wasm.__wbindgen_export);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_sky_light(ptr0, len0, val2);
    return ret;
}

/**
 * Get spawn weight for biome/mob combination
 * @param {string} biome
 * @param {string} mob_type
 * @returns {number}
 */
export function get_spawn_weight(biome, mob_type) {
    let ptr0, len0, ptr1, len1;
    try {
        ptr0 = passStringToWasm0(biome, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        len0 = WASM_VECTOR_LEN;
        ptr1 = passStringToWasm0(mob_type, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        len1 = WASM_VECTOR_LEN;
    } catch (e) {
        if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
        if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
        throw e;
    }
    const ret = wasm.get_spawn_weight(ptr0, len0, ptr1, len1);
    return ret >>> 0;
}

/**
 * Get a statistic value.
 * @param {string} stats_json
 * @param {string} name
 * @returns {bigint}
 */
export function get_statistic(stats_json, name) {
    let ptr0, len0, ptr1, len1;
    try {
        ptr0 = passStringToWasm0(stats_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        len0 = WASM_VECTOR_LEN;
        ptr1 = passStringToWasm0(name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        len1 = WASM_VECTOR_LEN;
    } catch (e) {
        if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
        if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
        throw e;
    }
    const ret = wasm.get_statistic(ptr0, len0, ptr1, len1);
    return ret;
}

/**
 * Get recipe count
 * @param {RecipeBookState} recipe_book
 * @returns {number}
 */
export function get_unlocked_count(recipe_book) {
    _assertClass(recipe_book, RecipeBookState);
    const ret = wasm.get_unlocked_count(recipe_book.__wbg_ptr);
    return ret >>> 0;
}

/**
 * @param {string} expression
 * @param {string} macros_json
 * @returns {number}
 */
export function glsl_condition_wasm(expression, macros_json) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        let ptr0, len0, ptr1, len1;
        try {
            ptr0 = passStringToWasm0(expression, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passStringToWasm0(macros_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len1 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
            throw e;
        }
        wasm.glsl_condition_wasm(retptr, ptr0, len0, ptr1, len1);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        if (r2) {
            throw takeFromExternrefTable0(r1);
        }
        return r0;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * @param {string} source
 * @returns {string}
 */
export function glsl_float_literals_wasm(source) {
    let deferred2_0;
    let deferred2_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const ptr0 = passStringToWasm0(source, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.glsl_float_literals_wasm(retptr, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred2_0 = r0;
        deferred2_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred2_0, deferred2_1, 1);
    }
}

/**
 * @param {string} name
 * @param {number} temperature
 * @param {number} rainfall
 * @param {number} y
 * @param {Uint8Array | number[]} map
 * @returns {number}
 */
export function grass_color(name, temperature, rainfall, y, map) {
    const val3 = +temperature;
    const val4 = +rainfall;
    const val5 = +y;
    let ptr0, len0, ptr1, len1;
    try {
        ptr0 = passStringToWasm0(name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        len0 = WASM_VECTOR_LEN;
        ptr1 = passArray8ToWasm0(map, wasm.__wbindgen_export);
        len1 = WASM_VECTOR_LEN;
    } catch (e) {
        if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
        if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
        throw e;
    }
    const ret = wasm.grass_color(ptr0, len0, val3, val4, val5, ptr1, len1);
    return ret >>> 0;
}

/**
 * `guardianBeam(start, end, age, ticks, charge)` - Guardian laser beam.
 * Two rotating crossed planes plus alternating end cap.
 * Attack charge changes the beam colour.
 *
 * Returns a `Vec<f32>` with stride 9 (x, y, z, u, v, r, g, b, a).
 * @param {Float32Array | number[]} start
 * @param {Float32Array | number[]} end
 * @param {number} age
 * @param {number} ticks
 * @param {number} charge
 * @returns {Float32Array}
 */
export function guardian_beam(start, end, age, ticks, charge) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val3 = +age;
        const val4 = +ticks;
        const val5 = +charge;
        let ptr0, len0, ptr1, len1;
        try {
            ptr0 = passArrayF32ToWasm0(start, wasm.__wbindgen_export);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passArrayF32ToWasm0(end, wasm.__wbindgen_export);
            len1 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 4, 4); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 4, 4); }
            throw e;
        }
        wasm.guardian_beam(retptr, ptr0, len0, ptr1, len1, val3, val4, val5);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v6 = getArrayF32FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v6;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * `hangingBox` for paintings: `[minX, minY, minZ, maxX, maxY, maxZ]`.
 * @param {number} hx
 * @param {number} hy
 * @param {number} hz
 * @param {number} facing
 * @param {number} w_px
 * @param {number} h_px
 * @returns {Float64Array}
 */
export function hanging_box(hx, hy, hz, facing, w_px, h_px) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.hanging_box(retptr, hx, hy, hz, facing, w_px, h_px);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayF64FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 8, 8);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * @param {string} name
 * @returns {boolean}
 */
export function has_jar_model(name) {
    const ptr0 = passStringToWasm0(name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.has_jar_model(ptr0, len0);
    return ret !== 0;
}

/**
 * Horse jump power calculation
 * @param {number} p
 * @returns {number}
 */
export function horse_jump_power(p) {
    const ret = wasm.horse_jump_power(p);
    return ret;
}

/**
 * @param {number} cur_damage
 * @param {number} rel_hardness
 * @returns {number}
 */
export function interaction_block_break_progress(cur_damage, rel_hardness) {
    const ret = wasm.interaction_block_break_progress(cur_damage, rel_hardness);
    return ret;
}

/**
 * @param {number} attack_speed
 * @returns {number}
 */
export function interaction_cooldown_period(attack_speed) {
    const ret = wasm.interaction_cooldown_period(attack_speed);
    return ret;
}

/**
 * @param {number} ticks
 * @param {number} attack_speed
 * @param {number} adjust
 * @returns {number}
 */
export function interaction_cooled_attack_strength(ticks, attack_speed, adjust) {
    const ret = wasm.interaction_cooled_attack_strength(ticks, attack_speed, adjust);
    return ret;
}

/**
 * Entity interpolation: `interp(e, partial)` → `{x, y, z}`.
 * @param {number} prev_x
 * @param {number} prev_y
 * @param {number} prev_z
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} partial
 * @returns {Float64Array}
 */
export function interpolate_position(prev_x, prev_y, prev_z, x, y, z, partial) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.interpolate_position(retptr, prev_x, prev_y, prev_z, x, y, z, partial);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayF64FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 8, 8);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Check if it's day time (sun above horizon)
 * @param {bigint} time_of_day
 * @returns {boolean}
 */
export function is_day_time(time_of_day) {
    const ret = wasm.is_day_time(time_of_day);
    return ret !== 0;
}

/**
 * Check if entity is an Ender Dragon (type 63, kind 'mob').
 * @param {string} kind
 * @param {number} type_id
 * @returns {boolean}
 */
export function is_dragon(kind, type_id) {
    const val2 = +type_id;
    const ptr0 = passStringToWasm0(kind, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.is_dragon(ptr0, len0, val2);
    return ret !== 0;
}

/**
 * @param {string} text
 * @returns {boolean}
 */
export function is_eagler_address(text) {
    const ptr0 = passStringToWasm0(text, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.is_eagler_address(ptr0, len0);
    return ret !== 0;
}

/**
 * @param {string} kind
 * @param {string} entity_name
 * @param {string | null} [held_item_name]
 * @returns {boolean}
 */
export function is_interactive_entity(kind, entity_name, held_item_name) {
    let ptr0, len0, ptr1, len1, ptr2, len2;
    try {
        ptr0 = passStringToWasm0(kind, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        len0 = WASM_VECTOR_LEN;
        ptr1 = passStringToWasm0(entity_name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        len1 = WASM_VECTOR_LEN;
        ptr2 = isLikeNone(held_item_name) ? 0 : passStringToWasm0(held_item_name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        len2 = WASM_VECTOR_LEN;
    } catch (e) {
        if (ptr2) { wasm.__wbindgen_export3(ptr2, len2 * 1, 1); }
        if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
        if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
        throw e;
    }
    const ret = wasm.is_interactive_entity(ptr0, len0, ptr1, len1, ptr2, len2);
    return ret !== 0;
}

/**
 * @param {string} name
 * @returns {boolean}
 */
export function is_lighting_option_wasm(name) {
    const ptr0 = passStringToWasm0(name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.is_lighting_option_wasm(ptr0, len0);
    return ret !== 0;
}

/**
 * Check if it's night time (hostile mobs can spawn)
 * @param {bigint} time_of_day
 * @returns {boolean}
 */
export function is_night_time(time_of_day) {
    const ret = wasm.is_night_time(time_of_day);
    return ret !== 0;
}

/**
 * Check if recipe is highlighted (can be crafted)
 * @param {RecipeBookState} recipe_book
 * @param {string} recipe_id
 * @returns {boolean}
 */
export function is_recipe_highlighted(recipe_book, recipe_id) {
    _assertClass(recipe_book, RecipeBookState);
    const ptr0 = passStringToWasm0(recipe_id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.is_recipe_highlighted(recipe_book.__wbg_ptr, ptr0, len0);
    return ret !== 0;
}

/**
 * Check if recipe is unlocked
 * @param {RecipeBookState} recipe_book
 * @param {string} recipe_id
 * @returns {boolean}
 */
export function is_recipe_unlocked(recipe_book, recipe_id) {
    _assertClass(recipe_book, RecipeBookState);
    const ptr0 = passStringToWasm0(recipe_id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.is_recipe_unlocked(recipe_book.__wbg_ptr, ptr0, len0);
    return ret !== 0;
}

/**
 * @param {string} kind
 * @returns {boolean}
 */
export function is_snap_kind(kind) {
    const ptr0 = passStringToWasm0(kind, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.is_snap_kind(ptr0, len0);
    return ret !== 0;
}

/**
 * Check if position is valid for spawning (solid block below, air above)
 * @param {boolean} block_below_solid
 * @param {boolean} block_at_air
 * @param {boolean} block_above_air
 * @returns {boolean}
 */
export function is_valid_spawn_position(block_below_solid, block_at_air, block_above_air) {
    const ret = wasm.is_valid_spawn_position(block_below_solid, block_at_air, block_above_air);
    return ret !== 0;
}

/**
 * `itemFrameBox` for item frames (6-direction facing).
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} face
 * @returns {Float64Array}
 */
export function item_frame_box(x, y, z, face) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.item_frame_box(retptr, x, y, z, face);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayF64FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 8, 8);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * @param {string} item
 * @param {number} damage
 * @returns {string}
 */
export function item_model_name_wasm(item, damage) {
    let deferred3_0;
    let deferred3_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val2 = +damage;
        const ptr0 = passStringToWasm0(item, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.item_model_name_wasm(retptr, ptr0, len0, val2);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred3_0 = r0;
        deferred3_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred3_0, deferred3_1, 1);
    }
}

/**
 * JS: `CATEGORY_OF` (internal in JS, exported here for wasm glue).
 * @param {string} name
 * @returns {string}
 */
export function js_category_of(name) {
    let deferred2_0;
    let deferred2_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.js_category_of(retptr, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred2_0 = r0;
        deferred2_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred2_0, deferred2_1, 1);
    }
}

/**
 * @param {number} pitch
 * @returns {number}
 */
export function js_clamp_pitch(pitch) {
    const ret = wasm.js_clamp_pitch(pitch);
    return ret;
}

/**
 * JS: `EVENT_SOUNDS[effectId]` (internal in JS, exported here for wasm glue).
 * @param {number} id
 * @returns {EventSoundInfo}
 */
export function js_event_sound(id) {
    const ret = wasm.js_event_sound(id);
    return EventSoundInfo.__wrap(ret);
}

/**
 * JS: `GLOBAL_EVENTS[effectId]` (internal in JS, exported here for wasm glue).
 * @param {number} id
 * @returns {string | undefined}
 */
export function js_global_event_sound(id) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.js_global_event_sound(retptr, id);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        let v1;
        if (r0 !== 0) {
            v1 = getStringFromWasm0(r0, r1);
            wasm.__wbindgen_export3(r0, r1 * 1, 1);
        }
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * JS: `HOSTILE_TYPES.has(name)` (internal in JS, exported here for wasm glue).
 * @param {string} name
 * @returns {boolean}
 */
export function js_is_hostile_type(name) {
    const ptr0 = passStringToWasm0(name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.js_is_hostile_type(ptr0, len0);
    return ret !== 0;
}

/**
 * @param {number} volume
 * @returns {number}
 */
export function js_max_distance(volume) {
    const ret = wasm.js_max_distance(volume);
    return ret;
}

/**
 * @param {number} lcg
 * @returns {number}
 */
export function js_mood_lcg_next(lcg) {
    const ret = wasm.js_mood_lcg_next(lcg);
    return ret;
}

/**
 * @param {string} binding
 * @returns {string}
 */
export function js_options_default_key(binding) {
    let deferred2_0;
    let deferred2_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const ptr0 = passStringToWasm0(binding, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.js_options_default_key(retptr, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred2_0 = r0;
        deferred2_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred2_0, deferred2_1, 1);
    }
}

/**
 * @param {number} difficulty
 * @returns {string}
 */
export function js_options_difficulty_name(difficulty) {
    let deferred1_0;
    let deferred1_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.js_options_difficulty_name(retptr, difficulty);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred1_0 = r0;
        deferred1_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @param {number} value
 * @returns {string}
 */
export function js_options_fov_label(value) {
    let deferred1_0;
    let deferred1_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.js_options_fov_label(retptr, value);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred1_0 = r0;
        deferred1_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @param {number} value
 * @returns {string}
 */
export function js_options_gamma_label(value) {
    let deferred1_0;
    let deferred1_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.js_options_gamma_label(retptr, value);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred1_0 = r0;
        deferred1_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @param {number} index
 * @returns {string}
 */
export function js_options_key_binding_category(index) {
    let deferred1_0;
    let deferred1_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.js_options_key_binding_category(retptr, index);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred1_0 = r0;
        deferred1_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @param {number} index
 * @returns {string}
 */
export function js_options_key_binding_description(index) {
    let deferred1_0;
    let deferred1_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.js_options_key_binding_description(retptr, index);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred1_0 = r0;
        deferred1_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @param {number} value
 * @returns {string}
 */
export function js_options_mouse_wheel_label(value) {
    let deferred1_0;
    let deferred1_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.js_options_mouse_wheel_label(retptr, value);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred1_0 = r0;
        deferred1_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @param {number} value
 * @returns {string}
 */
export function js_options_render_distance_label(value) {
    let deferred1_0;
    let deferred1_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.js_options_render_distance_label(retptr, value);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred1_0 = r0;
        deferred1_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
    }
}

/**
 * JS: `export { soundAssetName, soundTypeOf }` (soundAssetName half, for wasm).
 * @param {string} name
 * @returns {string}
 */
export function js_sound_asset_name(name) {
    let deferred2_0;
    let deferred2_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.js_sound_asset_name(retptr, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred2_0 = r0;
        deferred2_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred2_0, deferred2_1, 1);
    }
}

/**
 * @param {number} volume
 * @param {number} def_volume
 * @param {number} category_volume
 * @returns {number}
 */
export function js_voice_volume(volume, def_volume, category_volume) {
    const ret = wasm.js_voice_volume(volume, def_volume, category_volume);
    return ret;
}

/**
 * JS: end-portal texgen exposed to JavaScript.
 * @param {number} frag_x
 * @param {number} frag_y
 * @param {number} target_w
 * @param {number} target_h
 * @param {number} scale
 * @param {number} angle
 * @param {number} off_u
 * @param {number} off_v
 * @returns {Float32Array}
 */
export function js_webgpu_endportal_texgen(frag_x, frag_y, target_w, target_h, scale, angle, off_u, off_v) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.js_webgpu_endportal_texgen(retptr, frag_x, frag_y, target_w, target_h, scale, angle, off_u, off_v);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayF32FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * JS: entity shade term exposed to JavaScript.
 * @param {number} nx
 * @param {number} ny
 * @param {number} nz
 * @param {number} lighting
 * @returns {number}
 */
export function js_webgpu_entity_shade(nx, ny, nz, lighting) {
    const ret = wasm.js_webgpu_entity_shade(nx, ny, nz, lighting);
    return ret;
}

/**
 * JS: WGSL `fogFactor` exposed to JavaScript.
 * @param {number} d
 * @param {Float32Array | number[]} fog
 * @returns {number}
 */
export function js_webgpu_fog_factor(d, fog) {
    const val2 = +d;
    const ptr0 = passArrayF32ToWasm0(fog, wasm.__wbindgen_export);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.js_webgpu_fog_factor(val2, ptr0, len0);
    return ret;
}

/**
 * JS: WGSL `lightmap` lookup coordinates exposed to JavaScript.
 * @param {number} sky
 * @param {number} block
 * @returns {Float32Array}
 */
export function js_webgpu_lightmap_uv(sky, block) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.js_webgpu_lightmap_uv(retptr, sky, block);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayF32FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * JS: `endFrame` readback bytes-per-row formula exposed to JavaScript.
 * @param {number} width
 * @returns {number}
 */
export function js_webgpu_readback_bytes_per_row(width) {
    const ret = wasm.js_webgpu_readback_bytes_per_row(width);
    return ret >>> 0;
}

/**
 * JS: terrain vertex decode exposed to JavaScript.
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @returns {Float32Array}
 */
export function js_webgpu_terrain_vertex_pos(x, y, z) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.js_webgpu_terrain_vertex_pos(retptr, x, y, z);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayF32FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * `leashEndpoints`: returns `[startX, startY, startZ, endX, endY, endZ, height]`.
 * @param {number} mob_x
 * @param {number} mob_y
 * @param {number} mob_z
 * @param {number} mob_prev_x
 * @param {number} mob_prev_y
 * @param {number} mob_prev_z
 * @param {number} mob_width
 * @param {number} mob_body_yaw
 * @param {number} mob_prev_body_yaw
 * @param {number} mob_height
 * @param {number} holder_x
 * @param {number} holder_y
 * @param {number} holder_z
 * @param {number} holder_prev_x
 * @param {number} holder_prev_y
 * @param {number} holder_prev_z
 * @param {number} holder_yaw
 * @param {number} holder_prev_yaw
 * @param {number} holder_pitch
 * @param {number} holder_prev_pitch
 * @param {number} holder_eye_height
 * @param {boolean} holder_is_leash
 * @param {number} partial
 * @returns {Float64Array}
 */
export function leash_endpoints(mob_x, mob_y, mob_z, mob_prev_x, mob_prev_y, mob_prev_z, mob_width, mob_body_yaw, mob_prev_body_yaw, mob_height, holder_x, holder_y, holder_z, holder_prev_x, holder_prev_y, holder_prev_z, holder_yaw, holder_prev_yaw, holder_pitch, holder_prev_pitch, holder_eye_height, holder_is_leash, partial) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.leash_endpoints(retptr, mob_x, mob_y, mob_z, mob_prev_x, mob_prev_y, mob_prev_z, mob_width, mob_body_yaw, mob_prev_body_yaw, mob_height, holder_x, holder_y, holder_z, holder_prev_x, holder_prev_y, holder_prev_z, holder_yaw, holder_prev_yaw, holder_pitch, holder_prev_pitch, holder_eye_height, holder_is_leash, partial);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayF64FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 8, 8);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * `leashGeometry`: two crossed 24-segment strips, 8 floats per vertex.
 * @param {number} start_x
 * @param {number} start_y
 * @param {number} start_z
 * @param {number} end_x
 * @param {number} end_y
 * @param {number} end_z
 * @param {number} height
 * @returns {Float32Array}
 */
export function leash_geometry(start_x, start_y, start_z, end_x, end_y, end_z, height) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.leash_geometry(retptr, start_x, start_y, start_z, end_x, end_y, end_z, height);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayF32FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Centre of the leash knot block position, as used by rope endpoints.
 * @param {number} bx
 * @param {number} by
 * @param {number} bz
 * @returns {Float64Array}
 */
export function leash_knot_center(bx, by, bz) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.leash_knot_center(retptr, bx, by, bz);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayF64FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 8, 8);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * @param {string} colors_json
 * @param {number} world_time
 * @param {number} dimension
 * @param {number} rain
 * @returns {string}
 */
export function lighting_frame_wasm(colors_json, world_time, dimension, rain) {
    let deferred5_0;
    let deferred5_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val2 = +world_time;
        const val3 = +dimension;
        const val4 = +rain;
        const ptr0 = passStringToWasm0(colors_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.lighting_frame_wasm(retptr, ptr0, len0, val2, val3, val4);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred5_0 = r0;
        deferred5_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred5_0, deferred5_1, 1);
    }
}

/**
 * `EntityLivingBase.onLivingUpdate` client-side parts: limb swing, cape, etc.
 * Returns [limb_swing, limb_swing_amount].
 * @param {number} _prev_limb_swing
 * @param {number} _prev_limb_swing_amount
 * @param {number} limb_swing
 * @param {number} limb_swing_amount
 * @param {boolean} on_ground
 * @param {boolean} sprinting
 * @param {number} speed
 * @returns {Float64Array}
 */
export function living_update(_prev_limb_swing, _prev_limb_swing_amount, limb_swing, limb_swing_amount, on_ground, sprinting, speed) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.living_update(retptr, _prev_limb_swing, _prev_limb_swing_amount, limb_swing, limb_swing_amount, on_ground, sprinting, speed);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayF64FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 8, 8);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * JS: `(bytes.length / 1024).toFixed(1)` — exposed for the JS glue's log line.
 * @param {number} bytes_len
 * @returns {string}
 */
export function loader_kib_label(bytes_len) {
    let deferred1_0;
    let deferred1_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.loader_kib_label(retptr, bytes_len);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred1_0 = r0;
        deferred1_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
    }
}

/**
 * JS: `export function wasmReady()` — host-facing ready query.
 * @param {boolean} ready
 * @returns {boolean}
 */
export function loader_ready(ready) {
    const ret = wasm.loader_ready(ready);
    return ret !== 0;
}

/**
 * @param {string} message
 * @returns {string}
 */
export function loading_error_message(message) {
    let deferred2_0;
    let deferred2_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const ptr0 = passStringToWasm0(message, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.loading_error_message(retptr, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred2_0 = r0;
        deferred2_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred2_0, deferred2_1, 1);
    }
}

/**
 * @param {number | null} [distance]
 * @param {number | null} [chunks]
 * @returns {number}
 */
export function lod_distance(distance, chunks) {
    const ret = wasm.lod_distance(!isLikeNone(distance), isLikeNone(distance) ? 0 : distance, !isLikeNone(chunks), isLikeNone(chunks) ? 0 : chunks);
    return ret;
}

/**
 * @param {Uint8Array} colors
 * @param {number} x
 * @param {number} y
 * @param {number} columns
 * @param {number} rows
 * @param {Uint8Array | number[]} data
 */
export function map_apply_columns_wasm(colors, x, y, columns, rows, data) {
    const val3 = +x;
    const val4 = +y;
    const val5 = +columns;
    const val6 = +rows;
    let ptr0, len0, ptr1, len1;
    try {
        ptr0 = passArray8ToWasm0(colors, wasm.__wbindgen_export);
        len0 = WASM_VECTOR_LEN;
        ptr1 = passArray8ToWasm0(data, wasm.__wbindgen_export);
        len1 = WASM_VECTOR_LEN;
    } catch (e) {
        if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
        if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
        throw e;
    }
    wasm.map_apply_columns_wasm(ptr0, len0, colors, val3, val4, val5, val6, ptr1, len1);
}

/**
 * @param {Float32Array | number[]} a
 * @returns {Float32Array | undefined}
 */
export function mat4_invert(a) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const ptr0 = passArrayF32ToWasm0(a, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.mat4_invert(retptr, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        let v2;
        if (r0 !== 0) {
            v2 = getArrayF32FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export3(r0, r1 * 4, 4);
        }
        return v2;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * @param {Float32Array | number[]} a
 * @param {Float32Array | number[]} b
 * @returns {Float32Array}
 */
export function mat4_multiply(a, b) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        let ptr0, len0, ptr1, len1;
        try {
            ptr0 = passArrayF32ToWasm0(a, wasm.__wbindgen_export);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passArrayF32ToWasm0(b, wasm.__wbindgen_export);
            len1 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 4, 4); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 4, 4); }
            throw e;
        }
        wasm.mat4_multiply(retptr, ptr0, len0, ptr1, len1);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v3 = getArrayF32FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v3;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * @param {number} left
 * @param {number} right
 * @param {number} bottom
 * @param {number} top
 * @param {number} near
 * @param {number} far
 * @returns {Float32Array}
 */
export function mat4_ortho(left, right, bottom, top, near, far) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.mat4_ortho(retptr, left, right, bottom, top, near, far);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayF32FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * @param {number} fovy_radians
 * @param {number} aspect
 * @param {number} near
 * @param {number} far
 * @returns {Float32Array}
 */
export function mat4_perspective(fovy_radians, aspect, near, far) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.mat4_perspective(retptr, fovy_radians, aspect, near, far);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayF32FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * @param {Float32Array | number[]} a
 * @param {number} radians
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @returns {Float32Array}
 */
export function mat4_rotate(a, radians, x, y, z) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val2 = +radians;
        const val3 = +x;
        const val4 = +y;
        const val5 = +z;
        const ptr0 = passArrayF32ToWasm0(a, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.mat4_rotate(retptr, ptr0, len0, val2, val3, val4, val5);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v6 = getArrayF32FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v6;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * @param {Float32Array | number[]} a
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @returns {Float32Array}
 */
export function mat4_scale(a, x, y, z) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val2 = +x;
        const val3 = +y;
        const val4 = +z;
        const ptr0 = passArrayF32ToWasm0(a, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.mat4_scale(retptr, ptr0, len0, val2, val3, val4);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v5 = getArrayF32FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v5;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * @param {Float32Array | number[]} m
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @returns {Float32Array}
 */
export function mat4_transform_dir(m, x, y, z) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val2 = +x;
        const val3 = +y;
        const val4 = +z;
        const ptr0 = passArrayF32ToWasm0(m, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.mat4_transform_dir(retptr, ptr0, len0, val2, val3, val4);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v5 = getArrayF32FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v5;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * @param {Float32Array | number[]} m
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @returns {Float32Array}
 */
export function mat4_transform_point(m, x, y, z) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val2 = +x;
        const val3 = +y;
        const val4 = +z;
        const ptr0 = passArrayF32ToWasm0(m, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.mat4_transform_point(retptr, ptr0, len0, val2, val3, val4);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v5 = getArrayF32FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v5;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * @param {Float32Array | number[]} a
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @returns {Float32Array}
 */
export function mat4_translate(a, x, y, z) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val2 = +x;
        const val3 = +y;
        const val4 = +z;
        const ptr0 = passArrayF32ToWasm0(a, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.mat4_translate(retptr, ptr0, len0, val2, val3, val4);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v5 = getArrayF32FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v5;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * JS: `const rand = (a, b) => ...` with the Math.random() draw supplied by the
 * caller (wasm-friendly form of [`music_rand`]).
 * @param {number} a
 * @param {number} b
 * @param {number} draw
 * @returns {number}
 */
export function music_rand_with_draw(a, b, draw) {
    const ret = wasm.music_rand_with_draw(a, b, draw);
    return ret;
}

/**
 * JS: `SoundManager._musicType()` (internal in JS, exported here for wasm glue).
 * @param {boolean} is_credits
 * @param {boolean} in_world
 * @param {number} dimension
 * @param {boolean} end_boss
 * @param {boolean} creative_flight
 * @returns {MusicTrackInfo}
 */
export function music_type_for(is_credits, in_world, dimension, end_boss, creative_flight) {
    const ret = wasm.music_type_for(is_credits, in_world, dimension, end_boss, creative_flight);
    return MusicTrackInfo.__wrap(ret);
}

/**
 * Root tag name, or an empty string when the input is not valid NBT.
 * @param {Uint8Array | number[]} bytes
 * @returns {string}
 */
export function nbt_root_name(bytes) {
    let deferred2_0;
    let deferred2_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.nbt_root_name(retptr, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred2_0 = r0;
        deferred2_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred2_0, deferred2_1, 1);
    }
}

/**
 * Parse and re-encode an NBT root. An empty result means the input was not
 * valid NBT (the JavaScript caller keeps its own parser for error messages).
 * @param {Uint8Array | number[]} bytes
 * @returns {Uint8Array}
 */
export function nbt_roundtrip(bytes) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.nbt_roundtrip(retptr, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v2 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 1, 1);
        return v2;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * `simplify(readNbtRoot(bytes))` as JSON; `None` when the input is invalid.
 * @param {Uint8Array | number[]} bytes
 * @returns {string | undefined}
 */
export function nbt_simplify_json(bytes) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.nbt_simplify_json(retptr, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        let v2;
        if (r0 !== 0) {
            v2 = getStringFromWasm0(r0, r1);
            wasm.__wbindgen_export3(r0, r1 * 1, 1);
        }
        return v2;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * @param {Uint8Array | number[]} bytes
 * @returns {boolean}
 */
export function nbt_valid(bytes) {
    const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_export);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.nbt_valid(ptr0, len0);
    return ret !== 0;
}

/**
 * `animateOcelot`: 22 values — body(rx,py,pz), head(rx,ry,py,pz),
 * tail(rx,py,pz), tail2(rx,py,pz), then frontLeft, frontRight, backLeft,
 * backRight with (rx,py,pz).
 * @param {boolean} cat
 * @param {number} pitch
 * @param {number} yaw
 * @param {boolean} sitting
 * @param {number} ls
 * @param {number} lsa
 * @returns {Float64Array}
 */
export function ocelot_pose(cat, pitch, yaw, sitting, ls, lsa) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.ocelot_pose(retptr, cat, pitch, yaw, sitting, ls, lsa);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayF64FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 8, 8);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * @param {string} options_json
 * @param {string} values_json
 * @returns {string}
 */
export function pack_lighting_wasm(options_json, values_json) {
    let deferred3_0;
    let deferred3_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        let ptr0, len0, ptr1, len1;
        try {
            ptr0 = passStringToWasm0(options_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passStringToWasm0(values_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len1 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
            throw e;
        }
        wasm.pack_lighting_wasm(retptr, ptr0, len0, ptr1, len1);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred3_0 = r0;
        deferred3_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred3_0, deferred3_1, 1);
    }
}

/**
 * Deserialize a packet from bytes
 * @param {Uint8Array | number[]} bytes
 * @param {number} protocol_version
 * @param {boolean} clientbound
 * @returns {DecodedPacket}
 */
export function packet_deserialize(bytes, protocol_version, clientbound) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val2 = +protocol_version;
        const val3 = +clientbound;
        const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.packet_deserialize(retptr, ptr0, len0, val2, val3);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        if (r2) {
            throw takeFromExternrefTable0(r1);
        }
        return DecodedPacket.__wrap(r0);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * @param {string} name_value
 * @param {boolean} clientbound
 * @returns {number | undefined}
 */
export function packet_id_1152(name_value, clientbound) {
    const val2 = +clientbound;
    const ptr0 = passStringToWasm0(name_value, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.packet_id_1152(ptr0, len0, val2);
    return ret === Number.MAX_SAFE_INTEGER ? undefined : ret;
}

/**
 * @param {string} name_value
 * @param {boolean} clientbound
 * @returns {number | undefined}
 */
export function packet_id_498(name_value, clientbound) {
    const val2 = +clientbound;
    const ptr0 = passStringToWasm0(name_value, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.packet_id_498(ptr0, len0, val2);
    return ret === Number.MAX_SAFE_INTEGER ? undefined : ret;
}

/**
 * @param {string} name_value
 * @param {boolean} clientbound
 * @returns {number | undefined}
 */
export function packet_id_578(name_value, clientbound) {
    const val2 = +clientbound;
    const ptr0 = passStringToWasm0(name_value, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.packet_id_578(ptr0, len0, val2);
    return ret === Number.MAX_SAFE_INTEGER ? undefined : ret;
}

/**
 * @param {number} id_value
 * @param {boolean} clientbound
 * @returns {string | undefined}
 */
export function packet_name_1152(id_value, clientbound) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.packet_name_1152(retptr, id_value, clientbound);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        let v1;
        if (r0 !== 0) {
            v1 = getStringFromWasm0(r0, r1);
            wasm.__wbindgen_export3(r0, r1 * 1, 1);
        }
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * @param {number} id_value
 * @param {boolean} clientbound
 * @returns {string | undefined}
 */
export function packet_name_498(id_value, clientbound) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.packet_name_498(retptr, id_value, clientbound);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        let v1;
        if (r0 !== 0) {
            v1 = getStringFromWasm0(r0, r1);
            wasm.__wbindgen_export3(r0, r1 * 1, 1);
        }
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * @param {number} id_value
 * @param {boolean} clientbound
 * @returns {string | undefined}
 */
export function packet_name_578(id_value, clientbound) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.packet_name_578(retptr, id_value, clientbound);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        let v1;
        if (r0 !== 0) {
            v1 = getStringFromWasm0(r0, r1);
            wasm.__wbindgen_export3(r0, r1 * 1, 1);
        }
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Serialize a packet by ID and data
 * @param {number} packet_id
 * @param {Uint8Array | number[]} data
 * @param {number} protocol_version
 * @param {boolean} clientbound
 * @returns {Uint8Array}
 */
export function packet_serialize(packet_id, data, protocol_version, clientbound) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val2 = +packet_id;
        const val3 = +protocol_version;
        const val4 = +clientbound;
        const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.packet_serialize(retptr, val2, ptr0, len0, val3, val4);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        if (r3) {
            throw takeFromExternrefTable0(r2);
        }
        var v5 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 1, 1);
        return v5;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * @param {string} text
 * @returns {string | undefined}
 */
export function parse_address(text) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const ptr0 = passStringToWasm0(text, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.parse_address(retptr, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        let v2;
        if (r0 !== 0) {
            v2 = getStringFromWasm0(r0, r1);
            wasm.__wbindgen_export3(r0, r1 * 1, 1);
        }
        return v2;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Parse a `DeclareCommands` payload into the same shape as the JS parser.
 * Returns `None` on an unsupported parser, truncation, or a broken reference.
 * @param {Uint8Array | number[]} data
 * @returns {string | undefined}
 */
export function parse_command_tree(data) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.parse_command_tree(retptr, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        let v2;
        if (r0 !== 0) {
            v2 = getStringFromWasm0(r0, r1);
            wasm.__wbindgen_export3(r0, r1 * 1, 1);
        }
        return v2;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * `parseProxyUrl`: returns a ws(s) URL, or `None`.
 * @param {string} text
 * @returns {string | undefined}
 */
export function parse_proxy_url(text) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const ptr0 = passStringToWasm0(text, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.parse_proxy_url(retptr, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        let v2;
        if (r0 !== 0) {
            v2 = getStringFromWasm0(r0, r1);
            wasm.__wbindgen_export3(r0, r1 * 1, 1);
        }
        return v2;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Parse a recipe array from a `DeclareRecipes` payload. `protocol` is 404,
 * 498 or 578; only 404 reorders the type/id pair.
 * @param {Uint8Array | number[]} data
 * @param {number} protocol
 * @returns {string | undefined}
 */
export function parse_recipes(data, protocol) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val2 = +protocol;
        const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.parse_recipes(retptr, ptr0, len0, val2);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        let v3;
        if (r0 !== 0) {
            v3 = getStringFromWasm0(r0, r1);
            wasm.__wbindgen_export3(r0, r1 * 1, 1);
        }
        return v3;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Parse SNBT into a `{ t, v }` tree as JSON. `None` for malformed input.
 * @param {string} text
 * @returns {string | undefined}
 */
export function parse_snbt(text) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const ptr0 = passStringToWasm0(text, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.parse_snbt(retptr, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        let v2;
        if (r0 !== 0) {
            v2 = getStringFromWasm0(r0, r1);
            wasm.__wbindgen_export3(r0, r1 * 1, 1);
        }
        return v2;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} mx
 * @param {number} my
 * @param {number} mz
 * @param {bigint | null} [rng_seed]
 * @returns {string}
 */
export function particle_bubble(x, y, z, mx, my, mz, rng_seed) {
    let deferred1_0;
    let deferred1_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.particle_bubble(retptr, x, y, z, mx, my, mz, !isLikeNone(rng_seed), isLikeNone(rng_seed) ? BigInt(0) : rng_seed);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred1_0 = r0;
        deferred1_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {boolean} signal
 * @param {bigint | null} [rng_seed]
 * @returns {string}
 */
export function particle_campfire_smoke(x, y, z, signal, rng_seed) {
    let deferred1_0;
    let deferred1_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.particle_campfire_smoke(retptr, x, y, z, signal, !isLikeNone(rng_seed), isLikeNone(rng_seed) ? BigInt(0) : rng_seed);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred1_0 = r0;
        deferred1_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} mx
 * @param {number} my
 * @param {number} mz
 * @param {boolean} magic
 * @param {bigint | null} [rng_seed]
 * @returns {string}
 */
export function particle_crit(x, y, z, mx, my, mz, magic, rng_seed) {
    let deferred1_0;
    let deferred1_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.particle_crit(retptr, x, y, z, mx, my, mz, magic, !isLikeNone(rng_seed), isLikeNone(rng_seed) ? BigInt(0) : rng_seed);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred1_0 = r0;
        deferred1_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {boolean} lava
 * @param {bigint | null} [rng_seed]
 * @returns {string}
 */
export function particle_drip(x, y, z, lava, rng_seed) {
    let deferred1_0;
    let deferred1_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.particle_drip(retptr, x, y, z, lava, !isLikeNone(rng_seed), isLikeNone(rng_seed) ? BigInt(0) : rng_seed);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred1_0 = r0;
        deferred1_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} mx
 * @param {number} my
 * @param {number} mz
 * @param {bigint | null} [rng_seed]
 * @returns {string}
 */
export function particle_enchant(x, y, z, mx, my, mz, rng_seed) {
    let deferred1_0;
    let deferred1_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.particle_enchant(retptr, x, y, z, mx, my, mz, !isLikeNone(rng_seed), isLikeNone(rng_seed) ? BigInt(0) : rng_seed);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred1_0 = r0;
        deferred1_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @param {number} entity_x
 * @param {number} entity_y
 * @param {number} entity_z
 * @param {number} entity_width
 * @param {number} entity_height
 * @param {string} kind
 * @param {bigint | null} [rng_seed]
 * @returns {string}
 */
export function particle_entity_effect(entity_x, entity_y, entity_z, entity_width, entity_height, kind, rng_seed) {
    let deferred8_0;
    let deferred8_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val2 = +entity_x;
        const val3 = +entity_y;
        const val4 = +entity_z;
        const val5 = +entity_width;
        const val6 = +entity_height;
        const val7 = BigInt.asIntN(64, (isLikeNone(rng_seed) ? BigInt(0) : rng_seed));
        const ptr0 = passStringToWasm0(kind, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.particle_entity_effect(retptr, val2, val3, val4, val5, val6, ptr0, len0, !isLikeNone(rng_seed), val7);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred8_0 = r0;
        deferred8_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred8_0, deferred8_1, 1);
    }
}

/**
 * @param {number} entity_x
 * @param {number} entity_y
 * @param {number} entity_z
 * @param {number} entity_width
 * @param {number} entity_height
 * @param {bigint | null} [rng_seed]
 * @returns {string}
 */
export function particle_entity_fire(entity_x, entity_y, entity_z, entity_width, entity_height, rng_seed) {
    let deferred1_0;
    let deferred1_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.particle_entity_fire(retptr, entity_x, entity_y, entity_z, entity_width, entity_height, !isLikeNone(rng_seed), isLikeNone(rng_seed) ? BigInt(0) : rng_seed);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred1_0 = r0;
        deferred1_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @param {string} particle_json
 * @param {number} partial
 * @returns {number}
 */
export function particle_eval_alpha(particle_json, partial) {
    const val2 = +partial;
    const ptr0 = passStringToWasm0(particle_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.particle_eval_alpha(ptr0, len0, val2);
    return ret;
}

/**
 * @param {string} particle_json
 * @param {number} partial
 * @returns {number}
 */
export function particle_eval_size(particle_json, partial) {
    const val2 = +partial;
    const ptr0 = passStringToWasm0(particle_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.particle_eval_size(ptr0, len0, val2);
    return ret;
}

/**
 * @param {string} particle_json
 * @returns {number}
 */
export function particle_eval_tex(particle_json) {
    const ptr0 = passStringToWasm0(particle_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.particle_eval_tex(ptr0, len0);
    return ret;
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} radius
 * @param {bigint | null} [rng_seed]
 * @returns {string}
 */
export function particle_explosion(x, y, z, radius, rng_seed) {
    let deferred1_0;
    let deferred1_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.particle_explosion(retptr, x, y, z, radius, !isLikeNone(rng_seed), isLikeNone(rng_seed) ? BigInt(0) : rng_seed);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred1_0 = r0;
        deferred1_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {boolean} lava
 * @param {boolean} landing
 * @param {bigint | null} [rng_seed]
 * @returns {string}
 */
export function particle_falling_drop(x, y, z, lava, landing, rng_seed) {
    let deferred1_0;
    let deferred1_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.particle_falling_drop(retptr, x, y, z, lava, landing, !isLikeNone(rng_seed), isLikeNone(rng_seed) ? BigInt(0) : rng_seed);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred1_0 = r0;
        deferred1_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} mx
 * @param {number} my
 * @param {number} mz
 * @param {bigint | null} [rng_seed]
 * @returns {string}
 */
export function particle_flame(x, y, z, mx, my, mz, rng_seed) {
    let deferred1_0;
    let deferred1_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.particle_flame(retptr, x, y, z, mx, my, mz, !isLikeNone(rng_seed), isLikeNone(rng_seed) ? BigInt(0) : rng_seed);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred1_0 = r0;
        deferred1_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {boolean} falling
 * @param {boolean} landing
 * @param {bigint | null} [rng_seed]
 * @returns {string}
 */
export function particle_honey_drip(x, y, z, falling, landing, rng_seed) {
    let deferred1_0;
    let deferred1_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.particle_honey_drip(retptr, x, y, z, falling, landing, !isLikeNone(rng_seed), isLikeNone(rng_seed) ? BigInt(0) : rng_seed);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred1_0 = r0;
        deferred1_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @returns {string}
 */
export function particle_huge_explode(x, y, z) {
    let deferred1_0;
    let deferred1_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.particle_huge_explode(retptr, x, y, z);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred1_0 = r0;
        deferred1_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} scale
 * @param {bigint | null} [rng_seed]
 * @returns {string}
 */
export function particle_large_explode(x, y, z, scale, rng_seed) {
    let deferred1_0;
    let deferred1_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.particle_large_explode(retptr, x, y, z, scale, !isLikeNone(rng_seed), isLikeNone(rng_seed) ? BigInt(0) : rng_seed);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred1_0 = r0;
        deferred1_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {bigint | null} [rng_seed]
 * @returns {string}
 */
export function particle_lava(x, y, z, rng_seed) {
    let deferred1_0;
    let deferred1_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.particle_lava(retptr, x, y, z, !isLikeNone(rng_seed), isLikeNone(rng_seed) ? BigInt(0) : rng_seed);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred1_0 = r0;
        deferred1_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
    }
}

/**
 * WASM export for particle collision (used by JS fallback too).
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} motion_x
 * @param {number} motion_y
 * @param {number} motion_z
 * @param {number} width
 * @param {number} height
 * @param {boolean} collide
 * @param {Float64Array | number[]} boxes
 * @returns {Float64Array}
 */
export function particle_move(x, y, z, motion_x, motion_y, motion_z, width, height, collide, boxes) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val2 = +x;
        const val3 = +y;
        const val4 = +z;
        const val5 = +motion_x;
        const val6 = +motion_y;
        const val7 = +motion_z;
        const val8 = +width;
        const val9 = +height;
        const val10 = +collide;
        const ptr0 = passArrayF64ToWasm0(boxes, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.particle_move(retptr, val2, val3, val4, val5, val6, val7, val8, val9, val10, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v11 = getArrayF64FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 8, 8);
        return v11;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} mx
 * @param {number} my
 * @param {number} mz
 * @param {string} kind
 * @param {bigint | null} [rng_seed]
 * @returns {string}
 */
export function particle_native(x, y, z, mx, my, mz, kind, rng_seed) {
    let deferred9_0;
    let deferred9_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val2 = +x;
        const val3 = +y;
        const val4 = +z;
        const val5 = +mx;
        const val6 = +my;
        const val7 = +mz;
        const val8 = BigInt.asIntN(64, (isLikeNone(rng_seed) ? BigInt(0) : rng_seed));
        const ptr0 = passStringToWasm0(kind, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.particle_native(retptr, val2, val3, val4, val5, val6, val7, ptr0, len0, !isLikeNone(rng_seed), val8);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred9_0 = r0;
        deferred9_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred9_0, deferred9_1, 1);
    }
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} pitch
 * @param {bigint | null} [rng_seed]
 * @returns {string}
 */
export function particle_note(x, y, z, pitch, rng_seed) {
    let deferred1_0;
    let deferred1_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.particle_note(retptr, x, y, z, pitch, !isLikeNone(rng_seed), isLikeNone(rng_seed) ? BigInt(0) : rng_seed);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred1_0 = r0;
        deferred1_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} mx
 * @param {number} my
 * @param {number} mz
 * @param {bigint | null} [rng_seed]
 * @returns {string}
 */
export function particle_poof(x, y, z, mx, my, mz, rng_seed) {
    let deferred1_0;
    let deferred1_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.particle_poof(retptr, x, y, z, mx, my, mz, !isLikeNone(rng_seed), isLikeNone(rng_seed) ? BigInt(0) : rng_seed);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred1_0 = r0;
        deferred1_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} mx
 * @param {number} my
 * @param {number} mz
 * @param {bigint | null} [rng_seed]
 * @returns {string}
 */
export function particle_portal(x, y, z, mx, my, mz, rng_seed) {
    let deferred1_0;
    let deferred1_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.particle_portal(retptr, x, y, z, mx, my, mz, !isLikeNone(rng_seed), isLikeNone(rng_seed) ? BigInt(0) : rng_seed);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred1_0 = r0;
        deferred1_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {bigint | null} [rng_seed]
 * @returns {string}
 */
export function particle_rain(x, y, z, rng_seed) {
    let deferred1_0;
    let deferred1_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.particle_rain(retptr, x, y, z, !isLikeNone(rng_seed), isLikeNone(rng_seed) ? BigInt(0) : rng_seed);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred1_0 = r0;
        deferred1_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @param {bigint | null} [rng_seed]
 * @returns {string}
 */
export function particle_reddust(x, y, z, r, g, b, rng_seed) {
    let deferred1_0;
    let deferred1_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.particle_reddust(retptr, x, y, z, r, g, b, !isLikeNone(rng_seed), isLikeNone(rng_seed) ? BigInt(0) : rng_seed);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred1_0 = r0;
        deferred1_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} tex
 * @param {string | null | undefined} sprite
 * @param {number} mx
 * @param {number} my
 * @param {number} mz
 * @param {number} max_age
 * @param {number} scale
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @param {bigint | null} [rng_seed]
 * @returns {string}
 */
export function particle_simple_rising(x, y, z, tex, sprite, mx, my, mz, max_age, scale, r, g, b, rng_seed) {
    let deferred15_0;
    let deferred15_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val2 = +x;
        const val3 = +y;
        const val4 = +z;
        const val5 = +tex;
        const val6 = +mx;
        const val7 = +my;
        const val8 = +mz;
        const val9 = +max_age;
        const val10 = +scale;
        const val11 = +r;
        const val12 = +g;
        const val13 = +b;
        const val14 = BigInt.asIntN(64, (isLikeNone(rng_seed) ? BigInt(0) : rng_seed));
        var ptr0 = isLikeNone(sprite) ? 0 : passStringToWasm0(sprite, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        var len0 = WASM_VECTOR_LEN;
        wasm.particle_simple_rising(retptr, val2, val3, val4, val5, ptr0, len0, val6, val7, val8, val9, val10, val11, val12, val13, !isLikeNone(rng_seed), val14);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred15_0 = r0;
        deferred15_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred15_0, deferred15_1, 1);
    }
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} mx
 * @param {number} my
 * @param {number} mz
 * @param {number} scale_mul
 * @param {bigint | null} [rng_seed]
 * @returns {string}
 */
export function particle_smoke(x, y, z, mx, my, mz, scale_mul, rng_seed) {
    let deferred1_0;
    let deferred1_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.particle_smoke(retptr, x, y, z, mx, my, mz, scale_mul, !isLikeNone(rng_seed), isLikeNone(rng_seed) ? BigInt(0) : rng_seed);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred1_0 = r0;
        deferred1_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} mx
 * @param {number} my
 * @param {number} mz
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @param {boolean} instant
 * @param {boolean} witch
 * @param {bigint | null} [rng_seed]
 * @returns {string}
 */
export function particle_spell(x, y, z, mx, my, mz, r, g, b, instant, witch, rng_seed) {
    let deferred1_0;
    let deferred1_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.particle_spell(retptr, x, y, z, mx, my, mz, r, g, b, instant, witch, !isLikeNone(rng_seed), isLikeNone(rng_seed) ? BigInt(0) : rng_seed);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred1_0 = r0;
        deferred1_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} mx
 * @param {number} my
 * @param {number} mz
 * @param {bigint | null} [rng_seed]
 * @returns {string}
 */
export function particle_splash(x, y, z, mx, my, mz, rng_seed) {
    let deferred1_0;
    let deferred1_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.particle_splash(retptr, x, y, z, mx, my, mz, !isLikeNone(rng_seed), isLikeNone(rng_seed) ? BigInt(0) : rng_seed);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred1_0 = r0;
        deferred1_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
    }
}

/**
 * Check if a particle type exists in the registry.
 * @param {string} particle_type
 * @returns {boolean}
 */
export function particle_sprite_exists(particle_type) {
    const ptr0 = passStringToWasm0(particle_type, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.particle_sprite_exists(ptr0, len0);
    return ret !== 0;
}

/**
 * Get the number of animation frames for a particle type.
 * @param {string} particle_type
 * @returns {number}
 */
export function particle_sprite_frame_count(particle_type) {
    const ptr0 = passStringToWasm0(particle_type, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.particle_sprite_frame_count(ptr0, len0);
    return ret >>> 0;
}

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
 * @param {string} particle_type
 * @param {number} age
 * @param {number} max_age
 * @param {number} partial_tick
 * @param {number} sprite_mode
 * @param {number} random_seed
 * @returns {Float32Array | undefined}
 */
export function particle_sprite_get(particle_type, age, max_age, partial_tick, sprite_mode, random_seed) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val2 = +age;
        const val3 = +max_age;
        const val4 = +partial_tick;
        const val5 = +sprite_mode;
        const val6 = +random_seed;
        const ptr0 = passStringToWasm0(particle_type, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.particle_sprite_get(retptr, ptr0, len0, val2, val3, val4, val5, val6);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        let v7;
        if (r0 !== 0) {
            v7 = getArrayF32FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export3(r0, r1 * 4, 4);
        }
        return v7;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Get UV coordinates for a particle sprite by explicit frame index.
 *
 * # Arguments
 * * `particle_type` - Particle type name
 * * `frame` - Explicit frame index
 *
 * # Returns
 * UV coordinates as [u0, v0, u1, v1], or null if particle type/frame not found.
 * @param {string} particle_type
 * @param {number} frame
 * @returns {Float32Array | undefined}
 */
export function particle_sprite_get_frame(particle_type, frame) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val2 = +frame;
        const ptr0 = passStringToWasm0(particle_type, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.particle_sprite_get_frame(retptr, ptr0, len0, val2);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        let v3;
        if (r0 !== 0) {
            v3 = getArrayF32FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export3(r0, r1 * 4, 4);
        }
        return v3;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Get all registered particle type names.
 * @returns {string[]}
 */
export function particle_sprite_list() {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.particle_sprite_list(retptr);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayJsValueFromWasm0(r0, r1);
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Serializable representation of the particle sprite registry (for debugging).
 * @returns {string}
 */
export function particle_sprite_registry_json() {
    let deferred1_0;
    let deferred1_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.particle_sprite_registry_json(retptr);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred1_0 = r0;
        deferred1_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
    }
}

/**
 * Get the texture names for a particle type (for debugging/inspection).
 * @param {string} particle_type
 * @returns {string[] | undefined}
 */
export function particle_sprite_textures(particle_type) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const ptr0 = passStringToWasm0(particle_type, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.particle_sprite_textures(retptr, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        let v2;
        if (r0 !== 0) {
            v2 = getArrayJsValueFromWasm0(r0, r1);
            wasm.__wbindgen_export3(r0, r1 * 4, 4);
        }
        return v2;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Initialize or update the UV lookup table from JavaScript.
 * Called by JS after building the texture atlas.
 * @param {any} uv_data
 */
export function particle_sprites_set_uv_lookup(uv_data) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.particle_sprites_set_uv_lookup(retptr, uv_data);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        if (r1) {
            throw takeFromExternrefTable0(r0);
        }
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Tick all particles for one frame.
 * Returns updated particles and any newly spawned particles as JSON.
 * @param {string} particles_json
 * @param {string} explosion_emitters_json
 * @param {string} emitters_json
 * @param {Float64Array | number[]} collision_boxes
 * @param {number} settings
 * @param {bigint | null} [rng_seed]
 * @returns {string}
 */
export function particle_tick(particles_json, explosion_emitters_json, emitters_json, collision_boxes, settings, rng_seed) {
    let deferred7_0;
    let deferred7_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val5 = +settings;
        const val6 = BigInt.asIntN(64, (isLikeNone(rng_seed) ? BigInt(0) : rng_seed));
        let ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3;
        try {
            ptr0 = passStringToWasm0(particles_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passStringToWasm0(explosion_emitters_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len1 = WASM_VECTOR_LEN;
            ptr2 = passStringToWasm0(emitters_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len2 = WASM_VECTOR_LEN;
            ptr3 = passArrayF64ToWasm0(collision_boxes, wasm.__wbindgen_export);
            len3 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr3) { wasm.__wbindgen_export3(ptr3, len3 * 8, 8); }
            if (ptr2) { wasm.__wbindgen_export3(ptr2, len2 * 1, 1); }
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
            throw e;
        }
        wasm.particle_tick(retptr, ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, val5, !isLikeNone(rng_seed), val6);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred7_0 = r0;
        deferred7_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred7_0, deferred7_1, 1);
    }
}

/**
 * @param {string} reg_json
 * @param {number} state
 * @param {number} px
 * @param {number} py
 * @param {number} pz
 * @param {number} facing
 * @param {boolean} destroy_blocks
 * @param {number} f2
 * @returns {boolean}
 */
export function piston_can_push(reg_json, state, px, py, pz, facing, destroy_blocks, f2) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val2 = +state;
        const val3 = +px;
        const val4 = +py;
        const val5 = +pz;
        const val6 = +facing;
        const val7 = +destroy_blocks;
        const val8 = +f2;
        const ptr0 = passStringToWasm0(reg_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.piston_can_push(retptr, ptr0, len0, val2, val3, val4, val5, val6, val7, val8);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        if (r2) {
            throw takeFromExternrefTable0(r1);
        }
        return r0 !== 0;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * @param {string} name
 * @returns {boolean}
 */
export function piston_is_piston(name) {
    const ptr0 = passStringToWasm0(name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.piston_is_piston(ptr0, len0);
    return ret !== 0;
}

/**
 * @param {string} name
 * @returns {boolean}
 */
export function piston_is_sticky_block(name) {
    const ptr0 = passStringToWasm0(name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.piston_is_sticky_block(ptr0, len0);
    return ret !== 0;
}

/**
 * @param {string} name
 * @returns {string}
 */
export function piston_mobility(name) {
    let deferred2_0;
    let deferred2_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.piston_mobility(retptr, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred2_0 = r0;
        deferred2_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred2_0, deferred2_1, 1);
    }
}

/**
 * Set up an EntityLeashKnot / LeashFenceKnotEntity with position and dimensions.
 *
 * Mirrors `placeLeashKnot(e, x, z)` from the JavaScript original. The JS call
 * sites default `x` to the entity's `y` and `z` to its `z`; here both are
 * always supplied, and `y` is read from the entity when present.
 * @param {object} e
 * @param {number} x
 * @param {number} z
 */
export function place_leash_knot(e, x, z) {
    wasm.place_leash_knot(e, x, z);
}

/**
 * Strict overlap between an entity box and any occupied block-shape box.
 * Touching a face is allowed.
 * @param {Float64Array | number[]} boxes
 * @param {Float64Array | number[]} pos
 * @param {Float64Array | number[]} entity
 * @returns {boolean}
 */
export function placement_intersects(boxes, pos, entity) {
    let ptr0, len0, ptr1, len1, ptr2, len2;
    try {
        ptr0 = passArrayF64ToWasm0(boxes, wasm.__wbindgen_export);
        len0 = WASM_VECTOR_LEN;
        ptr1 = passArrayF64ToWasm0(pos, wasm.__wbindgen_export);
        len1 = WASM_VECTOR_LEN;
        ptr2 = passArrayF64ToWasm0(entity, wasm.__wbindgen_export);
        len2 = WASM_VECTOR_LEN;
    } catch (e) {
        if (ptr2) { wasm.__wbindgen_export3(ptr2, len2 * 8, 8); }
        if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 8, 8); }
        if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 8, 8); }
        throw e;
    }
    const ret = wasm.placement_intersects(ptr0, len0, ptr1, len1, ptr2, len2);
    return ret !== 0;
}

/**
 * @param {string} pose
 * @returns {number}
 */
export function player_pose_height_114(pose) {
    const ptr0 = passStringToWasm0(pose, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.player_pose_height_114(ptr0, len0);
    return ret;
}

/**
 * @param {string} pose
 * @returns {number}
 */
export function player_pose_height_115(pose) {
    const ptr0 = passStringToWasm0(pose, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.player_pose_height_115(ptr0, len0);
    return ret;
}

/**
 * @param {string} pose
 * @returns {number}
 */
export function player_pose_width_114(pose) {
    const ptr0 = passStringToWasm0(pose, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.player_pose_width_114(ptr0, len0);
    return ret;
}

/**
 * 1.15.2 maps the legacy `sneaking` input to the `crouching` pose.
 * @param {string} pose
 * @returns {number}
 */
export function player_pose_width_115(pose) {
    const ptr0 = passStringToWasm0(pose, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.player_pose_width_115(ptr0, len0);
    return ret;
}

/**
 * @param {number} distance
 * @param {number} distance_squared
 * @returns {number}
 */
export function pose_interval(distance, distance_squared) {
    const ret = wasm.pose_interval(distance, distance_squared);
    return ret >>> 0;
}

/**
 * @param {boolean} super_potato
 * @param {string} device_name
 * @returns {boolean}
 */
export function potato_decision(super_potato, device_name) {
    const val2 = +super_potato;
    const ptr0 = passStringToWasm0(device_name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.potato_decision(val2, ptr0, len0);
    return ret !== 0;
}

/**
 * Blend potion effect colors based on effect type and amplifier.
 * Matches Minecraft's potion color blending logic.
 *
 * Returns [r, g, b, a] as f32 values in 0..1 range.
 * @param {number} effect_id
 * @param {number} amplifier
 * @param {boolean} ambient
 * @returns {Float32Array}
 */
export function potion_effect_color(effect_id, amplifier, ambient) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.potion_effect_color(retptr, effect_id, amplifier, ambient);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayF32FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * End frame and return total time
 * @param {ProfilingData} profiler
 * @returns {number}
 */
export function profiler_end_frame(profiler) {
    _assertClass(profiler, ProfilingData);
    const ret = wasm.profiler_end_frame(profiler.__wbg_ptr);
    return ret;
}

/**
 * Get profiler data as formatted string (for debug overlay)
 * @param {ProfilingData} profiler
 * @returns {string}
 */
export function profiler_get_formatted(profiler) {
    let deferred1_0;
    let deferred1_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        _assertClass(profiler, ProfilingData);
        wasm.profiler_get_formatted(retptr, profiler.__wbg_ptr);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred1_0 = r0;
        deferred1_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
    }
}

/**
 * Get profiler results as a JSON string.
 * @param {ProfilingData} profiler
 * @returns {string}
 */
export function profiler_get_results(profiler) {
    let deferred1_0;
    let deferred1_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        _assertClass(profiler, ProfilingData);
        wasm.profiler_get_results(retptr, profiler.__wbg_ptr);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred1_0 = r0;
        deferred1_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
    }
}

/**
 * End a profiling section
 * @param {ProfilingData} profiler
 * @param {string} section
 */
export function profiler_mark_end(profiler, section) {
    _assertClass(profiler, ProfilingData);
    const ptr0 = passStringToWasm0(section, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN;
    wasm.profiler_mark_end(profiler.__wbg_ptr, ptr0, len0);
}

/**
 * Start a profiling section
 * @param {ProfilingData} profiler
 * @param {string} section
 */
export function profiler_mark_start(profiler, section) {
    _assertClass(profiler, ProfilingData);
    const ptr0 = passStringToWasm0(section, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN;
    wasm.profiler_mark_start(profiler.__wbg_ptr, ptr0, len0);
}

/**
 * Reset profiler data
 * @param {ProfilingData} profiler
 */
export function profiler_reset(profiler) {
    _assertClass(profiler, ProfilingData);
    wasm.profiler_reset(profiler.__wbg_ptr);
}

/**
 * Start a new frame
 * @param {ProfilingData} profiler
 */
export function profiler_start_frame(profiler) {
    _assertClass(profiler, ProfilingData);
    wasm.profiler_start_frame(profiler.__wbg_ptr);
}

/**
 * `proxyHttpBase`: ws(s) URL -> http(s) base without trailing slashes.
 * @param {string} url
 * @returns {string | undefined}
 */
export function proxy_http_base(url) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const ptr0 = passStringToWasm0(url, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.proxy_http_base(retptr, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        let v2;
        if (r0 !== 0) {
            v2 = getStringFromWasm0(r0, r1);
            wasm.__wbindgen_export3(r0, r1 * 1, 1);
        }
        return v2;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * One entity's contribution to the local player's motion.
 *
 * `bb` is the player's AABB `[x0, y0, z0, x1, y1, z1]`; the entity is the
 * potential pusher. Returns `[dx, dz]` to add to `motionX` / `motionZ`, or
 * `[0, 0]` when the boxes do not overlap.
 * @param {number} bb_x0
 * @param {number} bb_y0
 * @param {number} bb_z0
 * @param {number} bb_x1
 * @param {number} bb_y1
 * @param {number} bb_z1
 * @param {number} player_x
 * @param {number} player_z
 * @param {number} entity_x
 * @param {number} entity_y
 * @param {number} entity_z
 * @param {number} entity_width
 * @param {number} entity_height
 * @param {number} collision_reduction
 * @returns {Float64Array}
 */
export function push_offset(bb_x0, bb_y0, bb_z0, bb_x1, bb_y1, bb_z1, player_x, player_z, entity_x, entity_y, entity_z, entity_width, entity_height, collision_reduction) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.push_offset(retptr, bb_x0, bb_y0, bb_z0, bb_x1, bb_y1, bb_z1, player_x, player_z, entity_x, entity_y, entity_z, entity_width, entity_height, collision_reduction);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayF64FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 8, 8);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Remove unlocked recipe
 * @param {RecipeBookState} recipe_book
 * @param {string} recipe_id
 */
export function remove_recipe(recipe_book, recipe_id) {
    _assertClass(recipe_book, RecipeBookState);
    const ptr0 = passStringToWasm0(recipe_id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN;
    wasm.remove_recipe(recipe_book.__wbg_ptr, ptr0, len0);
}

/**
 * @param {BlockRegistryCore} reg
 * @param {number} state
 * @param {Uint32Array | number[]} neighbours
 * @returns {string}
 */
export function resolve_state_wasm(reg, state, neighbours) {
    let deferred3_0;
    let deferred3_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        _assertClass(reg, BlockRegistryCore);
        const val2 = +state;
        const ptr0 = passArray32ToWasm0(neighbours, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.resolve_state_wasm(retptr, reg.__wbg_ptr, val2, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred3_0 = r0;
        deferred3_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred3_0, deferred3_1, 1);
    }
}

/**
 * Riding position offset for a vehicle (boat, minecart, horse, etc.)
 * Returns [x, y, z].
 * @param {number} v_x
 * @param {number} v_y
 * @param {number} v_z
 * @param {number} v_yaw
 * @param {string} v_kind
 * @param {number} v_type
 * @param {number} v_height
 * @param {string} rider_kind
 * @param {number} rider_index
 * @param {number} passenger_count
 * @returns {Float64Array}
 */
export function rider_position(v_x, v_y, v_z, v_yaw, v_kind, v_type, v_height, rider_kind, rider_index, passenger_count) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val3 = +v_x;
        const val4 = +v_y;
        const val5 = +v_z;
        const val6 = +v_yaw;
        const val7 = +v_type;
        const val8 = +v_height;
        const val9 = +rider_index;
        const val10 = +passenger_count;
        let ptr0, len0, ptr1, len1;
        try {
            ptr0 = passStringToWasm0(v_kind, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passStringToWasm0(rider_kind, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len1 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
            throw e;
        }
        wasm.rider_position(retptr, val3, val4, val5, val6, ptr0, len0, val7, val8, ptr1, len1, val9, val10);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v11 = getArrayF64FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 8, 8);
        return v11;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * `ScaffoldingBlock.getCollisionShape` with the native `isAbove` check.
 * `feet` is the mover's bounding-box minimum Y; `Infinity` models no mover.
 * @param {number} distance
 * @param {boolean} bottom
 * @param {number} feet
 * @param {number} y
 * @param {boolean} sneaking
 * @returns {Float64Array}
 */
export function scaffolding_collision(distance, bottom, feet, y, sneaking) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.scaffolding_collision(retptr, distance, bottom, feet, y, sneaking);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayF64FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 8, 8);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * `drawEffects`: the amplifier suffix key (`enchantment.level.N`) or an empty
 * string when there is none.
 * @param {number} amplifier
 * @returns {string}
 */
export function screen_containers_amplifier_key(amplifier) {
    let deferred1_0;
    let deferred1_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.screen_containers_amplifier_key(retptr, amplifier);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred1_0 = r0;
        deferred1_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
    }
}

/**
 * `AnvilScreen.drawForeground`: the repair-cost label colour.
 * @param {number} cost
 * @param {boolean} has_output
 * @param {number} xp_level
 * @param {boolean} creative
 * @returns {number}
 */
export function screen_containers_anvil_cost_color(cost, has_output, xp_level, creative) {
    const ret = wasm.screen_containers_anvil_cost_color(cost, has_output, xp_level, creative);
    return ret;
}

/**
 * `AnvilScreen` slot positions.
 * @returns {Int32Array}
 */
export function screen_containers_anvil_slots() {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.screen_containers_anvil_slots(retptr);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayI32FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * `BeaconScreen.drawOverlay`: the tooltip suffix for a tier-3 button.
 * @param {number} tier
 * @param {number} effect
 * @returns {string}
 */
export function screen_containers_beacon_button_suffix(tier, effect) {
    let deferred1_0;
    let deferred1_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.screen_containers_beacon_button_suffix(retptr, tier, effect);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred1_0 = r0;
        deferred1_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
    }
}

/**
 * `GuiBeacon.Button.drawButton`: the 22x22 frame `u` offset
 * (0 default, +22 selected, +44 disabled, +66 hovered).
 * @param {boolean} enabled
 * @param {boolean} selected
 * @param {boolean} hovered
 * @returns {number}
 */
export function screen_containers_beacon_button_u(enabled, selected, hovered) {
    const ret = wasm.screen_containers_beacon_button_u(enabled, selected, hovered);
    return ret;
}

/**
 * `BeaconScreen._buttons()`: the power button list.
 *
 * `levels`/`primary`/`secondary` are `field(0..2)`; `has_payment` mirrors
 * `!!this.container.get(0)`. Returns a JSON array of button records with the
 * same fields the JS version builds (`x`, `y`, `effect`, `tier`, `enabled`,
 * `selected`, plus `confirm`/`cancel`/`u`/`v` for the two footer buttons).
 * Coordinates are GUI-relative offsets, exactly as in JS minus `guiLeft`/
 * `guiTop`, which the caller adds back.
 * @param {number} levels
 * @param {number} primary
 * @param {number} secondary
 * @param {boolean} has_payment
 * @returns {string}
 */
export function screen_containers_beacon_buttons(levels, primary, secondary, has_payment) {
    let deferred1_0;
    let deferred1_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.screen_containers_beacon_buttons(retptr, levels, primary, secondary, has_payment);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred1_0 = r0;
        deferred1_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
    }
}

/**
 * `BeaconScreen.field(i)`: the locally overridden value wins over the
 * container property. `local` is `-1` for "not overridden".
 * @param {number} local
 * @param {number} property
 * @returns {number}
 */
export function screen_containers_beacon_field(local, property) {
    const ret = wasm.screen_containers_beacon_field(local, property);
    return ret;
}

/**
 * `BeaconScreen` slot positions: payment slot plus the player inventory.
 * @returns {Int32Array}
 */
export function screen_containers_beacon_slots() {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.screen_containers_beacon_slots(retptr);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayI32FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * `GuiEnchantment._drawBook`: the interpolated book angles for one frame.
 * Returns `[f3, f4, f5]` (`f3` = open amount, `f4`/`f5` = page flips).
 * @param {number} o_open
 * @param {number} open
 * @param {number} o_flip
 * @param {number} flip
 * @param {number} partial
 * @returns {Float64Array}
 */
export function screen_containers_book_angles(o_open, open, o_flip, flip, partial) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.screen_containers_book_angles(retptr, o_open, open, o_flip, flip, partial);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayF64FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 8, 8);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * `ModelBook.setRotationAngles(0, f4, f5, f3)`: the part rotations and the
 * shared X offset. Returns `[coverRightRy, coverLeftRy, pagesRightRy,
 * pagesLeftRy, flipRightRy, flipLeftRy, pagesX]` where `flipRightRy`/
 * `flipLeftRy` are the raw `f - f*2*f4` / `f - f*2*f5` values.
 * @param {number} f3
 * @param {number} f4
 * @param {number} f5
 * @returns {Float64Array}
 */
export function screen_containers_book_rotations(f3, f4, f5) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.screen_containers_book_rotations(retptr, f3, f4, f5);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayF64FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 8, 8);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * `BrewingScreen.drawBackground`: `[j1, b]` where `j1` is the brew-arrow
 * height and `b` the bubble height. Returns an empty vector when `t <= 0`.
 * @param {number} t
 * @returns {Int32Array}
 */
export function screen_containers_brewing_bubbles(t) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.screen_containers_brewing_bubbles(retptr, t);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayI32FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * `BrewingScreen.drawBackground`: the fuel bar width.
 * @param {number} fuel
 * @returns {number}
 */
export function screen_containers_brewing_fuel_width(fuel) {
    const ret = wasm.screen_containers_brewing_fuel_width(fuel);
    return ret;
}

/**
 * `BrewingScreen` slot positions.
 * @returns {Int32Array}
 */
export function screen_containers_brewing_slots() {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.screen_containers_brewing_slots(retptr);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayI32FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * `ContainerScreen.init()`: `guiLeft`/`guiTop` from the window and GUI size.
 * Returns `[guiLeft, guiTop]`.
 * @param {number} width
 * @param {number} height
 * @param {number} x_size
 * @param {number} y_size
 * @returns {Float64Array}
 */
export function screen_containers_center(width, height, x_size, y_size) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.screen_containers_center(retptr, width, height, x_size, y_size);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayF64FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 8, 8);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * `ChestScreen.drawBackground` Y offset of the second (player inventory)
 * sprite: `rows * 18 + 17`.
 * @param {number} rows
 * @returns {number}
 */
export function screen_containers_chest_lower_offset(rows) {
    const ret = wasm.screen_containers_chest_lower_offset(rows);
    return ret;
}

/**
 * `ChestScreen`: `rows = floor(size / 9)`, then the player inventory.
 * Returns `[ySize, ...flat slots]` so the caller gets the derived height too.
 * @param {number} size
 * @returns {Int32Array}
 */
export function screen_containers_chest_slots(size) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.screen_containers_chest_slots(retptr, size);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayI32FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * `creativeCatalog(game)`: builds the three lookup tables from the creative
 * data (the `tabs` array of `creative.json`).
 *
 * Returns JSON `{ tabs: {label: [items]}, tabOfId: {id: label},
 * enchantmentTabs: {enchantmentId: label}, labels: [...], indices: [...] }`.
 * @param {string} creative_json
 * @returns {string}
 */
export function screen_containers_creative_catalog(creative_json) {
    let deferred2_0;
    let deferred2_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const ptr0 = passStringToWasm0(creative_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.screen_containers_creative_catalog(retptr, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred2_0 = r0;
        deferred2_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred2_0, deferred2_1, 1);
    }
}

/**
 * `CreativeScreen.mouseDown` inventory-slot branch: which slots changed
 * enough to need a `sendCreativeSlot` round trip.
 *
 * `before_json` / `after_json` are JSON arrays of the copied stacks before
 * and after the click; `stackable_json` is a 0/1 array saying whether each
 * changed pair is stackable with equal counts. Returns the changed indices.
 * @param {string} before_json
 * @param {string} after_json
 * @param {string} same_stack_json
 * @returns {string}
 */
export function screen_containers_creative_changed_slots(before_json, after_json, same_stack_json) {
    let deferred4_0;
    let deferred4_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        let ptr0, len0, ptr1, len1, ptr2, len2;
        try {
            ptr0 = passStringToWasm0(before_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passStringToWasm0(after_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len1 = WASM_VECTOR_LEN;
            ptr2 = passStringToWasm0(same_stack_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len2 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr2) { wasm.__wbindgen_export3(ptr2, len2 * 1, 1); }
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
            throw e;
        }
        wasm.screen_containers_creative_changed_slots(retptr, ptr0, len0, ptr1, len1, ptr2, len2);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred4_0 = r0;
        deferred4_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred4_0, deferred4_1, 1);
    }
}

/**
 * `CreativeScreen.mouseDown`: the outside-drop branch.
 *
 * Returns `{ "slot": -1, "item": <stack> }` for the stack that should be sent
 * to creative slot `-1`, or `"null"` when nothing drops.
 * @param {number} btn
 * @param {boolean} outside
 * @param {boolean} tab_hit
 * @param {string} cursor_json
 * @returns {string}
 */
export function screen_containers_creative_drop(btn, outside, tab_hit, cursor_json) {
    let deferred5_0;
    let deferred5_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val2 = +btn;
        const val3 = +outside;
        const val4 = +tab_hit;
        const ptr0 = passStringToWasm0(cursor_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.screen_containers_creative_drop(retptr, val2, val3, val4, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred5_0 = r0;
        deferred5_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred5_0, deferred5_1, 1);
    }
}

/**
 * `CreativeScreen.mouseDown` grid-item branch.
 *
 * `cursor_json` is the cursor stack (`"null"` when empty), `item_json` the
 * grid item. Returns JSON `{ "cursor": <item or null>, "taken": bool }` with
 * the resulting cursor; `max_stack` is `items.maxStack(id)` for the item.
 * @param {string} cursor_json
 * @param {string} item_json
 * @param {number} btn
 * @param {boolean} shift
 * @param {number} max_stack_item
 * @param {number} max_stack_cursor
 * @param {boolean} stackable
 * @returns {string}
 */
export function screen_containers_creative_grid_click(cursor_json, item_json, btn, shift, max_stack_item, max_stack_cursor, stackable) {
    let deferred8_0;
    let deferred8_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val3 = +btn;
        const val4 = +shift;
        const val5 = +max_stack_item;
        const val6 = +max_stack_cursor;
        const val7 = +stackable;
        let ptr0, len0, ptr1, len1;
        try {
            ptr0 = passStringToWasm0(cursor_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passStringToWasm0(item_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len1 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
            throw e;
        }
        wasm.screen_containers_creative_grid_click(retptr, ptr0, len0, ptr1, len1, val3, val4, val5, val6, val7);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred8_0 = r0;
        deferred8_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred8_0, deferred8_1, 1);
    }
}

/**
 * `CreativeScreen.gridItemAt(mx, my)`.
 *
 * Returns JSON `{"idx":n,"x":px,"y":py,"visible":bool}` or `"null"` when the
 * point misses the 9x5 grid (or the tab is the survival inventory tab).
 * @param {boolean} is_inventory_tab
 * @param {number} gui_left
 * @param {number} gui_top
 * @param {number} mx
 * @param {number} my
 * @param {number} scroll
 * @param {number} list_len
 * @returns {string}
 */
export function screen_containers_creative_grid_item_at(is_inventory_tab, gui_left, gui_top, mx, my, scroll, list_len) {
    let deferred1_0;
    let deferred1_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.screen_containers_creative_grid_item_at(retptr, is_inventory_tab, gui_left, gui_top, mx, my, scroll, list_len);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred1_0 = r0;
        deferred1_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
    }
}

/**
 * `CreativeScreen.render`: the first visible list index
 * (`round(scroll * maxScrollRows()) * 9`).
 * @param {number} scroll
 * @param {number} max_rows
 * @returns {number}
 */
export function screen_containers_creative_grid_start(scroll, max_rows) {
    const ret = wasm.screen_containers_creative_grid_start(scroll, max_rows);
    return ret;
}

/**
 * `CreativeScreen.key`: whether a number key over the grid/inventory should
 * pull the item into the hotbar, and what the two swapped stacks are.
 *
 * `grid_item_json` is `"null"` when the cursor is not over a grid item.
 * Returns JSON `{ "action": "grid"|"swap"|"none", "item": .., "before": ..,
 * "cur": .. }`.
 * @param {string} grid_item_json
 * @param {number} slot
 * @param {number} hotbar_slot
 * @param {string} slot_item_json
 * @param {number} max_stack_grid
 * @param {boolean} locked
 * @returns {string}
 */
export function screen_containers_creative_hotbar_key(grid_item_json, slot, hotbar_slot, slot_item_json, max_stack_grid, locked) {
    let deferred7_0;
    let deferred7_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val3 = +slot;
        const val4 = +hotbar_slot;
        const val5 = +max_stack_grid;
        const val6 = +locked;
        let ptr0, len0, ptr1, len1;
        try {
            ptr0 = passStringToWasm0(grid_item_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passStringToWasm0(slot_item_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len1 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
            throw e;
        }
        wasm.screen_containers_creative_hotbar_key(retptr, ptr0, len0, val3, val4, ptr1, len1, val5, val6);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred7_0 = r0;
        deferred7_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred7_0, deferred7_1, 1);
    }
}

/**
 * `CreativeScreen._layout()`: the player-inventory slot list (which is the
 * whole layout on every tab except `inventory`).
 *
 * `inventory` mirrors `tabLabel() === 'inventory'`: when true the armor 2x2
 * and off-hand slots are added ahead of the main inventory and hotbar.
 * @param {boolean} inventory
 * @returns {Int32Array}
 */
export function screen_containers_creative_layout(inventory) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.screen_containers_creative_layout(retptr, inventory);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayI32FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * `creativeLocked(it)`: `it.locked || it.nbt.v.CustomCreativeLock`.
 * @param {string} item_json
 * @returns {boolean}
 */
export function screen_containers_creative_locked(item_json) {
    const ptr0 = passStringToWasm0(item_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.screen_containers_creative_locked(ptr0, len0);
    return ret !== 0;
}

/**
 * `CreativeScreen.render`: whether the point is over the survival tab's
 * destroy-item highlight rect (the `dx, dy = 173, 112` sprite test).
 * @param {number} gui_left
 * @param {number} gui_top
 * @param {number} mx
 * @param {number} my
 * @returns {boolean}
 */
export function screen_containers_creative_on_destroy_rect(gui_left, gui_top, mx, my) {
    const ret = wasm.screen_containers_creative_on_destroy_rect(gui_left, gui_top, mx, my);
    return ret !== 0;
}

/**
 * `CreativeScreen.render`: whether the mouse is over the survival tab's
 * destroy-item slot (`L+172..L+190`, `T+111..T+129`).
 * @param {number} gui_left
 * @param {number} gui_top
 * @param {number} mx
 * @param {number} my
 * @returns {boolean}
 */
export function screen_containers_creative_on_destroy_slot(gui_left, gui_top, mx, my) {
    const ret = wasm.screen_containers_creative_on_destroy_slot(gui_left, gui_top, mx, my);
    return ret !== 0;
}

/**
 * `CreativeScreen.mouseDown`: whether the point is on the scrollbar track
 * (`mx` in `[L+175, L+187)`, `my` in `[T+18, T+130)`).
 * @param {number} gui_left
 * @param {number} gui_top
 * @param {number} mx
 * @param {number} my
 * @returns {boolean}
 */
export function screen_containers_creative_on_scrollbar(gui_left, gui_top, mx, my) {
    const ret = wasm.screen_containers_creative_on_scrollbar(gui_left, gui_top, mx, my);
    return ret !== 0;
}

/**
 * `CreativeScreen._scrollTo(my)`: the scroll fraction for a thumb drag.
 * @param {number} gui_top
 * @param {number} my
 * @returns {number}
 */
export function screen_containers_creative_scroll_to(gui_top, my) {
    const ret = wasm.screen_containers_creative_scroll_to(gui_top, my);
    return ret;
}

/**
 * `CreativeScreen.render`: the creative scrollbar thumb position
 * `[sx, sy, u]`.
 * @param {number} gui_left
 * @param {number} gui_top
 * @param {number} scroll
 * @param {number} max_rows
 * @returns {Float64Array}
 */
export function screen_containers_creative_scrollbar(gui_left, gui_top, scroll, max_rows) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.screen_containers_creative_scrollbar(retptr, gui_left, gui_top, scroll, max_rows);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayF64FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 8, 8);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * `CreativeScreen.setTab`: the chat-key tab index used by `key()`.
 * @returns {number}
 */
export function screen_containers_creative_search_tab_index() {
    const ret = wasm.screen_containers_creative_search_tab_index();
    return ret;
}

/**
 * `CreativeScreen._tabAt(mx, my)`: the tab index under the cursor, or `-1`.
 *
 * `tabs_json` is the output of [`screen_containers_tab_meta`].
 * @param {string} tabs_json
 * @param {number} gui_left
 * @param {number} gui_top
 * @param {number} x_size
 * @param {number} y_size
 * @param {number} mx
 * @param {number} my
 * @returns {number}
 */
export function screen_containers_creative_tab_at(tabs_json, gui_left, gui_top, x_size, y_size, mx, my) {
    const val2 = +gui_left;
    const val3 = +gui_top;
    const val4 = +x_size;
    const val5 = +y_size;
    const val6 = +mx;
    const val7 = +my;
    const ptr0 = passStringToWasm0(tabs_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.screen_containers_creative_tab_at(ptr0, len0, val2, val3, val4, val5, val6, val7);
    return ret;
}

/**
 * `CreativeScreen._drawTab`: the tab icon position `[ix, iy]`.
 * @param {number} tab_x
 * @param {number} tab_y
 * @param {boolean} top
 * @returns {Float64Array}
 */
export function screen_containers_creative_tab_icon_pos(tab_x, tab_y, top) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.screen_containers_creative_tab_icon_pos(retptr, tab_x, tab_y, top);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayF64FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 8, 8);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * `creativeTabOf(game, id)`: the first tab listing the id, else `"misc"`.
 * @param {string} catalog_json
 * @param {bigint} id
 * @returns {string}
 */
export function screen_containers_creative_tab_of(catalog_json, id) {
    let deferred3_0;
    let deferred3_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val2 = BigInt.asIntN(64, id);
        const ptr0 = passStringToWasm0(catalog_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.screen_containers_creative_tab_of(retptr, ptr0, len0, val2);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred3_0 = r0;
        deferred3_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred3_0, deferred3_1, 1);
    }
}

/**
 * `CreativeScreen._tabRect(t)`: the tab sprite rectangle.
 * Returns `[x, y, col, top]` in screen coordinates.
 * @param {number} gui_left
 * @param {number} gui_top
 * @param {number} x_size
 * @param {number} y_size
 * @param {number} column
 * @param {boolean} top
 * @param {boolean} right
 * @returns {Float64Array}
 */
export function screen_containers_creative_tab_rect(gui_left, gui_top, x_size, y_size, column, top, right) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.screen_containers_creative_tab_rect(retptr, gui_left, gui_top, x_size, y_size, column, top, right);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayF64FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 8, 8);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * `CreativeScreen._drawTab`: the sprite `v` offset (0 or 64, +32 selected).
 * @param {boolean} top
 * @param {boolean} selected
 * @returns {number}
 */
export function screen_containers_creative_tab_v(top, selected) {
    const ret = wasm.screen_containers_creative_tab_v(top, selected);
    return ret;
}

/**
 * `CreativeScreen.wheel(d)`: the new scroll fraction.
 * @param {number} scroll
 * @param {number} d
 * @param {number} max_rows
 * @returns {number}
 */
export function screen_containers_creative_wheel(scroll, d, max_rows) {
    const ret = wasm.screen_containers_creative_wheel(scroll, d, max_rows);
    return ret;
}

/**
 * `ContainerScreen.render` drag-split preview for one slot.
 *
 * Returns JSON `{"show":bool,"count":n,"countText":str|null}` where `count`
 * is the previewed stack size and `countText` the `§eN` overflow label.
 * @param {number} drag_limit
 * @param {number} cursor_count
 * @param {number} drag_slots
 * @param {number} item_count
 * @param {number} max_stack
 * @param {boolean} can_add
 * @param {boolean} is_valid
 * @returns {string}
 */
export function screen_containers_drag_preview(drag_limit, cursor_count, drag_slots, item_count, max_stack, can_add, is_valid) {
    let deferred1_0;
    let deferred1_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.screen_containers_drag_preview(retptr, drag_limit, cursor_count, drag_slots, item_count, max_stack, can_add, is_valid);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred1_0 = r0;
        deferred1_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
    }
}

/**
 * `ContainerScreen.render` cursor-item remainder while drag splitting.
 *
 * `slot_item_counts` are the current counts in each drag slot (0 for empty).
 * Returns `[left, text]` where `text` is `"§e0"` when nothing would be left.
 * @param {number} cursor_count
 * @param {number} drag_limit
 * @param {number} max_stack_cursor
 * @param {Int32Array | number[]} slot_item_counts
 * @returns {string}
 */
export function screen_containers_drag_remainder(cursor_count, drag_limit, max_stack_cursor, slot_item_counts) {
    let deferred5_0;
    let deferred5_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val2 = +cursor_count;
        const val3 = +drag_limit;
        const val4 = +max_stack_cursor;
        const ptr0 = passArray32ToWasm0(slot_item_counts, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.screen_containers_drag_remainder(retptr, val2, val3, val4, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred5_0 = r0;
        deferred5_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred5_0, deferred5_1, 1);
    }
}

/**
 * `ContainerScreen.key`: the drop-key action.
 * Returns `-1` for "not the drop key", otherwise the button (`1` for ctrl).
 * @param {string} code
 * @param {string} drop_code
 * @param {boolean} ctrl
 * @returns {number}
 */
export function screen_containers_drop_button(code, drop_code, ctrl) {
    const val3 = +ctrl;
    let ptr0, len0, ptr1, len1;
    try {
        ptr0 = passStringToWasm0(code, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        len0 = WASM_VECTOR_LEN;
        ptr1 = passStringToWasm0(drop_code, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        len1 = WASM_VECTOR_LEN;
    } catch (e) {
        if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
        if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
        throw e;
    }
    const ret = wasm.screen_containers_drop_button(ptr0, len0, ptr1, len1, val3);
    return ret;
}

/**
 * `drawEffects`: the duration label. `"**:**"` above 32767 ticks, otherwise
 * `M:SS` with the seconds zero-padded to two digits.
 * @param {number} duration
 * @returns {string}
 */
export function screen_containers_effect_duration(duration) {
    let deferred1_0;
    let deferred1_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.screen_containers_effect_duration(retptr, duration);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred1_0 = r0;
        deferred1_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
    }
}

/**
 * `drawEffects`/`BeaconScreen`: the localization key of an effect id from the
 * creative data, or `effect.none` when the id is unknown.
 * @param {string} creative_json
 * @param {number} id
 * @returns {string}
 */
export function screen_containers_effect_key(creative_json, id) {
    let deferred3_0;
    let deferred3_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val2 = +id;
        const ptr0 = passStringToWasm0(creative_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.screen_containers_effect_key(retptr, ptr0, len0, val2);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred3_0 = r0;
        deferred3_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred3_0, deferred3_1, 1);
    }
}

/**
 * `drawEffects`: the vertical step between effect rows
 * (`33`, or `floor(132 / (n - 1))` when there are more than five).
 * @param {number} n
 * @returns {number}
 */
export function screen_containers_effects_dy(n) {
    const ret = wasm.screen_containers_effects_dy(n);
    return ret;
}

/**
 * `InventoryEffectRenderer` shift used by `InventoryScreen.init` and
 * `CreativeScreen.init`: `floor(160 + (width - xSize - 200) / 2)`.
 * @param {number} width
 * @param {number} x_size
 * @returns {number}
 */
export function screen_containers_effects_shift_left(width, x_size) {
    const ret = wasm.screen_containers_effects_shift_left(width, x_size);
    return ret;
}

/**
 * `EnchantmentNameParts` reseeded from `xpSeed`: the three clue strings.
 *
 * The JS builds `JavaRandom(seed)`, then for each of the three lines draws
 * `nextInt(2) + 3` words from `NAME_PARTS`. `widths` are the wrapped-line
 * budgets (`86 - textWidth(cost)`) supplied by the caller, since text
 * measurement stays in JS. Word selection happens here; wrapping is done by
 * [`screen_containers_wrap_clue`].
 * @param {bigint} seed
 * @returns {string}
 */
export function screen_containers_enchant_clues(seed) {
    let deferred1_0;
    let deferred1_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.screen_containers_enchant_clues(retptr, seed);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred1_0 = r0;
        deferred1_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
    }
}

/**
 * `EnchantScreen.drawBackground` / `drawOverlay` base colours.
 * @param {number} variant
 * @returns {Int32Array}
 */
export function screen_containers_enchant_colors(variant) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.screen_containers_enchant_colors(retptr, variant);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayI32FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * `EnchantScreen.drawBackground`: whether a level row is affordable, which
 * selects the grey (unaffordable) or normal sprite.
 * @param {number} lapis_count
 * @param {number} level_index
 * @param {number} xp_level
 * @param {number} cost
 * @param {boolean} creative
 * @returns {boolean}
 */
export function screen_containers_enchant_enabled(lapis_count, level_index, xp_level, cost, creative) {
    const ret = wasm.screen_containers_enchant_enabled(lapis_count, level_index, xp_level, cost, creative);
    return ret !== 0;
}

/**
 * `EnchantScreen.drawOverlay`: the tooltip line prefix codes.
 * @param {number} lapis_count
 * @param {number} k
 * @returns {string}
 */
export function screen_containers_enchant_overlay_line(lapis_count, k) {
    let deferred1_0;
    let deferred1_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.screen_containers_enchant_overlay_line(retptr, lapis_count, k);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred1_0 = r0;
        deferred1_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
    }
}

/**
 * `EnchantScreen` slot positions.
 * @returns {Int32Array}
 */
export function screen_containers_enchant_slots() {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.screen_containers_enchant_slots(retptr);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayI32FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

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
 * @param {number} flip
 * @param {number} _o_flip
 * @param {number} flip_t
 * @param {number} flip_a
 * @param {number} open
 * @param {number} _o_open
 * @param {string} last_item
 * @param {string} item_key
 * @param {number} p0
 * @param {number} p1
 * @param {number} p2
 * @param {number} roll
 * @returns {string}
 */
export function screen_containers_enchant_tick(flip, _o_flip, flip_t, flip_a, open, _o_open, last_item, item_key, p0, p1, p2, roll) {
    let deferred13_0;
    let deferred13_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val3 = +flip;
        const val4 = +_o_flip;
        const val5 = +flip_t;
        const val6 = +flip_a;
        const val7 = +open;
        const val8 = +_o_open;
        const val9 = +p0;
        const val10 = +p1;
        const val11 = +p2;
        const val12 = +roll;
        let ptr0, len0, ptr1, len1;
        try {
            ptr0 = passStringToWasm0(last_item, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passStringToWasm0(item_key, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len1 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
            throw e;
        }
        wasm.screen_containers_enchant_tick(retptr, val3, val4, val5, val6, val7, val8, ptr0, len0, ptr1, len1, val9, val10, val11, val12);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred13_0 = r0;
        deferred13_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred13_0, deferred13_1, 1);
    }
}

/**
 * `FurnaceScreen.drawBackground`: the cook progress arrow width.
 * Returns `l + 1`.
 * @param {number} cook
 * @param {number} total_cook
 * @returns {number}
 */
export function screen_containers_furnace_cook(cook, total_cook) {
    const ret = wasm.screen_containers_furnace_cook(cook, total_cook);
    return ret;
}

/**
 * `FurnaceScreen.drawBackground`: the burn flame.
 * Returns `[k, srcY, srcH]` or an empty vector when `burn <= 0`.
 * @param {number} burn
 * @param {number} total
 * @returns {Int32Array}
 */
export function screen_containers_furnace_flame(burn, total) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.screen_containers_furnace_flame(retptr, burn, total);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayI32FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * `FurnaceScreen` slot positions: `[[0,56,17],[1,56,53],[2,116,35]]`.
 * @returns {Int32Array}
 */
export function screen_containers_furnace_slots() {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.screen_containers_furnace_slots(retptr);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayI32FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * `FurnaceScreen`: the texture name for a furnace-like window type.
 * @param {string} win_type
 * @returns {string}
 */
export function screen_containers_furnace_texture(win_type) {
    let deferred2_0;
    let deferred2_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const ptr0 = passStringToWasm0(win_type, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.screen_containers_furnace_texture(retptr, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred2_0 = r0;
        deferred2_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred2_0, deferred2_1, 1);
    }
}

/**
 * `HorseScreen`: two horse slots, an optional 3x5 chest, player inventory.
 * `chest` mirrors `win.size > 2`.
 * @param {number} size
 * @param {boolean} chest
 * @returns {Int32Array}
 */
export function screen_containers_horse_slots(size, chest) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.screen_containers_horse_slots(retptr, size, chest);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayI32FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * `fromJson` reviver: validates and unwraps the `{$ta, a}` / `{$big}`
 * envelope. Returns JSON, or `"null"` for an invalid payload (the JS throws).
 * @param {string} saved_json
 * @returns {string}
 */
export function screen_containers_hotbar_from_json(saved_json) {
    let deferred2_0;
    let deferred2_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const ptr0 = passStringToWasm0(saved_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.screen_containers_hotbar_from_json(retptr, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred2_0 = r0;
        deferred2_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred2_0, deferred2_1, 1);
    }
}

/**
 * `ContainerScreen.key`: the hotbar-swap decision.
 *
 * Returns the hotbar index `0..9` that the key matched, or `-1`.
 * @param {string} code
 * @param {string} hotbar_codes_json
 * @returns {number}
 */
export function screen_containers_hotbar_key(code, hotbar_codes_json) {
    let ptr0, len0, ptr1, len1;
    try {
        ptr0 = passStringToWasm0(code, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        len0 = WASM_VECTOR_LEN;
        ptr1 = passStringToWasm0(hotbar_codes_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        len1 = WASM_VECTOR_LEN;
    } catch (e) {
        if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
        if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
        throw e;
    }
    const ret = wasm.screen_containers_hotbar_key(ptr0, len0, ptr1, len1);
    return ret;
}

/**
 * `handleHotbarSnapshots`: the load branch's per-slot payloads
 * (`creativeCopy(list[n][i])` for `36 + i`), as JSON.
 * @param {string} list_json
 * @param {number} n
 * @returns {string}
 */
export function screen_containers_hotbar_load_payload(list_json, n) {
    let deferred3_0;
    let deferred3_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val2 = +n;
        const ptr0 = passStringToWasm0(list_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.screen_containers_hotbar_load_payload(retptr, ptr0, len0, val2);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred3_0 = r0;
        deferred3_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred3_0, deferred3_1, 1);
    }
}

/**
 * `CreativeScreen.setTab` on the `hotbar` tab: the list for one empty saved
 * bar, where the placeholder paper sits at column `n` of its own row.
 *
 * `paper_id` is `game.items.byName.get('paper').id` and `name_json` the
 * already-serialized `inventory.hotbarInfo` translate component.
 * @param {number} n
 * @param {bigint} paper_id
 * @param {string} name_json
 * @returns {string}
 */
export function screen_containers_hotbar_placeholder(n, paper_id, name_json) {
    let deferred4_0;
    let deferred4_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val2 = +n;
        const val3 = BigInt.asIntN(64, paper_id);
        const ptr0 = passStringToWasm0(name_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.screen_containers_hotbar_placeholder(retptr, val2, val3, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred4_0 = r0;
        deferred4_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred4_0, deferred4_1, 1);
    }
}

/**
 * `handleHotbarSnapshots`: the save branch — copies the nine hotbar stacks,
 * nulling locked ones, into slot `n` of the list.
 * @param {string} list_json
 * @param {number} n
 * @param {string} main_json
 * @returns {string}
 */
export function screen_containers_hotbar_save_payload(list_json, n, main_json) {
    let deferred4_0;
    let deferred4_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val3 = +n;
        let ptr0, len0, ptr1, len1;
        try {
            ptr0 = passStringToWasm0(list_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passStringToWasm0(main_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len1 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
            throw e;
        }
        wasm.screen_containers_hotbar_save_payload(retptr, ptr0, len0, val3, ptr1, len1);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred4_0 = r0;
        deferred4_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred4_0, deferred4_1, 1);
    }
}

/**
 * `hotbarSnapshots()`: validates and copies the stored toolbars.
 *
 * `saved_json` is the raw stored string (`null` when absent). Returns JSON
 * `[bar][slot] -> item|null`, always nine by nine.
 * @param {string} saved_json
 * @returns {string}
 */
export function screen_containers_hotbar_snapshots(saved_json) {
    let deferred2_0;
    let deferred2_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const ptr0 = passStringToWasm0(saved_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.screen_containers_hotbar_snapshots(retptr, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred2_0 = r0;
        deferred2_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred2_0, deferred2_1, 1);
    }
}

/**
 * `CreativeScreen.setTab` on the `hotbar` tab: concatenates the nine bars,
 * substituting placeholders for empty ones.
 *
 * `paper_id`/`names_json` (a nine-element array of the serialized
 * `inventory.hotbarInfo` components) are supplied by the JS side.
 * @param {string} snapshots_json
 * @param {bigint} paper_id
 * @param {string} names_json
 * @returns {string}
 */
export function screen_containers_hotbar_tab_list(snapshots_json, paper_id, names_json) {
    let deferred4_0;
    let deferred4_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val3 = BigInt.asIntN(64, paper_id);
        let ptr0, len0, ptr1, len1;
        try {
            ptr0 = passStringToWasm0(snapshots_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passStringToWasm0(names_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len1 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
            throw e;
        }
        wasm.screen_containers_hotbar_tab_list(retptr, ptr0, len0, val3, ptr1, len1);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred4_0 = r0;
        deferred4_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred4_0, deferred4_1, 1);
    }
}

/**
 * `toJson` replacer: rewrites `ArrayBuffer` views and `bigint` values into the
 * `{$ta, a}` / `{$big}` envelope the loader understands.
 *
 * `value_json` is plain JSON; `typed_arrays_json` is a parallel map of
 * pointer-free paths to typed-array payloads the JS side supplies, since Rust
 * has no access to the live buffers.
 * @param {string} value_json
 * @returns {string}
 */
export function screen_containers_hotbar_to_json(value_json) {
    let deferred2_0;
    let deferred2_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const ptr0 = passStringToWasm0(value_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.screen_containers_hotbar_to_json(retptr, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred2_0 = r0;
        deferred2_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred2_0, deferred2_1, 1);
    }
}

/**
 * The `HOTBARS_KEY` storage key.
 * @returns {string}
 */
export function screen_containers_hotbars_key() {
    let deferred1_0;
    let deferred1_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.screen_containers_hotbars_key(retptr);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred1_0 = r0;
        deferred1_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
    }
}

/**
 * `InventoryScreen` (ContainerPlayer 1.9+): result, 2x2 crafting grid, armor,
 * player inventory, off hand.
 * @returns {Int32Array}
 */
export function screen_containers_inventory_slots() {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.screen_containers_inventory_slots(retptr);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayI32FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * `ContainerScreen.isOutside(mx, my)`.
 * @param {number} mx
 * @param {number} my
 * @param {number} gui_left
 * @param {number} gui_top
 * @param {number} x_size
 * @param {number} y_size
 * @returns {boolean}
 */
export function screen_containers_is_outside(mx, my, gui_left, gui_top, x_size, y_size) {
    const ret = wasm.screen_containers_is_outside(mx, my, gui_left, gui_top, x_size, y_size);
    return ret !== 0;
}

/**
 * `CreativeScreen._refreshCatalog` / `setTab`: the search-tab reset rule —
 * the query is preserved only when staying on the search tab.
 * @param {string} new_label
 * @returns {boolean}
 */
export function screen_containers_keep_search_query(new_label) {
    const ptr0 = passStringToWasm0(new_label, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.screen_containers_keep_search_query(ptr0, len0);
    return ret !== 0;
}

/**
 * The `openContainerScreen` switch for the simple in-line layouts.
 *
 * Returns a JSON object `{ kind, tex, titleX, titleY, xSize, ySize, invX,
 * invY, hotbarY, slots }` describing the `SimpleScreen` subclass (or chest /
 * horse) that the caller should construct. The workstation screens created by
 * `createWorkstationScreen` and the recipe-book wrappers stay in JS; the
 * caller keeps its early-return for those.
 * @param {string} win_type
 * @param {number} size
 * @returns {string}
 */
export function screen_containers_layout_for(win_type, size) {
    let deferred3_0;
    let deferred3_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val2 = +size;
        const ptr0 = passStringToWasm0(win_type, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.screen_containers_layout_for(retptr, ptr0, len0, val2);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred3_0 = r0;
        deferred3_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred3_0, deferred3_1, 1);
    }
}

/**
 * `CreativeScreen.filter` entry point: does this item match the query?
 *
 * A convenience wrapper combining [`screen_containers_parse_search_query`],
 * [`screen_containers_tag_query_hit`] and [`screen_containers_search_hit`].
 * @param {string} raw_query
 * @param {bigint} item_id
 * @param {string | null | undefined} def_name
 * @param {string} tooltip_json
 * @param {string} item_tags_json
 * @returns {boolean}
 */
export function screen_containers_matches(raw_query, item_id, def_name, tooltip_json, item_tags_json) {
    const val5 = BigInt.asIntN(64, item_id);
    let ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3;
    try {
        ptr0 = passStringToWasm0(raw_query, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        len0 = WASM_VECTOR_LEN;
        ptr1 = isLikeNone(def_name) ? 0 : passStringToWasm0(def_name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        len1 = WASM_VECTOR_LEN;
        ptr2 = passStringToWasm0(tooltip_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        len2 = WASM_VECTOR_LEN;
        ptr3 = passStringToWasm0(item_tags_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        len3 = WASM_VECTOR_LEN;
    } catch (e) {
        if (ptr3) { wasm.__wbindgen_export3(ptr3, len3 * 1, 1); }
        if (ptr2) { wasm.__wbindgen_export3(ptr2, len2 * 1, 1); }
        if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
        if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
        throw e;
    }
    const ret = wasm.screen_containers_matches(ptr0, len0, val5, ptr1, len1, ptr2, len2, ptr3, len3);
    return ret !== 0;
}

/**
 * `CreativeScreen.maxScrollRows()`.
 * @param {number} list_len
 * @returns {number}
 */
export function screen_containers_max_scroll_rows(list_len) {
    const ret = wasm.screen_containers_max_scroll_rows(list_len);
    return ret;
}

/**
 * `ContainerScreen.mouseDown` state machine (the part after the widget and
 * `extraMouseDown` hooks).
 *
 * `dom_button` is the DOM button (0 left, 1 middle, 2 right); `slot` is the
 * `slotAt` result (`-1` for `null`); `inside` is `!isOutside(mx, my)`;
 * `has_cursor` is `!!this.inv.cursor`; `now` the platform time.
 * Returns the JSON decided by [`mouse_down_result`].
 * @param {number} dom_button
 * @param {number} slot
 * @param {boolean} inside
 * @param {boolean} has_cursor
 * @param {boolean} shift
 * @param {number} now
 * @param {number} last_click_slot
 * @param {number} last_click_time
 * @param {number} last_click_button
 * @param {boolean} drag_splitting
 * @returns {string}
 */
export function screen_containers_mouse_down(dom_button, slot, inside, has_cursor, shift, now, last_click_slot, last_click_time, last_click_button, drag_splitting) {
    let deferred1_0;
    let deferred1_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.screen_containers_mouse_down(retptr, dom_button, slot, inside, has_cursor, shift, now, last_click_slot, last_click_time, last_click_button, drag_splitting);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred1_0 = r0;
        deferred1_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
    }
}

/**
 * `ContainerScreen.mouseUp` state machine.
 *
 * Returns JSON `{ clicks: [{slotId, button, mode}], doubleClick, dragSplitting,
 * ignoreMouseUp, lastClickTime, dropCursor }`. `clicks` are the
 * `handleClick` calls in order. The double-click shift-merge scan is provided
 * separately by [`screen_containers_double_click_merge`] because it needs the
 * container's slot rules.
 * @param {number} dom_button
 * @param {number} slot
 * @param {boolean} inside
 * @param {boolean} shift
 * @param {boolean} _has_cursor
 * @param {boolean} cursor_survives
 * @param {boolean} double_click
 * @param {boolean} drag_splitting
 * @param {number} drag_button
 * @param {Int32Array | number[]} drag_slots
 * @param {boolean} ignore_mouse_up
 * @param {boolean} can_merge_slot
 * @returns {string}
 */
export function screen_containers_mouse_up(dom_button, slot, inside, shift, _has_cursor, cursor_survives, double_click, drag_splitting, drag_button, drag_slots, ignore_mouse_up, can_merge_slot) {
    let deferred13_0;
    let deferred13_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val2 = +dom_button;
        const val3 = +slot;
        const val4 = +inside;
        const val5 = +shift;
        const val6 = +_has_cursor;
        const val7 = +cursor_survives;
        const val8 = +double_click;
        const val9 = +drag_splitting;
        const val10 = +drag_button;
        const val11 = +ignore_mouse_up;
        const val12 = +can_merge_slot;
        const ptr0 = passArray32ToWasm0(drag_slots, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.screen_containers_mouse_up(retptr, val2, val3, val4, val5, val6, val7, val8, val9, val10, ptr0, len0, val11, val12);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred13_0 = r0;
        deferred13_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred13_0, deferred13_1, 1);
    }
}

/**
 * `CreativeScreen.filter`: the query parsing step.
 *
 * Splits `q` into the `#` tag query, the namespace and the term, applying the
 * `'minecraft'.includes(...)` namespace test from the JS.
 * Returns `{"tag":bool,"term":str,"namespaceOk":bool,"empty":bool}`.
 * @param {string} raw
 * @returns {string}
 */
export function screen_containers_parse_search_query(raw) {
    let deferred2_0;
    let deferred2_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const ptr0 = passStringToWasm0(raw, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.screen_containers_parse_search_query(retptr, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred2_0 = r0;
        deferred2_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred2_0, deferred2_1, 1);
    }
}

/**
 * `playerInvSlots(start, x0, y0, hotbarY)`.
 *
 * Returns a flat `Vec<i32>` of `[slot, x, y]` triples (the JS version returns
 * an array of 3-element arrays; a flat vector keeps the wasm boundary simple).
 * @param {number} start
 * @param {number} x0
 * @param {number} y0
 * @param {number} hotbar_y
 * @returns {Int32Array}
 */
export function screen_containers_player_inv_slots(start, x0, y0, hotbar_y) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.screen_containers_player_inv_slots(retptr, start, x0, y0, hotbar_y);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayI32FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * `drawEffects`: `POTION_ICON` lookup for an effect id, `-1` when absent.
 * @param {number} id
 * @returns {number}
 */
export function screen_containers_potion_icon(id) {
    const ret = wasm.screen_containers_potion_icon(id);
    return ret;
}

/**
 * `ContainerScreen.mouseUp` quickcraft emission for a multi-slot drag.
 *
 * Returns JSON `[{slotId, button, mode}]`: the stage-0 begin, one stage-1
 * entry per drag slot, and the stage-2 end — exactly the JS sequence.
 * @param {number} drag_limit
 * @param {Int32Array | number[]} drag_slots
 * @returns {string}
 */
export function screen_containers_quickcraft_clicks(drag_limit, drag_slots) {
    let deferred3_0;
    let deferred3_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val2 = +drag_limit;
        const ptr0 = passArray32ToWasm0(drag_slots, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.screen_containers_quickcraft_clicks(retptr, val2, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred3_0 = r0;
        deferred3_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred3_0, deferred3_1, 1);
    }
}

/**
 * `withRecipeBook`: the recipe-book button rectangle
 * `[x, y, w, h]` from the button offsets and the screen height.
 * @param {number} gui_left
 * @param {number} height
 * @param {number} bx
 * @param {number} by
 * @returns {Float64Array}
 */
export function screen_containers_recipe_button(gui_left, height, bx, by) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.screen_containers_recipe_button(retptr, gui_left, height, bx, by);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayF64FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 8, 8);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * `GuiButtonImage` hover row for the recipe-book button: `v + 19` when
 * hovered, `v` otherwise.
 * @param {number} v
 * @param {boolean} hovered
 * @returns {number}
 */
export function screen_containers_recipe_button_v(v, hovered) {
    const ret = wasm.screen_containers_recipe_button_v(v, hovered);
    return ret;
}

/**
 * `ContainerScreen.mouseUp` double-click shift-merge: whether slot `i`
 * belongs to the same inventory as the clicked slot
 * (`(c.slots[i].playerIndex !== undefined) === (c.slots[slot].playerIndex !== undefined)`).
 * @param {boolean} i_has_player_index
 * @param {boolean} slot_has_player_index
 * @returns {boolean}
 */
export function screen_containers_same_inventory(i_has_player_index, slot_has_player_index) {
    const ret = wasm.screen_containers_same_inventory(i_has_player_index, slot_has_player_index);
    return ret !== 0;
}

/**
 * `saveHotbarSnapshots(list)`: the wrapper written to storage.
 *
 * Returns JSON `{version, minecraftVersion, protocol, dataVersion, bars}`.
 * @param {string} list_json
 * @returns {string}
 */
export function screen_containers_save_hotbar_snapshots(list_json) {
    let deferred2_0;
    let deferred2_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const ptr0 = passStringToWasm0(list_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.screen_containers_save_hotbar_snapshots(retptr, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred2_0 = r0;
        deferred2_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred2_0, deferred2_1, 1);
    }
}

/**
 * `CreativeScreen.init`: the search field rectangle `[x, y, w, h]`.
 * @param {number} gui_left
 * @param {number} gui_top
 * @returns {Float64Array}
 */
export function screen_containers_search_field(gui_left, gui_top) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.screen_containers_search_field(retptr, gui_left, gui_top);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayF64FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 8, 8);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * `CreativeScreen.filter`: the whole match test for one item.
 *
 * `def_name` is `items.def(id).name`, `tooltip_lines` the item's tooltip
 * lines (formatting codes are stripped here, as `stripCodes` does in JS).
 * @param {string} query_json
 * @param {string | null | undefined} def_name
 * @param {string} tooltip_lines
 * @returns {boolean}
 */
export function screen_containers_search_hit(query_json, def_name, tooltip_lines) {
    let ptr0, len0, ptr1, len1, ptr2, len2;
    try {
        ptr0 = passStringToWasm0(query_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        len0 = WASM_VECTOR_LEN;
        ptr1 = isLikeNone(def_name) ? 0 : passStringToWasm0(def_name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        len1 = WASM_VECTOR_LEN;
        ptr2 = passStringToWasm0(tooltip_lines, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        len2 = WASM_VECTOR_LEN;
    } catch (e) {
        if (ptr2) { wasm.__wbindgen_export3(ptr2, len2 * 1, 1); }
        if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
        if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
        throw e;
    }
    const ret = wasm.screen_containers_search_hit(ptr0, len0, ptr1, len1, ptr2, len2);
    return ret !== 0;
}

/**
 * `CreativeScreen._tooltip`: the extra group / tag lines inserted at index 1
 * on the search tab.
 *
 * Returns a JSON array of the lines to splice in, in JS order (the group line
 * first, then the `§5#tag` lines).
 * @param {string | null | undefined} group
 * @param {string} tag_lines
 * @returns {string}
 */
export function screen_containers_search_tooltip_lines(group, tag_lines) {
    let deferred3_0;
    let deferred3_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        let ptr0, len0, ptr1, len1;
        try {
            ptr0 = isLikeNone(group) ? 0 : passStringToWasm0(group, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passStringToWasm0(tag_lines, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len1 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
            throw e;
        }
        wasm.screen_containers_search_tooltip_lines(retptr, ptr0, len0, ptr1, len1);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred3_0 = r0;
        deferred3_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred3_0, deferred3_1, 1);
    }
}

/**
 * `ContainerScreen.slotAt(mx, my)`.
 *
 * `slots_flat` is the flat `[slot, x, y]` layout (see
 * [`screen_containers_player_inv_slots`]). Returns the slot index or `-1`
 * for the JS `null`.
 * @param {Float64Array | number[]} slots_flat
 * @param {number} gui_left
 * @param {number} gui_top
 * @param {number} mx
 * @param {number} my
 * @returns {number}
 */
export function screen_containers_slot_at(slots_flat, gui_left, gui_top, mx, my) {
    const val2 = +gui_left;
    const val3 = +gui_top;
    const val4 = +mx;
    const val5 = +my;
    const ptr0 = passArrayF64ToWasm0(slots_flat, wasm.__wbindgen_export);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.screen_containers_slot_at(ptr0, len0, val2, val3, val4, val5);
    return ret;
}

/**
 * `stackOf` exposed for the tab icons (`_drawTab`),
 * Returns the JSON item for a creative tuple `[id, , tag]`.
 * @param {bigint} id
 * @param {string} tag_json
 * @returns {string}
 */
export function screen_containers_stack_of(id, tag_json) {
    let deferred3_0;
    let deferred3_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val2 = BigInt.asIntN(64, id);
        const ptr0 = passStringToWasm0(tag_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.screen_containers_stack_of(retptr, val2, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred3_0 = r0;
        deferred3_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred3_0, deferred3_1, 1);
    }
}

/**
 * `CreativeScreen.key`: the hotbar-swap validity test
 * (`!before || (isValid(slot, before) && before.count <= slotLimit(slot, before))`).
 * @param {boolean} before_present
 * @param {boolean} is_valid
 * @param {number} before_count
 * @param {number} slot_limit
 * @returns {boolean}
 */
export function screen_containers_swap_ok(before_present, is_valid, before_count, slot_limit) {
    const ret = wasm.screen_containers_swap_ok(before_present, is_valid, before_count, slot_limit);
    return ret !== 0;
}

/**
 * `tabInfo(game, i)`: the index of the tab with that index, or `-1`.
 * @param {string} creative_json
 * @param {number} index
 * @returns {number}
 */
export function screen_containers_tab_index(creative_json, index) {
    const val2 = +index;
    const ptr0 = passStringToWasm0(creative_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.screen_containers_tab_index(ptr0, len0, val2);
    return ret;
}

/**
 * `CreativeScreen.render`: the tab tooltip label key (`itemGroup.<label>`).
 * @param {string} label
 * @returns {string}
 */
export function screen_containers_tab_label_key(label) {
    let deferred2_0;
    let deferred2_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const ptr0 = passStringToWasm0(label, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.screen_containers_tab_label_key(retptr, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred2_0 = r0;
        deferred2_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred2_0, deferred2_1, 1);
    }
}

/**
 * `tabData(game)` reduced to the per-tab geometry fields.
 * Returns a JSON array of `{index, label, column, top, right, title,
 * scrollbar, background}`.
 * @param {string} creative_json
 * @returns {string}
 */
export function screen_containers_tab_meta(creative_json) {
    let deferred2_0;
    let deferred2_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const ptr0 = passStringToWasm0(creative_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.screen_containers_tab_meta(retptr, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred2_0 = r0;
        deferred2_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred2_0, deferred2_1, 1);
    }
}

/**
 * `SearchTreeManager.ITEMS` tag match for a `#tag` query.
 *
 * `tags_json` is the entry's tag list (`game.tags.forEntry('items', id)`).
 * @param {string} tags_json
 * @param {string} term
 * @returns {boolean}
 */
export function screen_containers_tag_query_hit(tags_json, term) {
    let ptr0, len0, ptr1, len1;
    try {
        ptr0 = passStringToWasm0(tags_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        len0 = WASM_VECTOR_LEN;
        ptr1 = passStringToWasm0(term, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        len1 = WASM_VECTOR_LEN;
    } catch (e) {
        if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
        if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
        throw e;
    }
    const ret = wasm.screen_containers_tag_query_hit(ptr0, len0, ptr1, len1);
    return ret !== 0;
}

/**
 * `CreativeScreen._tooltip`: the group for an enchanted book, which uses the
 * enchantment's own tab when the book carries exactly one enchantment.
 * @param {string} catalog_json
 * @param {bigint} item_id
 * @param {string} item_name
 * @param {string} enchantment_ids_json
 * @returns {string}
 */
export function screen_containers_tooltip_group(catalog_json, item_id, item_name, enchantment_ids_json) {
    let deferred5_0;
    let deferred5_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val4 = BigInt.asIntN(64, item_id);
        let ptr0, len0, ptr1, len1, ptr2, len2;
        try {
            ptr0 = passStringToWasm0(catalog_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passStringToWasm0(item_name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len1 = WASM_VECTOR_LEN;
            ptr2 = passStringToWasm0(enchantment_ids_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len2 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr2) { wasm.__wbindgen_export3(ptr2, len2 * 1, 1); }
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
            throw e;
        }
        wasm.screen_containers_tooltip_group(retptr, ptr0, len0, val4, ptr1, len1, ptr2, len2);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred5_0 = r0;
        deferred5_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred5_0, deferred5_1, 1);
    }
}

/**
 * `ContainerScreen._tryAddDrag(slot)`.
 *
 * `can_add` mirrors `c._canAdd(slot, cursor, true)`, `is_valid` mirrors
 * `c.isValid(slot, cursor)` and `can_drag` mirrors `c.canDragIntoSlot(slot)`,
 * all computed by the JS container (which owns the slot rules).
 * @param {number} cursor_count
 * @param {number} drag_slot_count
 * @param {boolean} can_add
 * @param {boolean} is_valid
 * @param {boolean} can_drag
 * @returns {boolean}
 */
export function screen_containers_try_add_drag(cursor_count, drag_slot_count, can_add, is_valid, can_drag) {
    const ret = wasm.screen_containers_try_add_drag(cursor_count, drag_slot_count, can_add, is_valid, can_drag);
    return ret !== 0;
}

/**
 * `FontRenderer.wrap` reduced to what the enchantment clue needs: greedily
 * fill lines up to `width` using a character-width table.
 *
 * `widths_json` maps a character to its pixel width; missing characters fall
 * back to `6` (the Standard Galactic Font's default). `max_lines` limits the
 * result the way `.slice(0, 2)` does in JS.
 * @param {string} text
 * @param {number} width
 * @param {string} widths_json
 * @param {number} max_lines
 * @returns {string}
 */
export function screen_containers_wrap_clue(text, width, widths_json, max_lines) {
    let deferred5_0;
    let deferred5_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val3 = +width;
        const val4 = +max_lines;
        let ptr0, len0, ptr1, len1;
        try {
            ptr0 = passStringToWasm0(text, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passStringToWasm0(widths_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len1 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
            throw e;
        }
        wasm.screen_containers_wrap_clue(retptr, ptr0, len0, val3, ptr1, len1, val4);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred5_0 = r0;
        deferred5_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred5_0, deferred5_1, 1);
    }
}

/**
 * @param {number} distance
 * @param {number} camera_x
 * @param {number} camera_y
 * @param {number} camera_z
 * @param {number} cx
 * @param {number} sy
 * @param {number} cz
 * @param {boolean} previous
 * @returns {boolean}
 */
export function section_lod(distance, camera_x, camera_y, camera_z, cx, sy, cz, previous) {
    const ret = wasm.section_lod(distance, camera_x, camera_y, camera_z, cx, sy, cz, previous);
    return ret !== 0;
}

/**
 * @param {string} source
 * @param {string} root
 * @returns {string}
 */
export function select_glsl_functions_wasm(source, root) {
    let deferred4_0;
    let deferred4_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        let ptr0, len0, ptr1, len1;
        try {
            ptr0 = passStringToWasm0(source, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passStringToWasm0(root, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len1 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
            throw e;
        }
        wasm.select_glsl_functions_wasm(retptr, ptr0, len0, ptr1, len1);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        var ptr3 = r0;
        var len3 = r1;
        if (r3) {
            ptr3 = 0; len3 = 0;
            throw takeFromExternrefTable0(r2);
        }
        deferred4_0 = ptr3;
        deferred4_1 = len3;
        return getStringFromWasm0(ptr3, len3);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred4_0, deferred4_1, 1);
    }
}

/**
 * @param {string} grid_json
 * @param {number} n
 * @param {string} records_json
 * @returns {string}
 */
export function server_craft_result(grid_json, n, records_json) {
    let deferred4_0;
    let deferred4_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val3 = +n;
        let ptr0, len0, ptr1, len1;
        try {
            ptr0 = passStringToWasm0(grid_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passStringToWasm0(records_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len1 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
            throw e;
        }
        wasm.server_craft_result(retptr, ptr0, len0, val3, ptr1, len1);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred4_0 = r0;
        deferred4_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred4_0, deferred4_1, 1);
    }
}

/**
 * @param {Uint8Array} light
 * @param {number} index
 * @param {number} value
 */
export function set_block_light(light, index, value) {
    const val2 = +index;
    const val3 = +value;
    var ptr0 = passArray8ToWasm0(light, wasm.__wbindgen_export);
    var len0 = WASM_VECTOR_LEN;
    wasm.set_block_light(ptr0, len0, light, val2, val3);
}

/**
 * @param {string} models_json
 * @returns {boolean}
 */
export function set_jar_models(models_json) {
    const ptr0 = passStringToWasm0(models_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.set_jar_models(ptr0, len0);
    return ret !== 0;
}

/**
 * @param {Uint8Array} light
 * @param {number} index
 * @param {number} value
 */
export function set_sky_light(light, index, value) {
    const val2 = +index;
    const val3 = +value;
    var ptr0 = passArray8ToWasm0(light, wasm.__wbindgen_export);
    var len0 = WASM_VECTOR_LEN;
    wasm.set_sky_light(ptr0, len0, light, val2, val3);
}

/**
 * @param {string} source
 * @param {number} version
 * @returns {string}
 */
export function shader_block_rules_wasm(source, version) {
    let deferred4_0;
    let deferred4_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val2 = +version;
        const ptr0 = passStringToWasm0(source, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.shader_block_rules_wasm(retptr, ptr0, len0, val2);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        var ptr3 = r0;
        var len3 = r1;
        if (r3) {
            ptr3 = 0; len3 = 0;
            throw takeFromExternrefTable0(r2);
        }
        deferred4_0 = ptr3;
        deferred4_1 = len3;
        return getStringFromWasm0(ptr3, len3);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred4_0, deferred4_1, 1);
    }
}

/**
 * @param {string} metadata_json
 * @param {number} revision
 * @param {string} name
 * @param {string} bytes_json
 * @returns {string}
 */
export function shader_library_add(metadata_json, revision, name, bytes_json) {
    let deferred5_0;
    let deferred5_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val4 = +revision;
        let ptr0, len0, ptr1, len1, ptr2, len2;
        try {
            ptr0 = passStringToWasm0(metadata_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passStringToWasm0(name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len1 = WASM_VECTOR_LEN;
            ptr2 = passStringToWasm0(bytes_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len2 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr2) { wasm.__wbindgen_export3(ptr2, len2 * 1, 1); }
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
            throw e;
        }
        wasm.shader_library_add(retptr, ptr0, len0, val4, ptr1, len1, ptr2, len2);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred5_0 = r0;
        deferred5_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred5_0, deferred5_1, 1);
    }
}

/**
 * @param {string | null} [legacy_bytes_json]
 * @param {string | null} [legacy_meta_json]
 * @returns {string}
 */
export function shader_library_migrate_legacy(legacy_bytes_json, legacy_meta_json) {
    let deferred3_0;
    let deferred3_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        let ptr0, len0, ptr1, len1;
        try {
            ptr0 = isLikeNone(legacy_bytes_json) ? 0 : passStringToWasm0(legacy_bytes_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len0 = WASM_VECTOR_LEN;
            ptr1 = isLikeNone(legacy_meta_json) ? 0 : passStringToWasm0(legacy_meta_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len1 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
            throw e;
        }
        wasm.shader_library_migrate_legacy(retptr, ptr0, len0, ptr1, len1);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred3_0 = r0;
        deferred3_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred3_0, deferred3_1, 1);
    }
}

/**
 * @returns {string}
 */
export function shader_library_new_id() {
    let deferred1_0;
    let deferred1_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.shader_library_new_id(retptr);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred1_0 = r0;
        deferred1_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @param {string} json_text
 * @returns {string}
 */
export function shader_library_normalize_metadata(json_text) {
    let deferred2_0;
    let deferred2_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const ptr0 = passStringToWasm0(json_text, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.shader_library_normalize_metadata(retptr, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred2_0 = r0;
        deferred2_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred2_0, deferred2_1, 1);
    }
}

/**
 * @param {string} metadata_json
 * @param {number} revision
 * @param {string | null} [id]
 * @returns {string}
 */
export function shader_library_remove(metadata_json, revision, id) {
    let deferred4_0;
    let deferred4_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val3 = +revision;
        let ptr0, len0, ptr1, len1;
        try {
            ptr0 = passStringToWasm0(metadata_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len0 = WASM_VECTOR_LEN;
            ptr1 = isLikeNone(id) ? 0 : passStringToWasm0(id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len1 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
            throw e;
        }
        wasm.shader_library_remove(retptr, ptr0, len0, val3, ptr1, len1);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred4_0 = r0;
        deferred4_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred4_0, deferred4_1, 1);
    }
}

/**
 * @param {string} metadata_json
 * @param {number} revision
 * @param {string | null | undefined} pack_bytes_json
 * @param {string | null | undefined} pack_options_json
 * @param {boolean} pack_enabled
 * @returns {string}
 */
export function shader_library_save_current(metadata_json, revision, pack_bytes_json, pack_options_json, pack_enabled) {
    let deferred6_0;
    let deferred6_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val4 = +revision;
        const val5 = +pack_enabled;
        let ptr0, len0, ptr1, len1, ptr2, len2;
        try {
            ptr0 = passStringToWasm0(metadata_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len0 = WASM_VECTOR_LEN;
            ptr1 = isLikeNone(pack_bytes_json) ? 0 : passStringToWasm0(pack_bytes_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len1 = WASM_VECTOR_LEN;
            ptr2 = isLikeNone(pack_options_json) ? 0 : passStringToWasm0(pack_options_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len2 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr2) { wasm.__wbindgen_export3(ptr2, len2 * 1, 1); }
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
            throw e;
        }
        wasm.shader_library_save_current(retptr, ptr0, len0, val4, ptr1, len1, ptr2, len2, val5);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred6_0 = r0;
        deferred6_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred6_0, deferred6_1, 1);
    }
}

/**
 * @param {string} metadata_json
 * @param {number} revision
 * @param {string | null | undefined} id
 * @param {boolean} enabled
 * @returns {string}
 */
export function shader_library_select(metadata_json, revision, id, enabled) {
    let deferred5_0;
    let deferred5_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val3 = +revision;
        const val4 = +enabled;
        let ptr0, len0, ptr1, len1;
        try {
            ptr0 = passStringToWasm0(metadata_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len0 = WASM_VECTOR_LEN;
            ptr1 = isLikeNone(id) ? 0 : passStringToWasm0(id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len1 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
            throw e;
        }
        wasm.shader_library_select(retptr, ptr0, len0, val3, ptr1, len1, val4);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred5_0 = r0;
        deferred5_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred5_0, deferred5_1, 1);
    }
}

/**
 * Check if a mob should spawn at given conditions
 * @param {number} difficulty
 * @param {number} light_level
 * @param {number} sky_light
 * @param {number} block_light
 * @param {number} y
 * @param {boolean} is_slime_chunk
 * @param {boolean} is_swamp
 * @returns {boolean}
 */
export function should_spawn_mob(difficulty, light_level, sky_light, block_light, y, is_slime_chunk, is_swamp) {
    const ret = wasm.should_spawn_mob(difficulty, light_level, sky_light, block_light, y, is_slime_chunk, is_swamp);
    return ret !== 0;
}

/**
 * Wake up conditions check.
 * Returns true if the player should wake up.
 * @param {bigint} world_time
 * @param {boolean} took_damage
 * @param {boolean} bed_destroyed
 * @param {boolean} left_bed
 * @param {boolean} in_combat
 * @returns {boolean}
 */
export function should_wake_up(world_time, took_damage, bed_destroyed, left_bed, in_combat) {
    const ret = wasm.should_wake_up(world_time, took_damage, bed_destroyed, left_bed, in_combat);
    return ret !== 0;
}

/**
 * `shulkerBox(e, peek)` → `[minX, minY, minZ, maxX, maxY, maxZ]` in block coordinates.
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} peek
 * @param {number} attach_face
 * @returns {Float64Array}
 */
export function shulker_box(x, y, z, peek, attach_face) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.shulker_box(retptr, x, y, z, peek, attach_face);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayF64FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 8, 8);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Shulker push vector for a given attach face (0..5).
 * @param {number} attach_face
 * @returns {Float64Array}
 */
export function shulker_push_vector(attach_face) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.shulker_push_vector(retptr, attach_face);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayF64FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 8, 8);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Simulate projectile motion for one tick (arrows, fireballs, etc.)
 * Returns new [x, y, z, motionX, motionY, motionZ].
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} motion_x
 * @param {number} motion_y
 * @param {number} motion_z
 * @param {number} accel_x
 * @param {number} accel_y
 * @param {number} accel_z
 * @param {number} drag
 * @param {number} gravity
 * @param {boolean} no_gravity
 * @param {boolean} in_ground
 * @param {boolean} block_at_feet_opaque
 * @returns {Float64Array}
 */
export function simulate_projectile(x, y, z, motion_x, motion_y, motion_z, accel_x, accel_y, accel_z, drag, gravity, no_gravity, in_ground, block_at_feet_opaque) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.simulate_projectile(retptr, x, y, z, motion_x, motion_y, motion_z, accel_x, accel_y, accel_z, drag, gravity, no_gravity, in_ground, block_at_feet_opaque);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayF64FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 8, 8);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * @param {number} angle
 * @param {number} temperature
 * @param {number} rain
 * @param {number} thunder
 * @returns {Float64Array}
 */
export function sky_color_wasm(angle, temperature, rain, thunder) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.sky_color_wasm(retptr, angle, temperature, rain, thunder);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayF64FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 8, 8);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Calculate sleep percentage for multiplayer sleep coordination.
 * Returns the percentage of players sleeping (0.0 to 1.0).
 * @param {number} total_players
 * @param {number} sleeping_players
 * @returns {number}
 */
export function sleep_percentage(total_players, sleeping_players) {
    const ret = wasm.sleep_percentage(total_players, sleeping_players);
    return ret;
}

/**
 * JS: `CATEGORIES` for wasm consumers.
 * @returns {string[]}
 */
export function sound_categories() {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.sound_categories(retptr);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayJsValueFromWasm0(r0, r1);
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Calculate title screen splash animation parameters.
 *
 * `progress` is a time value in milliseconds (typically `Date.now() % 1000`).
 * `text_width` is the rendered width of the splash text in pixels.
 * `screen_width` is the canvas width.
 *
 * Returns None on invalid input for JS fallback.
 * @param {number} progress
 * @param {number} text_width
 * @param {number} screen_width
 * @returns {SplashAnimation | undefined}
 */
export function splash_animation(progress, text_width, screen_width) {
    const ret = wasm.splash_animation(progress, text_width, screen_width);
    return ret === 0 ? undefined : SplashAnimation.__wrap(ret);
}

/**
 * Vertex data for the startup splash logo quad.
 *
 * Ported from `client/js/render/splash.js` lines 52-57.
 * Returns 36 floats (4 vertices * 9 components: x,y,z, u,v, r,g,b,a).
 * Returns None on invalid input for JS fallback.
 * @param {number} logo_x
 * @param {number} logo_y
 * @param {number} logo_size
 * @returns {Float64Array | undefined}
 */
export function splash_logo_vertices(logo_x, logo_y, logo_size) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.splash_logo_vertices(retptr, logo_x, logo_y, logo_size);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        let v1;
        if (r0 !== 0) {
            v1 = getArrayF64FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export3(r0, r1 * 8, 8);
        }
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Orthographic projection matrix for the startup splash.
 *
 * Ported from `client/js/render/splash.js` line 58.
 * Returns a 16-element column-major matrix (WebGL compatible).
 * Returns None on invalid input for JS fallback.
 * @param {number} scaled_width
 * @param {number} scaled_height
 * @returns {Float64Array | undefined}
 */
export function splash_ortho_matrix(scaled_width, scaled_height) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.splash_ortho_matrix(retptr, scaled_width, scaled_height);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        let v1;
        if (r0 !== 0) {
            v1 = getArrayF64FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export3(r0, r1 * 8, 8);
        }
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Calculate the startup splash scale and logo position.
 *
 * Ported from `client/js/render/splash.js` lines 46-48, 51.
 * Returns null on invalid input for JS fallback.
 * @param {number} viewport_width
 * @param {number} viewport_height
 * @param {number} dpr
 * @param {SplashConfig | null} [config]
 * @returns {SplashScale | undefined}
 */
export function splash_scale(viewport_width, viewport_height, dpr, config) {
    const val2 = +viewport_width;
    const val3 = +viewport_height;
    const val4 = +dpr;
    let ptr0 = 0;
    if (!isLikeNone(config)) {
        _assertClass(config, SplashConfig);
        ptr0 = config.__destroy_into_raw();
    }
    const ret = wasm.splash_scale(val2, val3, val4, ptr0);
    return ret === 0 ? undefined : SplashScale.__wrap(ret);
}

/**
 * Select a splash text from the list.
 *
 * Ported from `client/js/gui/screens/menus.js` lines 29-35.
 * Handles special dates: Christmas (Dec 24) and New Year (Jan 1).
 * `index` is used for deterministic selection (e.g., from Java's Random).
 * Returns null/empty string on failure for JS fallback.
 * @param {Array<any>} splashes
 * @param {number} index
 * @returns {string | undefined}
 */
export function splash_text(splashes, index) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.splash_text(retptr, splashes, index);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        let v1;
        if (r0 !== 0) {
            v1 = getStringFromWasm0(r0, r1);
            wasm.__wbindgen_export3(r0, r1 * 1, 1);
        }
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Select a random splash text from the list (convenience function).
 *
 * Uses JS Math.random() via wasm_bindgen for true randomness.
 * Returns null on failure for JS fallback.
 * @param {Array<any>} splashes
 * @returns {string | undefined}
 */
export function splash_text_random(splashes) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.splash_text_random(retptr, splashes);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        let v1;
        if (r0 !== 0) {
            v1 = getStringFromWasm0(r0, r1);
            wasm.__wbindgen_export3(r0, r1 * 1, 1);
        }
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * @param {BlockRegistryCore} reg
 * @param {number} state
 * @param {Uint32Array | number[]} neighbours
 * @returns {string}
 */
export function stairs_shape_wasm(reg, state, neighbours) {
    let deferred3_0;
    let deferred3_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        _assertClass(reg, BlockRegistryCore);
        const val2 = +state;
        const ptr0 = passArray32ToWasm0(neighbours, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.stairs_shape_wasm(retptr, reg.__wbg_ptr, val2, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred3_0 = r0;
        deferred3_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred3_0, deferred3_1, 1);
    }
}

/**
 * @param {number} angle
 * @returns {number}
 */
export function star_brightness_wasm(angle) {
    const ret = wasm.star_brightness_wasm(angle);
    return ret;
}

/**
 * Generate a statistic key for a block/item/entity
 * @param {string} category
 * @param {string} namespace
 * @param {string} name
 * @returns {string}
 */
export function stat_key(category, namespace, name) {
    let deferred4_0;
    let deferred4_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        let ptr0, len0, ptr1, len1, ptr2, len2;
        try {
            ptr0 = passStringToWasm0(category, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passStringToWasm0(namespace, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len1 = WASM_VECTOR_LEN;
            ptr2 = passStringToWasm0(name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len2 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr2) { wasm.__wbindgen_export3(ptr2, len2 * 1, 1); }
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
            throw e;
        }
        wasm.stat_key(retptr, ptr0, len0, ptr1, len1, ptr2, len2);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred4_0 = r0;
        deferred4_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred4_0, deferred4_1, 1);
    }
}

/**
 * Decode a UTF-8 string with VarInt length prefix
 * @param {Uint8Array | number[]} bytes
 * @returns {string}
 */
export function string_decode(bytes) {
    let deferred3_0;
    let deferred3_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.string_decode(retptr, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        var ptr2 = r0;
        var len2 = r1;
        if (r3) {
            ptr2 = 0; len2 = 0;
            throw takeFromExternrefTable0(r2);
        }
        deferred3_0 = ptr2;
        deferred3_1 = len2;
        return getStringFromWasm0(ptr2, len2);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred3_0, deferred3_1, 1);
    }
}

/**
 * Encode a UTF-8 string with VarInt length prefix
 * @param {string} value
 * @returns {Uint8Array}
 */
export function string_encode(value) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const ptr0 = passStringToWasm0(value, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.string_encode(retptr, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v2 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 1, 1);
        return v2;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * @param {number} angle
 * @param {number} rain
 * @param {number} thunder
 * @returns {number}
 */
export function sun_brightness_wasm(angle, rain, thunder) {
    const ret = wasm.sun_brightness_wasm(angle, rain, thunder);
    return ret;
}

/**
 * @param {number} angle
 * @returns {Float64Array}
 */
export function sunrise_colors_wasm(angle) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.sunrise_colors_wasm(retptr, angle);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayF64FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 8, 8);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * `updateMesh` decode: bytes -> unified float vertex layout.
 * @param {string} format
 * @param {Uint8Array | number[]} data
 * @returns {Float32Array}
 */
export function sw_decode_vertices(format, data) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        let ptr0, len0, ptr1, len1;
        try {
            ptr0 = passStringToWasm0(format, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passArray8ToWasm0(data, wasm.__wbindgen_export);
            len1 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
            throw e;
        }
        wasm.sw_decode_vertices(retptr, ptr0, len0, ptr1, len1);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v3 = getArrayF32FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v3;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * `DEFAULT_PARAMS[pipeline]`.
 * @param {string} pipeline
 * @returns {Float64Array}
 */
export function sw_default_params(pipeline) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const ptr0 = passStringToWasm0(pipeline, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.sw_default_params(retptr, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v2 = getArrayF64FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 8, 8);
        return v2;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * `lightmap(tex, sky, block)` against a table built by `sw_lightmap_table`.
 * @param {Float32Array | number[]} table
 * @param {number} sky
 * @param {number} block
 * @returns {Float64Array}
 */
export function sw_lightmap_sample(table, sky, block) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val2 = +sky;
        const val3 = +block;
        const ptr0 = passArrayF32ToWasm0(table, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.sw_lightmap_sample(retptr, ptr0, len0, val2, val3);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v4 = getArrayF64FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 8, 8);
        return v4;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * `buildLightmapTable(tex)` -> the 61 x 61 x 3 lookup table.
 * @param {Uint32Array | number[]} px
 * @param {number} w
 * @param {number} h
 * @returns {Float32Array}
 */
export function sw_lightmap_table(px, w, h) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val2 = +w;
        const val3 = +h;
        const ptr0 = passArray32ToWasm0(px, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.sw_lightmap_table(retptr, ptr0, len0, val2, val3);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v4 = getArrayF32FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v4;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * `mul4(out, a, b)` returning the product.
 * @param {Float64Array | number[]} a
 * @param {Float64Array | number[]} b
 * @returns {Float64Array}
 */
export function sw_mul4(a, b) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        let ptr0, len0, ptr1, len1;
        try {
            ptr0 = passArrayF64ToWasm0(a, wasm.__wbindgen_export);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passArrayF64ToWasm0(b, wasm.__wbindgen_export);
            len1 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 8, 8); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 8, 8); }
            throw e;
        }
        wasm.sw_mul4(retptr, ptr0, len0, ptr1, len1);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v3 = getArrayF64FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 8, 8);
        return v3;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * `packColor(r, g, b, a)`.
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @param {number} a
 * @returns {number}
 */
export function sw_pack_color(r, g, b, a) {
    const ret = wasm.sw_pack_color(r, g, b, a);
    return ret >>> 0;
}

/**
 * `PIPELINE_FORMAT[pipeline]`'s format name.
 * @param {string} pipeline
 * @returns {string}
 */
export function sw_pipeline_format(pipeline) {
    let deferred2_0;
    let deferred2_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const ptr0 = passStringToWasm0(pipeline, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.sw_pipeline_format(retptr, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred2_0 = r0;
        deferred2_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred2_0, deferred2_1, 1);
    }
}

/**
 * `_post(d)` as a standalone full-screen pass.
 * @param {Float64Array | number[]} params
 * @param {Uint32Array | number[]} src
 * @param {number} src_w
 * @param {number} src_h
 * @param {Uint32Array | number[]} aux
 * @param {number} aux_w
 * @param {number} aux_h
 * @param {Uint32Array | number[]} dst
 * @param {number} dst_w
 * @param {number} dst_h
 * @param {boolean} blend_alpha
 * @returns {Uint32Array}
 */
export function sw_post_process(params, src, src_w, src_h, aux, aux_w, aux_h, dst, dst_w, dst_h, blend_alpha) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val5 = +src_w;
        const val6 = +src_h;
        const val7 = +aux_w;
        const val8 = +aux_h;
        const val9 = +dst_w;
        const val10 = +dst_h;
        const val11 = +blend_alpha;
        let ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3;
        try {
            ptr0 = passArrayF64ToWasm0(params, wasm.__wbindgen_export);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passArray32ToWasm0(src, wasm.__wbindgen_export);
            len1 = WASM_VECTOR_LEN;
            ptr2 = passArray32ToWasm0(aux, wasm.__wbindgen_export);
            len2 = WASM_VECTOR_LEN;
            ptr3 = passArray32ToWasm0(dst, wasm.__wbindgen_export);
            len3 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr3) { wasm.__wbindgen_export3(ptr3, len3 * 4, 4); }
            if (ptr2) { wasm.__wbindgen_export3(ptr2, len2 * 4, 4); }
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 4, 4); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 8, 8); }
            throw e;
        }
        wasm.sw_post_process(retptr, ptr0, len0, ptr1, len1, val5, val6, ptr2, len2, val7, val8, ptr3, len3, val9, val10, val11);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v12 = getArrayU32FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v12;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * `vertexLayout(FORMAT[name])` as JSON.
 * @param {string} name
 * @returns {string}
 */
export function sw_vertex_layout(name) {
    let deferred2_0;
    let deferred2_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.sw_vertex_layout(retptr, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred2_0 = r0;
        deferred2_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred2_0, deferred2_1, 1);
    }
}

/**
 * `teamsCanPush(a, b)`: `same` is the JavaScript identity comparison.
 * @param {string | null | undefined} a
 * @param {string | null | undefined} b
 * @param {boolean} same
 * @returns {boolean}
 */
export function teams_can_push(a, b, same) {
    const val3 = +same;
    let ptr0, len0, ptr1, len1;
    try {
        ptr0 = isLikeNone(a) ? 0 : passStringToWasm0(a, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        len0 = WASM_VECTOR_LEN;
        ptr1 = isLikeNone(b) ? 0 : passStringToWasm0(b, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        len1 = WASM_VECTOR_LEN;
    } catch (e) {
        if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
        if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
        throw e;
    }
    const ret = wasm.teams_can_push(ptr0, len0, ptr1, len1, val3);
    return ret !== 0;
}

/**
 * Tick dragon death animation - port of `tickDragonDeath(e, g)`.
 * Returns updated entity JSON.
 * @param {string} entity_json
 * @returns {string}
 */
export function tick_dragon_death(entity_json) {
    let deferred2_0;
    let deferred2_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const ptr0 = passStringToWasm0(entity_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.tick_dragon_death(retptr, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred2_0 = r0;
        deferred2_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred2_0, deferred2_1, 1);
    }
}

/**
 * Tick entity effects - port of `tickEntityEffects(e, entities)`.
 * This handles guardian beam charging and dragon crystal searching.
 * Returns a JSON string with updated entity data, or empty string on failure.
 * @param {string} entity_json
 * @param {string} entities_json
 * @returns {string}
 */
export function tick_entity_effects(entity_json, entities_json) {
    let deferred3_0;
    let deferred3_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        let ptr0, len0, ptr1, len1;
        try {
            ptr0 = passStringToWasm0(entity_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passStringToWasm0(entities_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len1 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
            throw e;
        }
        wasm.tick_entity_effects(retptr, ptr0, len0, ptr1, len1);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred3_0 = r0;
        deferred3_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred3_0, deferred3_1, 1);
    }
}

/**
 * Tick fox interpolation on a JSON entity object (standalone, matches `tickFox(e)`).
 * @param {string} entity_json
 * @returns {string}
 */
export function tick_fox(entity_json) {
    let deferred2_0;
    let deferred2_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const ptr0 = passStringToWasm0(entity_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.tick_fox(retptr, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred2_0 = r0;
        deferred2_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred2_0, deferred2_1, 1);
    }
}

/**
 * Get time until next morning (ticks)
 * @param {bigint} time_of_day
 * @returns {bigint}
 */
export function ticks_until_morning(time_of_day) {
    const ret = wasm.ticks_until_morning(time_of_day);
    return ret;
}

/**
 * Get time until next night (ticks)
 * @param {bigint} time_of_day
 * @returns {bigint}
 */
export function ticks_until_night(time_of_day) {
    const ret = wasm.ticks_until_night(time_of_day);
    return ret;
}

/**
 * Add unlocked recipe
 * @param {RecipeBookState} recipe_book
 * @param {string} recipe_id
 */
export function unlock_recipe(recipe_book, recipe_id) {
    _assertClass(recipe_book, RecipeBookState);
    const ptr0 = passStringToWasm0(recipe_id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN;
    wasm.unlock_recipe(recipe_book.__wbg_ptr, ptr0, len0);
}

/**
 * `EntityPlayer.updateCape` - cape trailing point.
 * Returns [chasingX, chasingY, chasingZ, prevChasingX, prevChasingY, prevChasingZ].
 * @param {number} chasing_x
 * @param {number} chasing_y
 * @param {number} chasing_z
 * @param {number} prev_chasing_x
 * @param {number} prev_chasing_y
 * @param {number} prev_chasing_z
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @returns {Float64Array}
 */
export function update_cape(chasing_x, chasing_y, chasing_z, prev_chasing_x, prev_chasing_y, prev_chasing_z, x, y, z) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.update_cape(retptr, chasing_x, chasing_y, chasing_z, prev_chasing_x, prev_chasing_y, prev_chasing_z, x, y, z);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayF64FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 8, 8);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * `update_command_block` payload (position, command, mode enum, flags).
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {string} command
 * @param {string} mode
 * @param {boolean} track
 * @param {boolean} conditional
 * @param {boolean} automatic
 * @returns {Uint8Array}
 */
export function update_command_block(x, y, z, command, mode, track, conditional, automatic) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val3 = +x;
        const val4 = +y;
        const val5 = +z;
        const val6 = +track;
        const val7 = +conditional;
        const val8 = +automatic;
        let ptr0, len0, ptr1, len1;
        try {
            ptr0 = passStringToWasm0(command, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passStringToWasm0(mode, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len1 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
            throw e;
        }
        wasm.update_command_block(retptr, val3, val4, val5, ptr0, len0, ptr1, len1, val6, val7, val8);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v9 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 1, 1);
        return v9;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * `update_command_block_minecart` payload.
 * @param {number} id
 * @param {string} command
 * @param {boolean} track
 * @returns {Uint8Array}
 */
export function update_command_minecart(id, command, track) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val2 = +id;
        const val3 = +track;
        const ptr0 = passStringToWasm0(command, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.update_command_minecart(retptr, val2, ptr0, len0, val3);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v4 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 1, 1);
        return v4;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * @param {Uint8Array} data
 * @param {number} sun
 * @param {number} dimension
 * @param {number} torch_flicker
 * @param {number} gamma
 * @param {number} night_vision
 * @param {number} lightning
 */
export function update_lightmap_wasm(data, sun, dimension, torch_flicker, gamma, night_vision, lightning) {
    const val2 = +sun;
    const val3 = +dimension;
    const val4 = +torch_flicker;
    const val5 = +gamma;
    const val6 = +night_vision;
    const val7 = +lightning;
    var ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_export);
    var len0 = WASM_VECTOR_LEN;
    wasm.update_lightmap_wasm(ptr0, len0, data, val2, val3, val4, val5, val6, val7);
}

/**
 * Update recipe book state
 * @param {RecipeBookState} recipe_book
 * @param {string[]} unlocked_recipes
 * @param {string[]} highlighted_recipes
 */
export function update_recipe_book(recipe_book, unlocked_recipes, highlighted_recipes) {
    _assertClass(recipe_book, RecipeBookState);
    let ptr0, len0, ptr1, len1;
    try {
        ptr0 = passArrayJsValueToWasm0(unlocked_recipes, wasm.__wbindgen_export);
        len0 = WASM_VECTOR_LEN;
        ptr1 = passArrayJsValueToWasm0(highlighted_recipes, wasm.__wbindgen_export);
        len1 = WASM_VECTOR_LEN;
    } catch (e) {
        if (ptr1) { wasm.__wbindgen_export7(ptr1, len1); wasm.__wbindgen_export3(ptr1, len1 * 4, 4); }
        if (ptr0) { wasm.__wbindgen_export7(ptr0, len0); wasm.__wbindgen_export3(ptr0, len0 * 4, 4); }
        throw e;
    }
    wasm.update_recipe_book(recipe_book.__wbg_ptr, ptr0, len0, ptr1, len1);
}

/**
 * Update sleeping state from network delta (ported from JS updateSleeping).
 * Returns UpdateSleepResult indicating what changed.
 * @param {boolean} game_sleeping
 * @param {BlockPos | null | undefined} game_bed_pos
 * @param {SleepDelta} delta
 * @param {number} index
 * @param {number} pose_field
 * @returns {UpdateSleepResult}
 */
export function update_sleeping_from_delta(game_sleeping, game_bed_pos, delta, index, pose_field) {
    _assertClass(delta, SleepDelta);
    const val2 = +game_sleeping;
    const val3 = +index;
    const val4 = +pose_field;
    let ptr0 = 0;
    if (!isLikeNone(game_bed_pos)) {
        _assertClass(game_bed_pos, BlockPos);
        ptr0 = game_bed_pos.__destroy_into_raw();
    }
    const ret = wasm.update_sleeping_from_delta(val2, ptr0, delta.__wbg_ptr, val3, val4);
    return ret;
}

/**
 * Update a statistic value. Stats cross the JS boundary as a JSON object.
 * @param {string} stats_json
 * @param {string} name
 * @param {bigint} value
 * @returns {string}
 */
export function update_statistic(stats_json, name, value) {
    let deferred4_0;
    let deferred4_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val3 = BigInt.asIntN(64, value);
        let ptr0, len0, ptr1, len1;
        try {
            ptr0 = passStringToWasm0(stats_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passStringToWasm0(name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len1 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
            throw e;
        }
        wasm.update_statistic(retptr, ptr0, len0, ptr1, len1, val3);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred4_0 = r0;
        deferred4_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred4_0, deferred4_1, 1);
    }
}

/**
 * `update_structure_block` payload. Enum names use the same strings as the
 * JavaScript caller; unknown values serialize as -1, exactly like `indexOf`.
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} action
 * @param {string} mode
 * @param {string} name
 * @param {number} pos_x
 * @param {number} pos_y
 * @param {number} pos_z
 * @param {number} size_x
 * @param {number} size_y
 * @param {number} size_z
 * @param {string} mirror
 * @param {string} rotation
 * @param {string} metadata
 * @param {number} integrity
 * @param {bigint} seed
 * @param {boolean} ignore_entities
 * @param {boolean} show_air
 * @param {boolean} show_bounding_box
 * @returns {Uint8Array}
 */
export function update_structure_block(x, y, z, action, mode, name, pos_x, pos_y, pos_z, size_x, size_y, size_z, mirror, rotation, metadata, integrity, seed, ignore_entities, show_air, show_bounding_box) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val6 = +x;
        const val7 = +y;
        const val8 = +z;
        const val9 = +action;
        const val10 = +pos_x;
        const val11 = +pos_y;
        const val12 = +pos_z;
        const val13 = +size_x;
        const val14 = +size_y;
        const val15 = +size_z;
        const val16 = +integrity;
        const val17 = BigInt.asIntN(64, seed);
        const val18 = +ignore_entities;
        const val19 = +show_air;
        const val20 = +show_bounding_box;
        let ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4;
        try {
            ptr0 = passStringToWasm0(mode, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passStringToWasm0(name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len1 = WASM_VECTOR_LEN;
            ptr2 = passStringToWasm0(mirror, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len2 = WASM_VECTOR_LEN;
            ptr3 = passStringToWasm0(rotation, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len3 = WASM_VECTOR_LEN;
            ptr4 = passStringToWasm0(metadata, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len4 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr4) { wasm.__wbindgen_export3(ptr4, len4 * 1, 1); }
            if (ptr3) { wasm.__wbindgen_export3(ptr3, len3 * 1, 1); }
            if (ptr2) { wasm.__wbindgen_export3(ptr2, len2 * 1, 1); }
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
            throw e;
        }
        wasm.update_structure_block(retptr, val6, val7, val8, val9, ptr0, len0, ptr1, len1, val10, val11, val12, val13, val14, val15, ptr2, len2, ptr3, len3, ptr4, len4, val16, val17, val18, val19, val20);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v21 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 1, 1);
        return v21;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Validate a bed position - checks if it's a bed, not obstructed, and has space for player.
 * Returns validation result with facing direction and head/foot positions.
 * @param {WorldView} world
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @returns {BedValidationResult | undefined}
 */
export function validate_bed_position(world, x, y, z) {
    _assertClass(world, WorldView);
    const ret = wasm.validate_bed_position(world.__wbg_ptr, x, y, z);
    return ret === 0 ? undefined : BedValidationResult.__wrap(ret);
}

/**
 * Decode a VarInt from bytes
 * @param {Uint8Array | number[]} bytes
 * @returns {number}
 */
export function varint_decode(bytes) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.varint_decode(retptr, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        if (r2) {
            throw takeFromExternrefTable0(r1);
        }
        return r0;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Encode a VarInt (signed 32-bit)
 * @param {number} value
 * @returns {Uint8Array}
 */
export function varint_encode(value) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.varint_encode(retptr, value);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 1, 1);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Decode a VarLong from bytes
 * @param {Uint8Array | number[]} bytes
 * @returns {bigint}
 */
export function varlong_decode(bytes) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.varlong_decode(retptr, ptr0, len0);
        var r0 = getDataViewMemory0().getBigInt64(retptr + 8 * 0, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        if (r3) {
            throw takeFromExternrefTable0(r2);
        }
        return r0;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Encode a VarLong (signed 64-bit)
 * @param {bigint} value
 * @returns {Uint8Array}
 */
export function varlong_encode(value) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.varlong_encode(retptr, value);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 1, 1);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Convert degrees to radians
 * @param {number} deg
 * @returns {number}
 */
export function vehicle_deg_to_rad(deg) {
    const ret = wasm.vehicle_deg_to_rad(deg);
    return ret;
}

/**
 * Wrap angle to [-180, 180]
 * @param {number} a
 * @returns {number}
 */
export function vehicle_wrap(a) {
    const ret = wasm.vehicle_wrap(a);
    return ret;
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} w
 * @returns {Float32Array}
 */
export function wasm_decode_terrain_position(x, y, z, w) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.wasm_decode_terrain_position(retptr, x, y, z, w);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayF32FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * @param {number} d
 * @param {number} fog_start
 * @param {number} fog_end
 * @param {number} fog_density
 * @param {number} fog_mode
 * @returns {number}
 */
export function wasm_fog_factor(d, fog_start, fog_end, fog_density, fog_mode) {
    const ret = wasm.wasm_fog_factor(d, fog_start, fog_end, fog_density, fog_mode);
    return ret;
}

/**
 * @param {number} x
 * @param {number} y
 * @returns {Float32Array}
 */
export function wasm_lightmap_uv(x, y) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.wasm_lightmap_uv(retptr, x, y);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayF32FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * @param {number} quads
 * @returns {Uint32Array}
 */
export function wasm_quad_indices(quads) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.wasm_quad_indices(retptr, quads);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayU32FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * `override_color` is `None` when the biome record has no `waterColor`.
 * @param {number} id
 * @param {string} name
 * @param {number | null} [override_color]
 * @returns {number}
 */
export function water_color(id, name, override_color) {
    const val2 = +id;
    const val3 = +(isLikeNone(override_color) ? Number.MAX_SAFE_INTEGER : (override_color) >>> 0);
    const ptr0 = passStringToWasm0(name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.water_color(val2, ptr0, len0, val3);
    return ret >>> 0;
}

/**
 * JSON-based wasm-bindgen wrapper around `water_fog`.
 * `state_json`: `{"biomeId": 1, "waterVision": 0.5}`; `previous_json`: `{"target":..,"from":..,"time":..}` or null.
 * @param {string} state_json
 * @param {string | null | undefined} previous_json
 * @param {number} now
 * @returns {string}
 */
export function water_fog_json(state_json, previous_json, now) {
    let deferred4_0;
    let deferred4_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        const val3 = +now;
        let ptr0, len0, ptr1, len1;
        try {
            ptr0 = passStringToWasm0(state_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len0 = WASM_VECTOR_LEN;
            ptr1 = isLikeNone(previous_json) ? 0 : passStringToWasm0(previous_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            len1 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 1, 1); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 1, 1); }
            throw e;
        }
        wasm.water_fog_json(retptr, ptr0, len0, ptr1, len1, val3);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred4_0 = r0;
        deferred4_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred4_0, deferred4_1, 1);
    }
}

/**
 * JS: `BLENDS` names for wasm consumers.
 * @returns {string[]}
 */
export function webgpu_blend_names() {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.webgpu_blend_names(retptr);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayJsValueFromWasm0(r0, r1);
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * JS: `DRAW_STRIDE` / `GLOBAL_STRIDE` for wasm consumers.
 * @returns {number}
 */
export function webgpu_draw_stride() {
    const ret = wasm.webgpu_draw_stride();
    return ret >>> 0;
}

/**
 * @returns {number}
 */
export function webgpu_global_stride() {
    const ret = wasm.webgpu_global_stride();
    return ret >>> 0;
}

/**
 * @param {WorldCore} world
 * @param {BlockRegistryCore} reg
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @returns {Float64Array}
 */
export function world_collision_boxes(world, reg, x, y, z) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        _assertClass(world, WorldCore);
        _assertClass(reg, BlockRegistryCore);
        wasm.world_collision_boxes(retptr, world.__wbg_ptr, reg.__wbg_ptr, x, y, z);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayF64FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 8, 8);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * @param {WorldCore} world
 * @param {BlockRegistryCore} reg
 * @param {Float64Array | number[]} bb
 * @returns {Float64Array}
 */
export function world_get_collisions(world, reg, bb) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        _assertClass(world, WorldCore);
        _assertClass(reg, BlockRegistryCore);
        const ptr0 = passArrayF64ToWasm0(bb, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.world_get_collisions(retptr, world.__wbg_ptr, reg.__wbg_ptr, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v2 = getArrayF64FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 8, 8);
        return v2;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * @param {WorldCore} world
 * @param {BlockRegistryCore} reg
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {string} precipitation
 * @param {number} rain_strength
 * @returns {boolean}
 */
export function world_is_raining_at(world, reg, x, y, z, precipitation, rain_strength) {
    _assertClass(world, WorldCore);
    _assertClass(reg, BlockRegistryCore);
    const val2 = +x;
    const val3 = +y;
    const val4 = +z;
    const val5 = +rain_strength;
    const ptr0 = passStringToWasm0(precipitation, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.world_is_raining_at(world.__wbg_ptr, reg.__wbg_ptr, val2, val3, val4, ptr0, len0, val5);
    return ret !== 0;
}

/**
 * @param {WorldCore} world
 * @param {BlockRegistryCore} reg
 * @param {Float64Array | number[]} origin
 * @param {Float64Array | number[]} dir
 * @param {number} max_dist
 * @param {number} liquid_mode
 * @param {boolean} collider
 * @returns {string}
 */
export function world_raycast(world, reg, origin, dir, max_dist, liquid_mode, collider) {
    let deferred6_0;
    let deferred6_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        _assertClass(world, WorldCore);
        _assertClass(reg, BlockRegistryCore);
        const val3 = +max_dist;
        const val4 = +liquid_mode;
        const val5 = +collider;
        let ptr0, len0, ptr1, len1;
        try {
            ptr0 = passArrayF64ToWasm0(origin, wasm.__wbindgen_export);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passArrayF64ToWasm0(dir, wasm.__wbindgen_export);
            len1 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr1) { wasm.__wbindgen_export3(ptr1, len1 * 8, 8); }
            if (ptr0) { wasm.__wbindgen_export3(ptr0, len0 * 8, 8); }
            throw e;
        }
        wasm.world_raycast(retptr, world.__wbg_ptr, reg.__wbg_ptr, ptr0, len0, ptr1, len1, val3, val4, val5);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred6_0 = r0;
        deferred6_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred6_0, deferred6_1, 1);
    }
}

/**
 * Wrap angle to [-180, 180]
 * @param {number} a
 * @returns {number}
 */
export function wrap(a) {
    const ret = wasm.wrap(a);
    return ret;
}

/**
 * @param {Uint8Array | number[]} bytes
 * @returns {ZipArchive | undefined}
 */
export function zip_open(bytes) {
    const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_export);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.zip_open(ptr0, len0);
    return ret === 0 ? undefined : ZipArchive.__wrap(ret);
}

/**
 * Returns `[fov, from, to, started]`.
 * @param {number} now
 * @param {number} fov
 * @param {number} target
 * @param {number} from
 * @param {number} to
 * @param {number} started
 * @returns {Float64Array}
 */
export function zoom_fov(now, fov, target, from, to, started) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16) >>> 0;
        wasm.zoom_fov(retptr, now, fov, target, from, to, started);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayF64FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 8, 8);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}
function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg_Error_208446807d0d1e30: function(arg0, arg1) {
            const ret = Error(getStringFromWasm0(arg0, arg1));
            return ret;
        },
        __wbg___wbindgen_boolean_get_4f1baf9a00be3c74: function(arg0) {
            const v = arg0;
            const ret = typeof(v) === 'boolean' ? v : undefined;
            return isLikeNone(ret) ? 0xFFFFFF : ret ? 1 : 0;
        },
        __wbg___wbindgen_copy_to_typed_array_680b191e71920dc1: function(arg0, arg1, arg2) {
            new Uint8Array(arg2.buffer, arg2.byteOffset, arg2.byteLength).set(getArrayU8FromWasm0(arg0, arg1));
        },
        __wbg___wbindgen_debug_string_f249a2a76caa9a55: function(arg0, arg1) {
            const ret = debugString(arg1);
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32((arg0 >>> 0) + 4 * 1, len1, true);
            getDataViewMemory0().setInt32((arg0 >>> 0) + 4 * 0, ptr1, true);
        },
        __wbg___wbindgen_is_function_741ff2bb612836f5: function(arg0) {
            const ret = typeof(arg0) === 'function';
            return ret;
        },
        __wbg___wbindgen_is_null_c22311b1cc228e3a: function(arg0) {
            const ret = arg0 === null;
            return ret;
        },
        __wbg___wbindgen_is_object_8b968c3ab8e96595: function(arg0) {
            const val = arg0;
            const ret = typeof(val) === 'object' && val !== null;
            return ret;
        },
        __wbg___wbindgen_is_string_fc456fee5d3317de: function(arg0) {
            const ret = typeof(arg0) === 'string';
            return ret;
        },
        __wbg___wbindgen_is_undefined_be5b34249ff1fc15: function(arg0) {
            const ret = arg0 === undefined;
            return ret;
        },
        __wbg___wbindgen_jsval_loose_eq_b2f214e2e4b30e36: function(arg0, arg1) {
            const ret = arg0 == arg1;
            return ret;
        },
        __wbg___wbindgen_number_get_934b640d0889af78: function(arg0, arg1) {
            const obj = arg1;
            const ret = typeof(obj) === 'number' ? obj : undefined;
            getDataViewMemory0().setFloat64((arg0 >>> 0) + 8 * 1, isLikeNone(ret) ? 0 : ret, true);
            getDataViewMemory0().setInt32((arg0 >>> 0) + 4 * 0, !isLikeNone(ret), true);
        },
        __wbg___wbindgen_string_get_7ce8eee7fd327545: function(arg0, arg1) {
            const obj = arg1;
            const ret = typeof(obj) === 'string' ? obj : undefined;
            var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            var len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32((arg0 >>> 0) + 4 * 1, len1, true);
            getDataViewMemory0().setInt32((arg0 >>> 0) + 4 * 0, ptr1, true);
        },
        __wbg___wbindgen_throw_4c88d8bf264fd984: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbg_call_40b008ba32f73991: function() { return handleError(function (arg0, arg1) {
            const ret = arg0.call(arg1);
            return ret;
        }, arguments); },
        __wbg_call_a410eb4b59ed5965: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = arg0.call(arg1, arg2);
            return ret;
        }, arguments); },
        __wbg_done_57e08d0be6e30c02: function(arg0) {
            const ret = arg0.done;
            return ret;
        },
        __wbg_entries_7bb1459bd9b5c2b9: function(arg0) {
            const ret = Object.entries(arg0);
            return ret;
        },
        __wbg_getDate_a44b5f4a8c42a3c3: function(arg0) {
            const ret = arg0.getDate();
            return ret;
        },
        __wbg_getMonth_a4698d688e95d9bd: function(arg0) {
            const ret = arg0.getMonth();
            return ret;
        },
        __wbg_get_2080c49015e35254: function() { return handleError(function (arg0, arg1) {
            const ret = Reflect.get(arg0, arg1);
            return ret;
        }, arguments); },
        __wbg_get_635eea311fa1a291: function() { return handleError(function (arg0, arg1) {
            const ret = Reflect.get(arg0, arg1);
            return ret;
        }, arguments); },
        __wbg_get_d7176cfb76d71114: function(arg0, arg1) {
            const ret = arg0[arg1 >>> 0];
            return ret;
        },
        __wbg_get_unchecked_e6325ad374eff861: function(arg0, arg1) {
            const ret = arg0[arg1 >>> 0];
            return ret;
        },
        __wbg_instanceof_ArrayBuffer_12cdaa4161423e6b: function(arg0) {
            let result;
            try {
                result = arg0 instanceof ArrayBuffer;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_Uint8Array_d7aeb0dcb3108fea: function(arg0) {
            let result;
            try {
                result = arg0 instanceof Uint8Array;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_isArray_bcf1376d0d732d08: function(arg0) {
            const ret = Array.isArray(arg0);
            return ret;
        },
        __wbg_iterator_e4c5e8f68ada7b58: function() {
            const ret = Symbol.iterator;
            return ret;
        },
        __wbg_length_186163212ffe79c3: function(arg0) {
            const ret = arg0.length;
            return ret;
        },
        __wbg_length_b03a0fabb109b1e9: function(arg0) {
            const ret = arg0.length;
            return ret;
        },
        __wbg_new_0_36d738a0c8cfac43: function() {
            const ret = new Date();
            return ret;
        },
        __wbg_new_13de428334042d26: function(arg0) {
            const ret = new Uint8Array(arg0);
            return ret;
        },
        __wbg_new_37eb45aaf5eeb820: function() {
            const ret = new Array();
            return ret;
        },
        __wbg_new_7075786089b89c5e: function() {
            const ret = new Map();
            return ret;
        },
        __wbg_new_cd4348290afae586: function() {
            const ret = new Object();
            return ret;
        },
        __wbg_new_from_slice_355c10c5d8f2addb: function(arg0, arg1) {
            const ret = new Float32Array(getArrayF32FromWasm0(arg0, arg1));
            return ret;
        },
        __wbg_new_from_slice_b8daf545a41c6aa0: function(arg0, arg1) {
            const ret = new Uint8Array(getArrayU8FromWasm0(arg0, arg1));
            return ret;
        },
        __wbg_new_with_length_01b143a7e5dd5a3e: function(arg0) {
            const ret = new Uint8Array(arg0 >>> 0);
            return ret;
        },
        __wbg_next_178c1651c11432b3: function(arg0) {
            const ret = arg0.next;
            return ret;
        },
        __wbg_next_af5ac6a08bb0a717: function() { return handleError(function (arg0) {
            const ret = arg0.next();
            return ret;
        }, arguments); },
        __wbg_now_463ac581d2fc7ea3: function() {
            const ret = Date.now();
            return ret;
        },
        __wbg_prototypesetcall_13162965d1fe7aa3: function(arg0, arg1, arg2) {
            Uint8Array.prototype.set.call(getArrayU8FromWasm0(arg0, arg1), arg2);
        },
        __wbg_push_c9f4893fc209f768: function(arg0, arg1) {
            const ret = arg0.push(arg1);
            return ret;
        },
        __wbg_random_df36b90cd78a7d54: function() {
            const ret = Math.random();
            return ret;
        },
        __wbg_set_2793479888329cb6: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = Reflect.set(arg0, arg1, arg2);
            return ret;
        }, arguments); },
        __wbg_set_8282f7e0d2d01336: function(arg0, arg1, arg2) {
            const ret = arg0.set(arg1, arg2);
            return ret;
        },
        __wbg_set_d2d33b52458e984a: function(arg0, arg1, arg2) {
            arg0[arg1 >>> 0] = arg2;
        },
        __wbg_set_e4b9a833d288759a: function(arg0, arg1, arg2) {
            arg0[arg1] = arg2;
        },
        __wbg_set_feb3714f475485ba: function(arg0, arg1, arg2) {
            arg0.set(getArrayU8FromWasm0(arg1, arg2));
        },
        __wbg_stringify_0a0fbf2ef722380a: function() { return handleError(function (arg0) {
            const ret = JSON.stringify(arg0);
            return ret;
        }, arguments); },
        __wbg_value_e0f328965e184931: function(arg0) {
            const ret = arg0.value;
            return ret;
        },
        __wbindgen_generic_0000000000000001: function(arg0) {
            // Cast intrinsic for `F64 -> Externref`.
            const ret = arg0;
            return ret;
        },
        __wbindgen_generic_0000000000000002: function(arg0) {
            // Cast intrinsic for `I64 -> Externref`.
            const ret = arg0;
            return ret;
        },
        __wbindgen_generic_0000000000000003: function(arg0, arg1) {
            // Cast intrinsic for `Ref(String) -> Externref`.
            const ret = getStringFromWasm0(arg0, arg1);
            return ret;
        },
        __wbindgen_generic_0000000000000004: function(arg0) {
            // Cast intrinsic for `U64 -> Externref`.
            const ret = BigInt.asUintN(64, arg0);
            return ret;
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            table.set(0, undefined);
            table.set(1024, undefined);
            table.set(1025, null);
            table.set(1026, true);
            table.set(1027, false);
        },
    };
    return {
        __proto__: null,
        "./gravrust_bg.js": import0,
    };
}

const AdvancementsCoreFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_advancementscore_free(ptr, 1));
const BannerFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_banner_free(ptr, 1));
const BedSleepFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_bedsleep_free(ptr, 1));
const BedValidationResultFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_bedvalidationresult_free(ptr, 1));
const BiomeZoomFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_biomezoom_free(ptr, 1));
const BlockPosFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_blockpos_free(ptr, 1));
const BlockRegistryCoreFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_blockregistrycore_free(ptr, 1));
const BoxModelCoreFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_boxmodelcore_free(ptr, 1));
const CameraEyeFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_cameraeye_free(ptr, 1));
const CaptureNetworkCoreFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_capturenetworkcore_free(ptr, 1));
const ChunkColumnFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_chunkcolumn_free(ptr, 1));
const ConnectionFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_connection_free(ptr, 1));
const CraftingTableCoreFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_craftingtablecore_free(ptr, 1));
const DecodedPacketFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_decodedpacket_free(ptr, 1));
const EventSoundInfoFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_eventsoundinfo_free(ptr, 1));
const FallingBlockFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_fallingblock_free(ptr, 1));
const FireEntityFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_fireentity_free(ptr, 1));
const FireGeometryResultFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_firegeometryresult_free(ptr, 1));
const FireOverlayGeometryResultFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_fireoverlaygeometryresult_free(ptr, 1));
const FireUvFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_fireuv_free(ptr, 1));
const FluidStateFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_fluidstate_free(ptr, 1));
const FoxAITickResultFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_foxaitickresult_free(ptr, 1));
const FoxAnimationArgsFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_foxanimationargs_free(ptr, 1));
const FoxStateFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_foxstate_free(ptr, 1));
const FoxTargetResultFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_foxtargetresult_free(ptr, 1));
const FoxTrustPairFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_foxtrustpair_free(ptr, 1));
const FrustumFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_frustum_free(ptr, 1));
const ItemTableCoreFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_itemtablecore_free(ptr, 1));
const JavaRandomFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_javarandom_free(ptr, 1));
const ModelStoreCoreFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_modelstorecore_free(ptr, 1));
const MusicTrackInfoFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_musictrackinfo_free(ptr, 1));
const PacketReaderFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_packetreader_free(ptr, 1));
const PacketWriterFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_packetwriter_free(ptr, 1));
const PistonCoreFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_pistoncore_free(ptr, 1));
const PngImageFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_pngimage_free(ptr, 1));
const ProfileSectionFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_profilesection_free(ptr, 1));
const ProfilingDataFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_profilingdata_free(ptr, 1));
const RecipeBookCoreFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_recipebookcore_free(ptr, 1));
const RecipeBookStateFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_recipebookstate_free(ptr, 1));
const RegistryTagsCoreFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_registrytagscore_free(ptr, 1));
const ScoreboardCoreFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_scoreboardcore_free(ptr, 1));
const SectionCullerCoreFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_sectioncullercore_free(ptr, 1));
const SleepCameraFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_sleepcamera_free(ptr, 1));
const SleepDeltaFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_sleepdelta_free(ptr, 1));
const SleepStateFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_sleepstate_free(ptr, 1));
const SliceDataFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_slicedata_free(ptr, 1));
const SoftwareDeviceFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_softwaredevice_free(ptr, 1));
const SplashAnimationFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_splashanimation_free(ptr, 1));
const SplashConfigFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_splashconfig_free(ptr, 1));
const SplashScaleFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_splashscale_free(ptr, 1));
const TileRendererCoreFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_tilerenderercore_free(ptr, 1));
const VisGraphFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_visgraph_free(ptr, 1));
const WorldCoreFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_worldcore_free(ptr, 1));
const WorldViewFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_worldview_free(ptr, 1));
const ZipArchiveFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_ziparchive_free(ptr, 1));

function addToExternrefTable0(obj) {
    const idx = wasm.__wbindgen_export5();
    wasm.__wbindgen_externrefs.set(idx, obj);
    return idx;
}

function _assertClass(instance, klass) {
    if (!(instance instanceof klass)) {
        throw new Error(`expected instance of ${klass.name}`);
    }
}

function debugString(val) {
    switch (typeof val) {
        // primitive types
        case 'number':
        case 'boolean':
        case 'undefined':
        return `${val}`;
        case 'string':
        return JSON.stringify(val);
        case 'bigint':
        return `${val}n`;
        case 'symbol':
        return val.description !== undefined
            ? `Symbol(${val.description})`
            : 'Symbol';
        case 'function':
        return typeof val.name === 'string' && val.name !== ''
            ? `Function(${val.name})`
            : 'Function';
        case 'object': {
            if (val === null) {
                return 'null';
            }
            // objects
            if (Array.isArray(val)) {
                return '[' + Array.from(val, debugString).join(', ') + ']';
            }
            // errors
            if (val instanceof Error) {
                return `${val.name}: ${val.message}\n${val.stack}`;
            }

            const toStringOutput = toString.call(val);
            // Test for built-in
            const className = /\[object ([^\]]+)\]/.exec(toStringOutput)?.[1];

            // Failed to match the standard '[object ClassName]'
            if (className === undefined) {
                return toStringOutput;
            }
            if (className === 'Object') {
                // we're a user defined class or Object
                // JSON.stringify avoids problems with cycles, and is generally much
                // easier than looping through ownProperties of `val`.
                try {
                    return 'Object(' + JSON.stringify(val) + ')';
                } catch (_) {
                    return 'Object';
                }
            }
            // TODO we could test for more things here, like `Set`s and `Map`s.
            return className;
        }
        // Per MDN: 'This list of values is exhaustive.'
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/typeof#description
    }
}

function getArrayF32FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getFloat32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}

function getArrayF64FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getFloat64ArrayMemory0().subarray(ptr / 8, ptr / 8 + len);
}

function getArrayI32FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getInt32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}

function getArrayJsValueFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    const mem = getDataViewMemory0();
    const result = [];
    for (let i = ptr; i < ptr + 4 * len; i += 4) {
        result.push(wasm.__wbindgen_externrefs.get(mem.getUint32(i, true)));
    }
    wasm.__wbindgen_export7(ptr, len);
    return result;
}

function getArrayU16FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint16ArrayMemory0().subarray(ptr / 2, ptr / 2 + len);
}

function getArrayU32FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedBigUint64ArrayMemory0 = null;
function getBigUint64ArrayMemory0() {
    if (cachedBigUint64ArrayMemory0 === null || cachedBigUint64ArrayMemory0.byteLength === 0) {
        cachedBigUint64ArrayMemory0 = new BigUint64Array(wasm.memory.buffer);
    }
    return cachedBigUint64ArrayMemory0;
}

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

let cachedFloat32ArrayMemory0 = null;
function getFloat32ArrayMemory0() {
    if (cachedFloat32ArrayMemory0 === null || cachedFloat32ArrayMemory0.byteLength === 0) {
        cachedFloat32ArrayMemory0 = new Float32Array(wasm.memory.buffer);
    }
    return cachedFloat32ArrayMemory0;
}

let cachedFloat64ArrayMemory0 = null;
function getFloat64ArrayMemory0() {
    if (cachedFloat64ArrayMemory0 === null || cachedFloat64ArrayMemory0.byteLength === 0) {
        cachedFloat64ArrayMemory0 = new Float64Array(wasm.memory.buffer);
    }
    return cachedFloat64ArrayMemory0;
}

let cachedInt32ArrayMemory0 = null;
function getInt32ArrayMemory0() {
    if (cachedInt32ArrayMemory0 === null || cachedInt32ArrayMemory0.byteLength === 0) {
        cachedInt32ArrayMemory0 = new Int32Array(wasm.memory.buffer);
    }
    return cachedInt32ArrayMemory0;
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return decodeText(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

let cachedUint16ArrayMemory0 = null;
function getUint16ArrayMemory0() {
    if (cachedUint16ArrayMemory0 === null || cachedUint16ArrayMemory0.byteLength === 0) {
        cachedUint16ArrayMemory0 = new Uint16Array(wasm.memory.buffer);
    }
    return cachedUint16ArrayMemory0;
}

let cachedUint32ArrayMemory0 = null;
function getUint32ArrayMemory0() {
    if (cachedUint32ArrayMemory0 === null || cachedUint32ArrayMemory0.byteLength === 0) {
        cachedUint32ArrayMemory0 = new Uint32Array(wasm.memory.buffer);
    }
    return cachedUint32ArrayMemory0;
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        const idx = addToExternrefTable0(e);
        wasm.__wbindgen_export4(idx);
    }
}

function isLikeNone(x) {
    return x === undefined || x === null;
}

function passArray16ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 2, 2) >>> 0;
    getUint16ArrayMemory0().set(arg, ptr / 2);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passArray32ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 4, 4) >>> 0;
    getUint32ArrayMemory0().set(arg, ptr / 4);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passArray64ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 8, 8) >>> 0;
    getBigUint64ArrayMemory0().set(arg, ptr / 8);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passArrayF32ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 4, 4) >>> 0;
    getFloat32ArrayMemory0().set(arg, ptr / 4);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passArrayF64ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 8, 8) >>> 0;
    getFloat64ArrayMemory0().set(arg, ptr / 8);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passArrayJsValueToWasm0(array, malloc) {
    const ptr = malloc(array.length * 4, 4) >>> 0;
    for (let i = 0; i < array.length; i++) {
        const add = addToExternrefTable0(array[i]);
        getDataViewMemory0().setUint32(ptr + 4 * i, add, true);
    }
    WASM_VECTOR_LEN = array.length;
    return ptr;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_externrefs.get(idx);
    wasm.__wbindgen_export6(idx);
    return value;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(bytes) {
    numBytesDecoded += bytes.length;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true });
        cachedTextDecoder.decode();
        numBytesDecoded = bytes.length;
    }
    return cachedTextDecoder.decode(bytes);
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasmInstance, wasm;
function __wbg_finalize_init(instance, module) {
    wasmInstance = instance;
    wasm = instance.exports;
    wasmModule = module;
    cachedBigUint64ArrayMemory0 = null;
    cachedDataViewMemory0 = null;
    cachedFloat32ArrayMemory0 = null;
    cachedFloat64ArrayMemory0 = null;
    cachedInt32ArrayMemory0 = null;
    cachedUint16ArrayMemory0 = null;
    cachedUint32ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (!module.ok) {
            throw new Error(`failed to fetch Wasm: ${module.status} ${module.statusText} fetching '${module.url}'`);
        }

        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

let __wbg_init_promise;
async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;
    if (__wbg_init_promise === undefined) {
        __wbg_init_promise = __wbg_init_once(module_or_path);
        __wbg_init_promise.catch(() => { __wbg_init_promise = undefined; });
    }
    return __wbg_init_promise;
}

async function __wbg_init_once(module_or_path) {

    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('gravrust_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
