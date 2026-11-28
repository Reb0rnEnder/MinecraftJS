# Minecraft Java Edition Protocol & Data Diff: 1.20.6 (766) -> 1.21.11 (774)

Generated programmatically by `cache/port-1.21.11/diff_proto.mjs` from PrismarineJS `minecraft-data` pinned commit `57dfcb6f904ad3ae60279285c7799705684dfa6c`.

- **Baseline (1.20.6):** `pc/1.20.5/protocol.json` (protocol `766`, SHA-1 `679f1149cdc45510cd167e5bffc506b0468bad20`, 242450 bytes) & MinecraftJS `client/js/net/{play-codec-1.20.6.js, item-components-1.20.6.js, configuration-1.20.6.js, component-nbt-1.20.6.js, buffer.js}`.
- **Target (1.21.11):** `pc/1.21.11/protocol.json` (protocol `774`, `majorVersion: "1.21"`, `releaseType: "release"`, SHA-1 `39158e28155bdbc28c50e2937aaf45303edb48c8`, 330084 bytes).

---

## 1. Executive Summary

1. **Wire Protocol Version:** Protocol `766` (1.20.6) -> Protocol `774` (1.21.11).
2. **New Native Wire Primitive (`lpVec3`) & Unsigned 32-bit Int (`u32`):**
   - `lpVec3` (`"native"` in `protocol.json`) replaces `vec3i16` in `play.toClient.spawn_entity.velocity` and `play.toClient.entity_velocity.velocity` (introduced in 1.21.9).
   - `u32` is now required at runtime by `PositionUpdateRelatives` (`["bitflags", {"type": "u32", "flags": [...]}]` in `position` and `entity_teleport`).
   - Neither `lpVec3` nor `u32` is supported in `play-codec-1.20.6.js`, `item-components-1.20.6.js`, or `buffer.js` `Reader`.
3. **ProtoDef Constructors (`1.20.6` -> `1.21.11`):**
   - The **set of 13 ProtoDef constructor names** in `protocol.json` is unchanged (`array`, `bitfield`, `bitflags`, `buffer`, `container`, `entityMetadataLoop`, `mapper`, `option`, `pstring`, `registryEntryHolder`, `registryEntryHolderSet`, `switch`, `topBitSetTerminatedArray`).
   - However, **three ProtoDef evaluation edge cases** appear in 1.21.11 that break the 1.20.6 codecs:
     1. **`switch` without `default` (implicit `void`):** `SlotComponent.data?attribute_modifiers[].display.component`, `packet_common_server_links.links[].knownType`/`unknownType`, `packet_tracked_waypoint.waypoint.data` (`empty`), and `command_node.extraNodeData?2.properties` (6 singleton parsers) omit `"default"`. Both `play-codec-1.20.6.js` and `item-components-1.20.6.js` throw on missing switch branches instead of returning `void`.
     2. **Parent-scope `switch` lookup through `anon: true` container:** `DebugSubscriptionUpdate` reads `type` in the outer container, opens an anonymous `container` for `payload`, and switches on `compareTo: "type"` without `../`. `play-codec-1.20.6.js` `lookup()` only checks the innermost container frame and fails.
     3. **`UntrustedSlotComponent` (`set_creative_slot`) uses `ByteArray` (`buffer`) & `Slot.itemCount` became `varint`:** `item-components-1.20.6.js` does not implement `buffer` (needed for `UntrustedSlotComponent`), and its `rawSlot()` validates `itemCount` as signed `i8` (`-128..127`) whereas `Slot.itemCount` is now `varint`.
4. **Container & Slot Wire Breaks:**
   - `ContainerID` changed from `u8` to `varint` across all container packets (`close_window`, `window_items`, `craft_progress_bar`, `set_slot`, `open_horse_window`, `open_window`, `trade_list`, `craft_recipe_response`, `window_click`, `set_slot_state`, `craft_recipe_request`, `enchant_item`).
   - `Slot.itemCount` changed from `i8` to `varint`.
   - `SlotComponentType` expanded from **56** (0..55) to **104** (0..103): 3 removed (`hide_additional_tooltip`, `hide_tooltip`, `fire_resistant`), 51 added, 17 modified, and 48 existing component IDs shifted.
   - Serverbound `window_click` (1.21.5+) replaced full `Slot` payloads in `changedSlots[].item` and `cursorItem` with `["option", "HashedSlot"]` (CRC32C component hashes instead of component bodies).
   - Serverbound `set_creative_slot` replaced `Slot` with `UntrustedSlot` (wrapping each component in a `varint`-prefixed `ByteArray`).
   - `trade_list` replaced `addedComponentCount` + `SlotComponent[]` in `inputItem1` / `inputItem2` with `ExactComponentMatcher`.
5. **Major Gameplay Packet Overhauls:**
   - **Chunk / World / Teleport:** `map_chunk.heightmaps` changed from `anonymousNbt` to a typed array (`type: varint enum, data: i64[]`); inner chunk `PalettedContainer` (since 1.21.5) omits the `VarInt` array length prefix before packed `long[]`; `SpawnInfo` (`login`/`respawn`) added `seaLevel: varint`; `spawn_position` now uses `RespawnData` (`globalPos, yaw, pitch`); `position` and `entity_teleport` now carry velocity deltas `(dx, dy, dz)` and 32-bit `PositionUpdateRelatives` (and `position` moved `teleportId` first); added `sync_entity_position` and `player_rotation`.
   - **Recipes:** `declare_recipes` stripped all crafting recipe definitions (moved to `recipe_book_add` using `RecipeDisplay`/`SlotDisplay`) and now only sends recipe property sets (`name, items[]`) and `stoneCutterRecipes`. `unlock_recipes` removed and replaced by `recipe_book_add`, `recipe_book_remove`, `recipe_book_settings`.
   - **Explosion:** Dropped `affectedBlockOffsets` and split small/large particles; replaced with `{center: vec3f64, radius: f32, blockCount: i32, playerKnockback?: vec3f64, explosionParticle: Particle, sound: ItemSoundHolder, blockParticles: ExplosionParticleEntry[]}`.
   - **Movement / Input / Pick Item:** Removed `steer_vehicle` and `start_sneaking`/`stop_sneaking` from `entity_action`; added `player_input` bitflags (`forward, backward, left, right, jump, shift, sprint`). Split `pick_item` into `pick_item_from_block` and `pick_item_from_entity`.
   - **Chat & Component NBT:** `player_chat` added `globalIndex: varint` and both `player_chat`/`profileless_chat` switched `type` from `varint` to `ChatTypesHolder`; `chat_message`/`chat_command_signed` added trailing `checksum`; Component NBT (1.21.5+) switched `clickEvent`/`hoverEvent` to snake_case `click_event`/`hover_event` with restructured fields and added `shadow_color` and `object` components.
   - **Configuration & Dialogs / Code of Conduct / Debug / Waypoints:** Added `custom_report_details`, `server_links`, `clear_dialog`, `show_dialog`, `code_of_conduct`, `accept_code_of_conduct`, `custom_click_action`, `tracked_waypoint`, `debug_block_value`, `debug_chunk_value`, `debug_entity_value`, `debug_event`, `debug_subscription_request`, `set_cursor_item`, `set_player_inventory`, `select_bundle_item`, `change_gamemode`, `tick_end`, `player_loaded`, `move_minecart`, and test block packets (`game_test_highlight_pos`, `test_instance_block_status`, `set_test_block`, `test_instance_block_action`).

---

## 2. ProtoDef Constructor & Primitive Audit (`1.21.11` vs `play-codec-1.20.6.js` & `item-components-1.20.6.js`)

### 2.1 ProtoDef Constructors Comparison

| Constructor | 1.20.6 | 1.21.11 | `Slot`/`SlotComponent` (1.21.11) | `HashedSlot`/`UntrustedSlot` | `play-codec-1.20.6.js` | `item-components-1.20.6.js` | Notes / Behavioral Changes |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | --- |
| `array` | yes (2853 sites) | yes (6800 sites) | yes | yes | supported | supported | — |
| `bitfield` | yes (175 sites) | yes (392 sites) | yes | no | supported | supported | Play uses widths 8, 32, 64 (`play-codec` supports 8/16/32/64); `Slot` only uses 64 (`position`) (`item-components` only supports 64). |
| `bitflags` | yes (5 sites) | yes (24 sites) | no | no | supported | unsupported | `PositionUpdateRelatives` now uses `type: "u32"` (previously `u8`); `MovementFlags` & `player_input` use `u8`. |
| `buffer` | yes (49 sites) | yes (53 sites) | no | yes | supported | unsupported | Used by `ByteArray` (`UntrustedSlotComponent` in `set_creative_slot`); unsupported in `item-components-1.20.6.js`. |
| `container` | yes (5910 sites) | yes (18604 sites) | yes | yes | supported | supported | — |
| `entityMetadataLoop` | yes (3 sites) | yes (3 sites) | no | no | supported | unsupported | — |
| `mapper` | yes (711 sites) | yes (2437 sites) | yes | yes | supported | supported | — |
| `option` | yes (1611 sites) | yes (7789 sites) | yes | no | supported | supported | — |
| `pstring` | yes (3215 sites) | yes (11413 sites) | yes | no | supported | supported | All 1.21.11 usages have `countType: "varint"`. |
| `registryEntryHolder` | yes (457 sites) | yes (3055 sites) | yes | no | supported | supported | — |
| `registryEntryHolderSet` | yes (271 sites) | yes (1125 sites) | yes | no | supported | supported | — |
| `switch` | yes (540 sites) | yes (2281 sites) | yes | yes | supported | supported | 1.21.11 omits `default` in `attribute_modifiers[].display.component`, `server_links`, `tracked_waypoint`, `command_node` (6 parsers); `DebugSubscriptionUpdate` does parent lookup across `anon: true` container. |
| `topBitSetTerminatedArray` | yes (2 sites) | yes (2 sites) | no | no | supported | unsupported | — |

### 2.2 Primitives & Leaf Types Comparison

Comparing every leaf / `"native"` string type in `1.21.11` `protocol.json` against `play-codec-1.20.6.js` (`primitive()`), `item-components-1.20.6.js` (`primitiveRead()`/`primitiveWrite()`), and `buffer.js` (`Reader`/`Writer`):

| Leaf / Primitive Type | 1.20.6 `protocol.json` | 1.21.11 `protocol.json` | `Slot` / `Untrusted` / `Hashed` | `play-codec-1.20.6.js` | `item-components-1.20.6.js` | `buffer.js` Reader | Status / Notes |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | --- |
| `Slot` | defined in types | defined in types | no | yes | yes | via `item-components-1.20.6.js` | `itemCount` changed `i8 -> varint`; `item-components-1.20.6.js` `rawSlot()` checks `-128..127`. |
| `UUID` | yes (213) | yes (329) | yes | yes | yes | yes | — |
| `anonOptionalNbt` | yes (361) | yes (427) | yes | yes | yes | via `nbt-anonymous.js` | — |
| `anonymousNbt` | yes (1610) | yes (3446) | yes | yes | yes | via `nbt-anonymous.js` | — |
| `bool` | yes (2161) | yes (5952) | yes | yes | yes | yes | — |
| `f32` | yes (1068) | yes (7925) | yes | yes | yes | yes | — |
| `f64` | yes (197) | yes (350) | yes | yes | yes | yes | — |
| `i16` | yes (46) | yes (29) | no | yes | no | yes | — |
| `i32` | yes (712) | yes (1823) | yes | yes | yes | yes | — |
| `i64` | yes (74) | yes (76) | no | yes | yes | yes | — |
| `i8` | yes (193) | yes (72) | no | yes | yes | yes | Used in `Slot.itemCount` in 1.20.6 (changed to `varint` in 1.21.11); still used in `play` (`pitch`/`yaw`/etc.). |
| `lpVec3` | no | yes (4) | no | **NO** | no | **NO** | **NEW native type in 1.21.11**: used in `play.toClient.spawn_entity.velocity` and `play.toClient.entity_velocity.velocity` (replaced `vec3i16`). |
| `optvarint` | defined in types | defined in types | no | yes | named type | **NO** | Defined as `"varint"` in `types` (resolved as alias in 1.21.11; `play-codec` also accepts as primitive). |
| `position` | defined in types | defined in types | no | yes | yes | yes | — |
| `restBuffer` | yes (12) | yes (12) | no | yes | no | yes (`rest()`) | — |
| `string` | defined in types | defined in types | no | yes | yes | yes | — |
| `u16` | yes (2) | yes (2) | no | **NO** | no | yes | Used only in `handshaking.toServer.set_protocol.serverPort` (Reader has `u16()`, `play-codec` `primitive()` omits it). |
| `u32` | no | yes (5) | no | **NO** | no | **NO** | **NEW active usage in play**: `PositionUpdateRelatives` (`bitflags` of `u32`). `play-codec-1.20.6.js` throws (`Reader` lacks `u32()`). |
| `u8` | yes (82) | yes (79) | no | yes | no | yes | — |
| `varint` | yes (10501) | yes (33159) | yes | yes | yes | yes | — |
| `varlong` | yes (4) | yes (4) | no | yes | no | yes | — |
| `vec3f` | defined in types | defined in types | no | yes | named type | **NO** | Defined as `container` in `protocol.json` `types`, fast-pathed as primitives in `play-codec-1.20.6.js`. |
| `vec3f64` | defined in types | defined in types | no | yes | named type | **NO** | Defined as `container` in `protocol.json` `types`, fast-pathed as primitives in `play-codec-1.20.6.js`. |
| `vec3i16` | defined in types | no | no | yes | no | **NO** | Removed in 1.21.11 `protocol.json` (`types.vec3i16` deleted; replaced by `lpVec3`). |
| `vec4f` | defined in types | defined in types | no | yes | named type | **NO** | Defined as `container` in `protocol.json` `types`, fast-pathed as primitives in `play-codec-1.20.6.js`. |
| `void` | yes (686) | yes (1328) | yes | yes | yes | n/a | — |

### 2.3 Newly Discovered Runtime & Schema Edge Cases

1. **`lpVec3` (Native Packed Velocity Vector, 1.21.9+):** Marked `"native"` in `protocol.json`. Encodes `(x, y, z)` doubles as 1 byte (`0x00` if `max(|x|,|y|,|z|) < 1/32766`) or 6 bytes (2 header/scale bits + continuation flag + three 15-bit quantized components across 48 bits) plus an optional `VarInt` scale factor when `ceil(max) > 3`. Used in `spawn_entity` and `entity_velocity`.
2. **`u32` Primitive Missing in `play-codec-1.20.6.js` & `buffer.js`:** `PositionUpdateRelatives` changed from `bitflags(u8)` to `bitflags(u32)` (9 flags: `x, y, z, yaw, pitch, dx, dy, dz, yawDelta`). `play-codec-1.20.6.js` `primitive()` has no `u32` case and `buffer.js` `Reader` has no `u32()`.
3. **`switch` Without `default` Branch (Implicit `void`):** `1.21.11` contains `switch` definitions that omit `"default"`, relying on ProtoDef treating unmatched keys as `void`. In `1.20.6`, `generate-play-schema.mjs` patched `Particle.data` and 7 `command_node` parsers, while `play-codec-1.20.6.js` (line 144) and `item-components-1.20.6.js` (line 120) explicitly throw if no branch matches:
   - `types.SlotComponent.data?attribute_modifiers[].display.component`: only defines `"override": "anonymousNbt"` (`"default"` and `"hidden"` are unmatched).
   - `types.packet_common_server_links.links[].knownType`: only defines `"true"`; `unknownType`: only defines `"false"`.
   - `play.toClient.packet_tracked_waypoint.waypoint.data`: defines `"vec3i"`, `"chunk"`, `"azimuth"` (`"empty"` is unmatched).
   - `types.command_node.extraNodeData?2.properties`: defines 51 of 57 parsers; omits 6 context-aware singleton parsers (`minecraft:style`, `minecraft:nbt_tag`, `minecraft:item_slots`, `minecraft:loot_table`, `minecraft:loot_predicate`, `minecraft:loot_modifier`).
4. **Parent-Scope `switch` Lookup Inside `anon: true` Container:**
   - `types.DebugSubscriptionUpdate` reads `type` in the outer container, enters `{"anon": true, "type": ["switch", {..., "default": ["container", [{"name": "payload", "type": ["option", ["switch", {"compareTo": "type", ...}]]}]]}]}`, and switches on `compareTo: "type"` inside the inner container. `play-codec-1.20.6.js` `lookup()` checks only the innermost container frame and returns `undefined` unless parent scopes are searched.
5. **`Slot` / `UntrustedSlot` / `HashedSlot` in `item-components-1.20.6.js`:**
   - `Slot.itemCount` changed from `i8` to `varint` (`rawSlot()` enforces `item.count >= -128 && item.count <= 127`).
   - `UntrustedSlotComponent` (used in `set_creative_slot`) uses `ByteArray` (`["buffer", {"countType": "varint"}]`); `item-components-1.20.6.js` does not implement `buffer`.
   - `Slot` + `SlotComponent` itself uses only the 9 constructors and 9 primitives (`UUID`, `anonOptionalNbt`, `anonymousNbt`, `bool`, `f32`, `f64`, `i32`, `varint`, `void`) already supported in `item-components-1.20.6.js` (aside from `Slot.itemCount` `i8 -> varint` and `switch` without `default` in `attribute_modifiers[].display.component`).
6. **Bitfield Widths (`1.21.11`):** `play-codec-1.20.6.js` supports `8`, `16`, `32`, `64`. In `1.21.11`, all `bitfield` nodes are `8`, `32`, or `64` (`Slot` only uses 64-bit `position`).

---

## 3. Packet Inventory & Field-Level Diffs (All States & Directions)

### 3.1 Summary Table Across States

| State | Direction | 1.20.6 Packets | 1.21.11 Packets | Added | Removed | ID Shifted | Body Changed |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `handshaking` | `toClient` | 0 | 0 | 0 | 0 | 0 | 0 |
| `handshaking` | `toServer` | 2 | 2 | 0 | 0 | 0 | 0 |
| `status` | `toClient` | 2 | 2 | 0 | 0 | 0 | 0 |
| `status` | `toServer` | 2 | 2 | 0 | 0 | 0 | 0 |
| `login` | `toClient` | 6 | 6 | 0 | 0 | 0 | 1 |
| `login` | `toServer` | 5 | 5 | 0 | 0 | 0 | 0 |
| `configuration` | `toClient` | 15 | 20 | 5 | 0 | 0 | 0 |
| `configuration` | `toServer` | 8 | 10 | 2 | 0 | 0 | 1 |
| `play` | `toClient` | 122 | 139 | 19 | 2 | 118 | 22 |
| `play` | `toServer` | 58 | 66 | 11 | 3 | 53 | 19 |

### 3.2 Packet Renames & Conceptual Replacements

PrismarineJS `protocol.json` keeps stable Mojang-mapped packet names where possible, so the following removals/additions represent packet splits, merges, or replacements between `1.20.6` and `1.21.11`:

