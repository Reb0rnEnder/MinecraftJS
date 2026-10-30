# Native block render layers

The static translucent-name list omitted tinted glass (1.17) and honey blocks
(1.15). Their textures were therefore drawn in a solid/cutout pass. The runtime
now reads each block's client render layer extracted by executing the pinned
ItemBlockRenderTypes lookup, independently of its light-blocking properties.
Tinted glass is translucent and blocks light. Honey's correction applies to
1.15.2, 1.16.5 and 1.17.1; tinted glass stays exclusive to 1.17.1.

`tools/extract-render-layers.mjs --write|--check` verifies the target client hash,
executes `ExtractRenderLayers.java`, and validates a complete block-name table.
The native runtime generation ends with this step. Partial tables fail instead
of silently falling back for newly added blocks. Native data covers 680, 763 and
898 block definitions on the three respective versions.

The extraction world also returned 256 for every integer method, including
BlockGetter.getMaxLightLevel, whose native result is 15. That produced excessive
light opacity in 1.16.5/1.17.1 render tables. The proxy distinguishes that method
now. Regeneration changes only light opacity (1,666/1,741 states respectively).
The same extraction correction is applied to 1.14.4/1.15.2; their existing tables
are unchanged when re-extracted. World height remains 256 in this fixture.

`test-render-layers.mjs` checks every target-native blend classification,
tinted-glass opacity, blended meshes in Fast/Fancy/distance LOD, and incomplete
tables. The controlled 1.17.1 tinted-glass browser probe renders different walls
behind a real worker-built glass block, verifies that their colors remain visible
in Fancy/Fabulous, and reports no GL/console errors. These scenes do not connect
to or edit a game server.
