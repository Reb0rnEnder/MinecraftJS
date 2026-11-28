# Java Bytecode & Data-Report Oracle — Minecraft 1.21.11 (Protocol 774)

Verified against official Mojang 1.21.11 artifacts in `cache/port-1.21.11/`:

| Artifact | SHA-1 | Size (bytes) |
|---|---|---:|
| `version.json` | `673208434aebac19a7317e40f6b1588169e4e1f1` | 42,248 |
| `client.jar` | `ba2df812c2d12e0219c489c4cd9a5e1f0760f5bd` | 31,152,600 |
| `client.txt` | `031a68bebf55d824f66d6573d8c752f0e1bf232a` | 11,779,287 |
| `server.jar` | `64bb6d763bed0a9f1d632ec347938594144943ed` | 56,327,581 |
| `server.txt` | `5621e9253f05fd57872bbe7f8ddf5f9a7d525955` | 8,678,606 |
| `asset-index.json` (`29`) | `2cad63b294a82994828491a126a38598833e7303` | 530,166 |

Unpacked server bundler (`cache/port-1.21.11/bundler/META-INF/`): **40** jars (`39` library jars + `versions/1.21.11/server-1.21.11.jar`).

---

## 1. Mojang Native `--reports` & Resource Layout

### 1.1 Generated Reports (`cache/port-1.21.11/generated/reports/`)

| Report | Canonical SHA-1 | Summary |
|---|---|---|
| `blocks.json` | `96bb25e8dbcc88a27ca516d9c0cdaa9b257573f9` | **1,166** blocks, **29,671** block states (`0..29670`), 1 default state per block |
| `items.json` | `e33f47bef818d7ab1a81434acc8be8553fa24898` | **1,505** items, **18,953** default component entries; `item.components` is now a JSON object `{ "<component_id>": value }` (not an array) |
| `registries.json` | `9552332e07babf0e22e8c935ee0ef3bb6655cc67` | **95** built-in registries, all with contiguous `protocol_id` values starting from `0` |
| `commands.json` | `086cd22a7b0ca1041137c33dc1c3f47e26d46c4b` | Root Brigadier command tree (`85` root commands including `dialog`, `fetchprofile`, `rotate`, `stopwatch`, `test`, `waypoint`, etc.) |
| `packets.json` | `6d0caf634e803c51ae2271ef65fba8d3cf5d357a` | Native packet registry dump across all 5 phases (new in 1.21.x) |
| `datapack.json` | `dd984734d68ddb3a4b79144f389341d410f0230c` | Datapack registry structure (`elements`, `stable`, `tags`) for all registries + `function` & `structure` |
| `json-rpc-api-schema.json` | `bbc26acafff0352e9a228a5e08ac2329f6834313` | OpenRPC `1.3.2` schema (`Minecraft Server JSON-RPC` `2.0.0`, **85** methods, **14** schemas) |
| `biome_parameters/minecraft/` | — | `nether.json`, `overworld.json` |

### 1.2 `client.jar` & `asset-index.json` Resource Layout

- `pack.mcmeta` is **not** present in `client.jar` or `server.jar`; it is stored in `asset-index.json` (`"pack.mcmeta"`, hash `144191232b81d0fb1c4f9a7206f7e3fc0d4a2b94`, size `19950`). Title panoramas (`minecraft/textures/gui/title/background/panorama_*.png`) and `minecraft/resourcepacks/{high_contrast,programmer_art}.zip` are also in `asset-index.json`.
- `client.jar` embedded `version.json` reports:
  - `id`: `"1.21.11"`, `world_version`: `4671`, `protocol_version`: `774`, `java_version`: `21`, `series_id`: `"main"`, `stable`: `true`
  - `pack_version`: `{ "resource_major": 75, "resource_minor": 0, "data_major": 94, "data_minor": 1 }`
- `assets/minecraft/` inside `client.jar`:
  - `textures/`: **3,682** total (**3,517** `.png`, **165** `.mcmeta`)
  - `textures/gui/sprites/`: **487** total (**445** `.png`, **42** `.mcmeta`)
  - `models/`: **3,673** `.json`
  - `items/`: **1,505** `.json` (1.21.4+ item model definitions, 1:1 with `minecraft:item` count)
  - `blockstates/`: **1,168** `.json`
  - `lang/`: **2** `.json` (`deprecated.json`, `en_us.json`)
  - `atlases/`: **15** `.json` (`armor_trims`, `banner_patterns`, `beds`, `blocks`, `celestials`, `chests`, `decorated_pot`, `gui`, `items`, `map_decorations`, `paintings`, `particles`, `shield_patterns`, `shulker_boxes`, `signs`)
  - `font/`: **7** `.json` (`alt`, `default`, `illageralt`, `uniform`, `include/default`, `include/space`, `include/unifont`)
  - `equipment/`: **44** `.json` (1.21.4+ armor/saddle/carpet/harness/elytra equipment layer definitions)
  - `particles/`: **104** `.json`
  - `shaders/`: **93** files (**38** `.vsh`, **47** `.fsh`, **8** `.glsl`, **0** `.json` — post-effect definitions moved to `post_effect/`: **6** `.json`; `waypoint_style/`: **2** `.json`)
- `asset-index.json` (`29`): **4,593** objects total — `minecraft/lang/`: **144**, `minecraft/sounds/`: **4,405**, `minecraft/font/`: **5** (`include/unifont.json`, `include/unifont_pua.json`, `unifont.zip`, `unifont_jp.zip`, `unifont_pua.zip`).

---

## 2. `FeatureFlags` (`net.minecraft.world.flag.FeatureFlags` -> `dhb`)

Verified via `server.txt` and JVM bytecode `<clinit>()`:

- Universe: `new FeatureFlagRegistry.Builder("main")`
- Registered flags (in static init order):
  1. `VANILLA` (`a`) -> `minecraft:vanilla`
  2. `TRADE_REBALANCE` (`b`) -> `minecraft:trade_rebalance`
  3. `REDSTONE_EXPERIMENTS` (`c`) -> `minecraft:redstone_experiments`
  4. `MINECART_IMPROVEMENTS` (`d`) -> `minecraft:minecart_improvements`
- `VANILLA_SET` (`g`) = `FeatureFlagSet.of(VANILLA)`
- `DEFAULT_FLAGS` (`h`) = `VANILLA_SET` (`["minecraft:vanilla"]`)
- Experimental flags (`!isSubsetOf(VANILLA_SET)`): `minecraft:trade_rebalance`, `minecraft:redstone_experiments`, `minecraft:minecart_improvements`.
- Note: `net.minecraft.resources.ResourceLocation` was renamed to `net.minecraft.resources.Identifier` (`amo`).

