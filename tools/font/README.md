# Native font-provider rasterizer

`truetype.c` is a small freestanding WebAssembly bridge around stb_truetype,
vendored from nothings/stb commit `f0569113c93ad095470c54bf34a17b36646bbbb5`.
The header contains its complete MIT/public-domain dual license; this integration
uses its public-domain option. The checked-in `client/js/lib/truetype-wasm.js`
embeds the compiled bytes so normal builds and file:// pages need no additional
fetch or compiler. No host/system font is used.

Rebuild using clang with WebAssembly support and wasm-ld:

```sh
node tools/font/build.mjs
# Optional executable overrides:
CLANG=/path/to/clang WASM_LD=/path/to/wasm-ld node tools/font/build.mjs
```

Each font has an isolated Wasm instance. Font bytes persist; scratch allocation
resets between glyphs. Glyphs bake into lazy texture atlas pages shared by all
rendering backends. Provider metrics follow the native 1.13.2 classes `ciu` /
`ciu$b`: scale-for-pixel-height, oversampling, subpixel shift, advance and bearing.
Default fonts remain the jar's bitmap sheets plus legacy Unicode fallback.

`tools/fixtures/font-provider-test.ttf` is a tiny project-authored TrueType
fixture with one rectangular A glyph. It has no third-party font data. Tests
check actual raster output, metrics, scaling, skipping and provider layering.
