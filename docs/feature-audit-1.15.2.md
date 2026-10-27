# 1.15.2 feature audit — 2026-10-27

This audit compares the active branch with the requested [1.15](https://minecraft.wiki/w/Java_Edition_1.15), [1.15.1](https://minecraft.wiki/w/Java_Edition_1.15.1), and [1.15.2](https://minecraft.wiki/w/Java_Edition_1.15.2) pages. **The branch does not yet have full 1.15.2 parity.** Registry and asset presence are not treated as proof that the corresponding gameplay works.

## Verified in this pass

- Protocol 578 is active and the proxy advertises 578.
- The 1.15.2 login, respawn, particle, chunk-biome, and spawn-packet layouts are decoded by the target codec.
- Native 1.15.2 tables contain 680 blocks, 11,337 states, 883 inventory items, 103 entity types, 768 recipes, native tags, and resource-pack format 5.
- A live connection to the supplied 1.15.2 server receives Join Game, light updates, and terrain chunks without decoder errors.
- Entity IDs now resolve from the active 1.15.2 registry. In particular, wire ID 95 is `zombie` and 96 is `zombie_horse`; the stale 1.14.4 table caused zombies to render as zombie horses.

## 1.15-specific matrix

| Wiki topic | Status | Evidence / remaining work |
| --- | --- | --- |
| Bees | **partial** | The native registry, living-mob classification, anger/nectar/stinger metadata, state textures, winged model and stinger visibility are wired. Native model extraction, grounded/flying/rolling animation and speed/anger-dependent flight audio are implemented and regression-tested. Bee AI, hive occupancy, breeding and stinging damage are server-owned; client-visible acceptance remains open. |
| Bee nests and beehives | **partial** | Blocks, states, models, tags, recipes and collision data exist. Honey-level state rendering and full-hive ambient drips are implemented. Bee storage, harvesting, campfire suppression and comparator output are server-owned; end-to-end outcome checks remain. |
| Honey blocks | **partial** | Native block/item data and models exist. Fall-damage reduction, movement damping, side sliding and slime/honey piston separation are wired; walking, half-strength jump and edge-slide bounds have native regression checks; broad live acceptance remains. |
| Honeycomb, honey bottles and bee spawn egg | **partial** | Items and creative entries exist and honey bottles are recognized as food. Bottle/shears use, poison removal, crafting remainders and spawn-egg behavior need checks. |
| Honey particles | **partial** | Native particle definitions and dripping/falling/landing dispatch are wired, including full-hive ambient drips; native stage lifetimes/colors/gravity, honey landing audio and statuses 53/54 are implemented. General particle collision accuracy remains open. |
| 1.15 commands, predicates and gamerules | **server-owned / partial** | The command tree is received. Client-side predicate semantics and dedicated 1.15 gamerule UI are not implemented; server behavior still needs acceptance tests. |
| 1.15 controls and food changes | **partial** | Generic use and movement code exists, but creative food behavior, immediate elytra glide, and all item-specific outcomes need target tests. |
| 1.15.1 dolphin/bubble-column change | **server-owned / unverified** | The client receives server state; no dedicated native spawning acceptance test exists. |
| 1.15.1 chunk/performance fixes | **partial** | Target chunk decoding works. No fair rendering benchmark or invalid-biome recovery test has certified parity. |
| 1.15.2 bee-nest generation and Silk Touch anger rule | **server-owned / unverified** | Requires live world-generation and interaction scenarios; the client has no integrated server. |
| 1.15.2 effect stacking | **partial** | Effects are displayed and received, but replacement/restore sequencing needs a live amplifier test. |
| 1.15.2 `gui_light` item models | **partial** | Model inheritance now carries `gui_light` into item rendering and front-lit icons suppress side shading; held/builtin lighting still needs visual acceptance tests. |
| 1.15.2 multiplayer disclaimer and session-specific title | **implemented / tested** | Native warning text/coordinates, persisted opt-out and multiplayer session window title are implemented. |
| 1.15.2 rendering and bug fixes | **partial** | Native 1.15.2 constructors now extract 90 model variants, including BeeModel, with native quad UVs. Visual validation covers all mob adapters and texture references. Animation comparison remains open. The listed wiki fixes require individual acceptance tests. |

## Conclusion

The zombie identity bug is fixed, and the first client-side bee/honey slice is implemented, but the requested full parity claim would still be false. Bee AI, hive storage, world generation, predicates and gamerules are server responsibilities. The remaining client work is visual and interaction acceptance for these server outcomes, remaining entity animation acceptance, particle collision fidelity and server-driven interaction outcomes. Seeded biome zoom now matches 100 native Java oracle cases; the multiplayer warning/title and bee/honey slices are implemented. Native model extraction is complete; full parity is still unverified. See [the repair review](repair-review-2026-10-27.md) for current evidence and outstanding checks.

## Reproduce

```sh
node tools/port-1.15.2/runtime-data.mjs
node --test tools/test-1.15.2-bootstrap.mjs tools/test-1.15.2-runtime.mjs
```

Current changes and shared-backport scope: [native parity repairs](parity-repairs-2026-10-27.md).