---

## 3. `SharedConstants` / `WorldVersion` / `PackFormat`

- `SharedConstants` (`w`):
  - `SNAPSHOT = false`
  - `WORLD_VERSION = 4671`
  - `SERIES = "main"`
  - `RELEASE_NETWORK_PROTOCOL_VERSION = 774` (`getProtocolVersion()` returns `774`)
  - `SNAPSHOT_NETWORK_PROTOCOL_VERSION = 286`, `SNAPSHOT_PROTOCOL_BIT = 30`
  - `SNBT_NAG_VERSION = 4650`
  - `RESOURCE_PACK_FORMAT_MAJOR = 75`, `RESOURCE_PACK_FORMAT_MINOR = 0`
  - `DATA_PACK_FORMAT_MAJOR = 94`, `DATA_PACK_FORMAT_MINOR = 1`
  - `RPC_MANAGEMENT_SERVER_API_VERSION = "2.0.0"`
- `WorldVersion` (`aa`) & `WorldVersion$Simple` (`aa$a`) + `DetectedVersion` (`r`):
  - `WorldVersion.packVersion(PackType)` returns `PackFormat` (instead of `int`).
  - `DetectedVersion.createFromJson` reads `pack_version.resource_major`, `pack_version.resource_minor`, `pack_version.data_major`, `pack_version.data_minor`.
- `PackFormat` (`azz`) & `PackType` (`azn`):
  - `record PackFormat(int major, int minor) implements Comparable<PackFormat>`
  - `PackFormat.lastPreMinorVersion(PackType)`: `CLIENT_RESOURCES ("assets") -> 64`, `SERVER_DATA ("data") -> 81`.
  - `pack.mcmeta` supports `min_format` (`BOTTOM_CODEC`, minor defaults to `0`) and `max_format` (`TOP_CODEC`, minor defaults to `Integer.MAX_VALUE`) as `[major]` or `[major, minor]` compact lists; `supported_formats` is disallowed for packs requiring `major > lastPreMinorVersion`.

---

## 4. `DataComponents` (`ki`) & `DataComponentType` (`kh`)

- Total registered in `minecraft:data_component_type`: **104** (protocol IDs `0..103`, contiguous).
- `DataComponentType.STREAM_CODEC`: `ByteBufCodecs.registry(Registries.DATA_COMPONENT_TYPE)` (`VarInt` registry ID).
- `DataComponentType.Builder.build()`: if `.networkSynchronized(...)` is omitted, defaults to `ByteBufCodecs.fromCodecWithRegistries(codec)` (anonymous root NBT tag on the wire).
  - **Persistent-only (no explicit `networkSynchronized`; use NBT-over-wire fallback)**: `custom_data` (`0`), `intangible_projectile` (`22`), `map_decorations` (`45`), `debug_stick_state` (`55`), `recipes` (`64`), `lock` (`76`), `container_loot` (`77`).
  - **Transient-only (`codec == null`; excluded from `PERSISTENT_CODEC` / disk NBT, synchronized on wire)**: `creative_slot_lock` (`20`, `Unit.STREAM_CODEC` = 0 bytes), `map_post_processing` (`46`, `MapPostProcessing.STREAM_CODEC`).
  - **`ignoreSwapAnimation()`**: set on `damage` (`3`).
- `DataComponents.COMMON_ITEM_COMPONENTS` (10 defaults shared by items) plus per-item `item_name` & `item_model` = 12 common components present on all 1,505 items (`max_stack_size`, `lore`, `enchantments`, `repair_cost`, `use_effects`, `attribute_modifiers`, `rarity`, `break_sound`, `tooltip_display`, `swing_animation`, `item_name`, `item_model`).

### Exact `minecraft:data_component_type` Registry Order (`0..103`)

`0: custom_data`, `1: max_stack_size`, `2: max_damage`, `3: damage`, `4: unbreakable`, `5: use_effects`, `6: custom_name`, `7: minimum_attack_charge`, `8: damage_type`, `9: item_name`, `10: item_model`, `11: lore`, `12: rarity`, `13: enchantments`, `14: can_place_on`, `15: can_break`, `16: attribute_modifiers`, `17: custom_model_data`, `18: tooltip_display`, `19: repair_cost`, `20: creative_slot_lock`, `21: enchantment_glint_override`, `22: intangible_projectile`, `23: food`, `24: consumable`, `25: use_remainder`, `26: use_cooldown`, `27: damage_resistant`, `28: tool`, `29: weapon`, `30: attack_range`, `31: enchantable`, `32: equippable`, `33: repairable`, `34: glider`, `35: tooltip_style`, `36: death_protection`, `37: blocks_attacks`, `38: piercing_weapon`, `39: kinetic_weapon`, `40: swing_animation`, `41: stored_enchantments`, `42: dyed_color`, `43: map_color`, `44: map_id`, `45: map_decorations`, `46: map_post_processing`, `47: charged_projectiles`, `48: bundle_contents`, `49: potion_contents`, `50: potion_duration_scale`, `51: suspicious_stew_effects`, `52: writable_book_content`, `53: written_book_content`, `54: trim`, `55: debug_stick_state`, `56: entity_data`, `57: bucket_entity_data`, `58: block_entity_data`, `59: instrument`, `60: provides_trim_material`, `61: ominous_bottle_amplifier`, `62: jukebox_playable`, `63: provides_banner_patterns`, `64: recipes`, `65: lodestone_tracker`, `66: firework_explosion`, `67: fireworks`, `68: profile`, `69: note_block_sound`, `70: banner_patterns`, `71: base_color`, `72: pot_decorations`, `73: container`, `74: block_state`, `75: bees`, `76: lock`, `77: container_loot`, `78: break_sound`, `79: villager/variant`, `80: wolf/variant`, `81: wolf/sound_variant`, `82: wolf/collar`, `83: fox/variant`, `84: salmon/size`, `85: parrot/variant`, `86: tropical_fish/pattern`, `87: tropical_fish/base_color`, `88: tropical_fish/pattern_color`, `89: mooshroom/variant`, `90: rabbit/variant`, `91: pig/variant`, `92: cow/variant`, `93: chicken/variant`, `94: zombie_nautilus/variant`, `95: frog/variant`, `96: horse/variant`, `97: painting/variant`, `98: llama/variant`, `99: axolotl/variant`, `100: cat/variant`, `101: cat/collar`, `102: sheep/color`, `103: shulker/color`.