| State / Dir | 1.20.6 Packet(s) | 1.21.11 Packet(s) | Change Summary |
| --- | --- | --- | --- |
| `play.toClient` | `spawn_entity_experience_orb` (0x02 / 2) | Merged into `spawn_entity` (0x01 / 1) | Dedicated orb packet removed; experience orbs spawn via `spawn_entity` (data/metadata). |
| `play.toClient` | `unlock_recipes` (0x41 / 65) | `recipe_book_add` (72), `recipe_book_remove` (73), `recipe_book_settings` (74) | Replaced single string-ID unlock packet with structured `RecipeDisplay` additions, numeric ID removals, and 4 book settings (`crafting`, `furnace`, `blast`, `smoker`). |
| `play.toServer` | `debug_sample_subscription` (0x13 / 19) | `debug_subscription_request` (0x16 / 22) | Replaced single `varint` sample type with `array<DebugSubscriptionDataType>`. |
| `play.toServer` | `pick_item` (0x20 / 32) | `pick_item_from_block` (35), `pick_item_from_entity` (36) | Replaced hotbar-slot pick with server-authoritative block (`position, includeData`) and entity (`entityId, includeData`) pick requests. |
| `play.toServer` | `steer_vehicle` (0x26 / 38) | `player_input` (0x2A / 42) | Replaced float `sideways`/`forward`/`jump` packet with `bitflags(u8)` (`forward, backward, left, right, jump, shift, sprint`); also removed sneak actions from `entity_action`. |

### 3.3 `handshaking.toClient`

No packets in either `1.20.6` or `1.21.11`.

### 3.4 `handshaking.toServer`

Unchanged (2 packets): `0x00` (0) `set_protocol`, `0xfe` (254) `legacy_server_list_ping`.

### 3.5 `status.toClient`

Unchanged (2 packets): `0x00` (0) `server_info`, `0x01` (1) `ping`.

### 3.6 `status.toServer`

Unchanged (2 packets): `0x00` (0) `ping_start`, `0x01` (1) `ping`.

### 3.7 `login.toClient`

#### Complete `1.21.11` Packet ID Table (6 packets)

| ID (Hex / Dec) | Name | 1.20.6 ID | Status |
| --- | --- | --- | --- |
| `0x00` (0) | `disconnect` | `0x00` (0) | unchanged |
| `0x01` (1) | `encryption_begin` | `0x01` (1) | unchanged |
| `0x02` (2) | `success` | `0x02` (2) | **BODY CHANGED** |
| `0x03` (3) | `compress` | `0x03` (3) | unchanged |
| `0x04` (4) | `login_plugin_request` | `0x04` (4) | unchanged |
| `0x05` (5) | `cookie_request` | `0x05` (5) | unchanged |

#### Modified Packet Bodies (Field-Level Diffs)

- **`success`** (`2` -> `2`):
  - **REMOVED** `strictErrorHandling` (was pos 3): `bool`

### 3.8 `login.toServer`

Unchanged (5 packets): `0x00` (0) `login_start`, `0x01` (1) `encryption_begin`, `0x02` (2) `login_plugin_response`, `0x03` (3) `login_acknowledged`, `0x04` (4) `cookie_response`.

### 3.9 `configuration.toClient`

#### Complete `1.21.11` Packet ID Table (20 packets)

| ID (Hex / Dec) | Name | 1.20.6 ID | Status |
| --- | --- | --- | --- |
| `0x00` (0) | `cookie_request` | `0x00` (0) | unchanged |
| `0x01` (1) | `custom_payload` | `0x01` (1) | unchanged |
| `0x02` (2) | `disconnect` | `0x02` (2) | unchanged |
| `0x03` (3) | `finish_configuration` | `0x03` (3) | unchanged |
| `0x04` (4) | `keep_alive` | `0x04` (4) | unchanged |
| `0x05` (5) | `ping` | `0x05` (5) | unchanged |
| `0x06` (6) | `reset_chat` | `0x06` (6) | unchanged |
| `0x07` (7) | `registry_data` | `0x07` (7) | unchanged |
| `0x08` (8) | `remove_resource_pack` | `0x08` (8) | unchanged |
| `0x09` (9) | `add_resource_pack` | `0x09` (9) | unchanged |
| `0x0a` (10) | `store_cookie` | `0x0a` (10) | unchanged |
| `0x0b` (11) | `transfer` | `0x0b` (11) | unchanged |
| `0x0c` (12) | `feature_flags` | `0x0c` (12) | unchanged |
| `0x0d` (13) | `tags` | `0x0d` (13) | unchanged |
| `0x0e` (14) | `select_known_packs` | `0x0e` (14) | unchanged |
| `0x0f` (15) | `custom_report_details` | — | **ADDED** |
| `0x10` (16) | `server_links` | — | **ADDED** |
| `0x11` (17) | `clear_dialog` | — | **ADDED** |
| `0x12` (18) | `show_dialog` | — | **ADDED** |
| `0x13` (19) | `code_of_conduct` | — | **ADDED** |

#### Added Packets

- **`custom_report_details`** (`0x0f` / 15):
  - `details`: `["array",{"countType":"varint","type":["container",[{"name":"key","type":"string"},{"name":"value","type":"string"}]]}]`
- **`server_links`** (`0x10` / 16):
  - `links`: `["array",{"countType":"varint","type":["container",[{"name":"hasKnownType","type":"bool"},{"name":"knownType","type":["switch",{"compareTo":"hasKnownType","fields":{"true":"ServerLinkType"}}]},{"name":"unknownType","type":["switch",{"compareTo":"hasKnownType","fields":{"false":"anonymousNbt"}}]},{"name":"link","type":"string"}]]}]`
- **`clear_dialog`** (`0x11` / 17):
  - *(empty packet)*
- **`show_dialog`** (`0x12` / 18):
  - `dialog`: `anonymousNbt`
- **`code_of_conduct`** (`0x13` / 19):
  - `contents`: `string`

### 3.10 `configuration.toServer`

#### Complete `1.21.11` Packet ID Table (10 packets)

| ID (Hex / Dec) | Name | 1.20.6 ID | Status |
| --- | --- | --- | --- |
| `0x00` (0) | `settings` | `0x00` (0) | **BODY CHANGED** |
| `0x01` (1) | `cookie_response` | `0x01` (1) | unchanged |
| `0x02` (2) | `custom_payload` | `0x02` (2) | unchanged |
| `0x03` (3) | `finish_configuration` | `0x03` (3) | unchanged |
| `0x04` (4) | `keep_alive` | `0x04` (4) | unchanged |
| `0x05` (5) | `pong` | `0x05` (5) | unchanged |
| `0x06` (6) | `resource_pack_receive` | `0x06` (6) | unchanged |
| `0x07` (7) | `select_known_packs` | `0x07` (7) | unchanged |
| `0x08` (8) | `custom_click_action` | — | **ADDED** |
| `0x09` (9) | `accept_code_of_conduct` | — | **ADDED** |

#### Added Packets

- **`custom_click_action`** (`0x08` / 8):
  - `id`: `string`
  - `nbt`: `["option","anonymousNbt"]`
- **`accept_code_of_conduct`** (`0x09` / 9):
  - *(empty packet)*

#### Modified Packet Bodies (Field-Level Diffs)

- **`settings`** (`0` -> `0`):
  - **ADDED** `particleStatus` (pos 8): `["mapper",{"type":"varint","mappings":{"0":"all","1":"decreased","2":"minimal"}}]`

### 3.11 `play.toClient`

#### Complete `1.21.11` Packet ID Table (139 packets)

| ID (Hex / Dec) | Name | 1.20.6 ID | Status |
| --- | --- | --- | --- |
| `0x00` (0) | `bundle_delimiter` | `0x00` (0) | unchanged |
| `0x01` (1) | `spawn_entity` | `0x01` (1) | **BODY CHANGED** |
| `0x02` (2) | `animation` | `0x03` (3) | ID shifted |
| `0x03` (3) | `statistics` | `0x04` (4) | ID shifted |
| `0x04` (4) | `acknowledge_player_digging` | `0x05` (5) | ID shifted |
| `0x05` (5) | `block_break_animation` | `0x06` (6) | ID shifted |
| `0x06` (6) | `tile_entity_data` | `0x07` (7) | ID shifted |
| `0x07` (7) | `block_action` | `0x08` (8) | ID shifted |
| `0x08` (8) | `block_change` | `0x09` (9) | ID shifted |
| `0x09` (9) | `boss_bar` | `0x0a` (10) | ID shifted |
| `0x0a` (10) | `difficulty` | `0x0b` (11) | ID shifted, **BODY CHANGED** |
| `0x0b` (11) | `chunk_batch_finished` | `0x0c` (12) | ID shifted |
| `0x0c` (12) | `chunk_batch_start` | `0x0d` (13) | ID shifted |
| `0x0d` (13) | `chunk_biomes` | `0x0e` (14) | ID shifted |
| `0x0e` (14) | `clear_titles` | `0x0f` (15) | ID shifted |
| `0x0f` (15) | `tab_complete` | `0x10` (16) | ID shifted |
| `0x10` (16) | `declare_commands` | `0x11` (17) | ID shifted |
| `0x11` (17) | `close_window` | `0x12` (18) | ID shifted |
| `0x12` (18) | `window_items` | `0x13` (19) | ID shifted |
| `0x13` (19) | `craft_progress_bar` | `0x14` (20) | ID shifted |
| `0x14` (20) | `set_slot` | `0x15` (21) | ID shifted |
| `0x15` (21) | `cookie_request` | `0x16` (22) | ID shifted |
| `0x16` (22) | `set_cooldown` | `0x17` (23) | ID shifted, **BODY CHANGED** |
| `0x17` (23) | `chat_suggestions` | `0x18` (24) | ID shifted |
| `0x18` (24) | `custom_payload` | `0x19` (25) | ID shifted |
| `0x19` (25) | `damage_event` | `0x1a` (26) | ID shifted |
| `0x1a` (26) | `debug_block_value` | — | **ADDED** |
| `0x1b` (27) | `debug_chunk_value` | — | **ADDED** |
| `0x1c` (28) | `debug_entity_value` | — | **ADDED** |
| `0x1d` (29) | `debug_event` | — | **ADDED** |
| `0x1e` (30) | `debug_sample` | `0x1b` (27) | ID shifted |
| `0x1f` (31) | `hide_message` | `0x1c` (28) | ID shifted |
| `0x20` (32) | `kick_disconnect` | `0x1d` (29) | ID shifted |
| `0x21` (33) | `profileless_chat` | `0x1e` (30) | ID shifted, **BODY CHANGED** |
| `0x22` (34) | `entity_status` | `0x1f` (31) | ID shifted |
| `0x23` (35) | `sync_entity_position` | — | **ADDED** |
| `0x24` (36) | `explosion` | `0x20` (32) | ID shifted, **BODY CHANGED** |
| `0x25` (37) | `unload_chunk` | `0x21` (33) | ID shifted |
| `0x26` (38) | `game_state_change` | `0x22` (34) | ID shifted |
| `0x27` (39) | `game_test_highlight_pos` | — | **ADDED** |
| `0x28` (40) | `open_horse_window` | `0x23` (35) | ID shifted |
| `0x29` (41) | `hurt_animation` | `0x24` (36) | ID shifted |
| `0x2a` (42) | `initialize_world_border` | `0x25` (37) | ID shifted |
| `0x2b` (43) | `keep_alive` | `0x26` (38) | ID shifted |
| `0x2c` (44) | `map_chunk` | `0x27` (39) | ID shifted, **BODY CHANGED** |
| `0x2d` (45) | `world_event` | `0x28` (40) | ID shifted |
| `0x2e` (46) | `world_particles` | `0x29` (41) | ID shifted, **BODY CHANGED** |
| `0x2f` (47) | `update_light` | `0x2a` (42) | ID shifted |
| `0x30` (48) | `login` | `0x2b` (43) | ID shifted |
| `0x31` (49) | `map` | `0x2c` (44) | ID shifted |
| `0x32` (50) | `trade_list` | `0x2d` (45) | ID shifted, **BODY CHANGED** |
| `0x33` (51) | `rel_entity_move` | `0x2e` (46) | ID shifted |
| `0x34` (52) | `entity_move_look` | `0x2f` (47) | ID shifted |
| `0x35` (53) | `move_minecart` | — | **ADDED** |
| `0x36` (54) | `entity_look` | `0x30` (48) | ID shifted |
| `0x37` (55) | `vehicle_move` | `0x31` (49) | ID shifted |
| `0x38` (56) | `open_book` | `0x32` (50) | ID shifted |
| `0x39` (57) | `open_window` | `0x33` (51) | ID shifted |
| `0x3a` (58) | `open_sign_entity` | `0x34` (52) | ID shifted |
| `0x3b` (59) | `ping` | `0x35` (53) | ID shifted |
| `0x3c` (60) | `ping_response` | `0x36` (54) | ID shifted |
| `0x3d` (61) | `craft_recipe_response` | `0x37` (55) | ID shifted, **BODY CHANGED** |
| `0x3e` (62) | `abilities` | `0x38` (56) | ID shifted |
| `0x3f` (63) | `player_chat` | `0x39` (57) | ID shifted, **BODY CHANGED** |
| `0x40` (64) | `end_combat_event` | `0x3a` (58) | ID shifted |
| `0x41` (65) | `enter_combat_event` | `0x3b` (59) | ID shifted |
| `0x42` (66) | `death_combat_event` | `0x3c` (60) | ID shifted |
| `0x43` (67) | `player_remove` | `0x3d` (61) | ID shifted |
| `0x44` (68) | `player_info` | `0x3e` (62) | ID shifted, **BODY CHANGED** |
| `0x45` (69) | `face_player` | `0x3f` (63) | ID shifted |
| `0x46` (70) | `position` | `0x40` (64) | ID shifted, **BODY CHANGED** |
| `0x47` (71) | `player_rotation` | — | **ADDED** |
| `0x48` (72) | `recipe_book_add` | — | **ADDED** |
| `0x49` (73) | `recipe_book_remove` | — | **ADDED** |
| `0x4a` (74) | `recipe_book_settings` | — | **ADDED** |
| `0x4b` (75) | `entity_destroy` | `0x42` (66) | ID shifted |
| `0x4c` (76) | `remove_entity_effect` | `0x43` (67) | ID shifted |
| `0x4d` (77) | `reset_score` | `0x44` (68) | ID shifted |
| `0x4e` (78) | `remove_resource_pack` | `0x45` (69) | ID shifted |
| `0x4f` (79) | `add_resource_pack` | `0x46` (70) | ID shifted |
| `0x50` (80) | `respawn` | `0x47` (71) | ID shifted |
| `0x51` (81) | `entity_head_rotation` | `0x48` (72) | ID shifted |
| `0x52` (82) | `multi_block_change` | `0x49` (73) | ID shifted |
| `0x53` (83) | `select_advancement_tab` | `0x4a` (74) | ID shifted |
| `0x54` (84) | `server_data` | `0x4b` (75) | ID shifted |
| `0x55` (85) | `action_bar` | `0x4c` (76) | ID shifted |
| `0x56` (86) | `world_border_center` | `0x4d` (77) | ID shifted |
| `0x57` (87) | `world_border_lerp_size` | `0x4e` (78) | ID shifted |
| `0x58` (88) | `world_border_size` | `0x4f` (79) | ID shifted |
| `0x59` (89) | `world_border_warning_delay` | `0x50` (80) | ID shifted |
| `0x5a` (90) | `world_border_warning_reach` | `0x51` (81) | ID shifted |
| `0x5b` (91) | `camera` | `0x52` (82) | ID shifted |
| `0x5c` (92) | `update_view_position` | `0x54` (84) | ID shifted |
| `0x5d` (93) | `update_view_distance` | `0x55` (85) | ID shifted |
| `0x5e` (94) | `set_cursor_item` | — | **ADDED** |
| `0x5f` (95) | `spawn_position` | `0x56` (86) | ID shifted, **BODY CHANGED** |
| `0x60` (96) | `scoreboard_display_objective` | `0x57` (87) | ID shifted |
| `0x61` (97) | `entity_metadata` | `0x58` (88) | ID shifted |
| `0x62` (98) | `attach_entity` | `0x59` (89) | ID shifted |
| `0x63` (99) | `entity_velocity` | `0x5a` (90) | ID shifted, **BODY CHANGED** |
| `0x64` (100) | `entity_equipment` | `0x5b` (91) | ID shifted |
| `0x65` (101) | `experience` | `0x5c` (92) | ID shifted |
| `0x66` (102) | `update_health` | `0x5d` (93) | ID shifted |
| `0x67` (103) | `held_item_slot` | `0x53` (83) | ID shifted, **BODY CHANGED** |
| `0x68` (104) | `scoreboard_objective` | `0x5e` (94) | ID shifted |
| `0x69` (105) | `set_passengers` | `0x5f` (95) | ID shifted |
| `0x6a` (106) | `set_player_inventory` | — | **ADDED** |
| `0x6b` (107) | `teams` | `0x60` (96) | ID shifted, **BODY CHANGED** |
| `0x6c` (108) | `scoreboard_score` | `0x61` (97) | ID shifted |
| `0x6d` (109) | `simulation_distance` | `0x62` (98) | ID shifted |
| `0x6e` (110) | `set_title_subtitle` | `0x63` (99) | ID shifted |
| `0x6f` (111) | `update_time` | `0x64` (100) | ID shifted, **BODY CHANGED** |
| `0x70` (112) | `set_title_text` | `0x65` (101) | ID shifted |
| `0x71` (113) | `set_title_time` | `0x66` (102) | ID shifted |
| `0x72` (114) | `entity_sound_effect` | `0x67` (103) | ID shifted |
| `0x73` (115) | `sound_effect` | `0x68` (104) | ID shifted |
| `0x74` (116) | `start_configuration` | `0x69` (105) | ID shifted |
| `0x75` (117) | `stop_sound` | `0x6a` (106) | ID shifted |
| `0x76` (118) | `store_cookie` | `0x6b` (107) | ID shifted |
| `0x77` (119) | `system_chat` | `0x6c` (108) | ID shifted |
| `0x78` (120) | `playerlist_header` | `0x6d` (109) | ID shifted |
| `0x79` (121) | `nbt_query_response` | `0x6e` (110) | ID shifted |
| `0x7a` (122) | `collect` | `0x6f` (111) | ID shifted |
| `0x7b` (123) | `entity_teleport` | `0x70` (112) | ID shifted, **BODY CHANGED** |
| `0x7c` (124) | `test_instance_block_status` | — | **ADDED** |
| `0x7d` (125) | `set_ticking_state` | `0x71` (113) | ID shifted |
| `0x7e` (126) | `step_tick` | `0x72` (114) | ID shifted |
| `0x7f` (127) | `transfer` | `0x73` (115) | ID shifted |
| `0x80` (128) | `advancements` | `0x74` (116) | ID shifted, **BODY CHANGED** |
| `0x81` (129) | `entity_update_attributes` | `0x75` (117) | ID shifted, **BODY CHANGED** |
| `0x82` (130) | `entity_effect` | `0x76` (118) | ID shifted |
| `0x83` (131) | `declare_recipes` | `0x77` (119) | ID shifted, **BODY CHANGED** |
| `0x84` (132) | `tags` | `0x78` (120) | ID shifted |
| `0x85` (133) | `set_projectile_power` | `0x79` (121) | ID shifted, **BODY CHANGED** |
| `0x86` (134) | `custom_report_details` | — | **ADDED** |
| `0x87` (135) | `server_links` | — | **ADDED** |
| `0x88` (136) | `tracked_waypoint` | — | **ADDED** |
| `0x89` (137) | `clear_dialog` | — | **ADDED** |
| `0x8a` (138) | `show_dialog` | — | **ADDED** |

