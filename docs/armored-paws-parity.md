# Armored Paws implementation and shared wolf fixes

2026-11-15. This batch adds the missing Armadillo renderer and Configuration-owned wolf variants/body equipment on 1.20.6. It does not certify full client parity.

## Implemented

- Armadillo geometry and all four animation clips come from the pinned client jar, including hidden shell/body geometry, walking, rolling, initial scared pose, peek events and unrolling. Native tick transitions and the client peek sound are consumed. Baby geometry and collision/eye dimensions use the native 60% scale, not the generic 50% animal scale.
- All nine wolf variants resolve the current server registry's wild/tame/angry texture keys, including custom namespaces. Tame texture takes precedence over anger as in the native renderer. Metadata uses the actual 1.20.6 accessors and partial updates preserve collar/variant state.
- BODY equipment slot 6 now reaches the renderer. Wolf armor uses its native layer geometry, dye overlay (including black), strict damage stages, and removal/repair updates. Armor remains visible on invisible wolves; collars hide while armor is equipped. Baby layer transforms follow the body model.
- Wolf sitting/walking poses use the native hierarchy and float/trigonometric behavior. Tail height follows actual health/max-health, includes zero health, and prioritizes anger. The old 20-health constant is not used for the 1.20.6 ratio rule.
- The entity runtime table now comes from the actual 1.20.6 EntityType registry rather than 1.19.4 IDs. This exposes enabled-experiment gaps honestly: Bogged/Breeze adapters and wind-charge/ominous-spawner presentation remain unimplemented. The asset validator prints Bogged/Breeze as explicitly pending instead of silently omitting their registry entries. This does not mark experimental rendering accepted.

## Native evidence and validation

`ExtractPaws1206.java` executes the pinned native methods/accessors and model setup routines. Its fixtures contain **60 tail-angle cases, 36 variant/tame/anger choices, 66 durability cases, four shell timelines, 16 wolf/armor poses, and 36 Armadillo poses**. Models and keyframe channels are extracted from native layer/animation definitions. Oracle classes are byte-checked against the SHA-1-pinned original jar before execution; the unsigned cache removes signatures, not class code. No Java graphical client or GPU/FPS measurements are claimed.

The full native-data gate and **463 JavaScript tests** pass. Development assets rebuild with **126 native models**, 26,684 validated block states and 80 stable living adapters; the log explicitly lists the two deferred experimental living adapters. All ten browser entrypoints bundle. This is a development asset rebuild, not a regenerated all-version distribution.

## Applicable backports

All nine older supported branches gain the missing wolf collar layer and native health/anger tail handling. The six targets with official mappings (1.14.4–1.19.4) regenerate Wolf/TamableAnimal/AgeableMob metadata IDs directly from their pinned jars. In particular, 1.15 removes the wolf-specific health accessor and 1.16 adds anger time; the runtime no longer shifts those fields as if they were older layouts. Partial anger updates no longer overwrite collar colors. Sitting rear-leg height preserves 22px on 1.8.9–1.14.4 and uses the native 22.7px from 1.15.2 onward.

Classic dye-damage IDs remain reversed in 1.8.9/1.12.2; flattened targets use white-first IDs. 1.8.9 uses its native sheep color table and retains its native orange default collar quirk. It also retains the native fixed-20 tail rule. 1.12.2–1.19.4 retain their absolute-health-deficit rule; the later ratio rule, variants, armor, Armadillo, body slot and experimental entities are not backported. **27 older regression tests** pass, including actual renderer visibility/metadata transitions, plus six exact-version metadata regeneration checks.

Native legacy source anchors: 1.8.9 `ua`/`blk`/`zd`/`tv`; 1.12.2 `aam`/`ccq`; 1.13.2 `akm`/`dcl`. Modern Wolf and WolfCollarLayer names resolve through each release's official mappings. The [1.20.5 release notes](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-20-5) and [versioned Wiki history](https://minecraft.wiki/w/Java_Edition_1.20.5) distinguish the new variants/armor/health behavior. [15w46a history](https://minecraft.wiki/w/Java_Edition_15w46a) records the collar-default change after 1.8. Wiki direct page retrieval was restricted during this audit; indexed history excerpts were checked alongside the exact native classes.

## Remaining work

Live brushing/scute feedback, all repair/shears outcomes and resource reload/backend acceptance still need verification. Wolf interested-head/wet-shake animation and feedback remain missing consumers. Horse/llama body-equipment inventory behavior is separate PAWS-04 work. Decorated pots/archaeology, armor trims, display entities, scoreboard formats and other gameplay families remain on the main checklist. Server AI, breeding and loot stay authoritative. PAWS-01–03 are partial, with these implemented deliverables checked separately.
