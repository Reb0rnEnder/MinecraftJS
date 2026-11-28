# Java Edition 1.21.11 (Protocol 774) Wire Specification Summary

Derived from `minecraft.wiki` protocol pages pinned to pre-`26.1` revisions (`Packets` rev `3488593`, `Entity_metadata` rev `3343420`, `Chunk_format` rev `3330485`, `Slot_data` rev `3478850`, `Data_types` rev `3471172`, `Text_component_format` rev `3493941`, `Data_component_format` rev `3475678`, `Particles` rev `3289968`, `Registries` rev `3323741` cross-checked against current `Registries`, `Dialog` rev `3458349`, `Inventory`, `Command_data`) and diffed against `1.21.5` (`770`), `1.21.8` (`772`), and `1.21.10` (`773`).

> **Note on live wiki drift:** As of `2026-11-26`, the unpinned `Java_Edition_protocol/*` pages on `minecraft.wiki` have moved ahead to `26.1`–`26.3` (protocols `775`–`777`, e.g. adding Session ID UUID to `Login Success` in `26.2`, `sulfur_cube_archetype` / `world_clock` / `block_transformer` / `*_sound_variant` registries, and `sulfur_*` / `geyser*` particles). This document uses the pinned `1.21.11` (`774`) revisions and explicitly flags any wiki lag or target-jar verification items.

---

## 1. Protocol & Packet Changes (`1.21.5` -> `1.21.11`, Protocol `774`)

### Handshaking, Status & Login
- **Handshake** (`0x00` S2C/C2S `intention`): `Protocol Version` = **`774`** (`VarInt`), `Intent` (`VarInt Enum`: `1` Status, `2` Login, `3` Transfer). Legacy Server List Ping `0xFE`.
- **Status**: `0x00` `status_response` / `status_request`, `0x01` `pong_response` / `ping_request`.
- **Login**:
  - S2C: `0x00` `login_disconnect`, `0x01` `hello` (Encryption Request), `0x02` `login_finished` (Login Success — **`Game Profile`** only; Session ID UUID was not added until `26.2`), `0x03` `login_compression`, `0x04` `custom_query`, `0x05` `cookie_request`.
  - C2S: `0x00` `hello` (Login Start), `0x01` `key`, `0x02` `custom_query_answer`, `0x03` `login_acknowledged`, `0x04` `cookie_response`.

### Configuration State (`774`)

- **Clientbound (`0x00`–`0x13`)**:
  - `0x00` `cookie_request`, `0x01` `custom_payload`, `0x02` `disconnect`, `0x03` `finish_configuration`, `0x04` `keep_alive`, `0x05` `ping`, `0x06` `reset_chat`, `0x07` `registry_data`, `0x08` `resource_pack_pop`, `0x09` `resource_pack_push`, `0x0A` `store_cookie`, `0x0B` `transfer`, `0x0C` `update_enabled_features`, `0x0D` `update_tags`, `0x0E` `select_known_packs`, `0x0F` `custom_report_details`, `0x10` `server_links`.
  - **`0x11` `clear_dialog`** *(added 1.21.6)*: no fields. Closes active dialog screen and returns to previous screen.
  - **`0x12` `show_dialog`** *(added 1.21.6)*: `Dialog` (`NBT`, inline dialog compound — registry IDs are not valid in Configuration).
  - **`0x13` `code_of_conduct`** *(added 1.21.9)*: `Code of Conduct` (`String`). Server pauses configuration until client sends `accept_code_of_conduct`.
- **Serverbound (`0x00`–`0x09`)**:
  - `0x00` `client_information`, `0x01` `cookie_response`, `0x02` `custom_payload`, `0x03` `finish_configuration`, `0x04` `keep_alive`, `0x05` `pong`, `0x06` `resource_pack`, `0x07` `select_known_packs`.
  - **`0x08` `custom_click_action`** *(added 1.21.6)*: `ID` (`Identifier`), `Payload` (`NBT`, may be `TAG_End` `0`). *(Note: wiki rev `3289863` briefly showed `0x08` as `accept_code_of_conduct` in 1.21.10 before `3390605` restored `0x08 custom_click_action` and `0x09 accept_code_of_conduct`.)*
  - **`0x09` `accept_code_of_conduct`** *(1.21.9+/1.21.11)*: no fields.

### Play State (`774`)

