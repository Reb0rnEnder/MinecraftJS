# 1.15.2 feature audit — 2026-10-26

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
| Bees | **partial** | The native registry, living-mob classification, anger/nectar/stinger metadata, state textures, winged model and stinger visibility are wired. Bee AI, pollen/hive occupancy, breeding, stinging damage and native model extraction remain gaps. |
| Bee nests and beehives | **partial** | Blocks, states, models, tags, recipes and collision data exist. Honey levels, block entities, bee storage, harvesting, campfire suppression and comparator output are not implemented end to end. |
| Honey blocks | **partial** | Native block/item data and models exist. Fall-damage reduction, movement damping, side sliding and slime/honey piston separation are wired; jump/collision edge cases and live checks remain. |
| Honeycomb, honey bottles and bee spawn egg | **partial** | Items and creative entries exist and honey bottles are recognized as food. Bottle/shears use, poison removal, crafting remainders and spawn-egg behavior need checks. |
| Honey particles | **partial** | Native particle definitions and dripping/falling/landing dispatch are wired, including full-hive ambient drips; exact vanilla trajectories and all block-state conditions still need live checks. |
| 1.15 commands, predicates and gamerules | **server-owned / partial** | The command tree is received. Client-side predicate semantics and dedicated 1.15 gamerule UI are not implemented; server behavior still needs acceptance tests. |
| 1.15 controls and food changes | **partial** | Generic use and movement code exists, but creative food behavior, immediate elytra glide, and all item-specific outcomes need target tests. |
| 1.15.1 dolphin/bubble-column change | **server-owned / unverified** | The client receives server state; no dedicated native spawning acceptance test exists. |
| 1.15.1 chunk/performance fixes | **partial** | Target chunk decoding works. No fair rendering benchmark or invalid-biome recovery test has certified parity. |
| 1.15.2 bee-nest generation and Silk Touch anger rule | **server-owned / unverified** | Requires live world-generation and interaction scenarios; the client has no integrated server. |
| 1.15.2 effect stacking | **partial** | Effects are displayed and received, but replacement/restore sequencing needs a live amplifier test. |
| 1.15.2 `gui_light` item models | **partial** | Model inheritance now carries `gui_light` into item rendering and front-lit icons suppress side shading; held/builtin lighting still needs visual acceptance tests. |
| 1.15.2 multiplayer disclaimer and session-specific title | **missing** | The browser client retains the inherited menu flow and does not implement the Java disclaimer/title behavior. |
| 1.15.2 rendering and bug fixes | **partial** | Bees have a target-specific fallback model, but the packaged-class model extractor is not yet ported and the branch still uses the verified inherited bundle for other entities. The listed wiki fixes require individual acceptance tests. |

## Conclusion

The zombie identity bug is fixed, and the first client-side bee/honey slice is implemented, but the requested full parity claim would still be false. The largest remaining release-specific gap is bee AI and hive behavior, followed by native 1.15 model extraction and the 1.15.2 UI/model changes. The next implementation milestone should be hive harvesting/block-entity behavior and live bee acceptance tests before closing these rows.

## Reproduce

```sh
node tools/port-1.15.2/runtime-data.mjs
node --test tools/test-1.15.2-bootstrap.mjs tools/test-1.15.2-runtime.mjs
```
