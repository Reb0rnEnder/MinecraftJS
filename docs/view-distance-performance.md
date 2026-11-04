# View-distance performance fixes — 2026-11-04

A server sending a 32-chunk radius while the client selected 10 left tens of thousands of deferred sections in Game.dirty. Every rendered frame iterated all keys, split each coordinate string, and discarded distant entries again. These entries remain pending until movement or unload, so the cost persisted after nearby meshing finished.

## Changes

- DirtySections preserves Set membership/iteration semantics and indexes pending work by column. The scheduler queries only the selected radius plus its existing one-column meshing margin. Coordinates are parsed when membership changes. A cached nearby query survives dirtiness arriving outside that range; movement, range changes and nearby mutations invalidate it. This trades some index memory for eliminating repeated scans/allocations of deferred work.
- SectionCuller caches loaded-column occupancy while the world chunk-generation number, camera column, grid allocation and lookup callback remain unchanged. It still performs the original frustum/occlusion walk for camera movement; load, unload, world changes, radius changes and callback replacements refresh occupancy. Callers without an explicit revision retain the old always-refresh behavior. With radius 32, this avoids 4,489 world lookups on subsequent camera/frustum changes within the same column.
- Terrain GPU meshes are released beyond selected radius plus a two-column margin when the camera column/range changes. Eviction marks the section pending again and invalidates distant build leases, so revisiting it rebuilds from retained world data. Late replies cannot resurrect old meshes. World blocks, biome/light data and server updates remain intact. The retention margin is an implementation choice outside the visible culling radius, not a claim that vanilla uses this exact GPU cache.
- On targets with independent Update Light packets (1.14.4+), identical owned light buffers are reused and unchanged packets do not force remeshing. Sky-known state and data-vs-empty masks remain significant even when all bytes are zero. Overlapping neighbour invalidations are coalesced: updating all 24 interior layers issues 216 unique section-dirty notifications instead of 630 repeated notifications. First updates, real changes and boundary layers still invalidate the same set of sections.
- The opt-in performance capture includes nearbyDirtySections alongside total dirtiness. No permanent profiling hooks were added.

The client already sends its selected view distance in Client Settings when leaving Video Settings and through the F3 distance shortcut. This was inspected and retained. The changes also handle servers/proxies that send more terrain anyway. Receiving/decoding that terrain still costs CPU; this patch does not claim to remove all stream-loading work.

## CPU replay

`node tools/benchmark-view-distance.mjs` runs the actual Game scheduler against its previous-source oracle, then the actual SectionCuller with/without occupancy reuse. Five rounds, medians; Node v22.23.3 in this workspace. Scheduler: server radius 32, selected radius 10, 88,704 pending sections outside the active 11-column margin, 15 frames per round. Culling: selected radius 32, 21×21 loaded server columns, camera moving inside one column, 30 walks per round, native target height. No geometry is drawn in this CPU replay.

| Version | Scheduler before / after (ms per call) | Culler before / after (ms per call) |
|---|---:|---:|
| 1.8.9 | 8.586 / 0.0006 | 0.424 / 0.265 |
| 1.12.2 | 8.832 / 0.0006 | 0.427 / 0.258 |
| 1.13.2 | 8.426 / 0.0006 | 0.420 / 0.252 |
| 1.14.4 | 8.678 / 0.0006 | 0.426 / 0.259 |
| 1.15.2 | 8.753 / 0.0006 | 0.412 / 0.266 |
| 1.16.5 | 9.262 / 0.0006 | 0.426 / 0.258 |
| 1.17.1 | 9.067 / 0.0006 | 0.449 / 0.297 |
| 1.18.2 | 8.701 / 0.0006 | 0.483 / 0.294 |
| 1.19.4 | 8.506 / 0.0006 | 0.455 / 0.295 |

The idle-deferred scheduler improvement removes actual redundant work; sub-microsecond measurements should be read as effectively below 0.01 ms, not as an exact universal cost. Raw rounds are in view-distance-performance-results.json. These are isolated synthetic CPU measurements, not game FPS, measured GPU execution, Java/server comparisons or a guarantee of 600 FPS. At 600 FPS the entire frame budget is about 1.67 ms. User hardware, actual draw submissions, entity density, shaders, resolution, browser scheduling, VSync and caps still matter.

