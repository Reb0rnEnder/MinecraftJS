# Repair review after the 1.15.2 handoff

Scope: review `session-new.md` and commits `6eaa66c..1f7ecd2`, repair confirmed
regressions, continue the native client transition and backport shared fixes.
Keep the user's server/world, resource packs, session history and local files.

## Confirmed findings

1. 1.15.2 item mechanics still use 1.14.4 numeric IDs. Trident 853 resolves to
   action `none`; crossbow 857 resolves to a food. The Riptide test supplies an
   empty creative table and bypasses the production bug. Regenerate native
   creative tabs, icons, stacks and item mechanics; test the real loaded tables.
2. The imported 1.15.2 collision file dropped native render and selection
   tables. Placement checks `nb.collisionFull`, absent on registry definitions,
   so self-intersection is not checked. Use actual placed collision shapes and
   check the local player and blocking entities. Never predict a default state
   for every stateful/multiblock block. Validate rollback and server correction.
3. `_wetForRiptide` calls movement-fluid handling, which applies acceleration.
   Item eligibility checks must not move the player. Use a read-only fluid test
   and verify actual input/charge/release, not just `startRiptide` in isolation.
4. Builds silently accept a cache-only 1.14 entity-model bundle and disable
   native visual validation for 1.15.2. New block rendering data also lack
   provenance. Port native extraction, reject stale/missing artifacts, and
   distinguish completed runtime behavior from known extraction gaps.
5. `1.12.2-translation-wip` was authored on October 19, before this handoff.
   `git push --all` accidentally published it. Its translation layer is unwired;
   merging it would not repair the existing native 1.12.2 branch. Check for any
   independently useful fixes, backport onto `1.12.2`, preserve the local WIP
   commit, then remove only the accidentally published remote WIP ref after
   verifying no one added remote work.

## Execution order and acceptance

- P0: reproduce item-use and placement failures with production data; repair
  trident charging/release, safe placement and correction/rollback on 1.15.2
  and applicable older versions. Recheck native push-out conditions before
  changing movement; don't mask bad placement by removing collision handling.
- P1: restore native creative/mechanics/render/selection extraction with hash
  provenance; audit protocol/chunk/biome/entity metadata and asset/model build
  fallbacks. Add meaningful tests for confirmed failures and target coverage.
- P2: validate joins, reconnects, actual input, new content and existing features
  in a real browser against the running target server. Use an isolated world
  for destructive scenarios; do not change the user's world to test blocks.
- P3: update the parity/backport matrix with evidence and explicit remaining
  gaps, fix the accidentally published branch, run appropriate regressions and
  graphics checks, push named branches, and rebuild versioned artifacts with
  current hashes. Do not claim complete parity from a short unit suite.

Server-owned bee AI, hive storage and generation do not require duplicating the
server in the browser. Client acceptance should cover the packets, rendering,
input, particles, sounds and movement that expose those server outcomes.

## Implemented and checked

- Regenerated the native creative catalog, item use actions, selection shapes,
  collision shapes, occlusion/light/suffocation properties and versioned metadata.
  All 11,337 state records have the target jar hash. The search tab has 1,134
  entries, one firework star and no trident in Brewing.
- Placement rejects intersecting collision geometry, allows face contact and
  retains valid delayed predictions until authoritative correction. Multiblock
  and unresolved placement states are not guessed. Shared placement fixes are
  backported to 1.8.9/1.12.2/1.13.2/1.14.4; read-only Riptide wet checks and the
  durability guard go only to the versions with tridents.
- Restored 1.15 living metadata after insertion of the stinger count. Bee flags
  are wire index 16 (nectar 8, stung 4), anger 17; player absorption is 14.
  Preserve special native entity eye heights while checking registry identity.
- Restored height-dependent chunk biomes in world and worker snapshots.
- Native model constructors now extract 90 model variants with native quad UVs,
  including BeeModel. Builds reject extraction failures and validate 65 mob
  adapters, 115 texture references and all native rendering states. Fixed the
  1.15 iron-golem texture path and per-half chest geometry/textures. Removed
  the unverified 1.14 cache fallback. Shader pack version macro is now 11502.
- Browser/server acceptance used an isolated 1.15.2 server on port 25566. A
  server-given Riptide III trident charges through normal input and adds the
  native speed-3 impulse in water; the server saved the resulting position.
  A server-owned attached firework accelerated the gliding player over multiple
  ticks and emitted particles. No browser exceptions in those checks. A repeat with a fresh high-altitude player also passed: a server-owned rocket increased forward velocity and emitted 13 particles.
- Targeted 1.15 suite: 71 passes; additional placement checks: 2 passes.
  Version-appropriate 1.14 suite: 174 passes, one optional endpoint skip.
  Full older suites: 1.13: 259 passes; 1.12: 94; 1.8: 86 (one endpoint skip each),
  plus two new placement checks per checkout. Running 1.13-specific data tests
  against 1.14 is invalid and is excluded from the 1.14 result.

## Remaining parity work

These repairs do not establish complete 1.15.2 parity. Native geometry and valid
poses are checked, but every entity animation needs visual comparison (notably
bee rolling/grounded transitions and dragon mirrored limbs). Biome lookup now
preserves the 3D samples; native seeded biome-zoom interpolation needs separate
comparison. Honey adhesion/edge sliding, all workstation interactions and shader
pack compatibility still need their broader transition acceptance checks.
Server-owned bee AI/hive storage are tested through client-visible outcomes,
not treated as missing browser simulation. Keep the transition audit open.

Native piston events also still wrote legacy ID/metadata states. They now
resolve flattened piston/moving/head states and recognize slime attachments on
1.13.2, 1.14.4 and 1.15.2. Tests verify the base, moving state and attached block.
