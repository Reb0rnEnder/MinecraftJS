# Native bitmap, Unicode and TTF font providers

The 1.13.2/1.14.4 default fonts are not a replacement system TTF font. Their
`assets/minecraft/font/default.json` defines bitmap providers in priority order
(non-Latin European, accented, ASCII) followed by legacy Unicode. Vanilla also
supports custom resource-pack TTF providers. The previous renderer hardcoded
only the old 256-character ASCII mapping and Unicode pages, changing the look
and baseline of many accented and non-Latin characters.

The asset loader now merges default/alt JSON definitions across pack layers,
loads bitmap dimensions/ascent/character rows, and respects native fallback
order. High-priority pack definitions add providers without discarding lower
fallbacks. Bitmap texture files and TTF resources honor namespace and pack
priority. Reloading packs recreates provider caches and font textures.

Force Unicode filters the default font to legacy Unicode providers. Merely
selecting a non-English language no longer forces those old glyph pages.
Native Unicode glyphs use half-pixel bold/shadow offsets; bitmap and TTF fonts
use their native bearings/advances. Missing glyphs use the native box fallback.
The alternate galactic font has its own provider stack.

TTF providers use stb_truetype compiled to embedded WebAssembly, with no system
font or Canvas text substitution. Provider `size`, `oversample`, `shift` and
`skip` settings feed native glyph metrics and rasterization. Lazy atlas pages
are ordinary device textures and work with the WebGL, WebGPU and software
rendering paths. The source and reproducible build are in `tools/font/`.

References were read directly from the pinned jar: `cif` provider stacking,
`cip$a`/`cip$b` bitmap metrics, `cit$b` Unicode offsets and `ciu`/`ciu$b` TTF
metrics/rasterization. The vendored stb revision is recorded in its README.

Tests use the real jar definitions and pixels, check Polish/Cyrillic/arrow glyphs,
provider priority, fallback, pack reload, force-Unicode selection, bitmap scaling
and a project-authored TTF fixture's actual pixels and fractional metrics.
This provider system is carried into 1.14.4; it is not backported into 1.12.2 or
1.8.9, whose native font renderers predate it.
