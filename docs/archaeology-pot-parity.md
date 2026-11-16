# Archaeology and decorated pots — 1.20.6

Implemented 2026-11-17 against the pinned client SHA-1 `05b6f1c6b46a29d6ea82b4e0d42190e42402030f` and its official mappings. Native classes executed by the oracle are byte-for-byte identical to the pinned jar; only jar signature files are removed for reflection.

## Completed implementation

- Decorated-pot base and side geometry now come from the native model layers. The renderer uses all 24 native brick/sherd mappings in the native back/left/right/front order; unknown non-sherd items use the brick side. The same geometry/material path handles placed, held, inventory and dropped pots. Component-sensitive cache keys prevent different decorations from sharing an icon. Item pots use the native NORTH default and retain the normal item centering transform.
- Block-entity chunk/update data now reaches pot and brushable renderers. Pots retain server-provided decorations; their stored item is deliberately not drawn, matching `DecoratedPotRenderer`. Contents/loot/counts remain server-owned. Insertion consumes the click before item placement checks, without an invented GUI, local stack consumption, local feedback sound, normal arm swing or equip dip. Sneaking still uses the normal placement path.
- Pot block event 1 selects positive/negative wobble for seven/ten ticks. Rendering uses world time and partial ticks, preserves a valid tick zero, and ignores invalid parameters. Damage overlays use the actual pot geometry.
- Brush use starts on a block, including entity obstruction at the native block reach, stops on release/lost block/changed item/200 ticks, and never starts an air-use animation. Every tenth tick at offset five emits the native sand/gravel/generic sound and seven to twelve terrain particles using native face/view/hand directions. First-person left/right brushing and third-person BRUSH arm poses are implemented. Archaeology progress, loot, item damage and completion remain server-owned.
- Suspicious sand/gravel render the server-provided emerging item only when dusted and supplied a hit face. Native face translations, fixed item display, rotation, scale and adjacent-face lighting are used. Completion event 3008 plays the native brush-completion sound in the **player** category and emits block debris, rather than a generic breaking sound.
- Archaeology and campfires read the modern saved ItemStack `id/count/components` representation. Defaults, custom model data, names, enchantments, glint and pot decoration values are retained in a render-only view. This also fixes the old `Count/tag` campfire reader in this target. Item materials are private to the tile so lighting does not alter other cached item instances. This presentation view is not a replacement for the complete native ItemStack serialization codec.

## Batch validation

`npm run test:1.20.6` passes **482 tests**, zero failures/skips, including the nine new archaeology/pot integration tests. The actual native oracle additionally records:

- 256 matrices from `DecoratedPotRenderer.render`, across four facings, valid/invalid events, time boundaries and partial ticks;
- 64 `ItemInHandRenderer.applyBrushTransform` matrices, both arms and equip positions;
- six actual `HumanoidModel.poseRightArm/poseLeftArm` brush poses;
- 24 `BrushableBlockRenderer.translations` results and 18 `BrushItem.DustParticlesDelta.fromDirection` results;
- all 24 native pattern mappings, both wobble durations, default item facing and both brushable blocks' sounds.

Run `node tools/port-1.20.6/pot-fixtures.mjs --check` and `node --test tools/test-archaeology-1.20.6.mjs`. Model extraction produces **128 models**. Development assets were rebuilt successfully using default Opus. This is not an all-version distribution publication.

Live screenshots/audio, brush interaction through complete server loot progression, projectile shattering and reconnect acceptance remain unrecorded. CONTENT-02 and CONTENT-03 are therefore **partial**, with their implementation deliverables checked off separately. No full-parity claim is made.

## Version eligibility and history

These stable archaeology consumers belong to 1.20+, while pot storage/wobble belongs to 1.20.3+. The saved-item format fix is specific to 1.20.5+ components. Existing older targets therefore do not receive these implementations. In particular, 1.19.4's optional prototype content has different data/behavior and must not receive the later stable behavior as an unconditional backport. Shared audio-builder changes were independently tested/pushed on all ten named targets.

Historical cross-checks: [Java 1.20](https://minecraft.wiki/w/Java_Edition_1.20), [Java 1.20.3](https://minecraft.wiki/w/Java_Edition_1.20.3), [Mojang's 1.20.3 notes](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-20-3). Exact runtime transforms and event ownership come from the 1.20.6 jar, not current-version Wiki prose.

## Future chunk fading

Chunk fade-in is native Java **1.21.11**, introduced in **25w44a** with its Video Settings control. It is not a missing 1.20.6 or older feature. Keep it for a 1.21.11 transition rather than backporting its option, assets or rendering behavior. References: [Mojang 25w44a](https://www.minecraft.net/en-us/article/minecraft-snapshot-25w44a), [versioned Wiki history](https://minecraft.wiki/w/Java_Edition_25w44a), [chunk history](https://minecraft.wiki/w/Chunk).

Final material review: native `RenderType.entitySolid` retains culling, while `entityCutoutNoCull` explicitly disables it. Pot base/sides now use the native culled state, including item renderers. Placed pots use the dispatcher's block-position light sample rather than the inherited brightest-neighbor approximation; brushable item lighting continues to sample its native adjacent face. The additional focused regression checks all five pot materials and both light channels.
