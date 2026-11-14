# Native sign and loom correction

Recognize native mangrove signs and the hanging-sign variants already present in
the 1.19.4 experiment. Extract the target hanging layer and select its wall plank,
normal chains or attached V chains. Route `hanging_sign` block-entity updates to
the sign consumer rather than discarding their text. Feature requirements and
Creative gates are unchanged.

The 1.19.4 `HangingSignRenderer`/`SignRenderer` and model definitions were inspected
in the pinned jar `958928a560c9167687bea0cefeb7375da1e552a8` with official mappings.
The target retains `Text1..Text4`, a single text face, hanging text scale 1 and
Z offset 0.063. The 1.20 front/back fields, 0.9 scale and 0.073 offset are not
backported. Native model assets have been regenerated locally.

Native `LoomMenu.clickMenuButton` takes a selectable-list index. Follow server tag
order and send that index, including single pattern-item results. Existing legacy
banner NBT and native compositor remain unchanged.

Nine sign/dispatch/loom/lighting/banner/image regressions and the browser entry
bundle pass. This is scoped source/CPU validation, not a live server/GPU parity
claim. Earlier targets have no hanging-sign feature added.