Total documented packets in `1.21.11`: **139 Clientbound** (`0x00`–`0x8A`, noting wiki transclusion renders `0x0D` in `Update Tags (play)` body when its Play ID is **`0x84`**) and **66 Serverbound** (`0x00`–`0x41`).

#### New & Modified Play Clientbound Packets (`1.21.6`–`1.21.11`)

| ID | Resource | Packet | Change / Wire Layout |
| --- | --- | --- | --- |
| `0x01` | `add_entity` | Spawn Entity | `Entity ID (VarInt)`, `UUID`, `Type (VarInt)`, `X/Y/Z (Double)`, **`Velocity (LpVec3)`** *(replaced 3 `Short`s in 1.21.9)*, `Pitch/Yaw/Head Yaw (Angle)`, `Data (VarInt)`. |
| `0x1A` | `debug_block_value` | Debug Block Value | *(1.21.9)* `Location (Position)`, `Update (Debug Subscription Update)`. |
| `0x1B` | `debug_chunk_value` | Debug Chunk Value | *(1.21.9)* `Chunk Z (Int)`, `Chunk X (Int)` *(inverted order — read as big-endian Long with Z in upper 32 bits)*, `Update (Debug Subscription Update)`. |
| `0x1C` | `debug_entity_value` | Debug Entity Value | *(1.21.9)* `Entity ID (VarInt)`, `Update (Debug Subscription Update)`. |
| `0x1D` | `debug_event` | Debug Event | *(1.21.9)* `Event (Debug Subscription Event)`. |
| `0x1E` | `debug_sample` | Debug Sample | Shifted from `0x1A` (`1.21.9`). |
| `0x24` | `explode` | Explosion | Shifted from `0x20`; *(1.21.9)* added `Radius (Float)`, `Block Count (Int)` before `Player Delta Velocity (Prefixed Optional 3×Double)`, `Explosion Particle ID/Data`, `Explosion Sound (ID or Sound Event)`, and **`Block Particle Alternatives`** (`Prefixed Array` of `{Particle ID (VarInt), Particle Data (Varies), Scaling (Float), Speed (Float), Weight (VarInt)}`). |
| `0x27` | `game_test_highlight_pos` | Game Test Highlight Position | *(1.21.11)* `Absolute Location (Position)`, `Relative Location (Position)` (shifted `0x27+` from `1.21.10`). |
| `0x28` | `horse_screen_open` | Open Horse Screen | Shifted from `0x23`. `Window ID (VarInt)`, `Inventory columns count (VarInt)`, `Entity ID (Int)`. Used for horses/donkeys/mules/llamas/camels/nautilus mounts. |
| `0x2C` | `level_chunk_with_light` | Chunk Data and Update Light | Shifted from `0x27`. `Chunk X/Z (Int)`, `Heightmaps (Prefixed Array of Heightmap)`, `Data (Prefixed Array of Byte)`, `Block Entities`, `Light (Light Data)`. |
| `0x37` | `move_vehicle` | Move Vehicle (clientbound) | Shifted from `0x32` (`1.21.9`+ split S2C/C2S pages). |
| `0x47` | `player_rotation` | Player Rotation | Shifted from `0x42`; added **`Relative Yaw (Boolean)`** after `Yaw (Float)`, and **`Relative Pitch (Boolean)`** after `Pitch (Float)`. |
| `0x5F` | `set_default_spawn_position` | Set Default Spawn Position | Shifted from `0x5A`; *(1.21.9)* replaced `Angle (Float)` with **`Dimension Name (Identifier)`**, `Location (Position)`, **`Yaw (Float)`**, **`Pitch (Float)`**. |
| `0x63` | `set_entity_motion` | Set Entity Velocity | Shifted from `0x5E`; *(1.21.9)* replaced `Velocity X/Y/Z (3×Short)` with **`Velocity (LpVec3)`**. |
| `0x64` | `set_equipment` | Set Equipment | Shifted from `0x5F`; slots `0..7` (`6 = Body`, `7 = Saddle`). |
| `0x6B` | `set_player_team` | Update Teams | Shifted from `0x66`; *(1.21.6)* `Name Tag Visibility` & `Collision Rule` changed from `String Enum (40)` to **`VarInt Enum`** (`0..3`). |
| `0x84` | `update_tags` | Update Tags (play) | Shifted from `0x7F` (`1.21.10` confirms `0x84`; `rev3488593` has a wiki transclusion artifact showing `0x0D`). |
| `0x88` | `waypoint` | Waypoint | *(1.21.6)* `Operation (VarInt Enum: 0=track, 1=untrack, 2=update)`, `Identifier (Uuid or String)`, `Icon style (Identifier -> waypoint_style/<val>.json)`, `Color (Prefixed Optional 3×Unsigned Byte R,G,B)`, `Waypoint type (VarInt Enum)` + `Waypoint data`: `0=Empty`, `1=Vec3i (3×VarInt X,Y,Z)`, `2=Chunk (2×VarInt X,Z)`, `3=Azimuth (Float radians)`. |
| `0x89` | `clear_dialog` | Clear Dialog (play) | *(1.21.6)* no fields. |
| `0x8A` | `show_dialog` | Show Dialog (play) | *(1.21.6)* `Dialog (ID or NBT)` — ID in `minecraft:dialog` registry or inline NBT. |

