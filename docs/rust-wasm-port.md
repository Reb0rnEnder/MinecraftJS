# Rust / WebAssembly port

The client's portable algorithms now live in a Rust crate compiled to
WebAssembly. The JavaScript client loads that module at boot and calls into it;
the original JavaScript implementations remain in the tree as the reference
implementation and as the fallback when WebAssembly is unavailable.

This is **not** a claim that the browser client is entirely Rust. WebGL,
DOM/GUI, workers, WebSocket/TCP transport, audio and resource/model baking are
browser API calls and stay in JavaScript. The goal is to move every pure
algorithm and data structure that can run without a browser into the Rust core.

## Build

Requirements: Rust with the `wasm32-unknown-unknown` target, plus
`wasm-bindgen-cli` matching the crate's `wasm-bindgen` version.

```sh
npm run wasm          # cargo build + wasm-bindgen + embed base64
npm run test:rust     # native Rust unit tests
npm run test:wasm     # rebuild, then run the differential suite
npm run port:status   # file-by-file Rust coverage ledger
npm run build         # bundle the client with the generated bindings
```

Generated files under `client/js/wasm/pkg/` are checked in, so a checkout
without a Rust toolchain still runs the client. `rust/target/` is ignored.

## Modules

| Rust module | Ported from | Client path |
| --- | --- | --- |
| `chunk.rs` | `client/js/world/chunk.js`, `native-light.js` | **live** — section decode, palette unpacking, non-air count |
| `chunk_legacy.rs` | `client/js/world/chunk-1.14.4.js`, `chunk-1.15.2.js` | parity only — protocol-498/578 column decoding |
| `world.rs` | `client/js/world/world.js`, `chunk.js`, `slice.js` | parity only — full voxel engine, light BFS, heightmaps, biomes, slices |
| `visgraph.rs` | `client/js/render/visgraph.js` | **live** — section face-visibility graph |
| `png.rs` | `client/js/util/png.js` | **live** — texture/icon decoding and screenshot encoding |
| `zip.rs` | `client/js/util/zip.js` | **live** — resource-pack central directory + deflate |
| `utf8.rs` | `client/js/util/utf8.js` | **live** — WHATWG UTF-8 decode/encode |
| `base64.rs` | `client/js/util/base64.js` | **live** — forgiving base64 decode (plus encoder for tests) |
| `nbt.rs` | `client/js/net/nbt.js` | parity only — parse/re-encode, canonical bytes, `simplify` |
| `buffer.rs` | `client/js/net/buffer.js` | parity only — protocol primitives; packet bodies still JS |
| `math.rs` | `client/js/gfx/math.js` | parity only — full mat4/vec helpers and frustum; JS path kept because per-box WASM calls were slower |
| `biome_zoom.rs` | `client/js/world/biome-zoom.js` | **live** — 64-bit corner jitter and nearest-corner search |
| `command_tree.rs` | `client/js/net/command-tree.js` | parity only — Brigadier node/argument parser |
| `recipes.rs` | `client/js/net/recipes.js` | parity only — 404/498/578 recipe serializers and slots |
| `snbt.rs` | `client/js/net/snbt.js` | parity only — typed SNBT for hover payloads |
| `mccrypto.rs` | `client/js/util/mccrypto.js` | parity only — AES-128-CFB8, SHA-1, RSA PKCS#1 v1.5 |
| `entity_poses.rs` | `client/js/render/leash.js`, `fox-pose.js`, `ocelot-pose.js` | parity only — leash strips, fox/ocelot animation values |
| `entity_pushing.rs` | `client/js/game/entity-pushing.js` | parity only — collision-rule decisions and push velocity |
| `technical.rs` | `client/js/net/technical-packets.js` | parity only — command-block/structure payloads |
| `address.rs` | `client/js/net/address.js` | parity only — vanilla/Eaglercraft/proxy address parsing |
| `zoom.rs` | `client/js/game/zoom.js` | **live** — OptiFine FOV easing (JS fallback retained) |
| `physics.rs` | `client/js/game/physics.js` (helpers) | parity only — MathHelper sin/cos table, honey factors, look vector, offsets, AABB sweep, fast inverse sqrt, ray/AABB |
| `poses.rs` | `client/js/game/player-poses-1.14.4.js`, `1.15.2.js` | parity only — native pose dimensions |
| `collision.rs` | `client/js/game/placement-collision.js`, `world/scaffolding.js` | parity only — placement and scaffolding shapes |
| `jrandom.rs` | `client/js/util/jrandom.js` | parity only — Java 48-bit LCG |
| `lod.rs` | `client/js/render/lod.js` | parity only — distance/hysteresis/pose intervals |
| `camera.rs` | `client/js/render/camera-eye.js` | parity only — float32 eye easing |
| `protocol_ids.rs` | `client/js/net/protocol-1.14.4-ids.js`, `1.15.2-ids.js` | generated packet-ID tables |
| `uuid.rs` | `client/js/util/uuid-md5.js` | parity only — Java name UUIDs |
| `fluids.rs` | `client/js/world/fluids.js` | parity only — water/lava source and flow heights |
| `biomes.rs` | `client/js/world/biomes.js`, `water-biomes.js` | parity only — color tables and rain type |
| `particles.rs` | `client/js/render/particle-collision.js` | parity only — swept particle movement |
| `water_fog.rs` | `client/js/render/water-fog.js` | parity only — underwater fog transition |
| `base85.rs` | `client/js/util/base85.js` | parity only — packed single-file payloads |
| `crafting.rs` | `client/js/game/crafting.js`, `server-recipes.js` | parity only — 1.8 shaped/shapeless tables, repair, server recipe book |
| `culling.rs` | `client/js/render/culling.js` | parity only — breadth-first section walk with fog/frustum/visibility masks |
| `glsl_functions.rs` | `client/js/render/glsl-functions.js` | parity only — function selector, `block.properties`, animation lookup, float-literal bridge |
| `glsl_preprocess.rs` | `client/js/render/glsl-preprocessor.js` | parity only — `#if`/`#elif`/`#ifdef` conditional selection |
| `shader_lighting.rs` | `client/js/render/shader-lighting.js` | parity only — BSL colour/lightmap bridge |
| `sky.rs` | `client/js/render/sky.js` | **live** — lightmap fill and star field; scalar colours stay JS |
| `webgl2.rs` + `webgl2_alg.rs` | `client/js/gfx/webgl2.js` | parity only — verbatim GLSL, device state machine, draw caching; every `gl.*` call behind the `WebGlOps` trait |
| `webgpu.rs` + `webgpu_math.rs` | `client/js/gfx/webgpu.js` | parity only — verbatim WGSL, `BLENDS`, uniform rings, pipeline cache; every WebGPU call behind the `GpuOps` trait |
| `browser.rs` + `browser_alg.rs` + `platform.rs` + `platform_contract.rs` | `client/js/platform/browser.js`, `platform.js` | parity only — input state machines, DPR/resize math, device selection; DOM/fetch behind traits |
| `main_alg.rs` + `main_boot.rs` + `main_boot2.rs` + `boot_alg.rs` | `client/js/main.js` | parity only — the 26-step boot state machine with exact try/catch boundaries |
| `widgets.rs` + `widgets_alg*.rs` | `client/js/gui/widgets.js` | parity only — Button/Slider/TextField layout, hit-testing, text editing |
| `sound.rs` + `sound_alg2.rs` + `music_system.rs` | `client/js/audio/sound.js` | parity only — sounds.json registry, weighted picking, attenuation math, cave-mood LCG, music ticker |
| `protocol_1144.rs` + `protocol_1152.rs` + `protocol_1152_ids.rs` | `client/js/net/protocol-1.14.4.js`, `protocol-1.15.2.js` | parity only — full 498/578 codecs, changed-packet layouts, id remapping |
| `wasm_alg.rs` | `client/js/wasm/core.js` | parity only — single-flight loader with `atob` (forgiving-base64) semantics |
| `entity_renderer.rs` + `entity_render_alg.rs` + `item_renderer.rs` | `client/js/render/entity-renderer.js` | parity only — scene graph, materials, `_texFor`/`_modelFor` dispatch, pose/shade math |
| `options.rs` + `options_alg.rs` + `options_screen.rs` | `client/js/gui/screens/options.js` | parity only — option tables, slider mapping, formatters, screen layouts |