#### Removed Packets

- **`spawn_entity_experience_orb`** (was `0x02` / 2): `["container",[{"name":"entityId","type":"varint"},{"name":"x","type":"f64"},{"name":"y","type":"f64"},{"name":"z","type":"f64"},{"name":"count","type":"i16"}]]`
- **`unlock_recipes`** (was `0x41` / 65): `["container",[{"name":"action","type":"varint"},{"name":"craftingBookOpen","type":"bool"},{"name":"filteringCraftable","type":"bool"},{"name":"smeltingBookOpen","type":"bool"},{"name":"filteringSmeltable","type":"bool"},{"name":"blastFurnaceOpen","type":"bool"},{"name":"filteringBlastFurnace","type":"bool"},{"name":"smokerBookOpen","type":"bool"},{"name":"filteringSmoker","type":"bool"},{"name":"recipes1","type":["array",{"countType":"varint","type":"string"}]},{"name":"recipes2","type":["switch",{"compareTo":"action","fields":{"0":["array",{"countType":"varint","type":"string"}]},"default":"void"}]}]]`

#### Added Packets

- **`debug_block_value`** (`0x1a` / 26):
  - `blockPos`: `position`
  - `update`: `DebugSubscriptionUpdate`
- **`debug_chunk_value`** (`0x1b` / 27):
  - `chunkPos`: `packedChunkPos`
  - `update`: `DebugSubscriptionUpdate`
- **`debug_entity_value`** (`0x1c` / 28):
  - `entityId`: `varint`
  - `update`: `DebugSubscriptionUpdate`
- **`debug_event`** (`0x1d` / 29):
  - `event`: `DebugSubscriptionEvent`
- **`sync_entity_position`** (`0x23` / 35):
  - `entityId`: `varint`
  - `x`: `f64`
  - `y`: `f64`
  - `z`: `f64`
  - `dx`: `f64`
  - `dy`: `f64`
  - `dz`: `f64`
  - `yaw`: `f32`
  - `pitch`: `f32`
  - `onGround`: `bool`
- **`game_test_highlight_pos`** (`0x27` / 39):
  - `absolutePos`: `position`
  - `relativePos`: `position`
- **`move_minecart`** (`0x35` / 53):
  - `entityId`: `varint`
  - `steps`: `["array",{"countType":"varint","type":["container",[{"name":"position","type":"vec3f"},{"name":"velocity","type":"vec3f"},{"name":"yaw","type":"f32"},{"name":"pitch","type":"f32"},{"name":"weight","type":"f32"}]]}]`
- **`player_rotation`** (`0x47` / 71):
  - `yaw`: `f32`
  - `relativeYaw`: `bool`
  - `pitch`: `f32`
  - `relativePitch`: `bool`
- **`recipe_book_add`** (`0x48` / 72):
  - `entries`: `["array",{"countType":"varint","type":["container",[{"name":"recipe","type":["container",[{"name":"displayId","type":"varint"},{"name":"display","type":"RecipeDisplay"},{"name":"group","type":"optvarint"},{"name":"category","type":["mapper",{"type":"varint","mappings":{"0":"crafting_building_blocks","1":"crafting_redstone","2":"crafting_equipment","3":"crafting_misc","4":"furnace_food","5":"furnace_blocks","6":"furnace_misc","7":"blast_furnace_blocks","8":"blast_furnace_misc","9":"smoker_food","10":"stonecutter","11":"smithing","12":"campfire"}}]},{"name":"craftingRequirements","type":["option",["array",{"countType":"varint","type":"IDSet"}]]}]]},{"name":"flags","type":["bitflags",{"type":"u8","flags":["notification","highlight"]}]}]]}]`
  - `replace`: `bool`
- **`recipe_book_remove`** (`0x49` / 73):
  - `recipeIds`: `["array",{"countType":"varint","type":"varint"}]`
- **`recipe_book_settings`** (`0x4a` / 74):
  - `crafting`: `RecipeBookSetting`
  - `furnace`: `RecipeBookSetting`
  - `blast`: `RecipeBookSetting`
  - `smoker`: `RecipeBookSetting`
- **`set_cursor_item`** (`0x5e` / 94):
  - `contents`: `Slot`
- **`set_player_inventory`** (`0x6a` / 106):
  - `slotId`: `varint`
  - `contents`: `Slot`
- **`test_instance_block_status`** (`0x7c` / 124):
  - `status`: `anonymousNbt`
  - `size`: `["option","vec3i"]`
- **`custom_report_details`** (`0x86` / 134):
  - `details`: `["array",{"countType":"varint","type":["container",[{"name":"key","type":"string"},{"name":"value","type":"string"}]]}]`
- **`server_links`** (`0x87` / 135):
  - `links`: `["array",{"countType":"varint","type":["container",[{"name":"hasKnownType","type":"bool"},{"name":"knownType","type":["switch",{"compareTo":"hasKnownType","fields":{"true":"ServerLinkType"}}]},{"name":"unknownType","type":["switch",{"compareTo":"hasKnownType","fields":{"false":"anonymousNbt"}}]},{"name":"link","type":"string"}]]}]`
- **`tracked_waypoint`** (`0x88` / 136):
  - `operation`: `["mapper",{"type":"varint","mappings":{"0":"track","1":"untrack","2":"update"}}]`
  - `waypoint`: `["container",[{"name":"hasUUID","type":"bool"},{"anon":true,"type":["switch",{"compareTo":"hasUUID","fields":{"true":["container",[{"name":"uuid","type":"UUID"}]],"false":["container",[{"name":"id","type":"string"}]]}}]},{"name":"icon","type":["container",[{"name":"style","type":"string"},{"name":"color","type":["option",["container",[{"name":"red","type":"u8"},{"name":"green","type":"u8"},{"name":"blue","type":"u8"}]]]}]]},{"name":"type","type":["mapper",{"type":"varint","mappings":{"0":"empty","1":"vec3i","2":"chunk","3":"azimuth"}}]},{"name":"data","type":["switch",{"compareTo":"type","fields":{"vec3i":"vec3i","chunk":["container",[{"name":"chunkX","type":"varint"},{"name":"chunkZ","type":"varint"}]],"azimuth":"f32"}}]}]]`
- **`clear_dialog`** (`0x89` / 137):
  - *(empty packet)*
- **`show_dialog`** (`0x8a` / 138):
  - `dialog`: `["registryEntryHolder",{"baseName":"dialog","otherwise":{"name":"data","type":"anonymousNbt"}}]`

#### Modified Packet Bodies (Field-Level Diffs)

- **`spawn_entity`** (`1` -> `1`):
  - **CHANGED** `velocity` (moved pos 10 -> 6):
    - 1.20.6: `vec3i16`
    - 1.21.11: `lpVec3`
  - **MOVED** `pitch` (pos 6 -> 7): `i8`
  - **MOVED** `yaw` (pos 7 -> 8): `i8`
  - **MOVED** `headPitch` (pos 8 -> 9): `i8`
  - **MOVED** `objectData` (pos 9 -> 10): `varint`
- **`difficulty`** (`11` -> `10`):
  - **CHANGED** `difficulty`:
    - 1.20.6: `["mapper",{"type":"u8","mappings":{"0":"peaceful","1":"easy","2":"normal","3":"hard"}}]`
    - 1.21.11: `["mapper",{"type":"varint","mappings":{"0":"peaceful","1":"easy","2":"normal","3":"hard"}}]`
- **`set_cooldown`** (`23` -> `22`):
  - **ADDED** `cooldownGroup` (pos 0): `string`
  - **REMOVED** `itemID` (was pos 0): `varint`
- **`profileless_chat`** (`30` -> `33`):
  - **CHANGED** `type`:
    - 1.20.6: `varint`
    - 1.21.11: `ChatTypesHolder`
- **`explosion`** (`32` -> `36`):
  - **ADDED** `center` (pos 0): `vec3f64`
  - **MOVED** `radius` (pos 3 -> 1): `f32`
  - **ADDED** `blockCount` (pos 2): `i32`
  - **ADDED** `playerKnockback` (pos 3): `["option","vec3f64"]`
  - **ADDED** `explosionParticle` (pos 4): `Particle`
  - **MOVED** `sound` (pos 11 -> 5): `ItemSoundHolder`
  - **ADDED** `blockParticles` (pos 6): `["array",{"countType":"varint","type":"ExplosionParticleEntry"}]`
  - **REMOVED** `x` (was pos 0): `f64`
  - **REMOVED** `y` (was pos 1): `f64`
  - **REMOVED** `z` (was pos 2): `f64`
  - **REMOVED** `affectedBlockOffsets` (was pos 4): `["array",{"countType":"varint","type":["container",[{"name":"x","type":"i8"},{"name":"y","type":"i8"},{"name":"z","type":"i8"}]]}]`
  - **REMOVED** `playerMotionX` (was pos 5): `f32`
  - **REMOVED** `playerMotionY` (was pos 6): `f32`
  - **REMOVED** `playerMotionZ` (was pos 7): `f32`
  - **REMOVED** `block_interaction_type` (was pos 8): `varint`
  - **REMOVED** `small_explosion_particle` (was pos 9): `Particle`
  - **REMOVED** `large_explosion_particle` (was pos 10): `Particle`
- **`map_chunk`** (`39` -> `44`):
  - **CHANGED** `heightmaps`:
    - 1.20.6: `anonymousNbt`
    - 1.21.11: `["array",{"countType":"varint","type":["container",[{"name":"type","type":["mapper",{"type":"varint","mappings":{"0":"world_surface_wg","1":"world_surface","2":"ocean_floor_wg","3":"ocean_floor","4":"motion_blocking","5":"motion_blocking_no_leaves"}}]},{"name":"data","type":["array",{"countType":"varint","type":"i64"}]}]]}]`
  - **CHANGED** `chunkData`:
    - 1.20.6: `["buffer",{"countType":"varint"}]`
    - 1.21.11: `ByteArray`
- **`world_particles`** (`41` -> `46`):
  - **ADDED** `alwaysShow` (pos 1): `bool`
  - **MOVED** `x` (pos 1 -> 2): `f64`
  - **MOVED** `y` (pos 2 -> 3): `f64`
  - **MOVED** `z` (pos 3 -> 4): `f64`
  - **MOVED** `offsetX` (pos 4 -> 5): `f32`
  - **MOVED** `offsetY` (pos 5 -> 6): `f32`
  - **MOVED** `offsetZ` (pos 6 -> 7): `f32`
  - **MOVED** `velocityOffset` (pos 7 -> 8): `f32`
  - **MOVED** `amount` (pos 8 -> 9): `i32`
  - **MOVED** `particle` (pos 9 -> 10): `Particle`
- **`trade_list`** (`45` -> `50`):
  - **CHANGED** `trades`:
    - 1.20.6: `["array",{"countType":"varint","type":["container",[{"name":"inputItem1","type":["container",[{"name":"itemId","type":"varint"},{"name":"itemCount","type":"varint"},{"name":"addedComponentCount","type":"varint"},{"name":"components","type":["array",{"count":"addedComponentCount","type":"SlotComponent"}]}]]},{"name":"outputItem","type":"Slot"},{"name":"inputItem2","type":["option",["container",[{"name":"itemId","type":"varint"},{"name":"itemCount","type":"varint"},{"name":"addedComponentCount","type":"varint"},{"name":"components","type":["array",{"count":"addedComponentCount","type":"SlotComponent"}]}]]]},{"name":"tradeDisabled","type":"bool"},{"name":"nbTradeUses","type":"i32"},{"name":"maximumNbTradeUses","type":"i32"},{"name":"xp","type":"i32"},{"name":"specialPrice","type":"i32"},{"name":"priceMultiplier","type":"f32"},{"name":"demand","type":"i32"}]]}]`
    - 1.21.11: `["array",{"countType":"varint","type":["container",[{"name":"inputItem1","type":["container",[{"name":"itemId","type":"varint"},{"name":"itemCount","type":"varint"},{"name":"components","type":"ExactComponentMatcher"}]]},{"name":"outputItem","type":"Slot"},{"name":"inputItem2","type":["option",["container",[{"name":"itemId","type":"varint"},{"name":"itemCount","type":"varint"},{"name":"components","type":"ExactComponentMatcher"}]]]},{"name":"tradeDisabled","type":"bool"},{"name":"nbTradeUses","type":"i32"},{"name":"maximumNbTradeUses","type":"i32"},{"name":"xp","type":"i32"},{"name":"specialPrice","type":"i32"},{"name":"priceMultiplier","type":"f32"},{"name":"demand","type":"i32"}]]}]`
- **`craft_recipe_response`** (`55` -> `61`):
  - **ADDED** `recipeDisplay` (pos 1): `RecipeDisplay`
  - **REMOVED** `recipe` (was pos 1): `string`
- **`player_chat`** (`57` -> `63`):
  - **ADDED** `globalIndex` (pos 0): `varint`
  - **MOVED** `senderUuid` (pos 0 -> 1): `UUID`
  - **MOVED** `index` (pos 1 -> 2): `varint`
  - **MOVED** `signature` (pos 2 -> 3): `["option",["buffer",{"count":256}]]`
  - **MOVED** `plainMessage` (pos 3 -> 4): `string`
  - **MOVED** `timestamp` (pos 4 -> 5): `i64`
  - **MOVED** `salt` (pos 5 -> 6): `i64`
  - **MOVED** `previousMessages` (pos 6 -> 7): `previousMessages`
  - **MOVED** `unsignedChatContent` (pos 7 -> 8): `["option","anonymousNbt"]`
  - **MOVED** `filterType` (pos 8 -> 9): `varint`
  - **MOVED** `filterTypeMask` (pos 9 -> 10): `["switch",{"compareTo":"filterType","fields":{"2":["array",{"countType":"varint","type":"i64"}]},"default":"void"}]`
  - **CHANGED** `type` (moved pos 10 -> 11):
    - 1.20.6: `varint`
    - 1.21.11: `ChatTypesHolder`
  - **MOVED** `networkName` (pos 11 -> 12): `anonymousNbt`
  - **MOVED** `networkTargetName` (pos 12 -> 13): `["option","anonymousNbt"]`
- **`player_info`** (`62` -> `68`):
  - **CHANGED** `action`:
    - 1.20.6: `["bitflags",{"type":"u8","flags":["add_player","initialize_chat","update_game_mode","update_listed","update_latency","update_display_name"]}]`
    - 1.21.11: `["bitflags",{"type":"u8","flags":["add_player","initialize_chat","update_game_mode","update_listed","update_latency","update_display_name","update_hat","update_list_order"]}]`
  - **CHANGED** `data`:
    - 1.20.6: `["array",{"countType":"varint","type":["container",[{"name":"uuid","type":"UUID"},{"name":"player","type":["switch",{"compareTo":"../action/add_player","fields":{"true":"game_profile"},"default":"void"}]},{"name":"chatSession","type":["switch",{"compareTo":"../action/initialize_chat","fields":{"true":"chat_session"},"default":"void"}]},{"name":"gamemode","type":["switch",{"compareTo":"../action/update_game_mode","fields":{"true":"varint"},"default":"void"}]},{"name":"listed","type":["switch",{"compareTo":"../action/update_listed","fields":{"true":"varint"},"default":"void"}]},{"name":"latency","type":["switch",{"compareTo":"../action/update_latency","fields":{"true":"varint"},"default":"void"}]},{"name":"displayName","type":["switch",{"compareTo":"../action/update_display_name","fields":{"true":["option","anonymousNbt"]},"default":"void"}]}]]}]`
    - 1.21.11: `["array",{"countType":"varint","type":["container",[{"name":"uuid","type":"UUID"},{"name":"player","type":["switch",{"compareTo":"../action/add_player","fields":{"true":"game_profile_name_prop"},"default":"void"}]},{"name":"chatSession","type":["switch",{"compareTo":"../action/initialize_chat","fields":{"true":"chat_session"},"default":"void"}]},{"name":"gamemode","type":["switch",{"compareTo":"../action/update_game_mode","fields":{"true":"varint"},"default":"void"}]},{"name":"listed","type":["switch",{"compareTo":"../action/update_listed","fields":{"true":"varint"},"default":"void"}]},{"name":"latency","type":["switch",{"compareTo":"../action/update_latency","fields":{"true":"varint"},"default":"void"}]},{"name":"displayName","type":["switch",{"compareTo":"../action/update_display_name","fields":{"true":["option","anonymousNbt"]},"default":"void"}]},{"name":"listPriority","type":["switch",{"compareTo":"../action/update_list_order","fields":{"true":"varint"},"default":"void"}]},{"name":"showHat","type":["switch",{"compareTo":"../action/update_hat","fields":{"true":"bool"},"default":"void"}]}]]}]`
- **`position`** (`64` -> `70`):
  - **MOVED** `teleportId` (pos 6 -> 0): `varint`
  - **MOVED** `x` (pos 0 -> 1): `f64`
  - **MOVED** `y` (pos 1 -> 2): `f64`
  - **MOVED** `z` (pos 2 -> 3): `f64`
  - **ADDED** `dx` (pos 4): `f64`
  - **ADDED** `dy` (pos 5): `f64`
  - **ADDED** `dz` (pos 6): `f64`
  - **MOVED** `yaw` (pos 3 -> 7): `f32`
  - **MOVED** `pitch` (pos 4 -> 8): `f32`
  - **MOVED** `flags` (pos 5 -> 9): `PositionUpdateRelatives`
- **`spawn_position`** (`86` -> `95`):
  - 1.20.6: `["container",[{"name":"location","type":"position"},{"name":"angle","type":"f32"}]]`
  - 1.21.11: `RespawnData`
- **`entity_velocity`** (`90` -> `99`):
  - **CHANGED** `velocity`:
    - 1.20.6: `vec3i16`
    - 1.21.11: `lpVec3`
- **`held_item_slot`** (`83` -> `103`):
  - **CHANGED** `slot`:
    - 1.20.6: `i8`
    - 1.21.11: `varint`
