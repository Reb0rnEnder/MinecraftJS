# Shared client fixes and camera-distance LOD

Updated 2026-10-24; implemented and tested on 1.8.9, 1.12.2 and 1.13.2.

- Rain uses its own particle factory and vanilla gravity. In 1.13.2 the particle
  sheet uses 1/32 UV steps, while 1.8.9 and 1.12.2 use 1/16. Logical particle
  rows still contain 16 entries. The previous 1.13 UVs sampled the wrong rain
  pixels and transparent firework sprites. Tests sample the actual jar images.
- Firework trails continue to spawn at the rocket/rider position each tick,
  leaving older sparks behind. Elytra attachment is tested only in 1.12.2 and
  1.13.2; 1.8.9 retains normal fireworks.
- Barrier markers appear in creative while the main hand holds a barrier. Item
  switches, mode switches, block removal and chunk unloading invalidate them
  before rendering. Duplicate markers use a position index instead of scanning
  the particle list.
- Terrain LOD measures Euclidean distance from the actual rendering camera to
  section bounds, including height. Entity animation LOD uses camera distance.
  The option is measured in blocks, with 0 meaning Off. Old `lodChunks` saves
  migrate to blocks once. A four-block hysteresis band prevents repeated terrain
  rebuilds when hovering around the threshold, and worker results trigger a
  recheck in case the camera moved while a mesh was being built.
- Particle ticks compact the existing list instead of allocating a replacement
  every tick. Particle quads no longer allocate temporary UV arrays. Rain-height
  queries skip missing/empty chunk sections rather than reading every sky block.
  These reduce allocation and lookup work; no live FPS improvement is claimed.
- Shared backports include owned NBT copies, typed tag equality, slot validity and
  slot limits during merging, authoritative incoming crafting results, chat-style
  resets, visibility-independent equipment and safe deferred hand-skin resets.
  Local crafting/click prediction remains enabled. Legacy metadata comparisons
  remain enabled on the older clients.

Run the same offline checks from each version's checkout:

```sh
node tools/test-client-regressions.mjs
npm run build
```

The ten shared tests use each checkout's real game data, jar models and texture
pixels. The 1.13.2 branch also retains its complete protocol/registry/movement
regression suite. Live-server/browser testing remains separate.

Dragon/crystal beams, guardian attack beams and dragon death effects were also
implemented and backported in the follow-up. See [the effect audit](entity-effects-2026-10-24.md)
for version coverage, implementation details and validation. Riptide shells are
1.13.2-only.
