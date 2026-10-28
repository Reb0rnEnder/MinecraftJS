# Sleeping state and camera fixes — 2026-10-28

Both 1.14.4 and 1.15.2 still waited for the removed Use Bed packet to enter
local sleep. The server position update therefore put an awake client on the
bed. Living sleeping-position metadata is now applied to the local player
(index 12 in 1.14.4, 13 in 1.15.2), remote players and sleeping villagers.
Null positions, wake animations and respawns clear the state and sleep screen.

The modern native behavior was checked against the pinned official client jar
and its mappings: LivingEntity.startSleeping, LivingEntityRenderer.setupRotations
and Camera.setup. Sleep uses the bed center, y + 0.6875, a 0.2 x 0.2 pose,
a camera offset of 0.3 above the smoothed eye height, and native horizontal
model rotations and bed direction offsets. Third-person remains available.
Sleeping input cannot walk or fall off the bed locally.

Third-person camera rays now use collision shapes rather than selectable
outlines. Noncolliding plants do not obstruct the camera; solid shapes still
do. This follows ClipContext.Block.COLLIDER in the native modern camera.
The older-version sleeping/camera implementations are unchanged.

All five versions default Touchscreen Mode from device touch capability on
first use. Explicit saved preferences take precedence and keep vanilla arrow
behavior, including always-visible arrows when Touchscreen Mode is enabled.
List rows clipped behind headers/footers no longer count as hovered.

Validation: metadata packet handler, incremental metadata and explicit null
wake, all four bed directions, stable sleep physics, horizontal model matrices,
plant-versus-solid camera rays, touchscreen defaults and saved overrides.
Browser fixtures verify the sleep screen, first-person eye height, third-person
model, and wake cleanup in both modern versions. Full parity is not claimed.
