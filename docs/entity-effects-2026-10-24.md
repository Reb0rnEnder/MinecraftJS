# Dragon, crystal, guardian and Riptide effects

Implemented 2026-10-24 from the pinned vanilla client jars. This is a targeted
rendering correction, not a claim of complete client parity.

| Effect | 1.13.2 | 1.12.2 | 1.8.9 |
| --- | --- | --- | --- |
| Dragon healing crystal beam | Added | Backported | Backported |
| Crystal beam-target metadata, including respawn beams | Added renderer | Added metadata and renderer | Not a vanilla 1.8 feature |
| Guardian and elder guardian attack beam | Added renderer and charge timing | Added target metadata and renderer | Added target metadata and renderer |
| Dragon death skin dissolve, light rays, rising movement and explosion particles | Added | Backported | Backported |
| Huge-explosion emitter: six bursts per tick for eight ticks | Added | Backported | Backported |
| Riptide spinning texture shells | Added | Not available in this version | Not available in this version |

The dragon/crystal beam is an eight-sided taper with scrolling texture
coordinates, dark at the dragon and bright at the bobbing crystal. The nearest
crystal is selected within the dragon's expanded 32-block search bounds; the
client periodically refreshes this selection and immediately drops removed
crystals. Health restoration remains the server's responsibility.

Guardian attack beams read the synchronized target ID, including the local
player. Changing the target resets charge progress. Normal guardians charge for
80 ticks and elders for 60. The renderer draws the rotating crossed planes,
animated end cap and charge-dependent colour from the jar. Elder dimensions are
used for the beam's eye position. This is distinct from the Riptide effect.

Dragon death uses the 200-tick sequence rather than the generic 20-tick mob
smoke puff. The exploding texture provides an alpha-tested depth mask for the
remaining skin and eyes. Seeded light-ray fans grow and fade over the sequence;
large explosion particles appear throughout, followed by huge-explosion emitters
at ticks 180 through 200. Server entity removal still ends the sequence.
Riptide uses the jar's 64x64 texture and 16x32x16 model box, transformed into the
player's existing swimming/spinning pose with the vanilla shell scales and
rotation rates. It renders with the third-person player model.

Beam visibility uses the beam's bounds and distance to the camera, independently
of whether its owner body is visible. Dynamic GPU meshes are reused while active,
then freed on target changes, entity removal, renderer reset or world change.
Huge-explosion emitters are cleared with the particle system.

Validation: `node tools/test-client-regressions.mjs` on each version. Tests use
that version's actual jar textures and model geometry, exercise target changes,
local-player targets, endpoint motion, off-screen owners, charge durations,
mesh reuse/cleanup, death timing and the emitter lifetime. A software-rendered
frame test checks that the dragon loses visible skin fragments and that both
skin and eyes disappear completely at tick 200. The native 1.13.2 suites and
all three production HTML builds also pass. Live-server visual testing remains
necessary for the complete fight and Riptide experience.
