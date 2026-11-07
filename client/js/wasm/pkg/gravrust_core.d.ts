/* tslint:disable */
/* eslint-disable */

/**
 * Persistent renderer state, driven from JS.
 */
export class GameRenderer {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Borrow the framebuffer for zero-copy blitting.
     */
    frame(): number;
    constructor(w: number, h: number);
    /**
     * Advance time and re-render. Returns the RGBA framebuffer length.
     */
    tick(dt: number): number;
    readonly height: number;
    readonly width: number;
}

/**
 * Initialize the Rust WASM core.
 * This is called from client/js/main.js before the game bootstraps.
 */
export function init_wasm(): void;

/**
 * Reset the Rust core state (e.g. when changing worlds/dimensions).
 */
export function reset_core(): void;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_gamerenderer_free: (a: number, b: number) => void;
    readonly gamerenderer_frame: (a: number) => number;
    readonly gamerenderer_height: (a: number) => number;
    readonly gamerenderer_new: (a: number, b: number) => number;
    readonly gamerenderer_tick: (a: number, b: number) => number;
    readonly gamerenderer_width: (a: number) => number;
    readonly main: (a: number, b: number) => number;
    readonly init_wasm: () => void;
    readonly reset_core: () => void;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_start: () => void;
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
