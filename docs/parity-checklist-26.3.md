# Full-parity checklist: 26.3

Generated from [transition-26.3.tasks.json](transition-26.3.tasks.json). Updated 2026-11-27.

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
| Native item stacks (P04) | All 115 wire components decode with verified readers; every stack gets defaults from the native 1658-item report table, patch additions/removals are preserved through adapted slots, and native shapes drive tooltips, consumable actions, equippable slots, tool-rule mining speeds and harvest checks (470 native tool-required blocks); nested templates in bundle/container/charged-projectile components are adapted to decorated stacks. Click hashing for patched stacks belongs to P08. |

## Partial

| Area | Open part |
| --- | --- |
| P02 extraction | Native blocks, items, collision/selection shapes, block offsets, the sound/particle registries and the 40-entry mob-effect registry are installed from the 26.3 jar (including `breath_of_the_nautilus` id 39, colour 65518, beneficial, no attribute modifiers). The biome and enchantment tables are now native: 67 biomes including `dappled_forest`, `pale_garden` and `sulfur_caves`, and 43 enchantments in the native alphabetical registry order including the new `lunge` (id 21), with native costs, slots and effects. The food table is also native: 44 foods, including the four edible fish buckets and without the ominous bottle. The 16 tool rule tag families used by item components are generated from the jar's 300 block tag files, with nested tags expanded (`sword_efficient` includes leaves), and the 470 blocks whose native default state requires the correct tool are dumped from the registry for harvest checks. The entity table is now native too: 161 EntityTypes in registry order with native widths, heights, eye heights and MobCategory; the remaining client table (recipes) is still the older generation. |
| P06 Play path | All 144 inbound IDs decode with bytecode-verified bodies (0 raw) and 120 have adapters; a live join decodes 81 chunks and 26 entities with zero skipped frames; server chat, titles, pickups, boss bars and teleports render, while the sound, cooldown and mob-effect frames are byte-gated and socket-verified against the real server. Container windows open through the native menu registry id (the 26.3 order matches 766 exactly), chat messages can be deleted by packed signature, the server brand reaches its handler, and commands, player-list updates, server data, difficulty, entity events, section block updates, world particles, ticking state, border initialisation, the death-screen message, the scoreboard/team families, merchant offers, tags and debug samples are wired to their existing handlers, the recipe family decodes natively (the live burst's `update_recipes` and `recipe_book_add` frames consume exactly), statistics decode through the native 26.3 stat registry, minecart steps and tracked waypoints decode, tracked waypoints drive the native locator bar, and respawn resolves the dimension-type holder instead of treating its registry id as a name. The last four debug value/event frames decode through the native 16-entry debug-subscription registry and 15 value codecs; only dedicated_server_tick_time's null value codec stays fail-closed. Open: remaining outbound sender coverage. |
| P08 inventory/interaction | Serverbound bodies are native and live-accepted (click state id 1 -> 2 with the stack moved, attack removes a pig after 8 hits). The Creative catalog is now extracted from the pinned 26.3 client for all eight feature masks (2034 stacks, 405 component patches), the serverbound creative slot carries the native raw patch, and `HashedStack.create` supplies the native `HashedPatchMap` hashes that `writeHashedStack26_3` round-trips byte-for-byte for all 405 patched stacks; `creative-data:26.3 --check` and `test-creative-26.3.mjs` pin both. Open: general hashing for arbitrary server-provided component values (catalog stacks are covered) and live acceptance of the merchant/enchanting/stonecutter/loom menus (screens exist). |
| P10 resources | 26.3 equipment now samples `entity/equipment/humanoid/<asset>.png` and `humanoid_leggings/<asset>.png` through the native `equippable.assetId`; trims use native material/pattern ids, `item/<item>_<material>_trim` models and generated palettes, with the blocks atlas synthesizing `trims/items/*_trim` permutations (verified in-browser with all four armor pieces and the iron_darker override); the smithing screen uses native `container/slot/*` sprites and template icons (including nautilus armor and spear). Open: full GUI visual acceptance. |
| P12 particles | All 128 particle types and their 22 data StreamCodecs decode in entity metadata; the join decode-error count went 56 -> 0. Vibration's block and entity PositionSource branches decode to arrival ticks, and `level_particles` dispatches through `on_world_particles`. Wolf wet-shake/interested-head, splash and powered dragon/piglin head animation use the upstream formulas, pinned against the 26.3 jar by `test-wolf-shake-1.20.6.mjs` and `test-skull-animation-26.3.mjs`. Open: per-behaviour live trigger and rendering acceptance. |
| P13 screens/HUD | Player-list hearts use native `HealthState` blink/catch-up and `hud/heart/*` sprites; below-name objectives lift name tags only within 10 blocks; the smithing screen is 26.3-native; the title screen follows the native 26.3 rows (Friends/language/accessibility icon row, Options/Quit below), splash offset and two-second widget fade. The dialog screen presents both `show_dialog` holder branches for notice/confirmation/multi_action/dialog_list/server_links, uses native common/button/action fields and compact plain-message bodies, runs static and custom click actions, and routes `clear_dialog` through the same screen. Unit checks: `test-name-tags.mjs`, `test-tab-hearts-1.20.6.mjs`, `test-smithing-26.3.mjs`, `test-title-26.3.mjs`, `test-dialog-26.3.mjs`. Server-link buttons are populated from the last `server_links` packet, including the native known-type labels. Inputs cover text (including multiline), boolean checkboxes, number-range sliders and single-option cycles; dynamic command templates substitute their values and dynamic custom actions merge their NBT tags. Item bodies draw their item icon, the title-row warning button opens the native Back/Disconnect warning, and styled plain-message segments keep their click actions and show-text tooltips. Open: live visual acceptance. |

## Missing (inherited from 1.20.6)

Inventory action edge cases, authenticated sessions, resource packs/fonts beyond defaults, chat/commands
families, several presentation families, and the inherited 1.19.4 gaps. These are carried by P14 and are
not closed by the version jump.

## Unverified

- The remaining outbound Play families (chat, commands, recipe book) and inventory edge cases such as
  shift-click into a full container and patched stacks in a click.
- Entity identities new to 26.3 (for example `minecraft:sulfur_cube`) spawn with the native 26.3 id,
  dimensions and mob category, but families 26.3 restructured still lack a native renderer rig (P10).
- The browser serves 26.3 assets (jar first, then the index) and bakes 26.3 block models, textures and the 26.3 panorama. Entity rigs for the families 26.3 restructured still come from 1.20.6 (P10).

## Out of scope

Integrated singleplayer/world creation and Realms remain separate missing products, exactly as on 1.20.6.
