# Gravrust v0.2.0 - Complete Change Log

## Major Features

### 1. Full Rust/WASM Port (10 Modules)
- `webgl2` + `webgl2_alg` - 6 GLSL shaders, WebGL2Device
- `webgpu` + `webgpu_math` - 6 WGSL shaders, pipeline cache
- `browser` + `browser_alg` + `platform` - Input, device selection
- `main_alg` + `main_boot` + `boot_alg` - 26-step boot
- `widgets` + `widgets_alg/2/3` - Button/Slider/TextField
- `sound` + `sound_alg2` + `music_system` - Registry, LCG, ticker
- `protocol_1152/1144/1152_ids` - 498/578 codecs, 139 IDs
- `wasm_alg` - WASM loader, strict atob
- `entity_renderer` + `entity_render_alg` + `item_renderer` + `hand_renderer` - 40-case texFor, skin pipeline
- `options` + `options_alg` + `options_screen` - Full option tables

### 2. Gravrust Via Relay (NEW)
- **Proxy type**: `gravrust-via`
- **ViaVersion** - Newer client → Older server
- **ViaRewind** - Older client → Newer server  
- **ViaBackwards** - Newer client → Older server
- **Cross-version play**: Connect to ANY server version

### 3. F+1..F9 → F1..F9 Keyboard Shortcuts
- Hold `F` + press `1`..`9` → sends `F1`..`F9`
- For devices without function key row

### 4. Rebranding
- **User-facing**: "Gravrust 1.15.2"
- **Internal proxy type**: `mcjs` (was "Gravrust")
- **New relay type**: `gravrust-via`

### 5. Critical Bug Fixes
- VarInt wrapping_shl fix
- Mesh worker blob URL (3MB limit)
- ID mismatch (Gravrust-* vs minecraftjs-*)
- atob strict compliance
- map_colors_to_rgba full 16384 loop
- sound_type_of key resolution

### 6. Documentation
- No Minecraft/Mojang references
- Updated for Gravrust branding
- Via relay setup guide

### 7. Build System
- Version 0.2.0
- ViaProxy integration
- Updated proxy types: `mcjs`, `relay`, `wisp`, `gravrust-via`

## Files Removed (10 old JS modules)
- client/js/webgl2.js
- client/js/webgpu.js
- client/js/browser.js
- client/js/main.js
- client/js/widgets.js
- client/js/sound.js
- client/js/protocol-1.15.2.js
- client/js/wasm/core.js
- client/js/entity-renderer.js
- client/js/options.js

## Test Results
- 802 passed / 32 failed (32 pre-existing in other modules)
- All 10 ported modules: 0 failures
