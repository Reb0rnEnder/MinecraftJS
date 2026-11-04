# Visual parity and performance todo

This is the project-wide tracker; each feature applies only to its native versions. Work starts with small, independently reviewable corrections. Push each validated batch; backport shared fixes to every native applicable target. Do not add post-1.18 chat/security features to older clients. Preserve user servers, packs and captures.

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

- [x] Fix the confirmed opaque distant foliage LOD path and stale animated atlas mipmaps. Preserve Fancy alpha by default. A separate distant-grass screenshot reproduction remains open if it persists.
- [x] Expose separate controls for intentional distant terrain simplification and distant fire/mob animation reductions. Keep native-quality alpha correctness independent of optimisations.
- [x] Add opt-in bounded CPU/frame/draw/mesh performance capture with hook cleanup and local JSON download.
- [ ] Collect representative gameplay profiles and GPU timing; compare the same world/camera/settings with separately measured native FPS. CPU capture is not GPU execution time.
- [x] Profile actual collision code, remove unnecessary entity body-box work, backport the behavior-preserving optimization, and record mod applicability and CPU replay measurements.
- [ ] Profile remaining rendering/GPU regressions in representative gameplay before larger batching changes.

## Version-specific UI and chat

- [x] Restore the native 1.19.4 server-policy verification warning toast, including multiline dimensions and ten-second lifetime. This feature starts in 1.19.1 and is not backported to 1.18.2.
- [x] Render native 1.19.4 trust bars and hover explanations; preserve tags through delayed/wrapped messages and distinguish system messages.
- [x] Implement 1.19.4 cached signature references, native queued/displayed message deletion, minimum display timing and styled partial filtering.
- [x] Verify native 1.19.4 incoming Mojang certificates, session/message signatures and replay chains; drive native trust tags from validated results.
- [ ] Complete outgoing signed account sessions/command arguments, reportable logs and authenticated report submission.
- [x] Compare and correct Social Interactions native geometry, tabs, row spacing/icons, version-specific search fields, scrollbar input and resize behavior (1.16.5+ only).
- [ ] Finish Social Interactions reference-image, keyboard/narrator, recent signed-message/offline-history and reporting gates.
- [x] Audit the former chat-hover/UI regression failures: correct target-version fixture metadata, native HUD baselines and scrolling option-list expectations. Native item tooltip/hover behavior passes across all nine targets.

## Validation/publication

- [ ] Run focused regressions and native-source checks per applicable target, then push the corrected named branches.
- [ ] Record which tasks and native-image gates remain unfinished. Existing Gofile artifacts are the earlier build snapshot, not future commits from this list.

The preceding build's 18 actual Gofile URLs and hashes are recorded in `/home/ender/minecraftjs/dist/uploads/README.md` and `gofile-uploads.json`. Full native shader sky/water/shadow support remains a separate unfinished renderer task described in `preloading-and-real-shader-pipeline.md`.

- [x] Iron golem native crack overlays (1.15+ only): damage/repair thresholds, invisibility, lighting and LOD updates. See [native audit](iron-golem-cracks.md).
- [x] Villager offer decoder/screen field mismatch: [packet-to-screen regression and backport audit](merchant-crash-1.19.4.md).

- [x] Server/client view-distance mismatch: indexed pending meshes, cached column occupancy, bounded GPU terrain retention; identical light and overlapping invalidation work removed where native separate-light packets exist. [Backports, replays and remaining candidates](view-distance-performance.md).

- [x] Splash/lingering potion use, native pickup/button/comparator sounds and consume effects: [version-specific trigger audit and Ogg decode results](client-sound-trigger-audit.md).
- [ ] Complete native tool/bucket/bottle success predicates and their player-excluded local sound paths; audio asset tests do not prove these interactions complete.
