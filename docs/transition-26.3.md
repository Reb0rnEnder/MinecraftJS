# Transition plan: Java 26.3

Updated 2026-11-25. Work in the **existing `26.3` branch**, created from `1.20.6` at `761970e`. The
milestone order is in [transition-26.3.tasks.json](transition-26.3.tasks.json); a task is complete only
when its acceptance evidence exists. Full parity is not claimed at any point in this plan.

The target is native 26.3 multiplayer client behavior, not a chain of separately shipped ports. The 17
releases between 1.20.6 and 26.3 establish when behavior changed; the final jar resolves conflicts and
hotfixes. Integrated singleplayer and Realms remain separate missing products.

## Starting point and source authority

- All pins were fetched on 2026-11-25 with direct curl and verified: metadata
  `8696584e8d2da5726487597e6c5777480387ec22`, client `e877b6a07acd633fb3bb475002175cec036e7b87`
  (41,483,720 bytes), server `33680f5f2ac32864d6d7cf5e56a705fdb3e05f4c` (62,294,556 bytes),
  asset index `7b1c46ecb5292e80d36be4ccd18118f3d7b555aa` (id 34). See
  [target.json](../tools/port-26.3/target.json) and the [input record](transition-26.3.inputs.json).
- Native `version.json` inside the client jar confirms protocol **777**, data version **5023**,
  resource pack format **97.1**, data pack format **121.0**, Java **25**. The user-supplied local jar is
  byte-identical to Mojang's client object, so the port is not built on a repack.
- **Structural change from 1.20.6:** 26.3 ships *unobfuscated*. There is no `client_mappings` or
  `server_mappings` download, `net/minecraft/client/main/Main.class` resolves, and the same jar carries
  the resource pack (`assets/.mcassetsroot`) and the data pack (`data/.mcassetsroot`). Extraction therefore
  runs against native class names instead of official mappings, and texture/model/data reads come from the
  jar. A mapping file must never be substituted, and a placeholder mapping must never reintroduce
  obfuscated names.
- The 1.20.6 branch is the forwarded baseline and is **not full parity**: inventory edge cases,
  authenticated sessions, packs/fonts, commands and inherited 1.19.4 gaps are still open there. Those
  gaps carry forward as inherited findings (P14), not as accepted work.

## Release crosswalk

Every release between the baseline and the target. Pages are recorded with retrieval method and SHA-256 in
P01 before they are treated as sources; a link here is a work item, not a completed review.

