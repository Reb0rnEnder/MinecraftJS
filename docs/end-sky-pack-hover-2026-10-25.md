# End sky and resource-pack entry hover — 2026-10-25

The renderer previously allowed sky drawing only in dimension 0. The End was
therefore only a fog-coloured clear, without its textured sky. It now draws the
jar's `environment/end_sky.png` on six inward-facing cube faces at ±100, with
16×16 repeated UVs and the vanilla 40/255 RGB tint. The camera's rotation affects
it, while world position does not. The sky pass writes no depth and applies no
terrain fog or lightmap. Texture lookup goes through Assets on each draw so
resource-pack changes use the replacement texture.

Reference: pinned 1.13.2 jar, `cue.s()` (renderSkyEnd) and `cue.a(float)`
(renderSky). Older clients use the same six-face sky and their own jar texture.
The Nether is a non-surface dimension with fog and no textured skybox, stars,
sun, moon or clouds. Its existing fog-only behavior is retained and tested.

Resource-pack action controls now appear while the pointer is anywhere in the
entry, or in touchscreen mode. Add/remove/reorder highlights still depend on the
specific icon region under the pointer. The built-in default pack has no move
actions. Incompatible-pack warnings and click/confirmation behavior are retained.

Both fixes are applied to 1.13.2, 1.12.2 and 1.8.9 and carried forward onto the
1.14.4 development branch. `tools/test-sky-pack-regressions.mjs` uses each stable
version's actual End texture and the software rasterizer to check all six viewing
directions, non-flat texture detail, exact tint, no depth writes, camera-position
independence and replacement textures. It also checks dimension transitions,
Nether fog/no-sky behavior, full-row hover, action highlights, reordering edges,
touchscreen mode and the default entry. The shared client regression suite and
single-file release builds are also run on all three stable versions.