- **`teams`** (`96` -> `107`):
  - **CHANGED** `mode`:
    - 1.20.6: `i8`
    - 1.21.11: `["mapper",{"type":"i8","mappings":{"0":"add","1":"remove","2":"change","3":"join","4":"leave"}}]`
  - **ADDED** `@anon_2` (pos 2): `["switch",{"compareTo":"mode","fields":{"add":["container",[{"name":"name","type":"anonymousNbt"},{"name":"flags","type":["bitflags",{"type":"u8","flags":["friendly_fire","see_friendly_invisible"]}]},{"name":"nameTagVisibility","type":["mapper",{"type":"varint","mappings":{"0":"always","1":"never","2":"hide_for_other_teams","3":"hide_for_own_team"}}]},{"name":"collisionRule","type":["mapper",{"type":"varint","mappings":{"0":"always","1":"never","2":"push_other_teams","3":"push_own_team"}}]},{"name":"formatting","type":"varint"},{"name":"prefix","type":"anonymousNbt"},{"name":"suffix","type":"anonymousNbt"}]],"change":["container",[{"name":"name","type":"anonymousNbt"},{"name":"flags","type":["bitflags",{"type":"u8","flags":["friendly_fire","see_friendly_invisible"]}]},{"name":"nameTagVisibility","type":["mapper",{"type":"varint","mappings":{"0":"always","1":"never","2":"hide_for_other_teams","3":"hide_for_own_team"}}]},{"name":"collisionRule","type":["mapper",{"type":"varint","mappings":{"0":"always","1":"never","2":"push_other_teams","3":"push_own_team"}}]},{"name":"formatting","type":"varint"},{"name":"prefix","type":"anonymousNbt"},{"name":"suffix","type":"anonymousNbt"}]]},"default":"void"}]`
  - **CHANGED** `players` (moved pos 9 -> 3):
    - 1.20.6: `["switch",{"compareTo":"mode","fields":{"0":["array",{"countType":"varint","type":"string"}],"3":["array",{"countType":"varint","type":"string"}],"4":["array",{"countType":"varint","type":"string"}]},"default":"void"}]`
    - 1.21.11: `["switch",{"compareTo":"mode","fields":{"add":["array",{"countType":"varint","type":"string"}],"join":["array",{"countType":"varint","type":"string"}],"leave":["array",{"countType":"varint","type":"string"}]},"default":"void"}]`
  - **REMOVED** `name` (was pos 2): `["switch",{"compareTo":"mode","fields":{"0":"anonymousNbt","2":"anonymousNbt"},"default":"void"}]`
  - **REMOVED** `friendlyFire` (was pos 3): `["switch",{"compareTo":"mode","fields":{"0":"i8","2":"i8"},"default":"void"}]`
  - **REMOVED** `nameTagVisibility` (was pos 4): `["switch",{"compareTo":"mode","fields":{"0":"string","2":"string"},"default":"void"}]`
  - **REMOVED** `collisionRule` (was pos 5): `["switch",{"compareTo":"mode","fields":{"0":"string","2":"string"},"default":"void"}]`
  - **REMOVED** `formatting` (was pos 6): `["switch",{"compareTo":"mode","fields":{"0":"varint","2":"varint"},"default":"void"}]`
  - **REMOVED** `prefix` (was pos 7): `["switch",{"compareTo":"mode","fields":{"0":"anonymousNbt","2":"anonymousNbt"},"default":"void"}]`
  - **REMOVED** `suffix` (was pos 8): `["switch",{"compareTo":"mode","fields":{"0":"anonymousNbt","2":"anonymousNbt"},"default":"void"}]`
- **`update_time`** (`100` -> `111`):
  - **ADDED** `tickDayTime` (pos 2): `bool`
- **`entity_teleport`** (`112` -> `123`):
  - **ADDED** `dx` (pos 4): `f64`
  - **ADDED** `dy` (pos 5): `f64`
  - **ADDED** `dz` (pos 6): `f64`
  - **CHANGED** `yaw` (moved pos 4 -> 7):
    - 1.20.6: `i8`
    - 1.21.11: `f32`
  - **CHANGED** `pitch` (moved pos 5 -> 8):
    - 1.20.6: `i8`
    - 1.21.11: `f32`
  - **ADDED** `flags` (pos 9): `PositionUpdateRelatives`
  - **MOVED** `onGround` (pos 6 -> 10): `bool`
- **`advancements`** (`116` -> `128`):
  - **ADDED** `showAdvancements` (pos 4): `bool`
- **`entity_update_attributes`** (`117` -> `129`):
  - **CHANGED** `properties`:
    - 1.20.6: `["array",{"countType":"varint","type":["container",[{"name":"key","type":["mapper",{"type":"varint","mappings":{"0":"generic.armor","1":"generic.armor_toughness","2":"generic.attack_damage","3":"generic.attack_knockback","4":"generic.attack_speed","5":"player.block_break_speed","6":"player.block_interaction_range","7":"player.entity_interaction_range","8":"generic.fall_damage_multiplier","9":"generic.flying_speed","10":"generic.follow_range","11":"generic.gravity","12":"generic.jump_strength","13":"generic.knockback_resistance","14":"generic.luck","15":"generic.max_absorption","16":"generic.max_health","17":"generic.movement_speed","18":"generic.safe_fall_distance","19":"generic.scale","20":"zombie.spawn_reinforcements","21":"generic.step_height"}}]},{"name":"value","type":"f64"},{"name":"modifiers","type":["array",{"countType":"varint","type":["container",[{"name":"uuid","type":"UUID"},{"name":"amount","type":"f64"},{"name":"operation","type":"i8"}]]}]}]]}]`
    - 1.21.11: `["array",{"countType":"varint","type":["container",[{"name":"key","type":["mapper",{"type":"varint","mappings":{"0":"generic.armor","1":"generic.armor_toughness","2":"generic.attack_damage","3":"generic.attack_knockback","4":"generic.attack_speed","5":"player.block_break_speed","6":"player.block_interaction_range","7":"burning_time","8":"camera_distance","9":"explosion_knockback_resistance","10":"player.entity_interaction_range","11":"generic.fall_damage_multiplier","12":"generic.flying_speed","13":"generic.follow_range","14":"generic.gravity","15":"generic.jump_strength","16":"generic.knockback_resistance","17":"generic.luck","18":"generic.max_absorption","19":"generic.max_health","20":"mining_efficiency","21":"movement_efficiency","22":"generic.movement_speed","23":"oxygen_bonus","24":"generic.safe_fall_distance","25":"generic.scale","26":"sneaking_speed","27":"zombie.spawn_reinforcements","28":"generic.step_height","29":"submerged_mining_speed","30":"sweeping_damage_ratio","31":"tempt_range","32":"water_movement_efficiency","33":"waypoint_transmit_range","34":"waypoint_receive_range"}}]},{"name":"value","type":"f64"},{"name":"modifiers","type":["array",{"countType":"varint","type":["container",[{"name":"uuid","type":"string"},{"name":"amount","type":"f64"},{"name":"operation","type":"i8"}]]}]}]]}]`
- **`declare_recipes`** (`119` -> `131`):
  - **CHANGED** `recipes`:
    - 1.20.6: `["array",{"countType":"varint","type":["container",[{"name":"name","type":"string"},{"name":"type","type":["mapper",{"type":"varint","mappings":{"0":"minecraft:crafting_shaped","1":"minecraft:crafting_shapeless","2":"minecraft:crafting_special_armordye","3":"minecraft:crafting_special_bookcloning","4":"minecraft:crafting_special_mapcloning","5":"minecraft:crafting_special_mapextending","6":"minecraft:crafting_special_firework_rocket","7":"minecraft:crafting_special_firework_star","8":"minecraft:crafting_special_firework_star_fade","9":"minecraft:crafting_special_tippedarrow","10":"minecraft:crafting_special_bannerduplicate","11":"minecraft:crafting_special_banneraddpattern","12":"minecraft:crafting_special_shielddecoration","13":"minecraft:crafting_special_shulkerboxcoloring","14":"minecraft:crafting_special_suspiciousstew","15":"minecraft:crafting_special_repairitem","16":"minecraft:smelting","17":"minecraft:blasting","18":"minecraft:smoking","19":"minecraft:campfire_cooking","20":"minecraft:stonecutting","21":"minecraft:smithing_transform","22":"minecraft:smithing_trim","23":"minecraft:crafting_decorated_pot"}}]},{"name":"data","type":["switch",{"compareTo":"type","fields":{"minecraft:crafting_shapeless":["container",[{"name":"group","type":"string"},{"name":"category","type":"varint"},{"name":"ingredients","type":["array",{"countType":"varint","type":"ingredient"}]},{"name":"result","type":"Slot"}]],"minecraft:crafting_shaped":["container",[{"name":"group","type":"string"},{"name":"category","type":"varint"},{"name":"gridWidth","type":"varint"},{"name":"gridHeight","type":"varint"},{"name":"ingredients","type":["array",{"count":"gridWidth","type":["array",{"count":"gridHeight","type":"ingredient"}]}]},{"name":"result","type":"Slot"},{"name":"showNotification","type":"bool"}]],"minecraft:crafting_special_armordye":"minecraft_simple_recipe_format","minecraft:crafting_special_bookcloning":"minecraft_simple_recipe_format","minecraft:crafting_special_mapcloning":"minecraft_simple_recipe_format","minecraft:crafting_special_mapextending":"minecraft_simple_recipe_format","minecraft:crafting_special_firework_rocket":"minecraft_simple_recipe_format","minecraft:crafting_special_firework_star":"minecraft_simple_recipe_format","minecraft:crafting_special_firework_star_fade":"minecraft_simple_recipe_format","minecraft:crafting_special_repairitem":"minecraft_simple_recipe_format","minecraft:crafting_special_tippedarrow":"minecraft_simple_recipe_format","minecraft:crafting_special_bannerduplicate":"minecraft_simple_recipe_format","minecraft:crafting_special_banneraddpattern":"minecraft_simple_recipe_format","minecraft:crafting_special_shielddecoration":"minecraft_simple_recipe_format","minecraft:crafting_special_shulkerboxcoloring":"minecraft_simple_recipe_format","minecraft:crafting_special_suspiciousstew":"minecraft_simple_recipe_format","minecraft:smelting":"minecraft_smelting_format","minecraft:blasting":"minecraft_smelting_format","minecraft:smoking":"minecraft_smelting_format","minecraft:campfire_cooking":"minecraft_smelting_format","minecraft:stonecutting":["container",[{"name":"group","type":"string"},{"name":"ingredient","type":"ingredient"},{"name":"result","type":"Slot"}]],"minecraft:smithing_transform":["container",[{"name":"template","type":"ingredient"},{"name":"base","type":"ingredient"},{"name":"addition","type":"ingredient"},{"name":"result","type":"Slot"}]],"minecraft:smithing_trim":["container",[{"name":"template","type":"ingredient"},{"name":"base","type":"ingredient"},{"name":"addition","type":"ingredient"}]],"minecraft:crafting_decorated_pot":"minecraft_simple_recipe_format"}}]}]]}]`
    - 1.21.11: `["array",{"countType":"varint","type":["container",[{"name":"name","type":"string"},{"name":"items","type":["array",{"countType":"varint","type":"varint"}]}]]}]`
  - **ADDED** `stoneCutterRecipes` (pos 1): `["array",{"countType":"varint","type":["container",[{"name":"input","type":"IDSet"},{"name":"slotDisplay","type":"SlotDisplay"}]]}]`
- **`set_projectile_power`** (`121` -> `133`):
  - **ADDED** `accelerationPower` (pos 1): `f64`
  - **REMOVED** `power` (was pos 1): `vec3f64`

### 3.12 `play.toServer`

#### Complete `1.21.11` Packet ID Table (66 packets)

| ID (Hex / Dec) | Name | 1.20.6 ID | Status |
| --- | --- | --- | --- |
| `0x00` (0) | `teleport_confirm` | `0x00` (0) | unchanged |
| `0x01` (1) | `query_block_nbt` | `0x01` (1) | unchanged |
| `0x02` (2) | `select_bundle_item` | — | **ADDED** |
| `0x03` (3) | `set_difficulty` | `0x02` (2) | ID shifted, **BODY CHANGED** |
| `0x04` (4) | `change_gamemode` | — | **ADDED** |
| `0x05` (5) | `message_acknowledgement` | `0x03` (3) | ID shifted |
| `0x06` (6) | `chat_command` | `0x04` (4) | ID shifted |
| `0x07` (7) | `chat_command_signed` | `0x05` (5) | ID shifted, **BODY CHANGED** |
| `0x08` (8) | `chat_message` | `0x06` (6) | ID shifted, **BODY CHANGED** |
| `0x09` (9) | `chat_session_update` | `0x07` (7) | ID shifted |
| `0x0a` (10) | `chunk_batch_received` | `0x08` (8) | ID shifted |
| `0x0b` (11) | `client_command` | `0x09` (9) | ID shifted |
| `0x0c` (12) | `tick_end` | — | **ADDED** |
| `0x0d` (13) | `settings` | `0x0a` (10) | ID shifted, **BODY CHANGED** |
| `0x0e` (14) | `tab_complete` | `0x0b` (11) | ID shifted |
| `0x0f` (15) | `configuration_acknowledged` | `0x0c` (12) | ID shifted |
| `0x10` (16) | `enchant_item` | `0x0d` (13) | ID shifted, **BODY CHANGED** |
| `0x11` (17) | `window_click` | `0x0e` (14) | ID shifted, **BODY CHANGED** |
| `0x12` (18) | `close_window` | `0x0f` (15) | ID shifted |
| `0x13` (19) | `set_slot_state` | `0x10` (16) | ID shifted, **BODY CHANGED** |
| `0x14` (20) | `cookie_response` | `0x11` (17) | ID shifted |
| `0x15` (21) | `custom_payload` | `0x12` (18) | ID shifted |
| `0x16` (22) | `debug_subscription_request` | — | **ADDED** |
| `0x17` (23) | `edit_book` | `0x14` (20) | ID shifted |
| `0x18` (24) | `query_entity_nbt` | `0x15` (21) | ID shifted |
| `0x19` (25) | `use_entity` | `0x16` (22) | ID shifted |
| `0x1a` (26) | `generate_structure` | `0x17` (23) | ID shifted |
| `0x1b` (27) | `keep_alive` | `0x18` (24) | ID shifted |
| `0x1c` (28) | `lock_difficulty` | `0x19` (25) | ID shifted |
| `0x1d` (29) | `position` | `0x1a` (26) | ID shifted, **BODY CHANGED** |
| `0x1e` (30) | `position_look` | `0x1b` (27) | ID shifted, **BODY CHANGED** |
| `0x1f` (31) | `look` | `0x1c` (28) | ID shifted, **BODY CHANGED** |
| `0x20` (32) | `flying` | `0x1d` (29) | ID shifted, **BODY CHANGED** |
| `0x21` (33) | `vehicle_move` | `0x1e` (30) | ID shifted, **BODY CHANGED** |
| `0x22` (34) | `steer_boat` | `0x1f` (31) | ID shifted |
| `0x23` (35) | `pick_item_from_block` | — | **ADDED** |
| `0x24` (36) | `pick_item_from_entity` | — | **ADDED** |
| `0x25` (37) | `ping_request` | `0x21` (33) | ID shifted |
| `0x26` (38) | `craft_recipe_request` | `0x22` (34) | ID shifted, **BODY CHANGED** |
| `0x27` (39) | `abilities` | `0x23` (35) | ID shifted |
| `0x28` (40) | `block_dig` | `0x24` (36) | ID shifted |
| `0x29` (41) | `entity_action` | `0x25` (37) | ID shifted, **BODY CHANGED** |
| `0x2a` (42) | `player_input` | — | **ADDED** |
| `0x2b` (43) | `player_loaded` | — | **ADDED** |
| `0x2c` (44) | `pong` | `0x27` (39) | ID shifted |
| `0x2d` (45) | `recipe_book` | `0x28` (40) | ID shifted |
| `0x2e` (46) | `displayed_recipe` | `0x29` (41) | ID shifted, **BODY CHANGED** |
| `0x2f` (47) | `name_item` | `0x2a` (42) | ID shifted |
| `0x30` (48) | `resource_pack_receive` | `0x2b` (43) | ID shifted |
| `0x31` (49) | `advancement_tab` | `0x2c` (44) | ID shifted |
| `0x32` (50) | `select_trade` | `0x2d` (45) | ID shifted |
| `0x33` (51) | `set_beacon_effect` | `0x2e` (46) | ID shifted |
| `0x34` (52) | `held_item_slot` | `0x2f` (47) | ID shifted |
| `0x35` (53) | `update_command_block` | `0x30` (48) | ID shifted |
| `0x36` (54) | `update_command_block_minecart` | `0x31` (49) | ID shifted |
| `0x37` (55) | `set_creative_slot` | `0x32` (50) | ID shifted, **BODY CHANGED** |
| `0x38` (56) | `update_jigsaw_block` | `0x33` (51) | ID shifted |
| `0x39` (57) | `update_structure_block` | `0x34` (52) | ID shifted, **BODY CHANGED** |
| `0x3a` (58) | `set_test_block` | — | **ADDED** |
| `0x3b` (59) | `update_sign` | `0x35` (53) | ID shifted |
| `0x3c` (60) | `arm_animation` | `0x36` (54) | ID shifted |
| `0x3d` (61) | `spectate` | `0x37` (55) | ID shifted |
| `0x3e` (62) | `test_instance_block_action` | — | **ADDED** |
| `0x3f` (63) | `block_place` | `0x38` (56) | ID shifted, **BODY CHANGED** |
| `0x40` (64) | `use_item` | `0x39` (57) | ID shifted, **BODY CHANGED** |
| `0x41` (65) | `custom_click_action` | — | **ADDED** |

#### Removed Packets

- **`debug_sample_subscription`** (was `0x13` / 19): `["container",[{"name":"type","type":"varint"}]]`
- **`pick_item`** (was `0x20` / 32): `["container",[{"name":"slot","type":"varint"}]]`
- **`steer_vehicle`** (was `0x26` / 38): `["container",[{"name":"sideways","type":"f32"},{"name":"forward","type":"f32"},{"name":"jump","type":"u8"}]]`

#### Added Packets

- **`select_bundle_item`** (`0x02` / 2):
  - `slotId`: `varint`
  - `selectedItemIndex`: `varint`
- **`change_gamemode`** (`0x04` / 4):
  - `mode`: `["mapper",{"type":"varint","mappings":{"0":"survival","1":"creative","2":"adventure","3":"spectator"}}]`
- **`tick_end`** (`0x0c` / 12):
  - *(empty packet)*
- **`debug_subscription_request`** (`0x16` / 22):
  - `subscriptions`: `["array",{"countType":"varint","type":"DebugSubscriptionDataType"}]`
- **`pick_item_from_block`** (`0x23` / 35):
  - `position`: `position`
  - `includeData`: `bool`
- **`pick_item_from_entity`** (`0x24` / 36):
  - `entityId`: `varint`
  - `includeData`: `bool`
- **`player_input`** (`0x2a` / 42):
  - `inputs`: `["bitflags",{"type":"u8","flags":["forward","backward","left","right","jump","shift","sprint"]}]`
- **`player_loaded`** (`0x2b` / 43):
  - *(empty packet)*
- **`set_test_block`** (`0x3a` / 58):
  - `position`: `position`
  - `mode`: `varint`
  - `message`: `string`
