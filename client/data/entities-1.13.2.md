# Protocol 404 entity contract and audit

## Sources

Registry, superclass metadata layouts, dimensions, spawn-object dispatch and painting
motives were audited directly from `cache/1.13.2.jar`:

- Version: **Minecraft Java 1.13.2**, protocol **404**.
- Client jar SHA-1: **`30bfe37a8db404db11c7edf02cb5165817afb4d9`**.
- `aev.<clinit>`: 95 registry entries, IDs 0–94.
- `ot.<clinit>`: serializer registration order; `ou`: inherited parameter allocation.
- `aer`: base entity; `afa`: living base; `afb`: living mob; `aeo`: ageable.
- `aog`: player; `alz`: armor stand; `anw` / `anx`: zombie / zombie villager.
- `crd.a(iz)`: all 28 spawn-object IDs, their namespace, data interpretation and velocity handling.
- `amd.<clinit>`: all 26 painting motives and dimensions.
- `aoo`: evoker-fangs status 4 and animation lifetime.

The packet format was also cross-checked with PrismarineJS/minecraft-data,
commit `1df9432c07c81b47326e4fb1e06d3c8d723bf4aa`,
`data/pc/1.13.2/protocol.json`. No moving branch is needed to run the tests.

`entities.json` retains its existing array format. `type: "mob"` means the **entity
registry namespace**, including its non-mob entries; it does not assert that every
registry entry is valid in Spawn Mob. `type: "object"` is the separate spawn-object
namespace. JSON `internalId` identifies the corresponding **native registry ID**,
not a renderer selector. Width/height are unscaled dimensions (cloud default radius
3, fully inflated pufferfish); metadata adjusts dynamic bounds. Hanging entities
also have orientation-dependent `e.box`.

## Identity and renderer selectors

- `e.entityName` is authoritative canonical identity, such as `zombie`, `husk`, or
  `armor_stand`. Metadata dispatch uses this name.
- `e.entityType` preserves the original packet type **without remapping**.
- `e.entityNamespace` is `entity` for Spawn Mob, `object` for Spawn Object, and
  `weather` for Spawn Global Entity. The dedicated player/orb/painting packets
  have no wire type to preserve; they still set canonical `entityName`.
- `e.type` for implemented mobs is the following INTERNAL renderer selector. It
  must never be used to look up the protocol registry. Existing object renderers
  retain their object-ID selector in `e.type`.
- Unknown native mob IDs have `entityName: null`, `type: "unknown:<id>"`,
  `kind: "unknown_mob"`, zero dimensions and `pickable: false`. Known nonliving
  registry entries sent as mobs also use `unknown_mob`. There is no inferred
  humanoid identity. Unknown objects use `unknown_object`.

### Exact numeric family mapping

All flags in this table are identity flags assigned at spawn; unlisted flags are
absent. They are not inferred from metadata or numeric wire-ID coincidences.

| Canonical name (wire ID) | Internal `e.type` | Identity flags |
| --- | ---: | --- |
| creeper (10) | 50 | |
| skeleton (62) | 51 | |
| wither_skeleton (84) | 51 | `wither: true` |
| stray (71) | 51 | `stray: true` |
| spider (69) | 52 | |
| giant (27) | 53 | |
| zombie (87) | 54 | |
| husk (30) | 54 | `husk: true` |
| zombie_villager (89) | 54 | `villagerZombie: true` |
| slime (64) | 55 | |
| ghast (26) | 56 | |
| zombie_pigman (53) | 57 | |
| enderman (18) | 58 | |
| cave_spider (6) | 59 | |
| silverfish (61) | 60 | |
| blaze (4) | 61 | |
| magma_cube (38) | 62 | |
| ender_dragon (17) | 63 | |
| wither (83) | 64 | |
| bat (3) | 65 | |
| witch (82) | 66 | |
| endermite (19) | 67 | |
| guardian (28) | 68 | |
| elder_guardian (15) | 68 | `elder: true` |
| shulker (59) | 69 | |
| pig (51) | 90 | |
| sheep (58) | 91 | |
| cow (9) | 92 | |
| chicken (7) | 93 | |
| squid (70) | 94 | |
| wolf (86) | 95 | |
| mooshroom (47) | 96 | |
| snow_golem (66) | 97 | |
| ocelot (48) | 98 | |
| iron_golem (80) | 99 | |
| horse (29) | 100 | `horseType: 0` |
| donkey (11) | 100 | `horseType: 1` |
| mule (46) | 100 | `horseType: 2` |
| zombie_horse (88) | 100 | `horseType: 3` |
| skeleton_horse (63) | 100 | `horseType: 4` |
| rabbit (56) | 101 | |
| villager (79) | 120 | |

