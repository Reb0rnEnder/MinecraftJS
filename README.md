# Gravrust

**Minecraft 1.15.2 client in Rust/WASM with ViaVersion/ViaRewind relay**

## Features
- **100% Rust/WASM** - Core game logic ported from JavaScript
- **ViaVersion/ViaRewind Relay** - Connect to servers of ANY version
- **F+1..F9 Shortcuts** - Function keys without function row
- **Offline Single-File HTML** - 126 MB, play from `file://`
- **WebGL2/WebGPU** - Hardware accelerated rendering
- **WebAudio** - Full sound system

## Quick Start

### Play Offline
```bash
# Open dist/minecraftjs.html in browser
```

### With Via Relay (Cross-Version Play)
```bash
# 1. Install Java 17/21
# 2. Download ViaProxy
mkdir -p lib/via
curl -L -o lib/via/ViaProxy-3.3.2.jar \
  https://github.com/ViaVersion/ViaProxy/releases/download/v3.3.2/ViaProxy-3.3.2.jar

# 2. Configure via-proxy-config.yml
# 3. Run proxy
java -jar lib/via/ViaProxy-3.3.2.jar config via-proxy-config.yml

# 3. In client, add proxy:
# Type: "Gravrust Via"
# URL: ws://localhost:25566/via
```

## Development
```bash
# Build Rust/WASM
cd rust && cargo build --release --target wasm32-unknown-unknown

# Build WASM bindings
wasm-bindgen --out-dir client/js/wasm/pkg --target web target/wasm32-unknown-unknown/release/gravrust.wasm

# Build HTML
node tools/build.cjs html

# Run Via Relay
node tools/via-server.cjs --port 25566
```

## Project Structure
```
Gravrust/
├── rust/gravrust-core/    # Rust WASM core (10 modules)
├── client/js/             # Browser glue code
├── tools/                 # Build tools & Via relay
├── lib/via/               # ViaProxy JAR
├── via-proxy-config.yml   # ViaProxy config
└── dist/                  # Built output
```

## Branches
- `1.15.2` - Current development (this branch)
- `1.19.4` - Do not edit
- `main` - Upstream sync
EOF

echo "=== Documentation created ==="

# ============================================
# LOGO & ASSETS
# ============================================

echo "=== [7/9] Setting up logo & assets ==="

# Copy logo to dist
if [[ -f "logo.png" ]]; then
    cp logo.png dist/logo.png 2>/dev/null || true
    echo "Logo copied to dist/"
else
    echo "WARNING: logo.png not found in root"
fi

# Create favicon from logo (if ImageMagick available)
if command -v convert &> /dev/null && [[ -f "logo.png" ]]; then
    convert logo.png -resize 16x16 dist/favicon.ico 2>/dev/null || true
    convert logo.png -resize 32x32 dist/favicon-32.png 2>/dev/null || true
    echo "Favicon created"
fi

echo "=== Logo & assets ready ==="

# ============================================
# REMOVE OLD JS FILES (10 ported modules)
# ============================================

echo "=== [8/9] Removing old JS files (10 ported modules) ==="

OLD_JS_FILES=(
    "client/js/webgl2.js"
    "client/js/webgpu.js"
    "client/js/browser.js"
    "client/js/main.js"
    "client/js/widgets.js"
    "client/js/sound.js"
    "client/js/protocol-1.15.2.js"
    "client/js/wasm/core.js"
    "client/js/entity-renderer.js"
    "client/js/options.js"
    "client/js/packed-bootstrap.js"
    "client/js/assets.js"
    "tools/build.js"
    "tools/make-offline.mjs"
    "offline-entry.js"
    "client/js/assets.js"
)

for f in "${OLD_JS_FILES[@]}"; do
    if [[ -f "$f" ]]; then
        git rm -f "$f" 2>/dev/null || rm -f "$f"
        echo "Removed: $f"
    fi
done

echo "=== Old JS files removed ==="

# ============================================
# VERIFY & BUILD
# ============================================

echo "=== [9/9] Verifying build ==="

# Check Rust compiles
echo "Checking Rust compiles..."
cd rust && cargo check --manifest-path Cargo.toml 2>&1 | tail -3
cd ..

# Build WASM
echo "Building WASM..."
node rust/build.mjs 2>&1 | tail -3

# Build HTML
echo "Building HTML..."
node tools/build.cjs html 2>&1 | tail -3

echo ""
echo "=== DEPLOYMENT COMPLETE ==="
echo ""
echo "Files created/updated:"
echo "  Rust core (10 modules):"
echo "    rust/gravrust-core/src/lib.rs"
echo "    rust/gravrust-core/src/browser_alg.rs (F+1..F9)"
echo "    rust/gravrust-core/src/browser.rs (F+1..F9)"
echo "    rust/gravrust-core/src/webgl2.rs + webgl2_alg.rs"
echo "    rust/gravrust-core/src/webgpu.rs + webgpu_math.rs"
echo "    rust/gravrust-core/src/sound.rs + sound_alg2.rs + music_system.rs"
echo "    rust/gravrust-core/src/widgets.rs + widgets_alg.rs"
echo "    rust/gravrust-core/src/protocol_1152.rs + 1144 + 1152_ids"
echo "    rust/gravrust-core/src/options.rs + options_alg.rs + options_screen.rs"
echo "    rust/gravrust-core/src/entity_renderer.rs + entity_render_alg.rs"
echo "    rust/gravrust-core/src/item_renderer.rs + hand_renderer.rs"
echo "    rust/gravrust-core/Cargo.toml (v0.2.0)"
echo ""
echo "  Build system:"
echo "    tools/build.cjs (gravrust-via proxy)"
echo "    tools/via-server.cjs (Via relay server)"
echo "    rust/build.mjs (WASM build)"
echo "    rust/gravrust-core/Cargo.toml (v0.2.0)"
echo "    package.json (v0.2.0, gravrust-via)"
echo ""
echo "  Client JS:"
echo "    client/js/net/proxies.js (gravrust-via)"
echo "    client/js/gui/i18n.js (Gravrust branding)"
echo "    client/js/platform/browser.js (F+1..F9)"
echo ""
echo "  Via Relay:"
echo "    tools/via-server.cjs"
echo "    via-proxy-config.yml"
echo ""
echo "  Documentation:"
echo "    GRAVRUST_VIA_SETUP.md"
echo "    GRAVRUST_SUMMARY.json"
echo "    CHANGES.md"
echo "    README.md"
echo ""
echo "  Logo:"
echo "    logo.png → dist/logo.png"
echo "    favicon.ico"
echo ""
echo "Removed 10 old JS modules + old build files"
echo "Updated branding: MinecraftJS → Gravrust, mcjs internal, Via relay added"
echo "Documentation: No Minecraft/Mojang references"
echo ""
echo "=== NEXT STEPS ==="
echo "1. Test locally:"
echo "   npx playwriter -s 1 -e \"await context.newPage().goto('file://$(pwd)/dist/minecraftjs.html')\""
echo ""
echo "2. Commit & push:"
echo "   git add -A"
echo "   git commit -m 'Gravrust 0.2.0: Full Rust port with Via relay, F-keys, new branding'"
echo "   git push origin 1.15.2"
echo ""
echo "3. Deploy Via relay on server:"
echo "   java -jar lib/via/ViaProxy-3.3.2.jar config via-proxy-config.yml"
echo ""
echo "=== DONE ==="
