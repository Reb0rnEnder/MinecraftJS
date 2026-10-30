# Squid animation follow-up

Squid tentacles previously used a free-running generic sine. The client now
retains a per-entity phase, clamps at a complete cycle while waiting for server
status 19, interpolates old/current tentacle angles and applies SquidRenderer's
translated body rotations. Water swimming and land flopping use separate rules.
Glow squid also emit their native per-tick glow particle, only on 1.17.1.

Native comparisons: 1.8.9 `tx`/`bkb`, 1.12.2 `aaj`/`cax`, 1.13.2 `aki`/`dak`,
1.14.4 Squid `arv`, 1.15.2 Squid `aty`, 1.16.5 Squid `bav`, and the pinned
1.17.1 Squid `bev`, GlowSquid `ato`, SquidRenderer `eud`. Backports preserve
1.8.9–1.13.2's seed offset and older float angle conversion. The cycle/status
and interpolation regression passes on all seven targets. The isolated 1.17.1
mob browser scene renders without errors.

This ports the client animation, not server AI or swimming movement. Java's
constructor-local entity ID sequence is not reproduced: the random animation
speed uses the tracked entity ID, and Math.atan2 supplies direction angles.
Therefore exact random phase/angle equality with a simultaneously running Java
client is not claimed. Live animation comparisons remain acceptance work.
