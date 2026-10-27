# Portal, End-exit and parity repairs — 2026-10-27

Vanilla Survival portal travel waits approximately 80 ticks; Creative travel is
immediate. The server decides when to change dimensions. No artificial client
teleport delay has been added. Portal contact now tests the player's overlapping
blocks, including legacy state IDs. The visual ramp uses native 0.0125/0.05 tick
steps and nausea timing, and a rotating anisotropic projection warp replaces the
incorrect FOV oscillation. Source: pinned 1.15.2 LocalPlayer/GameRenderer and
[portal behavior](https://minecraft.wiki/w/Nether_Portal).

End-exit game-event value 0 now requests respawn without opening credits. Value 1
still opens the poem; the server owns whether it has been seen. A delayed credits
import cannot reopen it after changing connections. This fixes the unconditional
credits display without adding a browser-side per-world guess. Native source:
ClientPacketListener.handleGameEvent; [End poem access](https://minecraft.wiki/w/End_Poem).
These portal/credits fixes apply to all five supported versions.

The 1.13.2 recipe and NBT-query packet gaps are implemented. Protocol 404's recipe
id/type order is distinct from 498/578. Synchronized recipes now replace recipe
book/crafting data on 1.13.2–1.15.2, including ingredient alternatives and typed
output NBT. Matching handles shaped offsets/mirroring and overlapping shapeless
alternatives. Furnace/smoker/blast-furnace books filter their serializer types,
retain independent settings, and use native item registry icons. Reload/connection
changes invalidate catalogs; initial unlock packets clear stale unlocks.

F3+I requests typed server NBT when permitted; Shift+F3+I uses available client
block data. Requests are transaction/connection checked. Clipboard commands strip
identity/position fields; F3+C copies the native location command. These features
are applied only to the versions which introduced them (1.13+).

Particle motion now sweeps a small AABB against actual world collision shapes,
landing on partial surfaces and preventing fast particles tunnelling through a
wall. Collision-free particles bypass the collision query. This applies to all
five supported versions.

Regression fixtures cover native recipe packets, live handler dispatch, custom
NBT/results, recipe-book context filtering, settings, query correlation, SNBT,
portal ramps/projections, End-exit flags and particle slab/wall collisions.
Broader visual/server interaction acceptance remains open; this is not a claim
that every topic in the supported-version wiki inventory has been certified.
