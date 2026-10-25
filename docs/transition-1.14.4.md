# Transition from 1.13.2 to Java 1.14.4

Status: **active development runtime on protocol 498**, with native terrain data,
independent lighting and browser join/reconnect verified. Remaining entity,
workstation, movement and visual parity work is tracked below. This branch is
not yet a complete vanilla-parity release.

See [the active-runtime milestone](runtime-1.14.4-milestone.md) for implementation,
validation and the remaining work. Older networking-only limitations in the
initial milestone below are historical and superseded by this runtime milestone.

## Indexed assets and native title rendering

The village panorama now comes from the 1.14 asset index, overriding stale jar
copies. Source serving, built assets and the embedded HTML use the same defaults.
The title uses the native full-resolution CubeMap renderer and overlay, and
stale extracted asset folders are rejected by version/hash identity. See the
[asset/panorama milestone](indexed-assets-panorama-1.14.4.md) for the cause and tests.

## Implemented starting milestone (2026-10-25)

- Added hash-verified Mojang client/server jars, official mappings and metadata inputs.
- Pinned minecraft-data and both protocol schemas for reproducible comparisons.
- Ran the real 1.14.4 data generator: 676 blocks, 11,271 block states, 37 registries
  and 71 command roots, with a committed source/report hash baseline.
- Added packet/type change inventories, regeneration checks and integrity tests.
- Carried forward the End sky and resource-pack row-hover fixes on this branch.

See [bootstrap commands and limitations](../tools/port-1.14.4/README.md). The
client-side model/shape/GUI extraction and native 498 codecs are still pending.

## Native networking milestone (2026-10-25)

The staged protocol-498 codec now handles startup/control packets, native packed
positions, metadata additions, chunk heightmaps, section palettes and separate
light packets. A 25-second session against the local vanilla 1.14.4 server
successfully decoded 462 chunks / 2,372 sections / 462 light updates and completed
teleport and keepalive replies. Unsupported packet families remain explicit.
See [scope, validation and remaining work](protocol-1.14.4-milestone.md).

The browser now selects the native 498 codec, native asset tables and independent
world/light lifecycle; see the active-runtime milestone above.

## Baseline and scope

Branch from the updated 1.13.2 release after the shared backport audit and builds.
Keep 1.13.2, 1.12.2 and 1.8.9 maintained as separate release branches. Target native
Java 1.14.4, protocol **498**, rather than a translation shim. Keep asset IDs,
packet IDs, model extraction, UI layout and movement behavior version-specific.
Carry forward the shared Wisp, skin proxy, chat, inventory, lighting, particles,
selection, breaking-overlay and LOD fixes.

The committed audit `release-backport-audit-2026-10-25.md` records the starting
coverage and its limits. Green 1.13.2 tests do not certify 1.14.4 compatibility.
Do not simply rename tests or replace 404 with 498 and assume the port is done.

## 1. Pin references and adapt extraction

Use Mojang's version metadata as the authoritative jar and mappings source:

- [1.14.4 metadata](https://piston-meta.mojang.com/v1/packages/be146d5f66a3627ed0a87c234c4d8dde8ab35098/1.14.4.json)
- Client jar SHA-1: `8c325a0c5bd674dd747d6ebaa4c791fd363ad8a9`.
- Server jar SHA-1: `3dc3d84a581f14691199cf6831b71ed1296a9fdf`.
- Client mappings SHA-1: `6073e4ba6949217eb708c4512be2ccc1850a603f`.
- Server mappings SHA-1: `c604a623b416a88a844979a6c55862c8a97510a9`.

Download only into ignored caches; verify hashes. Pin the minecraft-data revision
used for cross-checks, not its moving default branch. Record version and source
hashes in generated data. The 1.14.4 metadata supplies official mappings: use
them to identify methods instead of carrying 1.13.2 obfuscated names forward.

Inspect `lib/mcassets.js`, `lib/modelextract.js`, and the block-shapes, creative,
biome, command, tag and GUI extractors under `tools/`. Regenerate registries,
collision/selection bounds, recipes, creative tabs, sounds, particles, entity
models, GUI order and native labels from the correct jar. Audit all numeric-ID
consumers, metadata indices and model-class assumptions. Keep resource-pack
format at the jar's value; 1.14.4 and 1.13.2 both use format 4.

Gate: reproducible extraction with provenance, registry round trips, complete
block/item models, and no fallback to 1.13 IDs. First source change should pin the
version inputs and extraction fixtures, not announce compatibility.

## 2. Implement the wire format before enabling gameplay

Audit every clientbound/serverbound packet in `client/js/net/packets.js`, the
binary reader/writer, `connection.js`, raw-TCP login in `tcp.js`, and `proxy.js`.
Update status/handshake/proxy-advertised versions together once native codecs
exist. Keep compression, encryption, relay and Wisp transport behavior intact.

Confirmed schema changes needing explicit fixtures:

- Packed block positions change from X/Y/Z bit ordering to X/Z/Y (26/26/12).
  Check positive, negative and boundary coordinates on both reads and writes.
- Chunk packets add heightmap NBT. Section data has a non-air block count;
  lighting moves out of chunk section data into the Update Light packet.
- Open Window uses numeric menu types and VarInt window IDs, replacing the
  1.13.2 string-type/u8 layout. Horse inventory has its own packet.
- Trade List includes costs, uses, XP, discounts and demand plus villager state.
- Audit entity spawn type IDs, metadata serializers and indices (including pose,
  villager data, optional positions and sleeping state), recipes, tags, particles,
  sounds, equipment, block actions and window transactions.
- Review added/removed packets, such as difficulty locking, recipe-book state,
  digging acknowledgements and view-position/distance updates, against the exact
  1.14.4 schema and jar. Do not substitute a later 1.14.x/1.15 layout by memory.

Gate: byte fixtures for every changed packet, full input consumption, and status,
login, keepalive, teleport, chat and disconnect against a local vanilla 1.14.4
server through MinecraftJS proxy, Java relay and Wisp v1.

## 3. Port chunks and independent lighting together

Update `world/chunk.js`, `world/world.js`, chunk consumers and mesh invalidation
for section non-air counts, palettes, heightmap NBT and the separate light masks.
Handle sky/block light and empty masks, including the boundary light sections
below and above the 16 terrain sections (18 light sections total).

Define and test lifecycle behavior for light-before-chunk, light-after-chunk,
partial updates, empty sections, dimension changes, unload/reload, and updates
arriving while workers mesh. Never render a stale light result over a newer
world state. Keep the existing falling-block and block-update fixes intact.

Gate: fixture chunks with single-value, local and global palettes, cross-word
states, all dimensions, and no dark terrain that requires a manual block update.
Verify terrain at chunk boundaries with smooth lighting on and off.

## 4. Implement poses, entities and item rendering

Use the jar's pose and dimension rules for sneaking, swimming, sleeping, gliding
and crawling under trapdoors. Match server metadata and player collision/eye
height; do not backport the newer crawling transition to 1.13.2.

Add jar-native models, metadata, animations and textures for the new/changed
villagers and professions, pillagers, ravagers, wandering traders/trader llamas,
cats, foxes and pandas, plus changed existing mob variants. Implement crossbow
pull/charged states and projectile behavior, shields, hands and first/third-person
transforms. Audit beds, signs, banners, bells, campfires and other changed block
entities. Preserve beams, death effects, barriers and model-based cracks.

Gate: repeatable entity/held-item fixtures, all poses and transitions, collision
checks, and visual comparisons with the pinned Java client.

## 5. Complete gameplay interfaces and 1.14 content

Implement menu mappings and layouts for blast furnace, smoker, stonecutter,
loom, cartography table, grindstone and lectern. Adapt merchant trading UI and
villager levels, existing workstations, recipe book and container slot logic.
Test authoritative inventory updates, shift-click, drag, cursor state and NBT.

Cover new blocks/items and their actual models, selection/collision bounds,
lighting, sounds and particles: scaffolding, bamboo, lanterns, campfires, bells,
new slabs/stairs/walls and other registered content. Verify placement and
interaction against the server rather than predicting unsupported behavior.

Regenerate creative search/tabs, controls, video options, key labels, F3 lines,
chat completions/hover events and resource-pack compatibility from the jar.
Verify raids and boss bars, advancements/toasts, recipes and changed sounds.

Gate: each native menu works against the server; registry and interaction tests
cover the added content; visual checks do not depend on placeholder models.

## 6. Release and backport policy

Keep shared regression suites; add `tools/test-1.14.4-*.mjs` with fixtures from
1.14.4. Port behavior expectations deliberately and retain tests protecting the
old fixes. Build the single-file client and test it over HTTP(S), with embedded
and external config, custom skins/resource packs, every rendering backend,
reconnects, chunk reloads and all three dimensions.

Maintain a feature/status checklist with evidence: protocol/registries, world
and lighting, movement, entities/items, menus/content, UI/assets, transport and
performance. Do not claim full parity while any entry is unimplemented or only
assumed. Record remaining visual discrepancies explicitly.

Backport shared engine/transport/UI bug fixes using adapted commits and each
older jar's tests. Do not backport 1.14-only content, registries, metadata, poses,
packet layouts or workstation mechanics. Record each applicable fix and its
older-branch commit IDs. Compare builds and representative frame/allocation
profiles with the baseline before claiming an optimization.

Release gate: all changed codec/data tests and shared regressions pass; local
vanilla-server play and visual checks pass; reconnect and asset/config flows
pass; no known blocking parity gaps remain; artifact version and checksums are
verified. Only then publish a fourth HTML artifact labeled 1.14.4.

## Cross-check sources

Mojang jar behavior takes priority where sources disagree. Schema references
below were inspected during planning and should be pinned before implementation:

- [minecraft-data version 498](https://github.com/PrismarineJS/minecraft-data/blob/master/data/pc/1.14.4/version.json)
- [1.14.4 protocol schema](https://github.com/PrismarineJS/minecraft-data/blob/master/data/pc/1.14.4/protocol.json)
- [1.13.2 protocol schema](https://github.com/PrismarineJS/minecraft-data/blob/master/data/pc/1.13.2/protocol.json)
- [Version-specific data paths](https://github.com/PrismarineJS/minecraft-data/blob/master/data/dataPaths.json)