*(Note: All Play Clientbound packets formerly at `0x1A`–`0x21` shifted `+4` in 1.21.9 and `+5` in 1.21.11 relative to 1.21.5; `0x22`–`0x82` shifted `+5` relative to 1.21.5, with `0x84` `update_tags` followed by `0x85` `projectile_power`, `0x86` `custom_report_details`, `0x87` `server_links`, `0x88` `waypoint`, `0x89` `clear_dialog`, `0x8A` `show_dialog`.)*

#### New & Modified Play Serverbound Packets (`1.21.6`–`1.21.11`)

| ID | Resource | Packet | Change / Wire Layout |
| --- | --- | --- | --- |
| `0x04` | `change_game_mode` | Change Game Mode | *(1.21.6)* `Game mode (VarInt Enum: 0=survival, 1=creative, 2=adventure, 3=spectator)`. Shifts all subsequent Play Serverbound packets (`0x05`–`0x40`) by `+1` relative to `1.21.5`. |
| `0x16` | `debug_subscription_request` | Debug Subscription Request | *(1.21.9, replaced `debug_sample_subscription`)* `Subscriptions (Prefixed Array of VarInt)` — active IDs in `minecraft:debug_subscription` registry. |
| `0x3E` | `test_instance_block_action` | Test Instance Block Action | `Test` changed from `Prefixed Optional VarInt` to `Prefixed Optional Identifier` (`minecraft:test_instance`). |
| `0x41` | `custom_click_action` | Custom Click Action (play) | *(1.21.6)* `ID (Identifier)`, `Payload (NBT; may be TAG_End 0)`. |

- **Commands (`0x10`) Node Flags** (`Java_Edition_protocol/Command_data`): added `0x20 Is restricted` (requires permission level > 0).

---

## 2. New Wire Data Types (`Java_Edition_protocol/Data_types`)

### `LpVec3` *(added 1.21.9 for `Spawn Entity` & `Set Entity Velocity`)*
Encodes 3 doubles in 1, 6, or 6+ bytes:
- Read first unsigned byte `b1`. If `b1 == 0`, return `(0.0, 0.0, 0.0)` (used when `max(|x|,|y|,|z|) < 3.051944088384301e-5`, i.e., `1/32766`).
- Otherwise read second unsigned byte `b2` and big-endian unsigned int `w` (bytes 3..6), forming 48-bit little-endian-header + big-endian-tail `packed = (w << 16) | (b2 << 8) | b1`.
- Bit layout of `packed`: bits `0..1` = lowest 2 bits of `scaleFactor`; bit `2` (`b1 & 4`) = continuation flag (if set, read `VarInt` `ext` and `scaleFactor |= (ext & 0xFFFFFFFFL) << 2`); bits `3..17` = 15-bit quantized X; bits `18..32` = 15-bit quantized Y; bits `33..47` = 15-bit quantized Z.
- Unpack axis: `(min(val & 32767, 32766.0) * 2.0 / 32766.0 - 1.0) * scaleFactor`.

### `Resolvable Profile` *(updated 1.21.9 for `Mannequin` & `minecraft:profile`)*
1. `Profile Kind` (`VarInt Enum`):
   - `0` (Partial): `Username` (`Prefixed Optional String(16)`), `UUID` (`Prefixed Optional UUID`), `Properties` (`Prefixed Array(16)` of `{Name String(64), Value String(32767), Signature Prefixed Optional String(1024)}`).
   - `1` (Complete): `Game Profile` (`UUID`, `Username`, `Properties`).
