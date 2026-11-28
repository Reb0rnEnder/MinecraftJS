# Minecraft Wiki Summary: Java Edition 1.21.6 – 1.21.11

Source authority: official Minecraft Wiki (`minecraft.wiki`) pages fetched via direct HTTP (`curl -4 -fsSL -A "MinecraftJS-Port/1.0"`), cached in `cache/port-1.21.11/wiki/` and verified free of challenge/CAPTCHA pages (`mw-content-text` present in every file).

## Version & Pack Format Matrix

Baseline before this range: **1.21.5** (Spring to Life, Mar 25, 2025) — Protocol `770`, Resource Pack `55`, Data Pack `71`, Java SE 21.

| Version | Official Name | Release Date | Protocol | Data Version | Resource Pack | Data Pack | Min Java | Server Compat |
| --- | --- | --- | ---: | ---: | --- | --- | --- | --- |
| **1.21.6** | Chase the Skies | June 17, 2025 | `771` | `4435` | `63` | `80` | Java SE 21 | Incompatible with 1.21.5 |
| **1.21.7** | — (hotfix) | June 30, 2025 | `772` | `4438` | `64` | `81` | Java SE 21 | Incompatible with 1.21.6 |
| **1.21.8** | — (hotfix) | July 17, 2025 | `772` | `4440` | `64` | `81` | Java SE 21 | Compatible with 1.21.7 |
| **1.21.9** | The Copper Age | September 30, 2025 | `773` | `4554` | `69.0` | `88.0` | Java SE 21 | Incompatible with 1.21.8 |
| **1.21.10** | — (hotfix) | October 7, 2025 | `773` | `4556` | `69.0` | `88.0` | Java SE 21 | Compatible with 1.21.9 |
| **1.21.11** | Mounts of Mayhem | December 9, 2025 | `774` | `4671` | `75.0` | `94.1` | Java SE 21 | Incompatible with 1.21.10 |

Notes on `1.21.11` & pack versions:
- `1.21.11` also shipped an experimental **`1.21.11 Unobfuscated`** (`1.21.11_unobfuscated`) distribution alongside the obfuscated release (last obfuscated version, last `1.x.y` version, last Java 21 requirement before `26.1`).
- Starting in `1.21.9` (snapshots `25w31a`+ / DP `82`+ / RP `65`+), `pack_format` gained **minor versions** (`major.minor`, e.g., `69.0` / `88.0` in 1.21.9–1.21.10 and `75.0` / `94.1` in 1.21.11).
  - Minor increments within the same major version are backwards-compatible.
  - In `pack.mcmeta`: `supported_formats` (and `formats` on overlays) were **removed** when targeting newer formats (only required/allowed if declaring support for DP `< 82` or RP `< 65`), `pack_format` became optional (when targeting DP `>= 82` / RP `>= 65`), and required **`min_format`** and **`max_format`** fields were added (either `[major, minor]` or a single integer `N`, where `min_format: N` means `[N, 0]` and `max_format: N` means `[N, 0x7fffffff]`). Same applies to overlay entries.

---

## Client-Visible Changes by Release

### 1.21.6 — Chase the Skies (Protocol 771)

- **Locator Bar & Waypoints**
  - HUD overlay replacing the experience bar when at least one unhidden player is present on a server and XP is not actively being gained (toggled by `locatorBar` gamerule, enabled by default on servers).
  - Driven by clientbound Play `waypoint` (`0x88` in 1.21.11; `0 = track`, `1 = untrack`, `2 = update`; UUID or String identifier; `waypoint_style` ID; optional RGB bytes; payload type `Empty`, `Vec3i`, `Chunk`, or `Azimuth` float angle in radians).
  - Displays colored markers when camera faces within 120° of a waypoint, or animated `hud/locator_bar_arrow_up` / `hud/locator_bar_arrow_down` sprites (with `.mcmeta` animations) when above/below viewport. Uses team colors if entity belongs to a team; spectators are only visible to other spectators.
  - Players are hidden when crouching, wearing a mob head or carved pumpkin, or under Invisibility, or when `minecraft:waypoint_transmit_range` is `0` (receivers governed by `minecraft:waypoint_receive_range`, default `60,000,000` for players, `0`–`60,000,000`).
  - Resource pack `waypoint_style/<name>.json`: `near_distance` (default `128`), `far_distance` (default `332`, must be `> near_distance`), `sprites` array resolved under `textures/gui/sprites/hud/locator_bar_dot/`.
  - `/waypoint list` and `/waypoint modify <selector> (color <color>|hex <RRGGBB>|reset|style set <style>|reset)` commands.
