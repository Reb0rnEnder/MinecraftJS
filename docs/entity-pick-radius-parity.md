# Entity pick radius parity (2026-11-06)

Targeting uses the native per-class radius instead of a universal .1 margin. The exact client jars define:

| Target | Entity default | ItemFrame | Shulker | AbstractHurtingProjectile |
| --- | --- | --- | --- | --- |
| 1.8.9 | .1f (widened float) | 0 | Not introduced | 1 |
| 1.12.2 through 1.19.4 | 0 | 0 | 0 | 1 |

The 1.20.6 worktree receives this fix in its forwarded 1.19.4 rendering baseline; its native 766 Play port remains incomplete. The 1.8.9/1.12.2 object spawner also restores large-fireball pickability; smaller fireballs remain non-pickable.

Compared exact methods `pk.ao` / `uo.ao` / `ws.ao` (1.8.9), `vg.aI` / `acb.aI` / `adi.aI` / `ael.aI` (1.12.2), `aer.aM` / `amb.aM` / `anl.aM` / `aol.aM` (1.13.2), and each officially mapped Entity/ItemFrame/Shulker/AbstractHurtingProjectile.getPickRadius method in 1.14.4–1.19.4. The 1.19.4 equivalents are `bfh.bB`, `buy.bB`, `bwg.bB`, `byt.bB`. No modern radius rule is imposed on the 1.8.9 default.

`tools/test-entity-pick-radius.mjs` exercises actual targeting at mob/frame edges, fireballs, nearer-block occlusion, survival reach and old object spawning. All ten targets pass focused regressions and browser-bundle compilation. The 1.19.4 native audit passes 330 tests in 56 files, zero failures/skips. No GPU performance or whole-renderer parity is inferred from ray tests; no distributions were rebuilt. The historical Wiki endpoint was restricted during this follow-up; exact native code supplies the per-class values.