2. `Body` (`Optional Identifier` — skin texture override), `Cape` (`Optional Identifier`), `Elytra` (`Optional Identifier`), `Model` (`Optional VarInt`: `0 = WIDE`, `1 = SLIM`).

### `Debug Subscription Update` & `Debug Subscription Event` *(added 1.21.9)*
- `Debug Subscription Event`: `Debug subscription type (VarInt Enum)` + `Data (Debug Subscription Data)`.
- `Debug Subscription Update`: `Subscription type (VarInt Enum)` + `Data (Prefixed Optional Debug Subscription Data)`.
- `Debug Subscription Data` types (`0..15`):
  - `0`: Dedicated server tick time *(no fields)*
  - `1`: Bee (`Hive Pos Prefixed Optional Position`, `Flower Pos Prefixed Optional Position`, `Travel ticks VarInt`, `Blacklisted hives Prefixed Array of Position`)
  - `2`: Villager brain (`Name/Profession String`, `XP Int`, `Health/Max health Float`, `Inventory String`, `Wants golem Boolean`, `Anger level Int`, `Activities/Behaviors/Memories/Gossips Prefixed Array of String`, `POIs/Potential POIs Prefixed Array of Position`)
  - `3`: Breeze (`Attack target Prefixed Optional VarInt`, `Jump target Prefixed Optional Position`)
  - `4`: Goal selector (`Priority VarInt`, `Is running Boolean`, `Name String(255)`)
  - `5`: Entity path (`Reached Boolean`, `Next block index Int`, `Block position Position`, `Nodes/Target nodes/Open set/Closed set Prefixed Array of Debug Path Node`, `Max node distance Float`) — `Debug Path Node` = `X/Y/Z Int`, `Walked distance Float`, `Cost malus Float`, `Closed Boolean`, `Type VarInt Enum (0..25)`, `F Float`.
  - `6`: Entity block intersection (`ID VarInt Enum: 0=IN_BLOCK, 1=IN_FLUID, 2=IN_AIR`)
  - `7`: Bee hive (`Type VarInt minecraft:block`, `Occupant count VarInt`, `Honey level VarInt`, `Sedated Boolean`)
  - `8`: POI (`Position`, `Type VarInt minecraft:point_of_interest_type`, `Free ticket count VarInt`)
  - `9`: Redstone wire orientation (`ID VarInt`)
  - `10`: Village section *(no fields)*
  - `11`: Raid (`Positions Prefixed Array of Position`)
  - `12`: Structure (`Structures Prefixed Array of Debug Structure Info`: `Bounding box min/max Position`, `Pieces Prefixed Array of {Min Position, Max Position, Is start Boolean}`)
  - `13`: Game event listener (`Listener radius VarInt`)
  - `14`: Neighbor update (`Position`)
  - `15`: Game event (`Event VarInt minecraft:game_event`, `X/Y/Z Double`)

### `Teleport Flags` (`Int` bitmask)
`0x0001` Rel X, `0x0002` Rel Y, `0x0004` Rel Z, `0x0008` Rel Yaw, `0x0010` Rel Pitch, `0x0020` Rel Vel X, `0x0040` Rel Vel Y, `0x0080` Rel Vel Z, `0x0100` Rotate velocity by rotation delta.

---

## 3. Chunk & Light Wire Format (`Java_Edition_protocol/Chunk_format`)

Unchanged structurally from `1.21.5` (`rev3330485`):
- **Packet `0x2C` (`level_chunk_with_light`)**:
  - `Chunk X (Int)`, `Chunk Z (Int)`
  - `Heightmaps` (`Prefixed Array of Heightmap`): `Type (VarInt Enum: 1=WORLD_SURFACE, 4=MOTION_BLOCKING, 5=MOTION_BLOCKING_NO_LEAVES)` + `Data (Prefixed Array of Long)`. `Bits Per Entry = ceil(log2(world_height + 1))`; 256 columns packed without crossing 64-bit longs, ordered fastest-increasing `x`, offset by dimension `min_y`.
  - `Data` (`Prefixed Array of Byte`): array of `Chunk Section`s (`world_height / 16` sections, bottom-to-top, **not** length-prefixed; extra trailing padding bytes in `Data` size must be skipped).
  - `Block Entities` (`Prefixed Array`): `Packed XZ (Unsigned Byte: ((x&15)<<4)|(z&15))`, `Y (Short)`, `Type (VarInt)`, `Data (NBT without x/y/z)`.
  - `Light Data`: `Sky/Block/Empty Sky/Empty Block Light Mask (BitSet of sections + 2)` + `Sky/Block Light arrays (Prefixed Array of Prefixed Array(2048) of Byte)`.