- **Dialogs (Modal Custom Screens)**
  - Experimental UI system in both **Configuration** (`show_dialog` `0x12`, `clear_dialog` `0x11`, `custom_click_action` `0x08`) and **Play** (`show_dialog` `0x8A`, `clear_dialog` `0x89`, `custom_click_action` `0x41` in 1.21.11) phases, plus `/dialog show|clear`, `minecraft:dialog` synchronized registry (Play accepts ID or inline NBT; Configuration requires inline NBT).
  - Screen layout: Header with title + warning icon (opens custom-content explanation with Leave World option), scrollable Body (`minecraft:plain_message`, `minecraft:item`), Inputs (`minecraft:text` with optional `multiline`, `minecraft:boolean`, `minecraft:single_option`, `minecraft:number_range`), and Footer/Actions (`minecraft:notice`, `minecraft:confirmation`, `minecraft:multi_action`, `minecraft:server_links`, `minecraft:dialog_list`).
  - Size limits enforced: buttons/plain_message/text/single_option/number_range width `1..1024`; item body `width`/`height` `1..256` (`description.width` `1..1024`).
  - Behavior flags: `can_close_with_escape` (default `true`), `pause` (default `true`, pauses singleplayer), `after_action` (`close`, `none` only if `pause: false`, `wait_for_response` which shows "Waiting for Response" with a "Back" button enabled after 5s and unpauses singleplayer).
  - Click/submit actions: static text click events (`open_url`, `run_command`, `suggest_command`, `change_page`, `copy_to_clipboard`, `show_dialog`, `custom` — `open_file` excluded) plus dynamic `minecraft:dynamic/run_command` (`$(key)` SNBT-escaped macro substitution) and `minecraft:dynamic/custom` (compound NBT of all inputs + `additions`).
  - **Quick Actions** keybind (default `G`) reads `#minecraft:quick_actions` dialog tag; **Pause menu** `#minecraft:pause_screen_additions` dialog tag replaces the Server Links button (falls back to `minecraft:server_links` dialog if `server_links` packet was received and tag is empty/unspecified).
  - Clicking `run_command` in chat/books/dialogs now prompts a **confirmation dialog** if the command cannot be parsed or requires permission level > 0 (command graph nodes gained `0x20 Is restricted` flag).
- **Happy Ghast, Ghastling, Dried Ghast & Harness**
  - `Dried Ghast` block: 3 hydration states when waterlogged (~20 min to spawn a `Ghastling`; reverts if dried or mined).
  - `Ghastling` (20 HP, baby `happy_ghast`, lured/sped up with snowballs, follows players or `#followable_friendly_mobs` within 16 blocks, roams within 32 blocks of home).
  - `Happy Ghast` (`minecraft:happy_ghast`, 20 HP, 4×4 hitbox): equippable with 16 colored `Harness` items (`happy_ghast_body` equipment asset layer, `#can_equip_harness` / `#harnesses`, shearable without rider, `can_be_sheared` & `shearing_sound` on `minecraft:equippable`). Up to **4 riders** (pilot sits in front above face, goggles lower when ridden, remaining 3 clockwise around sides). Can be stood on like a shulker (stops moving and snaps to cardinal yaw when player stands on top). Uses `flying_speed` and `camera_distance` (default `4.0`, increases 3rd-person camera distance for ghast/happy ghast/ender dragon/giant) attributes.
  - **Leashes**: Rendered 2× thicker; mob-to-mob leashing (sneak-interact); quad-leash slackless harness/boat attachment under Happy Ghast (`Is leash holder` metadata); snapping distance increased from 10 to 12 blocks (center-to-center; 16 blocks for Happy Ghast); shears snip leashes (and unequip saddles, horse armor, harnesses, carpets); firework boost snaps player leashes.
  - Regular **Ghasts** received a higher-resolution texture matching Happy Ghast and drop the `"Tears"` music disc (Amos Roddy, comparator output 10) on fireball-deflect kills.
