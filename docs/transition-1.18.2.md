# Transition plan: Java 1.18.2

Status: planning only. This worktree continues to report, load assets and connect
as 1.17.1. Do not rename it or change its protocol during planning. Existing
1.17.1 content/behavior gaps in `parity-1.17.1.md` remain explicit carry-over work.

Target: Java **1.18.2**, protocol **758**, data version **2975**, resource-pack
format **8**, data-pack format **9**, Java **17** tooling. The official version
metadata checksum was verified. `transition-1.18.2.inputs.json` pins metadata,
client/server jars, mappings, asset index and the upstream protocol schema;
this planning step does not download/launch a server or modify a world.

## Branch discipline and entry gate

Implementation baseline: the pushed F3 fixes at
`b0929cc969218e8f870c2b1d9000184bfa21a918` on 1.17.1. When implementation is requested, use the existing `1.18.2` branch if
present; otherwise create that exact name in `/home/ender/minecraftjs-1.18.2`.
Keep all currently supported worktrees, their asset identities and deployment
configuration usable. Do not create substitute branches for older versions.

Inventory unfinished 1.17.1 features before claiming any 1.18 parity. In
particular, powder snow/freezing, spyglass, glowing sign text, some mob poses,
required-pack behavior and the full inventory matrix still need acceptance work.

## Milestone 1: verified native inputs and change inventory

Download and hash-check the pinned target jars/mappings. Run native reports and
extract registries, tags, collision/selection/render/heightmap predicates, item
mechanics, entity metadata/model layers, biome effects, GUI arrays, particles,
sounds, languages and fonts. Cross-check every imported ID/state range against
native reports, rather than carrying over 1.17 tables under a new label.

Generate IDs and compare the exact 758 packet bodies with 756. The inspected
schema adds combined chunk/light data, per-section biome palettes, compact block
entity records and simulation-distance updates. Audit every remaining changed
body, not just packets needed by an idle join. Keep testable source hashes and
an implemented/verified/pending ledger.

## Milestone 2: dimension-height infrastructure before terrain activation

The ordinary Overworld now spans Y=-64 through 319 (384 blocks / 24 sections).
Replace fixed 0–255 / 16-section assumptions with dimension `min_y`/`height` in
storage, coordinate conversions, collision/rays, selection, snapshots, mesher
workers, dirty queues, visibility, camera bounds, light columns, heightmaps,
weather, particles, fluids, entities and debugging. Include negative section-Y
and boundary-light layers. Nether and End must retain their own dimension data.

The current 1.17 view deliberately rejects taller masks. Remove that guard only
after the consumers can represent the target dimension. Add fixtures around
Y=-64/-1/0/255/319 and transitions between differently sized dimensions. Preserve
word-based palette performance and compare against a BigInt reference decoder.

## Milestone 3: protocol, terrain and authoritative state

Decode the combined chunk/light packet atomically. Handle block and biome
palettes independently, including single-value biome palettes and registry-wide
palettes. Validate each section's length and all light masks/array counts against
the dimension height. Convert compact block-entity coordinates correctly and
preserve tile data across chunk reloads.

Track server view distance and simulation distance separately from the player's
render setting. Audit generic registry tags, inventory state/cursor recovery,
recipes, entities, resource packs, titles, login/respawn and server corrections.
Keep prior riding, movement, sound and F3 regression checks active.

Acceptance: fixture boundaries/malformed packets first, then a supplied matching
server: status/login/compression, full-height terrain/light, spawn confirmation,
keepalives, movement, containers, Nether/End round trips and chunk reloads. Do not
replace the user's running server or migrate its world to obtain a test instance.

## Milestone 4: visible 1.18/1.18.1/1.18.2 behavior

Audit all three releases, including biome names and vertical biome sampling,
world lighting/spawn-visible results, cloud height, music/sound-device controls,
render/simulation-distance options, controls/keybind layout, online options,
autosave indicator and chunk-builder settings. Native arrays remain the layout
authority; do not add settings without implementing their observable behavior.

Implement target fog shapes per environment. The 1.18.1 cylindrical distance-fog
change and 1.18.2 special-fog fixes need separate checks across terrain, entities,
water/lava/powder snow and blindness. Recheck stars/sky, pack format 8, fonts,
compliance resources, command trees and general registry-tag handling.

F3 must adopt 1.18's additions where data is actually available and 1.18.2's
region-file coordinates/name. Integrated-server generation/noise metrics are not
transmitted to remote clients: follow the native multiplayer branch and never
fabricate them. Preserve truthful browser/GPU/audio diagnostics.

World generation, spawning, AI and world upgrading remain server authority;
verify their client-visible outcomes instead of adding a competing client generator.

## Milestone 5: parity, backports, profiling and distribution

Build a release-change ledger distinguishing server-owned behavior from client
work, and test each accepted feature. Profile full-height joins, chunk decode,
meshing/upload queues, frame-time spikes and memory on actual scenes. Test all
supported graphics adapters and persisted fallback behavior; microbenchmarks
alone do not establish a frame-rate improvement.

Apply shared correctness/performance fixes to every applicable existing branch,
with version-appropriate implementations. Keep 1.18-only content/protocol/UI
changes on 1.18.2. Publish separately named development HTML/static builds with
source commits and checksums after validation. A successful join is not full parity.

## Verification sources

- [Minecraft Wiki: debug screen history](https://minecraft.wiki/w/Debug_screen?mobileaction=toggle_view_mobile)
- [Minecraft Wiki: Java 1.18](https://minecraft.wiki/w/Java_Edition_1.18)
- [Minecraft Wiki: Java 1.18.1](https://minecraft.wiki/w/Java_Edition_1.18.1)
- [Minecraft Wiki: Java 1.18.2](https://minecraft.wiki/w/Java_Edition_1.18.2)
- [Minecraft Wiki: chunk-height history](https://minecraft.wiki/w/Chunks)
- [Official pinned version metadata](https://piston-meta.mojang.com/v1/packages/334b33fcba3c9be4b7514624c965256535bd7eba/1.18.2.json)
- [Pinned 758 protocol schema](https://github.com/PrismarineJS/minecraft-data/blob/5e063fa99cfe8ded065ec6788b66696b7e4ef143/data/pc/1.18.2/protocol.json)

Wiki search-index content was accessible; direct full-page requests were blocked
by the site's robots policy. Use exact native sources/schema to resolve layout
and wire details, and consult version history rather than the redesigned current F3.
