# F3 audit across supported versions

Reference: the user's `realscreenshot.png` (1.17.1), each target's native debug
class and renderer/Minecraft/cache format strings, and the Minecraft Wiki history.
The screenshot remains a local user file and is not added to Git.

| Target | Native class | Version-specific differences retained |
| --- | --- | --- |
| 1.8.9 | avv | Chunk-update/VBO suffixes, legacy cache/entity text, one local-difficulty value, no debug-help footer. |
| 1.12.2 | bjd | Adds clamped difficulty and the help footer, including reduced-debug mode. |
| 1.13.2 | cgx | Server traffic, namespaced biome/dimension, FC n/a, separate left-side block/liquid coordinates, right-side block/fluid/tag data. |
| 1.14.4 | czn | Client Chunk Cache capacity/loaded count; Client Light and CH; sounds; FC 0. Multiplayer has no server chunk, so no SH/Server Light row. |
| 1.15.2 | ddb | Removes chunk-update/VBO suffixes; adds FPS biome-blend B; client fallback SH/Server Light. |
| 1.16.5 | dlp | Target coordinates move into right-hand headings; sounds include mood; graphics mode in FPS text. |
| 1.17.1 | dxh | Chunks[C] world/entity-storage metrics; no Server Light row; retains CH/SH and target-heading coordinates. |

The shared formatter chooses the appropriate content for the active version.
Formatting and order now include native FPS/entity/particle/cache line families,
client light, heightmaps, biome/difficulty, sound/mood and reduced-debug footers.
Allocated memory no longer incorrectly repeats the maximum heap size.

Heightmap predicates for 1.14+ are extracted by invoking the native Types'
`isOpaque` predicates for every block state, verified against the pinned jar.
CH is calculated from the live column and cached with block/chunk revision
invalidation. Missing multiplayer O/ML maps retain the native -1 result. Packed
heightmap reads distinguish pre-1.16 continuous arrays from padded long arrays.
The regeneration tools preserve this extraction step.

Server branding is read from minecraft:brand; packet rates use actual play
packet counters. Cache capacities use the server view radius. Browser entity
storage is represented by its actual entity/occupied-section/loaded-column counts.
These measurements reflect this renderer rather than copied screenshot numbers.
The browser runtime, device and heap remain truthful. WebAudio has no fixed
OpenAL source pools, so absent backend limits display infinity, not invented
247/8 hardware capacities. Native integrated-server-only rows remain absent.

Checks: `tools/test-debug-version-layout.mjs` runs on all seven targets and tests
full/reduced layouts, release-specific labels/targets, packet rates, allocation
format and native heightmap predicates/updates/packed-array boundaries. Browser
and distribution checks accompany the change; the native sources and temporary
decompiler output remain outside the repository.

The [Wiki history](https://minecraft.wiki/w/Debug_screen?mobileaction=toggle_view_mobile)
corroborates the target-field move in 1.16 and FPS change in 1.15. Its current
page describes a newer redesigned overlay, so it is not used as the old layout.
The 1.18.2 region-file addition belongs to the next target, not these backports.

The isolated F3 browser probe passed on all seven source clients. A separate
software-rendered live-server probe timed out before F3 was enabled, so it does
not establish sustained multiplayer HUD acceptance for this change. Existing
1.17.1 headless join limits remain documented in the parity ledger.