- **Shaders, Fog, Models, Text & Assets**
  - **Shader UBO Migration**: All core and post-process uniforms converted from loose opaque uniforms to uniform blocks (`Globals`, `Fog`, `Projection`, `DynamicTransforms`, `Lighting`, `CloudInfo` with new `CellSize`, `LightmapInfo`, `SamplerInfo` replacing `*Size`, plus per-pass config UBOs). Post-process `targets` gained `persistent` and `clear_color`.
  - **Fog Split**: Separated spherical environmental fog (`FogEnvironmentalStart/End`, `FogSkyEnd`, `FogCloudsEnd`) from cylindrical render-distance fog (`FogRenderDistanceStart/End`); removed `FOG_IS_SKY` and `FogShape`; fog now applies to 3D HUD elements (first-person hands/held items) and intensifies in rain.
  - **Sky & Clouds**: Added `stars` and `sky` core shaders; clouds extend to the horizon with an updated pattern, non-tintable `clouds.png`, dimension `cloud_height` field, and `Cloud Distance` video setting.
  - **Models & Atlases**: `mob_effects.png-atlas` merged into `gui.png-atlas` (effect sprites now support nine-slice/GUI scaling); added `minecraft:player_head` special item model (`minecraft:head` no longer reads `minecraft:profile`); added `oversized_in_gui` boolean to item model definitions; block model `elements[].rotation.angle` now allows any float in `[-45, 45]` instead of 22.5° steps; strict JSON parsing enforced everywhere; `.png.mcmeta` `blur` respected; panorama textures must be square and equal-sized.
  - **Text & Components**: Added `show_dialog` and `minecraft:custom` (`id`, optional `payload` string/NBT) `click_event` actions; `attribute_modifiers` gained `display` (`default`, `hidden`, `override`); `painting/variant` no longer accepts inline definitions.
  - **UI / Audio / Fonts / Controls**: Added `"UI"` sound category (plays while paused); `"Music Frequency"` (`Default`, `Frequent`, `Constant`) & `"Show Music Toast"` options (`icon/music_notes`, `toast/now_playing`); 5 new Amos Roddy tracks; sand/terracotta ambient sounds moved to dry grass (`block.sand.wind` -> `block.dry_grass.ambient`); `entity/leashknot/break*` -> `unleash*` & `place*` -> `leash*`; Friendly/Hostile sound source names -> `... Mobs`; `F3+V` prints client version; Unifont updated to `16.0.03` with `minecraft:include/unifont_pua`; Realms config screen tabbed.
  - **Combat / Projectiles**: Projectile target tolerance starts at `0` for 2 ticks, expanding by `0.05`/tick up to `0.3`; splash potion effect scales from closest hitbox-to-hitbox distance; firework rockets only boost while gliding; spectators follow entities across dimensions (stopping spectating).

### 1.21.7 (Protocol 772)

- Added `"Lava Chicken"` music disc (Hyper Potions; dropped by baby zombie riding a chicken when killed while mounted; comparator output 9) and `"Dennis"` 3×3 painting (Sarah Boeving).
- Fixed blindness/darkness fog failing underwater (`MC-298856`), happy ghast forward dismount pass-through (`MC-298919`), glowing sign text visibility (`MC-299017`), TTF glyph Z-order (`MC-298710`), close-range `text_display` z-fighting (`MC-298681`), `TextureAtlas` texture leaks (`MC-298898`), `ItemStackRenderState` memory leak (`MC-299071`), and Qualcomm/AMD GPU startup & rendering bugs.

### 1.21.8 (Protocol 772)

