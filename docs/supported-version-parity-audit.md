# Supported-version parity review — 2026-10-27

**No supported branch is certified as having every vanilla feature.** This pass
reviewed the wiki release inventory and ran read-only data/runtime probes across
1.8.9, 1.12.2, 1.13.2, 1.14.4 and 1.15.2. It did not execute every behavior or
reproduce every vanilla bug ticket. Registry/model presence is not gameplay parity.

## Reference coverage

The [release index](../tools/parity/wiki-release-index.json) records SHA-256s,
source links, Additions/Changes topic headings and fix IDs from **35 wiki release
pages**, covering 1.8–1.15.2, including the intermediate 1.9, 1.10 and 1.11 updates.
There are 1,095 topic records and 3,071 fix-ID references across the pages; the
same ticket can appear on multiple pages. These counts describe the reference
inventory, not completed acceptance tests. Cached wikitext stays outside Git.

References include [1.8](https://minecraft.wiki/w/Java_Edition_1.8),
[1.12](https://minecraft.wiki/w/Java_Edition_1.12),
[1.13](https://minecraft.wiki/w/Java_Edition_1.13),
[1.14](https://minecraft.wiki/w/Java_Edition_1.14), and
[1.15](https://minecraft.wiki/w/Java_Edition_1.15), with all listed patch pages
through each supported target. The native client jars and official mappings are
used to determine implementation details; the wiki supplies the change inventory.

## Current findings

[Machine-readable results](supported-version-audit-results.json) distinguish
measured content/probes from open acceptance work. Content counts below are local
data rows and extracted model variants, not a claim of complete native registry
or runtime behavior coverage. Pre-flattening metadata variants are not individual
block rows; entity tables can include aliases/non-mob entries.

| Target | Protocol | Block rows | Item rows | Model variants | Parity finding |
| --- | ---: | ---: | ---: | ---: | --- |
| 1.8.9 | 47 | 198 | 336 | 52 | Not certified. Baseline multiplayer behavior exists; no exhaustive visual/interaction or wiki-fix acceptance record. |
| 1.12.2 | 340 | 254 | 410 | 66 | Not certified. Content/UI support exists; every 1.9–1.12 interaction, mob state and patch regression has not been accepted. |
| 1.13.2 | 404 | 598 | 789 | 83 | Confirmed missing incoming recipe synchronization and NBT-query replies; other aquatic interaction/presentation acceptance remains open. |
| 1.14.4 | 498 | 676 | 876 | 87 | Partial. Existing detailed topic/patch review has 197 open acceptance topics; its 58 narrow runtime probes pass. |
| 1.15.2 | 578 | 680 | 883 | 90 | Partial. Bee/honey client behavior exists; broader interaction outcomes, particle fidelity and entity visual acceptance remain open. |

All five pinned client-jar SHA-1s match the wiki's target hashes. Collision shape
entries cover every local block row. Empty static-host proxy lists, the custom
model loader and skull-profile handling are present on all five branches. These
are narrow positive controls, not a parity percentage.

The 1.13.2 diagnostic actually calls its production decoder with packet IDs 0x54
(Declare Recipes) and 0x1d (NBT Query Response); both currently return `unknown`.
This prevents a full protocol/data-pack compatibility claim. Dedicated editor
packets and skull-profile rendering have since been added, so older audit prose
claiming those are wholly absent is historical and should not be reused as a
current defect list. Further work must use fresh reproductions.

World generation, mob AI and authoritative crafting/redstone/loot outcomes belong
to the connected vanilla server. Their client-visible results still require
acceptance tests. Integrated singleplayer and Realms are outside this multiplayer
client's current scope. OptiFine shaders and Eagler extensions remain partial
client enhancements, separate from vanilla version parity.

## Fox repair

The fox adapter previously rendered its raw constructor pose: it omitted the
native standing torso rotation and tail angle, and only animated head/legs. Fox
metadata flags were not decoded, sleeping textures were unused, babies used an
incorrect uniform half scale, and the fox had no mouth-held item layer.

The repaired adapter preserves extracted geometry/hierarchy and ports the native
standing, sitting, sleeping and crouching poses, interest head roll, faceplant leg
motion, pouncing rotation, sleeping variant textures, distinct baby head/body
transforms and mouth-held item transforms. State resets prevent hidden legs or
sleep rotations leaking into standing. Faceplant leg phase uses elapsed ticks so
LOD/frame rate does not control its speed; native Java increments that cosmetic
phase per animation call. Full server-driven fox eating/particle/event acceptance
is still separate from this model repair.

The repair applies to **1.14.4 and 1.15.2 only**. Foxes did not exist in older
supported versions. Regression tests exercise both branches' actual metadata
indices and extracted model bundles; browser pose captures provide a visual check.

## Next acceptance priorities

1. Implement/test the confirmed 1.13.2 recipe and NBT-query gaps with actual server
   payloads, then audit remaining decoded-but-unhandled play packets.
2. Compare all entity state transitions, baby proportions and held/equipment
   layers with native rendering; foxes demonstrate why mesh presence is insufficient.
3. Exercise each workstation and server-driven item-use outcome on an isolated
   matching-version server, including inventory rollback and resource reload.
4. Complete particle collision/visual comparisons and the open 1.14/1.15 topic
   scenarios, then replay relevant client-facing patch fixes.

Reproduce the cross-version diagnostic from a checkout with the five worktrees:

```sh
node tools/audit-supported-versions.mjs --write
node tools/audit-supported-versions.mjs --strict
```

`--strict` deliberately fails while full parity remains uncertified. Downloaded
wikitext can be re-indexed with
`node tools/parity/index-wiki-releases.mjs /path/to/wiki-cache`.
