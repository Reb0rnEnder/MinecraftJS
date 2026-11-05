# Large-distance performance and boat follow-up (2026-11-05)

The user's real 1.19.4 captures identify chunk scheduling as the largest initial CPU cost. Both captures use WebGL2, render distance 32, Fabulous enabled, no shader pack, and a 904 × 725 drawing buffer. They do not measure the previously described full 1440p ultrawide viewport. Different amounts of terrain had finished loading, so these are useful diagnostics rather than a controlled whole-client benchmark.

| Capture measure | Initial | After queue/air-storage changes |
|---|---:|---:|
| Frames in approximately 15 seconds | 343 | 908 |
| Median frame interval | 41.5 ms | 13.5 ms |
| Mesh-scheduling CPU / rendered frame | 32.56 ms | 5.81 ms |
| renderFrame CPU / frame | 5.68 ms | 8.18 ms |
| Median asynchronous GPU sample | 2.85 ms | 8.16 ms |
| Retained world backing buffers, final snapshot | 1,119,991,808 bytes | 456,939,520 bytes |
| Browser-reported used JS heap, final snapshot | 1,538,672,015 bytes | 669,373,900 bytes |
| Meshed sections, final snapshot | 3,075 | 18,491 |

The after capture still had 13,779 dirty sections. More loaded geometry explains why GPU/render cost can grow even while frame intervals improve. The subsequent disabled-LOD scan fix is newer than that capture; no post-LOD gameplay improvement or 600 FPS result is claimed. Raw user captures remain local inputs and are not committed.

## Changes

- A persistent nearest-first heap replaces per-frame sorting of the complete in-range backlog. Ordinary completions/removals retain ordering; new dirtiness enters the heap immediately. It re-anchors when the camera crosses a section boundary or changes range. This only quantizes rebuild priority: visible geometry, camera-distance LOD and entity animation distances are unchanged.
- Selection, neighbour readiness checks and dispatch share a cooperative two-millisecond budget. Initial heap creation is linear and can exceed that budget once; immediate native player-triggered builds can also exceed it. Lost leases re-enter the dirty set before the full-pool early return.
- Empty dirty sections remove stale meshes and invalidate outstanding tokens immediately. A late worker result cannot restore deleted geometry. Boundary changes still dirty neighbouring nonempty sections.
- Native 1.13.2+ block arrays use 16-bit storage for these registries, saving 8,192 bytes per allocated section. Decoders retain a 32-bit path for wider supplied registries and Section.set promotes wider values without truncation. Native 1.8.9/1.12.2 were already 16-bit.
- With independent server lighting (1.14.4+), sections containing only canonical state-zero air are implicit. Cave/void-air identities remain explicit, light columns retain their own lifecycle, and later placement recreates a section with its received lighting. No chunk/world data is discarded to lower the selected distance.
- Disabled LOD no longer rescans every mesh as ordinary full-detail meshes arrive. Turning LOD off still rebuilds existing LOD meshes, and late LOD results invalidate that check. Hysteresis now reads the renderer's numeric section keys and uses each section's actual prior state.
- Consecutive entity draws can share a batch when texture, target, uniforms and all render-state values agree. No material reordering occurs. Different lighting, overlays, glints, layer order and partial draws remain separate.
- The hidden console microprofiler is opt-in, bounded, removes hooks on stop, and includes CPU sections, per-pipeline submission/element counts, optional nonblocking/disjoint-aware WebGL2 GPU queries and known-buffer snapshots. It is documented in performance-capture.md. No extra settings rows were added.

## Validation and applicability

All nine existing named worktrees receive the scheduler, LOD, batching and profiler changes. Compact state storage applies to 1.13.2+, implicit canonical air to 1.14.4+ with independently retained server light. Native release differences remain intact.

The actual scheduler's synthetic 101,400-entry, 32/32 backlog replay improved from a median 22.26 ms to 2.28 ms per call before the final linear-heap construction adjustment. This is CPU replay time, not gameplay FPS. A synthetic 300-zombie scene reduces 300 submissions/frame to one when material values match, with some additional CPU comparison work; it does not represent a layered village scene. Real WebGL2 pixel comparisons across all nine versions render identical pixels while reducing a 160-quad test from 160 submissions to two. SwiftShader is a graphics regression target, not the user's GPU.