- Client-only graphics & stability hotfix (network-compatible with `1.21.7` servers): fixed Intel integrated graphics freezes, entity/block-entity/atlas corruption, `text_display` flickering, Gen11 shading errors, inverted/solid-color inventory item rendering (`MC-295947`, `MC-296107`, `MC-296585`, `MC-296908`, `MC-297784`, `MC-298903`, `MC-298908`), and AMD crash on invalid resource-pack shaders (`MC-299144`).

### 1.21.9 — The Copper Age (Protocol 773)

- **Copper Age Content**
  - **Copper Golem** (`minecraft:copper_golem`, 0.49×0.98 hitbox, 12 HP): spawns with carved pumpkin/jack o'lantern on copper block, inherits/advances oxidation (unless waxed; lightning cleans oxidation; turns into a poseable Copper Golem Statue block when fully oxidized, dropping held item), picks up up to 16 items from Copper Chests and sorts into matching wooden Chests/Trapped Chests, can have poppies planted on head by Iron Golems (shearable), opens doors.
  - **Blocks & Equipment**: `Copper Chest` (oxidizable/waxable, single/double), `Copper Golem Statue` (4 poses, comparator output, axe restores golem when unoxidized), `Copper Bars`, `Copper Chain` (vanilla `chain` renamed to `iron_chain`), `Copper Lantern`, `Copper Torch` (`copper_fire_flame` particle), oxidized/waxed `Lightning Rod` variants, `Shelf` (all wood types, stores/displays 3 centered item stacks using new `on_shelf` display transform, redstone-powered shelves connect up to 3 wide and swap 3/6/9 rightmost hotbar slots on interact, binary comparator output).
  - **Items**: Copper tools, Copper armor (`item.armor.equip_copper`), Copper nugget, Copper horse armor, updated colorblind-friendly Dye item icons.
- **Mannequin & Avatar Architecture**
  - Introduced `Avatar` entity base (shared by `Player` and `Mannequin`).
  - **`Mannequin`** (`minecraft:mannequin`, 0.6×1.8 hitbox, command-summonable living NPC with player model, skin layers, pose `standing`/`crouching`/`swimming`/`fall_flying`/`sleeping`, `main_hand`, `immovable`, configurable below-name `description` defaulting to `"NPC"` / `hide_description`, accepts `minecraft:profile`).
  - `minecraft:profile` & `minecraft:skull` no longer auto-resolve and mutate in-place: **Static** (has `properties`, or both `name`+`id`, or neither) vs **Dynamic** (only `name` OR `id`, resolved client-side on render with `"Dynamic"` tooltip label), plus new rendering overrides (`texture`, `cape`, `elytra`, `model` `wide`/`slim`). Added `/fetchprofile`.
- **Debug Screen, Debug Options & Debug Subscriptions**
  - Reworked F3 debug screen: works everywhere (including title/menus), reduced default clutter, new **Debug Options** screen (`F3+F6`, originally `F3+F5` in snapshots) with per-entry `Off` / `In F3` / `Always On` and `Default` / `Performance` presets; chunk borders/hitboxes/Octree moved into Debug Options; `-DMC_DEBUG_ENABLED` / `-DMC_DEBUG_PRINT_PROPERTIES` JVM debug flags preserved.
  - **Protocol Debug Subscriptions**: Replaced `debug_sample_subscription` with `debug_subscription_request` (Play S2C/C2S packets `0x1A`–`0x1D` `debug_block_value`, `debug_chunk_value`, `debug_entity_value`, `debug_event` covering 16 subscription types `0..15`).