`world.rs`, `buffer.rs`, `nbt.rs`, `math.rs`, `physics.rs`, `command_tree.rs`,
`recipes.rs`, `snbt.rs`, `mccrypto.rs`, `entity_poses.rs` and the other helper
modules are implemented and differential-tested but are not yet on the live
path. They are the base for the next migration stages: owning world storage,
moving packet decoding, and moving player integration. `biome_zoom.rs` is the
exception in this group: the client constructs the WASM zoomer directly and
falls back to the JS class when the core is unavailable.

## What is still JavaScript

These layers are intentionally outside the Rust core because they are browser
or platform integration rather than portable algorithms:

- `render/renderer.js` scene wiring, atlas upload, draw-call plumbing (the device
  state machines themselves are ported behind `WebGlOps`/`GpuOps`)
- `gui/**` — DOM screens, chat, HUD, input, menus (widgets, options and the
  entity renderer logic are ported; the DOM construction stays JS)
- `render/models.js`, `mesher.js`, blockstate/model baking — consumes the asset
  and model tables produced by the resource-pack pipeline
- `net/tcp.js`, `net/eagler.js`, WebSocket proxy and browser transport
- WebAudio node graph, workers, persistence (the sound manager, music ticker and
  platform contracts are ported; the `AudioContext` calls stay JS)

