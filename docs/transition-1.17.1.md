# Transition plan: Java 1.17.1

Status: **native input extraction and default-height connection baseline implemented**
on branch `1.17.1`, worktree `/home/ender/minecraftjs-1.17.1`, from fixed
1.16.5 commit `307c4d2d38a733618438244a6ba2360f311c6717`. The browser and proxy now
report 1.17.1/protocol 756. See [the ledger](parity-1.17.1.md) for evidence and
remaining acceptance checks. Earlier parity gaps remain carry-over work.

Target: Java 1.17.1, protocol **756**, resource-pack format **7**. Mojang's
metadata requires Java **16** for the native game/tooling; the browser client
continues to use the existing JavaScript/device adapters. The input snapshot
pins official metadata, client/server jars, mappings and the 1.17 asset index,
plus the upstream protocol revision. All pinned inputs were downloaded and checksum verified; native reports,
runtime shapes/mechanics, GUI arrays and model layers have been extracted.

## Branch and worktree discipline

The exact `1.17.1` branch uses a separate worktree and asset cache. Existing
version branches and the supplied server configuration/world are preserved.
The original input snapshot records the planning baseline; implementation began
from the later fixed 1.16.5 commit above. Keep protocol/content changes on 1.17.1;
backport shared fixes only where their version's schema supports them.

## Milestone 1: reproducible native inputs and inventory

- Adapt the 1.16.5 preparation/report tools to verify the pinned downloads and
  resolve classes/fields through the matching official mappings.
- Extract native registry IDs, tags, recipes, item mechanics/tool speeds,
  collision/selection/occlusion shapes, entity metadata/models, biome effects,
  sound IDs, particles, language/font assets and GUI option arrays.
- Compare 1.16.5 with the exact **1.17.1** packet schema. Generate packet IDs and
  a changed-layout report rather than treating 1.17 and 1.17.1 as interchangeable.
- Change title/status/crash/handshake identity only in the new worktree, with
  matching asset imports and independent cache keys. Preserve deployment/proxy,
  static hosting, renderer selection and existing configuration behavior.

Acceptance: hashes verify, registry/model extraction reports unresolved cases
explicitly, and no IDs or UI layouts are silently borrowed from the old target.

## Milestone 2: connection, terrain and rendering baseline

The inspected 1.17.1 schema confirms these high-priority wire changes:

- Terrain uses a long-array section mask, no `groundUp` field, and a variable
  biome array. Light updates also use long-array masks and explicit light-array
  counts. Update both decoding and the game/world consumers.
- Player teleports include `dismountVehicle`; spawn-position packets include an
  angle. Preserve rider cleanup and correct spawn-compass handling.
- Inventory contents and slot updates carry `stateId`; full contents include
  the carried stack. Click packets include changed slots and the cursor item.
- Explosion record counts are VarInts. Tags are grouped by registry identifier.
  Required resource packs add a flag and optional formatted prompt text.
- Entity destruction in the exact 1.17.1 schema is an ID array. Audit split
  title, combat and world-border packet families and every remaining changed
  incoming/outgoing body against the native implementation.

Refactor hardcoded 16-section/256-block/18-light-array assumptions in world
storage, snapshots, workers, dirty queues, render bounds, weather and collision
where the target dimension data requires it. Preserve the ordinary 1.17.1 world
height; this is not an automatic 1.18 terrain-height or world-generation upgrade.
Carry forward word-based palette decoding and compare with a BigInt reference.

Acceptance: fixture coverage for changed packet families and boundary cases,
then status/login/compression, terrain/light, teleport acknowledgements,
keepalives, movement and dimension transitions in a real browser connected to a
matching 1.17.1 test server. Use a supplied/authorized test instance; do not replace
the running 1.16.5 server or edit its world. No missing resources, packet decode
warnings or crashes are accepted for the connection milestone.

## Milestone 3: authoritative inventory and interactions

Implement state-ID reconciliation, cursor/changed-slot prediction and rejected
click recovery before relying on crafting or workstations. Re-run creative
inventory/search, containers, shift-click, drag/drop, recipes, equipment and
resource-pack prompt tests. Preserve explosion audio, native fire targeting,
riding/removal cleanup, interaction sounds and movement corrections.

Acceptance: server-confirmed inventory sequences and malformed/reordered fixture
checks; no ghost items, stale cursor state or accidental neighboring block edits.

## Milestone 4: Caves & Cliffs content in reviewable groups

1. Copper/raw ores/deepslate and decorative block families; native shapes,
   occlusion, lighting, tool behavior, placement and sounds.
2. Amethyst, dripstone, moss/azalea/root/vine plants, glow lichen and candles;
   animated/emissive textures, particles, state changes and collision.
3. Powder snow/freezing, cauldrons, leather-boots behavior and overlays;
   spyglass camera/overlay, glowing signs/item frames and the light block.
4. Axolotl, goat and glow-squid models, metadata, animations, attachments,
   variants and sounds. Compare 1.17.1 fixes rather than stopping at 1.17 models.
5. GUI layouts, accessibility/narration, resource-pack compatibility, commands,
   fonts and formatted text; identify command-only or experimental items from
   native creative lists rather than exposing every asset automatically.

Server-owned AI, spawning, loot and world generation are verified through their
client-visible results; they are not recreated as client authority. Versioned
assets/models alone do not establish behavior parity.

## Milestone 5: parity, performance and distribution

- Audit both release inventories and native implementations. Include 1.17.1
  connection-hostname behavior, bucket/variant handling, font corrections,
  view-distance sky rendering and inventory/collision/rendering fixes where
  client-visible. Keep an implemented/verified/pending ledger.
- Re-run sound registry/reference checks and browser decoding of all shipped
  samples. Exercise explosion, fire, boats, beds, pistons, light, particles,
  custom packs and multi-version regressions against the new target.
- Profile real joins and ordinary play. Compare chunk decode/meshing/upload,
  allocations, frame-time spikes and memory with the 1.16.5 baseline; retain
  bounded worker/upload queues. Do not claim FPS gains from kernel timings.
- Check supported graphics adapters and persisted fallback behavior. Ship a
  separately named development HTML and static folder with hashes and source
  commits. Keep new content gaps visible until behavioral checks pass.
- Backport shared correctness/performance fixes to existing named branches when
  their runtime/data layouts support them. Keep 1.17 content and protocol changes
  on 1.17.1; do not transplant padded palette logic into older continuous codecs.

No new WASM build is part of this transition plan. A later measured module port
would be a separate task. Full 1.17.1 parity is a later acceptance gate, not a
claim attached to the first successful join.

## Sources

- [Mojang 1.17 release notes](https://www.minecraft.net/en-us/article/caves---cliffs--part-i-out-today-java)
- [Mojang 1.17.1 release notes](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-17-1)
- [Official 1.17.1 version metadata](https://piston-meta.mojang.com/v1/packages/e0e7ab5ed6f55bbd874ef95be3c9356d67e64b57/1.17.1.json)
- [Pinned 1.17.1 protocol schema](https://github.com/PrismarineJS/minecraft-data/blob/5e063fa99cfe8ded065ec6788b66696b7e4ef143/data/pc/1.17.1/protocol.json)

The schema confirms the packet fields above; native jar comparisons and the
acceptance checks remain required during implementation.