- **Rendering, OpenGL, UI & Text**
  - **OpenGL 3.3 Core Profile**: GLSL bumped from `150` to `330`; fullscreen post/blit/lightmap vertex shaders replaced with `core/screenquad.vsh` (3 vertices via `gl_VertexID`, no `Position` attribute); removed `position_color*_lightmap` shaders; added `PER_FACE_LIGHTING` flag on `core/entity.vsh/fsh`; fixed ambient lighting on undersides of flat/hollow model cubes (armor, elytra, skin outer layers, skeletons, fins/wings); improved entity rendering order & offscreen particle culling; removed unused mipmaps on `armor_trims`, `banner_patterns`, `beds`, `chest`, `decorated_pot`, `shield_patterns`, `shulker_boxes`, `signs` atlases.
  - **End Flash**: End dimension now has skylight and periodic (every 30s, 5–19s duration) purple sky flashes (`environment/end_flash.png`, `weather.end_flash`); `"Hide Lightning Flashes"` renamed `"Hide Sky Flashes"`.
  - **Text `object` Component**: New inline 8×8 sprite component (`atlas` object type for sprites, `player` object type for 2D player faces with `hat` toggle; ignores bold & italic; `F3+S` inspects atlases).
  - **UI & Controls**: Chat drafts preserved on forced close (death/dialog) + option to always save drafts; cursor shape changes (`Allow Cursor Changes` in Mouse Settings); `"Show Subtitles"` -> `"Closed Captions"`; `"Voice/Speech"` -> `"Narrator/Voice"`; toggleable Attack/Use keybinds; multiple keybinds on same key work simultaneously; pack selection search boxes; tabbed Statistics screen; world loading screen shows player target chunks + progress bar; villager GUI result slot shifted 1px up; Server Code of Conduct screen during Configuration (`enable-code-of-conduct`); Minecraft Server Management Protocol (JSON-RPC 2.0 over WebSocket).
  - **World & Protocol Wire Changes**: Dimension-specific world borders; fixed spawn chunks removed; `Spawn Entity` & `Set Entity Velocity` switched velocity to **`LpVec3`**; `Set Default Spawn Position` gained `Dimension Name` + `Yaw` + `Pitch`; `Explosion` gained `Radius`, `Block Count`, `Block Particle Alternatives`; `dragon_breath`/`effect`/`instant_effect` optional parameters and required ARGB `Color` on `flash`.

### 1.21.10 (Protocol 773)

- Pure hotfix (network-compatible with `1.21.9` servers): fixed chunks failing to load while player is teleporting (`MC-302321`), repeating `/tp` (`MC-302405`), wind charge collisions (`MC-301916`), bubble column vertical launch bug, carpets blocking wall item-frame maps (`MC-302383`), and cobweb/piston item/entity clipping (`MC-211096`, `MC-278182`).

### 1.21.11 — Mounts of Mayhem (Protocol 774)

- **Mounts & Mobs**
  - **Nautilus & Zombie Nautilus** (`minecraft:nautilus`, `minecraft:zombie_nautilus`, 0.875×0.95 hitbox, 15 HP): aquatic tameable/rideable mounts with dash attack (jump key), `Breath of the Nautilus` status effect (pauses oxygen depletion while mounted), Nautilus inventory GUI (`gui/container/nautilus`, `container/slot/nautilus_armor*`), copper–netherite Nautilus Armor, data-driven `zombie_nautilus_variant` (`normal` and warm-ocean `warm` coral variant); `nautilus_one_cm` stat; horses/mules/donkeys/zombie horses/camels no longer sink while ridden in water.
  - **Camel Husk** (`minecraft:camel_husk`, 1.7×2.375, 32 HP) & **Parched** (`minecraft:parched`, 0.6×1.99, 16 HP): desert undead camel (sun-immune, ridden by spear-wielding Husk + Parched) and sun-immune desert skeleton shooting Arrows of Weakness.
  - **Zombie Horseman & Netherite Horse Armor**: Zombie Horses spawn naturally at night with spear-wielding Zombie riders, are tameable/healable with red mushrooms, equip horse armor (protects from sunlight); added Netherite Horse Armor; leather horse armor split into tinted base + overlay matching Bedrock.
- **Spears & Combat Components**
  - Crafted in wood, stone, copper, iron, gold, diamond, netherite (`spear_in_hand` item model, `container/slot/spear` smithing icon, `minecraft:spear` damage type, `Lunge` enchantment consuming hunger/durability on Jab).
  - Dual attacks: quick **Jab** (multi-target piercing ray with cooldown) and held **Charge** (3 animated states: Engaged -> Tired shaking vertical -> Disengaged lowered, velocity-scaled damage + knockback + dismount).
  - Backed by 7 new item data components: `minecraft:attack_range`, `minecraft:damage_type`, `minecraft:kinetic_weapon`, `minecraft:minimum_attack_charge`, `minecraft:piercing_weapon`, `minecraft:swing_animation` (`none`/`whack`/`stab`), `minecraft:use_effects` (`can_sprint`, `speed_multiplier`, `interact_vibrations`). Fish buckets gained food properties; `consumable` animation renamed `spear` -> `trident` and added new `spear`; `intangible` adds tooltip text; `swap_animation_scale` added to item models; items no longer bob when durability changes.