- **Chunk Section**: `Block count (Short)` (non-air count; `0` skips rendering), `Block states (Paletted Container of 4096 entries)`, `Biomes (Paletted Container of 64 entries)`.
- **Paletted Container**: `Bits Per Entry (Unsigned Byte)`, `Palette`:
  - `BPE == 0` -> Single valued (`Value VarInt`, **no Data Array**).
  - `BPE 4..8` (blocks) / `1..3` (biomes) -> Indirect (`Palette Length VarInt` + `Array of VarInt`).
  - `BPE >= 15` (blocks) / runtime-calculated (biomes) -> Direct (no palette).
  - **Data Array**: **no length VarInt** (since 1.21.5); `entries_per_long = floor(64 / BPE)`, `num_longs = ceil(num_entries / entries_per_long)`. Entries packed LSB-first inside big-endian `Long`s without crossing `Long` boundaries.

---

## 4. Slot Data & Data Components (`Slot_data` & `Data_component_format`)

- **`Slot` Wire Format**: `Item Count (VarInt)`. If `> 0`: `Item ID (VarInt)`, `Add Count (VarInt)`, `Remove Count (VarInt)`, `[Component Type (VarInt Enum), Component Data (Varies)] * AddCount`, `[Component Type (VarInt Enum)] * RemoveCount`.
- **`Hashed Slot` Wire Format** *(used in `Click Container` `0x11`)*: `Has Item (Boolean)`. If true: `Item ID (VarInt)`, `Item Count (VarInt)`, `Prefixed Array of {Component Type (VarInt Enum), Component Data Hash (Int CRC32C)}`, `Prefixed Array of Component Type (VarInt Enum)`.
- **Component Type Table (`Slot_data` rev `3478850`, IDs `0..95`)**:
  - `0` `custom_data` (Compound NBT), `1` `max_stack_size` (`VarInt`), `2` `max_damage` (`VarInt`), `3` `damage` (`VarInt`), `4` `unbreakable` *(empty)*, `5` `custom_name` (`Text Component`), `6` `item_name` (`Text Component`), `7` `item_model` (`Identifier`), `8` `lore` (`Prefixed Array of Text Component`), `9` `rarity` (`VarInt Enum`), `10` `enchantments` (`Prefixed Array of {VarInt, VarInt}`), `11` `can_place_on` (`Prefixed Array of Block Predicate`), `12` `can_break` (`Prefixed Array of Block Predicate`), `13` `attribute_modifiers` *(note: `Data_component_format` adds optional `display` `default`/`hidden`/`override` in `1.21.6`, verify stream fields against 1.21.11 jar)*, `14` `custom_model_data` (`floats`, `flags`, `strings`, `colors`), `15` `tooltip_display` (`Hide tooltip Boolean`, `Hidden components Prefixed Array of VarInt`), `16` `repair_cost`, `17` `creative_slot_lock`, `18` `enchantment_glint_override`, `19` `intangible_projectile` (empty Compound NBT), `20` `food`, `21` `consumable` (Animation `VarInt Enum`: `0=none, 1=eat, 2=drink, 3=block, 4=bow, 5=spear, 6=crossbow, 7=spyglass, 8=toot_horn, 9=brush`; note `Data_component_format` 1.21.11 renamed `spear`->`trident` and added `spear` — verify enum order in 1.21.11 jar), `22` `use_remainder`, `23` `use_cooldown`, `24` `damage_resistant`, `25` `tool`, `26` `weapon`, `27` `enchantable`, `28` `equippable` (`Slot 0..6` where `6=body` — verify `saddle` enum if added, plus 1.21.6 `Can be sheared Boolean` & `Shearing sound ID or SoundEvent`), `29` `repairable`, `30` `glider`, `31` `tooltip_style`, `32` `death_protection`, `33` `blocks_attacks`, `34` `stored_enchantments`, `35` `dyed_color`, `36` `map_color`, `37` `map_id`, `38` `map_decorations`, `39` `map_post_processing`, `40` `charged_projectiles`, `41` `bundle_contents`, `42` `potion_contents`, `43` `potion_duration_scale`, `44` `suspicious_stew_effects`, `45` `writable_book_content`, `46` `written_book_content`, `47` `trim`, `48` `debug_stick_state`, `49` `entity_data`, `50` `bucket_entity_data`, `51` `block_entity_data`, `52` `instrument`, `53` `provides_trim_material`, `54` `ominous_bottle_amplifier`, `55` `jukebox_playable`, `56` `provides_banner_patterns`, `57` `recipes`, `58` `lodestone_tracker`, `59` `firework_explosion`, `60` `fireworks`, `61` `profile` (`Resolvable Profile`), `62` `note_block_sound`, `63` `banner_patterns`, `64` `base_color`, `65` `pot_decorations`, `66` `container`, `67` `block_state`, `68` `bees`, `69` `lock` (String NBT), `70` `container_loot`, `71` `break_sound`, `72`..`95` entity variant components (`villager/variant`, `wolf/variant`, `wolf/sound_variant`, `wolf/collar`, `fox/variant`, `salmon/size`, `parrot/variant`, `tropical_fish/*`, `mooshroom/variant`, `rabbit/variant`, `pig/variant`, `cow/variant`, `chicken/variant`, `frog/variant`, `horse/variant`, `painting/variant`, `llama/variant`, `axolotl/variant`, `cat/variant`, `cat/collar`, `sheep/color`, `shulker/color`).