---

## 5. `ComponentSerialization` (`yj`) — NBT Encoding of Text Components

- Wire framing:
  - `ComponentSerialization.STREAM_CODEC`: `ByteBufCodecs.fromCodecWithRegistries(CODEC)` (anonymous root NBT tag via `NbtIo.writeAnyTag`/`readAnyTag` with `NbtAccounter.defaultQuota()` = 2 MB).
  - `ComponentSerialization.TRUSTED_STREAM_CODEC`: same with `NbtAccounter.unlimitedHeap()`.
  - `TRUSTED_CONTEXT_FREE_STREAM_CODEC`: `ByteBufCodecs.fromCodecTrusted(CODEC)` (no `RegistryOps`).
- Top-level `ComponentSerialization.CODEC`:
  - `Codec.either(Codec.either(Codec.STRING, ExtraCodecs.nonEmptyList(CODEC.listOf())), compoundCodec)`
  - On **encode**: if `component.tryCollapseToString() != null` (i.e., `PlainTextContents` with empty `siblings` and `Style.EMPTY`), writes a `TAG_String`. Otherwise writes a `TAG_Compound` (never writes top-level `TAG_List`; siblings go in `"extra"`).
  - On **decode**: accepts `TAG_String`, non-empty `TAG_List` (`createFromList` appends tail as siblings), or `TAG_Compound`.
- `ComponentContents` (`yi`) via `createLegacyComponentMatcher(..., "type")`:
  - Because `NbtOps.compressMaps()` is `false`, `orCompressed` selects `StrictEither`: on decode, if `"type"` key is present it dispatches by `"type"`, otherwise `FuzzyCodec` probes the 7 codecs; on encode, `"type"` is **omitted** and only the content-specific fields are emitted:
  1. `"text"` (`PlainTextContents`): `{ text: string }`
  2. `"translatable"` (`TranslatableContents`): `{ translate: string, fallback?: string, with?: (primitive | Component)[] }`
  3. `"keybind"` (`KeybindContents`): `{ keybind: string }`
  4. `"score"` (`ScoreContents`): `{ score: { name: SelectorPattern | string, objective: string } }` (wrapped inside `"score"` key!)
  5. `"selector"` (`SelectorContents`): `{ selector: SelectorPattern, separator?: Component }`
  6. `"nbt"` (`NbtContents`): `{ nbt: string, interpret?: boolean, separator?: Component, ...DataSources }`
  7. `"object"` (`ObjectContents`, **new**): `ObjectInfos.CODEC` dispatched on `"object"` (via `StrictEither`):
     - `"atlas"` (`AtlasSprite`): `{ atlas?: Identifier (default minecraft:blocks), sprite: Identifier }`
     - `"player"` (`PlayerSprite`): `{ player: ResolvableProfile, hat?: boolean (default true) }`
- `Style$Serializer.MAP_CODEC` (`zf$b`) fields merged into the `TAG_Compound`:
  - `color` (`TextColor.CODEC`: legacy name or `#RRGGBB`)
  - `shadow_color` (`ExtraCodecs.ARGB_COLOR_CODEC`: `TAG_Int` packed ARGB OR 4-float `[r, g, b, a]` list)
  - `bold`, `italic`, `underlined`, `strikethrough`, `obfuscated` (`Codec.BOOL` -> `TAG_Byte` 0/1)
  - `click_event` (**snake_case**, replaces `clickEvent`)
  - `hover_event` (**snake_case**, replaces `hoverEvent`)
  - `insertion` (`Codec.STRING`)
  - `font` (`FontDescription.CODEC`: `Identifier` string -> `FontDescription.Resource`)
- `ClickEvent` (`yf`, dispatched by `"action"`):
  - `open_url`: `{ action: "open_url", url: string }` (field renamed from `value` to `url`)
  - `open_file`: `{ action: "open_file", path: string }` (`allowFromServer = false` -> rejected by `ClickEvent.Action.CODEC`)
  - `run_command`: `{ action: "run_command", command: string }` (`ExtraCodecs.CHAT_STRING`; renamed from `value`)
  - `suggest_command`: `{ action: "suggest_command", command: string }` (`ExtraCodecs.CHAT_STRING`; renamed from `value`)
  - `show_dialog`: `{ action: "show_dialog", dialog: Holder<Dialog> }` (**new**)
  - `change_page`: `{ action: "change_page", page: int }` (`ExtraCodecs.POSITIVE_INT`, integer rather than string `value`)
  - `copy_to_clipboard`: `{ action: "copy_to_clipboard", value: string }`
  - `custom`: `{ action: "custom", id: Identifier, payload?: Tag }` (**new**)
- `HoverEvent` (`yo`, dispatched by `"action"`):
  - `show_text`: `{ action: "show_text", value: Component }`
  - `show_item`: `{ action: "show_item", id: Identifier, count?: int (default 1), components?: DataComponentPatch }` (`ItemStack.MAP_CODEC` **inlined** directly; no `contents` wrapper)
  - `show_entity`: `{ action: "show_entity", id: Identifier, uuid: UUID, name?: Component }` (`EntityTooltipInfo.CODEC` **inlined**; `type` renamed to `id`, `uuid` uses `UUIDUtil.LENIENT_CODEC`, no `contents` wrapper)

---

## 6. `ItemStack`, `HashedStack`, `ServerboundContainerClickPacket`, `ServerboundSetCreativeModeSlotPacket`

- `ItemStack` (`dlt`):
  - `OPTIONAL_STREAM_CODEC` uses `DataComponentPatch.STREAM_CODEC`:
    - `VarInt count`; if `count <= 0`, stops immediately (`ItemStack.EMPTY`).
    - Otherwise `Item.STREAM_CODEC` (`ByteBufCodecs.holderRegistry(Registries.ITEM)` = `VarInt` item ID) + `DataComponentPatch.STREAM_CODEC`:
      - `VarInt addedCount`, `VarInt removedCount`
      - `addedCount` × (`VarInt componentTypeId`, component value encoded with `componentType.streamCodec()`)
      - `removedCount` × (`VarInt componentTypeId`)
  - `STREAM_CODEC`: wraps `OPTIONAL_STREAM_CODEC`, throws on `isEmpty()`.
  - `OPTIONAL_UNTRUSTED_STREAM_CODEC`: uses `DataComponentPatch.DELIMITED_STREAM_CODEC`, where each added component payload is wrapped in `ByteBufCodecs.registryFriendlyLengthPrefixed(Integer.MAX_VALUE)` (leading `VarInt` byte length before the component value).
