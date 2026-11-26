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

## Partial

| Area | Open part |
| --- | --- |
| P02 extraction | Native blocks, items, collision/selection shapes and block offsets are installed from the 26.3 jar. The remaining client tables (biomes, effects, enchantments, entities, foods, particles, sounds, recipes, creative) are still the older generation. |
| P07 graphical join | Terrain, 81 chunks, sky, tall grass and the full HUD render in Chrome against a disposable 26.3 server, and the session survives the keepalive window. Entity rendering, movement, death/respawn and reconnect are still unverified. |

## Missing (inherited from 1.20.6)

Inventory action edge cases, authenticated sessions, resource packs/fonts beyond defaults, chat/commands
families, several presentation families, and the inherited 1.19.4 gaps. These are carried by P14 and are
not closed by the version jump.

## Unverified

- Entity rendering: `add_entity` and entity metadata are not adapted yet, so no mob or item entity has been drawn.
- Movement input, death/respawn, reconnect and inventory interaction in the browser.
- The browser still loads 1.20.6 model/texture bundles, so 26.3-only blocks have no baked models yet (P10).

## Out of scope

Integrated singleplayer/world creation and Realms remain separate missing products, exactly as on 1.20.6.
