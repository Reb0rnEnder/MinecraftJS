# Transition plan: Java 1.20.6

Updated 2026-11-06. Work in the **existing `1.20.6` branch** at `/home/ender/minecraftjs-1.20.6`. The latest user instruction authorizes proceeding with this port now; it supersedes the earlier requirement to finish every inherited fix first. Those fixes remain tracked, and still block a full-parity claim.

The target is the final native 1.20.6 multiplayer client behavior, not a succession of seven separately shipped ports. Intermediate releases establish when behavior changed; the final jar resolves conflicts and hotfixes. Integrated singleplayer/world creation and Realms remain separate missing products. Optional shader/Eagler compatibility has its own ledger.

The executable work order and completion state are in [transition-1.20.6.tasks.json](transition-1.20.6.tasks.json). Update both files after each accepted milestone. A task is complete only when its acceptance evidence exists.

## Starting point and source authority

- Client/server jars and both official mappings were hash-verified again on 2026-11-06. Native `version.json` confirms protocol **766**, data version **3839**, resource format **32**, data format **41**, Java **21**. Pins: [target.json](../tools/port-1.20.6/target.json) and [input/source record](transition-1.20.6.inputs.json).
- `npm run test:1.20.6` currently passes **nine tests**, including phase IDs, Configuration, cookies, anonymous NBT, login fields and initial Play layout. The earlier isolated-server handshake is recorded in [development evidence](development-1.20.6.md); it was not rerun for this planning update.
- Graphical gameplay, generated data and active Play consumers still use the **1.19.4 baseline**. `Reader766.slot` and `Writer766.slot` explicitly reject unsupported item stacks. Receiving raw chunk packets does not establish terrain decoding or rendering.
- Shared border/look-at, respawn, text/completion, picking, sound and basic Adventure corrections are forwarded. The inherited [parity inventory](parity-status-all-versions.md) remains open.

All seven requested historical Minecraft Wiki pages were fetched successfully with **direct curl (HTTP 200)** after the browser tool restricted them. The suggested Fandom pages were also tried: browser requests failed and direct requests returned HTTP 403 challenge pages, which are not treated as article content. The Wiki topic/section and fix-reference inventory is linked below; selected relevant sections and the official release notes inform this plan. This does not mean every historical fix was behaviorally reviewed. For future source checks, try direct HTTP before declaring a page unavailable, and verify that the response is the article rather than a challenge page. Exact native code and runtime fixtures determine implementations; protocol schemas are secondary cross-checks.

## Release crosswalk