- `HashedStack` (`xa`) & `HashedPatchMap` (`wz`):
  - `HashedStack.STREAM_CODEC`: `Boolean hasItem`; if `false` -> `HashedStack.EMPTY`; if `true` (`ActualItem`):
    - `item`: `VarInt` (`ByteBufCodecs.holderRegistry(Registries.ITEM)`)
    - `count`: `VarInt`
    - `components`: `HashedPatchMap.STREAM_CODEC`:
      - `addedComponents`: `Map<DataComponentType<?>, Integer>` (max `256`): `VarInt mapSize` + `mapSize` × (`VarInt componentTypeId`, **4-byte big-endian `int`** hash)
      - `removedComponents`: `Set<DataComponentType<?>>` (max `256`): `VarInt setSize` + `setSize` × (`VarInt componentTypeId`)
  - Hash calculation (`ServerPlayer.containerSynchronizer` / `HashOps.CRC32C_INSTANCE` (`bfw`)):
    - Each `TypedDataComponent` value is encoded via `registryAccess().createSerializationContext(HashOps.CRC32C_INSTANCE)`, producing a 32-bit CRC32C `HashCode.asInt()` using `HashOps` structural type tags (`1=EMPTY`, `2/3=MAP`, `4/5=LIST`, `6=BYTE`, `7=SHORT`, `8=INT`, `9=LONG`, `10=FLOAT`, `11=DOUBLE`, `12=STRING`, `13=BOOL`, `14/15=BYTE[]`, `16/17=INT[]`, `18/19=LONG[]`, sorted map entries).
- `ServerboundContainerClickPacket` (`ais`, Play SB `17`):
  - `containerId`: `VarInt` (`ByteBufCodecs.CONTAINER_ID`)
  - `stateId`: `VarInt`
  - `slotNum`: `short` (2 bytes)
  - `buttonNum`: `byte` (1 byte)
  - `clickType`: `ClickType.STREAM_CODEC` (`VarInt`: `0=PICKUP`, `1=QUICK_MOVE`, `2=SWAP`, `3=CLONE`, `4=THROW`, `5=QUICK_CRAFT`, `6=PICKUP_ALL`)
  - `changedSlots`: `Map<Integer, HashedStack>` (max `128`): `VarInt count` + `count` × (`short slot`, `HashedStack`)
  - `carriedItem`: `HashedStack.STREAM_CODEC`
- `ServerboundSetCreativeModeSlotPacket` (`ajw`, Play SB `55`):
  - `slotNum`: `short` (2 bytes)
  - `itemStack`: `ItemStack.validatedStreamCodec(ItemStack.OPTIONAL_UNTRUSTED_STREAM_CODEC)` (note: uses length-prefixed `DELIMITED_STREAM_CODEC`!). Also gated by `GameProtocols.HAS_INFINITE_MATERIALS` modifier.

---

## 7. Protocol Packet Registrations (`Handshake` / `Status` / `Login` / `Configuration` / `Game`)

Verified against `HandshakeProtocols` (`akl`), `StatusProtocols` (`alu`), `LoginProtocols` (`akv`), `ConfigurationProtocols` (`acp`), `GameProtocols` (`aia`), and `generated/reports/packets.json` (all IDs contiguous from `0`):

- **Handshake** (`HandshakeProtocols`): SB **1** (`0: intention`), CB **0**.
- **Status** (`StatusProtocols`): CB **2** (`0: status_response`, `1: pong_response`), SB **2** (`0: status_request`, `1: ping_request`).
- **Login** (`LoginProtocols`):
  - CB (**6**): `0: login_disconnect`, `1: hello`, `2: login_finished`, `3: login_compression`, `4: custom_query`, `5: cookie_request`
  - SB (**5**): `0: hello`, `1: key`, `2: custom_query_answer`, `3: login_acknowledged`, `4: cookie_response`
- **Configuration** (`ConfigurationProtocols`):
  - CB (**20**): `0: cookie_request`, `1: custom_payload`, `2: disconnect`, `3: finish_configuration`, `4: keep_alive`, `5: ping`, `6: reset_chat`, `7: registry_data`, `8: resource_pack_pop`, `9: resource_pack_push`, `10: store_cookie`, `11: transfer`, `12: update_enabled_features`, `13: update_tags`, `14: select_known_packs`, `15: custom_report_details`, `16: server_links`, `17: clear_dialog`, `18: show_dialog`, `19: code_of_conduct`
  - SB (**10**): `0: client_information`, `1: cookie_response`, `2: custom_payload`, `3: finish_configuration`, `4: keep_alive`, `5: pong`, `6: resource_pack`, `7: select_known_packs`, `8: custom_click_action`, `9: accept_code_of_conduct`
