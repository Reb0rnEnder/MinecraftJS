# Transition plan: Java 26.3

Updated 2026-11-26. Work in the **existing `26.3` branch**, created from `1.20.6` at `761970e`. The
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
| [1.21](https://minecraft.wiki/w/Java_Edition_1.21) | From its Additions section: chiseled copper (crafting table and stonecutter recipes), copper grates, copper bulbs whose light dims as they oxidize, the crafter, and the tuff block families. Trial-chamber content and enchantment changes are in the same article. Verify every item against the native reports; this row is a pointer, not a spec. |
| [1.21.1](https://minecraft.wiki/w/Java_Edition_1.21.1) | Hotfix release: verify client-visible behavior of its fixes only; do not import server internals. |
| [1.21.2](https://minecraft.wiki/w/Java_Edition_1.21.2) | From its Additions section: bundles (a mixed stack of 64, dyeable, with an inside tooltip) and the field-masoned banner pattern. The item-model, `consumable` and `use_remainder` changes sit under Changes and must be read there, not inferred from the additions list. |
| [1.21.3](https://minecraft.wiki/w/Java_Edition_1.21.3) | Hotfix release: confirm no target-only feature is backported into older branches. |
| [1.21.4](https://minecraft.wiki/w/Java_Edition_1.21.4) | From its Additions section: the creaking heart (living pale-oak block, activates between two pale logs, emits resin clumps when its creaking is hit, drops only with Silk Touch when placed) and the pale garden content around it. |
| [1.21.5](https://minecraft.wiki/w/Java_Edition_1.21.5) | From its Additions section: leaf litter (smelted from leaves, works like pink petals), wildflowers, the firefly bush with its light-level-13 particle behaviour, and the cactus flower. |
| [1.21.6](https://minecraft.wiki/w/Java_Edition_1.21.6) | From its Additions section: the dried ghast (found in soul-sand-valley fossils, crafted from soul sand and eight ghast tears, waterlogs through three states into a ghastling) and the harness crafted from leather, glass and wool. |
| [1.21.7](https://minecraft.wiki/w/Java_Edition_1.21.7) | Hotfix release: verify client-visible fixes; record anything server-owned. |
| [1.21.8](https://minecraft.wiki/w/Java_Edition_1.21.8) | Hotfix release: verify client-visible fixes; record anything server-owned. |
| [1.21.9](https://minecraft.wiki/w/Java_Edition_1.21.9) | From its Additions section: copper bars and copper chains (waxable, oxidizing, crafted from ingots/nuggets) and the copper chest with waxed and oxidized variants. |
| [1.21.10](https://minecraft.wiki/w/Java_Edition_1.21.10) | Hotfix release: verify client-visible fixes; record anything server-owned. |
| [1.21.11](https://minecraft.wiki/w/Java_Edition_1.21.11) | Hotfix release: verify client-visible fixes; record anything server-owned. |
| [26.1](https://minecraft.wiki/w/Java_Edition_26.1) | First year-based release. From its Additions section: the golden dandelion (crafted from a dandelion and eight gold nuggets, sold by wandering traders) which stops and restarts baby-mob aging via `AgeLocked`, with distinct particles for each direction, and cannot be used on monsters or villagers. |
| [26.1.1](https://minecraft.wiki/w/Java_Edition_26.1.1) | Hotfix release: verify client-visible fixes only. |
| [26.1.2](https://minecraft.wiki/w/Java_Edition_26.1.2) | Hotfix release: verify client-visible fixes only. |
| [26.2](https://minecraft.wiki/w/Java_Edition_26.2) | From its Additions section: cinnabar (stairs, slabs, walls, polished and brick sets), sulfur caves, and the bubble-generating sulfur block that produces a nausea-causing gas cloud on the water surface. |
| [26.3](https://minecraft.wiki/w/Java_Edition_26.3) | Target. From its Additions section: poplar trees and leaves (red, orange and yellow, with colour-matched falling-leaf particles), the dappled forest biome, red shrubs, shelf mushrooms in two sizes with bone-meal growth, one-use straw beds that do not set spawn, abandoned camps with eight biome camp maps plus buried ancient-city maps in the secret chest, the cushion entity, the poplar boat, and concrete crafting/stonecutting. |

Indexed topics and present models are not passed scenarios. Each topic gets one disposition:
implemented and accepted; implemented but unverified; missing; server-owned with client acceptance
pending; product outside current scope; or experiment-gated.

## Current checkpoint (2026-11-26)

- The native 26.3 runtime tables are installed: 1,286 blocks / 35,723 states with selection shape,
  collision boxes, render/suffocation/light/sound/occlusion values, 338 collision shapes, 418 selection
  boxes and 39 native offset policies, plus 1,658 items. `npm run runtime:26.3` reproduces them from the
  pinned client jar.
- The browser client reaches Play, spawns and renders a native 26.3 world: 81 chunks, terrain, sky, tall
  grass, the full HUD, and live entities from the native `add_entity`/`set_entity_data` path. A real
  session tracked 83 entities (pigs, sheep, cows, chickens, bats, villagers, glow squid and the 26.3
  sulfur_cube) and drew them in-world; health and bat flags come from native metadata frames.
  `client-net:26.3` and `adapter:26.3` remain green.
- Serverbound bodies are bytecode-verified for the join path: accept_teleportation echoes position and
  rotation, movement packets use the packed flags byte, every tick ends with client_tick_end, and
  keep_alive/ping are adapted. The live session no longer desynchronises or times out.
- P07 acceptance is closed: movement was accepted by the 26.3 server (6.9 blocks in 1.6 s), a zombie
  killed the player and the respawn round-trip restored health, and repeated disconnects rejoined Play.
  The preview webview cannot grant pointer lock, so input state was driven directly for that check.
- Item stacks and component patches are live (P04 partial): `ItemStack`/`ItemStackTemplate` decode exactly
  as `VarInt count, VarInt item id, VarInt added, VarInt removed, values, removed ids`, and all 115 wire
  components have verified readers. Native defaults come from the 1658-item report table
  (`item-defaults:26.3`, 40 attributes); `itemComponentValues26_3` merges the patch and normalizes
  report/network shape differences before `Items.components` consumes them, adapted inventory slots
  included. Native consumable animation/eat time drive `useAction`/`useDuration`, so potions drink and
  food eats with the 26.3 timings instead of the shifted 766 item ids. `block-tags:26.3` resolves the
  jar's 300 block tag files into the 16 tool-rule tag families, and native `tool` rules drive
  `strVsBlock` (pickaxe stone 8, sword cobweb 15, sword leaves 1.5); a native registry dump lists
  the 470 blocks that require the correct tool, so `canHarvest` now rejects wood-on-iron-ore and
  bare hands on stone. `tooltip_display` hides
  the whole tooltip or selected component sections using the native hidden-component ids, and
  `equippable.slot` drives player armor placement from the native component. A real 26.3 session received a damaged custom-named sword, an
  enchanted pickaxe, potions, a chest containing [apple x5, null, null, diamond x2] and a bundle containing
  [apple x3, stick x8] with zero decode errors. `component-codecs:26.3` pins all 122 component codecs and the
  seven server-only types. `components:26.3` encodes one real vanilla value per component with Mojang's own
  codec and requires every reader to consume those exact bytes; 30 previously fail-closed readers are now
  covered (only `can_place_on`/`can_break` remain).
- Serverbound is live (P08 partial): every rewritten body comes from 26.3 bytecode - LpVec3 read/write,
  HashedStack/HashedPatchMap, `container_click`/`container_close`, `player_action` with its direction byte,
  `use_item_on` with the insideBlock/worldBorderHit booleans and the native attack. `serverbound:26.3` pins
  each body as bytes. A live server accepted a pickup+place click (menu state id 1 -> 2, dirt moved 43 -> 44
  and stayed) and an attack (summoned pig removed after 8 hits).
- Particle metadata is closed (P12 partial): the 56 frames each join used to skip were all
  `[set_entity_data#101]` serializer 17. `ParticleTypes` BootstrapMethods pin all 128 particle types and the
  22 data StreamCodecs; `particle-codecs:26.3` decodes the live-captured frame and every codec byte layout.
  A fresh join now loads 81 chunks and 26 entities with zero skipped frames. Vibration stays fail-closed.
- Dialog screens (P13 partial): `show_dialog` and `clear_dialog` are now adapted. The screen parses the
  native Dialog dispatch graph for notice, confirmation, multi_action, dialog_list and server_links,
  resolves either holder branch through the configuration `minecraft:dialog` registry, renders compact
  plain-message and item bodies, executes static click actions plus custom/dynamic click actions, and
  builds server-link buttons from the last `server_links` packet. The four native input controls feed
  `dynamic/run_command` (`$(key)` substitution with native escaping) and `dynamic/custom` (input NBT tags
  merged into additions); item bodies draw their icon/count, the title-row warning button opens the
  Back/Disconnect warning, and styled plain-message spans keep their click actions and show-text
  tooltips. `test-dialog-26.3.mjs` covers the parser, registry resolution, adapter pair, server links,
  inputs, dynamic actions and screen semantics; live visual acceptance remains.
- The entity table is native for this target (P02 partial): the client's EntityType registry now supplies
  all 161 wire ids with native dimensions, eye heights and MobCategory, so spawn packets can no longer
  index 26.3 ids through the 1.20.6 order. The generated display table and stats names use the same dump,
  and the 26.3 wood boats/rafts, split potions and wind charges map to their existing object kinds.
  `test-entity-registry-26.3.mjs` and `entity-registry:26.3 --check` pin the native order.
- The local crafting table is native for this target (P02): `build-recipes:26.3` reads all 2042 recipe
  files and resolves 1185 shaped/shapeless component-free recipes against the native item ids, including
  198 tag-alternative ingredient sets. `crafting.js` matches `{any:[ids]}` alternatives and
  `test-recipes-26.3.mjs` pins the acacia boat and coal/charcoal fire-charge paths. The remaining 857
  non-crafting/component-result recipes stay server-authoritative.
- Open at this checkpoint: general HashedPatchMap hashing for arbitrary server-provided component values
  (Creative catalogue stacks now carry native hashes), live acceptance of the remaining container/menu
  families, `can_place_on`/`can_break` (adventure-predicate graph), native support/placement rules, dialog
  input widgets, and the renderer rigs 26.3 restructured. All 144 inbound Play IDs
  and all 16 native debug subscription entries decode; 120 have adapters. The native Creative catalogue now
  comes from the pinned client for all eight feature masks (2034 stacks, 405 component patches), so creative
  slots no longer wait on the item table. The task ledger remains partial; next tasks P08/P10.
- The asset target is 26.3: `lib/mcassets.js` defaults this tree to 26.3 (pack format 97) and the proxy serves
  the jar first and the index for indexed objects. `tools/port-26.3/ExtractLayers26_3.java` bakes all 361
  native layers and `lib/model-extract-26.3.js` produces a complete 129-model bundle (native composites for the
  per-slot armor and split banners; the 1.20.6 rig only where 26.3 restructured the part tree the renderer
  animates). 26.3 has 3,964 textures against 3,048 in 1.20.6: 2,302 shared paths changed, 1,165 are new, and
  the 249 paths 26.3 dropped fall back to the pinned 1.20.6 file so the 1.20.6 UI still boots. The title
  panorama is the 26.3 index image (599 KB against the 69-byte jar stub). Live check: the title screen and an
  81-chunk join render with the new art, no missing-texture crash and no decode error.

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
