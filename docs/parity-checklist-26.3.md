# Full-parity checklist: 26.3

Generated from [transition-26.3.tasks.json](transition-26.3.tasks.json). Updated 2026-11-26.

Full parity is **not** claimed. This checklist starts empty on purpose: a milestone enters it only with
acceptance evidence from a native run, not because a table or model exists.

## Accepted

| Area | Scope accepted |
| --- | --- |
| Native inputs (P00) | SHA-1 and size match for metadata, client and server; embedded version identity (protocol 777, world 5023, packs 97.1/121.0, Java 25); unobfuscated layout proven. |
| Native reports (P02) | Reproducible blocks/items/components/registries/commands/packets reports recorded in `tools/port-26.3/baseline.json`; every phase contiguous from zero. |
| Native protocol probe (P05) | A real 26.3 server reports protocol 777 and accepts the offline login → Set Compression → Login Success → Login Acknowledged → Configuration sequence with correct compressed framing (`npm run probe:26.3`). |
| Native login/configuration bytes (P03) | Seven captured native frames decode with the client's Reader and Login Success round-trips exactly; 26.3's added session UUID is asserted rather than ignored. |
| Play Login decode (P06) | The captured Play Login (id 50) parses to typed fields with zero trailing bytes and a plausible spawn: three levels, overworld dimension, sea level 63. |
| Graphical join (P07) | Chrome reached a disposable 26.3 server, rendered terrain, 81 chunks, sky, grass, the full HUD and live mobs (pigs, sheep, cows, chickens, bats, villagers, glow squid) at sane coordinates. Movement was server-accepted, a zombie kill led to a working respawn, and repeated reconnects returned to Play. |

## Partial

| Area | Open part |
| --- | --- |
| P02 extraction | Native blocks, items, collision/selection shapes and block offsets are installed from the 26.3 jar. The remaining client tables (biomes, effects, enchantments, entities, foods, particles, sounds, recipes, creative) are still the older generation. |
| P06 Play path | 82 of 144 inbound IDs decode with bytecode-verified bodies and 60 have adapters; a live join decodes 81 chunks and 26 entities with zero skipped frames, server chat, titles, pickups and teleports render. Open: recipe/advancement/map/boss families and the dialog packets. |
| P08 inventory/interaction | Serverbound bodies are native and live-accepted (click state id 1 -> 2 with the stack moved, attack removes a pig after 8 hits). Open: patched-item HashedPatchMap hashing, creative slots, merchant/enchanting/stonecutter/loom menus. |
| P12 particles | All 128 particle types and their 22 data StreamCodecs decode in entity metadata; the join decode-error count went 56 -> 0. Open: particle rendering and `level_particles` consumers; vibration stays fail-closed. |
| P04 items | ItemStack/Template/patch decode from the javap layout and 83 of 115 wire components have verified readers. Live: damaged and custom-named gear, enchantments, potions, chest and bundle contents. Open: 32 fail-closed component readers (attribute_modifiers, profile, item-modifier records) and click hashing for patched stacks (only empty HashedPatchMap patches are writable). |

## Missing (inherited from 1.20.6)

Inventory action edge cases, authenticated sessions, resource packs/fonts beyond defaults, chat/commands
families, several presentation families, and the inherited 1.19.4 gaps. These are carried by P14 and are
not closed by the version jump.

## Unverified

- The remaining outbound Play families (chat, commands, recipe book) and inventory edge cases such as
  shift-click into a full container and patched stacks in a click.
- Entity identities new to 26.3 (for example `minecraft:sulfur_cube`) spawn but fall back to an unknown-object
  identity because the entity table and models are still the 1.20.6 generation (P10).
- The browser still loads 1.20.6 model/texture bundles, so 26.3-only blocks have no baked models yet (P10).

## Out of scope

Integrated singleplayer/world creation and Realms remain separate missing products, exactly as on 1.20.6.
