# Iron golem crack overlays

Damage and repair now select the native low/medium/high crack textures. The layer follows the actual animated golem pose and shares normal entity lighting and hurt tint. It is hidden for invisible or sufficiently repaired golems, and health changes apply even while distant poses are throttled. Healthy/hidden crack layers skip pose work; visible layers copy the already computed base pose instead of animating a second golem.

The native thresholds use strict comparisons: below 75% is low, below 50% medium, below 25% high. Exactly 75% has no cracks; exactly 50% is low; exactly 25% medium. The fraction uses the synchronized maximum health. Spawned golems start with their native 100 health/max health before metadata and attributes arrive.

Verified from each target client.jar: IronGolem, IronGolem.Crackiness.byFraction and IronGolemCrackinessLayer. Extracted audit classes are cached under cache/port-V/golem-native. Native classes: 1.15.2 atl/dyu; 1.16.5 bai/eil; 1.17.1 bei/evt; 1.18.2 bin/ezf; 1.19.4 brv/fre. All five native texture sets already existed; no newer assets were added to older releases.

The [Iron Golem history](https://minecraft.wiki/w/Iron_golem#History) and [19w41a release history](https://minecraft.wiki/w/Java_Edition_19w41a) confirm this feature arrived in 1.15. Backported to existing 1.15.2, 1.16.5, 1.17.1 and 1.18.2; deliberately excluded from 1.14.4, 1.13.2, 1.12.2 and 1.8.9.

Regressions exercise the actual spawned entity and renderer, all exact thresholds and texture paths, custom maximum-health fractions, animated arm alignment, damage, repair, invisibility and LOD-skipped frames. Inventory equipment, fox pose and collision regressions also pass on each affected target. These are CPU/model regressions, not a claim of live user-GPU screenshot equivalence.