- **Environment Attributes & Timelines**
  - Data-driven **Environment Attributes** (`minecraft:visual/*`, `minecraft:audio/*`, `minecraft:gameplay/*`) configured on Dimension Types and Biomes with modifiers (`override`, `add`, `subtract`, `multiply`, `minimum`, `maximum`, boolean ops, color blending + `blend_to_gray`) and 8-block camera biome interpolation.
  - Replaced legacy biome `effects` subfields (`fog_color`, `water_fog_color`, `sky_color`, `particle`, `ambient_sound`, `mood_sound`, `additions_sound`, `music`, `music_volume`), biome tags (`#has_closer_water_fog`, `#snow_golem_melts`, `#increased_fire_burnout`, `#plays_underwater_music`, `#without_patrol_spawns`), and dimension type fields (`ultrawarm`, `bed_works`, `respawn_anchor_works`, `piglin_safe`, `has_raids`, `cloud_height`, `fixed_time` -> `has_fixed_time`, `effects` -> `skybox` + `cardinal_light`).
  - **Timelines** (`data/<ns>/timeline/<id>.json`) drive attribute keyframes over `period_ticks` with easing curves (`constant`, `linear`, `in_*`/`out_*`/`in_out_*`, `cubic_bezier`).
- **Chunk Fading, Atlases, Shaders, Video Settings & Models**
  - **Chunk Fading**: Chunks (along with their entities and block entities) fade in smoothly instead of popping in; controlled by `Chunk Fade Time` in Video Settings.
  - **Atlas Split & Celestial Atlas**: Item textures split out of `blocks` atlas into a non-mipmapped `items` atlas (item models must stay within one atlas); new `celestials.png-atlas` (`sun`, `end_flash`, `moon/*` phases).
  - **Mipmapping, GPU Animations & Shaders**: All world blocks now support mipmapping (`.mcmeta` `mipmap_strategy`: `auto`, `mean`, `dark_cutout`, `cutout`, `strict_cutout`; `alpha_cutoff_bias`); glass & glass panes support translucent textures; sprites animate on the GPU (`animate_sprite.vsh`, `animate_sprite_blit.fsh`, `animate_sprite_interpolate.fsh` + `SpriteAnimationInfo` UBO); `terrain` samples `blocks` atlas linearly and uses `ChunkSection` UBO instead of `DynamicTransforms`; added `block.vsh/fsh` for ad-hoc blocks; `Globals` UBO adds camera coordinates; dark green leaf gaps when See-Through Leaves is off (occluded leaf faces culled).
  - **Video Settings & UI**: Graphics modes replaced by **Presets** (`Fast`, `Fancy`, `Fabulous!`, `Custom`) across 3 tabs (`Display`, `Quality & Performance`, `Preferences` formerly `Interface`). Split out `See-Through Leaves`, `Show Vignette`, `Weather Effect Radius`, `Improved Transparency`, `Texture Filtering` (`None`, `RGSS`, `Anisotropic` `2x`/`4x`/`8x`), removed duplicate accessibility toggles from Video Settings.
  - **Block Rotations**: Block model elements support multi-axis float `x`/`y`/`z` rotations (removing `[-45, 45]` restriction); blockstate variants add `z` rotation (`0`/`90`/`180`/`270`).
  - **Misc Client/Protocol**: Nether fog fixed 10–96 blocks (independent of render distance); underwater biome fog blends across biomes; cloud position synced to world time; world border interpolation uses game ticks; `"Show Music Toast"` renamed `"Music Toast"` (3 states); `Debug` keybinds category & rebindable `F1`/`F3`/`F3+[char]`/`F4`; macOS `Command` -> `Control` fixes; `effect_background`/`effect_background_ambient` nine-sliced sprites replace `_large`/`_small`; Unifont `17.0.01`; game rules moved into snake_case `minecraft:` registry; unchanged-XP packets suppressed; ClientFps JFR event; KQueue on macOS; `Accept Code of Conduct` (`0x09`) & `Game Test Highlight Position` (`0x27`) packets.