- **Play** (`GameProtocols`):
  - CB (**139**, `0..138`): `0: bundle_delimiter`, `1: add_entity`, `2: animate`, `3: award_stats`, `4: block_changed_ack`, `5: block_destruction`, `6: block_entity_data`, `7: block_event`, `8: block_update`, `9: boss_event`, `10: change_difficulty`, `11: chunk_batch_finished`, `12: chunk_batch_start`, `13: chunks_biomes`, `14: clear_titles`, `15: command_suggestions`, `16: commands`, `17: container_close`, `18: container_set_content`, `19: container_set_data`, `20: container_set_slot`, `21: cookie_request`, `22: cooldown`, `23: custom_chat_completions`, `24: custom_payload`, `25: damage_event`, `26: debug/block_value`, `27: debug/chunk_value`, `28: debug/entity_value`, `29: debug/event`, `30: debug_sample`, `31: delete_chat`, `32: disconnect`, `33: disguised_chat`, `34: entity_event`, `35: entity_position_sync`, `36: explode`, `37: forget_level_chunk`, `38: game_event`, `39: game_test_highlight_pos`, `40: mount_screen_open`, `41: hurt_animation`, `42: initialize_border`, `43: keep_alive`, `44: level_chunk_with_light`, `45: level_event`, `46: level_particles`, `47: light_update`, `48: login`, `49: map_item_data`, `50: merchant_offers`, `51: move_entity_pos`, `52: move_entity_pos_rot`, `53: move_minecart_along_track`, `54: move_entity_rot`, `55: move_vehicle`, `56: open_book`, `57: open_screen`, `58: open_sign_editor`, `59: ping`, `60: pong_response`, `61: place_ghost_recipe`, `62: player_abilities`, `63: player_chat`, `64: player_combat_end`, `65: player_combat_enter`, `66: player_combat_kill`, `67: player_info_remove`, `68: player_info_update`, `69: player_look_at`, `70: player_position`, `71: player_rotation`, `72: recipe_book_add`, `73: recipe_book_remove`, `74: recipe_book_settings`, `75: remove_entities`, `76: remove_mob_effect`, `77: reset_score`, `78: resource_pack_pop`, `79: resource_pack_push`, `80: respawn`, `81: rotate_head`, `82: section_blocks_update`, `83: select_advancements_tab`, `84: server_data`, `85: set_action_bar_text`, `86: set_border_center`, `87: set_border_lerp_size`, `88: set_border_size`, `89: set_border_warning_delay`, `90: set_border_warning_distance`, `91: set_camera`, `92: set_chunk_cache_center`, `93: set_chunk_cache_radius`, `94: set_cursor_item`, `95: set_default_spawn_position`, `96: set_display_objective`, `97: set_entity_data`, `98: set_entity_link`, `99: set_entity_motion`, `100: set_equipment`, `101: set_experience`, `102: set_health`, `103: set_held_slot`, `104: set_objective`, `105: set_passengers`, `106: set_player_inventory`, `107: set_player_team`, `108: set_score`, `109: set_simulation_distance`, `110: set_subtitle_text`, `111: set_time`, `112: set_title_text`, `113: set_titles_animation`, `114: sound_entity`, `115: sound`, `116: start_configuration`, `117: stop_sound`, `118: store_cookie`, `119: system_chat`, `120: tab_list`, `121: tag_query`, `122: take_item_entity`, `123: teleport_entity`, `124: test_instance_block_status`, `125: ticking_state`, `126: ticking_step`, `127: transfer`, `128: update_advancements`, `129: update_attributes`, `130: update_mob_effect`, `131: update_recipes`, `132: update_tags`, `133: projectile_power`, `134: custom_report_details`, `135: server_links`, `136: waypoint`, `137: clear_dialog`, `138: show_dialog`.
  - SB (**66**, `0..65`): `0: accept_teleportation`, `1: block_entity_tag_query`, `2: bundle_item_selected`, `3: change_difficulty`, `4: change_game_mode`, `5: chat_ack`, `6: chat_command`, `7: chat_command_signed`, `8: chat`, `9: chat_session_update`, `10: chunk_batch_received`, `11: client_command`, `12: client_tick_end`, `13: client_information`, `14: command_suggestion`, `15: configuration_acknowledged`, `16: container_button_click`, `17: container_click`, `18: container_close`, `19: container_slot_state_changed`, `20: cookie_response`, `21: custom_payload`, `22: debug_subscription_request`, `23: edit_book`, `24: entity_tag_query`, `25: interact`, `26: jigsaw_generate`, `27: keep_alive`, `28: lock_difficulty`, `29: move_player_pos`, `30: move_player_pos_rot`, `31: move_player_rot`, `32: move_player_status_only`, `33: move_vehicle`, `34: paddle_boat`, `35: pick_item_from_block`, `36: pick_item_from_entity`, `37: ping_request`, `38: place_recipe`, `39: player_abilities`, `40: player_action`, `41: player_command`, `42: player_input`, `43: player_loaded`, `44: pong`, `45: recipe_book_change_settings`, `46: recipe_book_seen_recipe`, `47: rename_item`, `48: resource_pack`, `49: seen_advancements`, `50: select_trade`, `51: set_beacon`, `52: set_carried_item`, `53: set_command_block`, `54: set_command_minecart`, `55: set_creative_mode_slot`, `56: set_jigsaw_block`, `57: set_structure_block`, `58: set_test_block`, `59: sign_update`, `60: swing`, `61: teleport_to_entity`, `62: test_instance_block_action`, `63: use_item_on`, `64: use_item`, `65: custom_click_action`.

---

## 8. Chunk & Heightmap Wire Format (`ClientboundLevelChunkPacketData`, `LevelChunkSection`, `PalettedContainer`, `Heightmap`)

### 8.1 `ClientboundLevelChunkPacketData` (`aeq`) & `Heightmap` (`euq`)

- **Breaking change from 1.20.6**: Heightmaps are **no longer NBT**!
  - `HEIGHTMAPS_STREAM_CODEC` = `ByteBufCodecs.map(..., Heightmap.Types.STREAM_CODEC, ByteBufCodecs.LONG_ARRAY)`:
    1. `VarInt mapSize`
    2. For each heightmap (`Usage.CLIENT` only):
       - `VarInt heightmapTypeId` (`Heightmap.Types`: `0=WORLD_SURFACE_WG`, `1=WORLD_SURFACE [CLIENT]`, `2=OCEAN_FLOOR_WG`, `3=OCEAN_FLOOR`, `4=MOTION_BLOCKING [CLIENT]`, `5=MOTION_BLOCKING_NO_LEAVES [CLIENT]`)
       - `ByteBufCodecs.LONG_ARRAY`: `VarInt longCount` + `longCount` × `int64` (`FriendlyByteBuf.writeLongArray`)
  - Followed by:
    - `VarInt bufferLength` (max `0x200000` = 2 MiB) + `byte[bufferLength]` of concatenated `LevelChunkSection`s
    - `VarInt blockEntityCount` + `blockEntityCount` × `BlockEntityInfo`:
      - `byte packedXZ` (`(x & 15) << 4 | (z & 15)`)
      - `short y`
      - `VarInt blockEntityTypeId` (`Registries.BLOCK_ENTITY_TYPE`)
      - `Nullable CompoundTag` (anonymous NBT root tag, or `0x00` `TAG_End` for null)

### 8.2 `LevelChunkSection` (`eqr`) & `PalettedContainer` (`eqy`) & `Strategy` (`erd`)

- Each `LevelChunkSection.write(FriendlyByteBuf)` writes:
  1. `short nonEmptyBlockCount` (2 bytes)
  2. `PalettedContainer<BlockState> states`
  3. `PalettedContainer<Holder<Biome>> biomes`