| Release | Port requirements and native acceptance focus |
| --- | --- |
| [1.21](https://minecraft.wiki/w/Java_Edition_1.21) | Trial chambers, breeze/wind charge, mace, heavy core, crafter, vault/ominous items, copper bulb families, new tuff/brick sets, armadillo/wolf armor; component and enchantment changes. |
| [1.21.1](https://minecraft.wiki/w/Java_Edition_1.21.1) | Hotfix release: verify client-visible behavior of its fixes only; do not import server internals. |
| [1.21.2](https://minecraft.wiki/w/Java_Edition_1.21.2) | Bundles of bravery, pale garden ingredients, item-model/`item_model` rework, `consumable`/`use_remainder` component split, minecart improvements, protocol/packet reshuffle. |
| [1.21.3](https://minecraft.wiki/w/Java_Edition_1.21.3) | Hotfix release: confirm no target-only feature is backported into older branches. |
| [1.21.4](https://minecraft.wiki/w/Java_Edition_1.21.4) | The garden awakens: pale oak family, creaking/creaking heart, resin, eyeblossom, wood sets; new block/item/entity families and sounds. |
| [1.21.5](https://minecraft.wiki/w/Java_Edition_1.21.5) | Spring to life: biome ambience, firefly bushes, leaf litter, wildflowers, cactus flower, armadillo/egg changes, `test`/`tooltip_display` components, GUI sprite changes. |
| [1.21.6](https://minecraft.wiki/w/Java_Edition_1.21.6) | Chase the skies: happy ghast/harness, dried ghast, player locator bar, dialog screens, waypoints, sky/cloud rendering changes. |
| [1.21.7](https://minecraft.wiki/w/Java_Edition_1.21.7) | Hotfix release: verify client-visible fixes; record anything server-owned. |
| [1.21.8](https://minecraft.wiki/w/Java_Edition_1.21.8) | Hotfix release: verify client-visible fixes; record anything server-owned. |
| [1.21.9](https://minecraft.wiki/w/Java_Edition_1.21.9) | Copper age: copper golem/chest, lightning rod variants, shelves, copper tools/armor, `equippable`/`swappable` render changes, new GUI and menu families. |
| [1.21.10](https://minecraft.wiki/w/Java_Edition_1.21.10) | Hotfix release: verify client-visible fixes; record anything server-owned. |
| [1.21.11](https://minecraft.wiki/w/Java_Edition_1.21.11) | Hotfix release: verify client-visible fixes; record anything server-owned. |
| [26.1](https://minecraft.wiki/w/Java_Edition_26.1) | First year-based release. Fetch the article and official notes in P01 before assigning scope; do not assume the numbering implies a small release. |
| [26.1.1](https://minecraft.wiki/w/Java_Edition_26.1.1) | Hotfix release: verify client-visible fixes only. |
| [26.1.2](https://minecraft.wiki/w/Java_Edition_26.1.2) | Hotfix release: verify client-visible fixes only. |
| [26.2](https://minecraft.wiki/w/Java_Edition_26.2) | The README's Eaglercraft relay row already names "26.2", so this release exists in the wider ecosystem; scope comes from its own article in P01. |
| [26.3](https://minecraft.wiki/w/Java_Edition_26.3) | Target. Scope is whatever its article and official notes record, plus the accumulated data/protocol state in the pinned jars. |

Indexed topics and present models are not passed scenarios. Each topic gets one disposition:
implemented and accepted; implemented but unverified; missing; server-owned with client acceptance
pending; product outside current scope; or experiment-gated.

## Implementation order

| Order | Task IDs | Deliverable | Required gate |
| --- | --- | --- | --- |
| 0 | P00–P01 | Verified baseline and release/bug inventory | Source pins match; inherited gaps and source availability are explicit. |
| 1 | P02 | Native reports, registries, packets, resources | Reproducible extracted tables reject mixed-version data. |
| 2 | P03–P05 | Primitives, components, Login/Configuration | Native byte fixtures round-trip; disposable-server join reaches Configuration. |
| 3 | P06–P07 | Full Play path and graphical join | Real terrain, entities, HUD, movement, respawn and reconnect in Chrome against 26.3 only. |
| 4 | P08–P10 | Inventory/interaction, auth lifecycle, packs/fonts | Slot/action reconciliation, transfer and resource behavior pass their fixtures. |
| 5 | P11–P12 | Content families and their effects | Each family has interaction/state/visual acceptance. |
| 6 | P13–P14 | GUI/text/audio and inherited parity repairs | Remaining gaps close or are explicitly dispositioned. |
| 7 | P15–P16 | Whole-target acceptance and distributions | Open findings accounted for; SHAs, manifest and checksums match builds. |

## P00–P02 notes for this target

- `npm run prepare:26.3` verifies all four native inputs, the metadata identity, the packed version
  fields, the unobfuscated class layout and the in-jar asset/data markers. It writes
  `cache/port-26.3/verified-inputs.json`.
- `npm run reports:26.3` runs Mojang's data generator from the pinned bundler jar and records
  blocks, block states, items, default components, registries, commands and packet IDs.
- Assets are no longer an external download: resource inventory is read from the jar, and the asset index
  is pinned only as an identity cross-check. Do not add a texture-download step that 26.3 does not need.
- The 17-release gap is intentional scope, not an excuse to skip releases: every release in the crosswalk
  must have a disposition before P15.

## Evidence rules

Byte fixtures, recorded report hashes, and a real Chrome client joining a disposable 26.3 server on
127.0.0.1 are the only accepted gate evidence. "Implemented but unverified" is a legitimate status.
Never claim full parity, never invent FPS/Java numbers, and never mark an authenticated-account test
passed without a real account.