### String families

For these names `e.type === e.entityName`, and `e.kind === "mob"`:

`cod` (8), `dolphin` (12), `drowned` (14), `evoker` (21), `illusioner` (31),
`llama` (36), `parrot` (50), `pufferfish` (52), `polar_bear` (54), `salmon` (57),
`tropical_fish` (72), `turtle` (73), `vex` (78), `vindicator` (81), `phantom` (90).

Registry `armor_stand` (1) uses `type: "armor_stand"`, `kind: "armorstand"`.
Object armor stand (78) also has `kind: "armorstand"`, but preserves object type 78.

### Exact object dispatch

| Object wire ID | Canonical name | `e.kind` |
| ---: | --- | --- |
| 1 | boat | boat |
| 2 | item | item |
| 3 | area_effect_cloud | **area_effect_cloud** |
| 10 | minecart (see data below) | minecart |
| 50 | tnt | tnt |
| 51 | end_crystal | crystal |
| 60 | arrow | arrow |
| 61 | snowball | projectile |
| 62 | egg | projectile |
| 63 | fireball | projectile |
| 64 | small_fireball | projectile |
| 65 | ender_pearl | projectile |
| 66 | wither_skull | projectile |
| 67 | shulker_bullet | **shulker_bullet** |
| 68 | llama_spit | **llama_spit** |
| 70 | falling_block | falling |
| 71 | item_frame | itemframe |
| 72 | eye_of_ender | projectile |
| 73 | potion | projectile |
| 75 | experience_bottle | projectile |
| 76 | firework_rocket | projectile |
| 77 | leash_knot | leash |
| 78 | armor_stand | armorstand |
| 79 | evoker_fangs | **evoker_fangs** |
| 90 | fishing_bobber | fishhook |
| 91 | spectral_arrow | **spectral_arrow** |
| 93 | dragon_fireball | **dragon_fireball** |
| 94 | trident | **trident** |

Bold kinds are the seven newly dispatched renderer kinds. Dimensions for every
entry are in the JSON and runtime `OBJECT_TYPES` table.

Minecart data 0–6 sets `cartType` and, respectively, canonical `minecart`,
`chest_minecart`, `furnace_minecart`, `tnt_minecart`, `spawner_minecart`,
`hopper_minecart`, `command_block_minecart`. Wire `entityType` remains 10.

## Metadata audit

Serializer IDs: **0** Byte, **1** VarInt, **2** Float, **3** String, **4** Chat,
**5** Optional Chat, **6** Slot, **7** Boolean, **8** Rotation, **9** Position,
**10** Optional Position, **11** Direction, **12** Optional UUID,
**13** Optional direct block-state VarInt (0 = absent, no leading Boolean),
**14** NBT, **15** Particle. Optional values retain `null`. Metadata ends at byte
`0xff`. Slots have Boolean presence, VarInt ID, byte count and named-root NBT
(no legacy damage field on the wire); the compatibility slot object has `damage: 0`.

Particle values are `{ particleId, data }`: 3/20 have `{ blockState }`, 11 has
`{ red, green, blue, scale }`, 27 has `{ item }` (a slot), others have `{}`.
Raw NBT retains its typed `{ t, name, v }` representation, including shoulder NBT.