- **`test_instance_block_action`** (`0x3e` / 62):
  - `pos`: `position`
  - `action`: `varint`
  - `data`: `["container",[{"name":"test","type":["option","string"]},{"name":"size","type":"vec3i"},{"name":"rotation","type":"varint"},{"name":"ignoreEntities","type":"bool"},{"name":"status","type":"varint"},{"name":"errorMessage","type":["option","anonymousNbt"]}]]`
- **`custom_click_action`** (`0x41` / 65):
  - `id`: `string`
  - `nbt`: `["option","anonymousNbt"]`

#### Modified Packet Bodies (Field-Level Diffs)

- **`set_difficulty`** (`2` -> `3`):
  - **CHANGED** `newDifficulty`:
    - 1.20.6: `["mapper",{"type":"u8","mappings":{"0":"peaceful","1":"easy","2":"normal","3":"hard"}}]`
    - 1.21.11: `["mapper",{"type":"varint","mappings":{"0":"peaceful","1":"easy","2":"normal","3":"hard"}}]`
- **`chat_command_signed`** (`5` -> `7`):
  - **ADDED** `checksum` (pos 6): `i8`
- **`chat_message`** (`6` -> `8`):
  - **ADDED** `checksum` (pos 6): `u8`
- **`settings`** (`10` -> `13`):
  - **ADDED** `particleStatus` (pos 8): `["mapper",{"type":"varint","mappings":{"0":"all","1":"decreased","2":"minimal"}}]`
- **`enchant_item`** (`13` -> `16`):
  - **CHANGED** `windowId`:
    - 1.20.6: `i8`
    - 1.21.11: `ContainerID`
- **`window_click`** (`14` -> `17`):
  - **CHANGED** `changedSlots`:
    - 1.20.6: `["array",{"countType":"varint","type":["container",[{"name":"location","type":"i16"},{"name":"item","type":"Slot"}]]}]`
    - 1.21.11: `["array",{"countType":"varint","type":["container",[{"name":"location","type":"i16"},{"name":"item","type":["option","HashedSlot"]}]]}]`
  - **CHANGED** `cursorItem`:
    - 1.20.6: `Slot`
    - 1.21.11: `["option","HashedSlot"]`
- **`set_slot_state`** (`16` -> `19`):
  - **CHANGED** `window_id`:
    - 1.20.6: `varint`
    - 1.21.11: `ContainerID`
- **`position`** (`26` -> `29`):
  - **ADDED** `flags` (pos 3): `MovementFlags`
  - **REMOVED** `onGround` (was pos 3): `bool`
- **`position_look`** (`27` -> `30`):
  - **ADDED** `flags` (pos 5): `MovementFlags`
  - **REMOVED** `onGround` (was pos 5): `bool`
- **`look`** (`28` -> `31`):
  - **ADDED** `flags` (pos 2): `MovementFlags`
  - **REMOVED** `onGround` (was pos 2): `bool`
- **`flying`** (`29` -> `32`):
  - **ADDED** `flags` (pos 0): `MovementFlags`
  - **REMOVED** `onGround` (was pos 0): `bool`
- **`vehicle_move`** (`30` -> `33`):
  - **ADDED** `onGround` (pos 5): `bool`
- **`craft_recipe_request`** (`34` -> `38`):
  - **CHANGED** `windowId`:
    - 1.20.6: `i8`
    - 1.21.11: `ContainerID`
  - **ADDED** `recipeId` (pos 1): `varint`
  - **REMOVED** `recipe` (was pos 1): `string`
- **`entity_action`** (`37` -> `41`):
  - **CHANGED** `actionId`:
    - 1.20.6: `["mapper",{"type":"varint","mappings":{"0":"start_sneaking","1":"stop_sneaking","2":"stop_sleeping","3":"start_sprinting","4":"stop_sprinting","5":"start_riding_jump","6":"stop_riding_jump","7":"open_inventory","8":"start_fall_flying"}}]`
    - 1.21.11: `["mapper",{"type":"varint","mappings":{"0":"stop_sleeping","1":"start_sprinting","2":"stop_sprinting","3":"start_riding_jump","4":"stop_riding_jump","5":"open_inventory","6":"start_fall_flying"}}]`
- **`displayed_recipe`** (`41` -> `46`):
  - **CHANGED** `recipeId`:
    - 1.20.6: `string`
    - 1.21.11: `varint`
- **`set_creative_slot`** (`50` -> `55`):
  - **CHANGED** `item`:
    - 1.20.6: `Slot`
    - 1.21.11: `UntrustedSlot`
- **`update_structure_block`** (`52` -> `57`):
  - **CHANGED** `flags`:
    - 1.20.6: `u8`
    - 1.21.11: `["mapper",{"type":"u8","mappings":{"0":"ignore_entities","1":"show_air","2":"show_bounding_box","3":"strict"}}]`
- **`block_place`** (`56` -> `63`):
  - **ADDED** `worldBorderHit` (pos 7): `bool`
  - **MOVED** `sequence` (pos 7 -> 8): `varint`
- **`use_item`** (`57` -> `64`):
  - **ADDED** `rotation` (pos 2): `vec2f`

---

## 4. Schema `types` Differences & Subsystem Deep Dives

### 4.1 Top-Level `types` Inventory (81 -> 108)

- **Added (32):** `lpVec3`, `vec2f`, `vec3i`, `vec3i32`, `ExactComponentMatcher`, `DataComponentMatchers`, `ItemConsumeEffect`, `JukeboxSongData`, `KineticWeaponCondition`, `UntrustedSlotComponent`, `UntrustedSlot`, `HashedSlot`, `RespawnData`, `GlobalPos`, `DebugStructureInfo`, `Node`, `PathDebugData`, `Path`, `DebugSubscriptionDataType`, `DebugSubscriptionUpdate`, `DebugSubscriptionEvent`, `game_profile_name_prop`, `GameProfile`, `PartialResolvableProfile`, `GameProfileProperty`, `ResolvableProfile`, `PlayerSkinPatch`, `packet_common_custom_report_details`, `ServerLinkType`, `packet_common_server_links`, `packet_common_clear_dialog`, `packet_common_custom_click_action`
- **Removed (5):** `vec3i16`, `EntityMetadataWolfVariant`, `minecraft_simple_recipe_format`, `minecraft_smelting_format`, `game_profile`
- **Modified (12):** `ContainerID`, `SlotComponentType`, `SlotComponent`, `ItemBlockPredicate`, `ArmorTrimMaterial`, `ArmorTrimPattern`, `Slot`, `Particle`, `soundSource`, `entityMetadataEntry`, `command_node`, `packet_common_settings`

#### Added Top-Level Types (Exact Schemas)

- **`lpVec3`**: `native`
- **`vec2f`**: `["container",[{"name":"x","type":"f32"},{"name":"y","type":"f32"}]]`
- **`vec3i`**: `["container",[{"name":"x","type":"varint"},{"name":"y","type":"varint"},{"name":"z","type":"varint"}]]`
- **`vec3i32`**: `["container",[{"name":"x","type":"i32"},{"name":"y","type":"i32"},{"name":"z","type":"i32"}]]`
- **`ExactComponentMatcher`**: `["array",{"countType":"varint","type":"SlotComponent"}]`
- **`DataComponentMatchers`**: `["container",[{"name":"exactMatchers","type":"ExactComponentMatcher"},{"name":"partialMatchers","type":["array",{"countType":"varint","type":"varint"}]}]]`
- **`ItemConsumeEffect`**: `["container",[{"name":"type","type":["mapper",{"type":"varint","mappings":{"0":"apply_effects","1":"remove_effects","2":"clear_all_effects","3":"teleport_randomly","4":"play_sound"}}]},{"anon":true,"type":["switch",{"compareTo":"type","fields":{"apply_effects":["container",[{"name":"effects","type":["array",{"countType":"varint","type":"ItemPotionEffect"}]},{"name":"probability","type":"f32"}]],"remove_effects":["container",[{"name":"effects","type":"IDSet"}]],"clear_all_effects":"void","teleport_randomly":["container",[{"name":"diameter","type":"f32"}]],"play_sound":["container",[{"name":"sound","type":"ItemSoundHolder"}]]}}]}]]`
- **`JukeboxSongData`**: `["container",[{"name":"soundEvent","type":"ItemSoundHolder"},{"name":"description","type":"anonymousNbt"},{"name":"lengthInSeconds","type":"f32"},{"name":"comparatorOutput","type":"varint"}]]`
- **`KineticWeaponCondition`**: `["container",[{"name":"maxDurationTicks","type":"varint"},{"name":"minSpeed","type":"f32"},{"name":"minRelativeSpeed","type":"f32"}]]`
- **`UntrustedSlotComponent`**: `["container",[{"name":"type","type":"SlotComponentType"},{"name":"data","type":"ByteArray"}]]`
- **`UntrustedSlot`**: `["container",[{"name":"itemCount","type":"varint"},{"anon":true,"type":["switch",{"compareTo":"itemCount","fields":{"0":"void","false":"void"},"default":["container",[{"name":"itemId","type":"varint"},{"name":"addedComponentCount","type":"varint"},{"name":"removedComponentCount","type":"varint"},{"name":"components","type":["array",{"count":"addedComponentCount","type":"UntrustedSlotComponent"}]},{"name":"removeComponents","type":["array",{"count":"removedComponentCount","type":["container",[{"name":"type","type":"SlotComponentType"}]]}]}]]}]}]]`
- **`HashedSlot`**: `["container",[{"name":"itemId","type":"varint"},{"name":"itemCount","type":"varint"},{"name":"components","type":["array",{"countType":"varint","type":["container",[{"name":"type","type":"SlotComponentType"},{"name":"hash","type":"i32"}]]}]},{"name":"removeComponents","type":["array",{"countType":"varint","type":["container",[{"name":"type","type":"SlotComponentType"}]]}]}]]`
- **`RespawnData`**: `["container",[{"name":"globalPos","type":"GlobalPos"},{"name":"yaw","type":"f32"},{"name":"pitch","type":"f32"}]]`
- **`GlobalPos`**: `["container",[{"name":"dimensionName","type":"string"},{"name":"location","type":"position"}]]`
- **`DebugStructureInfo`**: `["container",[{"name":"boundingBoxMin","type":"position"},{"name":"boundingBoxMax","type":"position"},{"name":"pieces","type":["array",{"countType":"varint","type":["container",[{"name":"boundingBoxMin","type":"position"},{"name":"boundingBoxMax","type":"position"},{"name":"isStart","type":"bool"}]]}]}]]`
- **`Node`**: `["container",[{"name":"position","type":"vec3i32"},{"name":"walkedDistance","type":"f32"},{"name":"costMalus","type":"f32"},{"name":"closed","type":"bool"},{"name":"type","type":["mapper",{"type":"varint","mappings":{"0":"blocked","1":"open","2":"walkable","3":"walkable_door","4":"trapdoor","5":"powder_snow","6":"danger_powder_snow","7":"fence","8":"lava","9":"water","10":"water_border","11":"rail","12":"unpassable_rail","13":"danger_fire","14":"damage_fire","15":"danger_other","16":"damage_other","17":"door_open","18":"door_wood_closed","19":"door_iron_closed","20":"breach","21":"leaves","22":"sticky_honey","23":"cocoa","24":"damage_cautious","25":"danger_trapdoor"}}]},{"name":"f","type":"f32"}]]`
- **`PathDebugData`**: `["container",[{"name":"openSet","type":["array",{"countType":"varint","type":"Node"}]},{"name":"closedSet","type":["array",{"countType":"varint","type":"Node"}]},{"name":"targetNodes","type":["array",{"countType":"varint","type":"Node"}]}]]`
- **`Path`**: `["container",[{"name":"reached","type":"bool"},{"name":"nextNodeIndex","type":"i32"},{"name":"target","type":"position"},{"name":"nodes","type":["array",{"countType":"varint","type":"Node"}]},{"name":"debugData","type":"PathDebugData"}]]`
- **`DebugSubscriptionDataType`**: `["mapper",{"type":"varint","mappings":{"0":"DedicatedServerTickTime","1":"Bees","2":"Brains","3":"Breezes","4":"GoalSelectors","5":"EntityPaths","6":"EntityBlockIntersections","7":"BeeHives","8":"Pois","9":"RedstoneWireOrientations","10":"VillageSections","11":"Raids","12":"Structures","13":"GameEventListeners","14":"NeighborUpdates","15":"GameEvents"}}]`
- **`DebugSubscriptionUpdate`**: `["container",[{"name":"type","type":"DebugSubscriptionDataType"},{"anon":true,"type":["switch",{"compareTo":"type","fields":{"DedicatedServerTickTime":"void"},"default":["container",[{"name":"payload","type":["option",["switch",{"compareTo":"type","fields":{"DedicatedServerTickTime":"void","VillageSections":"void","Bees":["container",[{"name":"hivePos","type":["option","position"]},{"name":"flowerPos","type":["option","position"]},{"name":"travelTicks","type":"varint"},{"name":"blacklistedHives","type":["array",{"countType":"varint","type":"position"}]}]],"Brains":["container",[{"name":"name","type":"string"},{"name":"profession","type":"string"},{"name":"xp","type":"i32"},{"name":"health","type":"f32"},{"name":"maxHealth","type":"f32"},{"name":"inventory","type":"string"},{"name":"wantsGolem","type":"bool"},{"name":"angerLevel","type":"i32"},{"name":"activities","type":["array",{"countType":"varint","type":"string"}]},{"name":"behaviors","type":["array",{"countType":"varint","type":"string"}]},{"name":"memories","type":["array",{"countType":"varint","type":"string"}]},{"name":"gossips","type":["array",{"countType":"varint","type":"string"}]},{"name":"pois","type":["array",{"countType":"varint","type":"position"}]},{"name":"potentialPois","type":["array",{"countType":"varint","type":"position"}]}]],"Breezes":["container",[{"name":"attackTarget","type":["option","varint"]},{"name":"jumpTarget","type":["option","position"]}]],"GoalSelectors":["container",[{"name":"goals","type":["array",{"countType":"varint","type":["container",[{"name":"priority","type":"varint"},{"name":"running","type":"bool"},{"name":"name","type":"string"}]]}]}]],"EntityPaths":["container",[{"name":"path","type":"Path"},{"name":"maxNodeDistance","type":"f32"}]],"EntityBlockIntersections":["container",[{"name":"id","type":"varint"}]],"BeeHives":["container",[{"name":"type","type":"varint"},{"name":"occupantCount","type":"varint"},{"name":"honeyLevel","type":"varint"},{"name":"sedated","type":"bool"}]],"Pois":["container",[{"name":"pos","type":"position"},{"name":"poiType","type":"varint"},{"name":"freeTicketCount","type":"varint"}]],"RedstoneWireOrientations":["container",[{"name":"index","type":"varint"}]],"Raids":["container",[{"name":"positions","type":["array",{"countType":"varint","type":"position"}]}]],"Structures":["container",[{"name":"structures","type":["array",{"countType":"varint","type":"DebugStructureInfo"}]}]],"GameEventListeners":["container",[{"name":"listenerRadius","type":"varint"}]],"NeighborUpdates":["container",[{"name":"pos","type":"position"}]],"GameEvents":["container",[{"name":"event","type":"varint"},{"name":"pos","type":"vec3f64"}]]}}]]}]]}]}]]`
- **`DebugSubscriptionEvent`**: `["container",[{"name":"type","type":"DebugSubscriptionDataType"},{"name":"value","type":["switch",{"compareTo":"type","fields":{"DedicatedServerTickTime":"void","VillageSections":"void","Bees":["container",[{"name":"hivePos","type":["option","position"]},{"name":"flowerPos","type":["option","position"]},{"name":"travelTicks","type":"varint"},{"name":"blacklistedHives","type":["array",{"countType":"varint","type":"position"}]}]],"Brains":["container",[{"name":"name","type":"string"},{"name":"profession","type":"string"},{"name":"xp","type":"i32"},{"name":"health","type":"f32"},{"name":"maxHealth","type":"f32"},{"name":"inventory","type":"string"},{"name":"wantsGolem","type":"bool"},{"name":"angerLevel","type":"i32"},{"name":"activities","type":["array",{"countType":"varint","type":"string"}]},{"name":"behaviors","type":["array",{"countType":"varint","type":"string"}]},{"name":"memories","type":["array",{"countType":"varint","type":"string"}]},{"name":"gossips","type":["array",{"countType":"varint","type":"string"}]},{"name":"pois","type":["array",{"countType":"varint","type":"position"}]},{"name":"potentialPois","type":["array",{"countType":"varint","type":"position"}]}]],"Breezes":["container",[{"name":"attackTarget","type":["option","varint"]},{"name":"jumpTarget","type":["option","position"]}]],"GoalSelectors":["container",[{"name":"priority","type":"varint"},{"name":"running","type":"bool"},{"name":"name","type":"string"}]],"EntityPaths":["container",[{"name":"path","type":"Path"},{"name":"maxNodeDistance","type":"f32"}]],"EntityBlockIntersections":["container",[{"name":"id","type":"varint"}]],"BeeHives":["container",[{"name":"type","type":"varint"},{"name":"occupantCount","type":"varint"},{"name":"honeyLevel","type":"varint"},{"name":"sedated","type":"bool"}]],"Pois":["container",[{"name":"pos","type":"position"},{"name":"poiType","type":"varint"},{"name":"freeTicketCount","type":"varint"}]],"RedstoneWireOrientations":["container",[{"name":"index","type":"varint"}]],"Raids":["container",[{"name":"positions","type":["array",{"countType":"varint","type":"position"}]}]],"Structures":["container",[{"name":"structures","type":["array",{"countType":"varint","type":"DebugStructureInfo"}]}]],"GameEventListeners":["container",[{"name":"listenerRadius","type":"varint"}]],"NeighborUpdates":["container",[{"name":"pos","type":"position"}]],"GameEvents":["container",[{"name":"event","type":"varint"},{"name":"pos","type":"vec3f64"}]]}}]}]]`
- **`game_profile_name_prop`**: `["container",[{"name":"name","type":"string"},{"name":"properties","type":["array",{"countType":"varint","type":"GameProfileProperty"}]}]]`
- **`GameProfile`**: `["container",[{"name":"uuid","type":"UUID"},{"name":"name","type":"string"},{"name":"properties","type":["array",{"countType":"varint","type":"GameProfileProperty"}]}]]`
- **`PartialResolvableProfile`**: `["container",[{"name":"name","type":["option","string"]},{"name":"uuid","type":["option","UUID"]},{"name":"properties","type":["array",{"countType":"varint","type":"GameProfileProperty"}]}]]`
- **`GameProfileProperty`**: `["container",[{"name":"name","type":"string"},{"name":"value","type":"string"},{"name":"signature","type":["option","string"]}]]`
- **`ResolvableProfile`**: `["container",[{"name":"type","type":["mapper",{"type":"varint","mappings":{"0":"partial","1":"complete"}}]},{"anon":true,"type":["switch",{"compareTo":"type","fields":{"partial":"PartialResolvableProfile","complete":"GameProfile"}}]},{"name":"skinPatch","type":"PlayerSkinPatch"}]]`
- **`PlayerSkinPatch`**: `["container",[{"name":"body","type":["option","string"]},{"name":"cape","type":["option","string"]},{"name":"elytra","type":["option","string"]},{"name":"model","type":["option",["mapper",{"type":"varint","mappings":{"0":"wide","1":"slim"}}]]}]]`
- **`packet_common_custom_report_details`**: `["container",[{"name":"details","type":["array",{"countType":"varint","type":["container",[{"name":"key","type":"string"},{"name":"value","type":"string"}]]}]}]]`
- **`ServerLinkType`**: `["mapper",{"type":"varint","mappings":{"0":"bug_report","1":"community_guidelines","2":"support","3":"status","4":"feedback","5":"community","6":"website","7":"forums","8":"news","9":"announcements"}}]`
- **`packet_common_server_links`**: `["container",[{"name":"links","type":["array",{"countType":"varint","type":["container",[{"name":"hasKnownType","type":"bool"},{"name":"knownType","type":["switch",{"compareTo":"hasKnownType","fields":{"true":"ServerLinkType"}}]},{"name":"unknownType","type":["switch",{"compareTo":"hasKnownType","fields":{"false":"anonymousNbt"}}]},{"name":"link","type":"string"}]]}]}]]`
- **`packet_common_clear_dialog`**: `["container",[]]`
- **`packet_common_custom_click_action`**: `["container",[{"name":"id","type":"string"},{"name":"nbt","type":["option","anonymousNbt"]}]]`

