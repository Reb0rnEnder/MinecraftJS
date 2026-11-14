# Status effects, recipe-book controls and player NPCs

Three inherited consumer assumptions caused the reported regressions:

- The 1.20.6 effect registry is zero-based, but gameplay checks still used older one-based IDs. Regeneration (native ID 9) was interpreted as nausea; haste, jump boost, levitation, blindness, invisibility, night vision, hunger and other checks were shifted too. Inventory labels additionally read the deferred/empty Creative metadata table, producing `No Effect`.
- Status backgrounds and recipe-book controls were still sampled from legacy sheet rectangles. The target jar contains separate GUI sprites for those rectangles, leaving the old regions transparent.
- The unified entity-spawn handler routed player entities into the generic object path. It set `pickable=false`, preventing NPC targeting and attack packets even though the player model could render.

Effect consumers now resolve IDs by native registry name and use the generated native definitions for labels/icons/categories. Inventory/HUD ordering follows `MobEffectInstance.compareTo`; infinity is neither an expired icon nor a finite nausea duration. The 1.20.6 blend flag and local `BlendState` replace the removed FactorData wire assumption. Six scenarios are executed through the exact Java blend class and compared frame by frame, including smooth/immediate application, expiry and infinity. The existing darkness renderer receives those native blend values.

The UV adapter now resolves large/compact inventory effect panels, normal/ambient HUD backgrounds, book-opening buttons, tabs, filters, recipe slots, page arrows and alternative-recipe buttons to native sprites. The alternative-recipe panel uses the target nine-slice sprite. These sprites participate in the existing startup GUI preload. Tests render the real GUI draw methods into a recording target, verify the resolved native paths/UVs and nontransparent source pixels, and check effect names/categories/alpha. This is not a claim of complete screenshot or graphical-backend parity for every menu.

Player spawn packets now create players, retaining UUID/name, head rotation and pickability. A regression exercises the real spawn → entity manager → ray targeting → attack sender path and checks the emitted `use_entity` attack. It does not claim a new live authenticated WebMC session was tested.

Native authority: pinned 1.20.6 jar/mappings, `ClientPacketListener`, `EffectRenderingInventoryScreen`, `RecipeBookComponent`, `MobEffectInstance` / `BlendState`, and the actual PNG/sprite metadata. The full native packet and item UI gates remain required. The relevant shared infinity/duration/order presentation fixes are backported to 1.19.4 (`d7fdfe7`, `c633317`, verification note `9ce5e0c`). Older releases retain their native effect IDs, GUI sheets and separate player-spawn packets; they do not receive the later protocol or sprite changes.

Reported banner/formatting regressions and hanging signs are separate open consumer work. The full parity checklist remains incomplete.
