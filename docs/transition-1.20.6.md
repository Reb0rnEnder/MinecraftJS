# Transition plan: Java 1.20.6

Development target: the named 1.20.6 branch/worktree, forked from the corrected 1.19.4 baseline. This is a staged port, not a full-parity claim. Earlier supported versions keep their own protocol, assets and native behavior. User worlds are never upgraded as part of the port.

## Verified inputs and release boundaries

Official Mojang metadata for 1.20–1.20.6 was downloaded and SHA-1 checked. The exact 1.20.6 client/server jars and mappings were downloaded and hash-checked; the client's version.json confirms protocol 766, data version 3839, resource-pack format 32, data-pack format 41 and Java 21. Java 25 is available here for tooling; no Java-client performance comparison is claimed. The source references and hashes belong in transition-1.20.6.inputs.json and tools/port-1.20.6/target.json.

| Release | Protocol | Java | Main audit areas |
|---|---:|---:|---|
| [1.20](https://minecraft.wiki/w/Java_Edition_1.20) | 763 | 17 | Trails & Tales content, armor trims/smithing, archaeology, signs, camel/sniffer, cherry/bamboo, bookshelves and vibration changes |
| [1.20.1](https://minecraft.wiki/w/Java_Edition_1.20.1) | 763 | 17 | Hotfixes and language changes |
| [1.20.2](https://minecraft.wiki/w/Java_Edition_1.20.2) | 764 | 17 | Configuration state, registry negotiation, overlays and optional trade experiment |
| [1.20.3](https://minecraft.wiki/w/Java_Edition_1.20.3) | 765 | 17 | New bat presentation, decorated-pot item storage, text/network and resource-pack changes |
| [1.20.4](https://minecraft.wiki/w/Java_Edition_1.20.4) | 765 | 17 | Decorated-pot item-loss hotfix |
| [1.20.5](https://minecraft.wiki/w/Java_Edition_1.20.5) | 766 | 21 | Armadillo, wolf variants/armor, item components, known packs, cookies and transfer |
| [1.20.6](https://minecraft.wiki/w/Java_Edition_1.20.6) | 766 | 21 | Trader-llama inventory upgrade hotfix; target-native client behavior |

The Wiki pages/indexed release results were checked; direct page fetches were blocked by robots policy for several pages. Cross-check with official [1.20](https://feedback.minecraft.net/hc/en-us/articles/16499677456781-Minecraft-Java-Edition-1-20-Trails-Tales), [1.20.2](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-20-2), [1.20.5](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-20-5) and [1.20.6](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-20-6) release notes and exact native code. Intermediate jars are references, not claimed executed inputs.

## Milestone 0: baseline and native inputs

Carry the current camera, mesh-queue, LOD, compact storage, batching and profiler fixes forward. Keep the existing 1.19.4 ledgers open: outgoing signed chat/commands and reporting, full shader render graphs/shadows, display/mob/particle review, social/narrator reference gates, tool/bucket/bottle success sounds and unresolved vanilla floating-boat jitter are not completed by changing versions.

Pin inputs; extract native runtime registries, collision/selection/support/occlusion, models/layers, sounds/particles, creative catalogs, menus, item mechanics/default components, tags, language/fonts and exact version identity. Reuse extraction only after verifying the changed native constructors and codecs. Do not ship 1.19.4 generated tables under a 1.20.6 asset manifest.

Gate: native target inputs verify; source and asset identity checks reject mixed builds. Existing versions remain functional.

## Milestone 1: native transport, configuration and registries

Implement status/login and mandatory UUID, login acknowledgement, compression/encryption, plugin/cookie requests, then Configuration. Decode known-pack negotiation, streamed registry entries with optional anonymous NBT, enabled features/tags, keepalive/ping, resource packs, cookies and transfer. Start with no claimed cached known packs so the server supplies complete registry data. Support subsequent Play-to-Configuration transitions and reset registries atomically on server transfers.

Gate: an isolated vanilla 1.20.6 server accepts login/configuration, supplies complete registries and enters Play; a real keepalive and position confirmation succeed. This first network gate does not certify graphical play or item handling. Reject unsupported packets/negotiation honestly rather than interpreting them as old play packets.

## Milestone 2: play codecs, terrain and item components

Generate native packet IDs and compare schema dependencies, not just packet names. Replace the old join-game dimension codec with configuration registries and numeric dimension types. Port terrain/light, spawn/metadata, bundles, movement, damage, inventory and chunk batching acknowledgements.

Implement the 1.20.5+ typed component-patch item stack, native default components and additions/removals, preserving custom data and unknown/invalid payload behavior. Never reuse the old NBT slot codec. Convert to internal render/tooltip views without losing authoritative component values. Update recipes, menus, merchant offers, equipment, creative slots and click prediction together.

Gate: graphical join, terrain/light, reconnect/transfer, survival movement, hotbar/containers and native round-trip component fixtures pass. Only then switch the graphical runtime/version advertising and generated assets fully to 1.20.6; do not merely relabel the 1.19.4 client.

## Milestone 3: stable content and GUI parity

Complete stable Trails & Tales functionality and native Armored Paws content. Cover two-sided/waxed signs, hanging signs, decorated-pot insertion/contents and wobble (no invented pot GUI), brush archaeology, suspicious blocks, sniffer/camel behavior, bookshelves, trim rendering and the native smithing layout. Add armadillo/wolf variants, armor/cracks/dye and their actual sounds/particles. Match target menus, resource-pack compatibility, accessibility, debug content and commands against native code.

Native feature flags are essential: the jar also contains 1.21 experiments. Do not expose trial/breeze/crafter/mace or other experiment-only items merely because they exist in assets/registries. Bundles and the trade rebalance likewise follow server-enabled native flags.

Gate: per-family native behavior and visual tests; honest remaining-gaps inventory with stable/experimental/server-authoritative distinctions.

## Milestone 4: validation, backports and builds

Regress applicable shared fixes across existing targets, preserving native differences. Test WebGL2/WebGPU/software, fixed and camera-motion scenes, shader boundaries, screenshots and real network transfers. Use the opt-in profiler for measured CPU/GPU/memory comparisons; no arbitrary FPS promise.

Publish source commits and distributions separately. When rebuilding all clients, regenerate source SHAs, manifests and checksums together. Keep local servers/worlds/configuration, screenshots, shader packs and captures out of commits. Do not mark full parity complete while the carried-forward ledger or target-native gates remain open.

## Progress on the 1.20.6 branch

Milestone 0 has pinned/verified jars, mappings, metadata, assets index and protocol
schemas. Native runtime report extraction and mixed-build graphical gates remain.
Milestone 1's offline transport gate passes: native compression, mandatory UUID,
login acknowledgement, full streamed registries, tags/features, first Play join,
teleport confirmation, chunk-batch acknowledgement and a real keepalive.
Reconfiguration, cookies and malformed inputs have regression coverage; actual
server transfer, resource-pack presentation and encrypted login remain open.
See development-1.20.6.md for exact evidence. Milestones 2–4 remain pending.

## Follow-up gate, 2026-11-06

Per the user's requested order, complete the confirmed baseline fixes before advancing native 1.20.6 implementation. Continue on this existing branch; do not create another target. Shared border/look-at, respawn, keybind/completion, picking and sound fixes are forwarded and tested, with their baseline limitations documented. The remaining scope across all targets is maintained in [parity-status-all-versions.md](parity-status-all-versions.md); the 1.19.4 source review lists the still-open display, Adventure, authenticated chat/reporting, atlas and powered-head implementations. Full parity is a target, not a status inferred from the Configuration handshake.
