# Visual parity and performance todo

Work starts with small, independently reviewable corrections. Push each validated batch; backport shared fixes to every native applicable target. Do not add post-1.18 chat/security features to older clients. Preserve user servers, packs and captures.

## First: quick visual corrections

- [x] Show the preloaded panorama behind the loading overlay while it fades, rather than waiting for the loading screen to close.
- [x] Tint terrain/breaking particles from the source block and biome; preserve grass-block and already-coloured-texture exceptions.
- [x] Restore shulker boxes, including the undyed variant and the native light-gray texture name. Undyed boxes start at 1.13; 1.12 keeps its native silver naming.
- [x] Keep attempts to run real shader code when capabilities are missing, with explicit per-stage/buffer warnings. Do not restore generated cloud/wave/lightmap replacements.

## Next: entity and inventory rendering

- [x] Draw armour, held main-hand items and offhand shields/items on the inventory player preview, using native-version equipment/pose rules.
- [x] Correct dropped-item collision/ground support so items do not fall into solid blocks.
- [x] Preserve item entities for the native collection flight into the collector rather than immediately deleting them on inventory update.

## Then: distance rendering and performance

- [ ] Reproduce and fix opaque/black distant grass. Identify alpha-test, mipmapping and LOD interactions before changing unrelated graphics settings.
- [ ] Expose separate controls for intentional distant terrain simplification and distant fire/mob animation reductions. Keep native-quality alpha correctness independent of optimisations.
- [ ] Instrument and profile CPU ticks, meshing/worker uploads, entity rendering, draw submission and GPU passes. Compare the same world/camera/settings; do not fabricate vanilla FPS or assume the new preload budget improves steady-state FPS.
- [ ] Investigate recent performance regressions before adding more expensive shader/rendering work.

## Version-specific UI and chat

- [ ] Audit native 1.19.4 chat signing/trust state and its message-verification warning/dialog. Unsigned/system messages must retain their proper native distinctions; do not claim cryptographic verification that was not performed.
- [ ] Compare the social interaction screen with the exact native source: tabs, row geometry, icons, filtering, tooltips and blocking/reporting behavior. Apply only to versions where this screen exists.

## Validation/publication

- [ ] Run focused regressions and native-source checks per applicable target, then push the corrected named branches.
- [ ] Record which tasks and native-image gates remain unfinished. Existing Gofile artifacts are the earlier build snapshot, not future commits from this list.

The preceding build's 18 actual Gofile URLs and hashes are recorded in `/home/ender/minecraftjs/dist/uploads/README.md` and `gofile-uploads.json`. Full native shader sky/water/shadow support remains a separate unfinished renderer task described in `preloading-and-real-shader-pipeline.md`.
