# 1.17.1 vertical world bounds

The pinned official DimensionType codec accepts aligned min-Y and height,
min-Y at least -2032, height at most 4064, and an exclusive upper bound at most
2032. Logical height cannot exceed build height. This follows native `cnv` in
the pinned 1.17.1 client, with the historical addition cross-checked against
[dimension type history](https://minecraft.wiki/w/Dimension_type#History).

Dimension login/respawn now configures world storage rather than assuming sixteen
sections. Terrain/light BitSets retain all four possible 64-bit words. Light
boundary sections, empty masks, biome quart coordinates, padded server height
maps, worker snapshots, culling, block collisions/placement, tile scanning,
weather and void fog use the selected dimension bounds.

`test-vertical-world.mjs` covers a 384-block dimension starting at -64 and the
native maximum span, including terrain bit 130 and light bit 131. The dedicated
1.17.1 light suite covers light-before-terrain, replacement, independent empty
sections and worker invalidation. Seeded biome oracle tests still pass.
`probe-vertical-world-browser.mjs` renders four worker-built sections at Y=-32
and Y=304 in WebGL 2, checks visibility, precipitation, F3 heights and fog, and
reports no console or missing-resource errors. These are controlled scenes;
live custom-dimension travel and other adapters remain acceptance work.

Shared corrections are backported to all six older targets: a native height
of 256 no longer overflows an 8-bit height map, and section keys preserve the
full native horizontal world border without column aliases. Flattened targets
also recount each version's actual air states instead of inheriting unrelated
state IDs. `test-section-storage.mjs` passes on all seven branches. Custom
vertical bounds and protocol-756 fields are confined to 1.17.1.
