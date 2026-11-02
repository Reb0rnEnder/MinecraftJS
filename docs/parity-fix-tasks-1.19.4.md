# Native parity tasks

Target: the existing 1.19.4 worktree, with correctness fixes backported to every
applicable supported target. Native jar behavior and exact release history are
required evidence. This is a work ledger, not a full-parity completion claim.

## 1. Commands, editing and skins

- [x] Extract the 18 native default skins, UUID selection and slim/wide models.
- [x] Replace removed skin paths in player/hand/GUI/head fallbacks.
- [x] Filter command items/blocks with native server-enabled feature flags.
- [x] Extract separate native creative catalogs for Update 1.20 and bundles.
- [x] Native command parser oracle: 116 inputs, ranges, errors and smart usage.
- [x] Correct first Shift+Tab, scrolling selection, usage/error rows and redirects.
- [x] Complete the audited enum/registry arguments and native selector option suggestions,
      especially `/kill @e[type=`.
- [ ] Verify Ctrl+A/C/X/V in chat, search, command blocks, books and other native
      editable fields, including browsers without Clipboard API access.

## 2. Native menus and MinecraftJS Extras

- [x] Feedback/report links open the native confirmation dialog.
- [x] Move client-only Video options into a `MinecraftJS Extras` screen.
- [x] Persistent Extras switches: zoom, dynamic lights for held items (local and
      remote holders), and fullbright. Preserve each target's native Video rows.

## 3. Placement prediction

- [x] Match native wall-torch facing immediately, before server correction.
- [x] Reject unsupported lantern-on-stairs placements before sound/swing.
- [ ] Audit support/placement checks for other shapes; add native regressions for
      supported and rejected placements. Do not promise universal prevention
      from an incomplete generic placement rule.

## 4. Breaking and first-person obstruction

- [ ] Compare damage-stage timing, texture blending and geometry with native code.
- [ ] Show damage on chests and other native eligible block entities.
- [x] Render the native suffocation/block obstruction overlay when inside blocks,
      while preserving blocks that do not produce the overlay.

## 5. Entity/block-entity presentation

- [ ] Fix placed player/mob heads: model, orientation, profile/default textures.
- [ ] Port unified painting spawning and native variant metadata/size/orientation.
- [ ] Verify standing/wall banners, patterns, cloth transforms and damage rendering.
- [ ] Verify sculk sensor vibration visuals separately from shrieker ring effects;
      add only effects emitted by the corresponding native block.

## 6. Loading and broader release audit

- [x] Preload the native panorama before showing the title screen.
- [ ] Audit 1.19, 1.19.1, 1.19.2, 1.19.3 and 1.19.4 changes against native code and
      the five supplied historical Wiki pages. Separate data presence, functional
      support, visual tests, missing work and server-authoritative behavior.
- [ ] Record remaining display entities, signed chat and new mob/particle gaps.
- [ ] Regress every changed target; build with source SHAs, manifest and checksums
      updated together when publishing distributions.

No 1.19.3 skin assets, 1.19 protocol features, or 1.20 experiments are backported
to versions that did not contain them. User servers, worlds, screenshots,
shader packs, network captures and configuration remain local inputs.

## Verified checkpoint details

- Held-item lighting: first-person meshes now sample dynamic light in world
  coordinates before switching to camera-local hand transforms. The local held
  light also illuminates its own item and arm. Includes offhand and independent
  built-in materials; disabling dynamic lights restores unmodified world light.
  Regressed on all nine existing targets.
- Breaking: simulation-tick stages, negative-height worlds, simultaneous damage
  positions and greatest stage per position. Native chest/lid geometry and the
  modern position-projected decal UVs have regression coverage. The 24 UV oracle
  samples come from native `SheetedDecalTextureGenerator`. In-world visual
  comparison of all eligible block entities remains pending.
- Native placement predicates are extracted for every state in 1.14.4 through
  1.19.4. Lanterns use center support, wall torches use full-face support, and
  native look/face ordering selects an attachment. No waterlogged lantern state
  is introduced into 1.14/1.15. The existing 1.13 wall-state prediction is fixed
  separately; no lantern feature is added to older releases.
- Wall skull north/south rotations are repaired across all targets; the native
  0.74/0.26 offsets remain through 1.15 and 0.75/0.25 apply from 1.16. Modern
  zombie heads use their native layer and player hats retain their child
  hierarchy. Powered head animations and experimental piglin heads still need
  their own audit.
- Flattened placed banners now derive base dye from their block and convert NBT
  dye IDs at the legacy compositor boundary. Standing poles and wall metadata
  are corrected. Pattern blending/limits and cloth animation still need a full
  native visual comparison.
- 1.19 vibration trails use packet origin coordinates and track block/entity
  destinations. Shriekers emit the native event 3007 delayed ring sequence.
  These new ring effects are not backported into sensor-only releases.
- Native command oracle: 116 parses plus seven selector suggestion cases,
  including all entries/ranges for `/kill @e[type=`. The regeneration command is
  `node tools/port-1.19.4/command-data.mjs`.
- WebGL2, WebGPU and Software pixel checks passed across all nine targets after
  the lighting implementation. BSL's basic lighting bridge also passed its
  browser regression with the local pack; this is not full shaderpack emulation.

Still outstanding: actual browser clipboard checks across every editor, unified
painting variants/spawns, bundle inventory interactions, broader placement
families, native visual review, the release-history audit and remaining parity
items. The bundles creative catalog is feature-gated correctly; this does not
by itself establish functional bundle interactions. Distribution rebuilds must
use the eventual committed source heads and refresh manifests/checksums.