#### Removed Top-Level Types

- **`vec3i16`**: `["container",[{"name":"x","type":"i16"},{"name":"y","type":"i16"},{"name":"z","type":"i16"}]]`
- **`EntityMetadataWolfVariant`**: `["container",[{"name":"wildTexture","type":"string"},{"name":"tameTexture","type":"string"},{"name":"angryTexture","type":"string"},{"name":"biome","type":"IDSet"}]]`
- **`minecraft_simple_recipe_format`**: `["container",[{"name":"category","type":"varint"}]]`
- **`minecraft_smelting_format`**: `["container",[{"name":"group","type":"string"},{"name":"category","type":"varint"},{"name":"ingredient","type":"ingredient"},{"name":"result","type":"Slot"},{"name":"experience","type":"f32"},{"name":"cookTime","type":"varint"}]]`
- **`game_profile`**: `["container",[{"name":"name","type":"string"},{"name":"properties","type":["array",{"countType":"varint","type":["container",[{"name":"name","type":"string"},{"name":"value","type":"string"},{"name":"signature","type":["option","string"]}]]}]}]]`

#### State-Local Non-Packet Types Added / Changed

- **ADDED** `play.toClient.SlotDisplay`: `["container",[{"name":"type","type":["mapper",{"type":"varint","mappings":{"0":"empty","1":"any_fuel","2":"item","3":"item_stack","4":"tag","5":"smithing_trim","6":"with_remainder","7":"composite"}}]},{"name":"data","type":["switch",{"compareTo":"type","fields":{"empty":"void","any_fuel":"void","item":"varint","item_stack":"Slot","tag":"string","smithing_trim":["container",[{"name":"base","type":"SlotDisplay"},{"name":"material","type":"SlotDisplay"},{"name":"pattern","type":["registryEntryHolder",{"baseName":"patternId","otherwise":{"name":"data","type":"ArmorTrimPattern"}}]}]],"with_remainder":["container",[{"name":"input","type":"SlotDisplay"},{"name":"remainder","type":"SlotDisplay"}]],"composite":["array",{"countType":"varint","type":"SlotDisplay"}]}}]}]]`
- **ADDED** `play.toClient.RecipeDisplay`: `["container",[{"name":"type","type":["mapper",{"type":"varint","mappings":{"0":"crafting_shapeless","1":"crafting_shaped","2":"furnace","3":"stonecutter","4":"smithing"}}]},{"name":"data","type":["switch",{"compareTo":"type","fields":{"crafting_shapeless":["container",[{"name":"ingredients","type":["array",{"countType":"varint","type":"SlotDisplay"}]},{"name":"result","type":"SlotDisplay"},{"name":"craftingStation","type":"SlotDisplay"}]],"crafting_shaped":["container",[{"name":"width","type":"varint"},{"name":"height","type":"varint"},{"name":"ingredients","type":["array",{"countType":"varint","type":"SlotDisplay"}]},{"name":"result","type":"SlotDisplay"},{"name":"craftingStation","type":"SlotDisplay"}]],"furnace":["container",[{"name":"ingredient","type":"SlotDisplay"},{"name":"fuel","type":"SlotDisplay"},{"name":"result","type":"SlotDisplay"},{"name":"craftingStation","type":"SlotDisplay"},{"name":"duration","type":"varint"},{"name":"experience","type":"f32"}]],"stonecutter":["container",[{"name":"ingredient","type":"SlotDisplay"},{"name":"result","type":"SlotDisplay"},{"name":"craftingStation","type":"SlotDisplay"}]],"smithing":["container",[{"name":"template","type":"SlotDisplay"},{"name":"base","type":"SlotDisplay"},{"name":"addition","type":"SlotDisplay"},{"name":"result","type":"SlotDisplay"},{"name":"craftingStation","type":"SlotDisplay"}]]}}]}]]`
- **CHANGED** `play.toClient.SpawnInfo`:
  - 1.20.6: `["container",[{"name":"dimension","type":"varint"},{"name":"name","type":"string"},{"name":"hashedSeed","type":"i64"},{"name":"gamemode","type":["mapper",{"type":"i8","mappings":{"0":"survival","1":"creative","2":"adventure","3":"spectator"}}]},{"name":"previousGamemode","type":"u8"},{"name":"isDebug","type":"bool"},{"name":"isFlat","type":"bool"},{"name":"death","type":["option",["container",[{"name":"dimensionName","type":"string"},{"name":"location","type":"position"}]]]},{"name":"portalCooldown","type":"varint"}]]`
  - 1.21.11: `["container",[{"name":"dimension","type":"varint"},{"name":"name","type":"string"},{"name":"hashedSeed","type":"i64"},{"name":"gamemode","type":["mapper",{"type":"i8","mappings":{"0":"survival","1":"creative","2":"adventure","3":"spectator"}}]},{"name":"previousGamemode","type":"u8"},{"name":"isDebug","type":"bool"},{"name":"isFlat","type":"bool"},{"name":"death","type":["option","GlobalPos"]},{"name":"portalCooldown","type":"varint"},{"name":"seaLevel","type":"varint"}]]`
- **ADDED** `play.toClient.ChatTypesHolder`: `["registryEntryHolder",{"baseName":"chatType","otherwise":{"name":"data","type":"ChatTypes"}}]`
- **ADDED** `play.toClient.ExplosionParticleInfo`: `["container",[{"name":"particle","type":"Particle"},{"name":"scaling","type":"f32"},{"name":"speed","type":"f32"}]]`
- **ADDED** `play.toClient.ExplosionParticleEntry`: `["container",[{"name":"data","type":"ExplosionParticleInfo"},{"name":"weight","type":"varint"}]]`
- **CHANGED** `play.toClient.PositionUpdateRelatives`:
  - 1.20.6: `["bitflags",{"type":"u8","flags":["x","y","z","yaw","pitch"]}]`
  - 1.21.11: `["bitflags",{"type":"u32","flags":["x","y","z","yaw","pitch","dx","dy","dz","yawDelta"]}]`
- **ADDED** `play.toClient.RecipeBookSetting`: `["container",[{"name":"open","type":"bool"},{"name":"filtering","type":"bool"}]]`
- **ADDED** `play.toServer.MovementFlags`: `["bitflags",{"type":"u8","flags":["onGround","hasHorizontalCollision"]}]`

### 4.2 `Slot`, `UntrustedSlot`, `HashedSlot`, `SetCreativeSlot`, `ContainerClick` (`window_click`), & `ItemCost`

1. **`Slot` (`types.Slot`):**
   - `itemCount` changed from `i8` (1.20.6) to `varint` (1.21.11). Everything else in `Slot` (`itemId`, `addedComponentCount`, `removedComponentCount`, `components: SlotComponent[]`, `removeComponents`) is structurally identical (though `SlotComponentType` and `SlotComponent` changed extensively).
2. **`HashedSlot` & Serverbound `window_click` (`ContainerClick`, 1.21.5+):**
   - **Yes — 1.21.5 introduced `HashedSlot` (`HashedStack`) in serverbound `window_click`!**
   - `1.20.6 window_click`: `windowId: u8, stateId: varint, slot: i16, mouseButton: i8, mode: varint, changedSlots: array<varint>({location: i16, item: Slot}), cursorItem: Slot`.
   - `1.21.11 window_click`: `windowId: ContainerID (varint), stateId: varint, slot: i16, mouseButton: i8, mode: varint, changedSlots: array<varint>({location: i16, item: option<HashedSlot>}), cursorItem: option<HashedSlot>`.
   - `HashedSlot` schema: `["container",[{"name":"itemId","type":"varint"},{"name":"itemCount","type":"varint"},{"name":"components","type":["array",{"countType":"varint","type":["container",[{"name":"type","type":"SlotComponentType"},{"name":"hash","type":"i32"}]]}]},{"name":"removeComponents","type":["array",{"countType":"varint","type":["container",[{"name":"type","type":"SlotComponentType"}]]}]}]]` — instead of serializing full component payloads back to the server, the client sends `(type: SlotComponentType, hash: i32)` (CRC32C checksum of the encoded component value) for added/changed components and `type: SlotComponentType` for removed components.
3. **`UntrustedSlot` / `UntrustedSlotComponent` & Serverbound `set_creative_slot` (`SetCreativeSlot`):**
   - `1.20.6 set_creative_slot`: `{slot: i16, item: Slot}`.
   - `1.21.11 set_creative_slot`: `{slot: i16, item: UntrustedSlot}`.
   - `UntrustedSlot` schema: `["container",[{"name":"itemCount","type":"varint"},{"anon":true,"type":["switch",{"compareTo":"itemCount","fields":{"0":"void","false":"void"},"default":["container",[{"name":"itemId","type":"varint"},{"name":"addedComponentCount","type":"varint"},{"name":"removedComponentCount","type":"varint"},{"name":"components","type":["array",{"count":"addedComponentCount","type":"UntrustedSlotComponent"}]},{"name":"removeComponents","type":["array",{"count":"removedComponentCount","type":["container",[{"name":"type","type":"SlotComponentType"}]]}]}]]}]}]]`
   - `UntrustedSlotComponent` schema: `["container",[{"name":"type","type":"SlotComponentType"},{"name":"data","type":"ByteArray"}]]` — wraps each component payload in a `varint`-length-prefixed `ByteArray` (`["buffer", {"countType": "varint"}]`) so the server can bound/skip untrusted creative payloads.
4. **`ItemCost` (`trade_list`) & `DataComponentMatchers` / `ExactComponentMatcher`:**
   - `protocol.json` has no named `ItemCost` type; Mojang `ItemCost` is inlined inside `play.toClient.packet_trade_list` (`inputItem1` and `inputItem2`).
   - In `1.20.6`, each trade cost was `{itemId: varint, itemCount: varint, addedComponentCount: varint, components: array(count=addedComponentCount, SlotComponent)}`.
   - In `1.21.11`, each trade cost is `{itemId: varint, itemCount: varint, components: ExactComponentMatcher}`, where `ExactComponentMatcher = ["array", {"countType": "varint", "type": "SlotComponent"}]` (same wire format, refactored into a named type).
   - `ItemBlockPredicate` (used by `can_place_on` / `can_break`) also gained a trailing `components: DataComponentMatchers` field (`{exactMatchers: ExactComponentMatcher, partialMatchers: varint[]}`).

### 4.3 `SlotComponentType` & `SlotComponent` (`56 -> 104` components)

- **Total count:** 56 (0..55) -> 104 (0..103).
- **Removed (3):** `hide_additional_tooltip` (14), `hide_tooltip` (15), `fire_resistant` (21) (tooltip hiding merged into `tooltip_display`; `fire_resistant` generalized into `damage_resistant`).
- **Added (51):** `use_effects` (5), `minimum_attack_charge` (7), `damage_type` (8), `item_model` (10), `tooltip_display` (18), `consumable` (24), `use_remainder` (25), `use_cooldown` (26), `damage_resistant` (27), `weapon` (29), `attack_range` (30), `enchantable` (31), `equippable` (32), `repairable` (33), `glider` (34), `tooltip_style` (35), `death_protection` (36), `blocks_attacks` (37), `piercing_weapon` (38), `kinetic_weapon` (39), `swing_animation` (40), `potion_duration_scale` (50), `provides_trim_material` (60), `jukebox_playable` (62), `provides_banner_patterns` (63), `break_sound` (78), `villager/variant` (79), `wolf/variant` (80), `wolf/sound_variant` (81), `wolf/collar` (82), `fox/variant` (83), `salmon/size` (84), `parrot/variant` (85), `tropical_fish/pattern` (86), `tropical_fish/base_color` (87), `tropical_fish/pattern_color` (88), `mooshroom/variant` (89), `rabbit/variant` (90), `pig/variant` (91), `cow/variant` (92), `chicken/variant` (93), `zombie_nautilus/variant` (94), `frog/variant` (95), `horse/variant` (96), `painting/variant` (97), `llama/variant` (98), `axolotl/variant` (99), `cat/variant` (100), `cat/collar` (101), `sheep/color` (102), `shulker/color` (103).
- **ID-shifted existing components (48):** only IDs `0..4` (`custom_data`, `max_stack_size`, `max_damage`, `damage`, `unbreakable`) retained their 1.20.6 numeric IDs!

#### `SlotComponentType` Added / Removed / Re-IDed Summary Table

| Component Name | 1.20.6 ID | 1.21.11 ID | Payload Schema Status |
| --- | :---: | :---: | --- |
| `custom_data` | 0 | 0 | unchanged |
| `max_stack_size` | 1 | 1 | unchanged |
| `max_damage` | 2 | 2 | unchanged |
| `damage` | 3 | 3 | unchanged |
| `unbreakable` | 4 | 4 | **PAYLOAD CHANGED** |
| `use_effects` | — | 5 | **ADDED** |
| `custom_name` | 5 | 6 | unchanged |
| `minimum_attack_charge` | — | 7 | **ADDED** |
| `damage_type` | — | 8 | **ADDED** |
| `item_name` | 6 | 9 | unchanged |
| `item_model` | — | 10 | **ADDED** |
| `lore` | 7 | 11 | **PAYLOAD CHANGED** |
| `rarity` | 8 | 12 | unchanged |
| `enchantments` | 9 | 13 | **PAYLOAD CHANGED** |
| `can_place_on` | 10 | 14 | **PAYLOAD CHANGED** |
| `can_break` | 11 | 15 | **PAYLOAD CHANGED** |
| `attribute_modifiers` | 12 | 16 | **PAYLOAD CHANGED** |
| `custom_model_data` | 13 | 17 | **PAYLOAD CHANGED** |
| `tooltip_display` | — | 18 | **ADDED** |
| `repair_cost` | 16 | 19 | unchanged |
| `creative_slot_lock` | 17 | 20 | unchanged |
| `enchantment_glint_override` | 18 | 21 | unchanged |
| `intangible_projectile` | 19 | 22 | unchanged |
| `food` | 20 | 23 | **PAYLOAD CHANGED** |
| `consumable` | — | 24 | **ADDED** |
| `use_remainder` | — | 25 | **ADDED** |
| `use_cooldown` | — | 26 | **ADDED** |
| `damage_resistant` | — | 27 | **ADDED** |
| `tool` | 22 | 28 | **PAYLOAD CHANGED** |
| `weapon` | — | 29 | **ADDED** |
| `attack_range` | — | 30 | **ADDED** |
| `enchantable` | — | 31 | **ADDED** |
| `equippable` | — | 32 | **ADDED** |
| `repairable` | — | 33 | **ADDED** |
| `glider` | — | 34 | **ADDED** |
| `tooltip_style` | — | 35 | **ADDED** |
| `death_protection` | — | 36 | **ADDED** |
| `blocks_attacks` | — | 37 | **ADDED** |
| `piercing_weapon` | — | 38 | **ADDED** |
| `kinetic_weapon` | — | 39 | **ADDED** |
| `swing_animation` | — | 40 | **ADDED** |
| `stored_enchantments` | 23 | 41 | **PAYLOAD CHANGED** |
| `dyed_color` | 24 | 42 | **PAYLOAD CHANGED** |
| `map_color` | 25 | 43 | unchanged |
| `map_id` | 26 | 44 | unchanged |
| `map_decorations` | 27 | 45 | unchanged |
| `map_post_processing` | 28 | 46 | unchanged |
| `charged_projectiles` | 29 | 47 | unchanged |
| `bundle_contents` | 30 | 48 | unchanged |
| `potion_contents` | 31 | 49 | unchanged |
| `potion_duration_scale` | — | 50 | **ADDED** |
| `suspicious_stew_effects` | 32 | 51 | unchanged |
| `writable_book_content` | 33 | 52 | unchanged |
| `written_book_content` | 34 | 53 | unchanged |
| `trim` | 35 | 54 | **PAYLOAD CHANGED** |
| `debug_stick_state` | 36 | 55 | unchanged |
| `entity_data` | 37 | 56 | **PAYLOAD CHANGED** |
| `bucket_entity_data` | 38 | 57 | unchanged |
| `block_entity_data` | 39 | 58 | **PAYLOAD CHANGED** |
| `instrument` | 40 | 59 | **PAYLOAD CHANGED** |
| `provides_trim_material` | — | 60 | **ADDED** |
| `ominous_bottle_amplifier` | 41 | 61 | unchanged |
| `jukebox_playable` | — | 62 | **ADDED** |
| `provides_banner_patterns` | — | 63 | **ADDED** |
| `recipes` | 42 | 64 | unchanged |
| `lodestone_tracker` | 43 | 65 | **PAYLOAD CHANGED** |
| `firework_explosion` | 44 | 66 | unchanged |
| `fireworks` | 45 | 67 | unchanged |
| `profile` | 46 | 68 | **PAYLOAD CHANGED** |
| `note_block_sound` | 47 | 69 | unchanged |
| `banner_patterns` | 48 | 70 | unchanged |
| `base_color` | 49 | 71 | unchanged |
| `pot_decorations` | 50 | 72 | unchanged |
| `container` | 51 | 73 | unchanged |
| `block_state` | 52 | 74 | unchanged |
| `bees` | 53 | 75 | unchanged |
| `lock` | 54 | 76 | unchanged |
| `container_loot` | 55 | 77 | unchanged |
| `break_sound` | — | 78 | **ADDED** |
| `villager/variant` | — | 79 | **ADDED** |
| `wolf/variant` | — | 80 | **ADDED** |
| `wolf/sound_variant` | — | 81 | **ADDED** |
| `wolf/collar` | — | 82 | **ADDED** |
| `fox/variant` | — | 83 | **ADDED** |
| `salmon/size` | — | 84 | **ADDED** |
| `parrot/variant` | — | 85 | **ADDED** |
| `tropical_fish/pattern` | — | 86 | **ADDED** |
| `tropical_fish/base_color` | — | 87 | **ADDED** |
| `tropical_fish/pattern_color` | — | 88 | **ADDED** |
| `mooshroom/variant` | — | 89 | **ADDED** |
| `rabbit/variant` | — | 90 | **ADDED** |
| `pig/variant` | — | 91 | **ADDED** |
| `cow/variant` | — | 92 | **ADDED** |
| `chicken/variant` | — | 93 | **ADDED** |
| `zombie_nautilus/variant` | — | 94 | **ADDED** |
| `frog/variant` | — | 95 | **ADDED** |
| `horse/variant` | — | 96 | **ADDED** |
| `painting/variant` | — | 97 | **ADDED** |
| `llama/variant` | — | 98 | **ADDED** |
| `axolotl/variant` | — | 99 | **ADDED** |
| `cat/variant` | — | 100 | **ADDED** |
| `cat/collar` | — | 101 | **ADDED** |
| `sheep/color` | — | 102 | **ADDED** |
| `shulker/color` | — | 103 | **ADDED** |
| `hide_additional_tooltip` | 14 | — | **REMOVED** |
| `hide_tooltip` | 15 | — | **REMOVED** |
| `fire_resistant` | 21 | — | **REMOVED** |

