# Minecraft 1.13.2 client parity audit

Code review: 2026-10-24. Reference: the pinned `cache/1.13.2.jar` (protocol 404).
This is a list of confirmed gaps and validation work, not a percentage-complete claim
or an exhaustive certification of every vanilla feature. This project is a multiplayer
client; world generation, mob AI and authoritative gameplay belong to the server.

## Confirmed gaps, in recommended implementation order

| Area | Current gap | Evidence / starting point |
| --- | --- | --- |
| Protocol synchronization | Declare Commands (`0x11`) and Tags (`0x55`) are decoded and used by command input/F3. Declare Recipes (`0x54`) and NBT Query Response (`0x1d`) remain missing. Full selector-option/SNBT semantic validation and argument-specific suggestions still need parity work. | `client/js/net/packets.js`, `client/js/game/game.js` |
| Dedicated serverbound packets | Command/command-minecart editing, structure editing, book editing/signing, anvil renaming, beacon selection and trade selection still use custom-payload implementations. Renaming their channels does not implement the dedicated 1.13 packets. | `client/js/gui/screens/{commandblock,structure,book,containers}.js` |
| Particles | World-particle IDs and block/dust/item payloads now follow the native registry. Several newer effect renderers are still missing; area-effect clouds use default spell particles instead of all metadata-selected types. | `client/js/net/packets.js`, `client/js/render/particles.js`, `client/js/game/entities.js` |
| Crafting and recipe UI | Local crafting matching, repair and container remainders retain legacy metadata assumptions. Repair reads `stack.damage` instead of native NBT Damage. Datapack recipe synchronization and the complete furnace recipe-book flow are incomplete; synchronized tags are available to command/F3 consumers. | `client/js/game/{crafting,container,recipebook}.js`, `client/js/gui/screens/containers.js` |
| Movement and effects | Water pose gating, swim steering, sprint drag, water gravity, Dolphin's Grace drag and equipped Depth Strider are implemented. Full current/bubble-column behavior and air Slow Falling still need audit/implementation. | `client/js/game/physics.js`, `Game._applyEffects`, `client/js/world/fluids.js` |
| Pistons and interaction | Piston mobility/tile-entity lists and several interaction lists still contain pre-flattening names. Native identities are not sufficient when state behavior still assumes legacy names/metadata. | `client/js/game/{pistons,interaction}.js` |
| Horse-family containers | The horse window assumes two equipment slots and a fixed 5-column chest. Donkey/mule restrictions and llama carpet/strength-dependent layouts need species-specific handling. | `HorseScreen` in `client/js/gui/screens/containers.js` |
| Player heads | Block and item player heads select the default Steve texture; SkullOwner/profile texture resolution is missing. | `client/js/render/{tile-renderer,item-renderer}.js` |
| Underwater rendering | Biome water/fog colours, five-second transitions, EXP2 fog and underwater adaptation are implemented. Full underwater overlay lighting and visual comparison on each GPU backend still need verification. | `client/js/render/renderer.js` |
| Built-in item effects | Built-in entity item models, including the held trident, do not yet have the complete enchanted-glint rendering path. | `ItemRenderer.objectFor`, `client/js/render/item-renderer.js` |
| Trident polish | Riptide propulsion, wetness checks, charge threshold and body spin are implemented. The Riptide vortex layer is implemented. Complete client collision/bounce prediction and all Loyalty/Channeling presentation still need verification or implementation. Damage, durability, projectile creation and enchantment outcomes remain server authoritative. | `client/js/game/{interaction,physics,entities}.js`, `client/js/render/entity-renderer.js` |

## Recently corrected

- Native flattened blocks/items/entities and an 83-model jar-derived bundle are in use.
- Numeric sound IDs now follow all 662 registrations in the 1.13.2 jar.
- Automatic chat command suggestions require `/`; ordinary chat gets player-name suggestions on Tab. Command input parses the server tree, colours arguments with the vanilla palette, marks unread errors red, and supports wheel/keyboard suggestion navigation. F3 shows synchronized block/fluid tags, including both vanilla sand tags.
- Boats use the correct ice slipperiness, including faster blue ice.
- Held tridents use the 3D model and first-person charging transforms.
- Player swimming strokes match the jar bytecode, with vanilla pose blending.
- Creative main-hand barrier markers spawn locally and are revalidated before drawing and ticking, so item switches and block removal hide them immediately.
- All 50 particle IDs follow jar registration order, and world particles decode native block/dust/item payloads.
- Riptide I/II/III applies the local look-direction impulse after a ten-tick
  charge in water or exposed rain, retains the stack, lifts from the ground
  through collision handling, and sends release packets even for short charges.

- Dragon healing/crystal-target beams and guardian/elder guardian attack beams now render.
- Dragon death has the 200-tick dissolve, seeded light rays and explosion emitters.
- Riptide draws the vanilla spinning texture shells in the third-person player model.

## Validation still required before claiming full parity

- End-to-end tests against a vanilla 1.13.2 server for the protocol and UI flows above.
- GPU/browser comparison for models, effects, resource packs, fonts, lighting and animation.
- Exact movement traces covering slopes, currents, bubble columns, enchantments,
  collisions, vehicles, Riptide impacts and server corrections.
- A systematic registry/packet/feature checklist; passing the present regression
  suite proves its covered cases, not all vanilla behavior.