- **Breaking change from 1.20.6 in `PalettedContainer.write` / `read`**:
  1. `byte bitsPerEntry` (`storage.getBits()`)
  2. `Palette`:
     - `bits == 0` -> `SingleValuePalette`: `VarInt globalId`
     - `LinearPalette` (`1..4` bits for blocks, `1..3` for biomes): `VarInt size`, then `size` × `VarInt globalId`
     - `HashMapPalette` (`5..8` bits for blocks): `VarInt size`, then `size` × `VarInt globalId`
     - `GlobalPalette` (`>= 9` bits for blocks, `>= 4` for biomes): 0 bytes
  3. `FriendlyByteBuf.writeFixedSizeLongArray(storage.getRaw())` — **NO `VarInt` array-length prefix**! The `long` count is computed strictly from `bitsInMemory` and `entryCount` (`SimpleBitStorage`: `valuesPerLong = Math.floor(64 / bits)`, `longCount = ceil(entryCount / valuesPerLong)`, and `0` longs when `bits == 0`).
- `Strategy` (`erd`):
  - `createForBlockStates` (`bitsPerAxis = 4`, `entryCount = 4096`): `0 -> ZERO_BITS`, `1..4 -> FOUR_BITS_LINEAR` (4 bits), `5..8 -> HASHMAP`, `>= 9 -> Global(globalPaletteBitsInMemory, bits)`.
  - `createForBiomes` (`bitsPerAxis = 2`, `entryCount = 64`): `0 -> ZERO_BITS`, `1..3 -> LINEAR` (1/2/3 bits), `>= 4 -> Global(globalPaletteBitsInMemory, bits)`.

---

## 9. `ClientboundPlayerPositionPacket` (`afp`), `PositionMoveRotation` (`chy`), `Relative` (`chz`)

- `ClientboundPlayerPositionPacket` (Play CB `70`):
  1. `id`: `VarInt` (teleport ID)
  2. `change`: `PositionMoveRotation.STREAM_CODEC`:
     - `position`: `Vec3.STREAM_CODEC` (3 × `double`: `x, y, z`)
     - `deltaMovement`: `Vec3.STREAM_CODEC` (3 × `double`: `dx, dy, dz` — full doubles, **not** `LpVec3`)
     - `yRot`: `float` (yaw)
     - `xRot`: `float` (pitch)
  3. `relatives`: `Relative.SET_STREAM_CODEC` = **`ByteBufCodecs.INT` (4-byte big-endian `int` bitmask)** (was 1 byte in 1.20.6, and `dismountVehicle` byte was removed):
     - Bit `0` (`0x001`): `X`
     - Bit `1` (`0x002`): `Y`
     - Bit `2` (`0x004`): `Z`
     - Bit `3` (`0x008`): `Y_ROT`
     - Bit `4` (`0x010`): `X_ROT`
     - Bit `5` (`0x020`): `DELTA_X`
     - Bit `6` (`0x040`): `DELTA_Y`
     - Bit `7` (`0x080`): `DELTA_Z`
     - Bit `8` (`0x100`): `ROTATE_DELTA`
- `PositionMoveRotation.calculateAbsolute(current, change, relatives)`: applies relative `X/Y/Z/Y_ROT/X_ROT`, clamps pitch `[-90, 90]`, rotates `current.deltaMovement` by `(current.yRot - newYRot)` and `(current.xRot - newXRot)` if `ROTATE_DELTA` is set, then adds `change.deltaMovement` components where `DELTA_X/Y/Z` are set.
- `ClientboundEntityPositionSyncPacket` (Play CB `35`): `VarInt entityId`, `PositionMoveRotation values`, `boolean onGround`.
- `ClientboundTeleportEntityPacket` (Play CB `123`): `VarInt entityId`, `PositionMoveRotation change`, `Relative.SET_STREAM_CODEC` (`int` bitmask), `boolean onGround`.

---

## 10. `EntityDataSerializers` (`aly`) — All 39 Serializers (`0..38`)

Verified in exact `static` registration order:

| ID | Name | Wire Codec / Format |
|---:|---|---|
| `0` | `BYTE` | `ByteBufCodecs.BYTE` (1 byte) |
| `1` | `INT` | `ByteBufCodecs.VAR_INT` |
| `2` | `LONG` | `ByteBufCodecs.VAR_LONG` |
| `3` | `FLOAT` | `ByteBufCodecs.FLOAT` (4-byte IEEE-754) |
| `4` | `STRING` | `ByteBufCodecs.STRING_UTF8` (max 32767) |
| `5` | `COMPONENT` | `ComponentSerialization.TRUSTED_STREAM_CODEC` (anonymous NBT tag) |
| `6` | `OPTIONAL_COMPONENT` | `Boolean` + (`ComponentSerialization.TRUSTED_STREAM_CODEC` if true) |
| `7` | `ITEM_STACK` | `ItemStack.OPTIONAL_STREAM_CODEC` |
| `8` | `BOOLEAN` | `ByteBufCodecs.BOOL` (1 byte) |
| `9` | `ROTATIONS` | `3 × float` (`x, y, z`) |
| `10` | `BLOCK_POS` | `long` packed `BlockPos` (`BlockPos.asLong()`) |
| `11` | `OPTIONAL_BLOCK_POS` | `Boolean` + (`long` `BlockPos` if true) |
| `12` | `DIRECTION` | `Direction.STREAM_CODEC` (`VarInt`: `0=DOWN, 1=UP, 2=NORTH, 3=SOUTH, 4=WEST, 5=EAST`) |
| `13` | `OPTIONAL_LIVING_ENTITY_REFERENCE` | `Boolean` + (`UUID` 16 bytes if true; `EntityReference.streamCodec()` wraps `UUIDUtil.STREAM_CODEC`) |
| `14` | `BLOCK_STATE` | `VarInt` (`Block.BLOCK_STATE_REGISTRY` ID) |
| `15` | `OPTIONAL_BLOCK_STATE` | `VarInt` (`0` = empty, else `Block.stateById(id)`) |
| `16` | `PARTICLE` | `ParticleTypes.STREAM_CODEC` (`VarInt` particle type ID + type-specific payload) |
| `17` | `PARTICLES` | `VarInt count` + `count × ParticleTypes.STREAM_CODEC` |
| `18` | `VILLAGER_DATA` | `VarInt villagerType`, `VarInt villagerProfession`, `VarInt level` (uses `holderRegistry`, NOT raw registry IDs — both write `VarInt` ID) |
| `19` | `OPTIONAL_UNSIGNED_INT` | `VarInt` (`0` = empty, else `value + 1`) |
| `20` | `POSE` | `VarInt` (`0..17`: `STANDING..INHALING`) |
| `21` | `CAT_VARIANT` | `VarInt` (`holderRegistry(Registries.CAT_VARIANT)`) |
| `22` | `COW_VARIANT` | `VarInt` (`holderRegistry(Registries.COW_VARIANT)`) |
| `23` | `WOLF_VARIANT` | `VarInt` (`holderRegistry(Registries.WOLF_VARIANT)`) |
| `24` | `WOLF_SOUND_VARIANT` | `VarInt` (`holderRegistry(Registries.WOLF_SOUND_VARIANT)`) |
| `25` | `FROG_VARIANT` | `VarInt` (`holderRegistry(Registries.FROG_VARIANT)`) |
| `26` | `PIG_VARIANT` | `VarInt` (`holderRegistry(Registries.PIG_VARIANT)`) |
| `27` | `CHICKEN_VARIANT` | `VarInt` (`holderRegistry(Registries.CHICKEN_VARIANT)`) |
| `28` | `ZOMBIE_NAUTILUS_VARIANT` | `VarInt` (`holderRegistry(Registries.ZOMBIE_NAUTILUS_VARIANT)`) |
| `29` | `OPTIONAL_GLOBAL_POS` | `Boolean` + (`Identifier dimension`, `long pos`) if true |
| `30` | `PAINTING_VARIANT` | `ByteBufCodecs.holder(Registries.PAINTING_VARIANT, PaintingVariant.DIRECT_STREAM_CODEC)`: `VarInt 0` -> inline `(VarInt width, VarInt height, Identifier assetId, Optional<Component> title, Optional<Component> author)`, else `VarInt id + 1` |
| `31` | `SNIFFER_STATE` | `VarInt` (`0=IDLING, 1=FEELING_HAPPY, 2=SCENTING, 3=SNIFFING, 4=SEARCHING, 5=DIGGING, 6=RISING`) |
| `32` | `ARMADILLO_STATE` | `VarInt` (`0=IDLE, 1=ROLLING, 2=SCARED, 3=UNROLLING`) |
| `33` | `COPPER_GOLEM_STATE` | `VarInt` (`0=IDLE, 1=GETTING_ITEM, 2=GETTING_NO_ITEM, 3=DROPPING_ITEM, 4=DROPPING_NO_ITEM`) |
| `34` | `WEATHERING_COPPER_STATE` | `VarInt` (`0=UNAFFECTED, 1=EXPOSED, 2=WEATHERED, 3=OXIDIZED`) |
| `35` | `VECTOR3` | `3 × float` (`x, y, z`) |
| `36` | `QUATERNION` | `4 × float` (`x, y, z, w`) |
| `37` | `RESOLVABLE_PROFILE` | `Either<GameProfile, Partial>` (`Boolean isFull`: if `true` -> `UUID id`, `String(16) name`, `PropertyMap`; if `false` -> `Optional<String(16)> name`, `Optional<UUID> id`, `PropertyMap`) + `PlayerSkin.Patch` (`Optional<Identifier> body`, `Optional<Identifier> cape`, `Optional<Identifier> elytra`, `Optional<Boolean> model` where `true=SLIM, false=WIDE`) |
| `38` | `HUMANOID_ARM` | `VarInt` (`0=LEFT, 1=RIGHT`) |

---

## 11. Other Key 1.21.11 Packets & Synchronized Registries

### 11.1 `ClientboundExplodePacket` (`aek`, Play CB `36`)

1. `center`: `Vec3.STREAM_CODEC` (`3 × double`)
2. `radius`: `float`
3. `blockCount`: `int` (4 bytes)
4. `playerKnockback`: `Optional<Vec3>` (`Boolean` + `3 × double` if present)
5. `explosionParticle`: `ParticleTypes.STREAM_CODEC`
6. `explosionSound`: `SoundEvent.STREAM_CODEC` (`VarInt 0` -> inline `(Identifier location, Optional<float> fixedRange)`, else `VarInt id + 1`)
7. `blockParticles`: `WeightedList.streamCodec(ExplosionParticleInfo.STREAM_CODEC)` -> `VarInt count` + `count` × (`ParticleTypes.STREAM_CODEC`, `float scaling`, `float speed`, `VarInt weight`)

### 11.2 Recipe & Recipe Book Packets (`afs`, `aft`, `afu`, `ahw`, `afg`)

- `ClientboundUpdateRecipesPacket` (`ahw`, Play CB `131`):
  - `itemSets`: `Map<ResourceKey<RecipePropertySet>, RecipePropertySet>`: `VarInt count` + `count` × (`Identifier key`, `VarInt itemCount` + `itemCount × VarInt itemId`)
  - `stonecutterRecipes`: `SelectableRecipe.SingleInputSet`: `VarInt count` + `count` × (`Ingredient` [`HolderSet<Item>`], `SlotDisplay optionDisplay`)
- `ClientboundRecipeBookAddPacket` (`afs`, Play CB `72`):
  - `entries`: `List<Entry>`: `VarInt count` + `count` × (`RecipeDisplayEntry`: `VarInt id`, `RecipeDisplay` [`VarInt typeId` (`0=crafting_shapeless, 1=crafting_shaped, 2=furnace, 3=stonecutter, 4=smithing`) + type payload], `OPTIONAL_VAR_INT group`, `VarInt categoryId`, `Optional<List<Ingredient>> craftingRequirements`; followed by `byte flags` where `1=FLAG_NOTIFICATION`, `2=FLAG_HIGHLIGHT`)
  - `replace`: `boolean`
  - `SlotDisplay` (`dse`, `0..7` in `minecraft:slot_display`): `0=empty`, `1=any_fuel`, `2=item` (`VarInt itemId`), `3=item_stack` (`ItemStack.STREAM_CODEC`), `4=tag` (`Identifier tag`), `5=smithing_trim` (`SlotDisplay base`, `SlotDisplay material`, `Holder<TrimPattern>`), `6=with_remainder` (`SlotDisplay input`, `SlotDisplay remainder`), `7=composite` (`List<SlotDisplay>`).
- `ClientboundRecipeBookRemovePacket` (`aft`, Play CB `73`): `List<RecipeDisplayId>` (`VarInt count` + `count × VarInt`).
- `ClientboundRecipeBookSettingsPacket` (`afu`, Play CB `74`): `RecipeBookSettings` = 4 × (`boolean open`, `boolean filtering`) for `CRAFTING`, `FURNACE`, `BLAST_FURNACE`, `SMOKER` (8 booleans total).
- `ClientboundPlaceGhostRecipePacket` (`afg`, Play CB `61`): `VarInt containerId`, `RecipeDisplay`.