- **Wiki Lag Warning — New `1.21.11` Components**: `Slot_data` rev `3478850` stops at ID `95`, whereas `1.21.11` (`Data_component_format` rev `3475678`) added 7 new components: `minecraft:attack_range`, `minecraft:damage_type`, `minecraft:kinetic_weapon`, `minecraft:minimum_attack_charge`, `minecraft:piercing_weapon`, `minecraft:swing_animation`, and `minecraft:use_effects`. Extract exact `minecraft:data_component_type` numeric IDs and stream codecs directly from the `1.21.11` jar (`registries.json` / `DataComponents`)! (Also note `26.1` added `additional_trade_cost` and `dye` — exclude those from `1.21.11`.)

---

## 5. Text NBT Format (`Text_component_format`)

- **Wire Encoding**: Network **NBT Tag** (NOT JSON string, except Status MOTD `JSON Text Component`):
  - `TAG_String` if plain text only with no styling/children/events.
  - `TAG_Compound` for all other cases.
- **Content Types (`type`)**: `"text"`, `"translatable"` (`translate`, optional `fallback`, `with`), `"score"` (`score: {name, objective}`), `"selector"` (`selector`, `separator`), `"keybind"` (`keybind`), `"nbt"` (`source`, `nbt`, `interpret`, `separator`, `entity`/`block`/`storage`), and **`"object"`** *(added 1.21.9)*:
  - `object: "atlas"` (default): `atlas` (Identifier, default `"minecraft:blocks"`), `sprite` (Identifier, e.g., `"item/porkchop"`). Renders 8×8; ignores `bold` & `italic`.
  - `object: "player"`: `player` (Resolvable Profile / string `name`, `id`, `properties`, `texture`, `cape`, `elytra`, `model`), `hat` (Boolean, default `true`).
- **Styling**: `color` (`#RRGGBB` or named), `font`, `bold`, `italic`, `underlined`, `strikethrough`, `obfuscated`, `shadow_color` (`Int` ARGB or 4-float list).
- **Events** (snake_case `click_event` / `hover_event`):
  - `click_event.action`: `open_url` (`url`), `open_file` (`path`), `run_command` (`command`), `suggest_command` (`command`), `change_page` (`page` Int), `copy_to_clipboard` (`value`), **`show_dialog`** (`dialog`: ID or inline dialog compound — *1.21.6*), **`custom`** (`id`, optional `payload` NBT/string — *1.21.6*).
  - `hover_event.action`: `show_text` (`value`), `show_item` (`id`, `count`, `components`), `show_entity` (`id`, `uuid` string or 4-int array, `name`).

---

## 6. Entity Metadata & Types (`Entity_metadata` rev `3343420`)

