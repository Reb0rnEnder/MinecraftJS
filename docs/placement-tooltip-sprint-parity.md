# Placement feedback, attribute text and creative inventory follow-up

Target: 1.8.9.

1.16.5 / 1.17.1 / 1.18.2: GrowingPlantBlock survival is checked before local
placement feedback. Weeping vines attach to a sturdy bottom face above them or
the same plant family; twisting vines use the sturdy top face below them.
Cave vines share the downward rule only in targets where they exist. Invalid
placements do not swing, play the placement sound, lose items or create a local
prediction. This does not claim to predict server-only protection decisions.

Support flags are extracted from the exact native BlockState.isFaceSturdy
method for UP and DOWN, for every state, and preserved through generated render
data. Slab orientation is therefore handled using native support geometry,
not an opaque/full-cube heuristic. Extraction is implemented in each target's
ExtractRuntime.java and native data regenerated (17112 states in 1.16.5,
20342 in 1.17.1 and 1.18.2). No new vine blocks are added to earlier versions.
Native 1.18.2 references: GrowingPlantBlock cgs, WeepingVinesBlock cly and
TwistingVinesBlock clk; the support test is in cgs.canSurvive.

1.16+ attribute tooltip names use the target's snake_case description keys.
Legacy internal attribute names from weapon/potion tables are converted only at
the translation boundary. Older versions retain their camelCase language keys.
Weapon and potion tests use each target's actual en_us dictionary.

Sprint terrain particles are emitted for local and remote entities once per
entity tick, with native foot-block sampling, position spread and movement-
opposing velocity. Water/lava, crouching, spectator, dead and locally flying
players are excluded; invisible foot blocks do not create dust. The legacy
metadata block IDs and fluid flags remain version-specific. Native 1.18.2
Entity axk.canSpawnSprintParticle/spawnSprintParticle and LocalPlayer epw's
flight exclusion provide the modern reference. Existing terrain-particle
rendering supplies the texture and collision behavior. This is not a claim
that every particle type has been audited.

Creative tab icon stacks are cached by icon definition, rather than recreated
on every draw. 1.16.5 retains native stack identity phase (ItemProperties ejm,
anonymous class 2); 1.17+ uses the native integer rendering seed instead. Earlier
compass paths retain their native tick-based behavior. Scrollbar thumb Y is
integer-aligned, matching native creative rendering.

1.18.2 only: effect panels no longer shift the creative/survival inventory.
They use the right-hand space, with 120-pixel full panels, 32-pixel compact
panels/tooltips, or no panel when space is insufficient. Effects are read each
render so gaining/losing an effect while the screen is open is reflected.
Native 1.18.2 CreativeModeInventoryScreen efh / EffectRenderingInventoryScreen
efj were compared for dimensions, tab/slot/icon/scroll geometry and effect
placement. Native 1.17.1 ecc still shifts the screen and draws effects on the
left, so that older layout is deliberately preserved.

Validation: native support extraction and all-state support-flag coverage;
failed/successful vine placement including slabs; weapon/potion translations;
creative icon identity; sprint position/velocity and exclusion tests; existing
chest/dripleaf regressions; browser bundle and whitespace checks on every
applicable target. The 1.18.2 creative screen was rendered in Chromium with an
active effect and Nether compass, checked for centered geometry and no crash.
No hardware FPS or server-tick measurements are inferred from that browser test.