Moving the world store and mesher is the next meaningful step. It requires
replacing the JS `World`/`Chunk` object graph (renderer dirty tracking, tile
entities, collision and tests all read it directly), not just adding another
kernel. That is a separate, larger migration and is not claimed here.

## Fidelity

`tools/wasm-parity.mjs` runs the JS reference and the Rust kernel on identical
inputs and compares results bit-for-bit. Current coverage:

- visibility graphs, including random sections
- 1.9+ chunk sections at 4/5/6/7/8/14 bits per entry
- PNG decode and encode
- mat4 multiply/translate/scale/rotate/perspective/ortho/invert, frustum planes and AABB tests
- NBT round-trips, fixed points and `simplify`
- biome-zoom offsets and cells against random 64-bit seeds
- Brigadier command trees, including bounds, redirects and suggestions
- recipe arrays for protocols 404 and 578, including NBT-carrying slots
- SNBT scalars, compounds, indexed lists and arrays
- AES-128-CFB8, SHA-1, signed server hashes and RSA PKCS#1 v1.5
- leash endpoints/geometry, fox pose/scale and ocelot pose values
- 1.14.4/1.15.2 columns, local/global palettes, biomes and validation failures
- entity push rules/vectors, technical-block packets and address/proxy parsing
- zoom easing state transitions
- ZIP directory, stored and deflated entries against a real shader pack
- packet primitives, including underflow and VarInt/VarLong limits
- UTF-8 decoding for every single byte plus random invalid sequences
- base64 and base85 decode/encode
- Java `Random` sequences and UUID name hashing
- pose dimensions, placement/scaffolding collision, LOD, camera eye easing
- fluid state/height, biome colors/rain, particle sweeps and water fog
- protocol-498/578 packet ID tables
- physics sweep helpers and ray/AABB
- world loading, blocks, sky/block light, heightmaps, biomes and mesh slices
- crafting tables, repair, container items and randomised 2×2/3×3 grids
- section culling walks against random sections, frusta, masks and column maps
- GLSL function selection (including the error cases), `block.properties`
  conditionals and selectors, animation lookup tables, float-literal bridging
- shader condition evaluation and `activeGLSL` output for `#if`/`#elif`/
  `#ifdef` chains
- BSL option validation and day/night lightmap frames across all dimensions
- celestial angle, sun/star brightness, sky/fog/cloud/sunrise colours,
  brightness tables, the 16×16 lightmap bytes and the 1500-star field

Two deliberate deviations are worth knowing about:

- `glsl_preprocess.rs` returns `0` for integer division by zero, where the JS
  yields `±Infinity`; an `i32` result cannot represent it. Shader conditions
  divide by flags and lengths, never by zero in practice.
- `culling.rs` treats a section missing from the map as unoccluded, which is
  what the JS does when `sections.get(...)` is `undefined` (`vis` is `null`).
  An early port returned an all-zero mask there and wrongly pruned the walk;
  the differential suite caught it.

`npm run test:wasm` prints the check count and exits non-zero on the first
mismatch. Native unit tests cover the Rust-side edge cases without a browser.

## Coverage ledger

`rust/port-status.json` records, per JS file, how much of its algorithmic
surface has a Rust implementation. `npm run port:status` computes both metrics:
finished files and JS lines weighted by each file's percentage. Browser API
**calls** (DOM, workers, sockets, and the raw `gl.*`/WebGPU invocations) stay in
JavaScript as trait implementations, while the control flow around them is
ported and natively unit-tested. Current snapshot: **91 of 194 files complete**,
**61.84% of JS lines** weighted; the ten headline modules — WebGL 2, WebGPU,
browser platform, boot, widgets, sound, 1.14.4/1.15.2 protocol, WASM loader,
entity renderer and the options screens — are fully ported as Rust state
machines behind the `WebGlOps`/`GpuOps`/`SoundHost`/`BootEnv` contracts.

Use the ledger after every port:

```sh
node tools/rust-port-status.mjs --complete client/js/path/to/file.js
node tools/rust-port-status.mjs --partial client/js/path/to/file.js=40
```

## Fallback behavior

`client/js/wasm/core.js` initializes the module from embedded base64, so the
single-file build works from `file://` without `fetch()`. Every kernel wrapper
in `client/js/wasm/kernels.js` returns `null`/a sentinel on failure, and callers
run the original JS path. A browser without WebAssembly, a broken single-file
copy or a malformed packet therefore degrades to the JavaScript implementation
instead of failing the client.