---

## Fetched HTML Cache & SHA-256 Verification

All files stored under `/home/ender/minecraftjs-1.21.11/cache/port-1.21.11/wiki/`. Every file was verified to contain MediaWiki article markup (`mw-content-text`) and zero challenge/CAPTCHA markers.

### Release Changelogs & Version References

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `Java_Edition_1.21.6.html` | 492130 | `368629e4e1fd20f178ae0f93d967ef26f489af8cf171cb757c8d9ee114d0ac43` |
| `Java_Edition_1.21.6_Dev.html` | 512292 | `cf53d62300a5aef6f5fe062caf4266a73667b16ec25313504c8cdb3dfbc9d1a2` |
| `Java_Edition_1.21.7.html` | 290534 | `2cf1cadf05318b546e2b421f611c587f9d9916aff45319bf385a9955abb42e10` |
| `Java_Edition_1.21.8.html` | 279925 | `7e94c77fecd0286726f36511ccc7799954339878472f5125724480dd23a16733` |
| `Java_Edition_1.21.9.html` | 568990 | `b47e7321a2c13c495a73966683f5c96d4fa7d9d87a0ca38b31115037778f8e8e` |
| `Java_Edition_1.21.9_Dev.html` | 598173 | `8cbb0b420719dad90594830d4553828909d042796de064e52429e219700d0922` |
| `Java_Edition_1.21.10.html` | 279098 | `e1afb825ec17063e3f8d28fb8e14f46792249b8145fd5b2572217bcb8c10f0e9` |
| `Java_Edition_1.21.11.html` | 492445 | `220202d9f2d723c377066062ee336d25484cfa07c659f61769edc7607e42f570` |
| `Java_Edition_1.21.11_Dev.html` | 563468 | `85acecf0ba69e62d665cdd95564f080eb7a10d5a42678f0da4e4f919abefc54c` |
| `Pack_format.html` | 442185 | `be32c49252c34f042b0f409fc7c8d70e53287acfe94f741676858e44c9c6f08e` |
| `Protocol_version.html` | 557347 | `21110f58aa650d02d03eec254757387e774aacbcfd144496e9e2029789252054` |
| `Protocol_History.html` | 488714 | `729d7c1c16aa5e27a262c03c6df89c12b8071b65f292a72d66d82051af8b712a` |

