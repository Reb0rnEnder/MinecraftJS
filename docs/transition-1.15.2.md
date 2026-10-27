# Transition from Java 1.14.4 to 1.15.2

Created before implementation. Branch: `1.15.2`, worktree:
`/home/ender/minecraftjs-1.15.2`. Base: `4b7e1d1` (1.14.4 with corrected world
entity shader lighting and fence-knot alignment). The branch now selects native
1.15.2 data and protocol 578. The inherited entity-model bundle is still used
until the packaged-class extractor is ported.

## Milestones and completion gates

1. **Pinned inputs and change inventory.** Pin official 1.15.2 metadata, client,
   server, mappings and asset index by SHA-1. Pin protocol data to a reviewed
   minecraft-data revision. Download into an isolated, ignored cache. Generate
   a reproducible protocol-498-to-target report and jar resource inventory,
   including bee/honey resources, registry/mapping/model extraction risks.
   Tests verify hashes, target identity and complete packet-ID mappings. No
   active runtime/asset switch in this milestone.
2. **Protocol and first join.** Implement a separate target codec and native
   packet IDs using the pinned schema. Review every changed field, shared type,
   entity metadata index, spawn position/velocity and chunk/biome/light format.
   Validate compression, login, settings, spawn teleport, movement, keepalive,
   reconnect and dimension changes against an isolated 1.15.2 server before
   selecting the codec. Never accept target data through an unchanged 498
   decoder. Test local-player pushing, team collisions, health/hunger and chat.
3. **Native assets and registries.** Extract target block states, item/entity
   registries, models, collisions/selection boxes, opacity/culling/light data,
   tags, recipes, creative contents, translations, sounds, particles, fonts,
   panorama and pack metadata from verified inputs. Audit 1.15's renderer/model
   changes before adapting the jar extractor. Require provenance and coverage
   checks; reject stale bundles. Switch visible version/runtime/assets together,
   then verify source serving and standalone HTML agree.
4. **Buzzy Bees content and behaviour.** Implement bee model/textures/metadata,
   flight/anger/pollen/stinger poses, honey blocks and movement, honeycomb/honey
   bottles, nests/hives and honey levels, bottle/shear interactions, associated
   particles/sounds, recipes, GUIs/tooltips and dispenser/server-authoritative
   outcomes. Build a feature matrix from official 1.15 release/patch notes and
   pinned jar evidence, including 1.15.1/1.15.2 changes. Check every new block
   for neighbour-face culling, lighting, collisions and selection geometry.
5. **Parity and distribution.** Verify inherited features, fluids/poses/camera,
   entity pushes/leads, inventories/workstations, world effects, HUD/debug,
   resource packs and networking against the target. Run native regression,
   real browser/GPU, live join/rejoin and standalone build checks. Document
   outstanding gaps; initial models/first join do not establish full parity.

## Backport policy

Shared bugs are fixed in the newest applicable implementation and backported to
1.14.4/1.13.2/1.12.2/1.8.9 using each native protocol, state representation and
version behaviour. Do not backport bees, honey blocks or other new vanilla
content. Preserve pre-1.9 collision behaviour on 1.8.9. Keep user configs, local
packs and servers intact. Builds continue to identify their real runtime.

## Optional graphics track: shader shadows

This is separate from the version switch. First add an optional bounded
sun/moon depth-map pass with stable light-space projection, caster culling,
cutout alpha tests and animated-vegetation parity. Apply depth comparisons and
filtering only to direct light for terrain and world entities; preserve GUI,
emissive, ambient and block light. Include resource cleanup, shader Off,
backend fallback, chunk edges and performance gates. Start with conservative
resolution/distance. Full BSL shadow GLSL needs its own coordinate distortion,
uniform/sampler and pass compatibility work; a basic native map is not full
shader-pack compatibility. No claim of artifact-free shadows is made.

## Status

- Plan committed before implementation.
- Milestone 1: complete. Verified inputs, native reports/resource inventory,
  staged packet IDs and regression checks are in `tools/port-1.15.2`.
  Native baseline: 680 blocks, 11,337 states, 884 items, 103 entity types,
  768 recipes, resource-pack format 5; 93 clientbound/46 serverbound packets.
  Seven clientbound layouts change; serverbound layouts are unchanged in the
  pinned schema. See [preparation details](../tools/port-1.15.2/README.md).
- Milestone 2: complete for login/play framing, packet-ID migration, changed
  layouts, chunk biomes, particles, light updates, and live join probes.
  Milestone 3: native registries/tables and indexed assets are active; native
  1.15 model extraction is complete with native quad UVs and provenance checks.
  Native seeded biome zoom, bee/honey movement/animation/audio and the multiplayer
  warning/title are implemented. Milestones 4–5 still need broader interaction
  and visual acceptance; shadow implementation remains pending. See the [1.15.2 feature audit](feature-audit-1.15.2.md);
  full parity is not claimed.

## Source references

- [Official release metadata](https://piston-meta.mojang.com/mc/game/version_manifest_v2.json)
- [minecraft-data upstream](https://github.com/PrismarineJS/minecraft-data)
- [Iris shadow guide](https://shaders.properties/current/guides/your-first-shaderpack/4_shadows/)
- [Inherited feature audit](feature-audit-1.14.4.md)
- [Lighting and fence fixes](entity-lighting-and-fence-knots.md)
