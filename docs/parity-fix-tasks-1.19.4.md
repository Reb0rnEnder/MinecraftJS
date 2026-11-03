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
- [x] Verify Ctrl+A/C/X/V in chat, search, command blocks, books and other native
      editable fields, including browsers without Clipboard API access.

## 2. Native menus and MinecraftJS Extras

- [x] Feedback/report links open the native confirmation dialog.
- [x] Move client-only Video options into a `MinecraftJS Extras` screen.
- [x] Persistent Extras switches: zoom, dynamic lights for held items (local and
      remote holders), and fullbright. Preserve each target's native Video rows.

## 3. Placement prediction

- [x] Match native wall-torch facing immediately, before server correction.
- [x] Reject unsupported lantern-on-stairs placements before sound/swing.
- [x] Audit support/placement checks for other shapes; add native regressions for
      supported and rejected placements. Do not promise universal prevention
      from an incomplete generic placement rule.

## 4. Breaking and first-person obstruction

- [x] Compare damage-stage timing, texture blending and geometry with native code.
- [x] Show damage on chests and other native eligible block entities.
- [x] Render the native suffocation/block obstruction overlay when inside blocks,
      while preserving blocks that do not produce the overlay.

## 5. Entity/block-entity presentation

- [x] Fix placed player/mob heads: model, orientation, profile/default textures.
- [x] Port unified painting spawning and native variant metadata/size/orientation.
- [x] Verify standing/wall banners, patterns, cloth transforms and damage rendering.
- [x] Verify sculk sensor vibration visuals separately from shrieker ring effects;
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
  samples come from native `SheetedDecalTextureGenerator`. Pixel checks additionally exercise closed and open chest lids using native
  damage textures on WebGL2, WebGPU and Software in every target. These checks
  establish surface coverage, not an exhaustive screenshot match for all entities.
- Native placement predicates are extracted for every state in 1.14.4 through
  1.19.4. Lanterns use center support, wall torches use full-face support, and
  native look/face ordering selects an attachment. No waterlogged lantern state
  is introduced into 1.14/1.15. The existing 1.13 wall-state prediction is fixed
  separately; no lantern feature is added to older releases.
- Wall skull north/south rotations are repaired across all targets; the native
  0.74/0.26 offsets remain through 1.15 and 0.75/0.25 apply from 1.16. Modern
  zombie heads use their native layer and player hats retain their child
  hierarchy. The experimental piglin head now uses its native model and texture only when
  the server enables it. Powered dragon/piglin head animation remains a separate gap.
- Flattened placed banners now derive base dye from their block and convert NBT
  dye IDs at the legacy compositor boundary. Standing poles and wall metadata
  are corrected. Native dye palettes, the 17-layer limit and position/world-age cloth phase
  now have native-derived regressions. Legacy layered-mask blending preserves
  AWT versus NativeImage differences; modern masks retain their own alpha.
- 1.19 vibration trails use packet origin coordinates and track block/entity
  destinations. Shriekers emit the native event 3007 delayed ring sequence.
  These new ring effects are not backported into sensor-only releases.
- Native command oracle: 116 parses plus seven selector suggestion cases,
  including all entries/ranges for `/kill @e[type=`. The regeneration command is
  `node tools/port-1.19.4/command-data.mjs`.
- WebGL2, WebGPU and Software pixel checks passed across all nine targets after
  the lighting implementation. BSL's basic lighting bridge also passed its
  browser regression with the local pack; this is not full shaderpack emulation.

## Additional verified fixes

- Paintings use native 16-pixel tiles, repeating backs/edges and separate world
  lighting per tile. Legacy versions retain their atlas; modern versions use
  individual textures. The 1.19.4 unified spawn/metadata path covers all 30 native
  variants and four wall directions. A separate native server confirmed a 4×4
  painting through the real packet and entity paths.
- Bundles now implement typed-NBT capacity, nested weight, right-click insertion
  and extraction, item-use emptying, item predicates, durability bar and native
  tooltip grid. Invalid/output-slot transactions preserve contents. The native
  1.19.4 server confirmed insertion/extraction and authoritative slot snapshots.
  Backports start at 1.17; bundle sounds start at the native 1.18 behavior.
- Real Chromium clipboard tests cover chat, creative search, command blocks,
  book pages and signing titles over secure and insecure HTTP origins. Older
  book editors preserve their native selection limitations.
- Native placement-family extraction classifies the implementation owning
  `canSurvive`, exports support/replacement predicates and plant soils, and
  lists unreviewed context-dependent overrides. It covers rails, plates,
  carpets, ordinary/double plants and, where present, roots/spore blossoms.
  Native support extraction now binds newer tag registries before evaluating
  support. This prevents silently accepting unstable bottom-center supports.
- The targeted placement, banner, painting and bundle regressions pass on every
  applicable existing worktree. Browser chest-crack and clipboard checks pass
  on all nine targets. The inherited entire broad suite still has stale port
  fixtures and is not reported as passing.

Still outstanding: [broader release audit and known gaps](release-audit-1.19.4.md),
powered head animations, additional context-dependent placement rules and an
exhaustive native screenshot comparison. Full 1.19.4 parity remains unfinished.
Distribution rebuilds must use committed source heads and refresh manifests and
checksums together.