### Protocol & Format Specifications (Pinned 1.21.11 Revisions + Current Pages)

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `Packets_1.21.11_rev3488593.html` | 648471 | `266e75bc16c20f371b66c7c81e6caa620545df288d1d8fb26abc48d20b829b83` |
| `Entity_metadata_1.21.11_rev3343420.html` | 193014 | `942d52b140911f73c28390b9529a39f4107d0283212396b13a3d7cb3090f87c7` |
| `Chunk_format_1.21.11_rev3330485.html` | 83179 | `35f740201db97621930778e15959bc0a227861633c49b9b5e255a6637bae57c9` |
| `Slot_data_1.21.11_rev3478850.html` | 136672 | `6667e951b0ecf00957110beac3c192694c2822daac3b57f6cc88952507f9b28c` |
| `Data_types_1.21.11_rev3471172.html` | 212082 | `8adac7e538c5ba79ae797b21f9a8453596ff2c0db343253c6dee8a7a95937a5d` |
| `Text_component_format_1.21.11_rev3493941.html` | 249867 | `877aa98824c87c22e91190c1bdb9bffc45e55b240fd0f2bc30f626de18411de1` |
| `Data_component_format_1.21.11_rev3475678.html` | 564522 | `0d92449b29f92d6691455151e1adf48e78091237646890e745050dec19731635` |
| `Registries_1.21.11_rev3323741.html` | 63939 | `bcda84f1081c6dff3177c77663f8429bacbf6640d0dcd839dcb40768e9d69b47` |
| `Particles_1.21.11_rev3289968.html` | 54256 | `d72969b89ad8bc42d9cd442b8f37b0c4b0e5b1a00b95658dcfbeca7f6da867e0` |
| `Dialog_1.21.11_rev3458349.html` | 235499 | `7bedc55ab1d5b45612ce2a889a5c2b22897351580d5956d472621956089936d8` |
| `Packets_1.21.5_rev2959250.html` | 622212 | `627d441a1c14ed1a995bdf8e1bedcf991a53c78d118c996a7808485bcc71c69c` |
| `Packets_1.21.8_rev3076792.html` | 634491 | `aa2339928b3856c9e6aac43cdfa5b37aad145e90c9f13c7563da3ddf8d59b12e` |
| `Packets_1.21.10_rev3289863.html` | 640035 | `5816cf0fa06f14a42f701bd1eb8ccb3bc7db92950889c5ac6ae860c90d28fd80` |
| `Entity_metadata_1.21.5_rev2911702.html` | 185418 | `ad956df877bdd6a2cb3ede726c8182553415c70f61cdc31d387d1de8c530c621` |
| `Entity_metadata_1.21.6_rev3019287.html` | 186397 | `54f2f24137f6e6b57f3dc91ab56489ecb1b1763517dcd823a94489f785383262` |
| `Entity_metadata_1.21.9_rev3178340.html` | 193595 | `84cfe73d4ca2d9b79975b53aa8daa0bc755e0df8bb6a2d269a6a694d05f8b873` |
| `Java_Edition_protocol.html` | 153400 | `c2cdd0349aa8fd2a759ee73ca69cf069eab6a26dbf63575fefe0ce610c7ebee3` |
| `Java_Edition_protocol_Packets.html` | 782709 | `0fbf2d5ce9127b6fa5cd3d19f2ab30b7bfdd5b106c7f9c0eed3948a32c9324d4` |
| `Java_Edition_protocol_Chunk_format.html` | 93644 | `3ac6fa021bca9bde1ed2b2a0d4380e6f0fb2cff39a0936b81d9615873034b4ab` |
| `Java_Edition_protocol_Entity_metadata.html` | 292593 | `0062d25bfb30eca80bd0afda93fbe1ffdc00901ca577695d0723f3e50ca039dc` |
| `Java_Edition_protocol_Slot_data.html` | 151771 | `459cc6298348dd8093afb8acb61f31a30f4009b4597d1374f350003a958f0a15` |
| `Java_Edition_protocol_Data_types.html` | 228940 | `6ec4b6245f05d0a8ab2a8bd2bf815ed70e2582babc6673aba76781e8b0cadcde` |
| `Java_Edition_protocol_Registry_data.html` | 79866 | `0adc6134755b82a5cd5003882112f35e09ef5c67cd11316a1f7ed489af58bd6e` |
| `Java_Edition_protocol_Particles.html` | 53160 | `e858a9b3b387a7a07b120560d4af3aee58e82b25272a3f7cb892ae2037ac24f6` |
| `Java_Edition_protocol_Object_data.html` | 45933 | `ea0034d3ecd80ed8343a4cbc1a0accc10ebee572fa9d5698ec23f5898bf2f247` |
| `Java_Edition_protocol_Chat.html` | 42767 | `cbc02e2c7b241e75851c1db2c2bcb460371714fcb0524dee413037500fb0211a` |
| `Java_Edition_protocol_Inventory.html` | 103724 | `9991b2d311c88b25e11f3652645d3846f9a30a9c7da46a020d39c736ea23d81f` |
| `Java_Edition_protocol_Command_data.html` | 74176 | `1742b311ec45eb74b1035d51d8706a4125763a27c877e46755a183eba8bf53e5` |
| `Data_component_format.html` | 711161 | `d12105ef1a4be0f4ff76d7d65370678a281c76ed20c1dc6c13357964b13a42cc` |
| `Text_component_format.html` | 275177 | `f5ac3ed07ea591170fd9539d2c3153f03aa13fdae0b0fb894cf89f593dafdd7d` |