## Comparison with the requested projects

| Primary source | What applies here |
|---|---|
| [Sodium section manager](https://github.com/CaffeineMC/sodium/blob/dev/common/src/main/java/net/caffeinemc/mods/sodium/client/render/chunk/RenderSectionManager.java) | Keep camera-local rebuild work separate from remote terrain, retain derived visibility inputs until invalidated, and bound retained render resources. The new index/cache/residency policy applies these principles in our existing renderer; no Sodium source was copied. Region buffer arenas and opaque/cutout multi-draw remain a larger future change. |
| [Lithium](https://github.com/CaffeineMC/lithium) | Spatial candidate selection and avoiding redundant work. The previous collision early-rejection fix is already backported. This batch applies indexing to pending terrain; it does not add an entity spatial index or port server-only AI/ticking. |
| [Starlight technical details](https://github.com/PaperMC/Starlight/blob/fabric/TECHNICAL_DETAILS.md), [Phosphor](https://github.com/CaffeineMC/phosphor-fabric) | Lighting propagation optimizations primarily target a different path from receiving authoritative server light here. This batch removes redundant client light copies/remesh invalidations while retaining server values; it does not import or replace a light engine. |
| [EntityCulling](https://github.com/tr7zw/EntityCulling) | Uses async visibility testing. We already skip entities/block entities using frustum and section visibility; this batch makes the shared visibility inputs cheaper. Fine-grained per-entity occlusion is still absent. A single center ray is not equivalent and could hide a partly visible model, so that shortcut was not added. |
| [ImmediatelyFast](https://github.com/RaphiMC/ImmediatelyFast) | Efficient immediate-mode batching/uploads. Inspection confirms GUI quads and entity model parts already batch into shared uploads; shader/output target, lighting and transparency state still constrain grouping. No new batching speedup is claimed in this batch. Profile actual draw counts before implementing cross-entity or terrain region batching. |
| [Fabulously Optimized](https://github.com/Fabulously-Optimized/fabulously-optimized) | A collection of component mods, not another standalone renderer. Its components guide the separate checks above. |

## Backports and verification

Dirty scheduling, culler occupancy caching, GPU mesh residency and diagnostics are backported to existing 1.8.9, 1.12.2, 1.13.2, 1.14.4, 1.15.2, 1.16.5, 1.17.1, 1.18.2 and 1.19.4. Each branch retains its native fixed/dynamic vertical bounds, meshing priority policy and mesh layers. Separate light-packet changes apply only to 1.14.4 and later; no such packet or newer masks were added to legacy targets.

Differential tests compare indexed queries with full Set scans and actual scheduling with the previous scheduler through signed coordinates, camera movement and distance changes. Culling output/reached counts match fresh walks through movement, load/unload revision changes and distance changes. Tests cover mask semantics, light-before-terrain, buffer ownership, unique invalidations, worker token rejection and mesh re-entry. Existing worker/upload, visibility-cache, LOD, capture and golem regressions pass. An older first-person overlay test fixture was given the world lookup its current HUD requires; production overlay code is unchanged.

All nine targets also pass a headless Chromium test using actual WebGL buffers: an out-of-range mesh is released, its in-range neighbour remains alive, distant traffic preserves the cached active query, and stale worker replies cannot replace a newer lease. This validates WebGL resource ownership, not real desktop GPU speed. The scheduling/light changes use shared backend-neutral interfaces; WebGPU/software throughput was not measured in this batch.

No user configuration, worlds, captures, resource packs or shader packs were changed. Distribution HTML/manifests/checksums were not rebuilt. For a hardware-focused next pass, use [the ten-second browser capture](performance-capture.md) in the slow area, compare selected/server distances without changing the scene, and inspect meshScheduling, culling, worldRender, draw submissions and entity/tile costs. Region batching, incoming terrain decoding and tile scans remain candidate next targets; the actual capture determines which dominates.
