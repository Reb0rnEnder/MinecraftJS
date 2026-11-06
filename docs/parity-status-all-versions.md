# Remaining parity work across supported versions

Updated 2026-11-06. **No branch is certified as full vanilla parity.** This is the current known-work inventory, not an exhaustive fresh audit of every release. Older feature ledgers contain historical findings; a historical row must be reproduced against the current branch before it is treated as a current bug. Missing implementations and unexecuted acceptance scenarios are different.

## Shared implementation work

- **Adventure restrictions:** basic native permission gates are now implemented and regression-tested on all existing targets. Complete item-specific outcomes and native block-entity save-state matching remain open on applicable targets. Older versions use block-name lists; later versions support block predicates, tags, state and block-entity constraints. Do not prevent valid Adventure container/block interactions or item use in air.
- **Native rendering:** Fabulous multipass/translucency remains absent on 1.16.5 and later. Powered dragon-head animation remains absent on eligible targets (1.12.2 onward among our branches). Piglin-head animation applies only to the enabled 1.20 experiment in 1.19.4 and stable later targets.
- **Account services:** Microsoft block-list integration and applicable social/account behaviors remain incomplete. Incoming signed player-message verification exists on 1.19.4, but authenticated outgoing signed sessions/command arguments and reporting do not.
- **Optional products:** integrated singleplayer/world creation and native Realms are not implemented. They are additional product work if full parity includes them, not server behaviors to approximate inside the multiplayer client.

## Version-specific remaining work

All targets also need the cross-version acceptance work below. Entries here identify the principal existing ledgers and native release gates; they are not completion percentages.

| Existing branch | Remaining native-version work |
| --- | --- |
| **1.8.9** | Adventure block-name permissions; complete legacy combat/item-use, mob/equipment states, GUI/text and client sound/particle acceptance; uncommon protocol/reconnect cases. The native .1f default entity pick radius is deliberately retained. |
| **1.12.2** | Adventure block-name permissions, powered dragon heads; remaining 1.9–1.12 item/dual-hand, mob pose/equipment, workstation and client patch acceptance. Newer predicate/atlas/chat features do not belong here. |
| **1.13.2** | Predicate-based Adventure permissions and powered heads; complete aquatic interaction/animation, fluid/fog/particle, recipe/menu/resource-pack and patch acceptance. Existing recipe and NBT-query decoding are fixed, not still missing. |
| **1.14.4** | Adventure/powered-head work plus remaining workstation/recipe-book, raid effects, mob variant/pose/equipment, placement and navigation/narration scenarios. Its older topic matrix is an acceptance backlog and needs fresh reproductions; it is not a fresh count of missing implementations. |
| **1.15.2** | Adventure/powered-head work plus bee/hive interaction, honey/bottle/shears outcomes, item-use/effect sequencing, particle collision and item-lighting/animation acceptance. Existing extracted bee models and honey movement are implemented. |
| **1.16.5** | Fabulous rendering, account blocking/social services, Adventure/powered heads; remaining Nether item/vehicle/equipment/dimension, UI/command and patch acceptance. |
| **1.17.1** | Inherited 1.16.5 gaps; full powder-snow/equipment/freezing, goat/axolotl/glow, candle/dripstone/amethyst/vibration and travel/container acceptance, plus native debug/GUI/command/particle audit gates. |
| **1.18.2** | Inherited applicable gaps; exact cylindrical/environment fog, cloud/biome/altitude presentation, remaining F3/options/audio-device behavior, rare registry/dimension/pack and tall-world acceptance. |
| **1.19.4** | Confirmed open: display-entity rendering/transforms/interpolation; Adventure predicates; outgoing signed chat/commands and reporting; atlas JSON sources/generated palette sprites; powered dragon/piglin heads. Investigate native cache-center residency and unresolved floating chest-boat walking jitter. See the full review for acceptance requirements. |
| **1.20.6** | Native transport/Configuration has an initial isolated-server offline gate. Still needs encrypted/account login and transfer acceptance, complete Play codecs, configuration-registry integration, terrain/light/entity metadata, 1.20.5+ item components, recipes/menus/inventory, native generated assets/runtime identity, then stable 1.20–1.20.6 content and GUI/rendering acceptance. The graphical runtime is still a 1.19.4 baseline, not a playable/full-parity native 1.20.6 client. |