- **Wire Format**: Sequence of `[Index: Unsigned Byte, Type: VarInt Enum, Value: Varies]` terminated by `Index == 0xFF`.

### Metadata Type Enum (`0..38` in `1.21.11`)

| ID | Name | Wire Encoding | Notes |
| ---: | --- | --- | --- |
| `0` | Byte | `Byte` | |
| `1` | VarInt | `VarInt` | |
| `2` | VarLong | `VarLong` | |
| `3` | Float | `Float` | |
| `4` | String | `String (32767)` | |
| `5` | Text Component | `Text Component` | |
| `6` | Optional Text Component | `Prefixed Optional Text Component` | |
| `7` | Slot | `Slot` | |
| `8` | Boolean | `Boolean` | |
| `9` | Rotations | `3 × Float` (x, y, z) | |
| `10` | Position | `Position` | |
| `11` | Optional Position | `Prefixed Optional Position` | |
| `12` | Direction | `VarInt Enum` (0..5: D/U/N/S/W/E) | |
| `13` | Optional Living Entity Ref | `Prefixed Optional UUID` | |
| `14` | Block State | `VarInt` | |
| `15` | Optional Block State | `VarInt` (0=absent, else state ID) | |
| `16` | Particle | `VarInt` + `Varies` | Shifted `-1` in `1.21.9` when `NBT` removed |
| `17` | Particles | `VarInt` len + array of Particle | Shifted `-1` in `1.21.9` |
| `18` | Villager Data | `3 × VarInt` (type, prof, level) | Shifted `-1` in `1.21.9` |
| `19` | Optional VarInt | `VarInt` (0=absent, 1+val) | Shifted `-1` in `1.21.9` |
| `20` | Pose | `VarInt Enum` (`0..17`) | Shifted `-1` in `1.21.9` |
| `21` | Cat Variant | `VarInt` (`cat_variant`) | |
| `22` | Cow Variant | `VarInt` (`cow_variant`) | |
| `23` | Wolf Variant | `VarInt` (`wolf_variant`) | |
| `24` | Wolf Sound Variant | `VarInt` (`wolf_sound_variant`) | |
| `25` | Frog Variant | `VarInt` (`frog_variant`) | |
| `26` | Pig Variant | `VarInt` (`pig_variant`) | |
| `27` | Chicken Variant | `VarInt` (`chicken_variant`) | |
| `28` | **Zombie Nautilus Variant** | `VarInt` (`zombie_nautilus_variant`) | **Added `1.21.11`** (shifts `29..37` `+1`) |
| `29` | Optional Global Position | `Boolean` + `Opt Identifier` + `Opt Position` | |
| `30` | Painting Variant | `ID or Painting Variant` | |
| `31` | Sniffer State | `VarInt Enum` (`0..6`) | |
| `32` | Armadillo State | `VarInt Enum` (`0..3`) | |
| `33` | **Copper Golem State** | `VarInt Enum` (`0..4`: IDLE, GETTING_ITEM, GETTING_NO_ITEM, DROPPING_ITEM, DROPPING_NO_ITEM) | **Added `1.21.9`** |
| `34` | **Weathering Copper State** | `VarInt Enum` (`0..3`: UNAFFECTED, EXPOSED, WEATHERED, OXIDIZED) | **Added `1.21.9`** |
| `35` | Vector3 | `3 × Float` | |
| `36` | Quaternion | `4 × Float` | |
| `37` | **Resolvable Profile** | `Resolvable Profile` | **Added `1.21.9`** |
| `38` | **Humanoid Arm** | `VarInt Enum` (`0=LEFT, 1=RIGHT`) | **Added `1.21.11`** |

### Entity Metadata Additions & Changes (`1.21.6`–`1.21.11`)

