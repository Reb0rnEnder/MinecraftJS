# Signs, banners and resource images

The 1.20.6 port inherited sign-name checks, text fields and banner item/NBT readers
from older targets. Hanging signs were excluded from the tile renderer, their
block-entity data was dropped by Game dispatch, and modern patterns never reached
the banner/shield compositor.

The renderer now recognizes all registered sign woods, uses the extracted native
hanging-sign model and selects wall/normal/attached chain parts. Both text sides
read native `front_text`/`back_text`, including their JSON-string messages, dye,
glow and filtered variants. Each side has independent lighting. Editing retains
the server-selected face, sends plain text with the corresponding boolean, uses
the hanging sign's 60px limit, and preserves the opposite side.

Banner and shield items consume effective `banner_patterns`/`base_color`
components. Placed banners read lowercase `patterns`, modern dye names and holder
keys. Inline patterns and Configuration-owned registry IDs resolve to their
native asset locations. The lookup is cached by Configuration generation; it does
not traverse the dimension codec every inventory frame. Icon keys include the
resolved pattern layers. Loom choices use server tag order and send a list index,
rather than the obsolete hard-coded pattern ID. Standalone images preserve
resource namespaces through loading and caching.

Native evidence: SHA-1 `05b6f1c6b46a29d6ea82b4e0d42190e42402030f`,
`SignRenderer`, `HangingSignRenderer`, `SignText`, `BannerBlockEntity`,
`BannerPatternLayers`, `LoomMenu` and model layer definitions. Java oracles record
68 real sign frame/scale/text-offset/chain cases, native SignText serialization,
and three actual banner/shield ItemStack packets (including an inline pattern).
The target suite passes 220 tests. This batch's native oracles and browser entry
bundle also pass. 1.20.6 assets have been regenerated, including the new model.

History cross-checks: [1.20.5 release notes](https://feedback.minecraft.net/hc/en-us/articles/26136167989005-Minecraft-Java-Edition-1-20-5-Armored-Paws)
document banner components, modern pattern names and datapack definitions;
the [versioned Wiki](https://minecraft.wiki/w/Java_Edition_1.20.5) agrees.
[Hanging-sign history](https://minecraft.wiki/w/Hanging_Sign) distinguishes the
1.19.4 experiment from stable 1.20 content.

Backports: image loading has 54 passing image/model/banner regressions across
1.8.9–1.19.4. Native supplementary TTF skip handling is corrected in 1.16.5–1.19.4,
with 28 font regressions. 1.19.4 additionally restores its native woods and
experimental hanging model, block-entity dispatch and loom list indices; nine
scoped checks pass. Its legacy text fields, single face, scale 1 and 0.063 text
offset remain native to that target. No 1.20 sign fields, banner components or
new assets are copied into earlier versions. Older hanging-sign feature flags
are unchanged; earlier targets have no hanging-sign model added.

Remaining acceptance: authenticated WebMC/resource-pack scenes and GPU screenshot
comparisons, exact sign-editor preview/layout, remaining wax/filtered-account
flows and unrelated component families. These changes do not certify full parity.
