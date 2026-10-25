# Native 1.14.4 workstation and block interaction milestone

This implements the next gameplay-interface/content milestone. It does not mark
1.14.4 as a complete parity release. The particle sprite migration, remaining
entity models/animations and native player poses are still separate milestones.

## Implemented

- Preserve blast furnace/smoker menu identity, use their own native backgrounds,
  and retain the native three-slot furnace progress properties.
- Add grindstone, cartography table, stonecutter and loom screens with the slot
  positions, title offsets, textures and selection grids from the pinned client.
- Consume Declare Recipes for stonecutting, filter the server's ingredients and
  sort results by item description ID, matching RecipeManager.getRecipesFor.
  Recipe selection, scrolling/dragging and tooltips use native menu-button packets.
- Loom: banner/dye/template inputs, all 34 ordinary patterns, five template
  patterns (including globe), six-pattern limit, scroll/drag selection and
  composed banner previews. Pattern indices follow BannerPattern ordinals.
- Native merchant Trade List codec, selection packet, seven-offer list,
  scrolling, discounted/demand-adjusted costs, level labels and XP bar.
- Lectern: server-supplied book, page property and previous/next/take-book menu
  buttons. Adventure/spectator viewers receive the single Done button.
- Native map packet's added lock flag, bounds-checked pixel rectangles and
  cartography preview for scaling, cloning and locking. Shulker containers use
  the native shulker background rather than the chest fallback.
- Workstation input/output restrictions. Clicks predict the carried stack, result-slot consumption and repeated
  shift-click transfers using native menu rules; accepted transactions do not
  necessarily echo these changes. Server-provided recipes/offers determine the
  results and prices, and incoming slot updates override local predictions.
- Recognize the new workstation blocks, barrels and bells as interactions before
  held-block placement; send scaffolding extension placement to the server rather
  than rejecting it using generic block-placement checks.
- Scaffolding collision uses player feet height and sneaking context: top platform
  and posts when standing above, bottom ledge where appropriate, and no solid box
  while climbing inside. Jump climbs, sneak descends, and ladder-style fall speed
  applies. Size checks use the same entity collision context.
- Bell body uses BellModel's 32x32 texture, two box parts, pivot and native
  directional damped swing. Block event 1 restarts the 50-tick animation; chunk
  scans and block changes discover bells. The ordinary block model retains the
  mounting support. Ring sounds and gameplay effects are sent by the server.

## Reference and validation

All constants/layouts are checked against the pinned Mojang 1.14.4 client jar
SHA-1 `8c325a0c5bd674dd747d6ebaa4c791fd363ad8a9` and its official mappings.
Relevant mapped classes: GrindstoneScreen/Menu, CartographyScreen/Menu,
StonecutterScreen/Menu, LoomScreen/Menu, MerchantScreen/Menu, LecternScreen/Menu,
RecipeManager, BannerPattern, BellModel, BellRenderer, BellBlockEntity,
ScaffoldingBlock, EntityCollisionContext and LivingEntity.

Run the native and shared regression checks:

```sh
node --test tools/test-1.14.4-*.mjs tools/test-font-providers.mjs tools/test-worker-snapshots.mjs
```

The content tests exercise routing/slots, packet framing, optional trade costs,
price calculation, native recipe ordering, selection/scroll behavior, inventory
output handling, map lock/rectangle decoding, bell model/event expiry and a
scaffolding tower's climb/descent/top-platform physics.

An isolated vanilla 1.14.4 test world is used for browser interaction checks,
without modifying the user's running world. Native workstation openings, loom
output, stonecutting output/cursor/input consumption, lectern page changes,
merchant offers and bell block events have been exercised against the server.
The live trading check verified a normal purchase, placing its output in the
inventory, and repeated shift-click purchases: all three transactions were
accepted, consuming three emeralds and producing 18 bread. A native TCP movement
probe climbed a scaffolding tower from Y=4 to Y=7.8304 and descended to Y=5.4227
with zero server position corrections. The combined regression suite passes
46 tests.

## Remaining and backport policy

This is functional workstation support, not a claim that every new block/entity
is complete. Remaining work includes native recipe-book integration, book text
click-event navigation, map preview decoration icons, bell raid-resonance client
particles, campfire item/flame block-entity effects, newer sign types, native
villager/entity rendering and player pose/crawling rules. Broader placement,
waterlogged movement and automation behavior still need vanilla comparison.

The changes here depend on 1.14 menus, packets, item/block registries and new
climbing behavior. They must not be backported to 1.13.2, 1.12.2 or 1.8.9. No
stable-version artifact changes are needed for this milestone.