#### Modified `SlotComponent` Payloads (17 components)

- **`unbreakable`**:
  - 1.20.6: `bool`
  - 1.21.11: `void`
- **`lore`**:
  - 1.20.6: `["array",{"countType":"varint","type":"anonOptionalNbt"}]`
  - 1.21.11: `["array",{"countType":"varint","type":"anonymousNbt"}]`
- **`enchantments`**:
  - 1.20.6: `["container",[{"name":"enchantments","type":["array",{"countType":"varint","type":["container",[{"name":"id","type":"varint"},{"name":"level","type":"varint"}]]}]},{"name":"showTooltip","type":"bool"}]]`
  - 1.21.11: `["container",[{"name":"enchantments","type":["array",{"countType":"varint","type":["container",[{"name":"id","type":"varint"},{"name":"level","type":"varint"}]]}]}]]`
- **`stored_enchantments`**:
  - 1.20.6: `["container",[{"name":"enchantments","type":["array",{"countType":"varint","type":["container",[{"name":"id","type":"varint"},{"name":"level","type":"varint"}]]}]},{"name":"showInTooltip","type":"bool"}]]`
  - 1.21.11: `["container",[{"name":"enchantments","type":["array",{"countType":"varint","type":["container",[{"name":"id","type":"varint"},{"name":"level","type":"varint"}]]}]}]]`
- **`can_place_on`**:
  - 1.20.6: `["container",[{"name":"predicates","type":["array",{"countType":"varint","type":"ItemBlockPredicate"}]},{"name":"showTooltip","type":"bool"}]]`
  - 1.21.11: `["container",[{"name":"predicates","type":["array",{"countType":"varint","type":"ItemBlockPredicate"}]}]]`
- **`can_break`**:
  - 1.20.6: `["container",[{"name":"predicates","type":["array",{"countType":"varint","type":"ItemBlockPredicate"}]},{"name":"showTooltip","type":"bool"}]]`
  - 1.21.11: `["container",[{"name":"predicates","type":["array",{"countType":"varint","type":"ItemBlockPredicate"}]}]]`
- **`attribute_modifiers`**:
  - 1.20.6: `["container",[{"name":"attributes","type":["array",{"countType":"varint","type":["container",[{"name":"typeId","type":"varint"},{"name":"uuid","type":"UUID"},{"name":"name","type":"string"},{"name":"value","type":"f64"},{"name":"operation","type":["mapper",{"type":"varint","mappings":{"0":"add","1":"multiply_base","2":"multiply_total"}}]},{"name":"slot","type":["mapper",{"type":"varint","mappings":{"0":"any","1":"main_hand","2":"off_hand","3":"hand","4":"feet","5":"legs","6":"chest","7":"head","8":"armor","9":"body"}}]}]]}]},{"name":"showTooltip","type":"bool"}]]`
  - 1.21.11: `["array",{"countType":"varint","type":["container",[{"name":"typeId","type":"varint"},{"name":"name","type":"string"},{"name":"value","type":"f64"},{"name":"operation","type":["mapper",{"type":"varint","mappings":{"0":"add","1":"multiply_base","2":"multiply_total"}}]},{"name":"slot","type":["mapper",{"type":"varint","mappings":{"0":"any","1":"main_hand","2":"off_hand","3":"hand","4":"feet","5":"legs","6":"chest","7":"head","8":"armor","9":"body","10":"saddle"}}]},{"name":"display","type":["container",[{"name":"type","type":["mapper",{"type":"varint","mappings":{"0":"default","1":"hidden","2":"override"}}]},{"name":"component","type":["switch",{"compareTo":"type","fields":{"override":"anonymousNbt"}}]}]]}]]}]`
- **`custom_model_data`**:
  - 1.20.6: `varint`
  - 1.21.11: `["container",[{"name":"floats","type":["array",{"countType":"varint","type":"f32"}]},{"name":"flags","type":["array",{"countType":"varint","type":"bool"}]},{"name":"strings","type":["array",{"countType":"varint","type":"string"}]},{"name":"colors","type":["array",{"countType":"varint","type":"i32"}]}]]`
- **`food`**:
  - 1.20.6: `["container",[{"name":"nutrition","type":"varint"},{"name":"saturationModifier","type":"f32"},{"name":"canAlwaysEat","type":"bool"},{"name":"secondsToEat","type":"f32"},{"name":"usingConvertsTo","type":"Slot"},{"name":"effects","type":["array",{"countType":"varint","type":["container",[{"name":"effect","type":"varint"},{"name":"probability","type":"f32"}]]}]}]]`
  - 1.21.11: `["container",[{"name":"nutrition","type":"varint"},{"name":"saturationModifier","type":"f32"},{"name":"canAlwaysEat","type":"bool"}]]`
- **`tool`**:
  - 1.20.6: `["container",[{"name":"rules","type":["array",{"countType":"varint","type":["container",[{"name":"blocks","type":"IDSet"},{"name":"speed","type":["option","f32"]},{"name":"correctDropForBlocks","type":["option","bool"]}]]}]},{"name":"defaultMiningSpeed","type":"f32"},{"name":"damagePerBlock","type":"varint"}]]`
  - 1.21.11: `["container",[{"name":"rules","type":["array",{"countType":"varint","type":["container",[{"name":"blocks","type":"IDSet"},{"name":"speed","type":["option","f32"]},{"name":"correctDropForBlocks","type":["option","bool"]}]]}]},{"name":"defaultMiningSpeed","type":"f32"},{"name":"damagePerBlock","type":"varint"},{"name":"canDestroyBlocksInCreative","type":"bool"}]]`
- **`dyed_color`**:
  - 1.20.6: `["container",[{"name":"color","type":"i32"},{"name":"showTooltip","type":"bool"}]]`
  - 1.21.11: `i32`
- **`trim`**:
  - 1.20.6: `["container",[{"name":"material","type":["registryEntryHolder",{"baseName":"materialId","otherwise":{"name":"data","type":"ArmorTrimMaterial"}}]},{"name":"pattern","type":["registryEntryHolder",{"baseName":"patternId","otherwise":{"name":"data","type":"ArmorTrimPattern"}}]},{"name":"showInTooltip","type":"bool"}]]`
  - 1.21.11: `["container",[{"name":"material","type":["registryEntryHolder",{"baseName":"materialId","otherwise":{"name":"data","type":"ArmorTrimMaterial"}}]},{"name":"pattern","type":["registryEntryHolder",{"baseName":"patternId","otherwise":{"name":"data","type":"ArmorTrimPattern"}}]}]]`
- **`entity_data`**:
  - 1.20.6: `anonymousNbt`
  - 1.21.11: `["container",[{"name":"type","type":"varint"},{"name":"data","type":"anonymousNbt"}]]`
- **`block_entity_data`**:
  - 1.20.6: `anonymousNbt`
  - 1.21.11: `["container",[{"name":"type","type":"varint"},{"name":"data","type":"anonymousNbt"}]]`
- **`instrument`**:
  - 1.20.6: `["registryEntryHolder",{"baseName":"instrumentId","otherwise":{"name":"data","type":"InstrumentData"}}]`
  - 1.21.11: `["container",[{"name":"hasHolder","type":"bool"},{"name":"data","type":["switch",{"compareTo":"hasHolder","fields":{"true":["registryEntryHolder",{"baseName":"instrumentId","otherwise":{"name":"data","type":"InstrumentData"}}],"false":"string"}}]}]]`
- **`lodestone_tracker`**:
  - 1.20.6: `["container",[{"name":"globalPosition","type":["option",["container",[{"name":"dimension","type":"string"},{"name":"position","type":"position"}]]]},{"name":"tracked","type":"bool"}]]`
  - 1.21.11: `["container",[{"name":"globalPosition","type":["option","GlobalPos"]},{"name":"tracked","type":"bool"}]]`
- **`profile`**:
  - 1.20.6: `["container",[{"name":"name","type":["option","string"]},{"name":"uuid","type":["option","UUID"]},{"name":"properties","type":["array",{"countType":"varint","type":["container",[{"name":"name","type":"string"},{"name":"value","type":"string"},{"name":"signature","type":["option","string"]}]]}]}]]`
  - 1.21.11: `ResolvableProfile`

#### Added `SlotComponent` Payloads (51 components)

- **`use_effects`**: `["container",[{"name":"can_sprint","type":"bool"},{"name":"interact_vibrations","type":"bool"},{"name":"speed_multiplier","type":"f32"}]]`
- **`minimum_attack_charge`**: `f32`
- **`damage_type`**: `["container",[{"name":"hasHolder","type":"bool"},{"name":"damageType","type":["switch",{"compareTo":"hasHolder","fields":{"true":"varint","false":"string"}}]}]]`
- **`item_model`**: `string`
- **`tooltip_display`**: `["container",[{"name":"hideTooltip","type":"bool"},{"name":"hiddenComponents","type":["array",{"countType":"varint","type":"varint"}]}]]`
- **`blocks_attacks`**: `["container",[{"name":"blockDelaySeconds","type":"f32"},{"name":"disableCooldownScale","type":"f32"},{"name":"damageReductions","type":["array",{"countType":"varint","type":["container",[{"name":"horizontalBlockingAngle","type":"f32"},{"name":"type","type":["option","IDSet"]},{"name":"base","type":"f32"},{"name":"factor","type":"f32"}]]}]},{"name":"itemDamage","type":["container",[{"name":"threshold","type":"f32"},{"name":"base","type":"f32"},{"name":"factor","type":"f32"}]]},{"name":"bypassedBy","type":["option","string"]},{"name":"blockSound","type":["option","ItemSoundHolder"]},{"name":"disableSound","type":["option","ItemSoundHolder"]}]]`
- **`consumable`**: `["container",[{"name":"consume_seconds","type":"f32"},{"name":"animation","type":["mapper",{"type":"varint","mappings":{"0":"none","1":"eat","2":"drink","3":"block","4":"bow","5":"spear","6":"crossbow","7":"spyglass","8":"toot_horn","9":"brush","10":"bundle"}}]},{"name":"sound","type":"ItemSoundHolder"},{"name":"makes_particles","type":"bool"},{"name":"effects","type":["array",{"countType":"varint","type":"ItemConsumeEffect"}]}]]`
- **`use_remainder`**: `Slot`
- **`use_cooldown`**: `["container",[{"name":"seconds","type":"f32"},{"name":"cooldownGroup","type":["option","string"]}]]`
- **`damage_resistant`**: `string`
- **`weapon`**: `["container",[{"name":"itemDamagePerAttack","type":"varint"},{"name":"disableBlockingForSeconds","type":"f32"}]]`
- **`attack_range`**: `["container",[{"name":"minRange","type":"f32"},{"name":"maxRange","type":"f32"},{"name":"minCreativeRange","type":"f32"},{"name":"maxCreativeRange","type":"f32"},{"name":"hitboxMargin","type":"f32"},{"name":"mobFactor","type":"f32"}]]`
- **`enchantable`**: `varint`
- **`equippable`**: `["container",[{"name":"slot","type":["mapper",{"type":"varint","mappings":{"0":"main_hand","1":"off_hand","2":"feet","3":"legs","4":"chest","5":"head","6":"body","7":"saddle"}}]},{"name":"sound","type":"ItemSoundHolder"},{"name":"model","type":["option","string"]},{"name":"cameraOverlay","type":["option","string"]},{"name":"allowedEntities","type":["option","IDSet"]},{"name":"dispensable","type":"bool"},{"name":"swappable","type":"bool"},{"name":"damageable","type":"bool"},{"name":"equipOnInteract","type":"bool"},{"name":"shearable","type":"bool"},{"name":"shearingSound","type":"ItemSoundHolder"}]]`
- **`repairable`**: `["container",[{"name":"items","type":"IDSet"}]]`
- **`glider`**: `void`
- **`tooltip_style`**: `string`
- **`death_protection`**: `["container",[{"name":"effects","type":["array",{"countType":"varint","type":"ItemConsumeEffect"}]}]]`
- **`piercing_weapon`**: `["container",[{"name":"dealsKnockback","type":"bool"},{"name":"dismounts","type":"bool"},{"name":"sound","type":["option","ItemSoundHolder"]},{"name":"hitSound","type":["option","ItemSoundHolder"]}]]`
- **`kinetic_weapon`**: `["container",[{"name":"contactCooldownTicks","type":"varint"},{"name":"delayTicks","type":"varint"},{"name":"dismountConditions","type":["option","KineticWeaponCondition"]},{"name":"knockbackConditions","type":["option","KineticWeaponCondition"]},{"name":"damageConditions","type":["option","KineticWeaponCondition"]},{"name":"forwardMovement","type":"f32"},{"name":"damageMultiplier","type":"f32"},{"name":"sound","type":["option","ItemSoundHolder"]},{"name":"hitSound","type":["option","ItemSoundHolder"]}]]`
- **`swing_animation`**: `["container",[{"name":"type","type":["mapper",{"type":"varint","mappings":{"0":"none","1":"whack","2":"stab"}}]},{"name":"duration","type":"varint"}]]`
- **`potion_duration_scale`**: `f32`
- **`provides_trim_material`**: `["container",[{"name":"hasHolder","type":"bool"},{"name":"material","type":["switch",{"compareTo":"hasHolder","fields":{"true":["registryEntryHolder",{"baseName":"materialId","otherwise":{"name":"data","type":"ArmorTrimMaterial"}}],"false":"string"}}]}]]`
- **`jukebox_playable`**: `["container",[{"name":"hasHolder","type":"bool"},{"name":"song","type":["switch",{"compareTo":"hasHolder","fields":{"true":["registryEntryHolder",{"baseName":"songId","otherwise":{"name":"data","type":"JukeboxSongData"}}],"false":"string"}}]}]]`
- **`provides_banner_patterns`**: `string`
- **`break_sound`**: `ItemSoundHolder`
- **`villager/variant`**: `varint`
- **`wolf/variant`**: `varint`
- **`wolf/sound_variant`**: `varint`
- **`wolf/collar`**: `varint`
- **`fox/variant`**: `varint`
- **`salmon/size`**: `varint`
- **`parrot/variant`**: `varint`
- **`tropical_fish/pattern`**: `varint`
- **`tropical_fish/base_color`**: `varint`
- **`tropical_fish/pattern_color`**: `varint`
- **`mooshroom/variant`**: `varint`
- **`rabbit/variant`**: `varint`
- **`pig/variant`**: `varint`
- **`cow/variant`**: `varint`
- **`chicken/variant`**: `["container",[{"name":"hasHolder","type":"bool"},{"name":"variant","type":["switch",{"compareTo":"hasHolder","fields":{"true":"varint","false":"string"}}]}]]`
- **`zombie_nautilus/variant`**: `["container",[{"name":"hasHolder","type":"bool"},{"name":"variant","type":["switch",{"compareTo":"hasHolder","fields":{"true":"varint","false":"string"}}]}]]`
- **`frog/variant`**: `varint`
- **`horse/variant`**: `varint`
- **`painting/variant`**: `["registryEntryHolder",{"baseName":"variantId","otherwise":{"name":"data","type":"EntityMetadataPaintingVariant"}}]`
- **`llama/variant`**: `varint`
- **`axolotl/variant`**: `varint`
- **`cat/variant`**: `varint`
- **`cat/collar`**: `varint`
- **`sheep/color`**: `varint`
- **`shulker/color`**: `varint`

### 4.4 `entityMetadataEntry` (`31 -> 39` serializers)

- **Count:** 31 (0..30) -> 39 (0..38).
- **Removed:** `compound_tag` (16).
- **Added (9):** `cow_variant` (22), `wolf_sound_variant` (24), `pig_variant` (26), `chicken_variant` (27), `zombie_nautilus_variant` (28), `copper_golem_state` (33), `weathering_copper_golem_state` (34), `resolvable_profile` (37), `humanoid_arm` (38).
- **Payload Changes:**
  - `wolf_variant`: `["registryEntryHolder",{"baseName":"variantId","otherwise":{"name":"variantData","type":"EntityMetadataWolfVariant"}}]` -> `varint` (now direct registry ID instead of `registryEntryHolder`; `EntityMetadataWolfVariant` removed).
  - `optional_global_pos`: `["option","string"]` -> `["option","GlobalPos"]` (1.20.6 had an incorrect `option<string>` stub patched in `generate-play-schema.mjs`; 1.21.11 uses proper `option<GlobalPos>`).
  - `resolvable_profile` (37): `ResolvableProfile`; `humanoid_arm` (38): `["mapper", {"type": "varint", "mappings": {"0": "left", "1": "right"}}]`.

