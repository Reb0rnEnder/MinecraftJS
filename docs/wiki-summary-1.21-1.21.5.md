# Minecraft Java Edition 1.21–1.21.5 Wiki Technical Summary

Source analysis of the six official Minecraft Wiki release history pages fetched directly from `minecraft.wiki` and cached under [cache/port-1.21.11/wiki/](file:///home/ender/minecraftjs-1.21.11/cache/port-1.21.11/wiki/).

## 1. Version Matrix & Source Verification

| Version | Official Name | Release Date | Protocol Version | Data Version | Resource Pack Format | Data Pack Format | Min Java |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| **1.21** | Tricky Trials | 2024-06-13 | `767` | `3953` | `34` | `48` | Java SE 21 |
| **1.21.1** | *(Hotfix)* | 2024-08-08 | `767` | `3955` | `34` | `48` | Java SE 21 |
| **1.21.2** | Bundles of Bravery | 2024-10-22 | `768` | `4080` | `42` | `57` | Java SE 21 |
| **1.21.3** | *(Hotfix)* | 2024-10-23 | `768` | `4082` | `42` | `57` | Java SE 21 |
| **1.21.4** | The Garden Awakens | 2024-12-03 | `769` | `4189` | `46` | `61` | Java SE 21 |
| **1.21.5** | Spring to Life | 2025-03-25 | `770` | `4325` | `55` | `71` | Java SE 21 |

### Cached HTML Checksums & Integrity

All six fetches returned full article HTML (`<title>Java Edition 1.21[.x] – Minecraft Wiki</title>`, no challenge/403 pages):

| Version | Source URL | Cached HTML | Bytes | SHA-256 |
| --- | --- | --- | ---: | --- |
| 1.21 | https://minecraft.wiki/w/Java_Edition_1.21 | [Java_Edition_1.21.html](file:///home/ender/minecraftjs-1.21.11/cache/port-1.21.11/wiki/Java_Edition_1.21.html) | 954,688 | `0f9a623b945677d54bbd896ca8763a1f1bdad27274f6c38f2a7653c367ab1eb4` |
| 1.21.1 | https://minecraft.wiki/w/Java_Edition_1.21.1 | [Java_Edition_1.21.1.html](file:///home/ender/minecraftjs-1.21.11/cache/port-1.21.11/wiki/Java_Edition_1.21.1.html) | 280,006 | `1f9915cd8e6aafe08d1929a0fd329a3a4c3f681caa9d0c7acc38f77faebef2ac` |
| 1.21.2 | https://minecraft.wiki/w/Java_Edition_1.21.2 | [Java_Edition_1.21.2.html](file:///home/ender/minecraftjs-1.21.11/cache/port-1.21.11/wiki/Java_Edition_1.21.2.html) | 593,691 | `c643bd4cb28b5468bdf03db7d066312fafea991d609b16f19e29f3df6737afec` |
| 1.21.3 | https://minecraft.wiki/w/Java_Edition_1.21.3 | [Java_Edition_1.21.3.html](file:///home/ender/minecraftjs-1.21.11/cache/port-1.21.11/wiki/Java_Edition_1.21.3.html) | 278,844 | `afcf083d225863e2f9da75df93b66cf62d8b091992b17c617828869a3bfdaf3e` |
| 1.21.4 | https://minecraft.wiki/w/Java_Edition_1.21.4 | [Java_Edition_1.21.4.html](file:///home/ender/minecraftjs-1.21.11/cache/port-1.21.11/wiki/Java_Edition_1.21.4.html) | 449,192 | `236fd8b40db0c1c87559e2d43f582f0c2db5bf21ffd99dcbd655465c10e6277e` |
| 1.21.5 | https://minecraft.wiki/w/Java_Edition_1.21.5 | [Java_Edition_1.21.5.html](file:///home/ender/minecraftjs-1.21.11/cache/port-1.21.11/wiki/Java_Edition_1.21.5.html) | 620,483 | `a16e20cfaf6a34abca8349e6509b6759e646c495478690706b1fb0152fd899ea` |

### Source Coverage & Gaps Not Detailed in Top-Level Release Pages

These six release summary pages document feature, data-component, registry, shader, model, and high-level protocol additions, but do **not** enumerate full wire-level binary packet tables. Specifically, the following wire-level / low-level items are **absent or only indirectly referenced** in these six HTML files and must be verified against the target JAR's generated reports (`packets.json`, `registries.json`) and/or wiki snapshot / `Protocol_version` articles:
- Exact packet IDs, field-by-field binary layouts, and packet splits/renames (such as `player_position`, `sync_entity_position`, `move_minecart_along_track`, `recipe_book_add`, or `ClientboundUpdateRecipesPacket` payload internals beyond the MC-258971 note in 1.21.2).
- Chunk `Heightmaps` wire encoding changes (not mentioned in these six release articles).
- Exact `SynchedEntityData` / entity metadata numeric field IDs and serializers per release.
- `pack.mcmeta` `overlays` format details (none of these six release pages document changes to `pack.mcmeta` overlays).

---

## 2. High-Level Breaking Changes Summary (1.21–1.21.5)

| Area | Release(s) | Key Breaking Client / Protocol / Asset Changes |
| --- | --- | --- |
| **Protocol & Network** | 1.21, 1.21.2, 1.21.4, 1.21.5 | **1.21**: clientbound `custom_report_details` & `server_links` (`configuration` & `game` states). **1.21.2**: serverbound `client_tick_end`; tab-list custom ordering index; client Particles option sent to server; `strictErrorHandling` removed. **1.21.4**: serverbound `minecraft:player_loaded` sent after terrain loading screen closes (join & respawn). **1.21.5**: clientbound `player_chat` adds sequential `index` (disconnect on mismatch); serverbound `chat` & `chat_command_signed` add `last_seen` checksum byte (`0` disables). |
| **Text Components** | 1.21.4, 1.21.5 | **1.21.4**: added `shadow_color` style field. **1.21.5**: text components in NBT/item components/commands are no longer JSON wrapped in strings — inlined directly; `hoverEvent` -> `hover_event` (with inlined `contents` / `value` / `uuid`+`id`); `clickEvent` -> `click_event` (`url`, `command`, positive int `page`); strict URI/command parsing. |
| **Attributes** | 1.21, 1.21.2 | **1.21**: modifiers drop `uuid`+`name` for namespaced `id`; operations become strings (`add_value`, `add_multiplied_base`, `add_multiplied_total`); 10 new attributes. **1.21.2**: `generic.`, `player.`, `zombie.` prefixes stripped from all attribute IDs; `tempt_range` added. |
| **Item Components** | 1.21–1.21.5 | **1.21**: `jukebox_playable`, `food.using_converts_to`, `ominous_bottle_amplifier`. **1.21.2**: `consumable`, `damage_resistant` (replaces `fire_resistant`), `death_protection`, `enchantable`, `equippable`, `glider`, `item_model`, `repairable`, `tooltip_style`, `use_cooldown`, `use_remainder`; `food` stripped to stats only; `item_name` always present; `potion_contents.custom_name`; `lock` -> item predicate. **1.21.4**: `custom_model_data` split into `floats`/`flags`/`strings`/`colors`; `equippable.model` -> `asset_id`. **1.21.5**: `blocks_attacks`, `break_sound`, `potion_duration_scale`, `provides_banner_patterns`, `provides_trim_material`, `tooltip_display` (replaces `hide_tooltip`, `hide_additional_tooltip`, and all `show_in_tooltip` fields), `weapon`; `tool.can_destroy_blocks_in_creative`; `equippable.equip_on_interact` + `saddle` slot; top-level inlining of `attribute_modifiers`, `can_place_on`, `can_break`, `dyed_color`, `enchantments`, `stored_enchantments`; 24 entity/wolf variant components. |
| **Item Models & Assets** | 1.21.2, 1.21.4, 1.21.5 | **1.21.2**: equipment textures moved to `textures/entity/equipment/<layer>/` + `models/equipment/<id>.json`; trim armor textures split to `trims/entity/humanoid(_leggings)`; `light_emission` on block model elements; `broken` override on all items. **1.21.4 (CRITICAL)**: new `assets/<ns>/items/<id>.json` item model definitions (`model`, `composite`, `condition`, `range_dispatch`, `select`, `empty`, `bundle/selected_item`, `special`, `hand_animation_on_swap`, tint sources); `overrides` removed; `models/item/*` block redirects removed; `models/equipment/` -> `equipment/`; empty slot sprites moved/renamed to `gui/sprites/container/slot/*`; `broken_elytra` -> `elytra_broken`. **1.21.5**: `dry_foliage` colormap; unique spawn egg textures per mob (`spawn_egg.png`/`spawn_egg_overlay.png` removed); `sheep_fur` -> `sheep_wool`; `temperate_`/`cold_`/`warm_` pig, cow (new snout/mirrored legs), chicken textures; saddle equipment layers; `paletted_permutations.separator` in atlases. |
| **Shaders** | 1.21, 1.21.2, 1.21.5 | **1.21**: `blend` block removed; `position_color_tex`, `glint_direct`, `armor_glint` removed; `breeze_wind` added. **1.21.2**: major refactor — `defines` preprocessor values/flags, `attributes` removed, `ChunkOffset` -> `ModelOffset`, `Time` -> `GameTime`, `lightmap` shader, `post_effect` dir replaces `shaders/post`, `rendertype_entity_glint_direct`/`rendertype_entity_translucent_cull` removed, UI uses `position_tex_color`, shared `terrain`/`entity` shaders. **1.21.5**: core & post shader JSON program definitions removed (only `.vsh`/`.fsh` remain); `post_effect` references `vertex_shader`/`fragment_shader` directly with typed `uniform`s; global uniforms auto-filled in any shader. |
| **Entities & Registries** | 1.21–1.21.5 | **1.21**: data-driven `enchantment`, `jukebox_song`, `painting_variant`; plural datapack folders -> singular (`recipe`, `advancement`, `tags/item`, etc.). **1.21.2**: `boat`/`chest_boat` split into per-wood entity types; `instrument` & `trial_spawner` registries; `crafting_transmute` recipe & simplified recipe ingredients. **1.21.5**: `potion` entity split into `splash_potion` and `lingering_potion`; entity `ArmorItems`/`HandItems`/`body_armor_item`/`Saddle` unified into `equipment` + `drop_chances`; `cat_variant`, `frog_variant`, `pig_variant`, `cow_variant`, `chicken_variant`, `wolf_sound_variant` data-driven with `spawn_conditions`; `wolf_variant` grouped under `assets`. |

---

## 3. Java Edition 1.21 — *Tricky Trials* (June 13, 2024)

**Version Pins:** Protocol `767` | Data `3953` | Resource Pack `34` | Data Pack `48` | Java SE 21 (first major release requiring 64-bit OS & Java 21+).

### Protocol / Network / Client-Server Changes
- **New clientbound packets (`configuration` and `game`/Play phases):**
  - `custom_report_details`: list of key-value text entries appended to crash and disconnection reports generated while connected to the server.
  - `server_links`: list of built-in or custom link labels/URLs shown in a new **"Server Links..."** pause menu button (moving "Report Bugs" / "Give Feedback" into a sub-screen if needed). Built-in `report_bug` link also appears on packet-handling disconnection screens and in disconnection reports.
- **Disconnection screen:** Client can save detailed disconnection reports and show **"Open Disconnection Report Directory"** and server bug-report link buttons.
- **Packet reporting:** Report data generator now outputs network packet metadata.
- **Portals & dimension transitions:**
  - Thrown ender pearls can teleport players across dimensions through portals.
  - Players riding entities can travel through portals without portal delay.
  - Custom base attributes are kept on respawn; active effects and modifiers are kept when changing dimensions or winning the game.
- **Fixes affecting client/protocol state:** Fixed MC-124177 (losing client states on dimension change), MC-268113 (`generic.scale` desync exiting End), MC-269574 (client attributes desync exiting End), MC-170907 (network position deltas relative to wrong point), MC-267838 (projectile yaw rotation interpolation flickering), MC-272073 (billboard item display rotation bug), MC-271353 (recipe book UI flickering), MC-270779 (`/data` crash on large block data), MC-271001 (container count > 99 crash).

### Item Components, Attributes, Enchantments & Data Format
- **Item components:**
  - Added `jukebox_playable` (`{song: <id>, show_in_tooltip: <bool, default true>}`; replaces `hide_additional_tooltip` for music disc song names).
  - `food` component adds optional `using_converts_to` (item with components).
  - `custom_data` component accepts SNBT strings in JSON to preserve NBT types.
  - `ominous_bottle_amplifier` component set by new `set_ominous_bottle_amplifier` loot function.
  - `/give`, `/item`, `/loot` support `!component` prefix to remove default components.
- **Attributes (breaking ID & modifier format change):**
  - Modifier `uuid` + `name` replaced by single namespaced `id` (unique per attribute; existing custom modifiers upgraded to `minecraft:<uuid>`).
  - Entity NBT `Attributes` -> `attributes` (`Name`->`id`, `Base`->`base`, `Modifiers`->`modifiers` with `amount` and string `operation`: `add_value` [0], `add_multiplied_base` [1], `add_multiplied_total` [2]).
  - `generic.attack_knockback` now works on players.
  - Added 10 attributes: `generic.burning_time` (def 1, 0..1024), `generic.explosion_knockback_resistance` (def 0, 0..1), `player.mining_efficiency` (def 0, 0..1024), `generic.movement_efficiency` (def 0, 0..1), `generic.oxygen_bonus` (def 0, 0..1024), `player.sneaking_speed` (def 0.3, 0..1), `player.submerged_mining_speed` (def 0.2, 0..20), `player.sweeping_damage_ratio` (def 0, 0..1), `generic.water_movement_efficiency` (def 0, 0..1). *(Wiki lists 9 new attributes + `attack_knockback` player support).*
- **Data-driven registries & directory renames:**
  - Enchantments (`data/<ns>/enchantment/`), Enchantment Providers, `jukebox_song` (`data/<ns>/jukebox_song/<id>.json`), and `painting_variant` (`data/<ns>/painting_variant/<id>.json` referencing `asset_id` in paintings atlas) are now data-driven.
  - Datapack plural folders renamed to singular (`structures`->`structure`, `advancements`->`advancement`, `recipes`->`recipe`, `loot_tables`->`loot_table`, `predicates`->`predicate`, `item_modifiers`->`item_modifier`, `functions`->`function`, `tags/functions`->`tags/function`, `tags/items`->`tags/item`, `tags/blocks`->`tags/block`, `tags/entity_types`->`tags/entity_type`, `tags/fluids`->`tags/fluid`, `tags/game_events`->`tags/game_event`, `decorated_pot_patterns`->`decorated_pot_pattern`).
  - Removed `music_discs` item tag.
- **Projectile NBT:** `power` replaced by `acceleration_power`; arrow-like projectiles store `weapon` item stack instead of `ShotFromCrossbow`.

### Asset / Resource Pack / Shader / UI Changes
- **Resource pack format:** `34`.
- **Textures, models & audio assets:**
  - New textures/models for `breeze` and `wind_charge` (promoted from experimental to stable), `bogged`, trial chamber blocks, 20 new paintings, 3 music discs, 3 pottery sherds, 2 armor trims (`bolt`, `flow`), 2 banner patterns (`flow`, `guster`), mace, breeze rod, trial keys, ominous bottle.
  - **Bad Omen** effect icon changed to shadowy design + new application sound.
  - Ominous trial spawner activation & ambient sound events renamed; piston sound volume lowered; 4 new cave ambience tracks (`Cave 20`–`Cave 23`); 9 new background/title-screen music tracks.
  - **Rarity tooltip color updates:** Trident -> Epic (purple); Snout banner pattern -> Uncommon.
- **Shaders:**
  - Added `breeze_wind` shader.
  - Removed `blend` block from core shader JSONs.
  - Removed `position_color_tex` (use `position_tex_color`), `glint_direct` (use `glint`), `armor_glint`.
- **Menus & UI:**
  - **Crafter UI:** 3×3 shared container screen with toggleable disabled slots (empty-hand click or hotbar-slot key) and non-takeable preview output slot, **no recipe book**.
  - **Title screen:** Panorama updated to Trial Chambers.
  - **Disconnection screen:** Report directory & server `report_bug` link buttons.
  - **Pause menu:** "Server Links..." button when server sends links.
  - **Realms main screen:** Displays online players with head+name hover tooltip.
  - **Social interactions:** Attestation checkbox on player report.
  - **Crash reports:** Memory unit changed from `MB` to `MiB`; includes temp directory sizes.

### New & Changed Content (Blocks, Items, Entities, Worldgen, Effects, Enchantments, Particles)
- **Blocks:**
  - Copper family (8 variants each: 4 oxidation levels × waxed/unwaxed): `chiseled_copper`, `copper_bulb` (light 15/12/8/4, redstone T flip-flop, comparator reads 15 when lit), `copper_door`, `copper_grate` (transparent, waterloggable), `copper_trapdoor`.
  - Tuff family: `polished_tuff` (+ stairs/slab/wall), `tuff_bricks` (+ stairs/slab/wall), `chiseled_tuff`, `chiseled_tuff_bricks`, `tuff_slab`, `tuff_stairs`, `tuff_wall`. *(Double doors of different materials now form double doors automatically).*
  - `crafter` (redstone auto-crafter, comparator 0–9), `heavy_core` (player-head size, 12 orientations, waterloggable, Epic rarity), `trial_spawner` & `ominous_trial_spawner` (blue glow, soul flames, equips mobs, drops potions/projectiles), `vault` & `ominous_vault` (per-player unlock state, open/closed keyhole, cycles display item inside cage, soul flames on ominous).
- **Items:**
  - `mace` (6 dmg, 0.6 attack speed, fall ≥1.5 blocks triggers smash attack negating fall damage with knockback & explosive particle/sound, extra sound/knockback >5 blocks, repaired with breeze rods).
  - `breeze_rod`, `wind_charge` (0.5s cooldown, activates redstone/non-iron doors/trapdoors/buttons/levers/bells/extinguishes candles), `ominous_bottle` (levels I–V, 100 min Bad Omen, stackable to 64), `trial_key`, `ominous_trial_key`, `trial_explorer_map`.
  - Music discs: `Precipice` (comp 13), `Creator` (comp 12), `Creator (Music Box)` (comp 11).
  - 20 new paintings (by Sarah Boeving & Kristoffer Zetterstrand: 1×1 `Meditative`, 1×2 `Prairie Ride`, 2×2 `Baroque`/`Humble`, 3×3 `Bouquet`/`Cavebird`/`Cotán`/`Endboss`/`Fern`/`Owlemons`/`Sunflowers`/`Tides`, 3×4 `Backyard`/`Pond`, 4×2 `Changing`/`Finding`/`Lowmist`/`Passage`, 4×4 `Unpacked`/`Orb`).
  - Pottery sherds: `flow`, `guster`, `scrape`. Banner patterns: `flow`, `guster`. Smithing templates: `bolt`, `flow` armor trims.
  - Potions & tipped arrows: `Infestation`, `Oozing`, `Weaving`, `Wind Charging`.
  - Spawn eggs: `bogged_spawn_egg`, `breeze_spawn_egg`.
- **Entities / Mobs:**
  - **Bogged:** 16 HP, 4.5s bow attack (Poison arrows), shearable mushrooms, spawns in swamps/mangrove swamps/trial spawners.
  - **Breeze:** 30 HP, leaping movement, shoots wind charges, deflects projectiles back toward shooter, drops 1–2 breeze rods.
  - **Wind charge (entity):** player/breeze projectile breaking decorated pots & chorus flowers.
  - **Boats** now leashable; **End crystals** fire-immune; **Primed TNT** travels through Nether portals.
- **Worldgen:** **Trial Chambers** (underground deepslate Overworld structure, `dimension_padding: 10`, `jigsaw.liquid_settings`).
- **Effects (6):** `Infested` (10% chance to spawn 1–2 silverfish on hurt), `Oozing` (spawns 2 slimes on death), `Weaving` (2–3 cobwebs on death + cobweb speed boost), `Wind Charged` (wind burst on death), `Raid Omen` (30s countdown before raid), `Trial Omen` (15m × Bad Omen level, converts trial spawners to ominous). Bad Omen no longer comes from raid captains; gained via Ominous Bottle.
- **Enchantments (3 mace-exclusive):** `Density` (I–V, +0.5 smash dmg/block/level), `Breach` (I–IV, -15% armor effectiveness/level), `Wind Burst` (I–III, ominous vaults only, launches attacker upward on smash). Fire Protection burning reduction & Blast Protection knockback resistance now stack across armor pieces.
- **Particles:** `trial_spawner_detection`, `ominous_trial_spawner_detection`, `gust`, `small_gust_emitter`, `large_gust_emitter`, `vault_connection`.
- **Advancements (8):** `Minecraft: Trial(s) Edition`, `Crafters Crafting Crafters`, `Lighten Up`, `Who Needs Rockets?`, `Under Lock and Key`, `Revaulting`, `Blowback`, `Over-Overkill`.

---

## 4. Java Edition 1.21.1 (August 8, 2024)

**Version Pins:** Protocol `767` (compatible with 1.21 servers) | Data `3955` | Resource Pack `34` | Data Pack `48` | Java SE 21.

### Client-Visible & Security Changes
- **Languages:** Added `Tzotzil` and `Belarusian (Latin)`.
- **Security / Exploit Fixes:**
  - Fixed exploit allowing modified clients to crash servers via stack exhaustion when requesting command completion for a malicious target selector.
  - Fixed block entity swap update suppression exploit.
- **Client Fixes:**
  - MC-260689: Fixed player arm spinning while swimming with a loaded crossbow in the offhand.
  - MC-254899: Sitting/standing a tamed cat now triggers `minecraft:player_interacted_with_entity`.

---

## 5. Java Edition 1.21.2 — *Bundles of Bravery* (October 22, 2024)

**Version Pins:** Protocol `768` | Data `4080` | Resource Pack `42` | Data Pack `57` | Java SE 21.

### Protocol / Network / Client-Server Changes
- **New serverbound Play packet:** `minecraft:client_tick_end` — sent by the client when finishing each client tick.
- **Tab list ordering:** Servers can override player ordering in the tab list via a non-negative integer sorting index (highest to lowest).
- **Client options synced to server:** Client now sends the state of its **Particles** limiter setting to the server.
- **Removed server option:** `strictErrorHandling` removed (client no longer has temporary option to ignore connection errors); `spawn-animals` and `spawn-npcs` removed; added `pause-when-empty-seconds` (default 60) and `text-filtering-version` (default 0).
- **Hardcore protocol/state alignment:** World's hardcore mode now consistently controls both respawn eligibility and informing the client (hearts texture / death screen / forced Hard difficulty).
- **Bundle item selection & Creative throttling:**
  - Scroll wheel selects item inside a bundle; icon updates to show selected item poking out; pressing use throws/takes selected stack.
  - Rapid item dropping in Creative inventory is throttled.
- **Protocol bugfixes noted:** MC-258971 (`ClientboundUpdateRecipesPacket` breaking on multiple recipes with big tags), MC-259376 (`ServerboundMovePlayerPacket` invalid `xRot`), MC-273914 (avoid unnecessary client option packets), MC-272506 (fast server switching disconnect), MC-274030 (item count > 99 kick in Creative).

### Item Components, Attributes, Recipes & Data Format
- **New Item Components (11):**
  - `minecraft:consumable`: `{consume_seconds (1.6), animation (none|eat|drink|block|bow|spear|crossbow|spyglass|toot_horn|brush), sound, has_consume_particles, on_consume_effects: [{type: apply_effects|remove_effects|clear_all_effects|teleport_randomly|play_sound}]}`.
  - `minecraft:damage_resistant`: `{types: "#<damage_type_tag>"}` (replaces removed `minecraft:fire_resistant`).
  - `minecraft:death_protection`: `{death_effects: [...]}` (same effect types as `on_consume_effects`).
  - `minecraft:enchantable`: `{value: <positive int>}`.
  - `minecraft:equippable`: `{slot (head|chest|legs|feet|body|mainhand|offhand), equip_sound, model (equipment model id), allowed_entities, dispensable, swappable, damage_on_hurt, camera_overlay}`.
  - `minecraft:glider`: `{}` (allows elytra gliding when equipped).
  - `minecraft:item_model`: `<namespaced id>` (initially referenced `assets/<ns>/models/item/<id>`, then superseded in 1.21.4 by `assets/<ns>/items/<id>.json`).
  - `minecraft:repairable`: `{items: <id | #tag | list>}`.
  - `minecraft:tooltip_style`: `<namespaced id>` (uses `gui/sprites/tooltip/<id>_background` and `_frame`).
  - `minecraft:use_cooldown`: `{seconds, cooldown_group}`.
  - `minecraft:use_remainder`: `{id, count, ...}` (remainder item stack if count drops on use).
- **Changed / Removed Item Components:**
  - `minecraft:fire_resistant` **removed** (replaced by `damage_resistant`).
  - `minecraft:food` stripped to nutrition/saturation stats only (`eat_seconds`, `using_converts_to`, `effects` removed — moved to `consumable` & `use_remainder`).
  - `minecraft:item_name` is now **always present** on every item.
  - `minecraft:potion_contents` gains `custom_name` string (`item.minecraft.<item>.effect.<value>`).
  - Display name priority order changed: `written_book_content.title` > `custom_name` > `potion_contents.custom_name` > `item_name`.
  - `minecraft:lock` and container `Lock` -> `lock` changed to an **item predicate** (`items`, `count`, `components`, `predicates`).
- **Attributes:**
  - **Breaking:** Stripped `generic.`, `player.`, and `zombie.` prefixes from all attribute IDs!
  - Added `tempt_range` attribute.
- **Recipes:**
  - Added `crafting_transmute` (preserves components across dyed bundles/shulker boxes); removed `crafting_special_shulkerboxcoloring` and `crafting_special_suspiciousstew` (suspicious stew & shulker coloring now appear in recipe book).
  - **Breaking recipe ingredient format:** `{ "item": "<id>" }` -> `"<id>"`, `{ "tag": "<id>" }` -> `"#<id>"`; `smithing_transform`/`smithing_trim` `template`/`base`/`addition` became optional (reverted in 1.21.5 for `base`/all).
- **Particle Color Standardization:** RGB/ARGB particle fields (`trail.color`, `dust.color`, `dust_color_transition.from_color`/`to_color`) accept either `[R,G,B(,A)]` float vector or packed `RGB`/`ARGB` int.
- **Entity ID Split & Other Breaking Data Changes:**
  - `boat` and `chest_boat` entity IDs split into 18 separate entity types (`oak_boat`..`bamboo_raft`, `oak_chest_boat`..`bamboo_chest_raft`); `minecraft:boat` entity sub-predicate removed.
  - Entity x-rotation clamped to `[-90, 90]`.
  - Data-driven `instrument` (goat horns) and `trial_spawner` registries; `painting_variant` adds `author`/`title` text components.
  - Removed `bundle` feature flag/datapack.

### Asset / Resource Pack / Shader / UI & HUD Changes
- **Resource pack format:** `42`.
- **Equipment & Trim Texture Reorganization (BREAKING):**
  - Equipment textures moved under `textures/entity/equipment/`:
    - Armor `<material>_layer_1.png` -> `textures/entity/equipment/humanoid/<material>.png`; `layer_2` -> `humanoid_leggings/<material>.png` (`leather_layer_1/2_overlay` -> `leather_overlay`).
    - `wolf_armor` / `wolf_armor_overlay` -> `textures/entity/equipment/wolf_body/armadillo_scute(_overlay).png`.
    - `turtle_layer_1` -> `turtle_scute`.
    - Llama decor -> `textures/entity/equipment/llama_body/`; Horse armor -> `textures/entity/equipment/horse_body/`; Elytra -> `textures/entity/equipment/wings/elytra.png`.
  - New **equipment models** at `assets/<ns>/models/equipment/<path>.json` (`wolf_body`, `horse_body`, `llama_body`, `humanoid`, `humanoid_leggings`, `wings`, with `texture`, `dyeable`, `use_player_texture`). *(Moved to `equipment/` in 1.21.4).*
  - Armor trims moved from `textures/trims/models/armor` to `textures/trims/entity/humanoid` & `humanoid_leggings` (dropped `_leggings` suffix), plus trims work on any equipment model layer (e.g. `wolf_body`).
- **Models, Sprites & Item Visuals:**
  - Block model elements support optional `light_emission` (`0`–`15`).
  - All item models can use `broken` override predicate (value `1` when durability == 1).
  - Updated textures/models/UVs: redstone torch (inverted model uses 6 faces), repeaters/comparators, arrow & bee stinger texture maps, dragon egg UV, blaze rod bottom texture.
  - Bee nests/beehives at max honey show "full" texture in inventory/hand & show honey/bees in tooltip.
  - Enchanted shields & horse armor & wolf armor & llama carpets render enchantment glint (shield uses reduced armor glint).
  - Unique item textures for every banner pattern; banner patterns & smithing templates moved pattern/template type into item name with subtitle.
  - Bundle updated textures/models, bundle UI scaling, `container/bundle/slot_background`, `container/bundle/slot_highlight_front` & `_back`.
  - Custom tooltips (`tooltip/background`, `tooltip/frame`) and slot highlights (`container/slot_highlight_front` & `_back`).
  - `nine_slice` GUI sprite scaling gains `stretch_inner` boolean (default `false`).
  - Deprecated translation renames/removals in `/assets/minecraft/lang/deprecated.json` applied at startup.
- **Shaders (Major Refactor):**
  - Core shader JSONs add `defines` (`values`, `flags`), remove `blend` and `attributes` (`Position` always bound), and require namespaced `vertex`/`fragment` IDs.
  - Removed `rendertype_entity_glint_direct` (use `rendertype_entity_glint`) and `rendertype_entity_translucent_cull` (use `rendertype_item_entity_translucent_cull`).
  - Shared `terrain.fsh/.vsh` (cutout, solid, cutout_mipped, translucent, tripwire) and `entity.fsh/.vsh`; `rendertype_clouds` drops cloud texture sampler; UI elements use `position_tex_color` instead of `position_tex`.
  - Added `lightmap` shader with 9 uniforms (`AmbientLightFactor`, `SkyFactor`, `BlockFactor`, `UseBrightLightmap`, `SkyLightColor`, `NightVisionFactor`, `DarknessScale`, `DarkenWorldFactor`, `BrightnessFactor`).
  - `ChunkOffset` -> `ModelOffset`; post `Time` -> `GameTime`; `#moj_import <<ns>:<program>>` absolute path support.
  - Post-processing configs moved `shaders/post` -> `post_effect`; shader programs moved `shaders/program` -> `shaders/post`; JSON changed (`program`, merged `inputs` with `target`/`use_depth_buffer`/`location`/`bilinear`, `output`, `targets` map, `minecraft:translucent`/`item_entity`/`particles`/`weather`/`clouds`/`entity_outline` external targets).
- **UI / HUD / Options:**
  - **Oxygen bar:** empty air bubble texture, drowning wobble animation, popping sound rising in pitch as air runs out.
  - **Recipe book:** Space/Enter repeats last recipe; shulker coloring & suspicious stew recipes added.
  - **Rarity overhaul:** dozens of items re-categorized across Common, Uncommon, Rare, Epic.
  - **Debug screen:** removed `B` value in `E` row.
  - **Options:** Video **"Reduce FPS when"** (`AFK` [default: 30fps after 1m, 10fps after 9m/minimized] | `Minimized`); Accessibility **"Increase block outline contrast"**.
  - **Languages:** Added `High Norwegian`.

### New Content & Gameplay Changes
- **Items:** **Bundle** (craftable: 1 string + 1 leather; 16 dyed colors; nested bundles cost 4 + contents; max 64-item weight; 3-row/12-item tooltip grid; scroll-to-select & drop-stack), `field_masoned_banner_pattern`, `bordure_indented_banner_pattern`.
- **Mobs:** Baby variants for Dolphin, Squid, Glow Squid; Small / Medium / Large Salmon variants.
- **Sounds:** Unique `spawner` sound type (`block.spawner.break/place/hit/fall/step`), oxygen bubble pop, bundle fail-to-insert.
- **Particles:** Added `block_crumble` (`block_state`) and `trail` (`color`, `target`).
- **Gameplay:** Ender pearls load/tick 3×3 chunks & save/unload with owner; sneaking on slime blocks negates fall damage; carved pumpkin hides player map marker; portal cooldown reduced (0.5s carts/boats, 0.1s projectiles); projectiles collide/bounce with world border; mace smash death messages.
- **Experimental packs added:** `Minecart Improvements` (`minecartMaxSpeed`, rotation-follow option), `Redstone Experiments`, and `Winter Drop` (early preview of Pale Garden, Pale Oak, Creaking Heart, Creaking).

---

## 6. Java Edition 1.21.3 (October 23, 2024)

**Version Pins:** Protocol `768` (compatible with 1.21.2 servers) | Data `4082` | Resource Pack `42` | Data Pack `57` | Java SE 21.

### Changes & Fixes
- **Mobs:** Any small salmon upgraded from pre-1.21.2 or 1.21.2 is upgraded to the medium variant (fixing MC-277779).
- **Critical Hotfix:** Fixed MC-277791 (joining a Realm with a Resource Pack enabled failed with an error).

---

## 7. Java Edition 1.21.4 — *The Garden Awakens* (December 3, 2024)

**Version Pins:** Protocol `769` | Data `4189` | Resource Pack `46` | Data Pack `61` | Java SE 21.

### Protocol / Network / Client-Server Changes
- **New serverbound Play packet:** `minecraft:player_loaded` — sent by the client when the loading terrain screen closes after initial world load and after respawning.
- **Client CLI:** `client.jar` gains `net.minecraft.client.data.Main --client` to generate `assets`; `server.jar` `net.minecraft.data.Main` drops `--client`.
- **Spawn / respawn immunity removed:** Players no longer get 3 seconds of damage immunity upon joining, respawning, or loading in.
- **Pick block:** Now works on entities in Survival and Adventure mode (MC-65931).
- **Fixes affecting rendering/state sync:** Fixed MC-277754 (corner chunks desync), MC-277892 (stonecutter ghost item), MC-278102 (recipe book multi-recipe indicator), MC-191431 / MC-186105 / MC-111516 / MC-71990 (tab-list hat layer), MC-265033 / MC-277499 (empty slot sprites), MC-277959 (translucency sorting), MC-278257 (oxygen bar animation).

### Asset / Resource Pack Changes — CRITICAL 1.21.4 Item Model Definition Rewrite
- **Resource pack format:** `46`.
- **`assets/<namespace>/items/<id>.json` replaces hardcoded item models & `overrides`:**
  - Items with `minecraft:item_model=<ns>:<path>` resolve to `/assets/<ns>/items/<path>.json` containing `{"model": {"type": ..., ...}, "hand_animation_on_swap": <bool, default true>}`.
  - Block model `overrides` section **removed**.
  - No hardcoded paths in `models/` — models are loaded only if referenced from `items/` or `blockstates/`. Redirect-only files in `models/item/` were removed (point directly to `models/block/`).
  - **Item model types (`type`):**
    - `minecraft:model` (`model`, `tints`)
    - `minecraft:composite` (`models`)
    - `minecraft:condition` (`property`, `on_true`, `on_false`)
    - `minecraft:range_dispatch` (`property`, `scale`, `entries: [{threshold, model}]`, `fallback`) — replaces `overrides`
    - `minecraft:select` (`property`, `cases: [{when, model}]`, `fallback`)
    - `minecraft:empty`
    - `minecraft:bundle/selected_item`
    - `minecraft:special` (`model`, `base`)
  - **Special model types:** `minecraft:banner` (`color`), `minecraft:bed` (`texture`), `minecraft:chest` (`texture`, `openness`), `minecraft:conduit`, `minecraft:decorated_pot`, `minecraft:hanging_sign` (`wood_type`, `texture`), `minecraft:head` (`kind`, `texture`, `animation`), `minecraft:shield`, `minecraft:shulker_box` (`texture`, `openness`, `orientation`), `minecraft:standing_sign`, `minecraft:trident`.
  - **Boolean properties:** `broken`, `bundle/has_selected_item`, `carried`, `custom_model_data` (`index`), `damaged`, `extended_view`, `fishing_rod/cast`, `has_component` (`component`, `ignore_default`), `keybind_down` (`keybind`), `selected`, `using_item`, `view_entity`.
  - **Numeric properties:** `bundle/fullness`, `compass` (`target`: `spawn|lodestone|recovery|none`, `wobble`), `cooldown`, `count` (`normalize`), `crossbow/pull`, `custom_model_data` (`index`), `damage` (`normalize`), `time` (`source`: `daytime|moon_phase|random`, `wobble`), `use_cycle` (`period`), `use_duration` (`remaining`).
  - **Discrete/string properties:** `block_state` (`block_state_property`), `charge_type` (`none|rocket|arrow`), `context_dimension`, `context_entity_type`, `custom_model_data` (`index`), `display_context` (`none|thirdperson_*|firstperson_*|head|gui|ground|fixed`), `local_time` (ICU `locale`, `time_zone`, `pattern`), `main_hand` (`left|right`), `trim_material`.
  - **Tint sources:** `constant`, `custom_model_data`, `dye`, `firework`, `grass` (`temperature`, `downfall`), `map_color`, `potion`, `team`.
- **Other Critical 1.21.4 Asset / GUI / Entity Rendering Changes:**
  - `models/equipment/` directory moved up to **`equipment/`**.
  - `broken_elytra` model & texture renamed to **`elytra_broken`**.
  - **Empty slot GUI sprites** moved & renamed into `gui/sprites/container/slot/`:
    - `empty_armor_slot_{helmet,chestplate,leggings,boots}` -> `{helmet,chestplate,leggings,boots}`
    - `empty_slot_{sword,pickaxe,axe,shovel,hoe}` -> `{sword,pickaxe,axe,shovel,hoe}`
    - `empty_slot_smithing_template_{armor_trim,netherite}` -> `smithing_template_{armor_trim,netherite_upgrade}`
    - `empty_slot_{amethyst_shard,diamond,emerald,ingot,lapis_lazuli,quartz,redstone_dust}` -> `{amethyst_shard,diamond,emerald,ingot,lapis_lazuli,quartz,redstone_dust}`
    - Loom: `container/loom/{banner,pattern,dye}_slot` -> `container/slot/{banner,banner_pattern,dye}`
    - Brewing stand split out: `container/slot/brewing_fuel`, `container/slot/potion`
    - Horse/llama split out: `container/horse/{armor,llama_armor,saddle}_slot` -> `container/slot/{horse_armor,llama_armor,saddle}`
  - **Block entities + normal block models:** Blocks that previously rendered only block entities (banners, heads, beds, chests, conduits, decorated pots, shulker boxes, signs) now **also render their normal block model** over/with the block entity.
  - **Nine-slice UI sprites:** `toast/system`, `toast/tutorial`, `advancements/box_obtained`, `advancements/box_unobtained` updated to nine-slice scaling.
  - **Textures & models:** Nether bricks (normal/chiseled/cracked/red) texture updated; magma cube UV updated; non-top-level block models `cross_emissive` & `flower_pot_cross_emissive` added; new `trims/color_palettes/resin` palette; invalid `filled_map` in item frame (no `map_id`) no longer enlarges frame.
  - **Unifont** updated to 16.0.01.
  - **Title screen:** Panorama updated to Pale Garden.

### Item Components, Text, Data & Commands
- **`minecraft:custom_model_data` expanded:** now `{floats: [...], flags: [...], strings: [...], colors: [...]}` (and `set_custom_model_data` item modifier updated).
- **`minecraft:equippable`:** `model` field renamed to **`asset_id`**.
- **Text format:** Added optional `shadow_color` (packed ARGB int or RGBA float array; `0` hides shadow).
- **Particles:** `trail` particle now requires `duration` (ticks).
- **Biome effects:** `music` is now a weighted list (empty = no music); added `music_volume` for smooth transitions.
- **Data pack format:** `61`; removed `winter_drop` feature flag; removed `trim_material.item_model_index`; renamed furnace NBT (`CookTime`->`cooking_time_spent`, `CookTimeTotal`->`cooking_total_time`, `BurnTime`->`lit_time_remaining`, added `lit_total_time`) and TNT minecart `TNTFuse`->`fuse` + `explosion_speed_factor`.
- **Tooltip security:** Spawn eggs for operator-command entities and `block_entity_data` items with operator commands show non-hideable warning tooltips; `block_entity_data` only applies if `id` matches block type.

### New Content & Gameplay
- **Blocks:** `creaking_heart`, `eyeblossom` (`closed_eyeblossom`, `open_eyeblossom` with emissive eye texture & day/night transitions), `pale_hanging_moss`, `pale_moss_block`, `pale_moss_carpet`, `pale_oak_leaves` (gray `pale_oak_leaves` particles), full Pale Oak wood set (log/stripped/wood/stripped_wood/planks/stairs/slab/fence/fence_gate/door/trapdoor/pressure_plate/button/sign/hanging_sign/sapling), `resin_clump` (multi-face, waterloggable), `resin_block`, `resin_bricks` (+ chiseled/stairs/slab/wall). *(Bell, lanterns, iron/copper doors, pressure plates, brewing stand now drop with any tool; ender chest drops obsidian with wrong tool).*
- **Items:** `resin_brick` (armor trim material), `creaking_spawn_egg`, `pale_oak_boat`, `pale_oak_chest_boat`.
- **Mob:** **Creaking** (spawns at night from active Creaking Heart, 3 dmg, freezes when looked at by Survival/Adventure player without carved pumpkin, invulnerable to normal damage while heart exists, emits particle trail to heart & exudes resin clumps on heart when hit; spawn-egg Creaking has 1 HP; visible eyes when invisible).
- **Worldgen:** **Pale Garden** biome (desaturated grass, smoky gray sky, pale light blue water, fades out music, ambient blocks); **Pale Oak** 2×2 trees; **Pale Moss Patch**; woodland mansion chests can contain resin clumps.
- **Gameplay:** Water Breathing & Conduit Power regenerate oxygen underwater; elytra opening ends sprint; suspicious stew durations matched to Bedrock; mob equipment pickup logic updated + preferred/disliked weapon tags; experience orbs bounce when falling; Popoloca language added.

---

## 8. Java Edition 1.21.5 — *Spring to Life* (March 25, 2025)

**Version Pins:** Protocol `770` | Data `4325` | Resource Pack `55` | Data Pack `71` | Java SE 21.

### Protocol / Network Changes
- **Chat desync / ordering checks:**
  - Clientbound `player_chat` packet adds a sequential `index` starting at `0` on login / configuration reset and incrementing by `1` per message; client disconnects on unexpected index.
  - Serverbound `chat` and `chat_command_signed` packets add a checksum byte over the `'last seen'` signatures (`0` disables check for translation proxies).
- **Debug CLI:** Client accepts `--renderDebugLabels` to add OpenGL debug labels.

### Text Component NBT Format (BREAKING)
- **No longer JSON strings inside NBT:** Text components embedded in NBT, item components (e.g. `minecraft:custom_name={text:'Renamed item'}`), and command arguments (`/tellraw @s {text:'Hello world'}`, `/title`, `/scoreboard`) are stored directly as inline SNBT/NBT structures rather than JSON wrapped in a string.
- **`interpret: true` NBT text components** parse NBT directly instead of serializing to JSON string first.
- **Note on booleans in NBT text components:** NBT lacks distinct boolean vs integer types, so translation boolean args must use strings.
- **Snake_case Hover & Click Events:**
  - `hoverEvent` -> **`hover_event`**:
    - `show_text`: `contents` -> `value`.
    - `show_item`: `contents` inlined to top level (`id`, `count`, ...); `text` -> `value`.
    - `show_entity`: `contents` inlined; `id` -> `uuid`; `type` -> `id`.
  - `clickEvent` -> **`click_event`**:
    - `open_url`: `value` -> `url` (must be valid `http://` or `https://` URI or fails to parse).
    - `run_command`: `value` -> `command` (disallowed chars fail parse; leading `/` no longer required).
    - `suggest_command`: `value` -> `command` (disallowed chars fail parse).
    - `change_page`: `value` -> `page` (now **positive integer** instead of string).
    - `copy_to_clipboard`: unchanged.

### Item Components, Entity Data & Data Pack Changes
- **7 New Item Components:**
  - `blocks_attacks`: `{block_delay_seconds (0), bypassed_by (#tag), damage_reductions ([{type, base, factor, horizontal_blocking_angle (90)}]), disable_cooldown_scale (1), item_damage ({threshold, base, factor}), block_sound, disable_sound}`.
  - `break_sound`: `<sound event>` (now present by default on all item types).
  - `potion_duration_scale`: `<non-negative float, default 1.0>` (scales `potion_contents` including `custom_effects`).
  - `provides_banner_patterns`: `#<banner_pattern_tag>` (allows use in Loom pattern slot).
  - `provides_trim_material`: `<trim_material_id>` (used in smithing trimming; `trim_material` registry no longer specifies `item`).
  - `tooltip_display`: `{hide_tooltip (false), hidden_components ([])}` — **replaces** `hide_tooltip`, `hide_additional_tooltip`, and `show_in_tooltip` fields.
  - `weapon`: `{item_damage_per_attack (1), disable_blocking_for_seconds (0)}`.
- **24 New Entity & Variant Components** (transferred from spawn eggs/buckets/paintings/item frames to spawned entity):
  - `axolotl/variant`, `cat/collar`, `cat/variant` (`cat_variant` registry), `chicken/variant` (`chicken_variant`), `cow/variant` (`cow_variant`), `fox/variant`, `frog/variant` (`frog_variant`), `horse/variant`, `llama/variant`, `mooshroom/variant`, `painting/variant`, `parrot/variant`, `pig/variant` (`pig_variant`), `rabbit/variant`, `salmon/size`, `sheep/color`, `shulker/color`, `tropical_fish/base_color`, `tropical_fish/pattern`, `tropical_fish/pattern_color`, `villager/variant`, `wolf/collar`, `wolf/variant`, `wolf/sound_variant` (`wolf_sound_variant` registry).
  - Creative buckets/paintings & tooltips for tropical fish buckets / paintings use these components instead of `entity_data` / `bucket_entity_data`.
- **Inlined / Removed / Updated Item Components:**
  - **Inlined to top level & removed `show_in_tooltip`:** `attribute_modifiers` (`[...]`), `can_place_on` / `can_break` (single predicate or list `[...]`), `dyed_color` (int or `[R,G,B]` float array), `enchantments` / `stored_enchantments` (`{id: lvl}`).
  - **Removed `show_in_tooltip`:** `jukebox_playable`, `trim`, `unbreakable`.
  - **Removed components:** `hide_additional_tooltip`, `hide_tooltip` (use `tooltip_display`).
  - **`equippable`:** supports `saddle` slot; any mob can equip `body` slot if `allowed_entities` permits; added `equip_on_interact` boolean (default `false`).
  - **`tool`:** added `can_destroy_blocks_in_creative` boolean (default `true`).
  - `custom_name`, `potion_contents`, `potion_duration_scale` also transfer from spawning item / lingering potion to entity / area effect cloud.
  - `toggle_tooltips` loot function supports any component ID for `tooltip_display`.
- **Entity Equipment, Slots & Format Overhaul (BREAKING):**
  - Item slot `horse.saddle` renamed to **`saddle`**, supports any `#can_equip_saddle` mob and applies attribute modifiers.
  - `ArmorItems`, `HandItems`, `body_armor_item`, and pig/strider `Saddle` merged into **`equipment`** map (`head`, `chest`, `legs`, `feet`, `mainhand`, `offhand`, `body`, `saddle`; also stores player armor & offhand); `ArmorDropChances`, `HandDropChances`, `body_armor_drop_chance` merged into **`drop_chances`** map.
  - `potion` entity type **split** into `splash_potion` and `lingering_potion`.
  - Entity `custom_data` supported on all entities (`data` field); `FallDistance` -> `fall_distance` (double); `SleepingX/Y/Z` -> `sleeping_pos`; `TileX/Y/Z` -> `block_pos`; `AX/AY/AZ` -> `anchor_pos`; `HomePosX/Y/Z` -> `home_pos`; `BoundX/Y/Z` -> `bound_pos`; `SpawnX/Y/Z/Angle/Dimension/Forced` -> `respawn`; `enteredNetherPosition` -> `entered_nether_pos`; `CustomDisplayTile` removed on minecarts.
  - 15 legacy entity sub-predicates (`axolotl`, `wolf`, `pig`, etc.) removed in favor of `components`/`predicates`; `minecraft:sheep.color` removed.
- **Recipes & Data Pack (`71`):**
  - `crafting_transmute` `result` supports `{id, count, components}`.
  - `smithing_transform` `base` is required again; `smithing_trim` `base`, `template`, `addition` required again + added `pattern` field (trim pattern registry no longer defines item).
  - Lodestone recipe changed from netherite ingot to iron ingot.
  - Added `test_environment` & `test_instance` registries and `/test` command; SNBT expanded (heterogeneous lists, hex/binary/underscore/E-notation numbers, `bool()`, `uuid()`, unicode escapes, trailing commas).

### Asset / Resource Pack / Shader / UI & HUD Changes
- **Resource pack format:** `55`.
- **Spawn Eggs (BREAKING):**
  - Removed generic `spawn_egg.png` and `spawn_egg_overlay.png`.
  - Every mob now has its own unique shaped/textured spawn egg icon (with Programmer Art textures also added).
- **Dry Foliage:**
  - Added dry foliage colormap texture (`dry_foliage`) + `dry_foliage_color` biome effect field.
- **Mob Textures, Models & Variants:**
  - **Sheep:** `sheep_fur` renamed to **`sheep_wool`**; dyed sheep undercoat also colored; biome-dependent natural sheep wool colors.
  - **Pig:** `pig` renamed to `temperate_pig` (resized) + added `cold_pig` and `warm_pig`; `pig_saddle` resized.
  - **Cow & Mooshroom:** `cow` renamed to `temperate_cow` (resized, updated model with **extruded snout** and **mirrored legs**) + added `cold_cow` and `warm_cow`; mooshroom textures resized.
  - **Chicken:** `entity/chicken.png` moved to `entity/chicken/temperate_chicken.png` + added `cold_chicken` and `warm_chicken`.
  - **Saddle equipment layers & moved/split textures:** Added `pig_saddle`, `strider_saddle`, `camel_saddle`, `horse_saddle`, `donkey_saddle`, `mule_saddle`, `skeleton_horse_saddle`, `zombie_horse_saddle` equipment layers under `entity/equipment/<type>/saddle.png` (split from camel/horse/donkey/mule/skeleton/zombie horse base textures, moved from `entity/pig/` & `entity/strider/`). Saddles on horses/camels stay visible under Invisibility, don't flash red on damage, show enchantment glint, and support Thorns/Curse of Binding.
  - **Data-driven variant definitions:** Added `cat_variant`, `frog_variant`, `pig_variant`, `cow_variant`, `chicken_variant` (with `spawn_conditions`: `biome`, `moon_brightness`, `structure` + priority), and `wolf_variant` updated to group `angry`/`tame`/`wild` inside `assets` + `spawn_conditions`. *(Wiki notes changing these datapack variant definitions is flagged experimental).*
  - **Wolf sound variants:** 6 new variants (`Big`, `Cute`, `Puglin`, `Angry`, `Grumpy`, `Sad`, plus `Classic`) in `wolf_sound_variant` registry.
- **Item Models, Atlases & Item Rendering:**
  - Item model `select` property gains `minecraft:component` (unrecognized registry entries silently ignored); `condition` property gains `minecraft:component`.
  - Atlas `minecraft:paletted_permutations` gains optional `separator` string (default `_`).
  - **Item display & dropped item entity rendering:** `firstperson_lefthand` and `thirdperson_lefthand` match hand rendering; ground item hover height accounts for model size; ground stack renders flat if model Z-depth `< 1/16` block, otherwise 3D cluster.
  - Filled maps without `map_id` no longer show "Unknown Map" tooltip.
- **Particles & Shaders:**
  - `tinted_leaves` particle adds `color` parameter (packed int or 4-float array); all leaf blocks (`oak`..`flowering_azalea`) now emit falling leaf particles.
  - **Shaders (BREAKING):** Removed core shader & post-processing shader program JSON files (only `.vsh`/`.fsh` remain). `post_effect` JSON replaces `program` with `vertex_shader` & `fragment_shader`, requires `type` on each `uniform` (`int`, `ivec3`, `float`, `vec2`, `vec3`, `vec4`, `matrix4x4`), and makes `values` optional. Any shader can declare global uniforms (`ModelViewMat`, `ProjMat`, `TextureMat`, `ScreenSize`, `ColorModulator`, `Light0_Direction`, `Light1_Direction`, `GlintAlpha`, `FogStart`, `FogEnd`, `FogColor`, `FogShape`, `LineWidth`, `GameTime`, `ModelOffset`).
- **UI, HUD, Audio & Menus:**
  - **Beacon beams** render beyond 16 chunks up to client render distance, thicken with distance, and reach **2048** blocks high (up from 1024).
  - **Crossbow & Firework tooltips:** Crossbows display all charged projectiles; identical repeated projectiles/stars compact cleanly.
  - **Creative Spawn Eggs tab icon:** Changed from pig spawn egg to creeper spawn egg.
  - **Title screen:** Panorama updated to Spring to Life.
  - **Narrator:** Volume now scales with the Voice sound category.
  - **Sounds:** Desert/badlands/pale garden ambient block sounds moved from `Blocks` to `Ambient/Environment` category; iron block/bars/door/trapdoor/heavy weighted pressure plate get new sounds (`block.sand.idle`, `block.sand.wind` added); pistons breaking blocks play break sound; grass breaking sound lowered.
  - **Fullscreen startup reset:** Resets fullscreen option if previous startup crashed/failed to complete.

### New & Changed Content
- **Blocks (9):** `leaf_litter` (smelted from any leaves), `wildflowers`, `bush`, `firefly_bush` (glowing firefly particles at light ≤13), `cactus_flower`, `short_dry_grass`, `tall_dry_grass`, `test_block` (`start|log|fail|accept`), `test_instance_block`. `creaking_heart` gets distinct dormant texture; creaking hearts & eyeblossoms use fixed day time.
- **Items (2):** `blue_egg` (cold chicken), `brown_egg` (warm chicken) — usable in cake/pumpkin pie recipes.
- **Mobs & Worldgen:** Cold & warm variants of **Pig**, **Cow**, **Chicken**; **Camel** spawns naturally in deserts; **Fallen trees** (oak/spruce/birch/jungle); **Woodland mansions** can generate in Pale Garden (which occupies more Dark Forest area); **Cartographer** (7 new village/structure explorer maps) & **Wandering Trader** (buying trades, log trades, adjusted prices) moved out of experimental into normal gameplay.
- **Language:** Added `Kyrgyz`.