Tests cover heap ordering/mutation/defer/re-entry, empty-job cancellation, late mesh tokens, numeric-key LOD hysteresis and disabling, every native block-state ID, wider-state storage, canonical/cave/void air, independent lighting, later placement/reload, material boundaries, profiler cleanup/bounded samples, and GPU-query availability/disjoint cases. 335 relevant regressions passed across the nine targets, including per-target terrain/protocol checks. The native JVM coordinate samples independently returned [-4097,-1,0,4096] for 1.16.5–1.18.2 and [-4096,0,1,4097] for 1.19.4 at the tested negative/positive boundary inputs. Offline distributions are not rebuilt by this source-only maintenance batch.

## Relation to optimization mods

[Sodium](https://github.com/CaffeineMC/sodium/blob/dev/common/src/main/java/net/caffeinemc/mods/sodium/client/render/chunk/RenderSectionManager.java) motivates keeping rebuild/visibility queues persistent and reducing submissions. Region buffer arenas and multi-draw remain a larger architectural follow-up; they are not implemented here. [ImmediatelyFast](https://github.com/RaphiMC/ImmediatelyFast) motivates conservative batching, while [EntityCulling](https://github.com/tr7zw/EntityCulling) highlights more precise hidden-entity rejection. Neither complete mod was ported, and the measured entity costs in this capture are much smaller than the original scheduler cost.

[Starlight](https://github.com/PaperMC/Starlight/blob/fabric/TECHNICAL_DETAILS.md) and [Phosphor](https://github.com/CaffeineMC/phosphor-fabric) are lighting-engine work, not replacements for processing authoritative server light correctly. [Fabulously Optimized](https://github.com/Fabulously-Optimized/fabulously-optimized) is a component collection. Existing OptiFine-like quality controls remain separate from measured renderer changes. No vendor source was copied. Two per-walk visibility memoization experiments were rejected: one added overhead, the other did not show a reliable improvement over noise.

## Chest boats and native movement

Native 1.19.4 ChestBoat.interact opens storage on secondary use (sneak), otherwise mounts if capacity allows. Inventory while riding requests OPEN_INVENTORY (player-command action 7), which was missing here. A disposable vanilla 1.19.4 server and browser confirmed the resulting native ChestScreen. The repeatable tools/port-1.19.4/probe-chest-boat-inventory.mjs also verified both secondary-use opening and the riding Inventory key against that server; it refuses commands unless the isolated fixture MOTD matches. The user server/config/world were untouched. Chest boats are a 1.19 addition, so this feature is not backported: [official 22w12a announcement](https://feedback.minecraft.net/hc/en-us/articles/5059715633933-Minecraft-Java-Edition-Snapshot-22w12a), [Wiki history](https://minecraft.wiki/w/Boat_with_Chest#History).

The jar's chest-boat single-passenger offset is 0.15f, and the experimental 1.19.4 bamboo raft's riding height is 0.3 rather than -0.1. These native distinctions are retained only where present.

Exact client jars/mappings were inspected for ClientPacketListener, ClientboundMoveEntityPacket, VecDeltaCodec and Boat/ChestBoat. Since 1.16, zero-axis relative updates preserve exact coordinate bases and absolute teleports always supply exact coordinates to lerpTo. The client had quantized all axes and retained the older small-teleport shortcut. Fixes apply to 1.16.5–1.19.4: 1.16.5–1.18.2 encode with floor, while native 1.19.4 VecDeltaCodec uses round. Look-only updates use current interpolated coordinates; relative updates for a locally controlled vehicle are ignored, matching native handling. The 1.14.4/1.15.2 jars still contain the proximity shortcut, so it is preserved there. Earlier releases were not forced onto the newer movement path.

Standing/walking on a floating boat is also affected by vanilla [MC-156980](https://bugs.mojang.com/browse/MC-156980). Native server movement validation can reject movement as the boat bobs under a player. The client precision fixes do not claim to eliminate that server-side issue. The existing server-side [Boat Standing Fix description](https://modrinth.com/mod/boat-standing-fix) explains that its workaround changes the server checks; no server mod or configuration was installed. The disposable walking probe reproduced clipping/swimming pose and corrections, but did not establish a general client-only fix. This remains a release gate for claiming the reported boat problem completely solved. A 1.20.6 branch is not created on an unverified claim of completion.