| History requested | Port requirements and native acceptance focus | Available primary reference |
| --- | --- | --- |
| [1.20](https://minecraft.wiki/w/Java_Edition_1.20) | Stable Trails & Tales: archaeology, brush/suspicious blocks, pots/sherds, signs/hanging signs, smithing/trims, camel/sniffer/plants, cherry/bamboo, bookshelf, calibrated sensor/resonance and head/music effects. Previously experimental 1.20 assets must now follow the stable target flags. | [Official 1.20 notes](https://feedback.minecraft.net/hc/en-us/articles/16499677456781-Minecraft-Java-Edition-1-20-Trails-Tales) |
| [1.20.1](https://minecraft.wiki/w/Java_Edition_1.20.1) | Join cancellation must not softlock; check the language catalog and triage Realms/disk/generation fixes by client responsibility. Test cancellation during connection and loading rather than copying server fixes into the browser. | [Official 1.20.1 notes](https://www.minecraft.net/en-us/article/minecraft--java-edition-1-20-1) |
| [1.20.2](https://minecraft.wiki/w/Java_Edition_1.20.2) | Configuration/reconfiguration, streamed registries, chunk flow, pack overlays, client-visible interaction/reporting changes and the optional trade experiment. | [Official 1.20.2 notes](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-20-2) |
| [1.20.3](https://minecraft.wiki/w/Java_Edition_1.20.3) | Network NBT chat components; multiple UUID-addressed server packs and removal; score formatting, frozen/tick state, new bat and shield presentation, pot storage/wobble, GUI/resource changes. Pots have no inventory screen. | [Official 1.20.3 notes](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-20-3) |
| [1.20.4](https://minecraft.wiki/w/Java_Edition_1.20.4) | Pot item-loss hotfix: test client synchronization and safe reconnect, while storage/migration remains server-owned. | [Official 1.20.4 notes](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-20-4) |
| [1.20.5](https://minecraft.wiki/w/Java_Edition_1.20.5) | Component-based items/defaults, registry-aware codecs, transfer/cookies/authentication, armadillo/wolf variants and armor, changed attributes, text/particle/menu formats. | [Official 1.20.5 notes](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-20-5) |
| [1.20.6](https://minecraft.wiki/w/Java_Edition_1.20.6) | Trader-llama inventory hotfix: verify target slot/body-equipment interpretation and live inventory behavior; never upgrade a user world as a test. | [Official 1.20.6 notes](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-20-6) |

## Historical source inventory

[Machine-readable release index](transition-1.20.6.release-index.json); raw HTML stays in ignored `cache/port-1.20.6/source-review-2026-11-06/`. Each source records retrieval method, URL and SHA-256. This is a reference index, not an implementation checklist marked complete.

| Release | Topic/section entries | Fix-ID references |
| --- | ---: | ---: |
| 1.20 | 121 | 274 |
| 1.20.1 | 4 | 4 |
| 1.20.2 | 81 | 213 |
| 1.20.3 | 70 | 93 |
| 1.20.4 | 1 | 1 |
| 1.20.5 | 137 | 220 |
| 1.20.6 | 1 | 1 |

The 415 entries include section headings and top-level topic labels. 806 fix references contain 806 distinct IDs; unnumbered fixes still require manual triage. Counts do not measure feature completion. Navigation/reference sections are excluded. Re-index cached articles with:

```sh
python3 tools/port-1.20.6/index-release-history.py cache/port-1.20.6/source-review-2026-11-06 docs/transition-1.20.6.release-index.json
```

For every release topic/bug, record one of: implemented and accepted; implemented but unverified; missing; server-owned with client acceptance pending; product outside current scope; or experiment-gated. An indexed topic or present model is not a passed scenario. Audit final behavior, not every superseded intermediate bug.

## Implementation order

| Order | Task IDs | Deliverable | Required gate |
| --- | --- | --- | --- |
| 0 | P00–P01 | Verified baseline and release/bug inventory | Source pins match; inherited gaps and historical source availability are explicit. |
| 1 | P02 | Target runtime extraction and asset pipeline | Native reports/defaults/flags and asset identity are available without overwriting older targets. |
| 2 | P03–P05 | Primitives, item components and Configuration lifecycle | Native byte fixtures round-trip; control-state tests pass; no old slot/body decoder is used as a substitute. |
| 3 | P06–P07 | Complete essential Play path and graphical join | Real native terrain, entities, HUD and movement load in browser with 1.20.6 data and no mixed-version identity. |
| 4 | P08–P10 | Inventory/interaction, authenticated lifecycle and packs/fonts | Authoritative slot/action reconciliation, transfer/reload and resource behavior pass their fixtures. |
| 5 | P11–P12 | Stable content and its effects | Each feature family has real interaction/state/visual acceptance. |
| 6 | P13–P14 | Native UI/text/audio and inherited parity repairs | Remaining implementation gaps close; account-dependent checks remain unverified until actually exercised. |
| 7 | P15–P16 | Whole-target acceptance and distributions | Open findings are accounted for; validated source SHAs, manifest and checksums match published builds. |

Dependencies are explicit in the task ledger. Early browser experiments may use an isolated development entry point, but must keep their development status visible. Switching public version labels alone is not a milestone.

### P00–P02: inputs, inventory and extraction

Keep original fork provenance and record the latest forwarded source separately. Preserve existing worktrees, captures, settings, shaders and server worlds. Use disposable loopback fixtures; reuse verified jars without modifying the user's running server.

Extract from the exact target: block/state registries, collision/selection/support/occlusion, fluid/render/light properties, entity types/dimensions/metadata, default item components and stream-codec IDs, menus/recipes, particles/sounds, tags/features, creative categories and UI/asset layouts. Produce a native source index and generation errors report. Reject mixed source/asset versions.

Resolve resources in native jar + asset-index + pack order. A jar placeholder is not the final resource: the target jar's `font/include/unifont.json`, for example, has an empty provider list. Inventory referenced resources before treating that as the finished font. Add native atlas sources/paletted sprites, GUI sprites/scaling metadata, reference/filter/Unihex font support and resource-pack compatibility at the appropriate later gate. Preserve existing bitmap/space/TTF behavior where target code supports it.

**Gate:** reproducible extracted reports, counts and hashes agree with native inputs; default resources resolve; features absent in the final target are not imported from newer releases.

### P03–P04: binary primitives, text and component stacks

Use native RegistryFriendlyByteBuf, ComponentSerialization, ItemStack and DataComponentPatch stream codecs. Implement network NBT component trees and registry holders without flattening typed data into legacy strings. Cover optional values, VarInts, bitsets, packed positions, enums and malformed lengths; require complete packet consumption.

Store each item's native defaults plus its component additions/removals. Distinguish absent, explicitly removed and overridden values. Implement every registered network component codec needed for a supported stream; unknown payloads cannot be skipped by guessing their lengths. Keep authoritative component patches separate from derived tooltip/render views. Existing NBT adapters may be temporary read-only views, never the native wire representation.

Exercise empty/default stacks, names/lore, enchantments, durability, attributes, profiles, books, potions, fireworks, containers, bundles, trim and equipment components, including nested values and explicit removals. Port all consumers together: window contents/clicks, equipment, entities, recipes, trades, creative inventory, hover text and block-entity items. Update Adventure behavior to native `can_break`/`can_place_on` components; old CanDestroy/CanPlaceOn NBT is not the target format.

**Gate:** native encode/decode vectors and round-trips preserve patches and reject invalid values; consumers do not invent defaults or discard component removals. Do this before claiming inventory-compatible Play.

### P05–P07: Configuration, Play and graphical join

Extend existing transport rather than replacing it. Verify login/compression/encryption transitions, Configuration requests/replies, options, tags/features and registry holders. Continue to advertise no known-pack cache until the exact matching cache exists; do not synthesize omitted registry entries. Publish registry replacements atomically and test repeated configuration.

Build a body-and-handler inventory for **every** Play ID. Prioritize join/respawn/teleport, keepalive, chunks/light/biomes, chunk batches, block changes/entities, spawn/metadata/equipment, attributes/effects/damage, movement/vehicles, HUD and inventory. Validate target palette packing, registry sizes and dimension bounds. Transport chunk counts do not prove terrain consumption. Keep decoder errors visible; remove old-protocol fallbacks only as their native replacements pass.

**Graphical gate:** isolated native server → correct target world and sky → movement/mining/placement and survival HUD → respawn/dimension travel → reconnect. No unsupported essential packets, missing resources, default-state guesses or 1.19.4 generated data masquerading as 1.20.6. Then switch the normal graphical entry, status/title/F3 identity and build data together.

### P08–P10: interactions, session lifecycle and resources

Validate every menu's slot ordering, carried item, state IDs, click prediction, shift-click, recipes, merchant offers and equipment changes using the component model. Apply native interaction ranges/physics attributes, poses and attachment dimensions instead of fixed reach assumptions. Add data-driven placement/support checks and rejection-result tests: failed predictions must not invent successful placement audio or consumption; native version-specific swings still matter.

Finish online authentication and native transfer/reconfiguration behavior. Test visible chat and input-history retention independently from the new message-signature session on reconfiguration; preserving one does not mean preserving the other. Test cookie ownership, bounds, final-disconnect cleanup and transfer retention; preserve permitted chat/resource state while replacing the destination registry/world. Exercise pack push/pop, order, UUIDs, hashes, required-pack refusal, download progress, cancellation and reload during Configuration/Play. Never mark authenticated tests passed without an actual account session.

Cover GUI sprite atlases/nine-slice scaling, pack overlays/formats, generated texture palettes and font providers with overrides/reload fixtures. Compare default and custom resources at several GUI scales. A custom pack must not be required to make native menus/fonts work.

**Gate:** survival/creative inventory and rejection sequences, repeated reconnects, a real controlled transfer, pack stacking/reload/refusal, and text/resource fixtures pass; encrypted/account behavior has separately recorded evidence.

### P11–P12: content acceptance families

Implement the remaining client behavior and native effects per family, using the release crosswalk and exact target models/metadata:

| Family | Minimum live/visual scenario |
| --- | --- |
| Construction/signs | All new orientations/supports, hanging and two-sided/waxed editing, shelf hit slots, bamboo raft/passengers and reload. |
| Archaeology/pots | Brush use/cancel, suspicious-block stages and item display, sherd faces, insertion/contents/wobble, projectile break and reconnect; no invented pot GUI. |
| Smithing/equipment | Template menu/recipe output, upgrade and trim preview, worn armor and resource-generated trim textures. |
| Camel/sniffer/plants | Native dimensions/metadata, seating/dash/passengers, animation selection, sniff/dig/egg/plant stages and associated effects. Server AI/growth/loot remain authoritative. |
| Sensors/heads/music | Calibrated/resonance behavior received from server, particles/events, powered heads and native sound selection. |
| Armadillo/wolf/body armor | Variant registry resolution, poses/layers, equipment/dye/damage/repair/removal and target inventory interpretation. |
| Later presentation | Updated bat, shield pose, non-living names, scoreboard formats, pearl feedback and server tick/freeze presentation. |

Maintain a separate experiment matrix for bundles, trade rebalance and any update-1.21 content present in this jar. Default catalogs/completions must not expose disabled experiments. Enabled experimental support needs explicit implementation/acceptance; do not hide its gaps behind a stable-parity label. Server generation, AI, migration and drops are not browser simulations.

### P13–P14: GUI, commands and inherited work

Compare exact target screens/options/F3, tooltips, input/clipboard, narration and social interactions against native code and reference images. Include the jigsaw selection/placement-priority fields, out-of-game panorama and in-game menu blur/background exceptions, hide-splash options, focus rules and GUI-scale controls. Port native command argument/component/particle syntax, server completions, NBT chat styles/hover, chat trust, outgoing authenticated signing/command arguments and reporting. Keep system messages distinct from verified player chat; never fabricate a trust result.

Carry forward missing display rendering/interpolation (including synchronized render-property updates and next-tick position/rotation updates), complete block-entity predicate/save views, powered heads, atlas gaps, Fabulous compositing and unresolved floating-boat walking. Re-test earlier fixes with target-native fields rather than copying old metadata indices or NBT assumptions. Every client audio/particle trigger still needs behavior acceptance; registry equality is insufficient.

**Gate:** inherited findings have explicit dispositions and target tests. Optional OptiFine shader support remains separately described and does not replace native Fabulous rendering.

### P15–P16: acceptance, backports and release

Run deterministic wire/JVM regressions, controlled native-server sequences and WebGL2/WebGPU/software scene comparisons. Include join cancellation, high view-distance loads, dimension/registry swaps, concurrent inventory updates, language/pack changes and source hotfix scenarios. Measure CPU/GPU/frame-time/memory on representative hardware before making performance claims; do not infer Java FPS or promise 600 FPS.

For each release-note fix, retain its reproduction/evidence or an honest server-owned/out-of-scope/unverified disposition. Full target multiplayer parity cannot be declared while required implementations or acceptance gates remain open. Report separate singleplayer/Realms and experiment limitations.

Review shared fixes for every applicable existing branch, newest to oldest; preserve native differences. Target-only protocols, item components, assets, GUI rows and content stay on eligible targets. Push each validated batch. A release build must regenerate source commits, assets, manifests and checksums together; check static-host and offline builds as well as development serving. Do not redistribute local worlds/configuration/captures with builds.

## Immediate next work

P02 through P05 are complete: native target data/resources, strict protocol-766 NBT text, all 56 item-component payloads and the full Configuration lifecycle now have reproducible/native evidence. Exact minecraft:core@1.20.6 known-pack negotiation was verified against vanilla with all 196 omitted registry values restored from the pinned cache. Start **P06** for essential Play packet bodies and Game consumers. Keep all 80 target regressions and every native regeneration/live-probe gate green. The next useful user-test milestone is **P07 graphical native-server join**.

## Native implementation anchors

Confirmed in pinned mappings during this planning pass: ItemStack `cur`, DataComponentPatch `kj`, DataComponents `km`, RegistryFriendlyByteBuf `xa`, ComponentSerialization `xr`, ConfigurationProtocols `abx`, ClientPacketListener `fxy`, Attributes `buz`, UnihexProvider `fkm`, GuiSpriteScaling `gqt`, PalettedPermutations `gpm`. These identify exact source inputs; class presence does not validate behavior.