## Cross-version acceptance still required

- Every block/item use outcome and support/orientation permutation, workstation slot/click/recipe synchronization and reconciliation after rejection.
- Mob state transitions, baby proportions, equipped/held layers, passengers/leashes and block-entity transforms against each exact native client.
- Client sound triggers and physical playback; particle trajectories/collision/tints, lighting/fog/material transitions and reload behavior.
- GUI pixels, keyboard/focus/scrolling, narration, language/font behavior and command errors/completion against the target release.
- Rare valid packet bodies, proxy transfers, custom registries/dimensions and resource/data-pack combinations. Handler presence alone is not behavioral validation.
- WebGL2/WebGPU/software scene acceptance; representative CPU/GPU/memory captures. No 600-FPS guarantee or unmeasured Java comparison is made.

Full OptiFine shader-pack render graphs, sky/water reflections/shadows and Eagler extensions are separate compatibility work. They do not establish or block vanilla feature equality by themselves; user-requested extension tasks remain open in their own ledgers.

## Fixed and pushed at this checkpoint

The applicable existing branches now include native world-border decoding, interpolation/collision/rendering/warnings and server look-at; fresh-player respawn with release-specific metadata/attribute retention and initial-health handling; current-binding keybind text and native custom chat completions; per-class entity pick radii; seeded sound selection and native sample attenuation. No newer protocol field, entity feature or resource format was added to ineligible older targets.

The selected 1.19.4 native audit passes **416 tests in 59 files, zero failures/skips**. Focused applicable regressions and browser-bundle compilation pass across the ten worktrees. These are concrete checks, not a blanket certification of every GUI, effect or server sequence. Source changes are pushed; offline/static distributions have not been regenerated for this checkpoint.

## Execution order and the 1.20.6 gate

1. Finish the confirmed 1.19.4 implementation gaps, preserving exact native behavior. Review and backport/forward each shared change, regress it and push it as an independent batch.
2. Close outstanding native interaction/visual/reconnect acceptance gates; do not silently mark an unverified feature complete. Account signing/reporting needs authenticated acceptance, not fabricated signatures or a claimed live account test.
3. Continue the **existing** 1.20.6 worktree with its staged transition plan once the preceding fixes are complete. Do not create a duplicate branch or relabel old assets/protocol as a completed port. Carry remaining validation gates forward explicitly.
4. Rebuild distributions only as a coordinated checkpoint with source commits, manifest and checksums updated together.

## Evidence ledgers

- [1.19.4 full review](https://github.com/Reb0rnEnder/MinecraftJS/blob/1.19.4/docs/full-parity-review-1.19.4.md)
- [Earlier supported-version review](https://github.com/Reb0rnEnder/MinecraftJS/blob/1.19.4/docs/supported-version-parity-audit.md), [1.14.4 topic review](https://github.com/Reb0rnEnder/MinecraftJS/blob/1.14.4/docs/feature-audit-1.14.4.md), [1.15.2 review](https://github.com/Reb0rnEnder/MinecraftJS/blob/1.15.2/docs/feature-audit-1.15.2.md)
- [1.16.5](https://github.com/Reb0rnEnder/MinecraftJS/blob/1.16.5/docs/parity-1.16.5.md), [1.17.1](https://github.com/Reb0rnEnder/MinecraftJS/blob/1.17.1/docs/parity-1.17.1.md), [1.18.2](https://github.com/Reb0rnEnder/MinecraftJS/blob/1.18.2/docs/parity-1.18.2.md)
- [1.20.6 plan](https://github.com/Reb0rnEnder/MinecraftJS/blob/1.20.6/docs/transition-1.20.6.md) and [measured development evidence](https://github.com/Reb0rnEnder/MinecraftJS/blob/1.20.6/docs/development-1.20.6.md)

Exact-version jars/mappings determine implementations. Historical Wiki inventories and available official notes establish release scope; restricted Wiki data is recorded as unavailable in the linked reports. Local servers/worlds, screenshots, shader packs, session/configuration files and user captures are preserved outside these commits.
