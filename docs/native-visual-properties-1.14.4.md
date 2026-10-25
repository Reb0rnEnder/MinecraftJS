# Native block properties, living entities and ground shadows

Campfires were being treated as opaque full cubes because the registry's broad
`boundingBox: block` category was used for rendering and suffocation tests. The
collision shape was already correct (7/16 high), but the opaque flag hid adjacent
faces, darkened lighting/AO samples and triggered the player's sideways push-out.
Stonecutters, lecterns and bamboo had the same classification problem.

`ExtractRuntime.java` now evaluates every native BlockState's solid rendering,
view blocking, render type, light opacity/emission, shade brightness, full collision
shape and occlusion shape. `finalize-runtime-data.mjs` writes a compact indexed
table for all 11,271 states, with the client jar hash. Both the main thread and
workers read these state properties. Physics uses view blocking separately from
render opacity. Lit and unlit states retain their different light emission.

The same extraction records entity metadata indices through the native accessor
objects and official mappings, plus villager type/profession registries and hat
texture metadata. Villagers use the nine-part native model hierarchy, base skin,
biome, profession and level layers. Resource packs can override hat metadata.
Zombie villager paths/layers and witch part ordering are updated too.

Cat, fox, panda and ravager geometry is extracted from their native constructors.
These mobs, pillagers, wandering traders and trader llamas now have living-entity
classification and model/texture routing. Mooshrooms use the renamed red/brown
textures; minecart variants retain their shared renderer and native identities.
This establishes visible models and ordinary idle/walking behavior. Specialized
new animal poses, genetics, crossbow poses and combat animations remain further
parity work; this milestone does not claim complete entity animation parity.

The old shadow was one square positioned at an integer height under the entity
center. It floated over partial blocks and empty space. Shadows now project onto
eligible ground cells, with continuous circle UVs and height, light and distance
fading. Each entity owns a reusable dynamic mesh, disposed with its other meshes.
The common shadow fix is adapted to 1.13.2, 1.12.2 and 1.8.9. Native 1.14 content,
registries and properties are not backported.

## Checks that protect later ports

- `validateVisualRuntime` runs during asset/HTML builds and rejects missing or
  stale block properties, unclassified entities, missing model adapters/parts,
  non-finite poses and texture paths absent from the jar.
- It covers all 11,271 states, all 64 living types, and the villager biome,
  profession and level texture combinations. Unknown object/living identities
  require an explicit classification rather than silently disappearing.
- The asset layout is version 3, and source URLs use a new cache identity. Older
  extracted asset directories are rejected instead of supplying stale models.
- Regression tests cover adjacent-face culling, per-state emission, stepping onto
  campfires/stonecutters and staying there, structured villager metadata, hat
  rules, ground clipping, multiple shadow heights, lighting and the real World
  lighting API. The native/shared suite currently passes 56 tests.
- A browser fixture renders the new mobs, villager layers, dry lit/unlit campfires
  beside stone, and projected shadows through the actual rendering path.

These checks catch the property and coverage failures involved here. They do not
replace visual comparison and server tests for every new animation or mechanic.

```sh
node tools/port-1.14.4/finalize-runtime-data.mjs
node --test tools/test-1.14.4-*.mjs tools/test-shadows.mjs tools/test-font-providers.mjs tools/test-worker-snapshots.mjs
npm run build
```