| ID | 1.20.6 Serializer | 1.21.11 Serializer | 1.21.11 Wire Type |
| ---: | --- | --- | --- |
| 0 | `byte` | `byte` | `i8` |
| 1 | `int` | `int` | `varint` |
| 2 | `long` | `long` | `varlong` |
| 3 | `float` | `float` | `f32` |
| 4 | `string` | `string` | `string` |
| 5 | `component` | `component` | `anonymousNbt` |
| 6 | `optional_component` | `optional_component` | `["option","anonymousNbt"]` |
| 7 | `item_stack` | `item_stack` | `Slot` |
| 8 | `boolean` | `boolean` | `bool` |
| 9 | `rotations` | `rotations` | `["container",[{"name":"pitch","type":"f32"},{"name":"yaw","type":"f32"},{"name":"roll","type":"f32"}]]` |
| 10 | `block_pos` | `block_pos` | `position` |
| 11 | `optional_block_pos` | `optional_block_pos` | `["option","position"]` |
| 12 | `direction` | `direction` | `varint` |
| 13 | `optional_uuid` | `optional_uuid` | `["option","UUID"]` |
| 14 | `block_state` | `block_state` | `varint` |
| 15 | `optional_block_state` | `optional_block_state` | `optvarint` |
| 16 | `compound_tag` | `particle` | `Particle` |
| 17 | `particle` | `particles` | `["array",{"countType":"varint","type":"Particle"}]` |
| 18 | `particles` | `villager_data` | `["container",[{"name":"villagerType","type":"varint"},{"name":"villagerProfession","type":"varint"},{"name":"level","type":"varint"}]]` |
| 19 | `villager_data` | `optional_unsigned_int` | `optvarint` |
| 20 | `optional_unsigned_int` | `pose` | `varint` |
| 21 | `pose` | `cat_variant` | `varint` |
| 22 | `cat_variant` | `cow_variant` | `varint` |
| 23 | `wolf_variant` | `wolf_variant` | `varint` |
| 24 | `frog_variant` | `wolf_sound_variant` | `varint` |
| 25 | `optional_global_pos` | `frog_variant` | `varint` |
| 26 | `painting_variant` | `pig_variant` | `varint` |
| 27 | `sniffer_state` | `chicken_variant` | `varint` |
| 28 | `armadillo_state` | `zombie_nautilus_variant` | `varint` |
| 29 | `vector3` | `optional_global_pos` | `["option","GlobalPos"]` |
| 30 | `quaternion` | `painting_variant` | `["registryEntryHolder",{"baseName":"variantId","otherwise":{"name":"variantData","type":"EntityMetadataPaintingVariant"}}]` |
| 31 | — | `sniffer_state` | `varint` |
| 32 | — | `armadillo_state` | `varint` |
| 33 | — | `copper_golem_state` | `varint` |
| 34 | — | `weathering_copper_golem_state` | `varint` |
| 35 | — | `vector3` | `vec3f` |
| 36 | — | `quaternion` | `vec4f` |
| 37 | — | `resolvable_profile` | `ResolvableProfile` |
| 38 | — | `humanoid_arm` | `["mapper",{"type":"varint","mappings":{"0":"left","1":"right"}}]` |

### 4.5 `Particle` (`109 -> 115` particle types)

- **Count:** 109 (0..108) -> 115 (0..114).
- **Added (6):** `copper_fire_flame` (5), `pale_oak_leaves` (35), `tinted_leaves` (36), `trail` (49), `block_crumble` (113), `firefly` (114).
- **ID shifts:** 104 particle IDs shifted (everything from `crit` ID 5 onward shifted due to inserting `copper_fire_flame` at 5, `pale_oak_leaves`/`tinted_leaves` at 35–36, `trail` at 49, and appending `block_crumble`/`firefly` at 113–114).
- **Data Payload Changes:**
  - `dust`: 1.20.6=`["container",[{"name":"red","type":"f32"},{"name":"green","type":"f32"},{"name":"blue","type":"f32"},{"name":"scale","type":"f32"}]]` -> 1.21.11=`["container",[{"name":"color","type":"i32"},{"name":"scale","type":"f32"}]]`
  - `dust_color_transition`: 1.20.6=`["container",[{"name":"fromRed","type":"f32"},{"name":"fromGreen","type":"f32"},{"name":"fromBlue","type":"f32"},{"name":"scale","type":"f32"},{"name":"toRed","type":"f32"},{"name":"toGreen","type":"f32"},{"name":"toBlue","type":"f32"}]]` -> 1.21.11=`["container",[{"name":"fromColor","type":"i32"},{"name":"toColor","type":"i32"},{"name":"scale","type":"f32"}]]`
  - `block_crumble`: 1.20.6=*(none/void)* -> 1.21.11=`varint`
  - `trail`: 1.20.6=*(none/void)* -> 1.21.11=`["container",[{"name":"target","type":"vec3f64"},{"name":"color","type":"i32"},{"name":"duration","type":"varint"}]]`
  - `tinted_leaves`: 1.20.6=*(none/void)* -> 1.21.11=`i32`
  - `firefly`: 1.20.6=*(none/void)* -> 1.21.11=`void`
  - `dragon_breath`: 1.20.6=*(none/void)* -> 1.21.11=`["container",[{"name":"power","type":"f32"}]]`
  - `effect`: 1.20.6=*(none/void)* -> 1.21.11=`["container",[{"name":"color","type":"i32"},{"name":"power","type":"f32"}]]`
  - `instant_effect`: 1.20.6=*(none/void)* -> 1.21.11=`["container",[{"name":"color","type":"i32"},{"name":"power","type":"f32"}]]`
  - `flash`: 1.20.6=*(none/void)* -> 1.21.11=`i32`
- *(Note: `Particle.data` still omits `"default": "void"` in `protocol.json`, requiring the schema codec to treat unmatched switch keys as `void`.)*

### 4.6 `command_node`

- **`flags` bitfield (8 bits):** Added `allows_restricted` (1 bit) in place of 1 `unused` bit (`unused` 3 -> 2 bits).
- **`parser` mapper (54 -> 57):**
  - **Added (3):** `minecraft:hex_color` (17), `minecraft:resource_selector` (48), `minecraft:dialog` (55).
  - **ID shifts:** 37 parser IDs shifted (everything >= 17 shifted due to `minecraft:hex_color` at 17, `minecraft:resource_selector` at 48, `minecraft:dialog` at 55).
- **`properties` switch:** `minecraft:hex_color`, `minecraft:resource_selector` (`{registry: string}`), and `minecraft:dialog` (`void`) added. Six singleton context-aware parsers still omit branches in `properties.fields` (no `default`): `minecraft:style`, `minecraft:nbt_tag`, `minecraft:item_slots`, `minecraft:loot_table`, `minecraft:loot_predicate`, `minecraft:loot_modifier`.

### 4.7 `chunk` / `map_chunk`

- **`packet_map_chunk`:**
  - `heightmaps`: changed from `anonymousNbt` to `["array", {"countType": "varint", "type": ["container", [{"name": "type", "type": ["mapper", {"type": "varint", "mappings": {"0": "world_surface_wg", "1": "world_surface", "2": "ocean_floor_wg", "3": "ocean_floor", "4": "motion_blocking", "5": "motion_blocking_no_leaves"}}]}, {"name": "data", "type": ["array", {"countType": "varint", "type": "i64"}]}]]}]` (introduced in 1.21.5).
  - `chunkData`: changed from inline `["buffer", {"countType": "varint"}]` to named alias `ByteArray` (identical wire encoding).
- **Inner `chunkData` Binary Payload (1.21.5+, outside `protocol.json`):** `PalettedContainer` no longer prefixes the `long[]` data array with a `VarInt` length; the client must compute `long[]` length as `ceil(entries / floor(64 / bitsPerEntry))`.

### 4.8 `login`, `respawn`, `SpawnInfo`, & `spawn_position`

- `packet_login` and `packet_respawn` keep their outer fields, but `SpawnInfo` changed:
  - `death`: inline `{dimensionName: string, location: position}` extracted to `GlobalPos`.
  - Added trailing `seaLevel: varint` (introduced in 1.21.2).
- `packet_spawn_position` changed from `{location: position, angle: f32}` to `RespawnData` (`{globalPos: GlobalPos, yaw: f32, pitch: f32}` — adds dimension name + separate pitch).

### 4.9 `position`, `player_rotation`, `entity_teleport`, `sync_entity_position`, & `MovementFlags`

- **`packet_position` (S->C):** Reordered and expanded from `(x, y, z, yaw, pitch, flags: u8, teleportId)` to `(teleportId: varint, x: f64, y: f64, z: f64, dx: f64, dy: f64, dz: f64, yaw: f32, pitch: f32, flags: PositionUpdateRelatives)`.
- **`PositionUpdateRelatives`:** Expanded from `bitflags(u8)` (5 flags: `x, y, z, yaw, pitch`) to `bitflags(u32)` (9 flags: `x, y, z, yaw, pitch, dx, dy, dz, yawDelta`).
- **`packet_entity_teleport` & `packet_sync_entity_position` (S->C):** `entity_teleport` replaced `(entityId, x, y, z, yaw: i8, pitch: i8, onGround)` with `(entityId, x, y, z, dx, dy, dz, yaw: f32, pitch: f32, flags: PositionUpdateRelatives, onGround)`, while `sync_entity_position` covers the non-relative `f64/f32` position+velocity sync.
- **`packet_player_rotation` (S->C, added):** `{yaw: f32, relativeYaw: bool, pitch: f32, relativePitch: bool}`.
- **Serverbound `position`, `position_look`, `look`, `flying` (C->S):** Replaced trailing `onGround: bool` with `flags: MovementFlags` (`["bitflags", {"type": "u8", "flags": ["onGround", "hasHorizontalCollision"]}]`). `vehicle_move` (C->S) also added trailing `onGround: bool`.

### 4.10 `player_info`

- `action` `bitflags(u8)` expanded from 6 flags (`0..5`) to 8 flags (`0..7`), adding `update_hat` (bit 6) and `update_list_order` (bit 7).
- `player` branch (`add_player`): renamed `game_profile` -> `game_profile_name_prop` (same layout: `{name: string, properties: array}`).
- Entry fields added: `listPriority: varint` (when `update_list_order`), `showHat: bool` (when `update_hat`).

### 4.11 `explosion`

- `1.20.6`: `(x, y, z, radius, affectedBlockOffsets: array<i8,i8,i8>, playerMotionX/Y/Z: f32, block_interaction_type: varint, small_explosion_particle, large_explosion_particle, sound)`.
- `1.21.11`: `(center: vec3f64, radius: f32, blockCount: i32, playerKnockback: option<vec3f64>, explosionParticle: Particle, sound: ItemSoundHolder, blockParticles: array<ExplosionParticleEntry>)` where `ExplosionParticleEntry = {data: {particle: Particle, scaling: f32, speed: f32}, weight: varint}`.

### 4.12 `declare_recipes` & Recipe Book Packets

- **`declare_recipes`:** No longer carries full crafting/smelting/smithing definitions (all `24` recipe serializers, `minecraft_simple_recipe_format`, `minecraft_smelting_format` removed). Now only transmits `{recipes: array({name: string, items: varint[]}), stoneCutterRecipes: array({input: IDSet, slotDisplay: SlotDisplay})}`.
- **`unlock_recipes` removed; replaced by 3 packets:** `recipe_book_add` (entries with `displayId, RecipeDisplay, group: optvarint, category: mapper(0..12), craftingRequirements: option<IDSet[]>, flags: bitflags{notification, highlight}` + `replace: bool`), `recipe_book_remove` (`recipeIds: varint[]`), and `recipe_book_settings` (`crafting/furnace/blast/smoker: RecipeBookSetting{open, filtering}`).
- **`craft_recipe_response` (S->C):** `{windowId: ContainerID, recipe: string}` -> `{windowId: ContainerID, recipeDisplay: RecipeDisplay}`.
- **`craft_recipe_request` / `displayed_recipe` (C->S):** `recipe: string` -> `recipeId: varint` (and `craft_recipe_request.windowId` `i8 -> ContainerID (varint)`).

### 4.13 `RegistryData` (`configuration.registry_data` & `loginPacket.json`)

- **`configuration.toClient.registry_data` wire schema:** Unchanged (`{id: string, entries: array({key: string, value: option<anonymousNbt>})}` — `value` omitted when negotiated via `select_known_packs`).
- **Synced registries count (`loginPacket.json` vs `known-pack-1.20.6.js`):** Expanded from **8** registries in 1.20.6 to **23** registries in 1.21.11 `loginPacket.json`:
  - `minecraft:worldgen/biome`: 65 entries
  - `minecraft:chat_type`: 7 entries
  - `minecraft:trim_pattern`: 18 entries
  - `minecraft:trim_material`: 11 entries
  - `minecraft:wolf_variant`: 9 entries
  - `minecraft:wolf_sound_variant`: 7 entries
  - `minecraft:pig_variant`: 3 entries
  - `minecraft:frog_variant`: 3 entries
  - `minecraft:cat_variant`: 11 entries
  - `minecraft:cow_variant`: 3 entries
  - `minecraft:chicken_variant`: 3 entries
  - `minecraft:zombie_nautilus_variant`: 2 entries
  - `minecraft:painting_variant`: 51 entries
  - `minecraft:dimension_type`: 4 entries
  - `minecraft:damage_type`: 50 entries
  - `minecraft:banner_pattern`: 43 entries
  - `minecraft:enchantment`: 43 entries
  - `minecraft:jukebox_song`: 21 entries
  - `minecraft:instrument`: 8 entries
  - `minecraft:test_environment`: 1 entries
  - `minecraft:test_instance`: 1 entries
  - `minecraft:dialog`: 3 entries
  - `minecraft:timeline`: 4 entries
- **Note on `known-pack-1.20.6.js` & biome schemas:** In `1.21.11`, biome NBT entries (`minecraft:worldgen/biome`) carry `attributes` (e.g. `minecraft:visual/sky_color`, `minecraft:audio/background_music`) and string hex colors in `effects` rather than legacy integer colors.

### 4.14 `Chat` & `Component` NBT Types

- **Chat packets:**
  - `play.toClient.player_chat`: Prepended `globalIndex: varint`; changed `type` from `varint` to `ChatTypesHolder` (`registryEntryHolder` with inline `ChatTypes` fallback).
  - `play.toClient.profileless_chat`: Changed `type` from `varint` to `ChatTypesHolder`.
  - `play.toServer.chat_message` / `chat_command_signed`: Appended trailing `checksum: u8` (`chat_message`) / `checksum: i8` (`chat_command_signed`).
- **Component NBT payload changes (`anonymousNbt` / `component-nbt-1.20.6.js`):**
  - `SlotComponent` `lore` changed from `anonOptionalNbt[]` to `anonymousNbt[]` (non-optional entries).
  - Text Component NBT structure changed in 1.21.5+ (affecting `component-nbt-1.20.6.js`, which currently rejects unknown fields/types):
    - `clickEvent` -> `click_event` (action-specific keys `url`/`path`/`command`/`page`/`value`/`dialog`/`id`+`payload` instead of `value`).
    - `hoverEvent` -> `hover_event` (`show_text` uses `value`; `show_item` inlines `id, count, components`; `show_entity` inlines `name, id, uuid` without `contents` wrapper).
    - Added `shadow_color` (ARGB `int` or `[r, g, b, a]` float list) formatting field.
    - Added `object` content type (`"atlas"` sprite or `"player"` profile head sprite) in 1.21.9+ (`component-nbt-1.20.6.js` `COMPONENT_TYPES` only allows `text, translatable, score, selector, nbt, keybind`).

---

## 5. Downloaded `1.21.11` Data Files Summary (`cache/port-1.21.11/upstream/`)

| Local File | Upstream Path (`pc/...`) | Size (bytes) | SHA-1 | Record Count / Summary |
| --- | --- | ---: | --- | --- |
| `attributes.json` | `pc/1.21.11/attributes.json` | 4859 | `c5f5a4fd65d67edd1063498940a32256865af783` | 35 entries |
| `biomes.json` | `pc/1.21.11/biomes.json` | 14099 | `f366550eb6d4b3a09af97e16a1250bdc3b9b94aa` | 65 entries |
| `blockCollisionShapes.json` | `pc/1.21.11/blockCollisionShapes.json` | 1800338 | `278bbfccf79821d4f5dbb6ea227e1b6a86ca1641` | 1166 block mappings, 5128 shapes |
| `blockLoot.json` | `pc/1.20/blockLoot.json` | 207762 | `31b1d6ae8129b1bfa1d65819e9ac6199fc5dfeb2` | 925 entries |
| `blocks.json` | `pc/1.21.11/blocks.json` | 859248 | `637af0f4567076db7890c0b0722f2ad44dea1230` | 1166 blocks, 29671 block states |
| `commands.json` | `pc/1.21.6/commands.json` | 798643 | `9bc39299b20b66f183ec286606bcd8996892edae` | root + 86 parsers |
| `effects.json` | `pc/1.21.11/effects.json` | 3999 | `3ab14f83f1c924b798d27f80cd6efb835e752e2b` | 40 entries |
| `enchantments.json` | `pc/1.21.11/enchantments.json` | 16721 | `7df05ba19ff1d7200388bacb80dbc8a90fe3ae1b` | 43 entries |
| `entities.json` | `pc/1.21.11/entities.json` | 87002 | `5d2f3a6447324a410b72d60ecf023339023ff110` | 157 entries |
| `entityLoot.json` | `pc/1.20/entityLoot.json` | 19091 | `2d37a44e4d1450a0ea2e5e18de092f165a3063d6` | 81 entries |
| `foods.json` | `pc/1.21.11/foods.json` | 9364 | `ec70b2554ecdc4196c22c162f7b4545f50e42a3a` | 44 entries |
| `instruments.json` | `pc/1.21.11/instruments.json` | 1023 | `767af4b5e8ca26704daa2b8889cff465fcf5e521` | 23 entries |
| `items.json` | `pc/1.21.11/items.json` | 189280 | `6c65a94b47a6ce11742986910eaa3b457e9d4faa` | 1505 entries |
| `language.json` | `pc/1.21.11/language.json` | 492707 | `33ad14bf428ba5135be5942842bb5aef8073ffe4` | 7767 top-level keys |
| `loginPacket.json` | `pc/1.21.11/loginPacket.json` | 645760 | `2d19e9bbdc93c6cc89cfeada7228443ca025184f` | 12 fields, 23 dimensionCodec registries |
| `mapIcons.json` | `pc/1.20.2/mapIcons.json` | 3957 | `0793442b142b6c895efd52d52e514e31809397e3` | 34 entries |
| `materials.json` | `pc/1.21.11/materials.json` | 3687 | `e4e58ed8d29a2e965531023f9bd1fbf03b60224e` | 25 top-level keys |
| `particles.json` | `pc/1.21.11/particles.json` | 5690 | `f1ca30b312f962b36a8671c4f443edfc48ba9d19` | 115 entries |
| `proto.yml` | `pc/1.21.11/proto.yml` | 114909 | `1c9786eeded532a8fe4c49fd531e4fa8a5ecbc39` | ProtoDef YAML definition |
| `protocol.json` | `pc/1.21.11/protocol.json` | 330084 | `39158e28155bdbc28c50e2937aaf45303edb48c8` | protocol 774, 108 global types |
| `recipes.json` | `pc/1.21.11/recipes.json` | 403798 | `6d431d969fb63130e37f0884299fa7ed7c4dce9e` | 886 top-level keys |
| `sounds.json` | `pc/1.21.11/sounds.json` | 114586 | `37746cfe2d02f2238d2e735f0ddafd71edae6136` | 1838 entries |
| `tints.json` | `pc/1.21.11/tints.json` | 8862 | `97bc36d22c886ebefb001014fdd51a0aa2026735` | 5 top-level keys |
| `version.json` | `pc/1.21.11/version.json` | 107 | `742c255397ef089b09bcb3d8f095a2c7384267b8` | version 774 (1.21.11) |
| `windows.json` | `pc/1.16.1/windows.json` | 3472 | `b742a8ab61b82aac67e5b203f08fc083c761db42` | 14 entries |
