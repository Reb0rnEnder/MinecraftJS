# Dropped item block collision

Items previously advanced directly to their next position and only tested whether the cell containing their feet was opaque. That cannot represent slabs or transparent collision blocks and can tunnel through a floor entirely. Items now sweep their 0.25-block bodies through World.getCollisions and clip each movement axis against the actual block shapes. Server position/velocity packets remain authoritative.

Native references checked in the exact client jars: 1.8.9 uz, 1.12.2 acl, 1.13.2 amm; 1.14.4 atx, 1.15.2 awb, 1.16.5 bcv, 1.17.1 bhd, 1.18.2 bli, and 1.19.4 bvf. Their Entity movement uses Y then horizontal axes; 1.14+ resolves the larger horizontal displacement first. Gravity and vertical-drag float/double differences are retained. Only 1.14+ skips resting movement on three out of four ticks, using entity ID to stagger work. Ground friction uses the native block slipperiness. Extracted evidence lives under each cache/item-physics-src or cache/port-V/item-physics-src.

The Minecraft Wiki Item (entity) page could not be fetched because of robots.txt; no Wiki citation is claimed for these implementation formulas. Tests use each target's extracted block collision shapes for stone, glass, leaves and bottom slabs, plus wall/ceiling, fast-fall and real EntityManager.tick regressions.

Scope: block collision and ground support. Fluid currents, buoyancy, item merging and server-side pickup timing are not claimed complete by this patch. Items already spawned inside a block are still governed by server correction. No FPS gain has been measured.
