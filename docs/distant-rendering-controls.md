# Distance rendering and animated atlas mipmaps

The confirmed opaque/black foliage path forced fancy:false for every distant LOD section. Leaf quads then entered the solid draw layer, which does not discard transparent texels. Distant meshes now preserve the selected native Fancy/Fast leaf mode by default. MinecraftJS Extras offers Fast Distant Leaves as an explicit opt-in. Near meshes are unaffected by this extra setting. Small LOD-skipped plants remain an intentional existing terrain simplification; this patch does not claim a captured reproduction of every distant grass report.

Animated atlas sprites previously changed level zero only. WebGL2 and WebGPU rebuilt mips for full-image updates but not sprite edits, so distant fire/water/compass frames stayed frozen. Sprite edits now carry the current shared atlas pixels and update the bounded, coarsest-grid-aligned affected mip regions. There is no whole-atlas CPU rebuild each sprite and no duplicate retained atlas copy. Filtering remains alpha-weighted. Both GPU adapters use the same patch builder; the software renderer has no mip levels.

Independent Extras controls:
- Fast Distant Leaves: off by default, permits opaque distant leaves while retaining near Fancy leaves.
- Reduce Distant Mob Animations: on by default, retains the existing 2/4-tick distant pose update throttle; off updates every frame.
- Animate Distant Textures: on by default, updates animated sprite mip levels; off keeps only close level-zero animation. Re-enabling refreshes the mip chain immediately.

These are MinecraftJS extensions, not new vanilla Video Settings rows. Existing named version layouts and native leaf definitions remain intact.

Validation: all nine targets pass native mesh alpha routing, independent animation throttling and Extras layout tests. Dirty-region results equal full alpha-weighted rebuilding for aligned/unaligned, NPOT, narrow and edge cases. Adapter tests verify every uploaded level/origin for WebGL2 and WebGPU. Real headless WebGL readbacks confirm animated, intentionally frozen and resumed pixels at mip levels 0–4 without GL errors on each target. No desktop GPU FPS gain is claimed; correct distant texture animation adds bounded upload work.