| Class / canonical names | Additional indices and public properties |
| --- | --- |
| Base entity | 0 flags; 1 `air`; 2 optional chat → `customName` (raw preserved); 3 `nameVisible`; 4 `silent`; 5 `noGravity` |
| Living base | 6 hand flags (`usingItem`, `activeHand`, `riptide`); 7 `health`; 8 `potionColor`; 9 `potionAmbient`; 10 `arrowCount` |
| Living mob | 11 bit 1 `noAI`, bit 2 `leftHanded` |
| Player | 11 `absorption`; 12 `score`; 13 `skinFlags`; 14 `mainHand`; 15/16 `leftShoulder`/`rightShoulder` NBT |
| Armor stand | 11 `armorFlags` (1 small, 4 arms, 8 no base, 16 marker); 12–17 rotations in `poses.head/body/leftArm/rightArm/leftLeg/rightLeg` |
| Ageable animals and villager | 12 `child`; updates physical dimensions |
| zombie/husk/drowned/zombie_pigman/zombie_villager | 12 `child`; 13 unused legacy `zombieSpecialType`; 14 `armsRaised`; 15 `convertingToDrowned` |
| zombie_villager | **16 `converting`, 17 `villagerProfession`** |
| bat | 12 bit 1 `hanging` |
| blaze | 12 bit 1 `blazeOnFire` |
| creeper | 12 `creeperState`; 13 `powered`; 14 `ignited` |
| skeleton/wither_skeleton/stray | 12 `armsRaised` (not baby) |
| spider/cave_spider | 12 bit 1 `climbing` |
| slime/magma_cube | 12 `size`; dimensions `0.51000005 * size` |
| enderman | 12 `carriedBlockState` and `carried` (both **direct state IDs**); 13 `screaming` |
| ender_dragon | 12 `dragonPhase` |
| ghast | 12 `attacking` (not baby) |
| guardian/elder_guardian | 12 `guardianMoving`; 13 `guardianTarget` |
| shulker | 12 `attachFace`; 13 optional `attachPosition`; 14 `peekTick`; 15 `shulkerColor` |
| wither | 12–14 `witherTargets`; 15 `invulTime` |
| witch | 12 `witchAggressive` (not baby) |
| evoker/illusioner/vindicator | 12 `illagerFlags` (bit 1 → `armsRaised`); spellcasters add 13 `spell` |
| vex | 12 bit 1 `charging` |
| pig | 13 `saddled`; 14 `boostTime` |
| sheep | 13 low four bits `fleece`, bit 16 `sheared` |
| wolf/ocelot/parrot | 13 tameable flags (1 sitting, 4 tamed); 14 optional `ownerUuid` |
| wolf | 13 bit 2 `angry`; 15 `wolfHealth`; 16 `begging`; 17 `collar` |
| ocelot / parrot | 15 `catType` / `parrotVariant` |
| rabbit / villager | 13 `rabbitType` / `profession` |
| horse/donkey/mule/skeleton_horse/zombie_horse/llama | 13 horse flags; 14 optional `ownerUuid` |
| horse | 15 `horseVariant`; 16 `horseArmor` |
| donkey/mule/llama | 15 `horseChest` |
| llama | 16 `llamaStrength`; 17 `llamaCarpet` (-1 = none); 18 `llamaVariant` |
| polar_bear | 13 `standing` |
| snow_golem / iron_golem | 12 bit 16 `hasPumpkin` / bit 1 `playerCreated` |
| dolphin | 12 `treasurePosition`; 13 `gotFish`; 14 `moistness` |
| turtle | 13 `homePosition`; 14 `hasEgg`; 15 `layingEgg`; 16 `travelPosition`; 17 `goingHome`; 18 `travelling` |
| cod/salmon/pufferfish/tropical_fish | 12 `fromBucket` (**not child**) |
| pufferfish / tropical_fish | 13 `puffState` / `fishVariant` |
| phantom | 12 `phantomSize`; updates physical dimensions |
| item/potion | 6 `item` (nullable slot) |
| item_frame | 6 `item`; 7 `rotation` |
| firework_rocket | 6 `item`; 7 `boostedId` |
| arrow/spectral_arrow/trident | 6 bit 1 `critical`; 7 optional `ownerUuid` |
| arrow / trident | 8 `arrowColor` / `loyalty` |
| fishing_bobber | 6 encoded entity ID + 1 → `hookedEntityId` (-1 = none) |
| falling_block / tnt / wither_skull | 6 `origin` / `fuse` / `invulnerable` |
| end_crystal | 6 optional `beamTarget`; 7 `showBottom` |
| boat | 6 `timeSinceHit`; 7 `forwardDirection`; 8 `damageTaken`; 9 `boatType`; 10/11 paddles; 12 `bubbleTime` |
| all minecarts | 6 `rollingAmplitude`; 7 `rollingDirection`; 8 `cartDamage`; 9 direct-state `displayBlock`; 10 `displayOffset`; 11 `customDisplay` |
| furnace_minecart / command_block_minecart | 12 `furnacePowered` / 12 `command`, 13 raw-chat `lastOutput` |
| area_effect_cloud | 6 `radius`; 7 `cloudColor`; 8 `singlePoint`; 9 `particle` |

Chicken, cow, mooshroom, squid, silverfish, endermite, giant, and objects not listed
with extra fields have only their inherited parameters. Metadata updates merge
into `e.metadata`, but only the delta is applied to derived state, so unrelated
updates cannot restart a TNT fuse or clear an item-frame rotation.