- **New Entities** (`minecraft:entity_type` IDs & hitboxes in `Entity_metadata` rev `3343420`):
  - `minecraft:camel_husk` (ID `21`, `1.7 × 2.375`): extends `Camel` (`18: Is dashing Boolean`, `19: Last pose change tick VarLong`), no extra fields.
  - `minecraft:copper_golem` (ID `29`, `0.49 × 0.98`): extends `Creature`; `16: Weathering Copper State (34)`, `17: Copper Golem State (33)`.
  - `minecraft:happy_ghast` (ID `59`, `4.0 × 4.0`): extends `Animal`; `17: Is leash holder Boolean (8)`, `18: Stays still Boolean (8)`.
  - `minecraft:mannequin` (ID `84`, `0.6 × 1.8`): extends `Avatar`; `17: Resolvable Profile (37)`, `18: Immovable Boolean (8)`, `19: Description Optional Text Component (6)`.
  - `minecraft:nautilus` (ID `89`, `0.875 × 0.95`): extends `Abstract Nautilus` (`19: Is dashing Boolean (8)`), no extra fields.
  - `minecraft:parched` (ID `98`, `0.6 × 1.99`): extends `Monster`, no extra fields.
  - `minecraft:zombie_nautilus` (ID `153`, `0.875 × 0.95`): extends `Abstract Nautilus`; `20: Zombie Nautilus Variant (28)`.
- **Changed Existing Entities**:
  - `Avatar` *(new superclass of `Mannequin` and `Player`, 1.21.9)*: `15: Main hand (0=left, 1=right; default 1)` *(listed as `Byte (0)` in rev `3343420`, updated to `Humanoid Arm` in `26.1` — verify `Byte (0)` vs `Humanoid Arm (38)` in the 1.21.11 jar!)*, `16: Displayed Skin Parts bitmask Byte (0)` (`0x01..0x40`). `Player` (ID `156`) extends `Avatar` (`17: Additional Hearts Float`, `18: Score VarInt`, `19/20: Left/Right shoulder Optional VarInt (19)`).
  - `Item Frame` *(1.21.6)*: inserted `8: Direction (12)`, shifting `Item Slot (7)` to `9` and `Rotation VarInt` to `10`.
  - `Painting` *(1.21.6)*: inserted `8: Direction (12)`, shifting `Painting Variant` to `9` (type `30`).
  - `Pufferfish` *(1.21.6)*: inserted `16: From bucket Boolean (8)`, shifting `Puff state VarInt` to `17`.
  - `Bee` (`18`) & `Wolf` (`21`) *(1.21.11)*: `Anger time` changed from `VarInt (1)` to **`VarLong (2)`** (`anger_end_time` tick timestamp).
  - `Primed TNT` (`8`): client auto-decrements `Fuse time` by 1 per tick and deletes entity when it reaches `0`.

---

## 7. Synchronized Registries & Particles (`774`)

- **Synchronized Registries** (from `Registries` rev `3323741` + `1.21.11` release notes + current `Registries` excluding `26.x`):
  - Active in `1.21.11`: `minecraft:banner_pattern`, `minecraft:chat_type`, `minecraft:damage_type` *(must include `minecraft:spear`)*, `minecraft:dialog` *(1.21.6)*, `minecraft:dimension_type`, `minecraft:enchantment`, `minecraft:instrument`, `minecraft:jukebox_song` *(must include `minecraft:tears` & `minecraft:lava_chicken`)*, `minecraft:painting_variant`, `minecraft:test_environment`, `minecraft:test_instance`, `minecraft:timeline` *(1.21.11 — check if synchronized in 1.21.11 jar)*, `minecraft:trim_material`, `minecraft:trim_pattern`, `minecraft:worldgen/biome` *(must include `minecraft:plains`)*, `minecraft:cat_variant`, `minecraft:chicken_variant`, `minecraft:cow_variant`, `minecraft:frog_variant`, `minecraft:pig_variant`, `minecraft:wolf_variant`, `minecraft:wolf_sound_variant`, **`minecraft:zombie_nautilus_variant`** *(1.21.11, non-empty)*.
  - *(Exclude `26.x`-only registries shown on current live wiki: `block_transformer`, `sulfur_cube_archetype`, `world_clock`, `cat_sound_variant`, `chicken_sound_variant`, `cow_sound_variant`, `pig_sound_variant`, and `minecraft:bounce` jukebox song.)*
- **Particles (`Particles_1.21.11_rev3289968.html`)**:
  - `minecraft:copper_fire_flame` (`ID 5`, no payload) added in `1.21.9`.
  - `minecraft:dragon_breath` (`Power Float`), `minecraft:effect` & `minecraft:instant_effect` (`Color Int 0xRRGGBB`, `Power Float`), `minecraft:flash` (`Color Int ARGB`).
  - *(Exclude `26.2` particles on live wiki: `sulfur_bubbles`, `noxious_gas*`, `geyser*`, `pause_mob_growth`, `reset_mob_growth`, `sulfur_cube_goo`.)*
