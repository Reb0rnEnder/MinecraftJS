# GUI and beam parity follow-up

Updated 2026-10-24. Definitions were checked against each pinned client jar;
`tools/extract-gui.mjs --check` verifies the committed option order, binding
categories, category order, expected pack format and client-jar provenance.
Normal builds use `client/js/gui/vanilla-layout.js` and require no Java runtime.

| Correction | 1.13.2 | 1.12.2 | 1.8.9 |
| --- | --- | --- | --- |
| Crystal/dragon beam texture cutouts | Fixed | Backported | Backported |
| Video option order from the native jar | Fixed | Verified against its jar | Verified against its jar |
| Control category order and binding categories | Fixed | Backported | Native localized category ordering retained |
| Incompatible resource-pack tint and Yes/No selection dialog | Format 4 | Format 3 | Format 1 |
| GLFW modifier names, e.g. Left Shift | Added | Native LWJGL labels retained | Native LWJGL labels retained |
| Biome Blend option and actual configurable tint blending | Added | Not a vanilla feature in this version | Not a vanilla feature in this version |
| Separate block/liquid debug rays and targeted block/fluid/entity headings | Added | Native debug layout retained | Native debug layout retained |

The beam's geometry already used the jar's tapered octagonal strip and UVs, but
its opaque draw pass ignored texture alpha. Transparent texels have white RGB,
so the entire strip became a solid gradient bar. Alpha testing now discards those
texels. A real software-rasterizer test renders the actual jar texture and compares
its coverage with the broken solid pass; this runs on all three versions.

The 1.13.2 video list removes the obsolete anaglyph option, places VSync,
Fullscreen, Particles, Mipmap Levels and VBO in their native order, and ends its
vanilla options with Biome Blend. MinecraftJS-only options follow the vanilla
list. Biome Blend defaults to radius 2 (5x5), ranges from Off through 15x15, persists
in settings, and rebuilds terrain when changed. Meshing samples the selected area
for grass, foliage and water tint. Only the biome slice's horizontal margin grows;
block/light slices retain their existing compact dimensions. Edge tests verify
samples beyond the former two-block margin.

Controls use the jar's category priorities where that version defines them, then
Java-style comparison of translated binding labels. Drop is an Inventory binding
in 1.12.2/1.13.2, and a Gameplay binding in 1.8.9. Native 1.13.2 key labels use the
jar's translated GLFW names; the older versions retain their actual LWJGL names.

Resource-pack compatibility no longer assumes format 1 for every client. The
native warning tint appears for both older and newer incompatible packs, hover
text explains the mismatch, and selecting one opens the native translated
confirmation. Cancel/Escape leaves the pack available; Yes moves it to Selected.
Compatible packs move directly. Active packs remain unchanged until Done applies
the selected list.

Native F3 traces block-only and any-fluid rays independently at 20 blocks, rather
than reusing the shorter interaction target. It reports `Looking at block:` and
`Looking at liquid:`, includes flowing/waterlogged fluids, and displays the
separate targeted headings and properties on the right. Browser/runtime-specific
statistics remain truthful to the running client.

Validation: shared regression tests, real jar textures and bytecode-derived GUI
definitions, every native 1.13.2 suite, and production HTML builds on all three
branches. This covers the corrected screens and effects; it does not certify
pixel parity of every client screen or replace a live browser/server review.

Earlier shared features remain backported: dragon/guardian/death effects,
barrier markers, particle corrections, camera-distance LOD, jar selection bounds
and sleeping-camera positioning. The previous effect and bed-selection audit
files describe their version-specific coverage. Turtle eggs, native bed block
colours, 1.13 global-palette decoding, Biome Blend and GLFW/debug changes stay
on 1.13.2 where appropriate.