`horseFlags` deliberately preserves the existing renderer's layout: native bits
2/4 remain tame/saddle, native 16→internal32 (eating), 32→64 (rearing), 64→128
(mouth open), and internal8 is chest presence. Native bit8 is separately exposed
as `horseBred`; `tamed` and `saddled` are also explicit booleans.

## Renderer integration

1. The renderer now dispatches all fifteen string mob families and seven new
   object kinds. Unknown identities remain unsupported, rather than borrowing a
   Steve model. The extractor requires **83 models / 648 boxes** from the jar.
2. Enderman `carriedBlockState`, falling `blockState`, and cart `displayBlock` use
   the flattened state registry directly. Cart orientation uses named rail shapes,
   not a legacy damage nibble.
3. Item-frame `facing` is now the actual **six-direction** value: 0 down, 1 up,
   2 north, 3 south, 4 west, 5 east. Rendered geometry matches `itemFrameBox` bounds.
   Filled maps use native item identity and NBT `map`; late map packets refresh
   the frame contents and the `map=true` model variant.
   Painting facing remains horizontal: 0 south, 1 west, 2 north, 3 east.
4. Painting packet `title` is a motive VarInt. Entity `paintingId` preserves it;
   `paintingName` is canonical; entity `title` retains atlas names (`Kebab`,
   `SkullAndRoses`, etc.). Its dimensions and box are available before rendering.
5. Child `width`/`height` are physical child bounds, not adult bounds; do not halve
   them again for picking or name-tag placement. Model geometry still needs child
   scaling. Metadata invisibility and armor-stand marker flags remain authoritative.
6. Fangs expose `fangsActive`, `fangsLife`, `prevFangsProgress`, `fangsProgress`.
   Status 4 activates them; progress rises from 0 to 1 over 20 ticks. Server destroy
   controls lifetime. Fireballs expose normalized acceleration in `accelX/Y/Z`;
   spit and shulker bullets retain constructor velocity even with object data 0.
7. Use the named variant fields in the audit table for new model/texture selection
   (especially llama carpet/variant, parrot variant, fish variant, puff state,
    phantom size, spell, charging, turtle eggs, polar-bear standing).
8. Swimming is now predicted locally for sprinting players in water, uses the
   1.13 `0.6`-block pose hitbox/eye height, and renders remote metadata flag 4 as
   a horizontal living pose. The server remains authoritative for the final
   remote metadata state.

### Integration regressions and remaining limits

`tools/test-1.13.2-entity-rendering.mjs` exercises real spawn packets, metadata,
the entity manager, model poses and textured draw submission for every supported
living type and all 28 object kinds. It covers variant rebuilds, all six frame
orientations/maps, direct-state cart displays, boats, carried blocks, fangs and
unknown identities. Invisible bodies stay hidden while equipped armor, elytra,
headwear and held items remain independently renderable. Empty invisible marker
stands stay text-only; player visibility updates are not deferred by animation LOD.

`tools/test-1.13.2-entity-consumers.mjs` verifies native creative entity/block
picking and outgoing slot packets, block-placement identity, deep stack copies,
interaction tools, and sound identity against the jar's sound-event registry.
The protocol smoke fixtures now use actual Byte flags and native zombie ID 87.

These are CPU/packet integration checks, not proof of live-server/GPU appearance.
Area-effect clouds currently emit their default colored spell particles; alternate
metadata-selected particle types and the broader 1.13 particle pipeline still need
porting. Owner-specific player-head skins and the generic horse-container layout
remain separate work. Regenerate both assets and the standalone client after
changing model extraction; an old 66-model asset bundle cannot render the new mobs.

## Verification

`node tools/test-1.13.2-entities.mjs` exercises encoded Spawn Mob/Object/Player,
metadata, equipment, painting, teleport and status packets through EntityManager;
all serializers and particle payloads; family flags; names/invisibility/markers;
dynamic bounds; all 28 objects; variant-specific indices; and identity-sensitive
ticking. With the local jar present it also independently verifies all 95 registry
names, living-class inheritance, fixture serializer indices and painting order.
Without that jar only the explicit primary-source audit test is skipped; packet
regression tests remain offline and runnable.

Full integration/build checks (from the 1.13.2 worktree):

```sh
node --test --test-reporter=spec tools/test-1.13.2-*.mjs
npm run assets
npm run build
node tools/test-1.13.2-entity-models.mjs --built
```
