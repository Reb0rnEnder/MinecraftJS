# Loading screens and login terrain corrections

Startup logo geometry uses the target version's GUI scale. The 1.8.9–1.13.2
clients retain their square Mojang splash on white. The 1.14.4/1.15.2 clients
add the native 300-by-10 progress bar, red fill, smoothing and reload fades.
The 1.16.5 client uses the responsive two-part Mojang Studios atlas on red,
additive logo blending and white progress outline. Native 1.14 and 1.15 fill
widths differ by one pixel; that difference is retained.

The modern loading overlays also handle resource-pack selection, server packs
and F3+T reloads. Their completion fades over the parent screen or game view,
while input remains blocked. Startup uses the same native completion phases.
Downloading Terrain remains the version's dirt background and centered status.
These are client loading screens; local world generation is server-owned.

Geometry and timing were compared with `LoadingOverlay` from the pinned native
1.14.4, 1.15.2 and 1.16.5 jars. `test-loading-screens.mjs` checks scaling,
geometry, colors, atlas blending and completion timing. Browser startup and
resource-reload checks complement the isolated layout tests.

The 1.16.5 terrain decoder no longer rejects a section count above 4096.
`LevelChunkSection.recalcBlockCounts` also adds non-empty fluids to that counter,
so a fluid-filled section can legitimately report 8192. Actual occupied cells
are recounted independently for rendering. A full packet regression exercises
this case. Palette-width normalization follows `PalettedContainer.setBits`;
1.14.4 and 1.15.2 receive the matching normalization fix while retaining their
older continuous bit packing.

The empty-hand activation fix applies to flattened block versions (1.13.2+):
wooden doors, gates and trapdoors consume the first successful hand interaction,
including all wood variants. Missing block names previously allowed a second
hand packet to toggle the same block back. Iron doors and item/sneak bypass rules
remain subject to their native behavior. Statistics/structure translation fixes
also apply to 1.13.2+; the `pack.*` resource-pack keys and updated pack-screen
header/tooltip are specific to 1.16.5.
