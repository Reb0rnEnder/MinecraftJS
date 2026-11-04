# Performance analysis and mod-derived opportunities (2026-11-04)

The concrete cost found in the actual Game world-collision callback was body-box work before eligibility checks. Every query read positions and built a body box for every entity, then rejected items, XP and other non-colliders. This became more relevant once dropped items used correct block-shape collision. The fix tests the existing collision eligibility first, retaining ordering, riding/dead exclusions and each branch's existing moving-boat rules. It introduces no new collision type or version feature.

## Measured CPU replay

`node tools/benchmark-collision-candidates.mjs` uses the real Game callback and World.getCollisions with native block definitions: 600 nearby entities, 5,000 queries per round, five timed rounds after warmup, median shown. Timed entities have ordinary data fields. A separate instrumented query counts body-box reads; counting getters are excluded from timings. Node v22.23.3 on this workspace:

| Version | Before (ms) | After (ms) |
|---|---:|---:|
| 1.8.9 | 16.15 | 5.23 |
| 1.12.2 | 22.16 | 10.21 |
| 1.13.2 | 21.81 | 9.85 |
| 1.14.4 | 28.98 | 10.32 |
| 1.15.2 | 27.17 | 10.28 |
| 1.16.5 | 25.41 | 9.82 |
| 1.17.1 | 26.28 | 10.02 |
| 1.18.2 | 25.49 | 9.84 |
| 1.19.4 | 25.22 | 9.87 |

1.19.4 reduced this replay from 25.22 to 9.87 ms (about 61%); the separate query reads 20 body boxes instead of 600. The earlier progress-update numbers around 163/55 ms included counting-getter overhead and are superseded by these ordinary-field measurements. Results vary by machine/load. This is a collision CPU benchmark, not game FPS, rendering GPU time, a native Java comparison or a claim that the entire reported regression is solved.

A V8 sampled CPU profile independently shows the previous callback consuming the largest sampled application cost in this replay. Its startup/GC samples cover both variants and are not a measured per-frame GC saving. Raw phase results and the sampled summary are retained in performance-collision-results.json.

## Which mod ideas apply

| Source | Application here | Status |
|---|---|---|
| [Lithium](https://github.com/CaffeineMC/lithium) / [collision options](https://github.com/CaffeineMC/lithium/wiki/Configuration-File/e107e791749f32cea8263e9712ce6227f2505dd6) | Reject impossible collision candidates before shape/body work. Spatial entity indexing is a larger next step requiring exact spawn/movement/metadata invalidation. | Early rejection implemented and tested across all nine targets; indexing is not implemented. |
| [Sodium RenderSectionManager](https://github.com/CaffeineMC/sodium/blob/dev/common/src/main/java/net/caffeinemc/mods/sodium/client/render/chunk/RenderSectionManager.java) | Reuse visibility/sort results and bound mesh uploads. Region buffer arenas and batched draw submission remain the larger rendering opportunity. | Exact-input visibility caching and upload budgets already exist. Region batching needs draw/GPU profiles and a fallback for missing WebGL multi-draw; not added speculatively. |
| [Starlight](https://github.com/PaperMC/Starlight/blob/fabric/TECHNICAL_DETAILS.md) / [Phosphor](https://github.com/CaffeineMC/phosphor-fabric) | Lighting propagation work can be reduced, but received server light remains authoritative. Measure duplicate light-triggered remeshes before changing scheduling. | No replacement light engine was imported; this is not an automatic FPS fix for a network client. |
| [OptiFine](https://optifine.net/home) | Explicit animation/detail controls and bounded chunk-update work. | Separate distant foliage, mob-pose and animated-mip controls already exist; held-wheel zoom is now supported. No vendor shader effects are recreated as unrelated approximations. |
| [Fabulously Optimized](https://github.com/Fabulously-Optimized/fabulously-optimized) | A modpack's component selection informs separate profiling targets; it is not another render algorithm to port. | Reviewed as a collection, not claimed ported. |

No vendor source was copied. Existing WebGL draw code already caches programs, uniforms, matrices, textures, VAOs and render states; adding another redundant state cache was rejected after inspection. The useful next rendering experiment is region mesh batching while preserving transparency order, resource-pack/shader inputs and WebGL/WebGPU/software behavior. It needs actual draw-submission/GPU data, not a promise based on another mod's Java benchmarks.

## Validation and limits

Differential collision tests compare the previous callback with the optimized one over randomized movers/entities, including boats, shulkers where present, passengers and dead entities. Item floor/collision and pushing regressions pass. Shared zoom/input tests pass on all nine versions. User configurations, worlds and packs are untouched.

The opt-in capture in performance-capture.md collects real gameplay CPU sections, draw submissions, mesh queue sizes and frame intervals. A representative capture on the user's slow scene and actual hardware is still needed to identify remaining rendering/GPU bottlenecks. No live native-client, Java/server profiler or user-GPU numbers are available from this run.

## Follow-up: server/client view-distance mismatch

[The measured follow-up](view-distance-performance.md) implements camera-local dirty-section indexing, loaded-column occupancy reuse, bounded GPU terrain residency and native separate-light update coalescing where applicable. It also audits EntityCulling and ImmediatelyFast without claiming their code or full algorithms were ported.