### 11.3 `ClientboundPlayerInfoUpdatePacket` (`afn`, Play CB `68`)

- `actions`: `EnumSet<Action>` encoded as fixed 1-byte bitset (`writeFixedBitSet(..., 8)`):
  - `0 (0x01)`: `ADD_PLAYER` (`String(16) name`, `PropertyMap properties` [max 16 properties: `String(64) name`, `String(32767) value`, `Nullable String(1024) signature`])
  - `1 (0x02)`: `INITIALIZE_CHAT` (`Nullable RemoteChatSession.Data`: `UUID sessionId`, `ProfilePublicKey.Data`)
  - `2 (0x04)`: `UPDATE_GAME_MODE` (`VarInt gameModeId`)
  - `3 (0x08)`: `UPDATE_LISTED` (`boolean listed`)
  - `4 (0x10)`: `UPDATE_LATENCY` (`VarInt latency`)
  - `5 (0x20)`: `UPDATE_DISPLAY_NAME` (`Nullable ComponentSerialization.TRUSTED_STREAM_CODEC`)
  - `6 (0x40)`: `UPDATE_LIST_ORDER` (`VarInt listOrder`)
  - `7 (0x80)`: `UPDATE_HAT` (`boolean showHat`)
- `entries`: `writeCollection` (`VarInt count` + per-entry `UUID profileId` followed by each enabled action payload in enum ordinal order `0..7`).

### 11.4 `EnvironmentAttribute` (`cea`, `ceg`, `cec`) & Synchronized Registries (`RegistryDataLoader` / `ClientboundRegistryDataPacket`)

- `ClientboundRegistryDataPacket` (`ack`, Config CB `7`):
  - `Identifier registryKey`
  - `List<PackedRegistryEntry>` (`VarInt count` + `count` × (`Identifier id`, `Optional<Tag>` [`Boolean present` + anonymous NBT `Tag` if present; omitted when server & client share the known pack]))
- `RegistryDataLoader.SYNCHRONIZED_REGISTRIES` (`amp`, **23** synchronized registries):
  1. `minecraft:worldgen/biome` (`Biome.NETWORK_CODEC`)
  2. `minecraft:chat_type` (`ChatType.DIRECT_CODEC`)
  3. `minecraft:trim_pattern` (`TrimPattern.DIRECT_CODEC`)
  4. `minecraft:trim_material` (`TrimMaterial.DIRECT_CODEC`)
  5. `minecraft:wolf_variant` (`WolfVariant.NETWORK_CODEC`, `requiredNonEmpty=true`)
  6. `minecraft:wolf_sound_variant` (`WolfSoundVariant.NETWORK_CODEC`, `requiredNonEmpty=true`)
  7. `minecraft:pig_variant` (`PigVariant.NETWORK_CODEC`, `requiredNonEmpty=true`)
  8. `minecraft:frog_variant` (`FrogVariant.NETWORK_CODEC`, `requiredNonEmpty=true`)
  9. `minecraft:cat_variant` (`CatVariant.NETWORK_CODEC`, `requiredNonEmpty=true`)
  10. `minecraft:cow_variant` (`CowVariant.NETWORK_CODEC`, `requiredNonEmpty=true`)
  11. `minecraft:chicken_variant` (`ChickenVariant.NETWORK_CODEC`, `requiredNonEmpty=true`)
  12. `minecraft:zombie_nautilus_variant` (`ZombieNautilusVariant.NETWORK_CODEC`, `requiredNonEmpty=true`)
  13. `minecraft:painting_variant` (`PaintingVariant.DIRECT_CODEC`, `requiredNonEmpty=true`)
  14. `minecraft:dimension_type` (`DimensionType.NETWORK_CODEC`)
  15. `minecraft:damage_type` (`DamageType.DIRECT_CODEC`)
  16. `minecraft:banner_pattern` (`BannerPattern.DIRECT_CODEC`)
  17. `minecraft:enchantment` (`Enchantment.DIRECT_CODEC`)
  18. `minecraft:jukebox_song` (`JukeboxSong.DIRECT_CODEC`)
  19. `minecraft:instrument` (`Instrument.DIRECT_CODEC`)
  20. `minecraft:test_environment` (`TestEnvironmentDefinition.DIRECT_CODEC`)
  21. `minecraft:test_instance` (`GameTestInstance.DIRECT_CODEC`)
  22. `minecraft:dialog` (`Dialog.DIRECT_CODEC`)
  23. `minecraft:timeline` (`Timeline.NETWORK_CODEC`)
- **1.21.11 Environment Attribute System (`minecraft:environment_attribute`, 45 entries `0..44`)**:
  - `EnvironmentAttributeMap.NETWORK_CODEC` filters to `EnvironmentAttribute::isSyncable`. Entries encode either directly as value (`override` modifier) or `{ argument, modifier }`.
  - `Biome.NETWORK_CODEC` (`dxo`): `{ has_precipitation, temperature, temperature_modifier?, downfall, attributes?: EnvironmentAttributeMap, effects: BiomeSpecialEffects }`. `BiomeSpecialEffects` now contains only `water_color`, `foliage_color?`, `dry_foliage_color?`, `grass_color?`, `grass_color_modifier?` (`none`/`dark_forest`/`swamp`); sky/fog/water-fog colors, ambient particles, music, and ambient sounds moved into `attributes` (e.g., `minecraft:visual/sky_color`, `minecraft:visual/fog_color`, `minecraft:visual/water_fog_color`, `minecraft:visual/ambient_particles`, `minecraft:audio/background_music`, `minecraft:audio/ambient_sounds`).
  - `DimensionType.NETWORK_CODEC` (`esh`): `{ has_fixed_time?, has_skylight, has_ceiling, coordinate_scale, min_y, height, logical_height, infiniburn, ambient_light, monster_spawn_light_level, monster_spawn_block_light_limit, skybox? ("none"|"overworld"|"end"), cardinal_light? ("default"|"nether"), attributes?: EnvironmentAttributeMap, timelines?: HolderSet<Timeline> }`. Legacy boolean/effect fields (`natural`, `ultrawarm`, `bed_works`, `respawn_anchor_works`, `piglin_safe`, `has_raids`, `effects`, `fixed_time`) were replaced by `has_fixed_time`, `skybox`, `cardinal_light`, `attributes`, and `timelines`.
