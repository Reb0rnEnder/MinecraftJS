# Quick visual fixes — 2026-11-04

- All nine native clients: terrain particles now ask the existing native-version block/biome colour provider for tint index 0. Grass-block dirt particles stay untinted; precoloured leaf textures stay precoloured; black explicit tints are preserved. Hit/sprint particles carry their source block position. A complete break burst computes its colour once instead of repeating the biome blend 64 times.
- 1.14.4–1.19.4: the resource loading overlay now exposes its parent's panorama to the outer game renderer during the phase that reveals the parent. It does not draw a hidden cubemap during the fully opaque phase. Earlier native loading screens do not gain a newer fade overlay.
- 1.13.2–1.19.4: undyed shulker boxes join the block-entity scan, animated collision, non-opaque/special-render classification and lid/block-action path. Light-gray boxes use the actual `shulker_light_gray.png`; undyed boxes use `shulker.png`.
- 1.12.2: normalized light-gray data names are recognized as special/non-opaque shulker blocks, while item rendering preserves that version's `shulker_silver.png`. No undyed boxes or new shulker feature is added to 1.12.2 or 1.8.9.

Native references inspected: pinned 1.19.4 `TerrainParticle` (`fgx`, block-colour index 0 with `Blocks.GRASS_BLOCK` exception) and `LoadingOverlay` (`esq`, parent screen rendered during the native fade phases), plus each target's extracted block definitions/model bundles and real texture paths. The new tests build all registered box variants and verify both placed and inventory materials against their target's actual extracted textures.

History checks: [Leaves](https://minecraft.wiki/w/Leaves#History) records biome-coloured breaking particles since Java Alpha v1.2.1. [Shulker Box history](https://minecraft.wiki/w/Shulker_Box#History) and [18w10b](https://minecraft.wiki/w/Java_Edition_18w10b) place undyed boxes in 1.13, not 1.12. Older clients retain their native block registrations and texture naming.

Regression checks: `test-terrain-particle-colours.mjs`, `test-shulker-box-rendering.mjs`, `test-sprint-particles.mjs`, existing loading/world-event/portal particle checks on every target; `test-loading-panorama-fade.mjs` on the six overlay targets exercises the real `Game.renderFrame` dispatch, not just PNG preloading. Shulker tests skip on 1.8.9 because that version has no boxes. The tracked todo records the remaining reports; they are not marked fixed by this batch.

The earlier nine HTML/static builds and Gofile URLs remain an immutable snapshot of the preceding commits. This source batch is pushed separately; those downloads are not relabelled as containing later fixes.
